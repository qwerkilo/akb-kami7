# 工单 01：抽出 `e2e/_ui.cjs` 并迁移两个套件

- **Status**: resolved
- **Blocked by**: 无

## 实现

1. 新模块 `e2e/_ui.cjs`：五个函数（`openFilterPanel` / `openMore` / `fillScreening` /
   `passScreening` / `goToPick`），body 取 `e2e.cjs` 版；`goToPick` 用 300ms；注释随迁。
2. `e2e.cjs` 删本地定义（保留套件专属助手）、加 `const { … } = require("./_ui.cjs");`。
3. `e2e-v5.cjs` 同上。

## 判据

- 两个套件不再定义这五个；`node --check` 通过。
- `npm run e2e:all` **5/5**（245/54/42/72/144 不变）。

## Comments

`e2e/_ui.cjs` 已收五个共享页面操作，`e2e.cjs` / `e2e-v5.cjs` 改为名字级解构（提交 `e5f7ffa`）。

2026-10-29 triage 复核：工单已交付（检查点第六十八轮），补状态。
