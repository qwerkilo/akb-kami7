# 04: 等爱数据管线（官网 + Wikipedia + 照片回退）

**What to build:** 数据管线新增等爱三团（=LOVE / ≠ME / ≒JOY）：现役 33 + 毕业 4 = 37 人进入 `members.js`，`series: "love"`；含平假名读法、生年月日、出身地、身长/血型/星座/趣味/特技（等爱专有）、期生；照片按 官网 → Web Archive → Wikipedia/Commons → 占位图 回退。

**Blocked by:** 03（bio 字段形状与 profileRows 先行）

**Status:** ready-for-agent

- [ ] 三官网列表/详情页解析（fixture 驱动、fetcher 注入）：现役成员、照片 URL、资料字段
- [ ] ja.wikipedia 解析（fixture）：平假名读法、生年月日、出身地、元成员与卒業日、期生；抓取带重试
- [ ] 照片回退链 + 压缩入库（full/thumb 同规格）；缓存目录沿用 `scripts/_orig/`
- [ ] 产物不变量：love 系列存在、三团、37 人、bio 形状、图片/占位标记
- [ ] 趣味/特技自由文本补 zh/en 对照表条目（未知文本回退原文；测试守卫缺失）
- [ ] `python3 fetch_members.py` 端到端重跑，`--no-dl` 幂等

## Comments
