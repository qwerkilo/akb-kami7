# 12 · 真实跑产物变假名名 + 55 人缺图

- **Type**: grilling
- **Status**: in-progress
- **Blocked by**: 无

## Question

2026-10-31 真实增量跑（修好 skip 键的临时版本）完成 9m36s 后：

- `members.js` 的早安成员 `name` 全部变成假名（`のなか みき`），上一轮是汉字（`野中美希`）；
- 55 人没有照片（旧站 alt 是汉字，配不上假名记录）；`members.js` 313/234 行变化、图片被删；
- 已用 `git checkout` 还原产物，未提交。

这是上游维基表列名/内容变化（`名前` 列现在是假名？）还是解析器取错列？
必须先定位，再决定 skip 键（kana）是否随数据修复一起上线。用真实页面 diff
`parse_wiki_members` 的 `名前`/`kana` 取值；不要用 fixture 猜。

## Candidate fix（未真跑验证）

`first_line` 现在只对「第一行是整行括号假名」的姓名格往后找汉字名；
`リンリン\n（銭琳）` 仍取 `リンリン`，`（のなか みき）\n野中美希` 取 `野中美希`。
单测 128 条通过、`npm run check` exit 0。

**未验证**：真实 ja.wikipedia 抓取连续超时（SSL handshake / webfetch 60s），
无法确认真实姓名格是否就是「假名在前」。下一步：网络恢复后用真实页面 diff
`split_rows` 的 `名前` 原始格；真跑后必须核对 `members.js` 名字仍为汉字、缺图 7 人。
