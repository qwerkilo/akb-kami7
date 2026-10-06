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

    def test_json_that_is_not_an_object_yields_none(self):
        """端点在异常时会回 JSON 数组而不是对象。原来只把 json.loads 包进 try，
        后面的 .get 就抛出去了 —— 抓取路径上抛异常会让整条装配停摆。"""
        self.assertIsNone(photo_chain.commons_photo("x", lambda url: "[]"))
        self.assertIsNone(photo_chain.commons_photo("x", lambda url: "[1, 2]"))
        self.assertIsNone(photo_chain.commons_photo("x", lambda url: "null"))

        def boom(url):
            raise OSError("commons down")

        self.assertIsNone(photo_chain.commons_photo("x", boom))


class PlaceholderSrcTests(unittest.TestCase):
    """占位图判定：旧站用透明 gif 占位、alt 写成员名 —— 实测四个 Berryz 被配成同一张
    transparent.gif（1×1），压缩阶段才发现。"""

    def test_detects_transparent_and_spacer(self):
        self.assertTrue(
            photo_chain.is_placeholder_src(
                "https://web.archive.org/web/20150315010217id_/http://cdn.helloproject.com/img/transparent.gif"
            )
        )
        for u in (
            "http://x/img/blank.gif",
            "http://x/img/spacer.png",
            "http://x/1x1.gif",
            "http://x/pixel.gif",
        ):
            self.assertTrue(photo_chain.is_placeholder_src(u), u)

    def test_real_photos_are_not_placeholders(self):
        for u in (
            "http://cdn.helloproject.com/img/artist/m/f45e21d3.jpg",
            "https://upload.wikimedia.org/wikipedia/commons/b/b5/GotoMaki2025.jpg",
            "http://www.helloproject.com/berryz/img/shimizu.jpg",
        ):
            self.assertFalse(photo_chain.is_placeholder_src(u), u)
        self.assertFalse(photo_chain.is_placeholder_src(""))
        self.assertFalse(photo_chain.is_placeholder_src(None))


class CommonsSearchPhotoTests(unittest.TestCase):
    """Commons 文件命名空间搜索：pageimages 只回条目首图，这张表补「条目不使用、
    但 Commons 有文件」的那批（2026-10-05 实测：Berryz 四人 + 後藤真希）。"""

    @staticmethod
    def _fetch(hits, pages):
        def fetch(url):
            if "list=search" in url:
                return json.dumps({"query": {"search": [{"title": t} for t in hits]}})
            return json.dumps({"query": {"pages": pages}})

        return fetch

    def test_takes_file_whose_description_names_the_person(self):
        """Berryz AnimeNEXT 系列的真实形状：描述写「Maasa Sudo (須藤 茉麻)」（名字带空格）。"""
        fetch = self._fetch(
            ["File:Berryz Kobo at AnimeNEXT 20120609 15.38.42sudo.jpg"],
            {
                "1": {
                    "title": "File:Berryz Kobo at AnimeNEXT 20120609 15.38.42sudo.jpg",
                    "imageinfo": [
                        {
                            "url": "https://upload/sudo.jpg",
                            "width": 221,
                            "height": 306,
                            "extmetadata": {
                                "ImageDescription": {"value": "Maasa Sudo (須藤 茉麻)"}
                            },
                        }
                    ],
                }
            },
        )
        self.assertEqual(
            photo_chain.commons_search_photo("須藤茉麻", fetch), "https://upload/sudo.jpg"
        )

    def test_rejects_same_surname_other_person(self):
        """实测同名陷阱：搜「村上愛」命中篮球选手村上恵的图 —— 描述里不是本人，必须拒。"""
        fetch = self._fetch(
            ["File:Muramegu.jpg"],
            {
                "1": {
                    "title": "File:Muramegu.jpg",
                    "imageinfo": [
                        {
                            "url": "https://upload/megu.jpg",
                            "width": 2185,
                            "height": 1942,
                            "extmetadata": {
                                "ImageDescription": {"value": "村上恵　横浜ビー・コルセアーズ　3/24"}
                            },
                        }
                    ],
                }
            },
        )
        self.assertIsNone(photo_chain.commons_search_photo("村上愛", fetch))

    def test_skips_video_frames(self):
        """「Media from YouTube / Extracted images」是视频截帧，授权是上传者自述 —— 不用。"""
        fetch = self._fetch(
            ["File:金澤朋子.png"],
            {
                "1": {
                    "title": "File:金澤朋子.png",
                    "imageinfo": [
                        {
                            "url": "https://upload/kanazawa.png",
                            "width": 257,
                            "height": 245,
                            "extmetadata": {
                                "ImageDescription": {"value": "Juice=Juiceです。"},
                                "Categories": {
                                    "value": "Media from YouTube|Extracted images|Juice=Juice"
                                },
                            },
                        }
                    ],
                }
            },
        )
        self.assertIsNone(photo_chain.commons_search_photo("金澤朋子", fetch))

    def test_skips_junk_and_picks_largest_match(self):
        fetch = self._fetch(
            ["File:Flag of Japan.svg", "File:A small.jpg", "File:A large.jpg"],
            {
                # junk 页也配一张**更大**的图：不配的话「删掉过滤」结果不变 —— 变异验证
                # 抓出过这个假绿（两轴审查）。
                "0": {
                    "title": "File:Flag of Japan.svg",
                    "imageinfo": [
                        {
                            "url": "https://upload/flag.svg",
                            "width": 900,
                            "height": 900,
                            "extmetadata": {
                                "ImageDescription": {"value": "後藤真希のライブ"}
                            },
                        }
                    ],
                },
                "1": {
                    "title": "File:A small.jpg",
                    "imageinfo": [
                        {
                            "url": "https://upload/small.jpg",
                            "width": 200,
                            "height": 300,
                            "extmetadata": {
                                "ImageDescription": {"value": "後藤真希 live"}
                            },
                        }
                    ],
                },
                "2": {
                    "title": "File:A large.jpg",
                    "imageinfo": [
                        {
                            "url": "https://upload/large.jpg",
                            "width": 2048,
                            "height": 1570,
                            "extmetadata": {
                                "ImageDescription": {"value": "後藤真希GOTOMAKI"}
                            },
                        }
                    ],
                },
            },
        )
        self.assertEqual(
            photo_chain.commons_search_photo("後藤真希", fetch), "https://upload/large.jpg"
        )

    def test_does_not_reject_on_risky_substrings(self):
        """junk 表只许收「明确是图标」的词 —— 短词（tone/map/move/star）会命中人名的
        子串，误杀才是这里的风险（真正的把关是身份校验）。"""
        fetch = self._fetch(
            ["File:Morning Musume Star Live 2005.jpg"],
            {
                "1": {
                    "title": "File:Morning Musume Star Live 2005.jpg",
                    "imageinfo": [
                        {
                            "url": "https://upload/goto.jpg",
                            "width": 800,
                            "height": 600,
                            "extmetadata": {
                                "ImageDescription": {"value": "後藤真希 live"}
                            },
                        }
                    ],
                }
            },
        )
        self.assertEqual(
            photo_chain.commons_search_photo("後藤真希", fetch), "https://upload/goto.jpg"
        )

    def test_malformed_payload_yields_none(self):
        for payload in ("not json", "[]", "null"):
            self.assertIsNone(photo_chain.commons_search_photo("x", lambda url: payload))

        def boom(url):
            raise OSError("commons down")

        self.assertIsNone(photo_chain.commons_search_photo("x", boom))


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
