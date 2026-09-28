# 深化 ⑫：名册投影（rosterView）

## 背景

选人页的「过滤 / 计数 / 已选 / 展开」四类派生散在 6 处：`renderRoster`（建树+分组）、`renderSearch`（手写团体/期生/状态/搜索四条件）、`sectionHTML`（段内可见成员 + 两种计数 + 已选，并**副作用写** `SEC_INDEX`）、`toggleGroupNode`（重开组节点再建树）、`syncSelection`（每点选从 `SEC_INDEX` 重数每段已选 + 再建树重数组已选）、`ensureOpen`（首屏再建树）。计数文案 ternary 逐字两份；`pickedInNode` 与 `syncSelection` 是同一计算两种写法；选人页此前只有 E2E 覆盖。

## 做法

`core.js` 新增 `rosterView(sections, {group, generation, status, query, selected})`（纯数据、无 DOM 无文案）：

- 搜索态：`{mode:"search", hits}`（查询归一在投影内做；依赖 app 预计算的 `m.hay`，缺省按空串防御）
- 树/单团态：`{mode:"tree"|"flat", nodes:[{id:"g:团体", group, count, current, picked, sections:[{id:"团体#期生", label, members, count, current, picked}]}]}`
- `pickedTotal` = 已选总数

`app.js`：`rosterView()`（注入 snap 五字段）成为唯一派生入口；`sectionHTML(sec)` 消费投影段；`countText(node)` 收掉重复的计数 ternary；`syncSelection`/`toggleGroup`/`toggleGroupNode`/`ensureOpen` 都从投影取值；**删除** `visible`、`pickedInNode`、`SEC_INDEX`（边信道）。计数文案与 DOM 仍留在 app（i18n 归 DOM 层）。

点选快路径不缓存：每次重算投影（~1375 次检查，微秒级）。

## 验证

- 新增 core 缝 3 例：树模式（分组/计数/已选/空段剔除）、状态与期生过滤 + 单团 flat、搜索模式（命中顺序/过滤叠加/查询归一）
- **行为不变判据**：E2E 回归 **85/85**、v5 **49/49**；`npm test` JS 127 + Python 83
- 净变化：app.js **-25 行**（+60/-85，派生逻辑换位并删掉 SEC_INDEX/visible/pickedInNode）、core.js **+66 行**（投影本体，删 `pickedTotal` 后 -2）、test/core.test.js **+140 行**

## 行为变化（有意，审查确认后保留）

1. **组头「已选 N」口径**：旧实现（`syncSelection` 用不传期生的 `groupSections` + 不看可见性的 `pickedInNode`）计数「该团全部已选」（含被状态/期生筛掉的）；新口径只数**投影内可见成员**的已选——与段头口径自洽、与画面一致（旧口径会出现「组头已选 2、画面 0 张已选卡」）。**已改记录并补回归断言**（core 缝：状态过滤下组/段计数一致）。
2. **`ensureOpen` 选段**：旧实现取未过滤树的 `sections[0]`（可能展开一个被状态筛掉、根本不渲染的段，首屏 0 卡）；新实现取投影首个可见段（首屏见脸在状态筛选下也成立）。E2E 补「全折叠 + 切现役 → 首屏有卡片」断言。

搜索态不显示段/组已选（与原先一致）；`pickedTotal` 经审查确认无生产消费点，已删除。

- `refreshGroupOptions` 仍用 `groupSections` 取团体清单（与名册投影不同的关注点）。
