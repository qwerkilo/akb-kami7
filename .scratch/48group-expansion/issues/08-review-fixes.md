# 08: 首次 code review 修复（8c3361b..2587f33）

**What to build:** 处理首轮 code review 两轴发现的问题：4 行上游脏数据被原样带入、跨团来源标注硬编码中文、移籍成员结果 meta 缺毕业年份、托盘缺团体信息、缺加入期行无提示。

**Blocked by:** 07

**Status:** ready-for-agent

- [x] 解析器修复 SDN48 4 行 `data-sort-value="…" |` 脏姓名/昵称（`clean_name` 与昵称启发式），补 fixture 测试；产物测试增加字段纯净断言（不得含 `data-sort-value`、`[`、`]`、`{`、`}` 等）；重跑生成
- [x] 跨团来源标注结构化：`members.js` 不再写死中文（`兼任：`/`移籍自：`），改为结构化字段，由 `i18n.js` 渲染，en 界面不再出现中文
- [x] `fullMeta`：移籍类成员补上毕业年份（如 宮澤佐江 →「SKE48 · 兼任・移籍加入 · 兼任・移籍：AKB48 · 2016 毕业」）
- [x] 已选托盘以 title/aria 显示「团体 · 期生」（用户故事 14 的托盘部分）
- [x] 缺加入期行在上游结构变化时输出维护者可见的提示（用户故事 25）
- [x] 清理 `app.js` 中已迁走的残留注释；review 判断项里明确要做的小项
- [x] 重跑生成、`npm test`、E2E 冒烟；更新本工单与检查点

## Comments

2026-09-26：由 code review（基点 8c3361b）开出。两轴结论见 `docs/reviews/checkpoints.md` 同日记录。

2026-09-26 · ① 脏数据修复（diagnosing-bugs 流程）：

- 回路：`python3 -m unittest discover -s scripts -t scripts -p 'test_fetch_members.py' -k SortKey -v`（0.001s、确定性、先红后绿）；产物层断言 `test/members-artifact.test.js`「成员字段无 wikitext/排序键残留」先红后绿。
- 根因（三假设全部命中）：1) `clean_name` 未剥离 `data-sort-value="…" |` 前缀（チェン・チュー、シヨン的 name）；2) 昵称扫描行选择只排除 `ファイル:` 链接、漏了 `File:` 命名空间，导致以图片行下一格（排序键单元格）当昵称（KONAN、miray）；3) 缺属性型单元格的防御过滤。
- 修复后 4 人：チェン・チュー（nick ちゅちゅー）、KONAN（nick コニャン）、シヨン（nick シヨン）、miray（nick miray将軍）。
- 重跑生成：1136/1136 有图（2 个改名成员换了 id，旧图删除、新图下载压缩）。

2026-09-26 · ② 来源标注结构化：`merge_members` 改为输出 `extras: [{group, current}]`（45 人），`note` 仅保留「加入期来自未收录团体」这类专有信息；`app.js` 用 `sourceNote()` 经 i18n（`src_concurrent`/`src_transferred`/`src_mixed`）渲染，中文顿号/英文逗号分隔。产物测试断言 extras 结构且 note 不得含硬编码标注。

2026-09-26 · ③④⑤⑥ 收尾：

- `fullMeta` 对毕业成员统一走 `yearLeave()`（含移籍段），E2E 实测 宮澤佐江 结果显示「2016」。
- 托盘 aria/title 追加「团体 · 期生」，E2E 断言 SKE48 槽位通过。
- `parse_rows` 对缺加入期但像成员行的条目计数并打印「warning: 跳过 N 行缺加入期（页面/分段）」；生成结束时若无图成员也打印警告（当前 0）。新增 unittest 断言提示输出。
- 删除 app.js 已迁走的「variant kanji」残留注释。
- 判断项取舍（未做，记录为可接受）：`esc` 转义表与 core 占位函数内的同型代码、`isTransfer` 依赖分段 label 字符串、`state.group === "all"` 的三处重复、团体清单三处定义（快照测试属有意）——继续做会引入新抽象或新数据字段，收益小于零依赖架构下的改动成本。
- 验证：`npm test` 20+20 全绿；生成 `--no-dl` 幂等（members.js 字节不变）；E2E 28/28（新增托盘标注与移籍年份两项断言）无 JS 报错。
