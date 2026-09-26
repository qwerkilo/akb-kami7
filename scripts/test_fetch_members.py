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


class GroupOfTests(unittest.TestCase):
    def test_akb48_generation(self):
        self.assertEqual(fetch_members.group_of("1期|AKB48"), (1.0, "1期生"))

    def test_note_of(self):
        self.assertEqual(fetch_members.note_of("1期|AKB48"), "AKB48 1期")


if __name__ == "__main__":
    unittest.main()
