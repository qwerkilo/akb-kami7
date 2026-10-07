# 工单 01：产出与投影统一（`groups` rich，`extras` 退役）+ 重生成产物 + 守卫按系列

- **Status**: ready
- **Blocked by**: 无

## 实现

1. **48G 侧**（`scripts/fetch_members.py`）：
   - `merge_person`：`extras` → `groups`，元素 `{group, current}`，**含自家团**
     （按团归并：`current = any(该团记录的 status == "current")`）；只在多于一个团时写。
   - `:328` 的 `not m.get("extras")` → `not m.get("groups")`。
   - `:346` 的 `optional`：`"extras"` → `"groups"`。
2. **早安侧**（`scripts/morningmusume_members.py`）：`_assemble` 的 `belonged` 升级成 rich
   （同一归并规则），`optional` 不变。
3. **测试**：先写红测试（`merge_person` 的 rich 形状 + 含自家团 + 单团不写；早安侧同形）——
   Python 缝①；两侧投影的既有测试同步。
4. **重生成产物**：跑增量管线（`AKB_PROXY=http://127.0.0.1:7890 no_proxy=48pedia.org,www.48pedia.org
python3 -u scripts/fetch_members.py`），核对 `members.js` 的 diff 只含 `extras`→`groups`。
5. **产物守卫**（`test/members-artifact.test.js`）：
   - `:157` 的 extras 守卫改 `groups`（元素形状 + 不含文案）。
   - `:285` 的 `withGroups.length === 6` → **按系列期望**（morning 6 / 48g 46 / 坂道 3 = 55）
     - 视图级抽查（柏木由紀 ∈ NMB48、生駒里奈 ∈ AKB48、長濱ねる ∈ 日向坂46，走 `core.rosterView`）。
   - 加一条「0 人带 `extras`」（退役不留残迹）。

## 判据

- Python 单测全绿；产物里带 `groups` = 55、带 `extras` = 0。
- `members.js` diff 只含该字段迁移（逐段核对，无其他漂移）。
- 变异：`merge_person` 漏写自家团条目 → 被杀。
- `npm run check` exit=0。

## Comments

（实现时填写）
