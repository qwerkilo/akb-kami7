# 05: 等爱 UI 接入（系列 tab / 命名 / i18n / 持久化）

**What to build:** 站点出现第三个系列 tab「等爱」：可浏览三团（团体 → 期生两级）、选人、对决与海报；7 档叫「推し 7」、标题「我的等爱 推し 7」、标签 `#イコノイジョイ`、文件名 `love_*.png`；与其他系列状态隔离（含持久化）。

**Blocked by:** 04

**Status:** resolved

- [x] `session.js` 系列白名单加 `love`（持久化 key `akb:state:v2:love`）
- [x] `core.js` `names` 支持 love：`brand_7oshi`（推し 7 / Oshi 7）、`title_prefix_love`、`#イコノイジョイ`、`fileBase = love_{size}`；zh/en 穷举测试
- [x] i18n `series_love` 等新键（zh/en 同步）；系列 chips 三枚
- [x] 切换等爱后：候选池仅三团、32 档可用、金字塔海报、已选/进度独立
- [x] E2E：切到等爱 → 品牌/标题/标签/文件名/32 档路径

## Comments

## Comments

2026-09-27：`session.js` 系列白名单加 `love`；`CORE.names` love 变体（brand 推し 7 / Oshi 7、seriesLabel 等爱 / =LOVE Family、标签 #イコノイジョイ、fileBase `love_{size}`）；i18n 新增 brand_7oshi/series_love/title_prefix_love；index.html 第三个系列按钮「等爱」。海报照片来源按系列（love → 「照片：各团体官网・Wikipedia」），页脚补等爱来源说明。实测：切换等爱 → 推し 7 / 三团节点 12/12/13 → 资料卡 zhh/en 全字段本地化 → 生成「我的等爱 推し 7」海报，0 JS 报错。
