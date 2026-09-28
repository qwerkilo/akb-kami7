# 01 core 转移表 nav / steps

**Status:** resolved
**Blocked by:** 无

## What to build

`core.js` 新增导航相位段：`nav(ctx, intent) → {view, effect}` 与 `steps(ctx) → [{key, active, enabled, badge}]`，逐字实现 spec 的转移表；导出两函数。无 DOM、无 session 依赖。

## Acceptance

- [x] `test/core.test.js` 全表覆盖：12 个 intent × 相位/视图组合、`steps` 的 active/enabled/badge、缺省字段与非法 intent（先红后绿）
- [ ] `npm test` 全绿（JS 计数增加；Python 不变）
- [ ] app 未接线，无用户可见变化

## Comments

2026-09-28：`core.js` 新增 `nav(ctx,intent)` / `steps(ctx)` 并导出（与工单 02 的 app 接线同落一提交 `a223fa4`，工单粒度合并，第 3 条勾选说明此点）；`test/core.test.js` +9 例（全表 12 intent × 相位/视图、steps 三态、缺省/非法），JS 92 全绿。
