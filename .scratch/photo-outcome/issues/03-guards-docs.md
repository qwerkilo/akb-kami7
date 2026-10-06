# 工单 03：守卫与文档（并集结构性成立）

- **Status**: resolved
- **Blocked by**: 01, 02

## 决定

- 守卫：报告覆盖集合 == 缺图名单（对真实数据或完整夹具跑一遍，断言集合相等、
  每人一行、无重复）—— 把 ADR-0024 的「结构性成立」钉住。
- 守卫：每个原因字符串只有一个产生点（grep 式，剥注释）。
- 文档订正：`docs/agents/data-pipeline.md` 的范围说明（不再写「当前数据下成立」，
  改写成 ADR-0024 的形状）；`CONTEXT.md` 的「照片回退链」词条补一句「结果与原因同源」。

## 判据（可证伪）

1. 变异：报告漏掉一人 / 重复一人 → 守卫红。
2. 文档与 ADR 一致（范围句不再自相矛盾）。

## 实现记录（2026-10-06）

- **结构性并集**：报告由同一份 `missing` 驱动（短名单 + 逐人原因同源），由
  `SinglePhotoReportTests` 断言「每人恰好一行、集合相等」；变异「报告漏一人」被杀。
- **接线守卫**：`test_notes_reach_the_morning_loader_and_the_report`（同一份 notes 进
  loader 与报告）+ 加强的 `test_skip_photo_and_cache_reach_the_right_loaders`（notes 进
  两个 loader）—— 变异（去掉任一 loader 的 notes 接线）被杀。
- **链的单一出处守卫**：`test/members-artifact.test.js` 新增「photo_chain 不许有 errors
  - 两个签名 + 链自己产生原因」；变异（恢复 errors 参数/签名）会红。
- **文档**：`docs/agents/data-pipeline.md` 的汇总段改成 ADR-0024 的形状（一份报告、
  覆盖集合结构性相等、原因取值清单）；`CONTEXT.md` 的照片回退链词条已补（ADR-0024 提交）。

**遗留**：真实跑待等爱官网恢复（两次外部故障：500 / read timeout；门都正确中止未写入）。
