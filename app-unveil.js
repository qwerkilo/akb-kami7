// 揭幕：最后两张脸从对决页飞到海报位置并淡出（ADR-0020 §3）。
// 用 transform 而不是 left/top/width —— 后者会逐帧触发布局。
(function (root, factory) {
  const api = factory;
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AKB_APP_UNVEIL = { create: api };
})(typeof globalThis !== "undefined" ? globalThis : this, function (deps) {
  "use strict";
  const { $, playOnce } = deps;

  let from = null;
  let played = false;
  const reducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function capture() {
    if (reducedMotion()) return;
    const imgs = [$("#fighter-a"), $("#fighter-b")]
      .map((el) => el && el.querySelector("img"))
      .filter(Boolean);
    if (imgs.length !== 2) return;
    from = imgs
      .map((im) => {
        const r = im.getBoundingClientRect();
        if (!r.width) return null;
        return {
          src: im.currentSrc || im.src,
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
        };
      })
      .filter(Boolean);
    if (from.length !== 2) from = null;
  }

  function play() {
    if (!from || played || reducedMotion()) {
      from = null;
      return;
    }
    played = true;
    const start = from;
    from = null;
    const host = $("#poster");
    if (!host) return;
    const to = host.getBoundingClientRect();
    if (!to.width) return;
    const layer = document.createElement("div");
    layer.className = "unveil";
    layer.setAttribute("aria-hidden", "true");
    for (const f of start) {
      const img = document.createElement("img");
      img.src = f.src;
      img.alt = "";
      img.style.cssText = `left:${to.x}px;top:${to.y}px;width:${to.width}px;height:${to.height}px;
        transform:translate(${f.x - to.x}px, ${f.y - to.y}px) scale(${f.w / to.width}, ${f.h / to.height});`;
      layer.appendChild(img);
    }
    document.body.appendChild(layer);
    // 强制一次样式重算再进 rAF 改 transform：浏览器**不保证**在 appendChild 与
    // rAF 回调之间做过重算，不这么做 transition 可能压根不产生（隔离复现里 0 条动画）。
    void layer.offsetHeight;
    playOnce(layer, "transition", {
      onDone: () => layer.remove(),
      selfOnly: false,
    });
    requestAnimationFrame(() => {
      for (const img of layer.children) {
        img.style.transform = "none";
        img.style.opacity = "0";
      }
    });
  }

  function reset() {
    from = null;
    played = false;
  }

  return { capture, play, reset };
});
