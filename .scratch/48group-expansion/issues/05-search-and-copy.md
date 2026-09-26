# 05: 搜索扩展与 48 Group 文案/品牌

**What to build:** 搜索同时匹配汉字名、假名与昵称，片假名输入可命中平假名；页面品牌与提示文案从 AKB48 专用改为范围中性的「48 Group 神7」，中英同步。

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] 输入汉字、平假名、片假名、昵称（大小写不敏感）都能找到成员
- [ ] 汉字变体归一仍生效（﨑/崎、髙/高、邉/辺 等）
- [ ] 标题改为「48 Group 神7 / 48 Group Kami 7」，副标题保留「历代成员版 / All generations」，页面 title/description 与搜索占位同步改为中性文案
- [ ] 所有新增文案在 zh/en 两处齐全，index.html 的 data-i18n 属性同步
- [ ] node:test：zh/en 键集合一致；index.html 引用的 data-i18n 键都存在于 I18N
- [ ] `npm test` 全绿
