"""阶段进度与心跳（perf 工单 05）。

长跑（旧站扫描几百次抓取、1500 次下载/压缩）以前全程静默 —— 分不清「慢」与「死」，
只能靠外部工具（`/proc/<pid>/io`）证明它还活着。这里两个最小东西：

- `stage(name, total=…)`：上下文管理器，开始/结束各一行（名字、总数、命中、耗时）。
- `Stage.tick(ok=…)`：每处理一项调用一次；距上次心跳 ≥ `every` 秒时打一行
  `已完成/总数 · 速率 · 上次成功 Xs 前`（`ok=False` 记一次失败，用于「上次成功」）。

默认**静默**（单元测试不刷屏），`fetch_members.main` 调 `enable()` 打开。输出走 stderr、
单行、`flush=True`（管线日志用 `> log 2>&1`，两种都收）。
"""

import sys
import time

_enabled = False
_now = time.monotonic  # 测试注入假时钟


def enable():
    global _enabled
    _enabled = True


def enabled():
    return _enabled


def _emit(line):
    if _enabled:
        print(line, file=sys.stderr, flush=True)


_stack = []


def tick(ok=True):
    """把一次进度记到**当前**阶段（最内层 stage）—— 深调用栈里的循环不必层层传参。"""
    if _stack:
        _stack[-1].tick(ok=ok)


class Stage:
    """一个耗时阶段的进度。`tick()` 由循环逐项调用（无后台线程，确定性）。"""

    def __init__(self, name, total=None, every=10.0):
        self.name = name
        self.total = total
        self.every = every
        self.done = 0
        self.ok = 0
        self.failed = 0
        self._t0 = _now()
        self._last_beat = self._t0
        self._last_ok = self._t0

    def __enter__(self):
        _emit(f"▶ {self.name}" + (f"（共 {self.total}）" if self.total else ""))
        _stack.append(self)
        return self

    def tick(self, ok=True):
        self.done += 1
        if ok:
            self.ok += 1
            self._last_ok = _now()
        else:
            self.failed += 1
        now = _now()
        if now - self._last_beat >= self.every:
            self._last_beat = now
            elapsed = max(now - self._t0, 1e-9)
            rate = self.done / elapsed * 60
            since = now - self._last_ok
            progress = f"{self.done}/{self.total}" if self.total else str(self.done)
            _emit(
                f"  … {self.name} {progress} · {rate:.0f} 次/分 · 上次成功 {since:.0f}s 前"
                + (f" · 失败 {self.failed}" if self.failed else "")
            )

    def __exit__(self, *exc):
        if _stack and _stack[-1] is self:
            _stack.pop()
        dt = _now() - self._t0
        tail = f" · 失败 {self.failed}" if self.failed else ""
        _emit(f"✓ {self.name} {self.done} 项 · 用时 {dt:.1f}s{tail}")
        return False


def stage(name, total=None, every=10.0):
    return Stage(name, total=total, every=every)
