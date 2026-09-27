# 01: 清空已选（session + 托盘）

**What to build:** 选人页托盘加「清空」按钮：点击后确认，一键清除当前系列的全部已选并作废进行中的对决；空选时按钮禁用；只影响当前系列。

**Blocked by:** None (can start immediately)

**Status:** resolved

- [x] `session.js` 新增 `clearSelection() → bool`（清空 + 作废进行中对决 + 持久化；空时 false）
- [x] `test/session.test.js` 覆盖：清空后 selected 空且 phase 回 pick、空时 no-op、只清当前系列
- [x] 托盘「清空」按钮（空时 disabled），确认后生效；i18n `clear_pick`/`clear_confirm`（zh/en）
- [x] E2E：选 3 人 → 清空（确认）→ 已选 0、开始按钮回到「还差 N 位」

## Comments

2026-09-27：`session.clearSelection()`（清空已选 + 作废对决 + 持久化，空时 false）；托盘 hint 行右侧加「清空」小胶囊按钮（空时禁用，`confirm` 确认；i18n zh/en）。顺带修了托盘布局：`.slots` 的 `minmax(36px,1fr)` 在窄屏会把格子撑出容器、盖住按钮——改为 `minmax(0,1fr)`（与 `.tray.wide` 的 8 列一致），现 7 格不溢出。验证：`npm test` JS 61 + Python 47、E2E 46/46（新增 3 项清空检查）、托盘截图核对。
