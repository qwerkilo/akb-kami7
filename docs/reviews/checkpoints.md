# Code Review 检查点

每次 code review 结束后，在这里追加一条记录；下次 review 从最后一条的「下次基点」开始，不重复审查已经通过的部分。

每条记录的字段：

- **日期**：`YYYY-MM-DD`
- **本次基点**：上次检查点记录的 HEAD（首次写仓库起始提交）
- **审查范围**：`git diff <基点>...HEAD`、`git log <基点>..HEAD --oneline`
- **结论**：Standards / Spec 两轴各发现了什么、是否已处理
- **遗留问题**：未解决项，注明对应 issue 文件（`.scratch/<feature>/issues/NN-*.md`）
- **下次基点**：本次 HEAD 的完整 SHA（`git rev-parse HEAD`）

<!-- 示例（正式记录追加在注释外、文件末尾，不要删掉本段）：

## 2026-09-26 · 示例

- 基点：d21bbfe Add pre-commit hooks (husky + lint-staged + prettier)
- 范围：`git diff d21bbfe...HEAD`，共 3 个提交
- 结论：Standards 2 项（已修复 2）；Spec 1 项（已转为 issue）
- 遗留：`.scratch/foo/issues/03-bar.md`
- 下次基点：<本次 HEAD 的完整 SHA>

-->

## 2026-09-26 · 48 Group 扩展（首轮）

- 基点：`8c3361b` 添加 AGENTS.md 与协作文档（agent skills、code review 检查点）
- 范围：`git diff 8c3361b...2587f33`，共 9 个提交（bc3340f..2587f33：测试基建、core.js 抽取、7 团数据管线、团体筛选、搜索/文案、占位/标注、E2E、CodeGraph 接入、文档）
- 结论：
  - **Standards**：2 项实缺——① SDN48 4 行姓名/昵称残留 `data-sort-value="…" |`（チェン・チュー、KONAN、シヨン、miray，`clean_name` 与昵称启发式未处理排序键），且产物测试无字段纯净断言；② 跨团合并 `note` 硬编码中文，英文界面直出中文。其余为判断项（重复代码、`isTransfer` 魔字符串、`state.group === "all"` 散落、团体清单三处等）。
  - **Spec**：主体一致（7 团 1136 人、两条流程 E2E 26/26、测试全绿）；3 项偏差——① 用户故事 14 的「托盘显示团体与期生」只做了结果列表；② 用户故事 25 的「缺加入期行给出提示」为静默跳过；③ 移籍类成员结果 meta 缺毕业年份。
- 遗留：`.scratch/48group-expansion/issues/08-review-fixes.md`（2026-09-26 已全部修复：`017dd2e` 脏数据、`af34e18` 结构化来源、`3a8b03d` 毕业年份/托盘、`2e8c04f` 缺行提示；两轴问题均已闭环）
- 下次基点：`2587f333558ca275d7634da2fbc40355f4afe6ac`

## 2026-09-27 · 48 Group 扩展（二轮）

- 基点：`2587f33` 补齐结果/托盘/文案/文档（首轮范围末端）
- 范围：`git diff 2587f33...bbdbb7f`，共 13 个提交（首轮修复 4 + 检查点记录 1 + 质检基线/重构/测试/复检 4 + 二轮修复 1 + 测试守卫 1 + 文档）
- 结论：
  - **Standards**：1 项实缺——ticket 08 状态未收口仍为 `ready-for-agent`（01–07 均 resolved）；5 项判断项——extras 丢失同团去重（重构回归）、托盘文案硬编码全角括号且重复拼接、移籍成员卡片 meta 缺毕业年份（与结果页不一致）、`except Exception` 过宽（保留）、`section_key` 副作用命名（保留）。
  - **Spec**：4 项偏差——基线测试数 37 与实测 38 不符、工单状态未收口、上次检查点曾就地改写旧记录（本轮起改为追加）、产物纯度护栏未覆盖单字符 `{`/`}`（已加宽并做注入红证明）；核心声称（12 图刷新、覆盖率 97%、CRAP 0、变异 90.84%、E2E 28/28）核实通过，事故披露自洽。
  - 修复提交：`e35468a`（extras 去重 + 单测、托盘 i18n、卡片 yearLeave、纯度正则、工单收口、基线勘误）、`bbdbb7f`（集成测试真实目录不变量守卫，含原事故模式红证明）。
- 遗留：`.scratch/48group-expansion/issues/09-review2-fixes.md`（已 resolve）；判断项 MID：Stryker 工具未入仓（口径已记入 qa-baseline）、`except Exception` 保留。
- 下次基点：`bbdbb7fb038dcd9f8d93d6ce9e38180b7c50a31a`

## 2026-09-27 · v2 扩展（工单 01–08，第三轮）

- 基点：`bbdbb7fb038dcd9f8d93d6ce9e38180b7c50a31a`（二轮范围末端）
- 范围：`git diff bbdbb7f...546cbc4`，约 20 个提交（v2 工单 01–08：管线显式目录、坂道数据/折叠表、字幕 module + 海报 seam、折叠搜索/持久化/32 档、贴纸 UI 三相位重做、系列品牌与命名统一、审查修复）
- 结论：
  - **Standards**：2 项实缺——① `app.js` 本批新增却全文件未用的死代码（`SIZES` 与 4 个字幕薄封装）；② 系列切换按钮与 `aria-label` 硬编码中文未接 i18n（en 模式直出中文）。判断项：`poster.js` 调色板与 CSS 变量重复（保留）、`TRANSFER_GENERATION` 魔字符串（保留）、`placeRow` 缺员时列位错移（已修）、汉字数求和解析（已修并补 十一/二十一 测试）、`poster.test` 对 32 的恒真断言与假 `t` 单参（已加固）。
  - **Spec**：2 项实缺·高——① 坂道期生展开取全局索引导致空列表（`toggleGroup` 用 `GROUPS[gi]` 而 `gi` 为系列相对索引），已改 `data-sec` 键 + `SEC_INDEX` 映射并补 E2E「坂道期生展开有卡片 36」；② 对决跨系列串写（切系列未清 `duel`，`saveState` 把旧系列 order/answers 写入新 key，已完成结果会直出），已改为切换即清内存对决、`loadState` 校验 order id 归属、`backToPick` 明确放弃进度、`answer` 捕获系列防 160ms 竞态，并补 E2E「48G 对决不泄漏到坂道」。实缺·中：工单 08 未收口（本轮完成）。判断项：spec 折叠表计数 6→8 键一对多（已勘误）。
  - 命名决策（用户）：坂道 7 人档定名「7福神」（原 BEST 7）、32 档两系列统一「圈内」；ADR-0004 / CONTEXT / i18n / 海报文件名 / E2E 全量同步。
  - 验证：`npm test` JS 43 + Python 47、E2E 42/42（含 32 档 129 题、刷新续玩、坂道流程与海报、跨系列隔离）、`--no-dl` 幂等、截图核对 pick/32 结果/坂道结果。
- 遗留：判断项 MID——`poster.js` 调色板与 `style.css` 变量重复需人工同步；E2E 脚本在 /tmp 不入仓（Out of Scope）；Stryker 未入仓（口径见 qa-baseline）。
- 下次基点：`546cbc4`（本批实现提交；文档收口为其后一笔）
