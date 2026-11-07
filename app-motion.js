// 「动一次，然后保证它一定停下来」：时长从 CSS 实际读，事件 + 兜底双保险。
(function (root, factory) {
  const api = factory;
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AKB_APP_MOTION = { create: api };
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  // 余量盖住 stagger 的错开总量 + 200ms（名册的窗口是 单卡时长 + 错开 + 余量）。
  const MOTION_MARGIN_MS = 350;

  function motionMs(el, kind, sample) {
    const t = sample ? el.querySelector(sample) : el;
    if (!t) return 0;
    const cs = getComputedStyle(t);
    const prop = kind === "transition" ? "transition" : "animation";
    const max = (v) =>
      Math.max(
        0,
        ...String(v || "0s")
          .split(",")
          // getComputedStyle 返回的是**秒**（"0.2s" / "200ms"），必须换算成毫秒。
          .map((x) => {
            const n = parseFloat(x);
            if (!Number.isFinite(n)) return 0;
            return x.trim().endsWith("ms") ? n : n * 1000;
          })
      );
    return max(cs[prop + "Duration"]) + max(cs[prop + "Delay"]);
  }

  // 自己解绑，不用 { once: true }：那会被第一个冒泡到 el 的事件消耗掉（名册卡
  // 的 cardIn 早于相位自己的 phaseIn 结束，事件判据永远等不到自己那趟）。
  function playOnce(el, kind, opts = {}) {
    if (!el) return;
    if (opts.cls) el.classList.add(opts.cls);
    const event = kind === "transition" ? "transitionend" : "animationend";
    let settled = false;
    const finish = (ev) => {
      if (settled) return;
      if (ev && opts.selfOnly !== false && ev.target !== el) return;
      settled = true;
      el.removeEventListener(event, finish);
      if (opts.cls) el.classList.remove(opts.cls);
      if (opts.onDone) opts.onDone();
    };
    el.addEventListener(event, finish);
    setTimeout(finish, motionMs(el, kind, opts.sample) + MOTION_MARGIN_MS);
    return finish;
  }

  return { playOnce };
});
