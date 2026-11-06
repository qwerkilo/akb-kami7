// 字体预热：只预热「当前可见元素真的会用这个 family/weight 渲染」的 woff2 子集。
// 纯选择逻辑在 core.warmUrls；本模块只读 computed style 并抓取。
(function (root, factory) {
  const api = factory;
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AKB_APP_FONTS = { create: api };
})(typeof globalThis !== "undefined" ? globalThis : this, function (deps) {
  "use strict";
  const { CORE } = deps;

  function fontUsages(root) {
    const byKey = new Map();
    const els = root.querySelectorAll(
      "body *:not(script):not(style):not(noscript)"
    );
    for (const el of els) {
      if (el.childElementCount) continue;
      const text = el.textContent || "";
      if (!text || !el.getClientRects().length) continue;
      const cs = getComputedStyle(el);
      const weight = cs.fontWeight;
      for (const raw of cs.fontFamily.split(",")) {
        const family = raw
          .trim()
          .replace(/^["']|["']$/g, "")
          .toLowerCase();
        if (!family) continue;
        const key = family + "|" + weight;
        let set = byKey.get(key);
        if (!set) byKey.set(key, (set = new Set()));
        for (const ch of text) set.add(ch.codePointAt(0));
      }
    }
    return [...byKey.entries()].map(([key, chars]) => {
      const [family, weight] = key.split("|");
      return { family, weight, chars };
    });
  }

  async function warm() {
    if (!navigator.onLine) return;
    const links = [
      ...document.querySelectorAll(
        'link[rel="stylesheet"][href*="fonts.googleapis.com"]'
      ),
    ];
    for (const link of links) {
      try {
        const css = await (
          await fetch(link.href, { credentials: "omit" })
        ).text();
        // #4：只预热「可见元素真的会用这个 family/weight 渲染」的子集。此前是
        // 可见字符 × 全部 family（500+ 文件 / 5.7MB），标题字体的 CJK 子集被正文
        // 字符全部点亮；现在按 computed style 分组挑选。
        const urls = CORE.warmUrls(css, fontUsages(document));
        // 分批并发：逐个 await 要十几秒，期间用户断网就只预热了一半（实测会）。
        // 页面被切走/隐藏就停：否则导航会中断这批请求并刷一串资源错误。
        for (let i = 0; i < urls.length; i += 16) {
          if (document.hidden) return;
          await Promise.allSettled(
            urls.slice(i, i + 16).map((u) => fetch(u, { credentials: "omit" }))
          );
        }
      } catch (_) {}
    }
  }

  return { warm };
});
