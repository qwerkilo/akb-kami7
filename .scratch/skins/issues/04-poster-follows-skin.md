# 04 海报跟随皮肤

**Status:** ready-for-agent
**Blocked by:** 01

## What to build

`poster.js` 令牌新增 `cardStroke`；`slotCard` 按 `T.cardStroke` 描边（0 则跳过）；`app.js` 的 `posterTokens()` 按当前皮肤返回两套令牌（classic 上游七色 + cardStroke 0；sticker 现行 + cardStroke 3）；换皮肤后结果页海报重绘。

## Acceptance

- [ ] `test/poster.test.js`：classic 令牌不描边、sticker 3px、缺省回退不变
- [ ] E2E：结果页海报 canvas 角像素随皮肤变化（#edeff3 / #f5f1e6）
- [ ] `npm test` 全绿
