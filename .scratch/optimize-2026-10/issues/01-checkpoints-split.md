# 01 检查点整理：2350 行拆成索引 + 批次文件

- **Status**: resolved
- **Blocked by**: 无
- **对应决策**: Q10 = A

## 目标

`docs/reviews/checkpoints.md` 只保留**活信息**（格式说明、下次基点、未收口清单、批次日录）；
历史按批次拆到 `docs/reviews/checkpoints/`。

## 验收

1. 5 个批次文件（2026-09-26..29 / 09-30..10-04 / 10-06..07 / 10-08 scans / 10-08..11 ux-perf）。
2. **内容零丢失**：索引前言 + 5 个文件按序拼接 == 原文件（脚本逐字校验）。
3. AGENTS「Code Review 检查点」指向新位置并写明「新记录追加到当前批次文件，索引只更新活信息」。
4. `docs/reviews/qa-baseline.md` 的 `/tmp/opencode/e2e*.cjs` 过期指针改指 `npm run e2e` / 索引。
5. `npm run check` exit 0。

## 不做

- 改写历史内容、重排轮次编号。

## Comments

索引 + 5 个批次文件已落地，拼接逐字校验通过；AGENTS / qa-baseline 指针已更新（提交 `27e4b02` + `05d32b8`）。

2026-10-29 triage 复核：工单已交付，补状态。
