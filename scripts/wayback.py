"""跟 web.archive.org 说话：CDX 查询、快照 URL 的拼与拆。

一个远端主机一个模块（先例：`ja_wiki.py`）。此前快照 URL 的**格式**散在三处
（`photo_chain`、`love_members` 内联、`morningmusume_members`）、**解析**有两种写法
（`/web/(\\d{4,14})` 与 `^…\\d+[a-z]*_/`）—— 漏改一处不会红：两条链各自都有测试，
症状是某条链静默取到被 Wayback 注入改写的 HTML（`id_` 就是「不要改写」）。

全部为纯函数：网络经注入的 text fetcher 访问，测试离线。
"""

import json
import re
import urllib.parse

# 快照 URL 里的捕获时间戳（`/web/20150113120352id_/…`）
_TS = re.compile(r"/web/(\d{4,14})")
# 快照 URL 的前缀（`id_`/`if_`/`js_` 这类后缀都算）
_SNAPSHOT_PREFIX = re.compile(r"^https?://web\.archive\.org/web/\d+[a-z]*_/")


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


def snapshot_url(ts, url):
    """Wayback 原始快照 URL（`id_` = 不做注入改写）。"""
    return "https://web.archive.org/web/{}id_/{}".format(ts, url)


def snapshot_ts(url):
    """Wayback 快照 URL → 捕获时间戳（`/web/20150113120352id_/…` → 20150113120352）。"""
    m = _TS.search(url or "")
    return m.group(1) if m else ""


def original_url(url):
    """剥掉快照前缀，拿回原站 URL（非快照 URL 原样返回）。"""
    return _SNAPSHOT_PREFIX.sub("", (url or "").strip())


def latest_snapshot(url, fetch):
    """最近一次快照的原始 URL；查不到（或查询失败）给 None。"""
    rows = cdx_rows(url, fetch, limit=1)
    if not rows:
        return None
    return snapshot_url(rows[0][1], url)
