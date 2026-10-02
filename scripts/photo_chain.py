"""成员照片的通用回退链：Wayback CDX 查询 / Wayback 取图 / Wikipedia Commons 取图。

与站点无关的三段在此定义 —— 等爱（love_members）与早安（love_members 的姊妹 loader）
要用的回退链完全同形（官网 SSR + 日文 Wikipedia + Wayback + Commons），所以共享。
**站点有关**的那部分（从旧站列表页 HTML 里配对姓名与照片）留在各自 loader，
因为它编码的是那个站特定的 HTML 形状。

全部为纯函数：网络经注入的 text fetcher 访问，测试离线。
"""
import json
import urllib.parse

WIKI_API = "https://ja.wikipedia.org/w/api.php"


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
