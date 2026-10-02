# 「可折叠段」在 JS 里实现四遍 → 一遍

## 问题

领域里只有**一个**概念（可折叠段 = 头 + 名称 + 计数 + 已选徽章 + body ✓），
JS 里是四套实现：

| 位置                        | 行数 | 差异                                                |
| --------------------------- | ---- | --------------------------------------------------- |
| `sectionHTML`               | 14   | 期生层；`data-sec`、uid `gen-N`、body 是卡片        |
| `renderRoster` 内联的团体头 | 9    | 团体层；`data-group`、uid `grp-<团>`、body 是期生段 |
| `toggleGroup`               | 29   | 折叠/展开 + **滚动补偿**                            |
| `toggleGroupNode`           | 17   | 同算法，无滚动补偿                                  |
| 两个「已选徽章」循环        | 7    | 只差类名与 dataset                                  |

CSS 侧**是好的**：5 对逗号并列共享规则（`.gen-head,.grp-head` 等）。唯一真实差异是
`.gen-name` 16px vs `.grp-name` 17px —— 同一个老提交里顺手写的，1px 不成设计信号。

「这一层是不是顶层」还被绑在一个筛选状态上：`sectionHTML` 读 `snap.group === "all"`
推出 ` sub` 类。

## 决定（grill 2026-10-01）

1. **渲染器 + toggle 都合**：一个 `sectionHTML({level, id, label, count, picked, body})`
   与一个 `toggleSection(key, 取内容)`；`level` 只决定类名前缀。徽章更新也并进一处。
2. **`level` 显式传参**：`renderRoster` 知道自己在发顶层团体头还是嵌套期生头，
   `sectionHTML` 不再读 `snap.group`。
3. **两处不一致归一**：`.gen-name` / `.grp-name` 同一个字号；折叠补偿两层都做。

## 等价性要求

DOM 结构（标签 / 类名 / `aria-expanded` / `hidden`）在改前改后**逐项相同**；
两处有意的差异只有：字号归一、团体层折叠多了滚动补偿。

## 不做

- 不改 CSS 的逗号并列写法（那是标准共享规则，不是重复）。
- 不改筛选 / 对决 / 海报任何逻辑。
