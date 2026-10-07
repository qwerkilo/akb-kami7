# 工单 02：「种子生效」check + 守卫 + 变异

- **Status**: resolved
- **Blocked by**: 01

## 实现

1. header/first 各加一条「种子生效」check（第一个非默认档位的状态断言
   `.seg-size [data-pick][aria-checked="true"]` 的档位 = 种入值）；expect 72→73、144→145。
2. 守卫三条（`test/e2e-source.test.js`）：键字面量清单从 `core.PREF_KEYS` 计算（含
   `state("")` 前缀）并在 `e2e/*.cjs` 上断言 0 命中；用种子的套件必须 require `_store.cjs`；
   `_store.cjs` 必须 require `../core.js`。
3. 变异：① 抄回字面量 → 守卫红 ② `statePayload` 用 `v:999` → `e2e:header` 的「种子生效」红。

## 判据

- 守卫全绿；变异 2/2 被杀；`npm run check` exit=0；`npm run e2e:all` 5/5（245/54/42/73/145）。

## 判据与结果

- header/first 各 +1「种子生效」check（`PASS 种子生效：档位 = 16` / `= 40`），expect 73/145。
- 守卫「存储种子协议只有一处」：键清单从 `core.PREF_KEYS` 计算（含 `state("")` 前缀）并在
  五个套件上断言 0 命中；`_store.cjs` 必须 require `../core.js`。
- 变异 2/2 被杀：① 把 `akb:skin` 字面量抄回 first → 守卫红 ② `statePayload` 绕过
  `serializeState` 用 `v:999` → `npm run e2e:header` 红（「种子生效」check 抓住静默失效 ——
  这正是修复前会全绿的路径）。
- `npm run check` exit=0。
