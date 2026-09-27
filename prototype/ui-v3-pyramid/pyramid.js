/* 原型共享逻辑：金字塔渲染 + 选中/简介交互（四版仅行分布不同） */
(function () {
  "use strict";

  const SECTIONS = window.AKB_GROUPS || [];
  const POOL = [];
  for (const sec of SECTIONS) {
    if (sec.group !== "AKB48") continue;
    for (const m of sec.members) {
      POOL.push({ ...m, gen: sec.label, grp: sec.group });
    }
  }
  const TOP32 = POOL.slice(0, 32);
  const DEMO_NAMES = [
    "大島優子", "前田敦子", "板野友美", "高橋みなみ",
    "小嶋陽菜", "篠田麻里子", "渡辺麻友", "柏木由紀",
  ];
  const DEMO = DEMO_NAMES.map((n) => POOL.find((m) => m.name === n)).filter(Boolean);
  const EXTRA = { name: "大谷映美里", gen: "等爱示例" };

  const BIOS = {
    大島優子: [
      ["生年月日", "1988/10/17"],
      ["出身地", "栃木県"],
      ["身長 / 血型", "152cm / B型"],
    ],
    前田敦子: [
      ["生年月日", "1991/7/10"],
      ["出身地", "千葉県"],
    ],
    板野友美: [
      ["生年月日", "1991/7/3"],
      ["出身地", "神奈川県"],
    ],
    高橋みなみ: [
      ["生年月日", "1991/4/8"],
      ["出身地", "東京都"],
    ],
    小嶋陽菜: [
      ["生年月日", "1988/4/19"],
      ["出身地", "埼玉県"],
    ],
    篠田麻里子: [
      ["生年月日", "1986/3/11"],
      ["出身地", "福岡県"],
    ],
    渡辺麻友: [
      ["生年月日", "1994/3/26"],
      ["出身地", "埼玉県"],
    ],
    柏木由紀: [
      ["生年月日", "1991/7/15"],
      ["出身地", "熊本県"],
    ],
    大谷映美里: [
      ["生年月日", "1998/3/15"],
      ["出身地", "東京都"],
      ["身長 / 血型", "155cm / O型"],
      ["星座", "うお座"],
      ["趣味", "メイクやファッション、ラーメン巡り"],
      ["特技", "ジョッキ持ち"],
    ],
  };

  const rows = (document.body.dataset.rows || "1,3,5,7,9,7")
    .split(",")
    .map(Number);
  const weights = rows.map((_, i) => 1.45 - i * 0.12);

  const thumb = (m) =>
    m.img === false
      ? null
      : `../../img/thumb/${m.id}.webp`;

  function renderPyramid() {
    const box = document.getElementById("pyramid");
    const totalW = box.clientWidth;
    const totalH = box.clientHeight;
    const weightSum = weights.reduce((a, b) => a + b, 0);
    let idx = 0;
    const frag = document.createDocumentFragment();
    rows.forEach((n, r) => {
      const rowH = (totalH * weights[r]) / weightSum;
      const gap = 3;
      const cellW = Math.min(
        (totalW - gap * (n - 1)) / n,
        rowH * 0.86
      );
      const row = document.createElement("div");
      row.className = "row";
      for (let i = 0; i < n; i++) {
        const m = TOP32[idx] || {};
        const cell = document.createElement("div");
        cell.className = "cell" + (idx < 3 ? " top" : "");
        cell.style.width = `${cellW}px`;
        const src = thumb(m);
        cell.innerHTML =
          (src
            ? `<img src="${src}" alt="" loading="lazy">`
            : `<span class="ph"></span>`) +
          `<span class="rk">${idx + 1}</span>` +
          (cellW >= 46
            ? `<span class="nm">${m.name || ""}</span><span class="sb">${m.gen || ""}</span>`
            : "");
        row.appendChild(cell);
        idx++;
      }
      frag.appendChild(row);
    });
    box.innerHTML = "";
    box.appendChild(frag);
  }

  function renderDemo() {
    const box = document.getElementById("pick");
    const cards = DEMO.map((m, i) =>
      m.img === false
        ? `<div class="pcard" data-i="${i}">
            <span class="ph" style="width:100%;aspect-ratio:3/4;border:2px solid var(--ink);border-radius:10px;display:grid;place-items:center;font-family:var(--font-display);background:#e4e7ee">${m.name.charAt(0)}</span>
            <span class="order"></span>
            <span class="info" role="button" aria-label="查看简介">i</span>
            <div class="pnm">${m.name}</div>
          </div>`
        : `<div class="pcard" data-i="${i}">
            <img src="../../img/thumb/${m.id}.webp" alt="">
            <span class="order"></span>
            <span class="info" role="button" aria-label="查看简介">i</span>
            <div class="pnm">${m.name}</div>
          </div>`
    );
    cards.push(`<div class="pcard" data-i="${DEMO.length}">
        <span class="ph" style="width:100%;aspect-ratio:3/4;border:2px solid var(--ink);border-radius:10px;display:grid;place-items:center;font-family:var(--font-display);background:var(--lilac)">${EXTRA.name.charAt(0)}</span>
        <span class="order"></span>
        <span class="info" role="button" aria-label="查看简介">i</span>
        <div class="pnm">${EXTRA.name}<small>（${EXTRA.gen}）</small></div>
      </div>`);
    box.innerHTML = cards.join("");
  }

  let selected = [];
  const countEl = document.getElementById("count");
  function paint() {
    countEl.textContent = `已选 ${selected.length} / 7`;
    document.querySelectorAll(".pcard").forEach((el) => {
      const i = selected.indexOf(+el.dataset.i);
      el.classList.toggle("sel", i >= 0);
      el.querySelector(".order").textContent = i + 1;
    });
  }

  function openSheet(i) {
    const m = i === DEMO.length ? EXTRA : DEMO[i];
    if (!m) return;
    let name = m.name;
    let kana = m.kana || "";
    let rows = BIOS[name];
    if (!rows) {
      rows = [
        ["团体", m.grp || "—"],
        ["期生", m.gen || "—"],
        ["状态", m.status === "former"
          ? `卒業${m.end ? " · " + m.end.slice(0, 4) : ""}`
          : "现役"],
        ["昵称", m.nick || "—"],
      ];
    }
    const sheet = document.getElementById("sheet");
    sheet.innerHTML =
      `<button class="close" aria-label="关闭">×</button>
       <h3>${name}</h3>
       <p class="kana">${kana}</p>
       <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`;
    sheet.hidden = false;
    sheet.querySelector(".close").onclick = () => (sheet.hidden = true);
  }

  document.getElementById("pick").addEventListener("click", (e) => {
    const info = e.target.closest(".info");
    const card = e.target.closest(".pcard");
    if (!card) return;
    if (info) return openSheet(+card.dataset.i);
    const i = +card.dataset.i;
    const at = selected.indexOf(i);
    if (at >= 0) selected.splice(at, 1);
    else if (selected.length < 7) selected.push(i);
    paint();
  });

  document.getElementById("clear").addEventListener("click", () => {
    if (selected.length && window.confirm("清空已选？")) {
      selected = [];
      paint();
    }
  });

  window.addEventListener("resize", renderPyramid);
  renderPyramid();
  renderDemo();
  paint();
})();
