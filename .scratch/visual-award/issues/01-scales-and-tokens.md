# 01 · 设计刻度、中性阶、动效令牌与对比度

- **Status**: ready-for-agent
- **所属 spec**：`.scratch/visual-award/spec.md`
- **依据**：`docs/adr/0020-visual-language.md` §4 §5 §6

## 内容

先立刻度，再改页面：

1. **字阶 5 级**（12 / 14 / 16 / 20 / 28）与**间距 4 的倍数**（4 / 8 / 12 / 16 / 24 / 32）
   落成令牌，把 `style.css` 里散写的 14 个字号与刻度外产物（7px / 14px）映射过去。
   正文从 15px → 16px。
2. **中性阶补到 6 级**（同一冷灰色相，`--floor` / `--card` / `--line` / `--muted` / `--ink`
   之间补齐），主色 `--peach` `#e4007f` 不动。
3. **动效令牌**三档时长（快 120 / 中 200 / 慢 320）+ 一条缓动；
   `prefers-reduced-motion: reduce` 时全部关闭。
4. **对比度硬指标**：正文 / 次要文字 / 图标 ≥4.5:1；占位图首字 ≥3:1。
   现状三处欠账：`--muted` 在页底 4.33、`--peach` 作正文 3.96、占位首字 2.11。
5. **修 `.kami` 的真缺陷**：`::after` 洋红条在窄屏 `top:20px` 压在 20px 字面上，
   改成随字号走的偏移。
6. 令牌改动**同步** `poster.js` 的 `defaultTokens()`（等值守卫），
   以及 `test/poster.test.js` 里逐值相等的断言。

## 涉及缝

- ③ 产物不变式：`test/style-artifact.test.js`（令牌键集相同 / `:root` 挂原版块且原版块在前 /
  窄屏横账生效值）、`test/poster.test.js`（poster↔CSS 等值）

## 判据

- 三处对比度欠账达标，判据是**数字断言**（不是观感）
- `prefers-reduced-motion: reduce` 下 `transition` / `animation` 全部为 none
- `style.css` 里不再出现刻度外的字号与间距值
- `poster.js` 兜底与 CSS 逐值相等（等值守卫仍然通过）

## 备注

- 这一片**不改任何布局**，只改令牌与值。布局改动在 02/03/04。
- 正文 15 → 16px 会让窄屏横账更紧 —— 02/03 的横账预算要重新量。
