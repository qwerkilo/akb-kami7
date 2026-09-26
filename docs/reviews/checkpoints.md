# Code Review 检查点

每次 code review 结束后，在这里追加一条记录；下次 review 从最后一条的「下次基点」开始，不重复审查已经通过的部分。

每条记录的字段：

- **日期**：`YYYY-MM-DD`
- **本次基点**：上次检查点记录的 HEAD（首次写仓库起始提交）
- **审查范围**：`git diff <基点>...HEAD`、`git log <基点>..HEAD --oneline`
- **结论**：Standards / Spec 两轴各发现了什么、是否已处理
- **遗留问题**：未解决项，注明对应 issue 文件（`.scratch/<feature>/issues/NN-*.md`）
- **下次基点**：本次 HEAD 的完整 SHA（`git rev-parse HEAD`）

<!-- 示例（正式记录直接追加在注释下方，不要删掉本段）：

## 2026-09-26 · 示例

- 基点：d21bbfe Add pre-commit hooks (husky + lint-staged + prettier)
- 范围：`git diff d21bbfe...HEAD`，共 3 个提交
- 结论：Standards 2 项（已修复 2）；Spec 1 项（已转为 issue）
- 遗留：`.scratch/foo/issues/03-bar.md`
- 下次基点：<本次 HEAD 的完整 SHA>

-->
