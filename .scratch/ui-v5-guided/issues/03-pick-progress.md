# 03 选人进度环、团体覆盖与里程碑

**Status:** resolved
**Blocked by:** 无

## What to build

- 选人页工具行下方新增进度卡：inline SVG 进度环（`已选 N / M`）+ 按团体统计的覆盖 chips（只显示已选 > 0 的团体）。
- 选满时：toast「选满啦！点『开始对决』进入两两对比」+ 开始按钮加 `emphasis` 类；开始按钮文案改为「开始对决（约 N 题）」（`CORE.worstCase`）。
- 搜索无结果时追加一行提示（可搜简体/假名/昵称）。
- 新键 `picked_of` / `picked_full` / `start_est` / `empty_search_hint`（zh/en）。

## Acceptance

- [x] E2E：选 3 位后进度环文本为 `3/7`，覆盖 chips 含对应团体与计数
- [x] E2E：选满后 toast 出现、开始按钮文案含「约 14 题」
- [x] E2E：搜索无结果时出现提示行
- [x] `npm test` 全绿

## Comments

2026-09-28：进度环（`#pick-ring` inline SVG）+ 团体覆盖 chips + 选满 toast + `start_est`（约 N 题）+ 空搜索提示行；E2E 断言 3/7、覆盖 AKB48 3、约 14 题、提示行。
