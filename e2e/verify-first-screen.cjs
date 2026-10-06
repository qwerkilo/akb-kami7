// 首屏矩阵：皮肤 × 语言 × 宽度（第五轮扫描候选 5 —— 宽度矩阵此前只在 /tmp，换会话即丢）。
//
// 判据（与主套件 390px 块同源）：
//   ① **托盘之上完整可见的脸 ≥ 一整行的列数**（不是像素阈值 —— 见 e2e.cjs 的判据注释）；
//   ② 无横向滚动。
// 宽度维度覆盖 320/360/375/390/414/560 —— ≤380px 是历史上出过 P0 的地方
// （页头换行 +47px、系列 tab 点不到），而主套件只覆盖 390px 一档。
//
// 档位维**不在本套件**：16/40 档的托盘槽位网格会长高（40 档实测 182px、5 行），
// 这是设计取舍、不是宽度问题（见检查点第六十一轮的记录）；本套件量的是默认 7 档。
const { loadPlaywright } = require("./_playwright.cjs");
const { waitFor } = require("./_wait.cjs");
const { createChecker } = require("./_check.cjs");
const { chromium } = loadPlaywright();
const { spawn } = require("node:child_process");
const path = require("node:path");
const ROOT = path.join(__dirname, "..");
const PORT = 8871;
const BASE = `http://127.0.0.1:${PORT}/`;
const WIDTHS = [320, 360, 375, 390, 414, 560];
const LANGS = ["zh", "en", "ja"];
const SKINS = ["classic", "sticker"];
const STATES = SKINS.length * LANGS.length * WIDTHS.length;
(async () => {
  const server = spawn(
    "python3",
    [path.join(__dirname, "serve.py"), String(PORT)],
    {
      cwd: ROOT,
      stdio: "ignore",
    }
  );
  let browser = null;
  // 每个状态两条检查（见脸 / 横滚）
  const checker = createChecker({ name: "first", expect: STATES * 2 });
  const check = checker.check;
  try {
    await new Promise((r) => setTimeout(r, 1200));
    browser = await chromium.launch();
    for (const skin of SKINS) {
      for (const lang of LANGS) {
        for (const width of WIDTHS) {
          const label = `${skin}/${lang}/${width}px`;
          const ctx = await browser.newContext({
            viewport: { width, height: 844 },
            locale: "zh-CN",
          });
          // addInitScript 在每次导航前跑：语言 / 皮肤 / 档位一次种好（7 档 = 默认档，
          // 与判据建立时量的是同一个状态）
          await ctx.addInitScript(
            ([l, s]) => {
              localStorage.setItem("akb-lang", l);
              localStorage.setItem("akb:skin", s);
              for (const k of ["48g", "sakamichi", "love", "morning"]) {
                localStorage.setItem(
                  "akb:state:v2:" + k,
                  JSON.stringify({ v: 1, size: 7, selected: [], duel: null })
                );
              }
            },
            [lang, skin]
          );
          const page = await ctx.newPage();
          page.setDefaultNavigationTimeout(180000);
          page.setDefaultTimeout(180000);
          await page.goto(BASE + "?cb=" + Date.now(), {
            waitUntil: "domcontentloaded",
          });
          await waitFor(
            page,
            `${label} 名册`,
            () => document.querySelectorAll(".card").length > 0,
            { timeout: 90000 }
          );
          await page.waitForTimeout(600);
          const geo = await page.evaluate(() => {
            const trayTop = document
              .querySelector("#tray")
              .getBoundingClientRect().top;
            const cards = [...document.querySelectorAll(".card")];
            const cols = new Set(
              cards
                .slice(0, 6)
                .map((c) => Math.round(c.getBoundingClientRect().left))
            ).size;
            const fullFaces = cards.filter((c) => {
              const x = c.getBoundingClientRect();
              return x.top >= 0 && x.bottom <= trayTop + 1;
            }).length;
            return {
              cols,
              fullFaces,
              firstTop: cards[0]
                ? Math.round(cards[0].getBoundingClientRect().top)
                : -1,
              scrollW: document.documentElement.scrollWidth,
              innerW: window.innerWidth,
            };
          });
          check(
            `${label}：首屏完整可见 ≥ 一整行脸`,
            geo.cols > 0 && geo.fullFaces >= geo.cols,
            `${geo.fullFaces} 张完整可见 / ${geo.cols} 列（第一张卡 top=${geo.firstTop}）`
          );
          check(
            `${label}：无横向滚动`,
            geo.scrollW <= geo.innerW + 1,
            `scrollWidth=${geo.scrollW} innerWidth=${geo.innerW}`
          );
          await ctx.close();
        }
      }
    }
  } finally {
    // 任何抛错都要关浏览器、杀服务器（否则留一个 8871 的僵尸进程）
    if (browser) await browser.close();
    server.kill();
  }
  process.exit(checker.done());
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
