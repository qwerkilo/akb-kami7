import unittest

import fetch_members


class SlugTests(unittest.TestCase):
    def test_known_member_slug(self):
        # 板野友美 的 id 已存在于生成产物中，作为已知良好字面量
        self.assertEqual(fetch_members.slug("板野友美"), "m8393c0805d")

    def test_distinct_names_have_distinct_slugs(self):
        self.assertNotEqual(fetch_members.slug("前田敦子"), fetch_members.slug("大島優子"))


class CleanNameTests(unittest.TestCase):
    def test_piped_link_uses_display_name(self):
        self.assertEqual(
            fetch_members.clean_name("[[前田敦子|まえだ あつこ]]"),
            ("まえだ あつこ", "前田敦子"),
        )

    def test_plain_link_uses_page_title(self):
        self.assertEqual(fetch_members.clean_name("[[前田敦子]]"), ("前田敦子", "前田敦子"))

    def test_strips_html_tags(self):
        self.assertEqual(fetch_members.clean_name("<s>あつこ</s>"), ("あつこ", None))


SKE_FIXTURE = """== 現役メンバー ==
{|
|-
| {{!チーム|S}} 
| [[File:Ske1.jpg|50px]] 
| {{ルビ|[[相川暖花]]|あいかわ ほのか}} 
| ほのちゃん 
| {{加入期|2期|SKE48}} 
| {{年月日|2020|1|1}} 
|-
| {{!チーム|KII}} 
| [[ファイル:Ske2.jpg|50px]] 
| {{ルビ|[[青木詩織]]|あおき しおり}} 
| おしりん 
| {{加入期|1期|SKE48}} 
| {{年月日|2019|6|1}} 
== 元メンバー ==
{|
|-
| {{!チーム|E}} 
| [[File:Ske3.jpg|50px]] 
| {{ルビ|[[卒業花子]]|そつぎょう はなこ}} 
|  
| {{加入期|1期|SKE48}} 
| {{年月日|2013|4|1}}<br>（卒業） 
|-
| {{!チーム|E}} 
| {{ルビ|[[無写真子]]|むしゃしん こ}} 
|  
| {{加入期|3期|SKE48}} 
| {{年月日|2014|2|2}}<br>（卒業） 
|}
"""


class ParsePageTests(unittest.TestCase):
    def test_sections_map_to_status_and_group(self):
        rows = fetch_members.parse_page(SKE_FIXTURE, "SKE48", "former")
        self.assertEqual(
            [(r["name"], r["status"], r["group"]) for r in rows],
            [
                ("相川暖花", "current", "SKE48"),
                ("青木詩織", "current", "SKE48"),
                ("卒業花子", "former", "SKE48"),
                ("無写真子", "former", "SKE48"),
            ],
        )
        self.assertEqual(rows[0]["kana"], "あいかわ ほのか")
        self.assertEqual(rows[0]["file"], "Ske1.jpg")
        self.assertEqual(rows[1]["file"], "Ske2.jpg")
        self.assertEqual(rows[2]["end"], "2013.04.01")
        self.assertEqual(rows[2]["leave"], "卒業")
        self.assertEqual(rows[3]["file"], "")
        self.assertEqual(rows[3]["end"], "2014.02.02")


class GroupOfTests(unittest.TestCase):
    def test_akb48_generation(self):
        self.assertEqual(fetch_members.group_of("1期|AKB48", "AKB48"), (1.0, "1期生"))

    def test_same_group_generation(self):
        self.assertEqual(fetch_members.group_of("2期|SKE48", "SKE48"), (2.0, "2期生"))

    def test_draft_generation(self):
        self.assertEqual(fetch_members.group_of("2期|ドラフト", "SKE48"), (112, "选秀2期生"))

    def test_foreign_join_goes_to_transfer_bucket(self):
        self.assertEqual(
            fetch_members.group_of("2期|AKB48", "SKE48"), (130, "兼任・移籍加入")
        )

    def test_team8_stays_special_for_akb48(self):
        self.assertEqual(fetch_members.group_of("チーム8|AKB48", "AKB48"), (100, "Team 8"))

    def test_note_of(self):
        self.assertEqual(fetch_members.note_of("1期|AKB48"), "AKB48 1期")


def member(name, kana, group, status, join, end=None):
    return {
        "name": name,
        "kana": kana,
        "group": group,
        "status": status,
        "join": join,
        "end": end,
    }


class MergeMembersTests(unittest.TestCase):
    def test_merges_transfer_into_later_group(self):
        old = member("移籍花", "いせき はな", "SKE48", "former", "1期|SKE48", "2015.03.31")
        new = member("移籍花", "いせき はな", "NMB48", "current", "1期|SKE48")
        merged = fetch_members.merge_members([old, new])
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["group"], "NMB48")
        self.assertIn("移籍", merged[0]["note"])
        self.assertIn("SKE48", merged[0]["note"])

    def test_merges_concurrent_members_preferring_home_group(self):
        home = member("兼任子", "けんにん こ", "AKB48", "current", "14期|AKB48")
        side = member("兼任子", "けんにん こ", "STU48", "current", "14期|AKB48")
        merged = fetch_members.merge_members([side, home])
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["group"], "AKB48")
        self.assertIn("兼任", merged[0]["note"])
        self.assertIn("STU48", merged[0]["note"])

    def test_keeps_same_name_with_different_kana(self):
        a = member("同名", "どうめい いち", "AKB48", "former", "1期|AKB48", "2010.01.01")
        b = member("同名", "どうめい に", "SKE48", "former", "1期|SKE48", "2011.01.01")
        merged = fetch_members.merge_members([a, b])
        self.assertEqual(len(merged), 2)

    def test_keeps_single_record_untouched(self):
        one = member("単独", "たんどく", "HKT48", "current", "1期|HKT48")
        merged = fetch_members.merge_members([one])
        self.assertEqual(merged, [one])
        self.assertNotIn("note", merged[0])


AKB_CURRENT_PAGE = """== 現役メンバー ==
{|
|-
| [[File:Akb1.jpg|50px]] 
| {{ルビ|[[岩立沙穂]]|いわたて さほ}} 
| さほ 
| {{加入期|13期|AKB48}} 
| {{年月日|2024|1|1}} 
|}
"""

AKB_FORMER_PAGE = """== 元メンバー ==
{|
|-
| [[File:Akb2.jpg|50px]] 
| {{ルビ|[[前田敦子]]|まえだ あつこ}} 
| あっちゃん 
| {{加入期|1期|AKB48}} 
| {{年月日|2012|8|27}}<br>（卒業） 
|}
"""

SDN_PAGE = """== 2012年3月31日時点での在籍メンバー ==
{|
|-
| [[File:Sdn1.jpg|50px]] 
| {{ルビ|[[穐田和恵]]|あきた かずえ}} 
| かずちぃ 
| {{加入期|1期|SDN48}} 
| {{年月日|2012|3|31}} 
== 最終活動日以前の卒業メンバー ==
{|
|-
| [[File:Sdn2.jpg|50px]] 
| {{ルビ|[[手束真知子]]|たづか まちこ}} 
| まっちゃん 
| {{加入期|2期|SDN48}} 
| {{年月日|2011|6|30}}<br>（卒業） 
|}
"""

NO_JOIN_PAGE = """== 元メンバー ==
{|
|-
| [[File:Nj1.jpg|50px]] 
| {{ルビ|[[無期子]]|むき こ}} 
|  
| {{年月日|2015|1|1}}<br>（卒業） 
|}
"""


class ParsePageEdgeTests(unittest.TestCase):
    def test_akb_pages_pair_maps_current_and_former(self):
        current = fetch_members.parse_page(AKB_CURRENT_PAGE, "AKB48", "current")
        former = fetch_members.parse_page(AKB_FORMER_PAGE, "AKB48", "former")
        self.assertEqual([(r["name"], r["status"]) for r in current], [("岩立沙穂", "current")])
        self.assertEqual([(r["name"], r["status"]) for r in former], [("前田敦子", "former")])

    def test_sdn48_sections_all_former(self):
        rows = fetch_members.parse_page(SDN_PAGE, "SDN48", "former")
        self.assertEqual([(r["name"], r["status"]) for r in rows],
                         [("穐田和恵", "former"), ("手束真知子", "former")])
        self.assertEqual(rows[0]["end"], "2012.03.31")

    def test_row_without_join_is_skipped(self):
        rows = fetch_members.parse_page(NO_JOIN_PAGE, "AKB48", "former")
        self.assertEqual(rows, [])


if __name__ == "__main__":
    unittest.main()
