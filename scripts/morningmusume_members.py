"""早安少女家族（モーニング娘。）成员数据：ja.wikipedia 主条目 + 官网详情页。

只做**解析**：拆表、清洗、投影。装配与网络在 build 层（见同文件下半部分）。

与等爱（love_members）的关系：照片回退链共享 `photo_chain`，但**解析完全不能复用**
—— 早安的表格有三处硬差异，实测把等爱的 parse_wiki_members 套上来得到 0 人：

1. 生年月日不写成 `{{生年月日と年齢|…}}`，而是 `1999年{{Display none|0}}7日{{Center|(…)}}`；
2. 出身地整格被 `{{Display none|…/}}[[静岡県]]` 包着，不是以 `[都道府県]$` 结尾；
3. **表里有 rowspan="2"**（加入年月日与加入期会合并相邻两行），于是有的行只有 8 格，
   按位置取列会串位 —— 必须先做行展开。

全部为纯函数（fixture 驱动测试）；网络经注入的 text fetcher 访问，测试离线。
"""
import json
import re
import urllib.parse

import photo_chain
import roster

SERIES = "morning"
FILE_PREFIX = "morningmusume"
GROUP = "モーニング娘。"
WIKI_PAGE = "モーニング娘。"

# 站内约定：期生写「N期生」。原表的「12期」/「1期」都要归一到这个形状。
GEN_RE = re.compile(r"(\d+)\s*期")

DATE_RE = re.compile(r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日")


def _strip_invisible(text):
    """去掉 {{Display none|…}}（它的内容是对屏幕阅读器隐藏的，不属于字段值）"""
    prev = None
    while prev != text:
        prev = text
        text = re.sub(r"\{\{Display none\|[^}]*\}\}", "", text)
    return text


def _drop_named_templates(text, names):
    r"""按**花括号配平**剥掉指定名字的模板。

    正则治不了这个：`{{Efn2|加入当初のメンバーカラーは{{legend2|#00B140|…}}。変更は…}}`
    里含嵌套模板，`\{\{Efn2\|.*?\}\}\}` 会在第一个 `}}` 收尾、留下尾巴
    （实测留下 `ブルー。変更は2026年8月8日から適用。}}` 这种）。
    """
    for name in names:
        while True:
            start = text.find("{{" + name)
            if start < 0:
                break
            i = start + 2
            # depth 从 2 起：`{{` 的两个花括号已被 start 跳过，
            # 深度 1 的话只会消耗掉第一个 }、给每个表头留一个尾巴。
            depth = 2
            while i < len(text) and depth:
                if text[i] == "{":
                    depth += 1
                elif text[i] == "}":
                    depth -= 1
                i += 1
            text = text[:start] + text[i:]
    return text


def _strip_refs(text):
    """去掉 <ref>…</ref> 与 {{Efn2|…}} / {{R|:2}} 之类的脚注噪声。"""
    prev = None
    while prev != text:
        prev = text
        text = re.sub(r"<ref[^>]*>.*?</ref>", "", text, flags=re.S)
        text = _drop_named_templates(text, ("Efn2", "R"))
    return text


def _strip_templates(text):
    """去掉剩余的 {{…}}：取第一个位置参数，或无参数时取空。"""
    prev = None
    while prev != text:
        prev = text
        m = re.search(r"\{\{([^{}]*)\}\}", text)
        if not m:
            break
        inner = m.group(1)
        arg = inner.split("|")[1] if "|" in inner else ""
        text = text[: m.start()] + arg + text[m.end() :]
    return text


_LINK = re.compile(r"\[\[([^\]|]*)(?:\|([^\]]*))?\]\]")


def clean(cell, name=None):
    """把一个单元格洗成可用的纯文本：去脚注 → 拆管道链接 → 去残留模板 → 去标签。"""
    text = _strip_refs(_strip_invisible(cell))
    # 链接：带显示文字的取显示文字，否则取标题（去掉 disambiguator 的括号）
    def link(m):
        target, label = m.group(1), m.group(2)
        if label:
            return label
        return re.sub(r"\s*\(.*?\)\s*$", "", target)

    text = _LINK.sub(link, text)
    text = _strip_templates(text)
    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&nbsp;", " ")
    lines = [ln.strip() for ln in text.split("\n")]
    lines = [ln for ln in lines if ln]
    if name:
        lines = [ln for ln in lines if ln != name]
    return "\n".join(lines)


def parse_nick(cell, name=None):
    """昵称一格可能多行（`ちぇる<br />のなちゃん`）。

    grilling R1-Q3：显示第一个，其余作为**别名**返回 —— 它们要进搜索用的 haystack，
    但不显示（资料显示卡只放一行）。
    """
    lines = [ln.strip() for ln in cell.replace("<br />", "\n").replace("<br/>", "\n").split("\n")]
    lines = [ln for ln in lines if ln.strip()]
    if not lines:
        return ("", [])
    # **第一行也要洗**：真实数据里昵称格带 <ref group="注">…</ref> 的共用昵称注记
    # （中澤裕子就是），只洗别名那几行会让它漏进产物 —— 抓取后由产物测试抓到。
    # 不传 name 过滤：那是给**姓名格**的规则（`{{Small|（のなか みき）}}` 与正式名重复），
    # 而昵称格里「昵称 == 姓名」是常见情形（リンリン），丢掉就没人显示了。
    first = clean(lines[0])
    rest = []
    for ln in lines[1:]:
        ln = clean(ln, name=name)
        if ln and ln != first and ln != name:
            rest.append(ln)
    return (first, rest)


def first_line(cell_text):
    """姓名格是 `{{Display none|のなか みき/}}[[野中美希]]<br />{{Small|（のなか みき）}}` ——
    正式名是第一行，`{{Display none|…/}}` 里是假名，`{{Small|(…)}` 是重复的假名注记。
    站内姓名要正式名，假名另存，所以只取第一行。"""
    lines = [ln.strip() for ln in (cell_text or "").split("\n")]
    lines = [ln for ln in lines if ln]
    return lines[0] if lines else ""


def kana_of(cell_text):
    """从姓名格里取假名：`{{Display none|のなか みき/}}` 里那一份。
    早安的表没有独立的假名列，假名只在这个被隐藏的块里。"""
    m = re.search(r"\{\{Display none\|([^}/]+)/\}\}", cell_text or "")
    return m.group(1).strip() if m else ""


def _header_name(text):
    """表头可能写成 `! style="…" |名前`，也可能写成 `!加入期`（无属性无分隔符），
    后者要先把前导的 ! 剥掉，否则列名会变成「!加入期」而对不上 COLUMN_NORM。"""
    """表头单元格的显示名：去掉 style/class 属性与 <br />，再压空白。"""
    text = _strip_refs(text)
    text = text.lstrip("!").strip()
    text = re.sub(r"<br\s*/?>", "", text)
    text = re.sub(r"\{\{[^{}]*\}\}", "", text)
    text = re.sub(r"\s+", "", text)
    return text


def _split_attrs(text):
    """在**花括号深度 0** 的第一个 | 处切开属性与内容。

    不能直接 partition：格内容里自带 |（`{{Display none|しずおかけん/}}`），
    那样会把模板劈开、留下 `しずおかけん/}}静岡県` 这种残渣（我第一版就这么写的，
    现役表的每一格都脏）。
    """
    depth = 0
    for i, ch in enumerate(text):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth = max(0, depth - 1)
        elif ch == "|" and depth == 0:
            return text[:i], text[i + 1 :]
    # 整段都没有深度 0 的 | → 这格**没有属性**，全部都是内容
    # （出身地那格就是这种：唯一的 | 在 {{Display none|…/}} 里面）
    return "", text


def _row_cells(lines):
    """把 `|-` 之后的行解析成 (rowspan, 单元格文本) 序列。"""
    cells = []
    for line in lines:
        if not line.startswith("|"):
            continue
        head, rest = _split_attrs(line[1:])
        span = re.search(r'rowspan\s*=\s*"?(\d+)"?', head)
        cells.append((int(span.group(1)) if span else 1, rest))
    return cells


NEWLINE = chr(10)  # 换行符：wikitext 是 CRLF 的场合也要能切
DO_CLEAN = [True]


def _read_header(lines):
    """返回 (列名列表, 表头之后的行号)。

    扫到第一行 `!` 之前，什么都可能出现在前面：`{|class=…`、行分隔 `|-`、
    **section 标题 `=== メンバー ===`**（parse_wiki_members 按标题切完再传进来）。
    所以只认「第一行 `!`」，不能拿 `{|`/`|-` 当终止条件 —— 我第一版那么写，
    遇到 section 标题就再也到不了表头，width=0、解析出零人（红了 19 条才发现）。
    """
    i = 0
    while i < len(lines) and not lines[i].startswith("!"):
        i += 1
    header = []
    while i < len(lines) and lines[i].startswith("!"):
        header.append(_header_name(lines[i].split("|", 1)[1] if "|" in lines[i] else lines[i]))
        i += 1
    return header, i


def _read_blocks(lines, start):
    """表头之后按 `|-` 切成数据块；`|}` 收尾。"""
    blocks, cur = [], []
    for line in lines[start:]:
        if line.startswith("|-"):
            if cur:
                blocks.append(cur)
            cur = []
        elif line.startswith("|}"):
            break
        else:
            cur.append(line)
    if cur:
        blocks.append(cur)
    return blocks


def split_rows(text, do_clean=True):
    """把一张 wikitable 拆成「与表头等宽的行」，rowspan 向下填充。

    这是早安与等爱最本质的差异：等爱可以按 `\\n|-` 盲切后逐块解析，早安不行 ——
    `rowspan="2"` 会让某些行少两格，按位置取列就串位（实测把某人的出身地当成了姓名）。
    """
    DO_CLEAN[0] = do_clean
    lines = text.split(NEWLINE)
    header, i = _read_header(lines)
    return _fill_rows(_read_blocks(lines, i), header)


def _fill_rows(blocks, header):
    """把切出来的块展开成与表头等宽的行，rowspan 向下填充。

    早安表里「加入年月日」与「加入期」会横跨相邻两行，于是后一行少两格；
    不填充就按位置取列，会把某人的出身地当成姓名（调研时真的取错过）。
    """
    width = len(header)
    rows = []
    carry = {}
    for block in blocks:
        cells = _row_cells(block)
        out = {}
        col = 0
        ci = 0
        while col < width:
            if col in carry:
                left, val = carry[col]
                out[header[col]] = val
                if left <= 1:
                    del carry[col]
                else:
                    carry[col] = (left - 1, val)
                col += 1
                continue
            if ci < len(cells):
                span, raw = cells[ci]
                ci += 1
                val = clean(raw) if DO_CLEAN[0] else raw.strip()
                if DO_CLEAN[0] and header[col] in COLUMN_NORM:
                    val = COLUMN_NORM[header[col]](val)
                out[header[col]] = val
                if span > 1:
                    carry[col] = (span - 1, val)
                col += 1
                continue
            out[header[col]] = ""
            col += 1
        rows.append(out)
    return rows


def _date(text):
    m = DATE_RE.search(text or "")
    if not m:
        return ""
    return "{}.{}.{}".format(m.group(1), m.group(2).zfill(2), m.group(3).zfill(2))


def _generation(text):
    m = GEN_RE.search(text or "")
    return "{}期生".format(m.group(1)) if m else ""


# 表里这几列有固定语义，归一后 cell() 直接给投影值（日期一律 YYYY.MM.DD，
# 期生一律「N期生」—— 原表里「{{Center|12期}}」与裸「1期」两种写法混用）
COLUMN_NORM = {
    "名前": first_line,
    "生年月日（現年齢）": _date,
    "生年月日": _date,
    "加入年月日": _date,
    "加入期": _generation,
    "卒業・脱退日（発表日）卒業公演の開催地": _date,
}


def raw_row(text):
    """与 split_rows 同构，但**不清洗**单元格 —— 给多行的昵称用。"""
    return split_rows(text, do_clean=False)


def cell(row, name):
    return row.get(name, "")


raw_cell = cell  # split_rows(clean=False) 时格本来就是原文，两者同义


def _members_from_table(text, status):
    """字段取**清洗后**的行（姓名/日期/期生都已归一），昵称取**原始行** ——
    昵称要按 `<br />` 拆行，清洗过就看不出有几行了。
    注意**不要在这里再归一一次**：格值已经是 YYYY.MM.DD / N期生，
    再过一次 _date 会认不出（它的正则只认「1999年10月7日」这种原表形状）。"""
    out = []
    rows = split_rows(text)
    raws = raw_row(text)
    header_name = "名前"
    for row, raw in zip(rows, raws):
        name = row.get(header_name, "")
        if not name:
            continue
        nick, aliases = parse_nick(raw.get("ニックネーム", ""), name=name)
        out.append(
            {
                "name": name,
                "kana": kana_of(raw.get(header_name, "")),
                "nick": nick,
                "nick_aliases": aliases,
                "status": status,
                "generation": row.get("加入期", ""),
                # 键名要一字不差 —— 表头是「生年月日（現年齢）」（现年龄），
                # 我曾写成「（年齢）」于是永远取不到值
                "birth": row.get("生年月日（現年齢）", "")
                or row.get("生年月日", ""),
                "blood": row.get("血液型", ""),
                "from": row.get("出身地", ""),
                "end": row.get("卒業・脱退日（発表日）卒業公演の開催地", ""),
            }
        )
    return out


CURRENT_MARK = "=== メンバー ==="
FORMER_MARK = "=== 過去のメンバー ==="


def parse_wiki_members(wikitext):
    """两表合成一份名单。状态来自「出现在哪张表里」——
    早安官方对离开的说法分「卒業」与「脱退」，站内一律记 former（grilling R1-Q2），
    所以「ハロプロへの在籍状況」那一列不参与状态判定。"""
    ci = wikitext.find(CURRENT_MARK)
    fi = wikitext.find(FORMER_MARK)
    if ci < 0:
        return []
    if fi < 0:
        fi = len(wikitext)
    # 現在の表は 現在の表のセクション内；過去の表は 過去のメンバー配下の卒業表
    cur_text = wikitext[ci:fi]
    former_text = wikitext[fi:]
    return _members_from_table(cur_text, "current") + _members_from_table(former_text, "former")


# ── 官网解析（工单 03）───────────────────────────────────────────────────

SITE = "https://helloproject.com"
LIST_PATH = "/morningmusume/"

# 详情页的 `<dl><dt>字段名</dt><dd>值</dd></dl>` → 站内 bio 的键。
# 早安的官网**没有**身長与星座（两个源都没有，见 grilling R1-Q4），所以不留空键；
# 「座右の銘」「アンバサダー」「資格」「好きな音楽ジャンル」站内也没有对应字段 ——
# 带进 bio 只会变成没人消费的数据。
DETAIL_MAP = {
    "ニックネーム": "nick_raw",
    "生年月日": "birth",
    "血液型": "blood",
    "出身地": "from",
    "趣味": "hobby",
    "特技": "skill",
}

_PANEL = re.compile(
    r'<div class="MemberPanel">.*?href="([^"]+)"[^>]*>.*?'
    r'<img src="([^"]+)"[^>]*>.*?'
    r'<div class="MemberPanel__nameJa[^"]*">([^<]+)</div>'
    r'(?:<div class="MemberPanel__nameEn[^"]*">([^<]*)</div>)?',
    re.S,
)
_ROLE = re.compile(r'<div class="MemberPanel__role">([^<]*)</div>')
_DT_DD = re.compile(r"<dt[^>]*>\s*([^<]+?)\s*</dt>\s*<dd[^>]*>(.*?)</dd>", re.S)
_TAG = re.compile(r"<[^>]+>")


def parse_list(html):
    """官网列表页 → [{path, photo, name, name_en, role}]。

    照片 URL 是内容哈希（`/upload/images/<sha256>.webp`），**不含姓名信息**，
    所以只能靠「同一个 panel 内 img 与姓名相邻」配对，不能靠 URL 反查。
    """
    out = []
    for m in _PANEL.finditer(html):
        path, photo, name, name_en = m.group(1), m.group(2), m.group(3), m.group(4) or ""
        # role 在姓名之前出现，单独在 panel 范围内找
        panel = html[m.start() : m.end()]
        role = _ROLE.search(panel)
        out.append(
            {
                "path": path,
                "photo": photo,
                "name": name.strip(),
                "name_en": name_en.strip(),
                "role": role.group(1).strip() if role else "",
            }
        )
    return out


def parse_detail(html):
    """官网详情页 → {站内键: 值}。只保留 DETAIL_MAP 里的字段。"""
    out = {}
    for label, value in _DT_DD.findall(html):
        key = DETAIL_MAP.get(_TAG.sub("", label).strip())
        if not key:
            continue
        out[key] = _TAG.sub("", value).strip()
    if "birth" in out:
        out["birth"] = _date(out["birth"])
    return out


def _nick_split(raw):
    """官网把多个昵称写成顿号分隔（`ちぇる、のなちゃん`），
    Wikipedia 写成 `<br />` 分行 —— 两种都收敛成「显示第一个 + 其余进别名」。"""
    if not raw:
        return "", []
    parts = [p.strip() for p in re.split(r"[、,，]", raw) if p.strip()]
    if not parts:
        return "", []
    return parts[0], parts[1:]


# ── 装配（工单 03）───────────────────────────────────────────────────────

def norm_name(name):
    """姓名归一：去掉空白与括号注记，让「野中 美希」与「野中美希」认成同一人。"""
    return re.sub(r"[\s　（）()]+", "", name or "")


def build_bio(detail, wiki_row):
    """bio 由官网详情页给，Wikipedia 补官网没有的。

    ⚠️ 毕业成员**不在官网上**，所以 `from`（出身地）必须能从 Wikipedia 取到 ——
    真实抓取时 51 人里 40 人的 from 是空的，原因就是只接了官网那一路。
    期生不进 bio：它是筛选字段，不是资料。
    """
    bio = {}
    for key in ("birth", "blood", "from", "hobby", "skill"):
        if detail.get(key):
            bio[key] = detail[key]
    if wiki_row.get("birth") and not bio.get("birth"):
        bio["birth"] = wiki_row["birth"]
    if wiki_row.get("from") and not bio.get("from"):
        bio["from"] = wiki_row["from"]
    return bio


def _pick_nick(detail, w):
    """昵称取舍：官网优先，都没有就空。

    官网写顿号分隔（`ちぇる、のなちゃん`），Wikipedia 写 `<br />` 分行 ——
    两种都收敛成「显示第一个 + 其余进别名」（grilling R1-Q3）。Wikipedia 那边
    已经拆好，直接用。
    """
    nick, aliases = _nick_split(detail.get("nick_raw") or "")
    if nick:
        return nick, aliases
    return w.get("nick") or "", list(w.get("nick_aliases") or [])


def _base_record(name, w, nick, nick_aliases):
    """必在的字段。期生与状态只来自 Wikipedia（官网没有这两项）。"""
    return {
        "name": name,
        "kana": w.get("kana") or "",
        "nick": nick,
        "nick_aliases": nick_aliases,
        "status": w.get("status") or "current",
        "group": GROUP,
        "series": SERIES,
        "generation": w.get("generation") or "",
        "file": "{}:{}:{}".format(FILE_PREFIX, GROUP, name),
    }


def _optional_fields(detail, w):
    """毕业日与 bio —— 有才带（站里 `if (value)` 才入行，缺就是少一行）。"""
    extra = {}
    if w.get("end"):
        extra["end"] = w["end"]
    bio = build_bio(detail, w)
    if bio:
        extra["bio"] = bio
    return extra


def _merge_one(item, w):
    """合并一个人的两个来源，成一条记录。

    官网给昵称/资料/照片，Wikipedia 给期生与毕业状态 —— 谁都有对方没有的东西：
    官网**只有现役**，Wikipedia 才有毕业者；反过来 Wikipedia 的表若还没更新，
    新人只在官网上。
    """
    name = item.get("name") or w.get("name") or ""
    if not name:
        return None, None
    detail = item.get("detail") or {}
    nick, nick_aliases = _pick_nick(detail, w)
    rec = _base_record(name, w, nick, nick_aliases)
    rec.update(_optional_fields(detail, w))
    photo = item.get("photo")
    url = SITE + photo if photo else ""
    return rec, url


def build_members(official, wiki):
    """official: {姓名: parse_list 项（含 detail）}；wiki: parse_wiki_members 的结果。
    返回 (members, urls) —— 照片放在 urls 里按 file 键索引，与 love_members 同契约
    （fetch_members 靠 urls 下载，不要发明第二个形状）。

    两源按姓名归一后合并，任一侧独有的都要留下。
    """
    by_name = {norm_name(k): v for k, v in official.items()}
    wiki_by_norm = {norm_name(m["name"]): m for m in wiki}
    members, urls = [], {}
    for key in dict.fromkeys([*by_name.keys(), *wiki_by_norm.keys()]):
        rec, url = _merge_one(by_name.get(key) or {}, wiki_by_norm.get(key) or {})
        if not rec:
            continue
        members.append(rec)
        if url:
            urls[rec["file"]] = url
    return members, urls


def resolve_former_photos(members, urls, fetch, warn=print):
    """毕业成员的头像。**早安这里与等爱不同**：等爱能从旧列表页快照里配出「姓名 → 照片」，
    早安**不能** —— 实测 2023-01-08 的旧列表页快照里，`img/artist/s/<sha1>.jpg` 那批图
    是 ameblo 的**博客缩略图**，`#artist_photo` 那一批是**专辑封面**，页面上**没有**
    逐成员的照（子代理给的「旧列表页提取」这条路对本快照不成立）。

    所以链只有两节：Wikipedia Commons → （若已知照片 URL）Wayback 取图。
    取不到就 warn —— 站里会显示占位卡，但没人知道是谁缺了。

    ⚠️ 这意味着毕业成员的照片覆盖率**大概率不高**，缺口集中在 1~5 期。
    真正的缺口名单要等工单 04 的真实抓取（见 spec 的验收）。
    """
    for m in members:
        if m["status"] != "former" or m["file"] in urls:
            continue
        resolved = photo_chain.commons_photo(m["name"], fetch)
        if not resolved and m.get("photo_url"):
            resolved = photo_chain.wayback_photo(m["photo_url"], fetch)
        if resolved:
            urls[m["file"]] = resolved
        else:
            # 上游解析不到：仓库里已有照片的成员会沿用本地文件（img 仍为 true），
            # 只有连站内文件都没有的才真的显示占位。
            warn("warning: 早安毕业成员照片解析不到（若无站内文件则占位）：{}".format(m["name"]))
    return members, urls


def build_sections(members):
    """早安是**一系列一团**，且期生有 18 期 —— 所以不分组，段 label 用团名本身；
    期生留在成员记录上（等爱只有一期，才把 GENERATION 塞进段）。"""
    if not members:
        return []
    # optional 里要多带两个字段，理由与等爱相反：
    # - generation：早安有 18 期，「按期生筛」必须逐人存（等爱只有一期，期生在段 label 上）
    # - nick_aliases：进搜索用的 haystack（grilling R1-Q3：昵称只显示第一个，其余仍要能被搜到）
    # roster.project 的可选字段集默认只有 bio，带不进来就等于字段被静默丢掉。
    return [roster.section(GROUP, SERIES, GROUP, members, optional=("bio", "generation", "nick_aliases"))]


def load(fetch, warn=print):
    """抓官网列表 + 每人详情 + Wikipedia 两表 + 毕业照片。返回 (members, urls)。"""
    listing = parse_list(fetch(SITE + LIST_PATH))
    official = {}
    for item in listing:
        detail = parse_detail(fetch(SITE + item["path"]))
        merged = dict(item)
        merged["detail"] = detail
        official[item["name"]] = merged
    print("モーニング娘。: {} 人（官网）".format(len(official)))
    text = wiki_wikitext(WIKI_PAGE, fetch)
    wiki = parse_wiki_members(text)
    print("モーニング娘。: {} 人（Wikipedia）".format(len(wiki)))
    members, urls = build_members(official, wiki)
    resolve_former_photos(members, urls, fetch, warn)
    return members, urls


def wiki_wikitext(title, fetch):
    """取条目的 wikitext 原文。API 回的 wikitext 是 `{"*": "…"}`，
    少取一层就会把 dict 当字符串往下传（我第一版就那样，报的是
    'dict' object has no attribute 'find'）。"""
    query = photo_chain.WIKI_API + "?" + urllib.parse.urlencode(
        {"action": "parse", "page": title, "prop": "wikitext", "format": "json"}
    )
    try:
        data = json.loads(fetch(query))
    except Exception:
        return ""
    return (data.get("parse") or {}).get("wikitext", {}).get("*", "")
