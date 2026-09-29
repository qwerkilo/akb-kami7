/* Service Worker：可安装 + 离线可用。
 *
 * 策略与选型见 docs/adr/0016-pwa.md；「哪个请求进哪个桶、容量多少」在
 * sw-cache-rules.js（纯函数，node 可直接测），本文件只管 SW 生命周期：
 * 缓存名、install/activate/fetch 监听器、两种取数策略。
 */
importScripts("sw-cache-rules.js");

const RULES = self.AKB_CACHE_RULES;
const VERSION = "v1";
const SHELL_CACHE = "akb-shell-" + VERSION;
const IMG_CACHE = "akb-img-" + VERSION;
const FONT_CACHE = "akb-font-" + VERSION;
const KEEP = [SHELL_CACHE, IMG_CACHE, FONT_CACHE];

self.addEventListener("install", (e) => {
  // 逐个 add 而不是 addAll：某个文件 404 时其余仍能进缓存，站点至少还有离线能力
  e.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((c) => Promise.allSettled(RULES.SHELL_FILES.map((f) => c.add(f))))
  );
  // 新版本立即激活（不再等 waiting 被 postMessage 叫醒——实测那条路在
  // headless 环境里收不到消息，skipWaiting 永远不发生；真实浏览器可行但
  // 本项目不依赖它，所以那条死协议已删）。
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

const CACHE_OF = {
  img: [IMG_CACHE, RULES.IMG_CAP],
  font: [FONT_CACHE, RULES.FONT_CAP],
};

self.addEventListener("fetch", (e) => {
  const plan = RULES.classify(e.request, self.location);
  if (!plan) return; // 直连：非 GET、其余同源杂项、非字体域的跨源
  if (plan.kind === "shell") {
    e.respondWith(networkFirst(e.request));
    return;
  }
  const [cacheName, cap] = CACHE_OF[plan.kind];
  e.respondWith(cacheFirst(e.request, cacheName, cap));
});
