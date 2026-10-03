# 深化㉔：每团形状的单一扩展点（GROUPS 收成一处）

- **来源**：架构扫描（2026-10-03，报告 `/tmp/opencode/architecture-review-20261003-130435.html`）
  候选①，grill 四问全采纳（2026-10-03）
- **范围**：`scripts/morningmusume_members.py` + 两处测试清单

## 事实（实测）

- 「加一个团」今天要动 **5~7 处**：`GROUPS`（段配置）、`OFFICIAL_GROUPS`/`OFFICIAL_PATHS`
  （若现役）、`GROUP_END_RANK`（若已停止）、解析测试 `CASES`、产物测试三张表
  （`GROUP_ORDER`/`GROUP_COUNTS`/`SERIES_OF`）。
- **代码里没有团名分支** —— 七个 helper（colspan、合并列、脏列名、假名四写法…）全是
  **形状判据**。摩擦不是「形状知识散落」，而是**元数据三表各写一遍**。
- `WIKI_PAGE`（`:26`，モーニング娘。时代遗留）零引用。

## 决定（grill 2026-10-03）

1. **扩展点粒度 A**：三个元数据表合成 `GROUPS[团] = {page, current, former, official?, end_rank?}`；
   `OFFICIAL_GROUPS` / `OFFICIAL_PATHS` / `GROUP_END_RANK` 改成**从中派生**（手写表删除）。
   列名归一与形状判据**不进配置** —— 它们是形状知识、被所有团共享，按团复制会更难维护。
2. **测试清单 B**：缝③ 的清单是**规格**、不从生产派生；但 artifact 测试的三张表合成
   一张 `MANIFEST = [{group, count, series}]`（加团改一处）。`test_fetch_members.py`
   那份保留（另一个缝）。
3. **`_split_vitals` 触发条件改成形状匹配**（含「血液型」且含「身長」或「出身地」）：
   将来出现 `血液型/身長` 这种少一项的合并列时不静默丢字段。
4. **删死常量 `WIKI_PAGE`**。

## 等价性凭据

纯重构：产物 `members.js` 逐字节不变（`git diff` 空）；`npm test` 前后同数；
新增「派生列表与配置一致」守卫。

## 实现记录

- **Q1**：`GROUPS[团]` 收进 `official` / `end_rank`；`OFFICIAL_GROUPS` / `OFFICIAL_PATHS` /
  `GROUP_END_RANK` 改成从中派生（手写表删除）✓ 加团现在只改 `GROUPS` + 测试 `MANIFEST` 两处。
- **Q2**：artifact 测试三张表合成一张 `MANIFEST`（三张派生视图保持既有消费点不变）✓
- **Q3**：合并列触发改形状匹配（含「血液型」且含「身長」或「出身地」）+ 新增
  「少一项的合并列」测试 ✓
- **Q4**：`WIKI_PAGE` 删除 ✓

**等价性**：`git diff members.js` **空**（纯重构，产物逐字节不变）✓
**验证**：`npm run check` 退出码 0 ✓ **273 JS + 215 Python**（+2）✓
变异 **4/4 被杀**（派生条件放宽 / 删一个 end_rank / 形状退回精确列名 / 官网路径写错）✓
复杂度棘轮未推高 ✓
