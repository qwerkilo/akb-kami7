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
- 迁移：e2e.cjs 12 处 helper 调用（硬 8 / 软 4）、v5 1 处（硬）、pwa 14 处（硬 11 / 软 3）；
  两份本地 `ready()` 与 `_waitFonts` 删除；`noteTimeout` 只剩 `_wait.cjs` 与 pwa 的
  「旧写法」注释提及（导入已清）。
- 标签取自用途：`筛选相位` / `对决相位` / `挑人相位` / `重排按钮` / `海报 data-URL` /
  `SW 接管` / `断网重载后名册` / `对决开始` / `恢复在线后页头` / `iPhone 安装入口` /
  `预热前名册` / `浮层 <sel>` / `等爱 tab 生效` / `海报像素出现（断网前）` / `海报图生成` /
  `重载后 masthead` / `更新横幅出现` / `点刷新后新文档` / `切换皮肤后名册卡片` /
  `390px 首屏卡片` / `恢复在线后名册/结果`。
- 守卫：四套件 0 次 `waitForFunction` / `.waitForSelector(`、0 处自定义 `ready`；
  `_wait.cjs` 必须有 `waitFor` / `waitForSelector` / `ready` / `hard` —— 变异 2 个被杀。

## 验证（迁移前后同跑）

|                         | check 数                   | e2e:all         |
| ----------------------- | -------------------------- | --------------- |
| 迁移前（候选 3 收口时） | 245/54/43/72               | 4/4 · **5m36s** |
| 迁移后                  | **245/54/43/72**（不变 ✓） | 4/4 · **5m35s** |

`npm run check` exit=0；四个端口跑完都空闲（无孤儿）。
