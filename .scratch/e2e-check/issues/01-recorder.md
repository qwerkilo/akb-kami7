# 工单 01：共享记录器 `e2e/_check.cjs`

- **Status**: ready-for-agent
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
