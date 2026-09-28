# AGENTS.md

## 项目概览

纯静态站点，无构建步骤、无框架、无运行时依赖：`index.html` + `style.css` + `core.js` + `session.js` + `poster.js` + `i18n.js` + `app.js` + `members.js` + `simplified.js`，用静态服务器直接托管。

- 站点覆盖三系列共 13 团：48g 七团（AKB48 / SKE48 / NMB48 / HKT48 / NGT48 / STU48 / SDN48）、坂道三团（乃木坂46 / 櫻坂46 / 日向坂46）、等爱三团（=LOVE / ≠ME / ≒JOY），现役 + 毕业共 **1375 人**。
- 能力：三系列切换（各自保留已选/对决进度，localStorage）、7/16/32 档位（32 档精确全序最坏 129 题，结果与海报为金字塔布局）、简体输入与罗马字检索（`simplified.js` 折叠表 + `core.js` 假名→罗马字）、对决进度与刷新续玩（含向导模式：三步指示器、首屏见脸、引导卡、进度环、对决说明与续玩卡，① 返回不丢进度）、成员简介（卡片「i」→ 资料卡，值随语言本地化：映射表 + 自由文本对照表）、一键清空已选。
- `core.js` 是无 DOM 依赖的纯逻辑（搜索归一、折叠索引、两级分组、对决 replay、持久化载荷编解码、字幕 module、导航转移表 `nav`/`steps`、占位图）；`session.js` 是会话状态深模块（系列/档位/已选/对决/筛选，storage 与成员查询注入，node 可测）；`poster.js` 是海报绘制 module（7/16/32 × 四样式：金字塔/杂志/榜单/拼贴，ctx 依赖注入，假 ctx 可测）；`i18n.js` 是 zh/en/ja 文案；`app.js` 是 DOM 层：向导（步骤指示器/引导/进度/续玩）→ pick（系列/筛选/搜索）→ duel（两两对比排序，可回放归并、可撤回、可续玩）→ result（canvas 海报导出）。
- 三语 UI（zh/en/ja）：文案在 `i18n.js`，`index.html` 的 `data-i18n` 属性引用同一批键；改文案三处同步，`test/i18n.test.js` 检查键完整性（ja 与 zh 同集合、en 允许 `leave_*`）。首次访问按浏览器语言自动选（ja→ja、zh→zh、其他→en），选择记忆在 `akb-lang`；数据字段随 zh/en 走映射表、日语直出数据原文。
- `members.js` 是生成文件（48pedia + 等爱三团官网/Wikipedia），不要手改。

## CodeGraph（代码检索优先）

- 本仓库已建立 CodeGraph 索引（`.codegraph/` 是本地缓存，已 gitignore）。**定位符号、梳理调用链、了解架构一律先走 CodeGraph**：
  - MCP 工具 `codegraph_explore`（带上 `projectPath`），或命令行 `codegraph explore "<符号或问题>"`。
- 代码或数据改动后同步索引：`npm run graph:sync`（即 `codegraph sync -q`，秒级）；查看状态 `codegraph status`；索引异常时用 `codegraph index` 重建。
- 本机 FUSE 限制导致 git 钩子不执行，同步不会自动发生：**每次提交前手动同步一次**，与手跑 lint-staged 同一条流程。
- 索引覆盖 JS/Python 代码；HTML/CSS 不在索引内。

## 常用命令

- 本地预览（仓库根目录）：`python3 -m http.server`，用 `http://` 访问页面（`file://` 下海报导出会因 canvas 污染失败）。
- 格式化（Prettier，配置见 `.prettierrc`）。本机钩子不执行（原因见下），提交前手动运行：
  `PATH=/root/.local/bin:$PATH node node_modules/lint-staged/bin/lint-staged.js`
  （`/root/.local/bin/prettier` 是垫片，指向 `node_modules/prettier/bin/prettier.cjs`）
- 测试：`npm test`（node:test 跑 `test/*.test.js` + Python 标准库 unittest 跑 `scripts/test_*.py`，均离线、不联网）。
- 查看原型：原型文件在 `prototype/*` 分支上，main 工作区里没有属预期。用 `git worktree add /tmp/akb-proto-<名> prototype/<分支>` 检出，再 `python3 -m http.server <端口> --directory /tmp/akb-proto-<名>` 托管（原型引用的 `members.js`/`img/` 在 worktree 内齐全）。
- 没有 lint / typecheck 脚本。

## 环境限制（/mnt/sdcard 是 Android FUSE 挂载）

- 不支持符号链接和可执行位：`npm install` 必须加 `--bin-links=false --ignore-scripts`；husky 钩子在本机无法执行（git 会跳过），所以提交前要手动跑上面的 lint-staged 命令。
- 当前 Node v20.19.2：lint-staged 固定在 `^16`，不要升级到 v17（需要 Node ≥22）。

## 数据与图片生成

- 重新生成成员数据/图片（`scripts/fetch_members.py`）前读 `docs/agents/data-pipeline.md`。

## 工作流 SOP（尽量遵守）

1. 先用 `grilling` / `grill-with-docs` 把需求和方案 grill 清楚。
2. 更新 `CONTEXT.md` 和 `docs/adr/`（`domain-modeling`）。
3. `to-spec` → `.scratch/<feature>/spec.md`。
4. `to-tickets` → `.scratch/<feature>/issues/NN-*.md`。
5. `implement`，遵循 `tdd`；测试跑在 `node:test` + Python unittest 上，`npm test` 一键。
   - 测试只落七处缝：Python 解析纯函数、`core.js` 纯逻辑、产物不变量（`members.js`/`simplified.js`）、`session.js`、`poster.js`、`i18n` 键完整性、E2E 黑盒；跨缝前先确认。

## Code Review 检查点

- 每次 review 结束后，向 `docs/reviews/checkpoints.md` 追加一条记录（格式见该文件）：日期、本次基点、审查范围、结论、遗留问题、下次基点（本次 HEAD 的 SHA）。
- 下次 review 从上次记录的基点开始，不重复审查已经通过的部分。

## 约定

- 与用户交流使用中文。
- 提交信息使用中文（沿用仓库历史风格）。

## Agent skills

### Issue tracker

新建/更新 spec 与工单（`to-spec` / `to-tickets` / `triage` / `wayfinder`）前读 `docs/agents/issue-tracker.md`：`.scratch/<feature>/` 的本地 markdown 约定与操作。

### Triage labels

`triage` 打标签前读 `docs/agents/triage-labels.md`：五个标准角色，标签字符串与角色同名。

### Domain docs

改 `CONTEXT.md`、写 ADR 或命名领域概念前读 `docs/agents/domain.md`：单上下文（根 `CONTEXT.md` + `docs/adr/`）。
