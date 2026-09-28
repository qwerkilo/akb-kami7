# 03 · 断网端到端验收 + 文档

**Status:** pending
**Blocked by:** 02

## 范围

- `/tmp/opencode/e2e-pwa.cjs`（不入仓）：SW 激活 → 断网重载 → 启动/选人/开始对决/出图海报；
  已浏览成员离线有图、未浏览占位；离线胶囊；安装入口；更新横幅（临时副本跑第二版 sw.js，验证 waiting → 横幅 → 刷新生效）。
- 文档：`AGENTS.md` 补 PWA 一节（怎么本地验离线、改了壳要做什么）；`docs/reviews/qa-baseline.md` 若数字变化则更新。

## 验收

- 断网下全流程可用（海报像素探针非空）。
- 仓库零污染：E2E 的第二版 sw.js 只存在于临时副本，`git status` 干净。
