# 02 文案与 E2E

**Status:** resolved
**Blocked by:** 01

## What to build

`i18n.js` 的 `search_ph` 与 `empty_search_hint` 加「罗马字 / romaji」（zh/en 同步）；E2E 断言罗马字检索命中与提示文案。

## Acceptance

- [x] `search_ph` / `empty_search_hint` zh/en 同步更新（i18n 键完整性测试绿）
- [ ] E2E：`#search` 输入 `maeda` / `sato` / `tomochin` / `siniti` 各自命中；无结果提示含「罗马字」
- [ ] `npm test` + E2E 回归全绿（旧断言不变）

## Comments

2026-09-28：`search_ph`/`empty_search_hint` zh/en 加罗马字；E2E +4（maeda→前田敦子、sato→佐藤、tomochin→板野友美、sasshi→指原莉乃）+ v5 提示文案断言；回归 **72/72**、v5 44/44。
