# PWA（可安装 + 完全离线）spec

**Status:** ready-for-agent

## Problem

站点是纯静态、无运行时接口的：数据全在 `members.js`（376KB），壳与数据合计约 540KB，图片 85MB。
现状无 `manifest`、无 `sw.js`、无图标链接（标签页是默认地球图标）。这个应用的真实用法是
「地铁上掏出来挑脸」，但断网就打不开；手机上也没有「装到桌面」的入口。

## Solution

加 `manifest.webmanifest` + `sw.js`：可安装、可完整离线（挑人 → 对决 → 出图）。
壳 network-first + 缓存兜底，图片 cache-first + FIFO 封顶 600 条，字体运行时 cache-first。
用户可见部分按 ADR-0016：安装入口放**页脚**（四版原型里选的 D）、更新走顶部非阻塞横幅、
离线用页头小胶囊、iOS 给「分享 → 添加到主屏幕」浮层。图标由 `scripts/make_icons.py` 生成。

## User stories

1. 页脚出现「离线可用？把本站装到桌面」+「安装」+「怎么装？」；只有已装成应用（standalone）时才隐藏。捕获到安装事件时「安装」一键装，否则打开按平台分支的指引浮层（iOS / Android / Mac / 其他）；非安全上下文补一句为什么装不了。
2. 点「安装」触发安装；装完该行变成「已安装到桌面 ✓ 离线可用」，不再重复打扰。
3. iOS / 不支持安装事件的浏览器：「iOS 怎么装？」打开四步浮层（分享 → 添加到主屏幕 → 添加 → 完成）。
4. 断网后打开站点：应用能启动、名册能渲染、能选人、能开始对决、能导出海报（全流程可用）。
5. 断网时已经浏览过（图片已进缓存）的成员仍有照片；没浏览过的显示占位图，不报错。
6. 断网时页头出现「离线中」胶囊；恢复网络后自动消失。
7. 发布新版本后回访：顶部出现非阻塞横幅「有新版本可用，刷新后生效」+「刷新」；点之前不动当前页面（不能打断进行中的对决）。
8. 点「刷新」后加载新版本；不点就不会自动跳。
9. 安装为独立窗口后有图标（192/512/maskable）与启动色（主题粉），标签页有 favicon。
10. 首次访问即把字体预热进缓存（接管后重取 CSS 与 woff2），断网时海报与界面字形不变样。

## Implementation Decisions

- `sw.js`：`SHELL_FILES`（壳 + manifest + 两个图标）`install` 时 `addAll`；`activate` 清理旧缓存并 `clients.claim()`。
  fetch 分三路——导航与壳文件 **network-first**（失败回落缓存）、`img/` **cache-first + FIFO 封顶 600**、跨源字体 **cache-first**；其余直连。
  `message` 收 `{type:"skip-waiting"}` 才 `skipWaiting()`（配合横幅，不自动跳）。不设需要人工维护的 `CACHE_VERSION`。
- `manifest.webmanifest`：`short_name` 系列中立、`display: standalone`、`theme_color #e4007f`、`background_color #f5f1e6`、图标 192/512/maskable512，`start_url`/`scope` 用相对 `./`（GitHub Pages 子路径可用）。
- `app.js`：只在安全上下文（https / localhost / 127.0.0.1）注册 `sw.js`（`{updateViaCache:"none"}` 让新壳及时被发现）；
  `beforeinstallprompt` 捕获后启用页脚安装入口（未捕获则该行只留 iOS 指引）；`registration.waiting || updatefound→installed&&controller` 显示横幅；
  「刷新」`postMessage` + `controllerchange` 后 reload（一次性守卫）；`online/offline` 事件切离线胶囊。
- `i18n.js`：安装入口、iOS 浮层、离线胶囊、更新横幅四组键，zh/en/ja 三语齐。
- `scripts/make_icons.py`（Pillow）：粉色圆角底 + 白色「7」+ 柠檬黄下划线 → `icons/icon-192.png`、`icon-512.png`、`icon-maskable-512.png`（留安全区）、`apple-touch-icon.png`(180)、`favicon-32.png`。
- `meta description` 与 manifest 描述补等爱系列与「推し7」，档位口径保持 **7 / 16 / 40**（ADR-0015 已下线 32）。

## Testing Decisions

- 产物不变量缝（新增 `test/pwa-artifact.test.js`）：manifest 字段齐、每个声明的图标文件存在**且像素尺寸与声明一致**（读 PNG IHDR，无新依赖）；
  `sw.js` 的 `SHELL_FILES` 与盘上壳文件**双向一致**（多一个少一个都红）；`sw.js` 语法可编译。
- E2E（`/tmp/opencode/e2e-pwa.cjs`，不入仓）：SW 注册并激活 → `context.setOffline(true)` 重载 → 应用能启动、选人、开始对决、出图（海报像素探针）；
  看过的成员离线有图 / 没看过的占位；离线胶囊在断网时出现、恢复后消失；安装入口与 iOS 浮层；更新横幅用**临时副本 + 改了版本的 sw.js** 触发（不污染仓库）。
- 现有 E2E / node:test 全绿，不回归。
