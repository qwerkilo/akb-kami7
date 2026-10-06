/* 向导模式（v5 A）E2E：先红后绿。用法：node e2e-v5.cjs */
const { spawn } = require("node:child_process");
const { loadPlaywright } = require("./_playwright.cjs");
const { waitForSelector } = require("./_wait.cjs");
const { createChecker } = require("./_check.cjs");
const { chromium } = loadPlaywright();
const ROOT = require("node:path").join(__dirname, "..");
const PORT = 8777;
const BASE = `http://127.0.0.1:${PORT}/`;

// 工单 04 起语言/皮肤收进「更多」浮层（窄屏页头只留一行）
async function openFilterPanel(page) {
  const open = await page
    .$eval(".filter-panel", (el) => el.open)
    .catch(() => true);
  if (!open) {
    await page.click(".filter-trigger");
    await page.waitForTimeout(150);
  }
}

async function openMore(page) {
  const btn = page.locator("#more-btn");
  if (!(await btn.count())) return;
  if (!(await btn.isVisible())) return;
  if ((await btn.getAttribute("aria-expanded")) !== "true") {
    await btn.click();
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

const results = [];
// 回挑人页：步骤条在挑人页可用；对决页收起了步骤条，从「保存并返回」出去
async function goToPick(page) {
  if (await page.isVisible("#back-pick-btn"))
    await page.click("#back-pick-btn");
  else await page.click('#steps [data-step="pick"]');
  await page.waitForTimeout(250);
}

// 就绪屏障 `ready()` 收在 `e2e/_wait.cjs`（原先这里与 e2e.cjs 各一份、语义相同）。

const checker = createChecker({ name: "v5", expect: 54 });
const check = checker.check;

// 预期噪声：favicon、断网阶段的资源失败，以及「导航中断字体预热」这一两百个请求
function isExpectedResourceNoise(m) {
  const text = m.text();
  if (!/Failed to load resource|net::ERR/.test(text)) return false;
  if (/favicon/.test(text)) return true;
  // 「导航中断字体预热（两百多个 woff2）」这类资源错误只认字体域；
  // 其余资源错误仍算失败——别把断言放宽成全放行
  return /fonts\.g/.test(m.location()?.url || "");
}

(async () => {
  const server = spawn(
    "python3",
    [require("node:path").join(__dirname, "serve.py"), String(PORT)],
    {
      cwd: ROOT,
      stdio: "ignore",
    }
  );
  await new Promise((r) => setTimeout(r, 1200));
  const browser = await chromium.launch();
  const page = await browser.newPage({
    // 设备实测：本机（Android 15GB，可用常驻 <3GB）页面首次导航要 15s（正常 ~1s）。
    // Playwright 默认 30s 上限在这里是临界的 → 偶发 goto 超时。调高的是**导航/动作超时**，
    // 没有任何断言被放宽；断言本身仍按结果判定。
    viewport: { width: 420, height: 900 },
    locale: "zh-CN",
  });
  // 设备实测：本机（Android 15GB，可用常驻 <3GB）首次导航要 15s（正常 ~1s），Playwright 默认 30s 上限在这里是临界的 → 偶发 goto 超时。
  // 调高的是**导航/动作超时**，没有任何断言被放宽。
  page.setDefaultNavigationTimeout(120000);
  page.setDefaultTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !isExpectedResourceNoise(m))
      errors.push(m.text());
  });

  try {
    // 这个 context 是新建的、localStorage 本来就是空的 —— 原来的 goto→clear→reload
    // 白跑一次完整加载（实测 v5 30s 里有它一份）。
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(600);

    // 01 步骤条
    check(
      "步骤条三步",
      (await page.locator("#steps [data-step]").count()) === 3
    );
    check(
      "① 当前",
      (await page.getAttribute('#steps [data-step="pick"]', "aria-current")) ===
        "step"
    );
    check("② 初始禁用", await page.isDisabled('#steps [data-step="duel"]'));
    check("③ 初始禁用", await page.isDisabled('#steps [data-step="result"]'));
    check(
      "① 徽章 0/7",
      ((await page.textContent("#step-pick-n")) || "").trim() === "0/7"
    );

    // 02 首屏见脸 + 引导卡
    check(
      "首屏即见卡片",
      (await page.locator("#roster .card").count()) > 0,
      `${await page.locator("#roster .card").count()}`
    );
    check(
      "AKB48 组自动展开",
      (await page.getAttribute(
        '.grp[data-group="AKB48"] .grp-head',
        "aria-expanded"
      )) === "true"
    );
    check("引导卡可见", await page.isVisible("#coach"));
    await page.click('#coach [data-act="coach-ok"]');
    check("引导卡关闭", await page.isHidden("#coach"));
    check(
      "引导卡持久化",
      (await page.evaluate(() => localStorage.getItem("akb:coach:v1"))) === "1"
    );
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(600);
    check("刷新后引导卡不再出现", await page.isHidden("#coach"));

    // 03 进度环 / 覆盖 / 里程碑
    for (let i = 0; i < 3; i++)
      await page.locator("#roster .card").nth(i).click();
    await page.waitForTimeout(150);
    check(
      "进度环 3/7",
      ((await page.textContent("#pick-ring")) || "").trim() === "3/7",
      await page.textContent("#pick-ring")
    );
    const cov = ((await page.textContent("#pick-cov")) || "").trim();
    check(
      "覆盖含 AKB48 3",
      /AKB48/.test(cov) && /3/.test(cov),
      cov.slice(0, 40)
    );
    check(
      "① 徽章 3/7",
      ((await page.textContent("#step-pick-n")) || "").trim() === "3/7"
    );
    for (let i = 3; i < 7; i++)
      await page.locator("#roster .card").nth(i).click();
    await page.waitForTimeout(200);
    check(
      "选满 toast",
      /选满/.test((await page.textContent("#toast")) || ""),
      await page.textContent("#toast")
    );
    // ADR-0019：开始按钮现在带去「筛选」，题数提示搬到了筛选页的提交按钮上
    const startText = ((await page.textContent("#start-btn")) || "").trim();
    check("开始按钮带去筛选", /筛选/.test(startText), startText);
    await page.click("#start-btn");
    await page.waitForTimeout(400);
    const screenGo = ((await page.textContent("#screen-submit")) || "").trim();
    check(
      "筛选未划够时提交按钮禁用",
      await page.isDisabled("#screen-submit"),
      screenGo
    );
    check("筛选门槛文案含「再划」", /再划/.test(screenGo), screenGo);
    await fillScreening(page);
    const screenGo2 = ((await page.textContent("#screen-submit")) || "").trim();
    check(
      "筛选提交按钮含约8题（划 3 个后的层级 [4,3]）",
      /约\s*8\s*题/.test(screenGo2),
      screenGo2
    );
    await page.click('#steps [data-step="pick"]');
    await page.waitForTimeout(250);
    check("② 可点", !(await page.isDisabled('#steps [data-step="duel"]')));

    // 04 说明卡 + 保存提示
    // ADR-0019 改写版：步骤条 ② 先到「筛选」，提交后才进对决（所以 ④ 的说明卡在对决页）
    await page.click('#steps [data-step="duel"]');
    await page.waitForTimeout(350);
    check(
      "② 先到筛选页（不是对决页）",
      (await page.isVisible("#phase-screen")) &&
        !(await page.isVisible("#phase-duel"))
    );
    await passScreening(page);
    await page.waitForTimeout(250);
    check("筛选提交后对决页可见", await page.isVisible("#phase-duel"));
    const badge = ((await page.textContent("#step-duel-n")) || "").trim();
    check("② 分局显示第 N 题徽章", /第 1 题/.test(badge), badge);
    check("说明卡首次可见", await page.isVisible("#duel-intro"));
    const preStep = ((await page.textContent("#duel-step")) || "").trim();
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(320);
    check(
      "说明卡打开时方向键不作答",
      ((await page.textContent("#duel-step")) || "").trim() === preStep,
      preStep
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    check("Esc 关闭说明卡", await page.isHidden("#duel-intro"));
    check("说明卡关闭", await page.isHidden("#duel-intro"));
    check(
      "说明卡持久化",
      (await page.evaluate(() => localStorage.getItem("akb:duelintro:v1"))) ===
        "1"
    );
    check("保存提示可见", await page.isVisible("#duel-saved"));

    // 05 续玩卡
    for (let i = 0; i < 2; i++) {
      await page.click("#fighter-a");
      await page.waitForTimeout(260);
    }
    const stepNow = Number(await page.textContent("#duel-step"));
    await goToPick(page);
    await page.waitForTimeout(250);
    check("① 返回挑人页", await page.isVisible("#phase-pick"));
    const rc = ((await page.textContent("#resume-card")) || "").trim();
    check("续玩卡显示题号", rc.includes(String(stepNow)), rc.slice(0, 60));
    await page.click('#resume-card [data-act="resume-go"]');
    await page.waitForTimeout(250);
    check(
      "继续对决回到原题",
      (await page.isVisible("#phase-duel")) &&
        Number(await page.textContent("#duel-step")) === stepNow
    );

    // 04b 刷新后说明卡不再出现（续玩）
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(600);
    check("刷新后仍在对决", await page.isVisible("#phase-duel"));
    check("续玩不弹说明卡", await page.isHidden("#duel-intro"));

    // 04c 50% 里程碑（8 题的 50% = 第 4 题后）—— 逐题答，边答边看 toast
    let sawHalf = false;
    for (
      let i = 0;
      i < 10 && !(await page.isVisible("#phase-duel")) === false;
      i++
    ) {
      if (!(await page.isVisible("#fighter-a"))) break;
      await page.click("#fighter-a");
      await page.waitForTimeout(250);
      if (/一半/.test((await page.textContent("#toast")) || "")) {
        sawHalf = true;
        break;
      }
    }
    check("50% toast", sawHalf, await page.textContent("#toast"));

    // 05b 放弃
    await goToPick(page);
    await page.waitForTimeout(250);
    await page.click('#resume-card [data-act="resume-drop"]');
    await page.waitForTimeout(200);
    check("放弃后续玩卡消失", await page.isHidden("#resume-card"));

    // 05c 改选清空对决 + 新开对决不弹说明卡
    // ADR-0019 改写版：② 先到筛选页，提交后才进对决
    await page.click('#steps [data-step="duel"]');
    await page.waitForTimeout(300);
    check("② 先进筛选页", await page.isVisible("#phase-screen"));
    await passScreening(page);
    await page.waitForTimeout(200);
    await page.click("#fighter-a");
    await page.waitForTimeout(300);
    await goToPick(page);
    await page.waitForTimeout(250);
    check("新开对决不弹说明卡", await page.isHidden("#duel-intro"));
    check("续玩卡再现", await page.isVisible("#resume-card"));
    const trayBtn = ((await page.textContent("#start-btn")) || "").trim();
    check("对决中托盘按钮 = 继续对决", /继续对决/.test(trayBtn), trayBtn);
    const stepBefore = Number(
      await page.textContent("#step-duel-n").then((x) => x.replace(/\D/g, ""))
    );
    await page.click("#start-btn");
    await page.waitForTimeout(350);
    check(
      "托盘按钮回续到原题号",
      (await page.isVisible("#phase-duel")) &&
        Number(await page.textContent("#duel-step")) === stepBefore,
      `step ${stepBefore}`
    );
    await goToPick(page);
    await page.waitForTimeout(250);
    await page.locator('#roster .card[aria-pressed="true"]').first().click();
    await page.waitForTimeout(300);
    check("改选后对决清空、续玩卡消失", await page.isHidden("#resume-card"));
    await page.locator('#roster .card[aria-pressed="false"]').first().click();
    await page.waitForTimeout(250);

    // 06 结果态导航（ADR-0019 改写版：② 先到筛选页，提交后才进对决）
    await page.click('#steps [data-step="duel"]');
    await page.waitForTimeout(300);
    if (await page.isVisible("#phase-screen")) {
      await passScreening(page);
      await page.waitForTimeout(200);
    }
    for (let i = 0; i < 16; i++) {
      if (await page.isVisible("#phase-result")) break;
      await page.click("#fighter-a");
      await page.waitForTimeout(240);
    }
    check("结果页可见（第三轮）", await page.isVisible("#phase-result"));
    check(
      "③ 结果态可点",
      !(await page.isDisabled('#steps [data-step="result"]'))
    );
    check("结果态 ② 禁用", await page.isDisabled('#steps [data-step="duel"]'));
    await page.click('#steps [data-step="result"]');
    await page.waitForTimeout(300);
    check("③ 进入结果页", await page.isVisible("#phase-result"));
    await goToPick(page);
    await page.waitForTimeout(300);

    // 03b 搜索无结果提示行
    await openFilterPanel(page);
    await page.fill("#search", "zzzzzz");
    await page.waitForTimeout(400);
    const emptyText = ((await page.textContent("#roster")) || "").trim();
    check(
      "无结果提示行（含罗马字指引）",
      /换个关键词/.test(emptyText) && /罗马字/.test(emptyText),
      emptyText.slice(0, 40)
    );
    await openFilterPanel(page);
    await page.fill("#search", "");
    await page.waitForTimeout(350);

    // i18n：EN 步骤条
    await openMore(page);
    await page.click('[data-lang="en"]');
    await page.waitForTimeout(200);
    const enPick = (
      (await page.textContent('#steps [data-step="pick"]')) || ""
    ).trim();
    check("EN 步骤条", /Pick/i.test(enPick), enPick);

    // i18n：日语界面（步骤条 / 副标题 / 搜索提示 / html lang）
    await openMore(page);
    await page.click('[data-lang="ja"]');
    await page.waitForTimeout(250);
    const jaPick = (
      (await page.textContent('#steps [data-step="pick"]')) || ""
    ).trim();
    const jaSub = ((await page.textContent(".sub")) || "").trim();
    const jaLang = await page.getAttribute("html", "lang");
    check("日语步骤条", jaPick.includes("選ぶ"), jaPick);
    check("日语副标题", /歴代メンバー版/.test(jaSub), jaSub);
    check("html lang=ja", jaLang === "ja", jaLang);
    await openFilterPanel(page);
    await page.fill("#search", "zzzzzz");
    await page.waitForTimeout(400);
    const jaEmpty = ((await page.textContent("#roster")) || "").trim();
    check(
      "日语空搜索提示",
      /見つかりませんでした/.test(jaEmpty) && /ローマ字/.test(jaEmpty),
      jaEmpty.slice(0, 40)
    );
    await openFilterPanel(page);
    await page.fill("#search", "");
    await page.waitForTimeout(250);
    await openMore(page);
    await page.click('[data-lang="zh"]');
    await page.waitForTimeout(200);

    // i18n：首次访问按浏览器语言自动选（ja-JP → 日语）
    const jaPage = await browser.newPage({
      viewport: { width: 420, height: 900 },
      locale: "ja-JP",
    });
    await jaPage.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    await jaPage.evaluate(() => localStorage.clear());
    await jaPage.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
    await jaPage.waitForTimeout(600);
    const autoPick = (
      (await jaPage.textContent('#steps [data-step="pick"]')) || ""
    ).trim();
    check(
      "首次访问按浏览器语言选日语",
      autoPick.includes("選ぶ") &&
        (await jaPage.getAttribute("html", "lang")) === "ja",
      autoPick
    );
    await jaPage.close();

    check("无 JS 报错", errors.length === 0, errors.join(" | ").slice(0, 300));
  } catch (e) {
    check("脚本异常", false, String(e).slice(0, 300));
  }
  await browser.close();
  server.kill();
  process.exit(checker.done());
})();
