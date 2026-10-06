# 工单 02：链的失败语义（`errors` → `(url, reason)`）

- **Status**: ready-for-agent
- **Blocked by**: 01

## 背景

`photo_chain` 的 `commons_photo` / `commons_search_photo` 用可选 `errors` 列表收失败，
调用方再翻成中文；`love_members` 不传（失败静默）。Q3：链返回 `(url, reason)`，
原因在产生处写一次。

## 决定

- `commons_photo(name, fetch) -> (url, reason)`、`commons_search_photo(name, fetch) -> (url, reason)`：
  成功 `(url, None)`；请求失败 `(None, "查询失败")`；查了但没有 `(None, "源里没有")`。
  内部 `_search_hits` / `_imageinfo` 不再收 `errors`（原因由外层定）。
- `morningmusume_members._commons_for` / `_resolve_commons` 用新返回值；
  `love_members` 的两个调用点接上（缺图者获得原因）。
- `_note_scan_gaps` 的三类截断原因保留（旧站侧不变）。
- 删除 `photo_chain` 的 `errors` 参数（守卫：不许再出现 `errors=`）。

## 判据（可证伪）

1. 守卫：`photo_chain.py` 里不出现 `errors`（参数与调用）；`love_members` 调用点用新形状。
2. 夹具：搜索请求抛异常 → `(None, "查询失败")`；空结果 → `(None, "源里没有")`；
   命中 → `(url, None)`（三种都断言）。
3. love 的缺图者报告里有原因（不是「未记录」）。
4. 产物逐字节不变。
5. 变异 ≥2 全杀（把失败并进「源里没有」/ 忘记 love 的接线）。

## 注意

- `cdx_rows` / `wayback_photo` 不在范围（已知限制，见 ADR-0024 的后果）。
