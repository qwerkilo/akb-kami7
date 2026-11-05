// 筛选相位：清单渲染、锁定原因、重置与划除。
// 筛选语义本身在 core/session；本模块只做清单 DOM 与文案映射。
(function (root, factory) {
  const api = factory;
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AKB_APP_SCREEN = { create: api };
})(typeof globalThis !== "undefined" ? globalThis : this, function (deps) {
  "use strict";
  const {
    $,
    CORE,
    S,
    t,
    esc,
    thumbSrc,
    fullMeta,
    byId,
    snapshot,
    sync,
    renderSteps,
    navigate,
  } = deps;

  // L8：锁标单独成函数（内联的三元会把 renderScreen 的行模板推过复杂度基线）
  // 可及名的动作 + 原因（键名选择在 core.js，本函数只管取文案）
  const markLabel = (locked, noQuota, cut) =>
    t(CORE.markReasonKey(locked, noQuota, cut));

  // 触屏可见的原因（title 只服务鼠标）：锁定与名额用尽各有各的说法
  const markTitle = (locked, noQuota) =>
    locked || noQuota ? t(CORE.markReasonKey(locked, noQuota, false)) : "";

  const lockMark = (off) =>
    off
      ? '<svg class="lock" viewBox="0 0 12 14" aria-hidden="true" focusable="false"><rect x="1.5" y="6" width="9" height="7" rx="1.5" fill="currentColor"/><path d="M3.5 6V4.4a2.5 2.5 0 0 1 5 0V6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>'
      : "";

  function render() {
    sync();
    const snap = snapshot();
    const sc = snap.screening;
    if (!sc) return navigate("pick");
    $("#screen-intro").textContent = t("screen_intro", sc.pool.length);
    // 轮次标签：还有名额 = 正在第 round+1 轮；名额用尽 = 第 round 轮已到底
    $("#screen-round").textContent = t(
      "screen_round",
      sc.canCut > 0 ? sc.round + 1 : Math.max(1, sc.round)
    );
    // 跨轮已定的人不能在本轮「恢复」（toggleCut 会拒它），那这里就不能留一个
    // 点了没反应的可点控件。判据是「他被划掉的那一轮 ≠ 当前轮」——
    // 不能用 rounds[round] 的成员集合：当前轮还没往里划过任何东西时它是空的。
    const roundOf = (id) => sc.rounds.findIndex((r) => r.includes(id));
    const rows = snap.selected.map((id) => {
      const m = byId(id);
      const cut = sc.cut.includes(id);
      const r = roundOf(id);
      const locked = cut && r !== sc.round; // 别的轮次划掉的
      const noQuota = !cut && !sc.canCut; // 本轮名额用尽 → 划不动
      const off = locked || noQuota;
      return `<li class="screen-row${cut ? " cut" : ""}${locked ? " locked" : ""}">
        <span class="av"><img src="${thumbSrc(m)}" alt="" loading="lazy" decoding="async"></span>
        <span class="who"><b>${esc(m.name)}</b><s>${esc(fullMeta(m))}</s></span>
        <button class="mark" data-cut="${esc(id)}" aria-pressed="${cut ? "true" : "false"}"
          ${off ? "disabled" : ""}
          title="${esc(markTitle(locked, noQuota))}"
          aria-label="${esc(markLabel(locked, noQuota, cut) + " " + m.name)}">${lockMark(off)}${cut ? esc(t("screen_keep")) : esc(t("screen_cut"))}</button>
      </li>`;
    });
    $("#screen-list").innerHTML = rows.join("");
    // 页脚说的是「本轮待筛」而不是「已选」—— 划掉 ≠ 取消选择，两页的 N 含义不同
    $("#screen-count").textContent = t("screen_left", sc.pool.length, sc.size);
    const sub = $("#screen-submit");
    // 本轮划够就能开始排序；题数上限是「各层级组大小之和」，不再只是档位的函数
    sub.disabled = !sc.complete;
    // data-need：本轮还差几个人才能提交（给 E2E 用的确定性钩子，不含文案）
    // 缺口用 canCut（= 本轮还剩几个名额）；cut 是「全部已划」，不能拿来减
    sub.dataset.need = String(sc.canCut);
    sub.textContent = sc.complete
      ? // 用「实际已划的轮数」，不是完整计划：筛得浅题数反而多
        t("start_est", CORE.tierQuestionMax(snap.selected, sc.cut, sc.round))
      : t("screen_min", sc.canCut);
    const more = $("#screen-more");
    // 只有「本轮已划够、且还能再划」时才给递归入口（主动决定要不要继续细分）
    more.hidden = !sc.canRecurse;
    $("#screen-reset").disabled = !sc.cut.length;
    renderSteps();
  }

  function reset() {
    if (!S.resetScreening()) return;
    render();
  }

  function cut(id) {
    S.toggleCut(id);
    render();
  }

  return { render, reset, cut };
});
