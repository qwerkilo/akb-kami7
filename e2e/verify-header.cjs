// 复核 P0 修复：档位 × 语言 × 在线/离线，每个 tab 都必须点得到
const { loadPlaywright } = require("./_playwright.cjs");
const { chromium } = loadPlaywright();
const { spawn } = require("node:child_process");
const path = require("node:path");
const ROOT = path.join(__dirname, "..");
const PORT = 8861;
const BASE = `http://127.0.0.1:${PORT}/`;
(async () => {
  const server = spawn(
    "python3",
    [path.join(__dirname, "serve.py"), String(PORT)],
    {
      cwd: ROOT,
      stdio: "ignore",
    }
  );
  // try/finally：任何页面操作抛错都要关浏览器、杀服务器（否则留一个 8861 的僵尸进程 ——
  // 历轮 preflight 真的报过这种残留）
  let browser = null;
  let bad = 0,
    n = 0;
  try {
    await new Promise((r) => setTimeout(r, 1200));
    browser = await chromium.launch();
    for (const lang of ["zh", "en", "ja"]) {
      for (const size of [7, 16, 40]) {
        for (const series of ["48g", "sakamichi", "love", "morning"]) {
          const ctx = await browser.newContext({
            viewport: { width: 390, height: 844 },
            locale: "zh-CN",
          });
          const page = await ctx.newPage();
          await page.goto(BASE + "?cb=" + Date.now(), {
            waitUntil: "domcontentloaded",
            timeout: 120000,
          });
          await page.waitForTimeout(1500);
          await page.evaluate(
            ([l, sz]) => {
              localStorage.setItem("akb-lang", l);
              const bySeries = {
                "48g": [],
                sakamichi: [],
                love: [],
                morning: [],
              };
              for (const g of window.AKB_GROUPS)
                bySeries[g.series].push(...g.members);
              const idsOf = (k) => bySeries[k].slice(0, sz).map((m) => m.id);
              // 三个系列都要种：switchSeries 对没有存档的系列回落 {size:7}，
              // 只写 48g 的话「档位 × 系列」是假交叉（当年三系列 54 个状态里 18 个量的是 7 档）。
              for (const k of ["48g", "sakamichi", "love", "morning"]) {
                localStorage.setItem(
                  "akb:state:v2:" + k,
                  JSON.stringify({
                    v: 1,
                    size: sz,
                    selected: idsOf(k),
                    duel: null,
                  })
                );
              }
            },
            [lang, size]
          );
          await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
          await page.waitForTimeout(700);
          await page
            .click(`.seg-series [data-series="${series}"]`, { force: true })
            .catch(() => {});
          await page.waitForTimeout(300);
          for (const off of [false, true]) {
            await ctx.setOffline(off);
            await page.waitForTimeout(500);
            const r = await page.evaluate(() => {
              const seg = document.querySelector(".seg-series");
              const bb = seg.getBoundingClientRect();
              const tabs = [
                ...document.querySelectorAll(".seg-series [data-series]"),
              ].map((x) => {
                const q = x.getBoundingClientRect();
                const hit = document.elementFromPoint(
                  q.left + q.width / 2,
                  q.top + q.height / 2
                );
                return {
                  s: x.dataset.series,
                  l: Math.round(q.left),
                  r: Math.round(q.right),
                  inBox: q.left >= bb.left - 1 && q.right <= bb.right + 1,
                  own: !!(
                    hit &&
                    hit.closest("[data-series]") &&
                    hit.closest("[data-series]").dataset.series ===
                      x.dataset.series
                  ),
                };
              });
              const chip = document.querySelector("#pwa-chip");
              return {
                segW: Math.round(bb.width),
                chip:
                  chip && !chip.hidden
                    ? Math.round(chip.getBoundingClientRect().width)
                    : 0,
                bad: tabs.filter((t) => !t.inBox || !t.own).map((t) => t.s),
              };
            });
            n++;
            if (r.bad.length) {
              bad++;
              console.log(
                `FAIL ${lang}/${size}档/${series}/${off ? "离线" : "在线"} seg=${r.segW} chip=${r.chip} 不可达=${JSON.stringify(r.bad)}`
              );
            }
          }
          await ctx.close();
        }
      }
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
  console.log(
    bad
      ? `\n${bad}/${n} 个状态仍有问题`
      : `\n全部 ${n} 个状态正常（3 语言 × 3 档位 × 4 系列 × 在线/离线）`
  );
  process.exit(bad ? 1 : 0);
})();
