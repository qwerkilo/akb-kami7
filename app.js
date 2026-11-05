(() => {
  "use strict";

  const CORE = window.AKB_CORE;
  const FOLD = CORE.foldIndex(window.AKB_SIMPLIFIED || {});

  const GROUPS = window.AKB_GROUPS || [];
  const BY_ID = new Map(CORE.flattenMembers(GROUPS).map((m) => [m.id, m]));

  // 只读分享页的真实上下文：series/pick 会被 sync() 反复拉回接收者的存档，
  // 所以结果相关的命名一律从分享模块取，而不是读那两个变量。
  const activeSeries = () => share.series() || series;
  const activeSize = () => share.size() || pick;

  // 简介数据拆在 bios.js（首屏少解析 ~106KB）。空闲或打开资料卡时加载；
  // 离线由 SW 壳缓存兜底（bios.js 在 sw-cache-rules.js 的 SHELL_FILES 里）。
  let BIOS = null;
  let biosLoading = null;

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
  let introOpen = false;
  let ranking = [];
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
    return CORE.names(activeSeries(), activeSize(), t);
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
      brand.classList.toggle("long", activeSize() !== 7 || lang === "en");
    }
    const eyebrow = $("#eyebrow");
    if (eyebrow) eyebrow.textContent = N.eyebrow;
    const size7 = $("#size-7");
    if (size7) size7.textContent = CORE.names(activeSeries(), 7, t).brand;
    // 按钮里放长短两个标签，窄屏由 CSS 选短的那个。这里必须渲染成两个 <span> ——
    // 直接写 textContent 会把结构抹掉，窄屏就只剩一个截断的长标签了。
    document.querySelectorAll(".seg-series [data-series]").forEach((b) => {
      const n = CORE.names(b.dataset.series, pick, t);
      b.innerHTML = `<span class="seg-label-full">${esc(n.seriesLabel)}</span><span class="seg-label-short">${esc(n.seriesShort)}</span>`;
    });
    paintSeg(".seg-series", "series", activeSeries());
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

  function shareLink() {
    return share.link();
  }

  const share = window.AKB_APP_SHARE.create({
    $,
    CORE,
    t,
    byId: (id) => BY_ID.get(id),
    getSeries: () => series,
    getRanking: () => ranking,
    setRanking: (v) => {
      ranking = v;
    },
    renderChrome,
    renderResultBody,
    onExit: () => {
      view = "pick";
    },
  });

  const metaText = (m) => CORE.metaText(m, t, lang);
  const fullMeta = (m) => CORE.fullMeta(m, t, lang);
  const posterSub = (m) => CORE.posterSub(m, t, lang);

  const seriesGroups = () => GROUPS.filter((g) => g.series === series);

  /* ---------------- phase switching ---------------- */
  // ---- 「动一次，然后保证它一定停下来」的唯一出处 ----
  // 兜底时长从 CSS 实际读：元素（或取样后代）的 animation/transition 时长 + 最大延迟
  // 再加统一余量。取样选择器是必需的 —— 名册的动画挂在 .card 上，挂在 .roster 自身
  // 读出来是 0。读实际值而不是写死毫秒，令牌一改这里自动跟着走。
  // 余量按「stagger 的错开总量 + 200ms」取：名册的窗口是 单卡时长 + 错开 + 余量，
  // 所以余量必须盖住错开再加 200ms（本仓此前用写死的 600ms 达到同一效果）。
  // 250 不够 —— 那是 120 + 250 = 370ms，而理论最坏 + 200ms 是 464ms。
  const MOTION_MARGIN_MS = 350;

  function motionMs(el, kind, sample) {
    const t = sample ? el.querySelector(sample) : el;
    if (!t) return 0;
    const cs = getComputedStyle(t);
    const prop = kind === "transition" ? "transition" : "animation";
    const max = (v) =>
      Math.max(
        0,
        ...String(v || "0s")
          .split(",")
          // getComputedStyle 返回的是**秒**（"0.2s" / "200ms"），必须换算成毫秒 ——
          // 我第一版直接 parseFloat，兜底从 450ms 变成 250ms，动画被提前摘掉。
          .map((x) => {
            const n = parseFloat(x);
            if (!Number.isFinite(n)) return 0;
            return x.trim().endsWith("ms") ? n : n * 1000;
          })
      );
    return max(cs[prop + "Duration"]) + max(cs[prop + "Delay"]);
  }

  // 关键：**自己解绑**，不用 `{ once: true }`。那会被第一个冒泡到 el 的事件消耗掉 ——
  // 名册卡的 cardIn 早于相位自己的 phaseIn 结束，于是事件判据永远等不到自己那趟，
  // 清理退化成定时器：那条判据被装它的 `{once:true}` 自我击败。
  // 实测（在 clear 里挂日志）：先 +714ms 被 card/cardIn 调用并被判据挡回，
  // 再 +756ms 被定时器调用。
  // opts: {cls 加上并收尾时摘掉, sample 取样选择器, onDone 收尾动作,
  //        selfOnly 默认 true = 只认自己身上的事件（揭幕那种过渡在子元素上的传 false）}
  function playOnce(el, kind, opts = {}) {
    if (!el) return;
    if (opts.cls) el.classList.add(opts.cls);
    const event = kind === "transition" ? "transitionend" : "animationend";
    let settled = false;
    const finish = (ev) => {
      if (settled) return;
      // 子元素冒泡上来的事件不算 —— 名册卡自己有 cardIn，别的相位层也有自己的动画
      if (ev && opts.selfOnly !== false && ev.target !== el) return;
      settled = true;
      el.removeEventListener(event, finish);
      if (opts.cls) el.classList.remove(opts.cls);
      if (opts.onDone) opts.onDone();
    };
    el.addEventListener(event, finish);
    setTimeout(finish, motionMs(el, kind, opts.sample) + MOTION_MARGIN_MS);
    return finish;
  }

  let entering = null;
  // 「即将进入挑人步」：renderRoster 渲染完才消费它，见 show() 里的注释

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
      entering = shown;
      playOnce(shown, "animation", {
        cls: "enter",
        // 降级模式下没有 animationend（动画被关掉），兜底由 playOnce 负责
        onDone: () => {
          if (entering === shown) entering = null;
        },
      });
    }
    // 名册的进场 stagger 只在**进入挑人步**时播一次。此前挂在 .card 上，于是
    // 每次重渲名册（搜索去抖、切状态/团体/期生、切档位、切系列）整表都淡入
    // 一遍 —— 名册有 258 张卡，效率区不该每次按键都有 ~165ms 的装饰
    // （ADR-0020：效率区「一屏做完一步、不加装饰」）。
    //
    // 这里只置标志，**由渲染本身决定要不要加类**：我第一版在 show() 里加类并
    // 兜底摘类（时长由 playOnce 从 CSS 读出，不写现值）——冷缓存下名册渲染更晚 → 卡片在窗口之后创建 →
    // 根本没有动画（实测两次进入一次没播）。
    picker.setEntering(phase === "pick");
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

  /* ---------------- 简介（原型 C 杂志编辑） ---------------- */
  let profileId = null;

  // 浮层打开时把页面其余部分设为 inert：Tab 不会再走到背景（M4 的圈禁，
  // 用平台能力而不是手搓 tabindex 队列）。三个浮层共用，keep 是当前浮层的 id。
  function setPageInert(on, keep = []) {
    for (const el of document.body.children) {
      if (keep.includes(el.id) || el.tagName === "SCRIPT") continue;
      if (on) el.setAttribute("inert", "");
      else el.removeAttribute("inert");
    }
  }

  let profileOpener = null;

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

  function warmBios() {
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1200));
    idle(() => void loadBios());
  }

  function paintProfileRows() {
    const m = BY_ID.get(profileId);
    if (!m) return;
    const bio = (BIOS && BIOS[m.id]) || {};
    const rows = CORE.profileRows({ ...m, bio }, t, lang, I18N.values);
    $("#pf-fields").innerHTML = rows
      .map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
      .join("");
  }

  function openProfile(id) {
    const m = BY_ID.get(id);
    if (!m) return;
    profileId = id;
    $("#pf-photo").src = thumbSrc(m);
    $("#pf-name").textContent = m.name;
    $("#pf-kana").textContent = m.kana || "";
    $("#pf-badge").textContent =
      m.group + (m.generation ? " · " + CORE.genText(m.generation, lang) : "");
    $("#pf-close").setAttribute("aria-label", t("bio_close"));
    paintProfileRows();
    $("#profile").hidden = false;
    setPageInert(true, ["profile"]);
    profileOpener = document.activeElement;
    $("#pf-close")?.focus();
    // 首次打开早于空闲预取：数据到了补画一次（失败就保持无 bio 的卡片）
    loadBios().then(() => {
      if (profileId === id && !$("#profile").hidden) paintProfileRows();
    });
  }

  function closeProfile() {
    profileId = null;
    $("#profile").hidden = true;
    setPageInert(false);
    // 焦点还给真正的触发者（pwa-sheet 同款；不还的话键盘用户会落回页面开头）
    if (profileOpener && profileOpener.isConnected) profileOpener.focus();
    profileOpener = null;
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

  $("#roster").addEventListener("keydown", profileKey);

  $("#roster").addEventListener("click", (e) => {
    const grp = e.target.closest(".grp-head");
    if (grp) return picker.toggleGroupNode(grp.parentElement.dataset.group);
    const head = e.target.closest(".gen-head");
    if (head) return picker.toggleGroup(head.parentElement.dataset.sec);
    const pid = profileIdOf(e);
    if (pid) return openProfile(pid);
    const card = e.target.closest(".card");
    if (card) picker.toggleMember(card.dataset.id);
  });

  $("#slots").addEventListener("click", (e) => {
    const b = e.target.closest("[data-remove]");
    if (b) picker.toggleMember(b.dataset.remove);
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
    sync(); // snap 是会话状态的副本，不先同步读到的就是上一拍的 group/档位
    // 期生选项按**当前团**算（工单 04 决定 2）：℃-ute 的人没有期生，选中它时
    // 选项为空 → 控件整个不出现，而不是给一个只会筛出 0 人的下拉。
    const opts = CORE.generationOptions(seriesGroups(), snap.group);
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
    const field = $("#gen-field");
    if (field) field.hidden = opts.length === 0;
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
    const view = picker.view();
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
    // 窄屏把 .filter-sum 藏了（它挤档位段），于是「筛选生效了」在视觉上没有指示 ——
    // 给触发按钮挂 data-active，用边框变色提示（零宽度增量：border 本就在）。
    if (btn) {
      const seg = document.querySelector(
        '.seg-filter [aria-checked="true"], .seg-filter [aria-checked="true"]'
      );
      const f = seg && seg.dataset.filter;
      if (f && f !== "all") btn.setAttribute("data-active", "");
      else btn.removeAttribute("data-active");
    }
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
    picker.render();
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
    // 期生选项依赖当前团（决定 2），所以换团要重算 —— 否则给的是上一个团的期生。
    refreshGenOptions();
    picker.render({ resetScroll: true });
  });

  genSelect.addEventListener("change", () => {
    S.setGeneration(genSelect.value);
    picker.render({ resetScroll: true });
  });

  document.querySelectorAll(".seg-filter button").forEach((b) => {
    b.addEventListener("click", () => {
      S.setFilter(b.dataset.filter);
      paintFilters();
      picker.render();
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
      picker.render({ resetScroll: true });
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
    screen.render();
  });

  $("#clear-btn").addEventListener("click", () => {
    if (!snap.selected.length) return;
    if (!window.confirm(t("clear_confirm"))) return;
    S.clearSelection();
    picker.syncSelection();
  });

  // 当前打开的可圈禁浮层：简介 / 对决说明 / 安装指引。
  function openDialog() {
    if (profileId) return $("#profile");
    if (introOpen) return $("#duel-intro");
    if (pwa.isOpen()) return $("#pwa-sheet");
    return null;
  }

  // Tab 圈禁：inert 挡住背景之后，剩下的缺口是「最后一个可聚焦元素按 Tab 会
  // 跳到浏览器 UI、再回来时落在 body」——这里把 Tab/Shift+Tab 兜回浮层内。
  function profileTrap(e) {
    if (e.key !== "Tab") return;
    const el = openDialog();
    if (!el) return;
    const items = [
      ...el.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ),
    ].filter((x) => !x.disabled && x.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const inside = el.contains(document.activeElement);
    if (
      e.shiftKey
        ? !inside || document.activeElement === first
        : !inside || document.activeElement === last
    ) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Tab") return profileTrap(e);
    if (e.key !== "Escape") return;
    if (moreOpen()) return setMore(false);
    if (pwa.isOpen()) return pwa.close();
    if (introOpen) return closeIntro();
    if (profileId) return closeProfile();
  });

  // 段控件（radiogroup）的左右方向键：任何 .seg 都适用（L9 前只有皮肤段有）。
  // 触发走 next.click() —— 各 seg 的点击分派（皮肤/大小/筛选/语言）各自现成，
  // 不在这里列举（列举过一次，写死 switchSkin 时新 seg 误切皮肤）。
  function segArrowKey(e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return false;
    const group = e.target.closest?.(".seg");
    if (!group) return false;
    const items = [...group.querySelectorAll("button")];
    const idx = items.indexOf(e.target);
    if (idx < 0) return false;
    e.preventDefault();
    const next =
      items[
        (idx + (e.key === "ArrowRight" ? 1 : items.length - 1)) % items.length
      ];
    next.focus();
    next.click();
    return true;
  }

  document.addEventListener("keydown", (e) => {
    if (segArrowKey(e)) return;
    duel.arrowKey(e);
  });

  /* ---------------- result ---------------- */
  $("#rank-list").addEventListener("keydown", profileKey);
  $("#rank-list").addEventListener("click", profileClick);

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
    // 过渡挂在克隆层里的 img 上，所以它们的 transitionend 冒泡上来就算完成
    // （selfOnly:false）；收尾动作是移除克隆层本身。
    playOnce(layer, "transition", {
      onDone: () => layer.remove(),
      selfOnly: false,
    });
    requestAnimationFrame(() => {
      for (const img of layer.children) {
        img.style.transform = "none";
        img.style.opacity = "0";
      }
    });
  }

  /** 结果页的渲染顺序只有这一处（普通结果与只读分享共用）。 */
  function renderResultBody() {
    resultView.renderList();
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
  $("#restart-btn").addEventListener("click", () => {
    // 与「清空」同款确认：重新选人会作废当前对决进度（此前一键销毁、0 确认）。
    if (!window.confirm(t("reselect_confirm"))) return;
    navigate("restart");
  });
  $("#save-btn").addEventListener("click", savePoster);
  $("#copy-link").addEventListener("click", async () => {
    const link = shareLink();
    if (!link) return toast(t("copy_failed"));
    try {
      await navigator.clipboard.writeText(link);
      toast(t("copied"));
    } catch {
      toast(t("copy_failed"));
    }
  });
  $("#shared-cta").addEventListener("click", () => navigate("pick"));
  $("#share-btn").addEventListener("click", () => {
    const ex = resultView.exportData();
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
        name: v("--font-poster-name", v("--font-jp", d.fonts.jp)),
        display: v("--font-poster", v("--font-display", d.fonts.display)),
      },
      cardStroke: parseFloat(v("--poster-card-stroke", "3px")) || 0,
      corner: parseFloat(v("--poster-corner", "10px")),
      shadow: v("--poster-shadow", "1") !== "0",
      rankStyle: v("--poster-rank", "tape"),
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

    const ex = resultView.exportData();
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
      // toDataURL 是同步编码（40 人实测 177–185ms，合成 282–306ms 的长任务）；
      // toBlob 把编码移出主线程，预览用 object URL。下载路径本来就是 toBlob。
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) throw new Error("poster blob is null");
      const url = URL.createObjectURL(blob);
      const img = $("#poster-img");
      if (img.dataset.objUrl) URL.revokeObjectURL(img.dataset.objUrl);
      img.dataset.objUrl = url;
      img.src = url;
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
      a.download = resultView.exportData().fileName;
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
    const c = e.target.closest(".seg-cols [data-cols]");
    if (c) setCols(c.dataset.cols);
  });

  function paintSkin() {
    document.documentElement.dataset.skin = snap.skin;
    paintSeg(".seg-skin", "skin", snap.skin);
  }

  // 名册卡片大小档位（三档令牌在 style.css 的 .seg-cols 段）：外观偏好，不进 session
  // （对局状态）；键名走 PREF_KEYS（守卫禁止字面量）。默认「中」= 不留属性。
  function readCols() {
    try {
      const v = localStorage.getItem(CORE.PREF_KEYS.cols);
      return ["large", "compact"].includes(v) ? v : "std";
    } catch (e) {
      return "std";
    }
  }

  function setCols(name) {
    const v = ["large", "std", "compact"].includes(name) ? name : "std";
    try {
      if (v === "std") localStorage.removeItem(CORE.PREF_KEYS.cols);
      else localStorage.setItem(CORE.PREF_KEYS.cols, v);
    } catch (e) {
      /* 隐私模式等：仍应用本次选择 */
    }
    paintCols(v);
  }

  function paintCols(v) {
    const name = v || readCols();
    if (name === "std") delete document.documentElement.dataset.cols;
    else document.documentElement.dataset.cols = name;
    paintSeg(".seg-cols", "cols", name);
  }

  function switchSkin(next) {
    if (!S.setSkin(next)) return;
    sync();
    paintSkin();
    if (share.on() || snap.phase === "result") drawPoster();
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

  // 切相位时清掉上一步的提示：它属于上一屏（实测「已选满」的黑色 toast
  // 会压在筛选页第 6 行/按钮上 2.4 秒）。
  function hideToast() {
    const el = $("#toast");
    if (!el) return;
    clearTimeout(toastTimer);
    el.classList.remove("show");
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
    // 只让搜索态早退：团/期生作用域同样需要「没有可见卡就补展开」——否则该作用域
    // 与筛选相交为空时，整个名册空白且没有空态文案（M1 的 E 变体）。
    if (snap.query) return;
    const nodes = picker.view().nodes;
    if (!nodes.length) return;
    // 判据是「有没有**展开的段**活在当前投影里」——不能只看 snap.open 非空：
    // 筛选一出（如「现役」），原先展开的段可能被整体剔除，旧键变悬空，于是
    // 早退后没人补展开 → 名册 0 张卡且无空态（2026-10-08 修，ux-probe10）。
    const secIds = new Set();
    nodes.forEach((n) => (n.sections || []).forEach((x) => secIds.add(x.id)));
    if (snap.open.some((id) => secIds.has(id))) return;
    const first = nodes[0];
    if (!snap.open.includes(first.id)) S.toggleOpen(first.id);
    const sec = first.sections[0];
    if (sec && !snap.open.includes(sec.id)) S.toggleOpen(sec.id);
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
  function paint() {
    if (share.on() && share.paint()) return;
    sync();
    if (view === "screening") {
      show("screen");
      screen.render();
      return;
    }
    if (view === "duel" && snap.phase === "duel") {
      show("duel");
      duel.render();
      return;
    }
    if (view === "result" && snap.phase === "result") {
      resultView.render();
      return;
    }
    view = "pick";
    show("pick");
    picker.render();
  }

  // opts 透给 startDuel（目前只有 { shuffle }，出图页「这几位重新排序」用）
  function navigate(intent, opts) {
    // 只读分享页里的任何导航（步骤 ①、重新选人、CTA）都先退回接收者自己的会话
    if (share.on() && intent !== "boot") share.exit();
    const out = CORE.nav(navCtx(), intent);
    if (out.effect === "abandon") S.abandonDuel();
    hideToast();
    view = out.view;
    // 对决的对手来自「已选 + 筛选层级」（ADR-0019 改写版），不再由调用方传 order
    if (out.effect === "start" || out.effect === "resume")
      return duel.begin(opts);
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
    setPageInert(true, ["duel-intro"]);
    const go = el.querySelector('[data-act="intro-go"]');
    if (go) go.focus();
  }
  function closeIntro() {
    rememberFlag(INTRO_KEY);
    $("#duel-intro").hidden = true;
    introOpen = false;
    setPageInert(false);
    const f = $("#fighter-a");
    if (f) f.focus();
  }

  // data-act 的动作查表（原型设为 null，data-act 是任意字符串，防原型链上的名字）。
  const CLICK_ACTIONS = Object.assign(Object.create(null), {
    "coach-ok": () => {
      rememberFlag(COACH_KEY);
      $("#coach").hidden = true;
    },
    "resume-go": () => navigate("resume"),
    "resume-drop": () => {
      // 同「重新选人」：放弃会作废对决进度（此前 0 确认）。
      if (!window.confirm(t("drop_confirm"))) return;
      navigate("drop");
    },
    "intro-go": closeIntro,
    "intro-skip": closeIntro,
  });

  function stepClick(step) {
    // 只读分享页的 ① 只是退出只读，不涉及接收者自己的对决 —— 不要弹确认
    if (share.on()) return navigate(step.dataset.step);
    // ① 在非 pick 相位会 abandon 掉进行中的对决（core.nav 的 pick 规则）——与
    // 「重新选人」是同一条销毁路径，复用同一句确认（M5 只盖了按钮，这条漏了；
    // 第八轮扫描抓到：结果页点 ① 海报与全部答案直接消失、零确认）。
    const out = CORE.nav(navCtx(), step.dataset.step);
    if (out.effect === "abandon" && !window.confirm(t("reselect_confirm")))
      return;
    return navigate(step.dataset.step);
  }

  document.addEventListener("click", (e) => {
    const step = e.target.closest("#steps [data-step]");
    if (step && !step.disabled) return stepClick(step);
    const act = e.target.closest("[data-act]");
    if (act) {
      const fn = CLICK_ACTIONS[act.dataset.act];
      if (fn) return fn();
    }
    // 全部恢复是 id 不是 data-act —— 拆委托表时漏过这条，E2E 抓到（29/32）
    if (e.target.closest("#screen-reset")) {
      screen.reset();
      return;
    }
    const mark = e.target.closest("[data-cut]");
    if (mark) screen.cut(mark.dataset.cut);
  });

  /* ---------------- PWA（可安装 / 离线 / 更新，见 docs/adr/0016-pwa.md） ---------------- */

  // 当前页可见字符的码点集合（DOM 依赖，故留在 app.js；纯选择逻辑在 core.js）
  // 可见文本按「computed family + weight」分组：fonts 预热只拉这些组合的子集。
  // 不可见相位（result/duel 弹层等）不预热 —— 它们离线时走系统兜底，见 Q7=A1。
  function fontUsages(root) {
    const byKey = new Map();
    const els = root.querySelectorAll(
      "body *:not(script):not(style):not(noscript)"
    );
    for (const el of els) {
      if (el.childElementCount) continue;
      const text = el.textContent || "";
      if (!text || !el.getClientRects().length) continue;
      const cs = getComputedStyle(el);
      const weight = cs.fontWeight;
      for (const raw of cs.fontFamily.split(",")) {
        const family = raw
          .trim()
          .replace(/^["']|["']$/g, "")
          .toLowerCase();
        if (!family) continue;
        const key = family + "|" + weight;
        let set = byKey.get(key);
        if (!set) byKey.set(key, (set = new Set()));
        for (const ch of text) set.add(ch.codePointAt(0));
      }
    }
    return [...byKey.entries()].map(([key, chars]) => {
      const [family, weight] = key.split("|");
      return { family, weight, chars };
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
        // #4：只预热「可见元素真的会用这个 family/weight 渲染」的子集。此前是
        // 可见字符 × 全部 family（500+ 文件 / 5.7MB），标题字体的 CJK 子集被正文
        // 字符全部点亮；现在按 computed style 分组挑选。
        const urls = CORE.warmUrls(css, fontUsages(document));
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

  const pwa = window.AKB_APP_PWA.create({
    $,
    t,
    I18N,
    setPageInert,
    warmFonts,
  });

  const duel = window.AKB_APP_DUEL.create({
    $,
    CORE,
    S,
    t,
    esc,
    fullSrc,
    fullMeta,
    byId: (id) => BY_ID.get(id),
    view: () => view,
    series: () => series,
    introOpen: () => introOpen,
    profileId: () => profileId,
    pwaOpen: () => pwa.isOpen(),
    snapshot: () => snap,
    sync,
    show,
    navigate,
    renderSteps,
    toast,
    maybeIntro,
  });

  const screen = window.AKB_APP_SCREEN.create({
    $,
    CORE,
    S,
    t,
    esc,
    thumbSrc,
    fullMeta,
    byId: (id) => BY_ID.get(id),
    snapshot: () => snap,
    sync,
    renderSteps,
    navigate,
  });

  const picker = window.AKB_APP_PICK.create({
    $,
    CORE,
    S,
    t,
    esc,
    thumbSrc,
    metaText,
    seriesGroups,
    ensureOpen,
    paintFilterSum,
    playOnce,
    renderSteps,
    renderGuide,
    toast,
    byId: (id) => BY_ID.get(id),
    snapshot: () => snap,
    sync,
    lang: () => lang,
    members: [...BY_ID.values()],
    fold: FOLD,
  });

  const resultView = window.AKB_APP_RESULT.create({
    $,
    esc,
    t,
    thumbSrc,
    fullMeta,
    names,
    getRanking: () => ranking,
    setRanking: (v) => {
      ranking = v;
    },
    shareLink,
    sync,
    snapshot: () => snap,
    byId: (id) => BY_ID.get(id),
    renderBody: () => renderResultBody(),
  });

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
    if (e.target.closest('[data-act="pwa-install"]')) return void pwa.install();
    if (e.target.closest('[data-act="pwa-ios"]')) return void pwa.openSheet();
    if (
      e.target.closest('[data-act="pwa-ios-close"]') ||
      e.target.id === "pwa-scrim"
    )
      return void pwa.close();
    if (e.target.closest('[data-act="pwa-reload"]'))
      return void pwa.applyUpdate();
  });

  /* ---------------- boot ---------------- */
  paintSkin();
  paintCols();
  renderChrome();
  navigate("boot");
  pwa.init();
  warmBios();
  if (share.on()) share.enter();
})();

// L11：boot 占位与相位切换解耦 —— 模块加载后的下一帧就把它摘掉（相位在 init 里
// 已同步渲染过；之后离开挑人页/回挑人页都与占位无关）。
requestAnimationFrame(() => document.getElementById("boot")?.remove());
