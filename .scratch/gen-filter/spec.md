# 期生筛选（v8）spec

**Status:** ready-for-agent

## Problem

选人页已有「团体」「状态」「搜索」三种筛选，但没有**期生**维度——找某一期（如 AKB48 1期生、乃木坂 2期生）要翻很久。

## Solution

工具栏加「期生」下拉（与团体下拉并列）：选项 = 当前系列的去重期生（按数据出现顺序，汉字数字归一为阿拉伯，「兼任・移籍加入」不列）；与状态/团体/搜索全部 AND 叠加；两级分组下只显示命中的「团体 → 期生」段。

## User stories

1. 选人页可选「全部期生」或具体某期；选择后名册只剩该期的段（跨团显示，如「1期生」同时命中七团的 1期生 段）。
2. 汉字/阿拉伯归一：坂道选「1期生」同时命中乃木坂的「1期生」与櫻坂/日向坂的「一期生」；段头仍显示数据原文。
3. 与团体、状态、搜索叠加（例：团体=AKB48 + 期生=1期生）。
4. 选项文案随语言（en「1st gen」）；切换系列时复位为「全部期生」（与既有筛选项同为易失状态，不持久化）。
5. 无命中时沿用空态提示。

## Implementation Decisions

- `core.js`：`genKey(label)`（`一..二十一` 汉字期生 → 阿拉伯；其余原样）、`generationOptions(sections)`（按出现顺序去重、排除 `TRANSFER_GENERATION`）、`groupSections(sections, groupFilter, genFilter)` 增第三参（缺省不过滤，向后兼容）。
- `session.js`：状态加 `generation: "all"`（易失、不持久化、切系列复位）、`setGeneration(v)`、`snapshot()` 暴露。
- `app.js`：`#gen-filter` 下拉（`refreshGenOptions()` 于 `renderChrome` 重建，选项文案走 `CORE.genText`）、change 接线、`renderRoster`/`renderSearch`/`toggleGroupNode` 三处过滤都带上期生。
- `i18n.js`：`gen_label` / `gen_all`（zh 期生/全部期生、en Generation/All generations、ja 期生/すべての期生）。

## Testing Decisions

- core 缝：`genKey` 汉字范围与例外、`generationOptions` 顺序/去重/排除、`groupSections` 叠加与向后兼容。
- session 缝：`setGeneration` 生效、同值拒绝、切系列复位；首测快照补 `generation`。
- i18n 缝：新键三语存在（键集合一致）。
- E2E：48G 期生下拉选项、筛 1期生 只见该期且七团有节点、复位、坂道「一期生/1期生」归一命中三团。

## Out of Scope

- 多选期生、期生搜索建议、按期生排序、把期生筛选持久化；候选人数字（如「1.5期生」）的排序重排（沿用数据出现顺序）。
