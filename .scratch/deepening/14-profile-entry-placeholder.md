# 深化 ⑭：简介 ⓘ 归属单一出处 + 占位视觉进 tokens

扫描（2026-09-28 v3）批次 3：候选 F 与 C。

## F：ⓘ 的成员归属只看 `data-profile`

**问题**：`.info`（简介入口）不带成员 id——名册侧靠 `closest(".card").dataset.id`（键鼠各写一遍），结果榜单侧靠「`<li>` 在 `children` 里的下标」反查 `ranking`（键鼠各写一遍），隐含「DOM 顺序必须等于 ranking 顺序」的契约。

**做法**：`cardHTML` 与 `renderRankList` 的 `.info` 加 `data-profile="${m.id}"`；`profileIdOf(e)` 统一解析；`profileKey`（Enter/Space）挂名册与榜单两个容器，`profileClick` 挂榜单（名册点击在自己的分发器内用同一 `profileIdOf` 早退）；删掉 `profileKey(e, open, getId)` 的 `getId` 闭包参数与两处 DOM 下标反查。榜单的 `.info` 补 `tabindex="0"`，键盘真实可达。

**验证**（审查纠错后重做）：① 名册点击 ⓘ → 正确成员；② 名册键盘（合成 `keydown` 直达 handler）→ 正确成员；③ 榜单 `.info` **真实聚焦**（`tabindex` 生效）后 Enter → 打开正确成员；④ 榜单点击 → 打开**该行**成员（可构造失效场景：把末位 `<li>` 移到首位，旧实现按下标打开 `ranking[0]`、新实现打开行内成员）。此前记录声称的「四条浏览器实测」中两条键盘路径为**脚本假阳性**（`.info` 无 tabindex，`.focus()` 不生效、脚本比到了上一步的残留文本），已由审查指出并订正。

**已知限制**：名册卡片的 ⓘ 仍不可 Tab 到达——它嵌在 `<button class="card">` 内，加 `tabindex` 属非法交互嵌套；正解是卡片结构改造或键盘快捷键，另记跟进。

## C：占位视觉进 tokens

**问题**：占位色 `#e4e7ee` / 字色 `#9aa0b0` 跨 `style.css`（4 处）、`poster.js`（3 处）、`core.js`（SVG data-URI）硬编码；深化③把颜色收进 tokens 时漏了占位。ADR-0003 要求「各处占位样式一致实现」。

**做法**：`tokens.colors` 增 `placeholder` / `placeholderInk`（`poster.js` 默认值 = 原常量，行为不变）；`style.css` 增 `--placeholder` / `--placeholder-ink` 并把 4 处硬编码改走变量；`app.js` 的 `posterTokens()` 注入这两个变量。`core.js` 的 SVG 占位（无 DOM 场景）保留自有常量——core 不能读 CSS，跨 core↔poster 的完全合并不现实。

**验证**：占位色默认值与旧常量逐字相同（Spec 轴用真实 Chromium 对四样式 7 人海报逐像素对拍，与改动前完全一致）；新增测试断言注入自定义占位色被采用**且不得残留硬编码默认色**（对 a/b/d 三样式均咬：把杂志英雄图或拼贴占位回退硬编码即红）；`core.js` 的 SVG 常量补行内注释说明同值关系；`npm test` JS **130** + Python 83；E2E 86/86、v5 49/49。

## 备注

- 结果榜单的 `ranking` 仍由渲染期持有（DOM 不再反查），`data-profile` 是唯一契约。
- `style.css` 的占位变量两套皮肤同值（贴纸与经典当前都是 `#e4e7ee`），后续可按皮肤分别调。
