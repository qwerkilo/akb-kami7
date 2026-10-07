// 套件生命周期的唯一出处（第六轮架构扫描候选 2）。
//
// 此前五个套件各手写一遍「spawn serve.py → 就绪 → launch → body → close+kill → exit」，
// 收尾纪律三档（try/finally / catch 后清理 / 无 finally）—— pwa 是 hard 门最多、却
// 没有顶层 finally 的那个：门一抛就留孤儿（现场记录过 8781 残留，preflight 专为此而建）。
//
// 现在：起服务、就绪轮询、起浏览器、finally 清理、退出码都在这里；套件只提供 body。
const cp = require("node:child_process");
const path = require("node:path");
const { createChecker } = require("./_check.cjs");
const { loadPlaywright } = require("./_playwright.cjs");

const ROOT = path.join(__dirname, "..");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 轮询静态服务器就绪（serve.py 的 docroot = 进程 cwd，由 spawn 的 cwd 指定）。
 * 旧写法是四个套件盲等 1200ms：慢机器上不够、快机器上白等。
 */
async function waitServer(
  base,
  { tries = 40, interval = 250, fetchFn = fetch, sleepFn = sleep } = {}
) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetchFn(base);
      if (r.ok) return true;
    } catch (_) {}
    await sleepFn(interval);
  }
  return false;
}

/**
 * 跑一个套件。拥有：spawn serve.py（cwd）、就绪轮询、chromium.launch、finally 清理、
 * `exit(checker.done())`。`body({ browser, base, checker })` 保留套件自己的
 * contexts / pages / 超时选项。
 *
 * 错误语义与迁移前一致：body 抛 → `脚本异常` 记一条失败（exit 1）；服务器没起来 →
 * 工具失败（exit 2，不占 check 计数）。
 *
 * `deps` 是测试注入口（不在测试里改模块级开关）：
 * `{ spawn, launch, fetchFn, exit, sleepFn }`。
 */
async function runSuite({ name, expect, port, cwd = ROOT, body }, deps = {}) {
  const spawn = deps.spawn || cp.spawn;
  const launch = deps.launch || (() => loadPlaywright().chromium.launch());
  const fetchFn = deps.fetchFn || fetch;
  const exit = deps.exit || ((code) => process.exit(code));
  const sleepFn = deps.sleepFn || sleep;

  const base = `http://127.0.0.1:${port}/`;
  const server = spawn(
    "python3",
    [path.join(__dirname, "serve.py"), String(port)],
    { cwd, stdio: "ignore" }
  );
  const checker = createChecker({ name, expect });
  let browser = null;
  let code = 2; // 默认：工具失败（就绪没起来）
  try {
    if (await waitServer(base, { fetchFn, sleepFn })) {
      browser = await launch();
      await body({ browser, base, checker });
      code = checker.done();
    } else {
      console.error(`✗ [${name}] 静态服务器未就绪：${base}`);
    }
  } catch (e) {
    checker.check("脚本异常", false, String(e).slice(0, 300));
    code = checker.done();
  } finally {
    // 异常路径也必须收干净：关浏览器、杀服务（否则留孤儿进程）
    if (browser) await browser.close();
    server.kill();
  }
  exit(code);
}

module.exports = { runSuite };
