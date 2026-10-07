# Spec：套件生命周期收口（第六轮扫描候选 ②）

- Status: ready-for-agent
- 来源：第六轮架构扫描候选 ②（Strong）——「套件生命周期五份手写，收尾纪律三档，异常路径会留孤儿进程」
- grill：2026-10-07，六问全部采纳推荐（Q1 全收 / Q2 `_suite.cjs` 执行器 / Q3 轮询+硬失败 / Q4 单测缝 / Q5 三条守卫 / Q6 验收）

## 问题

五个套件（`e2e.cjs` / `e2e-v5.cjs` / `e2e-pwa.cjs` / `verify-header.cjs` / `verify-first-screen.cjs`）
各自手写同一套生命周期：`spawn serve.py（cwd=ROOT 或 TMP）→ 就绪 → chromium.launch → body →
close+kill → process.exit(checker.done())`。三处摩擦：

| 套件                      | 收尾纪律                                                   | 就绪        |
| ------------------------- | ---------------------------------------------------------- | ----------- |
| `e2e.cjs`                 | try/catch/finally，但 **launch 在 try 之外**（249 vs 268） | 盲等 1200ms |
| `e2e-v5.cjs`              | catch 后清理（close 自身抛就没兜底）                       | 盲等 1200ms |
| `e2e-pwa.cjs`             | **无顶层 try/finally** ✗ —— hard 门抛 → 未处理拒绝 → 孤儿  | 轮询 ✓      |
| `verify-header.cjs`       | try/finally ✓                                              | 盲等 1200ms |
| `verify-first-screen.cjs` | try/finally ✓ + `.catch(exit 1)`                           | 盲等 1200ms |

- **异常路径会留孤儿**：pwa 恰是 hard 门最多（最常抛）的套件；现场记录过 8781 残留，
  `preflight.mjs` 专为历轮遗留服务器而建。
- **就绪四样**：四个套件盲等 1200ms（慢机器上不够、快机器上白等），只有 pwa 轮询。
- `serve.py` 的 **docroot = 进程 cwd** 契约与 `close+kill+exit` 三行各重复 5 处。

## 决定

| #   | 决定                                                                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | **五个套件全收**（一个形状；只收三处会留下两套写法）                                                                                                                                                                                   |
| Q2  | 新模块 `e2e/_suite.cjs` 的 `runSuite({ name, expect, port, cwd?, body })` 拥有 **spawn + 就绪 + launch + finally(close+kill) + `process.exit(checker.done())`**；`body({ browser, base, checker })` 保留套件的 contexts/pages/超时选项 |
| Q3  | 就绪改**轮询**（`fetch(BASE)` 每 250ms、上限 ~10s）；超时 = **硬失败**（exit 2 + 明确消息），不占 check 计数                                                                                                                           |
| Q4  | 新 `test/e2e-suite.test.js`（注入假 spawn/launch/fetch/exit/sleep）：①body 抛错时 close+kill 都跑到 ②退出码 = `checker.done()` ③就绪超时 → 硬失败 ④body 拿到 `base`/`browser`                                                          |
| Q5  | 守卫（剥注释）：①`serve.py` 的 spawn 只许在 `_suite.cjs` ②`process.exit(` 只许在 `_check.cjs`/`_suite.cjs`/`run-all.cjs` ③五个套件都必须调 `runSuite(`                                                                                 |
| Q6  | 迁移前后各跑一次 `e2e:all`（5/5、check 数不变、时长不显著变差）；「硬失败 → 清理」在单测里做                                                                                                                                           |

## 设计

- `_suite.cjs` 的依赖走**参数注入**（`runSuite(opts, deps = {})`，默认 `{ spawn, launch, fetch, exit, sleep }`）——
  不在测试里改模块级开关（本仓记录过「模块级开关要保存/恢复」的坑）。
- 执行器不 reject：错误在内部转成 check（`脚本异常`，与今天的套件一致 → exit 1）或工具失败（就绪超时 → exit 2）。
- 各套件保留自己的 `PORT`/`BASE` 常量（最小 diff）；`port` 传进执行器。
- pwa 的 `buildTemp()` 留在套件内（同步、在 `runSuite` 之前）；其「静态服务器就绪」check 由执行器保证后删除
  （check 数 43 → 42，`expect` 同步）。

## 验收（可证伪）

1. 五个套件都经 `runSuite(` 跑；无手写 `spawn(serve.py)`、无手写 `process.exit(`。
2. `test/e2e-suite.test.js` 四条全绿；变异（去掉 finally 的 close/kill、去掉就绪轮询）均被杀。
3. `npm run e2e:all` **5/5**；check 数 = 245 / 54 / **42** / 72 / 144（pwa 少的那条是执行器保证的）；
   时长不显著变差（前后各一次实测对比）。
4. `npm run check` exit=0（含 `test/e2e-source.test.js` 的新守卫）。
5. 孤儿实测：单测里「body 抛错 → close+kill 都调用」；`e2e:all` 跑完四个端口空闲。

## 风险

- 执行器吞掉套件的顶层 try/catch 语义（如 e2e.cjs 的 `catch (e) { check("脚本异常", …) }`）——
  迁移时逐套件对照，确保异常路径的**输出与退出码**与今天一致。
- 轮询就绪在慢机器上的上限（40 × 250ms = 10s）可能不够 —— 与今天的盲等 1200ms 相比只增不减；
  不够时调上限并记录实测。
