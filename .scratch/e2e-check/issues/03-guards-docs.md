# 工单 03：守卫与文档

- **Status**: resolved
- **Blocked by**: 01, 02

## 决定

- 守卫（`test/e2e-source.test.js`）：`run-all.cjs` 不许出现 `parseCounts` /
  `compareCounts` / `expect:`；四个套件不许自己打印收尾行（`checks passed` / `项通过` /
  `个状态正常` 等字面量只在 `_check.cjs` 出现）。
- 文档：`AGENTS.md` 的 E2E 行（`e2e:all`）补一句「收尾行与数守恒由 `_check.cjs` 统一」；
  `.scratch/perf-fetch-e2e/issues/01`（并行 runner）的说明如有过时一并订正。

## 判据（可证伪）

1. 变异：在 `run-all.cjs` 恢复一个 `parseCounts` → 守卫红；在 `e2e.cjs` 手写收尾行 → 红。

## 实现记录（2026-10-06）

- 守卫（`test/e2e-source.test.js`）：runner 不许有 `parseCounts`/`compareCounts`/`expect:`
  （**剥注释再扫**）；四套件必须 `createChecker(` + `expect: N` + 把 `checker.done()`
  接到退出码；不许自己 `console.log(…通过…)` 或拼三种收尾格式。
- 变异 5 个全杀：v5 去掉 `process.exit(checker.done())` / 去掉 `expect` / pwa 加一行
  双引号收尾 / 手工加收尾行 / run-all 恢复 `parseCounts`（后两个见工单 01/02 记录）。
- 文档：`AGENTS.md` 的 ⑦ 行补「收尾行与 check 数守恒由 `e2e/_check.cjs` 统一，套件自报
  `EXPECT`」；`run-all.cjs` 顶部注释订正；`.scratch/perf-fetch-e2e/issues/01` 补「后续」段
  （原文提到的 parseCounts/compareCounts 已是历史）。

## 两轴审查后的补做（2026-10-06）

- 守卫加强：初版只查「出现 createChecker(」—— 删掉 `process.exit(checker.done())` 或
  `expect:` 时**没有一层会红**（审查者的 /tmp 副本实验证明）；现补三条承重点断言。
- 审查发现的其余低项：守卫双引号洞（已用 `console.log(…通过…)` 正则补上）、run-all
  注释过时（已改）、perf 工单文档（已补）。
