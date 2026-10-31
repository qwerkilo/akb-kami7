# 12 · 真实跑产物变假名名 + 55 人缺图

- **Type**: grilling
- **Status**: resolved
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

## Safety gate（2026-10-31）

`fetch_members._roster_gate` 现在在写产物前比对上一轮：任何「上一轮汉字 → 本轮纯假名」
都会 **SystemExit**（`--accept-drop` 可人工放行）。这不是解析修复，是防止未知上游/解析
形状再次写坏 `members.js` 与图片。纯函数 `name_drift` + 门各一条测试。

## Answer（2026-10-31 真实页面验证）

真实页面（`action=raw`）确认：上游给姓名格套了 `{{Sort|读音|显示值}}`，`_strip_templates`
取**第一个位置参数**（读音）→ `name` 变假名。修复：

- `_strip_templates` 对 `Sort` 取第二个位置参数（显示值）；
- `kana_of` 从 `Sort` 的排序键取读音；
- 上游把「加入年月日（加入期）」并成一列 → `_generation_from_row` 从原始格取回期生，
  并统一成 `N期生`（モーニング娘。才启用回退，其他团仍按期生列）；
- `photo_skip.key` 用 `kana or name`，上一轮投影补 `kana`。

真跑结果：**5m37s**、`members.js` 名字全为汉字、**缺图 7 人不变**、generation **51 人**；
逐成员语义比对只有 **5 处**合法上游变化（増本綺良/秋山眞緒 毕业、工藤遥别名顺序），
无丢失、无新增缺图。`npm run check` exit 0、`e2e:all` 5/5。
