"""Build members.js and compressed portraits from 48pedia.

usage: python fetch_members.py            # fetch lists, download, compress
       python fetch_members.py --no-dl    # reuse cached originals only
       python fetch_members.py --force    # recompress even if outputs are up to date
env AKB_PROXY overrides the proxy (default http://127.0.0.1:7897, empty = direct)
"""
import hashlib
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from functools import partial

from PIL import Image, ImageOps

import love_members
import roster
from wiki import api, get, wikitext

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIG = os.path.join(ROOT, "scripts", "_orig")
FULL = os.path.join(ROOT, "img", "full")
THUMB = os.path.join(ROOT, "img", "thumb")

FULL_BOX = (720, 960)
FULL_Q = 88
THUMB_W = 240
THUMB_Q = 84

EXCLUDE = ("バイトAKB",)

GROUP_ORDER = ("AKB48", "SKE48", "NMB48", "HKT48", "NGT48", "STU48", "SDN48", "乃木坂46", "櫻坂46", "日向坂46")
GROUPS_48G = GROUP_ORDER[:7]
GROUPS_SAKAMICHI = GROUP_ORDER[7:]
SERIES_OF = {g: "48g" for g in GROUPS_48G} | {g: "sakamichi" for g in GROUPS_SAKAMICHI}

# (group, page, default status for sections that are not "現役メンバー")
SOURCES = (
    ("AKB48", "AKB48メンバー一覧", "current"),
    ("AKB48", "AKB48元メンバー一覧", "former"),
    ("SKE48", "SKE48メンバー一覧", "former"),
    ("NMB48", "NMB48メンバー一覧", "former"),
    ("HKT48", "HKT48メンバー一覧", "former"),
    ("NGT48", "NGT48メンバー一覧", "former"),
    ("STU48", "STU48メンバー一覧", "former"),
    ("SDN48", "SDN48メンバー一覧", "former"),
    ("乃木坂46", "乃木坂46メンバー一覧", "former"),
    ("櫻坂46", "櫻坂46メンバー一覧", "former"),
    ("日向坂46", "日向坂46メンバー一覧", "former"),
)


def clean_name(s):
    s = re.sub(r'^data-sort-value="[^"]*"\s*\|\s*', "", s.strip())
    m = re.match(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]", s)
    if m:
        return (m.group(2) or m.group(1)).strip(), m.group(1).strip()
    return re.sub(r"<[^>]+>", "", s).strip(), None


def split_sections(text):
    """Split wikitext into (heading, body) pairs; the lead gets heading ""."""
    parts = re.split(r"(?m)^=+([^=\n]+)=+[ \t]*$", text)
    out = []
    if parts[0].strip():
        out.append(("", parts[0]))
    for i in range(1, len(parts) - 1, 2):
        out.append((parts[i].strip(), parts[i + 1]))
    return out


def status_of(title, default):
    return "current" if "現役" in title else default


def parse_page(text, group, default_status):
    """Parse every member section of one page, tagging rows with their group."""
    rows = []
    for title, body in split_sections(text):
        where = f"{group}/{title or '首段'}"
        for r in parse_rows(body, status_of(title, default_status), where=where):
            r["group"] = group
            r["series"] = SERIES_OF[group]
            rows.append(r)
    return rows


def name_kana_from_chunk(chunk, f):
    r = re.search(r"\{\{ルビ\|((?:\[\[[^\]]*\]\])|[^|]+)\|([^}]*)\}\}", chunk)
    if r:
        name, page = clean_name(r.group(1))
        return name, page, r.group(2).strip()
    if f:
        line = chunk.split(f.group(0), 1)[1].split("\n| ", 1)[1].split("\n")[0]
        name, page = clean_name(line)
        return name, page, ""
    return None, None, None


def looks_like_row(chunk, f):
    return bool(f) or "{{ルビ|" in chunk


def is_file_line(line):
    return bool(re.search(r"\[\[(?:ファイル|File):", line))


def row_line_index(lines, name):
    for i, ln in enumerate(lines):
        if "{{ルビ|" in ln:
            return i
        if name in ln and not is_file_line(ln):
            return i
    return None


def clean_nick(raw):
    nick = re.sub(r"<[^>]+>|\[\[|\]\]|\{\{[^}]*\}\}", "", raw).strip()
    if nick.startswith(("style=", "data-")) or re.search(r'\w+="', nick) or len(nick) > 30:
        return ""
    return nick


def nick_from_chunk(chunk, name):
    lines = chunk.split("\n")
    idx = row_line_index(lines, name)
    if idx is None or idx + 1 >= len(lines) or not lines[idx + 1].startswith("|"):
        return ""
    return clean_nick(lines[idx + 1][1:])


def end_leave_from_chunk(chunk):
    end = None
    dates = re.findall(r"\{\{年月日\|(\d{4})\|(\d*)\|(\d*)\}\}", chunk)
    if dates:
        y, mo, d = dates[-1]
        end = f"{y}.{mo.zfill(2)}.{d.zfill(2)}" if mo else y
    else:
        m = re.search(r'data-sort-value="(\d{4})(\d{2})(\d{2})"', chunk)
        if m:
            end = f"{m.group(1)}.{m.group(2)}.{m.group(3)}"
    reason = re.search(r"<br>（([^）]+)）", chunk)
    if not reason:
        reason = re.search(r'data-sort-value="\d{8}"\s*\|（([^）]+)）', chunk)
    return end, (reason.group(1).strip() if reason else None)


def birth_from_chunk(chunk):
    m = re.search(
        r"\{\{(?:生年月日|生年月日と年齢)\|(\d{4})\|(\d{1,2})\|(\d{1,2})\}\}", chunk
    )
    if not m:
        return None
    y, mo, d = m.groups()
    return f"{y}.{mo.zfill(2)}.{d.zfill(2)}"


def hometown_from_chunk(chunk):
    m = re.search(r"\{\{出身地\|([^}|]+)\}\}", chunk)
    return m.group(1).strip() if m else None


def parse_chunk(chunk, status):
    """Return (row, skipped) for one table row; row is None when unparsable."""
    f = re.search(r"\[\[(?:ファイル|File):([^|\]]+)", chunk)
    j = re.search(r"\{\{加入期\|([^}]*)\}\}", chunk)
    if not j:
        return None, looks_like_row(chunk, f)
    name, page, kana = name_kana_from_chunk(chunk, f)
    if name is None:
        return None, False
    if status == "former":
        end, leave = end_leave_from_chunk(chunk)
    else:
        end, leave = None, None
    team = re.search(r"\{\{!チーム\|([^}]*)\}\}", chunk)
    bio = {}
    birth = birth_from_chunk(chunk)
    if birth:
        bio["birth"] = birth
    hometown = hometown_from_chunk(chunk)
    if hometown:
        bio["from"] = hometown
    row = {
        "name": name,
        "page": page,
        "kana": kana,
        "nick": nick_from_chunk(chunk, name),
        "join": j.group(1).strip(),
        "team": team.group(1) if team else "",
        "file": f.group(1).strip() if f else "",
        "status": status,
        "end": end,
        "leave": leave,
    }
    if bio:
        row["bio"] = bio
    return row, False


def parse_rows(text, status, where=""):
    rows = []
    skipped = 0
    for chunk in re.split(r"\n\|-[^\n]*", text):
        row, dirty = parse_chunk(chunk, status)
        if dirty:
            skipped += 1
        if row:
            rows.append(row)
    if skipped:
        print(f"warning: 跳过 {skipped} 行缺加入期（{where or '未标注位置'}）")
    return rows


KANJI_DIGITS = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}
HISTORICAL_SUFFIX = {"日向坂46": {"欅坂46"}}


def kanji_to_int(s):
    if "十" not in s:
        return KANJI_DIGITS[s]
    tens, _, ones = s.partition("十")
    return (KANJI_DIGITS[tens] if tens else 1) * 10 + (KANJI_DIGITS[ones] if ones else 0)


def generation_key(label):
    if re.fullmatch(r"[\d.]+", label):
        return float(label)
    return float(kanji_to_int(label))


def generation_section(join, group):
    m = re.match(r"([\d.]+|[一二三四五六七八九十]+)期\|(.+)$", join)
    if not m:
        return None
    suffix = m.group(2).strip()
    allowed = {group} | HISTORICAL_SUFFIX.get(group, set())
    if suffix not in allowed:
        return None
    return (generation_key(m.group(1)), f"{m.group(1)}期生")


def draft_section(join):
    m = re.match(r"(\d)期\|ドラフト$", join)
    if m:
        return (110 + int(m.group(1)), f"选秀{m.group(1)}期生")
    return None


def is_foreign_join(join, group):
    return "|" in join and not join.endswith("|" + group)


def group_of(join, group):
    """Return (sort_key, label) for the accordion section inside one group."""
    section = generation_section(join, group)
    if section:
        return section
    if group == "AKB48" and join.startswith("チーム8"):
        return (100, "Team 8")
    section = draft_section(join)
    if section:
        return section
    if is_foreign_join(join, group):
        return (130, "兼任・移籍加入")
    return (140, "其他")


def note_of(join):
    m = re.match(r"([\d.]+|[一二三四五六七八九十]+)期\|(.+)$", join)
    return f"{m.group(2)} {m.group(1)}期" if m else join


def member_rank(r):
    """Prefer current records, then the latest leave date, then the home group."""
    return (r["status"] == "current", r["end"] or "", r["join"].endswith("|" + r["group"]))


def merge_person(records):
    if len(records) == 1:
        return records[0]
    keeper = max(records, key=member_rank)
    bio = {}
    for r in records:
        bio.update(r.get("bio") or {})
    if bio:
        keeper["bio"] = {**bio, **(keeper.get("bio") or {})}
    extras = {}
    for r in records:
        if r is keeper:
            continue
        entry = extras.setdefault(r["group"], {"group": r["group"], "current": False})
        entry["current"] = entry["current"] or r["status"] == "current"
    keeper["extras"] = list(extras.values())
    return keeper


def merge_members(rows):
    """Merge the same person (name + kana) appearing in several groups."""
    by_person = {}
    for r in rows:
        by_person.setdefault((r["name"], r["kana"]), []).append(r)
    return [merge_person(records) for records in by_person.values()]


def slug(name):
    return "m" + hashlib.md5(name.encode("utf-8")).hexdigest()[:10]


def assign_ids(members):
    seen_names = set()
    for m in members:
        suffix = "" if m["name"] not in seen_names else "#" + (m.get("join") or "")
        m["id"] = slug(m["name"] + suffix)
        seen_names.add(m["name"])


def section_key(m):
    key, label = group_of(m["join"], m["group"])
    if key >= 130 and not m.get("note") and not m.get("extras"):
        m["note"] = note_of(m["join"])
    return (GROUP_ORDER.index(m["group"]), key, label)


def build_sections(members):
    grouped = {}
    for m in members:
        grouped.setdefault(section_key(m), []).append(m)

    out = []
    for (gi, key, label), ms in sorted(grouped.items()):
        out.append(
            roster.section(
                GROUP_ORDER[gi],
                SERIES_OF[GROUP_ORDER[gi]],
                label,
                ms,
                optional=("bio", "leave", "note", "extras"),
            )
        )
    return out


def write_members_js(sections, path):
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("// generated by scripts/fetch_members.py from 48pedia.org\n")
        fh.write("window.AKB_GROUPS = ")
        json.dump(sections, fh, ensure_ascii=False, indent=1)
        fh.write(";\n")


def build_simplified(names, convert=None):
    """Return {simplified: [source forms...]} for name chars that need folding."""
    if convert is None:
        try:
            from opencc import OpenCC
        except ImportError:
            print("warning: 未安装 opencc，跳过 simplified.js 生成（pip install opencc）")
            return None
        t2s = OpenCC("t2s")
        try:
            jp2t = OpenCC("jp2t")
        except Exception:
            jp2t = None
        convert = (lambda ch: t2s.convert(jp2t.convert(ch))) if jp2t else t2s.convert
    pairs = {}
    for name in names:
        for ch in name:
            sim = convert(ch)
            if sim != ch:
                forms = pairs.setdefault(sim, [])
                if ch not in forms:
                    forms.append(ch)
    return pairs


def write_simplified_js(pairs, path):
    body = json.dumps(pairs, ensure_ascii=False, separators=(",", ":"))
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("// generated by scripts/fetch_members.py from 48pedia.org\n")
        fh.write(f"window.AKB_SIMPLIFIED = {body};\n")


def prune_unused(keep, dirs):
    removed = 0
    for d in dirs:
        for fn in os.listdir(d):
            if os.path.splitext(fn)[0] not in keep:
                os.remove(os.path.join(d, fn))
                removed += 1
    return removed


def image_urls(files, api_fn=api):
    out = {}
    for i in range(0, len(files), 50):
        batch = files[i:i + 50]
        data = api_fn(action="query", prop="imageinfo", iiprop="url|size",
                      titles="|".join("ファイル:" + f for f in batch))
        norm = {n["to"]: n["from"] for n in data["query"].get("normalized", [])}
        for p in data["query"]["pages"].values():
            ii = p.get("imageinfo")
            if not ii:
                continue
            title = norm.get(p["title"], p["title"])
            out[title.split(":", 1)[1]] = ii[0]["url"]
    return out


def download(args, orig_dir=ORIG, fetch=get):
    mid, url = args
    path = os.path.join(orig_dir, mid + os.path.splitext(url)[1].lower())
    if not os.path.exists(path):
        data = fetch(url)
        with open(path, "wb") as fh:
            fh.write(data)
    return mid, path


def download_all(jobs, fetch=get, orig_dir=ORIG, workers=6):
    paths = {}
    with ThreadPoolExecutor(workers) as ex:
        mapped = ex.map(partial(download, orig_dir=orig_dir, fetch=fetch), jobs)
        for n, (mid, p) in enumerate(mapped, 1):
            paths[mid] = p
            if n % 50 == 0:
                print(f"downloaded {n}/{len(jobs)}")
    return paths


def cached_image_paths(jobs, orig_dir=ORIG):
    paths = {}
    for mid, url in jobs:
        p = os.path.join(orig_dir, mid + os.path.splitext(url)[1].lower())
        if os.path.exists(p):
            paths[mid] = p
    return paths


def compress(mid, path, force=False, full_dir=FULL, thumb_dir=THUMB):
    outs = [
        os.path.join(full_dir, mid + ".webp"),
        os.path.join(thumb_dir, mid + ".webp"),
    ]
    if not force and all(os.path.exists(o) and os.path.getmtime(o) > os.path.getmtime(path) for o in outs):
        return Image.open(path).size, None
    im = Image.open(path)
    im = ImageOps.exif_transpose(im).convert("RGB")
    full = im.copy()
    full.thumbnail(FULL_BOX, Image.LANCZOS)
    # small originals are already the official profile size; avoid a lossy second generation
    q = FULL_Q if full.size != im.size else 94
    full.save(os.path.join(full_dir, mid + ".webp"), "WEBP", quality=q, method=6)
    w, h = im.size
    th = im.resize((THUMB_W, round(h * THUMB_W / w)), Image.LANCZOS)
    th.save(os.path.join(thumb_dir, mid + ".webp"), "WEBP", quality=THUMB_Q, method=6)
    return im.size, full.size


def load_rows(fetch_page=wikitext, sources=SOURCES, exclude=EXCLUDE):
    rows = []
    for group, page, default in sources:
        page_rows = parse_page(fetch_page(page), group, default)
        print(f"{group:5s} {page}: {len(page_rows)}")
        rows.extend(page_rows)
    return [r for r in rows if not r["join"].startswith(exclude)]


def parse_args(argv):
    argv = sys.argv[1:] if argv is None else argv
    return "--no-dl" in argv, "--force" in argv


def report_missing_info(missing):
    if missing:
        print("no image info:", missing)


def warn_missing_images(members):
    no_img = [m["name"] for m in members if not m["img"]]
    if no_img:
        print(f"warning: {len(no_img)} 位成员没有照片（界面显示占位）：{'、'.join(no_img[:10])}")


def report_removed(removed):
    if removed:
        print(f"removed {removed} unused image files")


def report_generation(sections, members, sizes):
    total = sum(len(g["members"]) for g in sections)
    print(f"groups {len(sections)}  members {total}  with image {sum(m['img'] for m in members)}")
    if sizes:
        ws = sorted(s[0] for s in sizes)
        hs = sorted(s[1] for s in sizes)
        print(f"original size median {ws[len(ws)//2]}x{hs[len(hs)//2]}  min {ws[0]}x{hs[0]}  max {ws[-1]}x{hs[-1]}")


def compress_members(members, paths, force, full_dir=FULL, thumb_dir=THUMB):
    sizes = []
    for m in members:
        p = paths.get(m["id"])
        m["img"] = bool(p)
        if p:
            try:
                sizes.append(compress(m["id"], p, force, full_dir, thumb_dir)[0])
            except Exception as e:
                print("compress failed", m["name"], e)
                m["img"] = False
    return sizes


def member_files(members):
    return sorted({m["file"] for m in members if m["file"]})


def resolve_missing(members, urls):
    return [m["name"] for m in members if m["file"] and m["file"] not in urls]


def collect_paths(members, urls, no_dl, fetch_url, orig_dir=ORIG):
    jobs = [(m["id"], urls[m["file"]]) for m in members if m["file"] in urls]
    if no_dl:
        return cached_image_paths(jobs, orig_dir)
    return download_all(jobs, fetch_url, orig_dir)


def default_dirs():
    return {"root": ROOT, "orig": ORIG, "full": FULL, "thumb": THUMB}


def main(
    argv=None,
    dirs=None,
    fetch_page=wikitext,
    api_fn=api,
    fetch_url=get,
    love_loader=None,
):
    no_dl, force = parse_args(argv)
    dirs = dirs or default_dirs()
    if love_loader is None:
        love_loader = love_members.load
    for d in (dirs["orig"], dirs["full"], dirs["thumb"]):
        os.makedirs(d, exist_ok=True)

    members = merge_members(load_rows(fetch_page))
    print(f"members after dedupe: {len(members)}")

    love = []
    love_urls = {}
    if love_loader:
        try:
            love, love_urls = love_loader(
                lambda url: fetch_url(url).decode("utf-8", "replace")
            )
        except Exception as e:
            raise SystemExit(
                f"等爱系列抓取失败（{e}）；为避免误删已有数据与图片，本次不写入。"
                "网络恢复后重试即可；本脚本不会在等爱失败时降级只写 48G/坂道。"
            )

    all_members = members + love
    assign_ids(all_members)

    urls = image_urls(member_files(members), api_fn)
    urls.update(love_urls)
    report_missing_info(resolve_missing(members, urls))

    paths = collect_paths(all_members, urls, no_dl, fetch_url, dirs["orig"])
    sizes = compress_members(all_members, paths, force, dirs["full"], dirs["thumb"])
    warn_missing_images(all_members)
    report_removed(
        prune_unused(
            {m["id"] for m in all_members},
            (dirs["orig"], dirs["full"], dirs["thumb"]),
        )
    )

    sections = build_sections(members) + love_members.build_sections(love)
    write_members_js(sections, os.path.join(dirs["root"], "members.js"))
    simplified = build_simplified([m["name"] for m in all_members])
    if simplified is not None:
        write_simplified_js(simplified, os.path.join(dirs["root"], "simplified.js"))
    report_generation(sections, all_members, sizes)


if __name__ == "__main__":
    main()
