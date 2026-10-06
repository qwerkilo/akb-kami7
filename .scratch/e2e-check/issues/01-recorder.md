# 工单 01：共享记录器 `e2e/_check.cjs`

- **Status**: resolved
- **Blocked by**: 无

## 决定

`createChecker({ name, expect, logFile })` 返回：

- `check(label, ok, detail)` —— 记一条；FAIL 时打印并收集（含 detail 截断）；
- `done()` —— 打印失败列表（若有）+ 收尾行 `[name] N/M 通过` + 追加失败日志
  （路径由 `tmpdir()` 派生并确保目录存在）+ 返回 exit code（有失败非零；
  `expect` 给了且 `total !== expect` 也算失败，打印「check 数守恒：声明 X 实得 Y」）。

`e2e/_wait.cjs` 的 `noteTimeout` 与它是邻居（记录器不管等待）。

## 判据（可证伪）

1. 纯函数/记录器单测（`test/e2e-check.test.js`）：计数、收尾行格式、exit code、
   expect 自检（多了/少了都红）、失败日志追加（用临时目录）、detail 截断。
2. 变异 ≥2 全杀（expect 自检去掉 / exit code 恒 0）。

## 实现记录（2026-10-06）

- `e2e/_check.cjs`：`createChecker({name, expect, logFile, print})` → `{check, done}`。
  计数、失败列表、失败日志、收尾行（`[name] N/M 通过`）、exit code 一处；`expect` 自检
  （声明 X 实得 Y 也算失败）；`done()` **幂等**；`TRUNC = 200` 一处截断。
- **失败日志**：路径 tmpdir 派生 + **每套件一份**（`e2e-fails-<name>.log`）+ **构造时清空**
  - **失败即时写**（两轴审查：初版只在 `done()` 写、四套件共写一个文件、且丢掉了
    第五十四轮的「按轮清空」—— 三条都修回）。
- 单测 `test/e2e-check.test.js`（8 条）：收尾行格式、计数/exit code、数守恒（多了/少了）、
  失败列表+日志、detail 截断、每套件路径、即时写+清空、`done()` 幂等。
- 变异：去掉数守恒 / exit 恒 0 → 被杀（审查者复跑确认）。

## 两轴审查后的修复（2026-10-06）

- **高：`e2e-pwa.cjs` 的清理是死代码** —— `process.exit(checker.done())` 排在
  `browser.close()`/`server.kill()` 之前，两行永不执行；实测 8781 上留了孤儿进程
  （已 kill）。修：先 `const code = checker.done()`，再关浏览器/杀服务器，最后
  `process.exit(code)`。**另三个套件的清理都在 `finally` 里，不受影响**（逐个核对过）。
- 中：失败日志的三处回退（见上）。
