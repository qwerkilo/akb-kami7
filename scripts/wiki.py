import gzip
import json
import os
import time
import urllib.parse
import urllib.request

PROXY = os.environ.get("AKB_PROXY", "http://127.0.0.1:7897")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"
API = "https://48pedia.org/api.php"

def build_opener(proxy=PROXY):
    handler = (
        urllib.request.ProxyHandler({"http": proxy, "https": proxy})
        if proxy
        else urllib.request.ProxyHandler({})
    )
    return urllib.request.build_opener(handler)


_opener = build_opener()


def maybe_gunzip(raw):
    """Wayback 的 `id_` 重放偶尔回的是 WARC 里的 **gzip 载荷**（实测：2009 年的
    cute01_s.jpg 回 15335 字节、头 `1f 8b`）—— 不解的话会被当成「文件不是图」，
    而 `_orig` 缓存一存就永久卡住（下载只看文件在不在）。JPEG/PNG/WebP/HTML/JSON
    都不以 `1f 8b` 开头，判据安全；坏 gzip 原样返回，交给调用方按「不是图」处理。
    """
    if raw[:2] != b"\x1f\x8b":
        return raw
    try:
        return gzip.decompress(raw)
    except Exception:
        return raw


def get(url, retries=4, data=None, opener=None):
    opener = opener or _opener
    for i in range(retries):
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, "Referer": "https://48pedia.org/"})
            with opener.open(req, timeout=40) as r:
                return maybe_gunzip(r.read())
        except Exception as e:
            # 404/410 是**永久**错误：重试只是白烧（性能调研 #1 实测：两个死 URL
            # 每轮 3×4 次请求 + 约 183s sleep）。
            if getattr(e, "code", None) in (404, 410):
                raise
            if i == retries - 1:
                raise
            time.sleep(2 * (i + 1))


def api(opener=None, **params):
    params.setdefault("format", "json")
    return json.loads(get(API, data=urllib.parse.urlencode(params).encode(), opener=opener))


def wikitext(page, opener=None):
    return api(action="parse", page=page, prop="wikitext", opener=opener)["parse"]["wikitext"]["*"]
