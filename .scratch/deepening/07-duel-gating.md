# 深化 ⑦：对决交互门控收成一处（报告候选 ②）

**Status:** resolved（2026-09-28）

## 背景

架构扫描（报告候选 ②）：`app.js` 里「对决是否可答」有三个真源——DOM `$("#phase-duel").hidden`、app 的 `view`、session 的 `snap.phase`；浮层/资料卡是否吃掉输入靠 DOM 探测（`$("#duel-intro").hidden` / `$("#profile").hidden`）；`answer` 一个函数叠四道闸（防连点、160ms 后系列比对、视图守卫、session 返回）；50% 里程碑分居两处（`renderDuel` 标记 + `answer` 弹提示）。两次审查各补一道，说明规则无归属处。

## 做了什么

1. **单一门控 `canDuelInput()`**（app.js）：`view === "duel" && snap.phase === "duel" && !introOpen && !profileId`——三个入口（`answer` / `undo` / 键盘）共用；不再探测 DOM。`introOpen` 改为显式状态（`maybeIntro`/`closeIntro` 维护）。
2. **顺带补上一处防御**：门控把 `profileId` 一并纳入（资料卡打开时不吃键盘）。严格说该组合今天不可达——资料卡只能从挑人/结果页打开，而那两处 `view` 不是 duel——属防御项，无对应 E2E（不可复现）。
3. **时间闸语义明确**：160ms 回调先过 `canDuelInput()` 再登记答案——用户在窗口内离开对决页时**丢弃这次点击**（下次回到原题重答），不再发生「看不见的状态变更」。
4. **里程碑单点**：`core.js` 新增 `milestone(percent, shown) → {shown, celebrate}`（阈值 50 一处定义，+1 例单测）；`answer` 跨阈值时庆祝、`renderDuel` 进入已越过的对决只标记；`snap.duel` 为空（对决刚完成）时不判里程碑。

## 验证

- `npm test`：JS 96（+1 milestone）+ Python 77。
- E2E v5 **44/44**（新增：说明卡打开时方向键不作答、Esc 关闭说明卡）；回归 **62/62**。
- 实现中回归 E2E 抓到一次真实回归：里程碑调用未防 `snap.duel === null`（完成决胜后相位变 result），已修并复跑（`answer` 循环 20 次未走空转）。

## 备注

- `answering`（防连点）保留为局部计时标志：属时序而非规则，不并入门控。
- 160ms 动画延迟仍是字面量（可读性足够，未命名常量）。
