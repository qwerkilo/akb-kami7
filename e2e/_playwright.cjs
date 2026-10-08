// Playwright 的动态解析：本机 playwright 装在 npx 缓存里（不在 node_modules）。
// 此前 4 个 e2e 脚本各抄一份（两轴审查的观察项）——收成一处。
const fs = require("node:fs");

/** 该 playwright 声明的 chromium 可执行文件**存在**吗。
 *  2026-10-08 事故：一条无版本号的 `npx playwright` 把 npx 缓存换成新版，
 *  与已装浏览器失配 → `npm run e2e:v5` 直接 0/1（报 "Executable doesn't exist"）。
 *  所以挑缓存不能只按「能 require」，还要按「浏览器真的在」。 */
function chromiumInstalled(pw) {
  try {
    return fs.existsSync(pw.chromium.executablePath());
  } catch {
    return false;
  }
}

function loadPlaywright() {
  const tries = ["playwright"];
  try {
    // 排序：readdir 顺序不稳定，同一环境两次跑可能挑到不同缓存。
    for (const d of fs.readdirSync("/root/.npm/_npx").sort()) {
      tries.push(`/root/.npm/_npx/${d}/node_modules/playwright`);
    }
  } catch {}
  let first = null;
  for (const t of tries) {
    let pw;
    try {
      pw = require(t);
    } catch {
      continue;
    }
    if (chromiumInstalled(pw)) return pw;
    if (!first) first = pw;
  }
  if (first) {
    console.warn(
      "⚠ playwright 已加载但找不到 chromium 可执行文件（e2e 会失败）——" +
        "跑 `npx playwright@<与浏览器配套的版本> install chromium`"
    );
    return first;
  }
  throw new Error(
    "找不到 playwright：npm i -D playwright 或用带版本号的 npx playwright 装一次"
  );
}

module.exports = { loadPlaywright };
