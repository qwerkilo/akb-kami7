# 深化 ⑥：i18n 键契约接进缝（报告候选 ④）

**Status:** resolved（2026-09-28）

## 背景

架构扫描（`/tmp/opencode/architecture-review-20260928-0222.html` 候选 ④）：i18n 缝的 adapter 只监听 `index.html` 属性与 `app.js` 字面量，最大消费者 `core.js` 不可见（键经 `CORE.*(m, t, lang)` 间接使用），且 `test/core.test.js` 自带一份 `bioDict` 副本；死键无人查。实测：删掉 `grad_short` 后所有测试仍绿，而真实 `posterSub` 输出 `1期生 · 2012 undefined`。

## 做了什么

1. `test/i18n.test.js` 新增三项：
   - **core.js 静态键扫描**（与 app.js 同款正则，含跨行调用 `t(\s*"`）；
   - **真实字典驱动真实组合**：用 `members.js` 产物（按 app.js 同款摊平 `group/generation/series`）× zh/en 跑 `metaText/fullMeta/posterSub/profileRows`，断言全为字符串、非空、无 `undefined`、无 `[object`；
   - **死键守卫**：未被 HTML 属性 / app.js / core.js 引用的键只允许动态家族 `bio_ / series_ / title_prefix_ / photo_src / leave_`。
2. `i18n.js` 删死键 3 个：`left_year`、`left`、`remove`（zh/en）。
3. `index.html` 6 处硬编码 aria-label 改为 `data-i18n-aria-label`（`series_label`、`lang_label`、`size_label`、`filter_label`、`slots_label`、`bio_close`），`i18n.js` 补 4 个新键（`lang_label / size_label / filter_label / slots_label`，zh/en 成对）。

## 验证

- `npm test`：JS 95（+3）+ Python 77；i18n 8/8。
- 红→绿过程：死键守卫先红（报出 3 个死键）；驱动测试先暴露测试自身两处 harness 缺陷（`t` 未调用函数值、`profileRows` 行是数组），修正后全绿。
- E2E 回归 62/62 + v5 42/42（aria-label 改动不影响选择器）。

## 备注

- `test/core.test.js` 的 `bioDict` 副本**保留**：它是 core 缝的独立期望（不读产物），删掉会削弱 core 缝的独立性；i18n 缝现在用真实字典兜底，两者互补。
- 未做（有意）：`leave_*` 是 en 直译家族（zh 走原文），不进死键守卫；动态键不静态化（会失去 i18n 的惰性）。
