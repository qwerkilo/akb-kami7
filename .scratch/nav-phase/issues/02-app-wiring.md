# 02 app 接线与回归

**Status:** resolved
**Blocked by:** 01

## What to build

`app.js` 收成 `navigate(intent, order?)` + `paint()`：替换 13 处 `view=` 赋值/推导（boot、steps 点击、开始按钮、续玩继续/放弃、对决返回、结果重排/重选、switchSeries、answer/undo 的 advance）；`renderSteps` 消费 `CORE.steps()`；托盘按钮在「有进行中对决」时显示「继续对决」并回续（不再静默重开）。

## Acceptance

- [x] E2E v5：新增「对决进行中托盘按钮 = 继续对决，点击回续到原题号」
- [ ] E2E v5 40/40（其余断言不变）、回归 e2e 62/62（行为不变）
- [ ] `npm test` 全绿
- [ ] `git grep "view = "` 在 app.js 中只剩 `navigate`/`paint` 内部赋值

## Comments

2026-09-28：`app.js` 收成 `navCtx()/paint()/navigate()`；13 处 `view=` 只剩声明、`paint` 兜底与 `navigate` 赋值；`renderSteps` 消费 `CORE.steps()`；托盘按钮在有对决时显示「继续对决」并回续（不再静默重开）。验证：`npm test` JS 92 + Python 77、E2E v5 **42/42**（新增托盘回续断言）、回归 **62/62**。
