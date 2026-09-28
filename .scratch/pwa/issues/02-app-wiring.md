# 02 · app.js 接线：注册 SW、页脚安装入口、iOS 浮层、离线胶囊、更新横幅

**Status:** pending
**Blocked by:** 01

## 范围

- `app.js`：安全上下文判断 → `register("sw.js", {updateViaCache:"none"})`；`beforeinstallprompt` 捕获；
  waiting/updatefound → 更新横幅；「刷新」postMessage + controllerchange 一次性 reload；online/offline → 离线胶囊。
- `index.html`：页脚安装行（`colophon` 内）、iOS 指引浮层、更新横幅容器。
- `i18n.js`：四组新键 zh/en/ja 齐（i18n 键 parity 测试会兜住）。
- `style.css`：四表面的两套皮肤样式（贴纸 + 原版），44px 触摸目标沿用既有约定。

## 验收

- node:test 全绿（键 parity 覆盖新键）。
- E2E：安装入口出现/点击后变「已安装」、iOS 浮层开合、离线胶囊随 setOffline 切换。
- 不影响既有 E2E（86 项 + v5 49 项）。
