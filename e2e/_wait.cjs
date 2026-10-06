// 等待的统一入口：**可以失败，但不可以沉默**。
//
// 为什么：主套件 21 分钟里有 18 分钟是 9 次 `ready()` 各烧满 120s 超时 —— 条件恒假
// （名册的 `<img loading="lazy">` 在视口外永不加载），而 `.catch(() => {})` 把超时吞掉：
// 不报错、不失败，只是安静地烧。任何「等一等、失败就继续」的地方都走这里 ——
// 超时打一行 ⚠（含标签与超时值），慢过 `SLOW_WAIT_MS` 的等待报耗时。
const { waitTicker } = require("./_progress.cjs");

const SLOW_WAIT_MS = 5000;

async function _run(label, timeout, call) {
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
    console.log(
      `  ⚠ 等待超时：${label}（${timeout}ms）—— 后面的断言可能读到未就绪状态`
    );
    return false;
  } finally {
    clearInterval(poll);
  }
}

/** 等 `fn` 为真。返回是否等到（超时会打 ⚠，不抛）。 */
function waitFor(pg, label, fn, { timeout = 15000 } = {}) {
  return _run(label, timeout, () => pg.waitForFunction(fn, null, { timeout }));
}

/** 等选择器出现。返回是否等到。 */
function waitForSelector(pg, label, sel, opts = {}) {
  const timeout = opts.timeout ?? 15000;
  return _run(label, timeout, () =>
    pg.waitForSelector(sel, { ...opts, timeout })
  );
}

/** 给「等一等、失败就继续」的旧写法用：至少让超时**出声**（不静默）。 */
function noteTimeout(label) {
  console.log(`  ⚠ 等待超时：${label}（后面的断言可能读到未就绪状态）`);
}

module.exports = { waitFor, waitForSelector, noteTimeout };
