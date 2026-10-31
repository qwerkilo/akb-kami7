# 10 · 海报解码内存原型

- **Type**: prototype
- **Status**: backlog (out of scope for this map)
- **Blocked by**: 无

## Question

`createImageBitmap(blob, {resizeWidth})`（或等价方案）能否在**解码层**把 40 人海报的图片内存从
均值 47.6MB / p90 ~99MB 降到与画布槽位匹配的量级，同时保持视觉无差异？
用可运行原型对比：原图 full 解码 vs resize 解码，记录耗时、内存估算与截图 A/B；不改产品代码。
