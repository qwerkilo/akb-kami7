# 01: 会话状态模块（session.js）

**What to build:** 新建 DOM 无关的会话状态模块：按系列隔离的档位、已选、对决进度与筛选统一收进模块，对外提供命名方法与 `snapshot()`；持久化沿用现有键与载荷格式。本票只交付模块与其 node 测试，`app.js` 暂不接线——用户可见行为零变化。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `create({storage, byId})` 接口与 spec 一致：`snapshot/switchSeries/setSize/toggleSelect/setFilter/setGroup/setQuery/toggleOpen/startDuel/answer/undo/abandonDuel`
- [ ] `snapshot()` 派生 `phase`（pick/duel/result）、`ranking` 与 `duel` 进度（step/max/percent/remaining/etaSeconds/pair/canUndo），不新增持久化字段
- [ ] 损坏/越权数据丢弃：坏 JSON、版本不符、非法档位、未知/跨系列成员 id、跨系列对决 order
- [ ] 切换系列保留并恢复各自已选与对决进度；改选/改档位作废进度；档位缩小截断已选；满员拒绝；完成后直达结果
- [ ] 非对决相位 `answer`/`undo` no-op（动画期间切系列的竞态在模块内消除）
- [ ] storage 适配器可注入（内存实现跑测试），storage 抛错时不崩溃
- [ ] `test/session.test.js` 覆盖以上规则；`npm test` 全绿；本票不修改 `app.js`

## Comments
