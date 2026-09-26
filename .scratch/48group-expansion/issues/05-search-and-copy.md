# 05: 搜索扩展与 48 Group 文案/品牌

**What to build:** 搜索同时匹配汉字名、假名与昵称，片假名输入可命中平假名；页面品牌与提示文案从 AKB48 专用改为范围中性的「48 Group 神7」，中英同步。

**Blocked by:** 04

**Status:** resolved

- [x] 输入汉字、平假名、片假名、昵称（大小写不敏感）都能找到成员
- [x] 汉字变体归一仍生效（﨑/崎、髙/高、邉/辺 等）
- [x] 标题改为「48 Group 神7 / 48 Group Kami 7」，副标题保留「历代成员版 / All generations」，页面 title/description 与搜索占位同步改为中性文案
- [x] 所有新增文案在 zh/en 两处齐全，index.html 的 data-i18n 属性同步
- [x] node:test：zh/en 键集合一致；index.html 引用的 data-i18n 键都存在于 I18N
- [x] `npm test` 全绿

## Comments

2026-09-26：完成。三处决定与发现：

1. `I18N` 整体抽到 `i18n.js`（UMD，浏览器挂 `window.AKB_I18N`），否则 i18n 完整性无法在 node:test 里测。
2. 搜索匹配改为 `CORE.haystack(m)`（名字 + 假名 + 昵称），`normalizeName` 增加片假名→平假名归一；真实数据验证：`あっちゃん`→前田敦子、`サッシー`→指原莉乃、`山崎`→山﨑空等。
3. 测试发现 zh/en 键集并非完全一致：`leave_*` 直译只存在于 en（zh 直接显示日文理由），测试改为「zh ⊆ en，且 en 多出的键必须都是 leave_*」，并把该契约写进测试名。
   品牌中性化同时覆盖：页面 eyebrow、标题输入框默认值、海报日期行与页脚、分享文本、下载文件名（`48group_*.png`）；灵感来源的外链文字保持原站名不动。
