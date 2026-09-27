# 08: 端到端验收 + 文档

**What to build:** 端到端验收与文档同步：E2E 全流程（48G/坂道 × 7/32 × 续玩）、`npm test`/产物/幂等全绿；更新 AGENTS.md（数据与系列说明、原型指针）、qa-baseline 复检记录与检查点；CONTEXT/ADR 如有新增一并落盘。

**Blocked by:** 06、07

**Status:** resolved

- [x] E2E 全流程通过、无 JS 报错
- [x] 文档同步（AGENTS / qa-baseline / 检查点）
- [x] Prettier/lint-staged 干净、`graph:sync` 完成

## Comments

2026-09-27：E2E 扩到 42 项（48G/坂道 × 7/32 × 简体检索 × 刷新续玩 × 跨系列隔离 × 海报无 undefined），全绿；`npm test` JS 43 + Python 47。文档：AGENTS 概览补 `poster.js`/`simplified.js` 与 v2 能力；qa-baseline 追加「v2 复检」（JS 99.06% 行、Python 93%、E2E 42）；检查点追加第三轮记录（基点 `bbdbb7f`）。审查由两个子代理按 Standards / Spec 两轴执行，实缺 4 项全部修复并各有回归护栏。命名同步：坂道「7福神」、32 档「圈内」。
