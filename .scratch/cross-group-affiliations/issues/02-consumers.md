# 工单 02：消费点改读统一字段（`core.js` 三处）+ E2E

- **Status**: resolved
- **Blocked by**: 01

## 实现

1. `core.js` 的 `crossGroupMembers`（名册补全）与搜索：`gs.includes(团)` → `gs.some(g => g.group === 团)`。
2. `core.js` 的 `sourceNote`：读 `m.groups`；文字列**非自家团**的团名；三个分支判据不变
   （现役且全现役 → 兼任；现役 → 移籍；否则 → 混在）。
3. **测试**（缝② `test/core.test.js`）：把 `extras` 夹具改 rich `groups`；补新用例：
   - 48G 转籍者出现在旧团名册（`crossGroupMembers` 补全）；
   - 按团搜索能搜到（既有用例改形状）；
   - 徽标文字**不含自家团**；早安转籍者出现「移籍」。
4. **E2E**：按实测更新受影响的名册计数断言；跑 `npm run e2e:all`。

## 判据

- 视图级抽查（真实产物）：柏木由紀 ∈ NMB48、生駒里奈 ∈ AKB48、長濱ねる ∈ 日向坂46；早安 6 人回归。
- 徽标：柏木由紀 仍是「兼任」、船木結 出现「移籍」，文字不含自家团。
- 变异：①`sourceNote` 文字不过滤自家团 ②搜索不认 `groups` —— 均被杀。
- `npm run check` exit=0；`npm run e2e:all` 5/5。

## 判据与结果

- `core.js` 三处改读 rich `groups`：名册补全 / 搜索（`gs.some(g => g.group === 团)`）、
  徽标（文字过滤自家团，三支判据不变）。
- 新用例：柏木由紀形状（48G 转籍者进旧团名册）；徽标文字不含自家团（`src_transferred:NMB48、SKE48`
  —— 自家 AKB48 被排除）。
- core 118 条全绿；i18n 的真实数据驱动测试（三语 × 全成员无空值/undefined）绿。
- E2E 全量：见 Comments。
- 记账：`m.group` 是 `flattenMembers` 从段回填的（产品成员本身不带）—— 徽标的自家团过滤依赖它。

## Comments

- 与工单 01 原子提交（见 01 的记账）。
