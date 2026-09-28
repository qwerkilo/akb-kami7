# 01 poster.js 四样式

**Status:** resolved
**Blocked by:** 无

## What to build

`poster.js` 三新样式（B 杂志封面 / C 榜单领奖台 / D 贴纸拼贴）+ `style` 分派与 `styles` 导出；共用页脚抽取。

## Acceptance

- [x] `draw()` 缺省 = 原金字塔（调用序列与 `style:'a'` 完全一致）
- [x] 四样式 × 7/16/32：画布尺寸正确、全员上图、绘制（含旋转/平移变换后）不越界
- [x] B/C/D 全员名字与名次落笔；文案无 `undefined`
- [x] 三新样式全部走令牌（皮肤跟随）
- [x] `npm test` 全绿（JS 113）

## Comments

2026-09-28（审查修复）：① C 领奖台在 16 档高版（H=1920）横向重叠且冠军不居中——横向几何改为按可用宽度预算（`kx`）推导；② C/D 补 `cardStroke` 消费（此前 C 不描边、D 贴纸标题硬编码 3px，classic 皮肤下违反「不描边」语义）；③ 新增测试：`cardStroke`/`ink` 令牌响应（4 样式）、C 领奖台「互不重叠且居中」（7/16/32）、B/C/D 名字名次用例扩到 16；④ 清理未用的 `ctx.toWorld` 与 D 的不可达分支。

2026-09-28：`drawMagazine`/`drawChart`/`drawCollage` + `STYLES`/`draw()` 分派；假 ctx 升级为仿射矩阵追踪（`toWorld` + 绘制时矩阵 `imagesM`），越界不变量经变异验证有判别力（把 B 固定 8 列后报 `b/32 越界 (72,1503)`）。
