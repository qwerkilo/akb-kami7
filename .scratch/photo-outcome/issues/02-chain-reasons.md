# 工单 02：链的失败语义（`errors` → `(url, reason)`）

- **Status**: resolved
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

## 实现记录（2026-10-06）

- `commons_photo(name, fetch) -> (url, reason)`、`commons_search_photo(name, fetch) -> (url, reason)`：
  命中 `(url, None)`；请求失败/形状异常 `(None, "查询失败")`；查了但没有 `(None, "源里没有")`。
  内部 `_search_hits` / `_imageinfo` 改成**失败抛**（原因由外层翻一次），`_note` 删除。
- `morningmusume_members._commons_for` 返回 `(url, reason)`（photo_url 兜底成功时 reason
  清空）；`_resolve_commons` 用 `notes.setdefault(file, reason or "源里没有")`（旧站截断
  原因仍优先）。love 的 `_resolve_member_photo` 同改（**等爱的缺图者从「未记录」变成有原因**）。
- 守卫（缝③）：`photo_chain.py` 里不许出现 `errors`（剥注释再扫）+ 两个签名 + 链必须自己
  产生两个原因串。
- 测试：`test_photo_chain` 的 **21 处调用点**按新契约更新（命中 → `(url, None)`；坏载荷/
  形状异常 → 「查询失败」；空 → 「源里没有」）；两组以 `errors` 写的测试重写成
  `ReasonTests` / `ShapeAnomalyTests`，`SameWritingLimitationTests` 的断言改为元组；
  love 新增「429 不许压成源里没有」。
- 变异 **2 个全杀**（失败并进「源里没有」/ love 的原因写死）；守卫承重（去掉签名里的
  二元组或恢复 errors 会红）。
- 真实源抽查（3s 节流）：後藤真希命中（与缓存一致）、福田明日香「源里没有」（与缓存
  一致）；須藤茉麻/夏焼雅在**链的更早一段**（`/og/`/旧站）命中，直接调 Commons 得到的
  是另一张合法图 —— 不是回归（链序未动）。
- 复杂度：`commons_search_photo` 11 → 拆 `_best_candidate`。

**真实跑**：同工单 01（三次尝试都被 ≠ME 站那一页的 500/超时挡住，门正确中止未写入）；
真实源抽查见上（Commons/Wikipedia 通，命中与缓存一致）。

## 两轴审查后的修复（2026-10-06）

- 链的原因串收成常量 `QUERY_FAILED` / `SOURCE_EMPTY`（唯一定义点）；`_commons_for` 的
  「任一阶段失败 → 查询失败」；loader 不再写原因字面量（缝③ 守卫钉住，变异被杀）。

- 已知缺口（审查记录）：spec 的「异常细节留在日志行」未实现 —— 原因只到「查询失败」
  粒度（与旧实现一致，旧的 errors 列表也从未打印）；加逐人日志会与 Q6-B 冲突，
  留作单独设计。
