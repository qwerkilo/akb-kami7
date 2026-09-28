# 01 期生筛选（core/session/i18n/UI/E2E）

**Status:** resolved
**Blocked by:** 无

## Acceptance

- [x] `core.genKey`：一/二/十/十一/二十一 → 1/2/10/11/21 期生；1期生、1.5期生、选秀1期生、兼任・移籍加入 原样
- [x] `core.generationOptions`：按出现顺序去重、排除「兼任・移籍加入」
- [x] `core.groupSections(sections, group, gen)`：叠加过滤、两参调用向后兼容
- [x] `session.setGeneration` + 切系列复位；`snapshot().generation`
- [x] `#gen-filter` 下拉（三语文案、en 走 genText）+ 三处渲染过滤
- [x] E2E：期生下拉、48G 筛 1期生（七团节点）、复位、坂道归一命中三团
- [x] `npm test` JS 124 + Python 83

## Comments

2026-09-28：48g 期生选项 33 个、坂道 8 个（含归一后的 1.5期生）、等爱 1 个；浏览器实测命中与复位正确；E2E 84/84（+4）。段头保留数据原文（一期生/1期生 各按原样显示），仅筛选键归一。
