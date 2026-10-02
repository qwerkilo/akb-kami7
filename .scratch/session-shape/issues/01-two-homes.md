# 工单 01 · 每系列状态形状收成两个家 + clearScreening + 守卫

**规格**：`.scratch/session-shape/spec.md`

## 步骤（每步都要见到红）

1. **红**：缝④ 加源码守卫 —— 五个字段名（`size`/`selected`/`duel`/`cut`/`deeperRound`）
   除了 `toRecord` 与 `fromRecord` 两个函数体外不得再出现。
   **这条现在就红**（它们出现在 5 处）。
2. **绿**：抽 `toRecord(state)` 与 `fromRecord(rec)`，把 `save` / `remember` /
   boot / 切系列恢复改成调它们；`loadSeries` 保留（它额外做系列过滤，那是 core 不认识
   系列的原因，读的是盘上原始载荷）。
3. **红 → 绿**：抽 `clearScreening()`，三个清零函数各自调它，范围/save/返回值的差异
   留在调用点。
4. **等价性**：探针在改前/改后输出逐字节相同（见 spec 的等价性要求）。
5. **变异验证**（用 `scripts/mutate.mjs`）：
   - `fromRecord` 漏一个字段 → 必须红
   - `toRecord` 漏一个字段 → 必须红
   - `clearScreening` 只清 cut 不清 deeperRound → 必须红

## 验收

- `npm run check` 全绿。
- 既有 session 测试全绿（它们是这次重构的安全网）。
- 探针逐字节相同。
- 复杂度棘轮未推高。
