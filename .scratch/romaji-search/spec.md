# 罗马字检索（romaji search）spec

**Status:** ready-for-agent

## Problem

检索目前只匹配 汉字 / 假名 / 昵称（含简体折叠）。直接敲罗马字（`maeda atsuko`、`sato`、`tomochin`）完全搜不到——`bio.romaji` 只有 33 个等爱成员且未入检索。中文输入法打汉字的路已覆盖，缺的是「不打汉字、直接敲 romaji」的场景。

## Solution

`core.js` 增加假名→罗马字转换（静态表 + 纯函数），运行时把罗马字变体并入检索 haystack；文案提到罗马字。**不改产物与数据管线**。

## User stories

1. 输入 `maeda`、`atsuko`、`maedaatsuko` 或 `maeda atsuko`（空格随意）都能搜到 前田敦子。
2. 输入 `satou` 或 `sato`（长音折叠）都能搜到 佐藤 类名字。
3. 输入 `siniti`（Kunrei 式异形）也能搜到 しんいち（`shinichi`）类名字。
4. 输入 `tomochin` 能搜到昵称含 ともちん 的成员（昵称也进罗马字）。
5. 输入 `matchi` 或 `macchi`（促音）都能搜到 まっち 类名字。
6. 输入 `shinnichi`（IME 习惯的 nn 写法）也能命中。
7. 无结果提示文案提到罗马字（zh/en 同步）。

## Implementation Decisions

- `core.js` 新增段「罗马字检索」：`ROMAJI`（主形，Hepburn）与 `ROMAJI_ALT`（异形：si/ti/tu/hu/zi、sya/zya…）；`romanize(s, alt)` 纯函数——内部小写、片假名→平假名、只保留平假名与 `ー`；`ー` 丢弃、`ん`→`n`、促音 `っ` 双写下一个音的辅音；非法/空输入返回 `""`。
- **变体**（并入 haystack，去重）：主形、异形、长音折叠（`ou→o`、`oo→o`、`uu→u`）、`nn` 展开（`n` 后接元音时写 `nn`，IME 习惯）。
- `haystack(member, fold)` 在原有 `name/kana/nick`（+ 简体折叠）之后追加上述变体；**查询串不做转换**（用户敲的就是罗马字）。
- 文案：`search_ph`、`empty_search_hint` 加「罗马字 / romaji」（zh/en）。
- **不做**：汉字拼音、首字母缩写、声调/连字符处理、`ei→e` 折叠（けいこ 不作 keko）。

## Testing Decisions

- `test/core.test.js`：`romanize`（主形/异形/长音/促音/ん/nn/非假名/空输入）与 `haystack`（含变体、简体折叠共存）——先红后绿。
- E2E：`#search` 输入 `maeda`、`sato`、`tomochin`、`siniti` 各自命中预期成员；无结果提示含「罗马字」。

## Out of Scope

- 汉字拼音（中文输入法已覆盖汉字）；姓氏/名字分词；模糊匹配（编辑距离）；权重排序。

## Further Notes

- 前置决策：v2 grill Q5（简体搜索 A：仅字形映射，拼音后续）——本批兑现「后续」。
- 假名覆盖：1375 人中 1371 有 `kana`，缺的 4 人名字本身是假名/片假名（`romanize` 直接吃名字）→ 全覆盖。
