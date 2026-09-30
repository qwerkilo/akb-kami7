# 04 · 结果页揭幕（签名时刻）

- **Status**: ready-for-agent
- **所属 spec**：`.scratch/visual-award/spec.md`
- **依据**：`docs/adr/0020-visual-language.md` §3

## 内容

结果页的签名时刻：**两张脸合并成一张海报的共享元素转场**。对决结束时，最后一次比较的
两张脸以共享元素的方式过渡到海报 canvas 的位置，中间态是海报逐渐显影。

- 只做转场，不改海报四样式的构图与 `poster.js` 的绘制逻辑
- ≤400ms 完成
- 尊重 `prefers-reduced-motion`（降级后直接显影）
- **不改变更新流程**：仍需用户点「刷新」才切（ADR-0016）

## 涉及缝

- ⑦ E2E

## 判据

- 揭幕 ≤400ms（用 `performance.now()` 在页面内量，不是靠肉眼看）
- 四种海报样式 × 两款皮肤都成立
- 降级模式下无转场
- E2E 现有的「结果页出现」判据从「canvas 的 display 不为 none」改成**判相位**
  （`[hidden]` 下 canvas 仍是 `display:block`，旧判据是假阳性 —— 已在历轮记录）

## 备注

- 判否「对决页翻卡」：40 档要做 106 次翻卡，会变成噪音。
