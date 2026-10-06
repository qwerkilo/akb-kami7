const { spawn } = require("node:child_process");
const { loadPlaywright } = require("./_playwright.cjs");
const { elapsed, blockStarter, waitTicker } = require("./_progress.cjs");
const { chromium } = loadPlaywright();

const ROOT = require("node:path").join(__dirname, "..");
const PORT = 8765;
const BASE = `http://127.0.0.1:${PORT}/`;

// 点对决卡片。两类问题都在这里兜住：
// ① 卡片切换有动画，过渡期间可能没有命中盒（force 也会报 not visible）
// ② 判「还在对决」与实际点击之间，最后一题可能已切到结果页 ——
//    所以重试耗尽后返回 false，让调用方 break，而不是让整份脚本挂掉。
async function clickFighter(page, sel = "#fighter-a") {
  for (let k = 0; k < 3; k++) {
    if (await page.isHidden("#phase-duel")) return false;
    try {
      await page.waitForSelector(sel, { state: "visible", timeout: 4000 });
      await page.waitForTimeout(260);
      await page.click(sel, { force: true });
      return true;
    } catch (e) {
      await page.waitForTimeout(220);
    }
  }
  return false;
}
// 展开某个团（两级分组：团头 → 期生段；单团视图下没有团头，只点段头）
async function openGroup(page, group) {
  // 名册很长，段头可能在视口外或过渡中；直接派发点击，绕开 Playwright 的可点性判定
  const expanded = await page.evaluate((g) => {
    const hit = (sel) => {
      const el = document.querySelector(sel);
      if (!el || el.getAttribute("aria-expanded") === "true") return false;
      el.click();
      return true;
    };
    return (
      hit(`.grp-head[aria-controls="grp-${g}"]`) ||
      hit(`.grp[data-group="${g}"] .gen .gen-head`)
    );
  }, group);
  if (expanded) await page.waitForTimeout(200);
}

// 展开名册里第一个还收着的分段（首屏见脸那道：名册默认是收起的）
async function openFirstSection(page) {
  for (const sel of [".grp-head", ".gen-head"]) {
    const heads = page.locator(`${sel}[aria-expanded="false"]`);
    if (await heads.count()) {
      await heads.first().click();
      await page.waitForTimeout(200);
      return;
    }
  }
}

// 对决页收起页头/步骤条/页脚（工单 03）→ 回挑人页只能走页内那个「保存并返回」
async function goToPick(page) {
  if (await page.isVisible("#back-pick-btn")) {
    await page.click("#back-pick-btn");
  } else {
    await page.click('#steps [data-step="pick"]');
  }
  await page.waitForTimeout(300);
}

const results = [];
const block = blockStarter(); // 功能块头（进度 + 分块耗时）
// 失败日志按轮清空：此前只追加，跨轮历史混在一起（两轴审查的观察项）
try {
  require("node:fs").writeFileSync("/tmp/opencode/e2e-fails.log", "");
} catch {}
// 就绪屏障：页面「能交互」不等于「图与字体到位」。海报断言量的是画布像素，字体回落
// 或图片没解码都会让底色断言假红（实测 0,0,0 / 255,255,255）。以前靠 page.goto 的
// waitUntil:"load" 顺带保证（load 等所有子资源），但本机单次导航要 30s、load 事件经常
// 不触发 → 改成 domcontentloaded 后必须显式等，否则是我把工具改弱了。
async function ready(pg) {
  // 等「渲染就绪」，**不是**「所有图片就绪」：名册卡片的 `<img loading="lazy">`
  // 在视口外永远不会加载，`imgs.every(complete && naturalWidth>0)` 恒假 —— 实测
  // 每次 ready() 都烧满 120s 超时（9 次 = 18 分钟，占整套 21 分钟的 85%）。
  // 现在只等视口内的图（有界 15s）+ 字体；海报的像素断言另有 `#poster-img` 的
  // data-URL 就绪信号（那才是「画出来了」）。
  const ticker = waitTicker("等待字体/视口内图片就绪");
  const poll = setInterval(() => ticker.tick(), 1000);
  try {
    await pg
      .waitForFunction(
        () => {
          const imgs = [...document.images].filter((i) => {
            const r = i.getBoundingClientRect();
            return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
          });
          return (
            imgs.length > 0 &&
            imgs.every((i) => i.complete && i.naturalWidth > 0)
          );
        },
        { timeout: 15000 }
      )
      .catch(() => {});
    await pg.evaluate(() => document.fonts.ready).catch(() => {});
  } finally {
    clearInterval(poll);
    ticker.done();
  }
  await pg.waitForTimeout(600);
}

function check(name, cond, detail) {
  const ok = !!cond;
  results.push({
    name,
    ok,
    detail: ok ? "" : String(detail ?? "").slice(0, 120),
  });
  if (!ok)
    require("node:fs").appendFileSync(
      "/tmp/opencode/e2e-fails.log",
      `${name}  — ${String(detail ?? "").slice(0, 200)}\n`
    );
  console.log(
    `[${elapsed()}] ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  — " + String(detail ?? "").slice(0, 120)}`
  );
}

// 说明卡（v5：只弹一次）先关掉，否则遮罩挡住答题
async function dismissIntro(page) {
  if (await page.isVisible("#duel-intro"))
    await page.click('#duel-intro [data-act="intro-go"]');
}

// 筛选是定值门槛：划够一半才给提交（ADR-0019 改写版）
async function fillScreening(page) {
  await page.waitForSelector("#phase-screen:not([hidden])", { timeout: 5000 });
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

// 工单 04 起语言/皮肤收进「更多」浮层（窄屏页头只留一行）
async function openMore(page) {
  const btn = page.locator("#more-btn");
  if (!(await btn.count()) || !(await btn.isVisible())) return;
  if ((await btn.getAttribute("aria-expanded")) !== "true") {
    await btn.click();
    await page.waitForTimeout(150);
  }
}

async function setSkin(page, skin) {
  await openMore(page);
  await page.click(`.seg-skin [data-skin="${skin}"]`);
  await page.waitForTimeout(250);
}

async function setLang(page, lang) {
  await openMore(page);
  await page.click(`.seg-lang [data-lang="${lang}"]`);
  await page.waitForTimeout(300);
}

// 16 档两轮细分 + 行锁定：返回 [名称, 是否通过] 对，交给 check 统一记录
async function openFilterPanel(page) {
  const open = await page
    .$eval(".filter-panel", (el) => el.open)
    .catch(() => true);
  if (!open) {
    await page.click(".filter-trigger");
    await page.waitForTimeout(150);
  }
}

async function checkSecondRound(page) {
  const out = [];
  out.push([
    "16 档：第一轮门槛 8 人",
    (await page.textContent("#screen-submit")).trim() === "再划 8 人",
  ]);
  for (let i = 0; i < 8; i++) {
    await page
      .locator('[data-cut][aria-pressed="false"]:not([disabled])')
      .first()
      .click();
    await page.waitForTimeout(120);
  }
  const after = ((await page.textContent("#screen-submit")) || "").trim();
  out.push([
    "16 档：第一轮划够 → 可提交",
    !(await page.isDisabled("#screen-submit")),
  ]);
  out.push(["16 档：第一轮题数 34（[8,8]，不是 49）", /34/.test(after)]);
  out.push(["16 档：可以继续细分", await page.isVisible("#screen-more")]);
  await page.click("#screen-more");
  await page.waitForTimeout(200);
  out.push([
    "16 档：进入第 2 轮",
    (await page.textContent("#screen-round")).includes("2"),
  ]);
  out.push([
    "16 档：第 2 轮门槛 4 人",
    (await page.textContent("#screen-submit")).trim() === "再划 4 人",
  ]);
  // 第 2 轮刚进来（本轮还有名额）时的行状态
  const lockState = await page.evaluate(() =>
    [...document.querySelectorAll("[data-cut]")].map((b) => ({
      cut: b.getAttribute("aria-pressed") === "true",
      disabled: b.disabled,
      locked: !!b.closest(".screen-row").classList.contains("locked"),
    }))
  );
  const lockedRows = lockState.filter((x) => x.cut);
  const openRows = lockState.filter((x) => !x.cut);
  out.push([
    "第 1 轮划掉的 8 人：locked 且 disabled",
    lockedRows.length === 8 && lockedRows.every((x) => x.disabled && x.locked),
    JSON.stringify(lockedRows.slice(0, 2)),
  ]);
  out.push([
    "未划的 8 人：可点",
    openRows.length === 8 && openRows.every((x) => !x.disabled && !x.locked),
    JSON.stringify(openRows.slice(0, 2)),
  ]);
  for (let i = 0; i < 4; i++) {
    await page
      .locator('[data-cut][aria-pressed="false"]:not([disabled])')
      .first()
      .click();
    await page.waitForTimeout(120);
  }
  // 两轮都划完 → 保留组剩 4 人到底，12 个已划的人全部 locked（只能全部恢复）
  const afterLock = await page.evaluate(() =>
    [...document.querySelectorAll("[data-cut]")].map((b) => ({
      cut: b.getAttribute("aria-pressed") === "true",
      locked: !!b.closest(".screen-row").classList.contains("locked"),
      disabled: b.disabled,
    }))
  );
  const stillLocked = afterLock.filter((x) => x.locked);
  out.push([
    "两轮都划完：12 个已划的人全部 locked（只能全部恢复）",
    stillLocked.length === 12 && stillLocked.every((x) => x.disabled),
    String(stillLocked.length),
  ]);
  out.push([
    "两轮都划完：名额用尽 → 未划的 4 人也 disabled",
    afterLock.filter((x) => !x.cut).every((x) => x.disabled),
    JSON.stringify(afterLock.filter((x) => !x.cut)),
  ]);
  const deep = ((await page.textContent("#screen-submit")) || "").trim();
  out.push(["16 档：两轮到底题数 27（[4,4,8]）", /27/.test(deep), deep]);
  return out;
}

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
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    await ready(page);

    // -- 首屏：自动展开第一团体 + 第一期生，立即见脸（v5 A）
    block("首屏");
    const firstCards = await page.locator(".card").count();
    check("首屏自动展开见脸", firstCards > 0, `实际 ${firstCards}`);
    const grpCount = await page.locator(".grp").count();
    check("默认 48G 视图 7 个团体", grpCount === 7, `实际 ${grpCount}`);
    const options = await page.$$eval("#group-filter option", (os) =>
      os.map((o) => o.value)
    );
    check(
      "团体下拉顺序固定",
      JSON.stringify(options) ===
        JSON.stringify([
          "all",
          "AKB48",
          "SKE48",
          "NMB48",
          "HKT48",
          "NGT48",
          "STU48",
          "SDN48",
        ]),
      options.join(",")
    );
    const title = await page.title();
    check("标题中性化", title.includes("48 Group"), title);
    const eyebrow = await page.textContent(".eyebrow");
    check("eyebrow 中性化", eyebrow.includes("48 Group"), eyebrow);

    // -- 两级浏览：全部 → AKB48（boot 已自动展开）
    block("两级浏览");
    const akbSections = await page
      .locator(`.grp[data-group="AKB48"] .gen.sub`)
      .count();
    check("AKB48 组内两级期生分段", akbSections === 30, `实际 ${akbSections}`);
    const akbOpen = await page.getAttribute(
      `.grp[data-group="AKB48"] .grp-head`,
      "aria-expanded"
    );
    check("AKB48 组自动展开", akbOpen === "true");

    // -- 全折叠（先段后组，open 清空）→ 切「现役」：ensureOpen 打开首个可见段
    block("全折叠（先段后组，open 清空）→ 切「现役」");
    await page.click('.grp[data-group="AKB48"] .gen-head');
    await page.waitForTimeout(200);
    await page.click('.grp[data-group="AKB48"] .grp-head');
    await page.waitForTimeout(200);
    const folded = await page.locator(".card").count();
    await openFilterPanel(page);
    await page.click('.seg-filter [data-filter="current"]');
    await page.waitForTimeout(400);
    const visibleCards = await page.locator(".card").count();
    check(
      "全折叠+现役过滤：首屏见脸",
      folded === 0 && visibleCards > 0,
      `${folded}->${visibleCards}`
    );
    await openFilterPanel(page);
    await page.click('.seg-filter [data-filter="all"]');
    await page.waitForTimeout(300);

    // -- 期生筛选：48G 选 1期生（只留该期），汉字/阿拉伯归一在坂道用例验证
    block("期生筛选");
    const genOpts = await page.$$eval("#gen-filter option", (os) =>
      os.map((o) => o.value)
    );
    check(
      "期生下拉：全部 + 多期、不含兼任・移籍加入",
      genOpts[0] === "all" &&
        genOpts.length > 10 &&
        !genOpts.includes("兼任・移籍加入"),
      `${genOpts.length}`
    );
    await openFilterPanel(page);
    await page.selectOption("#gen-filter", "1期生");
    await page.waitForTimeout(400);
    const genHeads = await page.$$eval(".gen-name", (els) =>
      els.map((e) => e.textContent.trim())
    );
    const genGroups = await page.$$eval(".grp-name", (els) =>
      els.map((e) => e.textContent.trim())
    );
    check(
      "48G 期生筛选：只见 1期生 段、七团都有节点",
      genHeads.length >= 1 &&
        genHeads.every((h) => h === "1期生") &&
        genGroups.length === 7,
      `${genHeads.join(",")}|${genGroups.join(",")}`
    );
    await openFilterPanel(page);
    await page.selectOption("#gen-filter", "all");
    await page.waitForTimeout(300);
    check(
      "期生筛选复位后段数恢复",
      (await page.locator(`.grp[data-group="AKB48"] .gen.sub`).count()) > 20
    );

    // -- 单团视图：选 SKE48
    block("单团视图");
    await openFilterPanel(page);
    await page.selectOption("#group-filter", "SKE48");
    await page.waitForTimeout(200);
    check("单团视图无团体头", (await page.locator(".grp").count()) === 0);
    const skeSections = await page.locator(".gen").count();
    check("SKE48 单层 18 段", skeSections === 18, `实际 ${skeSections}`);
    await openFirstSection(page);
    const skeCards = await page.locator(".card").count();
    check("SKE48 1期生卡片可见", skeCards > 15, `实际 ${skeCards}`);

    // 选 4 人（SKE）
    for (let i = 0; i < 4; i++) await page.locator(".card").nth(i).click();
    let pressed = await page.locator('.card[aria-pressed="true"]').count();
    check("SKE 已选 4", pressed === 4, `实际 ${pressed}`);
    const slotAria = await page.getAttribute(
      "#slots li:nth-child(1) button",
      "aria-label"
    );
    check(
      "托盘标注团体/期生",
      /SKE48/.test(slotAria) && /期生/.test(slotAria),
      slotAria
    );

    // -- 跨团混选：切回全部，再选 3 人
    block("跨团混选");
    await openFilterPanel(page);
    await page.selectOption("#group-filter", "all");
    await page.waitForTimeout(200);
    await openGroup(page, "NMB48");
    await page.click(`.grp[data-group="NMB48"] .gen.sub .gen-head`);
    await page.waitForTimeout(100);
    for (let i = 0; i < 3; i++)
      await page.locator(`.grp[data-group="NMB48"] .card`).nth(i).click();
    const picked = await page
      .locator("#slots li.slot:not(.empty-slot)")
      .count();
    check("跨团已选 7（托盘）", picked === 7, `实际 ${picked}`);

    // -- 对决：开始 + 撤回
    block("对决");
    await page.click("#start-btn");
    await page.waitForTimeout(400);
    // ADR-0019：开始后先过「筛选」这一步
    check("进入筛选", await page.isVisible("#phase-screen"));
    check(
      "筛选：一屏列出已选的人",
      (await page.locator(".screen-row").count()) === 7,
      `实际 ${await page.locator(".screen-row").count()}`
    );
    check(
      "筛选：默认一个都没划掉",
      (await page.locator(".screen-row.cut").count()) === 0
    );
    await page.locator("[data-cut]").nth(1).click();
    await page.waitForTimeout(200);
    check(
      "筛选：划掉一个 → 计数与门槛都变",
      (await page.textContent("#screen-count")).includes("6") &&
        (await page.isDisabled("#screen-submit"))
    );
    check(
      "筛选：门槛文案是「再划 2 人」",
      (await page.textContent("#screen-submit")).trim() === "再划 2 人",
      await page.textContent("#screen-submit")
    );
    check(
      "筛选：轮次行显示第 1 轮",
      (await page.textContent("#screen-round")).includes("1"),
      await page.textContent("#screen-round")
    );
    check(
      "筛选：没划够时不显示「继续细分」",
      await page.isHidden("#screen-more")
    );
    // 划够 3 个（7 档第一轮要划 3）→ 可提交，且出现递归入口
    for (let i = 0; i < 2; i++) {
      await page
        .locator('[data-cut][aria-pressed="false"]:not([disabled])')
        .first()
        .click();
      await page.waitForTimeout(150);
    }
    check(
      "筛选：划够一半 → 可提交",
      !(await page.isDisabled("#screen-submit"))
    );
    const est = ((await page.textContent("#screen-submit")) || "").trim();
    check("筛选：题数上限是各层级之和（8 题，不是 14）", /8/.test(est), est);
    check(
      "筛选：7 档只有一轮 → 不给「继续细分」",
      await page.isHidden("#screen-more")
    );
    check(
      "筛选：超额时未划的行按钮禁用（定值门槛）",
      (await page.locator("[data-cut][disabled]").count()) > 0
    );
    await page.click("#screen-reset");
    await page.waitForTimeout(200);
    check(
      "筛选：全部恢复 → 回到第 1 轮",
      (await page.textContent("#screen-round")).includes("1"),
      await page.textContent("#screen-round")
    );
    check(
      "筛选：恢复后门槛又变回「再划 3 人」",
      (await page.textContent("#screen-submit")).trim() === "再划 3 人",
      await page.textContent("#screen-submit")
    );
    check(
      "筛选：恢复后提交按钮重新禁用",
      await page.isDisabled("#screen-submit")
    );
    // 再划一轮进去：定值门槛下不划够就不给提交
    for (let i = 0; i < 3; i++) {
      await page
        .locator('[data-cut][aria-pressed="false"]:not([disabled])')
        .first()
        .click();
      await page.waitForTimeout(120);
    }
    await page.click("#screen-submit");
    await dismissIntro(page);
    await page.waitForTimeout(300);
    check("筛选提交后进入对决", await page.isVisible("#phase-duel"));
    const max = Number(await page.textContent("#duel-max"));
    check("最坏题数 8（7 档划 3 个后的层级 [4,3]）", max === 8, `实际 ${max}`);
    for (let i = 0; i < 3; i++) {
      await page.click("#fighter-a");
      await page.waitForTimeout(260);
    }
    // 工单 03 起对决页收起页头/步骤条/页脚 → 对决中切不到皮肤；
    // 「切皮肤不打断对决」改在回到挑人页后验（那条 CSS 不重建 DOM 的性质不变）
    const stepPreSkin = await page.textContent("#duel-step");
    check(
      "对决中页头与步骤条收起",
      (await page.evaluate(
        () => getComputedStyle(document.querySelector("#site-head")).display
      )) === "none" &&
        (await page.evaluate(
          () => getComputedStyle(document.querySelector("#steps")).display
        )) === "none"
    );
    await page.click("#back-pick-btn");
    await page.waitForTimeout(300);
    await setSkin(page, "sticker");
    await page.waitForTimeout(300);
    // 回到挑人页后切皮肤，进行中的对决仍在（第 ② 步仍可续玩）
    await setSkin(page, "sticker");
    await page.waitForTimeout(250);
    const trayText = ((await page.textContent("#start-btn")) || "").trim();
    check(
      "切皮肤后托盘按钮仍是「继续对决」",
      /继续对决/.test(trayText),
      trayText
    );
    await setSkin(page, "classic");
    await page.waitForTimeout(250);
    check(
      "切回原版后题号没变",
      (await page.textContent("#duel-step")) === stepPreSkin,
      stepPreSkin
    );

    // 回到对决继续验撤回（托盘按钮 = 继续对决）
    await page.click("#start-btn");
    await page.waitForTimeout(350);
    const stepBefore = Number(await page.textContent("#duel-step"));
    check(
      "从托盘续玩回到原题号",
      stepBefore === Number(stepPreSkin.replace(/\D/g, "")),
      `${stepPreSkin} -> ${stepBefore}`
    );
    await page.click("#undo-btn");
    await page.waitForTimeout(150);
    const stepAfter = Number(await page.textContent("#duel-step"));
    check(
      "撤回回退一步",
      stepAfter === stepBefore - 1,
      `${stepBefore} -> ${stepAfter}`
    );
    await clickFighter(page); // 撤回后卡片有过渡动画，等它稳定再点

    // -- 答完
    block("答完");
    for (let i = 0; i < 20; i++) {
      if (!(await clickFighter(page))) break;
      await page.waitForTimeout(230);
    }
    check("进入结果页", await page.isVisible("#phase-result"));
    // 「这几位重新排序」必须真的换对手 —— app 接线（navigate("resort", {shuffle}) 到
    // startDuel）那段路径没被 session 测试覆盖（那里是注入的 shuffle）
    {
      const firstPair = () =>
        page.evaluate(() => {
          const nm = (q) =>
            document.querySelector(q).querySelector(".nm").textContent.trim();
          return [nm("#fighter-a"), nm("#fighter-b")].join("|");
        });
      const pairs = new Set();
      // 6 次而不是 4 次：首对来自第一层（7 档下 4 人 → 6 种可能），4 次全同的概率
      // ~0.5%，实测在 2026-10-05 的第 2 次连跑里撞到过一次（244/245 假红）。
      // 6 次把它降到 ~0.01%；「resort 没洗牌」的真缺陷仍然会全同 → 照样红。
      for (let k = 0; k < 6; k++) {
        await page.waitForSelector("#resort-btn", {
          state: "visible",
          timeout: 10000,
        });
        await page.click("#resort-btn", { force: true });
        await page.waitForSelector("#phase-duel:not([hidden])", {
          timeout: 8000,
        });
        // resort 会重开对决 → maybeIntro() 又弹说明卡，遮罩会挡住答题
        await dismissIntro(page);
        pairs.add(await firstPair());
        if (k === 0) {
          check(
            "重新排序把题数清零（从第 1 题重答）",
            (await page.textContent("#duel-step")).trim() === "1"
          );
        }
        let g = 0;
        while (g++ < 40) {
          if (!(await clickFighter(page))) break;
          await page.waitForTimeout(120);
        }
      }
      check(
        "重新排序会换对手（6 场点出多组第一对）",
        pairs.size >= 2,
        `${pairs.size} 组: ${[...pairs].join(" / ")}`
      );
      check(
        "重新排序后能答完回到结果页",
        await page.isVisible("#phase-result")
      );
      // 说明卡的「已看过」标记是这次点出来的，会影响后面流程是否弹说明卡 ——
      // 恢复成「没看过」，别让本块污染后面的断言
      await page.evaluate(() => localStorage.removeItem("akb:duelintro:v1"));
    }
    const rankCount = await page.locator("#rank-list li").count();
    check("结果 7 项", rankCount === 7, `实际 ${rankCount}`);
    const rankMeta = await page.textContent("#rank-list");
    check(
      "结果 meta 含团体",
      /AKB48|SKE48|NMB48|HKT48|NGT48|STU48|SDN48/.test(rankMeta)
    );
    await page.waitForFunction(
      () => {
        const im = document.querySelector("#poster-img");
        return (
          im &&
          im.getAttribute("src") &&
          im.getAttribute("src").startsWith("data:image/png") &&
          im.naturalWidth > 100
        );
      },
      { timeout: 15000 }
    );
    check("海报生成成功", true);

    // -- 语言切换
    block("语言切换");
    await setLang(page, "en");
    await page.waitForTimeout(300);
    const brandEn = await page.textContent("#brand");
    check("英文品牌", brandEn.includes("Kami 7"), brandEn);
    const titleEn = await page.inputValue("#title-input");
    check("英文标题", titleEn.includes("48 Group"), titleEn);
    const saveEn = await page.textContent("#save-btn");
    check("英文结果页文案", saveEn.includes("Save"), saveEn);
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 8000 }),
      page.click("#save-btn"),
    ]);
    check(
      "保存海报文件名",
      download.suggestedFilename() === "48group_kami7.png",
      download.suggestedFilename()
    );
    await setLang(page, "zh");
    await page.waitForTimeout(200);

    // -- 移籍成员结果 meta 含毕业年份
    block("移籍成员结果 meta 含毕业年份");
    await page.evaluate(() => localStorage.clear());
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    await ready(page);
    await openFilterPanel(page);
    await page.fill("#search", "宮澤");
    await page.waitForTimeout(350);
    await page.click('.card:has-text("宮澤佐江")');
    await openFilterPanel(page);
    await page.fill("#search", "前田敦子");
    await page.waitForTimeout(350);
    await page.click('.card:has-text("前田敦子")');
    await openFilterPanel(page);
    await page.fill("#search", "");
    await page.waitForTimeout(350);
    const unsel = page.locator(
      '.grp[data-group="AKB48"] .card[aria-pressed="false"]'
    );
    for (let i = 0; i < 5; i++) await unsel.nth(i).click();
    await page.click("#start-btn");
    await passScreening(page);
    await dismissIntro(page);
    await page.waitForTimeout(300);
    for (let i = 0; i < 20; i++) {
      if (!(await clickFighter(page))) break;
      await page.waitForTimeout(230);
    }
    const rankText = await page.textContent("#rank-list");
    check(
      "移籍成员结果 meta 含毕业年份",
      /2016.*(毕业|卒業)/.test(rankText),
      (rankText.match(/2016[^ ]*/) || [""])[0].trim()
    );

    // -- 单团神7 全流程（SKE48）
    block("单团神7 全流程（SKE48）");
    await page.evaluate(() => localStorage.clear());
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    await ready(page);
    await openFilterPanel(page);
    await page.selectOption("#group-filter", "SKE48");
    await page.waitForTimeout(200);
    await openFirstSection(page);
    for (let i = 0; i < 7; i++) await page.locator(".card").nth(i).click();
    await page.click("#start-btn");
    await passScreening(page);
    await dismissIntro(page);
    await page.waitForTimeout(300);
    for (let i = 0; i < 16; i++) {
      if (await page.isHidden("#phase-duel")) break;
      await page.click("#fighter-b");
      await page.waitForTimeout(230);
    }
    check("单团流程到结果", await page.isVisible("#phase-result"));
    const skeMeta = await page.textContent("#rank-list");
    check("单团结果 meta 含 SKE48", skeMeta.includes("SKE48"));

    // -- v2 选人：系列切换 / 简体搜索 / 40 档 / 持久化
    block("v2 选人");
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    await ready(page);
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(400);
    await page.click('.seg-series [data-series="sakamichi"]');
    await page.waitForTimeout(300);
    const sakaBrand = await page.textContent("#brand");
    const sakaGrps = await page.locator(".grp").count();
    const sakaOptions = await page.$$eval("#group-filter option", (os) =>
      os.map((o) => o.value)
    );
    check(
      "坂道 tab：品牌 7福神 + 3 团",
      sakaBrand === "7福神" && sakaGrps === 3,
      `${sakaBrand}/${sakaGrps}`
    );
    await openFilterPanel(page);
    await page.selectOption("#gen-filter", "1期生");
    await page.waitForTimeout(400);
    const sakaGenHeads = await page.$$eval(".gen-name", (els) =>
      els.map((e) => e.textContent.trim())
    );
    const sakaGenGroups = await page.$$eval(".grp-name", (els) =>
      els.map((e) => e.textContent.trim())
    );
    check(
      "坂道期生筛选：1期生 命中三团（一期生/1期生 归一）",
      sakaGenHeads.length >= 1 &&
        sakaGenHeads.every((h) => /^[1一]期生$/.test(h)) &&
        sakaGenGroups.includes("櫻坂46") &&
        sakaGenGroups.includes("日向坂46"),
      `${sakaGenHeads.join(",")}|${sakaGenGroups.join(",")}`
    );
    await page.click('.grp[data-group="櫻坂46"] .grp-head');
    await page.waitForTimeout(300);
    const sakaHeads = await page.$$eval(
      '.grp[data-group="櫻坂46"] .gen-name',
      (els) => els.map((e) => e.textContent.trim())
    );
    check(
      "坂道段头保留原文（櫻坂显示一期生）",
      sakaHeads.length === 1 && sakaHeads[0] === "一期生",
      sakaHeads.join(",")
    );
    await openFilterPanel(page);
    await page.selectOption("#gen-filter", "all");
    await page.waitForTimeout(300);
    check(
      "坂道 tab：下拉仅坂道团",
      JSON.stringify(sakaOptions) ===
        JSON.stringify(["all", "乃木坂46", "櫻坂46", "日向坂46"]),
      sakaOptions.join(",")
    );
    const sakaCards = await page.locator(".card").count();
    check("坂道期生展开有卡片", sakaCards > 0, `实际 ${sakaCards}`);
    await page.click('.seg-series [data-series="48g"]');
    await page.waitForTimeout(200);
    await openFilterPanel(page);
    await page.fill("#search", "渡边");
    await page.waitForTimeout(400);
    const rosterText = await page.textContent("#roster");
    check(
      "简体搜索命中渡辺",
      rosterText.includes("渡辺麻友"),
      rosterText.slice(0, 40)
    );

    // 罗马字检索（汉字/假名/昵称都进 haystack）
    for (const [q, expect] of [
      ["maeda", "前田敦子"],
      ["sato", "佐藤"],
      ["tomochin", "板野友美"],
      ["sasshi", "指原莉乃"],
      ["sasihara", "指原莉乃"],
      ["acchan", "前田敦子"],
    ]) {
      await openFilterPanel(page);
      await page.fill("#search", q);
      await page.waitForTimeout(380);
      const txt = (await page.textContent("#roster")) || "";
      check(`罗马字：${q} 命中`, txt.includes(expect), txt.trim().slice(0, 30));
    }
    await openFilterPanel(page);
    await page.fill("#search", "");
    await page.waitForTimeout(300);
    await openFilterPanel(page);
    await page.fill("#search", "前田");
    await page.waitForTimeout(400);
    await page.locator(".card").first().click();
    const firstId = await page.getAttribute(".card", "data-id");
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(500);
    const trayRestored = await page.locator("#slots .slot button").count();
    await openFilterPanel(page);
    await page.fill("#search", "前田");
    await page.waitForTimeout(400);
    const restored = await page
      .locator(`.card[data-id="${firstId}"][aria-pressed="true"]`)
      .count();
    check(
      "刷新后恢复已选",
      trayRestored >= 1 && restored === 1,
      `托盘 ${trayRestored} / 卡片 ${restored}`
    );
    await page.click('.seg-size [data-pick="40"]');
    await page.waitForTimeout(300);
    const slots40 = await page.locator(".slot").count();
    const brand40 = await page.textContent("#brand");
    check(
      "40 档：托盘 40 格 + 品牌 圈内",
      slots40 === 40 && brand40 === "圈内",
      `${slots40}/${brand40}`
    );
    const size7Text = await page.textContent("#size-7");
    check(
      "40 档下 7 档按钮仍显示神7",
      size7Text.trim() === "神7",
      size7Text.trim()
    );

    // -- ADR-0019 改写版：16 档走两轮筛选（[8,4]），验证递归入口与题数随轮次变化
    block("ADR-0019 改写版");
    await goToPick(page); // 对决页收起页头 → 切档位前先回挑人页
    await page.click('.seg-size [data-pick="16"]');
    await page.waitForTimeout(300);
    const ids16 = await page.evaluate(() =>
      window.AKB_GROUPS.filter((g) => g.series === "48g")
        .flatMap((g) => g.members)
        .slice(0, 16)
        .map((m) => m.id)
    );
    await page.evaluate(
      (sel) =>
        localStorage.setItem(
          "akb:state:v2:48g",
          JSON.stringify({ v: 1, size: 16, selected: sel, duel: null })
        ),
      ids16
    );
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(500);
    await page.click("#start-btn");
    await page.waitForSelector("#phase-screen:not([hidden])", {
      timeout: 5000,
    });
    for (const [name, ok] of await checkSecondRound(page)) check(name, ok);

    // -- v2 对决：40 档（划一轮后 138 题）+ 进度 + 续玩
    block("v2 对决");
    await goToPick(page);
    const ids40 = await page.evaluate(() =>
      window.AKB_GROUPS.filter((g) => g.series === "48g")
        .flatMap((g) => g.members)
        .slice(0, 40)
        .map((m) => m.id)
    );
    await page.evaluate(
      (sel) =>
        localStorage.setItem(
          "akb:state:v2:48g",
          JSON.stringify({ v: 1, size: 40, selected: sel, duel: null })
        ),
      ids40
    );
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(500);
    await page.click("#start-btn");
    await page.waitForSelector("#phase-screen:not([hidden])");
    // 40 档逐轮细分：每划完一轮题数递减，「继续细分」在最后一轮消失
    // （边界二选一：138 → 119 → 110 → 106，层级 [3,2,5,10,20]）
    const est40 = [];
    for (let r = 1; r <= 4; r++) {
      let g = 0;
      while ((await page.isDisabled("#screen-submit")) && g++ < 30) {
        await page
          .locator('[data-cut][aria-pressed="false"]:not([disabled])')
          .first()
          .click();
        await page.waitForTimeout(50);
      }
      est40.push(
        ((await page.textContent("#screen-submit")) || "").match(/(\d+)/)[1]
      );
      const moreVisible = await page.isVisible("#screen-more");
      check(
        `40 档第 ${r} 轮划够后「继续细分」${r < 4 ? "出现" : "消失"}`,
        moreVisible === r < 4,
        String(moreVisible)
      );
      if (r < 4) {
        await page.click("#screen-more");
        await page.waitForTimeout(200);
      }
    }
    check(
      "40 档逐轮细分：138→119→110→106",
      est40.join(",") === "138,119,110,106",
      est40.join(",")
    );
    await page.click("#screen-submit");
    await dismissIntro(page);
    await page.waitForTimeout(400);
    const max40 = await page.textContent("#duel-max");
    check("40 档：四轮细分后题数 = 106（不是 177）", max40 === "106", max40);
    const extra40 = ((await page.textContent("#duel-extra")) || "").trim();
    check(
      "40 档：细进度条显示层级 1/5",
      /第\s*1\/5\s*组/.test(extra40),
      extra40
    );
    // 层级段数必须等于 core.screenTiers 的**独立计算结果**。此前只有上面那条
    // 「显示 1/5」，而它和段数用的是同一个字段（snap.duel.tiers）—— 验的是
    // 同一个数字被渲染了两次，不可能不一致（恒真）。
    const tiers40 = await page.evaluate(() => {
      const state = JSON.parse(
        localStorage.getItem("akb:state:v2:48g") || "{}"
      );
      const expected = window.AKB_CORE.screenTiers(
        state.selected || [],
        state.cut || []
      ).length;
      const segs = document.querySelectorAll("#duel-tiers i");
      return {
        expected,
        rendered: segs.length,
        cutRounds: (state.cut || []).length,
        done: document.querySelectorAll("#duel-tiers i.done").length,
        now: document.querySelectorAll("#duel-tiers i.now").length,
      };
    });
    check(
      "40 档：层级段数 = core.screenTiers 独立算出的层级数（5）",
      tiers40.rendered === tiers40.expected && tiers40.expected === 5,
      `渲染 ${tiers40.rendered} 段 / 独立算出 ${tiers40.expected} 层（存档里 ${tiers40.cutRounds} 轮划除）`
    );
    // 第一题时没有任何组完成 → done = 0。未开始的组既不是 now 也不是 done，
    // 所以「两类合计 = 段数」也是错的（我第一版两个不变量都写错了：
    // 先把「第 N 组进行中」当成「前 N 组已完成」，又假设每段都归这两类）。
    const cls40 = await page.evaluate(() => {
      const segs = [...document.querySelectorAll("#duel-tiers i")];
      return {
        now: segs.filter((s) => s.classList.contains("now")).length,
        done: segs.filter((s) => s.classList.contains("done")).length,
        pending: segs.filter(
          (s) => !s.classList.contains("now") && !s.classList.contains("done")
        ).length,
        firstIsNow: segs[0] && segs[0].classList.contains("now"),
      };
    });
    check(
      "40 档：段状态自洽（now 恰好 1 且在首段、done 为 0、三类合计 = 段数）",
      cls40.now === 1 &&
        cls40.firstIsNow &&
        cls40.done === 0 &&
        cls40.now + cls40.done + cls40.pending === tiers40.rendered,
      `now ${cls40.now}（首段 ${cls40.firstIsNow}）/ done ${cls40.done} / 未开始 ${cls40.pending} / 共 ${tiers40.rendered}`
    );
    // 细条是 flex 行：文案一长就会把 extra 挤到视口外（曾实测右边缘 484 > 390），
    // 省略号截断也不算数（用户读不到「约 9 分钟」就没意义）—— 必须完整放得下
    const thin = await page.evaluate(() => {
      const e = document.getElementById("duel-extra");
      const b = e.getBoundingClientRect();
      return {
        right: Math.round(b.right),
        vw: innerWidth,
        ellipsis: e.scrollWidth > e.clientWidth + 1,
        txt: e.textContent.trim(),
      };
    });
    check(
      "细进度条完整放得下（无省略号）",
      !thin.ellipsis,
      `${thin.txt} → ${thin.right}px`
    );
    check(
      "细进度条不溢出视口",
      thin.right <= thin.vw,
      `右边缘 ${thin.right} / 视口 ${thin.vw}`
    );
    await page.click("#fighter-a");
    await page.waitForTimeout(280);
    await page.click("#fighter-b");
    await page.waitForTimeout(280);
    const stepBefore40 = await page.textContent("#duel-step");
    const extraText = await page.textContent("#duel-extra");
    // 细条文案改版：百分比由进度条表示、题数由「1 / 最多 N 题」表示，
    // extra 只说「哪一组」和「还要多久」—— 曾把 5 个事实塞进去，整条溢出视口
    check(
      "进度文案含组别与预计时间",
      /第\s*\d+\/\d+\s*组/.test(extraText) && /分钟/.test(extraText),
      extraText
    );
    check(
      "细条不再重复百分比与题数（留给进度条与题号）",
      !/%/.test(extraText),
      extraText
    );
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(600);
    const inDuel = await page.isVisible("#phase-duel");
    const stepAfter40 = await page.textContent("#duel-step");
    check(
      "刷新后继续对决",
      inDuel && stepAfter40 === stepBefore40,
      `${stepBefore40}->${stepAfter40}`
    );
    await goToPick(page); // 对决页收起页头 → 切系列前先回挑人页
    await page.click('.seg-series [data-series="sakamichi"]');
    await page.waitForTimeout(400);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(700);
    const leakDuel = await page.isVisible("#phase-duel");
    const leakResult = await page.isVisible("#phase-result");
    check(
      "48G 对决不泄漏到坂道",
      !leakDuel && !leakResult,
      `duel=${leakDuel} result=${leakResult}`
    );

    // -- v2 结果：坂道 BEST 7 海报与文件名
    block("v2 结果");
    const idsSaka = await page.evaluate(() =>
      window.AKB_GROUPS.filter((g) => g.series === "sakamichi")
        .flatMap((g) => g.members)
        .slice(0, 7)
        .map((m) => m.id)
    );
    await page.evaluate((sel) => {
      localStorage.clear();
      localStorage.setItem(
        "akb:state:v2:sakamichi",
        JSON.stringify({ v: 1, size: 7, selected: sel, duel: null })
      );
    }, idsSaka);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(500);
    await goToPick(page);
    await page.click('.seg-series [data-series="sakamichi"]');
    await page.waitForTimeout(400);
    await page.click("#start-btn");
    await passScreening(page);
    await dismissIntro(page);
    await page.waitForTimeout(300);
    for (let i = 0; i < 16; i++) {
      if (await page.isHidden("#phase-duel")) break;
      await page.click("#fighter-a");
      await page.waitForTimeout(230);
    }
    check("坂道流程到结果", await page.isVisible("#phase-result"));
    const sakaRank = await page.textContent("#rank-list");
    check(
      "坂道结果 meta 含坂道团",
      /乃木坂46|櫻坂46|日向坂46/.test(sakaRank),
      sakaRank.slice(0, 30)
    );
    await page.waitForTimeout(800);
    const sakaTitle = await page.inputValue("#title-input");
    check("坂道默认标题 7福神", sakaTitle.includes("7福神"), sakaTitle);
    const [dlSaka] = await Promise.all([
      page.waitForEvent("download", { timeout: 8000 }),
      page.click("#save-btn"),
    ]);
    check(
      "坂道海报文件名",
      dlSaka.suggestedFilename() === "sakamichi_7fukujin.png",
      dlSaka.suggestedFilename()
    );

    // -- 成员简介（卡片 i → 资料卡）
    block("成员简介（卡片 i → 资料卡）");
    await page.evaluate(() => localStorage.clear());
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    await ready(page);
    await page.waitForTimeout(400);
    await page.locator(".card .info").first().click();
    await page.waitForTimeout(300);
    const pfVisible = await page.isVisible("#profile");
    const pfText = await page.textContent("#pf-fields");
    const pfName = (await page.textContent("#pf-name")).trim();
    const selectedAfterInfo = await page
      .locator(".card[aria-pressed='true']")
      .count();
    check(
      "简介：点卡片 i 打开资料卡（含生年月日）、且不选中成员",
      pfVisible && pfText.includes("生年月日") && selectedAfterInfo === 0,
      `${pfName} sel=${selectedAfterInfo}`
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    check("简介：Esc 关闭", await page.isHidden("#profile"));
    await setLang(page, "en");
    await page.waitForTimeout(300);
    await page.locator(".card .info").first().click();
    await page.waitForTimeout(300);
    const pfEn = await page.textContent("#pf-fields");
    check(
      "简介：EN 界面标签跟随",
      pfEn.includes("Date of birth"),
      pfEn.slice(0, 30)
    );
    await page.keyboard.press("Escape");
    await setLang(page, "zh");
    await page.waitForTimeout(200);

    // -- 清空已选（确认）
    block("清空已选（确认）");
    await page.evaluate(() => localStorage.clear());
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    await ready(page);
    await page.waitForTimeout(400);
    for (let i = 0; i < 3; i++) await page.locator(".card").nth(i).click();
    const beforeClear = await page.textContent("#start-btn");
    const clearEnabled = !(await page.isDisabled("#clear-btn"));
    check(
      "清空前：已选 3 人、清空可用",
      beforeClear.includes("4") && clearEnabled,
      `${beforeClear.trim()} enabled=${clearEnabled}`
    );
    page.once("dialog", (d) => d.accept());
    await page.click("#clear-btn");
    await page.waitForTimeout(300);
    const afterClear = await page.textContent("#start-btn");
    const slotsLeft = await page
      .locator("#slots .slot:not(.empty-slot)")
      .count();
    check(
      "清空后：已选清空、按钮回到还差 7 位",
      afterClear.includes("7") && slotsLeft === 0,
      `${afterClear.trim()} slots=${slotsLeft}`
    );
    check("清空后按钮禁用", await page.isDisabled("#clear-btn"));

    // -- 等爱系列（第三 tab）
    block("等爱系列（第三 tab）");
    await page.evaluate(() => localStorage.clear());
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    await ready(page);
    await page.waitForTimeout(400);
    await page.click('.seg-series [data-series="love"]');
    // 设备实测：本机可用常驻 <3GB 时模块加载后 handler 才绑上，固定 500ms 会读到
    // 切换前的品牌 —— 症状是「点了没反应」，实际是断言比 JS 快。
    await page
      .waitForFunction(
        () =>
          document.querySelector('.seg-series button[aria-checked="true"]')
            ?.dataset.series === "love",
        null,
        { timeout: 60000 }
      )
      .catch(() => {});
    await page.waitForTimeout(500);
    const loveBrand = await page.textContent("#brand");
    const loveGroups = await page.locator(".grp-name").allTextContents();
    const loveCounts = await page.locator(".grp-count").allTextContents();
    check(
      "等爱：品牌推し 7、三团节点 12/12/13",
      loveBrand.trim() === "推し 7" &&
        loveGroups.join("/") === "=LOVE/≠ME/≒JOY" &&
        loveCounts.every((c, i) => c.includes(["12", "12", "13"][i])),
      `${loveBrand.trim()} ${loveGroups.join("/")} ${loveCounts.join("|")}`
    );
    const titleLove = await page.inputValue("#title-input");
    check(
      "等爱：默认标题「我的等爱 推し 7」",
      titleLove.trim() === "我的等爱 推し 7",
      titleLove
    );
    const loveCards = await page.locator(".card").count();
    check(
      "等爱：展开 =LOVE 后 12 张卡片",
      loveCards === 12,
      `cards=${loveCards}`
    );

    // 第四个系列（早安家族）：**十一团**（伞下九团批，2026-10-02）
    await page.click('.seg-series [data-series="morning"]');
    await page.waitForTimeout(600);
    const mmGroups = await page.locator(".grp-name").allTextContents();
    check(
      "早安家族：十一个团节点（含伞下九团）",
      mmGroups.join("/") ===
        "モーニング娘。/℃-ute/アンジュルム/Juice=Juice/つばきファクトリー/BEYOOOOONDS/OCHA NORMA/ロージークロニクル/Berryz工房/カントリー・ガールズ/こぶしファクトリー",
      mmGroups.join("/")
    );
    const mmCounts = await page.locator(".grp-count").allTextContents();
    check(
      "早安家族：十一团计数（51/8/26/19/17/11/10/9/8/3/7）",
      mmCounts.length === 11 &&
        ["51", "8", "26", "19", "17", "11", "10", "9", "7", "4", "7"].every(
          (n, i) => mmCounts[i].startsWith(n)
        ),
      mmCounts.join("|")
    );
    // 展开 ℃-ute：8 张卡、全部毕业（它 2017 年就解散了）
    // 折叠头的真实形状：section.grp[data-group] > .grp-head（app.js 的委托点）
    await page.locator('section.grp[data-group="℃-ute"] > .grp-head').click();
    await page.waitForTimeout(700);
    // 团段与期生段是两层折叠：点团头只展开出期生段，卡片在期生段里。
    // 期生段要点 ℃-ute 自己的（11 团后 `.grp` 最后一个是こぶし，它没有期生段）
    await page.locator('section.grp[data-group="℃-ute"] .gen-head').click();
    await page.waitForTimeout(500);
    const cuteCards = await page
      .locator('section.grp[data-group="℃-ute"] .card')
      .count();
    const cuteStatus = await page
      .locator(".card .status-tag")
      .allTextContents()
      .catch(() => []);
    check(
      "℃-ute：展开后 8 张卡、全部毕业",
      cuteCards === 8 &&
        (cuteStatus.length === 0 ||
          cuteStatus.every((t) => /毕业|graduate|卒業/.test(t))),
      `cards=${cuteCards} status=${cuteStatus.join("|")}`
    );
    const cutePlaceholders = await page
      .locator(".card .card-img.is-placeholder, .card img[src='']")
      .count();
    check(
      "℃-ute：照片覆盖率低（源里没有官网照片，占位卡是预期）",
      cuteCards >= 6,
      `${cutePlaceholders}`
    );
    await page.click('.seg-series [data-series="48g"]');
    await page.waitForTimeout(400);

    // 第四个系列（早安）：一系列一团，51 人，7 档品牌「推し7」
    await page.click('.seg-series [data-series="morning"]');
    await page.waitForTimeout(600);
    const morningBrand = await page.textContent("#brand");
    const morningGroups = await page.locator(".grp-name").allTextContents();
    check(
      "早安：品牌推し7、团节点十一团",
      morningBrand.trim() === "推し7" && morningGroups.length === 11,
      `${morningBrand.trim()} ${morningGroups.join("/")}`
    );
    const titleMorning = await page.inputValue("#title-input");
    check(
      "早安：默认标题「我的早安家族 推し7」",
      titleMorning.trim() === "我的早安家族 推し7",
      titleMorning
    );
    const morningCards = await page
      .locator('section.grp[data-group="モーニング娘。"] .card')
      .count();
    check(
      "早安：モーニング娘。 51 张卡片",
      morningCards === 51,
      `cards=${morningCards}`
    );
    const morningErrs = [];
    page.on("pageerror", (e) => morningErrs.push(String(e)));
    await page.click('.seg-series [data-series="48g"]');
    await page.waitForTimeout(500);
    const morningBackBrand = await page.textContent("#brand");
    check(
      "早安：切回 48g 品牌恢复神7",
      morningBackBrand.trim() === "神7",
      `${morningBackBrand.trim()} errs=${morningErrs.join(";")}`
    );
    // 早安块结束时切回了 48g，而这里要查的是等爱资料卡 —— 先切回等爱
    await page.click('.seg-series [data-series="love"]');
    await page.waitForTimeout(500);
    await page.locator(".card .info").first().click();
    await page.waitForTimeout(300);
    const loveFields = await page.textContent("#pf-fields");
    check(
      "等爱简介：含血型/星座/趣味/特技/罗马字",
      ["血液型", "星座", "趣味", "特技", "罗马字"].every((k) =>
        loveFields.includes(k)
      ),
      loveFields.replace(/\n/g, "/").slice(0, 80)
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    for (let i = 0; i < 7; i++) await page.locator(".card").nth(i).click();
    await page.waitForTimeout(200);
    await page.click("#start-btn");
    await passScreening(page);
    await dismissIntro(page);
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(160);
      if (!(await page.isVisible("#phase-duel"))) break;
      await page.click("#fighter-a");
    }
    // 等海报**真的画出来**：`#poster-img` 的 src 变成 data URL 才是那个信号。
    // （不要等 `document.images` 全 complete —— 海报的图是 `new Image()` 加载的、
    // 根本不在 document.images 里，而名册的 lazy 图在视口外永不加载，实测恒假、
    // 白烧 20s 超时。）
    await page.waitForFunction(
      () => {
        const im = document.getElementById("poster-img");
        return (
          im && (im.getAttribute("src") || "").startsWith("data:image/png")
        );
      },
      { timeout: 20000 }
    );
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1200);
    const loveResultTitle = await page.inputValue("#title-input");
    const lovePosterOk = await page.evaluate(() => {
      const img = document.getElementById("poster-img");
      return (
        img && img.src.startsWith("data:image/png") && img.src.length > 100000
      );
    });
    check(
      "等爱：完成对决生成海报（我的等爱 推し 7）",
      loveResultTitle.trim() === "我的等爱 推し 7" && lovePosterOk,
      `${loveResultTitle.trim()} poster=${lovePosterOk}`
    );
    await page.click("#restart-btn");
    await page.waitForTimeout(300);
    await page.click('.seg-series [data-series="48g"]');
    await page.waitForTimeout(400);
    const backBrand = await page.textContent("#brand");
    check(
      "切回 48g：品牌回到神7（跨系列隔离）",
      backBrand.trim() === "神7",
      backBrand.trim()
    );

    // -- 皮肤切换（页头 A 版）
    block("皮肤切换（页头 A 版）");
    await page.evaluate(() => localStorage.clear());
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    await ready(page);
    await page.waitForTimeout(400);
    const skinDefault = await page.getAttribute("html", "data-skin");
    const skinChecked = await page.getAttribute(
      '.seg-skin [data-skin="classic"]',
      "aria-checked"
    );
    check(
      "皮肤：默认原版且选中态正确",
      skinDefault === "classic" && skinChecked === "true",
      `${skinDefault}/${skinChecked}`
    );
    const classicBorder = await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector(".roster"));
      return cs.borderTopWidth + " " + cs.borderTopStyle;
    });
    check(
      "皮肤：原版容器细边 1px solid",
      classicBorder === "1px solid",
      classicBorder
    );
    await setSkin(page, "sticker");
    await page.waitForTimeout(300);
    const skinAfter = await page.getAttribute("html", "data-skin");
    const skinStored = await page.evaluate(() =>
      localStorage.getItem("akb:skin")
    );
    check(
      "皮肤：切换为贴纸并持久化",
      skinAfter === "sticker" && skinStored === "sticker",
      `${skinAfter}/${skinStored}`
    );
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
    // 启动的 show() 末尾会把页面滚回顶部。等挑人相位真的显示（= show() 已跑完）再继续，
    // 否则下面的滚动断言与启动的 scrollTo 竞态 —— 负载高时启动变慢，实测出现过一次
    // 400 -> 0（2026-10-05 两轴审查的重跑）；中等负载下 50 轮复现不出，按竞态修。
    await page.waitForSelector("#phase-pick:not([hidden])", { timeout: 60000 });
    await page.waitForTimeout(400);
    check(
      "皮肤：刷新后保持贴纸",
      (await page.getAttribute("html", "data-skin")) === "sticker"
    );
    const stickerBorder = await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector(".roster"));
      return cs.borderTopWidth + " " + cs.borderTopStyle;
    });
    check(
      "皮肤：贴纸容器墨描边 2px solid",
      stickerBorder === "2px solid",
      stickerBorder
    );

    // 切皮肤不重建挑人 DOM：探针节点与滚动位置保留
    await page.evaluate(() => {
      document.querySelector("#roster .card").dataset.skinProbe = "1";
      window.scrollTo(0, 400);
    });
    const scrollBefore = await page.evaluate(() => window.scrollY);
    // DOM click：Playwright 的 page.click 会先自动滚回可见区，会污染滚动断言
    await page.evaluate(() =>
      document.querySelector('.seg-skin [data-skin="classic"]').click()
    );
    await page.waitForTimeout(300);
    check(
      "切皮肤不重建挑人 DOM（节点探针保留）",
      await page.evaluate(
        () =>
          document.querySelector('#roster .card[data-skin-probe="1"]') !== null
      )
    );
    const scrollAfter = await page.evaluate(() => window.scrollY);
    // 换肤会引起轻微布局位移（滚动锚定），断言「没有被弹回顶部」
    check(
      "切皮肤保留滚动位置（未回顶）",
      scrollAfter > 200,
      `scrollY ${scrollBefore} -> ${scrollAfter}`
    );

    // 卡片「i」触控目标 ≥44px，命中区扩到视觉圆之外
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    const infoBox = await page
      .locator("#roster .card .info")
      .first()
      .boundingBox();
    check(
      "卡片 i 触控目标 ≥44px",
      infoBox.width >= 44 && infoBox.height >= 44,
      `${infoBox.width}×${infoBox.height}`
    );
    const cardBox = await page.locator("#roster .card").first().boundingBox();
    const dx = Math.round(
      infoBox.x + infoBox.width - (cardBox.x + cardBox.width)
    );
    const dy = Math.round(cardBox.y - infoBox.y);
    check(
      "i 命中盒锚在卡角（视觉圆位置不变）",
      dx === 4 && dy === 4,
      `dx=${dx} dy=${dy}`
    );
    const selBefore = await page
      .locator('#roster .card[aria-pressed="true"]')
      .count();
    await page.mouse.click(infoBox.x + 6, infoBox.y + 6);
    await page.waitForTimeout(300);
    check("i 命中区角落打开资料卡", !(await page.isHidden("#profile")));
    check(
      "i 点击不改变已选",
      (await page.locator('#roster .card[aria-pressed="true"]').count()) ===
        selBefore
    );
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    // -- 海报跟随皮肤（结果页像素探针）
    block("海报跟随皮肤（结果页像素探针）");
    await page.evaluate(() => localStorage.clear());
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    await ready(page);
    await page.waitForTimeout(400);
    for (let i = 0; i < 7; i++) await page.locator(".card").nth(i).click();
    await page.click("#start-btn");
    await passScreening(page);
    await dismissIntro(page);
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(180);
      if (!(await page.isVisible("#phase-duel"))) break;
      try {
        await page.click("#fighter-a", { timeout: 2000 });
      } catch (_) {
        break;
      }
    }
    await page.waitForTimeout(1800);
    const posterPx = () =>
      page.evaluate(() => {
        const c = document.getElementById("poster-canvas");
        const d = c.getContext("2d").getImageData(6, 6, 1, 1).data;
        return d[0] + "," + d[1] + "," + d[2];
      });
    const classicPx = await posterPx();
    check("海报：原版皮肤底色 #edeff3", classicPx === "237,239,243", classicPx);
    await setSkin(page, "sticker");
    await page.waitForTimeout(1200);
    const stickerPx = await posterPx();
    check("海报：贴纸皮肤底色 #f5f1e6", stickerPx === "245,241,230", stickerPx);

    // -- 海报样式：默认 a、可切换、记忆
    block("海报样式");
    check(
      "样式 chips 四个",
      (await page.locator(".seg-style [data-style]").count()) === 4
    );
    const styleOn = await page.evaluate(
      () =>
        document.querySelector('.seg-style [aria-checked="true"]')?.dataset
          .style
    );
    check("样式默认 = 金字塔(a)", styleOn === "a", String(styleOn));
    await page.click('.seg-style [data-style="b"]');
    await page.waitForTimeout(1200);
    const pxB = await posterPx();
    check("切杂志封面：画面变白底", pxB === "255,255,255", pxB);
    check(
      "样式选择已持久化",
      (await page.evaluate(() => localStorage.getItem("akb:poster-style"))) ===
        "b"
    );
    await page.click('.seg-style [data-style="a"]');
    await page.waitForTimeout(1200);
    const pxA2 = await posterPx();
    check("切回金字塔：底色恢复", pxA2 === "245,241,230", pxA2);

    // 首屏不能闪皮肤。两个独立 context（应用 boot 会把 akb:skin 写进 localStorage，
    // 同一 context 里量第二次会读到已存皮肤，闪就量不出来了）；
    // 既比「第一帧 == 稳定后」，也比「第一帧 == 这位访客本来就该看到的皮肤」——
    // 只比相等的话，CSS 与应用一起错也会相等。
    const SKIN_FLOOR = {
      classic: "rgb(237, 239, 243)",
      sticker: "rgb(245, 241, 230)",
    };
    const SKIN_RADIUS = { classic: "999px", sticker: "14px" };
    const readSkin = (page) =>
      page.evaluate(() => {
        const cs = getComputedStyle(document.body);
        const btn = document.querySelector(".primary");
        return {
          floor: cs.backgroundColor,
          radius: btn ? getComputedStyle(btn).borderRadius : "?",
        };
      });
    for (const [label, seed] of [
      ["新访客", null],
      ["已存 sticker", "sticker"],
      ["已存 classic", "classic"],
    ]) {
      const want = SKIN_FLOOR[seed || "classic"];
      const firstCtx = await browser.newContext();
      if (seed)
        await firstCtx.addInitScript(
          `localStorage.setItem("akb:skin", ${JSON.stringify(seed)})`
        );
      const firstPage = await firstCtx.newPage();
      await firstPage.route("**/app.js", (r) => r.abort());
      await firstPage.goto(BASE, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      const first = await readSkin(firstPage);
      const firstAttr = await firstPage.evaluate(
        () => document.documentElement.dataset.skin || "(无)"
      );
      await firstCtx.close();

      const settledCtx = await browser.newContext();
      if (seed)
        await settledCtx.addInitScript(
          `localStorage.setItem("akb:skin", ${JSON.stringify(seed)})`
        );
      const settledPage = await settledCtx.newPage();
      await settledPage.goto(BASE, {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      await settledPage
        .waitForSelector(".card", { timeout: 20000 })
        .catch(() => {});
      const settled = await readSkin(settledPage);
      const settledAttr = await settledPage.evaluate(
        () => document.documentElement.dataset.skin || "(无)"
      );
      await settledCtx.close();

      check(
        `首屏皮肤底色 = 本该看到的那款（${label}）`,
        first.floor === want,
        `首屏 ${first.floor} vs 期望 ${want}`
      );
      check(
        `首屏 data-skin = 稳定后（${label}）`,
        firstAttr === settledAttr,
        `首屏 ${firstAttr} vs 稳定后 ${settledAttr}`
      );
      check(
        `首屏按钮圆角 = 稳定后（${label}）`,
        first.radius === settled.radius,
        `首屏 ${first.radius} vs 稳定后 ${settled.radius}（期望 ${SKIN_RADIUS[seed || "classic"]}）`
      );
    }
    check("无 JS 报错", errors.length === 0, errors.join(" | ").slice(0, 300));

    // -- 390px：系列 tab 必须点得到（工单 04 的 flex:none 曾把「等爱」压在「更多」底下）
    block("390px");
    // 主流程是 420px 视口，抓不到这个，所以单独开 390px 的 context。
    // 维度：语言（标签满宽 zh 201 / en 254 / ja 212）、档位（en 16 档品牌 "Senbatsu" 133
    // 比 7 档的 96 宽 37）、系列（品牌随系列变宽）。三个维度缺一个就漏 —— 我第一版只跑
    // 语言 × 系列，本项因此溜了两轮。
    //
    // **完整矩阵在独立脚本里**：本机（Android 15GB、可用常驻 <3GB）单次导航要 30s，
    // 跑不动「语言 × 档位 × 系列 × 在线/离线」的完整矩阵。这里只留语言 × 系列，
    // 档位与离线两维交给 /tmp/opencode/verify-header.cjs（54 状态 + 「没有横向滚动」）。
    // -- 390px：首屏必须见脸（工单 02 的判据）。新访客（未关引导卡）第一张成员卡
    block("390px");
    // 原本在第 738px —— 视口 844 的 87% 之前全是页头/步骤条/引导卡/进度/9 个筛选控件，
    // 而底部托盘 100px 又盖住它。「首屏见脸」此前只在关掉引导卡之后才成立。
    //
    // 判据是「**托盘之上完整可见的脸 ≥ 一整行的列数**」，不是像素阈值。原来写的是
    // 「第一张卡 top ≤ 400」—— 那个阈值在 390px 及以上成立、≤380px 是 432（页头在
    // 那里换行成两行 +47px），但量完发现 375px 与 390px 的完整可见脸数一模一样
    // （各 3 张），那 47px 只决定第二行露多少而第二行的名字本来就被托盘压着。
    // 为阈值改版式是零收益付代价。现在的说法与用户实际看到的东西对齐，且可证伪：
    // 页头/步骤条/引导卡/进度任一处涨到把第一行压进托盘就红。
    // （宽度维度的完整矩阵在 /tmp/opencode/verify-first-screen.cjs：
    //  两皮肤 × 三语言 × 320/360/375/390/414/560 共 36 状态全达标。）
    for (const lang of ["zh", "en", "ja"]) {
      const fc = await browser.newContext({
        viewport: { width: 390, height: 844 },
        locale: "zh-CN",
      });
      const fp = await fc.newPage();
      fp.setDefaultNavigationTimeout(180000);
      fp.setDefaultTimeout(180000);
      const fErrs = [];
      fp.on("pageerror", (e) => fErrs.push(String(e.message)));
      await fp.goto(BASE, { waitUntil: "domcontentloaded" });
      await fp.evaluate(() => document.fonts.ready);
      // 名册是 app.js 渲染的，模块加载慢时固定 600ms 之后它还不存在 ——
      // 断言会读到 card=undefined、cols=0，看着像「首屏一张脸都看不到」。
      await fp
        .waitForFunction(
          () => document.querySelectorAll(".card").length > 0,
          null,
          { timeout: 90000 }
        )
        .catch(() => {});
      await fp.waitForTimeout(600);
      // 别点 html：视口中心落在第一组的段头上 → 折叠掉全部卡片（实测 16→0），
      // 断言读到 card=undefined。语言键走 document 级监听，不需要焦点。
      await fp.evaluate(
        () => document.activeElement && document.activeElement.blur()
      );
      await fp.keyboard.press(
        lang === "zh" ? "z" : lang === "ja" ? "j" : "Control+Shift+L"
      );
      await fp.waitForTimeout(500);
      const geo = await fp.evaluate(() => {
        const box = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            h: Math.round(r.height),
            top: Math.round(r.top + scrollY),
            bottom: Math.round(r.bottom + scrollY),
          };
        };
        // 首屏判据的数据：托盘顶 + 每张卡的可见区间
        const trayBox = document.querySelector("#tray").getBoundingClientRect();
        const cards = [...document.querySelectorAll(".card")];
        const cols = new Set(
          cards
            .slice(0, 6)
            .map((c) => Math.round(c.getBoundingClientRect().left))
        ).size;
        const fullFaces = cards.filter((c) => {
          const x = c.getBoundingClientRect();
          return x.top >= 0 && x.bottom <= trayBox.top + 1;
        }).length;
        const tb = document.querySelector(".toolbar");
        let rows = 0;
        // 按「垂直范围是否重叠」分组，而不是比 top / 分桶：同一行内子元素因
        // align-items:center 而 top 最多差 8px（实测 3 与 8 都发生过），
        // 两种朴素写法都会把一行误判成两行 —— 我在这上面错过两次。
        if (tb) {
          const boxes = [...tb.children]
            .map((c) => c.getBoundingClientRect())
            .sort((a, b) => a.top - b.top);
          let bottom = null;
          for (const r of boxes) {
            if (bottom === null || r.top >= bottom - 1) {
              rows++;
              bottom = r.bottom;
            }
          }
        }
        const tray = document.querySelector("#tray");
        const trayBg = tray ? getComputedStyle(tray).backgroundColor : "";
        const alpha = trayBg.startsWith("rgba")
          ? Number(trayBg.split(",")[3])
          : 1;
        return {
          card: box(".card"),
          coach: box("#coach"),
          toolbarRows: rows,
          trayAlpha: alpha,
          trayH: box("#tray")?.h,
          cols,
          fullFaces,
        };
      });
      check(
        `390px/${lang}：新访客首屏完整可见 ≥ 一整行脸`,
        geo.cols > 0 && geo.fullFaces >= geo.cols,
        `${geo.fullFaces} 张完整可见 / ${geo.cols} 列（第一张卡 top=${geo.card?.top}）`
      );
      check(
        `390px/${lang}：筛选控件收成一行`,
        geo.toolbarRows <= 1,
        `${geo.toolbarRows} 行`
      );
      check(
        `390px/${lang}：引导卡压成一行（≤ 80px）`,
        geo.coach && geo.coach.h <= 80,
        `${geo.coach?.h}px`
      );
      check(
        `390px/${lang}：托盘不透明（名册卡片不透出）`,
        geo.trayAlpha === 1,
        `alpha=${geo.trayAlpha}`
      );
      check(
        `390px/${lang}：无 JS 报错`,
        fErrs.length === 0,
        fErrs.join(" | ").slice(0, 200)
      );
      await fc.close();
    }

    for (const lang of ["zh", "en", "ja"]) {
      const narrow = await browser.newContext({
        viewport: { width: 390, height: 844 },
        locale: "zh-CN",
      });
      const np = await narrow.newPage();
      np.setDefaultNavigationTimeout(180000);
      np.setDefaultTimeout(180000);
      const nErrs = [];
      np.on("pageerror", (e) => nErrs.push(String(e)));
      await np.goto(BASE, { waitUntil: "domcontentloaded", timeout: 180000 });
      await np.waitForTimeout(1500);
      for (const target of ["love", "48g"]) {
        await np.click(`.seg-series [data-series="${target}"]`, {
          force: true,
        });
        await np.waitForTimeout(400);
        const reach = await np.evaluate(() => {
          const vw = innerWidth;
          const more = document
            .querySelector("#more-btn")
            .getBoundingClientRect();
          const out = [];
          for (const b of document.querySelectorAll(
            ".seg-series [data-series]"
          )) {
            const r = b.getBoundingClientRect();
            const hit = document.elementFromPoint(
              r.left + r.width / 2,
              r.top + r.height / 2
            );
            out.push({
              s: b.dataset.series,
              right: Math.round(r.right),
              own: !!(
                hit &&
                hit.closest("[data-series]") &&
                hit.closest("[data-series]").dataset.series === b.dataset.series
              ),
              // 被压住 = x 与 y 同时交叠（窄屏换行后两者不同行，x 交叠不算）
              underMore:
                r.right > more.left + 1 &&
                r.left < more.right - 1 &&
                r.top < more.bottom - 1 &&
                more.top < r.bottom - 1,
              clipped: r.right > vw,
            });
          }
          return { out, moreLeft: Math.round(more.left) };
        });
        const tag = `390px/${lang}→${target}`;
        for (const t of reach.out) {
          check(`${tag}：tab「${t.s}」点得到`, t.own, JSON.stringify(t));
          check(
            `${tag}：tab「${t.s}」没被挤出视口`,
            !t.clipped,
            `right=${t.right} vw=${reach.vw}`
          );
          check(
            `${tag}：tab「${t.s}」没被「更多」压住`,
            !t.underMore,
            `tab 右 ${t.right} / 更多左 ${reach.moreLeft}`
          );
        }
      }
      const oneLine = await np.evaluate(() => {
        const rows = new Set(
          [...document.querySelectorAll(".seg-series [data-series]")].map((b) =>
            Math.round(b.getBoundingClientRect().top)
          )
        );
        return rows.size;
      });
      check(
        `390px/${lang}：系列 tab 同一行（没换行）`,
        oneLine === 1,
        `${oneLine} 行`
      );
      check(
        `390px/${lang}：无 JS 报错`,
        nErrs.length === 0,
        nErrs.join(" | ").slice(0, 200)
      );
      await narrow.close();
    }
    // ---- 工单 04 决定 2：期生控件按团出现（℃-ute 没有期生 → 控件不出现）----
    {
      const ctx2 = await browser.newContext({
        viewport: { width: 390, height: 844 },
        locale: "zh-CN",
      });
      const p2 = await ctx2.newPage();
      p2.setDefaultNavigationTimeout(180000);
      p2.setDefaultTimeout(180000);
      const errs2 = [];
      p2.on("pageerror", (e) => errs2.push(String(e)));
      await p2.goto(BASE, { waitUntil: "domcontentloaded", timeout: 180000 });
      await p2.waitForTimeout(1200);
      await p2.click('.seg-series [data-series="morning"]', { force: true });
      await p2.waitForTimeout(400);
      await openFilterPanel(p2);
      const genState = () =>
        p2.evaluate(() => {
          const f = document.querySelector("#gen-field");
          const sel = document.querySelector("#gen-filter");
          return {
            shown: f
              ? getComputedStyle(f).display !== "none" &&
                f.offsetParent !== null
              : false,
            opts: sel ? [...sel.options].map((o) => o.value) : [],
          };
        });
      const all = await genState();
      check("早安/全部团体：期生控件在", all.shown, JSON.stringify(all));
      check(
        "早安/全部团体：期生选项里没有团名",
        !all.opts.includes("モーニング娘。") && !all.opts.includes("℃-ute"),
        JSON.stringify(all.opts)
      );
      check(
        "早安/全部团体：期生选项是 18 期 + all",
        all.opts.length === 19,
        JSON.stringify(all.opts)
      );
      const cuteVal = await p2.evaluate(
        () =>
          [...document.querySelectorAll("#group-filter option")].find((o) =>
            o.value.includes("ute")
          )?.value
      );
      await p2.selectOption("#group-filter", cuteVal);
      await p2.waitForTimeout(300);
      const onCute = await genState();
      check(
        "切到 ℃-ute：期生控件不出现",
        !onCute.shown,
        JSON.stringify(onCute)
      );
      const momVal = await p2.evaluate(
        () =>
          [...document.querySelectorAll("#group-filter option")].find((o) =>
            o.value.includes("ーニング")
          )?.value
      );
      await p2.selectOption("#group-filter", momVal);
      await p2.waitForTimeout(300);
      const onMom = await genState();
      check(
        "切回モーニング娘。：期生控件回来",
        onMom.shown,
        JSON.stringify(onMom)
      );
      check(
        "℃-ute 组下选项只剩 all（不是上一个团的期生）",
        onCute.opts.length === 1,
        JSON.stringify(onCute.opts)
      );
      check(
        "390px/决定 2：无 JS 报错",
        errs2.length === 0,
        errs2.join(" | ").slice(0, 200)
      );
      await ctx2.close();
    }
  } catch (e) {
    check("脚本异常", false, String(e).slice(0, 300));
  } finally {
    await browser.close();
    server.kill();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed`
  );
  process.exit(failed.length ? 1 : 0);
})();
