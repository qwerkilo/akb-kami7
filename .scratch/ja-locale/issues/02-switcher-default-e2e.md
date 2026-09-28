# 02 切换器、默认语言与 E2E

**Status:** resolved
**Blocked by:** 01

## What to build

页头 `.seg-lang` 第三键「日」；`app.js` 语言初始化（三值 + 按浏览器语言）与 `html[lang]`；E2E 断言。

## Acceptance

- [x] 页头「中 / EN / 日」三键，`aria-checked` 与记忆（`akb-lang`）正确
- [x] 首次访问按 `navigator.language` 自动选（ja*→ja、zh*→zh、其他→en）；`setLang` 接受三值
- [x] `html[lang]` = ja / en / zh-CN
- [x] E2E：切日语（步骤条/副标题/空搜索提示/html lang）+ 独立 ja-JP 页面自动日语；两套脚本以 `locale: zh-CN` 启动保持既有断言
- [x] `npm test` + E2E 回归全绿

## Comments

2026-09-28：`.seg-lang` 三键；`app.js` 启动读 `akb-lang`（无存档则按 `navigator.language`）；E2E v5 **49/49**（+5：日语步骤条/副标题/html lang/空搜索提示/自动日语）、回归 **75/75**（脚本加 `locale: zh-CN` 后既有断言不变）。
