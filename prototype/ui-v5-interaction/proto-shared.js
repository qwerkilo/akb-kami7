/* 交互/UX 原型 v5 · 共享引擎（数据 / 会话 / 组件 / 海报 / 切换条）
   四变体只实现自己的「选人 + 对决」交互层，结果页与资料卡共享。 */
(function () {
  "use strict";

  const CORE = window.AKB_CORE;
  const I18N = window.AKB_I18N;
  const GROUPS = window.AKB_GROUPS || [];
  const t = (k, ...a) => {
    const v = (I18N.zh || {})[k];
    return typeof v === "function" ? v(...a) : v;
  };

  const BY_ID = new Map();
  GROUPS.forEach((g) =>
    g.members.forEach((m) => {
      m.group = g.group;
      m.generation = g.label;
      m.series = g.series;
      BY_ID.set(m.id, m);
    })
  );

  const mem = {
    _d: Object.create(null),
    getItem(k) {
      return this._d[k] ?? null;
    },
    setItem(k, v) {
      this._d[k] = String(v);
    },
  };
  const S = window.AKB_SESSION.create({
    storage: mem,
    byId: (id) => BY_ID.get(id),
  });

  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
    );
  const thumbSrc = (m) =>
    m.img ? `../../img/thumb/${m.id}.webp` : CORE.placeholderSrc(m.name);
  const fullSrc = (m) =>
    m.img ? `../../img/full/${m.id}.webp` : CORE.placeholderSrc(m.name);
  const metaText = (m) => CORE.metaText(m, t, "zh");
  const fullMeta = (m) => CORE.fullMeta(m, t, "zh");
  const seriesGroups = (s) => GROUPS.filter((g) => g.series === s);
  const seriesCount = (s) =>
    seriesGroups(s).reduce((n, g) => n + g.members.length, 0);
  const namesFor = (series, size) => CORE.names(series, size, t);
  const snapNow = () => S.snapshot();

  /* ---------------- toast ---------------- */
  let toastEl, toastTimer;
  function toast(msg, kind) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "proto-toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.dataset.kind = kind || "";
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2400);
  }

  /* ---------------- 共享组件 ---------------- */
  function cardHTML(m, opts = {}) {
    const snap = snapNow();
    const i = snap.selected.indexOf(m.id);
    const meta = opts.showGroup ? `${m.group} · ${metaText(m)}` : metaText(m);
    return `<button type="button" class="pcard" data-id="${m.id}" aria-pressed="${i >= 0}" data-order="${i + 1}">
      <span class="pcard-ph"><img src="${thumbSrc(m)}" alt="" loading="lazy" decoding="async" width="240" height="320"></span>
      <span class="pcard-nm">${esc(m.name)}</span>
      <span class="pcard-meta${m.status === "current" ? " now" : ""}">${esc(meta)}</span>
      <span class="pcard-i" data-info="${m.id}" role="button" tabindex="0" aria-label="${t("bio_open")}">i</span>
      <span class="pcard-ord" aria-hidden="true">${i >= 0 ? i + 1 : ""}</span>
    </button>`;
  }

  function fighterHTML(m) {
    return `<span class="pf-ph"><img src="${fullSrc(m)}" alt=""></span>
      <span class="pf-nm">${esc(m.name)}</span>
      <span class="pf-kn">${esc(m.kana || "")}</span>
      <span class="pf-meta">${esc(fullMeta(m))}</span>`;
  }

  function slotsHTML(ids, size) {
    const out = [];
    for (let i = 0; i < size; i++) {
      const m = BY_ID.get(ids[i]);
      const label = m
        ? `移除 ${m.name}（${m.group} · ${m.generation}）`
        : "空位";
      out.push(
        m
          ? `<li class="slot"><button type="button" data-remove="${m.id}" aria-label="${esc(label)}" title="${esc(label)}"><img src="${thumbSrc(m)}" alt="${esc(m.name)}"></button></li>`
          : `<li class="slot empty" aria-label="空位"></li>`
      );
    }
    return out.join("");
  }

  function ringHTML(done, total, sizePx) {
    const pct = total ? Math.min(1, done / total) : 0;
    const r = 26,
      c = 2 * Math.PI * r;
    return `<svg class="ring" width="${sizePx || 64}" height="${sizePx || 64}" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--line)" stroke-width="7"></circle>
      <circle cx="32" cy="32" r="${r}" fill="none" stroke="var(--pink)" stroke-width="7" stroke-linecap="round"
        stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}" transform="rotate(-90 32 32)"></circle>
      <text x="32" y="37" text-anchor="middle" class="ring-t">${done}/${total}</text>
    </svg>`;
  }

  /* ---------------- 资料卡（共享） ---------------- */
  let pfEl = null;
  function ensureProfile() {
    if (pfEl) return;
    pfEl = document.createElement("div");
    pfEl.className = "proto-profile";
    pfEl.hidden = true;
    pfEl.innerHTML = `<div class="pp-card" role="dialog" aria-modal="true" aria-label="成员简介">
      <button type="button" class="pp-close" aria-label="关闭">×</button>
      <div class="pp-head">
        <img class="pp-photo" alt="">
        <div class="pp-id">
          <h3 class="pp-name"></h3>
          <p class="pp-kana"></p>
          <span class="pp-badge"></span>
        </div>
      </div>
      <dl class="pp-fields"></dl>
    </div>`;
    document.body.appendChild(pfEl);
    pfEl.addEventListener("click", (e) => {
      if (e.target === pfEl || e.target.closest(".pp-close")) closeProfile();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !pfEl.hidden) closeProfile();
    });
  }
  function openProfile(id) {
    const m = BY_ID.get(id);
    if (!m) return;
    ensureProfile();
    pfEl.querySelector(".pp-photo").src = thumbSrc(m);
    pfEl.querySelector(".pp-name").textContent = m.name;
    pfEl.querySelector(".pp-kana").textContent = m.kana || "";
    pfEl.querySelector(".pp-badge").textContent =
      m.group + (m.generation ? " · " + m.generation : "");
    pfEl.querySelector(".pp-fields").innerHTML = CORE.profileRows(
      m,
      t,
      "zh",
      I18N.values
    )
      .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
      .join("");
    pfEl.hidden = false;
  }
  function closeProfile() {
    if (pfEl) pfEl.hidden = true;
  }

  /* ---------------- 海报 ---------------- */
  const imgCache = new Map();
  function loadImg(src) {
    if (!imgCache.has(src)) {
      imgCache.set(
        src,
        new Promise((res) => {
          const im = new Image();
          im.onload = () => res(im);
          im.onerror = () => res(null);
          im.src = src;
        })
      );
    }
    return imgCache.get(src);
  }
  const posterCanvas = document.createElement("canvas");
  posterCanvas.width = 1080;
  posterCanvas.height = 1440;
  let posterSeq = 0;
  async function drawPoster(ranking, title) {
    if (!ranking.length) return null;
    const seq = ++posterSeq;
    const size = window.AKB_POSTER.layout(ranking.length);
    posterCanvas.width = size.width;
    posterCanvas.height = size.height;
    const ctx = posterCanvas.getContext("2d");
    const imgs = await Promise.all(ranking.map((m) => loadImg(fullSrc(m))));
    if (seq !== posterSeq) return null;
    const snap = snapNow();
    const N = namesFor(snap.series, ranking.length);
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    window.AKB_POSTER.draw(ctx, {
      members: ranking,
      images: imgs,
      title: title || N.title,
      dateText: `${N.eyebrow} · ${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`,
      hashtag: N.posterTags,
      photoSrc: t(snap.series === "love" ? "photo_src_love" : "photo_src"),
      subOf: (m) => CORE.posterSub(m, t, "zh"),
    });
    try {
      return posterCanvas.toDataURL("image/png");
    } catch (_) {
      return null;
    }
  }
  function savePoster() {
    const snap = snapNow();
    posterCanvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = namesFor(snap.series, snap.size).fileBase + ".png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, "image/png");
  }
  function shareRanking(ranking) {
    const snap = snapNow();
    const title =
      (document.querySelector(".res-field input") || {}).value ||
      namesFor(snap.series, snap.size).title;
    const text =
      `${title}\n\n` +
      ranking.map((m, i) => `${i + 1}. ${m.name}`).join("\n") +
      `\n\n${namesFor(snap.series, snap.size).shareTags}`;
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener"
    );
  }

  /* ---------------- 结果页（共享） ---------------- */
  function renderResult(container, opts = {}) {
    const snap = snapNow();
    const ranking = (snap.ranking || []).map((id) => BY_ID.get(id));
    const N = namesFor(snap.series, snap.size);
    container.innerHTML = `<div class="res-wrap${opts.reveal ? " reveal" : ""}">
      <figure class="res-poster"><img alt="我的排名图"><figcaption>${t("longpress")}</figcaption></figure>
      <div class="res-side">
        ${opts.extraHTML || ""}
        <label class="res-field"><span>${t("title_label")}</span>
          <input type="text" maxlength="24" value="${esc(N.title)}"></label>
        <ol class="res-rank">${ranking
          .map(
            (m, i) => `<li style="--i:${i}">
          <span class="no">${i + 1}</span><img src="${thumbSrc(m)}" alt="">
          <span class="nm">${esc(m.name)}<span class="meta">${esc(fullMeta(m))}</span></span>
          <span class="info" role="button" tabindex="0" aria-label="${t("bio_open")}">i</span></li>`
          )
          .join("")}</ol>
        <div class="res-actions">
          <button type="button" class="btn primary" data-act="save">${t("save")}</button>
          <button type="button" class="btn" data-act="share">${t("share")}</button>
          <button type="button" class="btn" data-act="resort">${t("resort")}</button>
          <button type="button" class="btn" data-act="restart">${t("reselect")}</button>
        </div>
      </div>
    </div>`;
    const img = container.querySelector(".res-poster img");
    const input = container.querySelector(".res-field input");
    let seq = 0;
    async function redraw() {
      const mine = ++seq;
      const url = await drawPoster(ranking, input.value.trim());
      if (url && img && mine === seq) img.src = url;
    }
    redraw();
    let tm;
    input.addEventListener("input", () => {
      clearTimeout(tm);
      tm = setTimeout(redraw, 250);
    });
    container.addEventListener("click", (e) => {
      const info = e.target.closest(".info");
      if (info) {
        const li = info.closest("li");
        const idx = [...container.querySelectorAll(".res-rank li")].indexOf(li);
        if (ranking[idx]) openProfile(ranking[idx].id);
        return;
      }
      const act = e.target.closest("[data-act]");
      if (!act) return;
      const a = act.dataset.act;
      if (a === "save") savePoster();
      else if (a === "share") shareRanking(ranking);
      else if (a === "resort" && opts.onResort) opts.onResort(ranking);
      else if (a === "restart" && opts.onRestart) opts.onRestart();
    });
  }

  /* ---------------- 浮动切换条 ---------------- */
  const VARIANTS = [];
  const root = () => document.getElementById("proto-root");
  const menu = () => document.getElementById("proto-menu");
  function register(v) {
    VARIANTS.push(v);
  }
  function closeMenu() {
    const m = menu();
    if (m) m.hidden = true;
  }
  function mount(key) {
    const v = VARIANTS.find((x) => x.key === key) || VARIANTS[0];
    if (!v) return;
    closeMenu();
    root().innerHTML = "";
    root().dataset.variant = v.key;
    v.mount(root(), api);
    document.title = `${v.key} · ${v.name} — 交互/UX 原型 v5`;
    const label = document.getElementById("ps-label");
    if (label) label.textContent = `${v.key} · ${v.name}`;
    const url = new URL(location.href);
    url.searchParams.set("variant", v.key);
    history.replaceState(null, "", url);
  }
  function cycle(step) {
    const cur = root().dataset.variant || "A";
    const i = VARIANTS.findIndex((x) => x.key === cur);
    const next = VARIANTS[(i + step + VARIANTS.length) % VARIANTS.length];
    mount(next.key);
  }
  function buildSwitcher() {
    const sw = document.querySelector(".proto-switch");
    if (!sw) return;
    sw.addEventListener("click", (e) => {
      const go = e.target.closest("[data-go]");
      if (go) return cycle(+go.dataset.go);
      if (e.target.closest("#ps-label")) {
        const m = menu();
        m.innerHTML = VARIANTS.map(
          (v) => `<button type="button" role="menuitem" data-key="${v.key}">
          <b>${v.key} · ${v.name}</b><span>${v.desc}</span></button>`
        ).join("");
        m.hidden = !m.hidden;
      }
    });
    menu().addEventListener("click", (e) => {
      const b = e.target.closest("[data-key]");
      if (b) mount(b.dataset.key);
    });
    document.addEventListener("click", (e) => {
      if (
        !e.target.closest(".proto-switch") &&
        !e.target.closest(".proto-menu")
      )
        closeMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.target.closest("input, textarea")) return;
      if (e.key === "[") cycle(-1);
      else if (e.key === "]") cycle(1);
      else if (e.key === "Escape") closeMenu();
    });
  }

  /* ---------------- 公共入口 ---------------- */
  const api = {
    CORE,
    I18N,
    t,
    esc,
    S,
    snap: snapNow,
    GROUPS,
    BY_ID,
    seriesGroups,
    seriesCount,
    namesFor,
    thumbSrc,
    fullSrc,
    metaText,
    fullMeta,
    cardHTML,
    fighterHTML,
    slotsHTML,
    ringHTML,
    toast,
    openProfile,
    closeProfile,
    drawPoster,
    renderResult,
    rawDuel(series) {
      const st = CORE.deserializeState(
        mem.getItem(`akb:state:v2:${series}`) || ""
      );
      return st && st.duel ? st.duel : null;
    },
    beginDuel() {
      const snap = snapNow();
      if (snap.selected.length < snap.size) return false;
      return S.startDuel(CORE.shuffle(snap.selected.slice()));
    },
  };
  window.PROTO = { register, api };

  document.addEventListener("DOMContentLoaded", () => {
    buildSwitcher();
    const key = (
      new URLSearchParams(location.search).get("variant") || "A"
    ).toUpperCase();
    mount(key);
  });
})();
