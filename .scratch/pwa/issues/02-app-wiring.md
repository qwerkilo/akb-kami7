# 02 · app.js 接线：注册 SW、页脚安装入口、iOS 浮层、离线胶囊、更新横幅

**Status:** resolved
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

## 交付实况

- i18n 13 键 × 三语；`test/i18n.test.js` 的死键守卫在写 app.js 之前先红过一次（`pwa_installed` 无人引用），接线后转绿。
- E2E 抓到并修掉一个**真实缺陷**：首次访问时 `activate` 的 `clients.claim()` 会触发 `controllerchange`，原实现无条件 `location.reload()` → 用户第一次打开就被无意义地刷一次。改为只有用户点过「刷新」才 reload（`pendingReload` 闸门）。
- iOS 指引浮层补了真遮罩（`box-shadow` 挡不住指针点击）；点遮罩与 Esc 都能关，浮层期间纳入 `canDuelInput()` 门控。
