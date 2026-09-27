# 09: 二轮 code review 修复（2587f33..HEAD）

**What to build:** 处理二轮 code review（基点 `2587f33`）两轴发现的问题。

**Blocked by:** 08（历史）

**Status:** resolved

- [x] ticket 08 状态收口为 resolved（tracker 约定）
- [x] extras 按团体去重：同团多条记录合并（current 取逻辑或），并补单测（先红后绿）
- [x] 托盘 aria/title 文案抽到 i18n（`slot_remove`，zh/en），消除全角括号硬编码与重复拼接
- [x] 移籍成员卡片 meta 统一走 `yearLeave`（补毕业年份），与结果页显示一致
- [x] 产物纯度测试正则加宽（单字符 `{` `}` `|` `[]`），并以注入方式验证红色能力
- [x] `qa-baseline.md` 测试数勘误、变异复现口径入仓说明、二轮备注

## Comments

2026-09-27：全部修复。验证：`npm test` JS 28 / Python 39 全绿；E2E 28/28 无 JS 报错；纯度注入红证明后恢复；`git status` 干净。

二轮 review 两轴报告要点（存档于本次检查点）：

- Standards：ticket 状态未收口、extras 去重回归、托盘文案越权硬编码、卡片/结果 meta 年份不一致、基线计数漂移。
- Spec：检查点曾就地改写旧记录（本轮起改为追加）；其余声称（12 图刷新、覆盖率 97%、CRAP 0、变异 90.84%）核实通过。
