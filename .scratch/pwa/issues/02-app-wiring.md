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
- 复审后补：`markInstalled` 同时改 `data-i18n`（否则切语言会把「已安装」打回默认文案）；安装事件先置空再 `prompt`（真事件二次调用会抛 `InvalidStateError`）；点「刷新」但 `waiting` 已被别的标签页消费时直接刷新（横幅不再卡住）；关闭浮层把焦点还给**真正的触发者**（此前写死回 iOS 按钮，iOS 上是从「安装」进去的）；`sheetOpen` 声明上提到顶部状态块；PWA 按钮触摸目标 44px。
- 复审后补两处产品行为（都是 spec 承诺过的）：选中成员时预热 `img/full`（`warmPhotos()`，否则离线海报没脸）、SW 接管后重取 Google Fonts CSS + woff2（`warmFonts()`，否则首访离线字形变样）。
- **断网 E2E 又逼出一个既有缺陷**：`document.fonts.load()` 取不到字体时 reject → `fontsReady()` → `drawPoster()` 整条断掉 → 海报画布空白且无任何报错。已吞掉该失败（字体没加载出来也要出图，字形退化而已）。
- **更新流程改实现**：原先「waiting + postMessage 叫醒 skipWaiting」实测不可靠（消息发给 waiting 里的 worker 收不到），改为新 SW 在 `install` 里直接 `skipWaiting()`、页面只决定何时 reload。ADR-0016 第 5 条已同步。
