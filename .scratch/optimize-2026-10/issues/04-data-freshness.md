# 04 数据养护：每周只读核对上游名册

- **Status**: ready
- **Blocked by**: 无
- **对应决策**: Q9 = A

## 目标

`.github/workflows/freshness.yml`：`schedule`（每周一 18:00 UTC）+ `workflow_dispatch`，
跑 `python3 scripts/check_roster.py`（视图级，21 团），只读、失败即红、不写产物。

## 验收

1. workflow 语法合法，`timeout-minutes` 有上界（≤30）。
2. 步骤只读：不 `git commit`、不跑 `fetch_members.py`。
3. 本地尝试真跑一次并记录结果（若上游限流/不可达，如实记「本地未验证，以 CI 首跑为准」）。
4. 退出码语义沿用脚本：0 一致 / 1 缺口 / 2 工具失败。
