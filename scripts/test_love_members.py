import json
import unittest

import love_members


LOVE_LIST_FIXTURE = '''
<li>
  <a href="/feature/otani_emiri">
    <p class="thumb"><img src="/static/equallove/cmn/dummy.png" style="background-image:url(https://equal-love.jp/image/profile/otani_emiri.jpg);"></p>
  </a>
  <div class="txtSide">
    <p class="name">大谷 映美里 <span class="yomi">OTANI EMIRI</span></p>
    <ul class="snsList"></ul>
  </div>
</li>
'''

ME_LIST_FIXTURE = '''
<li class="inview">
  <a href="/feature/profile_sakurai_momo">
    <p class="thumb"><img src="/static/notequalme/cmn/dummy.png" style="background-image:url(https://not-equal-me.jp/image/profile/sakurai_momo_thumb.jpg);"></p>
  </a>
  <div class="txtSide">
    <div class="name">
      <div class="nameWrap">
        <span>櫻井 もも</span>
        <p class="yomi sp">SAKURAI MOMO</p>
      </div>
    </div>
  </div>
</li>
'''

JOY_LIST_FIXTURE = '''
<li class="inview">
  <a href="/feature/profile_aida_jurii">
    <figure class="thumb inview">
      <img src="/static/common/global-image/dummy.gif" style="background-image:url(https://nearly-equal-joy.jp/image/profile/aida_jurii.jpg);" alt="AIDA JURII">
    </figure>
  </a>
  <div class="txt">
    <p class="name">逢田 珠里依</p>
    <p class="yomi">AIDA JURII</p>
  </div>
</li>
'''

DETAIL_FIXTURE = '''
<dl class="clearfix">
  <dt>血液型</dt><dd>O型</dd>
  <dt>星座</dt><dd>うお座</dd>
  <dt>身長</dt><dd>155cm</dd>
  <dt>生年月日</dt><dd>1998/3/15</dd>
  <dt>出身地</dt><dd>東京都</dd>
  <dt>趣味</dt><dd>メイクやファッションを楽しむこと、ラーメン巡り</dd>
  <dt>特技</dt><dd>ジョッキ持ち</dd>
</dl>
'''

WIKI_FIXTURE = '''
== メンバー ==
{| class="wikitable sortable"
! 名前 || よみ || 生年月日 || 出身地 || 身長 || 血液型 || 備考
|-
| [[大谷映美里]] || おおたに えみり || {{生年月日と年齢|1998|3|15}}|| [[東京都]]|| 155cm || O型 || {{Refnest|愛称は、みりにゃ<ref>x</ref>。}}
|-
| [[佐々木舞香]] || ささき まいか || {{生年月日と年齢|2000|1|21}}|| [[愛知県]]|| 158cm || B型 || {{Refnest|愛称は、まいか。}}
|}
=== 元メンバー ===
{| class="wikitable sortable"
! 名前 || よみ || 生年月日 || 出身地 || 身長 || 血液型 || 最終在籍日 || 備考
|-
| [[佐竹のん乃]] || さたけ のんの || {{生年月日と年齢|1998|11|6}} || [[群馬県]]|| 159&nbsp;cm || A型 || 2021年3月6日<ref>x</ref> || {{Refnest|愛称は、のんの<ref>x</ref>。}}
|}
'''


class ParseListTests(unittest.TestCase):
    def test_love_item(self):
        items = love_members.parse_list(LOVE_LIST_FIXTURE, "love")
        self.assertEqual(
            items,
            [{
                "path": "/feature/otani_emiri",
                "name": "大谷 映美里",
                "romaji": "OTANI EMIRI",
                "photo": "https://equal-love.jp/image/profile/otani_emiri.jpg",
            }],
        )

    def test_me_item_strips_thumb(self):
        items = love_members.parse_list(ME_LIST_FIXTURE, "me")
        self.assertEqual(items[0]["photo"], "https://not-equal-me.jp/image/profile/sakurai_momo.jpg")
        self.assertEqual(items[0]["name"], "櫻井 もも")

    def test_joy_item(self):
        items = love_members.parse_list(JOY_LIST_FIXTURE, "joy")
        self.assertEqual(items[0]["name"], "逢田 珠里依")
        self.assertEqual(items[0]["path"], "/feature/profile_aida_jurii")


class ParseDetailTests(unittest.TestCase):
    def test_maps_fields_and_normalizes_birth(self):
        bio = love_members.parse_detail(DETAIL_FIXTURE)
        self.assertEqual(bio["birth"], "1998.03.15")
        self.assertEqual(bio["blood"], "O型")
        self.assertEqual(bio["sign"], "うお座")
        self.assertEqual(bio["height"], "155cm")
        self.assertEqual(bio["from"], "東京都")
        self.assertIn("ラーメン巡り", bio["hobby"])
        self.assertEqual(bio["skill"], "ジョッキ持ち")


class ParseWikiTests(unittest.TestCase):
    def test_current_and_former_rows(self):
        out = love_members.parse_wiki_members(WIKI_FIXTURE)
        self.assertEqual(sorted(out.keys()), sorted(["大谷映美里", "佐々木舞香", "佐竹のん乃"]))
        o = out["大谷映美里"]
        self.assertEqual(o["kana"], "おおたに えみり")
        self.assertEqual(o["birth"], "1998.03.15")
        self.assertEqual(o["from"], "東京都")
        self.assertEqual(o["height"], "155cm")
        self.assertEqual(o["blood"], "O型")
        self.assertEqual(o["nick"], "みりにゃ")
        self.assertNotIn("former", o)
        n = out["佐竹のん乃"]
        self.assertTrue(n["former"])
        self.assertEqual(n["grad"], "2021.03.06")
        self.assertEqual(n["from"], "群馬県")


class PhotoFallbackTests(unittest.TestCase):
    def test_wayback_photo_uses_first_snapshot(self):
        def fetch(url):
            return json.dumps([
                ["urlkey", "timestamp", "original"],
                ["x", "20220525051254", "orig"],
            ])
        self.assertEqual(
            love_members.wayback_photo("https://nearly-equal-joy.jp/image/profile/fukuyama_moeka.jpg", fetch),
            "https://web.archive.org/web/20220525051254id_/https://nearly-equal-joy.jp/image/profile/fukuyama_moeka.jpg",
        )

    def test_wayback_photo_none_without_snapshot(self):
        self.assertIsNone(love_members.wayback_photo("https://x/y.jpg", lambda url: "[]"))

    def test_commons_photo(self):
        def fetch(url):
            return json.dumps({"query": {"pages": {"1": {"thumbnail": {"source": "https://upload/c.jpg"}}}}})
        self.assertEqual(love_members.commons_photo("齊藤なぎさ", fetch), "https://upload/c.jpg")

    def test_resolve_former_photos_falls_back_to_archived_list_then_commons(self):
        archived_list = LOVE_LIST_FIXTURE.replace(
            "otani_emiri", "satake_nonno"
        ).replace("大谷 映美里", "佐竹 のん乃").replace("OTANI EMIRI", "SATAKE NONNO")

        def fetch(url):
            if "cdx" in url and "satake_nonno" in url:
                return json.dumps([
                    ["urlkey", "timestamp", "original"],
                    ["x", "20210201000000", "orig"],
                ])
            if "cdx" in url:
                return json.dumps([
                    ["urlkey", "timestamp", "original"],
                    ["x", "20220101000000", "list"],
                ])
            if "web.archive.org/web/20220101000000id_" in url:
                return archived_list
            if "pageimages" in url:
                if "%E7%A6%8F%E5%B1%B1" in url:
                    return json.dumps({"query": {"pages": {"1": {}}}})
                return json.dumps({"query": {"pages": {"1": {"thumbnail": {"source": "https://upload/nagisa.jpg"}}}}})
            raise AssertionError("unexpected url " + url)

        members = [
            {"name": "佐竹のん乃", "group": "=LOVE", "status": "former", "file": "love:=LOVE:佐竹のん乃"},
            {"name": "齊藤なぎさ", "group": "=LOVE", "status": "former", "file": "love:=LOVE:齊藤なぎさ"},
            {"name": "福山萌叶", "group": "≒JOY", "status": "former", "file": "love:≒JOY:福山萌叶"},
        ]
        urls = {}
        warned = []
        love_members.resolve_former_photos(members, urls, fetch, warn=warned.append)
        self.assertIn("20210201000000id_", urls["love:=LOVE:佐竹のん乃"])
        self.assertEqual(urls["love:=LOVE:齊藤なぎさ"], "https://upload/nagisa.jpg")
        self.assertNotIn("love:≒JOY:福山萌叶", urls)
        self.assertTrue(any("福山萌叶" in w for w in warned))


class BuildMembersTests(unittest.TestCase):
    def test_merges_official_and_wiki(self):
        official = {
            "=LOVE": [{
                "path": "/feature/otani_emiri",
                "name": "大谷 映美里",
                "romaji": "OTANI EMIRI",
                "photo": "https://equal-love.jp/image/profile/otani_emiri.jpg",
                "detail": {"birth": "1998.03.15", "from": "東京都", "height": "155cm"},
            }],
        }
        wiki = {
            "=LOVE": {
                "大谷映美里": {"kana": "おおたに えみり", "birth": "1998.03.15", "from": "東京都", "nick": "みりにゃ"},
                "佐竹のん乃": {"kana": "さたけ のんの", "birth": "1998.11.06", "former": True, "grad": "2021.03.06"},
            }
        }
        members, urls = love_members.build_members(official, wiki)
        by_name = {m["name"]: m for m in members}
        self.assertEqual(len(members), 2)
        cur = by_name["大谷 映美里"]
        self.assertEqual(cur["status"], "current")
        self.assertEqual(cur["series"], "love")
        self.assertEqual(cur["generation"], "1期生")
        self.assertEqual(cur["kana"], "おおたに えみり")
        self.assertEqual(cur["nick"], "みりにゃ")
        self.assertEqual(cur["bio"]["romaji"], "OTANI EMIRI")
        self.assertEqual(urls[cur["file"]], "https://equal-love.jp/image/profile/otani_emiri.jpg")
        old = by_name["佐竹のん乃"]
        self.assertEqual(old["status"], "former")
        self.assertEqual(old["end"], "2021.03.06")
        self.assertNotIn(old["file"], urls)

    def test_sections_shape(self):
        members, _ = love_members.build_members({}, {"≒JOY": {"逢田珠里依": {"kana": "あいだ じゅりい"}}})
        for m in members:
            m["id"] = "m" + m["name"]
            m["img"] = False
        sections = love_members.build_sections(members)
        self.assertEqual(sections[0]["group"], "≒JOY")
        self.assertEqual(sections[0]["series"], "love")
        self.assertEqual(sections[0]["label"], "1期生")
        self.assertEqual(sections[0]["members"][0]["name"], "逢田珠里依")



JOY_WIKI_FIXTURE = """
== メンバー ==
{| class="wikitable sortable" style="text-align:center;font-size:small;"
! 名前 || よみ 
!メンバーカラー|| 生年月日 || 出身地 || 身長 || 血液型 || 愛称 || 備考
|-
| [[逢田珠里依]] || あいだ じゅりい 
|| {{Color box|5F161D}} ボルドー || {{生年月日と年齢|2005|9|13}}|| [[東京都]]|| 161cm || O型 || じゅりい || 
|-
| [[大信田美月]] || おおしだ みつき 
|| {{Color box|884898}} 紫 || {{生年月日と年齢|2004|9|27}} || 大阪府 || 155cm || O型 || みっちゃん || 
|}
=== 元メンバー ===
{| class="wikitable sortable" style="text-align:center;font-size:small;"
! 名前 || よみ || 生年月日 || 出身地 || 身長 || 血液型 || 愛称 || 最終在籍日 || 備考
|-
| 福山萌叶 || ふくやま もえか || {{生年月日と年齢|2004|10|22}} || 神奈川県|| 162.5cm || O型 || もえか ||2023年3月29日<ref>x</ref>||{{Refnest|note}}
|}
"""

BOGUS_TABLE_FIXTURE = """
== 作品 ==
{|
|-
| [[埼玉県]] || {{生年月日と年齢|2000|1|1}} || 特典会場
|-
| [[バセドウ病]] || {{生年月日と年齢|1999|2|2}} || 備考リンク
|}
"""


class WikiTwoLineRowTests(unittest.TestCase):
    def test_two_line_rows_with_color_column(self):
        out = love_members.parse_wiki_members(JOY_WIKI_FIXTURE)
        self.assertEqual(sorted(out.keys()), ["大信田美月", "福山萌叶", "逢田珠里依"])
        a = out["逢田珠里依"]
        self.assertEqual(a["kana"], "あいだ じゅりい")
        self.assertEqual(a["birth"], "2005.09.13")
        self.assertEqual(a["from"], "東京都")
        self.assertEqual(a["height"], "161cm")
        self.assertEqual(a["blood"], "O型")
        self.assertEqual(a["nick"], "じゅりい")
        self.assertNotIn("former", a)
        m = out["大信田美月"]
        self.assertEqual(m["from"], "大阪府")
        f = out["福山萌叶"]
        self.assertTrue(f["former"])
        self.assertEqual(f["grad"], "2023.03.29")
        self.assertEqual(f["kana"], "ふくやま もえか")

    def test_non_member_rows_are_filtered(self):
        out = love_members.parse_wiki_members(BOGUS_TABLE_FIXTURE)
        self.assertEqual(out, {})

    def test_real_article_shape_regression(self):
        """真实抓过的三团块头（含跨行与颜色列）不产生非成员条目。"""
        out = love_members.parse_wiki_members(JOY_WIKI_FIXTURE + BOGUS_TABLE_FIXTURE)
        for name in ("埼玉県", "バセドウ病", "Color box"):
            self.assertNotIn(name, out)


ARCHIVED_ME_FIXTURE = '''<li class="inview">
<a href="/web/20210305034043/https://not-equal-me.jp/feature/profile_suganami_mirei">
<p class="thumb"><img src="/web/20210305034043im_/https://not-equal-me.jp/static/notequalme/cmn/dummy.png" style="background-image:url(https://web.archive.org/web/20210305034043im_/https://not-equal-me.jp/image/profile/suganami_mirei_thumb.jpg);"></p>
</a>
<div class="txtSide">
<div class="name">
<div class="nameWrap">
<span>菅波 美玲</span>
<ul class="snsList"></ul>
</div><!-- nameWrap -->
<p class="yomi">SUGANAMI MIREI</p>
</div><!-- name -->
</div><!-- txtSide -->
</li>
'''


class ArchivedPageTests(unittest.TestCase):
    def test_wayback_rewritten_markup_is_parsed_to_original_urls(self):
        items = love_members.parse_list(ARCHIVED_ME_FIXTURE, "me")
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["name"], "菅波 美玲")
        self.assertEqual(items[0]["romaji"], "SUGANAMI MIREI")
        self.assertEqual(
            items[0]["photo"],
            "https://not-equal-me.jp/image/profile/suganami_mirei.jpg",
        )
        self.assertEqual(items[0]["path"], "/feature/profile_suganami_mirei")

    def test_original_url_strips_wayback_prefix(self):
        self.assertEqual(
            love_members.original_url(
                "https://web.archive.org/web/20210305034043im_/https://x/y.jpg"
            ),
            "https://x/y.jpg",
        )
        self.assertEqual(love_members.original_url("https://x/y.jpg"), "https://x/y.jpg")


ARCHIVED_LONG_SNS_FIXTURE = '''<li class="inview">
<a href="/web/20200922165743/https://not-equal-me.jp/feature/profile_suganami_mirei">
<p class="thumb"><img src="/web/20200922165743im_/https://x/dummy.png" style="background-image:url(https://web.archive.org/web/20200922165743im_/https://not-equal-me.jp/image/profile/suganami_mirei_thumb.jpg);"></p>
</a>
<div class="txtSide">
<div class="name">
<div class="nameWrap">
<span>菅波 美玲</span>
<ul class="snsList">
<li class="showroom"><a href="https://www.showroom-live.com/r/ME_MIREI_SUGANAMI" target="_blank"><img src="/x.png" alt="showroom"></a></li>
<li class="twitter"><a href="https://twitter.com/suganami_mirei" target="_blank"><i class="fa"></i></a></li>
<li class="instagram"><a href="https://instagram.com/suganami_mirei" target="_blank"><i class="fa"></i></a></li>
<li class="tiktok"><a href="https://tiktok.com/@notequal_me_mirei" target="_blank"><i class="fa"></i></a></li>
</ul>
</div><!-- nameWrap -->
<p class="yomi">SUGANAMI MIREI</p>
</div><!-- name -->
</div><!-- txtSide -->
</li>
'''


class LooseParseTests(unittest.TestCase):
    def test_long_sns_list_is_handled_by_archived_pairs(self):
        self.assertEqual(love_members.parse_list(ARCHIVED_LONG_SNS_FIXTURE, "me"), [])
        pairs = love_members.archived_photo_pairs(ARCHIVED_LONG_SNS_FIXTURE)
        self.assertEqual(
            pairs["菅波美玲"],
            "https://not-equal-me.jp/image/profile/suganami_mirei.jpg",
        )

    def test_archived_list_collects_members(self):
        def fetch(url):
            if "cdx" in url:
                return json.dumps([
                    ["urlkey", "timestamp", "original"],
                    ["x", "20200922165743", "list"],
                ])
            if "web.archive.org/web/20200922165743id_" in url:
                return ARCHIVED_LONG_SNS_FIXTURE
            if "suganami_mirei.jpg" in url and "cdx" in url:
                return json.dumps([["u", "ts", "o"], ["x", "20200403132326", "o"]])
            raise AssertionError(url)

        photos = love_members.archived_list_photos("≠ME", fetch)
        self.assertEqual(
            photos["菅波美玲"],
            "https://not-equal-me.jp/image/profile/suganami_mirei.jpg",
        )


ARCHIVED_JOY_FIXTURE = '''
<li class="inview">
<a href="#popup_08" class="profile--pop">
<figure class="thumb">
<img src="https://web.archive.org/web/20220525051229im_/https://nearly-equal-joy.jp/image/profile/fukuyama_moeka.jpg" alt="FUKUYAMA MOEKA">
</figure>
<div class="txt">
<p class="name">福山 萌叶</p>
<p class="yomi">FUKUYAMA MOEKA</p>
</div>
</a>
</li>
<li class="inview">
<a href="#popup_09" class="profile--pop">
<figure class="thumb">
<img src="https://web.archive.org/web/20220525051229im_/https://nearly-equal-joy.jp/image/profile/aida_jurii.jpg" alt="AIDA JURII">
</figure>
<div class="txt">
<p class="name">逢田 珠里依</p>
<p class="yomi">AIDA JURII</p>
</div>
</a>
</li>
'''


class ArchivedPhotoPairTests(unittest.TestCase):
    def test_popup_anchored_rows_yield_name_and_original_photo(self):
        pairs = love_members.archived_photo_pairs(ARCHIVED_JOY_FIXTURE)
        self.assertEqual(
            pairs["福山萌叶"],
            "https://nearly-equal-joy.jp/image/profile/fukuyama_moeka.jpg",
        )
        self.assertEqual(
            pairs["逢田珠里依"],
            "https://nearly-equal-joy.jp/image/profile/aida_jurii.jpg",
        )


if __name__ == "__main__":
    unittest.main()
