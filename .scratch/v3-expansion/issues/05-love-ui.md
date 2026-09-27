# 05: 等爱 UI 接入（系列 tab / 命名 / i18n / 持久化）

**What to build:** 站点出现第三个系列 tab「等爱」：可浏览三团（团体 → 期生两级）、选人、对决与海报；7 档叫「推し 7」、标题「我的等爱 推し 7」、标签 `#イコノイジョイ`、文件名 `love_*.png`；与其他系列状态隔离（含持久化）。

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] `session.js` 系列白名单加 `love`（持久化 key `akb:state:v2:love`）
- [ ] `core.js` `names` 支持 love：`brand_7oshi`（推し 7 / Oshi 7）、`title_prefix_love`、`#イコノイジョイ`、`fileBase = love_{size}`；zh/en 穷举测试
- [ ] i18n `series_love` 等新键（zh/en 同步）；系列 chips 三枚
- [ ] 切换等爱后：候选池仅三团、32 档可用、金字塔海报、已选/进度独立
- [ ] E2E：切到等爱 → 品牌/标题/标签/文件名/32 档路径

## Comments
