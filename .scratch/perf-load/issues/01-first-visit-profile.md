# 01 · 首访真实瀑布与主线程画像

- **Type**: research
- **Status**: resolved
- **Blocked by**: 无

## Question

冷缓存首访（390/1280；zh/en；classic/sticker）实际传输了哪些字节、关键路径多长、主线程被什么占住？
需要按类型（JS/CSS/字体 CSS/woff2/thumb）给出 encoded/decoded 字节、请求数、LCP、长任务与 DOMContentLoaded/load，
并指出「占比最高且无视觉风险」的一到两项。只测量，不改产品代码。

## Answer

- 冷缓存首访 wire 约 **1.12–1.48 MB**（本机未压缩）：JS 639 K、字体 CSS 86 K + woff2 139–431 K、thumb 162 K；字体是真实网络上的最大且不可压缩项（zh 34–35%，gzip 估算约 57%）。
- 关键路径很短：DCL 中位 **330 ms**、LCP 中位 **644 ms**；但 load 中位 **5.4 s**（0.3–20.6 s），长尾全部是 Google Fonts（单次 woff2 最长 19.8 s；2/16 次字体全失败且静默回退）。
- 主线程 5 s 内 649–920 ms，Layout 33–35%、名册 HTML 解析 10–14%、脚本 eval 9–14%；最大单任务 161 ms 是 641 节点名册的首屏 layout，不是 JS 逻辑。
- 无视觉风险最大项：**bios.js + poster.js 延后加载 129 K（8.9–10.9%）**；其次修 SW 重复拉 index.html（25 K）。字体与缩略图是更大项，但需视觉 A/B，留给 02/06 决议。
- 报告：`.scratch/perf-load/research/01-first-visit.md`
