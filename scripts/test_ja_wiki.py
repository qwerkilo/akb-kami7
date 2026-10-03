"""ja_wiki 的取数测试：成功解析 + 两种失败策略（显式参数，不是两段代码的差异）。

网络经注入的 fetch 访问，全程离线。
"""
import unittest

import ja_wiki


class WikiWikitextTests(unittest.TestCase):
    def test_returns_the_star_field(self):
        asked = []

        def fetch(url):
            asked.append(url)
            return '{"parse": {"wikitext": {"*": "== 本文 =="}}}'

        got = ja_wiki.wiki_wikitext("モーニング娘。", fetch)
        self.assertEqual(got, "== 本文 ==")
        # URL 形状：action=parse + page + prop=wikitext
        self.assertTrue(asked[0].startswith(ja_wiki.WIKI_API + "?"), asked[0])
        self.assertIn("action=parse", asked[0])
        self.assertIn("prop=wikitext", asked[0])

    def test_raise_policy_is_the_default(self):
        def fetch(url):
            raise RuntimeError("boom")

        with self.assertRaises(RuntimeError):
            ja_wiki.wiki_wikitext("X", fetch)

    def test_empty_policy_swallows_failures(self):
        def boom(url):
            raise RuntimeError("boom")

        self.assertEqual(ja_wiki.wiki_wikitext("X", boom, on_error="empty"), "")
        # 畸形 JSON / 缺键也走同一条兜底（早安的第一版就是少取一层 dict）
        self.assertEqual(ja_wiki.wiki_wikitext("X", lambda u: "[]", on_error="empty"), "")
        self.assertEqual(
            ja_wiki.wiki_wikitext("X", lambda u: '{"parse": {}}', on_error="empty"), ""
        )
