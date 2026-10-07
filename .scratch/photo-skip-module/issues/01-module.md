# 工单 01：photo_skip 模块 + 消费点改指 + 守卫

- **Status**: resolved
- **Blocked by**: 无

## 实现

1. 新契约的警告测试 3 条（`WarnSkippedWithoutFilesTests`）—— 先写、先看红
   （当前 getattr 协议收不到 set 输入，「应该出声」那条红）。
2. `scripts/photo_skip.py`：`key` + `skips`（纯函数，不 import 管线 —— 避免循环依赖：
   `fetch_members` → loaders → `photo_skip`）。
3. `fetch_members`：`photo_skip_predicate` → `photo_skip_keys`（返回 frozenset）；
   `_warn_skipped_without_files(members, skipped, dirs)` 收集合、走 `photo_skip.skips`。
4. love `_needs_photo` / morning `resolve_former_photos` 改调 `photo_skip.skips`。
5. 旧测试改到新契约（4 条 predicate + 1 条 photo_skip_for + 2 条 loader 的 `skip=`）。

## 判据与结果

- 三条警告测试：先红（新契约）→ 实现后全绿 ✓。
- 332 条 Python 单测全绿；守卫 24/24；`npm run check` exit=0。
- 变异：去掉 `skips` 的 None 处理 **被杀**；`key` 只用 name **被杀**。
- 变异记账：第一版「去掉 None 处理」写成 `key in (skipped or set())` —— 与原文**等价**
  （None/空集/非空集三路同输出）→ 存活是预期，不是覆盖缺口；换成真去掉 None 守卫后被杀。
