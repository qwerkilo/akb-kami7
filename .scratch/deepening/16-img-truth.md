# 修 ⑯：`img` 标志的真值来源改为站内文件（等爱毕业照片 fail-open 修复）

来自深化⑮ 两轴审查指认的缺口：等爱毕业成员照片的「Web Archive 列表快照 → 图片快照 → Commons」回退链是**整条管线里唯一的 fail-open**（`except → None/[]`，解析不到只 `warn` 放行），而它的兄弟路径都是 fail-closed（等爱抓取失败直接 `SystemExit`；48G/坂道 `image_urls` 异常直接抛出、不写盘）。

本条闭环 `.scratch/deepening/15-seg-export-dates.md` 的「没有产物级安全网」与「待办（候选）」两段，以及 `docs/reviews/checkpoints.md` 第二十一轮的同一候选；那里建议的「最小修法：中止写盘」**未采纳**（理由见文末）。

## 症状（已复现）

走代理真实重跑 `fetch_members.py --no-dl` 时，某位等爱毕业成员的 `img` 从 `true` 翻成 `false`（两次运行分别是菅波美玲、福山萌叶——每次不同，说明是上游/快照可用性波动）。站点给「图就在仓库里」的成员渲染占位图；`test/members-artifact.test.js` 只断言 `typeof m.img === "boolean"`，**静默过全套测试**。

## 修复：`img` 以站内图片文件为真值

`compress_members` 不再从「远端 URL 是否解析成功」推导标志，改为看 `img/full/<id>.webp` 是否存在：

- 上游解析不到 / 压缩失败，但仓库里已有照片 → `img` 仍为 `true`（渲染器也只认本地文件，标志与现实一致）
- 仓库里确实没有文件 → `img: false`，且结尾的「没有照片（界面显示占位）」警告如实列出
- 新成员首次抓取还没有图 → 正确为 `false`（不阻塞正常刷新，不制造 fail-closed 阻塞）

同时把等爱的警告措辞改准：解析不到时说明「上游解析不到（沿用站内已有照片，若无则占位）」，不再一律宣称「无可用照片（占位）」。

## 红回路与验证

- **红**：`scripts/test_fetch_members.py::CompressMembersTests::test_existing_local_file_keeps_img_true`（本地有文件 + 远端解析不到 → 期望 `img` 为 true，修复前 FAIL）
- **绿**：同组四条单测（审查后补：只写出一半 / 0 字节残留必须报缺图、`usable()` 拒绝空文件）+ `test/members-artifact.test.js` 的**对称**不变量「`img: true` ⟺ full 与 thumb 都在且非空」（离线可验）
- **真实重跑**：修复后 `AKB_PROXY=… fetch_members.py --no-dl` 报告 `members 1375 with image 1375`，`git diff members.js` **为空**（产物逐字节不变；修复前同一命令会产生 1 行差异）
- `npm test` JS **131** + Python **86**；E2E 86/86、v5 49/49

## 备注与代价

- 没有采用「解析不到即中止写盘」的方案：那会让任何一位新成员缺照片就阻断整轮刷新（`need` 集约 4 人是常态），而本地文件才是渲染器的事实来源。
- **退化模式的变化（诚实记账）**：修复前，上游解析失败会让该成员渲染**显眼的占位图**（错得明显）；修复后会静默沿用上一次抓到的照片（可能已过时，错得隐蔽）。正常路径下 `compress` 的 mtime 短路会在解析成功时重压，站内的图不会长期陈旧。
- 判定要求 **full 与 thumb 都在且非空**（审查发现：只看 full 会让「只写出一半 / 0 字节残留」渲染成坏卡片图，而卡片 `<img>` 没有 `onerror` 兜底）；`compress` 的缓存短路也改用同一 `usable()` 判定，于是 0 字节残留会在下一轮被重压自愈。
- 覆盖面：这条契约同时兜住 48G/坂道 `urls` 缺项的同类静默降级，不止等爱。
- 判别力来自**红回路与注入复现**（把 Wayback CDX 与 Commons 解析注入为必然失败：修复前 `with image 1371`、4 行 `img:false`；修复后 1375、产物与已提交版本逐字节相同），不依赖某次真实重跑恰好复现。
- `prune_unused` 保留全部成员 id，图片文件不会被清理，因此沿用本地文件是安全的。
