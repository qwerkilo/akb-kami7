# 05: UI v2 选人页（D · 贴纸）

**What to build:** 按 D · 贴纸网格方向（原型 `prototype/ui-v2@8b74913`，`?variant=sticker`）重写选人页：Bento 大小块成员网格、系列 tab（48G / 坂道，各自保留状态）、7/16/32 档位、简体搜索、现役/毕业筛选、已选托板与计数、已选持久化恢复；移动优先。

**Blocked by:** 02、03、04

**Status:** resolved

- [x] 系列切换保留各自已选；候选池与搜索限定当前系列
- [x] 档位 7/16/32 与托板/海报格联动
- [x] 简体搜索命中；筛选、计数、分组标题正确
- [x] 刷新后已选恢复（localStorage 按系列）
- [x] E2E 选人段通过

## Comments

2026-09-27：贴纸语言重写 `style.css`（粗描边/硬阴影/糖果色/圆角，保留布局骨架：pick 相位 flex 列 + roster 内滚 + sticky 托板）；`index.html` 增系列 chips、32 档按钮、`simplified.js` 装载；`app.js` 增系列状态仓（按系列 localStorage）、`switchSeries`（保留各自已选/档位，筛选与搜索复位）、`foldIndex` 简体检索、`paintSizeButtons`、启动恢复。i18n 增 `series_*`/`brand_32`/`brand_best7`/`title_prefix_*`/`mode_32`（移除 `mode_7`/`title_7`/`title_16`，标题改为前缀 + 品牌）。E2E +5 项（系列切换品牌与下拉、简体搜索、刷新恢复、32 档托盘与品牌），33/33 全绿；截图核对贴纸视觉。
