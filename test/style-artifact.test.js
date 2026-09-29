const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// 产物不变式：style.css 两款皮肤的令牌块必须键集相同。
// 曾经贴纸块多出 --placeholder/--placeholder-ink，而 :root 兜底挂在贴纸块上
// ——等于替 classic 兜住了这两个键。兜底改挂 classic 之后，那两个键在 classic
// 下解析失败，.card .ph 的背景静默变透明（缩略图加载期间可见）。
const css = fs.readFileSync(path.join(__dirname, "..", "style.css"), "utf8");

// 令牌块解析：返回 名字 → 值（值里的换行/多空格按 CSS 规则归一，与 app.js
// 读 getComputedStyle 后做的 replace(/\s+/g, " ") 同一套）
function blockVars(selector) {
  const i = css.indexOf(selector);
  assert.ok(i >= 0, `style.css 里找不到 ${selector}`);
  const end = css.indexOf("\n}\n", i);
  const body = css.slice(i, end);
  const out = {};
  for (const m of body.matchAll(/^\s+(--[a-z0-9-]+):\s*([^;]+);/gm)) {
    out[m[1]] = m[2].replace(/\s+/g, " ").trim();
  }
  return out;
}

function blockKeys(selector) {
  return Object.keys(blockVars(selector));
}

const firstFamily = (font) => (/["']([^"']+)["']/.exec(font) || [, ""])[1];

test("两款皮肤的令牌键集相同且无重复", () => {
  const classic = blockKeys('[data-skin="classic"] {');
  const sticker = blockKeys('[data-skin="sticker"] {');
  assert.deepEqual(classic, [...new Set(classic)], "原版块里有重复的键");
  assert.deepEqual(sticker, [...new Set(sticker)], "贴纸块里有重复的键");
  assert.deepEqual(
    [...classic].sort(),
    [...sticker].sort(),
    `键集不同：仅原版 ${classic.filter((k) => !sticker.includes(k))}，仅贴纸 ${sticker.filter((k) => !classic.includes(k))}`
  );
  assert.ok(
    classic.length >= 30,
    `令牌块看起来被掏空了（只有 ${classic.length} 个键）`
  );
});

test("默认皮肤（:root）挂在原版块上，且原版块排在贴纸块之前", () => {
  const rootIdx = css.indexOf(':root,\n[data-skin="classic"] {');
  const stickerIdx = css.indexOf('[data-skin="sticker"] {');
  assert.ok(
    rootIdx >= 0,
    ':root 必须与 [data-skin="classic"] 同一块（首屏皮肤 = 应用默认）'
  );
  assert.ok(
    rootIdx < stickerIdx,
    "同权重下后来者胜：原版块必须排在贴纸块之前，否则贴纸会被盖掉"
  );
  assert.ok(
    !/\n:root,\n\[data-skin="sticker"\]/.test(css),
    ":root 不得挂在贴纸上（新访客会闪一下贴纸）"
  );
});

// 海报设计 token 的单一来源是 style.css（ADR/记忆 #164）：app 在绘制时经
// getComputedStyle 注入，poster.js 保留的 defaultTokens() 只是 node 测试与无 DOM
// 场景的兜底——它**逐值等于贴纸皮肤块**，漂移了就等于「兜底画的是另一套皮肤」。
test("poster.js 的兜底令牌逐值等于贴纸皮肤块（值相等，不只键集）", () => {
  const path = require("node:path");
  const poster = require("../poster.js");
  const d = poster.defaultTokens();
  const sticker = blockVars('[data-skin="sticker"] {');
  const shared = blockVars(":root {\n");

  // app.js posterTokens() 的映射（那边改这里要一起改，见下一条测试）
  const COLOR_MAP = {
    floor: "--floor",
    card: "--card",
    ink: "--ink",
    muted: "--muted",
    line: "--line",
    pink: "--pink",
    tape: "--lemon",
    placeholder: "--placeholder",
    placeholderInk: "--placeholder-ink",
  };
  for (const [token, cssVar] of Object.entries(COLOR_MAP)) {
    assert.equal(
      d.colors[token],
      sticker[cssVar],
      `poster 兜底 ${token} 应等于贴纸块的 ${cssVar}`
    );
  }
  // 描边宽度：CSS 写 3px，兜底是数字 3
  const stroke = parseFloat(sticker["--poster-card-stroke"]);
  assert.ok(Number.isFinite(stroke), "贴纸块应有 --poster-card-stroke");
  assert.equal(
    d.cardStroke,
    stroke,
    "poster 兜底 cardStroke 应等于贴纸的描边宽度"
  );

  // 字体在文件顶部的共享块里，而那里的值用 var() 引用（--font-display 里嵌了
  // var(--font-ui)），**不可能逐字相等**——比「首个字族名」，那才是海报真正用的
  for (const [token, cssVar] of Object.entries({
    ui: "--font-ui",
    jp: "--font-jp",
    display: "--font-display",
  })) {
    assert.equal(
      firstFamily(d.fonts[token]),
      firstFamily(shared[cssVar]),
      `poster 兜底字体 ${token} 的首个字族应等于 ${cssVar}`
    );
  }
});

test("app.js 的 posterTokens() 映射用的是同一批 CSS 变量名（别让上面那张表悄悄过期）", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  const body = src.slice(
    src.indexOf("function posterTokens()"),
    src.indexOf("function posterTokens()") + 1400
  );
  for (const v of [
    "--floor",
    "--card",
    "--ink",
    "--muted",
    "--line",
    "--pink",
    "--lemon",
    "--placeholder",
    "--placeholder-ink",
    "--poster-card-stroke",
    "--font-ui",
    "--font-jp",
    "--font-display",
  ]) {
    assert.ok(body.includes(`"${v}"`), `app.js posterTokens() 应读 ${v}`);
  }
});
