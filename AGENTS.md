# AGENTS.md

## 项目概览

纯静态站点，无构建步骤、无框架、无运行时依赖：`index.html` + `style.css` + `core.js` + `i18n.js` + `app.js` + `members.js`，用静态服务器直接托管。

- 站点覆盖 AKB48 / SKE48 / NMB48 / HKT48 / NGT48 / STU48 / SDN48 七个团体（现役 + 毕业，跨团去重后 1136 人）。
- `core.js` 是无 DOM 依赖的纯逻辑（搜索归一、两级分组、对决 replay、占位图）；`i18n.js` 是 zh/en 文案；`app.js` 是单文件 IIFE：pick（选人/筛选/搜索）→ duel（两两对比排序，可回放的归并排序，支持撤回）→ result（canvas 海报导出）。
- 双语 UI：文案在 `i18n.js`（zh/en），`index.html` 的 `data-i18n` 属性引用同一批键；改文案两处同步，`test/i18n.test.js` 会检查键完整性。
- `members.js` 是生成文件（数据来自 48pedia），不要手改。

## CodeGraph（代码检索优先）

- 本仓库已建立 CodeGraph 索引（`.codegraph/` 是本地缓存，已 gitignore）。**定位符号、梳理调用链、了解架构时优先用 CodeGraph**，不要先 grep / 逐个文件读：
  - MCP 工具 `codegraph_explore`（带上 `projectPath`），或命令行 `codegraph explore "<符号或问题>"`。
- 代码或数据改动后同步索引：`npm run graph:sync`（即 `codegraph sync -q`，秒级）；查看状态 `codegraph status`；索引异常时用 `codegraph index` 重建。
- 本机 FUSE 限制导致 git 钩子不执行，同步不会自动发生：**每次提交前手动同步一次**，与手跑 lint-staged 同一条流程。
- 索引覆盖 JS/Python 代码；HTML/CSS 不在索引内。

## 常用命令

- 本地预览（仓库根目录）：`python3 -m http.server`，用 `http://` 访问页面。不要直接双击打开 `file://`，否则海报导出会因 canvas 污染失败。
- 格式化（Prettier，配置见 `.prettierrc`）。本机钩子不执行（原因见下），提交前手动运行：
  `PATH=/root/.local/bin:$PATH node node_modules/lint-staged/bin/lint-staged.js`
  （`/root/.local/bin/prettier` 是垫片，指向 `node_modules/prettier/bin/prettier.cjs`）
- 测试：`npm test`（node:test 跑 `test/*.test.js` + Python 标准库 unittest 跑 `scripts/test_*.py`，均离线、不联网）。
- 没有 lint / typecheck 脚本。

## 环境限制（/mnt/sdcard 是 Android FUSE 挂载）

- 不支持符号链接和可执行位：`npm install` 必须加 `--bin-links=false --ignore-scripts`；husky 钩子在本机无法执行（git 会跳过），所以提交前要手动跑上面的 lint-staged 命令。
- 当前 Node v20.19.2：lint-staged 固定在 `^16`，不要升级到 v17（需要 Node ≥22）。

## 数据与图片生成

- `members.js`、`img/full`（720×960 WebP）、`img/thumb`（240 宽 WebP）都由 `scripts/fetch_members.py` 从 48pedia 的 8 个来源页生成（`SOURCES`，7 团；跨团按姓名+假名去重归口）；原图缓存在 `scripts/_orig/`（已 gitignore），脚本会删除未被引用的图片文件。
- 当前规模：1136 人、1136 张图，full 55M + thumb 15M（约 70MB）；members.js 约 230K。
- 依赖 Pillow（已装 12.3.0；缺失时 `pip install Pillow`）；网络默认走代理 `http://127.0.0.1:7897`，本机实际用 `AKB_PROXY=http://127.0.0.1:7890` 覆盖。
- 重跑：`cd scripts && python3 fetch_members.py`；`--no-dl` 只用缓存，`--force` 强制重新压缩。

## 工作流 SOP（尽量遵守）

1. 先用 `grilling` / `grill-with-docs` 把需求和方案 grill 清楚。
2. 更新 `CONTEXT.md` 和 `docs/adr/`（`domain-modeling`）。
3. `to-spec` → `.scratch/<feature>/spec.md`。
4. `to-tickets` → `.scratch/<feature>/issues/NN-*.md`。
5. `implement`，遵循 `tdd`（测试跑在 `node:test` + Python unittest 上，`npm test` 一键；基建已就位）。

## Code Review 检查点

- 每次 review 结束后，向 `docs/reviews/checkpoints.md` 追加一条记录（格式见该文件）：日期、本次基点、审查范围、结论、遗留问题、下次基点（本次 HEAD 的 SHA）。
- 下次 review 从上次记录的基点开始，不重复审查已经通过的部分。

## 约定

- 与用户交流使用中文。
- 提交信息使用中文（沿用仓库历史风格）。

## Agent skills

### Issue tracker

问题以本地 markdown 存放在 `.scratch/<feature>/`。见 `docs/agents/issue-tracker.md`。

### Triage labels

五个标准角色，标签字符串与角色同名。见 `docs/agents/triage-labels.md`。

### Domain docs

单上下文：仓库根 `CONTEXT.md` + `docs/adr/`。见 `docs/agents/domain.md`。
