# 07: 端到端验收与文档同步

**What to build:** 在真实全量数据上验收完整流程，并把范围、命令与规模同步进项目文档。

**Blocked by:** 04, 05, 06

**Status:** resolved

- [x] 跨团混选与单团两条流程各走通：选人 → 对决（含撤回）→ 结果 → 海报导出/保存
- [x] 中英切换在选人/对决/结果三页无缺失文案
- [x] 收起的分组不渲染卡片、缩略图懒加载，首屏在手机上可接受
- [x] AGENTS.md 更新：团体范围（7 团）、测试命令（`npm test`）、数据与图片规模
- [x] Prettier / lint-staged 干净；`npm test` 全绿

## Comments

2026-09-26：完成。用临时脚本（`/tmp/opencode/e2e.cjs`，Playwright + 无头 Chromium，不入库）跑 26 项检查，全部通过：

- 首屏 7 个团体头、0 张卡片 DOM（收起不渲染）；下拉顺序 all→SDN48；标题/eyebrow 中性化。
- 全部视图两级分组（AKB48 30 段）、单团视图单层（SKE48 18 段）；跨团混选 7 人（托盘）→ 对决（14 题上限、撤回 4→3）→ 结果 7 项且 meta 含团体。
- 海报 canvas 生成成功（data:image/png 且 naturalWidth>100）；`#save-btn` 下载文件名 `48group_kami7.png`。
- 中英切换：品牌 Kami 7、标题 My 48 Group Kami 7、结果页 Save image。
- 单团（SKE48）全流程独立复跑通过；全程无 JS 报错。
  文档：AGENTS.md 已更新（六文件结构、7 团/1136 人/70MB 规模、`npm test`、SOP 步骤 5 的测试基建说明）。
