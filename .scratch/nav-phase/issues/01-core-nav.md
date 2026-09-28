# 01 core 转移表 nav / steps

**Status:** ready-for-agent
**Blocked by:** 无

## What to build

`core.js` 新增导航相位段：`nav(ctx, intent) → {view, effect}` 与 `steps(ctx) → [{key, active, enabled, badge}]`，逐字实现 spec 的转移表；导出两函数。无 DOM、无 session 依赖。

## Acceptance

- [ ] `test/core.test.js` 全表覆盖：12 个 intent × 相位/视图组合、`steps` 的 active/enabled/badge、缺省字段与非法 intent（先红后绿）
- [ ] `npm test` 全绿（JS 计数增加；Python 不变）
- [ ] app 未接线，无用户可见变化

## Comments
