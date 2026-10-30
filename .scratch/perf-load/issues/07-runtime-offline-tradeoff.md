# 07 · 运行时与离线取舍

- **Type**: grilling
- **Status**: resolved
- **Blocked by**: 03

## Question

基于 03 的实测，决定搜索/渲染/内存/PWA 缓存是否动、动哪一项、验收口径与回退方案。

## Answer

2026-10-30 用户拍板：

- **海报预览**：做 `canvas.toBlob()` + object URL，替换 `toDataURL`；验收 40 人 longtask ≤100ms、
  预览/下载同条件视觉 A/B 无差异、object URL 正确 revoke。
- **海报内存**：先做原型（票 10）验证 `createImageBitmap` resize 解码，通过再进实现；不在本轮盲改管线。
- **搜索上限**：80 → **40**，保留「还有更多」提示；E2E 的 80 断言同步改为 40。
- **全展开名册 / PWA 缓存**：本轮不动，留 backlog（需真实设备数据与离线矩阵）。
- **不做**：`PICK_CONFIRM_MS`（UX 决策）、投影只算一次（收益仅几 ms）。
