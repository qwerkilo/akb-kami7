# 架构深化 ④：命名模块（CORE.names）

**What to build:** 把「随系列 / 档位变化的命名组合」（品牌、默认标题、页眉、话题标签、海报标签、文件名基）收进 `core.js` 的 `names(series, size, t)` 纯函数；app.js 移除 8 处分散组合，只消费该对象；文案仍留 i18n。

**Blocked by:** None

**Status:** resolved

## Comments

2026-09-27：按 grilling 结论实现——落点 core.js（返回 `{brand, seriesLabel, title, eyebrow, shareTags, posterTags, fileBase}`；审查后删除冗余的 seriesTag）；文件名保持现状只集中不改名；app.js 的 `kamiName`/`defaultTitle` 删除，8 处命名组合改调 `names()`。测试：`core.test.js` 精确断言 48g×7 全字段 + 映射穷举；`i18n.test.js` 在 zh/en × 系列 × 档位下断言品牌映射（神7/7福神/选拔组/圈内 与 Kami 7/7 Fukujin/Senbatsu/Ranked）、标题后缀、文件名格式且无 `undefined`。验证：`npm test` JS 58 + Python 47、E2E 42/42。架构扫描候选 ②（对决生命周期）经删除测试判定已被 ① 覆盖，归档不再立项（见检查点第四轮遗留）。
