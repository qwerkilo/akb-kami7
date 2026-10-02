# 工单 01 · playOnce 合三处 + 兜底从 CSS 读 + 修掉自我击败

**规格**：`.scratch/motion-once/spec.md`

## 步骤

1. **抓基线**：浏览器探针量三个时刻的时长（相位转场 / 名册 stagger / 揭幕），
   两皮肤 × 降级 × 有无，逐个记 `performance.now()` 差值。
2. 实现 `motionMs(el, sample)` + `MOTION_MARGIN_MS` + `playOnce(el, cls, kind, opts)`。
3. `show()` 的转场、`rosterEntered()`、`unveil()` 三处改调它。
4. **守卫**（缝③）：三处都经 `playOnce`；不许再有 `{ once: true }` 的动画/过渡监听；
   兜底不许写死毫秒字面量。
5. **变异**：`{once:true}` 改回来 / 兜底写死 / 三处有一处不调 playOnce → 全红。
6. **等价性**：探针对比改前改后。

## 验收

- `npm run check` 全绿；三套 E2E 全绿。
- 探针：三个时刻时长同量级，降级下不播不残留。
