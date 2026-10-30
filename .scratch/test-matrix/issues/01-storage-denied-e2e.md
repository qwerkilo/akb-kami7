# 01 · app 级存储拒绝 E2E

- **Status**: resolved
- **缝**：⑦ E2E

## 内容

隐私模式/配额满（`Storage.prototype.setItem` 抛 `QuotaExceededError`）下：
切语言、皮肤、卡片大小仍生效；刷新回落默认；无 `pageerror`。

## 结果

主套件新增 4 条（269/269）。变异：`session.js` 的 `write()` 不再吞异常 → E2E 红（被杀）。
