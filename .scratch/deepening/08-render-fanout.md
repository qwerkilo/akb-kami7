# 深化 ⑧：重绘扇出收成 renderChrome / renderAll（报告候选 ③）

**Status:** resolved（2026-09-28）

## 背景

架构扫描（报告候选 ③）：重绘清单是每个处理器各存一份的隐性依赖图——`setLang` 手写 7 个调用 + 2 处 `$("#phase-…").hidden` DOM 探测；`switchSeries` 6 个绘制 + 分支；尺寸切换各写一遍 `paintSizeButtons/applyStatic/标题/renderPick`；`renderPick` 里 `renderGuide` 被调两次（自身 + `syncSelection`）。历史事故（44e5294 `#size-7` 品牌过期）正是重绘顺序问题。

## 做了什么

1. **区域绘制助手**：`paintFilters()`（筛选 chip 的 aria 由 `snap.filter` 派生，替换两处手写循环）、`paintTitle()`（标题随系列/档位的命名，`dataset.dirty` 守卫保留）。
2. **`renderChrome()`**：refreshGroupOptions → paintSizeButtons → paintFilters → applyStatic → paintTitle（全局性重绘）。
3. **`renderAll()`**：`renderChrome() + renderPick() + (view !== "pick" ? paint() : ——)`——当前视图不是挑人时再补一次视图重绘；可见性全部由 `view`/相位派生，不再探测 DOM。
4. 接线：`setLang`（7 调用 + 4 探测 → `renderAll()` + 资料卡/intro 两处补绘）、尺寸切换（4 调用 → `renderAll()`）、`switchSkin`（+`renderAll()`）、`switchSeries`（6 绘制 → `renderChrome()` + `navigate("sync")`）、boot（4 调用 → `paintSkin(); renderChrome(); navigate("boot")`）。
5. `renderPick` 去掉重复的 `renderGuide()`（`syncSelection` 已覆盖）。

## 边界（有意保留）

- **点选 / 作答 / 搜索** 仍走定向路径（`syncSelection` / `navigate` / `renderPick({resetScroll})`）：挑人区不因一次点选而重建（滚动、图片重载、性能），这正是「单一幂等全量渲染」被删除测试判负的地方（见 `.scratch/deepening/05-render-pick-entry.md` 的记录）。
- `applyStatic` 保持为 i18n 静态 pass（职责内聚）。

## 验证

- `npm test` JS 96 + Python 77；E2E v5 **44/44**、回归 **62/62**（覆盖语言/系列/档位/皮肤四类全局切换）。
- `git grep` app.js：`$("#phase-duel").hidden` / `$("#phase-result").hidden` 探测在渲染路径中已消失（仅剩资料卡自身的显隐）。
