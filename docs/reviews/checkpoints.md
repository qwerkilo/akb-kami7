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
- 遗留：`.scratch/48group-expansion/issues/08-review-fixes.md`
- 下次基点：`2587f333558ca275d7634da2fbc40355f4afe6ac`
