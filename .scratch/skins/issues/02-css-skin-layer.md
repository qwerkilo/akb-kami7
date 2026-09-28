# 02 CSS 皮肤层（两套令牌）

**Status:** resolved
**Blocked by:** 01

## What to build

`style.css` 顶部改为两套皮肤令牌（classic = 上游 `11fa090` 七色；sticker = 现行），组件样式消费令牌；`app.js` boot 时按 `snapshot().skin` 设置 `html[data-skin]`（此时默认 classic 生效，页面呈现原版观感，但还没有切换器）。

## Acceptance

- [x] 默认（无存储）打开页面为原版观感：浅灰底、白卡细边、10px 圆角、粉主按钮、黄带
- [x] 贴纸令牌下与现状像素级一致（现有 E2E 55 项通过）
- [x] `npm test` 全绿

## Comments

2026-09-27：两套令牌（`:root/[data-skin=sticker]` 与 `[data-skin=classic]`）落地，组件改用令牌（--border/--shadow-sm/--shadow-xs/--card-_/--thumb-_/--tray-*/--picked-bg/--seg-active-color 等）+ classic 覆盖段（品牌/eyebrow/激活片/展开行/选中卡/托盘空位/进度条/or/海报框/首名徽章/页脚线/资料卡）。验证：默认 classic 截图接近上游；强制 sticker 截图与改动前一致；E2E 55/55。
