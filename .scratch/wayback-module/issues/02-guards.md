# 工单 02：缝③ 守卫 + 变异验证

- **Status**: in progress
- **Blocked by**: 01

## 实现

- 更新 `photo_chain.py` 的 def 集合守卫（去掉 `cdx_rows`/`wayback_photo`）。
- 更新「love 必须调共享模块」那条 → `wayback.cdx_rows` / `wayback.latest_snapshot` /
  `photo_chain.commons_photo`。
- 新增守卫「Wayback URL 格式与解析只许在 `wayback.py`」：产品代码（排除测试）里
  `id_/` 与 `web.archive.org/web/` 只在 `wayback.py`；love/morning/photo_chain 不许定义
  `cdx_rows|snapshot_url|snapshot_ts|original_url|latest_snapshot`。
- 变异 ≥3：① love 内联格式复活 ② `snapshot_ts` 第二份实现 ③ `latest_snapshot` 改回
  自拼格式（值相同 → 靠守卫杀）。

## 判据与结果

- 守卫三条落地：`photo_chain` 的 def 集合（去掉两个名字）、「love 必须调
  `wayback.cdx_rows`/`wayback.latest_snapshot`/`photo_chain.commons_photo`」、
  「Wayback URL 格式与解析只许在 `wayback.py`」+ **格式字面量全仓恰好一处**
  （wayback.py 内部也必须走 `snapshot_url()` —— 防「值相同的第二份实现」）。
- 变异 3 个全杀：① love 内联格式复活 ② `snapshot_ts` 第二份实现 ③ `latest_snapshot`
  自拼格式（值相同 → 行为测试按定义抓不到，**只有计数守卫杀得掉**）。
- `npm run check` exit=0；产品行为不变（纯 Python 重构，`members.js` 未动、未跑 E2E）。
