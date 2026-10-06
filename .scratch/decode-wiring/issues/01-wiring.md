# 工单 01：接线测试 + `text_fetcher` 单一出处

- **Status**: resolved
- **Blocked by**: 无

## 实现

- 新增 `text_fetcher(fetch_url)`（`decode_page` 之后）：`lambda url: decode_page(fetch_url(url))`。
- `_load_series` 改调它；`check_roster.main` 改用它（删掉自己那份 lambda）。
- 新测试 `LoadSeriesWiringTests`（`test_fetch_members.py`）2 条：
  1. 页面到达 loader 时已解码（Shift_JIS 的 `ALT="吉澤ひとみ"`）；
  2. loader 抛错 → `SystemExit`、消息含「等爱」与「不写入」。

## 判据与结果

1. 测试 2 条 ✓（绿 —— 这是接线的特征测试）。
2. 变异①（改回 UTF-8 replace）**被杀** ✓ —— 两轴审查复跑确认：113 条里**唯一**红的就是
   新接线测试（证明承重的是它、不是重复测纯函数）。变异②（删 cp932 兜底）被杀，但红的是
   **既有**的 `DecodePageTests`（纯函数测试）—— 它证明的是纯函数覆盖，不是本测试承重。
3. `npm run check` exit=0 ✓（产品行为不变：`members.js` 未动）。

## 两轴审查（2026-10-06，基点 8e97b04..8402fcb）

无高无中；三条低：

- 变异②的归属措辞（上）→ 已订正。
- `LoadSeriesWiringTests` docstring 的时态（修复后已不成立）→ 已订正为「修复前」，
  并把事故数字从 3 份副本减到 1 份（指路 `decode_page`）。
- `_load_series` 的 `loader=None` 早退分支无测试 —— 但 `main` 已用默认 loader 兜底、
  生产不可达（防御代码，本仓规矩不删既有死代码）→ 记为遗留，不在本批做。
