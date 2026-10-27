# 02 字体预热按「实际渲染的 family+weight」收口

- **Status**: done
- **Blocked by**: 无（顺序在 01 之后）
- **对应决策**: Q6 = A / Q7 = A1

## 事实

- 现状：任何可见字符 × 所有 family 的子集都预热 → 390px 冷缓存实测 **154 个 woff2 / 1.51MB**。
- `warmFonts` 的纯选择逻辑已在 `core.js`（`fontRange` / `faceCovers` / `warmUrls`），DOM 侧
  `fontCodePoints` 在 `app.js`。

## 实现要点

- 收集可见元素的 `(字符集, computed font-family, computed font-weight)`；family 取字体栈里
  第一个在 @font-face 中出现过的名字（去引号、大小写不敏感）。
- `warmUrls(css, faces)` 只选 `unicode-range` 覆盖该组字符 **且** `font-family`/`font-weight`
  匹配的 face。
- 保留「无 unicode-range 的 face 照常预热」与「无匹配时不预热」的既有语义。

## 验收

1. 同条件探针（390px 冷缓存、同字符集）woff2 数量与字节 **下降 ≥50%**（目标 ≤70 个 / ≤0.7MB）。
2. 缝② 单测覆盖 family/weight 匹配；**≥2 个变异被杀**（匹配反转 / 忽略 weight）。
3. `npm run e2e:pwa` 42/42（离线字体仍工作）、`npm run e2e` 255/255、`npm run check` exit 0。
4. 同条件 A/B 无视觉差异（`document.fonts.ready` 后首屏文本宽度/换行一致）。

## Comments

2026-10-27：落地。`warmUrls(css, usages)` 按 computed `family+weight` 选面（同 family 取
CSS 的「最近权重」规则）；`fontUsages` 只收**可见**叶元素的文本（`getClientRects().length`），
不可见相位不预热（Q7=A1）。

- 实测（390px 冷缓存，同一探针）：woff2 **154 → 51 个**、解码字节 **1,515,108 → 518,520**
  （−66%，超过 ≥50% 的目标）。
- 缝②：新增「只用到 A 时 B 的 face 不预热 / 用到 B 时无 range 照常 / 600 取最近 700」；
  **2 个变异全杀**（忽略 family / 忽略 weight）。
- `npm run e2e:pwa` 42/42、`npm run e2e` 255/255、`npm run check` exit 0。
- 如实记：探针里 woff2 的 `transferSize` 恒 0（Chromium 内存缓存），所以对比用的是
  `decodedBodySize`（同一口径的前后值）。
