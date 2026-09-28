# 05 验收与文档

**Status:** resolved
**Blocked by:** 03, 04

## What to build

E2E 全量（含皮肤项）与文档收口：CONTEXT 皮肤术语核对、检查点记录、AGENTS 若需同步。

## Acceptance

- [x] E2E 全绿（新增皮肤 4 项）
- [x] `npm test` 全绿；Prettier；`graph:sync`
- [x] 检查点追加（基点 = 本批起点）

## Comments

2026-09-27：E2E 扩到 **62 项**（皮肤 5 项含容器边框 CSS 断言、海报像素探针 2 项）；两轴审查：Standards 1 实缺（`--border: var(--border)` 自引用致贴纸描边全失，已修 + E2E 边框护栏）+ 判断项（预绘制皮肤防闪、classic 对齐上游：裸卡/粉带/黄叉/粉徽章、rank-list 半径令牌化）；Spec 偏差同步修复；检查点已追加。
