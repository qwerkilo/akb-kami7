# 深化 ⑨：海报几何单一出处（报告候选 ⑤）

**Status:** resolved（2026-09-28）

## 背景

架构扫描（报告候选 ⑤）：同一几何事实写在三处——`poster.layout()`（16 人 → 1920）、`draw()` 内部再算一遍 `tall = n > 7 && n <= 16`、`app.js` 先按 layout 设画布再切 `.tall` class（`style.css` 里**没有** `.tall` 规则，死知识）。更深的装配缝：单测的假 ctx 恒 1080×1440，于是唯一该用 1920 画的 16 人场景，在每个单测里都画在 1440 画布上——布局与 draw 失配时几何断言抓不到。

## 做了什么

1. `poster.js` `draw()` 开头：`const size = layout(n); ctx.canvas.width/height = …`，`W/H` 直接取自 size；`tall` 由 `H > 1440` 派生（谓词只剩一处）。
2. `app.js` `drawPoster()` 删掉 `layout()` 调用、画布赋值与 `.tall` class 切换——app 只说「画 N 人」。
3. `test/poster.test.js`：`drawWith` 回传 ctx；新增「draw 自行声明画布尺寸：7→1440 / 16→1920 / 32→1440」。

## 验证

- `npm test` JS 97（+1）+ Python 77；E2E v5 44/44、回归 62/62。
- 实拍 16 人全流程：`#poster-canvas` 1080×**1920**（旧测试画布是 1440），海报 16 槽、序号 1–16、`tall` class 已不存在；无 JS 报错（截图为证，检查点遗留的「16 人海报对照未做」就此闭环）。

## 备注

- `layout()` 仍是导出（测试用它做期望来源），draw 与它共用同一实现，二者不可能再失配。
