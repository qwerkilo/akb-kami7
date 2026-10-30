# 04 · love 官网空表快速中止（不做）

- **Status**: wontfix
- **理由**：规模门在 `fetch_members._roster_gate`（基线/`--accept-drop`/系列失败中止均已有测试）；
  在 `love_members.load` 再加 abort 属产品行为变更，本批边界是只补测试。
