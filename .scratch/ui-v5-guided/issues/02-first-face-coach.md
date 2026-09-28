# 02 首屏见脸与引导卡

**Status:** ready-for-agent
**Blocked by:** 无

## What to build

- **首屏见脸**：`renderRoster()` 在 `snap.open` 为空、无搜索词、`group === "all"` 时自动展开第一个团体与其第一期生（不新增状态；用户已折叠的状态不被覆盖）。
- **引导卡**：选人页顶部一张可关闭的说明卡（三步流程 + 自动保存），点「知道了」持久化到 `akb:coach:v1`（try/catch），此后（含刷新）不再出现。
- 新键 `coach_title` / `coach_body` / `coach_ok`（zh/en）。

## Acceptance

- [ ] E2E：全新存储打开页面，`#roster` 首屏即可见 `.card`（无需点击团体/期生）
- [ ] E2E：引导卡可见；点「知道了」→ 刷新后不可见（`localStorage` 有标记）
- [ ] E2E：已展开状态被用户折叠后刷新，不强制重新展开（`open` 非空时不自作主张）
- [ ] `npm test` 全绿
