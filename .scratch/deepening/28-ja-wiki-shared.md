# 深化㉘：ja.wikipedia 取数收进 `ja_wiki.py`（失败策略变显式参数）

- **来源**：架构扫描候选④（`/tmp/opencode/architecture-review-20261003-130435.html`），
  grill 三问全采纳（2026-10-03）
- **范围**：新模块 `scripts/ja_wiki.py` + `photo_chain` / `love_members` /
  `morningmusume_members` 的取数调用 + 测试与守卫

## 事实（实测）

- 两份 `wiki_wikitext`（love 失败**抛**、morning 失败**静默空串**）URL 与参数逐字相同、
  只在失败语义分叉；`WIKI_API` 住在 `photo_chain`（它自己也在用）。
- 第三个取数器 `wiki.py` 的 `wikitext` 是 48pedia 层（自带 UA/代理），不属这条缝。

## 决定（grill 2026-10-03）

1. **新模块 `scripts/ja_wiki.py`**（`WIKI_API` + `wiki_wikitext`）：模块名就是它干的事；
   `photo_chain` 从它 import `WIKI_API`；love 保留 `WIKI_API` re-export（既有测试按它找）。
2. **失败策略显式参数** `on_error="raise"`（默认，love）/ `"empty"`（morning）——
   两处行为都不变，差异从「两段代码」变成参数。
3. **守卫**：`ja_wiki.py` 的 def 集合 == `{wiki_wikitext}`；两个 loader 必须调它、
   不许再自己留一份；`photo_chain` 不许定义它。

## 等价性凭据

纯重构：产物 `members.js` 逐字节不变；`json`/`urllib.parse` 在两个 loader 里成为
未用 import，已一并删除（本改动造成）。
