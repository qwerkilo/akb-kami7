# 日语界面（ja locale）spec

**Status:** ready-for-agent

## Problem

UI 只有 zh/en 两种文案，而站点数据本身是日文（48pedia 名字/期生/状态）。日语用户读 UI 有隔阂——这是最自然缺的一门语言。

## Solution

`i18n.js` 新增 `ja` 块（110 键，与 zh 同集合）；数据字段日语**直出数据原文**（映射表只服务 zh/en）；页头语言切换器加「日」；首次访问按浏览器语言自动选。

## User stories

1. 浏览器语言为 ja 的用户首次访问，界面直接是日语（步骤条「選ぶ / 対決 / ポスター」）。
2. 任何用户点页头「日」即可切到日语，选择被记住（刷新后仍是日语）。
3. 日语界面的数据字段（出身地/星座/血液型/期生/状态/趣味/特技）直接显示日文原文（如「神奈川県」「1998年3月15日」「卒業」）。
4. 日语下搜索提示/空结果提示是日语（「見つかりませんでした」+ ローマ字指引）。
5. 海报与分享文案随语言（`私の48グループ` / `神7` / `圏内`）。
6. `html[lang]` 随语言（`ja` / `en` / `zh-CN`）。
7. 键完整性：ja 缺任何键会在 `npm test` 失效。

## Implementation Decisions

- **数据字段**：`core.js` 的 `localized()` 对 `ja` 直接返回原文；`bioDate()` 加 ja 格式（`1998年3月15日`）；`bloodText`/`genText`/`leaveText` 原有非 en 直通逻辑天然覆盖 ja。
- **文案**：`i18n.js` 新增 110 键，术语沿用日文原生词（神7 / 7福神 / 圏内 / 推し7；系列 = 48グループ / 坂道 / イコノイジョイ），按钮名词形、说明「〜ます」体。
- **切换器**：`.seg-lang` 加第三键「日」（沿用 44px radiogroup 模式）。
- **默认语言**：`app.js` 启动时读 `akb-lang`；无存档则按 `navigator.language`（ja*→ja、zh*→zh、其他→en）；`setLang` 接受三值。
- **测试**：i18n parity 扩到三语（ja 与 zh 同集合；en 允许 `leave_*`）；`names` 组合与真实字典驱动两处循环扩到 ja 并补 ja 品牌期望表。

## Testing Decisions

- `test/i18n.test.js`：parity（三语）、静态键扫描（三语）、names 期望表（ja 品牌词）、真实产物驱动（ja 无 `undefined`）。
- E2E：切「日」→ 步骤条/副标题/`html lang`/空搜索提示；独立页面 `locale: ja-JP` + 清存档 → 自动日语；两套 E2E 以 `locale: zh-CN` 启动以保持既有中文断言。

## Out of Scope

- 数据字段的日语改写（原文即日文，不做润色）；日语特有的排版微调（禁则处理/字体栈）；韩语等其他语言。
