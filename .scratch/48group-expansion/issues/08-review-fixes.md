# 08: 首次 code review 修复（8c3361b..2587f33）

**What to build:** 处理首轮 code review 两轴发现的问题：4 行上游脏数据被原样带入、跨团来源标注硬编码中文、移籍成员结果 meta 缺毕业年份、托盘缺团体信息、缺加入期行无提示。

**Blocked by:** 07

**Status:** ready-for-agent

- [x] 解析器修复 SDN48 4 行 `data-sort-value="…" |` 脏姓名/昵称（`clean_name` 与昵称启发式），补 fixture 测试；产物测试增加字段纯净断言（不得含 `data-sort-value`、`[`、`]`、`{`、`}` 等）；重跑生成
- [ ] 跨团来源标注结构化：`members.js` 不再写死中文（`兼任：`/`移籍自：`），改为结构化字段，由 `i18n.js` 渲染，en 界面不再出现中文
- [ ] `fullMeta`：移籍类成员补上毕业年份（如 宮澤佐江 →「SKE48 · 兼任・移籍加入 · 兼任・移籍：AKB48 · 2016 毕业」）
- [ ] 已选托盘以 title/aria 显示「团体 · 期生」（用户故事 14 的托盘部分）
- [ ] 缺加入期行在上游结构变化时输出维护者可见的提示（用户故事 25）
- [ ] 清理 `app.js` 中已迁走的残留注释；review 判断项里明确要做的小项
- [ ] 重跑生成、`npm test`、E2E 冒烟；更新本工单与检查点

## Comments

2026-09-26：由 code review（基点 8c3361b）开出。两轴结论见 `docs/reviews/checkpoints.md` 同日记录。

2026-09-26 · ① 脏数据修复（diagnosing-bugs 流程）：

- 回路：`python3 -m unittest discover -s scripts -t scripts -p 'test_fetch_members.py' -k SortKey -v`（0.001s、确定性、先红后绿）；产物层断言 `test/members-artifact.test.js`「成员字段无 wikitext/排序键残留」先红后绿。
- 根因（三假设全部命中）：1) `clean_name` 未剥离 `data-sort-value="…" |` 前缀（チェン・チュー、シヨン的 name）；2) 昵称扫描行选择只排除 `ファイル:` 链接、漏了 `File:` 命名空间，导致以图片行下一格（排序键单元格）当昵称（KONAN、miray）；3) 缺属性型单元格的防御过滤。
- 修复后 4 人：チェン・チュー（nick ちゅちゅー）、KONAN（nick コニャン）、シヨン（nick シヨン）、miray（nick miray将軍）。
- 重跑生成：1136/1136 有图（2 个改名成员换了 id，旧图删除、新图下载压缩）。
