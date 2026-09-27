(() => {
  "use strict";

  const CORE = window.AKB_CORE;
  const FOLD = CORE.foldIndex(window.AKB_SIMPLIFIED || {});

  const GROUPS = window.AKB_GROUPS || [];
  const BY_ID = new Map();
  GROUPS.forEach((g) =>
    g.members.forEach((m) => {
      m.group = g.group;
      m.generation = g.label;
      m.series = g.series;
      BY_ID.set(m.id, m);
    })
  );

  const S = window.AKB_SESSION.create({
    storage: {
      getItem: (k) => localStorage.getItem(k),
      setItem: (k, v) => localStorage.setItem(k, v),
    },
    byId: (id) => BY_ID.get(id),
  });
  let snap = S.snapshot();
  let series = snap.series;
  let pick = snap.size;
  function sync() {
    snap = S.snapshot();
    series = snap.series;
    pick = snap.size;
  }

  const I18N = window.AKB_I18N;

  let lang = "zh";
  try {
    if (localStorage.getItem("akb-lang") === "en") lang = "en";
  } catch (_) {}
  const t = (key, ...args) => {
    const v = I18N[lang][key];
    return typeof v === "function" ? v(...args) : v;
  };
  function names() {
    return CORE.names(series, pick, t);
  }

  function applyStatic() {
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.dataset.i18n;
      if (I18N[lang][key] != null) el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
    document.querySelectorAll("[data-i18n-alt]").forEach((el) => {
      el.alt = t(el.dataset.i18nAlt);
    });
    document.querySelectorAll(".seg-lang [data-lang]").forEach((b) => {
      b.setAttribute("aria-checked", b.dataset.lang === lang);
    });
    const N = names();
    const brand = $("#brand");
    if (brand) {
      brand.textContent = N.brand;
      brand.classList.toggle("long", pick !== 7 || lang === "en");
    }
    const eyebrow = $("#eyebrow");
    if (eyebrow) eyebrow.textContent = N.eyebrow;
    const size7 = $("#size-7");
    if (size7) size7.textContent = CORE.names(series, 7, t).brand;
    document.querySelectorAll(".seg-series [data-series]").forEach((b) => {
      b.textContent = CORE.names(b.dataset.series, pick, t).seriesLabel;
      b.setAttribute("aria-checked", b.dataset.series === series);
    });
    const seriesSeg = document.querySelector(".seg-series");
    if (seriesSeg) seriesSeg.setAttribute("aria-label", t("series_label"));
    const title = $("#title-input");
    if (title && !title.dataset.dirty) title.value = N.title;
  }

  const $ = (s) => document.querySelector(s);
  const thumbSrc = (m) => CORE.photoSrc(m, "thumb");
  const fullSrc = (m) => CORE.photoSrc(m, "full");
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
    );

  const metaText = (m) => CORE.metaText(m, t, lang);
  const fullMeta = (m) => CORE.fullMeta(m, t, lang);
  const posterSub = (m) => CORE.posterSub(m, t, lang);

  const seriesGroups = () => GROUPS.filter((g) => g.series === series);

  /* ---------------- phase switching ---------------- */
  function show(phase) {
    for (const id of ["pick", "duel", "result"]) {
      $(`#phase-${id}`).hidden = id !== phase;
    }
    window.scrollTo({ top: 0 });
  }

  /* ---------------- pick ---------------- */
  const roster = $("#roster");

  function visible(m) {
    return m.series === series && CORE.isVisible(m, snap.filter);
  }

  function cardHTML(m, showGroup) {
    const i = snap.selected.indexOf(m.id);
    const meta = showGroup ? `${m.group} · ${metaText(m)}` : metaText(m);
    return `<button class="card" data-id="${m.id}" aria-pressed="${i >= 0}" data-order="${i + 1}" title="${esc(m.name)}${m.kana ? "（" + esc(m.kana) + "）" : ""}">
      <span class="info" role="button" aria-label="${t("bio_open")}">i</span>
      <span class="ph"><img src="${thumbSrc(m)}" alt="" loading="lazy" decoding="async" width="240" height="320"></span>
      <span class="nm">${esc(m.name)}</span>
      <span class="meta${m.status === "current" ? " now" : ""}">${esc(meta)}</span>
    </button>`;
  }

  function pickedInNode(node) {
    return node.sections
      .flatMap((s) => s.members)
      .filter((m) => snap.selected.includes(m.id)).length;
  }

  let secSeq = 0;
  const SEC_INDEX = new Map();

  function sectionHTML(s, group) {
    const ms = s.members.filter(visible);
    if (!ms.length) return "";
    const secId = `${group}#${s.label}`;
    SEC_INDEX.set(secId, ms);
    const secUid = `gen-${++secSeq}`;
    const open = snap.open.includes(secId);
    const now = ms.filter((m) => m.status === "current").length;
    const count =
      snap.filter === "all" && now
        ? t("people_now", ms.length, now)
        : t("people", ms.length);
    const picked = ms.filter((m) => snap.selected.includes(m.id)).length;
    const sub = snap.group === "all" ? " sub" : "";
    return `<section class="gen${sub}" data-sec="${esc(secId)}">
      <button class="gen-head" aria-expanded="${open}" aria-controls="${secUid}">
        <i class="chev" aria-hidden="true"></i>
        <span class="gen-name">${esc(s.label)}</span>
        <span class="gen-count">${count}</span>
        <span class="gen-picked">${picked ? t("picked", picked) : ""}</span>
      </button>
      <div class="gen-body" id="${secUid}" ${open ? "" : "hidden"}>${open ? ms.map((m) => cardHTML(m)).join("") : ""}</div>
    </section>`;
  }

  function renderPick(opts = {}) {
    renderRoster();
    syncSelection();
    if (opts.resetScroll) roster.scrollTop = 0;
  }

  function renderRoster() {
    sync();
    const q = CORE.normalizeName(snap.query);
    if (q) return renderSearch(q);

    const tree = CORE.groupSections(seriesGroups(), snap.group);
    const twoLevel = snap.group === "all";
    const html = [];
    for (const node of tree) {
      const body = node.sections
        .map((s) => sectionHTML(s, node.group))
        .filter(Boolean)
        .join("");
      if (!body) continue;
      if (!twoLevel) {
        html.push(body);
        continue;
      }
      const ms = node.sections.flatMap((s) => s.members).filter(visible);
      const now = ms.filter((m) => m.status === "current").length;
      const count =
        snap.filter === "all" && now
          ? t("people_now", ms.length, now)
          : t("people", ms.length);
      const picked = pickedInNode(node);
      const key = "g:" + node.group;
      const open = snap.open.includes(key);
      html.push(`<section class="grp" data-group="${esc(node.group)}">
        <button class="grp-head" aria-expanded="${open}" aria-controls="grp-${esc(node.group)}">
          <i class="chev" aria-hidden="true"></i>
          <span class="grp-name">${esc(node.group)}</span>
          <span class="grp-count">${count}</span>
          <span class="grp-picked">${picked ? t("picked", picked) : ""}</span>
        </button>
        <div class="grp-body" id="grp-${esc(node.group)}" ${open ? "" : "hidden"}>${open ? body : ""}</div>
      </section>`);
    }
    roster.innerHTML =
      html.join("") || `<p class="empty">${t("empty_filter")}</p>`;
  }

  BY_ID.forEach((m) => {
    m.hay = CORE.haystack(m, FOLD);
  });

  function renderSearch(q) {
    const hits = [];
    for (const g of seriesGroups()) {
      if (snap.group !== "all" && g.group !== snap.group) continue;
      for (const m of g.members) {
        if (visible(m) && m.hay.includes(q)) hits.push(m);
      }
    }
    roster.innerHTML = hits.length
      ? `<p class="search-hint">${t("found", hits.length)}</p><div class="gen-body">${hits.map((m) => cardHTML(m, true)).join("")}</div>`
      : `<p class="empty">${t("empty_search", esc(snap.query))}</p>`;
  }

  function toggleGroup(secId) {
    const sec = [...roster.querySelectorAll(".gen")].find(
      (el) => el.dataset.sec === secId
    );
    if (!sec) return;
    const head = sec.querySelector(".gen-head");
    const body = sec.querySelector(".gen-body");
    const open = S.toggleOpen(secId);
    if (open) {
      body.innerHTML = (SEC_INDEX.get(secId) || []).map(cardHTML).join("");
      body.hidden = false;
    } else {
      body.hidden = true;
      body.innerHTML = "";
    }
    head.setAttribute("aria-expanded", open);
    if (
      !open &&
      head.getBoundingClientRect().top < roster.getBoundingClientRect().top
    ) {
      roster.scrollTop = sec.offsetTop;
    }
  }

  function toggleGroupNode(name) {
    const sec = roster.querySelector(`.grp[data-group="${name}"]`);
    if (!sec) return;
    const head = sec.querySelector(".grp-head");
    const body = sec.querySelector(".grp-body");
    const key = "g:" + name;
    const open = S.toggleOpen(key);
    if (open) {
      const node = CORE.groupSections(seriesGroups(), snap.group).find(
        (n) => n.group === name
      );
      body.innerHTML = node
        ? node.sections
            .map((s) => sectionHTML(s, node.group))
            .filter(Boolean)
            .join("")
        : "";
      body.hidden = false;
    } else {
      body.hidden = true;
      body.innerHTML = "";
    }
    head.setAttribute("aria-expanded", open);
  }

  function toggleMember(id) {
    if (!S.toggleSelect(id)) {
      const tray = $("#tray");
      tray.classList.remove("shake");
      void tray.offsetWidth;
      tray.classList.add("shake");
      return;
    }
    syncSelection();
  }

  function syncSelection() {
    sync();
    roster.querySelectorAll(".card").forEach((el) => {
      const i = snap.selected.indexOf(el.dataset.id);
      el.setAttribute("aria-pressed", i >= 0);
      el.dataset.order = i + 1;
    });
    roster.querySelectorAll(".gen").forEach((sec) => {
      const members = SEC_INDEX.get(sec.dataset.sec) || [];
      const n = members.filter((m) => snap.selected.includes(m.id)).length;
      sec.querySelector(".gen-picked").textContent = n ? t("picked", n) : "";
    });
    const tree = CORE.groupSections(seriesGroups(), snap.group);
    roster.querySelectorAll(".grp").forEach((sec) => {
      const node = tree.find((n) => n.group === sec.dataset.group);
      const picked = node ? pickedInNode(node) : 0;
      sec.querySelector(".grp-picked").textContent = picked
        ? t("picked", picked)
        : "";
    });
    roster.classList.toggle("full", snap.selected.length >= pick);
    renderTray();
  }

  function renderTray() {
    const slots = [];
    for (let i = 0; i < pick; i++) {
      const m = BY_ID.get(snap.selected[i]);
      const label = m
        ? esc(t("slot_remove", m.name, m.group, m.generation))
        : "";
      slots.push(
        m
          ? `<li class="slot"><button type="button" data-remove="${m.id}" aria-label="${label}" title="${label}"><img src="${thumbSrc(m)}" alt="${esc(m.name)}"></button></li>`
          : `<li class="slot empty-slot" aria-label="${t("empty_slot")}"></li>`
      );
    }
    $("#slots").innerHTML = slots.join("");
    $("#tray").classList.toggle("wide", pick !== 7);
    $("#slots").style.setProperty("--slots", String(pick === 7 ? 7 : 8));
    const left = pick - snap.selected.length;
    const btn = $("#start-btn");
    btn.disabled = left > 0;
    btn.textContent = left > 0 ? t("need", left) : t("start");
    const clearBtn = $("#clear-btn");
    if (clearBtn) clearBtn.disabled = snap.selected.length === 0;
  }

  /* ---------------- 简介（原型 C 杂志编辑） ---------------- */
  let profileId = null;

  function openProfile(id) {
    const m = BY_ID.get(id);
    if (!m) return;
    profileId = id;
    const rows = CORE.profileRows(m, t, lang, I18N.values);
    $("#pf-photo").src = thumbSrc(m);
    $("#pf-name").textContent = m.name;
    $("#pf-kana").textContent = m.kana || "";
    $("#pf-badge").textContent =
      m.group + (m.generation ? " · " + m.generation : "");
    $("#pf-close").setAttribute("aria-label", t("bio_close"));
    $("#pf-fields").innerHTML = rows
      .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
      .join("");
    $("#profile").hidden = false;
  }

  function closeProfile() {
    profileId = null;
    $("#profile").hidden = true;
  }

  $("#profile").addEventListener("click", (e) => {
    if (e.target === $("#profile") || e.target.closest(".pf-close"))
      closeProfile();
  });

  roster.addEventListener("click", (e) => {
    const grp = e.target.closest(".grp-head");
    if (grp) return toggleGroupNode(grp.parentElement.dataset.group);
    const head = e.target.closest(".gen-head");
    if (head) return toggleGroup(head.parentElement.dataset.sec);
    const info = e.target.closest(".info");
    if (info) {
      const card = info.closest(".card");
      if (card) return openProfile(card.dataset.id);
    }
    const card = e.target.closest(".card");
    if (card) toggleMember(card.dataset.id);
  });

  $("#slots").addEventListener("click", (e) => {
    const b = e.target.closest("[data-remove]");
    if (b) toggleMember(b.dataset.remove);
  });

  const groupSelect = $("#group-filter");

  function refreshGroupOptions() {
    groupSelect.innerHTML = `<option value="all">${t("all_groups")}</option>`;
    for (const node of CORE.groupSections(seriesGroups(), "all")) {
      const opt = document.createElement("option");
      opt.value = node.group;
      opt.textContent = node.group;
      groupSelect.appendChild(opt);
    }
  }

  function paintSizeButtons() {
    document
      .querySelectorAll(".seg-size button")
      .forEach((b) => b.setAttribute("aria-checked", +b.dataset.pick === pick));
  }

  function switchSeries(next) {
    if (!S.switchSeries(next)) return;
    sync();
    const search = $("#search");
    if (search) search.value = "";
    document
      .querySelectorAll(".seg-filter button")
      .forEach((b) =>
        b.setAttribute("aria-checked", b.dataset.filter === "all")
      );
    refreshGroupOptions();
    paintSizeButtons();
    applyStatic();
    const title = $("#title-input");
    if (title && !title.dataset.dirty) title.value = names().title;
    if (snap.phase === "duel") {
      show("duel");
      renderDuel();
    } else if (snap.phase === "result") {
      renderResult();
    } else {
      show("pick");
      renderPick();
    }
  }

  groupSelect.addEventListener("change", () => {
    S.setGroup(groupSelect.value);
    renderPick({ resetScroll: true });
  });

  document.querySelectorAll(".seg-filter button").forEach((b) => {
    b.addEventListener("click", () => {
      document
        .querySelectorAll(".seg-filter button")
        .forEach((x) => x.setAttribute("aria-checked", x === b));
      S.setFilter(b.dataset.filter);
      renderPick();
    });
  });

  document.querySelectorAll(".seg-size button").forEach((b) => {
    b.addEventListener("click", () => {
      const next = +b.dataset.pick;
      if (!S.setSize(next)) return;
      sync();
      paintSizeButtons();
      applyStatic();
      const title = $("#title-input");
      if (!title.dataset.dirty) title.value = names().title;
      renderPick();
    });
  });

  $("#title-input").addEventListener("change", () => {
    $("#title-input").dataset.dirty = "1";
  });

  let searchTimer;
  $("#search").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      S.setQuery(e.target.value);
      renderPick({ resetScroll: true });
    }, 120);
  });

  $("#start-btn").addEventListener("click", () =>
    beginDuel(CORE.shuffle(snap.selected.slice()))
  );

  $("#clear-btn").addEventListener("click", () => {
    if (!snap.selected.length) return;
    if (!window.confirm(t("clear_confirm"))) return;
    S.clearSelection();
    syncSelection();
  });

  /* ---------------- duel (replayable merge sort) ---------------- */
  function beginDuel(order) {
    if (!S.startDuel(order)) return;
    order.forEach((id) => {
      new Image().src = fullSrc(BY_ID.get(id));
    });
    show("duel");
    renderDuel();
  }

  function renderDuel() {
    sync();
    if (snap.phase === "result") return renderResult();
    if (snap.phase !== "duel") return;
    $("#duel-max").textContent = snap.duel.max;
    $("#duel-step").textContent = snap.duel.step;
    $("#duel-bar").style.width = `${snap.duel.percent}%`;
    const extra = $("#duel-extra");
    if (extra)
      extra.textContent = t(
        "duel_extra",
        snap.duel.percent,
        snap.duel.remaining,
        Math.max(1, Math.ceil(snap.duel.etaSeconds / 60))
      );
    $("#undo-btn").disabled = !snap.duel.canUndo;
    fillFighter($("#fighter-a"), BY_ID.get(snap.duel.pair[0]));
    fillFighter($("#fighter-b"), BY_ID.get(snap.duel.pair[1]));
  }

  function fillFighter(el, m) {
    el.classList.remove("picked");
    el.innerHTML = `<span class="ph"><img src="${fullSrc(m)}" alt=""></span>
      <span class="nm">${esc(m.name)}</span>
      <span class="kn">${esc(m.kana)}</span>
      <span class="meta">${esc(fullMeta(m))}</span>`;
    el.setAttribute("aria-label", t("pick_who", m.name));
  }

  let answering = false;
  function answer(leftWins) {
    if (answering || $("#phase-duel").hidden) return;
    answering = true;
    const forSeries = series;
    (leftWins ? $("#fighter-a") : $("#fighter-b")).classList.add("picked");
    setTimeout(() => {
      answering = false;
      if (S.snapshot().series !== forSeries) return;
      if (!S.answer(leftWins)) return;
      sync();
      if (snap.phase === "result") renderResult();
      else renderDuel();
    }, 160);
  }

  function undo() {
    if ($("#phase-duel").hidden) return;
    if (!S.undo()) return;
    renderDuel();
  }

  $("#fighter-a").addEventListener("click", () => answer(true));
  $("#fighter-b").addEventListener("click", () => answer(false));
  $("#undo-btn").addEventListener("click", undo);
  $("#back-pick-btn").addEventListener("click", backToPick);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#profile").hidden) closeProfile();
  });

  document.addEventListener("keydown", (e) => {
    if (
      $("#phase-duel").hidden ||
      e.target.closest?.("input, textarea") ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey
    )
      return;
    if (e.key === "ArrowLeft") answer(true);
    else if (e.key === "ArrowRight") answer(false);
    else if (e.key === "z" || e.key === "Z" || e.key === "Backspace") undo();
  });

  function backToPick() {
    S.abandonDuel();
    sync();
    show("pick");
    renderPick();
  }

  /* ---------------- result ---------------- */
  let ranking = [];

  function renderRankList() {
    $("#rank-list").innerHTML = ranking
      .map(
        (m, i) => `<li>
      <span class="no">${i + 1}</span>
      <img src="${thumbSrc(m)}" alt="">
      <span class="nm">${esc(m.name)}<span class="meta">${esc(fullMeta(m))}</span></span>
      <span class="info" role="button" aria-label="${t("bio_open")}">i</span>
    </li>`
      )
      .join("");
  }

  $("#rank-list").addEventListener("click", (e) => {
    const info = e.target.closest(".info");
    if (!info) return;
    const li = info.closest("li");
    const idx = [...$("#rank-list").children].indexOf(li);
    if (idx >= 0 && ranking[idx]) openProfile(ranking[idx].id);
  });

  function renderResult() {
    sync();
    if (snap.phase !== "result") return;
    ranking = snap.ranking.map((id) => BY_ID.get(id));
    renderRankList();
    show("result");
    drawPoster();
  }

  let drawTimer;
  $("#title-input").addEventListener("input", () => {
    clearTimeout(drawTimer);
    drawTimer = setTimeout(drawPoster, 200);
  });
  $("#resort-btn").addEventListener("click", () =>
    beginDuel(CORE.shuffle(ranking.map((m) => m.id)))
  );
  $("#restart-btn").addEventListener("click", backToPick);
  $("#save-btn").addEventListener("click", savePoster);
  $("#share-btn").addEventListener("click", () => {
    const text =
      `${$("#title-input").value.trim() || names().title}\n\n` +
      ranking.map((m, i) => `${i + 1}. ${m.name}`).join("\n") +
      `\n\n${names().shareTags}`;
    const url =
      location.protocol.startsWith("http") &&
      !/^(localhost|127\.)/.test(location.hostname)
        ? location.href.split("#")[0]
        : "";
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}${url ? "&url=" + encodeURIComponent(url) : ""}`,
      "_blank",
      "noopener"
    );
  });

  /* ---------------- poster canvas ---------------- */
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

  async function fontsReady() {
    if (!document.fonts) return;
    const wait = Promise.all([
      document.fonts.load(`64px "Dela Gothic One"`),
      document.fonts.load(`700 40px "Zen Kaku Gothic New"`, "渡辺麻友"),
    ]);
    await Promise.race([wait, new Promise((r) => setTimeout(r, 2500))]);
  }

  function posterTokens() {
    const d = AKB_POSTER.defaultTokens();
    const cs = getComputedStyle(document.documentElement);
    const v = (name, fallback) =>
      (cs.getPropertyValue(name) || "").replace(/\s+/g, " ").trim() || fallback;
    return {
      colors: {
        floor: v("--floor", d.colors.floor),
        card: v("--card", d.colors.card),
        ink: v("--ink", d.colors.ink),
        muted: v("--muted", d.colors.muted),
        line: v("--line", d.colors.line),
        pink: v("--pink", d.colors.pink),
        tape: v("--lemon", d.colors.tape),
      },
      fonts: {
        ui: v("--font-ui", d.fonts.ui),
        jp: v("--font-jp", d.fonts.jp),
        display: v("--font-display", d.fonts.display),
      },
    };
  }

  async function drawPoster() {
    if (!ranking.length) return;
    const canvas = $("#poster-canvas");
    const size = AKB_POSTER.layout(ranking.length);
    canvas.width = size.width;
    canvas.height = size.height;
    $("#poster").classList.toggle("tall", size.height > 1440);
    const ctx = canvas.getContext("2d");
    const [imgs] = await Promise.all([
      Promise.all(ranking.map((m) => loadImg(fullSrc(m)))),
      fontsReady(),
    ]);

    const title = $("#title-input").value.trim() || names().title;
    const d = new Date();
    AKB_POSTER.draw(ctx, {
      members: ranking,
      images: imgs,
      title,
      dateText: `${names().eyebrow} · ${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`,
      hashtag: names().posterTags,
      photoSrc: t("photo_src"),
      subOf: posterSub,
      tokens: posterTokens(),
    });

    try {
      $("#poster-img").src = canvas.toDataURL("image/png");
    } catch (err) {
      $("#poster-img").alt = t("poster_fail");
      console.error(err);
    }
  }

  function posterFileName() {
    return `${names().fileBase}.png`;
  }

  function savePoster() {
    const canvas = $("#poster-canvas");
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = posterFileName();
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, "image/png");
  }

  function setLang(next) {
    if (next !== "en" && next !== "zh") return;
    lang = next;
    try {
      localStorage.setItem("akb-lang", lang);
    } catch (_) {}
    applyStatic();
    renderPick();
    if (profileId && !$("#profile").hidden) openProfile(profileId);
    if (!$("#phase-duel").hidden) renderDuel();
    if (!$("#phase-result").hidden && ranking.length) {
      renderRankList();
      drawPoster();
    }
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-lang]");
    if (b) return setLang(b.dataset.lang);
    const s = e.target.closest(".seg-series [data-series]");
    if (s) switchSeries(s.dataset.series);
  });

  /* ---------------- boot ---------------- */
  refreshGroupOptions();
  paintSizeButtons();
  applyStatic();
  if (snap.phase === "duel") {
    show("duel");
    renderDuel();
  } else if (snap.phase === "result") {
    renderResult();
  } else {
    renderPick();
  }
})();
