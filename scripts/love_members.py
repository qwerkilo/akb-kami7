"""等爱系列（=LOVE / ≠ME / ≒JOY）成员数据：官网 + 日文 Wikipedia。

解析全部为纯函数（fixture 驱动测试）；网络经注入的 text fetcher 访问，测试离线。
"""
import re

import fetch_pool
import ja_wiki
import photo_chain
import progress
import roster

# re-export：既有测试按 love_members.WIKI_API 找它（常量现在住在 ja_wiki）
WIKI_API = ja_wiki.WIKI_API

SERIES = "love"
GROUP_ORDER = ["=LOVE", "≠ME", "≒JOY"]
GENERATION = "1期生"

SITES = {
    "=LOVE": {"base": "https://equal-love.jp", "kind": "love"},
    "≠ME": {"base": "https://not-equal-me.jp", "kind": "me"},
    "≒JOY": {"base": "https://nearly-equal-joy.jp", "kind": "joy"},
}
LIST_PATH = "/feature/profile"

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
    rec.update(_member_optional(chunk))
    return nm, rec


def _member_optional(chunk):
    """身高/血型/昵称：有才带上。"""
    rec = {}
    height = re.search(r"([\d.]+)\s*(?:&nbsp;)?\s*cm", chunk)
    if height:
        rec["height"] = height.group(1) + "cm"
    blood = re.search(r"\|\|\s*(AB|A|B|O)型\s*\|\|", chunk)
    if blood:
        rec["blood"] = blood.group(1) + "型"
    nick = parse_nick(chunk)
    if nick:
        rec["nick"] = nick
    return rec


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
    for row in photo_chain.cdx_rows(list_url, fetch, limit=8):
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


def _member_record(group, item, wiki_name, w, urls):
    """一个人的记录。官网项优先，Wikipedia 兜底；照片 URL 顺手写进 urls。"""
    name = item["name"] if item else wiki_name
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
    bio = build_bio(item, w)
    if bio:
        rec["bio"] = bio
    file_key = "love:{}:{}".format(group, name)
    rec["file"] = file_key
    photo = (item or {}).get("photo")
    if photo:
        urls[file_key] = photo
    return rec


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
            wiki_name = pair[0] if pair else None
            item = by_name.get(person_key)
            members.append(_member_record(group, item, wiki_name, w, urls))
    return members, urls


def _needs_photo(m, urls, skip):
    """这个人要不要解析照片：还没有 URL，且不在增量跑的跳过名单里（ADR-0023）。"""
    if m["file"] in urls:
        return False
    return not (skip and skip(m))


def resolve_former_photos(members, urls, fetch, warn=print, skip=None):
    """官网列表缺照片的成员（通常是已毕业）：Web Archive 列表快照 → 快照图片 → Commons。

    `skip(member)` 为真的人不解析（增量跑：已有站内照片，ADR-0023）。
    """
    need = [m for m in members if _needs_photo(m, urls, skip)]
    by_group = {}
    for m in need:
        by_group.setdefault(m["group"], []).append(m)
    for group, ms in by_group.items():
        photos = {norm_name(k): v for k, v in archived_list_photos(group, fetch).items()}
        for m in ms:
            photo = photos.get(norm_name(m["name"]))
            resolved = None
            if photo:
                resolved = photo_chain.wayback_photo(photo, fetch)
            if not resolved:
                resolved = photo_chain.commons_photo(m["name"], fetch)
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


def load(fetch, warn=print, skip_photo=None):
    """抓取三个官网 + Wikipedia 并装配；返回 (members, urls)。"""

    official = {}
    # 官网详情页是这里最慢的一段（每团 1 列表 + 每人 1 详情）：给心跳，别让日志静默
    # 总数在列表抓完前不知道（每团的详情数不同）→ 不写 total，心跳只报累计数
    with progress.stage("等爱：官网列表+详情") as st:
        for group, site in SITES.items():
            html = fetch(site["base"] + LIST_PATH)
            items = parse_list(html, site["kind"])
            urls = [site["base"] + item["path"] for item in items]
            # 详情页彼此独立：并发取（按主机限流），解析仍按列表顺序
            details = fetch_pool.fetch_many(
                urls, fetch, host="www.helloproject.com"
            )
            for item in items:
                item["detail"] = parse_detail(details[site["base"] + item["path"]])
                st.tick()
            official[group] = items
            print("{}: {} 人（官网）".format(group, len(items)))
    wiki = {}
    with progress.stage("等爱：Wikipedia", total=len(GROUP_ORDER)) as st:
        texts = fetch_pool.fetch_many(
            list(GROUP_ORDER),
            lambda g: ja_wiki.wiki_wikitext(g, fetch),
            host="ja.wikipedia.org",
        )
        for group in GROUP_ORDER:
            wiki[group] = parse_wiki_members(texts[group])
            st.tick()
            print("{}: {} 人（Wikipedia）".format(group, len(wiki[group])))
    members, urls = build_members(official, wiki)
    resolve_former_photos(members, urls, fetch, warn, skip=skip_photo)
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
