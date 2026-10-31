# 检查点 · 2026-10-31 · 票 12 候选修复（未真跑）

## 第九十一轮 · first_line 的「假名在前」候选修复

- **日期**：2026-10-31
- **本次基点**：`215987c`
- **审查范围**：`morningmusume_members.first_line`（姓名格归一）。
- **结论**：
  - 候选根因：真实姓名格可能把 `（のなか みき）` 放在正式名之前，`first_line`
    直接取第一行 → 成员名变假名 → 旧站 alt（汉字）配不上 → 55 人缺图。
  - 修复：仅当第一行是**整行括号假名**时才往后找含汉字的行；`リンリン\n（銭琳）`
    仍取 `リンリン`（防止把漢字表記当正式名）。
  - 单测 `test_first_line_prefers_kanji_when_kana_is_first` 覆盖两种行序与リンリン。
- **未验证（如实记）**：真实 ja.wikipedia 抓取连续超时（SSL handshake / webfetch 60s），
  无法确认真实格形状；**没有真跑管线**。票 12 保持 in-progress。
- **验证**：`npm run check` exit 0（128 条 morning 单测）。
- **下次基点**：本批最后一个代码提交（`git rev-parse HEAD`）

## 第九十二轮 · 写产物前的姓名漂移门

- **日期**：2026-10-31
- **本次基点**：`e86ccf4`
- **结论**：`_roster_gate` 增加 `name_drift`（上一轮汉字 → 本轮纯假名）检查，
  命中即 `SystemExit`（`--accept-drop` 放行并打警告）。这是**防护**，不是解析根因修复；
  票 12 仍 in-progress（真实页面未取到）。
- **验证**：`npm run check` exit 0；新增 `name_drift` 3 条 + 门 1 条测试。
