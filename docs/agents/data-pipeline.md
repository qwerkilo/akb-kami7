# 数据与图片生成

`members.js`、`img/full`（长边 ≤720×960 等比 WebP，不放大原图）、`img/thumb`（240 宽 WebP）都由 `scripts/fetch_members.py` 生成：

- **48G / 坂道**：48pedia 的 11 个来源页（`SOURCES`）；跨团按姓名+假名去重归口，跨系列兼任由 keeper+extras 合并；bio 取表内 `生年月日`/`出身地`。
- **等爱三团**：`scripts/love_members.py` 抓官网（列表+详情：血型/星座/身长/趣味/特技/罗马字）+ 日文 Wikipedia（假名/生年月日/出身地/元成员/毕业日）；毕业成员照片走回退链 **Web Archive 列表快照 → 图片快照 → Wikipedia/Commons → 沿用站内已有照片（无则占位）**；`main` 的 `love_loader` 可注入（测试离线）。
- **共用装配契约**：`scripts/roster.py`（`sort_members` / `project` / `section` / `ymd`）定义组内排序（现役优先 → 假名、空则姓名）、成员投影（基础字段恒在，可选字段仅真值带上）、分段形状 `{group, series, label, members}` 与统一日期格式 `ymd`（`YYYY.MM.DD`，缺月日只给年份）；两个数据源只提供各自的分组逻辑与可选字段集。
- `simplified.js`（OpenCC 离线生成，缺依赖时跳过）与 `members.js` 同批产出；原图缓存在 `scripts/_orig/`（已 gitignore），脚本会删除未被引用的图片文件。
- **`img` 标志的真值来源是站内文件**：`img/full/<id>.webp` 与 `img/thumb/<id>.webp` 都在且非空才为 `true`（渲染器只读这两个文件）。上游 URL 解析失败/压缩失败不会让仓库里已有的头像消失；因此脚本报告的 `with image` 是**仓库状态**，不是本轮解析成功数。上游波动导致的失败会以 warning 打出（等爱：逐个点名；其他：结尾汇总「N 位成员没有照片」）。
- 重跑：`cd scripts && python3 fetch_members.py`；`--no-dl` 只用缓存，`--force` 强制重新压缩。48pedia 偶发 SSL/WAF 失败，重试即可（脚本内已带 4 次重试）；**两道中止门都存在**——① 等爱抓取失败 → 中止不写入；② 48G/坂道 名册相对盘上 `members.js` 塌了（总数 < 基线 60%，或某团掉到基线一半以下，或某团一个成员都没解析到）→ 中止不写入。两者的理由相同：脚本末尾的 `prune_unused` 会把不在新名册里的图片**直接删掉**，带着残缺名册走到那一步就是全站删图。基线只统计 48G/坂道 团体（`members.js` 里还有等爱分段，口径不一致会让「团体消失」恒成立）。真出现合法的大变动（某个团解散）时用 `--accept-drop` 放行，差量会打到 stderr。
- 依赖 Pillow（缺失时 `pip install Pillow`）；网络默认走代理 `http://127.0.0.1:7897`，本机用 `AKB_PROXY=http://127.0.0.1:7890` 覆盖。
- 规模随数据更新漂移（当前 1375 人 / 1375 图，full 68M + thumb 17M）——以脚本输出为准，勿引用旧数字。
