import io
import json
import os
import tempfile
import unittest
from unittest import mock
import contextlib
from contextlib import redirect_stderr, redirect_stdout

from PIL import Image

import fetch_pool

# 测试的 fetch 是瞬时假对象：关掉真实源站的请求间隔（否则每个用例白等几十秒）
fetch_pool.INTERVAL_SCALE = 0.0
import check_roster
import fetch_members
import love_members
import morningmusume_members


class WiringTests(unittest.TestCase):
    """接线的 bug 只表现为「跑了但没跳过」—— 所以「跳过接进了哪个 loader」
    与「--refresh-photos 关掉什么」都要能单独测。"""

    def test_photo_skip_for_refresh_is_none(self):
        with tempfile.TemporaryDirectory() as td:
            self.assertIsNone(
                fetch_members.photo_skip_for(True, td, os.path.join(td, "full"), os.path.join(td, "thumb"))
            )

    def test_photo_skip_for_default_reads_prev_members(self):
        with tempfile.TemporaryDirectory() as td:
            full, thumb = os.path.join(td, "full"), os.path.join(td, "thumb")
            os.makedirs(full)
            os.makedirs(thumb)
            for d in (full, thumb):
                with open(os.path.join(d, "m1.webp"), "wb") as fh:
                    fh.write(b"x")
            with open(os.path.join(td, "members.js"), "w", encoding="utf-8") as fh:
                fh.write(
                    "window.AKB_GROUPS = "
                    + json.dumps(
                        [{"group": "AKB48", "members": [{"id": "m1", "name": "A", "img": True}]}]
                    )
                    + ";\n"
                )
            skip = fetch_members.photo_skip_for(False, td, full, thumb)
            self.assertIn(("AKB48", "A"), skip)
            self.assertNotIn(("AKB48", "B"), skip)

    def test_skip_photo_and_cache_reach_the_right_loaders(self):
        sentinel = lambda m: True
        notes_sentinel = {"f1": "源里没有"}
        seen = {}

        def fake_love(fetch, **kw):
            seen["love"] = kw
            return [], {}

        def fake_morning(fetch, **kw):
            seen["morning"] = kw
            return [], {}

        with mock.patch.object(love_members, "load", fake_love), mock.patch.object(
            morningmusume_members, "load", fake_morning
        ):
            love_loader, morning_loader = fetch_members.default_loaders(
                sentinel, use_cache=False, notes=notes_sentinel
            )
            love_loader(lambda url: "")
            morning_loader(lambda url: "")
        self.assertIs(seen["love"]["skip_photo"], sentinel)
        self.assertIs(seen["morning"]["skip_photo"], sentinel)
        self.assertFalse(seen["morning"]["use_cache"])
        # 同一份 notes 必须进两个 loader（工单 01 的接线；等爱复用 morning 的链）
        self.assertIs(seen["love"]["notes"], notes_sentinel)
        self.assertIs(seen["morning"]["notes"], notes_sentinel)

    def test_notes_reach_the_morning_loader_and_the_report(self):
        """工单 01 的接线：同一份 `notes` 既进 morning loader、又进报告 ——
        漏一处的症状是「原因在报告里永远是未记录」（本仓的接线 bug 类）。"""
        seen = {}

        def fake_load(fetch, **kw):
            seen.update(kw)
            kw["notes"]["f1"] = "源里没有"
            return [], {}

        captured = {}

        def fake_warn(members, failures=None, notes=None):
            captured["notes"] = notes

        with mock.patch.object(morningmusume_members, "load", fake_load), mock.patch.object(
            fetch_members, "warn_missing_images", fake_warn
        ), mock.patch.object(fetch_members, "default_loaders") as dl:
            def make_loaders(skip_photo, use_cache, notes=None):
                captured["dl_notes"] = notes
                return (lambda fetch: ([], {}), lambda fetch: fake_load(fetch, notes=notes))

            dl.side_effect = make_loaders
            with tempfile.TemporaryDirectory() as td:
                dirs = {k: os.path.join(td, k) for k in ("root", "orig", "full", "thumb")}
                for d in dirs.values():
                    os.makedirs(d)
                fetch_members.main(
                    argv=[],
                    dirs=dirs,
                    fetch_page=lambda *a, **k: "",
                    api_fn=lambda *a, **k: {},
                    fetch_url=lambda url: b"",
                )
        self.assertIs(captured["dl_notes"], captured["notes"])
        self.assertEqual(captured["notes"].get("f1"), "源里没有")


class LoadSeriesWiringTests(unittest.TestCase):
    """`_load_series` 的接线（第五轮扫描候选 6）。

    修复前 `decode_page` 只有纯函数测试、接线（本类）零覆盖 —— 回归（改回
    `.decode("utf-8","replace")`）全仓不会红。事故依据见 `decode_page` 的 docstring。
    """

    def test_pages_reach_the_loader_decoded(self):
        raw = (
            '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=Shift_JIS">'
            '<img SRC="x.jpg" ALT="吉澤ひとみ">'
        ).encode("cp932")
        seen = {}

        def loader(fetch):
            seen["text"] = fetch("http://example.invalid/artist/01/04/index.html")
            return [], {}

        members, urls = fetch_members._load_series("旧站", loader, lambda u: raw)
        self.assertIn("吉澤ひとみ", seen["text"], "loader 拿到的必须是解码后的文本")
        self.assertEqual((members, urls), ([], {}))

    def test_failure_aborts_without_writing(self):
        def loader(fetch):
            raise RuntimeError("boom")

        with self.assertRaises(SystemExit) as cm:
            fetch_members._load_series("等爱", loader, lambda u: b"")
        self.assertIn("等爱", str(cm.exception))
        self.assertIn("不写入", str(cm.exception))


class ParseArgsTests(unittest.TestCase):
    """`--refresh-photos` 是全量刷新开关（ADR-0023）：忽略「已有照片」的跳过与解析缓存。
    它与 `--force` 职责分明 —— `--force` 只管重下载与重压缩。"""

    def test_defaults_are_all_off(self):
        no_dl, force, accept_drop, refresh = fetch_members.parse_args([])
        self.assertEqual([no_dl, force, accept_drop, refresh], [False] * 4)

    def test_refresh_photos_flag(self):
        self.assertTrue(fetch_members.parse_args(["--refresh-photos"])[3])

    def test_flags_compose(self):
        no_dl, force, accept_drop, refresh = fetch_members.parse_args(
            ["--no-dl", "--force", "--refresh-photos"]
        )
        self.assertEqual([no_dl, force, accept_drop, refresh], [True, True, False, True])


class WarnSkippedWithoutFilesTests(unittest.TestCase):
    """`_warn_skipped_without_files` 此前零测试（grep 命中 0）—— 它是「跳过名单」的
    最后一个消费者：跳过的人在新 id 下没有文件时要出声（同名新人换 id 的场景）。"""

    def _dirs(self, td):
        full, thumb = os.path.join(td, "full"), os.path.join(td, "thumb")
        os.makedirs(full)
        os.makedirs(thumb)
        return full, thumb

    def _touch(self, d, name):
        with open(os.path.join(d, name), "wb") as fh:
            fh.write(b"x")

    def test_skipped_member_without_files_warns(self):
        with tempfile.TemporaryDirectory() as td:
            full, thumb = self._dirs(td)
            dirs = {"full": full, "thumb": thumb}
            err = io.StringIO()
            with contextlib.redirect_stderr(err):
                fetch_members._warn_skipped_without_files(
                    [{"group": "AKB48", "name": "A", "id": "m9"}],
                    {("AKB48", "A")},
                    dirs,
                )
            self.assertIn("跳过了 A", err.getvalue())

    def test_skipped_member_with_files_is_silent(self):
        with tempfile.TemporaryDirectory() as td:
            full, thumb = self._dirs(td)
            self._touch(full, "m9.webp")
            self._touch(thumb, "m9.webp")
            err = io.StringIO()
            with contextlib.redirect_stderr(err):
                fetch_members._warn_skipped_without_files(
                    [{"group": "AKB48", "name": "A", "id": "m9"}],
                    {("AKB48", "A")},
                    {"full": full, "thumb": thumb},
                )
            self.assertEqual(err.getvalue(), "")

    def test_member_not_in_skip_list_is_silent(self):
        with tempfile.TemporaryDirectory() as td:
            full, thumb = self._dirs(td)
            err = io.StringIO()
            with contextlib.redirect_stderr(err):
                fetch_members._warn_skipped_without_files(
                    [{"group": "AKB48", "name": "A", "id": "m9"}],
                    {("AKB48", "B")},
                    {"full": full, "thumb": thumb},
                )
            self.assertEqual(err.getvalue(), "")


class PhotoSkipPredicateTests(unittest.TestCase):
    """增量跑：已有站内照片的成员跳过照片解析（ADR-0023）。判据是**站内文件**
    （full + thumb 都在且非空），不是解析缓存 —— 缓存只覆盖早安，且会与文件脱节
    （有 URL 但下载失败的人会被缓存挡住、永远卡在没图）。"""

    @staticmethod
    def _touch(d, name, size=10):
        p = os.path.join(d, name)
        with open(p, "wb") as fh:
            fh.write(b"x" * size)
        return p

    def _dirs(self, td):
        full, thumb = os.path.join(td, "full"), os.path.join(td, "thumb")
        os.makedirs(full, exist_ok=True)
        os.makedirs(thumb, exist_ok=True)
        return full, thumb

    def test_skips_only_the_member_with_both_files(self):
        with tempfile.TemporaryDirectory() as td:
            full, thumb = self._dirs(td)
            self._touch(full, "m1.webp")
            self._touch(thumb, "m1.webp")
            prev = [{"group": "AKB48", "name": "A", "id": "m1", "img": True}]
            skip = fetch_members.photo_skip_keys(prev, full, thumb)
            self.assertIn(("AKB48", "A"), skip)
            self.assertNotIn(("AKB48", "B"), skip)
            self.assertNotIn(("NMB48", "A"), skip)

    def test_thumb_missing_or_empty_does_not_skip(self):
        """名册卡片读 thumb、海报读 full：只写出一半或 0 字节时宁可重解析。"""
        with tempfile.TemporaryDirectory() as td:
            full, thumb = self._dirs(td)
            self._touch(full, "m1.webp")
            skip = fetch_members.photo_skip_keys(
                [{"group": "AKB48", "name": "A", "id": "m1", "img": True}], full, thumb
            )
            self.assertNotIn(("AKB48", "A"), skip)
            self._touch(thumb, "m1.webp", size=0)  # 0 字节 = 损坏
            self.assertNotIn(("AKB48", "A"), skip)

    def test_img_false_does_not_skip(self):
        """img 是站内文件的派生值；img=false 说明文件不齐 —— 不该跳过。"""
        with tempfile.TemporaryDirectory() as td:
            full, thumb = self._dirs(td)
            self._touch(full, "m1.webp")
            self._touch(thumb, "m1.webp")
            skip = fetch_members.photo_skip_keys(
                [{"group": "AKB48", "name": "A", "id": "m1", "img": False}], full, thumb
            )
            self.assertNotIn(("AKB48", "A"), skip)

    def test_duplicate_name_in_same_group_is_not_skipped(self):
        """同名不同人（id 带 #join 后缀）→ 从名字判不出 id，保守不跳过。"""
        with tempfile.TemporaryDirectory() as td:
            full, thumb = self._dirs(td)
            self._touch(full, "m1.webp")
            self._touch(thumb, "m1.webp")
            prev = [
                {"group": "AKB48", "name": "A", "id": "m1", "img": True},
                {"group": "AKB48", "name": "A", "id": "m2", "img": True},
            ]
            skip = fetch_members.photo_skip_keys(prev, full, thumb)
            self.assertNotIn(("AKB48", "A"), skip)


class DecodePageTests(unittest.TestCase):
    """旧官网 2005 前后的页是 Shift_JIS：按 UTF-8 解会把 ALT 姓名变乱码，
    照片配对全灭（早期モー娘。25 人一个都配不到的真根因）。"""

    def test_shift_jis_alt_decodes(self):
        raw = '<img ALT="吉澤ひとみ">'.encode("cp932")
        got = fetch_members.decode_page(raw)
        self.assertIn("吉澤ひとみ", got)

    def test_utf8_page_stays_utf8(self):
        raw = '<meta charset="utf-8"><img ALT="中澤裕子">'.encode("utf-8")
        self.assertIn("中澤裕子", fetch_members.decode_page(raw))

    def test_unknown_bytes_fall_back_without_raising(self):
        self.assertIsInstance(fetch_members.decode_page(b"\xff\xfe\x00broken"), str)


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
                morning_loader=lambda fetch: ([], {}),
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
                    morning_loader=lambda fetch: ([], {}),
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
                morning_loader=lambda fetch: ([], {}),
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
                morning_loader=lambda fetch: ([], {}),
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
                morning_loader=lambda fetch: ([], {}),
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
                    morning_loader=lambda fetch: ([], {}),
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
                morning_loader=lambda fetch: ([], {}),
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

    def test_tiny_source_image_is_treated_as_missing(self):
        """1×1 占位图不是头像：删掉已生成的输出、img=False。

        这条同时钉住「不许漏赋值」——当初的实现用 `continue` 跳过 `img` 赋值，
        一条跑完 90 分钟的管线在最后一步 `KeyError: 'img'` 崩掉、整轮白跑。
        没有这条测试时，1×1 分支是零覆盖的。
        """
        with tempfile.TemporaryDirectory() as tmp:
            full, thumb = self._dirs(tmp)
            orig = os.path.join(tmp, "tiny.png")
            Image.new("RGB", (1, 1), (255, 0, 255)).save(orig)
            members = [{"id": "m1", "name": "占位图"}]
            with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                fetch_members.compress_members(
                    members, {"m1": orig}, False, full, thumb
                )
            self.assertFalse(members[0]["img"], "1×1 源图必须按缺图处理")
            self.assertFalse(os.path.exists(os.path.join(full, "m1.webp")))
            self.assertFalse(os.path.exists(os.path.join(thumb, "m1.webp")))



class CheckRosterSmokeTests(unittest.TestCase):
    """维护脚本 check_roster 此前零测试（质检复检 CRAP 按 0% 计）——只钉比对逻辑本身。"""

    def test_gap_line_lists_missing_and_extra(self):
        self.assertEqual(check_roster._gap_line([], []), "")
        self.assertEqual(check_roster._gap_line(["a"], []), "；缺: a")
        self.assertEqual(check_roster._gap_line([], ["b"]), "；多: b")
        self.assertEqual(check_roster._gap_line(["a"], ["b"]), "；缺: a；多: b")

    def test_check_group_detects_gaps_and_match(self):
        cfg = {"page": "X"}
        parsed = [{"name": "a"}, {"name": "b"}]
        with mock.patch.object(
            check_roster.mm.ja_wiki, "wiki_wikitext", return_value=""
        ), mock.patch.object(
            check_roster.mm, "parse_wiki_members", return_value=parsed
        ):
            self.assertFalse(
                check_roster.check_group("G", cfg, {"G": {"a"}}, lambda u: ""),
                "视图缺 b，必须报缺口",
            )
            self.assertTrue(
                check_roster.check_group("G", cfg, {"G": {"a", "b"}}, lambda u: ""),
                "完全一致时返回 True",
            )

    def test_check_group_upstream_failure_is_not_a_gap(self):
        with mock.patch.object(
            check_roster.mm.ja_wiki, "wiki_wikitext", side_effect=RuntimeError("429")
        ):
            self.assertIsNone(
                check_roster.check_group("G", {"page": "X"}, {"G": {"a"}}, None),
                "上游失败要报 None（与「缺人」分开），否则网络问题会被当成名册缺口",
            )



class MorningSeriesPipelineTests(unittest.TestCase):
    """早安是**第三个系列槽**。契约与等爱一致：loader 返回 (members, urls)，
    失败就 SystemExit 整体中止 —— 绝不「一个系列失败就只写另两个」。"""

    # 既有测试里的 fake_api / png_bytes / EMPTY_PAGE 都是各方法内的局部变量，
    # 这里自备一份，免得依赖别的测试的实现细节。
    EMPTY_PAGE = "<html><body></body></html>"

    def fake_api(self, **params):
        return {}

    def png_bytes(self, url):
        from PIL import Image
        import io

        buf = io.BytesIO()
        Image.new("RGB", (60, 80), (200, 180, 160)).save(buf, "PNG")
        return buf.getvalue()

    def _dirs(self, td):
        dirs = fetch_members.default_dirs()
        for key in ("root", "orig", "full", "thumb"):
            dirs[key] = os.path.join(td, key)
            os.makedirs(dirs[key], exist_ok=True)
        return dirs

    def _morning_stub(self, fetch):
        return (
            [
                {
                    "name": "野中美希",
                    "kana": "のなか みき",
                    "nick": "ちぇる",
                    "nick_aliases": ["のなちゃん"],
                    "status": "current",
                    "group": "モーニング娘。",
                    "series": "morning",
                    "generation": "12期生",
                    "file": "morningmusume:モーニング娘。:野中美希",
                    "img": False,
                },
                {
                    "name": "福田明日香",
                    "kana": "ふくだ あすか",
                    "nick": "明日香",
                    "nick_aliases": [],
                    "status": "former",
                    "group": "モーニング娘。",
                    "series": "morning",
                    "generation": "1期生",
                    "end": "1999.04.18",
                    "file": "morningmusume:モーニング娘。:福田明日香",
                    "img": False,
                },
            ],
            {"morningmusume:モーニング娘。:野中美希": "https://x/a.webp"},
        )

    def test_third_slot_writes_a_section(self):
        with tempfile.TemporaryDirectory() as td:
            dirs = self._dirs(td)
            fetch_members.main(
                dirs=dirs,
                fetch_page=lambda page: self.EMPTY_PAGE,
                api_fn=self.fake_api,
                fetch_url=lambda url: self.png_bytes(url),
                love_loader=lambda fetch: ([], {}),
                morning_loader=self._morning_stub,
            )
            raw = open(os.path.join(dirs["root"], "members.js"), encoding="utf-8").read()
            secs = json.loads(raw.split("window.AKB_GROUPS = ", 1)[1].rstrip(";\n"))
            series = {s["series"] for s in secs}
            self.assertIn("morning", series, "早安那一段没写进 members.js")
            mm = [s for s in secs if s["series"] == "morning"]
            self.assertEqual(len(mm), 1, "早安是一系列一团")
            self.assertEqual(mm[0]["group"], "モーニング娘。")
            self.assertEqual({m["name"] for m in mm[0]["members"]}, {"野中美希", "福田明日香"})

    def test_ids_span_all_three_series_without_colliding(self):
        with tempfile.TemporaryDirectory() as td:
            dirs = self._dirs(td)
            fetch_members.main(
                dirs=dirs,
                fetch_page=lambda page: self.EMPTY_PAGE,
                api_fn=self.fake_api,
                fetch_url=lambda url: self.png_bytes(url),
                love_loader=lambda fetch: (
                    [
                        {
                            "name": "藤吉夏鈴",
                            "kana": "ふじよし かりる",
                            "nick": "かりる",
                            "status": "current",
                            "group": "=LOVE",
                            "series": "love",
                            "generation": "1期生",
                            "file": "love:=LOVE:藤吉夏鈴",
                            "img": False,
                        }
                    ],
                    {},
                ),
                morning_loader=self._morning_stub,
            )
            raw = open(os.path.join(dirs["root"], "members.js"), encoding="utf-8").read()
            secs = json.loads(raw.split("window.AKB_GROUPS = ", 1)[1].rstrip(";\n"))
            ids = [m["id"] for s in secs for m in s["members"]]
            self.assertEqual(len(ids), len(set(ids)), "id 撞车了")
            by_name = {m["name"]: m["id"] for s in secs for m in s["members"]}
            self.assertTrue(by_name["野中美希"].startswith("m"), by_name["野中美希"])

    def test_morning_failure_aborts_instead_of_silently_dropping_the_series(self):
        def failing(fetch):
            raise OSError("helloproject 502")

        with tempfile.TemporaryDirectory() as td:
            dirs = self._dirs(td)
            with self.assertRaises(SystemExit) as ctx:
                fetch_members.main(
                    dirs=dirs,
                    fetch_page=lambda page: self.EMPTY_PAGE,
                    api_fn=self.fake_api,
                    fetch_url=lambda url: self.png_bytes(url),
                    love_loader=lambda fetch: ([], {}),
                    morning_loader=failing,
                )
            msg = str(ctx.exception)
            self.assertIn("早安", msg)
            self.assertNotIn("晨", msg.split("抓取失败")[0][-1:])

    def test_main_signature_exposes_the_third_slot(self):
        import inspect

        self.assertIn("morning_loader", inspect.signature(fetch_members.main).parameters)

    def test_morning_module_is_importable_and_exposes_the_contract(self):
        import morningmusume_members as mmm

        for fn in ("load", "build_sections", "build_members", "parse_list", "parse_detail"):
            self.assertTrue(hasattr(mmm, fn), fn)


class GateSeesEverySeriesTests(unittest.TestCase):
    """源的规模门必须在**三个 loader 都跑完之后**才算人数。

    这是一条真实抓取才发现的缺陷：门原本紧跟在 48G/坂道 之后，而基线的
    `groups` 里含等爱三团 —— 那时它们还没被加载，于是每次都算「一个成员都没解析到」
    并中止。等爱上线后**没人真跑过一次完整抓取**，所以一直没暴露。
    """

    BASELINE = {
        "counts": {"AKB48": 400},
        "love_counts": {"=LOVE": 12},
        "groups": {"AKB48", "=LOVE"},
        "total": 400,
    }

    def test_groups_from_a_later_series_are_not_called_disappeared(self):
        members = [{"name": "a", "group": "AKB48"}] * 400
        members += [{"name": "b", "group": "=LOVE", "status": "current"}] * 12
        self.assertEqual(fetch_members.roster_problems(members, self.BASELINE), [])

    def test_a_later_series_that_really_is_empty_is_still_caught(self):
        """门挪位之后，早安/等爱抓到 0 人这一条判据不能失效。"""
        members = [{"name": "a", "group": "AKB48"}] * 400
        problems = fetch_members.roster_problems(members, self.BASELINE)
        self.assertTrue(problems, "等爱被换成 0 人，门必须响")
        self.assertTrue(any("=LOVE" in p for p in problems))

    def test_main_runs_the_gate_after_all_three_loaders(self):
        """把顺序钉住：门在 main() 里必须排在三个 loader 之后。

        门体在 2026-10-04 拆进 `_roster_gate`（main 的 CCN 11→≤10），所以这里钉
        **调用点**的顺序，并另外确认 `_roster_gate` 里真的在做规模判定。"""
        import inspect

        src = inspect.getsource(fetch_members.main)
        gate = src.index("_roster_gate(")
        self.assertLess(src.index("all_members = members + love + morning"), gate)
        self.assertIn("roster_problems(", inspect.getsource(fetch_members._roster_gate))


# ── 工单 03：一个系列接第二个团时，规模门与基线怎么算 ────────────────────
class NewSeriesBaselineTests(unittest.TestCase):
    """新系列接进来时基线**天然不含**它 —— 「不在 GROUP_ORDER 里」那一支
    （等爱那轮做的泛化）让新团自动跳过规模门。这是个**要钉住的性质**：
    万一哪天基线生成把新系列写进去了，而 counts 里还没有它，
    门会在**抓取之前**就中止（那是个真实事故：等爱三团因为这个永远算「消失」）。"""

    def _baseline_dir(self, sections):
        """read_baseline 收的是**目录**（不是 baseline/ 子目录 —— 我在这栽过一次）。
        它读的是盘上的 members.js，所以夹具要造一个真 members.js。"""
        d = tempfile.mkdtemp()
        raw = "window.AKB_GROUPS = " + json.dumps(sections, ensure_ascii=False) + ";"
        with open(os.path.join(d, "members.js"), "w", encoding="utf-8") as fh:
            fh.write(raw)
        return d

    @staticmethod
    def _sec(group, series, n):
        return {"group": group, "series": series,
                "members": [{"name": f"人{i}", "file": f"{series}_{group}_{i}"} for i in range(n)]}

    def test_group_outside_group_order_goes_to_the_secondary_count_not_the_scale_one(self):
        """GROUP_ORDER 只是 48G/坂道的**抓取清单**；等爱与早安的团走另一本账 ——
        不分开的话「团消失」判据对它们恒假（等爱抓到 0 人却 exit 0 的那起事故）。"""
        import fetch_members as fm
        d = self._baseline_dir([
            self._sec("AKB48", "48g", 300),
            self._sec("℃-ute", "morning", 8),
        ])
        base = fm.read_baseline(d)
        self.assertEqual(base["counts"], {"AKB48": 300})
        self.assertNotIn("℃-ute", base["counts"])
        self.assertIn("℃-ute", base["love_counts"], "℃-ute 必须在副账里")
        self.assertEqual(base["love_counts"]["℃-ute"], 8)

    def test_a_new_group_is_absent_from_the_baseline_before_the_first_fetch(self):
        """新系列接进来时基线**天然不含**它 —— 所以第一次抓它不受规模门约束。
        这条是本工单要钉的性质：门对「基线里没有的团」必须放行，
        否则新系列永远抓不进来。"""
        import fetch_members as fm
        d = self._baseline_dir([self._sec("AKB48", "48g", 300)])
        base = fm.read_baseline(d)
        self.assertNotIn("℃-ute", base["counts"])
        self.assertNotIn("℃-ute", base.get("love_counts", {}))

    def test_missing_members_js_yields_none_so_nothing_is_gated(self):
        """读不到就返回 None（首次生成）——门必须整条跳过而不是对着空账报腰斩。"""
        import fetch_members as fm
        self.assertIsNone(fm.read_baseline(tempfile.mkdtemp()))

    def test_morning_series_grew_without_tripping_the_gate(self):
        """产物里的早安系列**恰好十一团**（伞下九团批，2026-10-02）。

        这条原来断言「恰好两段」（℃-ute 批），现在扩到 11 —— 它守的是
        「新团进产物时源门不该把它们当异常」，顺序也要与 GROUPS 配置一致。
        """
        secs = json.loads(
            open(os.path.join(os.path.dirname(__file__), "..", "members.js"),
                 encoding="utf-8").read().split("window.AKB_GROUPS = ", 1)[1].rstrip(";\n")
        )
        morning = [s for s in secs if s["series"] == "morning"]
        self.assertEqual(
            [s["group"] for s in morning],
            [
                "モーニング娘。",
                "℃-ute",
                "アンジュルム",
                "Juice=Juice",
                "つばきファクトリー",
                "BEYOOOOONDS",
                "OCHA NORMA",
                "ロージークロニクル",
                "Berryz工房",
                "カントリー・ガールズ",
                "こぶしファクトリー",
            ],
        )
        self.assertEqual(len(morning[1]["members"]), 8, "℃-ute 仍是 8 人")


if __name__ == "__main__":
    unittest.main()


class PhotoFailureReasonTests(unittest.TestCase):
    """工单 10：下载/压缩失败也要进「为什么没有照片」的汇总 —— 否则读汇总的人会以为
    缺图全是「源里没有」（实测：7 人里 2 人是解析到了但取不下来，只在日志里逐人可见）。"""

    def test_download_failure_is_recorded(self):
        failures = {}

        def boom(url):
            raise RuntimeError("404")

        with mock.patch.object(fetch_members.time, "sleep"):
            paths = fetch_members.download_all(
                [("m1", "http://x/a.jpg")], fetch=boom, workers=1, failures=failures
            )
        self.assertEqual(paths, {})
        self.assertEqual(failures.get("m1"), "下载失败")

    def test_compress_failure_is_recorded(self):
        with tempfile.TemporaryDirectory() as d:
            orig, full, thumb = (os.path.join(d, x) for x in ("orig", "full", "thumb"))
            for x in (orig, full, thumb):
                os.makedirs(x)
            bad = os.path.join(orig, "m1.jpg")
            io.open(bad, "wb").write(b"<html>not an image</html>")
            members = [{"id": "m1", "name": "梅田えりか", "img": False}]
            failures = {}
            fetch_members.compress_members(
                members, {"m1": bad}, False, full, thumb, failures
            )
            # 带异常类型（UnidentifiedImageError）—— 实现给了更多信息，断言前缀即可
            self.assertTrue(failures.get("m1", "").startswith("文件不是图"))
            self.assertFalse(members[0]["img"])

    def test_missing_summary_names_the_failures(self):
        members = [
            {"id": "m1", "name": "有原栞菜", "file": "f1", "img": False},
            {"id": "m2", "name": "福田明日香", "file": "f2", "img": False},
        ]
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            fetch_members.warn_missing_images(members, {"m1": "下载失败"})
        out = buf.getvalue()
        self.assertIn("有原栞菜", out)
        self.assertIn("下载失败", out)


class MissingUnionTests(unittest.TestCase):
    """工单 10 判据 3 的端到端面（工单 01 后：一份报告）：
    报告覆盖 == 缺图名单 —— 失败过但最终有图的人不列，且不重不漏。"""

    def test_report_covers_exactly_the_missing_list(self):
        """工单 01 后：一份报告 —— 覆盖集合 == 缺图名单（失败过但最终有图的不列）。"""
        members = [
            {"id": "m1", "name": "有原栞菜", "file": "f1", "img": False},  # 取不下来
            {"id": "m2", "name": "福田明日香", "file": "f2", "img": False},  # 未解析到
            {"id": "m3", "name": "梅田えりか", "file": "f3", "img": True},  # 失败过但最终有图
        ]
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            fetch_members.warn_missing_images(
                members, {"m1": "下载失败", "m3": "下载失败"}
            )
        out = buf.getvalue()
        self.assertIn("2 位成员没有照片", out)
        self.assertIn("没有照片 2 人（原因）：", out)
        self.assertIn("有原栞菜：下载失败", out)
        self.assertIn("福田明日香：未记录", out)
        self.assertNotIn("梅田えりか", out)


class SinglePhotoReportTests(unittest.TestCase):
    """工单 01（ADR-0024）：报告只一份 —— 解析阶段的原因（notes，按 file）与
    下载/压缩阶段的失败（failures，按 id）在报告处合并；覆盖集合 == 缺图名单，
    每人恰好一行（不再分「未解析到」与「取不下来」两段）。"""

    def test_single_report_merges_notes_and_failures(self):
        members = [
            {"id": "m1", "name": "有原栞菜", "file": "f1", "img": False},  # 取不下来
            {"id": "m2", "name": "福田明日香", "file": "f2", "img": False},  # 源里没有
            {"id": "m3", "name": "梅田えりか", "file": "f3", "img": False},  # 未记录
            {"id": "m4", "name": "野中美希", "file": "f4", "img": True},  # 有图，不列
        ]
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            fetch_members.warn_missing_images(
                members, {"m1": "下载失败"}, {"f2": "源里没有"}
            )
        out = buf.getvalue()
        self.assertIn("没有照片 3 人（原因）：", out)
        self.assertIn("有原栞菜：下载失败", out)
        self.assertIn("福田明日香：源里没有", out)
        self.assertIn("梅田えりか：未记录", out)
        report = out.split("没有照片 3 人（原因）：")[1]
        lines = [x for x in report.splitlines() if x.strip()]
        self.assertEqual(len(lines), 3, "每人恰好一行：\n" + report)
        self.assertNotIn("野中美希", report)
        # 单一报告：不再有两段的标题
        self.assertNotIn("照片解析到了但取不下来", out)
        self.assertNotIn("照片未解析到", out)

    def test_notes_win_over_failures_for_the_same_member(self):
        """同一人两张表都有（理论上不该发生）：notes 优先（解析阶段在前）。"""
        members = [{"id": "m1", "name": "X", "file": "f1", "img": False}]
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            fetch_members.warn_missing_images(
                members, {"m1": "下载失败"}, {"f1": "源里没有"}
            )
        self.assertIn("X：源里没有", buf.getvalue())
