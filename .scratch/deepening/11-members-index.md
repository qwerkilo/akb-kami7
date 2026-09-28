# 深化 ⑪：成员索引单一出处

**Status:** resolved（2026-09-28）

## 背景

「分段 → 成员字段（`group` / `generation` / `series`）摊平」这份知识写过两遍：`app.js:7-16` 与 `test/i18n.test.js` 的自有副本（测试为喂 core 函数而模仿 app）。若 app 侧摊平变化（新增字段、改变语义），测试仍用自己那份，会**静默分叉**——这是测试保真度缺口，不是风格问题。

## 做了什么

1. `core.js` 新增 `flattenMembers(groups)`：原地注入三字段并返回扁平成员列表（纯逻辑、无 DOM、容忍缺 `members` 的分段与空输入）。
2. `app.js`：`GROUPS` 保持分段列表不动，仅索引改走它——`const BY_ID = new Map(CORE.flattenMembers(GROUPS).map((m) => [m.id, m]));`。
3. `test/i18n.test.js` 删掉自有摊平副本，改用 `core.flattenMembers`——测试与生产消费同一实现。
4. 顺带闭环第十一轮遗留：E2E 增加「对决中切皮肤不打断对决」（切皮肤为 CSS 驱动，题号与相位不变）。

## 验证

- `npm test`：JS **108**（+1 `flattenMembers` 例，含「原地注入」身份断言）+ Python 83。
- E2E 回归 **75/75**（+1 对决切皮肤）、v5 44/44。
- 行为不变：`BY_ID` 构建路径等价（同一对象引用、同一字段），E2E 全绿为证。

## 备注

- `m.hay` 的预计算仍留在 app（一次性的缓存层，非契约）——不并进 core，避免 core 承担装配职责。

## 事故与修正（审查后补记）

- 初版 `25848fd` 误把 `GROUPS` 换成 `flattenMembers` 的扁平列表，而 `GROUPS` 仍是 `seriesGroups()` → `groupSections()` 的分段来源（`app.js:94/168/407`），**首屏崩溃**——单测抓不到（`app.js` 无单测缝），E2E 首屏断言当场抓到；`1c30514` 修为「GROUPS 保分段、仅 BY_ID 走索引」。教训：碰 `app.js` 装配必须**先跑 E2E 再提交**。
- 同批 E2E 滚动断言两次修正：「切皮肤保留滚动位置」原用 `#roster.scrollTop`（该元素 `scrollHeight === clientHeight`，恒 0，无判别力）→ 改用页面 `window.scrollY`；Playwright `page.click` 会自动滚回可见区污染断言 → 改 DOM click；换肤有轻微布局位移（滚动锚定 400→386）→ 断言改为「未回顶」（`> 200`）。
- 命名：审查指 `indexMembers` 名不副实（返回列表且原地注入），改为 `flattenMembers`；测试补 `strictEqual(list[0], groups[0].members[0])` 钉住身份契约。
- 评估结论（Standards 建议）：**不给** `members-artifact.test.js` 加 `flattenMembers` 不变量——本次回归是 app 接线错误，产物与 core 未被改坏，任何产物侧断言在坏版与好版都绿；要抓必须执行 `app.js` + DOM，等于把 E2E 缝搬进单测。维持 E2E 兜底。
