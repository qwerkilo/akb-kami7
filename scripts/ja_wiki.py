"""日文 Wikipedia 的取数：条目 wikitext。

与站点无关，网络经注入的 text fetcher 访问（测试离线）。
**失败策略是显式参数**，不是两段代码的差异：等爱要「失败即中止」（抛），
早安要「单页失败 → 该团 0 人」（空串，由源门的「团消失」兜）。
"""

import json
import urllib.parse

WIKI_API = "https://ja.wikipedia.org/w/api.php"


def wiki_wikitext(title, fetch, on_error="raise"):
    """取条目的 wikitext 原文。

    API 回的 wikitext 是 `{"*": "…"}`，少取一层就会把 dict 当字符串往下传
    （第一版就那样，报的是 'dict' object has no attribute 'find'）。

    `on_error="raise"`（默认）失败即抛；`"empty"` 失败返回空串。
    """
    query = WIKI_API + "?" + urllib.parse.urlencode(
        {"action": "parse", "page": title, "prop": "wikitext", "format": "json"}
    )
    try:
        data = json.loads(fetch(query))
        return data["parse"]["wikitext"]["*"]
    except Exception:
        if on_error == "raise":
            raise
        return ""
