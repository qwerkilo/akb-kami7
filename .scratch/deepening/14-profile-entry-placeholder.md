# 深化 ⑭：简介 ⓘ 归属单一出处 + 占位视觉进 tokens

扫描（2026-09-28 v3）批次 3：候选 F 与 C。

## F：ⓘ 的成员归属只看 `data-profile`

**问题**：`.info`（简介入口）不带成员 id——名册侧靠 `closest(".card").dataset.id`（键鼠各写一遍），结果榜单侧靠「`<li>` 在 `children` 里的下标」反查 `ranking`（键鼠各写一遍），隐含「DOM 顺序必须等于 ranking 顺序」的契约。

**做法**：`cardHTML` 与 `renderRankList` 的 `.info` 加 `data-profile="${m.id}"`；`profileIdOf(e)` 统一解析；`profileKey`（Enter/Space）与 `profileClick` 两个委托 handler 同时挂到名册与榜单容器；删掉 `profileKey(e, open, getId)` 的 `getId` 闭包参数与两处 DOM 下标反查。

**验证**：浏览器实测四条路径——名册点击 ⓘ / 名册键盘 Enter / 结果榜单点击 ⓘ / 结果榜单键盘 Space，均打开正确成员、无 JS 报错。

## C：占位视觉进 tokens

**问题**：占位色 `#e4e7ee` / 字色 `#9aa0b0` 跨 `style.css`（4 处）、`poster.js`（3 处）、`core.js`（SVG data-URI）硬编码；深化③把颜色收进 tokens 时漏了占位。ADR-0003 要求「各处占位样式一致实现」。

**做法**：`tokens.colors` 增 `placeholder` / `placeholderInk`（`poster.js` 默认值 = 原常量，行为不变）；`style.css` 增 `--placeholder` / `--placeholder-ink` 并把 4 处硬编码改走变量；`app.js` 的 `posterTokens()` 注入这两个变量。`core.js` 的 SVG 占位（无 DOM 场景）保留自有常量——core 不能读 CSS，跨 core↔poster 的完全合并不现实。

**验证**：占位色默认值与旧常量逐字相同（视觉零变化）；新增测试断言注入自定义 `placeholder/placeholderInk` 后海报填充确实采用；`npm test` JS **130** + Python 83；E2E 86/86、v5 49/49。

## 备注

- 结果榜单的 `ranking` 仍由渲染期持有（DOM 不再反查），`data-profile` 是唯一契约。
- `style.css` 的占位变量两套皮肤同值（贴纸与经典当前都是 `#e4e7ee`），后续可按皮肤分别调。
