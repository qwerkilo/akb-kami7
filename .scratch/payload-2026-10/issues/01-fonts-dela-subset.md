# 01 字体：Dela 用 text= 子集 + 覆盖率守卫

- **Status**: done
- **Blocked by**: 无

## 落地

- `index.html` 拆成两条字体链接：Dela（`text=` = 品牌/标题/数字字符集，URL 编码）+ Zen/Nunito（不带 text）。
- 新增 `test/fonts.test.js`：从 `core.names` × 三语 × 3 档 + `pwa_guide_title` + 数字派生必需字符，逐个断言在 `text=` 里；正文字体链接禁止带 `text=`。

## 验证

- 字体 CSS 传输 **117.7KB → 88.1KB**（Dela 部分 29.6KB → 825B）；Dela faces 123 → 1。
- `node --test test/fonts.test.js` 2/2；**变异被杀**：给 `brand_16` 加 `★`（text 未覆盖）→ 红。
- 首访预热 woff2 51 → 48、0.52MB → 0.48MB（Dela 只拉 1 个面）。
