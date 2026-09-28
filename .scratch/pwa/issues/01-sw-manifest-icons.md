# 01 · manifest + sw.js + 图标（含清单不变量）

**Status:** in-progress
**Blocked by:** 无

## 范围

- `scripts/make_icons.py`（Pillow）：`icons/icon-192.png`、`icon-512.png`、`icon-maskable-512.png`、
  `icons/apple-touch-icon.png`(180)、`favicon-32.png`。
- `manifest.webmanifest` + `index.html` 里的 `<link rel="manifest">`、`<link rel="icon">`、`apple-touch-icon`、`theme-color`。
- `sw.js`：按 ADR-0016 的三路 fetch + 600 条封顶 + skip-waiting 消息。
- `test/pwa-artifact.test.js`（红→绿）。
- 顺带修 `meta description` 的 40 → 32。

## 验收

- `npm test` 全绿且新测试先红过（人为删一个图标 / 从 SHELL_FILES 里删一行 → 必须红）。
- `python3 -c "from PIL import Image"` 生成脚本可重复执行，产物字节稳定（同样输入同样输出）。
- 浏览器 `/sw.js` 返回 200 且 `navigator.serviceWorker` 注册得上（E2E 在 03）。
