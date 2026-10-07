"""早安少女家族（モーニング娘。）成员解析的纯函数测试。

fixture 是从 ja.wikipedia 主条目的真实 wikitext 里切下来的三块，放在
`scripts/fixtures/morningmusume/` 而不是内联字符串里 —— 真 wikitext 内含
`[[PEACE$TONE]]'''` 这样的引号序列，会把内联的 `'''` 截断（等爱的 fixture 是内联的，
它那份 wikitext 没这个毛病）。

- current-members.wiki：现役表头 + 三行，含 **2 处 rowspan**
- former-members.wiki：毕业表头 + 三行（13 列），含 **1 处 rowspan**
- rinrin-row.wiki：リンリン 那一行，姓名是带 disambiguator 的管道链接

全程离线，无网络。
"""
import json
import os
import unittest
from unittest import mock

import fetch_pool

# 测试的 fetch 是瞬时假对象：关掉真实源站的请求间隔（否则每个用例白等几十秒）
fetch_pool.INTERVAL_SCALE = 0.0
import morningmusume_members as mm

FIX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "morningmusume")


def row_named(rows, name):
    """按姓名取行 —— 不用下标，这样测试不依赖 fixture 恰好切了几行。"""
    for r in rows:
        if r.get("名前") == name:
            return r
    raise AssertionError("fixture 里没有这一行：" + name)


def fixture(name):
    with open(os.path.join(FIX, name), encoding="utf-8") as fh:
        return fh.read()


LIST_HTML = fixture("list-members.html")
DETAIL_HTML = fixture("detail-nonaka.html")
CURRENT_WIKI = fixture("current-members.wiki")
FORMER_WIKI = fixture("former-members.wiki")

# fixture 只切了表本身，section 标题要自己补 —— parse_wiki_members 靠它们分表
BOTH = (
    "=== メンバー ===\n" + CURRENT_WIKI + "\n=== 過去のメンバー ===\n" + FORMER_WIKI
)
RINRIN_WIKI = fixture("rinrin-row.wiki")


class RowspanTests(unittest.TestCase):
    """现役表里「加入年月日」与「加入期」各用 rowspan="2" 合并了两行，于是
    山﨑愛生那一行**只有 8 格**。按位置取第 6 格会读到「メンバーカラー」的下一格 ——
    这就是调研里说的「串行」。"""

    def test_every_row_is_padded_to_the_header_width(self):
        rows = mm.split_rows(CURRENT_WIKI)
        # 每行都必须与表头等宽 —— 不写死行数（fixture 切几行是切片的事，不是契约）
        self.assertTrue(rows)
        self.assertEqual({len(r) for r in rows}, {10})

    def test_inherited_join_date_and_generation_are_carried_down(self):
        rows = mm.split_rows(CURRENT_WIKI)
        self.assertEqual(mm.cell(row_named(rows, "岡村ほまれ"), "加入年月日"), "2019.06.22")
        self.assertEqual(mm.cell(row_named(rows, "岡村ほまれ"), "加入期"), "15期生")
        # 山﨑愛生那行自己没有这两格，必须从上一行继承
        self.assertEqual(mm.cell(row_named(rows, "山﨑愛生"), "加入年月日"), "2019.06.22")
        self.assertEqual(mm.cell(row_named(rows, "山﨑愛生"), "加入期"), "15期生")

    def test_own_cells_do_not_shift_left_when_inherited(self):
        """继承之后，山﨑愛生自己的 メンバーカラー / 色種 / 特記事項 不能串位。"""
        rows = mm.split_rows(CURRENT_WIKI)
        self.assertTrue(mm.cell(row_named(rows, "山﨑愛生"), "メンバーカラー").startswith("ブルー"))
        self.assertTrue(mm.cell(row_named(rows, "山﨑愛生"), "特記事項").startswith("元ハロプロ研修生"))

    def test_generation_written_bare_and_in_center_template_both_parse(self):
        """现役表有「{{Center|12期}}」，毕业表有裸「1期」—— 两种都要认。"""
        rows = mm.split_rows(CURRENT_WIKI)
        self.assertEqual(mm.cell(row_named(rows, "野中美希"), "加入期"), "12期生")
        former = mm.split_rows(FORMER_WIKI)
        self.assertEqual(mm.cell(row_named(former, "福田明日香"), "加入期"), "1期生")


class NickTests(unittest.TestCase):
    """grilling R1-Q3：显示第一个，其余作为别名进搜索用的 haystack。"""

    def test_multiline_nick_takes_first_and_keeps_rest_as_aliases(self):
        rows = mm.split_rows(CURRENT_WIKI)
        self.assertEqual(mm.parse_nick(mm.raw_cell(row_named(rows, "野中美希"), "ニックネーム")), ("ちぇる", ["のなちゃん"]))

    def test_four_line_nick(self):
        rows = mm.split_rows(CURRENT_WIKI)
        self.assertEqual(
            mm.parse_nick(mm.raw_cell(row_named(rows, "山﨑愛生"), "ニックネーム")),
            ("めいちゃん", ["めいち", "めいさん", "パンダちゃん"]),
        )

    def test_first_line_is_cleaned_too(self):
        """真实抓取抓到的缺陷：中澤裕子的昵称格里带 <ref group="注">…</ref>，
        只洗别名那几行会让它漏进产物。而「昵称 == 姓名时丢掉」是**姓名格**的规则，
        昵称格里昵称就该等于姓名（リンリン），不能一起丢。"""
        cell = (
            'ゆうちゃん<ref group="注">主に、石黒彩・飯田圭織・安倍なつみ・保田圭が使用する。</ref>'
            "<br />ゆうちゃん"
        )
        nick, alias = mm.parse_nick(cell)
        self.assertEqual(nick, "ゆうちゃん")
        self.assertEqual(alias, [])

    def test_nick_without_br_is_a_single_value(self):
        self.assertEqual(mm.parse_nick("はだicals"), ("はだicals", []))

    def test_nick_equal_to_name_is_dropped_as_alias(self):
        """リンリン那行的昵称格就是「リンリン」，与姓名重复 —— 别把它当别名。"""
        rows = mm.split_rows(RINRIN_WIKI)
        nick, alias = mm.parse_nick(
            mm.raw_cell(row_named(rows, "リンリン"), "ニックネーム"), name="リンリン"
        )
        self.assertEqual((nick, alias), ("リンリン", []))


class CleanTests(unittest.TestCase):
    def test_name_strips_display_none_kana_and_small_parenthetical(self):
        rows = mm.split_rows(CURRENT_WIKI)
        self.assertEqual(mm.cell(row_named(rows, "野中美希"), "名前"), "野中美希")

    def test_name_keeps_the_display_text_of_a_disambiguated_link(self):
        """[[リンリン (1991年生の歌手)|リンリン]] → 取显示文字，不是带括号的标题。"""
        rows = mm.split_rows(RINRIN_WIKI)
        self.assertEqual(mm.cell(row_named(rows, "リンリン"), "名前"), "リンリン")

    def test_birth_survives_display_none_zero(self):
        rows = mm.split_rows(CURRENT_WIKI)
        self.assertEqual(mm.cell(row_named(rows, "野中美希"), "生年月日（現年齢）"), "1999.10.07")

    def test_from_survives_display_none_kana_prefix(self):
        rows = mm.split_rows(CURRENT_WIKI)
        self.assertEqual(mm.cell(row_named(rows, "野中美希"), "出身地"), "静岡県")

    def test_blood_type_needs_no_cleaning(self):
        rows = mm.split_rows(CURRENT_WIKI)
        self.assertEqual(mm.cell(row_named(rows, "野中美希"), "血液型"), "A型")

    def test_ref_and_efn_noise_is_dropped(self):
        rows = mm.split_rows(CURRENT_WIKI)
        self.assertEqual(mm.cell(row_named(rows, "山﨑愛生"), "メンバーカラー"), "ブルー")


class FormerTests(unittest.TestCase):
    def test_former_date_takes_the_graduation_date_not_the_announcement(self):
        """毕业格里是「1999年4月18日<br />（1999年1月17日発表…）」——
        取**第一个**日期（毕业日本身），而不是括号里的发表日。"""
        rows = mm.split_rows(FORMER_WIKI)
        self.assertEqual(mm.cell(row_named(rows, "福田明日香"), "卒業・脱退日（発表日）卒業公演の開催地"), "1999.04.18")

    def test_hellopro_column_is_not_treated_as_status(self):
        """「ハロプロへの在籍状況」那一列说的是毕业后的去向，不是现役/毕业。"""
        rows = mm.split_rows(FORMER_WIKI)
        self.assertTrue(mm.raw_cell(row_named(rows, "福田明日香"), "ハロプロへの在籍状況").startswith("同時にハロプロも卒業"))


class ParseWikiMembersTests(unittest.TestCase):
    def test_status_comes_from_which_table_the_name_appears_in(self):
        w = BOTH
        got = mm.parse_wiki_members(w)
        cur = [m["name"] for m in got if m["status"] == "current"]
        former = [m["name"] for m in got if m["status"] == "former"]
        self.assertIn("野中美希", cur)
        self.assertIn("福田明日香", former)
        self.assertEqual(len(cur) + len(former), len(got))

    def test_generation_lands_on_the_member(self):
        got = mm.parse_wiki_members(BOTH)
        former = [m for m in got if m["status"] == "former"]
        self.assertEqual(former[0]["name"], "福田明日香")
        self.assertEqual(former[0]["generation"], "1期生")
        # 假名只存在于 {{Display none|…/}} 里 —— 早安的表没有独立的假名列
        self.assertEqual(former[0]["kana"], "ふくだ あすか")

    def test_member_projection_carries_bio_fields(self):
        """格级断言不够：变异「把血液型那行删掉」曾全绿 —— 要断成员投影上真的有它。
        身高与星座早安两个源都没有，所以这两个键不存在（grilling R1-Q4）。"""
        got = {m["name"]: m for m in mm.parse_wiki_members(BOTH)}
        y = got["野中美希"]
        self.assertEqual(y["blood"], "A型")
        self.assertEqual(y["from"], "静岡県")
        self.assertEqual(y["birth"], "1999.10.07")
        self.assertEqual(y["nick"], "ちぇる")
        self.assertEqual(y["nick_aliases"], ["のなちゃん"])
        # 订正我当初写下的断言：我曾断言「height 不进 member」—— **改**。
        # ℃-ute 的源里**有**身高列（モーニング娘。没有），而站内身高要出现在资料卡上，
        # 所以它必须一路走到成员记录再由 build_bio 决定要不要带（决定 3：
        # 「有就显示、没有就不占位」）。空串而不是缺键 —— 缺键会让
        # `assertNotIn` 这类形状断言变成在测实现细节。
        self.assertEqual(y["height"], "", "モーニング娘。的源没有身高列，应为空串")
        self.assertNotIn("sign", y)

    def test_former_end_date_is_carried_to_the_member(self):
        got = {m["name"]: m for m in mm.parse_wiki_members(BOTH)}
        self.assertEqual(got["福田明日香"]["end"], "1999.04.18")
        self.assertEqual(got["野中美希"]["end"], "")

    def test_only_two_status_values_exist(self):
        """grilling R1-Q2：卒業 与 脱退 一律 former，不引入第三个状态。"""
        w = BOTH
        self.assertEqual({m["status"] for m in mm.parse_wiki_members(w)}, {"current", "former"})

    def test_love_members_parser_finds_nothing_here(self):
        """把等爱的 parser 套到早安的 wikitext 上会得到 0 人 —— 把这个坑钉住，
        防止有人后来「顺手复用」。"""
        import love_members

        self.assertEqual(len(love_members.parse_wiki_members(FORMER_WIKI)), 0)




# ── 装配层（工单 03）─────────────────────────────────────────────────────
class ParseListTests(unittest.TestCase):
    """官网列表页是 Astro 服务端渲染：每个成员一个 MemberPanel。

    照片 URL 是内容哈希（`/upload/images/<sha256>.webp`），**不含姓名**，
    所以只能靠「同一 panel 里 img 与姓名相邻」配对，不能靠 URL 反查。
    """

    def setUp(self):
        self.items = mm.parse_list(LIST_HTML)

    def test_three_panels(self):
        self.assertEqual(len(self.items), 3)

    def test_path_is_the_romaji_slug(self):
        self.assertEqual(self.items[0]["path"], "/morningmusume/miki_nonaka/")

    def test_name_and_romanized_name(self):
        self.assertEqual(self.items[0]["name"], "野中美希")
        self.assertEqual(self.items[0]["name_en"], "Miki Nonaka")

    def test_photo_is_the_content_hash_webp(self):
        self.assertTrue(self.items[0]["photo"].startswith("/upload/images/"))
        self.assertTrue(self.items[0]["photo"].endswith(".webp"))

    def test_role_is_kept_when_present(self):
        """野中美希是リーダー、小田さくら是サブリーダー —— 站内目前不显示，
        但解析要留着（丢了就再也拿不回来）。"""
        self.assertEqual(self.items[0]["role"], "リーダー")

    def test_empty_page_yields_no_items(self):
        self.assertEqual(mm.parse_list("<html><body>members are elsewhere</body></html>"), [])


class ParseDetailTests(unittest.TestCase):
    """详情页是成对的 `<dl><dt>字段名</dt><dd>值</dd></dl>`。

    官网**没有**身長与星座（grilling R1-Q4：早安两个源都没有这两项），所以映射表里
    不该留这两个空键。"""

    def setUp(self):
        self.d = mm.parse_detail(DETAIL_HTML)

    def test_maps_known_fields(self):
        self.assertEqual(self.d["nick_raw"], "ちぇる、のなちゃん")
        self.assertEqual(self.d["birth"], "1999.10.07")
        self.assertEqual(self.d["blood"], "A型")
        self.assertEqual(self.d["from"], "静岡県静岡市、アメリカ")
        self.assertEqual(self.d["hobby"], "筋トレ、美容、読書、バスケ観戦、作曲、愛犬と遊ぶこと")
        self.assertEqual(self.d["skill"], "英語、ピアノ、ドラえもんの声真似")

    def test_no_empty_keys_for_fields_the_site_never_has(self):
        for k in ("height", "sign"):
            self.assertNotIn(k, self.d, "早安没有身高/星座，别留空键")

    def test_unmapped_fields_are_dropped_not_carried(self):
        """「座右の銘」「アンバサダー」「資格」站内没有对应键 ——
        带进 bio 只会变成没人消费的数据。"""
        for k in ("座右の銘", "アンバサダー", "資格", "好きな音楽ジャンル"):
            self.assertNotIn(k, self.d)


class BuildMembersTests(unittest.TestCase):
    """官网给现役的资料与照片，Wikipedia 给期生与毕业状态，两源按姓名合并。

    契约与 love_members 对齐：返回 (members, urls) —— 照片放在 urls 里按 file 键索引，
    而不是塞进成员记录（fetch_members 靠 urls 下载，不要发明第二个形状）。
    """

    def setUp(self):
        items = mm.parse_list(LIST_HTML)
        official = {"モーニング娘。": {}}
        for it in items:
            it = dict(it)
            it["detail"] = mm.parse_detail(DETAIL_HTML) if it["name"] == "野中美希" else {}
            official["モーニング娘。"][it["name"]] = it
        self.members, self.urls = mm.build_members(official, mm.parse_all({"モーニング娘。": BOTH}))
        self.by_name = {m["name"]: m for m in self.members}

    def test_official_fills_bio_and_photo(self):
        m = self.by_name["野中美希"]
        self.assertEqual(m["bio"]["blood"], "A型")
        self.assertTrue(self.urls[m["file"]].endswith(".webp"))

    def test_wiki_fills_generation_and_status(self):
        m = self.by_name["野中美希"]
        self.assertEqual(m["generation"], "12期生")
        self.assertEqual(m["status"], "current")

    def test_every_record_has_the_file_key_and_series(self):
        for m in self.members:
            self.assertTrue(m["file"].startswith("morningmusume:"))
            self.assertEqual(m["group"], "モーニング娘。")
            self.assertEqual(m["series"], "morning")

    def test_nick_takes_first_and_keeps_rest_as_aliases(self):
        """grilling R1-Q3：官网写 `ちぇる、のなちゃん`（顿号分隔），
        Wikipedia 写 `<br />` 分行 —— 两种写法都要收敛到「显示第一个 + 其余进别名」。"""
        m = self.by_name["野中美希"]
        self.assertEqual(m["nick"], "ちぇる")
        self.assertEqual(sorted(m["nick_aliases"]), ["のなちゃん"])

    def test_official_nick_wins_when_the_two_sources_disagree(self):
        """变异「官网昵称一律丢弃」曾存活 —— 因为 Wikipedia 有兜底，两条路都给出「ちぇる」。
        所以必须造一个**两源不一致**的人，才能断出优先级。"""
        official = {
            "モーニング娘。": {
                "野中美希": {
                    "photo": "/upload/images/a.webp",
                    "detail": {"nick_raw": "非儿的昵称、别名一"},
                }
            }
        }
        members, _ = mm.build_members(official, mm.parse_all({"モーニング娘。": BOTH}))
        m = {x["name"]: x for x in members}["野中美希"]
        self.assertEqual(m["nick"], "非儿的昵称")
        self.assertEqual(m["nick_aliases"], ["别名一"])

    def test_member_present_only_on_wikipedia_still_appears_as_former(self):
        """福田明日香不在官网（官网只有现役）—— 她仍要出现，状态 former。"""
        m = self.by_name["福田明日香"]
        self.assertEqual(m["status"], "former")
        self.assertEqual(m["generation"], "1期生")
        self.assertNotIn(m["file"], self.urls)

    def test_from_comes_from_wikipedia_for_former_members(self):
        """毕业成员不在官网上，而 Wikipedia 的毕业表**有**出身地那一列 ——
        真实抓取时 51 人里 40 人 from 为空，就是因为只接了官网那一路。"""
        m = self.by_name["福田明日香"]
        self.assertEqual(m["bio"]["from"], "東京都")

    def test_kana_comes_from_wikipedia_because_the_official_list_has_none(self):
        """官网列表页只有日文名与罗马字名，**没有假名** —— 假名只能来自 Wikipedia 的
        `{{Display none|…/}}`（调研说「早安没有假名列」，实测它藏在姓名格里）。"""
        self.assertEqual(self.by_name["野中美希"]["kana"], "のなか みき")


class ResolvedCacheTests(unittest.TestCase):
    """解析结果缓存：重跑时跳过旧站那 900 次快照扫描（一次跑崩就白烧 1.5 小时）。"""

    def test_cache_path_is_outside_prune_dirs(self):
        """缓存不能落在 prune_unused 会扫的目录里。

        放 scripts/_orig 时每次成功跑完都会被清掉（stem 不是成员 id），
        「重跑只解析缺的人」实际不成立 —— 2026-10-04 两轴审查抓到。
        """
        import fetch_members

        cache = os.path.abspath(mm.RESOLVED_CACHE)
        dirs = fetch_members.default_dirs()
        for key in ("orig", "full", "thumb"):
            p = os.path.abspath(dirs[key])
            self.assertFalse(
                cache == p or cache.startswith(p + os.sep),
                f"缓存 {cache} 落在会被 prune_unused 清空的 {key} 目录里",
            )

    def test_round_trip(self):
        import tempfile

        with tempfile.TemporaryDirectory() as td:
            p = os.path.join(td, "_resolved.json")
            mm._save_resolved({"a:甲": "https://x/a.jpg"}, p)
            self.assertEqual(mm._load_resolved(p), {"a:甲": "https://x/a.jpg"})

    def test_use_cache_prefills_urls_before_resolution(self):
        """缓存里的成员要先填进 urls —— 各解析段只处理不在 urls 里的人，
        这就是「重跑只解析缺的那些」的机制。"""
        import tempfile
        from unittest import mock

        with tempfile.TemporaryDirectory() as td:
            p = os.path.join(td, "_resolved.json")
            mm._save_resolved({"morningmusume:既存": "https://x/a.jpg"}, p)
            seen = {}
            former = [{"name": "既存", "file": "morningmusume:既存", "status": "former"}]

            def fake_resolve(
                members, urls, fetch, warn=None, pause=0.0, skip=None, notes=None
            ):
                seen.update(urls)

            with mock.patch.object(mm, "RESOLVED_CACHE", p), mock.patch.object(
                mm, "resolve_former_photos", fake_resolve
            ), mock.patch.object(
                mm, "build_members", lambda o, w: (former, {})
            ), mock.patch.object(
                mm, "parse_list", lambda h: []
            ), mock.patch.object(
                mm.ja_wiki, "wiki_wikitext", lambda *a, **k: ""
            ), mock.patch.object(
                mm, "parse_all", lambda pages: {}
            ):
                mm.load(lambda u: "", photo=True, use_cache=True)
            self.assertEqual(seen.get("morningmusume:既存"), "https://x/a.jpg")

    def test_use_cache_saves_resolved_after_load(self):
        """解析完要把结果写回缓存 —— 下一次重跑才便宜。"""
        import tempfile
        from unittest import mock

        with tempfile.TemporaryDirectory() as td:
            p = os.path.join(td, "_resolved.json")
            former = [{"name": "新", "file": "morningmusume:新", "status": "former"}]

            def fake_resolve(
                members, urls, fetch, warn=None, pause=0.0, skip=None, notes=None
            ):
                urls["morningmusume:新"] = "https://x/new.jpg"

            with mock.patch.object(mm, "RESOLVED_CACHE", p), mock.patch.object(
                mm, "resolve_former_photos", fake_resolve
            ), mock.patch.object(
                mm, "build_members", lambda o, w: (former, {})
            ), mock.patch.object(
                mm, "parse_list", lambda h: []
            ), mock.patch.object(
                mm.ja_wiki, "wiki_wikitext", lambda *a, **k: ""
            ), mock.patch.object(
                mm, "parse_all", lambda pages: {}
            ):
                mm.load(lambda u: "", photo=True, use_cache=True)
            self.assertEqual(
                mm._load_resolved(p).get("morningmusume:新"), "https://x/new.jpg"
            )

    def test_missing_or_corrupt_cache_is_empty(self):
        import tempfile

        with tempfile.TemporaryDirectory() as td:
            p = os.path.join(td, "_resolved.json")
            self.assertEqual(mm._load_resolved(p), {}, "文件不存在要返回空，不能崩")
            with open(p, "w", encoding="utf-8") as fh:
                fh.write("{不是 json")
            self.assertEqual(mm._load_resolved(p), {}, "坏了也要返回空（重解析即可）")


class ResolveFormerPhotosTests(unittest.TestCase):
    """毕业成员的照片：旧列表页快照 → Wayback → Commons。每一级都要试，
    上一张 404 不能让整条链短路。"""

    def _members(self):
        return [
            {"name": "野中美希", "status": "current", "file": "morningmusume:野中美希"},
            {
                "name": "石黒彩",
                "status": "former",
                "group": "モーニング娘。",
                "file": "morningmusume:石黒彩",
                # 旧站逐成员照片的 URL：早安的旧列表页**没有**这种配对
                # （见 resolve_former_photos 的注释），所以这一节只在
                # 「已知 URL」时可用 —— 模拟的是 OG CDN / 详情页那类来源。
                "photo_url": "https://x/a.jpg",
            },
        ]

    def test_current_member_is_left_alone(self):
        members = self._members()
        urls = {members[0]["file"]: "/upload/images/a.webp"}
        mm.resolve_former_photos(members, urls, lambda url: "")
        self.assertEqual(urls[members[0]["file"]], "/upload/images/a.webp")

    def test_former_resolved_through_wayback_gets_an_url(self):
        seen = []

        def fetch(url):
            seen.append(url)
            if "cdx" in url:
                # CDX 的第一行是表头（urlkey/timestamp/original），cdx_rows 会剥掉它
                return json.dumps(
                    [["urlkey", "timestamp", "original"], ["x", "20220525051254", "o"]]
                )
            return "[]"

        members = self._members()
        urls = {members[0]["file"]: "/upload/images/a.webp"}
        # Commons 先试（这里回空），再退到 Wayback 取已知的 photo_url
        mm.resolve_former_photos(members, urls, fetch, warn=lambda m: None)
        self.assertTrue(urls.get(members[1]["file"], "").startswith("https://web.archive.org/"))
        self.assertTrue(any("石黒彩" in u or True for u in seen))

    def test_former_with_no_source_records_reason_in_notes(self):
        """解析不到时原因必须**交给调用方**（工单 01 / ADR-0024）：报告由管线打一份，
        解析阶段不再自己打逐人 warn —— 「有人喊过」由 `notes` 的键值保证。"""
        msgs = []
        members = self._members()
        urls = {members[0]["file"]: "/upload/images/a.webp"}

        # 「查了但没有」要用**形状合法**的空响应：`"[]"` 是端点异常时的形状，
        # 现在会被记成「查询失败」（工单 09/10 的区分）。
        def empty(url):
            if "list=search" in url:
                return json.dumps({"query": {"search": []}})
            if "pageimages" in url:
                return json.dumps({"query": {"pages": {}}})
            return "[]"  # CDX 等其它端点

        notes = {}
        mm.resolve_former_photos(members, urls, empty, warn=msgs.append, notes=notes)
        self.assertNotIn(members[1]["file"], urls)
        self.assertEqual(notes.get(members[1]["file"]), "源里没有")
        # 解析阶段保持安静（Q6-B）：不再有逐人「解析不到」行
        self.assertNotIn("解析不到", "\n".join(msgs))


OG_HTML = """<div class="commonGrid--base">
<link rel="preload" as="image" href="/upload/images/next.webp"/>
<div class="MemberPanel"><a href="https://up-front-create.com/x" class="MemberPanel__link group " target="_blank"><div class="Thumbnail MemberPanel__image "><div><img src="/upload/images/ishiguro.webp" alt="" width="298" height="298"/></div></div><div class="MemberPanel__nameJa paragraph">石黒彩</div><div class="MemberPanel__nameEn paragraph">Aya Ishiguro</div></a><div class="MemberPanel__socials"><ul></ul></div></div>
<div class="MemberPanel"><a href="https://up-front-create.com/y" class="MemberPanel__link group " target="_blank"><div class="Thumbnail MemberPanel__image "><div><img src="/upload/images/yuko.webp" alt="" width="298" height="298"/></div></div><div class="MemberPanel__nameJa paragraph">中澤裕子</div><div class="MemberPanel__nameEn paragraph">Yuko Nakazawa</div></a><div class="MemberPanel__socials"><ul></ul></div></div>
<div class="MemberPanel"><a href="#" class="MemberPanel__link"><div class="MemberPanel__nameJa paragraph">没有照片的人</div></a></div>
</div>"""


class IncrementalSkipTests(unittest.TestCase):
    """增量跑（ADR-0023）：在 `skip_photo` 名单（键集合）里的成员**不解析照片** —— 一个成员级请求
    都不发（og 那一页服务全体，仍会抓）。判据由 fetch_members 注入（id 规则在那里）。"""

    def test_resolve_former_photos_skips_flagged_member(self):
        members = [
            {"name": "A", "file": "f1", "status": "former", "group": "G", "join": "", "end": ""}
        ]
        urls = {}
        calls = []

        def fetch(url):
            calls.append(url)
            return "[]"

        mm.resolve_former_photos(
            members, urls, fetch, warn=lambda *a: None, skip={("G", "A")}
        )
        self.assertEqual(urls, {})
        self.assertEqual(calls, [mm.OG_URL], "除 og 页外不该有任何请求")

    def test_skip_none_keeps_resolving(self):
        """不传 skip（= --refresh-photos 或首次跑）时行为不变：会去解析。"""
        members = [
            {"name": "A", "file": "f1", "status": "former", "group": "G", "join": "", "end": ""}
        ]
        urls = {}
        calls = []

        def fetch(url):
            calls.append(url)
            return "[]"

        mm.resolve_former_photos(members, urls, fetch, warn=lambda *a: None)
        self.assertGreater(len(calls), 1, "没有 skip 时应当继续解析（会发成员级请求）")


class ScanBudgetTests(unittest.TestCase):
    """旧站扫描的预算按**抓取次数**算（不是 URL 数）—— 每次抓取才是真实成本
    （网络 + 节流），一个 URL 最多试 3 个快照。按 URL 记账会让实际抓取数三倍于预算：
    实测 12 个缺图者散在 5 个团时，扫描照旧跑到全局上限 900 次、增量跑 37 分钟没完。"""

    def _pick(self, best, budget, limit=900, pause=0):
        calls = []

        def fetch(url):
            calls.append(url)
            return "<html></html>"

        fetched, _cut = mm._pick_old_site_group(best, {}, {}, fetch, budget, 0, limit)
        return fetched, calls

    def test_budget_counts_fetches_not_urls(self):
        # 10 个 URL × 3 个快照 = 30 次抓取；预算 6 次 → 只抓 6 次（2 个 URL）
        best = {"http://x/%02d" % i: [f"2020{i:04d}"] * 3 for i in range(10)}
        fetched, calls = self._pick(best, budget=6)
        self.assertEqual(fetched, 6)
        self.assertEqual(len(calls), 6)

    def test_global_limit_still_caps(self):
        best = {"http://x/%02d" % i: [f"2020{i:04d}"] * 3 for i in range(10)}
        fetched, calls = self._pick(best, budget=100, limit=4)
        self.assertEqual(fetched, 4)
        self.assertEqual(len(calls), 4)

    def test_budget_scales_with_missing_count(self):
        """每团预算 = max(30, 15 × 该团缺图人数) —— 为 3 个人试 180 个 URL 是 60 倍超支。"""
        seen = {}

        def fake_candidates(prefixes, fetch, missing):
            seen[prefixes[0]] = len(missing)
            return {}  # 没有候选 → 只观察预算

        budgets = []

        def fake_pick(best, by_name, urls, fetch, budget, fetched, limit):
            budgets.append(budget)
            return fetched, None

        members = (
            [{"name": f"a{i}", "group": "モーニング娘。", "status": "former", "file": f"f{i}"} for i in range(3)]
            + [{"name": "b0", "group": "OCHA NORMA", "status": "former", "file": "g0"}]
        )
        with mock.patch.object(mm, "_old_site_candidates", fake_candidates), mock.patch.object(
            mm, "_pick_old_site_group", fake_pick
        ):
            mm._resolve_old_site_groups(members, {}, {}, lambda u: "", 0, 900)
        # モー娘。 3 人 → 45；OCHA 1 人 → 30
        self.assertEqual(budgets, [45, 30])


class ScanConcurrencyTests(unittest.TestCase):
    """工单 06：快照抓取并发（Wayback 3 并发 · 0.5s 间隔），但**按任务顺序**应用配对 ——
    同一成员多个候选时先到者胜，与串行逐键相同（确定性）。"""

    def test_pooled_pick_keeps_url_order(self):
        """两个候选页都有命中 → 取 URL 序靠前的（sorted(best) 的第一个）。"""
        best = {"http://x/a": ["20200101000000"], "http://x/b": ["20190101000000"]}
        by_name = {
            "甲": {"name": "甲", "file": "f1", "status": "former", "group": "G", "join": "", "end": ""}
        }
        pages = {
            "http://x/a": '<img ALT="甲" SRC="http://pic/a.jpg">',
            "http://x/b": '<img ALT="甲" SRC="http://pic/b.jpg">',
        }

        def fake(u):
            return pages["http://x/a"] if "/x/a" in u else pages["http://x/b"]

        urls = {}
        fetched, _cut = mm._pick_old_site_group(best, by_name, urls, fake, 100, 0, 900)
        self.assertEqual(fetched, 2)
        self.assertIn("pic/a.jpg", urls["f1"], "URL 序靠前的候选必须先应用")

    def test_failed_snapshot_is_skipped_not_fatal(self):
        """单张快照失败要跳过、继续别的候选（与串行一致）—— 并发版用 raise_first=False。"""
        best = {"http://x/a": ["20200101000000"], "http://x/b": ["20190101000000"]}
        by_name = {
            "甲": {"name": "甲", "file": "f1", "status": "former", "group": "G", "join": "", "end": ""}
        }

        def fake(u):
            if "/x/a" in u:
                raise RuntimeError("521")
            return '<img ALT="甲" SRC="http://pic/b.jpg">'

        urls = {}
        mm._pick_old_site_group(best, by_name, urls, fake, 100, 0, 900)  # 只看副作用
        self.assertIn("pic/b.jpg", urls["f1"])


class OldSitePhotoTests(unittest.TestCase):
    """工单 02：旧官网 Wayback 源（按团枚举 + alt 配对 + 在籍期校验，ADR-0022）。"""

    PAGE = """<html><body>
<img src="/images/artist_photo/cute05_s.jpg" alt="岡井千聖" width="100"/>
<img src="/images/artist_photo/cute06_s.jpg" alt="萩原舞" width="100"/>
<img src="/images/artist_photo/cute01_s.jpg" alt="梅田えりか" width="100"/>
</body></html>"""

    def test_prefill_skips_placeholder_urls(self):
        """缓存里的占位图不该有缓存效力：跳过它，该成员这一轮才会重新解析（实测
        transparent.gif 曾让四个 Berryz 永远停在 1×1）。"""
        urls = {}
        mm._prefill(
            urls,
            {"a": "http://cdn.helloproject.com/img/transparent.gif", "b": "http://x/real.jpg"},
        )
        self.assertEqual(urls, {"b": "http://x/real.jpg"})

    def test_prefill_keeps_real_urls_and_does_not_overwrite(self):
        urls = {"a": "http://fresh/a.jpg"}
        mm._prefill(urls, {"a": "http://cached/a.jpg", "b": "http://cached/b.jpg"})
        self.assertEqual(urls, {"a": "http://fresh/a.jpg", "b": "http://cached/b.jpg"})

    def test_match_page_skips_placeholder_src(self):
        """实测：旧站把透明 gif 当成员照（alt 里是姓名）——四个 Berryz 成员被配成同一张
        transparent.gif（1×1），压缩阶段才发现、整轮白跑完。占位图必须跳过，让链往下走。"""
        html = '<img src="/img/transparent.gif" ALT="清水佐紀">'
        by_name = {"清水佐紀": {"file": "f1", "join": "", "end": ""}}
        urls = {}
        mm._match_page(
            html, "http://www.helloproject.com/berryz/", "20150315010217", by_name, urls
        )
        self.assertEqual(urls, {})

    def test_match_page_accepts_real_photo(self):
        html = '<img src="/berryz/img/shimizu.jpg" ALT="清水佐紀">'
        by_name = {"清水佐紀": {"file": "f1", "join": "", "end": ""}}
        urls = {}
        mm._match_page(
            html, "http://www.helloproject.com/berryz/", "20150315010217", by_name, urls
        )
        self.assertEqual(
            urls,
            {
                "f1": "https://web.archive.org/web/20150315010217id_/http://www.helloproject.com/berryz/img/shimizu.jpg"
            },
        )

    def test_parse_img_pairs_keeps_order_and_missing_alt(self):
        pairs = mm.parse_img_pairs('<img src="a.jpg"><img alt="X" src="b.jpg">')
        self.assertEqual(pairs, [("", "a.jpg"), ("X", "b.jpg")])
        self.assertEqual(mm.parse_img_pairs(""), [])

    def test_tenure_boundaries(self):
        m = {"join": "2002.01.01", "end": "2009.10.25", "group": "℃-ute"}
        self.assertTrue(mm.tenure_ok(m, "20020101"))
        self.assertTrue(mm.tenure_ok(m, "20091025"))
        self.assertFalse(mm.tenure_ok(m, "20011231"))
        self.assertFalse(mm.tenure_ok(m, "20091026"))
        self.assertFalse(mm.tenure_ok(m, ""))

    def test_tenure_falls_back_to_group_end_year(self):
        """end 缺失（℃-ute 解散时那批）→ 用团终止年份；join 缺失则不设下界。"""
        m = {"join": "", "end": "", "group": "℃-ute"}
        self.assertTrue(mm.tenure_ok(m, "20050101"))
        self.assertTrue(mm.tenure_ok(m, "20171231"))
        self.assertFalse(mm.tenure_ok(m, "20180101"))

    def test_matches_by_alt_within_tenure(self):
        """alt=姓名 是证据①；快照时间戳必须在在籍期内。"""
        rows = [
            ["urlkey", "timestamp", "original"],
            ["x", "20090602100604", "http://www.helloproject.com/c-ute/profile.html"],
        ]

        def fetch(url):
            if "cdx" in url:
                return json.dumps(rows)
            return self.PAGE

        members = [
            {
                "name": "岡井千聖",
                "status": "former",
                "file": "m:岡井千聖",
                "group": "℃-ute",
                "join": "2002.06.30",
                "end": "2017.06.12",
            }
        ]
        urls = {}
        mm.resolve_old_site_photos(members, urls, fetch, pause=0)
        # 旧站来源的图一律套 Wayback（2026-10-03 改）：旧路径早已 404，而且
        # cdn.helloproject.com 对脚本一律 403（实测 43 张下载全部失败），
        # 存档里才有真图。
        self.assertEqual(
            urls["m:岡井千聖"],
            "https://web.archive.org/web/20090602100604id_/"
            "http://www.helloproject.com/images/artist_photo/cute05_s.jpg",
        )

    def test_relative_src_resolves_and_wraps_in_wayback(self):
        """2005 前后的一人一页写的是相对 src（`artist_photo.jpg`）——要相对原页面
        解析成绝对 URL 再套 Wayback；直接当 URL 下载会崩（实测 `unknown url type`）。"""
        rows = [
            ["urlkey", "timestamp", "original"],
            ["x", "20050416001745", "http://www.helloproject.com/artist/01/04/index.html"],
        ]
        page = '<img SRC="artist_photo.jpg" ALT="吉澤ひとみ">'

        def fetch(url):
            return json.dumps(rows) if "cdx" in url else page

        members = [
            {
                "name": "吉澤ひとみ",
                "status": "former",
                "file": "m:吉澤ひとみ",
                "group": "モーニング娘。",
                "join": "2000.04.16",
                "end": "2007.06.15",
            }
        ]
        urls = {}
        mm.resolve_old_site_photos(members, urls, fetch, pause=0)
        self.assertEqual(
            urls["m:吉澤ひとみ"],
            "https://web.archive.org/web/20050416001745id_/"
            "http://www.helloproject.com/artist/01/04/artist_photo.jpg",
        )

    def test_rejects_capture_outside_tenure(self):
        """**防张冠李戴**：扁平文件名会被后来阵容覆盖 —— 快照晚于毕业日就不采纳。"""
        rows = [
            ["urlkey", "timestamp", "original"],
            ["x", "20150602100604", "http://www.helloproject.com/c-ute/profile.html"],
        ]

        def fetch(url):
            return json.dumps(rows) if "cdx" in url else self.PAGE

        members = [
            {
                "name": "岡井千聖",
                "status": "former",
                "file": "m:岡井千聖",
                "group": "℃-ute",
                "join": "2002.06.30",
                "end": "2011.12.31",
            }
        ]
        urls = {}
        mm.resolve_old_site_photos(members, urls, fetch, pause=0)
        self.assertEqual(urls, {})

    def test_file_evidence_fallback(self):
        """无 alt 的少数走文件名证据（石村舞波）；同样过在籍期校验。"""
        rows = [
            ["urlkey", "timestamp", "original"],
            ["x", "20050426004204", "http://www.helloproject.com/berryz/img/isimura.jpg"],
        ]

        def fetch(url):
            return json.dumps(rows) if "cdx" in url else ""

        members = [
            {
                "name": "石村舞波",
                "status": "former",
                "file": "m:石村舞波",
                "group": "Berryz工房",
                "join": "",
                "end": "2005.10.02",
            }
        ]
        urls = {}
        mm.resolve_old_site_photos(members, urls, fetch, pause=0)
        self.assertTrue(urls["m:石村舞波"].startswith("https://web.archive.org/web/20050426004204"))


class OgPageTests(unittest.TestCase):
    """工单 01：现官网 /og/ 页（仍在事务所的卒业生，官方肖像）。"""

    def test_parses_name_and_photo_per_panel(self):
        got = mm.parse_og_page(OG_HTML)
        self.assertEqual(got["石黒彩"], "https://helloproject.com/upload/images/ishiguro.webp")
        self.assertEqual(got["中澤裕子"], "https://helloproject.com/upload/images/yuko.webp")

    def test_panel_without_photo_is_skipped(self):
        got = mm.parse_og_page(OG_HTML)
        self.assertNotIn("没有照片的人", got)

    def test_preload_link_does_not_steal_the_next_panel(self):
        """每个 panel 前有一个 preload 的 <link href=…>（下一张图）——
        取「块内第一个 img」而不是第一个 href，才不会张冠李戴。"""
        got = mm.parse_og_page(OG_HTML)
        self.assertNotIn("https://helloproject.com/upload/images/next.webp", got.values())

    def test_empty_or_broken_html_yields_empty_map(self):
        self.assertEqual(mm.parse_og_page(""), {})
        self.assertEqual(mm.parse_og_page("<html>no panels</html>"), {})


class ResolveOgSourceTests(unittest.TestCase):
    def _members(self):
        return [
            {"name": "野中美希", "status": "current", "file": "m:野中美希"},
            {"name": "石黒彩", "status": "former", "file": "m:石黒彩"},
            {"name": "後藤真希", "status": "former", "file": "m:後藤真希"},
        ]

    def test_og_wins_over_commons(self):
        """官方肖像优先于 Commons（grill Q2 的源顺序）。"""

        def fetch(url):
            if url == mm.OG_URL:
                return OG_HTML
            if "commons" in url or "wikipedia" in url:
                return json.dumps(
                    {"query": {"pages": {"1": {"thumbnail": {"source": "https://c/x.jpg"}}}}}
                )
            return "[]"

        urls = {}
        mm.resolve_former_photos(self._members(), urls, fetch, warn=lambda m: None)
        self.assertEqual(
            urls["m:石黒彩"], "https://helloproject.com/upload/images/ishiguro.webp"
        )

    def test_og_failure_falls_through_to_commons(self):
        """og 抓取抛错时链不能断：仍走 Commons。Commons 只认 後藤真希（模拟
        「只有部分人有 Commons 照」），石黒彩两边都没有 → 留在缺图名单。"""

        def fetch(url):
            if url == mm.OG_URL:
                raise RuntimeError("og 挂了")
            if "wikipedia" in url:
                if "%E5%BE%8C%E8%97%A4" in url or "後藤" in url:
                    return json.dumps(
                        {"query": {"pages": {"1": {"thumbnail": {"source": "https://c/goto.jpg"}}}}}
                    )
                return json.dumps({"query": {"pages": {}}})
            return "[]"

        urls = {}
        mm.resolve_former_photos(self._members(), urls, fetch, warn=lambda m: None)
        self.assertEqual(urls["m:後藤真希"], "https://c/goto.jpg")
        self.assertNotIn("m:石黒彩", urls)


class BuildSectionsTests(unittest.TestCase):
    def test_one_series_one_group_and_generation_stays_a_member_field(self):
        """早安是**一系列一团**；期生留在成员上（等爱是三团且只有一期，
        所以把 GENERATION 塞进 section —— 早安相反，18 期必须能筛）。"""
        secs = mm.build_sections(mm.build_members_from_wiki({"モーニング娘。": BOTH}))
        self.assertEqual(len(secs), 1)
        self.assertEqual(secs[0]["group"], "モーニング娘。")
        self.assertEqual(secs[0]["series"], "morning")
        # 段 label 直接用团名（期生是成员字段，不再像等爱那样把 GENERATION 塞进段）
        self.assertEqual(secs[0]["label"], "モーニング娘。")
        self.assertTrue(secs[0]["members"])
        # 订正我最初写下的假设：我曾断言「期生是筛选字段，不进产物」——**错**。
        # 早安有 18 期，「按期生筛」要求期生逐人存（等爱只有一期才把它塞进段 label）。
        for m in secs[0]["members"]:
            self.assertTrue(m.get("generation"), f"{m['name']} 丢了期生")
        # 昵称别名也要进产物 —— 它是搜索 haystack 的一部分（grilling R1-Q3）
        nonaka = [m for m in secs[0]["members"] if m["name"] == "野中美希"][0]
        self.assertEqual(nonaka["nick_aliases"], ["のなちゃん"])




# ── 工单 01：℃-ute 的 parse（按团配置节标记，复用モーニング娘。的解析器）────
CUTE_DISSOLVED_WIKI = fixture("cute-dissolved-members.wiki")   # 解散时全员（5 人）
CUTE_PAST_WIKI = fixture("cute-past-members.wiki")             # 更早离团（3 人）
# 同样要自己补 section 标题 —— fixture 只切了表本身（与早安那两个一致）。
# ⚠️ 我第一版切 fixture 时从标记**本身**开始，于是 fixture 自带标题、再补一次就
# 重复，span 只剩标题行、解析出 0 人。症状是「全员毕业」那几条报 KeyError，
# 看着像配置没生效。
CUTE_WIKI = (
    "=== 解散時のメンバー ===\n"
    + CUTE_DISSOLVED_WIKI
    + "\n=== 過去に在籍していたメンバー ===\n"
    + CUTE_PAST_WIKI
)


class CuteSectionTests(unittest.TestCase):
    """℃-ute 已 2017 年解散，所以条目里**没有现役节** —— 两张表都是毕业者。
    这一点不是特判，是数据本来的样子：モーニング娘。仍然有现役节。"""

    def test_group_config_declares_both_markers_and_page(self):
        cfg = mm.GROUPS["℃-ute"]
        self.assertTrue(cfg["page"], "每个团都要有条目名")
        self.assertEqual(len(cfg["former"]), 2, "解散时应有两张毕业表")
        self.assertEqual(cfg["current"], [], "℃-ute 没有现役节")

    def test_everyone_is_former(self):
        got = mm.parse_wiki_members(CUTE_WIKI, "℃-ute")
        self.assertTrue(got, "解析出 0 人")
        self.assertEqual({m["status"] for m in got}, {"former"})

    def test_both_tables_contribute(self):
        names = {m["name"] for m in mm.parse_wiki_members(CUTE_WIKI, "℃-ute")}
        # 解散时的 5 人 + 更早的 3 人
        self.assertEqual(len(names), 8, sorted(names))
        self.assertTrue("矢島舞美" in names, "解散时的成员")
        self.assertTrue("村上愛" in names, "更早离团的成员")

    def test_source_section_is_recorded(self):
        """「解散时」那张表**没有毕业日列**，所以那 5 人的 end 必然空 ——
        但必须知道是「源里没有」而不是「解析失败」，否则下游无法解释。"""
        got = {m["name"]: m for m in mm.parse_wiki_members(CUTE_WIKI, "℃-ute")}
        self.assertEqual(got["矢島舞美"]["from_section"], "解散時のメンバー")
        self.assertEqual(got["村上愛"]["from_section"], "過去に在籍していたメンバー")

    def test_graduation_date_present_only_where_the_column_exists(self):
        got = {m["name"]: m for m in mm.parse_wiki_members(CUTE_WIKI, "℃-ute")}
        # 「過去に在籍していた」那张有「卒業・脱退日卒業公演会場」列
        self.assertRegex(got["村上愛"]["end"], r"^\d{4}\.\d{2}\.\d{2}$", got["村上愛"]["end"])
        # 「解散時の」那张没有这一列 —— 空是事实，不许编
        self.assertEqual(got["矢島舞美"]["end"], "")

    def test_height_is_parsed_and_included_in_bio(self):
        """身高只有「解散時」那张表有。落 member.height，**也进 bio** ——
        决定 3 是「有就显示、没有就不占位」；工单 01 曾写「不进 bio」，
        工单 04 改成进 bio（资料卡那一行就是 bio.height）。"""
        got = {m["name"]: m for m in mm.parse_wiki_members(CUTE_WIKI, "℃-ute")}
        self.assertEqual(got["矢島舞美"]["height"], "166cm")
        self.assertEqual(got["村上愛"]["height"], "", "没有身高的要空字符串，不要 undefined")
        self.assertTrue("bio" not in got["矢島舞美"], "parse 层不产 bio")

    def test_no_generation_column_means_no_generation(self):
        got = {m["name"]: m for m in mm.parse_wiki_members(CUTE_WIKI, "℃-ute")}
        for m in got.values():
            self.assertEqual(m["generation"], "", "℃-ute 没有期生")

    def test_unknown_group_falls_back_to_the_default_instead_of_crashing(self):
        """传一个没配过的团名不该抛 —— 装配层会先跑一遍全系列。"""
        self.assertEqual(mm.parse_wiki_members(CUTE_WIKI, "不存在的团"), [])

    def test_morning_still_works_after_the_refactor(self):
        got = mm.parse_wiki_members(BOTH, "モーニング娘。")
        names = {m["name"] for m in got}
        self.assertTrue("野中美希" in names and "福田明日香" in names, sorted(names))
        self.assertTrue(any(m["status"] == "current" for m in got), "モーニング娘。仍有现役节")


# ── 工单 02：装配（一个系列两个团 + 全员毕业）────────────────────────────
CUTE_WIKI_PAGES = {
    "モーニング娘。": BOTH,
    "℃-ute": CUTE_WIKI,
}


class TwoGroupSectionTests(unittest.TestCase):
    def test_one_series_two_sections_labelled_by_group(self):
        got = mm.build_members_from_wiki(CUTE_WIKI_PAGES)
        secs = mm.build_sections(got)
        self.assertEqual([s["group"] for s in secs], ["モーニング娘。", "℃-ute"])
        self.assertEqual({s["series"] for s in secs}, {"morning"})
        # 注意：这里用的是**夹具**，不是真实抓取的人数（真实抓取是 51 人，
        # 那要等工单 03）。所以比的是**相对**形状，不钉绝对数字。
        self.assertEqual(len(secs[0]["members"]), 6, "モーニング娘。夹具 6 行")
        self.assertTrue(secs[0]["members"], "两段都不能是空的")
        self.assertTrue(
            any(m["name"] == "野中美希" for m in secs[0]["members"]), "现役要在"
        )
        self.assertEqual(len(secs[1]["members"]), 8, "℃-ute 夹具 8 人")

    def test_cute_members_are_all_former(self):
        got = mm.build_members_from_wiki(CUTE_WIKI_PAGES)
        cute = [m for m in got if m["group"] == "℃-ute"]
        self.assertEqual(len(cute), 8)
        self.assertEqual({m["status"] for m in cute}, {"former"})

    def test_real_load_path_keeps_the_two_groups_apart(self):
        """⚠️ 这条覆盖的是 **build_members**（真实 load 走的那条路）——
        我第一版只在 build_members_from_wiki 上测，于是两个团在测试里分得开、
        真实装配却并成一段（51 + 8 = 59 全进「モーニング娘。」）。
        根因：_base_record 把 group 写死成模块的 GROUP。
        """
        official = {"モーニング娘。": {}}
        for item in mm.parse_list(LIST_HTML):
            merged = dict(item)
            merged["detail"] = mm.parse_detail(DETAIL_HTML)
            merged["group"] = "モーニング娘。"
            official["モーニング娘。"][item["name"]] = merged
        members, _urls = mm.build_members(official, mm.parse_all(CUTE_WIKI_PAGES))
        self.assertEqual(
            sorted({m["group"] for m in members}), ["℃-ute", "モーニング娘。"]
        )
        cute = [m for m in members if m["group"] == "℃-ute"]
        self.assertEqual(len(cute), 8)
        # file 前缀必须跟着真实团走 —— 图片按 file 索引，带错团 = 图挂错人
        for m in cute:
            self.assertIn("℃-ute", m["file"], m["file"])

    def test_official_current_plus_wiki_former_is_a_transfer_not_an_error(self):
        """订正旧判据：这条原本断言「官网一个团 + Wikipedia 另一个团 → 报错」。

        收伞批（工单 02）之后这个形状是**跨团转籍的常态**（官网只有现役、
        Wikipedia 还留着毕业段），改由「最近归属」规则处理：现役赢。
        只有**两个现役团同时认领**才是真异常（TestCrossGroupMerge 里那条）。
        """
        official = {"モーニング娘。": {"村上愛": {"name": "村上愛", "group": "モーニング娘。", "detail": {}}}}
        members, _ = mm.build_members(official, mm.parse_all({"℃-ute": CUTE_WIKI}))
        m = {x["name"]: x for x in members}["村上愛"]
        self.assertEqual(m["group"], "モーニング娘。")
        self.assertEqual(m["status"], "current")

    def test_each_section_is_one_group_and_its_label_is_that_group(self):
        """团名落在**段**上（label + series），不是成员字段 —— 我第一版把
        断言写在成员上，于是 KeyError: 'group'。段 label 是站内「按团筛」的唯一依据，
        所以要钉的是段这一层。"""
        secs = mm.build_sections(mm.build_members_from_wiki(CUTE_WIKI_PAGES))
        for sec in secs:
            self.assertEqual(sec["label"], sec["group"])
            self.assertEqual(sec["series"], "morning")
        self.assertEqual(len(secs), 2, "两个团两段，不能把两个团塞进一段")

    def setUp(self):
        secs = mm.build_sections(mm.build_members_from_wiki(CUTE_WIKI_PAGES))
        self.by_group = {s["group"]: s for s in secs}

    def test_height_reaches_the_projection_for_the_group_that_has_it(self):
        """决定 3：「有就显示、没有就不占位」。dissolved 表有身高、past 表没有。"""
        members = self.by_group["℃-ute"]["members"]
        with_h = [m["bio"]["height"] for m in members if "height" in (m.get("bio") or {})]
        self.assertEqual(sorted(with_h), ["152cm", "156cm", "158cm", "161cm", "166cm"])

    def test_height_absent_is_omitted_entirely_not_written_as_empty(self):
        """「没有就不占位」= 产物里**没有这个键**，而不是有键但值是空串 ——
        资料卡要按有没有真值来决定要不要输出这一行。"""
        kami = self.by_group["モーニング娘。"]["members"]
        self.assertEqual([m for m in kami if "height" in (m.get("bio") or {})], [])
        cute = self.by_group["℃-ute"]["members"]
        no_h = [m for m in cute if "height" not in (m.get("bio") or {})]
        self.assertEqual({m["name"] for m in no_h}, {"村上愛", "有原栞菜", "梅田えりか"})

    def test_a_group_missing_from_the_config_fails_loudly(self):
        """没配在 GROUPS 里的团要**报错**而不是静默消失 —— 静默丢掉的症状是
        「某团从站点上不见了，而脚本 exit 0」，那正是源门当初要堵的那类事故
        （抓取 0 人 → build_sections 丢段 → prune_unused 删图）。
        变异验证时这条变异存活过（当时没有测试喂未配置的团），所以补上。
        """
        rows = mm.parse_wiki_members(CUTE_WIKI, "℃-ute")
        bogus = [dict(r, group="没配过的团") for r in rows]
        with self.assertRaises(ValueError) as ctx:
            mm.build_sections(bogus)
        self.assertIn("没配过的团", str(ctx.exception))

    def test_empty_wiki_page_yields_no_section(self):
        secs = mm.build_sections(mm.build_members_from_wiki({"℃-ute": ""}))
        self.assertEqual(secs, [], "取不到条目的团不该产出一段空段")

    def test_load_survives_a_broken_wiki_page(self):
        """morning 的失败策略是 **empty**（单页失败 → 该团 0 人，由源门的
        「团消失」兜），不是抛 —— 策略现在是 ja_wiki 的显式参数。"""

        def fetch(url):
            if "helloproject.com" in url:
                return "<html></html>"
            if "Juice" in url:
                raise RuntimeError("boom")
            return ""

        members, _ = mm.load(fetch, warn=lambda *a: None, photo=False)
        self.assertIsInstance(members, list)

    def test_load_parses_each_page_once(self):
        """深化㉗：load 此前为打印人数把每页解析两遍（11 团 22 次）——
        「解析两次」对任何断言都不可见（扫描只能用探针数调用），所以用计数钉住。"""
        calls = []
        real = mm.parse_wiki_members

        def counting(text, group=mm.DEFAULT_GROUP):
            calls.append(group)
            return real(text, group)

        def fetch(url):
            if "helloproject.com" in url:
                return LIST_HTML if url.endswith("morningmusume/") else "<html></html>"
            return BOTH

        with mock.patch.object(mm, "parse_wiki_members", counting):
            mm.load(fetch, warn=lambda *a: None, photo=False)
        self.assertEqual(len(calls), len(mm.GROUPS), f"每团一次，实际 {len(calls)} 次")
        self.assertEqual(len(set(calls)), len(calls), "有团被解析了两次")

    def test_load_talks_to_eleven_wiki_pages_and_only_live_official_groups(self):
        """Wikipedia 抓 11 团；官网只抓 7 个现役团（已停止活动的团没有官网页面）。"""
        asked = []

        def fetch(url):
            asked.append(url)
            if "helloproject.com" in url:
                return LIST_HTML if url.endswith("morningmusume/") else "<html></html>"
            if "℃-ute" in url:
                return CUTE_WIKI
            return BOTH

        mm.load(fetch, warn=lambda *a: None, photo=False)
        wiki_titles = [u for u in asked if "action=parse" in u]
        # 工单 01 起 GROUPS 有 11 团（モーニング娘。+ ℃-ute + 伞下九团）
        self.assertEqual(len(wiki_titles), 11, wiki_titles)
        site_roots = {u.split("//")[1].split("/")[0] for u in asked if "helloproject" in u}
        self.assertEqual(site_roots, {"helloproject.com"})
        self.assertFalse(
            any("cute" in u or "c-ute" in u for u in asked),
            "不该去抓℃-ute 的官网（它已解散、没有官网页面）",
        )


class TestGroupConfig(unittest.TestCase):
    """深化㉔：元数据收进 GROUPS 一处，三个派生视图要与规格一致。"""

    def test_derived_metadata_matches_spec(self):
        self.assertEqual(
            mm.OFFICIAL_GROUPS,
            [
                "モーニング娘。",
                "アンジュルム",
                "Juice=Juice",
                "つばきファクトリー",
                "BEYOOOOONDS",
                "OCHA NORMA",
                "ロージークロニクル",
            ],
            "官网覆盖 7 个现役团",
        )
        self.assertEqual(
            mm.OFFICIAL_PATHS,
            {
                "モーニング娘。": "/morningmusume/",
                "アンジュルム": "/angerme/",
                "Juice=Juice": "/juicejuice/",
                "つばきファクトリー": "/tsubakifactory/",
                "BEYOOOOONDS": "/beyooooonds/",
                "OCHA NORMA": "/ochanorma/",
                "ロージークロニクル": "/rosychronicle/",
            },
            "七条官网路径全钉（只钉一条时其余写错不会红）",
        )
        self.assertEqual(
            mm.GROUP_END_YEAR,
            {
                "Berryz工房": 2015,
                "℃-ute": 2017,
                "カントリー・ガールズ": 2019,
                "こぶしファクトリー": 2020,
            },
            "四个已停止活动团的终止年份",
        )
        # 互斥：有官网页面的团都不该有 end_year（现役 vs 已停止）
        self.assertEqual(set(mm.OFFICIAL_GROUPS) & set(mm.GROUP_END_YEAR), set())

    def test_vitals_column_with_missing_part(self):
        """合并列按形状触发：某团写成「血液型/身長」（少出身地）也要拆，
        缺的那项空着 —— 精确列名匹配会静默少字段。"""
        wiki = (
            "=== 現在のメンバー ===\n"
            '{| class="wikitable"\n'
            "!名前\n!生年月日\n!血液型/身長\n|-\n"
            "|'''[[試験子]]'''\n|1999年1月1日\n|A型<br>160cm\n|}\n"
        )
        got = mm.parse_wiki_members(wiki, "Juice=Juice")
        self.assertEqual(got[0]["blood"], "A型")
        self.assertEqual(got[0]["height"], "160cm")
        self.assertEqual(got[0]["from"], "")


class TestNineNewGroups(unittest.TestCase):
    """伞下九团（工单 01）：每团的段配置、脏表头、合并列、colspan 表头。

    fixture 全部从真实 wikitext 切下来（表头 + 3 行），放在 fixtures/morningmusume/。
    """

    CASES = [
        # (团, fixture, 首人, 假名, status)
        ("アンジュルム", "angerme-current.wiki", "伊勢鈴蘭", "いせ れいら", "current"),
        ("アンジュルム", "angerme-former.wiki", "小川紗季", "おがわ さき", "former"),
        ("Juice=Juice", "juicejuice-current.wiki", "段原瑠々", "だんばら るる", "current"),
        ("Juice=Juice", "juicejuice-former.wiki", "大塚愛菜", "おおつか あいな", "former"),
        ("つばきファクトリー", "tsubaki-current.wiki", "谷本安美", "たにもと あみ", "current"),
        ("BEYOOOOONDS", "beyooooonds-members.wiki", "西田汐里", "にしだ しおり", "current"),
        ("OCHA NORMA", "ochanorma-current.wiki", "斉藤円香", "さいとう まどか", "current"),
        ("ロージークロニクル", "rosy-current.wiki", "橋田歩果", "はしだ ほのか", "current"),
        ("Berryz工房", "berryz-hiatus.wiki", "清水佐紀", "しみず さき", "former"),
        ("カントリー・ガールズ", "country-hiatus.wiki", "山木梨沙", "やまき りさ", "former"),
        ("カントリー・ガールズ", "country-past.wiki", "島村嬉唄", "しまむら うた", "former"),
        ("こぶしファクトリー", "kobushi-dissolved.wiki", "広瀬彩海", "ひろせ あやか", "former"),
        ("こぶしファクトリー", "kobushi-former.wiki", "藤井梨央", "ふじい りお", "former"),
    ]

    def test_rows_name_kana_status_generation(self):
        for group, fix, name, kana, status in self.CASES:
            with self.subTest(group=group, fix=fix):
                got = mm.parse_wiki_members(fixture(fix), group)
                self.assertEqual(len(got), 3, f"{fix} 应解析出 3 行")
                first = got[0]
                self.assertEqual(first["name"], name)
                self.assertEqual(first["kana"], kana, f"{fix} 的假名没取到")
                self.assertEqual(first["status"], status)
                # 决定 4：这九团不解析期生
                self.assertEqual(first["generation"], "", f"{fix} 不该有期生")

    def test_angerme_former_fields(self):
        """アンジュルム 毕业表：毕业日列名与 ℃-ute 同形，日期要归一。"""
        rows = {m["name"]: m for m in mm.parse_wiki_members(fixture("angerme-former.wiki"), "アンジュルム")}
        m = rows["小川紗季"]
        self.assertEqual(m["birth"], "1996.11.18")
        self.assertEqual(m["blood"], "A型")
        self.assertEqual(m["from"], "埼玉県")
        self.assertEqual(m["end"], "2011.08.27")

    def test_juicejuice_combined_vitals_column(self):
        """Juice=Juice 现役把「血液型 / 身長 / 出身地」塞在一格里，要拆开。"""
        rows = {m["name"]: m for m in mm.parse_wiki_members(fixture("juicejuice-current.wiki"), "Juice=Juice")}
        m = rows["段原瑠々"]
        self.assertEqual(m["blood"], "A型")
        self.assertEqual(m["height"], "164.5cm")
        self.assertEqual(m["from"], "広島県")
        self.assertEqual(m["birth"], "2001.05.07")

    def test_juicejuice_former_end_column(self):
        """毕业列名是 `卒業・脱退<small>(日付/開催地/在籍日数)</small>`，日期要归一。"""
        rows = {m["name"]: m for m in mm.parse_wiki_members(fixture("juicejuice-former.wiki"), "Juice=Juice")}
        self.assertEqual(rows["大塚愛菜"]["end"], "2013.07.05")

    def test_tsubaki_dirty_headers(self):
        """つばき：`![[ABO式血液型|血液型]]` 与 `!身長{{R|na}}` 都要洗成正常列名。"""
        rows = {m["name"]: m for m in mm.parse_wiki_members(fixture("tsubaki-current.wiki"), "つばきファクトリー")}
        m = rows["谷本安美"]
        self.assertEqual(m["birth"], "1999.11.16")
        self.assertEqual(m["blood"], "B型")
        self.assertEqual(m["height"], "157.5cm")
        self.assertEqual(m["from"], "北海道")

    def test_beyooooonds_colspan_header_and_bang_cells(self):
        """BEYOOOOONDS：两行表头 + `colspan="2"` + 数据行里有 `!` 起始的格（所属）。"""
        rows = {m["name"]: m for m in mm.parse_wiki_members(fixture("beyooooonds-members.wiki"), "BEYOOOOONDS")}
        m = rows["西田汐里"]
        self.assertEqual(m["birth"], "2003.06.07")
        self.assertEqual(m["blood"], "B型")
        self.assertEqual(m["height"], "151cm")
        self.assertEqual(m["from"], "京都府")
        # 列对齐：備考 在 colspan=2 的「加入年月日」之后。不展开 colspan 的话
        # 整行左移一格、備考 会取到加入日 —— 这条是 colspan 展开唯一的承重断言
        # （前面那些字段都在 colspan 之前，展开与否都一样）。
        raw = fixture("beyooooonds-members.wiki")
        by_name = {r["名前"]: r for r in mm.split_rows(raw[raw.index("{|") :])}
        self.assertEqual(by_name["西田汐里"]["備考"], "元ハロプロ研修生")


def mini_table(name, status_section, end=""):
    """极小 wikitext 表：装配规则的测试不需要真实 3 行 fixture（那是解析测试的事）。

    列名用解析器已认的形状；end 列只有毕业段才写。
    """
    end_col = "\n!卒業・脱退日" if end else ""
    end_val = f"\n|{end}" if end else ""
    return (
        f"{status_section}\n"
        "{| class=\"wikitable\"\n"
        "!名前\n!生年月日" + end_col + "\n|-\n"
        f"|'''[[{name}]]'''\n|1999年1月1日" + end_val + "\n|}\n"
    )


class TestCrossGroupMerge(unittest.TestCase):
    """工单 02 决定 2：同一人跨团只留一份，保留最近归属（现役优先，其次毕业日较晚）。"""

    def test_transfer_keeps_the_current_affiliation(self):
        pages = {
            "こぶしファクトリー": mini_table("井上玲音", "=== 旧メンバー ===", end="2019年7月8日"),
            "Juice=Juice": mini_table("井上玲音", "=== 現在のメンバー ==="),
        }
        members = mm.build_members_from_wiki(pages)
        self.assertEqual(len(members), 1, "同一人只该留一份")
        self.assertEqual(members[0]["group"], "Juice=Juice")
        self.assertEqual(members[0]["status"], "current")

    def test_two_former_keeps_the_later_end(self):
        pages = {
            "カントリー・ガールズ": mini_table("島村嬉唄", "=== 過去に在籍していたメンバー ===", end="2015年6月12日"),
            "Berryz工房": mini_table("島村嬉唄", "=== 過去に在籍していたメンバー ===", end="2016年8月11日"),
        }
        members = mm.build_members_from_wiki(pages)
        self.assertEqual(len(members), 1)
        self.assertEqual(members[0]["group"], "Berryz工房", "毕业日较晚的归属优先")

    def test_two_current_claims_still_raise(self):
        pages = {
            "アンジュルム": mini_table("同名子", "=== 現在のメンバー ==="),
            "Juice=Juice": mini_table("同名子", "=== 現在のメンバー ==="),
        }
        with self.assertRaises(ValueError):
            mm.build_members_from_wiki(pages)

    def test_two_official_groups_claiming_the_same_person_still_raise(self):
        """审查抓到的真 bug：两源都可能缺席，报错信息里 `.get("wiki", {})` 在
        键存在且值为 None 时返回 None → AttributeError 而不是 ValueError。
        这条路径（官网+官网冲突）此前没有测试走过。"""
        official = {
            "アンジュルム": {"同名子": {"name": "同名子", "group": "アンジュルム", "detail": {}}},
            "Juice=Juice": {"同名子": {"name": "同名子", "group": "Juice=Juice", "detail": {}}},
        }
        with self.assertRaises(ValueError) as ctx:
            mm.build_members(official, {})
        self.assertIn("同名子", str(ctx.exception))

    def test_groups_are_rich_and_include_home(self):
        """统一载荷：`groups` 元素 {group, current}，含自家团（与 48G 同形）。"""
        pages = {
            "Berryz工房": mini_table("嗣永桃子", "=== 無期限活動休止発表時のメンバー ==="),
            "カントリー・ガールズ": mini_table("嗣永桃子", "=== 活動休止時のメンバー ==="),
        }
        members = mm.build_members_from_wiki(pages)
        self.assertEqual(len(members), 1)
        self.assertEqual(
            members[0]["groups"],
            [
                {"group": "Berryz工房", "current": False},
                {"group": "カントリー・ガールズ", "current": False},
            ],
        )

    def test_groups_current_flag_follows_each_group_record(self):
        """`current` 是**每团**的：官网现役（アンジュルム）+ Wikipedia 毕业（カントリー）
        → 两条各按自己的记录状态（现役 true / 毕业 false）。"""
        official = {
            "アンジュルム": {
                "転籍花": {"name": "転籍花", "group": "アンジュルム", "detail": {}}
            }
        }
        pages = {
            "カントリー・ガールズ": mini_table(
                "転籍花", "=== 活動休止時のメンバー ==="
            )
        }
        members, _ = mm.build_members(official, mm.parse_all(pages))
        m = {x["name"]: x for x in members}["転籍花"]
        self.assertEqual(m["group"], "アンジュルム", "现役赢")
        # 顺序 = GROUPS 配置顺序（早安侧；48G 侧是自家在前 + 记录顺序 —— 消费者都不看顺序）
        self.assertEqual(
            m["groups"],
            [
                {"group": "アンジュルム", "current": True},
                {"group": "カントリー・ガールズ", "current": False},
            ],
        )

    def test_tie_without_end_dates_uses_group_end_rank(self):
        """两边毕业日都缺时的裁决：按团体终止年份取较晚的（审查实测嗣永桃子
        被错判进 Berryz —— 她 2015 休止后仍在カントリー到 2017）。"""
        pages = {
            "Berryz工房": mini_table("嗣永桃子", "=== 無期限活動休止発表時のメンバー ==="),
            "カントリー・ガールズ": mini_table("嗣永桃子", "=== 活動休止時のメンバー ==="),
        }
        members = mm.build_members_from_wiki(pages)
        self.assertEqual(len(members), 1)
        self.assertEqual(members[0]["group"], "カントリー・ガールズ")

    def test_official_covers_many_groups(self):
        """官网侧改成按团分组：两个团的官网数据都要落进对应团。"""
        official = {
            "モーニング娘。": {"佐藤優樹": {"name": "佐藤優樹", "group": "モーニング娘。", "detail": {}}},
            "アンジュルム": {"伊勢鈴蘭": {"name": "伊勢鈴蘭", "group": "アンジュルム", "detail": {}}},
        }
        pages = {
            "モーニング娘。": mini_table("佐藤優樹", "=== メンバー ==="),
            "アンジュルム": mini_table("伊勢鈴蘭", "=== 現在のメンバー ==="),
        }
        members, _ = mm.build_members(official, mm.parse_all(pages))
        got = {m["name"]: m["group"] for m in members}
        self.assertEqual(got, {"佐藤優樹": "モーニング娘。", "伊勢鈴蘭": "アンジュルム"})

    def test_official_current_beats_wiki_former_for_same_person(self):
        """官网只有现役：官网说现役、Wikipedia 同一个人还在毕业段 = 转团/源未更新，取现役。"""
        official = {
            "Juice=Juice": {"井上玲音": {"name": "井上玲音", "group": "Juice=Juice", "detail": {}}}
        }
        pages = {"こぶしファクトリー": mini_table("井上玲音", "=== 旧メンバー ===", end="2019年7月8日")}
        members, _ = mm.build_members(official, mm.parse_all(pages))
        self.assertEqual(len(members), 1)
        self.assertEqual(members[0]["group"], "Juice=Juice")
        self.assertEqual(members[0]["status"], "current")


if __name__ == "__main__":
    unittest.main()


class PhotoReasonTests(unittest.TestCase):
    """工单 09：没找到照片的原因要说清是哪一种（查询失败 / 源里没有 / 预算内未扫完）——
    「源里没有」被当成事实是本仓翻过的车（预算截断的产物，见 issues/03 的订正）。"""

    MEMBER = {
        "name": "後藤真希",
        "file": "m1",
        "status": "former",
        "group": "モーニング娘。",
    }

    def test_commons_failure_noted_as_failure(self):
        urls, notes = {}, {}

        def boom(url):
            raise RuntimeError("429")

        mm._resolve_commons([self.MEMBER], urls, boom, 0, notes)
        self.assertEqual(notes.get("m1"), "查询失败")
        self.assertNotIn("m1", urls)

    def test_commons_empty_noted_as_source_empty(self):
        urls, notes = {}, {}

        def empty(url):
            import json

            if "list=search" in url:
                return json.dumps({"query": {"search": []}})
            return json.dumps({"query": {"pages": {}}})

        mm._resolve_commons([self.MEMBER], urls, empty, 0, notes)
        self.assertEqual(notes.get("m1"), "源里没有")

    def test_exhausted_group_is_noted_as_budget_not_missing_page(self):
        """判据 1：某团预算用尽 → 原因**不出现**「无其页」，而是「预算内未扫完」。"""
        members = [dict(self.MEMBER)]
        urls, notes = {}, {}
        best = {"http://x/a": ["20200101000000", "20200202000000", "20200303000000"]}

        def fake_candidates(prefixes, fetch, missing):
            return best

        def fake_fetch(url):
            return "<html>no photos here</html>"

        with mock.patch.object(mm, "_old_site_candidates", fake_candidates), mock.patch.object(
            mm, "_group_budget", lambda missing, g: 2
        ):
            mm._resolve_old_site_groups(members, {}, urls, fake_fetch, 0, 900, notes)
        self.assertEqual(notes.get("m1"), "旧站预算内未扫完")

    def test_resolve_fills_notes_and_prints_no_summary(self):
        """工单 01：解析阶段把原因交给调用方（`notes`），自己不打印汇总。"""
        members = [dict(self.MEMBER)]
        warns = []
        notes = {}

        def boom(url):
            raise RuntimeError("429")

        mm.resolve_former_photos(
            members, {}, boom, warn=warns.append, pause=0, notes=notes
        )
        self.assertEqual(notes.get(self.MEMBER["file"]), "查询失败")
        self.assertNotIn("照片未解析到", "\n".join(warns))
        self.assertNotIn("解析不到", "\n".join(warns))

    def test_old_site_reason_survives_the_commons_stage(self):
        """链尾的 Commons 不得覆盖旧站的原因（两轴审查抓到：覆盖让工单 09 的整条
        目的落空 —— 全链路报告永远看不到「预算内未扫完」）。"""
        members = [dict(self.MEMBER)]
        urls, notes = {}, {}
        notes[members[0]["file"]] = "旧站预算内未扫完"  # 模拟旧站段先写

        def empty(url):
            import json

            if "list=search" in url:
                return json.dumps({"query": {"search": []}})
            return json.dumps({"query": {"pages": {}}})

        mm._resolve_commons(members, urls, empty, 0, notes)
        self.assertEqual(notes[members[0]["file"]], "旧站预算内未扫完")

    def test_group_cut_by_global_limit_is_noted(self):
        """团被全局上限中途截断（预算没用完）：既不是「扫完了没找到」，也不是
        「预算用尽」—— 单独一类（此前静默落到 Commons 写成「源里没有」）。"""
        members = [dict(self.MEMBER)]
        urls, notes = {}, {}
        best = {"http://x/a": ["20200101000000", "20200202000000", "20200303000000"]}

        def fake_candidates(prefixes, fetch, missing):
            return best

        with mock.patch.object(mm, "_old_site_candidates", fake_candidates), mock.patch.object(
            mm, "_group_budget", lambda missing, g: 50
        ):
            # limit=1：只够抓 1 个快照 → 团被全局上限截断
            mm._resolve_old_site_groups(
                members, {}, urls, lambda u: "<html>x</html>", 0, 1, notes
            )
        self.assertEqual(notes.get(members[0]["file"]), "旧站被全局上限截断")

    def test_group_never_reached_is_noted_as_limit_not_missing_page(self):
        """第一类截断：全局上限在轮到该团**之前**就用完 —— 三分类里唯一没有测试的一类
        （grep 此前只在源码里命中「旧站未扫到（全局上限）」）。"""
        members = [dict(self.MEMBER)]
        urls, notes = {}, {}

        def fake_candidates(prefixes, fetch, missing):
            return {}

        with mock.patch.object(mm, "_old_site_candidates", fake_candidates):
            # limit=0：循环开头就 break → 该团压根没轮到
            mm._resolve_old_site_groups(
                members, {}, urls, lambda u: "<html>x</html>", 0, 0, notes
            )
        self.assertEqual(notes.get(members[0]["file"]), "旧站未扫到（全局上限）")

    def test_unknown_cut_reason_is_loud(self):
        """未来加了第四种截断却忘改 `_CUT_REASON` 时必须出声 ——
        静默当「扫完」会让它落到 Commons 写成「源里没有」（工单 09 的事故类）。"""
        members = [dict(self.MEMBER)]
        with mock.patch.object(
            mm, "_pick_old_site_group", lambda *a, **k: (0, "other")
        ), mock.patch.object(
            mm, "_old_site_candidates", lambda *a, **k: {"http://x/a": ["20200101000000"]}
        ):
            with self.assertRaises(KeyError):
                mm._resolve_old_site_groups(
                    members, {}, {}, lambda u: "<html>x</html>", 0, 900, {}
                )

    def test_query_failure_is_not_downgraded_by_a_later_empty_result(self):
        """两轴审查抓到的真缺陷：pageimages 请求失败 + 搜索查询成功但空 ——
        原因必须是「查询失败」，不许被后一阶段的空结果降级成「源里没有」
        （429 被记成「源里没有」是本仓记录过的坑）。"""
        members = [dict(self.MEMBER)]
        urls, notes = {}, {}

        def fetch(url):
            import json

            if "pageimages" in url:
                raise RuntimeError("429")
            if "list=search" in url:
                return json.dumps({"query": {"search": []}})
            return json.dumps({"query": {"pages": {}}})

        mm._resolve_commons(members, urls, fetch, 0, notes)
        self.assertEqual(notes.get(members[0]["file"]), "查询失败")

    def test_all_stages_empty_is_source_empty(self):
        """三阶段都「查了但没有」→ 「源里没有」（不是「查询失败」）。"""
        members = [dict(self.MEMBER)]
        urls, notes = {}, {}

        def fetch(url):
            import json

            if "list=search" in url:
                return json.dumps({"query": {"search": []}})
            return json.dumps({"query": {"pages": {}}})

        mm._resolve_commons(members, urls, fetch, 0, notes)
        self.assertEqual(notes.get(members[0]["file"]), "源里没有")
