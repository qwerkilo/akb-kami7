"""Build members.js and compressed portraits from 48pedia.

usage: python fetch_members.py            # fetch lists, download, compress
       python fetch_members.py --no-dl    # reuse cached originals only
       python fetch_members.py --force    # recompress even if outputs are up to date
       python fetch_members.py --accept-drop   # 名册相对基线塌了也照跑（真解散一个团时才用）
env AKB_PROXY overrides the proxy (default http://127.0.0.1:7897, empty = direct)
"""
import hashlib
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from functools import partial

from PIL import Image, ImageOps

import love_members
import morningmusume_members
import progress
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
        end = roster.ymd(y, mo, d)
    else:
        m = re.search(r'data-sort-value="(\d{4})(\d{2})(\d{2})"', chunk)
        if m:
            end = roster.ymd(m.group(1), m.group(2), m.group(3))
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
    return roster.ymd(y, mo, d)


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
        progress.tick()
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


def orig_path(mid, url, orig_dir=ORIG):
    """原图缓存路径：id + URL 扩展名小写（下载与缓存命中共享同一契约）。"""
    return os.path.join(orig_dir, mid + os.path.splitext(url)[1].lower())


def download(args, orig_dir=ORIG, fetch=get):
    mid, url = args
    path = orig_path(mid, url, orig_dir)
    if not os.path.exists(path):
        # 单张图失败（Wayback 521/404 等）不该让整轮抓取崩掉 —— 成员退回占位卡，
        # 而崩掉会丢掉前面几十分钟的解析结果（实测：一次 521 整轮白跑）。
        # Wayback 批量下载还会限流（实测 43 张 403），所以退避重试两次再放弃。
        for attempt in range(3):
            try:
                data = fetch(url)
            except Exception as e:
                if attempt == 2:
                    print(f"  下载失败，跳过 {mid}: {type(e).__name__} {e}", file=sys.stderr)
                    return mid, None
                time.sleep(5 * (attempt + 1))
                continue
            with open(path, "wb") as fh:
                fh.write(data)
            break
    return mid, path


def download_all(jobs, fetch=get, orig_dir=ORIG, workers=6):
    paths = {}
    with ThreadPoolExecutor(workers) as ex:
        mapped = ex.map(partial(download, orig_dir=orig_dir, fetch=fetch), jobs)
        for mid, p in mapped:
            progress.tick(ok=bool(p))
            if p:
                paths[mid] = p
    return paths


def cached_image_paths(jobs, orig_dir=ORIG):
    paths = {}
    for mid, url in jobs:
        p = orig_path(mid, url, orig_dir)
        if os.path.exists(p):
            paths[mid] = p
    return paths


# 占位图/追踪像素探测器（**不是**分辨率下限）：源图小于这个边长就不是头像，
# 官方照片最小 102×122，而实测的占位图是 1×1 —— 不因分辨率低而丢弃（spec 决定 4），
# 只拒「根本不是照片」的像素。
MIN_PHOTO_PX = 32


def usable(p):
    """站内图片文件可用：存在且非空（0 字节视为损坏，交给下一轮重压）。"""
    return os.path.exists(p) and os.path.getsize(p) > 0


def compress(mid, path, force=False, full_dir=FULL, thumb_dir=THUMB):
    outs = [
        os.path.join(full_dir, mid + ".webp"),
        os.path.join(thumb_dir, mid + ".webp"),
    ]
    if not force and all(usable(o) and os.path.getmtime(o) > os.path.getmtime(path) for o in outs):
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
        progress.tick()
        print(f"{group:5s} {page}: {len(page_rows)}")
        rows.extend(page_rows)
    return [r for r in rows if not r["join"].startswith(exclude)]


def photo_skip_for(refresh_photos, root, full_dir, thumb_dir):
    """本次跑要跳过谁的照片解析（ADR-0023）。

    `--refresh-photos` → None（不跳过任何人）；否则按**站内照片**决定（读上一轮
    members.js 拿 name+group → id 的映射）。读不到 members.js（首次跑）→ 空表 →
    不跳过任何人（全解析）。
    """
    if refresh_photos:
        return None
    return photo_skip_predicate(read_prev_members(root), full_dir, thumb_dir)


def default_loaders(skip_photo, use_cache):
    """默认的两个 loader（等爱 / 早安）。

    抽出来是为了让「跳过接进了哪个 loader」「缓存开不开」可测 —— 接线的 bug 只表现为
    「跑了但没跳过」或「refresh 了却仍读缓存」。
    """
    return (
        lambda fetch: love_members.load(fetch, skip_photo=skip_photo),
        lambda fetch: morningmusume_members.load(
            fetch, use_cache=use_cache, skip_photo=skip_photo
        ),
    )


def parse_args(argv):
    """(no_dl, force, accept_drop, refresh_photos)。

    `--refresh-photos` 与 `--force` 职责分明：前者是**重解析**（忽略「已有照片」的跳过
    与解析缓存），后者是**重下载 + 重压缩**。改 `--force` 去顺手重解析会让「只想重压」
    的人意外触发一次全量照片扫描（小时级）。"""
    argv = sys.argv[1:] if argv is None else argv
    return (
        "--no-dl" in argv,
        "--force" in argv,
        "--accept-drop" in argv,
        "--refresh-photos" in argv,
    )


def _parse_prev_sections(root):
    """盘上 members.js → 解析出的 sections；读不到/形状不对返回 None（静默，调用方决定提示）。"""
    try:
        with open(os.path.join(root, "members.js"), encoding="utf-8") as fh:
            raw = fh.read()
        sections = json.loads(raw.split("window.AKB_GROUPS = ", 1)[1].rstrip(";\n"))
        if not isinstance(sections, list):
            raise ValueError("segments is not a list")
        for sec in sections:
            if not isinstance(sec, dict) or not isinstance(sec.get("members"), list):
                raise ValueError("section is not a dict with a members list")
        return sections
    except (OSError, ValueError, KeyError, TypeError, IndexError):
        return None


def read_prev_members(root):
    """盘上 members.js 的成员（group/name/id/img）—— 增量跑的跳过判据用。

    以「上一轮的 name+group → id」为桥：id 规则（`assign_ids` 的 slug + 重名后缀）
    依赖全局重名顺序，**不能**从单个成员重算。读不到返回空表（不跳过任何人 = 全解析）。
    """
    sections = _parse_prev_sections(root)
    if sections is None:
        return []
    return [
        {
            "group": sec["group"],
            "name": m.get("name"),
            "id": m.get("id"),
            "img": bool(m.get("img")),
        }
        for sec in sections
        for m in sec["members"]
    ]


def photo_skip_predicate(prev_members, full_dir, thumb_dir):
    """增量跑：谁的照片解析可以跳过（ADR-0023）。

    判据是**站内文件**（`img/full` 与 `img/thumb` 都在且非空 —— 与 `img` 标志同一真值源），
    不是解析缓存：缓存只覆盖早安 loader，且会与文件脱节（有 URL 但下载失败的人会被缓存
    挡住、永远卡在没图）。

    同 (group, name) 在上一轮出现两次（同名不同人）时 id 不可判定 —— 保守不跳过。
    """
    counts = {}
    for m in prev_members:
        key = (m.get("group"), m.get("name"))
        counts[key] = counts.get(key, 0) + 1
    have = set()
    for m in prev_members:
        key = (m.get("group"), m.get("name"))
        if counts[key] != 1 or not m.get("img"):
            continue
        mid = m.get("id") or ""
        if usable(os.path.join(full_dir, mid + ".webp")) and usable(
            os.path.join(thumb_dir, mid + ".webp")
        ):
            have.add(key)

    def skip(member):
        return (member.get("group"), member.get("name")) in have

    return skip


def read_baseline(root):
    """盘上已有的 members.js → {"counts": {团体: 人数}, "total": n}。

    **只统计 48G/坂道 团体**（GROUP_ORDER 里的）：members.js 里还有等爱三团，
    而 load_rows 只喂 GROUP_ORDER 的 10 团——口径不一致会让「团体消失」判据
    恒非空，把每一次合法刷新都拦下来。读不到返回 None（首次生成 → 不校验）。
    """
    path = os.path.join(root, "members.js")
    try:
        sections = _parse_prev_sections(root)
        if sections is None:
            raise ValueError("members.js unreadable")
        counts = {}
        love_counts = {}
        for sec in sections:
            group = sec["group"]
            # 等爱三团**不在** GROUP_ORDER 里（那是 48G/坂道的抓取清单），但基线必须
            # 读它们 —— 否则「团消失」「腰斩」两条判据对等爱恒假，而等爱抓到 0 人时
            # love_members 只 print 一行、build_sections 把空团静默丢掉、prune_unused
            # 照删图片，脚本 exit 0（整组从站点上消失）。
            if group in GROUP_ORDER:
                counts[group] = counts.get(group, 0) + len(sec["members"])
            else:
                love_counts[group] = love_counts.get(group, 0) + len(sec["members"])
        if not counts:
            # 解析成功但一个 GROUP_ORDER 团体都没认出来（例如产物只剩等爱分段）：
            # 当成「读不到基线」处理，否则 total:0 会让门静默失效又不出声
            raise ValueError("no 48G/坂道 section in baseline")
    except (OSError, ValueError, KeyError, TypeError, IndexError) as e:
        print(f"读不到 {path} 的基线名册（{type(e).__name__}）——本次不校验名册规模")
        return None
    return {
        "counts": counts,
        # 等爱走逐团规则（它们人少，「总数跌 60%」对它们没有意义）
        "love_counts": love_counts,
        "groups": set(counts) | set(love_counts),
        "total": sum(counts.values()),
    }


# 名册规模相对基线跌到这个比例就停：上游整页失败/格式变动都会落到这里，
# 而 prune_unused 会把不在新集合里的图片全删掉——不能带着残缺名册走到那一步。
ROSTER_DROP_LIMIT = 0.6


# 逐团下限：某团腰斩到基线的一半以下，同样会 prune 掉那半团全部图片。
# 与总数阈值同源的两个判据；解散一个团需要 --accept-drop（这正是那把钥匙的用途）。
ROSTER_GROUP_LIMIT = 0.5


def roster_problems(new_members, baseline):
    """名册相对基线的异常，返回问题描述列表（空 = 正常）。纯函数，方便离线测。"""
    if not baseline or not baseline.get("total"):
        return []  # 首次生成，没有可比基线
    counts = {}
    for m in new_members:
        g = m.get("group")
        counts[g] = counts.get(g, 0) + 1
    base = baseline["total"]
    total = sum(counts.get(g, 0) for g in baseline["counts"])
    problems = []
    if total < base * ROSTER_DROP_LIMIT:
        drop = round((1 - total / base) * 100)
        problems.append(f"48G/坂道 名册从 {base} 人掉到 {total} 人（-{drop}%）")
    gone = sorted(baseline["groups"] - set(counts))
    if gone:
        problems.append("这些团体这次一个成员都没解析到：" + "、".join(gone))
    # 逐团下限对 48G/坂道与等爱一视同仁 —— 判据与「抓什么」无关，才不会漏掉新来源
    for g, n0 in sorted(
        list(baseline["counts"].items()) + list(baseline.get("love_counts", {}).items())
    ):
        n1 = counts.get(g, 0)
        if n1 < n0 * ROSTER_GROUP_LIMIT:
            problems.append(f"{g} 从 {n0} 人掉到 {n1} 人（低于基线的一半）")
    return problems


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
    """压缩原图并标记 img。

    img 的真值来源是**站内图片文件**而不是远端 URL 是否解析成功：等爱毕业成员的
    照片要走「Web Archive → 图片快照 → Commons」回退链，上游波动时解析不到，
    但仓库里已有的头像不该因此消失（渲染器也只认本地文件）。

    判定要求 full 与 thumb **都在且非空**——名册卡片读的是 thumb，只写出一半或
    留下 0 字节时宁可显示占位图，也不要渲染坏图。
    """
    sizes = []
    for m in members:
        progress.tick()
        p = paths.get(m["id"])
        if p:
            try:
                size = compress(m["id"], p, force, full_dir, thumb_dir)[0]
                # 源图过小（1×1 占位/追踪像素，实测 46 字节的 webp）不能当头像 ——
                # 渲染出来是一张坏卡片。删掉已生成的 full/thumb，让下面的
                # usable() 判 img=false 走占位（**不能 continue**：那会跳过 img 赋值，
                # 实测整轮抓取在 warn_missing_images 处 KeyError: 'img' 崩掉）。
                if size and min(size) < MIN_PHOTO_PX:
                    print(
                        f"  源图过小（{size[0]}×{size[1]}），按缺图处理：{m['name']}",
                        file=sys.stderr,
                    )
                    for out in (
                        os.path.join(full_dir, m["id"] + ".webp"),
                        os.path.join(thumb_dir, m["id"] + ".webp"),
                    ):
                        if os.path.exists(out):
                            os.remove(out)
                else:
                    sizes.append(size)
            except Exception as e:
                print("compress failed", m["name"], e)
        m["img"] = all(
            usable(out)
            for out in (
                os.path.join(full_dir, m["id"] + ".webp"),
                os.path.join(thumb_dir, m["id"] + ".webp"),
            )
        )
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


def decode_page(raw):
    """按页面声明的编码解码。

    ⚠️ 旧官网 2005 前后的页是 **Shift_JIS**，一律按 UTF-8 解会把成员姓名变成乱码
    （`ALT="吉澤ひとみ"` → `ALT="\ufffdg\ufffdV..."`），于是照片配对全部失败 ——
    实测：早期モー娘。 25 人一个都配不到，根因就是这里。
    """
    head = raw[:4096]
    m = re.search(rb"""charset=["']?([\w-]+)""", head, re.I)
    enc = (m.group(1).decode("ascii", "ignore").lower() if m else "utf-8")
    if enc in ("shift_jis", "shift-jis", "sjis", "x-sjis"):
        enc = "cp932"
    try:
        return raw.decode(enc)
    except (LookupError, UnicodeDecodeError):
        pass
    # 没声明 charset 的旧页（2005 前后）直接按候选编码试 —— cp932 的字节序列
    # 多半过不了 UTF-8 校验，试出来就是对的
    for alt in ("cp932", "euc-jp"):
        try:
            return raw.decode(alt)
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "replace")


def _load_series(label, loader, fetch_url):
    """装一个非 48G/坂道 的系列。返回 (members, urls)。

    抛异常就整体中止 —— 绝不「一个系列失败就只写其余系列」：脚本末尾的
    prune_unused 会把不在新名册里的图片直接删掉。三个系列各调一次，所以
    main 里不该把这三段摊开（那一摊把 CCN 推到棘轮之上）。
    """
    if not loader:
        return [], {}
    try:
        return loader(lambda url: decode_page(fetch_url(url)))
    except Exception as e:
        raise SystemExit(
            f"{label}系列抓取失败（{e}）；为避免误删已有数据与图片，本次不写入。"
            f"网络恢复后重试即可；本脚本不会在{label}失败时降级只写其余系列。"
        )


def _prepare_dirs(dirs):
    for d in (dirs["orig"], dirs["full"], dirs["thumb"]):
        os.makedirs(d, exist_ok=True)


def _roster_gate(all_members, dirs, accept_drop):
    """规模门：名册相对基线塌了就不写入（prune_unused 会删图）。"""
    problems = roster_problems(all_members, read_baseline(dirs["root"]))
    if not problems:
        return
    detail = "；".join(problems)
    if not accept_drop:
        raise SystemExit(
            f"名册异常（{detail}）。为避免 prune_unused 删掉已有图片，本次不写入。"
            "确认是上游真的少了人，再加 --accept-drop 放行。"
        )
    print(f"[--accept-drop] 放行名册异常：{detail}", file=sys.stderr)


def _write_outputs(dirs, members, love, morning, all_members, sizes):
    sections = (
        build_sections(members)
        + love_members.build_sections(love)
        + morningmusume_members.build_sections(morning)
    )
    write_members_js(sections, os.path.join(dirs["root"], "members.js"))
    simplified = build_simplified([m["name"] for m in all_members])
    if simplified is not None:
        write_simplified_js(simplified, os.path.join(dirs["root"], "simplified.js"))
    report_generation(sections, all_members, sizes)


def main(
    argv=None,
    dirs=None,
    fetch_page=wikitext,
    api_fn=api,
    fetch_url=get,
    love_loader=None,
    morning_loader=None,
):
    no_dl, force, accept_drop, refresh_photos = parse_args(argv)
    dirs = dirs or default_dirs()
    # 管线边缘多给几次重试：48pedia 的 521 会连穿 get() 默认的 4 次重试，
    # 单团抓取失败就被 loader 的 empty 策略变成「该团 0 人」→ 规模门中止整轮，
    # 而照片解析（几十分钟）已经白跑完。测试注入 fetch_url 时不受影响。
    if fetch_url is get:
        fetch_url = partial(get, retries=8)
    # 增量跑（ADR-0023）：已有站内照片的成员跳过照片解析；--refresh-photos 全解析。
    # 缓存只在非 refresh 时开（refresh 的语义就是「忽略跳过与缓存」）。
    skip_photo = photo_skip_for(
        refresh_photos, dirs["root"], dirs["full"], dirs["thumb"]
    )
    default_love, default_morning = default_loaders(
        skip_photo, use_cache=not refresh_photos
    )
    if love_loader is None:
        love_loader = default_love
    if morning_loader is None:
        morning_loader = default_morning
    _prepare_dirs(dirs)

    progress.enable()  # 阶段行 + 心跳（默认静默，测试不刷屏）
    with progress.stage("48pedia 来源页", total=len(SOURCES)):
        members = merge_members(load_rows(fetch_page))
    print(f"members after dedupe: {len(members)}")

    love, love_urls = _load_series("等爱", love_loader, fetch_url)
    morning, morning_urls = _load_series("早安", morning_loader, fetch_url)

    all_members = members + love + morning

    # 规模门必须排在**三个 loader 之后**：基线的 groups 里含等爱与早安的团，
    # 而门若紧跟在 48G/坂道 之后，那些团还没被加载 —— 每次都算「一个成员都没解析到」
    # 并中止。真实抓取才发现这条（等爱上线后没人真跑过一次完整抓取）。
    _roster_gate(all_members, dirs, accept_drop)

    assign_ids(all_members)

    with progress.stage("48pedia 图片 URL", total=len(member_files(members))):
        urls = image_urls(member_files(members), api_fn)
    urls.update(love_urls)
    urls.update(morning_urls)
    report_missing_info(resolve_missing(members, urls))

    with progress.stage("下载原图", total=len(all_members)):
        paths = collect_paths(all_members, urls, no_dl, fetch_url, dirs["orig"])
    with progress.stage("压缩", total=len(all_members)):
        sizes = compress_members(all_members, paths, force, dirs["full"], dirs["thumb"])
    warn_missing_images(all_members)
    report_removed(
        prune_unused(
            {m["id"] for m in all_members},
            (dirs["orig"], dirs["full"], dirs["thumb"]),
        )
    )

    _write_outputs(dirs, members, love, morning, all_members, sizes)


if __name__ == "__main__":
    main()
