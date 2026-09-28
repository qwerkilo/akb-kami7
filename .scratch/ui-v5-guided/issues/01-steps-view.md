# 01 三步指示器与视图状态

**Status:** resolved
**Blocked by:** 无

## What to build

`index.html` 顶部新增 `nav.steps`（三个按钮：挑人 / 对决 / 出图，sticky）；`app.js` 引入本地 `view` 状态（pick/duel/result，boot 按 session 相位初始化），渲染步骤计数徽章与 disabled 规则，并接管导航：

- ① 从对决回挑人：**保留对决**（不 `abandonDuel`），显示挑人页；从结果页点 ① 仍按「重新选人」丢弃。
- ② 有对决 → 回到对决；否则已选满 → `beginDuel()`；两者皆无 → disabled。
- ③ 仅当相位为 result 可点。
- 新键 `step_pick` / `step_duel` / `step_result`（zh/en）。

## Acceptance

- [x] E2E：boot 时 ① 高亮、②/③ disabled 且 ① 徽章为 `0/7`；选满后 ② 可点
- [x] E2E：对决中点 ① → 回到挑人页，`session` 中对决仍在（后续由 05 的续玩卡可见）
- [x] E2E：点 ② 开始对决后徽章显示「第 N 题」
- [x] `npm test` 全绿（i18n 键完整性覆盖新键）

## Comments

2026-09-28：`#steps` 三步指示器 + `view` 状态落地；① 从对决返回保留对决（续玩卡由 05 呈现）；E2E 30/30（步骤条状态、① 保留、② 开局/回续、③ 结果态）。
