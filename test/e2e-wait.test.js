// `e2e/_wait.cjs` 的软/硬两种形态（第五轮扫描候选 4）。
//
// 这批的迁移把 ~24 处裸条件等待分成软（后面有断言兜底）与硬（流程门），
// 所以这里用假 pg 钉住两者的**行为**：软超时返回 false + ⚠；硬超时抛带标签的 Error；
// `hard` 不许透传进 Playwright 的 options。
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { waitFor, waitForSelector, ready } = require("../e2e/_wait.cjs");

/** 假 pg：`waitForFunction`/`waitForSelector` 立刻按 `fail` 抛/成功；记录收到的 options。 */
function fakePg({ fail = false } = {}) {
  const seen = [];
  return {
    seen,
    waitForFunction(fn, arg, opts) {
      seen.push({ call: "fn", arg, opts });
      return fail ? Promise.reject(new Error("timeout")) : Promise.resolve({});
    },
    waitForSelector(sel, opts) {
      seen.push({ call: "sel", sel, opts });
      return fail ? Promise.reject(new Error("timeout")) : Promise.resolve({});
    },
    evaluate() {
      return Promise.resolve();
    },
    waitForTimeout() {
      return Promise.resolve();
    },
  };
}

/** 收集打印行。 */
function capture(fn) {
  const lines = [];
  const orig = console.log;
  console.log = (...a) => lines.push(a.join(" "));
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      console.log = orig;
    })
    .then((value) => ({ value, lines }));
}

test("软等待：超时返回 false 并打 ⚠（含标签与超时值）", async () => {
  const { value, lines } = await capture(() =>
    waitFor(fakePg({ fail: true }), "筛选相位", () => true, { timeout: 5000 })
  );
  assert.equal(value, false);
  assert.ok(
    lines.some((l) => l.includes("等待超时：筛选相位（5000ms）")),
    lines.join(" / ")
  );
});

test("硬等待：超时抛带标签的 Error（流程门）", async () => {
  await assert.rejects(
    () =>
      waitFor(fakePg({ fail: true }), "对决相位", () => true, { hard: true }),
    /等待超时：对决相位（15000ms）/
  );
});

test("等待成功返回 true", async () => {
  const { value } = await capture(() =>
    waitForSelector(fakePg(), "名册", ".card", { timeout: 3000 })
  );
  assert.equal(value, true);
});

test("hard 不许透传进 Playwright 的 options", async () => {
  const pg = fakePg();
  await capture(() =>
    waitForSelector(pg, "名册", ".card", { timeout: 3000, hard: true })
  );
  assert.equal(pg.seen[0].opts.hard, undefined, "hard 是本地开关");
  assert.equal(pg.seen[0].opts.timeout, 3000);
  const pg2 = fakePg();
  await capture(() =>
    waitFor(pg2, "条件", () => true, { timeout: 7000, hard: true })
  );
  assert.equal(pg2.seen[0].opts.hard, undefined);
  assert.equal(pg2.seen[0].opts.timeout, 7000);
});

test("ready：视口内图 → 字体 → settle（软等待，不抛）", async () => {
  const pg = fakePg({ fail: true }); // 图等待失败也不许抛（后面有断言兜底）
  const { value } = await capture(() => ready(pg, { settle: 0 }));
  assert.equal(value, undefined);
  assert.equal(pg.seen[0].call, "fn", "ready 等的是视口内图（函数等待）");
});
