# handoff：早安照片缺口（工单 02 在飞，工单 03 未做）

## 现状（2026-10-03）

- **工单 01（`/og/` 源）已收口**（commit `9629023`）：解析 37 人、命中缺图者 **18 人**。
- **工单 02（旧官网 Wayback 源）已实现、真实跑通，但覆盖没到位**：
  - 实现：`parse_img_pairs` / `snapshot_ts` / `tenure_ok`（在籍期校验，ADR-0022）/
    `resolve_old_site_photos`（按团前缀 CDX → 按 URL 去重 → 抓在籍期内最新快照 →
    `alt=姓名` 配对）+ 无 alt 的文件名证据表（5 人）。
  - 真实验证（`/tmp/opencode/probe-old2.py`，`AKB_PROXY=` 直连，**limit=300**）：
    旧官网源命中 **65 人**（按团：モー娘。15 / ℃-ute 7 / Berryz 8 / こぶし 7 / アンジュルム 13 /
    つばき 6 / Juice 7 / OCHA 2）；与 `/og/` 并集 **54/75**。
  - **残留 21 人**（比调研估的 ~8 多），几乎全是**早期モー娘。**：
    石黒彩、市井紗耶香、小川麻琴、亀井絵里、久住小春、紺野あさ美、後藤真希、新垣里沙、
    福田明日香、道重さゆみ、光井愛佳、吉澤ひとみ、リンリン + 村上愛、小川紗季、小数賀芙由香、
    福田花音、前田憂佳、大塚愛菜、島村嬉唄、山木梨沙。
  - **limit 是硬瓶颈**：`limit=200` 时 こぶし 一个都中不了、`limit=300` 时 7/8 中
    —— 抓取预算仍会被前面的团吃掉，**下一步要改成按团独立预算**（不是从全局池里分）。
- **工单 03（重生成 + 残留名单 + 守卫 + E2E）未做**；`members.js` 还没重生成。

## 残留的可疑原因（下一步先查这三条）

1. **早期モー娘。的 21 人**（最大一块）：调研实证它们在 `artist/01/NN/index.html`
   （2005、**alt=姓名**）与 `morningmusume/profile.html`（2009）——前缀已配，
   但一条没中。先逐条打印「这些 URL 抓没抓、页里 alt 是什么」，再定修法。
   两个候选原因：(a) `artist/01/` 前缀下 HTML 页多，预算没轮到；
   (b) 这些页的快照不在我们挑的 ts 上（`best` 取的是「最新在籍内」，
   而这些人的在籍期是 2000–2011，可能挑了太晚的快照、页里已没有她们）。
2. **预算改按团独立**：现在 `per_group = max(12, (limit-fetched)//groups_left)` 是从全局池分，
   前几个团吃多了后面就少 —— 实测 limit 200→300 让こぶし从 0→7。
3. **在籍期下界**：こぶし 的 `join` 其实是空（不是下界问题，已排除）；但 モー娘。 的
   `join` 来自 wiki，若比旧官网快照晚仍会误拒 —— 复查时留意。

## 2026-10-03 晚：找到并修掉两个**真根因**（早期モー娘。那批）

1. **Shift_JIS**：旧官网 2005 前后的页是 Shift_JIS，管线一律 UTF-8 解码 →
   `ALT="吉澤ひとみ"` 变乱码 → 配对全灭。修：`fetch_members.decode_page()`（按 meta charset，
   无声明时试 cp932/euc-jp），接在 `_load_series` 的 fetch 边缘。
2. **大写属性名**：那些页写 `SRC=` / `ALT=`（大写），`parse_img_pairs` 只认小写 → 修成 `re.I`。

实证：吉澤ひとみ的 2005-04-16 快照现在能解出 `alt=吉澤ひとみ` ✓。
**但 モー娘。源只从 1/25 升到 3/25** —— 说明**选 URL/选 ts 的逻辑还有一层问题**：

- 怀疑 `best` 里 `artist/01/04/index.html` 的候选 ts 不含 2005-04-16（CDX 行的 original
  带端口/形态差异？），或每团预算（limit=120、每 URL 试 3 个快照）在按字母序走到 04 前耗尽。
- 下一步：**打印「每个候选 URL × 它的 in-tenure ts 列表 × 抓没抓」**，对照
  `https://web.archive.org/web/20050416001745id_/http://www.helloproject.com/artist/01/04/index.html`
  这条已知能解出名字的 URL，看它是否进了 `best`。

## 关键命令

- 真实抓取：`AKB_PROXY= python3 scripts/fetch_members.py`（本机代理 7890 不通，必须直连）
- 旧官网源单测：`cd scripts && python3 -m unittest test_morning_members`（93 条）；解码：`test_fetch_members`（+3）
- 探针（**要用 decode_page**）：`AKB_PROXY= python3 /tmp/opencode/probe-mom2.py`（~10 分钟）
- 探针：`AKB_PROXY= python3 /tmp/opencode/probe-old2.py`（~17 分钟）

## 纪律

- **未解决前不 push**（用户明确要求）。
- 命中必须过 ADR-0022 的判定（证据 + 在籍期校验），不得为覆盖率放宽。
