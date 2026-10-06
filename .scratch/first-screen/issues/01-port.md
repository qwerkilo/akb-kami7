# 工单 01：首屏矩阵入仓

- **Status**: resolved
- **Blocked by**: 无

## 实现

- `e2e/verify-first-screen.cjs`：皮肤 × 语言 × 宽度 36 状态；每状态两条检查
  （首屏完整可见 ≥ 一整行脸 / 无横向滚动）；`expect: 72`；端口 8871；
  语言与皮肤经 `addInitScript` 种（`akb-lang` / `akb:skin`）。
- `package.json` 加 `e2e:first`；`run-all.cjs` 加 `{ name: "first", … }`。
- 守卫（`test/e2e-source.test.js`）：有 `createChecker(` 的套件文件必须出现在 `run-all` 里。
- `e2e/e2e.cjs` 的两处陈旧指针：1618 行改指 `npm run e2e:header`；1631 行改指本套件。

## 判据与结果

1. `node e2e/verify-first-screen.cjs` → **72/72 通过 · 1m51s** ✓
2. 守卫变异（删 `run-all` 里的 `first` 行）**被杀** ✓
3. `npm run e2e:all` 5 套件 —— 见验证记录。

## 验证记录

| 项                                     | 结果                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `node e2e/verify-first-screen.cjs`     | **72/72 通过 · 1m51s**（36 状态 × 2）                                                  |
| `npm run e2e:all`（5 套件）            | **5/5 通过 · 5m57s**（245/54/43/72/72 —— 新增 `first` 后总耗时只 +56s，runner 并行）   |
| 守卫变异（删 `run-all` 的 `first` 行） | **被杀** ✓                                                                             |
| `npm run check`                        | exit=0 ✓                                                                               |
| 陈旧指针                               | `e2e/e2e.cjs` 1618 / 1631 两处改指仓内命令；`e2e/*.cjs` 里 `/tmp` 只剩解释历史的注释 ✓ |
