# 工单 02：四套件迁移 + runner 简化

- **Status**: resolved
- **Blocked by**: 01

## 决定

- 四个套件改用 `createChecker`，各自声明 `EXPECT`（当前值：e2e 245 / v5 54 / pwa 43 /
  header 72），删掉各自的 `results`/`check`/`ok`/收尾行/exit code 逻辑。
- `verify-header.cjs` 的「状态」按 check 记（名字 = 状态描述），`EXPECT` = 72。
- `run-all.cjs`：删 `parseCounts` / `compareCounts` / `SUITES[].expect` 与相关 selfTest
  条目；保留 `--max-parallel` / `--only` / 失败聚合 / 内存并发。
- `e2e-pwa.cjs` 的失败列表、`e2e.cjs` 的失败日志 → 记录器统一提供。

## 判据（可证伪）

1. `npm run e2e:all` 4/4、`npm run e2e` / `:v5` / `:pwa` / `:header` 各自 exit 0。
2. 四条命令的输出都有统一的收尾行（`[名字] N/M 通过`）。
3. 变异：给 `e2e-v5.cjs` 删一条 check → 它**自己**红（EXPECT 自检），runner 不用管。
4. `run-all.cjs` 的 selfTest 仍全过（删掉 parseCounts 条目后）。

## 实现记录（2026-10-06）

- 四套件迁移：各自声明 `expect`（e2e 245 / v5 54 / pwa 43 / header 72），删掉自己的
  results/收尾行/exit code；header 的「状态」按 check 记（名字 = `语言/档位/系列/在线态`）；
  pwa 保留一行参数顺序适配 `(cond, label, extra)`。
- `run-all.cjs`：删 `parseCounts`（四条正则）、`compareCounts`、`SUITES[].expect` 与
  相关 selfTest 条目；启动横幅不再列基线数；结束行只报耗时 + 退出码（check 数在套件的
  收尾行里）；顶部注释同步。
- **实测**（`npm run e2e:all`，4 并发）：**4/4 通过 · 4m14s**，四个收尾行
  `[e2e] 245/245 通过` / `[v5] 54/54 通过` / `[pwa] 43/43 通过` / `[header] 72/72 通过`。
- 变异：v5 删一条 check → **它自己红**（EXPECT 自检），退出码 1 ✓（数守恒承重）。
- 两轴审查后：pwa 清理顺序修（见工单 01），重跑验证见工单 03。
