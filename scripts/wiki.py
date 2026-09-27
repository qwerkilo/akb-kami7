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


def get(url, retries=4, data=None, opener=None):
    opener = opener or _opener
    for i in range(retries):
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, "Referer": "https://48pedia.org/"})
            with opener.open(req, timeout=40) as r:
                return r.read()
        except Exception as e:
            if i == retries - 1:
                raise
            time.sleep(2 * (i + 1))


def api(opener=None, **params):
    params.setdefault("format", "json")
    return json.loads(get(API, data=urllib.parse.urlencode(params).encode(), opener=opener))


def wikitext(page, opener=None):
    return api(action="parse", page=page, prop="wikitext", opener=opener)["parse"]["wikitext"]["*"]
