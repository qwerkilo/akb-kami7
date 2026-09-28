# 04 海报跟随皮肤

**Status:** resolved
**Blocked by:** 01

## What to build

`poster.js` 令牌新增 `cardStroke`；`slotCard` 按 `T.cardStroke` 描边（0 则跳过）；`app.js` 的 `posterTokens()` 按当前皮肤返回两套令牌（classic 上游七色 + cardStroke 0；sticker 现行 + cardStroke 3）；换皮肤后结果页海报重绘。

## Acceptance

- [x] `test/poster.test.js`：classic 令牌不描边、sticker 3px、缺省回退不变
- [x] E2E：结果页海报 canvas 角像素随皮肤变化（#edeff3 / #f5f1e6）
- [x] `npm test` 全绿

## Comments

2026-09-27：`poster.js` tokens 增 `cardStroke`（默认 3）并按 0 跳过卡片描边；CSS 令牌 `--poster-card-stroke`（3px/0px）；`posterTokens()` 注入；换皮肤在结果页重绘海报。测试：poster 9 项（classic 无 3px 描边、页脚线仍在）；绘制调用序列快照 3301 条 diff 为空；E2E 像素探针（#edeff3 / #f5f1e6）60/60。
