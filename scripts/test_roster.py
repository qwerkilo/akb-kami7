"""roster：名册装配契约（组内排序 / 成员投影 / 分段形状），纯函数、离线。"""
import unittest

import roster


def member(name, kana="", status="current", **kw):
    return {
        "id": kw.get("id", "m-" + name),
        "name": name,
        "kana": kana,
        "nick": kw.get("nick", ""),
        "status": status,
        "end": kw.get("end"),
        "img": kw.get("img", True),
        **{k: v for k, v in kw.items() if k in ("bio", "leave", "note", "groups")},
    }


class RosterTest(unittest.TestCase):
    def test_ymd(self):
        # 统一日期格式 YYYY.MM.DD；缺月日时只给年份
        self.assertEqual(roster.ymd("1998", 3, 5), "1998.03.05")
        self.assertEqual(roster.ymd("1998", "3", "5"), "1998.03.05")
        self.assertEqual(roster.ymd("1998", "03", "05"), "1998.03.05")
        self.assertEqual(roster.ymd(2016), "2016")
        self.assertEqual(roster.ymd(2016, "", ""), "2016")
        self.assertEqual(roster.ymd("2016", None, None), "2016")

    def test_sort_current_first_then_kana_then_name(self):
        ms = [
            member("C", "う", "former"),
            member("A", "あ", "current"),
            member("B", "", "current"),
        ]
        self.assertEqual(
            [m["name"] for m in roster.sort_members(ms)], ["B", "A", "C"]
        )

    def test_project_base_keys_always_present_in_order(self):
        out = roster.project(member("A", "あ", "current", bio={"birth": "x"}))
        self.assertEqual(
            list(out), ["id", "name", "kana", "nick", "status", "end", "img", "bio"]
        )
        self.assertIsNone(out["end"])

    def test_project_optional_only_when_truthy(self):
        out = roster.project(
            member("A", "あ", "former", end="2013", leave="卒業", note="", groups=None),
            optional=("bio", "leave", "note", "groups"),
        )
        self.assertEqual(out["end"], "2013")
        self.assertEqual(out["leave"], "卒業")
        self.assertNotIn("note", out)
        self.assertNotIn("groups", out)

    def test_section_shape_and_member_order(self):
        s = roster.section(
            "=LOVE",
            "love",
            "1期生",
            [member("B", "い", "former"), member("A", "あ", "current")],
        )
        self.assertEqual(list(s), ["group", "series", "label", "members"])
        self.assertEqual((s["group"], s["series"], s["label"]), ("=LOVE", "love", "1期生"))
        self.assertEqual([m["name"] for m in s["members"]], ["A", "B"])
        self.assertNotIn("group", s["members"][0])

    def test_section_does_not_mutate_input(self):
        ms = [member("B", "い", "former"), member("A", "あ", "current")]
        roster.section("g", "s", "1期生", ms)
        self.assertEqual([m["name"] for m in ms], ["B", "A"])


if __name__ == "__main__":
    unittest.main()
