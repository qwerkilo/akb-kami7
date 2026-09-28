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

## 2026-09-27 · 皮肤系统批次（第七轮）

- 基点：`d8a003c`（文档修剪收口）
- 范围：`git diff d8a003c...HEAD`，6 个提交（CONTEXT/ADR-0011/spec/5 工单、01 session.skin、02 CSS 两套令牌、03 页头切换器、04 海报跟随、审查修复）
- 结论：
  - **Standards**：1 项实缺——令牌化脚本把 `--border` 的定义行也替换成 `var(--border)` 形成自引用，**贴纸皮肤全部 `var(--border)` 边框失效**（roster/card/seg/slot/按钮），而 E2E 只探海报 canvas 漏过（已修为 `2px solid var(--ink)`，并新增 E2E 容器边框断言：classic `1px solid` / sticker `2px solid`）；判断项——预 JS 无 `data-skin` 首屏闪烁（已加 head 内联预置）、classic 与上游差异（裸卡无边框/选中粉描边/`現役` 粉字/粉色品牌下划线带/空槽黄叉/主按钮无边框 999px 圆角/`rank-list` 半径令牌化）均已对齐。
  - **Spec**：逐条通过——默认 classic、页头切换器（原型 A）、持久化、键盘、海报跟随（像素扫描：classic 底 `#edeff3` + `#f4c20d` 带 + 粉，sticker 反之）、资料卡/界面跟随、zh/en 标签；Out of Scope 遵守（无第三款/无自定义配色）。
  - 验证：`npm test` JS 83 + Python 77、E2E **62/62**、海报调用序列快照 3301 条 diff 为空（贴纸绘制不变）。
- 遗留：LOW——classic 下 16/32 海报与资料卡/对决页未逐屏截图对照；`.gen-head` 展开底色为自定义灰（上游无此控件）。
- 下次基点：`ceb0a99`（审查修复提交；文档收口为其后一笔）

## 2026-09-28 · 向导模式批次（第八轮）

- 基点：`ceb0a99`（皮肤批次审查修复；皮肤文档收口 `dd59648` 一并纳入本次范围）
- 范围：`git diff ceb0a99..850f36b`，6 个提交（皮肤收口文档、v5 定案+工单、实现、收口、审查修复、文档追认）；原型分支 `prototype/ui-v5-interaction` @ `3e21b26`（四方案，不入 main）
- 结论：
  - **Standards**：1 项实缺——对决说明浮层打开时 ←/→ 仍在遮罩后作答、Z 撤回、Esc 无效、无焦点管理 → 修为：浮层打开时禁用对决快捷键、Esc 关闭、打开聚焦「开始」/关闭回焦选手卡、浮层 z-index 220（高于 toast）；5 项判断项——`#0e9f6e` 硬编码（新增 `--ok` 两皮肤令牌）、`.primary.emphasis` 覆盖贴纸按钮阴影（改 `outline`）、答题 160ms 回调缺视图守卫（末题后 160ms 内点 ① 会被弹回结果页；加 `view !== "duel"` 守卫）、50% 里程碑只在 `beginDuel` 重置（刷新进入 ≥50% 对决反复弹；改为 `answer()` 跨越判定 + `renderDuel` 仅标记）、E2E 证据缺口（已补 9 项断言）；吹毛求疵已处置：删死键 `start`、步骤条 44px、`aria-current="step"`、`.profile` 层级 30→150（此前被步骤条压住）、`i18n.test.js` 正则漏检 `-aria-label` 修复；保留（已记录）：`beginDuel` 布尔返回值暂无消费方、`.di-card` 半径沿用弹层先例。
  - **Spec**：10/10 user story 落地；5 工单实现齐全；ADR 的「① 保留对决 / 改选清空 / 仅两处显式丢弃」语义严格吻合；2 处偏差——① result 态 ② 额外禁用：**追认**并写入 ADR-0012 与工单 01（重开入口由「这几位重新排序」承担）；② 50% 里程碑刷新重弹（实缺·轻，已修，与 Standards 同源）。3 处工单勾选项的 E2E 证据缺口（刷新后 coach 隐藏、改选清掉对决、③ 结果态导航）已补齐。
  - 验证：`npm test` JS 83 + Python 77；E2E 回归 **62/62**、v5 脚本 **40/40**（含结果态导航、改选清空、刷新持久化）；无 JS 报错。
- 遗留：LOW——说明浮层未做完整 focus trap（Esc + 初始焦点已够用）；卡片「i」26px 触控目标（spec Out of Scope/遗留）；toast 与浮层同屏时 toast 压在浮层下（有意）。
- 下次基点：`850f36b`

## 2026-09-28 · 架构深化批次（第九轮）

- 基点：`65a34fb`（第八轮检查点）
- 范围：`git diff 65a34fb..0fa5c4e`，10 个提交（①–⑥ 六项深化 + 记录/格式化/审查修复）；设计记录：ADR-0013、`.scratch/nav-phase/`、`.scratch/deepening/06–10`
- 结论：
  - **Standards**：1 项实缺——`nav("pick")` 判的是相位（`phase === "result"`）而 spec 与旧实现判视图：系列 A 对决页切到「有已完成对决」的系列 B 后 view 落回 pick、phase 仍 result，此时点 ① 会静默丢弃 B 的完整名次（旧代码不丢弃）→ 改为 `view === "result"` 并补分歧格单测；判断项——`roster.project` 统一 `.get()` 后缺基础字段静默 None（产物测试只兜 id/name/status/img）→ 补 `kana/nick/end` 类型断言；i18n 死键白名单按前缀放行（边界已注明）；`undo` 不过 `answering`（既有行为，记录）；吹毛求疵——`duel50` 命名、切皮肤会重建挑人 DOM（滚动复位无断言）、aria-label 双写——均记录不修。
  - **Spec**：① 九条 user story 全部兑现、两张工单 acceptance 逐条对账（01/02 同落 `a223fa4`，工单已注明粒度合并）；②–⑥ 记录属实（⑤ 16 人 1920 有单测 + 实拍截图；⑥ 字节不变有 git 佐证、真实 1375 人/114 段/1375 图）；口径修正三处——「13 处 view」→「11 处（+1 声明）」、note 06「4 处 aria-label」→「6 处」、② 的资料卡门控更正为「防御项、当前不可达、无 E2E」。
  - 验证：`npm test` JS **98** + Python **82**；E2E v5 **44/44**、回归 **62/62**；六项 deepen 的验证声明与实测一致。
- 遗留：LOW——切皮肤重建挑人 DOM 的滚动位置无 E2E；i18n 白名单前缀边界（`bio_*` 内新增死键抓不到）；`undo` × `answering` 交错为既有行为。另：③ 的接线物理落在 ⑤ 的提交 `b17d82a`（已在 `61b8723` 补记，提交归属不独立）。
- 下次基点：`0fa5c4e`

## 2026-09-28 · 第八轮质检与 P1 修复（第十轮）

- 基点：`0fa5c4e`（第九轮检查点）
- 范围：`git diff 0fa5c4e..dbde119`，3 个提交（等爱失败分支修复、第八轮质检报告、P1 修复）；取证产物在 `/tmp/opencode/qa8/`
- 结论：
  - 第八轮全量数字入 `docs/reviews/qa-baseline.md`：覆盖率 JS 行 99.76%（core 99.64 / session 98.99 / poster 99.29 / i18n 99.70）、Python scripts 97%（roster 100）；测试 JS 98 + Python 83；变异整体 77.33%（core 90.93 / session 80.21 / poster 40.64，无覆盖 0）；重复率行 1.11% / 克隆 9；audit 0 漏洞、TODO 0。
  - **P1 已修**：nav/steps 抽 `navState()`（消 8 行生产克隆）+ 规则函数表——`nav` CCN 32→3、`steps` 10→5；补边界断言后 core 变异 90.93→**93.26%**（nav 段幸存 28→4，全部论证为等价）。
  - **口径勘误**：第 7 轮「fetch_members 全部 ≤6」在文件级近似下不成立（4 个 CCN 9 自基线即存在）；本轮起以「CCN > 10 或 CRAP > 10 才列修」为口径。
  - 另修：等爱抓取失败分支补测试（SystemExit 且不覆盖旧产物），错误文案不再建议会丢数据的 `love_loader=None`（`0fa2d2d`）。
  - 验证：`npm test` JS 99 + Python 83；E2E v5 44/44、回归 62/62。
- 遗留：LOW——poster.js 222 幸存属假 ctx 观测极限（接受）；i18n.js 函数覆盖率低（键多为数据非代码）；`app.js` 仍仅 E2E 黑盒。
- 下次基点：`dbde119`

## 2026-09-28 · 体验收尾与 replay 修复（第十一轮）

- 基点：`db56540`（第十轮检查点）
- 范围：`git diff db56540..f7b7e16`，3 个提交（`73bb036` 卡片「i」命中盒 + 切皮肤定向重绘、`663c687` replay 恢复崩溃修复、`f7b7e16` 审查修复）；两轴子代理审查
- 结论：
  - **实缺（已修）**：`73bb036` 的 i 命中盒做成 44px 后视觉圆内移 10px，与提交信息「视觉不变」不符且无断言兜住 → `f7b7e16` 把盒锚回卡角（`top/right: -4px`，圆回 6..30px）并补 E2E 几何断言（dx=4 / dy=4）。
  - **Standards 通过项**：replay 修复路径隔离干净（3000 组随机性质检查零分歧；合法前缀逐次等价）、`done ⇒ order` 恒为数组、session 侧无其他越界路径；i 命中盒在两套皮肤下圆径不变（`inset:10` 双约束）、`z-index:-1` 堆叠安全、键盘/委托行为不变；`switchSkin` 定向重绘（`paintSkin` + 按需 `drawPoster`）覆盖完整。
  - **Spec**：通过——1 判断项（提交信息措辞不实，已由 `f7b7e16` 真正落实 + 几何断言）；`663c687` 为根因修复（旧代码在 generator 完成后仍 `next`，得 `{done:true, value:undefined}`），全入口安全；`session.snapshot` **不加**防御（判断项：契约现在是全域函数，重复校验会掩盖破约且可能把崩溃换成静默错名次）；无越界。
  - 附带闭环：checkpoint 第七轮遗留「classic 下 16/32 海报与资料卡/对决页未逐屏对照」已用 classic 实拍核对（挑人/资料卡/对决/32 金字塔海报，均正确）。
  - 验证：`npm test` JS **101** + Python **83**；E2E 回归 **68/68**（+1 几何断言）、v5 44/44。
- 遗留：LOW——duel 相位切皮肤无 E2E（CSS 驱动，风险低）；测量类遗留同第十轮。
- 下次基点：`f7b7e16`

## 2026-09-28 · 罗马字检索（第十二轮）

- 基点：`f7b7e16`（第十一轮检查点）
- 范围：`git diff f7b7e16..164ad13`，4 个提交（`53b55e8` 为第十一轮检查点提交、`b7b5d6d` 功能、`33a79e6` 审查修复、`164ad13` 工单收口）；两轴子代理审查
- 结论：
  - **实缺（已修，两轴一致指认）**：促音初版只产 `tch` 系（matchi/matti），`macchi`/`acchan` 类常见拼法不中——41 个含「っち」的昵称受影响（`あっちゃん` 的通行拼法就是 `acchan`）→ 补 `cch` 变体、「长音折叠 × nn」组合、无罗马字时不留尾随空格；E2E 加 `acchan`（前田敦子，促音）与 `sasihara`（指原莉乃，Kunrei 异形）。
  - **通过项**：数据驱动完整性（104 个假名字符全有映射或有意丢弃；全量 1375 人罗马字非空、无 `undefined`；4 个无 kana 成员由名字转换）；haystack 契约（base 前缀不变、简体折叠共存、变体去重）；查询串不转换（`normalizeName` 去空格，故 `maeda atsuko` 可命中）；**不改产物与管线**（diff 未碰 `members.js`/`scripts/`）；Out of Scope 纪律（无拼音/缩写/模糊/权重/`ei` 折叠）。
  - 判断项/吹毛求疵已处置或记录：spec 的 `siniti` E2E 无真实靶子（全站 0 人）→ 改用 `sasihara`/`acchan` 并把偏差回写 spec；工单勾选失实已订正；补 `ふぁ/てぃ/ゔ` 与 `けいこ→keiko`（ei 不折叠）断言。
  - 验证：`npm test` JS **107** + Python **83**；E2E 回归 **74/74**（+6 罗马字断言）、v5 44/44。
- 遗留：LOW——`ー` 一律丢弃（`クリスティー` 搜 `kurisutii` 不中，spec 明示接受）；异形 `siniti` 型在本数据集无靶子（仅单测覆盖）；v5 仍 44（本轮把提示断言改宽而非新增站点）。
- 下次基点：`164ad13`

## 2026-09-28 · 深化⑪ 成员索引 + 遗留闭环（第十三轮）

- 基点：`649e3c2`（第十二轮检查点）
- 范围：`git diff 649e3c2..cb85e7f`，3 个提交（`25848fd` 深化、`1c30514` 首屏崩溃修复、`cb85e7f` 审查修复）；两轴子代理审查
- 结论：
  - **实缺（审查，已修）**：`.scratch/deepening/11-members-index.md` 停留在中间态——正文描述的是被修掉的崩溃版接线、未披露「`GROUPS` 被换成扁平列表 → 首屏崩溃（单测抓不到、E2E 当场抓到）与回滚」、也未记 E2E 滚动断言两次修正 → 已补「事故与修正」并改写正文；教训入文：碰 `app.js` 装配**先跑 E2E 再提交**。
  - **判断项已处置**：`indexMembers` 更名 **`flattenMembers`**（返回列表且原地注入，原名不副实）；core 测试补 `strictEqual(list[0], groups[0].members[0])` 钉住身份契约；E2E 补「对决中切皮肤不打断对决」+ 滚动断言改页面滚动（原 `#roster.scrollTop` 因 `scrollHeight === clientHeight` 恒 0、无判别力）、DOM click 规避 Playwright 自动滚回、容忍换肤布局位移（400→386）。
  - **通过项**：摊平知识现仅 `core.js` 一处（app 与 i18n 测试共用同一实现）；`GROUPS` 全部消费点仍是分段语义；`BY_ID` 1375 人无重复；无越界（5 文件）；测试落 core / i18n / E2E 三缝。
  - **评估并记录（Standards 建议）**：不给 `members-artifact.test.js` 加 `flattenMembers` 不变量——本次回归是 app 接线错误，产物与 core 未被改坏，产物侧断言在坏版与好版都绿；要抓必须执行 `app.js` + DOM，等于把 E2E 缝搬进单测。维持 E2E 兜底。
  - 验证：`npm test` JS **108** + Python **83**；E2E 回归 **75/75**、v5 44/44；首屏冒烟 16 卡 / 7 组。
- 遗留：LOW——对决切皮肤的断言只比对题号 + 相位，未比对 pair/order（「重置到同题号」理论可漏，有「无 JS 报错」兜底）；`flattenMembers` 对含 `null` 的分段会抛（与旧实现相同）。
- 下次基点：`3234d8d`（`cb85e7f` 为本轮代码收口，检查点文档为其后一笔）

## 2026-09-28 · 日语界面（第十四轮）

- 基点：`3234d8d`（第十三轮检查点；本轮范围亦含 `6553068` 文档一致性审计修复）
- 范围：`git diff 3234d8d..da651f1`，3 个提交（`6553068` 文档审计修复 14 文件、`6f7d755` 日语界面、`da651f1` 审查修复）；两轴子代理审查
- 结论：
  - **实缺（Standards，变异证明）**：ja 的核心行为「数据字段直出原文 / 日式日期」在 108 个 JS 测试里无一条能失败——删掉 `localized` 的 ja 短路与 `bioDate` 的 ja 分支后全绿 → 补 `genText` / `fullMeta` / `posterSub` / `profileRows` 的 ja 值断言。
  - **实缺（审查发现）**：96 人的期生标签是简体中文「选秀N期生」，ja/en 界面直出中文（en 侧此前即存在）→ `genText()` 对 ja 译「ドラフトN期生」、en 译「Draft Nth gen」（zh 保留原文），`fullMeta`/`posterSub`/资料卡徽章/托盘提示四条展示路径统一走它；真实界面（川本紗矢）核对「ドラフト1期生」。
  - 判断项/吹毛求疵已处置：ja 标点空格统一（兼任・移籍 / あと7人 / 3年卒業 / 中断して再開）；parity 的 `leave_` 豁免只给 en；浏览器语言回退移出 `try`（存储被禁时仍按浏览器语言）；spec 修正「44px」「按钮名词形」措辞并补迁移说明。
  - Spec：7 条 story 全部吻合（`names()` 与真实成员数据实测）；Out of Scope 零越界；数字对账（110/110 键、JS 110、Python 83、E2E 49/49 与 75/75）。`6553068` 文档审计修复经抽查属实（「11 处+1 声明」、`PYRAMID_NAMED_ROWS`、缩图不放大、ADR 口径、spec 状态约定）。
  - 验证：`npm test` JS **110** + Python **83**；E2E v5 **49/49**（+5：日语步骤条/副标题/html lang/空搜索/自动日语）、回归 **75/75**（两脚本加 `locale: zh-CN` 保持既有中文断言）；ja 界面实拍无 JS 报错。
- 遗留：LOW——无 `akb-lang` 存档的老用户默认语言从「恒 zh」改为随浏览器语言（spec 已记，属意图）；ja 排版微调（禁则/字体栈）与「推し7」书写差异按 Out of Scope 保留；语言选择刷新持久化无 E2E（既有口径）。
- 下次基点：`da651f1`

## 2026-09-28 · 海报四样式（第十五轮）

- 基点：`cd1c526`（第十四轮检查点）
- 范围：`git diff cd1c526..d657654`，2 个提交（四样式落地、审查修复）；两轴子代理审查；原型来源 `prototype/ui-v6-poster`（`4982832`）
- 结论：
  - **实缺 1（两轴独立指认）**：`.seg-style` 无 CSS——classic 皮肤下选中 chip 白字白底不可见、且缺 44px；已补（选中 mint 底色 + 加入 classic 反色组 + 44px），实拍核对。
  - **实缺 2（Standards）**：C 在 16 档高版（H=1920）领奖台横向重叠（1 号与 3 号重叠 151px）且冠军不居中——横向几何改为按可用宽度预算 `kx`（与画布高度解耦），新增「前三互不重叠且整体居中」单测（7/16/32）；实拍核对。
  - **实缺 3（Spec）**：C/D 未消费 `cardStroke`（C 不描边、D 贴纸标题硬编码 3px；classic 皮肤下违反「卡片不描边」语义）——补令牌消费 + 令牌响应单测（注入 ink/cardStroke 断言 4 样式）。
  - 判断项/吹毛求疵已处置：B/C/D 名字名次用例扩到 16 档；清理未用的 `ctx.toWorld` 与 D 的不可达分支；C 标题去掉虚留宽；`AGENTS.md` 的「金字塔布局」口径更新；工单 v5 计数 44→49 订正；按 SOP 补 CONTEXT 术语「海报样式」+ ADR-0014。
  - **通过项**：`drawClassic` 抽取与 `cd1c526` 基线的调用序列**逐字节一致**（Standards 离线对拍）；假 ctx 仿射矩阵经手算样例验证（translate(10,20)+rotate(90°)+translate(5,0) → toWorld(0,0)=(10,25)）；E2E 站点数对账属实（80/80、+5）且变异判别力已实证（B 固定 8 列 → `b/32 越界 (72,1503)`）。
  - 验证：`npm test` JS **115** + Python **83**；E2E 回归 **80/80**（+5 样式断言）、v5 **49/49**；32 档四样式与 16 档 C 实拍无 JS 报错。
- 遗留：LOW——样式×皮肤无逐像素矩阵单测（令牌响应 + E2E 像素探针兜底）；`.seg-style` 未接方向键导航（与其余 seg 一致）；占位色 `#e4e7ee` 三处硬编码（既有先例）。
- 下次基点：`d657654`
