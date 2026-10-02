"""共享照片回退链的测试：Wayback CDX 查询 / Wayback 取图 / Commons 取图。

这些用例原先在 test_love_members.py 里（那时链住在 love_members 内）。它们随函数一起
搬到共享模块 photo_chain —— 站点无关的逻辑要有自己的测试，而不是寄居在某个 loader 里。
"""
import json
import unittest
import urllib.parse

import photo_chain


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
        out = photo_chain.cdx_rows("https://x/1.jpg", lambda url: json.dumps(rows))
        self.assertEqual(out, rows[1:])

    def test_empty_payload_yields_empty_list(self):
        self.assertEqual(photo_chain.cdx_rows("https://x", lambda url: ""), [])
        self.assertEqual(photo_chain.cdx_rows("https://x", lambda url: "[]"), [])

    def test_malformed_payload_yields_empty_list(self):
        """CDX 在限流时会回 HTML 而不是 JSON —— 必须降级而不是抛。"""
        self.assertEqual(
            photo_chain.cdx_rows("https://x", lambda url: "<html>429</html>"), []
        )

    def test_fetch_error_yields_empty_list(self):
        def boom(url):
            raise OSError("cdx down")

        self.assertEqual(photo_chain.cdx_rows("https://x", boom), [])

    def test_query_carries_limit_and_status_filter(self):
        seen = {}

        def fetch(url):
            seen["url"] = url
            return "[]"

        photo_chain.cdx_rows("https://x/1.jpg", fetch, limit=200)
        q = urllib.parse.parse_qs(urllib.parse.urlparse(seen["url"]).query)
        self.assertEqual(q["limit"], ["200"])
        self.assertEqual(q["filter"], ["statuscode:200"])
        self.assertEqual(q["url"], ["https://x/1.jpg"])

    def test_prefix_flag_adds_match_type(self):
        seen = {}

        def fetch(url):
            seen["url"] = url
            return "[]"

        photo_chain.cdx_rows("https://x/a", fetch, prefix=True)
        q = urllib.parse.parse_qs(urllib.parse.urlparse(seen["url"]).query)
        self.assertEqual(q["matchType"], ["prefix"])
        photo_chain.cdx_rows("https://x/a", fetch)
        q2 = urllib.parse.parse_qs(urllib.parse.urlparse(seen["url"]).query)
        self.assertNotIn("matchType", q2)


class CommonsPhotoCharacterizationTests(unittest.TestCase):
    def test_takes_jawiki_pageimage_thumbnail(self):
        seen = {}

        def fetch(url):
            seen["url"] = url
            return json.dumps(
                {"query": {"pages": {"1": {"thumbnail": {"source": "https://upload/c.jpg"}}}}}
            )

        self.assertEqual(photo_chain.commons_photo("齊藤なぎさ", fetch), "https://upload/c.jpg")
        q = urllib.parse.parse_qs(urllib.parse.urlparse(seen["url"]).query)
        self.assertEqual(q["titles"], ["齊藤なぎさ"])
        self.assertEqual(q["prop"], ["pageimages"])
        self.assertEqual(q["pithumbsize"], ["800"])
        self.assertEqual(urllib.parse.urlparse(seen["url"]).netloc, "ja.wikipedia.org")

    def test_no_thumbnail_yields_none(self):
        self.assertIsNone(
            photo_chain.commons_photo("x", lambda url: json.dumps({"query": {"pages": {"1": {}}}}))
        )

    def test_malformed_or_erroring_payload_yields_none(self):
        self.assertIsNone(photo_chain.commons_photo("x", lambda url: "not json"))

        def boom(url):
            raise OSError("commons down")

        self.assertIsNone(photo_chain.commons_photo("x", boom))


class WaybackPhotoTests(unittest.TestCase):
    def test_wayback_photo_uses_first_snapshot(self):
        def fetch(url):
            return json.dumps([
                ["urlkey", "timestamp", "original"],
                ["x", "20220525051254", "orig"],
            ])

        self.assertEqual(
            photo_chain.wayback_photo(
                "https://nearly-equal-joy.jp/image/profile/fukuyama_moeka.jpg", fetch
            ),
            "https://web.archive.org/web/20220525051254id_/https://nearly-equal-joy.jp/image/profile/fukuyama_moeka.jpg",
        )

    def test_wayback_photo_none_without_snapshot(self):
        self.assertIsNone(photo_chain.wayback_photo("https://x/y.jpg", lambda url: "[]"))


if __name__ == "__main__":
    unittest.main()
