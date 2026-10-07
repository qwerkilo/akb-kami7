# Spec：E2E 存储种子协议收口（第六轮扫描候选 ④）

- Status: ready-for-agent
- 来源：第六轮扫描候选 ④（Strong）——「存储种子协议散在 E2E 且无守卫」
- grill：2026-10-07，五问全部采纳推荐

## 问题

应用侧的存储协议单一出处是 `core.PREF_KEYS` + `core.serializeState`，但 E2E 手写：

- **键名** 11 处（`akb-lang` / `akb:skin` / `akb:state:v2:<系列>`，种入/读取/删除，散在 5 个套件）
- **载荷** 5 处（`{v:1, size, selected, duel:null}`）
- **守卫 0 处**

**静默假绿路径（已坐实）**：`PREF_KEYS` 一改（如 `v2→v3`）→ 所有种子静默失效 → 应用回落默认
（7 档/zh/classic）→ header 的「档位」维塌成 7 档、first 同理 —— 而两个套件只断言 tab 可达 /
见脸 / 无横滚，**档位塌了照样全绿**。

**可行性实测**：`core.js` 可直接 `require`（`test/core.test.js` 即如此），`core.PREF_KEYS` 与
`core.serializeState` 均导出 —— 种子可完全从产品派生、零重复。

## 决定

| #   | 决定                                                                                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | 新模块 `e2e/_store.cjs`：`prefKey(name)` / `stateKey(series)` / `statePayload({size,selected,duel})` / `seedPrefs(ctx, {lang,skin})` / `seedStates(ctx, [系列], {size,selected})`（后两个走 addInitScript） |
| Q2  | 键与载荷**从产品 require 派生**（`PREF_KEYS` + `serializeState`），不是 helper 手写 + 守卫比对                                                                                                              |
| Q3  | 每个用种子的套件**验一次「种子生效」**（header/first 在第一个非默认档位的状态断言档位真的生效；e2e.cjs/v5 的下游断言本就依赖种子、非静默）→ 各 +1 check                                                     |
| Q4  | 守卫三条：① `e2e/*.cjs` 里不许出现任何 `PREF_KEYS` 的键字符串字面量（从 core 计算、含 `state("")` 前缀）② 用种子的套件必须 require `_store.cjs` ③ `_store.cjs` 必须 require `../core.js`                    |
| Q5  | 变异两条：① 把某套件的种子改回字面量 → 守卫红 ② `_store.cjs` 绕过 `serializeState` 用 `v:999` → 「种子生效」check 红                                                                                        |

## 设计

- e2e.cjs / e2e-v5.cjs 的**页内种入**（`page.evaluate` + reload）保持 evaluate 形式 —— 它们测
  「刷新续玩」，改成 addInitScript 会每次导航重种、**冲掉进度**（行为变更）。只有 header/first
  的「一次种好、多次加载」用 addInitScript 形式。
- 读取/删除也走 `prefKey`/`stateKey`（把键当 evaluate 参数传进页面）。

## 验收（可证伪）

1. `e2e/` 里不再出现键字符串字面量（守卫从 core 计算清单）。
2. header/first 各 +1 条「种子生效」check（expect 72→73、144→145），且该 check 在变异 ② 下红。
3. `npm run e2e:all` **5/5**（245/54/**42**/73/145）。
4. `npm run check` exit=0。
5. 变异两条都被杀。

## 风险

- header/first 的「种子生效」check 依赖档位控件（`.seg-size [data-pick][aria-checked="true"]`）——
  若实现不更新 `aria-checked`，check 会红（那是真问题，不是脚本问题）。
- `core.serializeState` 的入参形状与 E2E 需要的一致（`cut`/`deeperRound` 补默认）—— 实测过。
