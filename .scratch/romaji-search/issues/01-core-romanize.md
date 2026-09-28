# 01 core 罗马字转换与 haystack

**Status:** resolved
**Blocked by:** 无

## What to build

`core.js` 新增「罗马字检索」段：`ROMAJI` / `ROMAJI_ALT` 静态表、`romanize(s, alt)` 纯函数、haystack 追加去重变体（主形 / 异形 / 长音折叠 / nn 展开）；导出 `romanize`。

## Acceptance

- [x] `test/core.test.js` 覆盖：まえだあつこ→`maedaatsuko`；さとう→`satou`+`sato`；しんいち→`shinichi`/`siniti`/`shinnichi`；まっち→`matchi`/`macchi`；`ー` 丢弃、`ん`→`n`、片假名等价、非假名与空输入→`""`（先红后绿）
- [ ] `haystack` 含罗马字变体且与简体折叠共存
- [ ] `npm test` 全绿；无用户可见变化（app 未接文案）

## Comments

2026-09-28：`core.js` 新增 ROMAJI/ROMAJI_ALT 表 + `romanize(s, alt)`、`romajiForms()`（主形/异形/长音折叠/nn 展开去重）并入 `haystack`；促音辅音取 Kunrei 首字母（まっち→matchi、みっつ→mittsu）；`test/core.test.js` +4 例、改 3 处旧 haystack 断言（含罗马字的契约）；JS 105 全绿。
