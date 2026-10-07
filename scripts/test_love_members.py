import json
import urllib.parse
import unittest

import fetch_pool

# 测试的 fetch 是瞬时假对象：关掉真实源站的请求间隔（否则每个用例白等几十秒）
fetch_pool.INTERVAL_SCALE = 0.0
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
        notes = {}
        love_members.resolve_former_photos(members, urls, fetch, notes=notes)
        self.assertIn("20210201000000id_", urls["love:=LOVE:佐竹のん乃"])
        self.assertEqual(urls["love:=LOVE:齊藤なぎさ"], "https://upload/nagisa.jpg")
        self.assertNotIn("love:≒JOY:福山萌叶", urls)
        # 工单 01：原因交给 notes（不再逐人 warn）
        self.assertEqual(notes.get("love:≒JOY:福山萌叶"), "源里没有")

    def test_query_failure_reason_is_not_flattened_to_source_empty(self):
        """工单 02：Commons 请求失败 → 「查询失败」，不许压成「源里没有」
        （429 被记成「源里没有」是本仓记录过的坑）。"""
        members = [
            {
                "name": "佐竹のん乃",
                "group": "=LOVE",
                "status": "former",
                "file": "love:=LOVE:佐竹のん乃",
            }
        ]

        def fetch(url):
            if "web.archive.org/cdx" in url:
                return ""  # 没有归档列表
            raise RuntimeError("429 Too Many Requests")

        urls, notes = {}, {}
        love_members.resolve_former_photos(members, urls, fetch, notes=notes)
        self.assertEqual(notes.get("love:=LOVE:佐竹のん乃"), "查询失败")


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


class IncrementalSkipTests(unittest.TestCase):
    """增量跑（ADR-0023）：在 `skip_photo` 名单（键集合）里的成员不解析照片 —— 连该团的归档页
    都不抓（没有需要解析的人时不该发任何请求）。"""

    def test_resolve_former_photos_skips_flagged_member(self):
        members = [{"name": "A", "file": "f1", "group": "=LOVE"}]
        urls = {}
        calls = []

        def fetch(url):
            calls.append(url)
            return "[]"

        love_members.resolve_former_photos(
            members, urls, fetch, skip={("=LOVE", "A")}
        )
        self.assertEqual(urls, {})
        self.assertEqual(calls, [], "全被跳过时不该抓归档页")


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


EMPTY_WIKI = "== メンバー ==\n{|\n|}"


def load_fetcher(fail_detail=None, fail_cdx=False):
    """按 URL 分派的最小离线抓取器（三官网 + Wikipedia + 空 CDX/Commons）。"""

    def fetch(url):
        if url.startswith(love_members.WIKI_API):
            page = urllib.parse.unquote(url)
            text = WIKI_FIXTURE if "page==LOVE" in page else EMPTY_WIKI
            return json.dumps({"parse": {"wikitext": {"*": text}}})
        if "cdx" in url:
            if fail_cdx:
                raise OSError("cdx down")
            return "[]"
        if "pageimages" in url:
            return json.dumps({"query": {"pages": {"1": {}}}})
        if url == "https://equal-love.jp/feature/profile":
            return LOVE_LIST_FIXTURE
        if url == "https://not-equal-me.jp/feature/profile":
            return ME_LIST_FIXTURE
        if url == "https://nearly-equal-joy.jp/feature/profile":
            return JOY_LIST_FIXTURE
        if "/feature/" in url:
            if fail_detail and fail_detail in url:
                raise OSError("detail down")
            return DETAIL_FIXTURE
        raise AssertionError("unexpected url " + url)

    return fetch


class LoadTests(unittest.TestCase):
    def test_load_assembles_members_and_photo_urls(self):
        notes = {}
        members, urls = love_members.load(load_fetcher(), notes=notes)
        by_group = {}
        for m in members:
            by_group.setdefault(m["group"], []).append(m)
        self.assertEqual(
            {g: len(ms) for g, ms in by_group.items()},
            {"=LOVE": 3, "≠ME": 1, "≒JOY": 1},
        )
        merged = next(m for m in members if m["name"] == "大谷 映美里")
        self.assertEqual(merged["kana"], "おおたに えみり")
        self.assertEqual(merged["bio"]["romaji"], "OTANI EMIRI")
        self.assertEqual(merged["bio"]["blood"], "O型")
        self.assertEqual(
            urls["love:=LOVE:大谷 映美里"],
            "https://equal-love.jp/image/profile/otani_emiri.jpg",
        )
        self.assertEqual(
            urls["love:≠ME:櫻井 もも"],
            "https://not-equal-me.jp/image/profile/sakurai_momo.jpg",
        )
        self.assertEqual(
            urls["love:≒JOY:逢田 珠里依"],
            "https://nearly-equal-joy.jp/image/profile/aida_jurii.jpg",
        )
        # 工单 01：解析不到的人由 notes 记录原因（报告由管线打一份，不再逐人 warn）
        self.assertEqual(notes.get("love:=LOVE:佐竹のん乃"), "源里没有")

    def test_load_propagates_detail_failure_for_fail_fast(self):
        with self.assertRaises(OSError):
            love_members.load(load_fetcher(fail_detail="profile_sakurai_momo"))

    def test_load_survives_archive_failures(self):
        members, urls = love_members.load(load_fetcher(fail_cdx=True), warn=lambda _: None)
        self.assertEqual(len(members), 5)
        self.assertIn("love:=LOVE:大谷 映美里", urls)




class ParseNickTest(unittest.TestCase):
    """爱称解析单独测：它是从 parse_member_chunk 抽出来的缝，两条来源 + 两个排除条件。"""

    def test_takes_cell_after_blood_type(self):
        chunk = "\n||\n|生年月日と年齢|1998|3|15\n||O型||みかにゃ||"
        self.assertEqual(love_members.parse_nick(chunk), "みかにゃ")

    def test_skips_cell_that_is_a_label(self):
        # 血型后那一格是「愛称」说明而不是昵称 → 不得当昵称
        chunk = "\n||\n|生年月日と年齢|1998|3|15\n||A型||愛称は、みくにゃ(||"
        self.assertEqual(love_members.parse_nick(chunk), "みくにゃ")

    def test_falls_back_to_sentence_without_blood(self):
        chunk = "概要\n愛称は、ゆか（ゆーか）\n"
        self.assertEqual(love_members.parse_nick(chunk), "ゆか")

    def test_returns_none_when_nothing(self):
        chunk = "\n||\n|生年月日と年齢|1998|3|15\n||B型||\n"
        self.assertIsNone(love_members.parse_nick(chunk))




class BuildBioTest(unittest.TestCase):
    """build_bio 的三条语义：官网详情页打底、官网优先、Wikipedia 只补空缺。"""

    def test_official_detail_is_the_base(self):
        bio = love_members.build_bio({"detail": {"birth": "1998/3/15", "hobby": "Idle"}}, {})
        self.assertEqual(bio, {"birth": "1998/3/15", "hobby": "Idle"})

    def test_official_value_wins_over_wiki(self):
        bio = love_members.build_bio(
            {"detail": {"birth": "官网生日"}}, {"birth": "wiki生日", "from": "东京都"}
        )
        self.assertEqual(bio["birth"], "官网生日", "官网已有的字段不能被 Wikipedia 覆盖")
        self.assertEqual(bio["from"], "东京都", "官网没有的字段由 Wikipedia 补上")

    def test_no_detail_no_romaji(self):
        self.assertEqual(love_members.build_bio(None, {}), {})
        self.assertEqual(love_members.build_bio({}, {"blood": "O型"}), {"blood": "O型"})

    def test_romaji_comes_from_official(self):
        bio = love_members.build_bio({"romaji": "Mirei"}, {})
        self.assertEqual(bio["romaji"], "Mirei")


if __name__ == "__main__":
    unittest.main()
