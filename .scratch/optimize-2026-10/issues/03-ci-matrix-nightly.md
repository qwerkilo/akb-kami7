# 03 CI 矩阵套件每晚跑（独立 workflow）

- **Status**: done
- **Blocked by**: 无
- **对应决策**: Q8 = A

## 目标

`.github/workflows/matrix.yml`：`schedule`（每日 18:00 UTC）+ `workflow_dispatch`，
跑 `e2e:header` 与 `e2e:first` 两个矩阵套件；失败即 job 红；**不阻塞 push**。

## 验收

1. workflow 语法合法（本地能解析 YAML），`timeout-minutes` 有上界（≤60）。
2. 两步分开：`npm run e2e:header`、`npm run e2e:first`（挂住时能指认哪一步）。
3. 本地先跑两条命令全绿（header 73/73、first 145/145）再提交。
4. 不自动开 issue、不自动提交产物。

## 风险（如实记）

- 矩阵套件在 runner 上比本地慢 10–20×；首次定时跑的真实时长以 Actions 为准。

## Comments

2026-10-27：落地 `.github/workflows/matrix.yml`（schedule 每日 18:00 UTC + workflow_dispatch，
timeout 60，header/first 两步分开）。YAML 本地解析通过；两条命令本地实测 **header 73/73**、
**first 145/145** ✓。CI 首次定时跑的真实时长以 Actions 为准。
