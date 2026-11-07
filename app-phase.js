// 相位切换：显示哪一块、转场、名册进场标志、对决时收起页头/步骤/页脚。
(function (root, factory) {
  const api = factory;
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AKB_APP_PHASE = { create: api };
})(typeof globalThis !== "undefined" ? globalThis : this, function (deps) {
  "use strict";
  const { $, picker, unveilFx, playOnce } = deps;
  let entering = null;

  function show(phase) {
    for (const id of ["pick", "screen", "duel", "result"]) {
      $(`#phase-${id}`).hidden = id !== phase;
    }
    // 切屏转场：给刚显示的相位加一次 .enter，动画播完摘掉（留着会每次渲染重播）。
    if (entering) {
      entering.classList.remove("enter");
      entering = null;
    }
    if (phase !== "result") unveilFx.reset();
    const shown = $(`#phase-${phase}`);
    if (shown) {
      entering = shown;
      playOnce(shown, "animation", {
        cls: "enter",
        onDone: () => {
          if (entering === shown) entering = null;
        },
      });
    }
    // 名册的进场 stagger 只在进入挑人步时播一次；渲染本身决定要不要加类。
    picker.setEntering(phase === "pick");
    $("#roster")?.classList.remove("enter");
    // 对决时把页头与步骤条整体收起：这一步要的是两张脸，不是导航。
    const chrome = phase === "duel";
    const head = $("#site-head");
    if (head) head.hidden = chrome;
    const steps = $("#steps");
    if (steps) steps.hidden = chrome;
    const foot = $("#site-foot");
    if (foot) foot.hidden = chrome;
    window.scrollTo({ top: 0 });
  }

  return { show };
});
