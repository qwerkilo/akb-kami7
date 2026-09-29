# 02-screening-ui · 筛选页 UI + 文案

- **Status**: resolved
- **所属 spec**：`.scratch/screening-flow/spec.md`
- **依据**：`docs/adr/0019-screening-then-rank.md`

## 阻塞

- 阻塞于 `01`

## 内容

一屏清单、留/划掉、至少留 N 人；i18n 新键与改写；E2E

## 涉及缝

- 见 spec「测试」节

## 备注

- session 侧状态

## 完成记录

- `index.html` 加 `#phase-screen`（标题 + 说明 + 列表 + 粘底操作条 ✓）；`app.js` 加
  `renderScreen()` ✓、`show()` 认 `screen` ✓、`navCtx()` 带 `kept` ✓、
  开始按钮 → `navigate("screen")` ✓、提交 → `navigate("rank", order)` ✓。
- **文案 7 键 × 3 语**：`screen_title` / `screen_intro(n)` / `screen_keep` / `screen_cut` /
  `screen_min(n)` / `screen_reset` / `screen_go` ✓。提交按钮复用 `start_est(n)`
  （「开始排序（约 14 题）」✓）→ **`screen_submit` 成了死键，已从三语删掉** ✓（死键守卫
  逼出来的 ✓）。`picked_full` 三语同步（「下一步先筛一遍」✓）。
- **一处我自己改出来的真回归（E2E 抓的）**：开始按钮直接 `navigate("screen")` → 对决进行中
  点托盘按钮会跳去筛选而不是续上 ✓。已修：有 `snap.duel` 走 `resume` ✓ ✓。
- 三处 E2E 脚本都要跟着改（流程多了一步 ✓）：`e2e.cjs` 加 `passScreening()` 助手并接到
  各流程 ✓（+6 条筛选断言 ✓，95 → 101 ✓）；`e2e-v5.cjs` 的「开始按钮含约 14 题」改成
  「开始按钮带去筛选」+「筛选提交按钮含约 14 题」（题数提示搬到了筛选页 ✓）；`e2e-pwa.cjs`
  断网流程补筛选步 ✓（+1 条 ✓，42 → 43 ✓）。
- i18n 测试加严：每个筛选键**三语互异** ✓ + **语言标记**断言（zh 汉字 ✓、ja 假名 ✓、
  en 不含汉字假名 ✓）。原先只比「不相等」时，把 ja 换成一句**更短的中文照样不相等** ✓ →
  抓不到 ✓（3 个变异实证 ✓）。
- **一处等价变异（如实记账）**：提交按钮的 `canSubmit` 二次校验删掉仍全绿 ✓ —— 因为按钮
  本身已 `disabled` ✓，用户点不到 ✓ → 等价变异 ✓，保留这层防御但不计入「变异全红」✓。
- 验证：`npm test` JS **187** + Python **114**；E2E **101/101**、v5 **50/50**、PWA **43/43** ✓。
