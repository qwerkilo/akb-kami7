# 04 · 结果页揭幕（签名时刻）

- **Status**: resolved
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

## 实测结果

揭幕窗口实测 **256ms**（10ms 轮询量到的可见窗口 ✓ ≤400 ✓），CSS 时长取 `--dur-slow`
（320ms）。四种海报样式 × 两款皮肤都能揭幕且海报像素正常（naturalWidth 1080），
切样式后无残留克隆层。降级（prefers-reduced-motion: reduce）下**不创建克隆层**、
海报入场动画为 none，海报照常绘制。

## 判据

- 揭幕 ≤400ms（用 `performance.now()` 在页面内量，不是靠肉眼看）
- 四种海报样式 × 两款皮肤都成立
- 降级模式下无转场
- E2E 现有的「结果页出现」判据从「canvas 的 display 不为 none」改成**判相位**
  （`[hidden]` 下 canvas 仍是 `display:block`，旧判据是假阳性 —— 已在历轮记录）

## 途中我自己的两个错（探针写错，功能是好的）

① **第一版量到 3984ms**：我去听页面上**任意** transform 过渡的起止，量到的是名册
卡片与别的过渡混在一起的差值。揭幕本身没问题。
② **然后量到「无」**：改用 MutationObserver 观测 `.unveil`，只记到 add、记不到
remove，而元素确实被移除了（插日志确认 `done` 调了两次、第二次 `stillInDom=false`）。
最后用 10ms 轮询才稳定 —— 320~700ms 的窗口对 MutationObserver 太窄（同一批里
add/remove 都在回调前发生了）。
教训：观测「短暂存在的元素」用轮询，别指望 MutationObserver。

## 备注

- 判否「对决页翻卡」：40 档要做 106 次翻卡，会变成噪音。
