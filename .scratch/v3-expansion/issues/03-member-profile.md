# 03: 成员简介（48pedia 数据 + profileRows + sheet）

**What to build:** 48G/坂道成员卡片与结果列表出现「i」按钮，点开底部资料卡（原型 C「杂志编辑」样式）：生年月日、年龄、出身地、昵称、团体、期生、状态；无数据的字段不显示；值随页面语言本地化（映射表 + 自由文本对照表，专有名词保持原文）。

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] 解析器新增「生年月日」（`{{生年月日|Y|M|D}}`）与「出身地」（`{{出身地|…}}`）→ `bio: {birth, from}`；fixture 测试
- [x] `core.js` 新增 `profileRows(m, t, lang)`（纯函数）：按可用字段组装 `[label, value]` + 值本地化映射（星座/血型/都道府县/期生/日期；自由文本查 i18n 对照表，未收录回退原文），node 测试
- [x] 样式按原型 C（分支 `prototype/ui-v3-profile`，`764d029`）实现
- [x] 选人卡片右上角「i」按钮 → 底部 sheet（关闭按钮/点背景/Esc）；不干扰点卡片选中
- [x] 结果列表行内 ⓘ 打开同一 sheet
- [x] 产物不变量：48G/坂道成员 `bio` 形状；`npm test` 全绿

## Comments

2026-09-27：解析器新增 `birth_from_chunk`/`hometown_from_chunk`（兼容 `{{生年月日}}`/`{{生年月日と年齢}}`）→ `bio: {birth, from}`，`merge_person` 跨团合并 bio、`project_member` 投影；重跑产物：1337/1338 有生日、1292/1338 有出身地。`core.profileRows(m, t, lang, values, now)` 字段顺序 + 值本地化（47 都道府县、12 星座、血型 Type X、期生序数、日期格式、年龄按 now 注入），自由文本查 `I18N.values` 未收录回退原文。UI：卡片 i 角标（不触发选中）+ 结果列表 ⓘ → 底部资料卡（原型 C 杂志编辑：宋体名、品红标签、双栏），Esc/背景/关闭按钮关闭，语言切换跟随（zh/en 标签）。验证：`npm test` JS 68 + Python 51、E2E 49/49（新增 3 项简介检查）、截图核对。
