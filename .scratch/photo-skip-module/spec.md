# Spec：跳过名单收进 `scripts/photo_skip.py`（第五轮扫描候选 10）

- Status: resolved
- 来源：第五轮架构扫描候选 10（Speculative）——「跳过名单是『函数+隐藏属性』、两个 loader 各解一遍」
- **记账**：本批的 spec/工单写在实现**之后**（先按 grill 的四问推荐做了实现），
  与「先落 spec 再实现」的惯例不符 —— 如实记下，不假装顺序正确。

## 问题

| 角色   | 现状                                                                                  |
| ------ | ------------------------------------------------------------------------------------- |
| 生产   | `photo_skip_predicate` 返回**函数** `skip(member)`，挂**隐藏属性** `skip.skipped`     |
| 消费 1 | love `_needs_photo`：`not (skip and skip(m))`                                         |
| 消费 2 | morning：`[m for m in members if not (skip and skip(m))]`（同一表达式第二遍）         |
| 消费 3 | `_warn_skipped_without_files`：`getattr(skip_photo, "skipped", set())` + 自己再派生键 |

`(团, 名)` 键四处各派生一次；`getattr(..., set())` 的默认值是静默降级（属性名一改，
警告永远不响）。顺带核出：`_warn_skipped_without_files` **零测试**。

## 决定（grill 2026-10-07，全部采纳推荐）

| #   | 决定                                                                                                                                                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | 新模块 `scripts/photo_skip.py`：`key(member)`（键的唯一出处）+ `skips(skipped, member)`（含 None 处理）；名单是**一组键**（frozenset）；`photo_skip_predicate` 改名 `photo_skip_keys` 并返回键集合；`_warn_skipped_without_files` 直接收集合；两个 loader 改调 `photo_skip.skips()` |
| Q2  | 先补警告的三条特征测试（新契约：set 输入）再动                                                                                                                                                                                                                                      |
| Q3  | 缝③ 守卫：隐藏属性协议不许复活（`getattr(..., "skipped")` / `.skipped` 全仓 0 处）+ 两个 loader 必须调 `photo_skip.skips()` + `photo_skip.py` 的 def 集合 == `{key, skips}`                                                                                                         |
| Q4  | 变异：①`skips` 去掉 None 处理（应红）②`key` 只用 name（应红）                                                                                                                                                                                                                       |

## 验收（可证伪）

1. 三条警告测试：新契约下「跳过的人缺文件 → 出声」「有文件 → 静默」「不在名单 → 静默」。
2. `getattr(..., "skipped")` 与 `.skipped` 在产品代码 0 处；两个 loader 调 `photo_skip.skips(`。
3. 332 条 Python 单测全绿；`npm run check` exit=0。
4. 变异 2/2 被杀（去掉 None 处理 / 键只用 name）。
