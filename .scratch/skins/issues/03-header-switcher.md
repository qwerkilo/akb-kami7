# 03 页头切换器

**Status:** resolved
**Blocked by:** 02

## What to build

`index.html` 页头 `.masthead-side` 新增 `.seg.seg-skin`（radiogroup：原版 / 贴纸，带色板点）；i18n 键 `skin_label`/`skin_classic`/`skin_sticker`；`app.js` 接线 `session.setSkin` 并同步 `html[data-skin]`；方向键导航与焦点环；44px 触摸目标。

## Acceptance

- [x] 点击切换即时生效；刷新后保持；键盘方向键可切换
- [x] zh/en 标签正确（原版/贴纸，Classic/Sticker）
- [x] E2E 新增：切换 → `html[data-skin]` 变化、持久化、默认 classic
- [x] `npm test` 全绿

## Comments

2026-09-27：`.masthead-side` 列 + `.seg-skin`（色板点、44px、radiogroup）+ `data-i18n-aria-label` 支持 + i18n 三键 + `paintSkin/switchSkin` + 方向键导航；实测默认 classic、切换、持久化、键盘；E2E 58/58。
