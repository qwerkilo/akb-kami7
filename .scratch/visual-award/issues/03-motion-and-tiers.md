# 03 · 动效三时刻 + 对决页层级分隔

- **Status**: ready-for-agent
- **所属 spec**：`.scratch/visual-award/spec.md`
- **依据**：`docs/adr/0020-visual-language.md` §3 §4

## 内容

1. **进场 stagger**（名册卡）：按索引错开入场，≤320ms 完成。
2. **点选反馈**：选中态的即时反馈（≤120ms），与 01 的动效令牌一致。
3. **切屏转场**：三步之间的一次过渡（≤200ms）。
4. **对决页层级可见化**：组切换的一次过渡 + 组内题数的独立指示。
   细条里已有「第 t/n 组 · 约 M 分钟」文字，但**视觉上没有分组感**；
   40 档 106 题时用户会迷失自己在哪一组。
5. 全部尊重 `prefers-reduced-motion`（降级后无 transition/animation）。

## 涉及缝

- ⑦ E2E（`app.js` 无单测缝）

## 判据

- `prefers-reduced-motion: reduce` 下无 transition / animation（**断言计算样式**，
  不是元素属性）
- 三个关键时刻各自 ≤ 令牌时长上限（320 / 120 / 200ms）
- 40 档全流程走完，层级指示在每一轮都可见且与 `core.screenTiers` 的层级数一致

## 备注

- 判否「对决页手势加速」：新能力，且与「撤回」语义会打架，单独决策。
