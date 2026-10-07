# 工单 03：守卫（防回流）

- **Status**: resolved
- **Blocked by**: 02

## 实现（`test/e2e-source.test.js`，剥注释后扫）

1. `serve.py` 的 spawn 只许在 `_suite.cjs`（五个套件不许出现 `spawn(` + `serve.py`）。
2. `process.exit(` 只许在 `_check.cjs` / `_suite.cjs` / `run-all.cjs`。
3. 五个套件都必须调 `runSuite(`。

## 判据

- 三条守卫在迁移后全绿；对产品动手验证承重（如把 `_suite.cjs` 的 `process.exit` 挪回
  `e2e.cjs` → 守卫红，随后还原）。
- `npm run check` exit=0。

## 判据与结果

- 新守卫「套件生命周期只有一处」：套件清单**派生自磁盘**（不手抄 —— 本轮扫描候选 6/7 的教训），
  三条断言（不许 serve.py、不许 process.exit、必须 runSuite）+ 执行器三条（serve.py/exit/finally）。
- 既有两条守卫随迁移更新：①「检查记录只有一处」的承重点从套件挪到执行器
  （套件仍必须声明 `expect`、不许自建 checker、不许自接 done）②「都进了 run-all」的派生从
  `createChecker(` 改成 `runSuite(`。
- 承重实测：给 `verify-header.cjs` 注入 `if (false) process.exit(9);` → 守卫红 → 还原（用
  mutate 工具，自动还原）。

## Comments

（实现时填写）
