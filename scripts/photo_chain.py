"""成员照片的通用回退链：Wayback CDX 查询 / Wayback 取图 / Wikipedia Commons 取图。

与站点无关的三段在此定义 —— 等爱（love_members）与早安（love_members 的姊妹 loader）
要用的回退链完全同形（官网 SSR + 日文 Wikipedia + Wayback + Commons），所以共享。
**站点有关**的那部分（从旧站列表页 HTML 里配对姓名与照片）留在各自 loader，
因为它编码的是那个站特定的 HTML 形状。

全部为纯函数：网络经注入的 text fetcher 访问，测试离线。
"""
import json
import re
import urllib.parse

from ja_wiki import WIKI_API

COMMONS_API = "https://commons.wikimedia.org/w/api.php"

# 搜索命中里图标/模板/旗帜占多数，按文件名关键词先滤掉。**只收明确是图标的词**：
# 真正的把关是身份校验（`_mentions_name`），这里的误杀才是风险（「tone」「map」「move」
# 这类短词会命中人名的子串），所以宁少勿滥。
_SEARCH_JUNK = (
    "commons-logo", "wikiquote", "wiktionary", "wikinews", "wikisource", "wikibooks",
    "flag_of", "flagicon", "disambig", "edit-", "symbol_", "blue_pencil", "red_pencil",
    "ambox", "question_book", "portal", "speaker", "crystal", "nuvola", "emblem",
    "logo", "icon", "padlock", "lock-", "wiki.png", "wikimedia", "mediawiki",
    "oshirase", "kankei", "seal", "crest", "kamon", "decrease", "increase", "steady",
    "svg",
)

# 视频截帧不算自由素材：Commons 上有一批「Media from YouTube / Extracted images」的
# 成员图（实测 Juice=Juice 两人），授权是上传者自述、实为视频画面 —— 不用。
_VIDEO_CATS = ("media from youtube", "extracted images")


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


def commons_photo(name, fetch, errors=None):
    query = WIKI_API + "?" + urllib.parse.urlencode(
        {"action": "query", "titles": name, "prop": "pageimages", "pithumbsize": "800", "format": "json"}
    )
    try:
        data = json.loads(fetch(query))
    except Exception as e:
        _note(errors, e)
        return None
    # 返回值未必是预期的形状：实测端点在异常时会回 JSON 数组而不是对象，
    # 而原来只把 json.loads 包在 try 里，后面的 .get 就抛出去了 ——
    # 抓取路径上抛异常会让整条早安装配停摆。取不到就当没有。
    if not isinstance(data, dict):
        return None
    for page in (data.get("query") or {}).get("pages", {}).values():
        src = (page.get("thumbnail") or {}).get("source")
        if src:
            return src
    return None


def norm_name(s):
    """描述里常写「熊井 友理奈」（名字中间带空格）—— 去空白后比对。"""
    return re.sub(r"\s+", "", s or "")


def _note(errors, e):
    """把「请求失败」记进调用方的 errors 列表（工单 09）：失败与「查了但没有」必须
    分得开 —— 429 被记成「源里没有照片」是本仓记录过的坑。"""
    if errors is not None:
        errors.append(e)


def _search_hits(name, fetch, errors=None):
    query = COMMONS_API + "?" + urllib.parse.urlencode(
        {
            "action": "query",
            "list": "search",
            "srsearch": '"{}"'.format(name),
            "srnamespace": "6",
            "srlimit": "12",
            "format": "json",
        }
    )
    try:
        data = json.loads(fetch(query))
    except Exception as e:
        _note(errors, e)
        return []
    if not isinstance(data, dict):
        return []
    return [
        h.get("title", "")
        for h in (data.get("query") or {}).get("search", [])
        if h.get("title")
    ]


def _imageinfo(titles, fetch, errors=None):
    """一批取回候选文件的 imageinfo（titles=A|B|…，一次请求）。形状不对返回 {}。"""
    query = COMMONS_API + "?" + urllib.parse.urlencode(
        {
            "action": "query",
            "titles": "|".join(titles),
            "prop": "imageinfo",
            "iiprop": "url|size|extmetadata",
            "format": "json",
        }
    )
    try:
        data = json.loads(fetch(query))
    except Exception as e:
        _note(errors, e)
        return {}
    if not isinstance(data, dict):
        return {}
    return (data.get("query") or {}).get("pages", {})


# 占位/空图：旧站用透明 gif 占位，而 `alt` 里写着成员名 —— 实测四个 Berryz 成员
# 被配成**同一张** `transparent.gif`（1×1），直到压缩阶段才被发现（整轮白跑完）。
_PLACEHOLDER_SRC = (
    "transparent.gif", "transparent.png", "blank.gif", "blank.png",
    "spacer.gif", "spacer.png", "1x1", "pixel.gif", "pixel.png",
    "clear.gif", "clear.png", "empty.gif", "empty.png", "dot_clear",
)


def is_placeholder_src(url):
    """URL 是不是占位/空图。这类 URL 不能当成员照片（配对时要跳过、缓存里也要忽略）。"""
    low = (url or "").lower()
    return any(p in low for p in _PLACEHOLDER_SRC)


def _is_video_frame(em):
    """视频截帧不算自由素材（见 `_VIDEO_CATS`）。"""
    cats = (em.get("Categories") or {}).get("value", "").lower()
    return any(v in cats for v in _VIDEO_CATS)


def _mentions_name(page, em, want):
    """文件名或描述里出现本人姓名（去空白后比对）—— 不做校验会张冠李戴（实测同名
    陷阱：搜「村上愛」命中篮球选手村上恵的图）。"""
    desc = (em.get("ImageDescription") or {}).get("value", "")
    # 分别比对，**不要拼接**：title="File:前田" + desc="憂佳です" 拼出来会假命中
    # 「前田憂佳」（跨界误配，两轴审查抓到）。
    return want in norm_name(page.get("title", "")) or want in norm_name(desc)


def _portrait_candidate(page, want):
    """一个候选页 → (像素面积, url)；不合格返回 None。"""
    info = (page.get("imageinfo") or [{}])[0]
    src = info.get("url")
    if not src:
        return None
    em = info.get("extmetadata") or {}
    if _is_video_frame(em) or not _mentions_name(page, em, want):
        return None
    return ((info.get("width") or 0) * (info.get("height") or 0), src)


def commons_search_photo(name, fetch, errors=None):
    """Commons 文件命名空间搜索（`commons_photo` 的补充）：`commons_photo` 只回
    **条目首图**，而不少毕业成员的照片在 Commons 有文件、却没被用进条目（实测：
    Berryz 四人的 AnimeNEXT 单人照、後藤真希 2025）。

    身份校验与视频截帧过滤见 `_portrait_candidate`；命中多个时取像素面积最大的。
    取不到返回 None（与另两段一致）。
    """
    want = norm_name(name)
    cands = [
        t
        for t in _search_hits(name, fetch, errors)
        if not any(j in t.lower() for j in _SEARCH_JUNK)
    ]
    if not cands:
        return None
    best = None
    for page in _imageinfo(cands[:6], fetch, errors).values():
        cand = _portrait_candidate(page, want)
        if cand and (best is None or cand[0] > best[0]):
            best = cand
    return best[1] if best else None
