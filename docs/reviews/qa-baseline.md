# 质检基线：2026-09-26

基线提交：`346ae89`。工具与口径见各节；本文件供下次质检对比。

## 模块裁剪结论

| 模块       | 结论         | 工具                                            | 理由                                                     |
| ---------- | ------------ | ----------------------------------------------- | -------------------------------------------------------- |
| CRAP（≤6） | 做           | lizard + node 覆盖率 + coverage.py              | 纯逻辑达标；超标集中在 IO/编排层                         |
| 单元测试   | 做（补缺）   | node:test + unittest                            | 全绿；按变异幸存点补 4 条断言                            |
| Gherkin    | 不做         | —                                               | 单人静态站；28 项脚本化 E2E 已覆盖业务流，BDD 无协作收益 |
| QA 流程    | 部分做       | —                                               | 单人无 CI：报告内 checklist，不落流程文档                |
| 质量指标   | 做           | jscpd / npm audit / rg                          | 一次性基线（见下）                                       |
| 变异测试   | 做（限预算） | StrykerJS 8.7.1（command runner）               | core.js 76.34%，幸存点已分类处理                         |
| 覆盖率     | 做           | node --experimental-test-coverage / coverage.py | 数字见下                                                 |
| 密钥扫描   | 跳过         | —                                               | 用户指定跳过                                             |
| 越权/注入  | 不做         | —                                               | 无服务端/鉴权/SQL/命令执行面；无用户输入处理             |

## 覆盖率

- `core.js`：行 99.19% / 分支 95.35% / 函数 93.75%（唯一缺口为 UMD 全局导出分支）。
- `i18n.js`：行 99.24% / 函数 7.14%（文案表箭头函数按需调用，行覆盖即真实使用）。
- `scripts/fetch_members.py`：52%（未覆盖集中在网络下载、Pillow 压缩、`main` 编排）。
- `scripts/wiki.py`：50%（重试/异常路径）。

## 复杂度与 CRAP

CCN ≥ 10：

| 位置                 | CCN | 函数         |
| -------------------- | --- | ------------ |
| app.js:618           | 19  | `slot`       |
| app.js:704           | 11  | `drawPoster` |
| fetch_members.py:80  | 25  | `parse_rows` |
| fetch_members.py:245 | 44  | `main`       |

CRAP > 6（仅 fetch_members.py；core.js 最大仅 mergeSort 5.0）：

| 函数                         | CCN | 覆盖  | CRAP |
| ---------------------------- | --- | ----- | ---- |
| `main`                       | 44  | 1.4%  | 1897 |
| `compress`                   | 6   | 7.1%  | 34.8 |
| `image_urls`                 | 6   | 7.7%  | 34.3 |
| `parse_rows`                 | 25  | 95.1% | 25.1 |
| `load_rows`                  | 4   | 14.3% | 14.1 |
| `group_of` / `merge_members` | 7   | ≥92%  | 7.0  |

`app.js` 仅 E2E 覆盖（CRAP 按 0 单元覆盖上界：`slot` 380、`drawPoster` 132，不适用该目标）。

## 变异测试（core.js，StrykerJS）

- 得分：100/131 = **76.34%**（killed 98 + timeout 2）。
- 幸存 31 分类：UMD 导出分支 6（测试环境不适用）、等价突变 4+（空白归一/join 分隔符，无法区分）、`VARIANTS` 值 4、占位图边界 2、转义表 5、`shuffle` 内部 4、其余低影响。
- 已补断言并验证红色能力（`346ae89`）：七组汉字变体、占位图 XML 转义与空名回退、`shuffle` 确实重排。

## 质量指标

- TODO/FIXME/HACK/XXX：**0**。
- 重复率：**0.59%**（仅 2 处克隆：app.js 海报排行布局 ~19 行 gap 差异、style.css 徽章 ~10 行）。
- 依赖：devDeps 3（husky/lint-staged/prettier），无生产依赖；`npm audit` 0 漏洞（npmmirror 无审计接口，用官方源复查）。
- 规模：代码合计 13275 行（其中生成文件 members.js 11210 行）；仓库 257M（`scripts/_orig` 104M / `.git` 71M / img 69M）。

## 发现与建议（按优先级）

1. （中）`fetch_members.py` 的 `main`/`compress`/`image_urls`/`load_rows` 覆盖率低、CRAP 高：均为 IO/编排层，行为由产物不变量 + `--no-dl` 幂等 + 实测生成覆盖；不建议为指标硬拆，下次改该文件时顺带拆小。
2. （低）`parse_rows` CRAP 25.1：可接受，后续改动注意补 fixture。
3. （低）`app.js` `slot`/`drawPoster` 仅 E2E 覆盖：canvas 绘制代码，维持现状。
4. （低）两处代码克隆与两处等价突变：不处理。

## QA checklist（本机）

- 每次提交前：`npm test` + `npm run graph:sync` + `PATH=/root/.local/bin:$PATH node node_modules/lint-staged/bin/lint-staged.js`。
- 数据重跑后：产物不变量测试 + `--no-dl` 幂等核对。
- UI 改动后：E2E 冒烟（`/tmp/opencode/e2e.cjs`，28 项；Playwright 在 npx 缓存）。
- 每次 code review 后：追加 `docs/reviews/checkpoints.md`。

## 复检：2026-09-26（同日晚）

按本报告逐项修复后的复检结果（提交 `1142d6a`、`4025aca`）：

| 指标                      | 基线                                                                                                                         | 复检                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `fetch_members.py` 覆盖率 | 52%                                                                                                                          | **97%**（缺口仅网络/异常/打印分支）             |
| CRAP > 6 的函数           | 7 个（`main` 1897、`compress` 34.8、`image_urls` 34.3、`parse_rows` 25.1、`load_rows` 14.1、`group_of`/`merge_members` 7.0） | **0 个**（全部 ≤ 6.0）                          |
| core.js 变异得分          | 76.34%（幸存 31）                                                                                                            | **90.84%（119/131，幸存 12，全部等价/环境类）** |
| 测试数                    | JS 24 / Python 21                                                                                                            | JS 28 / Python 39（勘误见下）                   |
| 重复率 / TODO / 依赖漏洞  | 0.59% / 0 / 0                                                                                                                | 未变（未处理项）                                |

> 计数勘误（二轮 review）：复检时 Python 实为 38 例（原文 37）；二轮修复补 extras 去重断言 1 例后为 39。
> 变异复现口径（工具未入仓）：StrykerJS 8.7.1 + `mutate:["core.js"]` + command runner `node --test test/core.test.js`，concurrency 2，killed+timeout 计为检出。

修复摘要：

- 解析器与生成器拆出可测函数（`parse_chunk`/`name_kana_from_chunk`/`nick_from_chunk`/`end_leave_from_chunk`、`assign_ids`/`build_sections`/`write_members_js`/`prune_unused`/`collect_paths`/`compress_members` 等），网络、目录、API 均可注入；新增 fixture 单测与离线端到端（含 `--no-dl` 幂等断言）共 16 例。
- 变异幸存点补断言：七组汉字变体、占位图转义/空名/首字符、shuffle Fisher-Yates 固定随机数、haystack 精确合并、连续空白。
- 仍幸存 12 个全部为等价/环境类（UMD 分支、被下游归一化抹平的分隔符、自交换边界），不再追。

事故与修复（须引以为戒）：

- 集成测试的 `with patch.object(...)` 块在缩进调整后作用域失效，第二次 `main()` 以**真实目录**运行：prune 删除了 `img` 下全部图片与 `scripts/_orig` 缓存，并重写了 `members.js`。
- 处置：`git checkout` 恢复图片与产物；重跑生成重新下载 `_orig`（12 名成员图片随上游刷新，已随 `1142d6a` 提交）；测试改为 `contextlib.ExitStack` 包裹整个方法体，杜绝越界。
- 教训：**集成测试对全局路径的 patch 必须覆盖整个测试体**；今后此类测试应显式断言「补丁生效」（如运行前后校验真实目录数量/哈希不变）。

## v2 复检（2026-09-27，基线 `546cbc4`）

| 维度                        | v2 复检值                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| JS 行覆盖（node:test 全量） | 99.06% 总；`core.js` 99.62%（分支 90 / 函数 100）、`poster.js` 96.69%（分支 90 / 函数 92.86）  |
| `i18n.js`                   | 行 99.32%（文案函数仅 6.25%——表函数由 E2E 驱动执行，属预期）                                   |
| `app.js`                    | 不入 node 覆盖（DOM IIFE），由 E2E 42 项覆盖                                                   |
| Python 覆盖（coverage.py）  | `fetch_members.py` 96%、`wiki.py` 54%、合计 93%                                                |
| 测试数                      | JS 43 / Python 47；E2E 42 checks（系列切换、简体搜索、刷新恢复、32 档 129 题与续玩、坂道结果） |
| 数据                        | 1338 人 / 10 团 / 111 段；`simplified.js` 150 键、158 形、8 键一对多                           |

- 命令口径：`node --test --experimental-test-coverage`；`coverage run -m unittest discover -s scripts`；E2E 为 Playwright 1.62 脚本（临时目录，不入仓）。
- 未复测项：重复率 / TODO / 依赖漏洞沿用上表首轮值（本批无新增依赖）。
- 命名变更：坂道 7 人档「7福神」、32 档两系列统一「圈内」（ADR-0004 / CONTEXT / i18n / E2E 同步）。

## 会话模块复检（2026-09-27，基线 `53ab130`）

| 维度      | 值                                                                                      |
| --------- | --------------------------------------------------------------------------------------- |
| JS 行覆盖 | `session.js` 98.90%（分支 88.76 / 函数 90.63，13 例）；其余文件口径同 v2 复检           |
| 测试数    | JS 56 / Python 47；E2E 42 checks（黑盒行为不变，本次重构的硬验收）                      |
| 重构      | `app.js` 净减 106 行；状态与持久化规则集中 `session.js`（ADR-0008，storage 适配器直测） |

- 命令口径同上；本批无新增依赖、无 UI/文案变化。

## 架构深化批次复检（2026-09-27，基线 `44e5294`）

| 维度   | 值                                                                                                      |
| ------ | ------------------------------------------------------------------------------------------------------- |
| 测试数 | JS 59 / Python 47；E2E 43 checks（新增「32 档下 7 档按钮仍显示神7」回归）                               |
| 覆盖   | `names` 组合（zh/en × 系列 × 档位穷举）、poster tokens 注入/部分合并/缺省回退；`session.js` 98.90% 未变 |
| 重构   | 命名与设计 token 单一来源；`app.js` 8 对渲染调用收成 `renderPick`（弱化版）                             |

## v3 批次复检（2026-09-27，基线 `1a0241c`）

| 维度     | 值                                                                                                                         |
| -------- | -------------------------------------------------------------------------------------------------------------------------- |
| 测试数   | JS 69 / Python 71；E2E 55 checks（新增等爱 7 项）                                                                          |
| 覆盖     | `fetch_members.py` 96%、`love_members.py` 87%（新增 fixture/集成 24 项）、`core.js` 行 99.78%                              |
| 新增面   | 等爱数据管线（官网 + Wikipedia + 存档回退）、简介本地化（映射表 47 县/12 星座 + 20 条自由文本对照）、32 档金字塔、清空已选 |
| 已知残留 | `love_members.py` 网络编排分支（wayback/commons 失败路径）靠注入测到；实网异常靠快速中止保护                               |

## 全量质检（第七轮，2026-09-27，基线 `5e5d2ff`）

按需裁剪结论：CRAP **部分做**（只查不专拆）、单元测试 **做**（补缺口）、Gherkin **不做**（E2E 已覆盖业务流）、QA 流程 **部分做**（checklist 见下）、质量指标 **做**、变异测试 **做**、覆盖率 **做**、密钥扫描 **按用户要求跳过**、越权/注入 **不做**（纯静态站点，无服务端/鉴权/SQL/命令面；npm audit 0 漏洞作为依赖健康证据）。

### 覆盖率（行 / 分支 / 函数）

| 文件             | lines | branch | funcs |
| ---------------- | ----- | ------ | ----- |
| core.js          | 99.78 | 92.04  | 100   |
| session.js       | 98.94 | 89.25  | 90.91 |
| poster.js        | 99.09 | 92.73  | 100   |
| i18n.js          | 99.64 | 60.00  | 6.25  |
| fetch_members.py | 96    | —      | —     |
| love_members.py  | 87    | —      | —     |
| wiki.py          | 54    | —      | —     |

`app.js` 不入单测覆盖表，由 E2E 55 项黑盒兜底。

### CRAP / 复杂度（文件级覆盖近似）

- 超标：`poster.js slot` CCN30 / CRAP≈30（32 档金字塔膨胀）；`core.js names`14、`deserializeState`13、`genText`10、`sourceNote`8、`profileRows`8（该文件覆盖 99.78%，CRAP 受 CCN 主导）；`love_members.py parse_wiki_members`23.1、`build_members`22.0、`resolve_former_photos`10.2；`wiki.py get`7.4。
- 改善：`fetch_members.py main` 44→9、`drawPoster` 11→5；session.js 全部 ≤5。

### 变异测试（StrykerJS 8.7.1，1372 变异）

| 文件       | 修复前 | 修复后     | 幸存说明                                                  |
| ---------- | ------ | ---------- | --------------------------------------------------------- |
| core.js    | 63.76% | **91.98%** | 58 幸存：数据表字符串变体/等价类                          |
| session.js | 78.31% | **79.78%** | 55 幸存：等价/防御性拷贝/双重校验                         |
| poster.js  | 33.07% | **37.50%** | 240 幸存：假 ctx 无法验证几何/样式，接受（视觉+E2E 兜底） |

本轮据变异指认补 11 项断言：映射表穷举（47 县/12 星座/12 月）、期生序数、来源标注移籍/分隔符、金字塔行分布/居中/cover 纵横比、长标题缩放、未知 id 拒绝、防御拷贝、返回值语义等（JS 69→80）。

### 其他指标

- 依赖：`npm audit` 0 漏洞；dev 仅 husky/lint-staged/prettier。
- TODO/FIXME/HACK/XXX：0。
- 重复率：1.54%（jscpd，6 处自克隆；最大为 poster.js 219-266↔277-324 的布局段 48 行）。
- 规模：源码 18 文件 / 7183 行；members.js 384KB、图片 85MB、仓库 338MB。
- 提交前 checklist：`npm test`（JS 80 + Python 71）→ 手动 lint-staged → `npm run graph:sync`；UI 改动跑 E2E（55 项）；review 后记检查点。

### 建议（按优先级）

1. **P2**：下次改动 `poster.js` 时拆 `slot`（CCN 30 → 量算/绘制两段），并顺带把 poster.js 219-266/277-324 的自克隆收敛。
2. **P3**：`love_members.load` 编排分支补 2-3 项注入式测试（详情页失败重试、单成员失败不阻塞）——目前靠「快速中止」保护。
3. **P3**：`wiki.py` 的 `get` 重试路径可补 1 项单测（54% 覆盖率的主因）。
4. 维持现有 checklist；下次质检从本节数字对比。
