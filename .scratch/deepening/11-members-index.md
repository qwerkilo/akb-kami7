# 深化 ⑪：成员索引单一出处

**Status:** resolved（2026-09-28）

## 背景

「分段 → 成员字段（`group` / `generation` / `series`）摊平」这份知识写过两遍：`app.js:7-16` 与 `test/i18n.test.js` 的自有副本（测试为喂 core 函数而模仿 app）。若 app 侧摊平变化（新增字段、改变语义），测试仍用自己那份，会**静默分叉**——这是测试保真度缺口，不是风格问题。

## 做了什么

1. `core.js` 新增 `indexMembers(groups)`：原地注入三字段并返回扁平成员列表（纯逻辑、无 DOM、容忍缺 `members` 的分段与空输入）。
2. `app.js` 改为 `const GROUPS = CORE.indexMembers(window.AKB_GROUPS || [])` + `new Map(GROUPS.map(...))`。
3. `test/i18n.test.js` 删掉自有摊平副本，改用 `core.indexMembers`——测试与生产消费同一实现。
4. 顺带闭环第十一轮遗留：E2E 增加「对决中切皮肤不打断对决」（切皮肤为 CSS 驱动，题号与相位不变）。

## 验证

- `npm test`：JS **108**（+1 `indexMembers` 例）+ Python 83。
- E2E 回归 **75/75**（+1 对决切皮肤）、v5 44/44。
- 行为不变：`BY_ID` 构建路径等价（同一对象引用、同一字段），E2E 全绿为证。

## 备注

- `m.hay` 的预计算仍留在 app（一次性的缓存层，非契约）——不并进 core，避免 core 承担装配职责。
