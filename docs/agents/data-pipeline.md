# 数据与图片生成

`members.js`、`img/full`（长边 ≤720×960 等比 WebP，不放大原图）、`img/thumb`（240 宽 WebP）都由 `scripts/fetch_members.py` 生成：

- **48G / 坂道**：48pedia 的 11 个来源页（`SOURCES`）；跨团按姓名+假名去重归口，跨系列兼任由 keeper+extras 合并；bio 取表内 `生年月日`/`出身地`。
- **等爱三团**：`scripts/love_members.py` 抓官网（列表+详情：血型/星座/身长/趣味/特技/罗马字）+ 日文 Wikipedia（假名/生年月日/出身地/元成员/毕业日）；毕业成员照片走回退链 **Web Archive 列表快照 → 图片快照 → Wikipedia/Commons → 沿用站内已有照片（无则占位）**；`main` 的 `love_loader` 可注入（测试离线）。
- **早安家族（11 团：モーニング娘。/℃-ute/Berryz工房/カントリー・ガールズ/こぶしファクトリー/アンジュルム/Juice=Juice/つばきファクトリー/BEYOOOOONDS/OCHA NORMA/ロージークロニクル）**：`scripts/morningmusume_members.py` 抓**官网 7 个现役团**（列表 `MemberPanel` + 详情页的 `dl/dt/dd`；已停止活动的四团没有官网页面）**与各团的日文 Wikipedia 条目**（段标题按团配置在 `GROUPS`：现役段/毕业段的名字各团不同）。两源按姓名归一后合并：**官网只有现役且没有假名与期生**，Wikipedia 才有毕业者、期生与假名。`main` 的 `morning_loader` 可注入（测试离线）。
  - ⚠️ **跨团合并**：同一人只留一份（现役优先 → 毕业日较晚 → 团体终止年份，见 `GROUP_END_YEAR`）；两个现役团同时认领才抛 `ValueError`。真实数据里有 6 位转籍者。
  - ⚠️ **Wikipedia 的表有 `rowspan="2"`**（加入年月日与加入期会横跨相邻两行），于是有的行只有 8 格 —— 按位置取列会串位。`split_rows` 先按**列号**把 rowspan 向下填充。**这一条与等爱不同，不能复用它的 parser**（实测把 `love_members.parse_wiki_members` 套上来得到 0 人）。
  - ⚠️ **毕业照片的三节链**（工单 01/02，2026-10-04 起）：① **现官网 `/og/`**（仍在事务所的卒业生，官方肖像；链首，命中即止）→ ② **旧官网 Wayback 快照**（按团枚举 `artist/01/NN` 等一人一页/扁平页 + 在籍期校验；两个坑：2005 前后的页是 **Shift_JIS** 且属性大写、CDX 的 URL 有 `:80`/非 `:80` 两种形态要归一）→ ③ **Commons**（先查条目首图 `pageimages`，落空再搜**文件命名空间** `commons_search_photo`：身份校验 = 文件名/描述须含本人姓名，拒视频截帧 `Media from YouTube`/`Extracted images`，多个命中取面积最大；节流 `pause=1.5`，否则 429 会被记成「源里没有」）。**现役走官网照片**。
  - ⚠️ **旧站与 `/og/` 的图一律套 Wayback**：`cdn.helloproject.com` 对脚本一律 403（实测 43 张下载全失败），旧路径也早 404 —— 只有存档里有真图。
  - ⚠️ **Commons 要节流**（`resolve_former_photos(pause=1.5)`）：连打几十次会回 429，而失败被吞成「没有照片」—— 缺口名单会把限流记成源里没有。真实缺口名单逐人写进 `.scratch/helloproject-all/issues/03-pipeline.md`（数字让那份记录与产物测试钉，不在这里写第二份）。
- **共用装配契约**：`scripts/roster.py`（`sort_members` / `project` / `section` / `ymd`）定义组内排序（现役优先 → 假名、空则姓名）、成员投影（基础字段恒在，可选字段仅真值带上）、分段形状 `{group, series, label, members}` 与统一日期格式 `ymd`（`YYYY.MM.DD`，缺月日只给年份）；两个数据源只提供各自的分组逻辑与可选字段集。
- `simplified.js`（OpenCC 离线生成，缺依赖时跳过）与 `members.js` 同批产出；原图缓存在 `scripts/_orig/`（已 gitignore），脚本会删除未被引用的图片文件。
- **`img` 标志的真值来源是站内文件**：`img/full/<id>.webp` 与 `img/thumb/<id>.webp` 都在且非空才为 `true`（渲染器只读这两个文件）。上游 URL 解析失败/压缩失败不会让仓库里已有的头像消失；因此脚本报告的 `with image` 是**仓库状态**，不是本轮解析成功数。上游波动导致的失败会以 warning 打出（等爱：逐个点名；其他：结尾汇总「N 位成员没有照片」）。
- 重跑：`cd scripts && python3 fetch_members.py`。**数据阶段是并发的**（`fetch_pool`：按主机限流 —— 官网/维基 3 并发·0.2s，48pedia 2 并发·0.5s；错误按输入顺序重抛，解析顺序不变）；阶段行与心跳（每 ~10s：已完成/总数 · 速率 · 上次成功 Xs 前）打在 stderr。**默认是增量跑**（ADR-0023）：已有站内照片的成员**不解析照片**（数据照常抓），缺图者每轮仍尝试；`--refresh-photos` 才全量重解析（源变好、要换更清晰的照片时用它）；`--no-dl` 只用缓存，`--force` 强制重新下载 + 重新压缩。旧站扫描的每团预算按**抓取次数**算并随缺图人数缩放（公式的唯一出处是 `_group_budget`，由 `test_budget_scales_with_missing_count` 钉住）—— 按 URL 记账会让实际抓取三倍于预算（实测：12 个缺图者散在 5 个团时，扫描跑到全局上限 900 次、增量跑 37 分钟没跑完）。48pedia 偶发 SSL/WAF/521 失败，重试即可（管线边缘已带 8 次重试；单团抓取失败会被 loader 的 empty 策略变成「该团 0 人」再由门③中止 —— 所以重试要够）；**三道中止门都存在**——① 等爱抓取失败 → 中止不写入；② 早安抓取失败 → 中止不写入（理由相同：绝不「一个系列失败就只写其余系列」）；③ 名册相对盘上 `members.js` 塌了（总数 < 基线 60%，或某团掉到基线一半以下，或某团一个成员都没解析到）→ 中止不写入。

⚠️ **门③ 必须排在三个 loader 之后**。它原本紧跟在 48G/坂道 之后，而基线的比较集合含等爱与早安的团 —— 那时它们还没被加载，于是每次都算「一个成员都没解析到」并中止。**这是真实抓取才发现的**（等爱上线后没人真跑过一次完整抓取，所以一直没暴露）。
两者的理由相同：脚本末尾的 `prune_unused` 会把不在新名册里的图片**直接删掉**，带着残缺名册走到那一步就是全站删图。基线把 48G/坂道 记进 `counts`、等爱三团记进 `love_counts`（两者并集才是「团体消失」的比较集合，这样等爱不再被忽略，而「总数跌 60%」仍只算 48G/坂道 —— 等爱人少，比例对它们没意义）。**判据必须与「抓什么」无关**：早先基线用 `if group in GROUP_ORDER` 过滤，等爱分段被整个丢掉，于是「团消失」「腰斩」对等爱恒假；而等爱唯一的门只挡「抛异常」，抓到 0 人时 `love_members` 只 print 一行、`build_sections` 把空团静默丢掉、`prune_unused` 照删图、脚本 exit 0 —— 整组从站点上消失而没人报错。真出现合法的大变动（某个团解散）时用 `--accept-drop` 放行，差量会打到 stderr。

- 依赖 Pillow（缺失时 `pip install Pillow`）。
- **本机跑法（2026-10-04 实测，跑之前先读这三条）**：
  - **网络组合**：直连 DNS 对 `ja.wikipedia.org` / `web.archive.org` 会解析到假 IP（连接挂死），必须走本地代理；而 48pedia 反过来（直连通、经代理 403）。完整命令：
    `AKB_PROXY=http://127.0.0.1:7890 no_proxy=48pedia.org,www.48pedia.org python3 scripts/fetch_members.py`
  - **后台跑**（全量 30–100 分钟）：`setsid nohup timeout 14400 python3 -u scripts/fetch_members.py > /tmp/opencode/pipe.log 2>&1 < /dev/null & disown` —— 发起命令要**快速返回**：发起调用自己超时的话任务会连坐被杀（实测）。
  - **只改装配数据**（给成员加字段之类）时跳过照片解析：`mm.load(fetch, photo=False)` —— 旧站那 900 次快照扫描只服务照片，装配字段用不到。
  - **解析结果有缓存**（`scripts/_resolved.json`，gitignore）：重跑只解析缺的人；删掉它可强制全量重解析。**别放回 `_orig/`**：`prune_unused` 每次成功跑完会清空那里「stem 不是成员 id」的文件，缓存会被一起删掉（两轴审查抓到过）。
  - **跑完核对名册完整性**：`python3 scripts/check_roster.py`（视图级：按团筛选 vs 各团 Wikipedia 表；2026-10-04 用它抓到 3 个团缺转籍者）。
- 规模随数据更新漂移 —— **以脚本输出为准**（产物测试钉人数，本文不写第二份）。
