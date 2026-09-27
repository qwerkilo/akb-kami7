(() => {
  "use strict";

  const CORE = window.AKB_CORE;
  const FOLD = CORE.foldIndex(window.AKB_SIMPLIFIED || {});

  let series = "48g";
  let pick = 7;
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

  const I18N = window.AKB_I18N;

  let lang = "zh";
  try {
    if (localStorage.getItem("akb-lang") === "en") lang = "en";
  } catch (_) {}
  const t = (key, ...args) => {
    const v = I18N[lang][key];
    return typeof v === "function" ? v(...args) : v;
  };
  function kamiName() {
    if (pick === 32) return t("brand_32");
    if (pick === 16) return t("brand_16");
    return series === "sakamichi" ? t("brand_7fukujin") : t("brand_7");
  }
  function defaultTitle() {
    const prefix = t(
      series === "sakamichi" ? "title_prefix_saka" : "title_prefix_48g"
    );
    return `${prefix} ${kamiName()}`;
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
    const brand = $("#brand");
    if (brand) {
      brand.textContent = kamiName();
      brand.classList.toggle("long", pick !== 7 || lang === "en");
    }
    const eyebrow = $("#eyebrow");
    if (eyebrow)
      eyebrow.textContent = `${t(
        series === "sakamichi" ? "series_saka" : "series_48g"
      )} 好き顔ソート`;
    const size7 = $("#size-7");
    if (size7)
      size7.textContent =
        series === "sakamichi" ? t("brand_7fukujin") : t("brand_7");
    document.querySelectorAll(".seg-series [data-series]").forEach((b) => {
      b.textContent = t(
        b.dataset.series === "sakamichi" ? "series_saka" : "series_48g"
      );
      b.setAttribute("aria-checked", b.dataset.series === series);
    });
    const seriesSeg = document.querySelector(".seg-series");
    if (seriesSeg) seriesSeg.setAttribute("aria-label", t("series_label"));
    const title = $("#title-input");
    if (title && !title.dataset.dirty) title.value = defaultTitle();
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

  const state = {
    selected: [],
    filter: "all",
    group: "all",
    query: "",
    open: new Set(),
  };

  /* ---------------- 系列与持久化 ---------------- */
  const seriesStore = {
    "48g": { size: 7, selected: [], duel: null },
    sakamichi: { size: 7, selected: [], duel: null },
  };
  const storageKey = (s) => `akb:state:v2:${s}`;
  const SERIES_KEY = "akb:series";

  function saveState() {
    try {
      localStorage.setItem(
        storageKey(series),
        CORE.serializeState({
          size: pick,
          selected: state.selected,
          duel:
            duel.order.length > 0
              ? { order: duel.order, answers: duel.answers }
              : null,
        })
      );
    } catch (_) {}
  }

  function loadState(s) {
    try {
      const st = CORE.deserializeState(
        localStorage.getItem(storageKey(s)) || ""
      );
      if (!st) return;
      const kept = st.selected.filter(
        (id) => (BY_ID.get(id) || {}).series === s
      );
      let duel = st.duel;
      if (duel && duel.order.some((id) => (BY_ID.get(id) || {}).series !== s)) {
        duel = null;
      }
      seriesStore[s] = { size: st.size, selected: kept, duel };
    } catch (_) {}
  }

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
    return m.series === series && CORE.isVisible(m, state.filter);
  }

  function cardHTML(m, showGroup) {
    const i = state.selected.indexOf(m.id);
    const meta = showGroup ? `${m.group} · ${metaText(m)}` : metaText(m);
    return `<button class="card" data-id="${m.id}" aria-pressed="${i >= 0}" data-order="${i + 1}" title="${esc(m.name)}${m.kana ? "（" + esc(m.kana) + "）" : ""}">
      <span class="ph"><img src="${thumbSrc(m)}" alt="" loading="lazy" decoding="async" width="240" height="320"></span>
      <span class="nm">${esc(m.name)}</span>
      <span class="meta${m.status === "current" ? " now" : ""}">${esc(meta)}</span>
    </button>`;
  }

  function pickedInNode(node) {
    return node.sections
      .flatMap((s) => s.members)
      .filter((m) => state.selected.includes(m.id)).length;
  }

  let secSeq = 0;
  const SEC_INDEX = new Map();

  function sectionHTML(s, group) {
    const ms = s.members.filter(visible);
    if (!ms.length) return "";
    const secId = `${group}#${s.label}`;
    SEC_INDEX.set(secId, ms);
    const secUid = `gen-${++secSeq}`;
    const open = state.open.has(secId);
    const now = ms.filter((m) => m.status === "current").length;
    const count =
      state.filter === "all" && now
        ? t("people_now", ms.length, now)
        : t("people", ms.length);
    const picked = ms.filter((m) => state.selected.includes(m.id)).length;
    const sub = state.group === "all" ? " sub" : "";
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

  function renderRoster() {
    const q = CORE.normalizeName(state.query);
    if (q) return renderSearch(q);

    const tree = CORE.groupSections(seriesGroups(), state.group);
    const twoLevel = state.group === "all";
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
        state.filter === "all" && now
          ? t("people_now", ms.length, now)
          : t("people", ms.length);
      const picked = pickedInNode(node);
      const key = "g:" + node.group;
      const open = state.open.has(key);
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
      if (state.group !== "all" && g.group !== state.group) continue;
      for (const m of g.members) {
        if (visible(m) && m.hay.includes(q)) hits.push(m);
      }
    }
    roster.innerHTML = hits.length
      ? `<p class="search-hint">${t("found", hits.length)}</p><div class="gen-body">${hits.map((m) => cardHTML(m, true)).join("")}</div>`
      : `<p class="empty">${t("empty_search", esc(state.query))}</p>`;
  }

  function toggleGroup(secId) {
    const sec = [...roster.querySelectorAll(".gen")].find(
      (el) => el.dataset.sec === secId
    );
    if (!sec) return;
    const head = sec.querySelector(".gen-head");
    const body = sec.querySelector(".gen-body");
    const open = !state.open.has(secId);
    if (open) {
      state.open.add(secId);
      body.innerHTML = (SEC_INDEX.get(secId) || []).map(cardHTML).join("");
      body.hidden = false;
    } else {
      state.open.delete(secId);
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
    const open = !state.open.has(key);
    if (open) {
      state.open.add(key);
      const node = CORE.groupSections(seriesGroups(), state.group).find(
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
      state.open.delete(key);
      body.hidden = true;
      body.innerHTML = "";
    }
    head.setAttribute("aria-expanded", open);
  }

  function toggleMember(id) {
    const i = state.selected.indexOf(id);
    if (i >= 0) {
      state.selected.splice(i, 1);
    } else if (state.selected.length >= pick) {
      const tray = $("#tray");
      tray.classList.remove("shake");
      void tray.offsetWidth;
      tray.classList.add("shake");
      return;
    } else {
      state.selected.push(id);
    }
    invalidateDuel();
    syncSelection();
  }

  function syncSelection() {
    roster.querySelectorAll(".card").forEach((el) => {
      const i = state.selected.indexOf(el.dataset.id);
      el.setAttribute("aria-pressed", i >= 0);
      el.dataset.order = i + 1;
    });
    roster.querySelectorAll(".gen").forEach((sec) => {
      const members = SEC_INDEX.get(sec.dataset.sec) || [];
      const n = members.filter((m) => state.selected.includes(m.id)).length;
      sec.querySelector(".gen-picked").textContent = n ? t("picked", n) : "";
    });
    const tree = CORE.groupSections(seriesGroups(), state.group);
    roster.querySelectorAll(".grp").forEach((sec) => {
      const node = tree.find((n) => n.group === sec.dataset.group);
      const picked = node ? pickedInNode(node) : 0;
      sec.querySelector(".grp-picked").textContent = picked
        ? t("picked", picked)
        : "";
    });
    roster.classList.toggle("full", state.selected.length >= pick);
    renderTray();
    saveState();
  }

  function renderTray() {
    const slots = [];
    for (let i = 0; i < pick; i++) {
      const m = BY_ID.get(state.selected[i]);
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
    const left = pick - state.selected.length;
    const btn = $("#start-btn");
    btn.disabled = left > 0;
    btn.textContent = left > 0 ? t("need", left) : t("start");
  }

  roster.addEventListener("click", (e) => {
    const grp = e.target.closest(".grp-head");
    if (grp) return toggleGroupNode(grp.parentElement.dataset.group);
    const head = e.target.closest(".gen-head");
    if (head) return toggleGroup(head.parentElement.dataset.sec);
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
    if (next === series) return;
    seriesStore[series] = {
      size: pick,
      selected: state.selected.slice(),
      duel:
        duel.order.length > 0
          ? { order: duel.order.slice(), answers: duel.answers.slice() }
          : null,
    };
    duel.order = [];
    duel.answers = [];
    duel.pair = null;
    series = next;
    try {
      localStorage.setItem(SERIES_KEY, series);
    } catch (_) {}
    const st = seriesStore[series];
    pick = st.size;
    state.selected = st.selected.slice();
    state.filter = "all";
    state.group = "all";
    state.query = "";
    state.open.clear();
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
    if (title && !title.dataset.dirty) title.value = defaultTitle();
    if (st.duel && st.duel.order.length) {
      resumeDuel(st);
    } else {
      show("pick");
      renderRoster();
      syncSelection();
    }
  }

  groupSelect.addEventListener("change", () => {
    state.group = groupSelect.value;
    renderRoster();
    syncSelection();
    roster.scrollTop = 0;
  });

  document.querySelectorAll(".seg-filter button").forEach((b) => {
    b.addEventListener("click", () => {
      document
        .querySelectorAll(".seg-filter button")
        .forEach((x) => x.setAttribute("aria-checked", x === b));
      state.filter = b.dataset.filter;
      renderRoster();
      syncSelection();
    });
  });

  document.querySelectorAll(".seg-size button").forEach((b) => {
    b.addEventListener("click", () => {
      const next = +b.dataset.pick;
      if (next === pick) return;
      pick = next;
      if (state.selected.length > pick) state.selected.length = pick;
      invalidateDuel();
      paintSizeButtons();
      applyStatic();
      const title = $("#title-input");
      if (!title.dataset.dirty) title.value = defaultTitle();
      saveState();
      renderRoster();
      syncSelection();
    });
  });

  $("#title-input").addEventListener("change", () => {
    $("#title-input").dataset.dirty = "1";
  });

  let searchTimer;
  $("#search").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.query = e.target.value;
      renderRoster();
      syncSelection();
      roster.scrollTop = 0;
    }, 120);
  });

  $("#start-btn").addEventListener("click", () =>
    startDuel(CORE.shuffle(state.selected.slice()))
  );

  /* ---------------- duel (replayable merge sort) ---------------- */
  const duel = { order: [], answers: [], pair: null };

  function startDuel(order) {
    duel.order = order;
    duel.answers = [];
    order.forEach((id) => {
      new Image().src = fullSrc(BY_ID.get(id));
    });
    $("#duel-max").textContent = CORE.worstCase(order.length);
    saveState();
    show("duel");
    advance();
  }

  function resumeDuel(st) {
    if (st.duel.order.some((id) => !BY_ID.get(id))) {
      duel.order = [];
      duel.answers = [];
      saveState();
      show("pick");
      renderRoster();
      syncSelection();
      return;
    }
    duel.order = st.duel.order.slice();
    duel.answers = st.duel.answers.slice();
    const r = CORE.replay(duel.order, duel.answers);
    if (r.done) return finish(r.order);
    $("#duel-max").textContent = CORE.worstCase(duel.order.length);
    show("duel");
    advance();
  }

  function invalidateDuel() {
    if (duel.order.length) {
      duel.order = [];
      duel.answers = [];
    }
  }

  function advance() {
    const r = CORE.replay(duel.order, duel.answers);
    if (r.done) return finish(r.order);
    duel.pair = r.pair;
    const p = CORE.duelProgress(duel.order.length, duel.answers.length);
    $("#duel-step").textContent = duel.answers.length + 1;
    $("#duel-bar").style.width = `${p.percent}%`;
    const extra = $("#duel-extra");
    if (extra)
      extra.textContent = t(
        "duel_extra",
        p.percent,
        p.remaining,
        Math.max(1, Math.ceil(p.etaSeconds / 60))
      );
    $("#undo-btn").disabled = duel.answers.length === 0;
    fillFighter($("#fighter-a"), BY_ID.get(r.pair[0]));
    fillFighter($("#fighter-b"), BY_ID.get(r.pair[1]));
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
      if (forSeries !== series) return;
      duel.answers.push(leftWins);
      saveState();
      advance();
    }, 160);
  }

  function undo() {
    if (!duel.answers.length || $("#phase-duel").hidden) return;
    duel.answers.pop();
    saveState();
    advance();
  }

  $("#fighter-a").addEventListener("click", () => answer(true));
  $("#fighter-b").addEventListener("click", () => answer(false));
  $("#undo-btn").addEventListener("click", undo);
  $("#back-pick-btn").addEventListener("click", backToPick);

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
    invalidateDuel();
    saveState();
    show("pick");
    renderRoster();
    syncSelection();
  }

  /* ---------------- result ---------------- */
  let ranking = [];

  function finish(ids) {
    ranking = ids.map((id) => BY_ID.get(id));
    saveState();
    $("#rank-list").innerHTML = ranking
      .map(
        (m, i) => `<li>
      <span class="no">${i + 1}</span>
      <img src="${thumbSrc(m)}" alt="">
      <span class="nm">${esc(m.name)}<span class="meta">${esc(fullMeta(m))}</span></span>
    </li>`
      )
      .join("");
    show("result");
    drawPoster();
  }

  let drawTimer;
  $("#title-input").addEventListener("input", () => {
    clearTimeout(drawTimer);
    drawTimer = setTimeout(drawPoster, 200);
  });
  $("#resort-btn").addEventListener("click", () =>
    startDuel(CORE.shuffle(ranking.map((m) => m.id)))
  );
  $("#restart-btn").addEventListener("click", backToPick);
  $("#save-btn").addEventListener("click", savePoster);
  $("#share-btn").addEventListener("click", () => {
    const hashtags =
      series === "sakamichi"
        ? "#Sakamichi #好き顔ソート"
        : "#48Group #好き顔ソート";
    const text =
      `${$("#title-input").value.trim() || defaultTitle()}\n\n` +
      ranking.map((m, i) => `${i + 1}. ${m.name}`).join("\n") +
      `\n\n${hashtags}`;
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

    const title = $("#title-input").value.trim() || defaultTitle();
    const d = new Date();
    const brand = t(series === "sakamichi" ? "series_saka" : "series_48g");
    AKB_POSTER.draw(ctx, {
      members: ranking,
      images: imgs,
      title,
      dateText: `${brand} 好き顔ソート · ${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`,
      hashtag:
        series === "sakamichi"
          ? "#Sakamichi  #好き顔ソート"
          : "#48Group  #好き顔ソート",
      photoSrc: t("photo_src"),
      subOf: posterSub,
    });

    try {
      $("#poster-img").src = canvas.toDataURL("image/png");
    } catch (err) {
      $("#poster-img").alt = t("poster_fail");
      console.error(err);
    }
  }

  function posterFileName() {
    const prefix = series === "sakamichi" ? "sakamichi" : "48group";
    if (pick === 7)
      return `${prefix}_${series === "sakamichi" ? "7fukujin" : "kami7"}.png`;
    return `${prefix}_${pick}.png`;
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
    renderRoster();
    syncSelection();
    if (!$("#phase-duel").hidden && duel.pair) {
      fillFighter($("#fighter-a"), BY_ID.get(duel.pair[0]));
      fillFighter($("#fighter-b"), BY_ID.get(duel.pair[1]));
    }
    if (!$("#phase-result").hidden && ranking.length) {
      $("#rank-list").innerHTML = ranking
        .map(
          (m, i) => `<li>
        <span class="no">${i + 1}</span>
        <img src="${thumbSrc(m)}" alt="">
        <span class="nm">${esc(m.name)}<span class="meta">${esc(fullMeta(m))}</span></span>
      </li>`
        )
        .join("");
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
  try {
    const saved = localStorage.getItem(SERIES_KEY);
    if (saved === "48g" || saved === "sakamichi") series = saved;
  } catch (_) {}
  loadState("48g");
  loadState("sakamichi");
  pick = seriesStore[series].size;
  state.selected = seriesStore[series].selected.slice();
  refreshGroupOptions();
  paintSizeButtons();
  applyStatic();
  if (seriesStore[series].duel) {
    resumeDuel(seriesStore[series]);
  } else {
    renderRoster();
    syncSelection();
  }
})();
