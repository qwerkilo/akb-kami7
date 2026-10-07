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
      // fetch 也要有上界：端口被「接受连接但不响应」的进程占用时，单次 fetch 能远超 10s
      const r = await fetchFn(base, { signal: AbortSignal.timeout(1000) });
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
 * 错误语义：body 抛 → `脚本异常` 记一条失败（exit 1）—— 与 e2e/v5 迁移前一致；
 * pwa/header/first 迁移前是未处理拒绝（栈打印），现在同样收敛成 `脚本异常` FAIL
 * （退出码都是 1）。服务器没起来 → 工具失败（exit 2，不占 check 计数）。
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
  // 挂 error 监听：python3 不存在（ENOENT）时未处理的 'error' 事件会直接崩掉进程
  // （退出码 1、且 waitServer 的 exit 2 路径根本走不到）。记下来，就绪失败时一起报。
  let spawnError = null;
  server.on("error", (e) => {
    spawnError = e;
  });
  const checker = createChecker({ name, expect });
  let browser = null;
  let code = 2; // 默认：工具失败（就绪没起来）
  try {
    if (await waitServer(base, { fetchFn, sleepFn })) {
      browser = await launch();
      await body({ browser, base, checker });
      code = checker.done();
    } else {
      console.error(
        `✗ [${name}] 静态服务器未就绪：${base}${spawnError ? `（spawn 失败：${spawnError.message}）` : ""}`
      );
    }
  } catch (e) {
    checker.check("脚本异常", false, String(e).slice(0, 300));
    code = checker.done();
  } finally {
    // 异常路径也必须收干净：关浏览器、杀服务（否则留孤儿进程）。
    // close 自己抛错（浏览器崩了/OOM）也不能吞掉 kill —— 嵌套 try/finally +
    // 不把 close 的异常放出去，否则 exit(code) 都跑不到（这正是本模块要消灭的孤儿类）。
    try {
      if (browser) await browser.close();
    } catch (e) {
      console.error(`⚠ [${name}] 关闭浏览器失败：${e}`);
    } finally {
      server.kill();
    }
  }
  exit(code);
}

module.exports = { runSuite };
