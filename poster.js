// 海报模块入口：组合核心与版式，保持 AKB_POSTER 的公开接口不变。
(function (root) {
  const isNode = typeof module === "object" && module.exports;
  const core = isNode ? require("./poster-core.js") : root.AKB_POSTER_CORE;
  const makeLayouts = isNode
    ? require("./poster-layouts.js")
    : root.AKB_POSTER_LAYOUTS;
  const api = Object.assign({}, core, makeLayouts(core));
  if (isNode) module.exports = api;
  else root.AKB_POSTER = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
