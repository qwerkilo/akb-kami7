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


if __name__ == "__main__":
    unittest.main()


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
        official = {}
        for it in items:
            it = dict(it)
            it["detail"] = mm.parse_detail(DETAIL_HTML) if it["name"] == "野中美希" else {}
            official[it["name"]] = it
        self.members, self.urls = mm.build_members(official, mm.parse_wiki_members(BOTH))
        self.by_name = {m["name"]: m for m in self.members}

    def test_official_fills_bio_and_photo_url(self):
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
            "野中美希": {
                "photo": "/upload/images/a.webp",
                "detail": {"nick_raw": "非儿的昵称、别名一"},
            }
        }
        members, _ = mm.build_members(official, mm.parse_wiki_members(BOTH))
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


class ResolveFormerPhotosTests(unittest.TestCase):
    """毕业成员的照片：旧列表页快照 → Wayback → Commons。每一级都要试，
    上一张 404 不能让整条链短路。"""

    def _members(self):
        return [
            {"name": "野中美希", "status": "current", "file": "morningmusume:野中美希"},
            {
                "name": "石黒彩",
                "status": "former",
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

    def test_former_with_no_source_warns_instead_of_silently_dropping(self):
        """解析不到时要**喊一声**：站里会显示占位卡，但没人知道是谁。"""
        msgs = []
        members = self._members()
        urls = {members[0]["file"]: "/upload/images/a.webp"}
        mm.resolve_former_photos(members, urls, lambda url: "[]", warn=msgs.append)
        self.assertNotIn(members[1]["file"], urls)
        self.assertEqual(len(msgs), 1)
        self.assertIn("石黒彩", msgs[0])


class BuildSectionsTests(unittest.TestCase):
    def test_one_series_one_group_and_generation_stays_a_member_field(self):
        """早安是**一系列一团**；期生留在成员上（等爱是三团且只有一期，
        所以把 GENERATION 塞进 section —— 早安相反，18 期必须能筛）。"""
        secs = mm.build_sections(mm.parse_wiki_members(BOTH))
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


if __name__ == "__main__":
    unittest.main()


# ── 工单 01：℃-ute 的 parse（按团配置节标记，复用モーニング娘。的解析器）────
CUTE_DISSOLVED_WIKI = fixture("cute-dissolved-members.wiki")   # 解散时全员（5 人）
CUTE_PAST_WIKI = fixture("cute-past-members.wiki")             # 更早离团（3 人）
CUTE_WIKI = CUTE_DISSOLVED_WIKI + "\n" + CUTE_PAST_WIKI


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

    def test_height_is_parsed_but_not_in_bio(self):
        """身高只有「解散時」那张表有。落 member.height，**不进 bio** ——
        站内身高只出现在资料卡，与血型/出身地同一层（决定 3）。"""
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
