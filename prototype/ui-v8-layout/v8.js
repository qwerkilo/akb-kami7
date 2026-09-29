/* 四版版面原型的共享引擎：真数据（members.js）+ 真令牌，差别只在布局。 */
const GROUPS = window.AKB_GROUPS || [];
const flat = GROUPS.flatMap((g) => g.members.map((m) => ({ ...m, group: g.group, gen: g.label, series: g.series })));
const SERIES = { "48g": "48 Group", sakamichi: "坂道", love: "等爱" };
const q = new URLSearchParams(location.search);
const VARIANT = (q.get("variant") || "A").toUpperCase();
const SKIN = (q.get("skin") || "sticker").toLowerCase();
document.documentElement.setAttribute("data-skin", SKIN);

const state = { series: "48g", size: 7, picked: [], step: 0, view: "pick", lang: "zh" };
const pool = () => flat.filter((m) => m.series === state.series);
const photo = (m, s = "thumb") => (m.img ? `img/${s}/${m.id}.webp` : "");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const T = {
  pick: "挑人", duel: "对决", out: "出图", start: "开始排序", clear: "清空", more: "⋯",
  vs: "更喜欢哪张脸？", undo: "撤回上一题", save: "保存并返回", done: "已完成", saved: "进度已自动保存",
  sel: "已选", gens: "全部期生", status: "全部状态", all: "全部团体", q: "搜索名字 / 假名 / 罗马字",
};

function stepsHTML(active) {
  return `<div class="steps">${["pick", "duel", "out"]
    .map(
      (k, i) =>
        `<span><b>${i + 1}</b> ${T[k]}${k === "pick" ? ` <span class="chip">${state.picked.length}/${state.size}</span>` : ""}${
          k === active ? " ◂" : ""
        }</span>${i < 2 ? "<span>›</span>" : ""}`
    )
    .join("")}</div>`;
}
function gridHTML(limit = 12) {
  const ms = pool().slice(0, limit);
  return `<div class="grid">${ms
    .map((m, i) => {
      const on = state.picked.includes(m.id);
      return `<div class="mcard ${on ? "picked" : ""}">
        ${on ? `<span class="rank">${state.picked.indexOf(m.id) + 1}</span>` : ""}
        <button class="info" title="简介">i</button>
        <div class="ph">${photo(m) ? `<img src="${photo(m)}" alt="${esc(m.name)}" loading="lazy">` : ""}</div>
        <div class="nm">${esc(m.name)}</div><div class="mt">${esc(m.gen)}</div></div>`;
    })
    .join("")}</div>`;
}
function versusHTML() {
  const a = pool()[state.step % 2], b = pool()[(state.step + 1) % 2];
  const face = (m) => `<div class="face"><div class="ph">${photo(m, "full") ? `<img src="${photo(m, "full")}" alt="${esc(m.name)}">` : ""}</div>
    <div class="nm">${esc(m.name)}</div><div class="mt">${esc(m.group)} · ${esc(m.gen)}</div></div>`;
  return `<div class="q">${T.vs}</div>
    <div class="prog"><i style="width:${Math.round((state.step / 14) * 100)}%"></i></div>
    <div style="text-align:center;font-size:12px;color:var(--muted)">${state.step + 1} / 最多 14 题 · ${T.saved}</div>
    <div class="versus">${face(a)}<div style="display:grid;place-items:center;font-weight:800">or</div>${face(b)}</div>`;
}
function rankHTML() {
  const ms = state.picked.length ? state.picked.map((id) => flat.find((m) => m.id === id)).filter(Boolean) : pool().slice(0, 7);
  return `<div class="rank-list">${ms
    .map(
      (m, i) => `<div class="rank-row"><span class="no">${i + 1}</span>
      <span class="av">${photo(m) ? `<img src="${photo(m)}" alt="">` : ""}</span>
      <span>${esc(m.name)}<br><span style="font-size:11px;color:var(--muted)">${esc(m.group)} · ${esc(m.gen)}</span></span></div>`
    )
    .join("")}</div>`;
}
const thumbs = (n = 7) =>
  `<span class="thumbs">${state.picked
    .slice(0, n)
    .map((id) => {
      const m = flat.find((x) => x.id === id);
      return `<i>${m && photo(m) ? `<img src="${photo(m)}" alt="">` : ""}</i>`;
    })
    .join("")}</span>`;

const LABEL = { "48g": "48G", sakamichi: "坂道", love: "等爱" };
const seg = (items, cur, attr) =>
  `<span class="seg">${items
    .map((v) => `<button ${attr}="${v}" aria-checked="${v === cur}">${LABEL[v] || v}</button>`)
    .join("")}</span>`;

const VIEWS = {
  A: {
    cls: "v-a",
    note: "A · 紧凑页头条：页头收成一行（品牌+系列+档位+⋯），对决页两张脸进首屏，托盘压成一条。",
    pick: () => `<div class="bar"><span class="brand">神7</span>${seg(["48g", "sakamichi", "love"], state.series, "data-s")}${seg(["7", "16", "40"], String(state.size), "data-z")}<span class="grow"></span><button class="more">${T.more}</button></div>
      ${stepsHTML("pick")}
      <div class="row" style="display:flex;gap:6px;padding:0 10px 6px"><input placeholder="${T.q}" style="flex:1;min-height:38px;border-radius:999px;border:1px solid var(--line);padding:0 12px">${seg(["现役", "毕业"], "现役", "data-f")}</div>
      ${gridHTML(12)}
      <div class="tray">${thumbs()}<span class="count">${T.sel} ${state.picked.length}/${state.size}</span><button class="primary">${T.start}</button></div>`,
    duel: () => `<div class="bar"><span class="brand">神7</span><span class="grow"></span><button class="more">${T.more}</button></div>
      ${stepsHTML("duel")}
      ${versusHTML()}
      <div class="duelbar"><button class="ghost">${T.undo}</button><button class="primary">${T.save}</button></div>`,
  },
  B: {
    cls: "v-b",
    note: "B · 对决沉浸：挑人页页头照旧；进对决后页头收成一条细进度条，两张脸撑满首屏；已选变成右下角悬浮药丸。",
    pick: () => `<div class="chrome"><div class="row1"><span class="logo">神7</span><span class="grow" style="flex:1"></span>${seg(["中", "EN", "日"], "中", "data-l")}</div>
      <div class="row2">${seg(["48g", "sakamichi", "love"], "48g", "data-s")}${seg(["7", "16", "40"], "7", "data-z")}</div></div>
      ${stepsHTML("pick")}
      <div style="display:flex;gap:6px;padding:0 10px 6px"><input placeholder="${T.q}" style="flex:1;min-height:38px;border-radius:999px;border:1px solid var(--line);padding:0 12px"></div>
      ${gridHTML(12)}
      <div class="pill-tray">${thumbs()}<span style="font-size:12px">${state.picked.length}/${state.size}</span><button class="primary" style="padding:8px 14px;min-height:36px">${T.start}</button></div>`,
    duel: () => `<div class="thin"><span>${state.step + 1}/14</span><span class="prog" style="flex:1;margin:0"><i style="width:${Math.round((state.step / 14) * 100)}%"></i></span><button class="chip">${T.more}</button></div>
      <div class="duel-stage">${versusHTML()}
      <div class="duelbar" style="position:sticky;bottom:0;display:flex;gap:8px;padding:10px;background:var(--card);border-top:1px solid var(--line)"><button class="ghost">${T.undo}</button><button class="primary" style="flex:1">${T.save}</button></div></div>`,
  },
  C: {
    cls: "v-c",
    note: "C · 分栏工作台：顶栏 + 一行筛选；≥900px 时变左栏筛选 / 中间名册 / 右栏已选三栏（手机上右栏折成底部一条）。",
    pick: () => `<div class="top"><div class="row"><span style="font-weight:800">神7</span>${seg(["7", "16", "40"], "7", "data-z")}<span style="flex:1"></span>${seg(["中", "EN", "日"], "中", "data-l")}</div>
      <div class="filters">${[T.all, "AKB48", "SKE48", "坂道", T.gens, T.status].map((x) => `<button class="chip">${x}</button>`).join("")}</div></div>
      ${stepsHTML("pick")}
      <div class="workspace"><div class="rail"><div class="g">团体</div><div class="g">${T.gens}</div><div class="g">${T.status}</div></div>
        <div>${gridHTML(12)}</div>
        <div class="side">${state.picked.map((id) => { const m = flat.find((x) => x.id === id); return m ? `<div class="m">${photo(m) ? `<img src="${photo(m)}">` : ""}<span>${esc(m.name)}</span></div>` : ""; }).join("") || `<div class="m" style="color:var(--muted)">还没选</div>`}</div></div>
      <div class="traybar"><span style="font-size:13px">${T.sel} ${state.picked.length}/${state.size}</span><button class="chip">${T.clear}</button><button class="primary">${T.start}</button></div>`,
    duel: () => `<div class="top"><div class="row"><span style="font-weight:800">对决</span><span style="flex:1"></span><button class="chip">${T.more}</button></div></div>
      ${versusHTML()}
      <div class="traybar"><button class="ghost">${T.undo}</button><button class="primary" style="flex:1">${T.save}</button></div>`,
  },
  D: {
    cls: "v-d",
    note: "D · 底部抽屉：页头只剩一条标题栏（点它拉出设置抽屉：系列/档位/语言/皮肤）；已选收成底部一个把手，点开才是完整已选板。",
    pick: () => `<div class="titlebar"><span class="t">神7 · 历代成员版</span><span class="grow"></span><button class="chip">中</button><button class="chip">原版</button></div>
      ${stepsHTML("pick")}
      <div style="display:flex;gap:6px;padding:0 10px 6px"><input placeholder="${T.q}" style="flex:1;min-height:38px;border-radius:999px;border:1px solid var(--line);padding:0 12px"></div>
      ${gridHTML(12)}
      <button class="handle"><span class="n">已选 ${state.picked.length}/${state.size}</span><span>▲</span></button>`,
    duel: () => `<div class="titlebar"><span class="t">对决 ${state.step + 1}/14</span><span class="grow"></span><button class="chip">${T.more}</button></div>
      <div class="duel">${versusHTML()}</div>
      <div class="action"><button class="ghost">${T.undo}</button><button class="primary">${T.save}</button></div>`,
  },
};

const v = VIEWS[VARIANT] || VIEWS.A;
document.body.className = v.cls + " has-tray";
document.body.innerHTML = `
  <div class="proto-bar">
    <b>版面原型</b>
    ${["A", "B", "C", "D"].map((k) => `<a href="?variant=${k}&skin=${SKIN}" ${k === VARIANT ? 'aria-current="true"' : ""}>${k}</a>`).join("")}
    <span class="sp"></span>
    <a href="?variant=${VARIANT}&skin=classic">原版</a><a href="?variant=${VARIANT}&skin=sticker">贴纸</a>
  </div>
  <div class="proto-note">${v.note}</div>
  <div id="app"></div>`;

function paint() {
  const pick = state.view === "pick";
  document.getElementById("app").innerHTML = pick
    ? v.pick()
    : v.duel() + (state.view === "out" ? rankHTML() : "");
}
state.picked = pool().slice(0, 7).map((m) => m.id);
state.view = q.get("view") || "pick";
paint();

document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.closest(".mcard") && !t.closest(".info")) {
    const card = t.closest(".mcard");
    const id = pool()[card.parentElement.children.length ? [...card.parentElement.children].indexOf(card) : 0].id;
    const i = state.picked.indexOf(id);
    if (i >= 0) state.picked.splice(i, 1); else state.picked.push(id);
    paint();
  } else if (t.closest(".face") || t.closest(".duelbar .primary, .duel .primary")) {
    state.step++;
    if (state.step >= 4) state.view = "out"; else paint();
  } else if (t.closest("[data-s]")) { state.series = t.closest("[data-s]").dataset.s === "48G" ? "48g" : t.closest("[data-s]").dataset.s; state.picked = pool().slice(0, 7).map((m) => m.id); paint(); }
  else if (t.closest("[data-z]")) { state.size = +t.closest("[data-z]").dataset.z; paint(); }
  else if (t.closest(".primary") && /开始排序/.test(t.textContent)) { state.view = "duel"; state.step = 0; paint(); }
  else if (t.closest(".more, .handle")) { /* 原型里不展开 */ }
});
