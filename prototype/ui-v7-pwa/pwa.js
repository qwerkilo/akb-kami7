/* ui-v7-pwa 原型脚本：真实成员数据与照片，交互层只做 PWA 表面（安装 / 更新 / 离线） */
(function () {
  "use strict";
  var qs = new URLSearchParams(location.search);
  var VARIANTS = {
    A: "页头安装按钮",
    B: "底部安装条",
    C: "流程内引导卡",
    D: "页脚入口",
  };
  var STATES = ["installable", "installed", "update", "offline"];
  var state = STATES.indexOf(qs.get("state")) >= 0 ? qs.get("state") : "installable";
  var variant = (VARIANTS[qs.get("variant")] ? qs.get("variant") : "A").toUpperCase();
  var skin = localStorage.getItem("proto:skin") || "sticker";

  var flat = [];
  (window.AKB_GROUPS || []).forEach(function (sec) {
    (sec.members || []).forEach(function (m) {
      flat.push({ m: m, sec: sec });
    });
  });
  var first = (window.AKB_GROUPS || [])[0] || { label: "—", members: [] };
  var shown = (first.members || []).slice(0, 12);
  var picked = new Set();

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function photo(m) {
    return "../../img/thumb/" + m.id + ".webp";
  }
  function setState(next) {
    state = next;
    document.body.dataset.state = state;
    var sel = document.getElementById("st-sel");
    if (sel) sel.value = state;
    document.getElementById("st-lbl").textContent = LABELS[state];
  }
  var LABELS = {
    installable: "可安装",
    installed: "已安装",
    update: "有新版本",
    offline: "离线中",
  };

  function header() {
    var inst =
      variant === "A"
        ? '<button type="button" class="pwa-install-btn" data-act="install">' +
          '<span class="ic" aria-hidden="true">⤓</span><span class="lbl">安装</span></button>'
        : "";
    var chip =
      '<span class="pwa-chip" role="status"><span class="dot" aria-hidden="true"></span><span class="lbl">离线中</span></span>';
    return (
      '<header class="masthead"><div class="masthead-main">' +
      '<p class="eyebrow">48 Group 好き顔ソート</p>' +
      '<h1><span class="kami">神7</span><span class="sub">历代成员版</span></h1>' +
      '<div class="seg" role="radiogroup" aria-label="系列"><button type="button" aria-checked="true">48 Group</button>' +
      '<button type="button" aria-checked="false">坂道</button><button type="button" aria-checked="false">等爱</button></div>' +
      '</div><div class="masthead-side">' +
      inst +
      chip +
      '<div class="seg" role="radiogroup" aria-label="语言"><button type="button" aria-checked="true">中</button>' +
      '<button type="button" aria-checked="false">EN</button><button type="button" aria-checked="false">日</button></div>' +
      '<div class="seg seg-skin" role="radiogroup" aria-label="皮肤">' +
      '<button type="button" role="radio" aria-checked="' +
      (skin === "classic") +
      '" data-skin="classic"><span class="swatch classic" aria-hidden="true"></span>原版</button>' +
      '<button type="button" role="radio" aria-checked="' +
      (skin === "sticker") +
      '" data-skin="sticker"><span class="swatch sticker" aria-hidden="true"></span>贴纸</button></div>' +
      "</div></header>"
    );
  }

  function updateBanner() {
    return (
      '<div class="pwa-update" role="status"><b>有新版本可用，刷新后生效</b>' +
      '<button type="button" class="btn primary" data-act="reload">刷新</button></div>'
    );
  }

  function steps() {
    return (
      '<nav class="steps" aria-label="步骤"><button type="button" aria-current="step"><span class="step-no">1</span>挑人<b>2/7</b></button>' +
      '<span class="steps-sep">›</span><button type="button" disabled><span class="step-no">2</span>对决</button>' +
      '<span class="steps-sep">›</span><button type="button" disabled><span class="step-no">3</span>出图</button></nav>'
    );
  }

  function installBar() {
    if (variant !== "B") return "";
    return (
      '<div class="pwa-bar" role="region" aria-label="安装到桌面"><p><b>装到桌面，离线也能用</b>' +
      "装到主屏幕后，没网也能挑人、排序、出图。</p>" +
      '<button type="button" class="btn primary" data-act="install">安装</button>' +
      '<button type="button" class="btn ghost x" data-act="dismiss" aria-label="关闭">✕</button></div>'
    );
  }

  function installCard() {
    if (variant !== "C") return "";
    return (
      '<div class="pwa-card" role="region" aria-label="安装到桌面"><div class="txt"><b>把本站装到桌面</b>' +
      "<p>装上后离线可用，挑人、排序、出图都不需要网络。</p></div>" +
      '<div class="acts"><button type="button" class="btn primary" data-act="install">安装</button>' +
      '<button type="button" class="btn ghost" data-act="dismiss">稍后</button></div></div>'
    );
  }

  function footEntry() {
    var inner =
      variant === "D"
        ? '<div class="pwa-foot"><span class="txt">离线可用？把本站装到桌面。</span>' +
          '<button type="button" class="btn primary" data-act="install">安装</button>' +
          '<button type="button" class="btn ghost" data-act="ios">iOS 怎么装？</button></div>'
        : '<div class="pwa-foot"><span class="txt">iPhone / iPad：</span>' +
          '<button type="button" class="btn ghost" data-act="ios">添加到主屏幕的步骤</button></div>';
    return (
      '<footer class="colophon"><span>成员名单与照片来自</span>' +
      '<a href="https://48pedia.org/" target="_blank" rel="noopener">エケペディア（48pedia）</a>' +
      "<span>，版权归原权利人所有。</span>" +
      inner +
      "</footer>"
    );
  }

  function roster() {
    var cards = shown
      .map(function (m, i) {
        return (
          '<button type="button" class="card' +
          (picked.has(i) ? " picked" : "") +
          '" data-i="' + i + '"><img src="' + photo(m) + '" alt="' + esc(m.name) + '" loading="lazy">' +
          (picked.has(i) ? '<span class="tick">✓</span>' : "") +
          '<span class="nm">' + esc(m.name) + "</span></button>"
        );
      })
      .join("");
    return (
      installCard() +
      '<h2 class="group-label">' + esc(first.group || "AKB48") + " · " + esc(first.label) + "</h2>" +
      '<div class="grid">' + cards + "</div>"
    );
  }

  function tray() {
    var slots = [0, 1, 2, 3, 4, 5, 6]
      .map(function (i) {
        var idx = Array.from(picked)[i];
        var m = idx == null ? null : shown[idx];
        return (
          '<span class="slot">' +
          (m ? '<img src="' + photo(m) + '" alt="">' : "") +
          "</span>"
        );
      })
      .join("");
    return (
      '<div class="tray"><div class="tray-slots">' + slots + "</div>" +
      '<button type="button" class="btn primary" disabled>开始排序（约 14 题）</button></div>'
    );
  }

  function sheet() {
    return (
      '<div class="pwa-sheet" id="ios-sheet" role="dialog" aria-modal="true" aria-label="添加到主屏幕">' +
      "<h3>iPhone / iPad 添加到主屏幕</h3><ol>" +
      "<li>用 Safari 打开本站</li><li>点底部工具条的<b>分享</b>按钮</li>" +
      "<li>下滑选<b>添加到主屏幕</b></li><li>点右上角「添加」</li></ol>" +
      '<button type="button" class="btn primary" data-act="close-ios">知道了</button></div>'
    );
  }

  function protoBar() {
    var opts = STATES.map(function (s) {
      return '<option value="' + s + '"' + (s === state ? " selected" : "") + ">" + LABELS[s] + "</option>";
    }).join("");
    if (qs.get("clean")) return "";
    return (
      '<div class="proto-bar"><button type="button" data-act="prev" aria-label="上一版">‹</button>' +
      '<span class="lbl" id="st-lbl">' + LABELS[state] + " · " + variant + " " + VARIANTS[variant] + "</span>" +
      '<button type="button" data-act="next" aria-label="下一版">›</button><span class="sep"></span>' +
      '<select id="st-sel" aria-label="状态">' + opts + "</select>" +
      '<span class="sep"></span><span class="hint">原型 · 四版安装入口</span></div>'
    );
  }

  document.body.className = "variant-" + variant.toLowerCase();
  document.body.innerHTML =
    header() + updateBanner() + steps() +
    '<input class="search" type="search" placeholder="搜索名字 / 罗马字（简体会自动折叠）">' +
    installBar() + roster() + tray() + footEntry() + sheet() + protoBar();
  document.documentElement.dataset.skin = skin;
  setState(state);

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act],[data-i],[data-skin]");
    if (!t) return;
    var act = t.dataset.act;
    if (act === "install") {
      setState("installed");
      var lbl = t.querySelector(".lbl");
      if (lbl) lbl.textContent = "已安装";
      if (variant === "D")
        t.outerHTML =
          '<div class="pwa-foot"><span class="txt">已安装到桌面 ✓ 离线可用</span></div>';
      return;
    }
    if (act === "reload") return setState("installable");
    if (act === "dismiss") {
      document.body.dataset.bar = "closed";
      return;
    }
    if (act === "ios") return document.getElementById("ios-sheet").classList.add("open");
    if (act === "close-ios") return document.getElementById("ios-sheet").classList.remove("open");
    if (act === "prev" || act === "next") {
      var keys = Object.keys(VARIANTS);
      var i = keys.indexOf(variant);
      var n = keys[(i + (act === "next" ? 1 : keys.length - 1)) % keys.length];
      return go({ variant: n });
    }
    if (t.dataset.i != null) {
      var idx = Number(t.dataset.i);
      if (picked.has(idx)) picked.delete(idx);
      else picked.add(idx);
      var body = document.body;
      body.innerHTML =
        header() + updateBanner() + steps() +
        '<input class="search" type="search" placeholder="搜索名字 / 罗马字（简体会自动折叠）">' +
        installBar() + roster() + tray() + footEntry() + sheet() + protoBar();
      document.body.dataset.state = state;
      return;
    }
    if (t.dataset.skin) {
      skin = t.dataset.skin;
      localStorage.setItem("proto:skin", skin);
      document.documentElement.dataset.skin = skin;
      var b = document.body;
      b.innerHTML =
        header() + updateBanner() + steps() +
        '<input class="search" type="search" placeholder="搜索名字 / 罗马字（简体会自动折叠）">' +
        installBar() + roster() + tray() + footEntry() + sheet() + protoBar();
      document.body.dataset.state = state;
    }
  });
  document.addEventListener("change", function (e) {
    if (e.target.id === "st-sel") setState(e.target.value);
  });

  function go(patch) {
    var q = new URLSearchParams(location.search);
    q.set("variant", patch.variant || variant);
    q.set("state", state);
    location.search = q.toString();
  }
})();
