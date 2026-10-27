# 04 数据养护：每周只读核对上游名册

- **Status**: done
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

## Comments

2026-10-27：落地 `.github/workflows/freshness.yml`（每周一 18:00 UTC + workflow_dispatch，
timeout 30，只读）。两个实现事实：

- `scripts/wiki.py` 的 `AKB_PROXY` 默认指向本机 `127.0.0.1:7897`，runner 上没有 → workflow
  显式 `AKB_PROXY: ""` 走直连。
- **本地真跑发现并修掉一个假阳性**：ja.wikipedia 的 モーニング娘。 表已换用**假名**列，
  而视图是汉字名 → 51 人全被误报「缺 + 多」。`_compare_group` 改为双向「汉字或 kana 命中」
  判等；新增 1 条用例（另 2 条夹具更新），`CheckRosterSmokeTests` 6/6 ✓。
- 本地（`AKB_PROXY=` 直连）**exit 0：无缺口（视图与上游一致）** ✓（21 团）。
- 未验证：48pedia / ja.wikipedia 对 GitHub runner IP 的可达性 —— 以首次定时跑为准。
