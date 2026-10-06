# 工单 01：等待与就绪合一 + 守卫

- **Status**: resolved
- **Blocked by**: 无

## 实现

- `_wait.cjs`：`waitFor` / `waitForSelector` 加 `hard` 选项（软：⚠ + false；硬：抛
  `等待超时：<标签>（Nms）`）；`ready(pg, {settle})` 从 e2e.cjs 搬来（含字体与 settle）。
- 迁移点（逐处选软/硬）：
  - **硬**（流程门）：`#phase-screen` / `#phase-duel` / `#phase-pick` / `#resort-btn` /
    海报 data-URL / SW 接管 / 断网重载后名册 / 对决开始 / 恢复在线 / iPhone 安装入口 /
    预热前名册 —— 超时抛，带标签。
  - **软**（后面有断言兜底）：浮层、等爱 tab、切换皮肤后卡片、390px 首屏卡片、
    海报像素/图生成、重载后 masthead、更新横幅、点刷新后新文档、SW 接管（pwa:154）。
- 删除两份本地 `ready()` 与 `_waitFonts`。

## 判据

1. 守卫（`test/e2e-source.test.js`）：四套件 0 次 `waitForFunction` / `.waitForSelector(`、
   0 处自定义 `ready`；`_wait.cjs` 有软/硬两形态 —— 变异 2 个被杀。
2. `npm run e2e:all` 4/4、check 数不变（245/54/43/72）。
3. 耗时与迁移前同量级（迁移前 4/4 · 5m36s）。

## 实现记录（2026-10-06）

- `_wait.cjs`：`_run` 加 `hard` 参数；`waitFor` / `waitForSelector` 透传 `hard`；
  `ready(pg, {settle = 600})` 从 e2e.cjs 搬来（视口内图 → `waitFor`、字体、settle）。
- 迁移：e2e.cjs 12 处 helper 调用（硬 8 / 软 4）、v5 1 处（硬）、pwa 14 处（**硬 8 / 软 6**）；
  两份本地 `ready()` 与 `_waitFonts` 删除（v5 的那份迁移前就是**死代码** —— 0 处调用，
  所以 v5 连 `ready` 都不导入）。`noteTimeout` 仍是 `_wait.cjs` 的导出，**`verify-header.cjs`
  还在用**（它的 click `.catch`），未在迁移清单内。
- 标签取自用途：`筛选相位` / `对决相位` / `挑人相位` / `重排按钮` / `海报 data-URL` /
  `SW 接管` / `断网重载后名册` / `对决开始` / `恢复在线后页头` / `iPhone 安装入口` /
  `预热前名册` / `浮层 <sel>` / `等爱 tab 生效` / `海报像素出现（断网前）` / `海报图生成` /
  `重载后 masthead` / `更新横幅出现` / `点刷新后新文档` / `切换皮肤后名册卡片` /
  `390px 首屏卡片` / `恢复在线后名册/结果`。
- 守卫：四套件 0 次 `waitForFunction` / `.waitForSelector(`、0 处自定义 `ready`；
  `_wait.cjs` 必须有 `waitFor` / `waitForSelector` / `ready` / `hard` —— 变异 2 个被杀。

## 验证（迁移前后同跑）

|                         | check 数                   | e2e:all                              |
| ----------------------- | -------------------------- | ------------------------------------ |
| 迁移前（候选 3 收口时） | 245/54/43/72               | 4/4 · **5m36s**                      |
| 迁移后                  | **245/54/43/72**（不变 ✓） | 4/4 · **5m35s**                      |
| 迁移后 + 两轴审查修复   | 245/54/43/72               | 4/4 · **5m01s**（含一次 flake 复跑） |

`npm run check` exit=0；四个端口跑完都空闲（无孤儿）；两轴审查修复后单跑主套件
**245/245**；新增 `test/e2e-wait.test.js`（5 条，假 pg 钉软/硬行为），三个守卫测试文件
共 19 条全绿。

## 两轴审查后的修复（2026-10-06）

- **低（真隐患）**：`clickFighter`（e2e.cjs 的浮层点击）被我从裸调用改成**软** —— 超时后
  会继续 force click，对不存在的元素会等满默认 120s（旧写法 4s 封顶；实测 force click 对
  `display:none` 元素会立即抛，故当前不可达，但语义漂了）。改回**硬**（它在 try/catch 里，
  硬抛被同一 catch 接住 = 旧语义）。
- **低（超时漂移）**：pwa「海报像素出现（断网前）」15s→20s（复制粘贴事故）→ 改回 15000。
- **低（守卫漏面）**：`HELPERS` 补 `ready`（漏 import 时守卫要能红）。
- **低（测试）**：新增 `test/e2e-wait.test.js`（5 条，假 pg）：软返回 false + ⚠（含标签与
  超时值）、硬抛带标签、成功返回 true、`hard` 不透传进 Playwright options、`ready` 软等不抛。
- 低：硬等待的错误文案改成「这是流程门，后面的检查不再执行」（原文案是软等待的说辞）；
  `SLOW_WAIT_MS` 不再导出（无人用）；`ready(pg, {settle})` 的可配置参数保留（测试用）。

## 迁移后的一次 flake（如实记账）

`npm run e2e:all`（迁移后、含两轴审查修复）第一次跑：主套件在「对决相位」门超时
（8s，`…对决相位 5s` → FAIL），整套 39/40、声明 245 实得 40（异常提前终止）。
**同一份代码紧接着单跑 `npm run e2e` = 245/245** —— 逐处对照迁移前后语义相同
（该处是裸调用 → `hard: true`，options 与超时一致），所以判为**门太紧**而不是回归。
处置：该门 8s → 15s（套件里其余「点击 → 相位变化」的门都在 15s 档），并把这次 flake
写进注释。复跑 `e2e:all` 4/4（见验证表）。
