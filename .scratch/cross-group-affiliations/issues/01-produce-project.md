# 工单 01：产出与投影统一（`groups` rich，`extras` 退役）+ 重生成产物 + 守卫按系列

- **Status**: resolved
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

## 判据与结果

- 产出/投影/重生成完成：**带 groups = 55**（48g 46 + 坂道 3 + morning 6）、**带 extras = 0**。
- `members.js` 逐成员结构比对：**0 漂移**（125 段 / 1544 人 / id 全同，除字段迁移外逐字段一致）。
- Python 336 条全绿；`npm run check` exit=0；复杂度棘轮无新增（顺手把 `merge_person`/`_assemble`
  各拆出一个助手，棘轮曾红两处）。
- 变异 3/3 被杀：①`merge_person` 漏写自家团条目 ②morning 的 `belonged` 丢自家团 ③`current`
  恒 False（补了「每团 current 各按自己记录」的测试让它承重）。
- 记账：一次**等价变异**（`rec["groups"] = [] or [`）存活是预期，不是缺口（换真变异后被杀）。
- 记账：morning 的 `groups` 顺序 = GROUPS 配置顺序（48G 侧是自家在前 + 记录顺序）—— 消费者
  都不看顺序，测试期望按实测写。

## Comments

- 与工单 02 的耦合：产物（rich groups）与消费点（core.js）之间**必须原子提交** ——
  真实数据驱动的 i18n 测试（`posterText` 空值）在只落一侧时必红。
