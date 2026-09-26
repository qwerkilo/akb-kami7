import io
import json
import os
import tempfile
import unittest
from contextlib import ExitStack, redirect_stdout
from unittest.mock import patch

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

        with tempfile.TemporaryDirectory() as td, ExitStack() as stack:
            dirs = {k: os.path.join(td, k) for k in ("orig", "full", "thumb")}
            stack.enter_context(patch.object(fetch_members, "ROOT", td))
            stack.enter_context(patch.object(fetch_members, "ORIG", dirs["orig"]))
            stack.enter_context(patch.object(fetch_members, "FULL", dirs["full"]))
            stack.enter_context(patch.object(fetch_members, "THUMB", dirs["thumb"]))

            fetch_members.main(
                fetch_page=fake_pages, api_fn=fake_api, fetch_url=lambda url: png_bytes
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
                fetch_page=fake_pages,
                api_fn=fake_api,
                fetch_url=no_download,
            )
            with open(members_js, encoding="utf-8") as fh:
                self.assertEqual(fh.read(), raw)


if __name__ == "__main__":
    unittest.main()
