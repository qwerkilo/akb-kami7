// E2E 的预期噪声判定（第六轮扫描候选 6）。
//
// 此前是三份手写清单：e2e.cjs 与 e2e-v5.cjs 各一份逐字节相同的 isExpectedResourceNoise，
// e2e-pwa.cjs 一份形状不同的内联正则 —— 「同一约定写两遍」的漂移类。收成一处，
// 守卫在 test/e2e-source.test.js（e2e/ 里不许再出现这些字面量）。
//
// 判据只放行**已知的**噪声，别把它放宽成全放行：
// - favicon / net::ERR 这类资源加载失败；
// - 「导航中断字体预热（两百多个 woff2）」只认字体域，其余资源错误仍算失败；
// - 断网阶段浏览器给的 "A network error occurred"（只有 pwa 跑离线，对它才是预期噪声）。
function isExpectedNoise(m, { offline = false } = {}) {
  const text = m.text();
  if (/A network error occurred/.test(text)) return true;
  if (!/Failed to load resource|net::ERR/.test(text)) return false;
  // 离线阶段（pwa 套件）浏览器对**所有**请求都报 net::ERR —— 那里只守 JS 错误，
  // 资源失败一律放行；在线套件（e2e/v5）只放行 favicon 与字体域的那批。
  // 这是两个套件的**有意**差异（离线时全放行），不是可以顺手抹平的口径。
  if (offline && /net::ERR/.test(text)) return true;
  if (/favicon/.test(text)) return true;
  return /fonts\.g/.test(m.location()?.url || "");
}

module.exports = { isExpectedNoise };
