# Spec：`decode_page` 的接线覆盖（第五轮扫描候选 6）

- Status: resolved
- 来源：第五轮架构扫描候选 6 ——「`decode_page` 纯函数有测试、接线零覆盖」

## 问题

`decode_page`（`fetch_members.py`）有 3 条直接测试，但它的**生产接线**（`_load_series`
注入给 loader 的 fetch）**0 条测试**：改回 `.decode("utf-8", "replace")` 全仓不会红。
这条接线的回归实测过一次（2026-10-05/06）：旧官网 2005 前后的页是 Shift_JIS →
姓名变乱码 → 照片配对全灭（早期モー娘。 25 人一个都配不到），花了一整轮才定位。

## 决定（grill 2026-10-06，全部采纳推荐）

| #   | 决定                                                                                    |
| --- | --------------------------------------------------------------------------------------- |
| Q1  | 缝① 行为接线测试（假 loader 捕获注入的 fetch，喂 Shift_JIS 字节断言解码后的文本）       |
| Q2  | 抽 `text_fetcher(fetch_url)` 一处，`_load_series` 与 `check_roster` 共用（2 份 → 1 份） |
| Q3  | 不加源码守卫（行为测试承重，形状守卫无额外分辨力）                                      |
| Q4  | 变异 2 个必须全杀（改回 UTF-8 replace / 删 cp932 兜底）                                 |

## 非目标

- 不动 `decode_page` 的解码逻辑本身（已有测试）。
- 48G / Wikipedia 两条边走 API（JSON），没有 charset 解码问题，不进范围。

## 验收（可证伪）

1. 接线测试在：`_load_series` 注入的 fetch 喂 Shift_JIS 字节 → loader 收到 `吉澤ひとみ`
   而不是乱码；loader 抛错 → `SystemExit` 且消息含系列名与「不写入」。
2. `check_roster` 与 `_load_series` 走**同一个** `text_fetcher`（grep 无第二份 lambda）。
3. 变异 2 个全杀。
