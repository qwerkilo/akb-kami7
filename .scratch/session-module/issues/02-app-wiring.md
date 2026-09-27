# 02: app.js 接线与全量回归

**What to build:** `app.js` 删除自有的状态变量与持久化逻辑（`state`/`seriesStore`/`duel`/`pick`/`series` 与 `saveState`/`loadState`/`switchSeries`/`resumeDuel`/`invalidateDuel`），全部改为消费会话模块的命名方法与 `snapshot()`；渲染、事件转发、i18n、动画延时与海报逻辑不变。完成后做两轴代码审查并记录检查点。

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `app.js` 不再持有状态与持久化代码，只保留渲染/事件/i18n/动画/海报
- [ ] 用户可见行为与文案零变化：E2E 42 项黑盒全绿、无 JS 报错
- [ ] `npm test` 全绿（core/i18n/产物/session/python）；`node --check` 通过
- [ ] 两轴（Standards/Spec）代码审查完成；`docs/reviews/checkpoints.md` 追加本轮记录

## Comments
