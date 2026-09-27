# 01: 清空已选（session + 托盘）

**What to build:** 选人页托盘加「清空」按钮：点击后确认，一键清除当前系列的全部已选并作废进行中的对决；空选时按钮禁用；只影响当前系列。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `session.js` 新增 `clearSelection() → bool`（清空 + 作废进行中对决 + 持久化；空时 false）
- [ ] `test/session.test.js` 覆盖：清空后 selected 空且 phase 回 pick、空时 no-op、只清当前系列
- [ ] 托盘「清空」按钮（空时 disabled），确认后生效；i18n `clear_pick`/`clear_confirm`（zh/en）
- [ ] E2E：选 3 人 → 清空（确认）→ 已选 0、开始按钮回到「还差 N 位」

## Comments
