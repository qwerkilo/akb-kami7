# 02: 坂道数据管线：三团 + 折叠表

**What to build:** 管线支持坂道系列——解析乃木坂46 / 櫻坂46 / 日向坂46 成员列表页（历史成员并入现团：欅坂46 → 櫻坂46、けやき坂46 → 日向坂46），适配汉字数字期生（一期/四期）、`data-sort-value` 日期与 `最終在籍日` 列、跨页重复人物按现规则去重；`members.js` 每个分段带 `series`（`48g` / `sakamichi`）；离线生成 `simplified.js` 简体折叠表（OpenCC）；下载并压缩坂道照片（约 +13MB）。现有 UI 能在坂道数据上泛化显示。

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] 三团解析 fixture 单测（汉字期生、日期列、跨页重复人物）
- [ ] `members.js` 含 `series`，两组齐全（48G ≈1136 + 坂道 ≈205）
- [ ] `simplified.js` 随数据生成，产物测试校验其结构
- [ ] 图片全量、`--no-dl` 幂等、产物不变量测试扩展通过
