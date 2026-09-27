const { test } = require("node:test");
const assert = require("node:assert/strict");
const poster = require("../poster.js");

function fakeCtx() {
  const calls = { texts: [], fills: [], fonts: [] };
  const ctx = {
    canvas: { width: 1080, height: 1440 },
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arcTo() {},
    clip() {},
    fill() {},
    fillRect() {},
    stroke() {},
    translate() {},
    rotate() {},
    drawImage() {},
    fillText(text) {
      calls.texts.push(String(text));
    },
    measureText(s) {
      return { width: String(s).length * 10 };
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
  return { members, calls };
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

test("draw：32 人海报 8×4 网格，32 人全部在列", () => {
  const { members, calls } = drawWith(32);
  for (const m of members) {
    assert.ok(calls.texts.includes(m.name), `缺名字 ${m.name}`);
    assert.ok(calls.texts.includes(m.subtitle), `缺副标题 ${m.subtitle}`);
  }
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
