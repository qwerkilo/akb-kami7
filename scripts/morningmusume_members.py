"""早安家族（Hello! Project）成员数据：ja.wikipedia + 官网详情页；含モーニング娘。与 ℃-ute。

只做**解析**：拆表、清洗、投影。装配与网络在 build 层（见同文件下半部分）。

与等爱（love_members）的关系：照片回退链共享 `photo_chain`，但**解析完全不能复用**
—— 早安的表格有三处硬差异，实测把等爱的 parse_wiki_members 套上来得到 0 人：

1. 生年月日不写成 `{{生年月日と年齢|…}}`，而是 `1999年{{Display none|0}}7日{{Center|(…)}}`；
2. 出身地整格被 `{{Display none|…/}}[[静岡県]]` 包着，不是以 `[都道府県]$` 结尾；
3. **表里有 rowspan="2"**（加入年月日与加入期会合并相邻两行），于是有的行只有 8 格，
   按位置取列会串位 —— 必须先做行展开。

全部为纯函数（fixture 驱动测试）；网络经注入的 text fetcher 访问，测试离线。
"""
import re
import time

import ja_wiki
import photo_chain
import roster

SERIES = "morning"
FILE_PREFIX = "morningmusume"
GROUP = "モーニング娘。"

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


_BIRTH_TEMPLATE = re.compile(r"\{\{生年月日と年齢\|(\d+)\|(\d+)\|(\d+)\}\}")


def clean(cell, name=None):
    """把一个单元格洗成可用的纯文本：去脚注 → 拆管道链接 → 去残留模板 → 去标签。"""
    # Juice=Juice 的生日写成 `{{生年月日と年齢|2001|5|7}}`，其余团写成
    # `2001年5月7日`。不先还原成日期，_strip_templates 会把模板换成第一个参数
    # （「2001」），_date 再也认不出 —— 实测 birth 直接变空串。
    text = _BIRTH_TEMPLATE.sub(r"\1年\2月\3日", cell or "")
    text = _strip_refs(_strip_invisible(text))
    # 链接：带显示文字的取显示文字，否则取标题（去掉 disambiguator 的括号）
    def link(m):
        target, label = m.group(1), m.group(2)
        if label:
            return label
        return re.sub(r"\s*\(.*?\)\s*$", "", target)

    text = _LINK.sub(link, text)
    text = _strip_templates(text)
    text = text.replace("'''", "").replace("''", "")
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
    # 第一行可能是角色徽章而不是姓名（BEYOOOOONDS 的「リーダー」徽章写成
    # Small 模板 + 粗体，清洗后是方括号行），跳过方括号行。
    for ln in lines:
        if not ln.startswith("［") and not ln.startswith("["):
            return ln
    return lines[0] if lines else ""


def kana_of(cell_text):
    """从姓名格里取假名：`{{Display none|のなか みき/}}` 里那一份。
    早安的表没有独立的假名列，假名只在这个被隐藏的块里。"""
    t = cell_text or ""
    m = re.search(r"\{\{Display none\|([^}/]+)/\}\}", t)
    if m:
        return m.group(1).strip()
    # 其余团的假名写法（实测三种）：<small>(だんばら るる)</small>、
    # {{Small|（たにもと あみ）}}、裸的「（ひろせ あやか）」（こぶし）。
    # 裸括号那条要求内容是纯假名 —— 否则会把消歧义括号（`リンリン (1991年生…)`）当假名。
    # 其余写法（<small>(だんばら るる)</small>、{{Small|（たにもと あみ）}}、
    # 裸的「（ひろせ あやか）」）统一由这一条兜：要求内容是**纯假名**，
    # 消歧义括号（`リンリン (1991年生の歌手)`）含汉字数字，不会误命中。
    # 前两个写法不必各留一个分支 —— 变异实测删掉它们测试仍全绿（冗余）。
    m = re.search(r"[（(]([ぁ-ゖァ-ヺー\s]+)[）)]", t)
    return m.group(1).strip() if m else ""


def _header_name(text):
    """表头单元格的显示名：去掉 style/class 属性与 <br />，再压空白。

    表头可能写成 `! style="…" |名前`，也可能写成 `!加入期`（无属性无分隔符），
    后者要先把前导的 ! 剥掉，否则列名会变成「!加入期」而对不上 COLUMN_NORM。"""
    text = _strip_refs(text)
    text = text.lstrip("!").strip()
    text = re.sub(r"<br\s*/?>", "", text)
    text = re.sub(r"<small[^>]*>.*?</small>", "", text, flags=re.S)
    text = _LINK.sub(lambda m: m.group(2) or m.group(1), text)
    text = re.sub(r"\{\{[^{}]*\}\}", "", text)
    text = text.replace("'''", "").replace("''", "")
    # 残留的 `]]`/`}}`：wikilink 被上一行剥掉显示文字后可能留下半截
    text = re.sub(r"[]}]+$", "", text).lstrip("[{")
    text = re.sub(r"\s+", "", text)
    return text


def _split_attrs(text):
    """在**花括号深度 0** 的第一个 | 处切开属性与内容。

    不能直接 partition：格内容里自带 |（`{{Display none|しずおかけん/}}`），
    那样会把模板劈开、留下 `しずおかけん/}}静岡県` 这种残渣（我第一版就这么写的，
    现役表的每一格都脏）。
    """
    depth = 0
    bracket = 0
    for i, ch in enumerate(text):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth = max(0, depth - 1)
        elif text.startswith("[[", i):
            bracket += 1
        elif text.startswith("]]", i):
            bracket = max(0, bracket - 1)
        elif ch == "|" and depth == 0 and bracket == 0:
            return text[:i], text[i + 1 :]
    # 整段都没有深度 0 的 | → 这格**没有属性**，全部都是内容
    # （出身地那格就是这种：唯一的 | 在 {{Display none|…/}} 里面）
    return "", text


def _row_cells(lines):
    """把 `|-` 之后的行解析成 (rowspan, 单元格文本) 序列。"""
    cells = []
    for line in lines:
        # `!` 起始的格也算数据：BEYOOOOONDS 的「所属」列写成 `!rowspan="4" |C`，
        # 只认 `|` 会把它丢掉、后面所有列左移一格。
        if not line.startswith("|") and not line.startswith("!"):
            continue
        head, rest = _split_attrs(line[1:])
        span = re.search(r'rowspan\s*=\s*"?(\d+)"?', head)
        cells.append((int(span.group(1)) if span else 1, rest))
    return cells


NEWLINE = chr(10)  # 换行符：wikitext 是 CRLF 的场合也要能切


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
    while i < len(lines):
        line = lines[i]
        if line.startswith("!"):
            header.extend(_header_cells(line))
            i += 1
            continue
        # 多行表头：`|-` 之后若还是 `!`，**且那一串 `!` 之后紧跟 `|-`/`|}`**，
        # 那才是同一张表头的第二行（BEYOOOOONDS 的 グループ/ユニット）。
        # 少了后半个条件会把数据行里 `!rowspan="4" |C` 那种格当成表头吞掉 ——
        # 实测症状是整行左移一格（姓名取到了昵称）。
        if line.startswith("|-") and i + 1 < len(lines) and lines[i + 1].startswith("!"):
            j = i + 1
            while j < len(lines) and lines[j].startswith("!"):
                j += 1
            if j < len(lines) and (lines[j].startswith("|-") or lines[j].startswith("|}")):
                i += 1
                continue
        break
    return header, i


def _header_cells(line):
    """一个 `!` 行 → 一个或多个列名。

    - 属性与内容的分隔 `|` 不能直接 split：`![[ABO式血液型|血液型]]` 与
      `!身長{{R|na}}` 的 `|` 在链接/模板里，直接 split 会得到「血液型]]」「na}}」。
    - `colspan="2"` 要展开成两列，否则后面的列全部左移一格（BEYOOOOONDS）。
      第二列起用 `#2` 后缀命名 —— 没有消费点，只需要占住位置。
    """
    head, content = _split_attrs(line[1:])
    name = _header_name(content)
    span = re.search(r'colspan\s*=\s*"?(\d+)"?', head)
    n = int(span.group(1)) if span else 1
    return [name] + [f"{name}#{k}" for k in range(2, n + 1)]


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
    lines = text.split(NEWLINE)
    header, i = _read_header(lines)
    return _fill_rows(_read_blocks(lines, i), header, do_clean)


def _fill_rows(blocks, header, do_clean=True):
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
                val = clean(raw) if do_clean else raw.strip()
                norm = _norm_for(header[col]) if do_clean else None
                if norm:
                    val = norm(val)
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
    # 日期格式只有一个家（roster.ymd）—— 此前这里自己造了一遍格式串，
    # 改 roster.ymd 时早安静默留在旧格式（产物守卫只断形状、不认来源）。
    return roster.ymd(m.group(1), m.group(2), m.group(3))


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
    # ℃-ute「過去に在籍していたメンバー」那张表的列名**少了中间的括号**，
    # 两个源对毕业日的叫法不一样 —— 不归一的话那 3 人的 end 会是日文原文。
    "卒業・脱退日卒業公演会場": _date,
    # 工单 01（伞下九团）：毕业列的叫法有四种（`卒業・脱退日（発表日）…`、
    # `卒業・脱退日卒業公演会場`、`卒業・脱退日卒業公演の開催地`、
    # `卒業・脱退(日付/開催地/在籍日数)`、`卒業・脱退日`）—— 逐个写会一直漏，
    # 所以只留一个前缀键，由 _norm_for 做最长前缀匹配。
    "卒業・脱退": _date,
}


def _norm_for(header):
    """列名 → 归一函数：先精确、再最长前缀。

    各团的同一字段有四五种叫法（生日带不带「（現年齢）/（年齢）」、毕业列五种写法、
    昵称叫「ニックネーム」或「愛称」），逐个写进 COLUMN_NORM 会一直漏
    （アンジュルム 的 `卒業・脱退日卒業公演の開催地` 就漏了，实测红）。
    最长前缀避免歧义：`加入年月日（加入期）` 命中 `加入年月日` 而不是更短的 `加入`。
    """
    if header in COLUMN_NORM:
        return COLUMN_NORM[header]
    best = None
    for key, fn in COLUMN_NORM.items():
        if header.startswith(key) and (best is None or len(key) > len(best[0])):
            best = (key, fn)
    return best[1] if best else None


def raw_row(text):
    """与 split_rows 同构，但**不清洗**单元格 —— 给多行的昵称用。"""
    return split_rows(text, do_clean=False)


def cell(row, name):
    return row.get(name, "")


raw_cell = cell  # split_rows(clean=False) 时格本来就是原文，两者同义


def _col(row, *prefixes):
    """按**列名前缀**取值。

    各团的列名不齐：生日有「生年月日」「生年月日（現年齢）」「生年月日（年齢）」，
    毕业列有四种叫法，昵称有「ニックネーム」与「愛称」，还有脏列名残留的
    「血液型]]」被 _header_name 洗成「血液型」才恰好相等。前缀匹配让这些
    差异不再需要逐个写进 COLUMN_NORM。
    """
    for p in prefixes:
        for k, v in row.items():
            if k.startswith(p):
                return v
    return ""


def _split_vitals(v):
    """Juice=Juice 现役把「血液型 / 身長 / 出身地」塞在一格（换行分隔）里，拆开。

    按内容形状认而不是按位置认：某一行缺了（例如没写身高）也不会把出身地当成身高。
    """
    blood = height = frm = ""
    for line in (v or "").split("\n"):
        line = line.strip()
        if not line:
            continue
        if re.fullmatch(r"[ABO]+型", line):
            blood = line
        elif line.endswith("cm"):
            height = re.sub(r"\s+", "", line)
        elif not frm:
            frm = line
    return blood, height, frm


def _members_from_table(text, status, from_section=""):
    """字段取**清洗后**的行（姓名/日期/期生都已归一），昵称取**原始行** ——
    昵称要按 `<br />` 拆行，清洗过就看不出有几行了。
    注意**不要在这里再归一一次**：格值已经是 YYYY.MM.DD / N期生，
    再过一次 _date 会认不出（它的正则只认「1999年10月7日」这种原表形状）。"""
    out = []
    rows = split_rows(text)
    raws = raw_row(text)
    for row, raw in zip(rows, raws):
        name = _col(row, "名前")
        if not name:
            continue
        nick, aliases = parse_nick(_col(raw, "ニックネーム", "愛称"), name=name)
        # 触发条件按**形状**而不是精确列名：某团若写成「血液型/身長」（少一项）
        # 也要拆，缺的项空着（拆解本身已按内容形状认）。
        vitals = next(
            (
                v
                for k, v in row.items()
                if "血液型" in k and ("身長" in k or "出身地" in k)
            ),
            "",
        )
        if vitals:
            blood, height, frm = _split_vitals(vitals)
        else:
            blood = _col(row, "血液型")
            height = _col(row, "身長")
            frm = _col(row, "出身地")
        # 有的表写成「151 cm」（&nbsp; 清洗成空格），站内统一成 151cm
        if height.endswith("cm"):
            height = re.sub(r"\s+", "", height)
        out.append(
            {
                "name": name,
                "kana": kana_of(_col(raw, "名前")),
                "nick": nick,
                "nick_aliases": aliases,
                "status": status,
                "generation": row.get("加入期", ""),
                "birth": _col(row, "生年月日"),
                "blood": blood,
                "from": frm,
                "end": _col(row, "卒業・脱退"),
                # 身長只有部分团的表有；缺就空（决定 3：有就显示、没有就不占位）。
                "height": height,
                # 记下这张人来自哪个节：「解散時」那张表**没有毕业日列**，
                # 那 5 人的 end 必然空 —— 不记来源的话，下游分不清
                # 「源里没有这一列」与「解析失败」。
                "from_section": from_section.strip("= ").strip(),
            }
        )
    return out


# 每个团的**节配置**。加团 = 加一行，而不是往代码里堆第三个布尔。
#
# current / former 放的是**节标题原文**（条目里的写法），解析器按它们切文本。
# 「出现在哪个节」决定 status —— 站内只有 current / former 两值
# （grilling R1-Q2：卒業 与 脱退 一律 former），所以不引入第三个状态。
#
# ⚠️ ℃-ute 的 current 是**空列表**：它 2017 年就解散了，条目里根本没有现役节，
# 两张表都是毕业者（解散时全员 + 更早离团的人）。这不是特判，是数据本来的样子 ——
# 硬写「若无现役节就当全员毕业」会掩盖「某个团真的漏了现役节」这种源故障。
GROUPS = {
    "モーニング娘。": {
        "page": "モーニング娘。",
        "current": ["=== メンバー ==="],
        "former": ["=== 過去のメンバー ==="],
        "official": "/morningmusume/",
    },
    "℃-ute": {
        "page": "℃-ute",
        "current": [],
        "former": ["=== 解散時のメンバー ===", "=== 過去に在籍していたメンバー ==="],
        "end_year": 2017,
    },
    # ── 伞下九团（工单 01）。段标题是各条目里的原文；current 为空 = 该团已停止活动、
    #    条目里没有现役节（不是特判：℃-ute 先例，硬写「无现役节就当全员毕业」会掩盖源故障）。
    "アンジュルム": {
        "page": "アンジュルム",
        "current": ["=== 現在のメンバー ==="],
        "former": ["=== 元メンバー ==="],
        "official": "/angerme/",
    },
    "Juice=Juice": {
        "page": "Juice=Juice",
        "current": ["=== 現在のメンバー ==="],
        "former": ["=== 元メンバー ==="],
        "official": "/juicejuice/",
    },
    "つばきファクトリー": {
        "page": "つばきファクトリー",
        "current": ["=== 現在のメンバー ==="],
        "former": ["=== 元メンバー ==="],
        "official": "/tsubakifactory/",
    },
    "BEYOOOOONDS": {
        "page": "BEYOOOOONDS",
        "current": ["=== メンバー一覧 ==="],
        "former": [],
        "official": "/beyooooonds/",
    },
    "OCHA NORMA": {
        "page": "OCHA NORMA",
        "current": ["=== 現在のメンバー ==="],
        "former": ["=== 元メンバー ==="],
        "official": "/ochanorma/",
    },
    "ロージークロニクル": {
        "page": "ロージークロニクル",
        "current": ["== メンバー =="],
        "former": [],
        "official": "/rosychronicle/",
    },
    "Berryz工房": {
        "page": "Berryz工房",
        "current": [],
        "former": [
            "=== 無期限活動休止発表時のメンバー ===",
            "=== 過去に在籍していたメンバー ===",
        ],
        "end_year": 2015,
    },
    "カントリー・ガールズ": {
        "page": "カントリー・ガールズ",
        "current": [],
        "former": [
            "=== 活動休止時のメンバー ===",
            "=== 過去に在籍していたメンバー ===",
        ],
        "end_year": 2019,
    },
    "こぶしファクトリー": {
        "page": "こぶしファクトリー",
        "current": [],
        "former": ["=== 解散時のメンバー ===", "=== 旧メンバー ==="],
        "end_year": 2020,
    },
}

DEFAULT_GROUP = "モーニング娘。"


def _section_span(text, mark, following):
    """一个节的文本范围：从 mark 到 following 里的第一个标记为止（缺则到文末）。"""
    start = text.find(mark)
    if start < 0:
        return None
    ends = [text.find(m, start + len(mark)) for m in following]
    ends = [e for e in ends if e > start]
    return text[start : min(ends) if ends else len(text)]


def parse_wiki_members(wikitext, group=DEFAULT_GROUP):
    """按团解析一张条目，返回该团的成员列表。

    状态来自「出现在哪个节」—— 官方对离开的说法分「卒業」与「脱退」，站内一律
    former（grilling R1-Q2），所以「ハロプロへの在籍状況」那一列不参与判定。

    传一个没配过的团名返回空列表而不抛：装配层会先按全系列配置跑一遍，
    缺配置要静默跳过而不是让整条抓取停摆。
    """
    cfg = GROUPS.get(group)
    if not cfg:
        return []
    marks = list(cfg["current"]) + list(cfg["former"])
    out = []
    for mark in cfg["current"]:
        span = _section_span(wikitext, mark, marks)
        if span:
            out += _members_from_table(span, "current", mark)
    for mark in cfg["former"]:
        span = _section_span(wikitext, mark, marks)
        if span:
            out += _members_from_table(span, "former", mark)
    return out


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
    # 身高：只有℃-ute 那两张表有。决定 3「有就显示、没有就不占位」——
    # 空串直接不写进 bio，产物里就不会有这一键（资料卡少一行可以，造假值不行）。
    if wiki_row.get("height") and not bio.get("height"):
        bio["height"] = wiki_row["height"]
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


def _base_record(name, w, nick, nick_aliases, group=None):
    """必在的字段。期生与状态只来自 Wikipedia（官网没有这两项）。

    ⚠️ group **必须来自这条记录自己的来源**，不能写死成模块里的 GROUP ——
    我第一版那么写了，于是℃-ute 的 8 人**全部**被标成「モーニング娘。」、
    两个团并成一段，真实抓取时才看见（51 + 8 = 59 全在一个段里）。
    症状是「一个系列两个团」在任何单元测试里都过、只有跑真实装配才炸 ——
    因为那条路径（build_members）我当时没有两个团的用例。
    """
    g = group or w.get("group") or GROUP
    return {
        "name": name,
        "kana": w.get("kana") or "",
        "nick": nick,
        "nick_aliases": nick_aliases,
        "status": w.get("status") or "current",
        "group": g,
        "series": SERIES,
        "generation": w.get("generation") or "",
        "file": "{}:{}:{}".format(FILE_PREFIX, g, name),
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
    # 两源所属团不一致这件事不在这里判：跨团转籍（こぶし → Juice=Juice 那 4 人）
    # 是常态，由 _assemble 的「最近归属」规则统一处理，只有**两个现役团同时认领**
    # 才是真异常。_merge_one 只负责把同一个人、同一个团的两源拼起来。
    og, wg = item.get("group"), w.get("group")
    rec = _base_record(name, w, nick, nick_aliases, group=og or wg)
    rec.update(_optional_fields(detail, w))
    photo = item.get("photo")
    url = SITE + photo if photo else ""
    return rec, url


def parse_all(pages):
    """{团: wikitext} → {团: [成员记录]}（记录带 status 与 group）。

    解析与装配分开：`load` 只解析一次（此前为打印人数又跑了一遍 —— 11 团 22 次），
    装配只收数据、不再碰 wikitext。
    """
    return {
        group: [dict(m, group=group) for m in parse_wiki_members(text, group)]
        for group, text in pages.items()
    }


def build_members_from_wiki(pages):
    """只从 Wikipedia 装配（{团: wikitext}）；返回成员列表（照片不经手）。"""
    members, _urls = _assemble({}, parse_all(pages))
    return members


# 已停止活动团的**团体终止年份**：只在「同一个人在两团都毕业、且两边都没有逐人
# 毕业日」时当次级排序键（Berryz/カントリー/こぶし 的源表没有毕业日列）。
# 不写进成员数据 ——「空是事实，不许编」，它只用于归属裁决。
# 从 GROUPS 派生（加团只改那一处配置）。
GROUP_END_YEAR = {
    g: cfg["end_year"] for g, cfg in GROUPS.items() if cfg.get("end_year")
}


def _affinity(cand):
    """「最近归属」的排序键：现役优先，其次毕业日越晚越近，再次团体终止年份。

    没有第三个键的话，嗣永桃子（Berryz 2015 休止后仍在カントリー到 2017）两边
    毕业日都空、打平后按插入序取先到的 Berryz —— 审查实测，方向与「最近归属」相反。
    """
    return (
        1 if cand["status"] == "current" else 0,
        cand.get("end") or "",
        GROUP_END_YEAR.get(cand["group"], 0),
    )


def _assemble(official, parsed):
    """official: {团: {姓名: parse_list 项}}；parsed: {团: [成员记录]}（parse_all 的产物）。
    返回 (members, urls) —— 照片按 file 键索引，与 love_members 同契约。

    同一人跨团只留一份（工单 02 决定 2）：现役优先，其次毕业日较晚的归属，
    再次团体终止年份（见 GROUP_END_YEAR）。真实数据里的转籍者都从已停止活动的团
    转入现役团（人名与人数让产物测试钉，不在这里写第二份）。
    两份**现役**冲突才是数据异常（收伞式重叠），抛 ValueError 让人看见 ——
    「官网现役 + Wikipedia 毕业段」的旧冲突现在是转籍常态，取现役。
    """
    cands = {}
    order = []

    def add(key, cand):
        if key not in cands:
            cands[key] = []
            order.append(key)
        cands[key].append(cand)

    for group, by_name in (official or {}).items():
        for name, item in by_name.items():
            add(
                norm_name(name),
                {"group": group, "status": "current", "end": "", "official": item, "wiki": None},
            )
    for group, members in parsed.items():
        for m in members:
            add(
                norm_name(m["name"]),
                {
                    "group": group,
                    "status": m["status"],
                    "end": m.get("end", ""),
                    "official": None,
                    # group 由 parse_all 挂在记录上（_base_record 用它拼 file 键，
                    # 不带的话会回落成模块常量「モーニング娘。」——实测图片挂错团）
                    "wiki": m,
                },
            )

    members, urls = [], {}
    for key in order:
        group_cands = cands[key]
        currents = {c["group"] for c in group_cands if c["status"] == "current"}
        if len(currents) > 1:
            raise ValueError(
                "{} 同时是两个团的现役：{}（收伞式重叠）".format(
                    # 两源都可能缺席：`.get("wiki", {})` 在键存在且值为 None 时
                    # 返回 None → AttributeError（审查实测：官网+官网冲突这条路径
                    # 抛的不是 ValueError）。用 `or {}` 兜。
                    (group_cands[0].get("wiki") or {}).get("name")
                    or (group_cands[0].get("official") or {}).get("name")
                    or "?",
                    " / ".join(sorted(currents)),
                )
            )
        best = max(group_cands, key=_affinity)
        same = [c for c in group_cands if c["group"] == best["group"]]
        item = next((c["official"] for c in same if c["official"]), None) or {}
        w = next((c["wiki"] for c in same if c["wiki"]), None) or {}
        rec, url = _merge_one(item, w)
        if not rec:
            continue
        rec["group"] = best["group"]
        rec["series"] = SERIES
        members.append(rec)
        if url:
            urls[rec["file"]] = url
    return members, urls


def build_members(official, parsed):
    """official: {团: {姓名: parse_list 项（含 detail）}}；parsed: {团: [成员记录]}。
    返回 (members, urls)。合并规则见 _assemble。"""
    return _assemble(official, parsed)


OG_URL = "https://helloproject.com/og/"


def parse_og_page(html):
    """现官网 `/og/` 页 → {姓名: 照片 URL}。

    页面结构：每个卒业生一个 `class="MemberPanel"` 块，块内依次是
    照片 `<img src="/upload/images/<sha1>.webp">`、`MemberPanel__nameJa`、
    `MemberPanel__nameEn`。**姓名取 nameJa**（`img` 的 alt 是空的）。
    ⚠️ 每个块前还有一个 preload 的 `<link href=下一张图>` —— 取「块内第一个 `img`」
    而不是第一个 `href`，否则会把下一人的照片配给上一人。
    """
    out = {}
    for part in html.split('class="MemberPanel"')[1:]:
        img = re.search(r'<img src="([^"]+)"', part)
        name = re.search(r"MemberPanel__nameJa[^>]*>([^<]+)<", part)
        if not img or not name:
            continue
        url = img.group(1)
        if url.startswith("/"):
            url = "https://helloproject.com" + url
        out[name.group(1).strip()] = url
    return out


def resolve_former_photos(members, urls, fetch, warn=print, pause=0.0):
    """毕业成员的头像。**照片回退链**（CONTEXT）三节：

    1. **现官网 `/og/`**（仍在事务所的卒业生，官方肖像、500×500）—— 一页 37 人，
       一次抓取解析成「姓名 → 照片」映射；命中即止（官方肖像优先于 Commons）。
    2. **Wikipedia Commons**（现役与兜底；失败被 `commons_photo` 吞成 None）。
    3. **（若已知照片 URL）Wayback 取图** —— 旧官网快照源的钩子。

    取不到就 warn 并进缺图名单（站里显示占位卡）—— 缺图是**显式记录的状态**，
    不是静默降级。旧官网 Wayback 的逐成员解析见工单 02（`/og/` 覆盖不到的那批）。
    """
    og = {}
    try:
        og = parse_og_page(fetch(OG_URL))
    except Exception:
        og = {}
    for m in members:
        if m["status"] != "former" or m["file"] in urls:
            continue
        resolved = og.get(m["name"])
        # Commons 会限流：连打几十次会回 429，而 commons_photo 把失败吞成 None ——
        # 不节流时缺口名单会把「被限流」记成「源里没有照片」（等爱那轮实测过）。
        if not resolved and pause:
            time.sleep(pause)
        if not resolved:
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
    """早安是**一系列两团**（モーニング娘。+ ℃-ute），且期生有 18 期 —— 所以不分组，段 label 用团名本身；
    期生留在成员记录上（等爱只有一期，才把 GENERATION 塞进段）。"""
    if not members:
        return []
    # 按团分段，段的顺序跟 GROUPS 的配置顺序走 —— 稳定顺序才有可断言的产物。
    # optional 里要多带三个字段，理由与等爱相反：
    # - generation：モーニング娘。有 18 期，「按期生筛」必须逐人存（等爱只有一期，期生在段 label 上）
    # - nick_aliases：进搜索用的 haystack（grilling R1-Q3：昵称只显示第一个，其余仍要能被搜到）
    # - height：身高只在 bio 里且「有就显示」—— 空串由 build_bio 剔掉，不会进产物
    # roster.project 的可选字段集默认只有 bio，带不进来就等于字段被静默丢掉。
    optional = ("bio", "generation", "nick_aliases")
    out = []
    for group in GROUPS:
        rows = [m for m in members if m.get("group") == group]
        if not rows:
            continue
        out.append(roster.section(group, SERIES, group, rows, optional=optional))
    # 配置里没有的团（不该有，但要能看见而不是静默丢掉）
    stray = {m.get("group") for m in members} - set(GROUPS)
    if stray:
        raise ValueError("这些团没配在 GROUPS 里：{}".format(sorted(stray)))
    return out


# 官网只覆盖这个团：℃-ute 2017 年就解散了、官网首页那 7 个现役团里没有它，
# 猜过的路径全 404（决定 8）。它的成员全部来自 Wikipedia。
# 官网覆盖现役团；已停止活动的团没有官网页面。**从 GROUPS 派生** ——
# 生产侧加团只需在 GROUPS 里加一个 official 键（测试清单仍要跟着加，真实触点
# 清单见 `.scratch/deepening/24-group-config.md`）。
OFFICIAL_PATHS = {
    g: cfg["official"] for g, cfg in GROUPS.items() if "official" in cfg
}
OFFICIAL_GROUPS = list(OFFICIAL_PATHS)


def load(fetch, warn=print, photo=True):
    """抓官网（仅 OFFICIAL_GROUPS）+ 各团 Wikipedia 条目 + 毕业照片。返回 (members, urls)。"""
    official = {}
    for group in OFFICIAL_GROUPS:
        listing = parse_list(fetch(SITE + OFFICIAL_PATHS[group]))
        by_name = {}
        for item in listing:
            detail = parse_detail(fetch(SITE + item["path"]))
            merged = dict(item)
            merged["detail"] = detail
            merged["group"] = group
            by_name[item["name"]] = merged
        official[group] = by_name
        print("{}: {} 人（官网）".format(group, len(by_name)))

    pages = {
        g: ja_wiki.wiki_wikitext(cfg["page"], fetch, on_error="empty")
        for g, cfg in GROUPS.items()
    }
    parsed = parse_all(pages)
    for group in GROUPS:
        print("{}: {} 人（Wikipedia）".format(group, len(parsed.get(group, []))))
    members, urls = build_members(official, parsed)
    if photo:
        resolve_former_photos(members, urls, fetch, warn, pause=1.5)
    return members, urls


