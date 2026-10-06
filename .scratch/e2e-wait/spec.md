# Spec：等待与就绪收进 `e2e/_wait.cjs`（候选 4）

- Status: ready-for-agent
- 来源：第五轮架构扫描候选 4（`/tmp/opencode/architecture-review-20261006-104242.html`）

## 问题

`_wait.cjs` 名义上是「等待的唯一入口」，实际只覆盖了软等待的一半：

| 形态                                                   | 数量 | 问题                                                                                  |
| ------------------------------------------------------ | ---- | ------------------------------------------------------------------------------------- |
| 裸 `waitForFunction` / `waitForSelector`（硬，超时抛） | ~24  | 流程门；抛 Playwright 的 `Timeout Nms exceeded`，`waitForFunction` 连等的是什么都不说 |
| `.catch(noteTimeout(…))`（软）                         | ~5   | 每处重写包装                                                                          |
| `.then(true).catch(false)` + `ok(…)`（软+断言）        | 3    | ⚠ 没有标签                                                                            |
| `ready()` 两份实现（`e2e.cjs` / `e2e-v5.cjs`）         | 2    | **语义完全相同**，只差写法                                                            |

## 决定（grill 2026-10-06，全部采纳推荐）

| #   | 决定                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------- |
| Q1  | `ready()` 收进 `_wait.cjs`（视口内图 + 字体 + 600ms settle）                                                |
| Q2  | 软等待全走 `waitFor` / `waitForSelector`；`.then(true).catch(false)` 的三处变成 `ok(await waitFor(…), "…")` |
| Q3  | 硬等待（流程门）走 `waitFor(…, {hard: true})` —— 超时抛**带标签**的 Error，不增加 check 计数                |
| Q4  | 守卫：四套件不许裸 `waitForFunction` / `.waitForSelector(`，不许自己实现 `ready`                            |
| Q5  | 迁移前后各跑一次 `e2e:all`（4/4 + 耗时），确认行为等价                                                      |

## 非目标

- 不改 `waitForTimeout`（那是「睡一会儿」，不是条件等待）。
- 不改各套件的断言与流程。

## 验收（可证伪）

1. 四套件里 `waitForFunction` / `.waitForSelector(` 出现 **0 次**；`ready` 只从 `_wait.cjs` 取
   （守卫，变异被杀）。
2. `_wait.cjs` 同时提供软（返回 bool）与硬（抛带标签）两种形态。
3. `npm run e2e:all` 4/4、check 数守恒（245/54/43/72 不变 —— 迁移不新增 check）。
4. 迁移后耗时与迁移前（4/4 · 5m36s）同量级。
