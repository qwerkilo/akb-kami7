# 工单 01：`e2e/_store.cjs` + 迁移四个套件

- **Status**: resolved
- **Blocked by**: 无

## 实现

1. 新 `e2e/_store.cjs`：`prefKey` / `stateKey` / `statePayload`（走 `core.serializeState`）/
   `seedPrefs(ctx, {…})` / `seedStates(ctx, [系列], {size, selected})`；require `../core.js`。
2. `e2e.cjs`：三处种入（48g 16 档 / 48g 40 档 / sakamichi）改 `stateKey`+`statePayload` 参数传入；
   四处读取/删除（duelIntro 删除、48g 读取、skin、poster-style）改 `prefKey`/`stateKey` 参数；
   两处皮肤 addInitScript 改 `seedPrefs`。
3. `e2e-v5.cjs`：coach/duelIntro 两处读取改参数。
4. `verify-header.cjs` / `verify-first-screen.cjs`：语言/皮肤/档位种子改 `seedPrefs`+`seedStates`。

## 判据

- `e2e/` 无键字面量；`npm run e2e:all` 5/5（除 Q3 的 +2 外 check 数不变）。

## 判据与结果

- `e2e/_store.cjs`：`prefKey` / `stateKey` / `statePayload`（走 `core.serializeState`）/
  `seedPrefs` / `seedStates`；require `../core.js`（实测可直接 require —— `test/core.test.js` 即如此）。
- 迁移：e2e.cjs（3 种入 + 4 读取/删除 + 2 皮肤 addInitScript）、v5（2 读取）、header / first（种子）。
  页内种入保持 `page.evaluate` 形式（addInitScript 会每次导航重种、冲掉「刷新续玩」的进度）。
- 全仓 `e2e/` 已无 `PREF_KEYS` 键字面量（只剩注释里一处 `akb:skin`，守卫剥注释）。
- `npm run e2e:all` 5/5（245/54/42/73/145，含 Q3 的 +2）。
