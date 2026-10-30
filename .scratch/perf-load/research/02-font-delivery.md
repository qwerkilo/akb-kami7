# 02 · 字体交付面：Zen CSS 88KB 与「48 个 woff2」

- **Status**: done（测量日 2026-10-30）
- **测量表面**: 本机 curl（Chrome 131 UA）拉 Google Fonts CSS + HEAD 全部 woff2；一次 390×844 / zh / classic 的 headless 探针（Chromium 151，`python3 e2e/serve.py 8124` 托管，非 E2E 套件）读计算样式与 `document.fonts`
- **脚本/数据**: `/tmp/opencode/font02/`（CSS、`faces.json`、`sizes.json`、`probe4.cjs`、`probe4.json`）
- **上游测量**: `.scratch/perf-load/research/01-first-visit.md`（下称 01）

## Question

Google Fonts 的两条 CSS 实际交付了什么？首访预热 48 个 woff2 的选择口径与总量是多少？
哪些 face 实际渲染不到？保持现状 / 自托管+子集化 / 只拆分按需加载 CSS 三种方案的成本、收益、视觉与离线一致性、许可与维护成本各是什么？
是否存在「不改视觉」的立即可做项？不实施，只研究。

## Method

1. 读 `index.html` 的字体 `<link>`、`style.css` 的字体令牌与两套皮肤覆盖、`test/fonts.test.js`、`core.js` 的 `fontRange/faceCovers/faceFamily/faceWeightRange/weightDistance/warmUrls`、`app.js` 的 `fontUsages/warmFonts/fontsReady`、01 报告。
2. 用 Chrome 131 UA `curl --compressed` 拉两条 CSS（`size_download` = encoded，`wc -c` = decoded），解析 `@font-face` 的 family/weight/unicode-range/url。
3. 对 CSS 里 368 个唯一 woff2 URL 发 HEAD 取 `Content-Length`（4 个 DNS 抖动重试；与 01 抽查的 Nunito 39,128 B 一致），按权重汇总。
4. 用 Google Fonts `text=` 端点测「合并子集」的成本：100 / 400 / 601 / 800 / 817 字符、101 个拉丁字符、34 个品牌字符；同一方法测 Dela 的 `text=` 与全量。
5. 用 Node `vm` 读 `members.js` / `i18n.js` 统计唯一字符（不写文件）。
6. 一次 headless 探针复刻 `fontUsages` 口径：按 computed `font-family|font-weight` 分组可见叶子文本，读 `document.fonts` 的 `status` 判断「真正被绘制」的 face；与 01 的 38 个 URL 对照。
7. 许可：从 `google/fonts` 仓库取三份 `OFL.txt`（经 `gh-proxy.com`），查版权行有无 Reserved Font Name。

## Raw numbers

### 1) 两条 CSS 的交付面

| 项                   | Dela（带 `text=`）                       | Zen + Nunito（正文）                                            |
| -------------------- | ---------------------------------------- | --------------------------------------------------------------- |
| encoded（wire）      | **825 B**                                | **87,244 B**                                                    |
| decoded              | 1,292 B                                  | 341,037 B                                                       |
| `@font-face` 数      | 1                                        | **373**                                                         |
| 其中 Zen             | 0                                        | 363（121 个 unicode-range 子集 × 500/700/900）                  |
| 其中 Nunito          | 0                                        | 10（5 个子集 × 800/900，**两档共用同一批 5 个 URL**，可变字体） |
| 唯一 woff2 URL       | 1（`/l/font?kit=…`，不是 `.woff2` 后缀） | 368                                                             |
| 字体总字节（若全下） | **12,812 B**                             | 4,362,488 B（Zen 4,224,972 + Nunito 137,516）                   |
| `font-display`       | swap                                     | swap                                                            |

- Zen 每个权重 121 个 face、约 1.4 MB：500 = 1,408,144 B；700 = 1,418,228 B；900 = 1,398,600 B。
- 单个 Zen 子集中位数约 9.9 KB（min 924 / max 23,916）；121 个子集共覆盖 17,484 个码点（平均约 145 字/子集），但按频率切分使得少量字符也能命中很多子集：23 个 UI CJK 字符命中 15 个子集，16 个名字的 55 个字符命中 29 个子集。
- Dela **全量**（不带 `text=`）是 123 个 face / 115,011 B decoded / 30,387 B wire / **1,517,756 B** 字体；现有 `text=` 把 CSS 压到 825 B、字体压到 12,812 B（−99.2%），是已做过的一次正确优化。

拆分测得的 CSS（Chrome 131 UA）：

| 请求                          |       wire | decoded | faces |
| ----------------------------- | ---------: | ------: | ----: |
| `Zen:wght@700`                |     28,953 | 112,465 |   121 |
| `Zen:wght@900`                |     28,953 | 112,465 |   121 |
| `Zen:wght@500`                |     28,955 | 112,465 |   121 |
| `Zen:wght@700;900`            | **57,924** | 224,930 |   242 |
| `Nunito:wght@800;900`         |        632 |   4,168 |    10 |
| 现有合并（Zen 3 档 + Nunito） | **87,244** | 341,037 |   373 |

> 只拆不删权重没有收益：三个单档之和 + Nunito = 87,493 B，比合并的 87,244 B 还多 249 B（gzip 失去了三份相同 unicode-range 列表的跨权重冗余）。
> **删掉 500 档**才省：58,556 B（700;900 + Nunito）− 87,244 = **−28,688 B（−32.9%）**；把 500 换成 400 B 的品牌 `text=` CSS 后是 58,956 B，仍省 **28,288 B（−32.4%）**。

### 2) 字体令牌与实际使用（计算样式）

`style.css:2-18` 的令牌：

- `--font-ui` = PingFang SC / Hiragino Sans GB / Microsoft YaHei / Noto Sans SC / sans-serif（**系统字体**）
- `--font-jp` = Zen Kaku Gothic New / Hiragino Sans / Yu Gothic / Meiryo / `--font-ui`
- `--font-display` = Dela Gothic One / Zen / `--font-ui`
- `--font-round` = Nunito / `--font-jp`
- `--font-serif` = Hiragino Mincho ProN / Yu Mincho / Noto Serif CJK SC / Noto Serif JP / serif（**系统字体**）

390×844 / zh / classic 探针（`document.fonts` 与 computed style）：

| 元素                              | computed family                                                    | weight  | 说明                                             |
| --------------------------------- | ------------------------------------------------------------------ | ------- | ------------------------------------------------ |
| `.card .nm`（名册名字）           | PingFang SC（`--font-ui`）                                         | 600     | `style.css:2720` classic 覆盖；**不用 Zen**      |
| `.card .nm`（sticker）            | `--font-serif`                                                     | 700     | `style.css:3191`；**不用 Zen**                   |
| `.gen-name` / `.grp-name`（段名） | classic `--font-ui` 600 / `--font-serif`；sticker `--font-serif`   | 600/700 | 均不用 Zen                                       |
| `.kami`（品牌）                   | classic `--font-serif` 700；sticker `--font-round` 400             | 700/400 | classic 不用 Dela/Zen；sticker 的 CJK 落 Zen 500 |
| `.kami + .sub`（副标题）          | classic `--font-ui` 500（390 下 `rects=0`，隐藏）；sticker Zen 700 | 500/700 | 仅 sticker 用 Zen 700                            |
| `.fighter .nm`（对决名字）        | Zen 900                                                            | 900     | 两个皮肤都用 Zen 900（只在 duel 相位）           |
| 海报                              | classic `--font-poster(-name)` = serif；sticker = Dela / Zen       | —       | 只有 sticker 海报用 Dela 标题 + Zen 名字         |
| `.pwa-sheet h3`（安装指引标题）   | Dela                                                               | 400     | 只在打开安装浮层时可见                           |

**结论：名册里的成员名在两套皮肤下都不是 Zen，而是系统字体。** 01 的选项 C 里「离线承诺要求覆盖全部成员名」这句对名册不成立；Zen 的动态字符只出现在 **duel 名字**（900）与 **sticker 海报名字**（700），以及用户输入的海报标题的回退链。

那么首访的 Zen 到底在画什么？探针给出的可见 Zen 文本只有两组：

- 600 档：`神716人版圈内 40`（尺寸选择器 / 品牌按钮）
- 800 档：`知道了0/7全部现役已毕业清空还差 位怎么装？`（按钮、筛选 chip、环形进度）

这些元素都是 `--font-round`（Nunito 在前）：拉丁/数字由 Nunito 画，CJK 落到 Zen。**首访的 Zen 成本不是成员名，而是约 22 个中文 UI 字符。**

`document.fonts` 状态（同一个探针）：

| 字族           | 已加载（= 真正绘制） | 未加载（仅被预热） |
| -------------- | -------------------: | -----------------: |
| Zen 900        |                   11 |                110 |
| Zen 700        |                    4 |                117 |
| Zen 500        |                **0** |                121 |
| Nunito 800/900 |                    1 |                  9 |

同一次加载的资源里有 38 个字体 URL（与 01 的 38/38 一致），但 **只有 15 个 Zen face 被真正绘制**（700×4 + 900×11），**500 一个都没画**。

### 3) 首访预热的实际数字（01 + 本次复算）

01 的实测（唯一 URL 集合，含 wire 字节）：

| 条件            | woff2 文件 | woff2 总量 |   其中 500 |     其中 700 |     其中 900 |     Nunito |
| --------------- | ---------: | ---------: | ---------: | -----------: | -----------: | ---------: |
| 390 zh classic  |         38 |      403 K | 7 / 67.5 K | 16 / 159.5 K | 14 / 138.1 K | 1 / 38.2 K |
| 390 zh sticker  |         38 |      395 K | 3 / 23.5 K | 17 / 167.7 K | 17 / 165.8 K | 1 / 38.2 K |
| 1280 zh sticker |         42 |      431 K | 3 / 23.5 K | 19 / 185.4 K | 19 / 183.5 K | 1 / 38.2 K |
| 390 en classic  |         10 |      139 K | 3 / 33.9 K |   3 / 33.7 K |   3 / 32.9 K | 1 / 38.2 K |
| 1280 en sticker |         18 |      203 K | 3 / 33.9 K |   7 / 65.8 K |   7 / 65.1 K | 1 / 38.2 K |

- **「48 个 / 0.48 MB」没有复现**：zh 是 38–42 个 / 395–431 K，en 是 10–18 个 / 139–203 K。48 更可能是旧口径或估算；01 的 38/38 与本次探针的 38 个 URL 完全一致。
- 01 的 en 数字偏小是**真实差异，不是缓存假象**（我最初怀疑是跨轮字体内存缓存）：en 的 UI 文案是拉丁字母，Nunito 自己就能画，Zen 只需要拉丁/kana 几个 face；zh 的中文下拉到 Zen，才拉 14–19 个 CJK 子集。01 的 en 500 档 33.9 K 按同一逻辑也只是被预热、没有绘制（en 品牌是拉丁，500 没有可见用途）。
- 01 的字体 CSS 86 K + woff2 数字与本次一致（本机 curl 87,244 B vs 01 87,253 B，差 9 B 是 UA/压缩档位噪声）。

### 4) `warmFonts` 的选择口径（以及两个 bug）

`app.js:1991-2017`：逐个字体 `<link>` `fetch` CSS → `CORE.warmUrls(css, fontUsages(document))` → 每 16 个一批 `fetch`。`fontUsages`（`app.js:1962-1989`）把每个可见叶子元素的 **computed family 列表里的每一个 family** 都记上这段文本的字符，按 `family|weight` 分组。

`core.js:1355-1382` 对每个 usage：取同 family 的 faces，算权重距离最小值，把所有「距离等于最小值且 unicode-range 命中任一字符」的 face 都加入。这里有两个与 CSS 规范不一致的地方：

1. **权重平局全部保留**。Zen 只有 500/700/900 三个单值 face；页面上的 weight 是 600 和 800：
   - 600：到 500 与 700 的距离都是 100 → 同时选 500 和 700；
   - 800：到 700 与 900 的距离都是 100 → 同时选 700 和 900。
     CSS Fonts 4 §5.2 的匹配规则是：目标 > 500 时先向上找最近的更大权重。所以 600 应选 **700**，800 应选 **900**，500 在 classic 根本不会被选。实际预热却把三档全拉了。
2. **每个 family 都拿到全部字符**。`--font-round` 的拉丁/数字本来由 Nunito 画，但字符同时被记到 Zen 上 → Zen 的 `latin`（约 9.6 K/档）和数字子集被预热，实际不绘制（`document.fonts` 里 Zen 的 `latin` 是未加载）。

探针把这两点量化了（390 zh classic）：

- 当前预热：37 个 Zen face / 365 K；真正绘制：15 个 / **142 K**（按同一批 URL 的 `encodedBodySize` 求和）。
- 按「CSS 平局规则 + 第一个能覆盖的 family」修正后：**15 个 / 142 K**，正好等于浏览器自己画的集合。
- **多预热了 22 个 face / 约 223 K（61%）**，其中 500 档 67.5 K 是纯浪费（classic 一个都不画）。

这也是 01 的「38 个 / 403 K」与「主线程/首屏其实 0.3–0.6 s 就好了」并不矛盾的原因：字体大头是预热出来的，不是渲染刚需。

### 5) 字符集与「合并子集」的成本

成员数据：1,544 人 / 125 个 group（`members.js`）。

| 字符集                         |       唯一字符 |                 其中 CJK |
| ------------------------------ | -------------: | -----------------------: |
| 全部 `name`+`kana`+`nick`      |            834 |                        — |
| 名字 + 期生 label + 三语副标题 |            876 |                  **817** |
| 名字 + 全部 i18n（zh/en/ja）   |              — | **1,401**（union 1,502） |
| i18n zh / en / ja              | 407 / 90 / 364 |            344 / 0 / 303 |

Google `text=` 合并子集的实测（同一字体、同一 UA）：

| 请求                 |                   字符数 | CSS wire |         woff2 |
| -------------------- | -----------------------: | -------: | ------------: |
| Zen 700 `text=`      |                      100 |    901 B |      16,164 B |
| Zen 700 `text=`      |                      400 |  2,530 B |      54,936 B |
| Zen 700 `text=`      |                      601 |  3,826 B |      57,744 B |
| Zen 700 `text=`      |                      800 |  4,744 B |     111,080 B |
| Zen 700 `text=`      | 817（名字+label+副标题） |        — | **114,596 B** |
| Zen 700 `text=`      |         101（拉丁/数字） |    494 B |       6,248 B |
| Zen 700 `text=`      |        24（首访可见 UI） |    415 B |   **3,580 B** |
| Zen 900 `text=`      |        24（首访可见 UI） |    417 B |   **3,552 B** |
| Zen 500 `text=`      |         34（全部品牌串） |    400 B |   **3,868 B** |
| Nunito 800 `text=`   |                      101 |    479 B |       8,908 B |
| Dela `text=`（现有） |                76 ranges |    825 B |      12,812 B |

关键对比：**首访真正要画的 23 个 CJK 字符（共 24 个字符，含 1 个全角问号），合并子集只要 7.1 K（700 + 900 两档合计）；按 Google 121 个 unicode-range 切片却要 142 K。** 差 20 倍，全部是每个切片约 10 K 的固定开销（表结构/字形表），不是字形本身。

### 6) 许可（OFL）

三份 `OFL.txt` 都是 SIL Open Font License 1.1：

- Zen Kaku Gothic New：`Copyright 2022 The Zen Kaku Gothic Project Authors`
- Dela Gothic One：`Copyright 2020 The Dela Gothic Project Authors`
- Nunito：`Copyright 2014 The Nunito Project Authors`

三份版权行都**没有** `with Reserved Font Name`（grep `with reserved` 无命中）。OFL 允许修改/子集化与自托管，要求随附 OFL 与版权声明、不得单独售卖字体。子集化属于修改，允许；没有 RFN 就没有改名义务。Google Fonts 的 CSS API 只是分发通道，字体本身是 OFL，拿到 woff2 后自托管不依赖 Google 的 API 条款。

## Findings

1. **交付面比票面小，但票面的「48 个 / 0.48 MB」不准**：CSS 是 87.2 K wire / 341 K decoded、373 个 face（Zen 363 + Nunito 10）+ Dela 1 个；首访 zh 是 38–42 个 / 395–431 K，en 10–18 个 / 139–203 K。全量 Zen（3 档）是 4.03 MiB，但永远不会全下。

2. **Zen 不是名册名字的字体**。classic 的 `.card .nm` 是 `--font-ui` 600（PingFang 等），sticker 是 `--font-serif`；段名同理。Zen 在首访只画约 22 个中文 UI 字符（`--font-round` 元素里 Nunito 画不了的 CJK），动态 Zen 只出现在 duel 名字（900）和 sticker 海报名字（700）。因此「按成员名子集化」对首访不是正确轴；首访的正确轴是 **UI 字符集**。

3. **首访字体的大头是预热浪费，不是渲染刚需**。390 zh classic 真正绘制 15 个 Zen face / 142 K；预热拉了 37 个 / 365 K。两个原因都在 `warmUrls`：权重平局把 500/700 和 700/900 都保留（CSS 只会选 700/900），以及把 Nunito 能画的拉丁/数字也算到 Zen 上。两处修正后首访 woff2 可到 **约 142 K + Nunito 38 K = 180 K**（−55%），视觉零变化。

4. **500 档在 classic 是纯预热**（`document.fonts` 0 个 loaded，67.5 K）。它只在 sticker 品牌 CJK（神/选拔组/圈内/福/推し…）与 `--font-round` 的 600 档上被选中；把 500 从主 CSS 拆成一个 `text=<全部品牌串>` 的小链接（400 B CSS + 3.9 K woff2）可以保持所有品牌串的视觉不变，同时把主 CSS 从 87.2 K 降到 **58.6 K（−32.9%；含 500 品牌 CSS 400 B 时 59.0 K）**，并消掉 67.5 K 的 500 预热。

5. **Dela 首访完全不需要**：classic 品牌是 serif，sticker 品牌是 Nunito；Dela 只用于安装浮层标题与 sticker 海报标题。现有 825 B 的 CSS 首访可以延后到打开安装浮层/进入 result 时再注入，字体 12.8 K 也一起延后。这是零视觉变化的 825 B + 一次第三方请求。

6. **`media="print"` + `onload` 的副作用是「保证一次 FOUT + 拖 load」**：CSS 不阻塞首屏（01 的 DCL 330 ms / LCP 644 ms 中位数），但 88 K 的样式表仍在 load 依赖集里，01 的 load 中位数 5.4 s、最坏 20.6 s 主要来自字体链路。改成 `preload`/load 后注入可以把 `load` 提前，但字体应用时间不变；不是视觉修复，是测试/长尾修复。

7. **自托管（B）的价值主要是可用性与离线确定性，不是首访字节**。首访 UI 子集只要 60–150 K（看字符集取多宽），与修正后的 A（约 238 K）同量级或更小；但 B 没有 fonts.googleapis.com 依赖（01 的 2/16 失败、国内不可达），且能保证离线时 duel 名字/sticker 海报名字不会静默回退。代价是生成器 + 提交产物 + 覆盖测试；全量名字子集（817 CJK × 700/900）约 229 K，若要把离线 duel/海报也做到确定性，B 总量约 290–380 K。

8. **只拆 CSS（C）的纯收益是约 29 K**：拆 500 后 58.6 K；只拆不删是 0 收益（三档分开 87.5 K ≈ 合并 87.2 K）。真正的大收益要「eager UI `text=` 子集 + 懒加载全量 700/900」：首访可到 50–75 K，但需要维护 eager 字符集、改 `test/fonts.test.js` 的「正文不能带 text=」守卫，并在进入 duel/result 时懒加载全量 CSS——这是设计改动，不是零风险。

## Options

### A. 保持现状

| 维度         | 结论                                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 预计字节     | zh 首访 86 K CSS + 395–431 K woff2 ≈ **481–517 K**（占未压缩 total 33–35%，01）；en 225–289 K（19–23%）；回访 0（SW/HTTP 缓存）                    |
| 视觉一致性   | 当前基线；首访保证一次 FOUT（`display=swap` + `media=print`）                                                                                      |
| 离线一致性   | 只缓存「这次首访拉过的」子集。名册名字是系统字体，不受影响；**duel 名字与 sticker 海报名字**离线可能落到系统字体；用户输入的海报标题离线也可能回退 |
| 许可         | Google Fonts 托管，OFL；无需自备许可文件                                                                                                           |
| 维护成本     | 0；但第三方故障是静默的（01 的 2/16，`catch(_){}`），国内网络会永久 fallback                                                                       |
| 是否需改代码 | 否                                                                                                                                                 |

### B. 自托管 + 子集化（OFL）

分两档，因为「首访 UI」和「离线 duel/海报名字」是不同的字符集：

| 变体                   | 内容                                                                                                                                               |                                                                                                                        预计静态字节 | 视觉                                                                                                        | 离线                                                                  | 维护                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------: | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **B0 · UI 子集**       | Zen 700/900 各一个 `text=<Zen 实际绘制的 UI 字符>` woff2 + Zen 500 品牌子集 + Nunito latin（39 K）+ Dela 品牌子集（12.8 K）+ 自写 `@font-face` CSS | **约 60–150 K**（首访可见 24 字 → 7 K + Nunito 39 K + Dela 13 K + 品牌 4 K ≈ 63 K；全相位/三语安全集 300 字 → 80 K + 56 K ≈ 136 K） | 覆盖到的字形与现在逐像素同（同一字体文件、同一 weight）；未覆盖的 duel/海报名字回退系统（名册本来就用系统） | UI 完全离线；duel/海报名字需懒加载或接受系统回退                      | 需一个 `fonttools` 生成脚本 + 提交 woff2/CSS/OFL；i18n 改字或成员改名要重跑；加覆盖测试（像 Dela 的 `requiredChars()`） |
| **B1 · B0 + 全量名字** | 再加 Zen 700/900 的 817 CJK 名字子集（各 114.6 K）                                                                                                 |                                                                                                                    **约 290–380 K** | duel 名字与 sticker 海报名字也确定                                                                          | **名字/UI 离线一致**（四系列 1,544 人）；任意标题字仍回退，与今天相同 | 同上，且每次成员数据变更都要重生成；产物进 SW `SHELL_FILES`/缓存预算                                                    |

- **许可**：OFL 1.1 允许子集化与自托管；三份版权行无 Reserved Font Name；随附 `OFL.txt` 与版权行，不单独售卖字体即可。建议把三份 OFL 放进 `fonts/` 并在页脚/仓库注明。
- **视觉风险**：同一字体文件子集化不改轮廓与 metrics，但 hinting/表重排可能带来亚像素差；需要一次视觉 A/B（截图对比 + `document.fonts.check`）。用户海报标题是任意字符，Dela/Zen 子集都不可能全覆盖；classic 海报用系统 serif 本来就没问题，sticker 海报的任意字仍会回退（与今天离线行为相同）。
- **是否需改代码**：是（`index.html` 字体链接、`sw-cache-rules.js` 的 `SHELL_FILES`/`FONT_HOSTS`、`test/fonts.test.js`、`sw.js` 预缓存、可能的 `warmFonts` 简化）。不加运行时构建步骤，产物像 `members.js` 一样提交。

### C. 只拆分 / 按需加载 CSS（继续用 Google Fonts）

| 子项                                                                                   | 收益                                                                                                                                                                                                          | 风险                                                                                                                                                      | 改代码                                |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **C1 · 500 拆成 `text=<品牌串>` 小链接**                                               | 主 CSS 87.2 K → 58.6 K（−28.7 K；含品牌 CSS 400 B 为 59.0 K）；500 的预热/绘制 67.5 K → **3.9 K**（classic 只预热、浏览器不画；sticker 真正画）；所有品牌串（zh/en/ja × 4 系列 × 7/16/40，34 个字符）视觉不变 | 需要把 `test/fonts.test.js` 的 `requiredChars()` 复用为品牌子集守卫；未来新品牌串漏字会红（这是好事）                                                     | 是（`index.html` + 测试）             |
| **C2 · Dela CSS 延后**                                                                 | −825 B + 一次第三方请求；首访本来就不下 Dela 字体                                                                                                                                                             | 安装浮层/进入 result 前要注入；`fontsReady()` 之前要保证 Dela CSS 已在                                                                                    | 是（`index.html` + `app.js`）         |
| **C3 · `warmUrls` 平局规则 + 首覆盖 family**（代码修复，不是 CSS 拆分，但和 C 一起做） | 首访 zh Zen 365 K → 142 K（−223 K，−61%）；视觉零变化（只是不再预热 CSS 永远不会选的 face）                                                                                                                   | 需要改 `core.js` 并加 fixture 测试；会失去「切 sticker 离线时 500 品牌已缓存」的偶然保险 → 用 C1 的 3.9 K 品牌子集补回                                    | 是（`core.js` + `test/core.test.js`） |
| **C4 · eager UI `text=` + 懒加载全量 700/900**                                         | 首访 50–75 K（CSS 1–2 K + UI 字体 7–35 K + Nunito 39 K），比 A 少约 85%                                                                                                                                       | 要维护 eager 字符集（跨相位/三语），要改「正文不能带 text=」守卫，要为 duel/result 加懒加载全量 CSS 的路径；进入 duel 时可能有一次 FOUT；测试覆盖成本最高 | 是（较大）                            |

**C 的结论**：C1 + C2 + C3 是「不改视觉」的组合，zh 首访从约 490 K 降到约 **238 K（−51%）**：

```
现状            87.2 K CSS + 365 K Zen + 38 K Nunito = 490 K
C3 预热修正     87.2        + 142       + 38          = 267 K
C1 删 500 档    59.0        + 142       + 38          = 239 K
C2 延后 Dela    −0.8 K                                 ≈ 238 K
```

（C1 的 3.9 K 品牌子集在 classic 会被 `warmFonts` 预热、但浏览器不绘制；sticker 会真正绘制。两者都远小于现在的 67.5 K。）

C4 能到 50–75 K，但它已经不是「只拆分」而是「按相位拆分 + 懒加载」，风险和测试成本要单独立项。

### 立即可做（不改视觉）

1. **修 `warmUrls` 的权重平局**（`core.js:1376-1379`）：同距离时按 CSS Fonts §5.2 选（目标 > 500 优先更大的权重；400–500 优先更小的）。这一条单独就能去掉 classic 的 500 档 67.5 K。
2. **修「每个 family 都拿全部字符」**（`app.js:1962-1989` / `core.js`）：按 family 顺序把每个字符分给第一个有 face 覆盖它的 family（Nunito 覆盖拉丁/数字，Zen 只留 CJK）。这一条再去掉约 60 K 的 Zen 拉丁/数字子集。
   1、2 都要**先把多条字体 CSS 的 face 表合并**再选：现在 `warmUrls` 是对每条 `<link>` 单独调的；拆出 500 品牌链接后，单看那条 CSS，500 会成为该 family 唯一的 face，600 档仍会选中它。合并后按最终的 family/weight 表选，才真正符合浏览器的 CSS 匹配。
3. **500 拆成品牌 `text=` 链接**（C1）：主 CSS −28.7 K（含品牌 CSS 400 B 为 −28.2 K），500 字体 67.5 K → 3.9 K（classic 只预热、浏览器不绘制；sticker 真正绘制）。
4. **Dela CSS 延后**（C2）：−825 B + 一次请求。
5. 预连接已经在（`index.html:17-18`），不要动。
6. `media=print` 的副作用（FOUT + load 长尾）不是「不改视觉」能修的；如果要做，单独评估 `preload`/load 后注入对 E2E `load` 语义的影响。

## Caveats

- 单位：为便于对照 01，woff2 的「K」沿用其 `/1024` 口径；CSS 的「K」按 `/1000` 口径。两者差 <3%，不影响结论；精确值以 B 为单位的那几处为准。
- Google Fonts 的 CSS 随 UA 变。本次用 Chrome 131 UA；01 用 Chromium 151，87,253 vs 87,244 B（差 9 B）。换 UA 可能改变子集切法/face 数，数字要按同 UA 复测。
- 01 的 per-condition URL 集合理论上会被同进程字体内存缓存影响；但 en 的 9–18 个与本次的 CSS/探针解释一致（en UI 是拉丁，Zen 只需少量 kana/拉丁），按真实差异处理。即便如此，en 的 139–203 K 只应看作「该条件当次运行」的值，不是冷访客的精确上界；冷访客最可信的是 zh 的 38 个 / 403 K（与本次探针的 38 个 URL、`document.fonts` 计数一致）。
- 探针只跑了 **390×844 / zh / classic** 一个条件；1280、en、sticker、duel/result/screen 相位的 Zen 字符集没有逐相位扫。`warmUrls` 修正后的 142 K 是「当前可见 pick 屏」的数，跨相位/三语的安全字符集会更大（B0 给的是 60–150 K 区间）。
- `text=` 子集大小是 Google 的按请求输出，不等于 fonttools 合并子集的字节；后者通常更小（少一层按 slice 的表开销），但会有 ±10–20% 的差异。B 的预算应按「实测生成后再定」。
- 没有跑 E2E、没有视觉 A/B、没有 CLS 数据；`media=print` 的 FOUT 位移未量化。01 也只说「5.6–6.4 s 有二次布局任务」。
- 中文/日文 UI 的 Zen 字符集依赖 i18n 与相位；C4/B0 的 eager 集合必须用一次「全相位 × 三语 × 两皮肤」的 DOM 扫来确定，本次没有做。
- 许可结论基于 `google/fonts` 仓库的三份 OFL 文本；实现时仍应把对应 `OFL.txt` 与版权行一起提交，并在 README/页脚注明。
- 本报告只做测量与建议，没有修改任何产品代码；`members.js` / `i18n.js` 仅用 `vm` 读取。

## Reproduction notes

```bash
# CSS（encoded 用 size_download，decoded 用 wc -c）
UA='Mozilla/5.0 ... Chrome/131.0.0.0 Safari/537.36'
curl -sS --compressed -A "$UA" -o css1.css -w '%{size_download}\n' \
  'https://fonts.googleapis.com/css2?family=Nunito:wght@800;900&family=Zen+Kaku+Gothic+New:wght@500;700;900&display=swap'
wc -c css1.css   # 341037

# 全部 woff2 的 Content-Length（368 个 URL）
# 从 css1.css 解析出 faces.json 后，对每个唯一 URL 发 HEAD，取 content-length 求和：
python3 - <<'PY'
import json, urllib.request, concurrent.futures
urls = sorted({f['url'] for f in json.load(open('faces.json'))})
def head(u):
    r = urllib.request.Request(u, method='HEAD', headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(r, timeout=30) as x:
        return int(x.headers.get('Content-Length') or 0)
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
    print(sum(ex.map(head, urls)))
PY

# 探针（非 E2E 套件）
python3 e2e/serve.py 8124 &
node /tmp/opencode/font02/probe4.cjs > probe4.json
```

关键对照：`probe4.json` 的 38 个 URL 与 01 的 38/38 一致；`document.fonts` 的 loaded 计数（700×4 + 900×11）是「真正绘制」15 个 face 的直接证据。
