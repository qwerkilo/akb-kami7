# 06 · 首访优化取舍

- **Type**: grilling
- **Status**: resolved
- **Blocked by**: 01, 02

## Question

基于 01/02 的实测，决定首访要动哪几项（JS 拆分、字体、CSS、图片），每项的收益、风险、验收口径与不做理由。

## Answer

2026-10-30 用户拍板：

- **本轮首访只做零视觉三项**：延后 `bios.js`+`poster.js`（约 −129K）、字体预热 C1–C3
  （500 拆品牌 `text=` / Dela 延后 / 修 `warmUrls` 权重与 family 覆盖，zh 约 −51%）、
  修 SW 重复拉 `index.html`（约 −25K）。
- **字体可靠性**：先加 preconnect + 失败留痕（不再静默回退）；自托管 UI 子集另立票。
- **验收**：zh 首访 ≤ 1.15MB；LCP ≤ 700ms；字体失败必须可见/留痕；同条件 A/B
  （390/1280 × zh/en × 两皮肤）；首屏矩阵 145/145 不降。
- **排除**：图片交付（thumb/full 尺寸与格式）与 `members.js` 按系列拆本轮不做。
- **两个缺陷**（`image_query_files` 键不匹配、pwa 字体门恒假）另走 `diagnosing-bugs`，
  与优化决策并行。
