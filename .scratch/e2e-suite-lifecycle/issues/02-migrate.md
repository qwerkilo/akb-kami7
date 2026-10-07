# 工单 02：迁移五个套件到 `runSuite`

- **Status**: resolved
- **Blocked by**: 01

## 实现（逐套件对照，保持异常路径的输出与退出码与今天一致）

1. `e2e.cjs`：删 spawn/盲等/launch/顶层 try-catch-finally/exit；`browser`、`checker` 从 body 参数拿；
   `const check = checker.check` 不变；套件自己的 `catch (e) { check("脚本异常", …) }` 删除（执行器负责）。
2. `e2e-v5.cjs`：同上。
3. `e2e-pwa.cjs`：`buildTemp()` 留在 `runSuite` 之前；删「静态服务器就绪」check（执行器保证）→
   `expect: 43 → 42`；删手写 close/kill/exit。
4. `verify-header.cjs` / `verify-first-screen.cjs`：`let browser = null; try/finally` 换成 body 参数；
   first 的 `.catch(exit 1)` 删除（执行器不 reject）。
5. 各套件的 `PORT`/`BASE` 常量保留；`port` 传给执行器。

## 判据

- `npm run e2e:all` **5/5**，check 数 245 / 54 / **42** / 72 / 144。
- 四个端口跑完空闲（`ss -ltn` / preflight 无残留）；总时长与迁移前对比（前后各一次实测，记录数字）。
- 变异：pwa 的 body 里注入一个必抛的语句 → 收尾行与退出码正确、无孤儿（真跑一次，随后还原）。

## 判据与结果

- 五个套件全部迁移：无手写 `spawn(serve.py)`、无 `chromium.launch`、无 `process.exit`、
  无自建 checker；pwa 的 `buildTemp()` 留在 `runSuite` 之前、`cwd: TMP`。
- **check 数**：245 / 54 / **42** / 72 / 144（pwa 少的是执行器保证的「静态服务器就绪」）。
- **故障注入（真跑）**：v5 与 **pwa** 的 body 首行注入必抛 → 两处都是 `脚本异常` FAIL、
  退出码 1、**端口空闲无孤儿**（pwa 正是修复前会留 8781 孤儿的那条路）。
- 孤儿检查：每次 `e2e:all` 后 `ss -ltn` 五个端口全空闲、无 serve.py 残留。
- 时长：迁移前 6m31s（单样本）；迁移后 7m07s / 8m11s / 8m41s —— **机器负载漂移，
  不作为结论**（review-rules #2：跨轮对比会被骗；就绪轮询的机制上界是「服务器真慢时最多等 10s」、
  常见情况下 ~250-500ms 就返回，替代固定 1200ms）。
- 记账：故障注入用 `git checkout <file>` 还原，把**未提交的迁移**一起回退了（v5/pwa）——
  已重放并重新过闸门；教训：临时改动要在提交之后再注入，或逐行撤销而不是整文件 checkout。

## Comments

（实现时填写）
