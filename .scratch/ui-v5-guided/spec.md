# 交互 v5 · 向导模式 spec

**Status:** ready-for-agent

## Problem

站点流程（挑人 → 对决 → 出图）没有显式导航：首屏是 7 个折叠团体行（要点三层才见到第一张脸）；选人进度只在托盘与「还差 N 位」；对决「自动保存」不可见，离开即等于放弃（只有「重新选人」会清掉进度）；长流程没有说明与续玩入口。

## Solution

按用户选定的原型 A（`prototype/ui-v5-interaction` @ `3e21b26`）折入：三步指示器 + 首屏见脸 + 引导卡 + 进度环/里程碑 + 对决说明卡与保存提示 + 续玩卡。

## User stories

1. 作为用户，我在页面顶部看到常驻三步指示器「① 挑人 N/M › ② 对决 › ③ 出图」，当前步骤高亮，可点击回退/前进。
2. 作为用户，② 在我选满前不可点；选满后点击即开始对决；有进行中对决时点 ② 直接回到对决。
3. 作为用户，我在对决中点 ①（或「保存并返回」）回到挑人页，**对决进度不丢**，页面出现续玩卡；点「继续对决」回到原题号，点「放弃」才丢弃。
4. 作为用户，我改动已选成员（增/删/换档位）会按既有规则清掉进行中的对决，续玩卡随之消失。
5. 作为新用户，我打开页面立刻能看到成员照片（自动展开第一个团体 + 第一期生），不需要点三层。
6. 作为新用户，我首次看到一张引导卡解释三步流程与自动保存；点「知道了」后（含刷新）不再出现。
7. 作为用户，我在选人页看到进度环（已选 N/M）与按团体统计的覆盖 chips；选满时出现里程碑提示且开始按钮醒目。
8. 作为新用户，我**首次**开始对决时看到可跳过的说明卡（最多 N 题、约 M 分钟、进度自动保存）；说明卡只出现一次（含刷新），续玩不再出现。
9. 作为用户，对决页常显「进度已自动保存」，并保留既有键盘（← → / Z）与撤回。
10. 作为英文用户，以上全部文案本地化（en）。

## Implementation Decisions

- **视图状态**：`app.js` 新增本地 `view`（`"pick" | "duel" | "result"`），boot 时按 session 相位初始化；`show(view)` 负责切段。与 `session` 相位解耦的关键：从对决回挑人不再 `abandonDuel()`，只有续玩卡的「放弃」与结果页的「重新选人」才丢弃。
- **步骤条**：`index.html` 新增 `nav.steps`（三个 button，`aria-current` 标记当前，sticky 顶部），`app.js` 渲染计数徽章（① `selected/size`、② 进行中显示 `第 N 题`）与 disabled 规则（② = 有对决或已选满；③ = 相位为 result）。
- **首屏见脸**：`renderRoster()` 前若 `snap.open` 为空且无搜索词且 `group === "all"`，自动 `toggleOpen` 第一团体 + 其第一期生（无新状态，不覆盖用户已折叠状态）。
- **引导卡 / 说明卡**：`localStorage` 键 `akb:coach:v1`、`akb:duelintro:v1`（try/catch 包裹，仿 `akb-lang` 先例）；说明卡只在 `beginDuel()` 新开时出现。
- **进度环 / 覆盖 chips**：`app.js` 以 inline SVG 渲染（与原型一致），数据由 `snapshot().selected` + `BY_ID` 派生，不进 core。
- **里程碑**：选满 → toast「选满啦！…」+ 开始按钮 `emphasis` 类；对决到 50% → toast「已完成一半，保持节奏」（各只提示一次）。
- **toast**：`app.js` 新增轻量 toast（新增 `#toast` 元素，无新模块）；样式消费两套皮肤令牌（新增 `--ok`）。
- **文案**：`i18n.js` 新键（zh/en 成对）：`step_pick`、`step_duel`、`step_result`、`coach_title`、`coach_body`、`coach_ok`、`picked_of`、`picked_full`、`halfway`、`duel_saved`、`duel_intro_title`、`duel_intro_1..3`、`duel_intro_go`、`duel_intro_skip`、`resume_title`、`resume_body`、`resume_go`、`resume_drop`、`start_est`、`empty_search_hint`。
- **不变**：对决算法、题量、海报、皮肤系统、会话持久化格式、`session.js` 接口。

## Testing Decisions

- `test/i18n.test.js`：新键 zh/en 完整性（现有护栏，新键自动纳入）。
- E2E（黑盒，/tmp 脚本）：步骤条状态与导航；① 保留对决 → 续玩卡 → 继续/放弃；首屏见脸；引导卡持久化；进度环与覆盖；选满里程碑与按钮文案；说明卡一次性；50% 里程碑；「进度已自动保存」常显。
- 无 session/core/poster 新逻辑 → 不新增 node:test 用例；`npm test` 应保持 JS 83 + Python 77 全绿。

## Out of Scope

- B/C/D 的机制（答题时间线回退、拖拽作答、三栏工作台、长按简介/手势）；引导内容的多语言排版微调。

## Further Notes

- 原型：`prototype/ui-v5-interaction`（四方案单页，`?variant=A`）。
- ~~已知遗留：卡片「i」26px（< 44px 触控目标）~~ 已闭环（2026-09-28）：视觉圆保持 24px，命中盒扩到 44×44px（`::before` 画圆，点击落在圆外也命中，且不吃选中）；E2E 断言 44×44 与角落命中。
- 原型中「选满后按钮脉冲」以 `emphasis` 类做静态强调，不做无限动画（reduced-motion 友好）。
