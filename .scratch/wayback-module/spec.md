# Spec：Wayback 知识收进 `scripts/wayback.py`（第五轮扫描候选 8）

- Status: in progress
- 来源：第五轮架构扫描候选 8 ——「『跟 Wayback/源站说话』的知识散在四模块」

## 问题（核对后的实际形状）

| 知识                              | 现状                                                                                            | 份数            |
| --------------------------------- | ----------------------------------------------------------------------------------------------- | --------------- |
| 快照 URL 格式 `web/{ts}id_/{url}` | `photo_chain.wayback_photo`、`morning._snapshot_url`、`love` 内联在循环里                       | **3**           |
| 快照 URL 解析                     | `morning.snapshot_ts`（`/web/(\d{4,14})`）与 `love.WAYBACK_PREFIX + original_url`（另一条正则） | **2 种写法**    |
| CDX 查询构造                      | `photo_chain.cdx_rows`                                                                          | 1 ✓             |
| 主机节流 / 下载重试               | `fetch_pool` 的 host 表 / `fetch_members`                                                       | 1 ✓（不在范围） |

分叉的后果不是学术性的：`id_` 是「不做注入改写」，love 内联那份漏改就会取到被 Wayback
改写过的 HTML，而**任何单测都不会红**（两条链各自都有测试）。

## 决定（grill 2026-10-07，全部采纳推荐）

| #   | 决定                                                                                               |
| --- | -------------------------------------------------------------------------------------------------- |
| Q1  | 新建 `scripts/wayback.py`（主机模块，先例 `ja_wiki.py`）：CDX 查询、快照 URL 的拼/拆、最近快照     |
| Q2  | `cdx_rows` 与 `wayback_photo` 一并搬进去；后者改名 `latest_snapshot`（它接受任意 URL，不专用于图） |
| Q3  | 调用点全改 `wayback.*`（6 处 + 测试 + 守卫），不在 `photo_chain` 留 re-export                      |
| Q4  | 缝③ 守卫：「Wayback URL 格式与解析只许在 `wayback.py`」                                            |
| Q5  | 既有测试跟着搬；**先补 3 条特征测试**（拼/拆往返）再搬                                             |

## 非目标

- `fetch_pool` 的主机节流表与 `fetch_members` 的下载重试：都是**多主机通用**知识，
  已在单一出处，不动。
- `love_members.WIKI_API` 的 re-export：历史包袱、与 Wayback 无关，不动。

## 验收（可证伪）

1. 产品代码里 `id_/` 与 `web.archive.org/web/` **只在 `wayback.py`** 出现（缝③ 守卫）。
2. `photo_chain.py` 不再定义 `cdx_rows` / `wayback_photo`；def 集合守卫随之更新。
3. `love_members` / `morningmusume_members` 必须调 `wayback.*`（守卫），且不再定义
   `cdx_rows|snapshot_url|snapshot_ts|original_url|latest_snapshot`。
4. 纯重构：`members.js` 逐字节不变（本批不跑真实管线，靠产物文件哈希 + 单测）。
5. 变异 ≥3 个全杀（含「love 内联格式」复活、「解析正则」第二份）。
