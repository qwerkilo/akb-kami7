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

1. 测试 2 条 ✓（绿 —— 这是接线的特征测试，承重由变异证明）。
2. 变异①（改回 UTF-8 replace）**被杀** ✓；变异②（删 cp932 兜底）**被杀** ✓。
3. `npm run check` exit=0 ✓（产品行为不变：`members.js` 未动）。
