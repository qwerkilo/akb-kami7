# 工单 01：特征测试 + `wayback.py` + 搬迁调用点

- **Status**: in progress
- **Blocked by**: 无

## 实现

1. **先补特征测试**（缝①，`scripts/test_wayback.py`）：`snapshot_url` 拼、`snapshot_ts` 拆、
   `original_url` 剥前缀、往返（拼→拆得回原 URL 与 ts）、非快照 URL 原样返回。
2. 新建 `scripts/wayback.py`：`cdx_rows`（从 `photo_chain` 原样搬）、`snapshot_url`、
   `snapshot_ts`（morning 的正则）、`original_url`（love 的正则）、`latest_snapshot`
   （原 `wayback_photo`，改用 `snapshot_url`）。
3. 搬迁调用点：
   - `photo_chain`：删 `cdx_rows`/`wayback_photo`（不再需要 `urllib.parse` 时一并删 import）。
   - `love_members`：`photo_chain.cdx_rows`→`wayback.cdx_rows`、`photo_chain.wayback_photo`→
     `wayback.latest_snapshot`、内联格式→`wayback.snapshot_url`、自己的 `WAYBACK_PREFIX`/
     `original_url` 删掉、2 处调用（:69 / :205）改 `wayback.original_url`。
   - `morningmusume_members`：`snapshot_ts`/`_snapshot_url` 删掉、改 `wayback.*`；
     `photo_chain.cdx_rows`/`photo_chain.wayback_photo` 改指。
4. 测试跟着搬（`test_photo_chain` 的 `cdx_rows`、`test_morning_members.snapshot_ts`、
   `test_love_members.original_url`）。

## 判据与结果

- 特征测试 5 条（`test_wayback.py`）：拼/拆/剥前缀/往返/`[a-z]*` 后缀 ✓ 全绿。
- 搬迁后 `scripts/` 单测 **326 条 OK**；`id_/` 与 `web.archive.org/web/` 在产品代码里
  只剩 `wayback.py` 一处 ✓。
- 测试搬迁对账：`photo_chain` 的 8 条特征测试**搬进** `test_wayback.py`（`cdx_rows` 6 +
  `wayback_photo` 2，改名 `latest_snapshot`）；love 的 `original_url` 用例与 morning 的
  `snapshot_ts` 用例**删除**（同输入同输出，已被新用例覆盖 —— love 的 `im_` 后缀用例
  并进新文件的 `test_strip_tolerates_rewrite_suffixes`，没有丢覆盖）。
