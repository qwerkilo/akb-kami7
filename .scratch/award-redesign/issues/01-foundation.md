# 01 · 设计基础：令牌、页头、步骤条、按钮

- **Status**: ready-for-agent
- **Blocked by**: 无
- **缝**：③ 产物守卫（style-artifact）、⑦ E2E

## 内容

- 字阶加入 display 档（标题/大数字），保持正文 16；间距、圆角、阴影、动效令牌按方向重定。
- 页头：classic 纸感（品牌衬线、工具文字化）；sticker 生写（品牌圆体、工具贴纸）。
- 步骤条：01/02/03 + 细线；当前步粉色。
- 按钮族：primary（classic 方角 / sticker 贴纸硬阴影）、ghost、link；focus-visible 统一。

## 验收

`e2e:header` / `e2e:first` 全绿；style-artifact 守卫更新且仍只许减不许增；对比度守卫通过。
