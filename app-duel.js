// 对决相位：回放式归并排序的渲染、答题、撤回与键盘。
// 纯状态仍在 session/core；本模块只持有「本次对决的 UI 瞬时状态」。
(function (root, factory) {
  const api = factory;
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AKB_APP_DUEL = { create: api };
})(typeof globalThis !== "undefined" ? globalThis : this, function (deps) {
  "use strict";
  const {
    $,
    CORE,
    S,
    t,
    esc,
    fullSrc,
    fullMeta,
    byId,
    view,
    series,
    introOpen,
    profileId,
    pwaOpen,
    snapshot,
    sync,
    show,
    navigate,
    renderSteps,
    toast,
    maybeIntro,
  } = deps;

  let duel50 = false;
  let lastTierIdx = null;
  let answering = false;
  const PICK_CONFIRM_MS = 160;

  function begin(opts) {
    if (!S.startDuel(opts)) return false;
    duel50 = false;
    snapshot().selected.forEach((id) => {
      new Image().src = fullSrc(byId(id));
    });
    show("duel");
    render();
    maybeIntro();
    return true;
  }

  function renderProgress(s) {
    $("#duel-max").textContent = s.duel.max;
    $("#duel-step").textContent = s.duel.step;
    $("#duel-bar").style.width = `${s.duel.percent}%`;
    const extra = $("#duel-extra");
    if (!extra) return;
    // 多轮筛选时对决跨层级（保留组 + 各轮划掉组），单一百分比看不出层级跳跃 →
    // tier/tiers 就是为此而算的（ADR-0019）
    extra.textContent = t(
      "duel_extra",
      s.duel.percent,
      s.duel.remaining,
      Math.max(1, Math.ceil(s.duel.etaSeconds / 60)),
      s.duel.tier + 1,
      s.duel.tiers
    );
  }

  // 层级段：一共 tiers 组、现在第 tier+1 组、已答 tierAnswered / 组内上限 tierMax
  function tierStripHTML(s) {
    const n = Math.max(1, s.duel.tiers || 1);
    const now = Math.min(s.duel.tier || 0, n - 1);
    let html = "";
    for (let i = 0; i < n; i++)
      html += `<i class="${i < now ? "done" : i === now ? "now" : ""}"></i>`;
    if (!html || !s.duel.tierMax) return html;
    // 组内进度：当前段的 --fill（渐变填充，不改尺寸）
    const pct = Math.max(
      0,
      Math.min(
        100,
        Math.round(((s.duel.tierAnswered || 0) / s.duel.tierMax) * 100)
      )
    );
    return html.replace('class="now"', `class="now" style="--fill:${pct}%"`);
  }

  function renderTierStrip(s) {
    const tiers = $("#duel-tiers");
    if (!tiers) return;
    // 翻转只在**换组**时来一次：整排每次渲染都重建，不判一下就会每答一题
    // 都播一次 200ms 的装饰（效率区的每次点击不该有这种东西）。
    const nowIdx = Math.min(
      s.duel.tier || 0,
      Math.max(1, s.duel.tiers || 1) - 1
    );
    tiers.classList.toggle(
      "flip",
      lastTierIdx !== null && lastTierIdx !== nowIdx
    );
    lastTierIdx = nowIdx;
    tiers.innerHTML = tierStripHTML(s);
  }

  function fillFighter(el, m) {
    el.classList.remove("picked");
    el.innerHTML = `<span class="ph"><img src="${fullSrc(m)}" alt=""></span>
      <span class="nm">${esc(m.name)}</span>
      <span class="kn">${esc(m.kana)}</span>
      <span class="meta">${esc(fullMeta(m))}</span>`;
    el.setAttribute("aria-label", t("pick_who", m.name));
  }

  function render() {
    sync();
    const s = snapshot();
    if (s.phase === "result") return navigate("advance");
    if (s.phase !== "duel") return;
    renderProgress(s);
    renderTierStrip(s);
    $("#undo-btn").disabled = !s.duel.canUndo;
    fillFighter($("#fighter-a"), byId(s.duel.pair[0]));
    fillFighter($("#fighter-b"), byId(s.duel.pair[1]));
    // 换人对读屏播报（L10 尾巴）：进度有 aria-live，选手姓名此前没有出口。
    const live = $("#duel-live");
    if (live) {
      live.textContent = s.duel.pair
        .map((id) => byId(id)?.name || "")
        .filter(Boolean)
        .join(" vs ");
    }
    duel50 = CORE.milestone(s.duel.percent, duel50).shown;
    renderSteps();
  }

  function canInput() {
    return (
      view() === "duel" &&
      snapshot().phase === "duel" &&
      !introOpen() &&
      !profileId() &&
      !pwaOpen()
    );
  }

  // 点一张脸之后**故意**推迟 160ms 才落盘：让 `.fighter.picked` 的位移+缩放
  // 被看到 —— 否则「我选了这张」只有一帧，160 档（40 档 106 题）会看不清自己在选谁。
  // 代价是这段时间内所有对决命令都被冻结（闩见下），撤回按钮在这期间是 disabled
  // （`canUndo` 为 false），而键盘的 Z/Backspace 原先**完全静默** —— 现在补一句提示。
  function answer(leftWins) {
    if (answering || !canInput()) return;
    answering = true;
    const forSeries = series();
    (leftWins ? $("#fighter-a") : $("#fighter-b")).classList.add("picked");
    setTimeout(() => {
      answering = false;
      if (S.snapshot().series !== forSeries) return;
      if (!canInput()) return;
      if (!S.answer(leftWins)) return;
      sync();
      const s = snapshot();
      if (s.duel) {
        const ms = CORE.milestone(s.duel.percent, duel50);
        duel50 = ms.shown;
        if (ms.celebrate) toast(t("halfway"));
      }
      navigate("advance");
    }, PICK_CONFIRM_MS);
  }

  function undo() {
    if (!canInput()) return;
    // 这 160ms 里 `canUndo` 是 false（答案还没落盘），所以撤回按钮是 disabled
    // —— 用户看得见对等物；键盘没有，于是给它一句提示，别让按键悄悄消失。
    if (answering) return toast(t("duel_undo_pending"));
    if (!S.undo()) return;
    navigate("advance");
  }

  const isUndoKey = (k) => k === "z" || k === "Z" || k === "Backspace";
  const isTyping = (e) => Boolean(e.target.closest?.("input, textarea"));
  const hasModifier = (e) => e.ctrlKey || e.metaKey || e.altKey;

  function arrowKey(e) {
    if (!canInput() || isTyping(e) || hasModifier(e)) return;
    if (e.key === "ArrowLeft") return answer(true);
    if (e.key === "ArrowRight") return answer(false);
    if (isUndoKey(e.key)) undo();
  }

  function bind() {
    $("#fighter-a").addEventListener("click", () => answer(true));
    $("#fighter-b").addEventListener("click", () => answer(false));
    $("#undo-btn").addEventListener("click", undo);
    $("#back-pick-btn").addEventListener("click", () => {
      navigate("leave");
      toast(t("duel_saved"));
    });
  }

  bind();
  return { begin, render, answer, undo, arrowKey, canInput };
});
