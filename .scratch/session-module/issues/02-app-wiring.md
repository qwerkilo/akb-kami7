# 02: app.js 接线与全量回归

**What to build:** `app.js` 删除自有的状态变量与持久化逻辑（`state`/`seriesStore`/`duel`/`pick`/`series` 与 `saveState`/`loadState`/`switchSeries`/`resumeDuel`/`invalidateDuel`），全部改为消费会话模块的命名方法与 `snapshot()`；渲染、事件转发、i18n、动画延时与海报逻辑不变。完成后做两轴代码审查并记录检查点。

**Blocked by:** 01

**Status:** resolved

- [x] `app.js` 不再持有状态与持久化代码，只保留渲染/事件/i18n/动画/海报
- [x] 用户可见行为与文案零变化：E2E 42 项黑盒全绿、无 JS 报错
- [x] `npm test` 全绿（core/i18n/产物/session/python）；`node --check` 通过
- [x] 两轴（Standards/Spec）代码审查完成；`docs/reviews/checkpoints.md` 追加本轮记录

## Comments

2026-09-27：`app.js` 接线完成（净减 106 行）：删除 `state`/`seriesStore`/`duel`/`pick` 状态变量与 `saveState`/`loadState`/`switchSeries`/`resumeDuel`/`invalidateDuel`/`advance`/`finish`，改为 `session.js` 驱动（`sync()` 镜像 + `snap` 渲染；`beginDuel`/`renderDuel`/`renderResult`/`renderRankList` 收敛）。`index.html` 按 core → session → poster → app 装载。接线中修掉一处 `setSize` 后 `pick` 过期导致品牌显示错误的问题（先 `sync()` 再渲染）。两轴审查（Standards + Spec）结论：Spec 逐条吻合、E2E 实跑 42/42、无越界改动；Standards 1 实缺已修——原「重建恢复」用例未覆盖*进行中*对决与 `undo` 正路径，已补 step 2 / canUndo / pair 断言与 undo 回退断言（`session.js` 行覆盖 98.90%、分支 88.76%）；判断项（`snap/series/pick` 三镜像靠 sync 纪律）接受并记录，nits 已清。检查点见 `docs/reviews/checkpoints.md`。
