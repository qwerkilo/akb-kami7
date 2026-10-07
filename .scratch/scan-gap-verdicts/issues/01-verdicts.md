# 工单 01：每团结局取代三集合

- **Status**: resolved
- **Blocked by**: 无

## 实现

1. 特征测试 `test_group_never_reached_is_noted_as_limit_not_missing_page`（limit=0 → 团没轮到）——
   先绿（钉住现有行为），是「去掉判据」变异的杀手。
2. `_CUT_REASON = {"budget": "旧站预算内未扫完", "limit": "旧站被全局上限截断"}`（唯一定义点）。
3. `_resolve_old_site_groups`：三集合 → `verdicts`（没轮到的团不进表、扫完存 None、截断存原因串）。
4. `_note_scan_gaps(missing, urls, verdicts, notes)`：单循环查结论。

## 判据与结果

- 特征测试重构前绿、变异②下**红**（实测：只跑那一条 → 红 ✓ 承重）。
- 328 条 Python 单测全绿；`npm run check` exit=0。
- 变异 2/2 被杀（①两类对调 ②去掉「没轮到」判据）。
