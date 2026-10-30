# 01 · 首访真实瀑布与主线程画像

- **Type**: research
- **Status**: open
- **Blocked by**: 无

## Question

冷缓存首访（390/1280；zh/en；classic/sticker）实际传输了哪些字节、关键路径多长、主线程被什么占住？
需要按类型（JS/CSS/字体 CSS/woff2/thumb）给出 encoded/decoded 字节、请求数、LCP、长任务与 DOMContentLoaded/load，
并指出「占比最高且无视觉风险」的一到两项。只测量，不改产品代码。
