# 04: 等爱数据管线（官网 + Wikipedia + 照片回退）

**What to build:** 数据管线新增等爱三团（=LOVE / ≠ME / ≒JOY）：现役 33 + 毕业 4 = 37 人进入 `members.js`，`series: "love"`；含平假名读法、生年月日、出身地、身长/血型/星座/趣味/特技（等爱专有）、期生；照片按 官网 → Web Archive → Wikipedia/Commons → 占位图 回退。

**Blocked by:** 03（bio 字段形状与 profileRows 先行）

**Status:** resolved

- [x] 三官网列表/详情页解析（fixture 驱动、fetcher 注入）：现役成员、照片 URL、资料字段
- [x] ja.wikipedia 解析（fixture）：平假名读法、生年月日、出身地、元成员与卒業日、期生；抓取带重试
- [x] 照片回退链 + 压缩入库（full/thumb 同规格）；缓存目录沿用 `scripts/_orig/`
- [x] 产物不变量：love 系列存在、三团、37 人、bio 形状、图片/占位标记
- [x] 趣味/特技自由文本补 zh/en 对照表条目（未知文本回退原文；测试守卫缺失）
- [x] `python3 fetch_members.py` 端到端重跑，`--no-dl` 幂等

## Comments

## Comments

2026-09-27：新增 `scripts/love_members.py`（纯函数解析 + 注入式 fetcher，测试离线）：三官网列表/详情解析（含 Wayback 重写页面的宽松解析 `parse_list_loose`/`archived_photo_pairs`）、日文 Wikipedia 按 `|-` 块解析（兼容 ≒JOY 跨行 + 颜色列，用「出身地是都道府县」过滤误匹配行）、Web Archive 列表快照 + 图片快照 + Commons 回退链；`fetch_members.main` 注入 `love_loader` 并合并 members/urls/sections/prune。产物：**37 人（=LOVE 12 / ≠ME 12 / ≒JOY 13）**，含 4 名毕业成员，**37/37 有图**（毕业成员经 Archiy 快照/Commons 回退），全团 1375 人 1375 图。验证：`npm test` JS 69 + Python 71（love 相关 24 项）、E2E 49/49。
