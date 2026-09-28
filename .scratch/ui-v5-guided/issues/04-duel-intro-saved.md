# 04 对决说明卡与自动保存提示

**Status:** ready-for-agent
**Blocked by:** 01（新开对决的入口）

## What to build

- **说明卡**：首次**新开**对决时弹出可跳过的说明浮层（最多 N 题、约 M 分钟、进度自动保存）；「开始」与「跳过说明」都持久化到 `akb:duelintro:v1`（try/catch），此后（含刷新）不再出现；**续玩不出现**。
- **保存提示**：对决页进度区常显「进度已自动保存」（含小圆点）。
- **50% 里程碑**：对决进度首次到 50% 时 toast「已完成一半，保持节奏」（每次对决只提示一次）。
- 新键 `duel_intro_title` / `duel_intro_1..3` / `duel_intro_go` / `duel_intro_skip` / `duel_saved` / `halfway`（zh/en）。

## Acceptance

- [ ] E2E：全新存储 → 开始对决 → 说明卡可见 → 点「开始」→ 刷新后重新开始新对决不再出现
- [ ] E2E：续玩（有对决时点 ②）不出现说明卡
- [ ] E2E：「进度已自动保存」在对决页可见
- [ ] E2E：答到 50% 时 toast 出现（用 7 档 14 题，答第 7 题后）
- [ ] `npm test` 全绿
