"""按主机限流的小线程池（perf 工单 08）。

数据阶段的请求彼此独立 —— 官网 70 个详情页、11 个维基条目、48pedia 11 个来源页、
~27 次 imageinfo 批量 —— 串行纯粹是历史写法（实测数据阶段 ~10–12 分钟是增量跑的地板）。

`fetch_many(urls, fn)`：小线程池 + **按主机**限流（并发上限 + 最小间隔），
结果按 URL 键返回；**错误按输入顺序重抛第一个**（调用方现有的失败语义不变：
`fn` 自己决定 raise 还是返回空串）。单请求语义不变 —— 池只决定「什么时候发」。

按主机分开限流的意义：48pedia 有 WAF/521 前科（1–2 并发），官网与维基可以 2–3 并发；
不同主机之间互不阻塞。
"""

import threading
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

# 每主机 (并发上限, 最小间隔秒)。未列出的主机用 DEFAULT。
HOST_LIMITS = {
    "www.helloproject.com": (3, 0.2),
    # 等爱三个官网各算一个主机（此前 love 侧统一传 www.helloproject.com 的标签 ——
    # 标签是别人的主机名，且与早安的抓取共享同一份限流预算；两相位今天顺序跑、
    # 不冲突，但按真实主机分开才是对的）
    "equal-love.jp": (2, 0.2),
    "not-equal-me.jp": (2, 0.2),
    "nearly-equal-joy.jp": (2, 0.2),
    "ja.wikipedia.org": (3, 0.2),
    "48pedia.org": (2, 0.5),
    "www.48pedia.org": (2, 0.5),
    # Wayback 实测：2 并发稳定最快（同批 8 个快照 URL 交替跑两轮：2 并发 5.9/6.5s、
    # 串行 13.6/31.2s、**3 并发 24.5/41.2s** —— 更多并发被限流、反而更慢）。
    "web.archive.org": (2, 0.2),
}
DEFAULT = (2, 0.2)
# 429/521/503 时的自适应降速：间隔翻倍，封顶 5s（Wayback 521 有前科、Commons 429 也是）；
# 连续成功 RECOVER_AFTER 次后间隔减半（下限回到 base）—— 降速要能恢复。
PENALTY_CODES = (429, 503, 521)
MAX_INTERVAL = 5.0
RECOVER_AFTER = 10

_now = time.monotonic  # 测试注入假时钟

# 间隔缩放：生产恒为 1.0；**测试**把它设成 0（那里的 fetch 是瞬时的假对象，
# 间隔只用来保护真实源站，对假对象只会把测试拖慢几十秒）。
INTERVAL_SCALE = 1.0


class _Gate:
    """一个主机的闸门：信号量（并发）+ 锁与时间戳（最小间隔）。"""

    def __init__(self, limit, interval):
        self.sem = threading.Semaphore(limit)
        self.lock = threading.Lock()
        self.base = interval
        self.interval = interval
        self.last = None
        self.streak = 0  # 连续成功数（用于「成功后退回」）

    def penalize(self):
        """限流信号（429/521/503）：间隔翻倍，封顶 MAX_INTERVAL。"""
        with self.lock:
            self.streak = 0
            self.interval = min(max(self.interval * 2, 0.1), MAX_INTERVAL)

    def reward(self):
        """连续成功 RECOVER_AFTER 次 → 间隔减半（下限 base）—— 429 过去之后要能恢复，
        否则一次限流会让该主机整个进程生命周期都按翻倍间隔跑。"""
        with self.lock:
            self.streak += 1
            if self.streak >= RECOVER_AFTER and self.interval > self.base:
                self.interval = max(self.interval / 2, self.base)
                self.streak = 0

    def __enter__(self):
        self.sem.acquire()
        self.lock.acquire()
        try:
            if self.last is not None:
                wait = self.interval * INTERVAL_SCALE - (_now() - self.last)
                if wait > 0:
                    time.sleep(wait)
            self.last = _now()
        finally:
            self.lock.release()
        return self

    def __exit__(self, *exc):
        self.sem.release()
        return False


# 闸门是**模块级**的（按主机）：429 的降速要跨调用保留（一次扫描按团分多次
# fetch_many），否则每次调用都从初始间隔重新开始，自适应就白做了。
_gates = {}
_gates_lock = threading.Lock()


def reset_gates():
    """测试用：清空闸门（间隔/并发状态跨测试会污染）。"""
    with _gates_lock:
        _gates.clear()


def _gate_for(host, limits):
    with _gates_lock:
        if host not in _gates:
            limit, interval = limits.get(host, DEFAULT)
            _gates[host] = _Gate(limit, interval)
        return _gates[host]


def fetch_many(urls, fn, workers=8, limits=None, host=None, raise_first=True):
    """并发取 `urls`（`fn(url)`），返回 `{url: 值}`；错误按输入顺序重抛第一个。

    `limits` 覆盖 `HOST_LIMITS`（测试用）。`workers` 是全局线程数上限。
    `host` 给「键不是 URL」的调用方（维基条目名、48pedia 批量查询）：整批都算这个主机。
    `raise_first=False` 时不抛：失败的键在结果里是那个异常对象（旧站扫描要「跳过
    失败、继续下一个候选」的语义，与串行版一致）。

    429/521/503 会让该主机的间隔翻倍（自适应降速）—— 源站压力大时自动退让。
    """
    limits = limits or HOST_LIMITS

    def one(url):
        h = host or urlparse(url).netloc
        gate = _gate_for(h, limits)
        with gate:
            try:
                out = fn(url)
            except Exception as e:  # noqa: BLE001
                if getattr(e, "code", None) in PENALTY_CODES:
                    gate.penalize()
                raise
            gate.reward()
            return url, out

    out = {}
    errors = []
    with ThreadPoolExecutor(workers) as ex:
        futures = [ex.submit(one, u) for u in urls]
        for i, fut in enumerate(futures):
            try:
                url, value = fut.result()
                out[url] = value
            except Exception as e:  # noqa: BLE001 —— 按输入顺序收集，最后重抛第一个
                errors.append((i, e))
    if errors and raise_first:
        errors.sort(key=lambda x: x[0])
        raise errors[0][1]
    for i, e in errors:
        out[urls[i]] = e
    return out
