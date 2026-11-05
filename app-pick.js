// 挑人相位：名册投影、折叠段、选中与托盘。
// 名册投影的纯逻辑在 core.rosterView；本模块只做 DOM。
(function (root, factory) {
  const api = factory;
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AKB_APP_PICK = { create: api };
})(typeof globalThis !== "undefined" ? globalThis : this, function (deps) {
  "use strict";
  const {
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
    byId,
    snapshot,
    sync,
    lang,
    members,
    fold,
  } = deps;

  let entering = false;
  members.forEach((m) => {
    m.hay = CORE.haystack(m, fold);
  });

  const roster = $("#roster");

  function viewOpts() {
    return {
      group: snapshot().group,
      generation: snapshot().generation,
      status: snapshot().filter,
      query: snapshot().query,
      selected: snapshot().selected,
    };
  }

  const rosterView = () => CORE.rosterView(seriesGroups(), viewOpts());

  // 计数文案单一出处（数字来自投影，i18n 留在 DOM 层）
  function countText(node) {
    return snapshot().filter === "all" && node.current
      ? t("people_now", node.count, node.current)
      : t("people", node.count);
  }

  function cardHTML(m, showGroup, i) {
    const sel = snapshot().selected.indexOf(m.id);
    const meta = showGroup ? `${m.group} · ${metaText(m)}` : metaText(m);
    // --i 是进场 stagger 的下标（工单 03）。不传时为 0：搜索结果不需要错开入场。
    // **封顶在 CSS 里**（min(var(--i), 8)），JS 只传原始下标 —— 此前 8 这个数
    // 在 app.js 与测试里各存一份，改了一处另一处不响。
    const idx = typeof i === "number" ? i : 0;
    return `<button class="card" style="--i:${idx}" data-id="${m.id}" aria-pressed="${sel >= 0}" data-order="${sel + 1}" title="${esc(m.name)}${m.kana ? "（" + esc(m.kana) + "）" : ""}">
      <span class="info" role="button" tabindex="0" aria-label="${t("bio_open")}" data-profile="${m.id}">i</span>
      <span class="ph"><img src="${thumbSrc(m)}" alt="" loading="lazy" decoding="async" width="240" height="320"></span>
      <span class="nm">${esc(m.name)}</span>
      <span class="meta${m.status === "current" ? " now" : ""}">${esc(meta)}</span>
    </button>`;
  }

  let secSeq = 0;

  // 「这一层是不是嵌套的」：没选定具体团体时，期生段挂在团体段下面。
  // 原来这个判据藏在 sectionHTML 里读 snapshot().group，现在提到调用处显式传。
  function nested() {
    return snapshot().group === "all";
  }

  // 一个折叠段。level 只决定类名前缀与 data 属性名，其余形状两级完全一样 ——
  // 之前这是四套实现（两个渲染器 + 两个 toggle + 两个徽章循环）。
  // `sub` 由渲染的地方显式给出（顶层团体里的期生段是嵌套的），不再从筛选状态反推。
  function sectionHTML(o) {
    // level 只决定前缀与 data 属性名；两层共用同一份模板（候选 6 收口）。
    const cls = o.level === "grp" ? "grp" : "gen";
    const attr = cls === "grp" ? "group" : "sec";
    const open = o.open;
    return `<section class="${cls}${o.sub ? " sub" : ""}" data-${attr}="${esc(o.id)}">
      <button class="${cls}-head" aria-expanded="${open}" aria-controls="${o.uid}">
        <i class="chev" aria-hidden="true"></i>
        <span class="${cls}-name">${esc(o.label)}</span>
        <span class="${cls}-count">${countText(o.node)}</span>
        <span class="${cls}-picked">${o.picked ? t("picked", o.picked) : ""}</span>
      </button>
      <div class="${cls}-body" id="${o.uid}" ${open ? "" : "hidden"}>${o.body}</div>
    </section>`;
  }

  // 期生段：一张可折叠的卡片列表
  function genSectionHTML(sec, sub) {
    const open = snapshot().open.includes(sec.id);
    return sectionHTML({
      level: "gen",
      sub,
      id: sec.id,
      uid: `gen-${++secSeq}`,
      label: sec.label,
      picked: sec.picked,
      node: sec,
      open,
      body: open
        ? sec.members.map((m, k) => cardHTML(m, false, k)).join("")
        : "",
    });
  }

  // 团体段：body 是它下面的期生段
  function grpSectionHTML(node) {
    const open = snapshot().open.includes(openKey("grp", node.group));
    const body = open
      ? node.sections.map((s) => genSectionHTML(s, nested())).join("")
      : "";
    return sectionHTML({
      level: "grp",
      id: node.group,
      uid: "grp-" + esc(node.group),
      label: node.group,
      picked: node.picked,
      node,
      open,
      body,
    });
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
    // 投影一变就重画摘要：搜索 / 换团 / 换期生只走这里，此前摘要停在旧数
    // （第八轮扫描抓到：名册 7 张、#filter-sum 仍显示 1134）。
    paintFilterSum();
    if (view.mode === "search") return renderSearch(view);

    const twoLevel = view.mode === "tree";
    const html = [];
    for (const node of view.nodes) {
      if (twoLevel) {
        // 两级：团体段是顶层，它下面的期生段是嵌套的
        html.push(grpSectionHTML(node));
        continue;
      }
      // 只有一层（选定了某个团体，或搜结果之外的状态）：期生段直接铺在名册里
      html.push(
        node.sections.map((sec) => genSectionHTML(sec, nested())).join("")
      );
    }
    roster.innerHTML =
      html.join("") || `<p class="empty">${t("empty_filter")}</p>`;
    rosterEntered();
  }

  // 进场 stagger 的开关：卡片**已经存在**之后才加 .roster.enter，
  // 所以卡片一插入就是动画的起点（CSS 里 .roster.enter .card 才有 animation）。
  // 动画结束或兜底窗口后摘掉（窗口由 playOnce 从 CSS 读出，不写现值），摘掉后重渲不再有动画。
  function rosterEntered() {
    const el = $("#roster");
    const wanted = entering;
    entering = false;
    if (!el) return;
    el.classList.remove("enter");
    if (!wanted) return;
    // 动画挂在 .card 上（.roster.enter .card），所以取样选择器给 ".card"，
    // 时长由 playOnce 从 CSS 读出再加统一余量 —— 此前这里写死 600ms。
    // 余量要紧贴不得：本机冷加载时主线程被字体与脚本占住，动画还在延迟相位
    // 就被摘类 → 整批 cancelled（实测三次进入有一次整个不播）。
    playOnce(el, "animation", { cls: "enter", sample: ".card" });
  }

  // 宽命中（单个 "a" 曾命中 1000+）会把 467KB 的 innerHTML 一次重建 → 冻结 ~1s。
  // 只渲染前 N 张，其余用一行诚实提示（再输入一个字即可缩小）。
  const SEARCH_RENDER_CAP = 40;
  function renderSearch(view) {
    const hits = view.hits;
    const shown = hits.slice(0, SEARCH_RENDER_CAP);
    const more = hits.length - shown.length;
    roster.innerHTML = hits.length
      ? `<p class="search-hint">${t("found", hits.length)}</p><div class="gen-body">${shown.map((m) => cardHTML(m, true)).join("")}</div>${more > 0 ? `<p class="hint">${t("search_more", more)}</p>` : ""}`
      : `<p class="empty">${t("empty_search", esc(snapshot().query))}</p><p class="hint">${t("empty_search_hint")}</p>`;
    rosterEntered();
  }

  // 折叠/展开一个段。两级同一个算法：定位 → 取内容 → 切 hidden → 写 aria-expanded。
  // 折叠态的存储键：团体段记在 `g:<团名>` 下，期生段记在段 id 下 —— 与
  // grpSectionHTML / genSectionHTML 里读 snapshot().open 用的是同一个约定（合成一处前，
  // toggleGroupNode 用的 `"g:" + name` 与渲染侧的 "g:" + node.group 是两处字面量）。
  function openKey(level, key) {
    return level === "grp" ? "g:" + key : key;
  }

  function toggleSection(level, key, content) {
    // key 是数据派生的团体名/期生名；含引号时拼选择器会抛 DOMException（质检发现④）
    const k = CSS.escape(key);
    const sec = roster.querySelector(
      level === "grp" ? `.grp[data-group="${k}"]` : `.gen[data-sec="${k}"]`
    );
    if (!sec) return;
    const c = level === "grp" ? "grp" : "gen";
    const head = sec.querySelector(`.${c}-head`);
    const body = sec.querySelector(`.${c}-body`);
    const open = S.toggleOpen(openKey(level, key));
    if (open) {
      body.innerHTML = content();
      body.hidden = false;
    } else {
      body.hidden = true;
      body.innerHTML = "";
    }
    head.setAttribute("aria-expanded", open);
    // 原来这里还有一段「折叠后把视口滚回该段」的补偿。它是**死代码**：
    // #phase-pick 是 min-height 而非固定高，名册容器随内容长高，
    // `.roster` 的 overflow-y:auto 永远不触发（实测 scrollHeight === clientHeight、
    // scrollTop 恒 0），所以两层都没生效过 —— grill 时我把它当成「团体层缺补偿」
    // 是错的。真要滚回该 scrollIntoView 或滚 window，不是 scrollTop。
  }

  function toggleGroup(secId) {
    toggleSection("gen", secId, () =>
      // 显式包一层：把 cardHTML 直接交给 .map 会把 (element, index, array) 三个
      // 参数全传进去，第三参 i 收到的是**数组** → Math.min(array, 8) = NaN →
      // `--i: NaN` 是已定义的自定义属性，var(--i, 0) 的兜底不生效 →
      // calc(NaN * 18ms) 整条失效，animation-delay 静默回退 initial，且无报错。
      (viewSection(secId)?.members || []).map((m) => cardHTML(m)).join("")
    );
  }

  function toggleGroupNode(name) {
    toggleSection("grp", name, () => {
      const node = rosterView().nodes.find((n) => n.group === name);
      return node
        ? node.sections.map((s) => genSectionHTML(s, nested())).join("")
        : "";
    });
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
    if (snapshot().selected.length === snapshot().size) toast(t("picked_full"));
    syncSelection();
  }

  function syncSelection() {
    sync();
    roster.querySelectorAll(".card").forEach((el) => {
      const i = snapshot().selected.indexOf(el.dataset.id);
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
    for (const [level, picked] of [
      ["gen", secPicked],
      ["grp", grpPicked],
    ]) {
      const key = level === "grp" ? "group" : "sec";
      roster.querySelectorAll(`.${level}`).forEach((sec) => {
        const n = picked.get(sec.dataset[key]) || 0;
        sec.querySelector(`.${level}-picked`).textContent = n
          ? t("picked", n)
          : "";
      });
    }
    roster.classList.toggle(
      "full",
      snapshot().selected.length >= snapshot().size
    );
    renderTray();
    renderSteps();
    renderGuide();
  }

  function renderTray() {
    const slots = [];
    for (let i = 0; i < snapshot().size; i++) {
      const m = byId(snapshot().selected[i]);
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
    const left = snapshot().size - snapshot().selected.length;
    const btn = $("#start-btn");
    btn.disabled = left > 0;
    btn.textContent =
      left > 0
        ? t("need", left)
        : snapshot().phase === "duel"
          ? t("resume_go")
          : t("screen_go");
    btn.classList.toggle("emphasis", left === 0);
    const clearBtn = $("#clear-btn");
    if (clearBtn) clearBtn.disabled = snapshot().selected.length === 0;
  }

  return {
    render: renderPick,
    syncSelection,
    toggleMember,
    toggleGroup,
    toggleGroupNode,
    view: rosterView,
    setEntering: (v) => {
      entering = v;
    },
  };
});
