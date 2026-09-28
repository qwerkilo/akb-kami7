# 海报四样式（v6）spec

**Status:** ready-for-agent

## Problem

海报只有一种版式（金字塔），用户想要多版式：**保留现行款为默认，其余可切换，下载即当前样式**。

## Solution

`poster.js` 增加四种样式（a 金字塔默认 / b 杂志封面 / c 榜单领奖台 / d 贴纸拼贴），结果页加样式 chips，选择持久化在 `akb:poster-style`，导出（下载/分享）自动是当前样式。设计来自原型分支 `prototype/ui-v6-poster`（提交 `4982832`）。

## User stories

1. 结果页默认显示现行金字塔（a），与升级前完全一致。
2. 点样式 chips 切到 b/c/d，海报即时重绘。
3. 刷新/下次进入仍是我上次选的样式（`akb:poster-style`）。
4. 7 / 16 / 32 三档在四种样式下都成立（16 档高版 1920 也适配）。
5. 四种样式都跟随皮肤（原版/贴纸的底色、描边、字体令牌一致生效）。
6. 「保存图片」导出的就是当前所选样式；分享文案与文件名不变。
7. 三语界面下样式名本地化（金字塔/杂志封面/榜单/拼贴；Pyramid/Magazine/Chart/Collage；ピラミッド/マガジン/ランキング/コラージュ）。

## Implementation Decisions

- **`poster.js`**：新增 `drawMagazine` / `drawChart` / `drawCollage`，`draw()` 按 `opts.style` 分派（缺省 = `drawClassic`），导出 `styles: ["a","b","c","d"]`；共用 `posterFooter`；三种新样式全部消费令牌（`colors` / `fonts` / `cardStroke`），奖牌色（金/银/铜）为样式语义常量。
- **布局自适应**：B 冠军横图 + 网格（行/列随 n：7→1 行、16→2 行、32→3 行，列数由 n 反推）；C 前三领奖台 + 双栏紧凑榜（行高由可用高度均分）；D 拍立得行分布（7→[4,3]、16→[6,5,5]、32→[7,7,6,6,6]）铺满可用高度。
- **`app.js`**：`posterStyle` 状态（默认 "a"，读 `akb:poster-style` 并以 `AKB_POSTER.styles` 校验）；`setPosterStyle` 持久化 + 重绘；`renderStyleSeg` 同步 `aria-checked`；点击走事件委托。
- **`index.html`**：结果页 `.seg-style` radiogroup（4 键，`data-i18n-aria-label="style_label"`）。
- **i18n**：`style_label` / `style_a..d` 三语。
- **测试**：假 ctx 增加仿射矩阵追踪（save/restore/translate/rotate）与「绘制时矩阵」快照 → 新增不变量：四样式 × 7/16/32 画布尺寸正确、全员上图、**每张图的四角（经变换）都在画布内**、文案无 `undefined`；「省略 style ≡ style:'a'」的调用序列等价；B/C/D 全员名字与名次落笔。

## Testing Decisions

- `test/poster.test.js`：+3 例（默认等价、四样式不变量、B/C/D 名字名次）；假 ctx 升级不影响既有断言（新增 `imagesM` 平行数组）。
- E2E：结果页样式 chips 四个、默认 a、切 b 后画面变白底（像素探针）、选择持久化、切回 a 底色恢复。

## Out of Scope

- 样式自定义（拖拽/换色/上传）；更多样式；样式×皮肤的像素矩阵单测（E2E 兜底）；海报尺寸/比例变更。
