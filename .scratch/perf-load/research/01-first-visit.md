# 01 · 首访真实瀑布与主线程画像

- **Status**: done（测量日 2026-10-30）
- **测量表面**: 本地静态服务器 `127.0.0.1:8123`（与 `e2e/serve.py` 同为 ThreadingHTTPServer + SimpleHTTPRequestHandler；额外把每个响应体字节数写 JSONL，供 SW 预缓存核对）
- **机器**: 8 核 / 15 GB（可用约 3.5 GB）；Node 24.21.0；Chromium 151.0.7922.34（Playwright headless）
- **脚本**: `/tmp/opencode/{serve_log.py, measure-first-visit.cjs, measure-cdp.cjs, trace-first-visit.cjs, probe-*.cjs}`（未进仓库；口径见 Method）

## Question

冷缓存首访（390/1280；zh/en；classic/sticker）实际传输了哪些字节、关键路径多长、主线程被什么占住？
需要按类型（JS/CSS/字体 CSS/woff2/thumb）给出 encoded/decoded 字节、请求数、LCP、长任务与 DOMContentLoaded/load，
并指出「占比最高且无视觉风险」的一到两项。只测量，不改产品代码。

## Method

### 条件与轮次

8 个条件：`{390×844, 1280×900} × {zh, en} × {classic, sticker}`。
每个条件 **新建 browser context**（`browser.newContext()`），页面不复用；每轮换序（第 1 轮正序、第 2 轮逆序）跑两轮，共 16 次页面加载。
条件通过 `addInitScript` 写 `akb-lang` / `akb:skin`（只写偏好，不种存档）。

### 命令

```bash
# 行为与 e2e/serve.py 一致，额外记录每个 GET 的响应体字节数
python3 /tmp/opencode/serve_log.py 8123 /tmp/opencode/server-8123.jsonl /mnt/sdcard/Download/akb-kami7

node /tmp/opencode/measure-first-visit.cjs http://127.0.0.1:8123/ /tmp/opencode/first-visit.json 2
node /tmp/opencode/trace-first-visit.cjs   http://127.0.0.1:8123/ /tmp/opencode/trace.json
```

页面内采集（`addInitScript`，早于任何页面脚本）：

```js
new PerformanceObserver((list) => {
  /* 记录 largest-contentful-paint, buffered:true */
}).observe({ type: "largest-contentful-paint", buffered: true });
new PerformanceObserver((list) => {
  /* 记录 longtask 的 startTime/duration */
}).observe({ type: "longtask", buffered: true });
```

`load` 之后等「资源条目数 1.5 s 无变化（上限 20 s）」，再等 2.5 s（给 SW install 的 shell 预缓存留时间），然后读：
`performance.getEntriesByType("resource")`、navigation timing、LCP、longtask、`document.querySelectorAll("*").length`、`performance.memory`、`document.fonts.status`。

### 字节口径

- **总下载量 = 同源服务器实测（server log，16 次运行恒为 958.5 K / 33 请求） + 外部资源 wire 字节**。同源部分包含 SW install 额外拉的一次 `index.html`。
- 外部 CSS 的 **wire 字节取 `<link>` 那条**（Google 返回压缩体：87,253 B encoded / 341,037 B decoded）；`warmFonts` 的 `fetch()` 命中缓存时，resource timing 会把 `encodedBodySize` 报成解压后的 341,037 B 且 `transferSize=0` —— **这不是第二次下载**，不能累加。
- woff2 在本机 Chromium 的 `transferSize` 恒为 0（review-rules #6 已预警）；用 `encodedBodySize`，并与 `curl` 的 `Content-Length` 对过（例：Nunito 子集 39,128 B 完全一致）。
- 同一 URL 在一次加载里可能出现多条（渲染触发 + `warmFonts` 重复请求）：按 URL 去重；优先取 `transferSize>0` 的那条，否则取 `encodedBodySize` 最大的一条。

### 冷缓存核对

- 同源：16 次运行 server log 都是 33 个请求、每条路径各 1 次（`/` 与 `/index.html` 各一次，后者是 SW install 拉的）—— 每个 context 都真的重新下载。
- 字体：本机 Chromium 会把同一浏览器进程内已取过的字体从内存缓存复用；`Network.dataReceived` 对字体不可靠（全新 browser + `Network.clearBrowserCache` 后仍报 0 字节）。所以 woff2 的数字是**「一组唯一 URL 的体积」**，等价于真实冷访客要下载的量；不把它当成「本次运行实际过网字节」的逐步证据。
- 2/16 次运行在窗口内 **0 个 woff2**（390 en sticker r1、1280 zh classic r2）；随后对这两个条件各重跑 3 次（另加 390 zh classic 4 次）均正常拿到全部字体 —— 是第三方字体请求的瞬时失败，不是代码路径。表中对这两次标注 `字体失败`。

### 主线程归因

CDP `Tracing`（`devtools.timeline,v8,disabled-by-default-devtools.timeline`），取 `CrRendererMain`，窗口 = 最后一次 `navigationStart` 起 5 s，聚合 `ph="X"` 事件的 `dur`。追踪有开销，只用于**占比**，不用于绝对耗时。覆盖 3 个代表条件各 1 次。

### 时间

- 两轮矩阵：2026-10-30 14:03:53 – 14:06:29 UTC。
- trace：约 14:18 UTC；字体失败复测：约 14:25–14:35 UTC。

## Raw numbers

### 1) 首访字节（wire，K；两次运行）

`其他同源` 69 K = 两次 index.html（2×24.9 K，其中一次是 SW install）+ 图标 12.0 K + sw.js/sw-cache-rules 5.9 K + manifest 0.9 K（simplified.js 2.4 K 已计入 JS）。

请求数：同源 33 个 + 外部字体 CSS 2 个 + woff2 10–42 个 = 45–77 个唯一请求；另有最多 16 个重复字体请求命中内存缓存（不计字节）。

| 条件            | 总 wire r1/r2 | JS  | style.css | 字体 CSS | woff2 r1/r2             | thumb | 其他同源 | DCL ms r1/r2 | LCP ms r1/r2 | load ms r1/r2 |
| --------------- | ------------- | --- | --------- | -------- | ----------------------- | ----- | -------- | ------------ | ------------ | ------------- |
| 390 zh classic  | 1448 / 1448   | 639 | 89        | 86       | 403 / 403 (38/38)       | 162   | 69       | 313 / 324    | 376 / 432    | 5557 / 735    |
| 390 zh sticker  | 1440 / 1440   | 639 | 89        | 86       | 395 / 395 (38/38)       | 162   | 69       | 268 / 968    | 708 / 1252   | 10305 / 6656  |
| 390 en classic  | 1183 / 1183   | 639 | 89        | 86       | 139 / 139 (10/10)       | 162   | 69       | 285 / 824    | 344 / 1016   | 5342 / 1143   |
| 390 en sticker  | 1045 / 1202   | 639 | 89        | 86       | `字体失败` / 157 (0/12) | 162   | 69       | 288 / 283    | 700 / 704    | 299 / 20606   |
| 1280 zh classic | 1456 / 1045   | 639 | 89        | 86       | 411 / `字体失败` (39/0) | 162   | 69       | 361 / 595    | 436 / 756    | 5381 / 5674   |
| 1280 zh sticker | 1476 / 1476   | 639 | 89        | 86       | 431 / 431 (42/42)       | 162   | 69       | 283 / 1276   | 588 / 1488   | 6121 / 5622   |
| 1280 en classic | 1196 / 1196   | 639 | 89        | 86       | 151 / 151 (12/12)       | 162   | 69       | 336 / 324    | 520 / 448    | 343 / 478     |
| 1280 en sticker | 1248 / 1248   | 639 | 89        | 86       | 203 / 203 (18/18)       | 162   | 69       | 295 / 253    | 728 / 580    | 691 / 710     |

口径提示：上表是**本机未压缩**传输。`members.js` 等文本在 GitHub Pages 上会被 gzip/brotli；见 Caveats 的 gzip 估算。

按类型占比（用有字体的那一次；zh 34% 字体 / 44% JS / 11% thumb；en 19% 字体 / 54% JS / 14% thumb）：

| 条件                | JS     | 字体（CSS+woff2） | thumb | style.css + 其他 |
| ------------------- | ------ | ----------------- | ----- | ---------------- |
| 390/1280 zh classic | 44%    | 34%               | 11%   | 11%              |
| 390/1280 zh sticker | 43–44% | 33–35%            | 11%   | 11%              |
| 390/1280 en classic | 53–54% | 19–20%            | 14%   | 13%              |
| 390/1280 en sticker | 51–57% | 15–23%            | 14%   | 12–13%           |

字体拆分（唯一 woff2，K）：

| 条件            | woff2 文件 | woff2 总量 | 其中 Zen Kaku | 其中 Nunito | 其中 Dela                  |
| --------------- | ---------- | ---------- | ------------- | ----------- | -------------------------- |
| 390 zh classic  | 38         | 403        | 37 个 / 365   | 1 个 / 38   | 0（≤560 走 serif 栈）      |
| 1280 zh classic | 39         | 411        | 38 个 / 373   | 1 个 / 38   | 0                          |
| 390 en classic  | 10         | 139        | 9 个 / 101    | 1 个 / 38   | 0                          |
| 390 en sticker  | 12         | 157        | 11 个 / 118   | 1 个 / 38   | 0                          |
| 1280 en sticker | 18         | 203        | 17 个 / 165   | 1 个 / 38   | 0（sticker 品牌走 Nunito） |

Dela Gothic One 的 CSS 只有 825 B，但首访没有下载它的 woff2（`/l/font`）：390 classic 的 computed family 是 Hiragino/Yu/Noto Serif 栈，1280 的 woff2 集合里也没有 Dela 文件；sticker 品牌则走 Nunito。也就是说这条字体链路目前只产生一次 825 B 的 CSS —— 留给字体票一起看是否还要保留。

### 2) 同源文件（server log，单次运行，共 958.5 K / 33 请求）

| 文件                      | 字节       | 说明                                       |
| ------------------------- | ---------- | ------------------------------------------ |
| members.js                | 315.5 K    | 全量四系列成员数据                         |
| bios.js                   | 98.9 K     | `requestIdleCallback` 里 `loadBios()` 拉取 |
| style.css                 | 88.9 K     | 未压缩                                     |
| app.js                    | 77.9 K     |                                            |
| i18n.js                   | 50.6 K     | 三语                                       |
| core.js                   | 47.3 K     |                                            |
| poster.js                 | 30.0 K     | 首访不绘制海报                             |
| index.html                | 24.9 K × 2 | 页面导航 `/` + SW install 的 `index.html`  |
| session.js                | 16.1 K     |                                            |
| img/thumb ×16             | 162 K      | 仅展开的第一段（16 人）                    |
| icons ×3 + manifest       | 12.9 K     |                                            |
| sw.js + sw-cache-rules.js | 5.9 K      |                                            |
| simplified.js             | 2.4 K      |                                            |

### 3) 关键路径与长任务

16 次合计的中位数：**DCL 330 ms，LCP 644 ms，load 5,361 ms**。

- DCL 范围 253–1,276 ms；LCP 范围 344–1,488 ms；load 范围 299–20,606 ms。
- LCP 元素：绝大多数是名册缩略图（`IMG`，17,112 px² @390；9,231–14,093 px² @1280），一次是品牌标题 `H2`（23,715 px²）。
- 长任务：每次 1–5 个，合计 119–1,168 ms，单个最大 87–441 ms。
- 典型首屏：`responseStart` 6 ms（本地）、DCL ≈ 0.3 s 时名册已渲染完；LCP 0.35–0.75 s；**load 不是首屏指标**，被 Google Fonts 拖到 5 s 量级（最坏 20.6 s）。

### 4) 主线程归因（trace，窗口 = 导航后 5 s）

| 条件            | 主线程任务合计 | Layout       | ParseHTML | EvaluateScript | UpdateLayoutTree | Paint   | PrePaint | GC 类    |
| --------------- | -------------- | ------------ | --------- | -------------- | ---------------- | ------- | -------- | -------- |
| 390 zh classic  | 665 ms         | 232 ms (35%) | 78 (12%)  | 76 (11%)       | 70 (11%)         | 31 (5%) | 11 (2%)  | ~35 (5%) |
| 1280 zh sticker | 920 ms         | 320 ms (35%) | 90 (10%)  | 88 (10%)       | 34 (4%)          | 60 (7%) | 43 (5%)  | ~55 (6%) |
| 390 en sticker  | 649 ms         | 213 ms (33%) | 93 (14%)  | 88 (14%)       | 44 (7%)          | 32 (5%) | 12 (2%)  | ~33 (5%) |

最长的单个任务都是 **Layout**：390 zh classic 70 ms 处一个 161 ms 的 layout（161 ms 内 Layout 126 ms + style 32 ms）；1280 zh sticker 80 ms 处一个 126 ms 的 layout（Layout 119 ms）。随后是 69–84 ms 的 `ParseHTML`（名册 `innerHTML` 解析）。`EvaluateScript` 9 个脚本合计 76–88 ms，其中 members.js 单脚本约 66–80 ms。

## Findings

1. **JS 是本机未压缩口径下最大的字节类（639 K，43–57%），但它是「假大头」：gzip 后约 161 K。** 单文件最大是 `members.js` 315.5 K（22–27%）；其次是 `bios.js` 98.9 K 和 `poster.js` 30.0 K —— 后两者首访都不需要（bios 只在打开简介卡时用，poster 只在结果页画布用）。真正不可压缩的大头是字体与缩略图。
2. **字体是真实网络上的最大类，也是首访最不稳定的一段。** zh：字体 CSS 86 K + woff2 395–431 K（34% 未压缩；按 gzip 估算约 57%）；en：86 K + 139–203 K（19%；gzip 估算 38%）。zh 要 38–42 个 Zen Kaku 子集，en 只要 9–17 个；同一个 `warmFonts` 还会对同一 URL 发出重复请求（54 次请求 / 38 个唯一 URL），重复请求命中内存缓存、不增加字节，但增加调度。
3. **关键路径（首屏）很短，长尾全在第三方字体。** DCL 中位数 330 ms、LCP 中位数 644 ms；但 load 中位数 5.4 s、最坏 20.6 s —— 一次 19.8 s 的 woff2 响应与 load 同尾（20,606 / 20,703 ms），en classic 还有一次 5.3 s 的字体 CSS。字体 CSS 用 `media="print"` 交换，故不阻塞首屏；代价是**保证一次 FOUT**，字体到达后（本机 5.6–20.7 s）还会触发二次布局（trace 里 5.9 s 处仍有 44–70 ms 任务）。
4. **主线程是「渲染」占住，不是 JS 逻辑占住。** 5 s 内任务总时长 649–920 ms；Layout 33–35%、名册 HTML 解析 10–14%、9 个脚本的 EvaluateScript 9–14%、style/paint 8–15%、GC 约 5%。641 个 DOM 节点的首次 layout 单任务 126–161 ms，是本轮最大的单任务；members.js 的 eval 只有 66–80 ms。优化 DOM/首屏卡片结构的收益大于换 JS 框架或拆搜索。
5. **缩略图已被 lazy 限制住，首访没有 full 图。** 两个视口都只加载展开的第一段 16 张（162 K），`img/full` 0 字节；名册滚动/展开才会继续拉。唯一「同内容重复下载」是 SW install 额外拉的一次 `index.html`（24.9 K）；其余 shell 文件由 HTTP 缓存服务，server log 没有第二次。
6. **第三方字体失败是静默的。** 2/16 次运行在窗口内一个 woff2 都没拿到（页面照常渲染、`warmFonts` 的 `catch(_){}` 不发声）；复测 3/3（390 en sticker）、3/3（1280 zh classic）、4/4（390 zh classic）又都正常。对国内网络（fonts.googleapis.com 不可达）这会变成常态：首访永久 fallback 字体，load 可能挂到超时 —— 这是站点当前最大的可用性风险，而不只是性能问题。

## Options

| 选项                                            | 收益（本机实测 / gzip 估算）                                               | 视觉风险                                                                                                                                         | 改产品代码                                                                                        |
| ----------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| **A. `bios.js` + `poster.js` 延后到真正需要时** | **129 K / 8.9–10.9%**（gzip 约 33 K / 3.8–5.5%）                           | **无**：bios 已有「晚到补画」路径（`openProfile` 里 `loadBios().then(paintProfileRows)`）；poster 只在结果页 `drawPoster` 用，可在进入对决时预取 | 是（app.js 去掉 `warmBios()`；poster 从 `<script>` 改为按需加载）                                 |
| **B. 修 SW install 重复拉 `index.html`**        | **25 K / 1.7–2.1%**（gzip 6.6 K / 0.8–1.1%）                               | **无**                                                                                                                                           | 是（sw.js：把 `./` 的响应同时写入 `./` 与 `index.html` 两个 key，或只 `add("./")` 并改 fallback） |
| C. 降低字体体积（自托管/子集/减字重）           | 489 K zh / 225 K en（34% / 19%；gzip 估算 57% / 38%）—— **真实网络最大项** | **有**：字形覆盖、字重与排版变化，需视觉 A/B；离线承诺要求覆盖全部成员名                                                                         | 是（字体方案；属于 02/06 票的决策）                                                               |
| D. 缩略图 AVIF/尺寸档                           | 162 K（11–14%；gzip 估算 19–27%）                                          | 有（画质），需视觉 A/B                                                                                                                           | 是（图片管线）                                                                                    |
| E. i18n 按语言拆包                              | 34 K / 2.3–2.9%（gzip 约 12 K / 1.4–2%）                                   | 低：切语言多一次请求（需预取或等待）                                                                                                             | 是                                                                                                |
| F. members.js 按系列拆 / 压掉生成文件的缩进     | 拆系列约 87 K（6–7%；gzip 约 15 K）；压缩进 raw 更明显但 gzip 仅省几 K     | 中：切系列要联网、PWA 预缓存要全量                                                                                                               | 是（数据管线/运行时）                                                                             |

**结论（回答「占比最高且无视觉风险」）**：无视觉风险的选项里，A 最大（8.9–10.9% 实测），B 是接近零成本的补充（1.7–2.1%）。但把「占比」放到真实部署（文本压缩后）看，最大项是字体（zh 约 57%）与缩略图（19–27%），二者都带视觉决策，不能算「无风险」—— 这正是 02 字体票与图片票要拍板的部分。

## Caveats

- **本机服务器不压缩**。`members.js` 323 K → `gzip -9` 55.6 K；8 个 JS 合计 654 K → 约 161 K；`style.css` 91 K → 24 K。上表 raw 占比不能直接搬到 GitHub Pages；文中标了「gzip 估算」的比例是按逐文件 `gzip -9` 粗算，未验证 Pages 的实际 brotli 档位。
- **Google Fonts CSS 的 333 K decoded 不是下载量**：两个 `<link>` 合计 encoded 88,078 B（≈86 K）；`warmFonts` 的 `fetch()` 命中缓存时 resource timing 报 333 K/transfer 0。用 86 K。
- **woff2 的 transferSize 在本机 Chromium 恒为 0**；encodedBodySize 与 curl `Content-Length` 一致（抽查 39,128 B）。不要把 transferSize 0 读成「没下载」。
- **2/16 次字体请求全失败**；复测正常。字体数字取「唯一 URL 集合」，不等于每次运行的实际过网字节。
- **第三方网络波动大**：同一台机器同一天，字体 CSS 0.3–5.3 s、单次 woff2 最长 19.8 s；load 的 0.3–20.6 s 主要是这个，不是应用代码。DCL/LCP 也有 2–4 倍波动（review-rules #2 的口径），所以全文给范围与中位数，不给单次值下结论。
- **headless 桌面 Chromium + 本机 CPU**：移动端 CPU 通常慢 3–5 倍，绝对 ms 不能外推；占比与资源集合可以外推。
- **没有测 CLS**；字体 swap 造成的布局位移未量化，只说「5.6–6.4 s 有二次布局任务」。
- **CDP `Network.dataReceived` 对字体不可用**（新 browser + clearBrowserCache 仍报 0），所以没有用它做「实际过网」证据；同源部分以 server log 为准。
- 开始时机器上有两个遗留静态服务器（8798/8799），没有动；本次用 8123，结束后已 kill 自己起的进程。

## Reproduction notes

- 结果 JSON：`/tmp/opencode/first-visit.json`（16 runs）、`/tmp/opencode/trace.json`（3 条 trace）、`/tmp/opencode/server-8123.jsonl`（server log）。
- 关键复现步骤：起 8123 → 跑 `measure-first-visit.cjs` 两轮（正/逆序）→ 用「按 URL 去重 + 同源 server log + 外部 wire」汇总；trace 只跑 3 个代表条件。
- 运行顺序、时间与条件都写在 Method / 时间节；换机器复现时先看 `docs/reviews/review-rules.md` #2/#6 的同条件要求。
