const { test } = require("node:test");
const assert = require("node:assert/strict");
const poster = require("../poster.js");

function fakeCtx() {
  const calls = {
    texts: [],
    textPos: [],
    textFonts: [],
    images: [],
    imagesM: [],
    fills: [],
    fonts: [],
    strokes: [],
  };
  const stack = [];
  let m = [1, 0, 0, 1, 0, 0]; // a b c d e f
  const ctx = {
    canvas: { width: 1080, height: 1440 },
    save() {
      stack.push(m.slice());
    },
    restore() {
      m = stack.pop() || m;
    },
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arcTo() {},
    arc() {},
    clip() {},
    fill() {},
    fillRect() {},
    stroke() {
      calls.strokes.push(ctx.lineWidth);
    },
    translate(x = 0, y = 0) {
      m[4] += m[0] * x + m[2] * y;
      m[5] += m[1] * x + m[3] * y;
    },
    rotate(a = 0) {
      const [a1, b1, c1, d1] = m;
      const cs = Math.cos(a);
      const sn = Math.sin(a);
      m[0] = a1 * cs + c1 * sn;
      m[1] = b1 * cs + d1 * sn;
      m[2] = a1 * -sn + c1 * cs;
      m[3] = b1 * -sn + d1 * cs;
    },
    drawImage(...args) {
      calls.images.push(args);
      calls.imagesM.push(m.slice());
    },
    fillText(text, x, y) {
      calls.texts.push(String(text));
      calls.textPos.push([String(text), x, y]);
      calls.textFonts.push([String(text), font]);
    },
    measureText(s) {
      const m = /(\d+)px/.exec(font);
      const size = m ? Number(m[1]) : 16;
      return { width: String(s).length * size * 0.55 };
    },
    textAlign: "",
    textBaseline: "",
    strokeStyle: "",
    lineWidth: 1,
    shadowColor: "",
    shadowBlur: 0,
    shadowOffsetY: 0,
  };
  let fillStyle = "";
  let font = "";
  Object.defineProperty(ctx, "fillStyle", {
    get: () => fillStyle,
    set: (v) => {
      fillStyle = v;
      calls.fills.push(v);
    },
  });
  Object.defineProperty(ctx, "font", {
    get: () => font,
    set: (v) => {
      font = v;
      calls.fonts.push(v);
    },
  });
  return { ctx, calls };
}

function people(n) {
  return Array.from({ length: n }, (_, i) => ({
    name: `成员${i + 1}`,
    group: "AKB48",
    generation: "1期生",
    status: "current",
  }));
}

function drawWith(n) {
  const members = people(n);
  members.forEach((m, i) => (m.subtitle = `副标题${i + 1}`));
  const { ctx, calls } = fakeCtx();
  const opts = {
    members,
    images: members.map(() => null),
    title: "我的 48 Group 神7",
    dateText: "48 Group 好き顔ソート · 2026.09.27",
    hashtag: "#48Group  #好き顔ソート",
    photoSrc: "写真：48pedia",
    subOf: (m) => m.subtitle,
  };
  poster.draw(ctx, opts);
  return { members, calls, ctx };
}

test("layout：7/16/32 的画布尺寸", () => {
  assert.deepEqual(poster.layout(7), { width: 1080, height: 1440 });
  assert.deepEqual(poster.layout(16), { width: 1080, height: 1920 });
  assert.deepEqual(poster.layout(32), { width: 1080, height: 1440 });
});

test("draw：7 人海报槽位齐、标题/话题/名字/副标题都落笔", () => {
  const { members, calls } = drawWith(7);
  for (const m of members) {
    assert.ok(calls.texts.includes(m.name), `缺名字 ${m.name}`);
    assert.ok(calls.texts.includes(m.subtitle), `缺副标题 ${m.subtitle}`);
  }
  assert.ok(calls.texts.includes("我的 48 Group 神7"));
  assert.ok(calls.texts.includes("#48Group  #好き顔ソート"));
  assert.ok(!calls.texts.some((x) => x.includes("undefined")));
});

test("draw：16 人海报 16 个槽位与 CENTER 标记", () => {
  const { members, calls } = drawWith(16);
  for (const m of members)
    assert.ok(calls.texts.includes(m.name), `缺名字 ${m.name}`);
  assert.equal(calls.texts.filter((x) => x === "CENTER").length, 1);
  assert.ok(!calls.texts.some((x) => x.includes("undefined")));
});

test("draw：32 人金字塔——序号 1-32 齐全、上半有名字/字幕、其余不画", () => {
  const { members, calls } = drawWith(32);
  members.forEach((m, i) => {
    const named = i < 16;
    assert.equal(calls.texts.includes(m.name), named, `名字可见性 ${m.name}`);
    assert.equal(
      calls.texts.includes(m.subtitle),
      named,
      `副标题可见性 ${m.subtitle}`
    );
  });
  assert.equal(calls.texts.filter((x) => x === "CENTER").length, 0);
  const nums = calls.texts.filter((x) => /^\d{1,2}$/.test(x));
  assert.deepEqual(
    [...new Set(nums)].sort((a, b) => a - b),
    Array.from({ length: 32 }, (_, i) => String(i + 1))
  );
  assert.ok(!calls.texts.some((x) => x.includes("undefined")));
});

test("draw：注入 tokens 后使用注入的颜色与字体，缺省回退内置默认", () => {
  const tokens = {
    colors: {
      floor: "#010101",
      card: "#020202",
      ink: "#030303",
      muted: "#040404",
      line: "#050505",
      pink: "#060606",
      tape: "#070707",
    },
    fonts: { ui: "UX", jp: "JX", display: "DX" },
  };
  const base = {
    members: people(7),
    images: people(7).map(() => null),
    title: "T",
    dateText: "D",
    hashtag: "H",
    photoSrc: "P",
    subOf: () => "",
  };
  const injected = fakeCtx();
  poster.draw(injected.ctx, { ...base, tokens });
  assert.ok(injected.calls.fills.includes("#010101"), "地板色未用注入值");
  assert.ok(injected.calls.fills.includes("#060606"), "榜首胶带色未用注入值");
  assert.ok(injected.calls.fills.includes("#070707"), "胶带色未用注入值");
  assert.ok(
    injected.calls.fonts.some((f) => f.includes("DX")),
    "display 字体未用注入值"
  );
  assert.ok(
    injected.calls.fonts.some((f) => f.includes("JX")),
    "jp 字体未用注入值"
  );
  assert.ok(
    injected.calls.fonts.some((f) => f.includes("UX")),
    "ui 字体未用注入值"
  );
  assert.ok(
    !injected.calls.fills.some((f) =>
      [
        "#f5f1e6",
        "#ffffff",
        "#20242e",
        "#6f6a60",
        "#cfc7b8",
        "#ffe08a",
        "#e4007f",
      ].includes(f)
    ),
    "注入后仍出现内置颜色"
  );

  const partial = fakeCtx();
  poster.draw(partial.ctx, {
    ...base,
    tokens: { colors: { floor: "#0a0a0a" } },
  });
  assert.ok(partial.calls.fills.includes("#0a0a0a"), "部分注入未生效");
  assert.ok(
    partial.calls.fills.includes("#ffe08a"),
    "未注入的颜色应回退内置默认"
  );
  assert.ok(
    partial.calls.fonts.some((f) => f.includes("Dela Gothic One")),
    "未注入的字体应回退内置默认"
  );

  const fallback = fakeCtx();
  poster.draw(fallback.ctx, base);
  assert.ok(fallback.calls.fills.includes("#f5f1e6"), "缺省未回退内置地板色");
  assert.deepEqual(poster.defaultTokens().colors.tape, "#ffe08a");
});

function drawFull(n) {
  const members = people(n);
  members.forEach((m, i) => (m.subtitle = `副标题${i + 1}`));
  const { ctx, calls } = fakeCtx();
  poster.draw(ctx, {
    members,
    images: members.map(() => ({ width: 720, height: 960 })),
    title: "T",
    dateText: "D",
    hashtag: "H",
    photoSrc: "P",
    subOf: (m) => m.subtitle,
  });
  return { calls };
}

test("draw：32 人金字塔——行分布 1-3-5-7-9-7、居中、宽度不增、上半有名字", () => {
  const { calls } = drawFull(32);
  assert.equal(calls.images.length, 32);
  const rects = calls.images.map((a) => ({
    x: a[5],
    y: a[6],
    w: a[7],
    h: a[8],
  }));
  const byY = new Map();
  for (const r of rects) {
    const k = Math.round(r.y);
    byY.set(k, [...(byY.get(k) || []), r]);
  }
  const ys = [...byY.keys()].sort((a, b) => a - b);
  const rows = ys.map((y) => byY.get(y).sort((a, b) => a.x - b.x));
  assert.deepEqual(
    rows.map((r) => r.length),
    [1, 3, 5, 7, 9, 7]
  );
  for (const row of rows) {
    const left = row[0].x;
    const right = 1080 - (row[row.length - 1].x + row[row.length - 1].w);
    assert.ok(Math.abs(left - right) < 3, `行未居中：${left} vs ${right}`);
  }
  const widths = rows.map((r) => r[0].w);
  for (let i = 1; i < widths.length; i++) {
    assert.ok(
      widths[i] <= widths[i - 1] + 0.5,
      `第 ${i + 1} 行比上一行宽：${widths}`
    );
  }
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1][0];
    const named = i <= 4;
    const gapBelow = rows[i][0].y - (prev.y + prev.h);
    assert.ok(gapBelow >= (named ? 36 : 6), `行间距不足：${gapBelow}`);
  }
  const names = new Set(calls.texts);
  for (const m of people(32)) {
    const idx = +m.name.replace("成员", "");
    assert.equal(names.has(m.name), idx <= 16, `${m.name} 名字显示不符`);
  }
});

test("draw：32 人金字塔——照片 cover 不变形、每行居中、长标题截断", () => {
  const members = people(32);
  members.forEach((m, i) => (m.subtitle = `副标题${i + 1}`));
  const { ctx, calls } = fakeCtx();
  poster.draw(ctx, {
    members,
    images: members.map(() => ({ width: 300, height: 400 })),
    title: "很长的标题".repeat(30),
    dateText: "48 Group 好き顔ソート · 2026.09.27",
    hashtag: "#48Group  #好き顔ソート",
    photoSrc: "写真：48pedia",
    subOf: (m) => m.subtitle,
  });
  assert.equal(calls.images.length, 32);
  for (const args of calls.images) {
    const [, , , sw, sh, , , w, h] = args;
    assert.ok(
      Math.abs(sw / sh - w / h) < 0.02,
      `cover 变形 ${sw}/${sh} vs ${w}/${h}`
    );
    assert.ok(Math.abs(w / h - 0.75) < 0.02, `目标非 3:4 ${w}/${h}`);
  }
  const rows = new Map();
  for (const args of calls.images) {
    const y = Math.round(args[6]);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push(args);
  }
  const counts = [...rows.values()].map((arr) => arr.length);
  assert.deepEqual(counts, [1, 3, 5, 7, 9, 7]);
  for (const arr of rows.values()) {
    const left = Math.min(...arr.map((a) => a[5]));
    const right = Math.max(...arr.map((a) => a[5] + a[7]));
    const mid = (left + right) / 2;
    assert.ok(Math.abs(mid - 540) < 2, `行未居中 mid=${mid}`);
  }
  const longTitle = "很长的标题".repeat(30);
  const titleFont = calls.textFonts.find(([t]) => t === longTitle);
  assert.ok(titleFont, "长标题应完整落笔");
  const size = Number(/(\d+)px/.exec(titleFont[1])[1]);
  assert.ok(size < 64, `长标题应缩小字号，实际 ${size}px`);
});

test("draw：短标题用最大字号 64px 绘制", () => {
  const { calls } = drawWith(7);
  const titleFont = calls.textFonts.find(([t]) => t === "我的 48 Group 神7");
  assert.ok(
    titleFont && titleFont[1].includes("64px"),
    titleFont && titleFont[1]
  );
});

test("draw：cardStroke 0 不描卡片边（原版），默认 3px（贴纸）", () => {
  assert.equal(poster.defaultTokens().cardStroke, 3);
  const sticker = drawWith(7);
  assert.ok(sticker.calls.strokes.includes(3), "贴纸应有 3px 卡片描边");
  const members = people(7);
  members.forEach((m, i) => (m.subtitle = `副${i + 1}`));
  const { ctx, calls } = fakeCtx();
  poster.draw(ctx, {
    members,
    images: members.map(() => null),
    title: "x",
    dateText: "y",
    hashtag: "z",
    photoSrc: "w",
    subOf: (m) => m.subtitle,
    tokens: { cardStroke: 0 },
  });
  assert.ok(
    calls.strokes.every((w) => w <= 2),
    "原版不应有卡片描边（只余页脚 2px）"
  );
  assert.ok(calls.strokes.includes(2), "页脚分隔线仍描边");
});

test("draw 自行声明画布尺寸：7/16/32 由成员数决定", () => {
  for (const [n, h] of [
    [7, 1440],
    [16, 1920],
    [32, 1440],
  ]) {
    const { ctx } = drawWith(n);
    assert.equal(ctx.canvas.width, 1080, `${n} 宽`);
    assert.equal(ctx.canvas.height, h, `${n} 高`);
  }
});

function fakeImgs(n) {
  return Array.from({ length: n }, () => ({ width: 720, height: 960 }));
}

function runStyle(style, n) {
  const members = people(n);
  members.forEach((m, i) => (m.subtitle = `副标题${i + 1}`));
  const { ctx, calls } = fakeCtx();
  const opts = {
    members,
    images: fakeImgs(n),
    title: "我的 48 Group 圈内",
    dateText: "48 Group 好き顔ソート · 2026.09.28",
    hashtag: "#48Group",
    photoSrc: "写真：48pedia",
    subOf: (m) => m.subtitle,
  };
  poster.draw(ctx, style ? { ...opts, style } : opts);
  return { members, calls, ctx };
}

test("默认样式 = a：省略 style 与 style:'a' 的调用序列完全一致", () => {
  assert.deepEqual(runStyle(undefined, 32).calls, runStyle("a", 32).calls);
});

test("四样式 × 7/16/32/40：画布尺寸正确、全员上图、所有绘制都在画布内", () => {
  for (const style of poster.styles) {
    for (const n of [7, 16, 32, 40]) {
      const { calls, ctx } = runStyle(style, n);
      const want = poster.layout(n);
      assert.equal(ctx.canvas.width, want.width, `${style}/${n} 宽`);
      assert.equal(ctx.canvas.height, want.height, `${style}/${n} 高`);
      assert.ok(
        calls.images.length >= n,
        `${style}/${n} 只画了 ${calls.images.length} 张图`
      );
      for (let ii = 0; ii < calls.images.length; ii++) {
        const [, , , , , x, y, w, h] = calls.images[ii];
        const mat = calls.imagesM[ii];
        const world = (px, py) => [
          mat[0] * px + mat[2] * py + mat[4],
          mat[1] * px + mat[3] * py + mat[5],
        ];
        const corners = [
          world(x, y),
          world(x + w, y),
          world(x, y + h),
          world(x + w, y + h),
        ];
        for (const [cx, cy] of corners) {
          assert.ok(
            cx >= -0.5 &&
              cy >= -0.5 &&
              cx <= want.width + 0.5 &&
              cy <= want.height + 0.5,
            `${style}/${n} 越界: (${Math.round(cx)},${Math.round(cy)})`
          );
        }
      }
      assert.ok(
        !calls.texts.some((x) => x.includes("undefined")),
        `${style}/${n} 文案含 undefined`
      );
    }
  }
});

test("B/C/D：全员名字与名次都落笔（对比 a 只画前 16 名）", () => {
  for (const style of ["b", "c", "d"]) {
    for (const n of [7, 16, 32, 40]) {
      const { members, calls } = runStyle(style, n);
      for (const m of members)
        assert.ok(
          calls.texts.includes(m.name),
          `${style}/${n} 缺名字 ${m.name}`
        );
      const nums = new Set(
        calls.texts.filter((x) => /^\d{1,2}$/.test(x)).map(Number)
      );
      for (let i = 1; i <= n; i++)
        assert.ok(nums.has(i), `${style}/${n} 缺名次 ${i}`);
    }
  }
});

test("四样式都消费注入令牌：ink 随 tokens 变、cardStroke=0 不描边、=3 描边", () => {
  const run = (style, tokens) => {
    const members = people(16);
    const { ctx, calls } = fakeCtx();
    poster.draw(ctx, {
      members,
      images: fakeImgs(16),
      title: "T",
      dateText: "D",
      hashtag: "#H",
      photoSrc: "P",
      subOf: () => "s",
      style,
      tokens,
    });
    return calls;
  };
  for (const style of poster.styles) {
    const thin = run(style, { colors: { ink: "#123456" }, cardStroke: 0 });
    const thick = run(style, { colors: { ink: "#654321" }, cardStroke: 3 });
    assert.ok(thin.fills.includes("#123456"), `${style} 未用注入 ink`);
    assert.ok(thick.fills.includes("#654321"), `${style} 未用注入 ink`);
    assert.ok(thick.fonts.length > 0, style);
    assert.ok(
      thick.strokes.length > thin.strokes.length,
      `${style} cardStroke=3 未描边（thin=${thin.strokes.length} thick=${thick.strokes.length}）`
    );
    assert.ok(!thin.strokes.includes(3), `${style} cardStroke=0 仍描边 3px`);
  }
});

test("C 领奖台：前三张照片互不重叠且整体居中（7/16/32）", () => {
  for (const n of [7, 16, 32, 40]) {
    const { calls } = runStyle("c", n);
    const rects = calls.images.slice(0, 3).map((args, i) => {
      const [, , , , , x, y, w, h] = args;
      const mat = calls.imagesM[i];
      const x0 = mat[0] * x + mat[2] * y + mat[4];
      const y0 = mat[1] * x + mat[3] * y + mat[5];
      return { x0, y0, x1: x0 + w, y1: y0 + h };
    });
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const ox = Math.max(
          0,
          Math.min(rects[i].x1, rects[j].x1) -
            Math.max(rects[i].x0, rects[j].x0)
        );
        const oy = Math.max(
          0,
          Math.min(rects[i].y1, rects[j].y1) -
            Math.max(rects[i].y0, rects[j].y0)
        );
        assert.equal(ox * oy, 0, `c/${n} 第 ${i + 1} 与 ${j + 1} 张重叠`);
      }
    }
    const left = Math.min(...rects.map((r) => r.x0));
    const right = Math.max(...rects.map((r) => r.x1));
    assert.ok(
      Math.abs((left + right) / 2 - 540) < 12,
      `c/${n} 未居中: ${(left + right) / 2}`
    );
  }
});

test("A 40 档金字塔：行分布 1-3-5-7-9-11-4、前 4 行带名字", () => {
  const { members, calls } = runStyle("a", 40);
  const rowsMap = new Map();
  for (let i = 0; i < 40; i++) {
    const y = calls.images[i][6];
    rowsMap.set(y, (rowsMap.get(y) || 0) + 1);
  }
  const counts = [...rowsMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, c]) => c);
  assert.deepEqual(counts, [1, 3, 5, 7, 9, 11, 4]);
  members.forEach((m, i) =>
    assert.equal(calls.texts.includes(m.name), i < 16, `名字可见性 ${m.name}`)
  );
});

test("D 拼贴：拍立得消费 cardStroke（贴纸 ≥ 人数条 3px 墨描边；原版 0）", () => {
  const run = (n, cs) => {
    const { ctx, calls } = fakeCtx();
    poster.draw(ctx, {
      members: people(n),
      images: fakeImgs(n),
      title: "T",
      dateText: "D",
      hashtag: "#H",
      photoSrc: "P",
      subOf: () => "s",
      style: "d",
      tokens: { cardStroke: cs },
    });
    return calls.strokes.filter((w) => w === 3).length;
  };
  assert.equal(run(7, 0), 0);
  assert.ok(run(7, 3) >= 7, `7 人贴纸应有 ≥7 条 3px 描边，实际 ${run(7, 3)}`);
  assert.ok(run(32, 3) >= 32, `32 人贴纸应有 ≥32 条 3px 描边`);
});

test("全员无照片时每个位置都有占位（四样式 × 三档，占位与首字）", () => {
  // 收口成一处绘制点之后，「没有照片」这件事的结果不再取决于样式：
  // 每一格要么有脸，要么有底色 + 名字首字。c（榜单）此前是**零占位**——
  // 领奖台与紧凑榜行只有 if (images[i]) 没有 else，40 档离线时 37/40 没有脸。
  for (const [style, n] of [
    ["a", 7],
    ["b", 7],
    ["c", 7],
    ["d", 7],
    ["a", 16],
    ["c", 16],
    ["c", 40],
  ]) {
    const members = people(n);
    const { ctx, calls } = fakeCtx();
    poster.draw(ctx, {
      members,
      images: members.map(() => null),
      title: "T",
      dateText: "D",
      hashtag: "#H",
      photoSrc: "P",
      subOf: () => "s",
      style,
      tokens: { colors: { placeholder: "#123456", placeholderInk: "#654321" } },
    });
    const fills = calls.fills.filter((f) => f === "#123456").length;
    assert.equal(
      fills,
      n,
      `${style}/${n} 档：占位底色应画满 ${n} 格，实际 ${fills}`
    );
    assert.ok(
      calls.fills.includes("#654321"),
      `${style}/${n} 档：占位首字未用注入的 placeholderInk`
    );
  }
});

test("占位视觉消费 tokens（placeholder / placeholderInk，四样式都不许硬编码残留）", () => {
  for (const style of ["a", "b", "c", "d"]) {
    const members = people(7);
    const { ctx, calls } = fakeCtx();
    poster.draw(ctx, {
      members,
      images: members.map(() => null),
      title: "T",
      dateText: "D",
      hashtag: "#H",
      photoSrc: "P",
      subOf: () => "s",
      style,
      tokens: { colors: { placeholder: "#123456", placeholderInk: "#654321" } },
    });
    assert.ok(calls.fills.includes("#123456"), `${style} 未用注入的占位底色`);
    assert.ok(
      !calls.fills.includes("#e4e7ee"),
      `${style} 仍有硬编码占位底色残留`
    );
    assert.ok(calls.fills.includes("#654321"), `${style} 未用注入的占位字色`);
  }
});
