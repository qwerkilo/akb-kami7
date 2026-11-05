// 结果相位：榜单渲染与导出数据的装配。
// 海报画布与揭幕留在 app.js（它们直接操作 canvas / 几何）。
(function (root, factory) {
  const api = factory;
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AKB_APP_RESULT = { create: api };
})(typeof globalThis !== "undefined" ? globalThis : this, function (deps) {
  "use strict";
  const {
    $,
    esc,
    t,
    thumbSrc,
    fullMeta,
    names,
    getRanking,
    setRanking,
    shareLink,
    sync,
    snapshot,
    byId,
    renderBody,
  } = deps;

  function renderList() {
    $("#rank-list").innerHTML = getRanking()
      .map(
        (m, i) => `<li>
      <span class="no">${i + 1}</span>
      <img src="${thumbSrc(m)}" alt="">
      <span class="nm">${esc(m.name)}<span class="meta">${esc(fullMeta(m))}</span></span>
      <span class="info" role="button" tabindex="0" aria-label="${t("bio_open")}" data-profile="${m.id}">i</span>
    </li>`
      )
      .join("");
  }

  /** 当前结果页的渲染入口；普通结果与只读分享共用。 */
  function render() {
    sync();
    const s = snapshot();
    if (s.phase !== "result") return;
    setRanking(s.ranking.map((id) => byId(id)));
    renderBody();
  }

  // 结果页导出装配：标题回退、日期规则、分享串与文件名各自只此一处
  function exportData() {
    const title = $("#title-input").value.trim() || names().title;
    const d = new Date();
    return {
      title,
      dateText: `${names().eyebrow} · ${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`,
      hashtag: names().posterTags,
      fileName: `${names().fileBase}.png`,
      caption: `${title}\n\n${getRanking()
        .map((m, i) => `${i + 1}. ${m.name}`)
        .join("\n")}\n\n${names().shareTags}`,
      shareUrl: shareLink(),
    };
  }

  return { render, renderList, exportData };
});
