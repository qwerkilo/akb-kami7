# 05 · CI / E2E 负载画像

- **Type**: research
- **Status**: resolved
- **Blocked by**: 无

## Question

本地 `e2e:all` ~4.5 分钟、CI 只跑三个快速套件、矩阵套件 nightly：当前 CI 分钟数与反馈延迟的构成是什么？
哪些等待/重复加载/套件矩阵可以合并或分片而不降覆盖？给出成本与风险，不实施。

## Answer

研究资产：`.scratch/perf-load/research/05-ci-e2e-load.md`（实测/推断分列，含 run/job ID 与日志路径）。

- **本地 `e2e:all`**：2026-10-29/30 的 5/5 轮次 3m44–4m21（中位 4m05），2 并发。13:39 轮 4m16 = e2e 2m57 + v5 25s + pwa 54s；first/header 是影子工作，不在关键路径。启动/清理每套件 2–5s，run-all 交接 <1s。
- **CI push**：成功 run 中位 3m35（202–238s）；check job 38s、e2e job 234s 并行；e2e job = setup 28s + 主套件 134s + v5 22s + pwa 49s。失败 run 在主套件 ~125–127s 失败后跳过 v5/pwa（总 ~2m42）；Playwright install 有一次 552s 长尾（run 701s）。
- **nightly**：matrix job 201–226s（header 105s + first 64–68s + setup 27–53s），run 185–230s；cron 18:00 UTC 实际 ~22:00 UTC 才创建（调度延迟 ~4h）。60 分钟 timeout 很宽裕；“runner 慢 10–20×”是陈旧注释，实测 header/first 与本地同量级。
- **最大低风险项**：pwa 字体门 `n>=17` 与当前 warm set 12 条不一致，门恒假，本地/CI 每次白等 30s（pwa 的 61%，push e2e job 的 13%）。修掉：本地 4m16→~3m47，CI 234→~205s。修法应从 warm set 派生或 CSS+首批 + 10–15s 上限，保留离线字体断言。
- **其次**：缓存 Playwright 浏览器（常态 -15s，消除 552s 长尾）；CI 三套件 2 并发试跑（-72s）；主套件 390px 第二组循环实际没切语言（3 次 zh 却标 zh/en/ja），先修覆盖。
- **不建议**：CI 跑全量 `e2e:all`（>2h）、nightly 分片（201s 很便宜）、削减矩阵维度/6 次重排、整体删等待/加重试、CI 3–4 并发。
- **矩阵进 push**：加独立 job 约 +201–226s runner/次、墙钟不变；覆盖优先时才做，且先做 header 36→9 与 first 600ms→`fonts.ready` 把矩阵降到 ~115s。
