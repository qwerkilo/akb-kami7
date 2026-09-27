# 04: core：折叠搜索 + 持久化 + 32 档支持

**What to build:** `core.js`：`haystack(member, foldMap)` 把简体折叠形并入搜索 hay（`foldMap` 由调用方传入，运行时来自 `simplified.js`，测试用夹具表）；持久化序列化/反序列化 + 校验（损坏或过期数据安全丢弃）；32 档进度辅助（`worstCase(32) = 129`、按经验值预估剩余时长）。

**Blocked by:** 03（同一文件串行编辑）

**Status:** resolved

- [x] 简体输入命中（渡边 → 渡辺/渡邊、马 → 馬、宫 → 宮）node:test
- [x] 序列化往返、损坏/过期数据安全丢弃 node:test
- [x] `worstCase` 32=129 与进度/时长辅助测试
- [x] `npm test` 全绿

## Comments

2026-09-27：`core.js` 新增 `foldIndex(simpMap)`（简体键 → 日文形反查表）、`haystack(member, fold)`（折叠形并入 hay，无表时行为不变）、`serializeState`/`deserializeState`（v1、尺寸白名单、字段过滤、duel 形状校验）、`duelProgress`（最坏口径剩余 + 5s/题 ETA）；测试 +4。运行时装载 `simplified.js` 与 UI 接线随 05。
