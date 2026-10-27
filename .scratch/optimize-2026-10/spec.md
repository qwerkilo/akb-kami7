# Spec：2026-10 优化批次（字体预热 / CI 矩阵 / 数据养护 / 检查点整理）

- **Status**: ready-for-agent
- **依据**：2026-10-27 两轮 grilling（用户确认 Q6–Q11）
- **顺序**：e（检查点整理）→ a（字体预热）→ b（CI 矩阵）→ c（数据养护）

## 事实基线（2026-10-27 实测）

- 首访 390px 冷缓存（本地未压缩）：JS 657KB（gzip≈160KB，`members.js` 443KB/gz75KB）、
  Google Fonts CSS 117KB 传输 / 456KB 解码、**字体预热 154 个 woff2 / 1.51MB**、缩略图 165KB/16 张。
- CI：`check` + `e2e` 两 job；e2e 只跑 `e2e`/`v5`/`pwa`，矩阵套件（header 73 态 / first 145 态）
  不在 CI（runner 上 10–20× 慢，曾 >2h）。
- 养护：数据管线无定时任务。
- 文档：`docs/reviews/checkpoints.md` 2350 行 / 82 轮。

## 决策（Q6–Q11）

- **Q6 = A**：本轮只做字体预热按「实际渲染用到的 family+weight」收口；`members.js` 拆分进 backlog。
- **Q7 = A1**：预热口径 = 可见元素的 computed family+weight 对应的子集（不是首屏一屏）。
- **Q8 = A**：新建 `matrix.yml`，每日 18:00 UTC（北京 02:00）+ 手工触发，跑 header+first，失败即红。
- **Q9 = A**：每周一次只读 `check_roster.py`，失败即红，不自动提交。
- **Q10 = A**：checkpoints 按批次分 5 个文件 + 索引（活信息：基点/遗留/批次日录）。
- **Q11 = e → a → b → c**。

## 范围外（backlog）

- `members.js` 拆分（首载 JS 443KB → 按系列/简介懒载）：另开一轮 grill（动产物管线与缓存清单）。
- 产品新功能（分享链接 / 深色皮肤等）：另开 grill。
