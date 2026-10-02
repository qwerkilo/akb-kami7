# 工单 01 · 折叠段渲染器与 toggle 合一 + level 显式化 + 两处不一致归一

**规格**：`.scratch/section-node/spec.md`

## 步骤

1. **抓基线**：浏览器探针录下两层折叠段的 DOM 结构、两种皮肤的字号、折叠后视口行为。
2. **合渲染器**：`sectionHTML({level, id, label, count, picked, body})`。
3. **合 toggle**：一个 `toggleSection(key, contentFn)`，滚动补偿两层都做。
4. **level 显式化**：删掉 `sectionHTML` 里读 `snap.group` 的那行。
5. **徽章循环并一处**。
6. **归一两处差异**：字号取同一个值。
7. **等价性**：探针除两处有意的差异外逐项相同。
8. **守卫**（缝③）：`.gen`/`.grp` 类名前缀只从 `sectionHTML` 一处产出；两处字号规则
   不许各自写死。
9. **变异验证**：`mutate.mjs` 打三个（改 level 前缀、把滚动补偿去掉、把字号改回去）。

## 验收

- `npm run check` 全绿；E2E 三套全绿。
- 探针除两处有意差异外相同。
- 版式基线（页头 66/60、托盘 81/84、首卡 385/389）不动。
