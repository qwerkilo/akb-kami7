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

## 第九十三轮 · 票 12 收口：Sort 模板是根因

- **日期**：2026-10-31
- **本次基点**：`3b3b6c6`
- **审查范围**：真实 ja.wikipedia 页面（`action=raw`）+ 增量管线。
- **结论**：
  - 根因是上游姓名格 `{{Sort|读音|显示值}}`，`_strip_templates` 取第一个参数 → 假名。
    修 `_strip_templates`（Sort 取显示值）、`kana_of`（Sort 键）、`_generation_from_row`
    （合并列的期生，统一 `N期生`，只对モーニング娘。回退）、`photo_skip.key`（kana）。
  - 真跑 **5m37s**、缺图 **7**、generation **51**、名字全汉字；语义 diff 仅 5 处合法变化
    （増本綺良/秋山眞緒毕业、工藤遥别名顺序），无丢失。
  - 票 11/12 均 resolved。
- **验证**：`npm run check` exit 0；`npm run e2e:all` 5/5（272/54/46/73/145）。
- **下次基点**：本批最后一个提交（`git rev-parse HEAD`）

## 第九十四轮 · 票 09 收口：perf-load 地图完成

- **日期**：2026-10-31
- **本次基点**：`ede652e`
- **结论**：优先级表落票 09：P0 已完成；P1 = 删除 Zen 500（真实渲染 0 face，−28.7KB wire）
  - `poster.js` 延后（8.8KB gzip）；P2 起（海报解码原型/图片/PWA/字体自托管/worker）进 backlog。
    验收：encoded/decoded 体积、同条件 A/B、`e2e:all` 5/5、首屏 145/145、数据真跑语义 diff。
- **验证**：纯文档；`npm run check` exit 0。
- **下次基点**：本批最后一个提交

## 第九十五轮 · P1①：删 Zen 500

- **日期**：2026-10-31
- **本次基点**：`ad68957`
- **结论**：Zen 500 在首访真实渲染 0 个 face（研究 02）；删掉后 Google Fonts CSS
  **87,244 → 58,403 wire（−28,841 B / −33%）**。390 与 1280 的挑人页截图（旧/新 index）
  **逐字节相同**；`e2e:all` 5/5、首屏矩阵 145/145。
- **P1② 放弃**：`app.js:45`/`session.js` 在建会话时读 `AKB_POSTER.styles`，延后 poster.js
  需要搬走 POSTER_STYLES 所有权，8.8KB gzip 不值这个风险（如实记录，不硬做）。
- **验证**：`test/fonts.test.js` 新增「Zen 不请求 500」；`npm run check` exit 0。
- **下次基点**：本批最后一个提交
