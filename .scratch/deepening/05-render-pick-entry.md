# 架构深化 ⑤：选人页渲染单一入口（弱化版）

**What to build:** 把 8 对调用点成对出现的「先 `renderRoster()` 再 `syncSelection()`（必要时 `roster.scrollTop = 0`）」收成一次 `renderPick({resetScroll})`；点选仍走 `syncSelection()` 快速路径。不新建模块、不改行为与性能。

**Blocked by:** None

**Status:** resolved

## Comments

2026-09-27：按 grilling 结论做弱化版——完整版「单入口 + DOM diff」未通过删除测试（全量重绘伤点选性能与滚动，diff 只是把复杂度搬进新机制），归档为不采纳。实现：`renderPick(opts)` 包装重建+联动+可选回滚顶部；团体筛选与搜索用 `{resetScroll:true}`，切换系列/档位/状态筛选/语言/返回选人/启动共 6 处收成一次调用（合计 8 对配对调用）；`toggleMember` 保持 `syncSelection()` 单步。验证：`npm test` JS 59 + Python 47、E2E 42/42。
