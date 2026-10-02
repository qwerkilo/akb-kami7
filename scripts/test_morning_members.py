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
        self.assertNotIn("height", y)
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
