# 地图：性能与负载优化（2026-10-30）

- **Label**: wayfinder:map
- **Status**: charting

## Destination

在**不动产品代码**的前提下，产出一份有优先级的性能/负载优化决策图：每项含测量表面、同条件基线、风险与取舍，可直接转成实现工单。

## Notes

- 约束：静态站无后端；不加构建步骤；不新增运行时依赖；三语 × 两皮肤 × 离线承诺不变；首屏见脸矩阵不能退化。
- 测量纪律：同条件 A/B（review-rules #2），数字带测量表面与条件（#6）；资源体积用 `decodedBodySize`/`encodedBodySize`，`transferSize` 可能为 0。
- 本仓库是本地 markdown tracker：研究资产写 `.scratch/perf-load/research/NN-*.md`（替代 wayfinder 的 `research/<name>` 分支；本仓无 PR 流程），从对应票链接。
- 排序偏好：用户可感知优先（首访/滚动/搜索/离线），其次低风险；开发效率项单独成组。
- **首批实现已落地（检查点 88）**：06 的 SW 重复 index、字体权重平局；07 的搜索 40、预览 toBlob。
  未做：bios/poster 延后、C1/C2、海报 resize 原型（票 10）、名册/PWA backlog。
- **研究发现的两个真缺陷已修（610df3b）**：① `image_query_files` 键不匹配 → 按 `photo_skip.skips` 过滤（变异被杀）；② pwa 字体门恒假 → 「CSS 已缓存 + 连续两拍稳定」，pwa 52s→28s。它们不算本图的决策票，但影响 04/05 的可压缩量。
- 本图只产**决策**与可开工工单，不改产品代码；研究票由子代理并行取证，决议票由用户拍板。

## Decisions so far

- [01 · 首访真实瀑布](issues/01-first-visit-profile.md)：首访 1.12–1.48MB；JS 占 43–57%、字体 19–34%；LCP 中位 644ms、load 中位 5.4s（长尾全在 Google Fonts，2/16 次字体失败静默回退）；无视觉风险项：延后 bios+poster 省 129K、修 SW 重复拉 index 25K。
- [02 · 字体交付面](issues/02-font-delivery.md)：Zen+Nunito CSS 87KB/373 faces；zh 实画 15 个 Zen face/142K，预热 37 个/365K（61% 多预热）；C1–C3（500 拆品牌 text=、Dela 延后、修 warmUrls 权重）可零视觉把 zh 降到约 238K（−51%）。
- [03 · 运行时与内存](issues/03-runtime-memory.md)：宽命中搜索 71–93ms longtask；默认名册 641 节点/首屏 347–379ms，全展开 7804 节点/595KB；海报绘制 282–306ms；40 张 full 解码约 15.3MB、全库均值约 47.6MB；PWA 600 张上限对应 6.2–28.6MB。
- [04 · 管线墙钟](issues/04-pipeline-wallclock.md)：14m08 构成 = 旧站扫描 370s + 下载 281s（死 URL 重试）+ 数据 145s + Commons 27s；发现 `image_query_files` 键不匹配导致性能 #5 空操作（每轮白付 26–80s）；负结果缓存等可再压到约 2m50s–3m20s。
- [05 · CI/E2E](issues/05-ci-e2e-load.md)：本地 e2e:all 4m16；CI push 中位 3m35；nightly 3m05–3m50（旧「runner 慢 10–20×」不成立）；pwa 字体门 `n>=17` 恒假，每次白等 30s。
- [06 · 首访取舍](issues/06-first-visit-tradeoff.md)：本轮只做零视觉三项（延后 bios+poster、字体预热 C1–C3、SW 重复 index）；字体失败先留痕；验收 zh ≤1.15MB / LCP ≤700ms / 首屏 145/145；图片与 members 拆分排除。
- [07 · 运行时/离线取舍](issues/07-runtime-offline-tradeoff.md)：海报预览改用 toBlob（去 82–185ms 同步任务）；搜索上限 80→40；海报解码内存先做原型（票 10）；全展开/PWA 缓存留 backlog；确认延迟与微优化不做。
- [08 · 管线与 CI 取舍](issues/08-pipeline-ci-tradeoff.md)：CDX 缓存（成功响应/7 天 TTL）+ CI Playwright 缓存与钉版本 + 390px 语言覆盖修正；真实管线 30 分钟未完成，另开票 11。
- [11 · 旧站扫描 660 与 30 分钟未完成](issues/11-old-site-scan-budget.md)：660 = 15 × 44；根因是解析记录用假名、上一轮 members.js 用汉字，skip 键 name 匹配不上。修键会暴露票 12 的数据回归，故未提交。

<!-- 关闭一张票后在这里追加一行：gist + 链接 -->

## Not yet specified

- **图片交付**：thumb 19MB / full 73MB；是否需要响应式尺寸、AVIF/WebP 质量档、只在选中时取 full、PWA 缓存淘汰策略 —— 取决于首访画像与真实命中率（海报解码内存已毕业为票 10）。
- **PWA 缓存预算**：图片 600 / 字体 500 的上限与设备配额、内存峰值的关系；离线命中率是否达标。
- **搜索索引**：启动预计算 60ms、宽命中 80 张上限是否足够；worker 化是否值得（依赖运行时画像）。
- **字体自托管（B0/B1）**：C1–C3 已决；自托管 UI 子集/全量名字子集仍需视觉与离线 A/B（另票）。
- **名册全展开 / PWA 缓存预算**：07 决定留 backlog，等真实设备数据与离线矩阵。
- **旧站扫描预算/目标**：11 已定位为 name/kana 身份不一致；修键前必须先解票 12 的解析回归。
- **早安解析名变假名 / 55 人缺图**：12（阻断数据管线）。
- **Pages 缓存头**：静态托管的缓存策略可调空间（预计很小，验证后再决定是否成票）。

## Out of scope

- 加后端 / CDN / 构建步骤（违反静态站约束）。
- 重写搜索算法或 UI（不是性能决策，另开一轮）。
- 新增数据源、补图、改成员管线语义（数据批已收口）。
- 第三方分析/监控接入（隐私与无后端）。
