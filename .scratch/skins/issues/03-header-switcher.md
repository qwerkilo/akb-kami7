# 03 页头切换器

**Status:** ready-for-agent
**Blocked by:** 02

## What to build

`index.html` 页头 `.masthead-side` 新增 `.seg.seg-skin`（radiogroup：原版 / 贴纸，带色板点）；i18n 键 `skin_label`/`skin_classic`/`skin_sticker`；`app.js` 接线 `session.setSkin` 并同步 `html[data-skin]`；方向键导航与焦点环；44px 触摸目标。

## Acceptance

- [ ] 点击切换即时生效；刷新后保持；键盘方向键可切换
- [ ] zh/en 标签正确（原版/贴纸，Classic/Sticker）
- [ ] E2E 新增：切换 → `html[data-skin]` 变化、持久化、默认 classic
- [ ] `npm test` 全绿
