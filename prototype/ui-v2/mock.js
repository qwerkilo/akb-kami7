// 原型共享数据与渲染（throwaway，不进入生产代码）
const MEMBERS48 = [
  {
    id: "m3dbe559b39",
    name: "前田敦子",
    group: "AKB48",
    gen: "1期生",
    status: "former",
  },
  {
    id: "m3ba08e033b",
    name: "大島優子",
    group: "AKB48",
    gen: "2期生",
    status: "former",
  },
  {
    id: "m64c32528f0",
    name: "渡辺麻友",
    group: "AKB48",
    gen: "3期生",
    status: "former",
  },
  {
    id: "m4ff5e7f3b7",
    name: "柏木由紀",
    group: "AKB48",
    gen: "3期生",
    status: "former",
  },
  {
    id: "mdd6413e287",
    name: "横山由依",
    group: "AKB48",
    gen: "9期生",
    status: "former",
  },
  {
    id: "m19d40a15c4",
    name: "小栗有以",
    group: "AKB48",
    gen: "Team 8",
    status: "current",
  },
  {
    id: "m14a7951a65",
    name: "岩立沙穂",
    group: "AKB48",
    gen: "13期生",
    status: "current",
  },
  {
    id: "m81dc04e6ca",
    name: "福岡聖菜",
    group: "AKB48",
    gen: "15期生",
    status: "current",
  },
  {
    id: "m2267bb69ab",
    name: "松井珠理奈",
    group: "SKE48",
    gen: "1期生",
    status: "former",
  },
  {
    id: "m45b82862d7",
    name: "井田玲音名",
    group: "SKE48",
    gen: "6期生",
    status: "current",
  },
  {
    id: "ma9daaad492",
    name: "鎌田菜月",
    group: "SKE48",
    gen: "6期生",
    status: "current",
  },
  {
    id: "m6fdb66051f",
    name: "山本彩",
    group: "NMB48",
    gen: "1期生",
    status: "former",
  },
  {
    id: "m13bc25e59a",
    name: "新澤菜央",
    group: "NMB48",
    gen: "6期生",
    status: "current",
  },
  {
    id: "m0799de42e7",
    name: "平山真衣",
    group: "NMB48",
    gen: "7期生",
    status: "current",
  },
  {
    id: "mb259d958cc",
    name: "宮脇咲良",
    group: "HKT48",
    gen: "1期生",
    status: "former",
  },
  {
    id: "m8fc71b5ebc",
    name: "指原莉乃",
    group: "HKT48",
    gen: "兼任・移籍加入",
    status: "former",
  },
  {
    id: "m8001f5be2e",
    name: "秋吉優花",
    group: "HKT48",
    gen: "2期生",
    status: "current",
  },
  {
    id: "maedb528cc1",
    name: "渕上舞",
    group: "HKT48",
    gen: "2期生",
    status: "current",
  },
  {
    id: "md60b1c7253",
    name: "清司麗菜",
    group: "NGT48",
    gen: "1期生",
    status: "current",
  },
  {
    id: "mc316ddad6e",
    name: "大塚七海",
    group: "NGT48",
    gen: "2期生",
    status: "current",
  },
  {
    id: "mc5ecf3e477",
    name: "甲斐心愛",
    group: "STU48",
    gen: "1期生",
    status: "current",
  },
  {
    id: "m8c13b7ac30",
    name: "谷口茉妃菜",
    group: "STU48",
    gen: "1期生",
    status: "current",
  },
];

const MEMBERS_SAKA = [
  { name: "齋藤飛鳥", group: "乃木坂46", gen: "1期生", status: "former" },
  { name: "山下美月", group: "乃木坂46", gen: "3期生", status: "former" },
  { name: "遠藤さくら", group: "乃木坂46", gen: "4期生", status: "current" },
  { name: "賀喜遥香", group: "乃木坂46", gen: "4期生", status: "current" },
  { name: "森田ひかる", group: "櫻坂46", gen: "2期生", status: "current" },
  { name: "山﨑天", group: "櫻坂46", gen: "2期生", status: "current" },
  { name: "藤吉夏鈴", group: "櫻坂46", gen: "2期生", status: "current" },
  { name: "小坂菜緒", group: "日向坂46", gen: "2期生", status: "current" },
  { name: "金村美玖", group: "日向坂46", gen: "2期生", status: "current" },
  { name: "齊藤京子", group: "日向坂46", gen: "1期生", status: "former" },
  { name: "加藤史帆", group: "日向坂46", gen: "1期生", status: "former" },
  { name: "佐々木久美", group: "日向坂46", gen: "1期生", status: "current" },
];

const MOCK = {
  series: "48g",
  size: 7,
  selected: ["m3dbe559b39", "m19d40a15c4", "m2267bb69ab", "m6fdb66051f"],
};

function mockData() {
  return MOCK.series === "48g" ? MEMBERS48 : MEMBERS_SAKA;
}

function mockAvatar(m, cls) {
  if (m.id) {
    return `<span class="ph ${cls || ""}"><img src="../../img/thumb/${m.id}.webp" alt="" loading="lazy"></span>`;
  }
  const hue = [...m.name].reduce(
    (h, c) => (h * 31 + c.codePointAt(0)) % 360,
    7
  );
  return `<span class="ph ${cls || ""}"><span class="avatar-ph" style="--h:${hue}">${m.name[0]}</span></span>`;
}

function mockCard(m) {
  const on = MOCK.selected.includes(m.id);
  const meta = m.status === "current" ? "现役" : `${m.group} · 毕业`;
  return `<button class="card" data-id="${m.id || m.name}" aria-pressed="${on}">
    ${mockAvatar(m)}
    <span class="nm">${m.name}</span>
    <span class="meta">${meta}</span>
  </button>`;
}

function mockGroups() {
  const out = [];
  for (const m of mockData()) {
    let g = out.find((x) => x.group === m.group);
    if (!g) out.push((g = { group: m.group, items: [] }));
    g.items.push(m);
  }
  return out;
}

function renderMockRoster(el) {
  el.innerHTML = mockGroups()
    .map(
      (g) =>
        `<section class="grp-block"><h3 class="grp-name">${g.group}<span>${g.items.length}</span></h3>
         <div class="cards">${g.items.map(mockCard).join("")}</div></section>`
    )
    .join("");
}

function renderMockTray(el) {
  const slots = [];
  for (let i = 0; i < MOCK.size; i++) {
    const m = mockData().find((x) => x.id && x.id === MOCK.selected[i]);
    slots.push(
      m
        ? `<li class="slot">${mockAvatar(m)}</li>`
        : `<li class="slot empty">${i + 1}</li>`
    );
  }
  el.innerHTML = slots.join("");
  const count = el.parentElement.querySelector(".tray-count");
  if (count) count.textContent = `${MOCK.selected.length} / ${MOCK.size}`;
}

function renderMockPoster(el) {
  const data = mockData();
  const cells = [];
  for (let i = 0; i < MOCK.size; i++) {
    const m = data[i % data.length];
    const rank =
      i < 3
        ? `<span class="rank r${i + 1}">${i + 1}</span>`
        : `<span class="rank">${i + 1}</span>`;
    cells.push(
      `<div class="poster-cell">${rank}${mockAvatar(m)}<span class="pnm">${m.name}</span></div>`
    );
  }
  el.innerHTML = cells.join("");
  el.style.setProperty(
    "--cols",
    MOCK.size === 32 ? 8 : MOCK.size === 16 ? 4 : 4
  );
}

function initMock(root) {
  const roster = root.querySelector("[data-mock-roster]");
  const tray = root.querySelector("[data-mock-tray]");
  const poster = root.querySelector("[data-mock-poster]");
  const paint = () => {
    renderMockRoster(roster);
    renderMockTray(tray);
    renderMockPoster(poster);
    root
      .querySelectorAll("[data-series]")
      .forEach((b) =>
        b.classList.toggle("on", b.dataset.series === MOCK.series)
      );
    root
      .querySelectorAll("[data-size]")
      .forEach((b) =>
        b.classList.toggle("on", Number(b.dataset.size) === MOCK.size)
      );
  };
  root.querySelectorAll("[data-series]").forEach((b) =>
    b.addEventListener("click", () => {
      MOCK.series = b.dataset.series;
      MOCK.selected = MOCK.selected.filter((id) =>
        mockData().some((m) => m.id === id)
      );
      paint();
    })
  );
  root.querySelectorAll("[data-size]").forEach((b) =>
    b.addEventListener("click", () => {
      MOCK.size = Number(b.dataset.size);
      MOCK.selected = MOCK.selected.slice(0, MOCK.size);
      paint();
    })
  );
  root.addEventListener("click", (e) => {
    const card = e.target.closest(".card");
    if (!card || !card.dataset.id) return;
    const id = card.dataset.id;
    const i = MOCK.selected.indexOf(id);
    if (i >= 0) MOCK.selected.splice(i, 1);
    else if (MOCK.selected.length < MOCK.size) MOCK.selected.push(id);
    paint();
  });
  paint();
}
