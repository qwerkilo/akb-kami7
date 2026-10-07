"""共享照片回退链的测试：Wayback CDX 查询 / Wayback 取图 / Commons 取图。

这些用例原先在 test_love_members.py 里（那时链住在 love_members 内）。它们随函数一起
搬到共享模块 photo_chain —— 站点无关的逻辑要有自己的测试，而不是寄居在某个 loader 里。
"""
import json
import unittest
import urllib.parse

import photo_chain



class CommonsPhotoCharacterizationTests(unittest.TestCase):
    def test_takes_jawiki_pageimage_thumbnail(self):
        seen = {}

        def fetch(url):
            seen["url"] = url
            return json.dumps(
                {"query": {"pages": {"1": {"thumbnail": {"source": "https://upload/c.jpg"}}}}}
            )

        self.assertEqual(
            photo_chain.commons_photo("齊藤なぎさ", fetch), ("https://upload/c.jpg", None)
        )
        q = urllib.parse.parse_qs(urllib.parse.urlparse(seen["url"]).query)
        self.assertEqual(q["titles"], ["齊藤なぎさ"])
        self.assertEqual(q["prop"], ["pageimages"])
        self.assertEqual(q["pithumbsize"], ["800"])
        self.assertEqual(urllib.parse.urlparse(seen["url"]).netloc, "ja.wikipedia.org")

    def test_no_thumbnail_yields_source_empty(self):
        self.assertEqual(
            photo_chain.commons_photo(
                "x", lambda url: json.dumps({"query": {"pages": {"1": {}}}})
            ),
            (None, "源里没有"),
        )

    def test_malformed_or_erroring_payload_yields_query_failed(self):
        self.assertEqual(
            photo_chain.commons_photo("x", lambda url: "not json"), (None, "查询失败")
        )

    def test_json_that_is_not_an_object_yields_query_failed(self):
        """端点在异常时会回 JSON 数组而不是对象。原来只把 json.loads 包进 try，
        后面的 .get 就抛出去了 —— 抓取路径上抛异常会让整条装配停摆。
        形状异常是**失败形状**（工单 09）：原因记「查询失败」。"""
        for payload in ("[]", "[1, 2]", "null"):
            self.assertEqual(
                photo_chain.commons_photo("x", lambda url, p=payload: p),
                (None, "查询失败"),
            )

        def boom(url):
            raise OSError("commons down")

        self.assertEqual(photo_chain.commons_photo("x", boom), (None, "查询失败"))


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
            photo_chain.commons_search_photo("須藤茉麻", fetch),
            ("https://upload/sudo.jpg", None),
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
        self.assertEqual(
            photo_chain.commons_search_photo("村上愛", fetch), (None, "源里没有")
        )

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
        self.assertEqual(
            photo_chain.commons_search_photo("金澤朋子", fetch), (None, "源里没有")
        )

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
            photo_chain.commons_search_photo("後藤真希", fetch),
            ("https://upload/large.jpg", None),
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
            photo_chain.commons_search_photo("後藤真希", fetch),
            ("https://upload/goto.jpg", None),
        )

    def test_malformed_payload_yields_query_failed(self):
        for payload in ("not json", "[]", "null"):
            self.assertEqual(
                photo_chain.commons_search_photo("x", lambda url, p=payload: p),
                (None, "查询失败"),
            )

        def boom(url):
            raise OSError("commons down")

        self.assertEqual(photo_chain.commons_search_photo("x", boom), (None, "查询失败"))




if __name__ == "__main__":
    unittest.main()


class ReasonTests(unittest.TestCase):
    """工单 02 / ADR-0024：链自己给原因（「查询失败」/「源里没有」）——
    请求失败与「查了但没有」必须分得开（429 被记成「源里没有」是本仓记录过的坑）。"""

    def test_search_request_failure_is_query_failed(self):
        def boom(url):
            raise RuntimeError("429 Too Many Requests")

        self.assertEqual(photo_chain.commons_search_photo("後藤真希", boom), (None, "查询失败"))

    def test_search_empty_result_is_source_empty(self):
        def empty(url):
            if "list=search" in url:
                return json.dumps({"query": {"search": []}})
            return json.dumps({"query": {"pages": {}}})

        self.assertEqual(photo_chain.commons_search_photo("後藤真希", empty), (None, "源里没有"))

    def test_pageimages_failure_is_query_failed(self):
        def boom(url):
            raise RuntimeError("503")

        self.assertEqual(photo_chain.commons_photo("後藤真希", boom), (None, "查询失败"))


class ShapeAnomalyTests(unittest.TestCase):
    """形状异常（端点异常时回 JSON 数组）也是**失败形状**，不是「源里没有」。"""

    def test_array_payload_is_a_failure_not_an_empty_result(self):
        def arr(url):
            return json.dumps(["not", "a", "dict"])

        self.assertEqual(photo_chain.commons_photo("後藤真希", arr), (None, "查询失败"))

    def test_array_payload_in_search_is_a_failure(self):
        def arr(url):
            return json.dumps(["nope"])

        self.assertEqual(photo_chain.commons_search_photo("後藤真希", arr), (None, "查询失败"))


class SameWritingLimitationTests(unittest.TestCase):
    """工单 09 判据 3：**已知限制**——子串校验挡得住不同写法的同名（村上愛 vs 村上恵），
    挡不住**同写法的两个人**；`commons_photo`（条目首图）路径更弱（无姓名校验）。
    测试名写明这是记录限制，不是验收正确性。"""

    @staticmethod
    def _fetch(hits, pages):
        def fetch(url):
            if "list=search" in url:
                return json.dumps({"query": {"search": [{"title": t} for t in hits]}})
            return json.dumps({"query": {"pages": pages}})

        return fetch

    def test_known_limitation_same_writing_other_person_is_not_rejected(self):
        fetch = self._fetch(
            ["File:小川紗季.jpg"],
            {
                "1": {
                    "title": "File:小川紗季.jpg",
                    "imageinfo": [
                        {
                            "url": "https://upload/ballet.jpg",
                            "width": 300,
                            "height": 400,
                            "extmetadata": {
                                "ImageDescription": {"value": "バレエダンサーの小川紗季"}
                            },
                        }
                    ],
                }
            },
        )
        # 记录当前行为：同写法他人**会**被采纳（已知限制，见 ADR-0022 补充）
        self.assertEqual(
            photo_chain.commons_search_photo("小川紗季", fetch),
            ("https://upload/ballet.jpg", None),
        )

    def test_cross_field_concatenation_no_longer_false_matches(self):
        """跨界拼接（title="File:前田" + desc="憂佳です"）此前会假命中「前田憂佳」——
        两轴审查修掉：姓名必须出现在**标题或描述各自**里。"""
        fetch = self._fetch(
            ["File:前田"],
            {
                "1": {
                    "title": "File:前田",
                    "imageinfo": [
                        {
                            "url": "https://upload/x.jpg",
                            "width": 300,
                            "height": 400,
                            "extmetadata": {"ImageDescription": {"value": "憂佳です"}},
                        }
                    ],
                }
            },
        )
        self.assertEqual(
            photo_chain.commons_search_photo("前田憂佳", fetch), (None, "源里没有")
        )
