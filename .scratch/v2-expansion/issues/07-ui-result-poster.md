# 07: 结果 + 海报

**What to build:** 结果与海报：名次列表与海报消费字幕/海报 module；32 档 8×4 网格（1080×1440）；系列品牌（48G「神7」/ 坂道「7福神」）与标签（#48Group / #Sakamichi）；保存图片可用。

**Blocked by:** 05、06

**Status:** resolved

- [x] 结果 meta 完整（来源/毕业年份），无 `undefined`
- [x] 32 档海报 8×4 且可保存
- [x] 系列品牌与分享标签正确
- [x] E2E 结果段通过

## Comments

2026-09-27：`drawPoster` 文案按系列（`坂道 好き顔ソート` / `#Sakamichi` vs `48 Group 好き顔ソート` / `#48Group`）；下载文件名 `48group_kami7.png` / `48group_16.png` / `48group_32.png` / `sakamichi_best7.png`（后随命名决策改为 `sakamichi_7fukujin`）；分享文案标签随系列；`poster.js` 调色板换贴纸系（奶油底 + 墨色描边 + 柠檬胶带），槽位加墨色描边。E2E +4（坂道流程到结果、结果 meta、BEST 7 标题、sakamichi_best7.png），40/40 绿；截图核对 32 格海报与坂道海报（生駒里奈 显示「兼任・移籍：AKB48 · 2018 毕业」）。
