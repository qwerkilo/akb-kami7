/* v9：四版的差别在**你到底做什么动作**。真数据 + 真令牌（tokens.css）。 */
const GROUPS = window.AKB_GROUPS || [];
const flat = GROUPS.flatMap((g) => g.members.map((m) => ({ ...m, group: g.group, gen: g.label, series: g.series })));
const q = new URLSearchParams(location.search);
const V = (q.get("variant") || "E").toUpperCase();
const SKIN = (q.get("skin") || "sticker").toLowerCase();
document.documentElement.setAttribute("data-skin", SKIN);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ph = (m, s = "thumb") => (m.img ? `img/${s}/${m.id}.webp` : "");
const st = { series: "48g", size: 7, picked: [], q: 0, view: q.get("view") || "duel", step: 0 };
const pool = () => flat.filter((m) => m.series === st.series);
const L = { "48g": "48G", sakamichi: "坂道", love: "等爱" };
const seg = (items, cur, attr) => `<span class="seg">${items.map((v) => `<button ${attr}="${v}" aria-checked="${v === L[v]}" >${L[v] || v}</button>`).join("")}</span>`;
const topbar = (title) => `<div class="top"><b>${title}</b><span class="grow"></span>${seg(["7", "16", "40"], "7", "data-z")}<button class="chip">中</button><button class="chip">原版</button></div>`;
const grid = (n = 12) => `<div class="grid">${pool().slice(0, n).map((m) => {
  const i = st.picked.indexOf(m.id);
  return `<div class="mcard ${i >= 0 ? "picked" : ""}">${i >= 0 ? `<span class="rank">${i + 1}</span>` : ""}<button class="info">i</button>
    <div class="ph">${ph(m) ? `<img src="${ph(m)}" loading="lazy" alt="">` : ""}</div>
    <div class="nm">${esc(m.name)}</div><div class="mt">${esc(m.gen)}</div></div>`;
}).join("")}</div>`;
const thumbs = () => `<span class="thumbs">${st.picked.slice(0, 8).map((id) => { const m = flat.find((x) => x.id === id); return `<i>${m ? `<img src="${ph(m)}" alt="">` : ""}</i>`; }).join("")}</span>`;
const P = pool();
st.picked = P.slice(0, 7).map((m) => m.id); // 必须在首次渲染前就绪

// 对决的候选池 = 已选的人（函数声明会提升，渲染在后面也能用）
function PICKED() {
  return st.picked.map((id) => flat.find((m) => m.id === id)).filter(Boolean);
}

const VIEWS = {
  // E 滑选：上下两张脸，滑上去=选上面那张。没有按钮——手势就是全部。
  E: {
    note: "E · 滑选 Swipe：并排 → 上下叠放。手指上滑选上面那张、下滑选下面那张，整页没有按钮；选完自动下一题。挑人页长按卡片看简介。",
    pick: () => topbar("挑人") + grid(12) + `<div class="e-tray">${thumbs()}<span class="count">${st.picked.length}/${st.size}</span></div>`,
    duel: () => `<div class="e-stage"><div class="deck" id="deck"></div>
      <div class="e-hint">上滑选上面那张 · 下滑选下面那张 · 或用 <kbd>↑</kbd><kbd>↓</kbd></div></div>`,
    mount() {
      const deck = document.getElementById("deck");
      const draw = (off = 0, dir = 1) => {
        const S = PICKED(); const a = S[st.step % S.length], b = S[(st.step + 1) % S.length];
        deck.innerHTML = `<div class="e-card" style="transform:translate(${off * 5}%, ${off * -5}%) scale(${1 - Math.abs(off) * .04});opacity:${1 - Math.abs(off) * .5};z-index:2">
            <div class="ph">${ph(a, "full") ? `<img src="${ph(a, "full")}" alt="">` : ""}</div>
            <div class="cap"><b>${esc(a.name)}</b><span>${esc(a.group)} · ${esc(a.gen)}</span></div></div>
          <div class="e-card" style="transform:translate(${(1 - off) * 5}%, ${(1 - off) * -5}%);z-index:1">
            <div class="ph">${ph(b, "full") ? `<img src="${ph(b, "full")}" alt="">` : ""}</div>
            <div class="cap"><b>${esc(b.name)}</b><span>${esc(b.group)} · ${esc(b.gen)}</span></div></div>`;
      };
      draw();
      let y0 = null, off = 0;
      deck.addEventListener("pointerdown", (e) => { y0 = e.clientY; deck.setPointerCapture(e.pointerId); });
      deck.addEventListener("pointermove", (e) => { if (y0 == null) return; off = Math.max(0, Math.min(1, (y0 - e.clientY) / 160 + 0.5)); draw(off); });
      deck.addEventListener("pointerup", (e) => {
        if (y0 == null) return; const d = y0 - e.clientY; y0 = null;
        if (Math.abs(d) > 60) { st.step++; draw(); } else draw();
      });
      deck.addEventListener("click", () => { st.step++; draw(); });
      addEventListener("keydown", (e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") { st.step++; draw(); } });
    },
  },
  // F 锦标赛：一屏两列各 3 张，点一列 = 选那一列的 3 个（选边不选张）。题数大减。
  F: {
    note: "F · 锦标赛 Bracket：不再两两比。一屏两列各 3 张脸，点一列 = 选那一列的 3 个（选边不选张），7 人只需 3 题左右。列头写「已进/淘汰」。",
    pick: () => topbar("挑人") + grid(12) + `<div class="f-foot"><span class="count">已选 ${st.picked.length}/${st.size}</span><button class="primary">开始（${st.size} 人）</button></div>`,
    duel: () => {
      const S = PICKED();
      const half = Math.ceil(S.length / 2), round = st.q % 3;
      const L1 = S.slice(0, half), R1 = S.slice(half, half * 2);
      const cell = (m) => `<div class="fcell"><span class="av">${ph(m) ? `<img src="${ph(m)}" alt="">` : ""}</span><span><b>${esc(m.name)}</b><s>${esc(m.gen)}</s></span></div>`;
      return `<div class="f-wrap"><div class="f-ask">第 ${round + 1} 轮 · 点一列，选这一列的 ${half} 人</div>
        <div class="f-cols">
          <div class="f-col ${round === 0 ? "win" : ""}"><h4><span>左列</span><span>${round === 0 ? "已选" : "淘汰"}</span></h4>${L1.map(cell).join("")}</div>
          <div class="f-col ${round === 1 ? "win" : ""}"><h4><span>右列</span><span>${round === 1 ? "已选" : "淘汰"}</span></h4>${R1.map(cell).join("")}</div>
        </div></div>
        <div class="f-foot"><span class="count">${round + 1}/3 轮 · 预计 30 秒</span><button class="primary">选左列</button><button class="ghost" style="min-height:46px">选右列</button></div>`;
    },
  },
  // G 清单：滚动手动标注（留/划掉），走到底一次性提交。
  G: {
    note: "G · 清单 Checklist：不两两比。一条条往下滚，每人两个按钮：留 / 划掉；走到底部一次性提交。适合「我心里已有答案」的用户。",
    pick: () => topbar("挑人") + grid(12) + `<div class="g-foot"><span class="count">已选 ${st.picked.length}/${st.size}</span><button class="primary">开始</button></div>`,
    duel: () => `<div class="g-list">${PICKED().map((m, i) => `<div class="g-row ${i < 2 ? "in" : ""}">
        <span class="av">${ph(m) ? `<img src="${ph(m)}" alt="">` : ""}</span>
        <span class="meta"><b>${esc(m.name)}</b><s>${esc(m.group)} · ${esc(m.gen)}</s></span>
        <button class="mark">${i < 2 ? "✓" : "✕"}</button></div>`).join("")}</div>
      <div class="g-foot"><span class="count">留 2 / 划掉 5</span><button class="primary">提交这份名单</button></div>`,
  },
  // H 对照长条：上下两条横向轨，同一列并排；点任一张，两侧同步高亮 → 确认。
  H: {
    note: "H · 对照长条 Rail：上下两条横向头像轨，同一列两张脸并排比。点任一张 → 上下同步高亮 → 按「就选这两张」。适合「扫一眼就定」。",
    pick: () => topbar("挑人") + grid(12) + `<div class="f-foot"><span class="count">已选 ${st.picked.length}/${st.size}</span><button class="primary">开始</button></div>`,
    duel: () => {
      const cell = (m, on) => `<div class="h-cell ${on ? "on" : ""}"><div class="ph">${ph(m) ? `<img src="${ph(m)}" alt="">` : ""}</div><div class="nm">${esc(m.name)}</div></div>`;
      const S = PICKED(); const idx = st.step % Math.max(1, S.length - 4);
      return `<div class="h-rails">
        <div class="h-rail-label"><span>上一轮留下的</span><span>滑动查看</span></div>
        <div class="h-rail">${S.slice(0, 4).map((m, i) => cell(m, i === idx)).join("")}</div>
        <div class="h-rail-label"><span>本轮对手</span><span>${st.step + 1}/4</span></div>
        <div class="h-rail">${S.slice(4, 8).map((m, i) => cell(m, i === idx)).join("")}</div></div>
        <div class="h-foot"><span class="count">上面赢 → 留下</span><button class="primary">就选这两张</button></div>`;
    },
  },
};

const v = VIEWS[V] || VIEWS.E;
document.body.innerHTML = `
  <div class="proto-bar"><b>交互范式</b>${["E", "F", "G", "H"].map((k) => `<a href="?variant=${k}&skin=${SKIN}&view=${st.view}" ${k === V ? 'aria-current="true"' : ""}>${k}</a>`).join("")}
    <span class="sp"></span><a href="?variant=${V}&skin=classic&view=${st.view}">原版</a><a href="?variant=${V}&skin=sticker&view=${st.view}">贴纸</a></div>
  <div class="note">${v.note}</div>
  <div class="proto-bar" style="position:static;background:#22242e"><a href="?variant=${V}&skin=${SKIN}&view=pick" ${st.view === "pick" ? 'aria-current="true"' : ""}>挑人页</a><a href="?variant=${V}&skin=${SKIN}&view=duel" ${st.view === "duel" ? 'aria-current="true"' : ""}>核心循环</a></div>
  <div id="app">${st.view === "pick" ? v.pick() : v.duel()}</div>`;
if (st.view !== "pick" && v.mount) v.mount();
document.addEventListener("click", (e) => {
  if (e.target.closest(".f-col, .h-cell, .g-row, .e-tray, .f-foot, .h-foot, .g-foot")) { st.step++; document.getElementById("app").innerHTML = v.duel(); if (v.mount) v.mount(); }
  else if (e.target.closest("[data-z]")) st.size = +e.target.closest("[data-z]").dataset.z;
});
