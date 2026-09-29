# PWA（可安装 + 离线）

按分支读，不用整篇读。策略与选型的权威出处是 `docs/adr/0016-pwa.md`，本文件是「要动手改时需要知道的东西」。

## 文件

- `manifest.webmanifest` + `sw.js` + `icons/`（图标由 `python3 scripts/make_icons.py` 生成，产物提交，脚本幂等且逐字节可复现）。
- `sw.js` 只管 SW 生命周期：缓存名、install/activate/fetch 监听器、`networkFirst` / `cacheFirst` 两种取数策略。第一行 `importScripts("sw-cache-rules.js")`。
- `sw-cache-rules.js` 是**缓存分类规则**（纯函数 `classify(req, loc)` + `SHELL_FILES` / `IMG_CAP` / `FONT_CAP` / `FONT_HOSTS`）。放出来是因为 `sw.js` 在模块顶层就注册监听器，node 里 `require` 它会炸——不抽出来，「哪个请求进哪个桶、容量多少」就只能靠 grep 源码确认形状（原来的守卫连 `FONT_CAP` 被删都测不出来）。
- **源码文本守卫是最后手段**：优先写可执行断言；实在只能读源文本时（例如「`app.js` 不得自持步数表副本」），正则必须**锚定目标的形状**（`GUIDE_STEPS\s*=\s*\{`），不要扫全文关键字（`ios:\s*\d` 会把无关的普通数据判成违规）。
- 守卫分工：`test/sw-cache-rules.test.js` 管**规则**（可执行的分类断言 + 清单与盘上双向比对）；`test/pwa-artifact.test.js` 管**产物**（manifest 字段、图标像素、`sw.js` 可编译、install 段里真的有 `self.skipWaiting()`、死协议已删）。

## 缓存策略

| 资源                                                               | 策略                                          | 容量                                                 |
| ------------------------------------------------------------------ | --------------------------------------------- | ---------------------------------------------------- |
| 壳（`index.html` / `style.css` / 根目录 `*.js` / manifest / 图标） | network-first，失败回落缓存                   | 无上限（键固定，约 540KB）                           |
| `img/full` 与 `img/thumb`                                          | cache-first（URL 永不失效），只在浏览时进缓存 | FIFO 600 条（full 与 thumb 共用一栏，约覆盖 300 人） |
| 跨源**字体域**（`fonts.googleapis.com` / `fonts.gstatic.com`）     | cache-first                                   | FIFO 500 条                                          |
| 导航请求                                                           | 走壳那一条                                    | —                                                    |
| 其余一切（同源杂项、非 GET、**非字体域的跨源**）                   | 直连不过缓存                                  | —                                                    |

跨源判定是**白名单**而不是「所有跨源都收」：今天站内只有 Google Fonts 一个跨源源，黑名单与白名单行为相同，但接 CDN 或加一张外部图时黑名单会让字体桶静默变杂物箱。

不需要人工改版本号：壳是 network-first，在线永远拿最新；`VERSION` 只在**换缓存结构**时才需要动。

**改壳文件后同步 `sw.js` 的 `SHELL_FILES`**（新增/删除根目录 `.js`、`style.css`、`index.html`、图标）。漏了会红：`test/pwa-artifact.test.js` 拿清单与盘上文件双向比对。

## 离线要「真的有脸、不变样」的两处预热

- **选中成员时预热 `img/full`**（`app.js` 的 `warmPhotos`）：名册只渲染 thumb、海报读 full，只靠浏览名册会让离线海报没脸。
- **SW 接管后重取字体 CSS + woff2**（`warmFonts`）：首访的字体请求发生在接管之前，不重取就会离线字形变样。按 16 个一批并发预热（逐个 await 要十几秒，期间断网就只预热一半）。

## 更新流程

新 SW 在 `install` 里直接 `skipWaiting()`，页面只在用户点横幅「刷新」时 reload。

- **不自动 reload**：自动刷新会打断进行中的对决（进度虽已自动保存，一次自动跳转仍会毁掉当下的节奏）。
- **waiting 里的 worker 收不到 `postMessage`**：实测「waiting + 发消息叫醒 skipWaiting」这条路在本机环境不可靠（消息发给 active 的能收到），所以改成 install 期就接管。**那条 `message` 死协议已删**（`app.js` 从不发消息），`test/pwa-artifact.test.js` 现在断言 install 段里真的有 `self.skipWaiting()`、且全文不再出现 `skip-waiting`——原来那条「全文含 skipWaiting」的断言被 install 里的调用满足，死协议也算「有」。
- 横幅是 `position: static`，不盖住同样 sticky 的步骤条；代价是用户停在页面下方看不见它——新 SW 已激活，下次自然打开即新版。

## 安装入口与指引文案

- **能力探测决定按钮行为，不决定入口可见性**：入口（页脚）除已装成应用（`navigator.standalone`）外始终显示。`beforeinstallprompt` 只决定「安装」是一键还是改名「怎么装？」——Firefox、macOS Safari、headless、非安全上下文都不触发它，把可见性挂在上面会让入口彻底消失（用户报过「底部没看到安装按钮」）。
- 指引按平台分支渲染（`guidePlatform()` + `GUIDE_STEPS`）——**步数表住在 `i18n.js` 并由 `app.js` 读取**：它是文案元数据（键名 `pwa_<plat>_s<i>` 与步数必须一一对应），住在一起才不会分家。步数：**iOS 4 步、其余（Android / macOS / 其他）各 3 步**——`test/i18n.test.js` 用这张表派生键检查（多一步、缺一步、少一步都会红）。**死键守卫查不到拼出来的键**，缺一个时 `t()` 返回 `undefined`、WebIDL 变成空字符串，指引里会静悄悄多一条空白步骤——`test/i18n.test.js` 的「安装指引的动态键三语齐」就是守这个的。
- 平台事实（改文案时按这份写，写错会让人直接放弃）：

  | 平台                  | 路径                                         | 步数                                       | 备注                      |
  | --------------------- | -------------------------------------------- | ------------------------------------------ | ------------------------- |
  | iOS / iPadOS Safari   | 分享 → 添加到主屏幕 → 添加                   | 4                                          | iPad 的分享按钮在**顶部** |
  | Android Chrome / Edge | 右上菜单 ⋮ → 安装应用 / 添加到主屏幕         | 3                                          |                           |
  | macOS Safari          | 文件 → 添加到程序坞…                         | macOS 14 起是这个名字                      |
  | Firefox 桌面版        | Windows 143+ / Linux：地址栏的 web apps 按钮 | **macOS 版不支持**（同进程 Dock 无法区分） |

- 非安全上下文（http + 局域网 IP、直接打开的本地文件）会补一句「装不了、也不能离线，请用 https 或 127.0.0.1」。
- `file://` 下不注册 SW：`secureCtx = window.isSecureContext && location.protocol !== "file:"`——**别简化成纯 `isSecureContext`**，`file://` 在浏览器里也是安全上下文，只是注册不了 SW。同一个判定也控制「装不了也不能离线」的原因提示（`pwa_insecure`）✓。

## 验离线

**手动**：仓库根 `python3 -m http.server`（`127.0.0.1` 是安全上下文）→ DevTools Application 看 SW 与缓存。

**黑盒**：`/tmp/opencode/e2e-pwa.cjs`（本机临时脚本，**/tmp 不持久**；第二版 `sw.js` 跑在 `/tmp` 副本里，不污染仓库）。要复跑就按它的结构重建：

1. 临时副本目录（壳文件复制过去 + `img` 软链）另起一个 `python3 -m http.server`。
2. `context.setOffline(true)` 后 reload，验证挑人 → 对决 → 出图全程可用。
3. 合成 `beforeinstallprompt` 验一键安装路径；UA 上下文验 iOS / Android / macOS 三个指引分支（`other` 分支目前只有 `test/i18n.test.js` 覆盖键，改平台判断时要手工量一次）。
4. 把副本里的 `sw.js` 的 `VERSION` 改掉再 `registration.update()`，验更新横幅与「点刷新才切」。
5. 钩 `unhandledrejection`——它抓到过一个真 bug（`document.fonts.load()` 取不到字体时 reject，一路冒泡让 `drawPoster()` 整条断掉，海报画布空白且无报错）。

在 `http://<局域网 IP>` 下测是**非安全上下文**（`navigator.serviceWorker` 整个不存在），那不是产品缺陷；要测可安装性用 `127.0.0.1` 或 https。
