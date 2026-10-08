// 首屏矩阵：皮肤 × 语言 × 宽度（第五轮扫描候选 5 —— 宽度矩阵此前只在 /tmp，换会话即丢）。
//
// 判据（与主套件 390px 块同源）：
//   ① **托盘之上完整可见的脸 ≥ 一整行的列数**（不是像素阈值 —— 见 e2e.cjs 的判据注释）；
//   ② 无横向滚动。
// 宽度维度覆盖 320/360/375/390/414/560 —— ≤380px 是历史上出过 P0 的地方
// （页头换行 +47px、系列 tab 点不到），而主套件只覆盖 390px 一档。
//
// 档位维取两端（7 / 40）：40 档的托盘槽位最多，曾是「空槽位换行 → 托盘 300px →
// 首屏 0 张脸」的最坏档（同条件实测见工单 02 的表）；修成单行横向滚动后，
// 档位数只影响横滑长度，7 与 40 都必须过。
const { waitFor } = require("./_wait.cjs");
const { firstScreenGeo, firstScreenOk } = require("./_ui.cjs");
const { runSuite } = require("./_suite.cjs");
const S = require("./_store.cjs");
const path = require("node:path");
const PORT = 8871;
const BASE = `http://127.0.0.1:${PORT}/`;
const WIDTHS = [320, 360, 375, 390, 414, 560];
const LANGS = ["zh", "en", "ja"];
const SKINS = ["classic", "sticker"];
// 档位维取两端：7 档（判据建立时的默认档）与 40 档（托盘槽位最多 → 最坏）。
// 中间档位（16）在两者之间，槽位数只影响换行 —— 40 档过了它必过。
const SIZES = [7, 40];
runSuite({
  name: "first",
  expect: 145, // 数守恒：2 皮肤 × 3 语言 × 6 宽度 × 2 档 × 2 检查 + 「种子生效」1 条
  port: PORT,
  body: async ({ browser, checker }) => {
    const check = checker.check;
    let seedChecked = false;
    for (const skin of SKINS) {
      for (const lang of LANGS) {
        for (const width of WIDTHS) {
          for (const size of SIZES) {
            const label = `${skin}/${lang}/${width}px/${size}档`;
            const ctx = await browser.newContext({
              viewport: { width, height: 844 },
              locale: "zh-CN",
            });
            // addInitScript 在每次导航前跑：语言 / 皮肤 / 档位一次种好（7 档 = 默认档，
            // 与判据建立时量的是同一个状态）
            await S.seedPrefs(ctx, { lang, skin });
            await S.seedStates(ctx, ["48g", "sakamichi", "love", "morning"], {
              size,
            });
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
            // 种子的正面防线（见 header 同款注释）：档位塌成默认 7 时本套件此前照样全绿。
            if (size !== 7 && !seedChecked) {
              seedChecked = true;
              const applied = await page.evaluate(
                () =>
                  document.querySelector(
                    '.seg-size [data-pick][aria-checked="true"]'
                  )?.dataset.pick
              );
              check(
                `种子生效：档位 = ${size}`,
                applied === String(size),
                `实得 ${applied}`
              );
            }
            const geo = await page.evaluate(firstScreenGeo);
            check(
              `${label}：首屏完整可见 ≥ 一整行脸`,
              firstScreenOk(geo),
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
    }
  },
});
