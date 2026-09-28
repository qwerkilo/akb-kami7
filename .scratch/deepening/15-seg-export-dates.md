# 深化 ⑮：分段控件选中态、结果页导出装配、日期格式

扫描（2026-09-28 v3）最后一批：候选 G、H、I（J 值本地化两套协议维持判负/可选）。

## G：`paintSeg(sel, attr, value)`

六个分段控件（语言 / 系列 / 皮肤 / 档位 / 状态筛选 / 海报样式）各有一份 `aria-checked` 绘制循环，其中档位那份还做数字强转。统一为 `paintSeg`：值一律按字符串比较（`String(value)`），六处调用点各剩一行。接线方式（全局 dispatcher / 逐按钮监听）与各控件的额外职责（系列按钮还要写 `seriesLabel`、皮肤还要设 `documentElement.dataset.skin`）保持原样。

**明确不做**：扫描报告的删除测试还提到「给键盘行为统一落点（方向键目前只有皮肤控件有）」——本批是行为保持收口，未加方向键导航，**该半边未做**。副产物：档位旧实现是 `+b.dataset.pick === pick`（数字比较），`pick` 为字符串时整排按钮都不选中；`pick` 由 `session` 的数字闸门保证，实践中不可达。

## H：`resultExport()`

标题回退表达式（`画布` 与 `分享` 两份逐字重复）、日期规则（内联拼 `YYYY.MM.DD`）、分享串、分享 URL 资格、下载文件名收成一个数据型函数 `resultExport()` → `{title, dateText, hashtag, fileName, caption, shareUrl}`。`drawPoster` 只做 canvas 绘制，`savePoster`/分享按钮消费同一对象；`posterFileName()` 随之删除。

## I：`roster.ymd(y, mo, d)`

`YYYY.MM.DD`（缺月日时只给年份）在 5 个解析点各写一份格式串，全部改走 `roster.ymd`——两个生成器共用，与 `roster.py` 已收口的装配契约同层。

## 验证

- `npm test` JS 130 + Python 83；E2E 回归 **86/86**、v5 **49/49**。
- **I 的产物级中性证明**：走代理真实跑一次 `fetch_members.py --no-dl`（1375 人 / 114 段），与提交版 `members.js` 逐行对比**只有 1 行差异**（`福山萌叶` 的 `"img": true→false`，见下）——**全部日期字符串逐字相同**。

## 事故与遗留（重要）

真实重跑把**某位等爱毕业成员**（本次：菅波美玲；上一次观察是福山萌叶——每次不同）的头像从 `img: true` 打成了 `img: false`：毕业成员照片走「Web Archive 列表快照 → 图片快照 → Commons 回退链」，本次三段都没命中（上游/快照可用性波动）。已 `git checkout members.js` 回退，`npm test` 恢复全绿。

**注意：这里没有产物级安全网**——`test/members-artifact.test.js` 只断言 `typeof m.img === "boolean"`，`img: false` 照样过测。上面「恢复全绿」指的是测试绿，不是「图片齐全」被断言守住。

- **本次未提交任何数据变更**，只提交代码收口。
- **待办（候选）**：等爱毕业成员图片回退链失败时应**保留既有映射或拒绝写盘**（当前会静默写 `img: false`）。这与 `roster.py` 之外的另一个「破坏性写入」缺口同族，建议下一轮用 `diagnosing-bugs` 走一遍（先建红回路：注入一个必然失败的图片查找）。
