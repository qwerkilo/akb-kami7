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

2026-09-28：期生选项（不含「全部期生」）48g 30（含归一后的 1.5/12.5期生与选秀 1-3期生；已排除兼任・移籍加入 / Team 8 / 其他）、坂道 7、等爱 1；浏览器实测命中与复位正确。

2026-09-28（审查修复）：① 排除「Team 8」「其他」（此前会作为期生选项出现，「其他」在 en/ja 还是中文）；② `refreshGenOptions` 的值口径改为显式计算（消除陈旧 snap 导致的空 value 死分支）；③ `ensureOpen` 带上期生筛选（首屏见脸在期生筛选下也生效）；④ `kanjiNumber` 单正则化并补十九/二十/二十九/三十断言；⑤ 会话加「重建实例仍为 all」的易失断言；⑥ E2E 补「櫻坂段头保留原文（一期生）」。E2E 85/85。段头保留数据原文（一期生/1期生 各按原样显示），仅筛选键归一。
