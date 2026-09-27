/* 原型共享逻辑：选人网格 + 简介卡（四种皮肤共用同一 DOM，差异全在 CSS；标签随页面语言 zh/en） */
(function () {
  "use strict";

  const L = {
    zh: {
      birth: "生年月日",
      age: "年龄",
      from: "出身地",
      height: "身長",
      blood: "血液型",
      sign: "星座",
      hobby: "趣味",
      skill: "特技",
      nick: "昵称",
      group: "团体",
      gen: "期生",
      status: "状态",
      grad: (y) => `卒業 ${y}`,
      current: "现役",
      romaji: "罗马字",
    },
    en: {
      birth: "Date of birth",
      age: "Age",
      from: "Hometown",
      height: "Height",
      blood: "Blood type",
      sign: "Zodiac",
      hobby: "Hobbies",
      skill: "Skills",
      nick: "Nickname",
      group: "Group",
      gen: "Generation",
      status: "Status",
      grad: (y) => `Graduated ${y}`,
      current: "Active",
      romaji: "Romaji",
    },
  };

  const MEMBERS = {
    大島優子: { kana: "おおしま ゆうこ", nick: "ゆうこ", birth: "1988/10/17", from: "栃木県", gen: "2期生", grad: "2014/6/9" },
    前田敦子: { kana: "まえだ あつこ", nick: "あっちゃん", birth: "1991/7/10", from: "千葉県", gen: "1期生", grad: "2012/8/27" },
    板野友美: { kana: "いたの ともみ", nick: "ともちん", birth: "1991/7/3", from: "神奈川県", gen: "1期生", grad: "2013/8/27" },
    高橋みなみ: { kana: "たかはし みなみ", nick: "たかみな", birth: "1991/4/8", from: "東京都", gen: "1期生", grad: "2016/4/8" },
    小嶋陽菜: { kana: "こじま はるな", nick: "こじはる", birth: "1988/4/19", from: "埼玉県", gen: "1期生", grad: "2017/4/19" },
    篠田麻里子: { kana: "しのだ まりこ", nick: "まりこ", birth: "1986/3/11", from: "福岡県", gen: "1.5期生", grad: "2013/7/22" },
    渡辺麻友: { kana: "わたなべ まゆ", nick: "まゆゆ", birth: "1994/3/26", from: "埼玉県", gen: "3期生", grad: "2017/12/31" },
    柏木由紀: { kana: "かしわぎ ゆき", nick: "ゆきりん", birth: "1991/7/15", from: "鹿児島県", gen: "3期生", grad: "2024/4/30" },
    大谷映美里: {
      kana: "おおたに えみり",
      romaji: "OTANI EMIRI",
      nick: "みりにゃ",
      birth: "1998/3/15",
      from: "東京都",
      height: "155cm",
      blood: "O型",
      sign: "うお座",
      hobby: "メイクやファッションを楽しむこと、ラーメン巡り",
      skill: "ジョッキ持ち",
      gen: "1期生",
      current: true,
    },
  };

  const SECTIONS = window.AKB_GROUPS || [];
  const POOL = [];
  for (const sec of SECTIONS) {
    if (sec.group !== "AKB48") continue;
    for (const m of sec.members) POOL.push({ ...m, grp: sec.group });
  }
  const DEMO = Object.keys(MEMBERS)
    .filter((n) => n !== "大谷映美里")
    .map((n) => POOL.find((m) => m.name === n) || { name: n });

  let lang = "zh";

  function ageOn(birth) {
    const [y, m, d] = birth.split("/").map(Number);
    const now = new Date(2026, 8, 27);
    let a = now.getFullYear() - y;
    if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a--;
    return a;
  }

  function rowsOf(m) {
    const t = L[lang];
    const r = [];
    const push = (k, v) => v && r.push([k, v]);
    push(t.birth, m.birth);
    push(t.age, m.birth ? String(ageOn(m.birth)) : "");
    push(t.from, m.from);
    push(t.height, m.height);
    push(t.blood, m.blood);
    push(t.sign, m.sign);
    push(t.hobby, m.hobby);
    push(t.skill, m.skill);
    push(t.nick, m.nick);
    push(t.group, m.grp);
    push(t.gen, m.gen);
    if (m.grad) push(t.status, t.grad(m.grad.slice(0, 4)));
    else if (m.current) push(t.status, t.current);
    push(t.romaji, m.romaji);
    return r;
  }

  function fillSheet(m, photoId) {
    const sheet = document.getElementById("sheet");
    const photo = sheet.querySelector("#s-photo");
    photo.src = photoId ? `../../img/thumb/${photoId}.webp` : "";
    photo.style.display = photoId ? "" : "none";
    sheet.querySelector("#s-name").textContent = m.name;
    sheet.querySelector("#s-kana").textContent = m.kana || "";
    sheet.querySelector("#s-badge").textContent = m.grp ? "PROFILE · 48pedia" : "=LOVE · 等爱示例";
    sheet.querySelector("#s-fields").innerHTML = rowsOf(m)
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
      .join("");
  }

  function render() {
    const pick = document.getElementById("pick");
    pick.innerHTML =
      DEMO.map(
        (m, i) =>
          `<div class="pcard" data-i="${i}"><img src="../../img/thumb/${m.id}.webp" alt="">
            <span class="info" role="button" aria-label="查看简介">i</span>
            <div class="pnm">${m.name}</div></div>`
      ).join("") +
      `<div class="pcard" data-i="${DEMO.length}"><span class="ph">大</span>
        <span class="info" role="button" aria-label="查看简介">i</span>
        <div class="pnm">大谷映美里<small>（等爱）</small></div></div>`;
  }

  let lastIndex = null;
  function open(i) {
    lastIndex = i;
    const name = i === DEMO.length ? "大谷映美里" : DEMO[i].name;
    const m = { ...MEMBERS[name], name, grp: i === DEMO.length ? null : "AKB48" };
    fillSheet(m, i === DEMO.length ? null : DEMO[i].id);
    document.getElementById("sheet").hidden = false;
  }

  document.getElementById("pick").addEventListener("click", (e) => {
    const card = e.target.closest(".pcard");
    if (card && e.target.closest(".info")) open(+card.dataset.i);
  });
  document.addEventListener("click", (e) => {
    const sheet = document.getElementById("sheet");
    if (sheet.hidden) return;
    if (e.target.closest(".close")) {
      sheet.hidden = true;
      return;
    }
    if (
      e.target.closest(".sheet") ||
      e.target.closest(".info") ||
      e.target.closest(".lang")
    )
      return;
    sheet.hidden = true;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") document.getElementById("sheet").hidden = true;
  });

  document.querySelectorAll(".lang button").forEach((b) => {
    b.addEventListener("click", () => {
      lang = b.dataset.lang;
      document.querySelectorAll(".lang button").forEach((x) => x.classList.toggle("on", x === b));
      if (lastIndex != null && !document.getElementById("sheet").hidden) open(lastIndex);
    });
  });

  render();
})();
