// 套件执行器的单测缝（第六轮架构扫描候选 2）。
//
// 「异常路径必须清理」这条不变量此前只能靠真跑观察 —— pwa 没有顶层 finally，
// hard 门一抛就留孤儿（现场记录过 8781 残留）。这里用注入的假 spawn/launch/exit
// 钉住它：body 抛错时 close 与 kill 都必须被调用。
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const SUITE = require(path.join(__dirname, "..", "e2e", "_suite.cjs"));

function fakes({ fetchOk = true } = {}) {
  const calls = { kill: 0, close: 0, exit: null, spawned: [] };
  const server = { kill: () => calls.kill++, on: () => {} };
  const browser = { close: async () => calls.close++ };
  return {
    calls,
    deps: {
      spawn: (cmd, args, opts) => {
        calls.spawned.push({ cmd, args, opts });
        return server;
      },
      launch: async () => browser,
      fetchFn: async () => ({ ok: fetchOk }),
      sleepFn: async () => {},
      exit: (code) => {
        calls.exit = code;
      },
    },
  };
}

test("body 抛错：finally 仍关浏览器、杀服务器（exit 1）", async () => {
  const { calls, deps } = fakes();
  await SUITE.runSuite(
    {
      name: "t",
      port: 9999,
      body: async ({ checker }) => {
        checker.check("ok", true);
        throw new Error("boom");
      },
    },
    deps
  );
  assert.equal(calls.close, 1, "浏览器必须关（孤儿浏览器会吃内存）");
  assert.equal(
    calls.kill,
    1,
    "服务器必须杀（孤儿服务器正是 preflight 抓的东西）"
  );
  assert.equal(
    calls.exit,
    1,
    "脚本异常 = 一条失败 check → exit 1（与迁移前一致）"
  );
});

test("正常路径：退出码 = checker.done()（全绿 0 / 有失败 1）", async () => {
  const a = fakes();
  await SUITE.runSuite(
    {
      name: "t",
      port: 9999,
      body: async ({ checker }) => {
        checker.check("a", true);
      },
    },
    a.deps
  );
  assert.equal(a.calls.exit, 0);
  assert.equal(a.calls.close, 1);
  assert.equal(a.calls.kill, 1);

  const b = fakes();
  await SUITE.runSuite(
    {
      name: "t",
      port: 9999,
      body: async ({ checker }) => {
        checker.check("b", false, "故意失败");
      },
    },
    b.deps
  );
  assert.equal(b.calls.exit, 1, "失败 check → exit 1");
});

test("就绪超时：exit 2（工具失败）、清理照跑、body 不跑", async () => {
  const { calls, deps } = fakes({ fetchOk: false });
  let bodyRan = false;
  await SUITE.runSuite(
    {
      name: "t",
      port: 9999,
      body: async () => {
        bodyRan = true;
      },
    },
    deps
  );
  assert.equal(bodyRan, false, "服务器没起来就不该跑 body");
  assert.equal(calls.exit, 2, "服务器未就绪是工具失败，不占 check 计数");
  assert.equal(calls.kill, 1, "工具失败也必须杀服务器");
  assert.equal(calls.close, 0, "没起浏览器就没什么可关");
});

test("body 拿到 base、browser 与 checker", async () => {
  const { deps } = fakes();
  let got = null;
  await SUITE.runSuite(
    {
      name: "t",
      port: 12345,
      body: async (ctx) => {
        got = ctx;
      },
    },
    deps
  );
  assert.equal(got.base, "http://127.0.0.1:12345/");
  assert.ok(got.browser, "body 用注入的 browser");
  assert.equal(typeof got.checker.check, "function");
  assert.equal(typeof got.checker.done, "function");
});

test("close 抛错：kill 仍要跑到、退出码照给（嵌套 finally）", async () => {
  const calls = { kill: 0, exit: null };
  const deps = {
    spawn: () => ({ kill: () => calls.kill++, on: () => {} }),
    launch: async () => ({
      close: async () => {
        throw new Error("browser crashed");
      },
    }),
    fetchFn: async () => ({ ok: true }),
    sleepFn: async () => {},
    exit: (c) => {
      calls.exit = c;
    },
  };
  await SUITE.runSuite({ name: "t", port: 9999, body: async () => {} }, deps);
  assert.equal(calls.kill, 1, "close 抛错也不能吞掉 server.kill()");
  assert.equal(calls.exit, 0, "清理失败不影响退出码（打印警告，不占 check）");
});

test("spawn 挂 error 监听（ENOENT 不许直接崩进程）", async () => {
  const calls = { exit: null };
  let onError = null;
  const deps = {
    spawn: () => ({
      kill: () => {},
      on: (ev, fn) => {
        if (ev === "error") onError = fn;
      },
    }),
    fetchFn: async () => {
      throw new Error("ECONNREFUSED");
    },
    sleepFn: async () => {},
    exit: (c) => {
      calls.exit = c;
    },
  };
  await SUITE.runSuite({ name: "t", port: 9999, body: async () => {} }, deps);
  assert.ok(onError, "必须挂 'error' 监听 —— 否则未处理事件直接崩掉进程");
  assert.equal(calls.exit, 2, "起服务失败 = 工具失败");
});

test("spawn 的契约：serve.py + 端口 + cwd（pwa 的 TMP 靠它）", async () => {
  const { calls, deps } = fakes();
  await SUITE.runSuite(
    { name: "t", port: 4321, cwd: "/tmp/somewhere", body: async () => {} },
    deps
  );
  assert.equal(calls.spawned.length, 1);
  const [s] = calls.spawned;
  assert.equal(s.cmd, "python3");
  assert.ok(s.args[0].endsWith("serve.py"), s.args[0]);
  assert.equal(s.args[1], "4321");
  assert.equal(s.opts.cwd, "/tmp/somewhere");
});
