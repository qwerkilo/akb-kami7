// 等待与就绪的统一入口：**可以失败，但不可以沉默**。
//
// 为什么：主套件 21 分钟里有 18 分钟是 9 次 `ready()` 各烧满 120s 超时 —— 条件恒假
// （名册的 `<img loading="lazy">` 在视口外永不加载），而 `.catch(() => {})` 把超时吞掉：
// 不报错、不失败，只是安静地烧。任何「等一等」的地方都走这里 ——
// 软等待超时打一行 ⚠（含标签与超时值）、慢过 `SLOW_WAIT_MS` 的等待报耗时；
// **硬等待**（`hard: true`，流程门）超时抛带标签的 Error（门失败时后面整块都无意义）。
//
// 两种形态的分工（第五轮扫描候选 4）：
// - 软：后面有断言兜底（读到未就绪状态会红）→ 返回 false，调用方继续；
// - 硬：相位/服务/产物就绪这类**门** → 抛，让「脚本异常」带上人能看懂的标签。
const { waitTicker } = require("./_progress.cjs");

const SLOW_WAIT_MS = 5000;

async function _run(label, timeout, call, hard) {
  const t0 = Date.now();
  const ticker = waitTicker(label);
  const poll = setInterval(() => ticker.tick(), 1000);
  try {
    await call();
    const ms = Date.now() - t0;
    if (ms >= SLOW_WAIT_MS)
      console.log(`  …${label} 等了 ${(ms / 1000).toFixed(1)}s`);
    return true;
  } catch {
    const msg = `等待超时：${label}（${timeout}ms）`;
    if (hard) throw new Error(`${msg} —— 后面的断言会读到未就绪状态`);
    console.log(`  ⚠ ${msg} —— 后面的断言可能读到未就绪状态`);
    return false;
  } finally {
    clearInterval(poll);
  }
}

/**
 * 等 `fn` 为真。软（默认）返回是否等到；`hard: true` 超时抛带标签的 Error。
 */
function waitFor(pg, label, fn, { timeout = 15000, hard = false } = {}) {
  return _run(
    label,
    timeout,
    () => pg.waitForFunction(fn, null, { timeout }),
    hard
  );
}

/** 等选择器出现。软（默认）返回是否等到；`hard: true` 超时抛。 */
function waitForSelector(pg, label, sel, opts = {}) {
  const { hard = false, ...rest } = opts;
  const timeout = rest.timeout ?? 15000;
  return _run(
    label,
    timeout,
    () => pg.waitForSelector(sel, { ...rest, timeout }),
    hard
  );
}

/** 给「等一等、失败就继续」的旧写法用：至少让超时**出声**（不静默）。 */
function noteTimeout(label) {
  console.log(`  ⚠ 等待超时：${label}（后面的断言可能读到未就绪状态）`);
}

/**
 * 页面「渲染就绪」（原先 e2e.cjs 与 e2e-v5.cjs 各一份、语义相同）：
 * 视口内图片 + 字体 + 一小段 settle。
 *
 * 注意**不是**「所有图片就绪」：名册卡片的 `<img loading="lazy">` 在视口外永远不会
 * 加载，`imgs.every(complete && naturalWidth>0)` 恒假 —— 实测每次 ready() 都烧满
 * 120s 超时（9 次 = 18 分钟，占整套 21 分钟的 85%）。海报的像素断言另有
 * `#poster-img` 的 data-URL 就绪信号（那才是「画出来了」）。
 */
async function ready(pg, { settle = 600 } = {}) {
  await waitFor(
    pg,
    "视口内图片",
    () => {
      const imgs = [...document.images].filter((i) => {
        const r = i.getBoundingClientRect();
        return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
      });
      return (
        imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0)
      );
    },
    { timeout: 15000 }
  );
  try {
    await pg.evaluate(() => document.fonts.ready);
  } catch {
    noteTimeout("字体");
  }
  await pg.waitForTimeout(settle);
}

module.exports = {
  waitFor,
  waitForSelector,
  noteTimeout,
  ready,
  SLOW_WAIT_MS,
};
