/* Service Worker 的缓存分类规则：哪个请求进哪个桶、容量多少。
 *
 * 纯函数 + 常量，不碰任何 SW 全局：service worker 用 importScripts 引入它，
 * node 测试直接 require 同一份文件——于是「分类规则」成为可断言的规则，
 * 而不是三段只能靠 grep 源码确认形状的 if。
 *
 * 壳文件清单的权威出处也在这里（sw.js 只保留与 SW 生命周期相关的部分：
 * 缓存名、install/activate/fetch 监听器与两种取数策略）。
 */
(function (root) {
  const IMG_CAP = 600; // full 与 thumb 共用一栏，约覆盖 300 人
  const FONT_CAP = 500; // Google Fonts 的 unicode-range 子集实测 200+ 条，封个顶防异常膨胀
  // 跨源只收这两个域：它们是 warmFonts（app.js）预热的同一批资源。
  // 另一份在 app.js 的 warmFonts——改字体源时两处要一起改（页面侧由断网 E2E 兜底）。
  const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
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
    "sw-cache-rules.js",
    "manifest.webmanifest",
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/icon-maskable-512.png",
  ];
  const SHELL_NAMES = new Set(
    SHELL_FILES.filter((f) => f !== "./").map((f) => f.split("/").pop())
  );

  /** 请求该走哪条策略：null = 直连不过缓存。 */
  function classify(req, loc) {
    if (req.method !== "GET") return null;
    const url = new URL(req.url, loc.origin);
    const sameOrigin = url.origin === loc.origin;
    if (
      req.mode === "navigate" ||
      (sameOrigin && SHELL_NAMES.has(url.pathname.split("/").pop()))
    ) {
      return { kind: "shell" };
    }
    if (sameOrigin && url.pathname.includes("/img/"))
      return { kind: "img", cap: IMG_CAP };
    if (!sameOrigin && FONT_HOSTS.includes(url.hostname)) {
      return { kind: "font", cap: FONT_CAP };
    }
    return null;
  }

  const api = { classify, IMG_CAP, FONT_CAP, FONT_HOSTS, SHELL_FILES };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AKB_CACHE_RULES = api;
})(typeof self === "object" ? self : globalThis);
