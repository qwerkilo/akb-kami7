# 工单 01：`e2e/_suite.cjs` 执行器 + 单测缝

- **Status**: resolved
- **Blocked by**: 无

## 实现

1. 新模块 `e2e/_suite.cjs`：
   - `waitServer(base, { tries = 40, interval = 250 })` —— 轮询 `fetch(base)`。
   - `runSuite({ name, expect, port, cwd = ROOT, body }, deps = {})` —— 拥有 spawn serve.py
     （cwd、stdio ignore）、就绪、`chromium.launch`、`finally`（close+kill）、`process.exit`。
     `deps` 默认 `{ spawn, launch, fetch, exit, sleep }`（测试注入用；不在测试里改模块级开关）。
   - 错误语义：body 抛 → `checker.check("脚本异常", false, …)` + `checker.done()`（exit 1，与今天一致）；
     就绪超时 → 打印 `✗ [name] 静态服务器未就绪：base` + exit 2（工具失败，不占 check 计数）。
2. `test/e2e-suite.test.js`（四条）：
   - body 抛错 → fake close+kill **都被调用**；
   - 退出码 = `checker.done()`（全绿 0 / 有失败 1）；
   - 就绪超时（fetch 恒 reject + 假 sleep）→ exit 2 + kill 被调用；
   - body 收到 `base` 与 `browser`。
3. `_wait.cjs` 不变；`_check.cjs` 不变。

## 判据

- 单测四条全绿；变异：①finally 里去掉 `server.kill()` ②去掉就绪轮询（直接 launch）→ 均被杀。
- `npm run check` exit=0。

## 判据与结果

- `e2e/_suite.cjs`：`runSuite({name, expect, port, cwd, body}, deps)` + `waitServer`（内部）；
  `deps` 注入 `{spawn, launch, fetchFn, exit, sleepFn}`（测试用，不改模块级开关）。
- 错误语义：body 抛 → `脚本异常` FAIL + exit 1；就绪超时 → exit 2（工具失败，不占 check）。
- 单测 7 条全绿（`test/e2e-suite.test.js`）：抛错仍 close+kill / 退出码=done() / 就绪超时 exit 2
  且 body 不跑 / body 拿到 base+browser / spawn 契约（serve.py+端口+cwd）。
- 变异 4/4 被杀：finally 去掉 `server.kill()`、去掉就绪轮询（直接 launch）、
  扁平 finally（close 抛错跳过 kill）、去掉 spawn 的 error 监听。
- 两轴审查后的加固：`close` 抛错不许吞掉 `kill`（嵌套 try/finally + 警告）、spawn 挂
  `error` 监听（ENOENT 不再直接崩进程）、`fetch` 加 `AbortSignal.timeout(1000)`（让
  「10s 上界」成为真上界）。
- 记账：`waitServer` 曾导出但无人用 → 收敛为只导出 `runSuite`。

## Comments

（实现时填写）
