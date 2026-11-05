// PWA 子模块：安装 / 离线胶囊 / 安装指引 / SW 更新。
// 由 app.js 注入 DOM、i18n 与焦点圈禁；保持原有无构建 UMD 形态。
(function (root, factory) {
  const api = factory;
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AKB_APP_PWA = { create: api };
})(typeof globalThis !== "undefined" ? globalThis : this, function (deps) {
  "use strict";
  const { $, t, I18N, setPageInert, warmFonts } = deps;

  let installEvent = null; // beforeinstallprompt 捕获到的安装事件
  let sheetOpen = false;
  let sheetOpener = null;

  const swOK = "serviceWorker" in navigator;
  // 平台原语 + 一处显式排除：file:// 在浏览器里 isSecureContext 也是 true，
  // 但那边注册不了 SW、也装不了 PWA，必须按「装不了」说。改用原语之后
  // 127.0.0.2、*.localhost、企业内网 https 这些白名单会误判的地址不再被误判。
  const secureCtx = window.isSecureContext && location.protocol !== "file:";
  const standalone =
    matchMedia("(display-mode: standalone)").matches ||
    navigator.standalone === true;
  const isIOS =
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  function paintInstall() {
    const row = $("#pwa-install");
    if (!row) return;
    // 曾经整行吊在 beforeinstallprompt 上，于是 Firefox / macOS Safari / headless /
    // 非安全上下文里入口彻底消失（连「手动装」的指引一起没了）——那是设计缺陷。
    // 现在：除已装成应用（standalone）外始终显示；有没有一键安装只决定按钮的行为——
    // 有就「安装」一键装、「怎么装？」给指引；没有就让「怎么装？」直接开指引，
    // 另一个按钮此刻与它同作用，藏掉（顺带让 360px 下这一行少换行一次）。
    row.hidden = standalone;
    // 「已安装」态靠 markInstalled() 把按钮摘掉并改文案（切语言也不会复活）；
    // 这里只管「有没有一键安装」这一维。
    const key = installEvent ? "pwa_install_go" : "pwa_guide_go";
    const primary = row.querySelector('[data-act="pwa-install"]');
    if (primary) {
      primary.dataset.i18n = key;
      primary.textContent = t(key);
    }
    const guide = row.querySelector('[data-act="pwa-ios"]');
    if (guide) guide.hidden = !installEvent;
    const txt = row.querySelector(".pwa-install-txt");
    if (txt) {
      txt.dataset.i18n = "pwa_install";
      txt.textContent = t("pwa_install");
    }
  }
  // 步数表来自 i18n.js（文案元数据；app.js 不再自持一份）
  const GUIDE_STEPS = I18N.GUIDE_STEPS;
  function guidePlatform() {
    const ua = navigator.userAgent;
    if (isIOS) return "ios";
    if (/Android/i.test(ua)) return "android";
    if (/Macintosh/i.test(ua)) return "macos";
    return "other";
  }
  function guideTitleKey(plat) {
    return plat === "other" ? "pwa_guide_title" : "pwa_guide_title_" + plat;
  }
  function paintOffline() {
    const chip = $("#pwa-chip");
    if (chip) chip.hidden = navigator.onLine;
  }
  function markInstalled() {
    const row = $("#pwa-install");
    if (!row) return;
    row.querySelectorAll("button").forEach((b) => b.remove());
    const txt = row.querySelector(".pwa-install-txt");
    if (txt) {
      txt.textContent = t("pwa_installed");
      txt.dataset.i18n = "pwa_installed"; // 不换键的话 applyStatic 会打回默认文案
    }
    row.hidden = standalone;
  }
  function showUpdateBanner() {
    const el = $("#pwa-update");
    if (el) el.hidden = false;
  }
  function openSheet() {
    const el = $("#pwa-sheet");
    if (!el) return;
    sheetOpen = true;
    sheetOpener = document.activeElement;
    const plat = guidePlatform();
    const n = GUIDE_STEPS[plat]; // 不给兜底：平台名写错时 1 <= undefined 为 false，浮层会是空的（不抛）——靠 i18n 的孤儿键检查拦
    const titleKey = guideTitleKey(plat);
    el.dataset.i18nAriaLabel = titleKey;
    el.setAttribute("aria-label", t(titleKey)); // 只改 dataset 的话浮层可及名会停在通用标题
    const head = el.querySelector("h3");
    if (head) {
      head.dataset.i18n = titleKey;
      head.textContent = t(titleKey);
    }
    const list = $("#pwa-guide-steps");
    if (list) {
      list.textContent = "";
      for (let i = 1; i <= n; i++) {
        const li = document.createElement("li");
        li.dataset.i18n = "pwa_" + plat + "_s" + i;
        li.textContent = t(li.dataset.i18n);
        list.appendChild(li);
      }
    }
    const hint = $("#pwa-sheet-hint");
    if (hint) {
      hint.hidden = secureCtx; // 非安全上下文：装不了也用不了离线，说清楚为什么
      if (!secureCtx) hint.textContent = t("pwa_insecure");
    }
    el.hidden = false;
    const scrim = $("#pwa-scrim");
    if (scrim) scrim.hidden = false;
    setPageInert(true, ["pwa-sheet", "pwa-scrim"]);
    el.querySelector("button")?.focus();
  }
  function closeSheet() {
    const el = $("#pwa-sheet");
    if (!el) return;
    sheetOpen = false;
    el.hidden = true;
    const scrim = $("#pwa-scrim");
    if (scrim) scrim.hidden = true;
    setPageInert(false);
    // 还给真正的触发者（iOS 上是「安装」，桌面事件捕获后可能是「iOS 怎么装？」）
    if (sheetOpener && sheetOpener.isConnected) sheetOpener.focus();
    sheetOpener = null;
  }
  async function doInstall() {
    if (!installEvent) return openSheet(); // iOS / 不支持安装事件 → 给指引
    const e = installEvent;
    installEvent = null; // 一次安装事件只能消费一次，先置空防双击重复 prompt
    e.prompt();
    const choice = await e.userChoice;
    paintInstall();
    if (choice.outcome === "accepted") markInstalled();
  }
  function applyUpdate() {
    // 新 SW 在 install 里就 skipWaiting 了（消息唤醒 waiting 不可靠），所以这里
    // 只需要刷新页面；横幅先收掉，免得刷新失败时它还杵在屏幕上。
    const el = $("#pwa-update");
    if (el) el.hidden = true;
    location.reload();
  }
  function watchUpdate(reg) {
    if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner();
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener("statechange", () => {
        if (w.state === "installed" && navigator.serviceWorker.controller) {
          showUpdateBanner();
        }
      });
    });
  }
  function initPWA() {
    paintOffline();
    paintInstall();
    window.addEventListener("online", paintOffline);
    window.addEventListener("offline", paintOffline);
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      installEvent = e;
      paintInstall();
    });
    window.addEventListener("appinstalled", () => {
      installEvent = null;
      markInstalled();
    });
    // file:// 与非安全上下文不注册 SW；注册失败也不打扰用户（站点照常可用）
    if (!swOK || !secureCtx) return;
    navigator.serviceWorker
      .register("sw.js", { updateViaCache: "none" })
      .then((reg) => {
        watchUpdate(reg);
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          // 首次访问的字体请求发生在接管之前，没有进缓存 → 断网后字形变样。
          // 接管之后重新请求一遍（CSS 可跨域读，woff2 从 CSS 里解析出来一并预热）。
          // 这里绝不 reload：首次接管、新版本激活都会触发它，而自动刷新会打断
          // 进行中的对决——刷新只由用户点横幅上的「刷新」发起。
          void warmFonts();
        });
        if (navigator.serviceWorker.controller) void warmFonts();
      })
      .catch(() => {});
  }

  return {
    init: initPWA,
    isOpen: () => sheetOpen,
    close: closeSheet,
    openSheet,
    install: doInstall,
    applyUpdate,
  };
});
