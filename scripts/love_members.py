"""等爱系列（=LOVE / ≠ME / ≒JOY）成员数据：官网 + 日文 Wikipedia。

解析全部为纯函数（fixture 驱动测试）；网络经注入的 text fetcher 访问，测试离线。
"""
import json
import re
import urllib.parse

import roster

SERIES = "love"
GROUP_ORDER = ["=LOVE", "≠ME", "≒JOY"]
GENERATION = "1期生"

SITES = {
    "=LOVE": {"base": "https://equal-love.jp", "kind": "love"},
    "≠ME": {"base": "https://not-equal-me.jp", "kind": "me"},
    "≒JOY": {"base": "https://nearly-equal-joy.jp", "kind": "joy"},
}
LIST_PATH = "/feature/profile"
WIKI_API = "https://ja.wikipedia.org/w/api.php"

LOVE_ITEM = re.compile(
    r'<a href="[^"]*?(/feature/[a-z_0-9]+)"[^>]*>\s*<p class="thumb"><img[^>]*?url\(([^)]+)\)[^>]*></p>\s*</a>\s*<div class="txtSide">\s*<p class="name">\s*([^<]+?)\s*<span class="yomi">([^<]+)</span>',
    re.S,
)
ME_ITEM = re.compile(
    r'<a href="[^"]*?(/feature/profile_[a-z_0-9]+)"[^>]*>\s*<p class="thumb"><img[^>]*?url\(([^)]+)\)[^>]*></p>\s*</a>[\s\S]{0,240}?<span>([^<]+)</span>[\s\S]{0,80}?<p class="yomi[^"]*">([^<]+)</p>',
    re.S,
)
JOY_ITEM = re.compile(
    r'<a href="[^"]*?(/feature/profile_[a-z_0-9]+)"[^>]*>\s*<figure class="thumb[^"]*">\s*<img[^>]*?url\(([^)]+)\)[^>]*>\s*</figure>\s*</a>\s*<div class="txt[^"]*">\s*<p class="name">([^<]+)</p>\s*<p class="yomi">([^<]+)</p>',
    re.S,
)
ITEMS = {"love": LOVE_ITEM, "me": ME_ITEM, "joy": JOY_ITEM}

DETAIL_MAP = {
    "血液型": "blood",
    "星座": "sign",
    "身長": "height",
    "生年月日": "birth",
    "出身地": "from",
    "趣味": "hobby",
    "特技": "skill",
    "ニックネーム": "nick",
}


def norm_name(name):
    return re.sub(r"\s+", "", name or "")


WAYBACK_PREFIX = re.compile(r"^https?://web\.archive\.org/web/\d+[a-z]*_/")


def original_url(url):
    return WAYBACK_PREFIX.sub("", url.strip())


def strip_thumb(url):
    return re.sub(r"_thumb(\.\w+)$", r"\1", url)


def parse_list(html, kind):
    out = []
    for path, photo, name, romaji in ITEMS[kind].findall(html):
        out.append({
            "path": path,
            "name": re.sub(r"\s+", " ", name).strip(),
            "romaji": romaji.strip(),
            "photo": strip_thumb(original_url(photo)),
        })
    return out


def parse_detail(html):
    bio = {}
    for k, v in re.findall(r"<dt>([^<]+)</dt><dd>([^<]*)</dd>", html):
        key = DETAIL_MAP.get(k.strip())
        v = v.strip()
        if not key or not v:
            continue
        if key == "birth":
            m = re.match(r"(\d{4})/(\d{1,2})/(\d{1,2})$", v)
            if not m:
                continue
            v = roster.ymd(m.group(1), m.group(2), m.group(3))
        bio[key] = v
    return bio


def former_members_at(wikitext):
    """元メンバー 小节的位置：它的起点之前算现役，之后算毕业。"""
    former_at = len(wikitext)
    for heading in ("=== 元メンバー", "== 元メンバー"):
        i = wikitext.find(heading)
        if i >= 0:
            former_at = min(former_at, i)
    return former_at


def parse_nick(chunk):
    """爱称：优先血型后面那一格，兜底正文里的「愛称は、…」句式。

    血型后面那一格在部分行是「愛称」说明而不是昵称，要排除。"""
    nick = None
    blood = re.search(r"\|\|\s*(AB|A|B|O)型\s*\|\|", chunk)
    if blood:
        cell = re.match(r"\s*([^|{\n]{1,15}?)\s*\|\|", chunk[blood.end() :])
        if cell and "愛称" not in cell.group(1):
            nick = cell.group(1).strip()
    if not nick:
        alt = re.search(r"愛称は、([^<（(\n、]+)", chunk)
        if alt:
            nick = alt.group(1).strip()
    return nick


def parse_member_chunk(chunk):
    """一行成员单元格块 → (name, rec)；不是成员行时返回 None。

    行可能像 =LOVE 那样单行（名前 || よみ || …），也可能像 ≒JOY 那样
    跨两行（メンバーカラー 另起一行）；用「出身地是都道府县」过滤掉
    新闻/作品表里的误匹配行。"""
    if "{{生年月日と年齢" not in chunk:
        return None
    name = re.search(
        r"\n\|\s*(?:\[\[([^\]|]+)(?:\|[^\]]+)?\]\]|([^|\n]{2,20}?))\s*(?:\|\||\n)",
        chunk,
    )
    if not name:
        return None
    nm = (name.group(1) or name.group(2)).strip()
    kana_cell = re.match(r"\s*([^|\n]+?)\s*(?:\|\||\n)", chunk[name.end() :])
    birth = re.search(r"\{\{生年月日と年齢\|(\d+)\|(\d+)\|(\d+)\}\}", chunk)
    if not birth:
        return None
    pref = re.search(r"\}\}\s*\|\|\s*(?:\[\[([^|\]]+)\]\]|([^|\]\n]+?))\s*\|\|", chunk)
    from_ = (pref.group(1) or pref.group(2)).strip() if pref else ""
    if not re.search(r"[都道府県]$", from_):
        return None
    rec = {"from": from_}
    if kana_cell:
        rec["kana"] = kana_cell.group(1).strip()
    rec["birth"] = roster.ymd(birth.group(1), birth.group(2), birth.group(3))
    height = re.search(r"([\d.]+)\s*(?:&nbsp;)?\s*cm", chunk)
    if height:
        rec["height"] = height.group(1) + "cm"
    blood = re.search(r"\|\|\s*(AB|A|B|O)型\s*\|\|", chunk)
    if blood:
        rec["blood"] = blood.group(1) + "型"
    nick = parse_nick(chunk)
    if nick:
        rec["nick"] = nick
    return nm, rec


def parse_wiki_members(wikitext):
    """{名前: {kana, birth, from, height, blood, nick, former, grad}}。

    按 |- 切块后逐块交给 parse_member_chunk 解析。"""
    former_at = former_members_at(wikitext)
    out = {}
    for chunk_match in re.finditer(r"\n\|-([\s\S]*?)(?=\n\|-|\n\|\}|\n\n|$)", wikitext):
        chunk = chunk_match.group(1)
        parsed = parse_member_chunk(chunk)
        if parsed is None:
            continue
        nm, rec = parsed
        if chunk_match.start() >= former_at:
            rec["former"] = True
            grad = re.search(r"(\d{4})年(\d{1,2})月(\d{1,2})日", chunk)
            if grad:
                rec["grad"] = roster.ymd(grad.group(1), grad.group(2), grad.group(3))
        out[nm] = rec
    return out


def wiki_wikitext(title, fetch):
    url = WIKI_API + "?" + urllib.parse.urlencode(
        {"action": "parse", "page": title, "prop": "wikitext", "format": "json"}
    )
    return json.loads(fetch(url))["parse"]["wikitext"]["*"]


def cdx_rows(url, fetch, limit=6, prefix=False):
    params = {
        "url": url,
        "output": "json",
        "limit": str(limit),
        "filter": "statuscode:200",
        "collapse": "digest",
    }
    if prefix:
        params["matchType"] = "prefix"
    query = "http://web.archive.org/cdx/search/cdx?" + urllib.parse.urlencode(params)
    try:
        rows = json.loads(fetch(query) or "[]")
    except Exception:
        return []
    return rows[1:] if rows else []


def wayback_photo(url, fetch):
    rows = cdx_rows(url, fetch, limit=1)
    if not rows:
        return None
    return "https://web.archive.org/web/{}id_/{}".format(rows[0][1], url)


def commons_photo(name, fetch):
    query = WIKI_API + "?" + urllib.parse.urlencode(
        {"action": "query", "titles": name, "prop": "pageimages", "pithumbsize": "800", "format": "json"}
    )
    try:
        data = json.loads(fetch(query))
    except Exception:
        return None
    for page in data.get("query", {}).get("pages", {}).values():
        src = (page.get("thumbnail") or {}).get("source")
        if src:
            return src
    return None


def archived_photo_pairs(html):
    """归档列表页里的 {规范化姓名: 原始照片 URL}；容忍 #popup 锚点与 SNS 列表拆块。"""
    out = {}
    for chunk in re.split(r"<li\b", html):
        candidates = re.findall(r"url\(([^)]+?\.(?:jpe?g|png)[^)]*)\)", chunk)
        candidates += re.findall(r'src="([^"]+?\.(?:jpe?g|png)[^"]*)"', chunk)
        url = next(
            (
                u
                for u in candidates
                if not re.search(r"(dummy|logo|ico_|icon)", u, re.I)
            ),
            None,
        )
        if not url:
            continue
        name = re.search(r'<p class="name">\s*([^<\n]+?)\s*(?:<|$)', chunk)
        if not name:
            name = re.search(r"<span>([^<]+)</span>", chunk)
        if not name:
            continue
        out.setdefault(norm_name(name.group(1)), strip_thumb(original_url(url)))
    return out


def archived_list_photos(group, fetch):
    """官网列表页的历史快照里解析出的 {名前: 照片 URL}（覆盖已毕业成员）。"""
    site = SITES[group]
    list_url = site["base"] + LIST_PATH
    out = {}
    for row in cdx_rows(list_url, fetch, limit=8):
        ts = row[1]
        try:
            html = fetch("https://web.archive.org/web/{}id_/{}".format(ts, list_url))
        except Exception:
            continue
        for name, photo in archived_photo_pairs(html).items():
            out.setdefault(name, photo)
        for item in parse_list(html, site["kind"]):
            out.setdefault(norm_name(item["name"]), item["photo"])
    return out


def build_bio(item, w):
    """官网详情页的字段打底，Wikipedia 补空缺；官网没有的字段不进 bio。"""
    bio = {}
    if item and item.get("detail"):
        bio.update(item["detail"])
    for key in ("birth", "from", "height", "blood"):
        if w.get(key):
            bio.setdefault(key, w[key])
    if item and item.get("romaji"):
        bio["romaji"] = item["romaji"]
    return bio


def build_members(official, wiki):
    """official: {group: [parse_list 项（含 detail）]}；wiki: {group: parse_wiki_members}。
    返回 (members, urls)。"""
    members = []
    urls = {}
    for group in GROUP_ORDER:
        by_name = {norm_name(item["name"]): item for item in official.get(group, [])}
        wiki_group = wiki.get(group, {})
        wiki_by_norm = {norm_name(k): (k, v) for k, v in wiki_group.items()}
        keys = list(dict.fromkeys([*by_name.keys(), *wiki_by_norm.keys()]))
        for person_key in keys:
            pair = wiki_by_norm.get(person_key)
            w = pair[1] if pair else {}
            item = by_name.get(person_key)
            name = item["name"] if item else pair[0]
            bio = build_bio(item, w)
            rec = {
                "name": name,
                "kana": w.get("kana") or (item["romaji"].lower() if item else ""),
                "nick": w.get("nick") or "",
                "status": "former" if w.get("former") else "current",
                "group": group,
                "series": SERIES,
                "generation": GENERATION,
            }
            if w.get("grad"):
                rec["end"] = w["grad"]
            if bio:
                rec["bio"] = bio
            file_key = "love:{}:{}".format(group, name)
            rec["file"] = file_key
            photo = (item or {}).get("photo")
            if photo:
                urls[file_key] = photo
            members.append(rec)
    return members, urls


def resolve_former_photos(members, urls, fetch, warn=print):
    """官网列表缺照片的成员（通常是已毕业）：Web Archive 列表快照 → 快照图片 → Commons。"""
    need = [m for m in members if m["file"] not in urls]
    by_group = {}
    for m in need:
        by_group.setdefault(m["group"], []).append(m)
    for group, ms in by_group.items():
        photos = {norm_name(k): v for k, v in archived_list_photos(group, fetch).items()}
        for m in ms:
            photo = photos.get(norm_name(m["name"]))
            resolved = None
            if photo:
                resolved = wayback_photo(photo, fetch)
            if not resolved:
                resolved = commons_photo(m["name"], fetch)
            if resolved:
                urls[m["file"]] = resolved
            else:
                # 上游解析不到：仓库里已有照片的成员会沿用本地文件（img 仍为 true），
                # 只有连站内文件都没有的才真的显示占位。
                warn(
                    "warning: 等爱成员（多为已毕业）上游照片解析不到（沿用站内已有照片，若无则占位）：{} {}".format(
                        group, m["name"]
                    )
                )
    return members, urls


def load(fetch, warn=print):
    """抓取三个官网 + Wikipedia 并装配；返回 (members, urls)。"""
    official = {}
    for group, site in SITES.items():
        html = fetch(site["base"] + LIST_PATH)
        items = parse_list(html, site["kind"])
        for item in items:
            detail = fetch(site["base"] + item["path"])
            item["detail"] = parse_detail(detail)
        official[group] = items
        print("{}: {} 人（官网）".format(group, len(items)))
    wiki = {}
    for group in GROUP_ORDER:
        text = wiki_wikitext(group, fetch)
        wiki[group] = parse_wiki_members(text)
        print("{}: {} 人（Wikipedia）".format(group, len(wiki[group])))
    members, urls = build_members(official, wiki)
    resolve_former_photos(members, urls, fetch, warn)
    return members, urls


def build_sections(members):
    grouped = {}
    for m in members:
        grouped.setdefault(m["group"], []).append(m)
    out = []
    for group in GROUP_ORDER:
        ms = grouped.get(group)
        if not ms:
            continue
        out.append(roster.section(group, SERIES, GENERATION, ms))
    return out
