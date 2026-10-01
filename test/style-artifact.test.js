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
    /\.masthead-main \.seg-series button\s*\{[^}]*padding:\s*6px 7px/,
    "≤560px 应把系列 tab 内边距收窄到 6px 7px（每按钮比默认的 12px 省 10px）"
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

test("窄屏页头：离线胶囊缩成「更多」角上的点（84px 横向成本会让 seg 塌到 66px）", () => {
  const narrow = mediaBlock(560);
  assert.match(
    narrow,
    /\.pwa-chip\s*\{[^}]*position:\s*absolute/,
    "≤560px 离线胶囊应绝对定位（否则 84px 全额吃掉系列 tab 的横账）"
  );
  assert.match(
    narrow,
    /\.pwa-chip\s*>\s*span:not\(\.pwa-dot\)\s*\{[^}]*clip-path/,
    "文字要用 clip 移出屏幕而不是 display:none —— role=status 要靠它播报"
  );
  // gap 必须断言**级联后的有效值**，不能只断言「有一条 .masthead 规则带 gap:6」：
  // 560 断点下本来就有两个 @media 块、块 1 的 .masthead 早就是 gap:6（列布局），
  // 只扫「有没有」的话，删掉我那条覆盖（块 2 的 gap:6）照样匹配 → 守卫是空的。
  // CSS 里同权重后来居上，所以取这些规则里最后一条的 gap 才是真正生效的那个。
  const mastheadGaps = [...narrow.matchAll(/\.masthead\s*\{([^}]*)\}/g)]
    .map((m) => /gap:\s*([0-9]+)px/.exec(m[1]))
    .filter(Boolean)
    .map((m) => Number(m[1]));
  assert.ok(mastheadGaps.length, "≤560px 块里找不到 .masthead 的 gap");
  assert.equal(
    mastheadGaps[mastheadGaps.length - 1],
    5,
    `≤560px 页头 gap 的生效值应为 5px（最紧的 en 16 档只差 2px），实际 ${JSON.stringify(mastheadGaps)}`
  );
});

test("≤380px：系列 tab 落到第二行，但品牌与「更多」留在第一行（display:contents 换行）", () => {
  const tiny = mediaBlock(380);
  assert.match(
    tiny,
    /\.masthead-main\s*\{[^}]*display:\s*contents/,
    "≤380px 应让 main 的子元素直接参与 .masthead 排列（否则「更多」被挤到第三行、页头 66→164px）"
  );
  assert.match(
    tiny,
    /\.masthead-side\s*\{[^}]*margin-left:\s*auto/,
    "「更多」靠右推（写死宽度会在另一种语言下复发）"
  );
  // display:contents 才是真正起作用的机制。前两版方案（给 main 写 flex:1 0 100% /
  // flex:1 1 auto）都会把「更多」挤到独占一行或第三行：页头 66→164px，375px 以下
  // 「首屏见脸」从 3 张掉到 0 张。所以这条不许被删。
  assert.match(
    tiny,
    /\.masthead-main\s*\{[^}]*display:\s*contents/,
    "≤380px 应给 .masthead-main 写 display:contents（brand/tab/「更多」各自参与 .masthead 排列）"
  );
  assert.match(
    tiny,
    /\.masthead-main \.seg-series\s*\{[^}]*flex:\s*1 0 100%/,
    "≤380px 系列 tab 应独占一行"
  );
  assert.match(
    tiny,
    /\.steps button\s*\{[^}]*padding:\s*8px 6px/,
    "≤380px 步骤条按钮内边距应收窄（英文第 3 步标签最长，360px 上会横向滚动）"
  );
  // 360px en：步骤条第 3 枚按钮右边缘 366 > 360 → 6px 横向滚动。断点取 340px 而非 320px
  // （差 6px 的不只是 320 那一档，321~340 同样放不下）。更窄则让步骤条自己横向滚动。
  const tiny340 = mediaBlock(340);
  assert.ok(tiny340, "≤340px 的断点块不许被删");
  assert.match(
    tiny340,
    /\.steps button\s*\{[^}]*padding:\s*8px 3px/,
    "≤340px 步骤条按钮内边距应收到 8px 3px（三个按钮共省 18px）"
  );
  assert.match(
    tiny340,
    /\.steps\s*\{[^}]*overflow-x:\s*auto/,
    "≤340px 允许步骤条横向滚动（再窄就不收内边距了）"
  );
});

// ---- ADR-0020 §6：对比度是硬指标，不是观感 ----
// 现状三处欠账（实测）：--muted 在页底 4.33:1（正文需 ≥4.5）、--peach 作正文 3.96:1、
// 占位图首字 2.11:1。这个守卫就是为了让它们没法再欠着 —— 纯计算，不依赖浏览器。
function srgbLum(hex) {
  let h = hex.replace("#", "").trim();
  assert.match(h, /^[0-9a-f]{3}([0-9a-f]{3})?$/i, `不是十六进制色：${hex}`);
  if (h.length === 3) h = [...h].map((c) => c + c).join(""); // #fff 是合法简写
  const ch = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function contrast(a, b) {
  const la = srgbLum(a);
  const lb = srgbLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

test("对比度：两款皮肤的正文 / 次要文字 / 占位首字都达标（ADR-0020 §6）", () => {
  // 正文与小字 ≥4.5:1（WCAG AA）；占位首字是大字号图形，套大字阈值 ≥3:1 ——
  // 它是**信息**（离线时要读得出是谁），不能当装饰豁免。
  // 同块内的 var() 引用要能解析：贴纸块的 --on-primary 写的是 var(--ink)，
  // 而对比度是算不出来的 —— 必须跟着引用取到字面量（限深 4 层，防环）。
  const resolve = (v, vars, depth = 0) => {
    const m = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(v);
    if (!m || depth > 3) return v;
    return vars[m[1]] ? resolve(vars[m[1]], vars, depth + 1) : v;
  };
  const PAIRS = [
    ["正文 ink / 卡片", "--ink", "--card", 4.5],
    ["正文 ink / 页底", "--ink", "--floor", 4.5],
    ["次要 muted / 卡片", "--muted", "--card", 4.5],
    ["次要 muted / 页底", "--muted", "--floor", 4.5],
    // 压 --peach 的文字（主按钮 / 分段控件选中态）：--on-primary 是这个用途的令牌
    // （实测白字在原版 #e4007f 上 4.56:1；贴纸皮那块 --peach 是浅色，用墨色 9.09:1）
    ["主按钮文字 / 主色浅色面", "--on-primary", "--peach", 4.5],
    // 压 --pink 的文字：--pink 两款皮肤同值（#e4007f），所以白字即可 ——
    // 实测 4.56:1。我一度把它写成「主色作正文」的用例，那是伪判据（CSS 里
    // 0 处 color: var(--pink)），真判据是主按钮/分段控件/序号这些压 --pink 的元素。
    ["压 --pink 的文字", "--on-pink", "--pink", 4.5],
    ["占位首字 / 占位底", "--placeholder-ink", "--placeholder", 3],
    ["占位底上的 ink", "--ink", "--placeholder", 4.5],
  ];
  for (const skin of ["classic", "sticker"]) {
    const v = blockVars(`[data-skin="${skin}"] {`);
    for (const [name, fg, bg, min] of PAIRS) {
      assert.ok(v[fg], `${skin} 块缺 ${fg}`);
      assert.ok(v[bg], `${skin} 块缺 ${bg}`);
      const got = contrast(resolve(v[fg], v), resolve(v[bg], v));
      assert.ok(
        got >= min,
        `${skin} 的${name}只有 ${got.toFixed(2)}:1（要求 ≥${min}）—— ${fg}=${resolve(v[fg], v)} on ${bg}=${resolve(v[bg], v)}`
      );
    }
  }
});

test("刻度：令牌存在，且刻度外的字面量只许减不许增（棘轮，ADR-0020 §4）", () => {
  const shared = blockVars(":root {");
  for (const k of [
    "--t1",
    "--t2",
    "--t3",
    "--t4",
    "--t5",
    "--s1",
    "--s2",
    "--s3",
    "--s4",
    "--s5",
    "--s6",
  ]) {
    assert.ok(shared[k], `:root 块缺刻度令牌 ${k}`);
  }
  const TYPE = ["12px", "14px", "16px", "20px", "28px", "44px", "72px"];
  // 28px 在表里：它是 4 的倍数（4×7），漏掉会把它误报成新欠账。
  // 负值不参与：负边距是出血（如 margin: 12px -16px 0），不是节奏值。
  const SPACE = [
    "0",
    "1px",
    "2px",
    "3px",
    "4px",
    "6px",
    "8px",
    "12px",
    "16px",
    "20px",
    "24px",
    "28px",
    "32px",
    "40px",
    "48px",
    "56px",
    "64px",
  ];
  const decls = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .matchAll(
      /(^|[;{])\s*(font-size|padding|padding-top|padding-bottom|padding-left|padding-right|margin|margin-top|margin-bottom|margin-left|margin-right|gap|row-gap|column-gap)\s*:\s*([^;}]+)/g
    );
  const type = new Set();
  const space = new Set();
  for (const m of decls) {
    for (const raw of m[3].split(/\s+/).filter(Boolean)) {
      if (!/^\d+(\.\d+)?px$/.test(raw)) continue; // 负边距是出血，不是节奏
      const v = raw.trim();
      if (m[2] === "font-size") {
        if (!TYPE.includes(v)) type.add(v);
      } else if (!SPACE.includes(v)) space.add(v);
    }
  }
  // 棘轮：刻度建立之前 style.css 里有 8 个刻度外字号与 8 个刻度外间距。
  // 整体重排要动全层数值（改 padding 就是改版面），而本机跑不动全量 E2E ——
  // 所以这里不假装已经清零，而是**只许减不许增**：清单外的刻度外值一律红。
  // 每次重排一批就从清单里划掉一个，并改这一行。
  const KNOWN_TYPE = [
    "10px",
    "11px",
    "13px",
    "15px",
    "17px",
    "18px",
    "19px",
    "30px",
  ];
  const KNOWN_SPACE = [
    "5px",
    "7px",
    "10px",
    "13px",
    "14px",
    "18px",
    "22px",
    "30px",
  ];
  const newType = [...type].filter((v) => !KNOWN_TYPE.includes(v)).sort();
  const newSpace = [...space].filter((v) => !KNOWN_SPACE.includes(v)).sort();
  assert.deepEqual(
    newType,
    [],
    `新出现的刻度外字号：${newType.join("、")}（用刻度令牌或既有值）`
  );
  assert.deepEqual(
    newSpace,
    [],
    `新出现的刻度外间距：${newSpace.join("、")}（用刻度令牌或既有值）`
  );
  const left =
    [...type].filter((v) => KNOWN_TYPE.includes(v)).length +
    [...space].filter((v) => KNOWN_SPACE.includes(v)).length;
  assert.ok(
    left <= KNOWN_TYPE.length + KNOWN_SPACE.length,
    `棘轮反了：剩 ${left} 个，但基线是 ${KNOWN_TYPE.length + KNOWN_SPACE.length} 个`
  );
});
test("动效：有三档时长令牌 + 一条缓动，且降级时全部关闭（ADR-0020 §4）", () => {
  const shared = blockVars(":root {");
  for (const k of ["--dur-fast", "--dur-mid", "--dur-slow", "--ease"]) {
    assert.ok(shared[k], `:root 块缺动效令牌 ${k}`);
  }
  const fast = parseFloat(shared["--dur-fast"]);
  const mid = parseFloat(shared["--dur-mid"]);
  const slow = parseFloat(shared["--dur-slow"]);
  assert.ok(
    fast <= mid && mid <= slow,
    `三档时长必须递增：${fast}/${mid}/${slow}`
  );
  assert.ok(slow <= 400, `最慢一档 ${slow}ms 超过 400ms 上限`);
  // 降级块：prefers-reduced-motion 下 transition/animation 归零
  const rm =
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/.exec(
      css
    );
  assert.ok(rm, "style.css 缺 @media (prefers-reduced-motion: reduce) 块");
  // 必须锚在**通用选择器**那条规则上：块里还有 .toast 的 transition:none，
  // 只在整块里搜 transition/animation 的话，把通用规则改成 revert 也照样通过 ——
  // 守卫给的是虚假安全感（实测过：改成 revert 仍然全绿）。
  const uni =
    /(^|\n)\s*\*,\s*\n\s*\*::before,\s*\n\s*\*::after\s*\{([^}]*)\}/.exec(
      rm[1]
    );
  assert.ok(uni, "降级块里缺通用选择器规则（*, *::before, *::after）");
  assert.match(uni[2], /transition:\s*none/, "降级时 transition 必须归零");
  assert.match(uni[2], /animation:\s*none/, "降级时 animation 必须关掉");
});

// 品牌下那条洋红装饰：窄屏（20px 字 + 4px 下内边距）时，写死 8px 会切进字的下缘 ——
// 两款皮肤下都读作「错位」。几何只能在浏览器里量（仓外探针 verify-ticket01），
// 但**形状**可以在这里守：条高必须随字号，且窄屏的下内边距要大于条高。
test("品牌装饰条：高度随字号，窄屏留出了条的位置（不许写死像素）", () => {
  const start = css.indexOf('[data-skin="classic"] .kami::after');
  assert.ok(start >= 0, "style.css 里找不到品牌的装饰条规则");
  const body = css.slice(start, css.indexOf("\n}", start));
  const h = /height:\s*([\d.]+)em/.exec(body);
  assert.ok(h, "装饰条高度必须用 em（写死 px 就会在窄屏切进字面）");
  const narrow = mediaBlock(560);
  assert.ok(narrow, "缺 ≤560px 断点块");
  let seen = 0;
  for (const m of narrow.matchAll(/\.kami(?:\.long)?\s*\{([^}]*)\}/g)) {
    seen++;
    const pad = /padding:\s*([^;]+);/.exec(m[1]);
    const fontSize = /font-size:\s*([\d.]+)px/.exec(m[1]);
    assert.ok(pad && fontSize, `窄屏 .kami 的声明形状变了：${m[1].trim()}`);
    const parts = pad[1].trim().split(/\s+/);
    const bottom = parseFloat(parts[2] ?? parts[0]); // Number("7px") 是 NaN —— 要 parseFloat
    const barPx = Number(h[1]) * Number(fontSize[1]);
    assert.ok(
      bottom > barPx,
      `窄屏 .kami 下内边距 ${bottom}px 要大于装饰条 ${barPx.toFixed(1)}px，否则条压字`
    );
  }
  assert.ok(
    seen >= 2,
    `窄屏块里应同时有 .kami 与 .kami.long，只找到 ${seen} 处`
  );
});

// ---- 工单 02：首屏见脸的几何判据（第一张成员卡 top ≤ 400）只有浏览器能量，
// 而 E2E 脚本不入仓 —— 所以这里守**形状与形状之间的关系**。改这几处而不同步
// 下面的断言，会让新访客的首屏又看不到产品（此前 738px，视口 844 的 87%）。
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("引导卡：正文在原生 details 里，默认只占一行", () => {
  const details = /<details class="coach-more">([\s\S]*?)<\/details>/.exec(
    html
  );
  assert.ok(
    details,
    'index.html 缺 <details class="coach-more">（引导卡正文要收进去）'
  );
  assert.match(
    details[1],
    /id="coach-body"/,
    "#coach-body 必须在 coach-more 里"
  );
  assert.match(
    details[1],
    /<summary>/,
    "coach-more 缺 <summary>（默认展开会占版面）"
  );
  // 「知道了」必须排在 </details> **之后**：放进 summary 的话，点击它会先
  // 折叠 details（而不是关掉引导卡）—— 这种错在浏览器里才看得出来。
  const block =
    /<div class="coach" id="coach"[\s\S]*?<\/div>\s*(?=<div class="resume")/.exec(
      html
    );
  assert.ok(block, "找不到引导卡区块");
  const closeAt = block[0].indexOf("</details>");
  const okAt = block[0].indexOf('data-act="coach-ok"');
  assert.ok(closeAt > 0, "引导卡区块里找不到 </details>");
  assert.ok(
    okAt > closeAt,
    "「知道了」按钮必须排在 </details> 之后（放进 summary 会被点击折叠吞掉）"
  );
});

test("筛选面板：状态/团体/期生/搜索都在 details 里，工具条只剩两件", () => {
  const panel = /<details class="filter-panel">([\s\S]*?)<\/details>/.exec(
    html
  );
  assert.ok(panel, 'index.html 缺 <details class="filter-panel">');
  for (const id of ["group-filter", "gen-filter", "search"]) {
    assert.match(
      panel[1],
      new RegExp(`id="${id}"`),
      `#${id} 必须在筛选面板里（行宽放不下 9 个控件）`
    );
  }
  assert.match(panel[1], /class="seg seg-filter"/, ".seg-filter 必须在面板里");
  // 工具条里只该剩档位段与触发按钮
  const bar =
    /<div class="toolbar">([\s\S]*?)<\/div>\s*\n\s*<div id="roster"/.exec(html);
  assert.ok(bar, "找不到 .toolbar 区块");
  const outside = bar[1].replace(panel[0], "");
  assert.match(outside, /class="seg seg-size"/, "档位段应留在工具条行内");
  assert.ok(!/id="search"/.test(outside), "搜索框还在工具条行内");
});

test("窄屏横账：档位段基准为 0 且段内不换行（英文 288 + 触发 147 > 358）", () => {
  const seg = /\.toolbar > \.seg-size \{([^}]*)\}/.exec(css);
  assert.ok(seg, "style.css 缺 .toolbar > .seg-size 规则");
  // flex 基准必须是 0：容器是 flex-wrap: wrap，换行按**基准尺寸**决定，
  // 基准 auto 时（内容 288）还没轮到收缩就先换行了 —— 我第一版就写成了 1 1 auto。
  assert.match(
    seg[1],
    /flex:\s*1 1 0/,
    "档位段的 flex 基准必须是 0（1 1 0），否则英文界面会换行成两行"
  );
  assert.match(seg[1], /min-width:\s*0/, "档位段需要 min-width: 0 才能收缩");
  assert.match(seg[1], /overflow-x:\s*auto/, "档位段需要段内横向滚动兜底");
  assert.match(
    css,
    /\.toolbar > \.seg-size\.seg \{[^}]*flex-wrap:\s*nowrap/,
    "段内不能换行（.seg 默认 wrap，会把三个按钮折成两行）"
  );
});

test("窄屏：步骤条标签不换行（en「Screen / Duel」曾把步骤条从 57 顶到 77）", () => {
  const narrow = mediaBlock(560);
  assert.ok(narrow, "缺 ≤560px 断点块");
  const btn = /\.steps button \{([^}]*)\}/.exec(narrow);
  assert.ok(btn, "≤560px 块里缺 .steps button 规则");
  assert.match(btn[1], /white-space:\s*nowrap/, "窄屏步骤条必须 nowrap");
  assert.match(
    html,
    /class="step-label"/,
    "index.html 缺 .step-label 包裹（否则省略号无处可施）"
  );
});

test("托盘不透明（半透明会让名册卡片从下面透出并与提示文字重叠）", () => {
  for (const skin of ["classic", "sticker"]) {
    const v = blockVars(`[data-skin="${skin}"] {`);
    assert.ok(v["--tray-bg"], `${skin} 块缺 --tray-bg`);
    assert.doesNotMatch(
      v["--tray-bg"],
      /rgba\([^)]*0?\.\d+\)/,
      `${skin} 的 --tray-bg 是半透明的（${v["--tray-bg"]}）—— 名册卡片会透出并与提示文字重叠`
    );
  }
});
