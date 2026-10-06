import unittest
from unittest import mock

import wiki


class FakeResponse:
    def __init__(self, data):
        self.data = data

    def read(self):
        return self.data

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class GetRetryTests(unittest.TestCase):
    def test_retries_then_succeeds(self):
        calls = {"n": 0}

        class Opener:
            def open(self, req, timeout=None):
                calls["n"] += 1
                if calls["n"] < 3:
                    raise OSError("boom")
                return FakeResponse(b"ok")

        with mock.patch("time.sleep", lambda _s: None):
            out = wiki.get("https://x", retries=4, opener=Opener())
        self.assertEqual(out, b"ok")
        self.assertEqual(calls["n"], 3)

    def test_raises_after_last_retry(self):
        class Opener:
            def open(self, req, timeout=None):
                raise OSError("always down")

        with mock.patch("time.sleep", lambda _s: None):
            with self.assertRaises(OSError):
                wiki.get("https://x", retries=3, opener=Opener())

    def test_first_try_success_does_not_sleep(self):
        slept = []

        class Opener:
            def open(self, req, timeout=None):
                return FakeResponse(b"data")

        with mock.patch("time.sleep", slept.append):
            out = wiki.get("https://x", opener=Opener())
        self.assertEqual(out, b"data")
        self.assertEqual(slept, [])


if __name__ == "__main__":
    unittest.main()


class GzipPayloadTests(unittest.TestCase):
    """Wayback 的 `id_` 重放偶尔回的是 WARC 里的 **gzip 载荷**（实测：2009 年的
    cute01_s.jpg 回 15335 字节、头 `1f 8b`）—— 不解的话会被当成「文件不是图」，
    而 `_orig` 缓存一存就永久卡住（下载只看文件在不在）。"""

    def test_gunzips_payload_with_gzip_magic(self):
        import gzip as gz

        class Opener:
            def open(self, req, timeout=None):
                return FakeResponse(gz.compress(b"\xff\xd8real jpeg bytes"))

        out = wiki.get("https://x", opener=Opener())
        self.assertEqual(out, b"\xff\xd8real jpeg bytes")

    def test_leaves_normal_payload_alone(self):
        class Opener:
            def open(self, req, timeout=None):
                return FakeResponse(b"\xff\xd8plain jpeg")

        out = wiki.get("https://x", opener=Opener())
        self.assertEqual(out, b"\xff\xd8plain jpeg")

    def test_broken_gzip_is_returned_raw(self):
        """头像 gzip 但内容坏了：原样返回（由调用方按「不是图」处理），不抛。"""

        class Opener:
            def open(self, req, timeout=None):
                return FakeResponse(b"\x1f\x8bnot really gzip")

        out = wiki.get("https://x", opener=Opener())
        self.assertEqual(out, b"\x1f\x8bnot really gzip")
