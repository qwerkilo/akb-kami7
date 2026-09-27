# 03: core：字幕 module + 海报绘制 seam

**What to build:** `core.js` 新增两个 module：① 字幕 module——统一选人卡片/对决/结果/海报的成员字幕（现役/毕业、来源 note、兼任/移籍、毕业年份），消灭 `m.note` 直用与「兼任・移籍加入」魔字符串；② 海报绘制 module——绘制接受依赖（成员序列、档位、品牌文案、文本解析、画布目标），不再闭包读全局状态。`app.js` 小接入（视觉不变），顺带根除 undefined 类字幕问题。

**Blocked by:** None (can start immediately；与 04 同改 core.js，需串行)

**Status:** ready-for-agent

- [ ] 字幕 module 覆盖全分支（现役 / 毕业 / 兼任 / 移籍 / 有 extras 无 note），node:test
- [ ] 海报 module 布局计算可测（7/16/32 网格、槽位顺序）
- [ ] app.js 接入后 E2E 28 项通过、海报字幕无 `undefined`
- [ ] `m.note` 直用与魔字符串从 `app.js` 消失
