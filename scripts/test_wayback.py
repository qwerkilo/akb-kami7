"""wayback.py 的特征测试（缝①）。

拼/拆快照 URL 此前散在三处（格式 3 份、解析 2 种写法）—— 这些测试钉住
「拼出来的能被拆回来」，搬迁前后都该绿。
"""
import json
import unittest
import urllib.parse

import wayback


class CdxRowsCharacterizationTests(unittest.TestCase):
    """cdx_rows 此前只被 resolve_former_photos 间接用到，没有直接测试。
    照片回退链要从 love_members 提到共享模块，先把它的行为逐字钉住 ——
    这是重构的等价性凭据，不是「新功能」。"""

    def test_strips_header_row_and_returns_rest(self):
        rows = [
            ["urlkey", "timestamp", "original"],
            ["a", "20220525051254", "https://x/1.jpg"],
            ["b", "20230101000000", "https://x/2.jpg"],
        ]
        out = wayback.cdx_rows("https://x/1.jpg", lambda url: json.dumps(rows))
        self.assertEqual(out, rows[1:])

    def test_empty_payload_yields_empty_list(self):
        self.assertEqual(wayback.cdx_rows("https://x", lambda url: ""), [])
        self.assertEqual(wayback.cdx_rows("https://x", lambda url: "[]"), [])

    def test_malformed_payload_yields_empty_list(self):
        """CDX 在限流时会回 HTML 而不是 JSON —— 必须降级而不是抛。"""
        self.assertEqual(
            wayback.cdx_rows("https://x", lambda url: "<html>429</html>"), []
        )

    def test_fetch_error_yields_empty_list(self):
        def boom(url):
            raise OSError("cdx down")

        self.assertEqual(wayback.cdx_rows("https://x", boom), [])

    def test_query_carries_limit_and_status_filter(self):
        seen = {}

        def fetch(url):
            seen["url"] = url
            return "[]"

        wayback.cdx_rows("https://x/1.jpg", fetch, limit=200)
        q = urllib.parse.parse_qs(urllib.parse.urlparse(seen["url"]).query)
        self.assertEqual(q["limit"], ["200"])
        self.assertEqual(q["filter"], ["statuscode:200"])
        self.assertEqual(q["url"], ["https://x/1.jpg"])

    def test_prefix_flag_adds_match_type(self):
        seen = {}

        def fetch(url):
            seen["url"] = url
            return "[]"

        wayback.cdx_rows("https://x/a", fetch, prefix=True)
        q = urllib.parse.parse_qs(urllib.parse.urlparse(seen["url"]).query)
        self.assertEqual(q["matchType"], ["prefix"])
        wayback.cdx_rows("https://x/a", fetch)
        q2 = urllib.parse.parse_qs(urllib.parse.urlparse(seen["url"]).query)
        self.assertNotIn("matchType", q2)

class LatestSnapshotTests(unittest.TestCase):
    def test_uses_first_snapshot(self):
        def fetch(url):
            return json.dumps([
                ["urlkey", "timestamp", "original"],
                ["x", "20220525051254", "orig"],
            ])

        self.assertEqual(
            wayback.latest_snapshot(
                "https://nearly-equal-joy.jp/image/profile/fukuyama_moeka.jpg", fetch
            ),
            "https://web.archive.org/web/20220525051254id_/https://nearly-equal-joy.jp/image/profile/fukuyama_moeka.jpg",
        )

    def test_none_without_snapshot(self):
        self.assertIsNone(wayback.latest_snapshot("https://x/y.jpg", lambda url: "[]"))


class SnapshotURLTests(unittest.TestCase):
    def test_build(self):
        self.assertEqual(
            wayback.snapshot_url("20150113120352", "http://x/y.jpg"),
            "https://web.archive.org/web/20150113120352id_/http://x/y.jpg",
        )

    def test_ts_extracted_from_snapshot_url(self):
        self.assertEqual(
            wayback.snapshot_ts("https://web.archive.org/web/20090602100604id_/http://x/y"),
            "20090602100604",
        )
        self.assertEqual(wayback.snapshot_ts("http://x/y"), "")

    def test_original_url_strips_snapshot_prefix(self):
        self.assertEqual(
            wayback.original_url(
                "https://web.archive.org/web/20150113120352id_/http://x/y.jpg"
            ),
            "http://x/y.jpg",
        )
        self.assertEqual(wayback.original_url("https://x/y.jpg"), "https://x/y.jpg")

    def test_round_trip(self):
        for url in ["http://www.helloproject.com/x.jpg", "https://x/a/b.html"]:
            ts = "20150113120352"
            snap = wayback.snapshot_url(ts, url)
            self.assertEqual(wayback.original_url(snap), url)
            self.assertEqual(wayback.snapshot_ts(snap), ts)

    def test_strip_tolerates_rewrite_suffixes(self):
        # 带 `[a-z]*` 后缀的形态都要能剥（love 原用例是 `im_`、morning 是 `id_`）
        self.assertEqual(
            wayback.original_url("https://web.archive.org/web/20150113120352js_/http://x/y"),
            "http://x/y",
        )
        self.assertEqual(
            wayback.original_url(
                "https://web.archive.org/web/20210305034043im_/https://x/y.jpg"
            ),
            "https://x/y.jpg",
        )


if __name__ == "__main__":
    unittest.main()
