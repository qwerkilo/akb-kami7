# 02 CSS 皮肤层（两套令牌）

**Status:** ready-for-agent
**Blocked by:** 01

## What to build

`style.css` 顶部改为两套皮肤令牌（classic = 上游 `11fa090` 七色；sticker = 现行），组件样式消费令牌；`app.js` boot 时按 `snapshot().skin` 设置 `html[data-skin]`（此时默认 classic 生效，页面呈现原版观感，但还没有切换器）。

## Acceptance

- [ ] 默认（无存储）打开页面为原版观感：浅灰底、白卡细边、10px 圆角、粉主按钮、黄带
- [ ] 贴纸令牌下与现状像素级一致（现有 E2E 55 项通过）
- [ ] `npm test` 全绿
