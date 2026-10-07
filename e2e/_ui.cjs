// 页面操作词汇的唯一出处（第六轮扫描候选 3）。
//
// 此前 e2e.cjs 与 e2e-v5.cjs 各写一份：三个函数逐字节相同（openFilterPanel /
// fillScreening / passScreening）、openMore 写法分叉、goToPick 已真漂移
// （300ms vs 250ms，注释也只有一边）。「同一约定写两遍、改一处就静默失效」——
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

module.exports = {
  openMore,
  openFilterPanel,
  fillScreening,
  passScreening,
  goToPick,
};
