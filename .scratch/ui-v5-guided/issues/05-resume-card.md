# 05 续玩卡（继续 / 放弃）

**Status:** ready-for-agent
**Blocked by:** 01

## What to build

选人页在存在进行中对决时显示续玩卡：「有一场进行中的对决 · 第 N / 最多 M 题 · 已完成 P%」+「继续对决」+「放弃」。

- 「继续对决」→ 回到对决原题号（不重开）。
- 「放弃」→ `abandonDuel()`，卡片消失。
- 任何改选（`toggleSelect`）按既有 session 语义清掉对决，卡片随之消失（不新增逻辑）。
- 新键 `resume_title` / `resume_body` / `resume_go` / `resume_drop`（zh/en）。

## Acceptance

- [ ] E2E：开始对决 → 答 2 题 → 点 ① → 续玩卡显示「第 3 / 最多 14 题」→ 点「继续对决」→ 回到对决第 3 题
- [ ] E2E：点「放弃」→ 续玩卡消失，重新选人页干净
- [ ] E2E：对决中返回挑人后改动已选 → 续玩卡消失（既有语义）
- [ ] `npm test` 全绿
