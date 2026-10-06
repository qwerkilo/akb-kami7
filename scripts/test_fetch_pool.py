import threading
import time
import unittest
from unittest import mock

import fetch_pool


class FetchManyTests(unittest.TestCase):
    """工单 08：按主机限流的小线程池。判据 = 并发上限、同主机最小间隔、结果确定、
    错误按输入顺序重抛（调用方的失败语义不变）。"""

    def setUp(self):
        # 本模块测的就是「间隔」本身：显式把缩放恢复成 1（别的测试模块会把它设成 0，
        # 模块级全局状态会跨模块泄漏 —— 在同一个进程里按字母序跑时踩过）。
        self.addCleanup(setattr, fetch_pool, "INTERVAL_SCALE", fetch_pool.INTERVAL_SCALE)
        fetch_pool.INTERVAL_SCALE = 1.0
        fetch_pool.reset_gates()  # 闸门是模块级的（429 降速要跨调用保留）→ 测试间要清
        self.limits = {"a.test": (2, 0.0), "b.test": (1, 0.0)}
        self.peak = {}  # 每主机的**峰值**在飞数（不是当前值 —— 后者跑完归零）
        self._lock = threading.Lock()

    def _fn_factory(self, delay=0.05, fail=()):
        def fn(url):
            host = url.split("//")[1].split("/")[0]
            with self._lock:
                cur = self.peak.get("cur_" + host, 0) + 1
                self.peak["cur_" + host] = cur
                self.peak[host] = max(self.peak.get(host, 0), cur)
            try:
                time.sleep(delay)
                if url in fail:
                    raise RuntimeError("boom " + url)
                return "v:" + url
            finally:
                with self._lock:
                    self.peak["cur_" + host] -= 1

        return fn

    def test_results_keyed_by_url(self):
        urls = [f"http://a.test/{i}" for i in range(5)]
        out = fetch_pool.fetch_many(urls, self._fn_factory(), limits=self.limits)
        self.assertEqual(len(out), 5)
        self.assertEqual(out["http://a.test/3"], "v:http://a.test/3")

    def test_per_host_concurrency_capped(self):
        urls = [f"http://a.test/{i}" for i in range(8)]
        fetch_pool.fetch_many(urls, self._fn_factory(), limits=self.limits)
        self.assertLessEqual(self.peak["a.test"], 2)

    def test_single_slot_host_is_serial(self):
        urls = [f"http://b.test/{i}" for i in range(4)]
        fetch_pool.fetch_many(urls, self._fn_factory(), limits=self.limits)
        self.assertEqual(self.peak["b.test"], 1)

    def test_hosts_do_not_block_each_other(self):
        urls = [f"http://a.test/{i}" for i in range(3)] + [
            f"http://b.test/{i}" for i in range(3)
        ]
        fetch_pool.fetch_many(urls, self._fn_factory(), limits=self.limits)
        self.assertGreaterEqual(self.peak["a.test"], 1)
        self.assertGreaterEqual(self.peak["b.test"], 1)

    def test_interval_between_same_host_requests(self):
        stamps = []

        def fn(url):
            stamps.append(fetch_pool._now())
            return 1

        fake = [0.0]

        def now():
            return fake[0]

        with mock.patch.object(fetch_pool, "_now", now), mock.patch.object(
            fetch_pool.time, "sleep", lambda s: fake.__setitem__(0, fake[0] + s)
        ):
            fetch_pool.fetch_many(
                ["http://c.test/1", "http://c.test/2", "http://c.test/3"],
                fn,
                limits={"c.test": (1, 0.5)},
            )
        self.assertEqual(len(stamps), 3)
        self.assertGreaterEqual(stamps[1] - stamps[0], 0.5)
        self.assertGreaterEqual(stamps[2] - stamps[1], 0.5)

    def test_first_error_by_input_order_is_raised(self):
        """**两个**失败：必须重抛输入序里靠前的那个（只有一个失败时「抛最后」也能通过 ——
        变异验证抓出过这个假绿）。"""
        urls = ["http://a.test/1", "http://a.test/2", "http://a.test/3"]
        with self.assertRaises(RuntimeError) as cm:
            fetch_pool.fetch_many(
                urls, self._fn_factory(fail={urls[0], urls[2]}), limits=self.limits
            )
        self.assertIn("http://a.test/1", str(cm.exception))

    def test_host_override_for_non_url_keys(self):
        """键不是 URL 时（维基条目名、48pedia 批量）用 host 指定限流主机。"""
        seen = []

        def fn(k):
            seen.append(k)
            return "v:" + k

        out = fetch_pool.fetch_many(
            ["条目甲", "条目乙"], fn, limits={"ja.wikipedia.org": (1, 0.0)},
            host="ja.wikipedia.org",
        )
        self.assertEqual(out, {"条目甲": "v:条目甲", "条目乙": "v:条目乙"})
        self.assertEqual(sorted(seen), ["条目乙", "条目甲"])

    def test_raise_first_false_returns_exceptions(self):
        """旧站扫描要「跳过失败、继续下一个候选」—— 失败的键在结果里是异常对象。"""
        urls = ["http://a.test/1", "http://a.test/2"]
        out = fetch_pool.fetch_many(
            urls,
            self._fn_factory(fail={urls[0]}),
            limits=self.limits,
            raise_first=False,
        )
        self.assertIsInstance(out[urls[0]], RuntimeError)
        self.assertEqual(out[urls[1]], "v:" + urls[1])

    def test_429_doubles_the_interval(self):
        """限流信号（429/521/503）→ 该主机间隔翻倍，封顶 5s。"""
        gate = fetch_pool._Gate(2, 0.5)
        gate.penalize()
        self.assertEqual(gate.interval, 1.0)
        gate.penalize()
        self.assertEqual(gate.interval, 2.0)
        for _ in range(5):
            gate.penalize()
        self.assertEqual(gate.interval, fetch_pool.MAX_INTERVAL)

    def test_429_penalty_triggered_by_code(self):
        """429 之后同主机的下一次抓取要等翻倍后的间隔（假时钟全程量，别混真实时钟）。"""
        class Boom(Exception):
            code = 429

        fake = [0.0]
        stamps = []

        def now():
            return fake[0]

        def fn(url):
            stamps.append(fake[0])
            if len(stamps) == 1:
                raise Boom()
            return 1

        with mock.patch.object(fetch_pool, "_now", now), mock.patch.object(
            fetch_pool.time, "sleep", lambda s: fake.__setitem__(0, fake[0] + s)
        ):
            with self.assertRaises(Boom):
                fetch_pool.fetch_many(
                    ["http://d.test/1"], fn, limits={"d.test": (1, 0.5)}
                )
            fetch_pool.fetch_many(
                ["http://d.test/2"], fn, limits={"d.test": (1, 0.5)}
            )
        # 第一次失败把该主机间隔翻到 1.0 → 第二次抓取至少等 1.0s
        self.assertGreaterEqual(stamps[1] - stamps[0], 1.0)

    def test_no_error_when_all_succeed(self):
        out = fetch_pool.fetch_many(
            ["http://a.test/1"], self._fn_factory(), limits=self.limits
        )
        self.assertEqual(out, {"http://a.test/1": "v:http://a.test/1"})


if __name__ == "__main__":
    unittest.main()
