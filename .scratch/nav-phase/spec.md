# 导航相位（view）转移表 spec

**Status:** ready-for-agent

## Problem

ADR-0012 的导航语义没有实现归属：`view` 的合法转移散在 `app.js` 13 处，步骤条禁用规则与开始按钮谓词各写一遍；这块只有仓外 E2E 覆盖，最近两批都在这里打补丁。

## Solution

把转移规则收成 `core.js` 的两个纯函数（`nav` / `steps`），`app.js` 只转发意图与执行 effect；`view` 仍不持久化。

## User stories

1. 我在对决页点步骤 ① 回挑人：对决保留、续玩卡出现（行为不变）。
2. 我在结果页点步骤 ①：对决丢弃、回挑人（不变）。
3. 我点步骤 ②：进行中的对决 → 回续；已选满且无对决 → 开局；否则不可点（不变）；开局后徽章显示「第 N 题」（不变）。
4. 步骤 ③ 仅在结果相位可点（不变）。
5. 我刷新：有进行中对决时直接回到对决页（boot 由相位恢复，不变）。
6. 我切换系列：对决页对「新系列有对决」→ 停在对决页；结果页对「新系列有结果」→ 停在结果页；否则回挑人（不变）。
7. 对决中我改选任何一位：对决清空、续玩卡消失（既有 session 语义，不变）。
8. **（有意的行为变化）** 有进行中对决时，挑人页托盘按钮显示「继续对决」并回续——不再静默重开丢掉进度；真正重开需先「放弃」。
9. 全部转移规则可从 `core.js` 的两个纯函数读出，并有 node:test 全表覆盖（新）。

## Implementation Decisions

- **`core.js` 新增**：`nav(ctx, intent) → {view, effect}`、`steps(ctx) → [{key, active, enabled, badge}]`；`ctx = {view, phase, selected, size, step}`；intent ∈ `boot / sync / pick / duel / result / start / resume / drop / restart / leave / resort / advance`；effect ∈ `none / start / resume / abandon`；非法 intent 与缺省字段返回 `{view, effect:"none"}`（view 缺省 `"pick"`）。
- **转移表**（唯一出处，与 ADR-0012 一致）：
  - `boot`：view = 相位（duel→duel、result→result、否则 pick）。
  - `sync`：view 能与新相位共存（duel+duel / result+result）则保留，否则 pick。
  - `pick`：view=result 时 effect `abandon`；其余 view=pick、effect none。
  - `duel`：相位 duel → view=duel；相位 pick 且已选满 → view=duel + effect `start`；否则不变。
  - `result`：相位 result → view=result；否则不变。
  - `start`：相位 duel → view=duel + effect `resume`（第 8 条）；已选满 → view=duel + effect `start`；否则不变。
  - `resume`：相位 duel → view=duel；否则不变。
  - `drop` / `restart`：相位 pick 不变；否则 view=pick + effect `abandon`。
  - `leave`：view=pick、effect none（保留对决）。
  - `resort`：相位 result → view=duel + effect `start`；否则不变。
  - `advance`：相位 result → view=result；相位 duel → view=duel；否则不变（保守）。
- **`steps(ctx)`**：`pick` 恒可点（badge `已选/档位`）；`duel` 可点条件 = 相位 duel 或（相位 pick 且已选满），badge = 相位 duel 时的题号；`result` 可点条件 = 相位 result。
- **`app.js`**：`navigate(intent, order?)`（执行 effect：`abandon` → `S.abandonDuel()`；`start` → `beginDuel(order | 打乱已选)`；随后 `paint()`）与 `paint()`（按 view/相位分派 show + render，带纠正）。13 处赋值替换；`renderSteps` 消费 `steps()`；托盘按钮文案：还有空位 →「还差 N 位」、有对决 →「继续对决」（`resume_go`）、否则「开始排序（约 N 题）」。
- **不改**：ADR-0012 语义、session 接口、持久化格式、对决算法、E2E 断言（除第 8 条新增一条）。

## Testing Decisions

- `test/core.test.js`：`nav` 全表（12 intent × ctx 组合 + 缺省/非法）+ `steps` 三态（active/enabled/badge），期望值来自本 spec 的表（独立于实现逐字写死）。
- E2E：v5 脚本补「对决进行中托盘按钮 = 继续对决且回续」；其余回归不改断言（62/62 + 40/40 维持）。

## Out of Scope

- 候选 ②（对决交互门控：answer/undo/键盘/浮层/里程碑）、③（重绘扇出）、⑤（海报几何）、⑥（名册装配契约）——各自单独评审。
- `view` 持久化；跨设备同步；步骤条视觉重做。

## Further Notes

- 架构扫描报告：`/tmp/opencode/architecture-review-20260928-0222.html`（候选 ①）。
- 前置决策：ADR-0012（向导模式语义）、ADR-0008（会话边界）。
