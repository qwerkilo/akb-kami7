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
