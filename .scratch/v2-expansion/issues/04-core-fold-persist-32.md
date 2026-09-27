# 04: core：折叠搜索 + 持久化 + 32 档支持

**What to build:** `core.js`：`haystack(member, foldMap)` 把简体折叠形并入搜索 hay（`foldMap` 由调用方传入，运行时来自 `simplified.js`，测试用夹具表）；持久化序列化/反序列化 + 校验（损坏或过期数据安全丢弃）；32 档进度辅助（`worstCase(32) = 129`、按经验值预估剩余时长）。

**Blocked by:** 03（同一文件串行编辑）

**Status:** ready-for-agent

- [ ] 简体输入命中（渡边 → 渡辺/渡邊、马 → 馬、宫 → 宮）node:test
- [ ] 序列化往返、损坏/过期数据安全丢弃 node:test
- [ ] `worstCase` 32=129 与进度/时长辅助测试
- [ ] `npm test` 全绿
