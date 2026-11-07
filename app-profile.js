// 成员简介卡：懒加载 bios.js、渲染字段、焦点归还与 inert 圈禁。
(function (root, factory) {
  const api = factory;
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AKB_APP_PROFILE = { create: api };
})(typeof globalThis !== "undefined" ? globalThis : this, function (deps) {
  "use strict";
  const { $, CORE, t, esc, thumbSrc, byId, lang, I18N, setPageInert } = deps;

  let BIOS = null;
  let biosLoading = null;
  let profileId = null;
  let opener = null;

  function loadBios() {
    if (biosLoading) return biosLoading;
    biosLoading = new Promise((resolve) => {
      const el = document.createElement("script");
      el.src = "bios.js";
      el.async = true;
      el.onload = () => resolve((BIOS = window.AKB_BIOS || {}));
      el.onerror = () => resolve(null);
      document.head.appendChild(el);
    });
    return biosLoading;
  }

  function warm() {
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1200));
    idle(() => void loadBios());
  }

  function paintRows() {
    const m = byId(profileId);
    if (!m) return;
    const bio = (BIOS && BIOS[m.id]) || {};
    const rows = CORE.profileRows({ ...m, bio }, t, lang(), I18N.values);
    $("#pf-fields").innerHTML = rows
      .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
      .join("");
  }

  function open(id) {
    const m = byId(id);
    if (!m) return;
    profileId = id;
    $("#pf-photo").src = thumbSrc(m);
    $("#pf-name").textContent = m.name;
    $("#pf-kana").textContent = m.kana || "";
    $("#pf-badge").textContent =
      m.group +
      (m.generation ? " · " + CORE.genText(m.generation, lang()) : "");
    $("#pf-close").setAttribute("aria-label", t("bio_close"));
    paintRows();
    $("#profile").hidden = false;
    setPageInert(true, ["profile"]);
    opener = document.activeElement;
    $("#pf-close")?.focus();
    // 首次打开早于空闲预取：数据到了补画一次（失败就保持无 bio 的卡片）
    loadBios().then(() => {
      if (profileId === id && !$("#profile").hidden) paintRows();
    });
  }

  function close() {
    profileId = null;
    $("#profile").hidden = true;
    setPageInert(false);
    // 焦点还给真正的触发者（pwa-sheet 同款；不还的话键盘用户会落回页面开头）
    if (opener && opener.isConnected) opener.focus();
    opener = null;
  }

  function isOpen() {
    return profileId !== null;
  }

  function reopen() {
    if (profileId) open(profileId);
  }

  function idOf(e) {
    const info = e.target.closest(".info");
    return info ? info.dataset.profile || null : null;
  }

  $("#profile").addEventListener("click", (e) => {
    if (e.target === $("#profile") || e.target.closest(".pf-close")) close();
  });

  return { open, close, isOpen, warm, reopen, idOf };
});
