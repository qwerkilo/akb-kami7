// 进度提示：E2E 一套要跑十几分钟，长等待期间没有输出时看起来像假死
// （轮询循环、ready() 等图片/字体、页面加载都可能是几十秒的静默）。
//
// 两个最小助手，都只在**真的慢**（≥5s）时才开口 —— 正常快路径零噪声：
//   - `blockStarter()`：功能块头 `[块 N] 名字（累计 3m12s）`（相邻两行相减 = 该块耗时）
//   - `waitTicker(label)`：长等待里每 5s 一行 `…等待字体预热 12s`
//   - `elapsed()`：`3m12s` 形式的累计耗时（给每行 check 打时间线用）
const T0 = Date.now();

function elapsed() {
  const s = Math.round((Date.now() - T0) / 1000);
  return `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
}

function blockStarter() {
  let n = 0;
  return (name) => {
    n += 1;
    console.log(`[块 ${n}] ${name}（累计 ${elapsed()}）`);
  };
}

function waitTicker(label) {
  const t0 = Date.now();
  let last = 0;
  const secs = () => (Date.now() - t0) / 1000;
  return {
    tick(extra = "") {
      const s = secs();
      if (s >= 5 && s - last >= 5) {
        last = s;
        console.log(
          `  …${label} ${Math.round(s)}s${extra ? `（${extra}）` : ""}`
        );
      }
    },
    done(extra = "") {
      const s = secs();
      if (s >= 5)
        console.log(
          `  …${label} 完成 ${Math.round(s)}s${extra ? `（${extra}）` : ""}`
        );
    },
  };
}

module.exports = { elapsed, blockStarter, waitTicker };
