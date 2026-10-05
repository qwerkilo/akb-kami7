// Playwright 的动态解析：本机 playwright 装在 npx 缓存里（不在 node_modules）。
// 此前 4 个 e2e 脚本各抄一份（两轴审查的观察项）——收成一处。
const fs = require("node:fs");

function loadPlaywright() {
  const tries = ["playwright"];
  try {
    for (const d of fs.readdirSync("/root/.npm/_npx")) {
      tries.push(`/root/.npm/_npx/${d}/node_modules/playwright`);
    }
  } catch {}
  for (const t of tries) {
    try {
      return require(t);
    } catch {}
  }
  throw new Error(
    "找不到 playwright：npm i -D playwright 或用 npx playwright 装一次"
  );
}

module.exports = { loadPlaywright };
