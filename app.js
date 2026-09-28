(() => {
  "use strict";

  const CORE = window.AKB_CORE;
  const FOLD = CORE.foldIndex(window.AKB_SIMPLIFIED || {});

  const GROUPS = window.AKB_GROUPS || [];
  const BY_ID = new Map(CORE.flattenMembers(GROUPS).map((m) => [m.id, m]));

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
  let view = "pick";
  let duel50 = false;
  let introOpen = false;
  function sync() {
    snap = S.snapshot();
    series = snap.series;
    pick = snap.size;
  }

  const I18N = window.AKB_I18N;

  const preferLang = () => {
    const nav = (navigator.language || "").toLowerCase();
    return nav.startsWith("ja") ? "ja" : nav.startsWith("zh") ? "zh" : "en";
  };
  let lang = preferLang();
  try {
    const saved = localStorage.getItem("akb-lang");
    if (saved === "en" || saved === "zh" || saved === "ja") lang = saved;
  } catch (_) {}
  const t = (key, ...args) => {
    const v = I18N[lang][key];
    return typeof v === "function" ? v(...args) : v;
  };
  function names() {
    return CORE.names(series, pick, t);
  }

  const POSTER_STYLE_KEY = "akb:poster-style";
  let posterStyle = "a";
  try {
    const saved = localStorage.getItem(POSTER_STYLE_KEY);
    if (AKB_POSTER.styles.includes(saved)) posterStyle = saved;
  } catch (_) {}

  // 分段控件选中态统一绘制：aria-checked = 按钮属性值 === 当前值（值一律按字符串比）
  function paintSeg(sel, attr, value) {
    const want = String(value);
    const key = `data-${attr}`;
    document.querySelectorAll(`${sel} [${key}]`).forEach((b) => {
      b.setAttribute("aria-checked", b.getAttribute(key) === want);
    });
  }

  function renderStyleSeg() {
    paintSeg(".seg-style", "style", posterStyle);
  }

  function setPosterStyle(next) {
    if (!AKB_POSTER.styles.includes(next) || next === posterStyle) return;
    posterStyle = next;
    try {
      localStorage.setItem(POSTER_STYLE_KEY, next);
    } catch (_) {}
    renderStyleSeg();
    drawPoster();
  }

  function applyStatic() {
    document.documentElement.lang =
      lang === "en" ? "en" : lang === "ja" ? "ja" : "zh-CN";
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
    document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel));
    });
    paintSeg(".seg-lang", "lang", lang);
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
    });
    paintSeg(".seg-series", "series", series);
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

  function viewOpts() {
    return {
      group: snap.group,
      generation: snap.generation,
      status: snap.filter,
      query: snap.query,
      selected: snap.selected,
    };
  }

  const rosterView = () => CORE.rosterView(seriesGroups(), viewOpts());

  // 计数文案单一出处（数字来自投影，i18n 留在 DOM 层）
  function countText(node) {
    return snap.filter === "all" && node.current
      ? t("people_now", node.count, node.current)
      : t("people", node.count);
  }

  function cardHTML(m, showGroup) {
    const i = snap.selected.indexOf(m.id);
    const meta = showGroup ? `${m.group} · ${metaText(m)}` : metaText(m);
    return `<button class="card" data-id="${m.id}" aria-pressed="${i >= 0}" data-order="${i + 1}" title="${esc(m.name)}${m.kana ? "（" + esc(m.kana) + "）" : ""}">
      <span class="info" role="button" aria-label="${t("bio_open")}" data-profile="${m.id}">i</span>
      <span class="ph"><img src="${thumbSrc(m)}" alt="" loading="lazy" decoding="async" width="240" height="320"></span>
      <span class="nm">${esc(m.name)}</span>
      <span class="meta${m.status === "current" ? " now" : ""}">${esc(meta)}</span>
    </button>`;
  }

  let secSeq = 0;

  function sectionHTML(sec) {
    const secUid = `gen-${++secSeq}`;
    const open = snap.open.includes(sec.id);
    const sub = snap.group === "all" ? " sub" : "";
    return `<section class="gen${sub}" data-sec="${esc(sec.id)}">
      <button class="gen-head" aria-expanded="${open}" aria-controls="${secUid}">
        <i class="chev" aria-hidden="true"></i>
        <span class="gen-name">${esc(sec.label)}</span>
        <span class="gen-count">${countText(sec)}</span>
        <span class="gen-picked">${sec.picked ? t("picked", sec.picked) : ""}</span>
      </button>
      <div class="gen-body" id="${secUid}" ${open ? "" : "hidden"}>${open ? sec.members.map((m) => cardHTML(m)).join("") : ""}</div>
    </section>`;
  }

  function viewSection(id) {
    for (const node of rosterView().nodes) {
      const sec = node.sections.find((s) => s.id === id);
      if (sec) return sec;
    }
    return null;
  }

  function renderPick(opts = {}) {
    ensureOpen();
    renderRoster();
    syncSelection();
    if (opts.resetScroll) roster.scrollTop = 0;
  }

  function renderRoster() {
    sync();
    const view = rosterView();
    if (view.mode === "search") return renderSearch(view);

    const twoLevel = view.mode === "tree";
    const html = [];
    for (const node of view.nodes) {
      const body = node.sections.map(sectionHTML).join("");
      if (!twoLevel) {
        html.push(body);
        continue;
      }
      const open = snap.open.includes(node.id);
      html.push(`<section class="grp" data-group="${esc(node.group)}">
        <button class="grp-head" aria-expanded="${open}" aria-controls="grp-${esc(node.group)}">
          <i class="chev" aria-hidden="true"></i>
          <span class="grp-name">${esc(node.group)}</span>
          <span class="grp-count">${countText(node)}</span>
          <span class="grp-picked">${node.picked ? t("picked", node.picked) : ""}</span>
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

  function renderSearch(view) {
    const hits = view.hits;
    roster.innerHTML = hits.length
      ? `<p class="search-hint">${t("found", hits.length)}</p><div class="gen-body">${hits.map((m) => cardHTML(m, true)).join("")}</div>`
      : `<p class="empty">${t("empty_search", esc(snap.query))}</p><p class="hint">${t("empty_search_hint")}</p>`;
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
      body.innerHTML = (viewSection(secId)?.members || [])
        .map(cardHTML)
        .join("");
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
      const node = rosterView().nodes.find((n) => n.group === name);
      body.innerHTML = node ? node.sections.map(sectionHTML).join("") : "";
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
    sync();
    if (snap.selected.length === snap.size) toast(t("picked_full"));
    syncSelection();
  }

  function syncSelection() {
    sync();
    roster.querySelectorAll(".card").forEach((el) => {
      const i = snap.selected.indexOf(el.dataset.id);
      el.setAttribute("aria-pressed", i >= 0);
      el.dataset.order = i + 1;
    });
    const view = rosterView();
    const secPicked = new Map();
    const grpPicked = new Map();
    for (const node of view.nodes) {
      grpPicked.set(node.group, node.picked);
      for (const sec of node.sections) secPicked.set(sec.id, sec.picked);
    }
    roster.querySelectorAll(".gen").forEach((sec) => {
      const n = secPicked.get(sec.dataset.sec) || 0;
      sec.querySelector(".gen-picked").textContent = n ? t("picked", n) : "";
    });
    roster.querySelectorAll(".grp").forEach((sec) => {
      const n = grpPicked.get(sec.dataset.group) || 0;
      sec.querySelector(".grp-picked").textContent = n ? t("picked", n) : "";
    });
    roster.classList.toggle("full", snap.selected.length >= pick);
    renderTray();
    renderSteps();
    renderGuide();
  }

  function renderTray() {
    const slots = [];
    for (let i = 0; i < pick; i++) {
      const m = BY_ID.get(snap.selected[i]);
      const label = m
        ? esc(
            t("slot_remove", m.name, m.group, CORE.genText(m.generation, lang))
          )
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
    btn.textContent =
      left > 0
        ? t("need", left)
        : snap.phase === "duel"
          ? t("resume_go")
          : t("start_est", CORE.worstCase(pick));
    btn.classList.toggle("emphasis", left === 0);
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
      m.group + (m.generation ? " · " + CORE.genText(m.generation, lang) : "");
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

  // ⓘ 的成员归属只看 data-profile（不再依赖 DOM 位置或容器）
  function profileIdOf(e) {
    const info = e.target.closest(".info");
    return info ? info.dataset.profile || null : null;
  }

  function profileKey(e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    const id = profileIdOf(e);
    if (!id) return;
    e.preventDefault();
    openProfile(id);
  }

  function profileClick(e) {
    const id = profileIdOf(e);
    if (id) openProfile(id);
  }

  roster.addEventListener("keydown", profileKey);

  roster.addEventListener("click", (e) => {
    const grp = e.target.closest(".grp-head");
    if (grp) return toggleGroupNode(grp.parentElement.dataset.group);
    const head = e.target.closest(".gen-head");
    if (head) return toggleGroup(head.parentElement.dataset.sec);
    const pid = profileIdOf(e);
    if (pid) return openProfile(pid);
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

  const genSelect = $("#gen-filter");

  function refreshGenOptions() {
    const opts = CORE.generationOptions(seriesGroups());
    const want = snap.generation;
    const value = want === "all" || opts.includes(want) ? want : "all";
    if (value !== want) {
      S.setGeneration(value);
      sync();
    }
    genSelect.innerHTML = `<option value="all">${t("gen_all")}</option>`;
    for (const key of opts) {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = CORE.genText(key, lang);
      genSelect.appendChild(opt);
    }
    genSelect.value = value;
  }

  function paintSizeButtons() {
    paintSeg(".seg-size", "pick", pick);
  }

  function paintFilters() {
    sync();
    paintSeg(".seg-filter", "filter", snap.filter);
  }

  function paintTitle() {
    sync();
    const title = $("#title-input");
    if (title && !title.dataset.dirty) title.value = names().title;
  }

  function renderChrome() {
    refreshGroupOptions();
    refreshGenOptions();
    paintSizeButtons();
    paintFilters();
    applyStatic();
    paintTitle();
  }

  function renderAll() {
    renderChrome();
    renderPick();
    if (view !== "pick") paint();
  }

  function switchSeries(next) {
    if (!S.switchSeries(next)) return;
    sync();
    const search = $("#search");
    if (search) search.value = "";
    renderChrome();
    navigate("sync");
  }

  groupSelect.addEventListener("change", () => {
    S.setGroup(groupSelect.value);
    renderPick({ resetScroll: true });
  });

  genSelect.addEventListener("change", () => {
    S.setGeneration(genSelect.value);
    renderPick({ resetScroll: true });
  });

  document.querySelectorAll(".seg-filter button").forEach((b) => {
    b.addEventListener("click", () => {
      S.setFilter(b.dataset.filter);
      paintFilters();
      renderPick();
    });
  });

  document.querySelectorAll(".seg-size button").forEach((b) => {
    b.addEventListener("click", () => {
      const next = +b.dataset.pick;
      if (!S.setSize(next)) return;
      sync();
      renderAll();
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

  $("#start-btn").addEventListener("click", () => navigate("start"));

  $("#clear-btn").addEventListener("click", () => {
    if (!snap.selected.length) return;
    if (!window.confirm(t("clear_confirm"))) return;
    S.clearSelection();
    syncSelection();
  });

  /* ---------------- duel (replayable merge sort) ---------------- */
  function beginDuel(order) {
    if (!S.startDuel(order)) return false;
    duel50 = false;
    order.forEach((id) => {
      new Image().src = fullSrc(BY_ID.get(id));
    });
    show("duel");
    renderDuel();
    maybeIntro();
    return true;
  }

  function renderDuel() {
    sync();
    if (snap.phase === "result") return navigate("advance");
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
    duel50 = CORE.milestone(snap.duel.percent, duel50).shown;
    renderSteps();
  }

  function fillFighter(el, m) {
    el.classList.remove("picked");
    el.innerHTML = `<span class="ph"><img src="${fullSrc(m)}" alt=""></span>
      <span class="nm">${esc(m.name)}</span>
      <span class="kn">${esc(m.kana)}</span>
      <span class="meta">${esc(fullMeta(m))}</span>`;
    el.setAttribute("aria-label", t("pick_who", m.name));
  }

  function canDuelInput() {
    return view === "duel" && snap.phase === "duel" && !introOpen && !profileId;
  }

  let answering = false;
  function answer(leftWins) {
    if (answering || !canDuelInput()) return;
    answering = true;
    const forSeries = series;
    (leftWins ? $("#fighter-a") : $("#fighter-b")).classList.add("picked");
    setTimeout(() => {
      answering = false;
      if (S.snapshot().series !== forSeries) return;
      if (!canDuelInput()) return;
      if (!S.answer(leftWins)) return;
      sync();
      if (snap.duel) {
        const ms = CORE.milestone(snap.duel.percent, duel50);
        duel50 = ms.shown;
        if (ms.celebrate) toast(t("halfway"));
      }
      navigate("advance");
    }, 160);
  }

  function undo() {
    if (!canDuelInput()) return;
    if (!S.undo()) return;
    navigate("advance");
  }

  $("#fighter-a").addEventListener("click", () => answer(true));
  $("#fighter-b").addEventListener("click", () => answer(false));
  $("#undo-btn").addEventListener("click", undo);
  $("#back-pick-btn").addEventListener("click", () => {
    navigate("leave");
    toast(t("duel_saved"));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (introOpen) return closeIntro();
    if (profileId) return closeProfile();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      const group = e.target.closest?.(".seg-skin");
      if (group) {
        const items = [...group.querySelectorAll("button")];
        const idx = items.indexOf(e.target);
        if (idx >= 0) {
          e.preventDefault();
          const next =
            items[
              (idx + (e.key === "ArrowRight" ? 1 : items.length - 1)) %
                items.length
            ];
          next.focus();
          switchSkin(next.dataset.skin);
        }
        return;
      }
    }
    if (
      !canDuelInput() ||
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

  /* ---------------- result ---------------- */
  let ranking = [];

  const rankList = $("#rank-list");

  rankList.addEventListener("keydown", profileKey);

  function renderRankList() {
    $("#rank-list").innerHTML = ranking
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

  rankList.addEventListener("click", profileClick);

  function renderResult() {
    sync();
    if (snap.phase !== "result") return;
    ranking = snap.ranking.map((id) => BY_ID.get(id));
    renderRankList();
    show("result");
    renderSteps();
    renderStyleSeg();
    drawPoster();
  }

  let drawTimer;
  $("#title-input").addEventListener("input", () => {
    clearTimeout(drawTimer);
    drawTimer = setTimeout(drawPoster, 200);
  });
  $("#resort-btn").addEventListener("click", () =>
    navigate("resort", CORE.shuffle(ranking.map((m) => m.id)))
  );
  $("#restart-btn").addEventListener("click", () => navigate("restart"));
  $("#save-btn").addEventListener("click", savePoster);
  $("#share-btn").addEventListener("click", () => {
    const ex = resultExport();
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(ex.caption)}${ex.shareUrl ? "&url=" + encodeURIComponent(ex.shareUrl) : ""}`,
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
        placeholder: v("--placeholder", d.colors.placeholder),
        placeholderInk: v("--placeholder-ink", d.colors.placeholderInk),
      },
      fonts: {
        ui: v("--font-ui", d.fonts.ui),
        jp: v("--font-jp", d.fonts.jp),
        display: v("--font-display", d.fonts.display),
      },
      cardStroke: parseFloat(v("--poster-card-stroke", "3px")) || 0,
    };
  }

  // 结果页导出装配：标题回退、日期规则、分享串与文件名各自只此一处
  function resultExport() {
    const title = $("#title-input").value.trim() || names().title;
    const d = new Date();
    return {
      title,
      dateText: `${names().eyebrow} · ${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`,
      hashtag: names().posterTags,
      fileName: `${names().fileBase}.png`,
      caption: `${title}\n\n${ranking.map((m, i) => `${i + 1}. ${m.name}`).join("\n")}\n\n${names().shareTags}`,
      shareUrl:
        location.protocol.startsWith("http") &&
        !/^(localhost|127\.)/.test(location.hostname)
          ? location.href.split("#")[0]
          : "",
    };
  }

  async function drawPoster() {
    if (!ranking.length) return;
    const canvas = $("#poster-canvas");
    const ctx = canvas.getContext("2d");
    const [imgs] = await Promise.all([
      Promise.all(ranking.map((m) => loadImg(fullSrc(m)))),
      fontsReady(),
    ]);

    const ex = resultExport();
    AKB_POSTER.draw(ctx, {
      members: ranking,
      images: imgs,
      title: ex.title,
      dateText: ex.dateText,
      hashtag: ex.hashtag,
      photoSrc: t(series === "love" ? "photo_src_love" : "photo_src"),
      subOf: posterSub,
      tokens: posterTokens(),
      style: posterStyle,
    });

    try {
      $("#poster-img").src = canvas.toDataURL("image/png");
    } catch (err) {
      $("#poster-img").alt = t("poster_fail");
      console.error(err);
    }
  }

  function savePoster() {
    const canvas = $("#poster-canvas");
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = resultExport().fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, "image/png");
  }

  function setLang(next) {
    if (next !== "en" && next !== "zh" && next !== "ja") return;
    lang = next;
    try {
      localStorage.setItem("akb-lang", lang);
    } catch (_) {}
    renderAll();
    if (profileId) openProfile(profileId);
    if (introOpen) paintIntro();
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-lang]");
    if (b) return setLang(b.dataset.lang);
    const s = e.target.closest(".seg-series [data-series]");
    if (s) switchSeries(s.dataset.series);
    const st = e.target.closest(".seg-style [data-style]");
    if (st) return setPosterStyle(st.dataset.style);
    const k = e.target.closest(".seg-skin [data-skin]");
    if (k) switchSkin(k.dataset.skin);
  });

  function paintSkin() {
    document.documentElement.dataset.skin = snap.skin;
    paintSeg(".seg-skin", "skin", snap.skin);
  }

  function switchSkin(next) {
    if (!S.setSkin(next)) return;
    sync();
    paintSkin();
    if (snap.phase === "result") drawPoster();
  }

  /* ---------------- 向导模式（v5 A） ---------------- */
  const COACH_KEY = "akb:coach:v1";
  const INTRO_KEY = "akb:duelintro:v1";

  const memFlags = new Set();
  function storedFlag(key) {
    try {
      if (localStorage.getItem(key) === "1") return true;
    } catch (_) {}
    return memFlags.has(key);
  }
  function rememberFlag(key) {
    memFlags.add(key);
    try {
      localStorage.setItem(key, "1");
    } catch (_) {}
  }

  let toastTimer;
  function toast(msg) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
  }

  function ringSVG(n, m) {
    const pct = m ? Math.min(1, n / m) : 0;
    const c = 2 * Math.PI * 26;
    return `<svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
      <circle cx="32" cy="32" r="26" fill="none" style="stroke: var(--line)" stroke-width="7"></circle>
      <circle cx="32" cy="32" r="26" fill="none" style="stroke: var(--pink)" stroke-width="7" stroke-linecap="round"
        stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}" transform="rotate(-90 32 32)"></circle>
      <text class="ring-t" x="32" y="37" text-anchor="middle">${n}/${m}</text>
    </svg>`;
  }

  function ensureOpen() {
    sync();
    if (snap.open.length || snap.query || snap.group !== "all") return;
    const first = rosterView().nodes[0];
    if (!first) return;
    S.toggleOpen(first.id);
    const sec = first.sections[0];
    if (sec) S.toggleOpen(sec.id);
  }

  function renderGuide() {
    sync();
    const coach = $("#coach");
    if (coach) {
      coach.hidden = storedFlag(COACH_KEY);
      if (!coach.hidden) {
        $("#coach-title").textContent = t("coach_title", names().brand);
        $("#coach-body").textContent = t("coach_body", snap.size);
      }
    }
    const ring = $("#pick-ring");
    if (ring) {
      ring.innerHTML = ringSVG(snap.selected.length, snap.size);
      const byGroup = new Map();
      snap.selected.forEach((id) => {
        const m = BY_ID.get(id);
        if (m) byGroup.set(m.group, (byGroup.get(m.group) || 0) + 1);
      });
      $("#pick-cov").innerHTML =
        `<b class="cov-sum">${esc(t("picked_of", snap.selected.length, snap.size))}</b>` +
        [...byGroup.entries()]
          .map(
            ([g, n]) => `<span class="cov-chip">${esc(g)} <b>${n}</b></span>`
          )
          .join("");
    }
    const res = $("#resume-card");
    if (res) {
      res.hidden = !snap.duel;
      if (snap.duel)
        $("#resume-body").textContent = t(
          "resume_body",
          snap.duel.step,
          snap.duel.max,
          snap.duel.percent
        );
    }
  }

  function navCtx() {
    sync();
    return {
      view,
      phase: snap.phase,
      selected: snap.selected.length,
      size: snap.size,
      step: snap.duel ? snap.duel.step : null,
    };
  }

  function paint() {
    sync();
    if (view === "duel" && snap.phase === "duel") {
      show("duel");
      renderDuel();
      return;
    }
    if (view === "result" && snap.phase === "result") {
      renderResult();
      return;
    }
    view = "pick";
    show("pick");
    renderPick();
  }

  function navigate(intent, order) {
    const out = CORE.nav(navCtx(), intent);
    if (out.effect === "abandon") S.abandonDuel();
    view = out.view;
    if (out.effect === "start")
      return beginDuel(order || CORE.shuffle(snap.selected.slice()));
    paint();
    return true;
  }

  function renderSteps() {
    sync();
    const bar = $("#steps");
    if (!bar) return;
    for (const s of CORE.steps(navCtx())) {
      const btn = bar.querySelector(`[data-step="${s.key}"]`);
      if (!btn) continue;
      btn.disabled = !s.enabled;
      btn.setAttribute("aria-current", s.active ? "step" : "false");
      if (s.key === "pick") {
        $("#step-pick-n").textContent = s.badge;
      } else if (s.key === "duel") {
        const b = $("#step-duel-n");
        b.hidden = s.badge == null;
        if (s.badge != null) b.textContent = t("step_duel_n", s.badge);
      }
    }
  }

  function paintIntro() {
    sync();
    if (!snap.duel) return;
    $("#di-line2").textContent = t(
      "duel_intro_2",
      snap.duel.max,
      Math.max(1, Math.ceil(snap.duel.etaSeconds / 60))
    );
  }
  function maybeIntro() {
    const el = $("#duel-intro");
    if (!el) return;
    if (storedFlag(INTRO_KEY)) {
      el.hidden = true;
      introOpen = false;
      return;
    }
    paintIntro();
    el.hidden = false;
    introOpen = true;
    const go = el.querySelector('[data-act="intro-go"]');
    if (go) go.focus();
  }
  function closeIntro() {
    rememberFlag(INTRO_KEY);
    $("#duel-intro").hidden = true;
    introOpen = false;
    const f = $("#fighter-a");
    if (f) f.focus();
  }

  document.addEventListener("click", (e) => {
    const step = e.target.closest("#steps [data-step]");
    if (step && !step.disabled) {
      navigate(step.dataset.step);
      return;
    }
    if (e.target.closest('[data-act="coach-ok"]')) {
      rememberFlag(COACH_KEY);
      $("#coach").hidden = true;
      return;
    }
    if (e.target.closest('[data-act="resume-go"]')) return navigate("resume");
    if (e.target.closest('[data-act="resume-drop"]')) return navigate("drop");
    if (
      e.target.closest('[data-act="intro-go"]') ||
      e.target.closest('[data-act="intro-skip"]')
    ) {
      closeIntro();
    }
  });

  /* ---------------- boot ---------------- */
  paintSkin();
  renderChrome();
  navigate("boot");
})();
