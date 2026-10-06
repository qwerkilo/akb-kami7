import io
import unittest
from contextlib import redirect_stderr
from unittest import mock

import progress


class StageProgressTests(unittest.TestCase):
    """工单 05：阶段行 + 心跳。默认静默；心跳 ≥ every 秒才开口，且要能回答
    「在动吗」—— 速率 + 上次成功 Xs 前（只有累计数分不清重试与卡死）。"""

    def setUp(self):
        progress._enabled = False
        self.t = 1000.0
        self._patch = mock.patch.object(progress, "_now", side_effect=lambda: self.t)
        self._patch.start()
        self.addCleanup(self._patch.stop)

    def _capture(self, fn):
        buf = io.StringIO()
        with redirect_stderr(buf):
            fn()
        return buf.getvalue()

    def test_disabled_prints_nothing(self):
        out = self._capture(lambda: progress.stage("x").tick())
        self.assertEqual(out, "")

    def test_stage_lines_have_name_total_and_duration(self):
        progress.enable()

        def run():
            with progress.stage("旧站扫描", total=120) as st:
                self.t += 2.5
                st.tick()
                self.t += 1.0

        out = self._capture(run)
        self.assertIn("▶ 旧站扫描（共 120）", out)
        self.assertIn("✓ 旧站扫描 1 项 · 用时 3.5s", out)

    def test_heartbeat_only_after_every_seconds(self):
        progress.enable()
        buf = io.StringIO()
        with redirect_stderr(buf):
            with progress.stage("扫描", total=100) as st:
                self.t += 5
                st.tick()
                self.assertNotIn("…", buf.getvalue(), "5s 时不该有心跳")
                self.t += 6  # 累计 11s
                st.tick()
        line = [l for l in buf.getvalue().split("\n") if "…" in l][0]
        self.assertIn("扫描 2/100", line)
        self.assertIn("次/分", line)
        self.assertIn("上次成功", line)

    def test_rate_and_last_success_reflect_reality(self):
        progress.enable()
        buf = io.StringIO()
        with redirect_stderr(buf):
            with progress.stage("下载", total=200, every=10) as st:
                for _ in range(10):
                    st.tick()
                self.t += 60  # 10 项 / 60s → 10 次/分
                st.tick()
                self.t += 30
                st.tick(ok=False)  # 失败不刷新「上次成功」
                self.t += 11
                st.tick(ok=False)
        beats = [l for l in buf.getvalue().split("\n") if "…" in l]
        self.assertTrue(beats)
        # 最后一次心跳发生在第 13 次 tick（t=101s）：13/101s ≈ 8 次/分；
        # 「上次成功」停在 t=60s 那次 → 41s 前。
        self.assertIn("13/200", beats[-1])
        self.assertIn("8 次/分", beats[-1])
        self.assertIn("上次成功 41s 前", beats[-1])
        self.assertIn("失败 2", beats[-1])
        self.assertIn("失败 2", buf.getvalue().split("\n")[-2])

    def test_module_level_tick_forwards_to_innermost_stage(self):
        """深调用栈里的循环用 progress.tick()（不必层层传 stage 参数）；
        嵌套时进最内层，退出后回到外层。"""
        progress.enable()
        buf = io.StringIO()
        with redirect_stderr(buf):
            with progress.stage("外层", total=10):
                progress.tick()
                with progress.stage("内层", total=10):
                    for _ in range(3):
                        progress.tick()
                progress.tick()
        lines = buf.getvalue().split("\n")
        # 行序：▶外层 / ▶内层 / ✓内层 / ✓外层
        self.assertIn("✓ 内层 3 项", lines[2])
        self.assertIn("✓ 外层 2 项", lines[3])

    def test_tick_without_stage_is_a_noop(self):
        progress.enable()
        out = self._capture(lambda: progress.tick())
        self.assertEqual(out, "")

    def test_total_missing_prints_bare_count(self):
        progress.enable()
        buf = io.StringIO()
        with redirect_stderr(buf):
            with progress.stage("枚举") as st:
                st.tick()
        self.assertIn("▶ 枚举\n", buf.getvalue())
        self.assertIn("✓ 枚举 1 项", buf.getvalue())


if __name__ == "__main__":
    unittest.main()
