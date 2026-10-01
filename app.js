(() => {
  "use strict";

  const CORE = window.AKB_CORE;
  const FOLD = CORE.foldIndex(window.AKB_SIMPLIFIED || {});

  const GROUPS = window.AKB_GROUPS || [];
  const BY_ID = new Map(CORE.flattenMembers(GROUPS).map((m) => [m.id, m]));

  // 首次访问的默认语言按浏览器判定（这是「选什么」的决定，不是持久化）；
  // 一旦用户自己选过，session 里的落盘值优先。
  const preferLang = () => {
    const nav = (navigator.language || "").toLowerCase();
    return nav.startsWith("ja") ? "ja" : nav.startsWith("zh") ? "zh" : "en";
  };

  const S = window.AKB_SESSION.create({
    storage: {
      getItem: (k) => localStorage.getItem(k),
      setItem: (k, v) => localStorage.setItem(k, v),
    },
    byId: (id) => BY_ID.get(id),
    posterStyles: window.AKB_POSTER.styles,
    lang: preferLang(),
  });
  let snap = S.snapshot();
  let series = snap.series;
  let pick = snap.size;
  let view = "pick";
  let duel50 = false;
  let introOpen = false;
  let sheetOpen = false; // iOS 安装指引浮层打开
  let sheetOpener = null; // 浮层打开前的焦点，关闭时还回去
  const warmed = new Set();
  function warmPhotos() {
    // 对决卡与海报读 img/full，名册只用到 img/thumb：选中的成员顺手把 full 预热，
    // 这样离线时那张海报才真的有脸（请求走 SW 的 image cache-first，命中即缓存）。
    if (!navigator.onLine) return;
    for (const id of snap.selected) {
      if (warmed.has(id)) continue;
      warmed.add(id);
      const m = BY_ID.get(id);
      if (!m || !m.img) continue;
      const img = new Image();
      img.decoding = "async";
      img.src = CORE.photoSrc(m, "full");
    }
  }

  function sync() {
    snap = S.snapshot();
    series = snap.series;
    pick = snap.size;
    warmPhotos(); // 恢复存档回来时也要把已选成员的 full 预热
  }

  const I18N = window.AKB_I18N;

  let lang = snap.lang;
  const t = (key, ...args) => {
    const v = I18N[lang][key];
    return typeof v === "function" ? v(...args) : v;
  };
  function names() {
    return CORE.names(series, pick, t);
  }

  let posterStyle = snap.posterStyle;

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
    if (!S.setPosterStyle(next)) return;
    sync(); // setter 改的是 session 的 state，snap 是副本
    posterStyle = snap.posterStyle;
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
    // 按钮里放长短两个标签，窄屏由 CSS 选短的那个。这里必须渲染成两个 <span> ——
    // 直接写 textContent 会把结构抹掉，窄屏就只剩一个截断的长标签了。
    document.querySelectorAll(".seg-series [data-series]").forEach((b) => {
      const n = CORE.names(b.dataset.series, pick, t);
      b.innerHTML = `<span class="seg-label-full">${esc(n.seriesLabel)}</span><span class="seg-label-short">${esc(n.seriesShort)}</span>`;
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
  let entering = null;
  // 「即将进入挑人步」：renderRoster 渲染完才消费它，见 show() 里的注释
  let rosterEntering = false;

  function show(phase) {
    for (const id of ["pick", "screen", "duel", "result"]) {
      $(`#phase-${id}`).hidden = id !== phase;
    }
    // 切屏转场（工单 03）：给刚显示的相位加一次 .enter，动画播完摘掉 ——
    // 留着会在每次渲染时重播，而同一个相位可能被渲染很多次。
    // reduced-motion 下 CSS 把它归零，但仍然要摘类，否则动画事件不来。
    if (entering) {
      entering.classList.remove("enter");
      entering = null;
    }
    if (phase !== "result") {
      unveiled = false;
      unveilFrom = null;
    }
    const shown = $(`#phase-${phase}`);
    if (shown) {
      shown.classList.add("enter");
      entering = shown;
      const clear = (ev) => {
        // 必须判事件来源：animationend 会从子元素冒泡，而名册卡自己有
        // cardIn 入场动画 —— 不判的话切屏转场会被**第一张卡的动画结束**摘掉，
        // 相位动画还在跑就提前归位（本机因为 258 张卡的 stagger 拖慢主线程
        // 才没看出来，快的机器上会切）。
        if (ev && ev.target !== shown) return;
        shown.classList.remove("enter");
        if (entering === shown) entering = null;
      };
      shown.addEventListener("animationend", clear, { once: true });
      // 降级模式下没有 animationend（动画被关掉），兜底摘掉
      setTimeout(clear, 400);
    }
    // 名册的进场 stagger 只在**进入挑人步**时播一次。此前挂在 .card 上，于是
    // 每次重渲名册（搜索去抖、切状态/团体/期生、切档位、切系列）整表都淡入
    // 一遍 —— 名册有 258 张卡，效率区不该每次按键都有 ~165ms 的装饰
    // （ADR-0020：效率区「一屏做完一步、不加装饰」）。
    //
    // 这里只置标志，**由渲染本身决定要不要加类**：我第一版在 show() 里加类并
    // 用 400ms 兜底摘类，冷缓存下名册渲染晚于 400ms → 卡片在窗口之后创建 →
    // 根本没有动画（实测两次进入一次没播）。
    rosterEntering = phase === "pick";
    $("#roster")?.classList.remove("enter");
    // 对决时把页头与步骤条整体收起：这一步要的是两张脸，不是导航
    // （工单 03 / ADR-0019；页头里的语言/皮肤切换在返回挑人页后仍可用）
    const chrome = phase === "duel";
    const head = $("#site-head");
    if (head) head.hidden = chrome;
    const steps = $("#steps");
    if (steps) steps.hidden = chrome;
    // 页脚（版权 + 安装行）同理：对决中它既占 270px 又与这一步无关
    const foot = $("#site-foot");
    if (foot) foot.hidden = chrome;
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

  function cardHTML(m, showGroup, i) {
    const sel = snap.selected.indexOf(m.id);
    const meta = showGroup ? `${m.group} · ${metaText(m)}` : metaText(m);
    // --i 是进场 stagger 的下标（工单 03）。不传时为 0：搜索结果不需要错开入场。
    // **封顶在 CSS 里**（min(var(--i), 8)），JS 只传原始下标 —— 此前 8 这个数
    // 在 app.js 与测试里各存一份，改了一处另一处不响。
    const idx = typeof i === "number" ? i : 0;
    return `<button class="card" style="--i:${idx}" data-id="${m.id}" aria-pressed="${sel >= 0}" data-order="${sel + 1}" title="${esc(m.name)}${m.kana ? "（" + esc(m.kana) + "）" : ""}">
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
      <div class="gen-body" id="${secUid}" ${open ? "" : "hidden"}>${open ? sec.members.map((m, k) => cardHTML(m, false, k)).join("") : ""}</div>
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
    rosterEntered();
  }

  // 进场 stagger 的开关：卡片**已经存在**之后才加 .roster.enter，
  // 所以卡片一插入就是动画的起点（CSS 里 .roster.enter .card 才有 animation）。
  // 400ms 后摘掉（比最坏错开 144ms + 单卡 120ms 宽裕），摘掉后重渲不再有动画。
  function rosterEntered() {
    const el = $("#roster");
    const wanted = rosterEntering;
    rosterEntering = false;
    if (!el) return;
    el.classList.remove("enter");
    if (!wanted) return;
    el.classList.add("enter");
    // 窗口取 600ms 而非理论最坏 264ms（单卡 120 + 8 档错开 144）：本机冷加载时
    // 主线程被字体与脚本占住，动画还在延迟相位就被摘类 → 整批 cancelled
    // （实测三次进入有一次整个不播）。余量比贴着理论值重要。
    setTimeout(() => el.classList.remove("enter"), 600);
  }

  BY_ID.forEach((m) => {
    m.hay = CORE.haystack(m, FOLD);
  });

  function renderSearch(view) {
    const hits = view.hits;
    roster.innerHTML = hits.length
      ? `<p class="search-hint">${t("found", hits.length)}</p><div class="gen-body">${hits.map((m) => cardHTML(m, true)).join("")}</div>`
      : `<p class="empty">${t("empty_search", esc(snap.query))}</p><p class="hint">${t("empty_search_hint")}</p>`;
    rosterEntered();
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
      // 显式包一层：把 cardHTML 直接交给 .map 会把 (element, index, array) 三个
      // 参数全传进去，第三参 i 收到的是**数组** → Math.min(array, 8) = NaN →
      // `--i: NaN` 是已定义的自定义属性，var(--i, 0) 的兜底不生效 →
      // calc(NaN * 18ms) 整条失效，animation-delay 静默回退 initial，且无报错。
      body.innerHTML = (viewSection(secId)?.members || [])
        .map((m) => cardHTML(m))
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
          : t("screen_go");
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
    paintFilterSum();
  }

  // 筛选按钮上的摘要：折叠面板收起时，「筛选生效了」在按钮上要看得见。
  // 数字取当前筛选下的名册人数（core.rosterView 的投影，不是 DOM 数出来的）。
  function paintFilterSum() {
    const el = $("#filter-sum");
    if (!el) return;
    const view = rosterView();
    const n =
      view.mode === "search"
        ? view.hits.length
        : view.nodes.reduce(
            (sum, node) =>
              sum + node.sections.reduce((a, s) => a + s.members.length, 0),
            0
          );
    el.textContent = t("filter_sum", n);
    // 窄屏用 CSS 隐藏了摘要（.filter-sum { display: none }，因为它会挤掉档位段
    // 的宽度），所以把同一句话挂到触发按钮的可及名上 —— 信息不丢，只是不占视觉宽度。
    const btn = $(".filter-trigger");
    if (btn)
      btn.setAttribute(
        "aria-label",
        `${t("filter_label")} · ${t("filter_sum", n)}`
      );
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

  $("#start-btn").addEventListener("click", () => {
    // 有进行中的对决就走 resume（只切视图，保留题号）—— 这里必须预判：
    // navigate() 对 effect "start" 与 "resume" 都调 beginDuel()，而 beginDuel 里的
    // S.startDuel() 会重开对决、把答案清零。nav 的 start 规则在 phase==="duel" 时
    // 返回 effect "resume" 但仍会走到 beginDuel，所以这一层预判不是冗余的。
    sync();
    if (snap.duel) return navigate("resume");
    navigate("screen");
  });

  $("#screen-submit").addEventListener("click", () => {
    sync();
    // 门槛是「本轮划够一半」（定值，不是「至少留 N 人」）
    if (!snap.screening || !snap.screening.complete) return;
    navigate("rank"); // startDuel 自己按层级喂（保留组 + 各轮划掉组）
  });
  // 「继续细分」：进入下一轮（session 里记 deeper —— 轮次自动推进，
  // 没有这个显式标记就分不清「刚划完、可以提交」和「已经在下一轮里」）
  $("#screen-more").addEventListener("click", () => {
    S.enterNextRound();
    renderScreen();
  });

  $("#clear-btn").addEventListener("click", () => {
    if (!snap.selected.length) return;
    if (!window.confirm(t("clear_confirm"))) return;
    S.clearSelection();
    syncSelection();
  });

  /* ---------------- duel (replayable merge sort) ---------------- */
  function beginDuel(opts) {
    if (!S.startDuel(opts)) return false;
    duel50 = false;
    snap.selected.forEach((id) => {
      new Image().src = fullSrc(BY_ID.get(id));
    });
    show("duel");
    renderDuel();
    maybeIntro();
    return true;
  }

  let lastTierIdx = null;
  function renderDuel() {
    sync();
    if (snap.phase === "result") return navigate("advance");
    if (snap.phase !== "duel") return;
    $("#duel-max").textContent = snap.duel.max;
    $("#duel-step").textContent = snap.duel.step;
    $("#duel-bar").style.width = `${snap.duel.percent}%`;
    const extra = $("#duel-extra");
    if (extra)
      // 多轮筛选时对决跨层级（保留组 + 各轮划掉组），单一百分比看不出层级跳跃 →
      // tier/tiers 就是为此而算的（ADR-0019）
      extra.textContent = t(
        "duel_extra",
        snap.duel.percent,
        snap.duel.remaining,
        Math.max(1, Math.ceil(snap.duel.etaSeconds / 60)),
        snap.duel.tier + 1,
        snap.duel.tiers
      );
    // 层级段：一共 tiers 组、现在第 tier+1 组、已答 tierAnswered / 组内上限 tierMax
    const tiers = $("#duel-tiers");
    if (tiers) {
      // 翻转只在**换组**时来一次：整排每次渲染都重建，不判一下就会每答一题
      // 都播一次 200ms 的装饰（效率区的每次点击不该有这种东西）。
      const nowIdx = Math.min(
        snap.duel.tier || 0,
        Math.max(1, snap.duel.tiers || 1) - 1
      );
      tiers.classList.toggle(
        "flip",
        lastTierIdx !== null && lastTierIdx !== nowIdx
      );
      lastTierIdx = nowIdx;
      const n = Math.max(1, snap.duel.tiers || 1);
      const now = Math.min(snap.duel.tier || 0, n - 1);
      let html = "";
      for (let i = 0; i < n; i++)
        html += `<i class="${i < now ? "done" : i === now ? "now" : ""}"></i>`;
      // 组内进度：当前段的 --fill（渐变填充，不改尺寸）
      if (html && snap.duel.tierMax) {
        const pct = Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((snap.duel.tierAnswered || 0) / snap.duel.tierMax) * 100
            )
          )
        );
        html = html.replace(
          'class="now"',
          `class="now" style="--fill:${pct}%"`
        );
      }
      tiers.innerHTML = html;
    }
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
    return (
      view === "duel" &&
      snap.phase === "duel" &&
      !introOpen &&
      !profileId &&
      !sheetOpen
    );
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
    if (moreOpen()) return setMore(false);
    if (sheetOpen) return closeSheet();
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

  /* ---------------- 揭幕（签名时刻，工单 04 / ADR-0020 §3）----------------
     最后比较的两张脸合并成一张海报：用两个 fixed 定位的克隆从对决页的位置
     飞到海报画面的位置并淡出，同时海报自己淡入。
     用 transform 而不是 left/top/width —— 后者会逐帧触发布局，两张脸也够不上
     合成层；transform 从起点尺寸缩到终点尺寸是同一条 GPU 路径。
     降级（prefers-reduced-motion: reduce）时整段跳过，海报直接显影。 */
  let unveilFrom = null;
  let unveiled = false;
  const reducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function captureUnveil() {
    if (reducedMotion()) return;
    const imgs = [$("#fighter-a"), $("#fighter-b")]
      .map((el) => el && el.querySelector("img"))
      .filter(Boolean);
    if (imgs.length !== 2) return;
    unveilFrom = imgs
      .map((im) => {
        const r = im.getBoundingClientRect();
        if (!r.width) return null;
        return {
          src: im.currentSrc || im.src,
          x: r.x,
          y: r.y,
          w: r.width,
          h: r.height,
        };
      })
      .filter(Boolean);
    if (unveilFrom.length !== 2) unveilFrom = null;
  }

  function unveil() {
    if (!unveilFrom || unveiled || reducedMotion()) {
      unveilFrom = null;
      return;
    }
    unveiled = true;
    const from = unveilFrom;
    unveilFrom = null;
    const host = $("#poster");
    if (!host) return;
    const to = host.getBoundingClientRect();
    if (!to.width) return;
    const layer = document.createElement("div");
    layer.className = "unveil";
    layer.setAttribute("aria-hidden", "true");
    for (const f of from) {
      const img = document.createElement("img");
      img.src = f.src;
      img.alt = "";
      img.style.cssText = `left:${to.x}px;top:${to.y}px;width:${to.width}px;height:${to.height}px;
        transform:translate(${f.x - to.x}px, ${f.y - to.y}px) scale(${f.w / to.width}, ${f.h / to.height});`;
      layer.appendChild(img);
    }
    document.body.appendChild(layer);
    // 强制一次样式重算再进 rAF 改 transform：浏览器**不保证**在 appendChild 与
    // rAF 回调之间做过重算，不这么做 transition 可能压根不产生（两轴都实测到
    // 隔离复现里 0 条动画；真实应用里因为图片解码恰好触发了重算才侥幸在跑）。
    void layer.offsetHeight;
    const done = () => layer.remove();
    layer.addEventListener("transitionend", done, { once: true });
    setTimeout(done, 700);
    requestAnimationFrame(() => {
      for (const img of layer.children) {
        img.style.transform = "none";
        img.style.opacity = "0";
      }
    });
  }

  function renderResult() {
    sync();
    if (snap.phase !== "result") return;
    ranking = snap.ranking.map((id) => BY_ID.get(id));
    renderRankList();
    captureUnveil(); // 必须在 show 之前 —— 之后对决页已隐藏，取不到位置
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
  // 「这几位重新排序」：shuffle 传进 startDuel，由它对**每一层内部**洗牌
  // （层级归属是语义，层内顺序是自由量 —— 洗它不违反「跨层级不比较」）
  $("#resort-btn").addEventListener("click", () =>
    navigate("resort", { shuffle: CORE.shuffle })
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
    // 字体加载失败要吞掉：document.fonts.load() 在取不到字体时会 reject，
    // 一路冒泡会让 drawPoster 整条断掉——断网时正是这种情况（字体子集没缓存到），
    // 结果是海报画布一直空白、用户只看到一张空图。
    const wait = Promise.all([
      document.fonts.load(`64px "Dela Gothic One"`),
      document.fonts.load(`700 40px "Zen Kaku Gothic New"`, "渡辺麻友"),
    ]).catch(() => {});
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
      unveil(); // 海报有像素了才揭幕，否则飞过去是一片空白
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
    if (!S.setLang(next)) return;
    sync();
    lang = snap.lang;
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
  // 「已看过」标记：键名在 core.PREF_KEYS。**内存回落是有意的取舍**——存储不可用
  // （隐私模式 / 配额满）时，标记只在本会话有效：引导卡不该在同一次会话里反复弹，
  // 而皮肤/语言/海报样式在那种情况下回落到默认值（用户看不出异常）。
  const COACH_KEY = CORE.PREF_KEYS.coach;
  const INTRO_KEY = CORE.PREF_KEYS.duelIntro;

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
      // 筛选门槛（ADR-0019 改写版）：本轮划够一半
      canScreen: snap.screening ? snap.screening.complete : false,
    };
  }

  /* ---------------- screening (清单筛选；ADR-0019) ---------------- */
  function renderScreen() {
    sync();
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
      const m = BY_ID.get(id);
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
          title="${off ? esc(t("screen_locked")) : ""}"
          aria-label="${esc(t("pick_who", m.name))}">${cut ? esc(t("screen_keep")) : esc(t("screen_cut"))}</button>
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
        t("start_est", CORE.tierQuestionMax(snap.selected.length, sc.round))
      : t("screen_min", sc.canCut);
    const more = $("#screen-more");
    // 只有「本轮已划够、且还能再划」时才给递归入口（主动决定要不要继续细分）
    more.hidden = !sc.canRecurse;
    $("#screen-reset").disabled = !sc.cut.length;
    renderSteps();
  }

  function paint() {
    sync();
    if (view === "screening") {
      show("screen");
      renderScreen();
      return;
    }
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

  // opts 透给 startDuel（目前只有 { shuffle }，出图页「这几位重新排序」用）
  function navigate(intent, opts) {
    const out = CORE.nav(navCtx(), intent);
    if (out.effect === "abandon") S.abandonDuel();
    view = out.view;
    // 对决的对手来自「已选 + 筛选层级」（ADR-0019 改写版），不再由调用方传 order
    if (out.effect === "start" || out.effect === "resume")
      return beginDuel(opts);
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
    const mark = e.target.closest("[data-cut]");
    if (mark) {
      S.toggleCut(mark.dataset.cut);
      renderScreen();
      return;
    }
    if (e.target.closest("#screen-reset")) {
      if (S.resetScreening()) renderScreen();
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

  /* ---------------- PWA（可安装 / 离线 / 更新，见 docs/adr/0016-pwa.md） ---------------- */
  let installEvent = null; // beforeinstallprompt 捕获到的安装事件
  let swReg = null;

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
    el.querySelector("button")?.focus();
  }
  function closeSheet() {
    const el = $("#pwa-sheet");
    if (!el) return;
    sheetOpen = false;
    el.hidden = true;
    const scrim = $("#pwa-scrim");
    if (scrim) scrim.hidden = true;
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
    swReg = reg;
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
  async function warmFonts() {
    if (!navigator.onLine) return;
    const links = [
      ...document.querySelectorAll(
        'link[rel="stylesheet"][href*="fonts.googleapis.com"]'
      ),
    ];
    for (const link of links) {
      try {
        const css = await (
          await fetch(link.href, { credentials: "omit" })
        ).text();
        const urls = Array.from(
          new Set(
            Array.from(css.matchAll(/url\((https:\/\/[^)]+\.woff2)\)/g)).map(
              (m) => m[1]
            )
          )
        );
        // 分批并发：逐个 await 要十几秒，期间用户断网就只预热了一半（实测会）。
        // 页面被切走/隐藏就停：否则导航会中断这批请求并刷一串资源错误。
        for (let i = 0; i < urls.length; i += 16) {
          if (document.hidden) return;
          await Promise.allSettled(
            urls.slice(i, i + 16).map((u) => fetch(u, { credentials: "omit" }))
          );
        }
      } catch (_) {}
    }
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

  /* ---------------- 更多浮层（语言 / 外观） ---------------- */
  const moreBtn = $("#more-btn");
  const moreMenu = $("#more-menu");

  function setMore(open) {
    if (!moreMenu || !moreBtn) return;
    moreMenu.hidden = !open;
    moreBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  function moreOpen() {
    return !!moreMenu && !moreMenu.hidden;
  }

  if (moreBtn) {
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setMore(!moreOpen());
    });
    // 点浮层外面关掉；点语言/皮肤后也关（选完就收起，不挡着名册）
    moreMenu.addEventListener("click", (e) => {
      if (e.target.closest(".seg-lang button, .seg-skin button"))
        setMore(false);
    });
  }
  document.addEventListener("click", (e) => {
    if (
      moreOpen() &&
      !e.target.closest("#more-menu") &&
      !e.target.closest("#more-btn")
    )
      setMore(false);
  });
  // 选完语言/皮肤后要重画按钮状态（paintSeg 在 changeLang / 皮肤处理里跑）
  window.addEventListener("resize", () => {
    if (moreOpen() && window.innerWidth > 560) setMore(false);
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest('[data-act="pwa-install"]')) return void doInstall();
    if (e.target.closest('[data-act="pwa-ios"]')) return void openSheet();
    if (
      e.target.closest('[data-act="pwa-ios-close"]') ||
      e.target.id === "pwa-scrim"
    )
      return void closeSheet();
    if (e.target.closest('[data-act="pwa-reload"]')) return void applyUpdate();
  });

  /* ---------------- boot ---------------- */
  paintSkin();
  renderChrome();
  navigate("boot");
  initPWA();
})();
