# 02-screening-ui · 筛选页 UI 与文案 —— 改写为「逐轮二分」版

- **Status**: done（初版语义「筛选到人数 = 档位」已作废，见下方「作废原因」）
- **所属 spec**：`.scratch/screening-flow/spec.md`
- **依据**：`docs/adr/0019-screening-then-rank.md`（2026-09-29 语义改写版）

## 阻塞

- 阻塞于 `01`

## 作废原因

初版实现完成后发现它在数据流下**不可用**：`session.toggleSelect` 在
`selected.length >= size` 时返回 false，所以挑人阶段最多只能选到档位人数；
而提交门槛是 `kept >= size`，于是 `kept = 已选 − 已划 ≤ size`
→ **只有「一个都没划」才可能提交**，「划掉」的唯一后果是把路走死 ✓。

## 现在的内容

筛选页 = **逐轮二分**：每轮把保留组划掉一半（定值门槛），保留组剩 4 人即停；
每轮划完是二选一（提交 or 点「继续细分」进下一轮）；名次由**层级由内到外**填充，
每层内部跑精确全序（`core.replayTiers`）。

| 档位 | 轮次         | 层级（内→外）     | 题数          |
| ---- | ------------ | ----------------- | ------------- |
| 7    | 划 3         | [4, 3]            | 8（原 14）    |
| 16   | 划 8 → 4     | [4, 4, 8]         | 27（原 49）   |
| 40   | 划 20→10→5→2 | [3, 2, 5, 10, 20] | 106（原 177） |

## 涉及缝

- ② `core.js` 纯逻辑：`screenRounds` / `screenStep` / `screenTiers` /
  `tierQuestionMax` / `rankTiers` / `replayTiers` / `tierProgress`（7 条新测试）
- ④ `session.js`：`cut` 从平面 id 数组变成**按轮次分组**；`startDuel` 不再收 order；
  新增 `enterNextRound`
- ⑥ `i18n.js`：`screen_intro` / `screen_min` 语义反转（不再「至少留 N 人」），
  新增 `screen_more` / `screen_round`
- ⑦ E2E：定值门槛的填法、`passScreening` 助手、题数断言改层级求和

## 备注

- 实际题数会**浮动**（mergeSort 的比较次数依赖答案，`worstCase` 只是上界），
  所以 E2E 不判具体题数，判「打完了」。
