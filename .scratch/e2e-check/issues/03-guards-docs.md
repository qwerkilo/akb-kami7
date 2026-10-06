# 工单 03：守卫与文档

- **Status**: ready-for-agent
- **Blocked by**: 01, 02

## 决定

- 守卫（`test/e2e-source.test.js`）：`run-all.cjs` 不许出现 `parseCounts` /
  `compareCounts` / `expect:`；四个套件不许自己打印收尾行（`checks passed` / `项通过` /
  `个状态正常` 等字面量只在 `_check.cjs` 出现）。
- 文档：`AGENTS.md` 的 E2E 行（`e2e:all`）补一句「收尾行与数守恒由 `_check.cjs` 统一」；
  `.scratch/perf-fetch-e2e/issues/01`（并行 runner）的说明如有过时一并订正。

## 判据（可证伪）

1. 变异：在 `run-all.cjs` 恢复一个 `parseCounts` → 守卫红；在 `e2e.cjs` 手写收尾行 → 红。
