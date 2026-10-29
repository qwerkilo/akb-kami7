# 03 · 复制链接 + X 分享串带链接

- **Status**: resolved
- **Blocked by**: 02
- **缝**：⑦ E2E

## 内容

- 结果操作区新增「复制链接」（`#copy-link`）：用当前 ranking + 标题生成 URL，
  `navigator.clipboard.writeText`，成功 toast「已复制」，失败给可操作提示。
- `resultExport().shareUrl` 改为该链接（http(s) 下），X 分享串自动带上。
- i18n 三语：`copy_link` / `copied` / `copy_failed`。

## 验收

E2E：stub 剪贴板 → 点击后拿到含 `?r=` 且 id 顺序正确的链接。

## Comments

2026-10-29 实现：结果操作区「复制链接」写剪贴板并 toast；X 分享串改用同一 `shareLink()`。
E2E 新增 1 条（stub 剪贴板，断言含 `?r=48g-7-` 且 id 顺序正确）；主套件 260/260。
