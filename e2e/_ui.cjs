// 页面操作词汇的唯一出处（第六轮扫描候选 3）。
//
// 此前 e2e.cjs 与 e2e-v5.cjs 各写一份：三个函数逐字节相同（openFilterPanel /
// fillScreening / passScreening）、openMore 写法分叉、goToPick 已真漂移
// （300ms vs 250ms，两边的注释措辞也各写各的）。「同一约定写两遍、改一处就静默失效」——
// 这里的漂移已经发生，所以收成一处。守卫在 test/e2e-source.test.js。
const { waitForSelector } = require("./_wait.cjs");

// 工单 04 起语言/皮肤收进「更多」浮层（窄屏页头只留一行）
async function openMore(page) {
  const btn = page.locator("#more-btn");
  if (!(await btn.count()) || !(await btn.isVisible())) return;
  if ((await btn.getAttribute("aria-expanded")) !== "true") {
    await btn.click();
    await page.waitForTimeout(150);
  }
}

async function openFilterPanel(page) {
  const open = await page
    .$eval(".filter-panel", (el) => el.open)
    .catch(() => true);
  if (!open) {
    await page.click(".filter-trigger");
    await page.waitForTimeout(150);
  }
}

// 筛选是定值门槛：划够一半才给提交（ADR-0019 改写版）
async function fillScreening(page) {
  await waitForSelector(page, "筛选相位", "#phase-screen:not([hidden])", {
    timeout: 5000,
    hard: true,
  });
  const sub = page.locator("#screen-submit");
  let guard = 0;
  while ((await sub.isDisabled()) && guard++ < 60) {
    const btn = page
      .locator('[data-cut][aria-pressed="false"]:not([disabled])')
      .first();
    if ((await btn.count()) === 0) break;
    await btn.click();
    await page.waitForTimeout(60);
  }
}

async function passScreening(page) {
  await fillScreening(page);
  await page.click("#screen-submit");
  await page.waitForTimeout(250);
}

// 回挑人页：步骤条在挑人页可用；对决页收起了步骤条，从「保存并返回」出去
async function goToPick(page) {
  if (await page.isVisible("#back-pick-btn")) {
    await page.click("#back-pick-btn");
  } else {
    await page.click('#steps [data-step="pick"]');
  }
  await page.waitForTimeout(300);
}

/** 首屏判据的数据（页内执行，**无闭包** —— 直接 page.evaluate(firstScreenGeo)）。
 *  托盘顶 + 每张卡的可见区间；只数**可见**的卡：被折叠段里的卡 rect 全 0，会被算成
 *  「完整可见」且给列数添一个 0 列（假绿/假红各一条）。此前这份判据在两个套件里
 *  逐字节各写一遍（e2e.cjs 的 390px 块与 verify-first-screen）。 */
function firstScreenGeo() {
  const trayTop = document.querySelector("#tray").getBoundingClientRect().top;
  const cards = [...document.querySelectorAll(".card")].filter((c) => {
    const x = c.getBoundingClientRect();
    return x.width > 0 && x.height > 0;
  });
  const cols = new Set(
    cards.slice(0, 6).map((c) => Math.round(c.getBoundingClientRect().left))
  ).size;
  const fullFaces = cards.filter((c) => {
    const x = c.getBoundingClientRect();
    return x.top >= 0 && x.bottom <= trayTop + 1;
  }).length;
  return {
    cols,
    fullFaces,
    visible: cards.length,
    firstTop: cards[0] ? Math.round(cards[0].getBoundingClientRect().top) : -1,
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
  };
}

/** 判据：一整行的脸完整可见。visible ≥ 6 是前提 —— 可见卡太少时 cols 会跟着缩水
 *  （自指假绿）。 */
function firstScreenOk(geo) {
  return geo.visible >= 6 && geo.cols > 0 && geo.fullFaces >= geo.cols;
}

module.exports = {
  firstScreenGeo,
  firstScreenOk,
  openMore,
  openFilterPanel,
  fillScreening,
  passScreening,
  goToPick,
};
