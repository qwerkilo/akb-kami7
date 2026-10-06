# 工单 01：报告层合一（纯重构）

- **Status**: resolved
- **Blocked by**: 无

## 背景

「未解析到」由 loader 打印、「取不下来」由管线打印，两段各自成形（工单 09/10 的产物）。
Q2/Q6：结果表由管线拥有、只打一份报告。

## 决定

- `resolve_former_photos` 不再自己打印汇总（去掉 `_report_photo_reasons` 与逐人
  `warn("…解析不到…")` 行）—— 把原因**交出来**（返回或注入 sink）。
- `main` 合并「解析阶段原因」+「下载/压缩失败」，打**一份**报告：
  `没有照片 N 人（原因）：` + 逐人 `姓名：原因`。
- 报告按成员（`file`）索引；`failures` 仍是 `id` 键（download/compress 不认识成员），
  合并处映射一次。
- **等价性**：产物 `members.js` 逐字节不变；报告覆盖的**成员集合与每人原因不变**
  （格式可变，这是本工单的目的）。

## 判据（可证伪）

1. 真实跑：产物逐字节不变；报告一行一人、集合 == 缺图名单。
2. 注入夹具（一个解析失败 + 一个下载失败 + 一个压缩失败）→ 三人各一行、原因正确、
   不重复。
3. 解析阶段不再出现逐人 warn 行（grep 日志）。
4. 变异 ≥2 全杀（报告漏人 / 原因串错）。

## 注意

- `_report_photo_reasons` 的「未记录」兜底要保留语义（没原因的缺图者不能消失）。

## 实现记录（2026-10-06）

- `warn_missing_images(members, failures=None, notes=None)`：**一份报告** —— 缺图名单 +
  逐人原因；原因来自 `notes`（按 `file`，解析阶段）或 `failures`（按 `id`，下载/压缩），
  由 `_photo_reason()` 合并（notes 优先），缺两者记「未记录」。覆盖集合 == 缺图名单
  由**同一份 `missing`** 驱动（结构性）。
- `resolve_former_photos(..., notes=None)`（morning 与 love 两份实现都改）：不再打汇总，
  把原因写进调用方的 `notes`；**逐人 warn 行删除**（Q6-B）。
- `load(..., notes=None)`（morning / love）+ `default_loaders(skip_photo, use_cache, notes=None)`：
  同一份 `notes` 进两个 loader；`main` 建 `photo_notes = {}` 并传给 `warn_missing_images`。
- 删掉 `_report_photo_reasons`（死代码）。
- 测试：新增 `SinglePhotoReportTests`（合并/一人一行/未记录/notes 优先）+ 接线测试
  `test_notes_reach_the_morning_loader_and_the_report` + 加强既有
  `test_skip_photo_and_cache_reach_the_right_loaders`（notes 进两个 loader）；四处钉旧
  格式的测试按新契约更新（两段 → 一份）。
- 变异 **全杀**（去掉 notes 通道 / morning 的 notes 接线 / love 的 notes 接线 / 报告漏一人 /
  恢复链的失败→空降级 / love 的原因写死 / loader 写原因字面量 / 链返回字面量 —— 共 8 个，
  其中 2 个在两轴审查后补验）。
- 复杂度：`warn_missing_images` 12 → 拆 `_photo_reason`；love 的 `resolve_former_photos`
  11 → 拆 `_resolve_member_photo`。

**真实跑（三次尝试，全部被外部源故障挡住）**：

1. 等爱官网 500 → 门正确中止、未写入；
2. read timeout（493s）→ 同上；
3. read timeout（374s）→ 同上。

**根因已定位（外部）**：`≠ME` 的 `https://not-equal-me.jp/feature/profile_honda_miyuki`
一页在故障中 —— 直连与代理都测过：交替 **200（21–31s）** 与 **500**，有时直接超时；
管线对该页的 8 次重试每次都可能超 40s → 等爱段整体失败。**不是本批代码的问题**
（失败发生在官网详情抓取阶段，早于照片解析）。

因此「产物逐字节不变」这条当时**尚未用完整跑验证**。

**补跑成功（2026-10-06，≠ME 站恢复后）**：`pipe exit=0`；**`members.js` 逐字节相同** ✓；
报告是**一份**「没有照片 7 人（原因）：」+ 每人一行 —— 集合与缺图名单完全一致：

```
福田明日香：旧站预算内未扫完
石黒彩：旧站预算内未扫完
市井紗耶香：旧站预算内未扫完
村上愛：源里没有
有原栞菜：下载失败
梅田えりか：文件不是图（UnidentifiedImageError）
小数賀芙由香：源里没有
```

（前三人从「源里没有」订正为「旧站预算内未扫完」—— 原因更诚实：它们确实落在被
预算截断的扫描里；产物不受影响。）

## 两轴审查后的修复（2026-10-06）

- **中：`_commons_for` 把「查询失败」降级成「源里没有」**（pageimages 请求失败 + 搜索
  查询成功但空 —— 旧实现靠 errors 累积记「查询失败」，新实现被后一阶段覆盖）。
  修：任一阶段失败 → 「查询失败」；补组合测试
  （`test_query_failure_is_not_downgraded_by_a_later_empty_result` +
  `test_all_stages_empty_is_source_empty`）。
- **中：验收 3「原因只有一个产生点」没有守卫** → `photo_chain` 定义 `QUERY_FAILED` /
  `SOURCE_EMPTY` 常量（唯一定义点），loader 只读常量；缝③ 守卫两条（链不许写死、
  loader 不许写原因字面量），变异各一个被杀。
- 低：删 `_imageinfo` 的不可达 `return {}`；删死参数（morning `_resolve_commons` 的
  `warn`、love `resolve_former_photos` 的 `warn`）；守卫改剥 docstring（不只 `#` 注释）；
  love 的 `load` docstring 事实订正（它用自己的实现，不是复用 morning 的）；
  `data-pipeline.md` 的两句过期机制描述（429 被吞）更新；测试名/类文档订正
  （`test_report_covers_exactly_the_missing_list`、
  `test_malformed_payload_yields_query_failed`）；记录数字订正（21 处调用点、
  变异清单）。
