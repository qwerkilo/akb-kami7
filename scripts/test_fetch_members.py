import io
import json
import os
import tempfile
import unittest
from unittest import mock
from contextlib import redirect_stderr, redirect_stdout

from PIL import Image

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


    def test_unknown_join_falls_back_to_other(self):
        self.assertEqual(fetch_members.group_of("その他|AKB48", "AKB48"), (140, "其他"))


def member(name, kana, group, status, join, end=None, **extra):
    m = {
        "name": name,
        "kana": kana,
        "group": group,
        "status": status,
        "join": join,
        "end": end,
    }
    m.update(extra)
    return m


class MergeMembersTests(unittest.TestCase):
    def test_merges_transfer_into_later_group(self):
        old = member("移籍花", "いせき はな", "SKE48", "former", "1期|SKE48", "2015.03.31")
        new = member("移籍花", "いせき はな", "NMB48", "current", "1期|SKE48")
        merged = fetch_members.merge_members([old, new])
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["group"], "NMB48")
        self.assertEqual(merged[0]["extras"], [{"group": "SKE48", "current": False}])

    def test_merges_concurrent_members_preferring_home_group(self):
        home = member("兼任子", "けんにん こ", "AKB48", "current", "14期|AKB48")
        side = member("兼任子", "けんにん こ", "STU48", "current", "14期|AKB48")
        merged = fetch_members.merge_members([side, home])
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["group"], "AKB48")
        self.assertEqual(merged[0]["extras"], [{"group": "STU48", "current": True}])

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
        self.assertNotIn("extras", merged[0])

    def test_same_group_records_collapse_into_one_extra(self):
        akb = member("兼任子", "けんにん こ", "AKB48", "current", "1期|AKB48")
        ske_now = member("兼任子", "けんにん こ", "SKE48", "current", "1期|SKE48")
        ske_old = member(
            "兼任子", "けんにん こ", "SKE48", "former", "1期|SKE48", end="2020.01.01"
        )
        merged = fetch_members.merge_members([akb, ske_now, ske_old])
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["group"], "AKB48")
        self.assertEqual(merged[0]["extras"], [{"group": "SKE48", "current": True}])


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

    def test_row_with_join_but_no_name_is_dropped(self):
        page = "== 元メンバー ==\n{|\n|-\n| {{加入期|1期|AKB48}}\n|}"
        self.assertEqual(fetch_members.parse_rows(page, "former"), [])

    def test_nick_is_empty_when_name_not_in_chunk(self):
        chunk = "| {{加入期|1期|AKB48}}"
        self.assertEqual(fetch_members.nick_from_chunk(chunk, "不存在"), "")

    def test_missing_join_row_is_reported(self):
        buf = io.StringIO()
        with redirect_stdout(buf):
            fetch_members.parse_page(NO_JOIN_PAGE, "AKB48", "former")
        self.assertIn("缺加入期", buf.getvalue())


SORTKEY_FIXTURE = """{| 
|-
{{!チーム|SDN}}
| [[File:2012年SDN48プロフィール チェン・チュー.jpg|50px]]
| data-sort-value="ちぇん ちゅー" | チェン・チュー
| ちゅちゅー
| {{生年月日|1986|11|6}}
| {{加入期|1期|SDN48}}
| {{年月日|2012|3|31}}
|-
{{!チーム|SDN}}
| [[File:2012年SDN48プロフィール KONAN.jpg|50px]]
| data-sort-value="こなん" | {{ルビ|KONAN|コナン}}
| こなん
| {{生年月日|1983|1|1}}
| {{加入期|3期|SDN48}}
| {{年月日|2012|3|31}}
|}
"""


BIO_FIXTURE = """|-
| {{!チーム|AKB}}
| [[ファイル:Bio テスト.jpg|50px]]
| {{ルビ|[[山田花子]]|やまだ はなこ}}
| はなちゃん
| {{生年月日|1994|10|4}}
| {{出身地|神奈川県}}
| {{加入期|13期|AKB48}}
| {{年月日|2013|8|24}}
| 備考
"""


class BioTests(unittest.TestCase):
    def test_extracts_birth_and_hometown(self):
        row, dirty = fetch_members.parse_chunk(BIO_FIXTURE, "current")
        self.assertFalse(dirty)
        self.assertEqual(row["bio"], {"birth": "1994.10.04", "from": "神奈川県"})

    def test_omits_bio_when_both_missing(self):
        chunk = BIO_FIXTURE
        chunk = chunk.replace("| {{生年月日|1994|10|4}}\n", "")
        chunk = chunk.replace("| {{出身地|神奈川県}}\n", "")
        row, _ = fetch_members.parse_chunk(chunk, "current")
        self.assertNotIn("bio", row)

    def test_merge_keeps_bio_from_every_record(self):
        a = {
            "name": "X", "kana": "x", "status": "current", "end": None,
            "join": "1期|A", "group": "A", "bio": {"birth": "2000.01.02"},
        }
        b = {
            "name": "X", "kana": "x", "status": "current", "end": None,
            "join": "1期|B", "group": "B", "bio": {"from": "東京都"},
        }
        merged = fetch_members.merge_person([a, b])
        self.assertEqual(merged["bio"], {"birth": "2000.01.02", "from": "東京都"})

    def test_section_projection_keeps_bio_only_when_present(self):
        base = {"id": "m1", "name": "山田", "kana": "やまだ", "nick": "", "status": "current", "end": None, "img": True, "join": "1期|AKB48", "group": "AKB48", "source": "x"}
        sections = fetch_members.build_sections([dict(base)])
        self.assertNotIn("bio", sections[0]["members"][0])
        with_bio = dict(base, bio={"birth": "1994.10.04"})
        sections = fetch_members.build_sections([with_bio])
        self.assertEqual(
            sections[0]["members"][0]["bio"], {"birth": "1994.10.04"}
        )


class SortKeyCellTests(unittest.TestCase):
    def test_data_sort_value_cells_do_not_leak_into_fields(self):
        rows = fetch_members.parse_rows(SORTKEY_FIXTURE, "former")
        self.assertEqual(
            [(r["name"], r["nick"], r["kana"]) for r in rows],
            [("チェン・チュー", "ちゅちゅー", ""), ("KONAN", "こなん", "コナン")],
        )
        for r in rows:
            for field in ("name", "nick", "kana"):
                self.assertNotIn("data-sort-value", r[field])


class LoadRowsTests(unittest.TestCase):
    def test_load_rows_fetches_each_source_and_tags_group(self):
        calls = []

        def fake_fetch(page):
            calls.append(page)
            return SORTKEY_FIXTURE

        rows = fetch_members.load_rows(
            fetch_page=fake_fetch, sources=(("SDN48", "SDN48メンバー一覧", "former"),)
        )
        self.assertEqual(calls, ["SDN48メンバー一覧"])
        self.assertEqual([r["name"] for r in rows], ["チェン・チュー", "KONAN"])
        self.assertTrue(all(r["group"] == "SDN48" for r in rows))

    def test_load_rows_applies_exclusion(self):
        baito = (
            "{|\n|-\n| [[File:baito.jpg|50px]]\n"
            "| {{ルビ|[[バイト子]]|ばいと こ}}\n| {{加入期|バイトAKB}}\n|}"
        )
        rows = fetch_members.load_rows(
            fetch_page=lambda page: baito,
            sources=(("AKB48", "AKB48元メンバー一覧", "former"),),
        )
        self.assertEqual(rows, [])


class ImageUrlsTests(unittest.TestCase):
    def test_maps_normalized_titles_to_urls_and_skips_missing(self):
        seen = {}

        def fake_api(**params):
            seen.update(params)
            return {
                "query": {
                    "normalized": [{"from": "File:A.jpg", "to": "ファイル:A.jpg"}],
                    "pages": {
                        "1": {
                            "title": "ファイル:A.jpg",
                            "imageinfo": [{"url": "https://example.test/a.jpg"}],
                        },
                        "2": {"title": "ファイル:B.jpg"},
                    },
                }
            }

        out = fetch_members.image_urls(["A.jpg", "B.jpg"], api_fn=fake_api)
        self.assertEqual(out, {"A.jpg": "https://example.test/a.jpg"})
        self.assertEqual(seen["titles"], "ファイル:A.jpg|ファイル:B.jpg")


class ImageIoTests(unittest.TestCase):
    def test_download_writes_file_and_reuses_cache(self):
        calls = []

        def fake_get(url):
            calls.append(url)
            return b"IMG:" + url.encode()

        with tempfile.TemporaryDirectory() as td:
            mid, path = fetch_members.download(
                ("mid1", "http://x/A.JPG"), orig_dir=td, fetch=fake_get
            )
            self.assertEqual(mid, "mid1")
            self.assertEqual(path, os.path.join(td, "mid1.jpg"))
            with open(path, "rb") as fh:
                self.assertEqual(fh.read(), b"IMG:http://x/A.JPG")
            fetch_members.download(("mid1", "http://x/A.JPG"), orig_dir=td, fetch=fake_get)
            self.assertEqual(len(calls), 1)

    def test_download_all_maps_jobs(self):
        with tempfile.TemporaryDirectory() as td:
            paths = fetch_members.download_all(
                [("a", "http://x/a.png"), ("b", "http://x/b.png")],
                orig_dir=td,
                fetch=lambda url: b"x",
                workers=2,
            )
            self.assertEqual(set(paths), {"a", "b"})
            self.assertTrue(os.path.exists(paths["a"]))

    def test_cached_image_paths_only_existing(self):
        with tempfile.TemporaryDirectory() as td:
            open(os.path.join(td, "a.png"), "wb").close()
            out = fetch_members.cached_image_paths(
                [("a", "http://x/a.png"), ("b", "http://x/b.png")], orig_dir=td
            )
            self.assertEqual(set(out), {"a"})

    def test_compress_writes_full_and_thumb(self):
        with tempfile.TemporaryDirectory() as td:
            src = os.path.join(td, "src.png")
            Image.new("RGB", (300, 400), (120, 30, 30)).save(src)
            full_dir = os.path.join(td, "full")
            thumb_dir = os.path.join(td, "thumb")
            os.makedirs(full_dir)
            os.makedirs(thumb_dir)
            size, full = fetch_members.compress(
                "mtest", src, full_dir=full_dir, thumb_dir=thumb_dir
            )
            self.assertEqual(size, (300, 400))
            self.assertEqual(full, (300, 400))
            self.assertTrue(os.path.exists(os.path.join(full_dir, "mtest.webp")))
            thumb_path = os.path.join(thumb_dir, "mtest.webp")
            self.assertEqual(Image.open(thumb_path).size[0], 240)
            cached = fetch_members.compress(
                "mtest", src, full_dir=full_dir, thumb_dir=thumb_dir
            )
            self.assertEqual(cached, ((300, 400), None))


class AssignIdsTests(unittest.TestCase):
    def test_unique_names_get_slug_ids(self):
        members = [member("甲", "こう", "AKB48", "current", "1期|AKB48")]
        fetch_members.assign_ids(members)
        self.assertEqual(members[0]["id"], fetch_members.slug("甲"))

    def test_duplicate_names_get_join_suffix(self):
        members = [
            member("同名", "どうめい", "AKB48", "current", "1期|AKB48"),
            member("同名", "どうめい", "SKE48", "current", "2期|SKE48"),
        ]
        fetch_members.assign_ids(members)
        self.assertNotEqual(members[0]["id"], members[1]["id"])
        self.assertEqual(members[1]["id"], fetch_members.slug("同名#2期|SKE48"))


class BuildSectionsTests(unittest.TestCase):
    def test_orders_groups_sections_and_members(self):
        members = [
            member("乙", "おつ", "SKE48", "former", "1期|SKE48"),
            member("甲", "こう", "SKE48", "current", "1期|SKE48"),
            member("丙", "へい", "SKE48", "current", "2期|SKE48"),
            member("丁", "てい", "AKB48", "current", "1期|AKB48"),
        ]
        for i, m in enumerate(members):
            m["id"] = f"m{i}"
            m["img"] = True
            m["nick"] = ""
        out = fetch_members.build_sections(members)
        self.assertEqual([s["group"] for s in out], ["AKB48", "SKE48", "SKE48"])
        self.assertEqual([s["label"] for s in out], ["1期生", "1期生", "2期生"])
        self.assertEqual([m["name"] for m in out[1]["members"]], ["甲", "乙"])
        self.assertEqual(
            set(out[1]["members"][0]),
            {"id", "name", "kana", "nick", "status", "end", "img"},
        )

    def test_projects_note_and_extras(self):
        concurrent = member(
            "兼任子",
            "けんにん こ",
            "AKB48",
            "current",
            "1期|AKB48",
            id="m1",
            img=True,
            nick="",
            extras=[{"group": "STU48", "current": True}],
        )
        foreign = member(
            "外来子",
            "がいらい こ",
            "AKB48",
            "former",
            "2期|JKT48",
            end="2020.01.01",
            id="m2",
            img=False,
            nick="",
        )
        out = fetch_members.build_sections([concurrent, foreign])
        by_name = {m["name"]: m for s in out for m in s["members"]}
        self.assertEqual(
            by_name["兼任子"]["extras"], [{"group": "STU48", "current": True}]
        )
        self.assertNotIn("note", by_name["兼任子"])
        self.assertEqual(by_name["外来子"]["note"], "JKT48 2期")
        self.assertFalse(by_name["外来子"]["img"])


class WriteMembersJsTests(unittest.TestCase):
    def test_writes_round_trippable_file(self):
        sections = [{"group": "AKB48", "label": "1期生", "members": []}]
        with tempfile.TemporaryDirectory() as td:
            path = os.path.join(td, "members.js")
            fetch_members.write_members_js(sections, path)
            with open(path, encoding="utf-8") as fh:
                src = fh.read()
        self.assertTrue(src.startswith("// generated by scripts/fetch_members.py"))
        payload = src.split("window.AKB_GROUPS = ", 1)[1].rstrip(";\n")
        self.assertEqual(json.loads(payload), sections)


class PruneUnusedTests(unittest.TestCase):
    def test_removes_unreferenced_files(self):
        with tempfile.TemporaryDirectory() as td:
            open(os.path.join(td, "a.webp"), "wb").close()
            open(os.path.join(td, "b.webp"), "wb").close()
            removed = fetch_members.prune_unused({"a"}, [td])
            self.assertEqual(removed, 1)
            self.assertTrue(os.path.exists(os.path.join(td, "a.webp")))
            self.assertFalse(os.path.exists(os.path.join(td, "b.webp")))


class RosterGateTests(unittest.TestCase):
    """必需数据源门：名册相对盘上基线塌了就不许写盘（否则 prune 会删掉全站图片）。"""

    def _baseline(self, groups, count):
        # 人数按 groups 平分，够逐团下限判据用
        per = max(1, count // len(groups))
        return {
            "groups": set(groups),
            "counts": {g: per for g in groups},
            "total": sum(per for _ in groups),
        }

    @staticmethod
    def _members(per_group):
        return [{"group": g} for g, n in per_group.items() for _ in range(n)]

    def test_no_baseline_is_a_first_run_and_passes(self):
        self.assertEqual(fetch_members.roster_problems([], None), [])

    def test_healthy_roster_has_no_problems(self):
        base = self._baseline(["AKB48", "SKE48"], 100)
        members = self._members({"AKB48": 60, "SKE48": 40})
        self.assertEqual(fetch_members.roster_problems(members, base), [])

    def test_total_below_threshold_is_a_problem(self):
        base = self._baseline(["AKB48"], 100)
        problems = fetch_members.roster_problems(self._members({"AKB48": 30}), base)
        self.assertTrue(problems)
        # 掉了 70%，消息里要带差量；逐团下限也会命中同一个团
        self.assertTrue(any("70" in p for p in problems), problems)

    def test_missing_group_is_a_problem_even_when_total_is_fine(self):
        base = self._baseline(["AKB48", "SDN48"], 100)
        problems = fetch_members.roster_problems(
            self._members({"AKB48": 60, "SKE48": 40}), base
        )
        # 必须盯「团体消失」那句本身：逐团下限的消息里也有团名，只 any(团名) 会被它满足
        self.assertTrue(any("一个成员都没解析到" in p for p in problems), problems)

    def test_love_groups_are_covered_too(self):
        """等爱三团也在门的范围内（架构扫描候选 3）。

        以前 read_baseline 用 `if group in GROUP_ORDER` 过滤，而等爱不在 GROUP_ORDER 里
        → 基线里根本没有等爱 → 「团消失」「腰斩」两条判据对等爱恒假。而等爱唯一的门
        是 try/except，只挡「抛异常」：抓到 0 人时 love_members 只 print 一行，
        build_sections 把空团静默丢掉，prune_unused 照删图片，脚本 exit 0。
        """
        base = self._baseline(["AKB48", "SKE48"], 200)
        base["love_counts"] = {"=LOVE": 30, "≠ME": 20, "≒JOY": 10}
        # groups 是并集（与 read_baseline 的真实形状一致）—— 我第一版只加 love_counts
        # 而没加 groups，于是「团消失」那条判据在测试里不响，看起来像门没生效
        base["groups"] = base["groups"] | set(base["love_counts"])

        # ① 等爱三团这次一个成员都没解析到 → 必须报，哪怕 48G/坂道 完全健康
        members = self._members({"AKB48": 100, "SKE48": 100})
        problems = fetch_members.roster_problems(members, base)
        self.assertTrue(
            any("=LOVE" in p and "一个成员都没解析到" in p for p in problems),
            problems,
        )
        # ② 等爱某团腰斩 → 逐团下限也要管到等爱
        half = self._members({"AKB48": 100, "SKE48": 100, "=LOVE": 5})
        problems = fetch_members.roster_problems(half, base)
        self.assertTrue(any("=LOVE" in p and "一半" in p for p in problems), problems)
        # ③ 等爱健康时不该多报（总分判据仍只看 48G/坂道）
        ok = self._members(
            {"AKB48": 100, "SKE48": 100, "=LOVE": 30, "≠ME": 20, "≒JOY": 10}
        )
        self.assertEqual(fetch_members.roster_problems(ok, base), [])

    def test_read_baseline_keeps_love_sections(self):
        """read_baseline 必须把等爱分段也读进来（否则上面的判据无从比对）。"""
        import json
        import tempfile

        sections = [
            {"group": "AKB48", "members": [{"n": 1}] * 60},
            {"group": "SKE48", "members": [{"n": 1}] * 40},
            {"group": "=LOVE", "members": [{"n": 1}] * 30},
            {"group": "≠ME", "members": [{"n": 1}] * 20},
            {"group": "≒JOY", "members": [{"n": 1}] * 10},
        ]
        with tempfile.TemporaryDirectory() as td:
            # read_baseline 收的是**目录**（它自己拼 members.js）—— 我第一版传了整个
            # 路径，于是变成 dir/members.js/members.js → NotADirectoryError → 返回 None
            with open(td + "/members.js", "w", encoding="utf-8") as fh:
                fh.write("window.AKB_GROUPS = " + json.dumps(sections) + ";\n")
            base = fetch_members.read_baseline(td)
        self.assertEqual(base["counts"], {"AKB48": 60, "SKE48": 40})
        self.assertEqual(base["love_counts"], {"=LOVE": 30, "≠ME": 20, "≒JOY": 10})
        # 总分判据仍只算 48G/坂道（等爱人少，走逐团规则）
        self.assertEqual(base["total"], 100)

    def test_halved_group_is_a_problem(self):
        # 基线每团 100 人：AKB48 掉到 40（低于一半）→ 该团被点名，总数判据不响
        base = self._baseline(["AKB48", "SKE48"], 200)
        problems = fetch_members.roster_problems(
            self._members({"AKB48": 40, "SKE48": 100}), base
        )
        self.assertEqual(len(problems), 1, problems)
        self.assertIn("AKB48", problems[0])

    def test_growth_never_trips_the_gate(self):
        base = self._baseline(["AKB48"], 10)
        self.assertEqual(fetch_members.roster_problems(self._members({"AKB48": 200}), base), [])

    def test_threshold_boundary(self):
        base = self._baseline(["AKB48"], 100)
        self.assertEqual(
            fetch_members.roster_problems(self._members({"AKB48": 60}), base),
            [],
            "正好 60% 应当放行",
        )
        self.assertEqual(
            len(fetch_members.roster_problems(self._members({"AKB48": 59}), base)), 1, "59% 应当拦下"
        )

    def test_just_below_threshold_still_passes(self):
        # 基线口径必须只含 48G/坂道 团体——含等爱分段会让「团体消失」恒成立
        base = {"groups": {"AKB48"}, "counts": {"AKB48": 100}, "total": 100}
        self.assertEqual(fetch_members.roster_problems(self._members({"AKB48": 100}), base), [])
        self.assertEqual(
            len(fetch_members.roster_problems(self._members({"AKB48": 99}), base)), 0
        )


class ReadBaselineTests(unittest.TestCase):
    """基线读取：口径只算 48G/坂道，畸形产物不抛异常且会说话。"""

    def _write(self, td, body):
        with open(os.path.join(td, "members.js"), "w", encoding="utf-8") as fh:
            fh.write("window.AKB_GROUPS = " + body + ";\n")

    def test_love_sections_go_to_their_own_bucket(self):
        # 这条测试原来叫 test_ignores_love_sections，断言「等爱分段被完全忽略」——
        # 那正是候选 3 的缺陷：基线里没有等爱，于是「团消失」「腰斩」对等爱恒假。
        # 现在等爱进 love_counts，总分判据仍只看 48G/坂道。
        with tempfile.TemporaryDirectory() as td:
            self._write(
                td,
                json.dumps(
                    [
                        {"group": "AKB48", "members": [{"n": 1}, {"n": 2}]},
                        {"group": "=LOVE", "members": [{"n": 1}]},
                        {"group": "≒JOY", "members": [{"n": 1}, {"n": 2}, {"n": 3}]},
                    ]
                ),
            )
            base = fetch_members.read_baseline(td)
            self.assertEqual(base["total"], 2)
            self.assertEqual(base["love_counts"], {"=LOVE": 1, "≒JOY": 3})
            # 「团消失」要看得见等爱，所以 groups 是并集；总分仍只算 48G/坂道
            self.assertEqual(base["groups"], {"AKB48", "=LOVE", "≒JOY"})

    def test_sums_multiple_sections_of_one_group(self):
        with tempfile.TemporaryDirectory() as td:
            self._write(
                td,
                json.dumps(
                    [
                        {"group": "AKB48", "members": [{"n": 1}]},
                        {"group": "AKB48", "members": [{"n": 1}, {"n": 2}]},
                    ]
                ),
            )
            self.assertEqual(fetch_members.read_baseline(td)["total"], 3)

    def test_malformed_product_returns_none_and_says_so(self):
        for name, body in [
            ("truncated", '[{"group": "AKB48", "members": ['),
            ("not_a_list", '{"group": "AKB48"}'),
            ("elements_are_strings", '["AKB48", "SKE48"]'),
            ("missing_members_key", '[{"group": "AKB48"}]'),
        ]:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as td:
                self._write(td, body)
                buf = io.StringIO()
                with redirect_stdout(buf):
                    base = fetch_members.read_baseline(td)
                self.assertIsNone(base, name)
                self.assertIn("不校验名册规模", buf.getvalue(), "基线读不出来必须出声，不能静默放行")

    def test_absent_file_returns_none(self):
        with tempfile.TemporaryDirectory() as td:
            buf = io.StringIO()
            with redirect_stdout(buf):
                self.assertIsNone(fetch_members.read_baseline(td))
            self.assertIn("不校验名册规模", buf.getvalue())

    def test_love_only_product_is_treated_as_no_baseline(self):
        # 解析成功但只有等爱分段 → 同样当「读不到」，否则 total:0 会让门静默失效
        with tempfile.TemporaryDirectory() as td:
            self._write(td, json.dumps([{"group": "=LOVE", "members": [{"n": 1}]}]))
            buf = io.StringIO()
            with redirect_stdout(buf):
                self.assertIsNone(fetch_members.read_baseline(td))
            self.assertIn("不校验名册规模", buf.getvalue())

    def test_members_not_a_list_is_rejected(self):
        # len("abc") == 3，否则会把三个字符当成三个人
        for body in ['[{"group": "AKB48", "members": "abc"}]', '[{"group": "AKB48", "members": {"a": 1}}]']:
            with self.subTest(body=body), tempfile.TemporaryDirectory() as td:
                self._write(td, body)
                buf = io.StringIO()
                with redirect_stdout(buf):
                    self.assertIsNone(fetch_members.read_baseline(td))
                self.assertIn("不校验名册规模", buf.getvalue())

class MainGateIntegrationTests(unittest.TestCase):
    def test_broken_source_aborts_without_touching_anything(self):
        png = io.BytesIO()
        Image.new("RGB", (60, 80), (10, 120, 30)).save(png, "PNG")
        png_bytes = png.getvalue()

        def fake_api(**params):
            titles = params["titles"].split("|")
            return {
                "query": {
                    "pages": {
                        str(i): {"title": t, "imageinfo": [{"url": f"https://x/{i}.png"}]}
                        for i, t in enumerate(titles)
                    }
                }
            }

        def good_pages(page):
            return SORTKEY_FIXTURE if page == "SDN48メンバー一覧" else "{|\n|}"

        with tempfile.TemporaryDirectory() as td:
            dirs = {
                "root": td,
                "orig": os.path.join(td, "orig"),
                "full": os.path.join(td, "full"),
                "thumb": os.path.join(td, "thumb"),
            }
            fetch_members.main(
                dirs=dirs,
                fetch_page=good_pages,
                api_fn=fake_api,
                fetch_url=lambda url: png_bytes,
                love_loader=lambda fetch: ([], {}),
            )
            before_js = open(os.path.join(td, "members.js"), encoding="utf-8").read()
            before_files = sorted(os.listdir(dirs["full"])), sorted(os.listdir(dirs["thumb"]))

            # 上游抽到错误页：名册会是空的
            def broken_pages(page):
                return "<html><body>503 Service Unavailable</body></html>"

            with self.assertRaises(SystemExit) as ctx:
                fetch_members.main(
                    dirs=dirs,
                    fetch_page=broken_pages,
                    api_fn=fake_api,
                    fetch_url=lambda url: png_bytes,
                    love_loader=lambda fetch: ([], {}),
                )
            self.assertIn("SDN48", str(ctx.exception))
            after_js = open(os.path.join(td, "members.js"), encoding="utf-8").read()
            after_files = sorted(os.listdir(dirs["full"])), sorted(os.listdir(dirs["thumb"]))
            self.assertEqual(before_js, after_js, "中止后 members.js 不得被改写")
            self.assertEqual(before_files, after_files, "中止后图片目录不得被动过（prune 会删库）")

    def test_accept_drop_flag_lets_a_real_drop_through(self):
        png = io.BytesIO()
        Image.new("RGB", (60, 80), (10, 120, 30)).save(png, "PNG")
        png_bytes = png.getvalue()

        def fake_api(**params):
            titles = params["titles"].split("|")
            return {
                "query": {
                    "pages": {
                        str(i): {"title": t, "imageinfo": [{"url": f"https://x/{i}.png"}]}
                        for i, t in enumerate(titles)
                    }
                }
            }

        def good_pages(page):
            return SORTKEY_FIXTURE if page == "SDN48メンバー一覧" else "{|\n|}"

        def fewer_members(page):
            # 砍掉 fixture 的一半（2 人 → 1 人 = -50%，低于 60% 下限）
            if page != "SDN48メンバー一覧":
                return "{|\n|}"
            half = SORTKEY_FIXTURE.index("|-\n", SORTKEY_FIXTURE.index("|-\n") + 1)
            return SORTKEY_FIXTURE[:half] + "|}\n"

        with tempfile.TemporaryDirectory() as td:
            dirs = {
                "root": td,
                "orig": os.path.join(td, "orig"),
                "full": os.path.join(td, "full"),
                "thumb": os.path.join(td, "thumb"),
            }
            kwargs = dict(
                dirs=dirs,
                api_fn=fake_api,
                fetch_url=lambda url: png_bytes,
                love_loader=lambda fetch: ([], {}),
            )
            fetch_members.main(fetch_page=good_pages, **kwargs)
            with self.assertRaises(SystemExit):
                fetch_members.main(argv=["--no-dl"], fetch_page=fewer_members, **kwargs)
            # 逃生阀放行，但差量要出现在 stderr 上（走 stdout 会混在正常流水里）
            err = io.StringIO()
            with redirect_stderr(err):
                fetch_members.main(
                    argv=["--no-dl", "--accept-drop"], fetch_page=fewer_members, **kwargs
                )
            # 总数判据命中（-50%）；逐团下限不命中（1 人 ≥ 基线 2 人的一半）✓
            self.assertIn("-50%", err.getvalue(), err.getvalue())
            self.assertIn("名册从 2 人掉到 1 人", err.getvalue(), err.getvalue())


class MainIntegrationTests(unittest.TestCase):
    def test_main_runs_offline_pipeline(self):
        png = io.BytesIO()
        Image.new("RGB", (60, 80), (10, 120, 30)).save(png, "PNG")
        png_bytes = png.getvalue()

        def fake_api(**params):
            titles = params["titles"].split("|")
            pages = {
                str(i): {"title": t, "imageinfo": [{"url": f"https://x/{i}.png"}]}
                for i, t in enumerate(titles)
            }
            return {"query": {"pages": pages}}

        def fake_pages(page):
            return SORTKEY_FIXTURE if page == "SDN48メンバー一覧" else "{|\n|}"

        def no_download(url):
            raise AssertionError("--no-dl 不应触发下载")

        with tempfile.TemporaryDirectory() as td:
            dirs = {
                "root": td,
                "orig": os.path.join(td, "orig"),
                "full": os.path.join(td, "full"),
                "thumb": os.path.join(td, "thumb"),
            }
            fetch_members.main(
                dirs=dirs,
                fetch_page=fake_pages,
                api_fn=fake_api,
                fetch_url=lambda url: png_bytes,
                love_loader=lambda fetch: ([], {}),
            )

            members_js = os.path.join(td, "members.js")
            self.assertTrue(os.path.exists(members_js))
            with open(members_js, encoding="utf-8") as fh:
                raw = fh.read()
            sections = json.loads(raw.split("window.AKB_GROUPS = ", 1)[1].rstrip(";\n"))
            self.assertEqual(len(sections), 2)
            self.assertTrue(all(s["group"] == "SDN48" for s in sections))
            self.assertEqual([s["label"] for s in sections], ["1期生", "3期生"])
            members = [m for s in sections for m in s["members"]]
            self.assertEqual(len(members), 2)
            self.assertTrue(all(m["img"] for m in members))
            self.assertEqual(len(os.listdir(dirs["full"])), 2)
            self.assertEqual(len(os.listdir(dirs["thumb"])), 2)

            fetch_members.main(
                argv=["--no-dl"],
                dirs=dirs,
                fetch_page=fake_pages,
                api_fn=fake_api,
                fetch_url=no_download,
                love_loader=lambda fetch: ([], {}),
            )
            with open(members_js, encoding="utf-8") as fh:
                self.assertEqual(fh.read(), raw)

    def test_love_failure_aborts_before_writing(self):
        """等爱抓取失败 → SystemExit 且不写入；错误文案不得建议会丢数据的做法。"""

        def failing_loader(fetch):
            raise RuntimeError("boom")

        with tempfile.TemporaryDirectory() as td:
            dirs = {
                "root": td,
                "orig": os.path.join(td, "orig"),
                "full": os.path.join(td, "full"),
                "thumb": os.path.join(td, "thumb"),
            }
            members_js = os.path.join(td, "members.js")
            with open(members_js, "w", encoding="utf-8") as fh:
                fh.write("// 旧产物\n")
            with self.assertRaises(SystemExit) as ctx:
                fetch_members.main(
                    dirs=dirs,
                    fetch_page=lambda page: "{|\n|}",
                    api_fn=lambda **params: {"query": {"pages": {}}},
                    fetch_url=lambda url: b"",
                    love_loader=failing_loader,
                )
            msg = str(ctx.exception)
            self.assertIn("等爱系列抓取失败", msg)
            self.assertNotIn("love_loader=None", msg)
            with open(members_js, encoding="utf-8") as fh:
                self.assertEqual(fh.read(), "// 旧产物\n")


class LoveIntegrationTests(unittest.TestCase):
    def test_love_members_flow_into_members_js(self):
        png = io.BytesIO()
        Image.new("RGB", (60, 80), (30, 60, 90)).save(png, "PNG")
        png_bytes = png.getvalue()

        def fake_api(**params):
            return {"query": {"pages": {}}}

        def fake_pages(page):
            return "{|\n|}"

        def love_stub(fetch):
            members = [{
                "name": "大谷 映美里",
                "kana": "おおたに えみり",
                "nick": "みりにゃ",
                "status": "current",
                "group": "=LOVE",
                "series": "love",
                "generation": "1期生",
                "bio": {"birth": "1998.03.15", "romaji": "OTANI EMIRI"},
                "file": "love:=LOVE:大谷 映美里",
            }]
            return members, {"love:=LOVE:大谷 映美里": "https://x/love.png"}

        with tempfile.TemporaryDirectory() as td:
            dirs = {
                "root": td,
                "orig": os.path.join(td, "orig"),
                "full": os.path.join(td, "full"),
                "thumb": os.path.join(td, "thumb"),
            }
            fetch_members.main(
                dirs=dirs,
                fetch_page=fake_pages,
                api_fn=fake_api,
                fetch_url=lambda url: png_bytes,
                love_loader=love_stub,
            )
            with open(os.path.join(td, "members.js"), encoding="utf-8") as fh:
                sections = json.loads(
                    fh.read().split("window.AKB_GROUPS = ", 1)[1].rstrip(";\n")
                )
            self.assertEqual(len(sections), 1)
            self.assertEqual(sections[0]["series"], "love")
            self.assertEqual(sections[0]["group"], "=LOVE")
            member = sections[0]["members"][0]
            self.assertEqual(member["name"], "大谷 映美里")
            self.assertTrue(member["img"])
            self.assertEqual(member["bio"]["romaji"], "OTANI EMIRI")


NOGIZAKA_FIXTURE = """== 現役メンバー ==
{|
|-
| {{!チーム|乃木坂}}
| [[ファイル:2026年乃木坂46プロフィール_愛宕心響 2.jpg|50px]]
| {{ルビ|[[愛宕心響]]|あたご ここね}}
| {{生年月日|2005|9|17}}
| {{出身地|兵庫県}}
| {{加入期|6期|乃木坂46}}
|}
== 元メンバー ==
{|
|-
| {{!チーム|乃木坂}}
| [[ファイル:2014年乃木坂46プロフィール_松井玲奈.jpg|50px]]
| {{ルビ|[[松井玲奈]]|まつい れな}}
| {{生年月日|1991|7|27}}
| {{出身地|愛知県}}
| {{加入期|1期|SKE48}}
| {{年月日|2015|5|14}}<br>（兼任解除）
|}
"""

SAKURAZAKA_FIXTURE = """== 元メンバー ==
{|
|-
| {{!チーム|欅坂}}
| [[ファイル:欅坂46 お披露目 鈴木泉帆.jpg|50px]]
| {{ルビ|[[鈴木泉帆]]|すずき みづほ}}
| {{生年月日|2000|10|7}}
| {{出身地|愛知県}}
| {{加入期|一期|櫻坂46}}
| data-sort-value="20150930" |（活動開始前辞退）
|-
| {{!チーム|欅坂}}
| [[ファイル:2018年欅坂46プロフィール 今泉佑唯_2.jpg|50px]]
| {{ルビ|[[今泉佑唯]]|いまいずみ ゆい}}
| {{生年月日|1998|9|30}}
| {{出身地|神奈川県}}
| {{加入期|一期|櫻坂46}}
| {{年月日|2018|11|4}}
|}
"""

HINATAZAKA_FIXTURE = """== 元メンバー ==
{|
|-
| {{!チーム|けやき坂|けやき坂<br>・欅坂}}
| [[ファイル:2017年けやき坂46プロフィール_長濱ねる.jpg|50px]]
| {{ルビ|[[長濱ねる]]|ながはま ねる}}
| {{生年月日|1998|9|4}}
| {{出身地|長崎県}}
| {{加入期|1.5期|欅坂46}}
| {{年月日|2017|9|25}}<br>（兼任解除）
|}
"""


class SakamichiTests(unittest.TestCase):
    def test_kanji_generations_normalize_to_keys(self):
        self.assertEqual(fetch_members.group_of("四期|櫻坂46", "櫻坂46"), (4.0, "四期生"))
        self.assertEqual(fetch_members.group_of("一期|日向坂46", "日向坂46"), (1.0, "一期生"))
        self.assertEqual(fetch_members.group_of("6期|乃木坂46", "乃木坂46"), (6.0, "6期生"))
        self.assertEqual(fetch_members.group_of("十一期|乃木坂46", "乃木坂46"), (11.0, "十一期生"))
        self.assertEqual(fetch_members.group_of("二十一期|乃木坂46", "乃木坂46"), (21.0, "二十一期生"))

    def test_historical_suffix_is_a_generation(self):
        self.assertEqual(fetch_members.group_of("1.5期|欅坂46", "日向坂46"), (1.5, "1.5期生"))

    def test_foreign_join_goes_to_transfer_bucket(self):
        self.assertEqual(fetch_members.group_of("1期|SKE48", "乃木坂46"), (130, "兼任・移籍加入"))
        self.assertEqual(fetch_members.note_of("1期|SKE48"), "SKE48 1期")

    def test_nogizaka_page_rows(self):
        rows = fetch_members.parse_page(NOGIZAKA_FIXTURE, "乃木坂46", "former")
        self.assertEqual(len(rows), 2)
        atago, matsui = rows
        self.assertEqual((atago["name"], atago["status"], atago["series"]), ("愛宕心響", "current", "sakamichi"))
        self.assertEqual(matsui["name"], "松井玲奈")
        self.assertEqual((matsui["status"], matsui["end"], matsui["leave"]), ("former", "2015.05.14", "兼任解除"))

    def test_sakurazaka_sortkey_date_and_plain_date(self):
        rows = fetch_members.parse_page(SAKURAZAKA_FIXTURE, "櫻坂46", "former")
        self.assertEqual(
            [(r["name"], r["end"], r["leave"]) for r in rows],
            [("鈴木泉帆", "2015.09.30", "活動開始前辞退"), ("今泉佑唯", "2018.11.04", None)],
        )

    def test_hinatazaka_15th_generation_section(self):
        rows = fetch_members.parse_page(HINATAZAKA_FIXTURE, "日向坂46", "former")
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["join"], "1.5期|欅坂46")
        self.assertEqual(rows[0]["end"], "2017.09.25")
        rows[0]["id"] = "n1"
        rows[0]["img"] = True
        sections = fetch_members.build_sections(rows)
        self.assertEqual(sections[0]["group"], "日向坂46")
        self.assertEqual(sections[0]["series"], "sakamichi")
        self.assertEqual(sections[0]["label"], "1.5期生")

    def test_build_simplified_folds_chars(self):
        mapping = {"宮": "宫", "邊": "边", "辺": "边"}
        pairs = fetch_members.build_simplified(["宮邊辺", "宮崎"], convert=lambda ch: mapping.get(ch, ch))
        self.assertEqual(pairs, {"宫": ["宮"], "边": ["邊", "辺"]})

    def test_write_simplified_js_round_trip(self):
        with tempfile.TemporaryDirectory() as td:
            path = os.path.join(td, "simplified.js")
            fetch_members.write_simplified_js({"宫": ["宮"]}, path)
            src = open(path, encoding="utf-8").read()
            payload = src.split("window.AKB_SIMPLIFIED = ", 1)[1].rstrip(";\n")
            self.assertEqual(json.loads(payload), {"宫": ["宮"]})


class CompressMembersTests(unittest.TestCase):
    """img 标志的真值来源：站内图片文件（不是远端 URL 是否解析成功）"""

    def _dirs(self, tmp):
        full = os.path.join(tmp, "full")
        thumb = os.path.join(tmp, "thumb")
        os.makedirs(full)
        os.makedirs(thumb)
        return full, thumb

    def _touch(self, path, data=b"x"):
        with open(path, "wb") as fh:
            fh.write(data)

    def test_existing_local_files_keep_img_true(self):
        with tempfile.TemporaryDirectory() as tmp:
            full, thumb = self._dirs(tmp)
            self._touch(os.path.join(full, "m1.webp"))
            self._touch(os.path.join(thumb, "m1.webp"))
            members = [{"id": "m1", "name": "既有头像"}, {"id": "m2", "name": "无图"}]
            with redirect_stdout(io.StringIO()):
                fetch_members.compress_members(members, {}, False, full, thumb)
            self.assertTrue(members[0]["img"], "本地已有图片时 img 不得降级为 false")
            self.assertFalse(members[1]["img"], "本地无图时 img 应为 false")

    def test_half_written_or_empty_output_reports_missing(self):
        """只写出一半、或是 0 字节残留时必须报缺图（宁可占位，也不渲染坏图）"""
        with tempfile.TemporaryDirectory() as tmp:
            full, thumb = self._dirs(tmp)
            self._touch(os.path.join(full, "m1.webp"))  # thumb 缺失
            self._touch(os.path.join(full, "m2.webp"))
            self._touch(os.path.join(thumb, "m2.webp"), b"")  # 0 字节残留
            members = [{"id": "m1", "name": "只有 full"}, {"id": "m2", "name": "空 thumb"}]
            with redirect_stdout(io.StringIO()):
                fetch_members.compress_members(members, {}, False, full, thumb)
            self.assertFalse(members[0]["img"], "缺 thumb 时 img 应为 false")
            self.assertFalse(members[1]["img"], "0 字节 thumb 时 img 应为 false")

    def test_resolved_url_without_output_still_reports_truthfully(self):
        """远端解析成功但压缩失败、仓库里也没有文件 → img 必须为 false"""
        with tempfile.TemporaryDirectory() as tmp:
            full, thumb = self._dirs(tmp)
            members = [{"id": "m1", "name": "压缩失败"}]

            def boom(mid, path, force=False, full_dir=None, thumb_dir=None):
                raise OSError("压缩失败")

            with redirect_stdout(io.StringIO()):
                with mock.patch("fetch_members.compress", boom):
                    fetch_members.compress_members(
                        members, {"m1": "orig.jpg"}, False, full, thumb
                    )
            self.assertFalse(members[0]["img"], "仓库里没有文件时 img 必须是 false")

    def test_usable_rejects_empty_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            empty = os.path.join(tmp, "x.webp")
            self._touch(empty, b"")
            good = os.path.join(tmp, "y.webp")
            self._touch(good)
            self.assertFalse(fetch_members.usable(empty))
            self.assertFalse(fetch_members.usable(os.path.join(tmp, "missing.webp")))
            self.assertTrue(fetch_members.usable(good))


if __name__ == "__main__":
    unittest.main()
