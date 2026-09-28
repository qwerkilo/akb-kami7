# 02 文案与 E2E

**Status:** resolved
**Blocked by:** 01

## What to build

`i18n.js` 的 `search_ph` 与 `empty_search_hint` 加「罗马字 / romaji」（zh/en 同步）；E2E 断言罗马字检索命中与提示文案。

## Acceptance

- [x] `search_ph` / `empty_search_hint` zh/en 同步更新（i18n 键完整性测试绿）
- [x] E2E：`#search` 输入 `maeda` / `sato` / `tomochin` / `sasshi` / `sasihara` / `acchan` 各自命中；无结果提示含「罗马字」（`siniti` 无真实靶子，改用异形 `sasihara` 与促音 `acchan`，见 spec 偏差记录）
- [x] `npm test` + E2E 回归全绿（旧断言不变）

## Comments

2026-09-28：`search_ph`/`empty_search_hint` zh/en 加罗马字；E2E +6（maeda→前田敦子、sato→佐藤、tomochin→板野友美、sasshi→指原莉乃、sasihara→指原莉乃（异形）、acchan→前田敦子（促音 cch））+ v5 提示文案断言；回归 **74/74**、v5 44/44。
