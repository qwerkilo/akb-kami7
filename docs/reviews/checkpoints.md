# Code Review 检查点

每次 code review 结束后，在这里追加一条记录；下次 review 从最后一条的「下次基点」开始，不重复审查已经通过的部分。

每条记录的字段：

- **日期**：`YYYY-MM-DD`
- **本次基点**：上次检查点记录的 HEAD（首次写仓库起始提交）
- **审查范围**：`git diff <基点>...HEAD`、`git log <基点>..HEAD --oneline`
- **结论**：Standards / Spec 两轴各发现了什么、是否已处理
- **遗留问题**：未解决项，注明对应 issue 文件（`.scratch/<feature>/issues/NN-*.md`）
- **下次基点**：本次 HEAD 的完整 SHA（`git rev-parse HEAD`）

<!-- 示例（正式记录追加在注释外、文件末尾，不要删掉本段）：

## 2026-09-26 · 示例

- 基点：d21bbfe Add pre-commit hooks (husky + lint-staged + prettier)
- 范围：`git diff d21bbfe...HEAD`，共 3 个提交
- 结论：Standards 2 项（已修复 2）；Spec 1 项（已转为 issue）
- 遗留：`.scratch/foo/issues/03-bar.md`
- 下次基点：<本次 HEAD 的完整 SHA>

-->

## 2026-09-26 · 48 Group 扩展（首轮）

- 基点：`8c3361b` 添加 AGENTS.md 与协作文档（agent skills、code review 检查点）
- 范围：`git diff 8c3361b...2587f33`，共 9 个提交（bc3340f..2587f33：测试基建、core.js 抽取、7 团数据管线、团体筛选、搜索/文案、占位/标注、E2E、CodeGraph 接入、文档）
- 结论：
  - **Standards**：2 项实缺——① SDN48 4 行姓名/昵称残留 `data-sort-value="…" |`（チェン・チュー、KONAN、シヨン、miray，`clean_name` 与昵称启发式未处理排序键），且产物测试无字段纯净断言；② 跨团合并 `note` 硬编码中文，英文界面直出中文。其余为判断项（重复代码、`isTransfer` 魔字符串、`state.group === "all"` 散落、团体清单三处等）。
  - **Spec**：主体一致（7 团 1136 人、两条流程 E2E 26/26、测试全绿）；3 项偏差——① 用户故事 14 的「托盘显示团体与期生」只做了结果列表；② 用户故事 25 的「缺加入期行给出提示」为静默跳过；③ 移籍类成员结果 meta 缺毕业年份。
- 遗留：`.scratch/48group-expansion/issues/08-review-fixes.md`（2026-09-26 已全部修复：`017dd2e` 脏数据、`af34e18` 结构化来源、`3a8b03d` 毕业年份/托盘、`2e8c04f` 缺行提示；两轴问题均已闭环）
- 下次基点：`2587f333558ca275d7634da2fbc40355f4afe6ac`

## 2026-09-27 · 48 Group 扩展（二轮）

- 基点：`2587f33` 补齐结果/托盘/文案/文档（首轮范围末端）
- 范围：`git diff 2587f33...bbdbb7f`，共 13 个提交（首轮修复 4 + 检查点记录 1 + 质检基线/重构/测试/复检 4 + 二轮修复 1 + 测试守卫 1 + 文档）
- 结论：
  - **Standards**：1 项实缺——ticket 08 状态未收口仍为 `ready-for-agent`（01–07 均 resolved）；5 项判断项——extras 丢失同团去重（重构回归）、托盘文案硬编码全角括号且重复拼接、移籍成员卡片 meta 缺毕业年份（与结果页不一致）、`except Exception` 过宽（保留）、`section_key` 副作用命名（保留）。
  - **Spec**：4 项偏差——基线测试数 37 与实测 38 不符、工单状态未收口、上次检查点曾就地改写旧记录（本轮起改为追加）、产物纯度护栏未覆盖单字符 `{`/`}`（已加宽并做注入红证明）；核心声称（12 图刷新、覆盖率 97%、CRAP 0、变异 90.84%、E2E 28/28）核实通过，事故披露自洽。
  - 修复提交：`e35468a`（extras 去重 + 单测、托盘 i18n、卡片 yearLeave、纯度正则、工单收口、基线勘误）、`bbdbb7f`（集成测试真实目录不变量守卫，含原事故模式红证明）。
- 遗留：`.scratch/48group-expansion/issues/09-review2-fixes.md`（已 resolve）；判断项 MID：Stryker 工具未入仓（口径已记入 qa-baseline）、`except Exception` 保留。
- 下次基点：`bbdbb7fb038dcd9f8d93d6ce9e38180b7c50a31a`

## 2026-09-27 · v2 扩展（工单 01–08，第三轮）

- 基点：`bbdbb7fb038dcd9f8d93d6ce9e38180b7c50a31a`（二轮范围末端）
- 范围：`git diff bbdbb7f...546cbc4`，约 20 个提交（v2 工单 01–08：管线显式目录、坂道数据/折叠表、字幕 module + 海报 seam、折叠搜索/持久化/32 档、贴纸 UI 三相位重做、系列品牌与命名统一、审查修复）
- 结论：
  - **Standards**：2 项实缺——① `app.js` 本批新增却全文件未用的死代码（`SIZES` 与 4 个字幕薄封装）；② 系列切换按钮与 `aria-label` 硬编码中文未接 i18n（en 模式直出中文）。判断项：`poster.js` 调色板与 CSS 变量重复（保留）、`TRANSFER_GENERATION` 魔字符串（保留）、`placeRow` 缺员时列位错移（已修）、汉字数求和解析（已修并补 十一/二十一 测试）、`poster.test` 对 32 的恒真断言与假 `t` 单参（已加固）。
  - **Spec**：2 项实缺·高——① 坂道期生展开取全局索引导致空列表（`toggleGroup` 用 `GROUPS[gi]` 而 `gi` 为系列相对索引），已改 `data-sec` 键 + `SEC_INDEX` 映射并补 E2E「坂道期生展开有卡片 36」；② 对决跨系列串写（切系列未清 `duel`，`saveState` 把旧系列 order/answers 写入新 key，已完成结果会直出），已改为切换即清内存对决、`loadState` 校验 order id 归属、`backToPick` 明确放弃进度、`answer` 捕获系列防 160ms 竞态，并补 E2E「48G 对决不泄漏到坂道」。实缺·中：工单 08 未收口（本轮完成）。判断项：spec 折叠表计数 6→8 键一对多（已勘误）。
  - 命名决策（用户）：坂道 7 人档定名「7福神」（原 BEST 7）、32 档两系列统一「圈内」；ADR-0004 / CONTEXT / i18n / 海报文件名 / E2E 全量同步。
  - 验证：`npm test` JS 43 + Python 47、E2E 42/42（含 32 档 129 题、刷新续玩、坂道流程与海报、跨系列隔离）、`--no-dl` 幂等、截图核对 pick/32 结果/坂道结果。
- 遗留：判断项 MID——`poster.js` 调色板与 `style.css` 变量重复需人工同步；E2E 脚本在 /tmp 不入仓（Out of Scope）；Stryker 未入仓（口径见 qa-baseline）。
- 下次基点：`546cbc4`（本批实现提交；文档收口为其后一笔）

## 2026-09-27 · 会话状态模块（第四轮：架构深化 ①）

- 基点：`b51ad23`（v2 文档收口）
- 范围：`git diff b51ad23...53ab130`，5 个提交（CONTEXT 术语 + ADR-0008、spec、工单 01–02、session.js + 13 例、app.js 接线、审查实缺补齐）
- 结论：
  - **Standards**：1 项实缺——「重建恢复」用例名含「进行中」但实测已完结流程，*进行中*恢复与 `undo` 正路径无覆盖（已补 step 2 / canUndo / pair / undo 回退断言，13 例全绿）；判断项——`snap/series/pick` 三镜像靠 `sync()` 纪律（接线中已出一次 `setSize` 后品牌过期的事故并同批修复，镜像模式接受并记录）；nits——测试未用解构已清、setter 返回值直通保留。
  - **Spec**：逐条通过——接口与 snapshot 形状、恢复语义（未知/跨系列 id 拒绝、完成直达结果）、Out of Scope 遵守（`style.css`/`i18n.js`/`core.js`/`poster.js` 零改动）；`npm test` JS 56 + Python 47、E2E 实跑 42/42、`node --check` 通过；欠账（工单 02 收口与检查点）本轮完成。
- 遗留：判断项 LOW——`snap` 镜像需保持「先 `sync()` 再读」纪律；无效对决载荷丢弃不回写（与旧行为等价，可接受）。
- 下次基点：`53ab130fb72bc076ed1c4365c9fff9ea81603527`（本批实现与测试提交；文档收口为其后一笔）

## 2026-09-27 · 架构深化 ②–⑤（第五轮）

- 基点：`0b4c746`（会话模块收口）
- 范围：`git diff 0b4c746...44e5294`，5 个提交（④ 命名模块、③ 设计 token、⑤ 渲染入口弱化版、Standards 修复；② 经删除测试归档为「已被 ① 覆盖」）
- 结论：
  - **Standards**：1 项实缺——`#size-7` 按钮文案改接 `names(series, pick)` 后，16/32 档下显示当前档位品牌（boot 恢复 16/32 时直接可见），已改为恒取 `names(series, 7, t).brand` 并加 E2E 回归（现 43 项）；判断项——`names` 冗余字段 `seriesTag`（已删）、poster 注入用例负例不全与部分合并无覆盖（已补）、系列按钮整算 `names()` 仅取 `seriesLabel`（LOW，保留）。
  - **Spec**：逐条通过——④ 字段与文件名规则同旧行为、app 无残留组合；③ CSS 为唯一来源、tape↔`--lemon` 映射、注入/部分合并/缺省回退均有断言，像素对照（7 人版）与默认值完全一致；⑤ 8 对配对调用一一对应、滚动与 `show()` 次序不变、`toggleMember` 仍单步；`npm test` JS 59 + Python 47、E2E 43/43、海报探针 0 undefined。
  - 架构扫描 5 张候选卡闭环：① 会话状态仓（第四轮）、② 归档、③④⑤ 本轮。
- 遗留：LOW——系列按钮每枚整算 `names()`（4 次/渲染，可忽略）；16/32 海报像素对照未做（与 7 人同代码路径）；回顶行为无自动化断言。
- 下次基点：`44e52940fda9da7beb822d45df886de5b3a47bbf`（含审查修复；文档收口为其后一笔）

## 2026-09-27 · v3 批次（清空 / 金字塔 / 简介 / 等爱系列，第六轮）

- 基点：`44e5294`（架构深化收口）
- 范围：`git diff 0c25a96...1a0241c`，13 个提交（领域模型 + ADR-0009/0010、spec/工单、01 清空、02 金字塔、03 简介、04 等爱管线、05 等爱接入、审查修复；原型留档于 `prototype/ui-v3-pyramid` d6da539 与 `prototype/ui-v3-profile` 764d029）
- 结论：
  - **Standards**：3 项实缺——① `parse_wiki_members` 的 kana 正则强制链接，无链接姓名行（福山萌叶）假名为空（已改为名字格下一格取值并加断言）；② `main` 吞掉等爱抓取异常后仍 prune/写产物，一次网络抖动会删 37 人图（已改为快速中止不写入）；③ `test_love_members.py` 的 `unittest.main()` 位于中段致直跑漏 8 例（已移末尾，直跑 19 例）。判断项已取舍：`assign_ids` 改用 `m.get("join")`、`report_generation` 传全量成员、删除冗余 `parse_list_loose`（`archived_photo_pairs` 已覆盖实测全部形态）、`.info` 补 Enter/Space 键盘入口、项目等爱死分支与变量遮蔽清理。
  - **Spec**：4 项偏差——① 结果列表 ⓘ 绝对定位但 `li` 未定位，7 枚叠在页面右上（已加 `position: relative`）；② ADR-0010 的「<118px 省略」与实现「前 4 行有名」不一致（ADR 已按实现改写）；③ 毕业照片实际 4/4 经 Web Archive（含曲径：列表快照 → 图片快照），Commons 仅作兜底未用（与 ADR 回退链一致，记录即可）；④ 等爱失败路径、EN 海报截图等如实列为已验证/未验证。其余逐条通过：13 字段顺序、47 县/12 星座/20 条译文、37 人 37 图、推し 7/Oshi 7、`love_{size}` 文件名、`#イコノイジョイ`、来源措辞与页脚。
  - 验证：`npm test` JS 69 + Python 71、E2E 实跑 55/55、覆盖 `fetch_members.py` 96% / `love_members.py` 87% / `core.js` 行 99.78%、`--no-dl` 幂等。
- 遗留：LOW——`members-artifact.test.js` bio 覆盖阈值偏松（-2/-60，实际 -1/-46）；原型像素级对照未做；`.info` 在卡片按钮内的嵌套语义仍非标准（已补键盘路径，记为可接受）。
- 下次基点：`1a0241c90584ec687073c9e1ebb3cb69be471ff5`（审查修复提交；文档收口为其后一笔）

## 2026-09-27 · 质检修复（第七轮后续）

- 基点：`5e5d2ff`（第七轮质检）
- 范围：`e99ef00`（11 项断言补齐）→ `4a58ad6`（P2 poster 重构）→ `b490870`（P3 注入测试），共 3 个提交
- 结论：质检建议按优先级全部落地——P2 结构性热点（`slot` CCN 30）拆分并经 3301 条绘制调用快照证明行为不变、48 行克隆消除；P3 两处低覆盖（`love_members.load` 编排、`wiki.get` 重试）补齐注入式测试，覆盖率 96%/89%；`scan-secrets.py` 草稿移出仓库。验证：`npm test` JS 80 + Python 77、E2E 55/55、`--no-dl` 幂等。
- 遗留：LOW——`members-artifact.test.js` bio 阈值偏松；poster.js 变异幸存仍以假 ctx 无法覆盖的几何/样式为主（视觉 + E2E 兜底，接受）。
- 下次基点：`b490870153ca18a438c6fb7ea1bca6a64d147851`（含全部质检修复；文档收口为其后一笔）
