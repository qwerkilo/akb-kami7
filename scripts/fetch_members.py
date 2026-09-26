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

from PIL import Image, ImageOps

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

GROUP_ORDER = ("AKB48", "SKE48", "NMB48", "HKT48", "NGT48", "STU48", "SDN48")

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
        for r in parse_rows(body, status_of(title, default_status)):
            r["group"] = group
            rows.append(r)
    return rows


def parse_rows(text, status):
    rows = []
    for chunk in re.split(r"\n\|-[^\n]*", text):
        f = re.search(r"\[\[(?:ファイル|File):([^|\]]+)", chunk)
        j = re.search(r"\{\{加入期\|([^}]*)\}\}", chunk)
        if not j:
            continue
        r = re.search(r"\{\{ルビ\|((?:\[\[[^\]]*\]\])|[^|]+)\|([^}]*)\}\}", chunk)
        if r:
            name, page = clean_name(r.group(1))
            kana = r.group(2).strip()
        elif f:
            line = chunk.split(f.group(0), 1)[1].split("\n| ", 1)[1].split("\n")[0]
            name, page = clean_name(line)
            kana = ""
        else:
            continue
        lines = chunk.split("\n")
        idx = next(
            (
                i
                for i, ln in enumerate(lines)
                if "{{ルビ|" in ln
                or (name in ln and not re.search(r"\[\[(?:ファイル|File):", ln))
            ),
            None,
        )
        nick = ""
        if idx is not None and idx + 1 < len(lines) and lines[idx + 1].startswith("|"):
            nick = re.sub(r"<[^>]+>|\[\[|\]\]|\{\{[^}]*\}\}", "", lines[idx + 1][1:]).strip()
            if nick.startswith(("style=", "data-")) or re.search(r'\w+="', nick) or len(nick) > 30:
                nick = ""
        end = None
        leave = None
        if status == "former":
            dates = re.findall(r"\{\{年月日\|(\d{4})\|(\d*)\|(\d*)\}\}", chunk)
            if dates:
                y, mo, d = dates[-1]
                end = f"{y}.{mo.zfill(2)}.{d.zfill(2)}" if mo else y
            reason = re.search(r"<br>（([^）]+)）", chunk)
            if reason:
                leave = reason.group(1).strip()
        team = re.search(r"\{\{!チーム\|([^}]*)\}\}", chunk)
        rows.append({
            "name": name,
            "page": page,
            "kana": kana,
            "nick": nick,
            "join": j.group(1).strip(),
            "team": team.group(1) if team else "",
            "file": f.group(1).strip() if f else "",
            "status": status,
            "end": end,
            "leave": leave,
        })
    return rows


def group_of(join, group):
    """Return (sort_key, label) for the accordion section inside one group."""
    m = re.match(r"([\d.]+)期\|" + re.escape(group) + r"$", join)
    if m:
        n = float(m.group(1))
        return (n, f"{m.group(1)}期生")
    if group == "AKB48" and join.startswith("チーム8"):
        return (100, "Team 8")
    m = re.match(r"(\d)期\|ドラフト$", join)
    if m:
        return (110 + int(m.group(1)), f"选秀{m.group(1)}期生")
    if "|" in join and not join.endswith("|" + group):
        return (130, "兼任・移籍加入")
    return (140, "其他")


def note_of(join):
    m = re.match(r"([\d.]+期)\|(.+)$", join)
    return f"{m.group(2)} {m.group(1)}" if m else join


def member_rank(r):
    """Prefer current records, then the latest leave date, then the home group."""
    return (r["status"] == "current", r["end"] or "", r["join"].endswith("|" + r["group"]))


def merge_members(rows):
    """Merge the same person (name + kana) appearing in several groups."""
    by_person = {}
    for r in rows:
        by_person.setdefault((r["name"], r["kana"]), []).append(r)

    merged = []
    for records in by_person.values():
        if len(records) == 1:
            merged.append(records[0])
            continue
        keeper = max(records, key=member_rank)
        others = [r for r in records if r is not keeper]
        groups = list(dict.fromkeys(r["group"] for r in others))
        if keeper["status"] == "current" and all(r["status"] == "current" for r in others):
            keeper["note"] = "兼任：" + "、".join(groups)
        elif keeper["status"] == "current":
            keeper["note"] = "移籍自：" + "、".join(groups)
        else:
            keeper["note"] = "兼任・移籍：" + "、".join(groups)
        merged.append(keeper)
    return merged


def slug(name):
    return "m" + hashlib.md5(name.encode("utf-8")).hexdigest()[:10]


def image_urls(files):
    out = {}
    for i in range(0, len(files), 50):
        batch = files[i:i + 50]
        data = api(action="query", prop="imageinfo", iiprop="url|size",
                   titles="|".join("ファイル:" + f for f in batch))
        norm = {n["to"]: n["from"] for n in data["query"].get("normalized", [])}
        for p in data["query"]["pages"].values():
            ii = p.get("imageinfo")
            if not ii:
                continue
            title = norm.get(p["title"], p["title"])
            out[title.split(":", 1)[1]] = ii[0]["url"]
    return out


def download(args):
    mid, url = args
    path = os.path.join(ORIG, mid + os.path.splitext(url)[1].lower())
    if not os.path.exists(path):
        data = get(url)
        with open(path, "wb") as fh:
            fh.write(data)
    return mid, path


def compress(mid, path, force=False):
    outs = [os.path.join(FULL, mid + ".webp"), os.path.join(THUMB, mid + ".webp")]
    if not force and all(os.path.exists(o) and os.path.getmtime(o) > os.path.getmtime(path) for o in outs):
        return Image.open(path).size, None
    im = Image.open(path)
    im = ImageOps.exif_transpose(im).convert("RGB")
    full = im.copy()
    full.thumbnail(FULL_BOX, Image.LANCZOS)
    # small originals are already the official profile size; avoid a lossy second generation
    q = FULL_Q if full.size != im.size else 94
    full.save(os.path.join(FULL, mid + ".webp"), "WEBP", quality=q, method=6)
    w, h = im.size
    th = im.resize((THUMB_W, round(h * THUMB_W / w)), Image.LANCZOS)
    th.save(os.path.join(THUMB, mid + ".webp"), "WEBP", quality=THUMB_Q, method=6)
    return im.size, full.size


def load_rows():
    rows = []
    for group, page, default in SOURCES:
        page_rows = parse_page(wikitext(page), group, default)
        print(f"{group:5s} {page}: {len(page_rows)}")
        rows.extend(page_rows)
    return [r for r in rows if not r["join"].startswith(EXCLUDE)]


def main():
    no_dl = "--no-dl" in sys.argv
    for d in (ORIG, FULL, THUMB):
        os.makedirs(d, exist_ok=True)

    members = merge_members(load_rows())
    print(f"members after dedupe: {len(members)}")

    seen_names = set()
    for m in members:
        m["id"] = slug(m["name"] + ("" if m["name"] not in seen_names else "#" + m["join"]))
        seen_names.add(m["name"])

    urls = image_urls(sorted({m["file"] for m in members if m["file"]}))
    missing = [m["name"] for m in members if m["file"] and m["file"] not in urls]
    if missing:
        print("no image info:", missing)

    jobs = [(m["id"], urls[m["file"]]) for m in members if m["file"] in urls]
    paths = {}
    if no_dl:
        for mid, url in jobs:
            p = os.path.join(ORIG, mid + os.path.splitext(url)[1].lower())
            if os.path.exists(p):
                paths[mid] = p
    else:
        with ThreadPoolExecutor(6) as ex:
            for n, (mid, p) in enumerate(ex.map(download, jobs), 1):
                paths[mid] = p
                if n % 50 == 0:
                    print(f"downloaded {n}/{len(jobs)}")

    sizes = []
    for m in members:
        p = paths.get(m["id"])
        m["img"] = bool(p)
        if p:
            try:
                sizes.append(compress(m["id"], p, "--force" in sys.argv)[0])
            except Exception as e:
                print("compress failed", m["name"], e)
                m["img"] = False

    keep = {m["id"] for m in members}
    removed = 0
    for d in (ORIG, FULL, THUMB):
        for fn in os.listdir(d):
            if os.path.splitext(fn)[0] not in keep:
                os.remove(os.path.join(d, fn))
                removed += 1
    if removed:
        print(f"removed {removed} unused image files")

    grouped = {}
    for m in members:
        key, label = group_of(m["join"], m["group"])
        if key >= 130 and not m.get("note"):
            m["note"] = note_of(m["join"])
        grouped.setdefault((GROUP_ORDER.index(m["group"]), key, label), []).append(m)

    out = []
    for (gi, key, label), ms in sorted(grouped.items()):
        ms.sort(key=lambda m: (m["status"] != "current", m["kana"] or m["name"]))
        out.append({
            "group": GROUP_ORDER[gi],
            "label": label,
            "members": [
                {k: m[k] for k in ("id", "name", "kana", "nick", "status", "end", "img")}
                | ({"leave": m["leave"]} if m.get("leave") else {})
                | ({"note": m["note"]} if m.get("note") else {})
                for m in ms
            ],
        })

    with open(os.path.join(ROOT, "members.js"), "w", encoding="utf-8") as fh:
        fh.write("// generated by scripts/fetch_members.py from 48pedia.org\n")
        fh.write("window.AKB_GROUPS = ")
        json.dump(out, fh, ensure_ascii=False, indent=1)
        fh.write(";\n")

    total = sum(len(g["members"]) for g in out)
    print(f"groups {len(out)}  members {total}  with image {sum(m['img'] for m in members)}")
    if sizes:
        ws = sorted(s[0] for s in sizes)
        hs = sorted(s[1] for s in sizes)
        print(f"original size median {ws[len(ws)//2]}x{hs[len(hs)//2]}  min {ws[0]}x{hs[0]}  max {ws[-1]}x{hs[-1]}")


if __name__ == "__main__":
    main()
