# 06: UI 对决页 + 续玩

**What to build:** 对决页按贴纸语言重写：进度百分比、剩余题数、预计时长、撤回、32 档长流程体验；对决进度（order + answers）持久化，刷新或关页后可继续（题号与已答序列一致）。

**Blocked by:** 05

**Status:** resolved

- [x] 32 档进度与预计时长展示正确（最坏 129 题）
- [x] 刷新后恢复进行中的对决（题号与已答序列一致）
- [x] 撤回与「同一答案序列还原同一名次」不变
- [x] E2E 对决段（含续玩）通过

## Comments

2026-09-27：`advance` 改用 `CORE.duelProgress`（进度条百分比 + 新增 `#duel-extra`：已完成 x% · 预计还需 n 题 · 约 m 分钟）；对决状态（order+answers）随 `saveState` 按系列持久化；新增 `resumeDuel`（启动与系列切换时恢复，中途刷新回原题号，已完成则直接进结果，失效 id 自动丢弃）；`invalidateDuel` 在改选/改档位时清进度。E2E +3（32 档最坏 129、进度文案、刷新续玩），36/36 绿。（补充）恢复已完成对决时发现 32 档 129 答超出旧校验上限，`deserializeState` 的 answers 上限改为 `worstCase(order)` 并补单测。
