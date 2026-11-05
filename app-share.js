// 分享链接的只读结果（ADR-0025）：解码、渲染、退出、生成链接。
// 由 app.js 注入 DOM / 状态 getter / 渲染回调；不在模块内读 localStorage。
(function (root, factory) {
  const api = factory;
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AKB_APP_SHARE = { create: api };
})(typeof globalThis !== "undefined" ? globalThis : this, function (deps) {
  "use strict";
  const {
    $,
    CORE,
    t,
    getSeries,
    getRanking,
    setRanking,
    renderChrome,
    renderResultBody,
    onExit,
  } = deps;

  const sharedLink = (() => {
    const d = CORE.decodeShare(location.search);
    if (!d) return null;
    const members = d.ids.map((id) => deps.byId(id));
    if (members.some((m) => !m || m.series !== d.series)) return null;
    return { ...d, members };
  })();
  let sharedOn = !!sharedLink;
  let titleBeforeShared = null;

  function paintSteps() {
    const bar = $("#steps");
    if (!bar) return;
    for (const btn of bar.querySelectorAll("[data-step]")) {
      const key = btn.getAttribute("data-step");
      // 当前步（出图）不可点：点它只会退出只读，用户预期是「什么都不发生」
      btn.disabled = key !== "pick";
      btn.setAttribute("aria-current", key === "result" ? "step" : "false");
    }
  }

  /** 只读结果页的渲染体：任何重渲染（切换语言/皮肤/样式）都必须走这里。 */
  function paint() {
    if (!sharedLink) return false;
    setRanking(sharedLink.members.slice());
    $("#shared-note").hidden = false;
    $("#resort-btn").hidden = true;
    renderResultBody();
    paintSteps();
    return true;
  }

  function enter() {
    if (!sharedLink) return;
    const input = $("#title-input");
    titleBeforeShared = {
      value: input.value,
      dirty: input.dataset.dirty || "",
    };
    input.value =
      sharedLink.title ||
      CORE.names(sharedLink.series, sharedLink.size, t).title;
    // 标记为「用户改过」：applyStatic / setLang 不得用接收者的默认标题覆盖分享标题
    input.dataset.dirty = "1";
    renderChrome();
    paint();
  }

  function exit() {
    if (!sharedOn) return;
    sharedOn = false;
    setRanking([]);
    onExit();
    $("#shared-note").hidden = true;
    $("#resort-btn").hidden = false;
    const input = $("#title-input");
    if (input && titleBeforeShared) {
      input.value = titleBeforeShared.value;
      if (titleBeforeShared.dirty)
        input.dataset.dirty = titleBeforeShared.dirty;
      else delete input.dataset.dirty;
    }
    titleBeforeShared = null;
    if (location.search) history.replaceState(null, "", location.pathname);
    renderChrome();
  }

  /** 当前结果页的分享链接；file:// 或排名为空时返回空串（复制时提示失败）。 */
  function link() {
    if (!getRanking().length || !location.protocol.startsWith("http"))
      return "";
    const q = CORE.encodeShare({
      series: sharedOn && sharedLink ? sharedLink.series : getSeries(),
      size: getRanking().length,
      ids: getRanking().map((m) => m.id),
      title: $("#title-input").value,
    });
    return q ? `${location.origin}${location.pathname}?${q}` : "";
  }

  return {
    on: () => sharedOn,
    series: () => (sharedOn && sharedLink ? sharedLink.series : null),
    size: () => (sharedOn && sharedLink ? sharedLink.size : null),
    paint,
    enter,
    exit,
    link,
  };
});
