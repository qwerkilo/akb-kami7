# ADR-0013：导航相位（view）落 core 转移表，不持久化

日期：2026-09-28

## 背景

ADR-0012 定了向导模式的导航语义（① 从对决返回不丢进度、改选清空、结果态 ② 禁用、仅「放弃 / 重新选人」显式丢弃），但实现上：`view` 的合法转移散在 `app.js` **13 处**，步骤条禁用谓词与开始按钮谓词各写一遍（`left > 0` vs `!(snap.duel || selected >= size)`），且这块只有仓外 E2E 覆盖。架构扫描（2026-09-28 报告候选 ①）指认：语义有共识、没有实现归属。

## 决定

1. **转移表落 `core.js` 纯函数**：`nav(ctx, intent) → {view, effect}` 与 `steps(ctx) → [{key, active, enabled, badge}]`；`ctx = {view, phase, selected, size, step}`；intent ∈ `boot / sync / pick / duel / result / start / resume / drop / restart / leave / resort / advance`；effect ∈ `none / start / resume / abandon`。
2. **`view` 不持久化**：刷新时由 session 相位恢复（`boot`）；不把 `view` 并入 `session`（不重开 ADR-0008 的边界）。
3. **语义不变**：ADR-0012 的三条语义原样保持，`nav()` 只是它们的唯一实现处。
4. **顺带消除隐式重开**：对决进行中且已选已满时，托盘按钮由「开始排序」改为「继续对决」（intent `start` → effect `resume`）——原实现会静默丢弃进行中的对决；真正重开需先「放弃」。
5. `app.js` 只保留渲染与 effect 执行（调用 session / DOM），不再自行判断转移；`advance`（作答 / 撤回后）表达「对决完成 → 出图」的状态驱动转移。

## 后果

- `core.js` 新增两个导出；`app.js` 的 13 处赋值收成 `navigate(intent)` + `paint()`。
- 转移表与步骤条状态在 `test/core.test.js` 全表覆盖（node:test）；E2E 退回行为回归。
- 候选 ②（对决交互门控）与 ③（重绘扇出）将以本表为前置，后续单独评审。
