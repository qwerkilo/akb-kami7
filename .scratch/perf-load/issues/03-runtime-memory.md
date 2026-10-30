# 03 · 运行时与内存画像

- **Type**: research
- **Status**: resolved
- **Blocked by**: 无

## Question

挑人/搜索/对决/结果四个相位的运行时成本：宽命中搜索（1000+ 命中）的主线程时长、DOM 节点与内存峰值、
PWA 缓存占用（图片/字体）、海报 canvas 峰值；指出可优化项与风险。只测量，不改产品代码。

## Answer

结论：80 张搜索上限已生效（1089 命中 → 80 卡 / 39.9KB innerHTML / 483 roster 节点），但宽命中仍有 **71–93ms** longtask（按键→paint 214–240ms）；默认名册很轻（16 卡 / 641 节点 / 约 347–379ms 首屏），「全部展开」是 **1134 卡 / 7804 节点 / 594.7KB**，整表重建 **195–197ms**、longtask 69–79ms。对决无 longtask（入口 29–41ms 可见，单题 209–214ms 主要是刻意的 160ms 确认延迟）。最大的单任务与内存峰值都在结果海报：40 人时 `draw + toDataURL` 合成 **282–306ms** longtask，canvas 5.93–7.91MB，dataURL 1.5–1.7MB；40 张 full 图解码约 15.3MB（本次低分辨率样本）/ 47.6MB（全库平均）/ ~99MB（p90），JS heap 峰值仅 6.9–7.6MB（占不到全部）。PWA 的 `IMG_CAP=600` 按条目而非字节封顶：全 thumb 约 6.2MB、混合约 17.4MB、全 full 约 28.6MB；quota 3.2GB、首访实际 1.8MB，当前无配额压力，风险是 full 挤掉 thumb 的淘汰顺序。

最值得先做的是海报导出改 `canvas.toBlob()` + object URL（去掉 82–185ms 同步编码与 base64 字符串），其次评估按槽位尺寸解码；搜索上限降到 32/40 是低成本兜底。

完整报告（条件、两轮原始数字、选项与风险）：[03-runtime-memory.md](../research/03-runtime-memory.md)
