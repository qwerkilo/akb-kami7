# 皮肤系统（原版 / 贴纸）spec

**Status:** ready-for-agent

## Problem

站点现行是 v2/v3 的「贴纸」风格；上游原版的浅灰白卡观感被覆盖后无法找回。用户希望两款风格并存、可切换，且导出海报也跟随所选皮肤。

## Solution

把「皮肤」作为一层主题：同一 DOM 上切换两套 CSS 令牌与组件样式；页头提供切换器；皮肤选择持久化；海报绘制按皮肤注入不同令牌。

## User stories

1. 作为用户，我在页头（中/EN 旁）看到「原版 | 贴纸」切换器，点击即切换整个界面风格。
2. 作为用户，我的选择在刷新后保持（localStorage，全设备一份，与系列无关）。
3. 作为新用户（无存储），我默认看到**原版**（与上游观感一致）。
4. 作为键盘用户，我可以用方向键在切换器内选择、焦点可见。
5. 作为用户，我在任一皮肤下都能完整使用所有功能（系列切换、7/16/32、对决、资料卡、清空）。
6. 作为用户，我导出的海报与当前皮肤一致：原版皮肤导出原版调色（浅灰底、无描边卡片、黄带），贴纸皮肤导出贴纸调色（奶油底、墨描边、柠檬带）。
7. 作为用户，资料卡、托盘、结果列表等所有界面元素都跟随皮肤。
8. 作为英文用户，切换器标签本地化（Classic / Sticker）。

## Implementation Decisions

- **皮肤状态**：`session.js` 新增 `skin`（`"classic"|"sticker"`，默认 `"classic"`），键 `akb:skin`；`setSkin(next)` 校验并持久化；`snapshot().skin`。
- **主题层**：`style.css` 顶部两套令牌（`:root,[data-skin=sticker]` 与 `[data-skin=classic]`），组件样式消费令牌；`app.js` 在 boot 与切换时设置 `document.documentElement.dataset.skin`。
- **切换器**：`index.html` 页头 `.masthead-side` 内新增 `.seg.seg-skin`（radiogroup，两个按钮，44px 触摸目标、`aria-checked`、方向键导航）；文案键 `skin_label` / `skin_classic` / `skin_sticker`（zh/en）。
- **海报**：`poster.js` 令牌新增 `cardStroke`；`slotCard` 的 `lineWidth` 用 `T.cardStroke`，为 0 时跳过 `stroke()`；`app.js` 的 `posterTokens()` 按皮肤返回两套令牌（classic 取上游 `11fa090` 的七色；sticker 为现行默认）。
- **不变**：布局（7/16/32 与金字塔）、题量、交互流程、导出尺寸均不变。

## Testing Decisions

- `test/session.test.js`：skin 默认 classic、setSkin 校验/持久化/非法值拒绝、快照暴露。
- `test/poster.test.js`：注入 classic 令牌时 `cardStroke=0` 不描边、sticker 时 3px 描边；令牌缺省回退不变。
- `test/i18n.test.js`：新键 zh/en 完整性。
- E2E（黑盒）：页头切换 → `html[data-skin]` 变化、刷新保持、默认 classic；海报 canvas 角像素随皮肤变化（#edeff3 vs #f5f1e6）。

## Out of Scope

- 第三款皮肤、自定义配色；皮肤跟随系列；皮肤影响对决赛制或海报布局。

## Further Notes

- 原型：`prototype/ui-v4-skins`（`d0acb5c`，四版切换器；选定 A 页头）。
- 上游原版基准：`11fa090` 的 `style.css` 与 `app.js` 海报段。
