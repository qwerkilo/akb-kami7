# 数据与图片生成

`members.js`、`img/full`（720×960 WebP）、`img/thumb`（240 宽 WebP）都由 `scripts/fetch_members.py` 生成：

- **48G / 坂道**：48pedia 的 11 个来源页（`SOURCES`）；跨团按姓名+假名去重归口，跨系列兼任由 keeper+extras 合并；bio 取表内 `生年月日`/`出身地`。
- **等爱三团**：`scripts/love_members.py` 抓官网（列表+详情：血型/星座/身长/趣味/特技/罗马字）+ 日文 Wikipedia（假名/生年月日/出身地/元成员/毕业日）；毕业成员照片走回退链 **Web Archive 列表快照 → 图片快照 → Wikipedia/Commons → 占位**；`main` 的 `love_loader` 可注入（测试离线）。
- `simplified.js`（OpenCC 离线生成，缺依赖时跳过）与 `members.js` 同批产出；原图缓存在 `scripts/_orig/`（已 gitignore），脚本会删除未被引用的图片文件。
- 重跑：`cd scripts && python3 fetch_members.py`；`--no-dl` 只用缓存，`--force` 强制重新压缩。48pedia 偶发 SSL/WAF 失败，重试即可（脚本内已带 4 次重试）；等爱抓取失败会**快速中止不写入**（避免误删已有数据与图片）。
- 依赖 Pillow（缺失时 `pip install Pillow`）；网络默认走代理 `http://127.0.0.1:7897`，本机用 `AKB_PROXY=http://127.0.0.1:7890` 覆盖。
- 规模随数据更新漂移（当前 1375 人 / 1375 图，full 68M + thumb 17M）——以脚本输出为准，勿引用旧数字。
