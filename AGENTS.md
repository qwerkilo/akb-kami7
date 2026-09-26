# AGENTS.md

## 项目概览

纯静态站点，无构建步骤、无框架、无运行时依赖：`index.html` + `style.css` + `app.js` + `members.js`，用静态服务器直接托管。

- `app.js` 是单文件 IIFE，三个阶段：pick（选人/筛选/搜索）→ duel（两两对比排序，可回放的归并排序，支持撤回）→ result（canvas 1080×1440 海报导出）。
- 双语 UI：文案同时存在于 `app.js` 顶部的 `I18N` 对象（zh/en）和 `index.html` 的 `data-i18n` 属性里，改文案必须两处、双语同步。
- `members.js` 是生成文件（数据来自 48pedia），不要手改。

## 常用命令

- 本地预览（仓库根目录）：`python3 -m http.server`，用 `http://` 访问页面。不要直接双击打开 `file://`，否则海报导出会因 canvas 污染失败。
- 格式化（Prettier，配置见 `.prettierrc`）。本机钩子不执行（原因见下），提交前手动运行：
  `PATH=/root/.local/bin:$PATH node node_modules/lint-staged/bin/lint-staged.js`
  （`/root/.local/bin/prettier` 是垫片，指向 `node_modules/prettier/bin/prettier.cjs`）
- 没有 lint / typecheck 脚本。

## 环境限制（/mnt/sdcard 是 Android FUSE 挂载）

- 不支持符号链接和可执行位：`npm install` 必须加 `--bin-links=false --ignore-scripts`；husky 钩子在本机无法执行（git 会跳过），所以提交前要手动跑上面的 lint-staged 命令。
- 当前 Node v20.19.2：lint-staged 固定在 `^16`，不要升级到 v17（需要 Node ≥22）。

## 数据与图片生成

- `members.js`、`img/full`（720×960 WebP）、`img/thumb`（240 宽 WebP）都由 `scripts/fetch_members.py` 生成；原图缓存在 `scripts/_orig/`（已 gitignore），脚本会删除未被引用的图片文件。
- 依赖 Pillow（当前环境未安装：`pip install Pillow`）；网络请求默认走代理 `http://127.0.0.1:7897`，可用 `AKB_PROXY` 覆盖。
- 重跑：`cd scripts && python3 fetch_members.py`；`--no-dl` 只用缓存，`--force` 强制重新压缩。

## 工作流 SOP（尽量遵守）

1. 先用 `grilling` / `grill-with-docs` 把需求和方案 grill 清楚。
2. 更新 `CONTEXT.md` 和 `docs/adr/`（`domain-modeling`）。
3. `to-spec` → `.scratch/<feature>/spec.md`。
4. `to-tickets` → `.scratch/<feature>/issues/NN-*.md`。
5. `implement`，遵循 `tdd`（跑在 Node 内置 `node:test` 上；测试基建尚未搭建，首个实现任务需先补 `npm test` 脚本与测试文件）。

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
