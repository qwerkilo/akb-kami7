# 深化⑱：`sw.js` 的缓存分类规则抽成可断言的 module

来自架构扫描的候选 4（`/tmp/architecture-review-20260929-003318.html`）。四条决策经 grilling 拍板。

## 症状（三条都有实测）

1. **死协议被测试守着**：`sw.js` 的 `message` 监听器等一条 `skip-waiting` 消息，而 `app.js` 从不发消息（改用 install 期直接 `skipWaiting()`）。删掉整条分支，`test/pwa-artifact.test.js` 仍全绿——因为那条守卫是 `src.includes("skipWaiting")`，**被 install 里的 `self.skipWaiting()` 满足了**。断言守错了位置：它给「install 期接管」这个真实机制提供虚假的安全感。
2. **分类规则没有可测的 interface**：fetch handler 里三个 if 分支 + 两个 cap 只能靠 grep 源码确认形状。实测**把 `FONT_CAP` 删掉，三条断言全绿**——ADR-0016 写下来的「字体缓存封顶」没有守卫。
3. **跨源判定是黑名单**：`!sameOrigin` → 字体桶（注释写「字体等跨源资源」，实现是所有跨源）。今天站内只有 Google Fonts 一个跨源源，行为无差别；接 CDN 或加一张外部图，字体桶就静默变杂物箱，而文档说的是「跨源字体」。

## 做法

- 新增 `sw-cache-rules.js`：纯函数 `classify(req, loc)` + `SHELL_FILES` / `SHELL_NAMES` / `IMG_CAP` / `FONT_CAP` / `FONT_HOSTS`。它不碰任何 SW 全局，`sw.js` 第一行 `importScripts` 引入，node 测试直接 `require` 同一份文件。抽出来的原因很实际：**`sw.js` 在模块顶层就注册监听器，node 里 `require` 它会炸**，不抽就没有缝。
- `sw.js` 收成只剩 SW 生命周期：缓存名、install/activate/fetch 监听器、`networkFirst` / `cacheFirst` / `put` / `trim`。fetch handler 变成「问规则，按 kind 选桶」。
- 跨源判定改成**字体域白名单**（`fonts.googleapis.com` + `fonts.gstatic.com`），其余跨源直连。
- 删掉 `message` 死协议；守卫改成断言 **install 段里**有 `self.skipWaiting()`、且全文不再出现 `skip-waiting`。
- 守卫重新分工：`test/sw-cache-rules.test.js`（新增，5 条）管**规则**（可执行的分类断言 + 清单与盘上双向比对）；`test/pwa-artifact.test.js` 管**产物**（manifest、图标、`sw.js` 可编译、install 段、死协议已删）。

## 红回路与判别力

先写 `test/sw-cache-rules.test.js`（实现前红在「Cannot find module」✓），实现后：

| 变异                                 | 结果                       |
| ------------------------------------ | -------------------------- |
| 跨源改回黑名单（`!sameOrigin` 就收） | 红                         |
| 字体桶封顶改为无上限                 | 红（**旧守卫测不出这个**） |
| 图片桶漏掉 `/img/` 前缀              | 红                         |
| 非 GET 也进缓存                      | 红                         |

另外 E2E 的临时副本**当场替我抓到一个真问题**：副本清单是手写的第三份「哪些文件是壳」，新文件没拷进去 → SW 装不上（页面无 controller）。已把副本清单改为从 `SHELL_FILES` 派生（`sw.js` 单独处理，它会被换成第二版触发更新流程）——同一类漂移源的第二次收口。

## 遗留

- 页面侧 `warmFonts` 用 `link[href*="fonts.googleapis.com"]` 选样式表，SW 侧用 `FONT_HOSTS` 白名单：两处需要一起改，靠**注释互指 + 两侧各自的测试**提醒，不靠机制（共用一份要 SW import 页面模块，不划算）。
- `test/sw-cache-rules.test.js` 里「壳文件」表把图标写死成三条，若 manifest 再加图标尺寸，那条测试要跟着改（manifest 那侧已有「声明的图标都在盘上且尺寸一致」覆盖 ✓）。
- 真机（iOS Safari / Android Chrome）仍未验过安装与离线。

## 两轴复审的发现与处理

**守卫层面一处净丢失（已修）**：`test/sw-cache-rules.test.js` 最初把「盘上的图标」写死成三条 ✗——旧守卫是从 `manifest().icons` **派生**的 ✗。实测「manifest 加第 4 个图标而不加进 `SHELL_FILES`」→ 写死版 **143 全绿**，派生版立刻红 ✓。已改回派生 ✓（并实证会红 ✓）。本记录原先写「manifest 侧已有覆盖 ✓」——**那句是错的**，已删。

**新引入的无人守耦合（已修）**：`sw.js` 的 `CACHE_OF[plan.kind]` 缺键时是 TypeError → `respondWith` 从不调用 → 浏览器按「无人处理」直连 → **静默失去缓存** ✗（删掉 `font` 键 143 全绿 ✓）。已加断言：从一批代表请求跑出 `classify` 的 kind 集合，断言 `CACHE_OF` 的键覆盖它 ✓（实证会红 ✓）。

**死代码（已删）**：`test/pwa-artifact.test.js` 的 `shellFiles()` 在清单搬到新文件后没有调用方，而且它 grep 的 `SHELL_FILES = [` 已不在 `sw.js` 里（谁再调用会直接 assert 失败）。

**其它**：`sw.js` 的注释口径对齐 ADR（headless 实测 vs 真实浏览器可行）；导出面去掉无消费方的 `SHELL_NAMES`；`test/pwa-artifact.test.js` 的 install 段正则要求列 0 的 `});`（只会假红不会假绿 ✓ 方向安全）。

**E2E 判别力的真实边界（两轴各自独立实测）**：

- 只有 E2E 能抓：SW 装得上并接管、install/activate 生命周期、`clients.claim`、版本变更→横幅→点刷新才 reload、壳断网兜底、**字体断网不变样**（唯一有判别力的「缓存真落盘」断言，`FONT_HOSTS=[]` → 红 ✓）。
- 只有 node 能抓：分类每条边界、清单↔盘上双向一致、死协议已删、`skipWaiting` 的位置。
- **两者都抓不到**：图片分类与 600 封顶在真实 Cache 层面的行为；`navigate` 断网回落 `index.html`（E2E 断网重载的是 `/`，命中 `./` 而非回落分支 ✗ 既有缺口）。
- **「断网后仍有照片」两条断言的判别力取决于图片有没有在接管后经过 SW**：Standards 轴那轮 `akb-img-v1 = 0`（图片是接管前加载的，离线由浏览器 HTTP 缓存兜住）→ 断言不咬；用 `/tmp/opencode/pwa-cache-probe.cjs`（断网前 CDP 清 HTTP 缓存）跑健康路径 → 照片 16/16 且来自 SW 缓存 ✓。结论：**它是「有时咬、有时不咬」**，所以这项核对单独放在探针里，不塞进主 E2E。

**两处一次修好又撤回的尝试（如实记账）**：曾把 `Network.clearBrowserCache` 塞进主 E2E 的断网前，结果**字体**断言变红（Latin 子集的 Nunito 离线没被应用，h1 宽 160 → 140.3，而 325 个 woff2 全在 `akb-font-v1` 里）。查了三个探针：把量宽的两侧都加上 `await document.fonts.ready`（**真修复，保留**✓）、统计字体缓存按族分布、对比 `wDefault/wZenKaku/wNunito/wSans` 宽度。在 e2e-pwa 那种流程里复现、在 `pwa-cache-probe.cjs` 里**不复现**（两侧 h1 都是 413.5 ✓）→ 判定为**流程相关的度量时序**，不是产品缺陷结论。`Network.clearBrowserCache` 已从主 E2E 撤掉，保留 `document.fonts.ready` 那处健壮性修复 ✓。

## 遗留

- 页面侧 `warmFonts` 用 `link[href*="fonts.googleapis.com"]` 选样式表，SW 侧用 `FONT_HOSTS` 白名单：两处需要一起改，靠**注释互指 + 两侧各自的测试**提醒，不靠机制（共用一份要 SW import 页面模块，不划算）。
- 「只在安全上下文注册 SW」（`app.js` 的 `initPWA`）**仍无任何守卫**（既有缺口，本轮未加剧）。
- `networkFirst` 的「navigate 断网回落 `index.html`」无守卫（既有缺口）。
- 真机（iOS Safari / Android Chrome）仍未验过安装与离线。
