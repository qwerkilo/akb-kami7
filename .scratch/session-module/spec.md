# 会话状态模块（session.js）

**Status:** ready-for-agent

## Problem Statement

站点的交互状态（系列、档位、已选、对决进度、筛选）散落在 `app.js` 的 12 个事件处理器里——全文件 44 处直接引用 `state.*`。按系列隔离、改选作废进度、恢复与损坏丢弃这些规则没有单一定义处，上轮的「跨系列串写」事故正由此而来；同时该状态是 DOM IIFE 的内部物，node 测试完全够不到，只有 E2E 黑盒能覆盖。

## Solution

把会话状态收成一个 DOM 无关的模块：命名方法修改 + `snapshot()` 读取，`storage` 适配器与成员查询依赖注入；相位、名次与进度由既有纯函数派生。`app.js` 只保留 DOM 渲染、事件转发、i18n、动画延时与海报，用户可见行为严格不变（E2E 42 项作为回归基线）。

## User Stories

1. 作为用户，切换系列时两个系列各自的已选与对决进度都保留，且绝不串写。
2. 作为用户，刷新后回到上次所在的系列。
3. 作为用户，32 档对决中途刷新能回到原题号；完成后刷新直达结果页。
4. 作为用户，改选或改档位会作废旧进度，不会被带回旧对决。
5. 作为用户，已选满员后再点卡片得到拒绝反馈（托盘 shake），行为与现在一致。
6. 作为用户，档位缩小时超出的已选被截断，与现在一致。
7. 作为用户，存储损坏、版本不符、非法档位或过期成员 id 时静默丢弃并正常启动。
8. 作为用户，撤回、重新选人、这几位重新排序的语义与现在完全一致。
9. 作为维护者，会话的全部规则集中在一个文件里，改动只需看一处。
10. 作为维护者，`app.js` 不再持有状态变量与持久化逻辑，只剩渲染与转发。
11. 作为测试作者，只跨会话模块接口即可驱动「选人 → 切系列 → 对决 → 刷新恢复 → 结果」全流程，无需 DOM。
12. 作为代理（agent），定位状态行为时无需在 800 行 IIFE 里搜索散落的 `state.*` 引用。
13. 作为维护者，E2E 黑盒脚本不因本次重构改动一行，且全绿。

## Implementation Decisions

- 新模块 `session.js`（UMD，风格与 `core.js` / `poster.js` 一致；`index.html` 加载顺序 core → session → poster → app）。
- 接口（来自 grilling 已确认的草案）：

```js
const S = AKB_SESSION.create({ storage, byId });
S.snapshot() → {
  series, size,
  selected: [id…],
  filter, group, query, open: [key…],
  phase: "pick" | "duel" | "result",
  duel: null | { step, max, percent, remaining, etaSeconds, pair: [a, b], canUndo },
  ranking: null | [id…],
}
S.switchSeries(next) / S.setSize(n) / S.toggleSelect(id) → bool
S.setFilter(f) / S.setGroup(g) / S.setQuery(q) / S.toggleOpen(key)
S.startDuel(order) / S.answer(leftWins) → bool / S.undo() / S.abandonDuel()
```

- 派生而非存储：`phase`、`ranking`、`duel` 进度分别由 `CORE.replay` / `CORE.duelProgress` / `CORE.worstCase` 派生。
- 持久化：沿用 `akb:state:v2:<series>` 与 `akb:series` 键与 v1 载荷，`CORE.serializeState` / `deserializeState` 仍是载荷编解码；只持久化 `size` / `selected` / `duel`；筛选、搜索、展开不持久化（维持现状）。
- 恢复语义不变：无效成员 id 丢弃、跨系列 id 拒绝、已完成对决直达结果、题号与答案序列逐位还原。
- `toggleSelect` 满员返回 `false`（app 保留 shake 反馈）；`answer` 在非对决相位 no-op（动画期间的系列切换竞态由此在模块内消除）。
- `startDuel(order)` 由 app 传入 `CORE.shuffle(...)` 的结果（选人与重新排序两个入口一致）。
- `abandonDuel` 等价于现有「重新选人」的作废语义；完成的对决保留在状态中以便刷新直达结果。
- `app.js` 移除 `state` / `seriesStore` / `duel` / `pick` / `series` 变量与 `saveState` / `loadState` / `switchSeries` / `resumeDuel` / `invalidateDuel` 逻辑；保留渲染、事件转发、i18n、动画延时、海报。
- 不改 UI、不改文案与命名、不改存储键与载荷版本。

## Testing Decisions

- 好测试：只跨接口断言外部行为（可见结果与状态转移），不触碰存储内部格式；期望值来自规格中写明的规则（隔离、截断、丢弃、作废），不是把实现重算一遍。
- 缝：唯一新 seam 是 `session.js` 的接口，测试注入内存 storage 与假成员表；`core.js` 测试与成员产物测试不受影响。
- 新测试 `test/session.test.js`（node:test，风格同 `test/core.test.js`）：启动恢复、损坏丢弃（坏 JSON / 版本不符 / 非法 size / 非法 id / 跨系列 id）、切换保留与恢复、改选作废、档位截断、满员拒绝、对决推进与撤回、完成直达结果、答案序列一致性、非对决相位 `answer` no-op。
- E2E（临时脚本，不入仓）42 项必须全绿且无 JS 报错——黑盒行为不变的硬验收。

## Out of Scope

- 不改变任何用户可见行为、文案或命名。
- 不持久化筛选 / 搜索 / 展开状态。
- 不引入 `dispatch` / 订阅机制 / 结果快照持久化。
- 不重构渲染函数、i18n 绑定机制（架构扫描候选 ②④⑤ 另行处理）。

## Further Notes

- 前置已落盘：ADR-0008（`session.js` 深模块）、CONTEXT 术语「会话」。
- 预估拆票：① `session.js` + 单测（新缝，无 UI 改动）；② `app.js` 接线 + 全量回归（E2E 42 项硬门槛）。
- 风险与对策：接线阶段避免双状态并存产生分叉——先建模块并测绿，再一次性接线以 E2E 验收。
