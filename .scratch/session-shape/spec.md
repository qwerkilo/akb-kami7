# 每系列状态形状收成两个家

## 问题

「哪些字段按系列隔离」这个形状是 `{size, selected, duel, cut, deeperRound}`，
它在 `session.js` 里被**各自列举 5 次**：`loadSeries`（读盘）、`save`（落盘）、
`remember`（内存 store）、boot 恢复、切系列恢复。三个清零函数（`clearDuel` /
`resetScreening` / `clearSelection`）又各自手写 `state.cut = []; state.deeperRound = 0;`。

**这个 bug 类在本仓已发生三次**，代码里留着自证：`session.js:115-118` 的注释写明
`deeperRound` 是「第三例」，症状是「同一状态下刷新前后相反」。每次漏一处都要靠一次
累计审查才抓得到，而不是靠形状本身。

## 决定（grill 2026-10-01）

1. **两个具名辅助函数**：`toRecord(state)`（state → 按系列记录，一份字段清单 + 空对决
   转 `null` + 深拷贝）与 `fromRecord(rec)`（记录 → state，boot 与切系列共用）。5 个家 → 2 个。
   显式字段名保留（不像常量循环那样要跳转才能看到字段）。
2. **抽 `clearScreening()`**：清 `cut` + `deeperRound`。三个调用方各自决定要不要连带清
   已选/对决、要不要 `save()`、返回什么 —— 差异留在调用点。
3. **加守卫**：缝④ 加源码断言，那五个字段名除了两个辅助函数以外不得再在 `session.js`
   里出现，防止形状慢慢长回 5 个家。

## 等价性要求

纯搬家的等价重构。判据：**同一套探针在改前/改后输出逐字节相同** —— 探针覆盖
选人 / 筛选 / 划除 / 继续细分 / 提交 / 答一题 / 撤回 / 保存 / 切系列 / 切回来 / 清空 /
换档位，每步打一份 `snapshot()` 与落盘载荷。

## 不做

- 不改任何字段语义、不改存档格式（无需迁移）。
- 不动 `core.deserializeState` / `core.clampCut`（那是 load 路径的夹子，单一出处）。
