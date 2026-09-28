/* Service Worker：可安装 + 离线可用。
 *
 * 策略（见 docs/adr/0016-pwa.md）：
 * - 壳与导航：network-first，在线永远拿最新（小站往返几十毫秒），离线回落缓存秒开。
 *   不设需要人工维护的版本号——本站没有构建步骤，忘了改就会让用户长期吃旧壳。
 * - 图片：cache-first（URL 永不失效）+ FIFO 封顶 600 条，避免涨到 85MB 全量。
 * - 跨源字体（Google Fonts）：cache-first，首次访问后离线仍用原字体。
 * 更新时不 skipWaiting：等用户在横幅上点「刷新」，绝不自动 reload 打断进行中的对决。
 */
const VERSION = "v1";
const SHELL_CACHE = "akb-shell-" + VERSION;
const IMG_CACHE = "akb-img-" + VERSION;
const FONT_CACHE = "akb-font-" + VERSION;
const KEEP = [SHELL_CACHE, IMG_CACHE, FONT_CACHE];
const IMG_CAP = 600;
const FONT_CAP = 500; // Google Fonts 的 unicode-range 子集实测 200+ 条，封个顶防异常膨胀
const SHELL_FILES = [
  "./",
  "index.html",
  "style.css",
  "core.js",
  "session.js",
  "poster.js",
  "i18n.js",
  "members.js",
  "simplified.js",
  "app.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
];
const SHELL_NAMES = new Set(
  SHELL_FILES.filter((f) => f !== "./").map((f) => f.split("/").pop())
);

self.addEventListener("install", (e) => {
  // 逐个 add 而不是 addAll：某个文件 404 时其余仍能进缓存，站点至少还有离线能力
  e.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((c) => Promise.allSettled(SHELL_FILES.map((f) => c.add(f))))
  );
  // 新版本立即激活（不等「waiting」被 postMessage 叫醒——实测那条路不可靠：
  // 消息发给 waiting 里的 worker 收不到，skipWaiting 永远不发生）。
  // 页面仍然不会自动刷新：app.js 只在用户点横幅上的「刷新」时才 reload，
  // 壳又是 network-first，所以激活本身对用户不可见。
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // 只清本应用自己的缓存：同源（user.github.io）下别的应用的缓存不能删
      await Promise.all(
        keys
          .filter((k) => k.startsWith("akb-") && !KEEP.includes(k))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "skip-waiting") self.skipWaiting();
});

async function trim(cache, cap) {
  const keys = await cache.keys(); // 插入顺序，FIFO 淘汰最旧的
  if (keys.length <= cap) return;
  await Promise.all(
    keys.slice(0, keys.length - cap).map((k) => cache.delete(k))
  );
}

// 写缓存失败（配额满等）绝不该影响响应本身
async function put(cache, req, res) {
  try {
    await cache.put(req, res.clone());
  } catch (_) {}
}

async function networkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) await put(cache, req, res);
    return res;
  } catch (err) {
    const hit =
      (await cache.match(req)) ||
      (req.mode === "navigate" ? await cache.match("index.html") : null);
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req, cacheName, cap) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === "opaque")) {
    await put(cache, req, res);
    if (cap) await trim(cache, cap);
  }
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (
    req.mode === "navigate" ||
    (sameOrigin && SHELL_NAMES.has(url.pathname.split("/").pop()))
  ) {
    e.respondWith(networkFirst(req));
    return;
  }
  if (sameOrigin && url.pathname.includes("/img/")) {
    e.respondWith(cacheFirst(req, IMG_CACHE, IMG_CAP));
    return;
  }
  if (!sameOrigin) {
    // 字体等跨源资源：命中即用，miss 落盘（含 opaque，跨源拿不到状态码也照收）
    e.respondWith(cacheFirst(req, FONT_CACHE, FONT_CAP));
    return;
  }
  // 其余同源请求直连（图片以外的杂项不该被缓存）
});
