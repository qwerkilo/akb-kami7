# Spec：首屏字节（字体 CSS 子集 + bio 拆分）

- **Status**: done
- **依据**：2026-10-27 两轮 grilling（Q1 = B；Q2–Q5 用户确认）
- **范围**：A 字体（Dela text 子集）→ B（`bio` 拆出 `members.js`）

## 事实基线（2026-10-27 实测，390px 冷缓存）

- 字体 CSS 445KB 原文 / **115KB gzip**：Zen 85KB、Dela 29.6KB、Nunito 0.6KB。
- `members.js` 443KB / gzip 75KB；其中 `bio` 106KB / gzip 25KB，唯一消费点是简介卡。
- 首访 JS 657KB（未压缩本机口径）；Google CSS 117.7KB 传输。

## 决策

- **Q1 = B**（A + bio 拆分）；按系列拆 + bio（C）留 backlog（默认系列是最大的 48g，额外收益小、要动切系列同步路径）。
- **Q2 = A**：bios 空闲预取 + SW 壳缓存（首访总字节不变，省关键路径）。
- **Q3 = A**：没拿到 bios 时照常开卡片，bio 行省略。
- **Q4**：Dela 字符集从 `core.names` × 三语 × 3 档 + 安装指引标题 + 数字派生；守卫逐个字符比对；漏字回退 Zen。
- **Q5**：验收见各工单。

## 结果（收货数字）

- 字体 CSS：**117.7KB → 88.1KB 传输**（Dela 825B + Zen/Nunito 87.2KB）；Dela face 123→1；预热 woff2 51→48、0.52MB→0.48MB。
- JS 关键路径：**443 → 323KB**（gzip 75.2 → 57.6）；bios.js 101KB / gzip 10.9KB 空闲加载。
- 守卫/测试：fonts 2 条、members-artifact +2、pwa 断网简介 +1；变异 2/2 被杀（app 不合并 bios → 主 E2E 红；品牌加字符 → 字体守卫红）。
