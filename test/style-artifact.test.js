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

// ---- 窄屏页头的三条横账规则（缝③，源码守卫） ----
// 这条测试**不测行为、只测「规则还在」**：窄屏页头能不能放下系列 tab 只能在浏览器里
// 量（E2E 缝⑦，脚本在 /tmp 不入仓）。仓内如果完全没有守卫，那么删掉下面任意一条
// 都不会有任何测试变红，而后果是「等爱在手机上点不到」——这个 P0 已经因此溜过两轮。
// 局限要写清楚：它抓「规则被删/被改名」，抓不到「预算算错、规则还在但不够用」。
// style.css 里同一个断点可能有多个 @media 块（不同年代加的），所以要把该断点的
// 全部块拼起来再断言 —— 只取第一个会漏（第一版就是这么写错的，红了但不是 CSS 的问题）。
function mediaBlock(maxWidth) {
  const at = `@media (max-width: ${maxWidth}px)`;
  const out = [];
  let from = 0;
  for (;;) {
    const i = css.indexOf(at, from);
    if (i < 0) break;
    const end = css.indexOf("\n}\n", i);
    assert.ok(end > i, `@media (max-width: ${maxWidth}px) 块没有正常闭合`);
    out.push(css.slice(i, end));
    from = end;
  }
  assert.ok(out.length, `style.css 里找不到 ${at}`);
  return out.join("\n");
}

test("窄屏页头：系列 tab 的长短标签切换规则还在（删了就会重演等爱点不到的 P0）", () => {
  const narrow = mediaBlock(560);
  assert.match(
    narrow,
    /\.seg-label-full\s*\{[^}]*display:\s*none/,
    "≤560px 应隐藏长标签"
  );
  assert.match(
    narrow,
    /\.seg-label-short\s*\{[^}]*display:\s*inline/,
    "≤560px 应显示短标签"
  );
  assert.match(
    narrow,
    /\.masthead-main \.seg-series button\s*\{[^}]*padding:\s*6px 8px/,
    "≤560px 应把系列 tab 内边距收窄到 6px 8px（每按钮省 8px，三按钮省 24px）"
  );
  assert.match(
    narrow,
    /\.masthead-main \.sub\s*\{[^}]*display:\s*none/,
    "≤560px 应隐藏副标题（它让出的 80px 是 tab 预算的一部分）"
  );
});

test("窄屏页头：≤380px 有把系列 tab 另起一行的规则（更窄时不得切掉半个 tab）", () => {
  const tiny = mediaBlock(380);
  // 选择器可能是列表（`.masthead,\n  .masthead-main {`），所以不能要求 .masthead 紧跟 {
  assert.match(
    tiny,
    /\.masthead\b[^{}]*\{[^}]*flex-wrap:\s*wrap/,
    "≤380px 页头应允许换行"
  );
  assert.match(
    tiny,
    /\.masthead-main \.seg-series\s*\{[^}]*flex:\s*1 0 100%/,
    "≤380px 系列 tab 应独占一行"
  );
});
