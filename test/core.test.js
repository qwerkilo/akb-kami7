const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../core.js");

test("replay 按答案序列还原对决过程与最终名次", () => {
  assert.deepEqual(core.replay(["a", "b"], [true]), {
    done: true,
    order: ["a", "b"],
  });
  assert.deepEqual(core.replay(["a", "b"], [false]), {
    done: true,
    order: ["b", "a"],
  });

  const order = ["a", "b", "c"];
  assert.deepEqual(core.replay(order, []), { done: false, pair: ["b", "c"] });
  assert.deepEqual(core.replay(order, [false]), {
    done: false,
    pair: ["a", "c"],
  });
  assert.deepEqual(core.replay(order, [false, false]), {
    done: false,
    pair: ["a", "b"],
  });
  assert.deepEqual(core.replay(order, [false, false, true]), {
    done: true,
    order: ["c", "a", "b"],
  });
});

test("worstCase 给出归并排序最大比较次数", () => {
  assert.equal(core.worstCase(1), 0);
  assert.equal(core.worstCase(2), 1);
  assert.equal(core.worstCase(3), 3);
  assert.equal(core.worstCase(7), 14);
  assert.equal(core.worstCase(16), 49);
});

test("normalizeName 去空白、转小写并统一汉字变体", () => {
  assert.equal(core.normalizeName("  山﨑 天 "), "山崎天");
  assert.equal(core.normalizeName("Watanabe Mayu"), "watanabemayu");
  assert.equal(core.normalizeName("髙橋"), "高橋");
  assert.equal(core.normalizeName("德永"), "徳永");
});

test("isVisible 按状态筛选", () => {
  assert.equal(core.isVisible({ status: "current" }, "all"), true);
  assert.equal(core.isVisible({ status: "current" }, "current"), true);
  assert.equal(core.isVisible({ status: "current" }, "former"), false);
  assert.equal(core.isVisible({ status: "former" }, "former"), true);
});

test("shuffle 只重排不增删元素", () => {
  const out = core.shuffle([1, 2, 3, 4, 5]);
  assert.deepEqual(
    [...out].sort((a, b) => a - b),
    [1, 2, 3, 4, 5]
  );
});

test("normalizeName 把片假名归一为平假名", () => {
  assert.equal(core.normalizeName("サシハラ リノ"), "さしはらりの");
  assert.equal(core.normalizeName("マイダ アツコ"), "まいだあつこ");
});

test("haystack 覆盖名字、假名与昵称", () => {
  const m = { name: "指原莉乃", kana: "さしはら りの", nick: "さっしー" };
  const hay = core.haystack(m);
  for (const q of ["指原", "さしはら", "サシハラ", "さっしー", "サッシー"]) {
    assert.ok(hay.includes(core.normalizeName(q)), `应命中: ${q}`);
  }
  assert.equal(core.haystack({ name: "前田敦子" }), "前田敦子");
});

test("photoSrc 对有图成员给出图片路径，对无图成员给出占位图", () => {
  assert.equal(
    core.photoSrc({ id: "m1", img: true }, "thumb"),
    "img/thumb/m1.webp"
  );
  assert.equal(
    core.photoSrc({ id: "m1", img: true }, "full"),
    "img/full/m1.webp"
  );
  const ph = core.photoSrc({ id: "m2", img: false, name: "無写真子" }, "thumb");
  assert.ok(ph.startsWith("data:image/svg+xml"));
  assert.ok(decodeURIComponent(ph).includes("無"));
  assert.ok(
    core
      .photoSrc({ id: "m3", img: false, name: "" }, "thumb")
      .startsWith("data:image/svg+xml")
  );
});

test("normalizeName 去掉连续空白", () => {
  assert.equal(core.normalizeName("  渡辺  麻友 "), "渡辺麻友");
});

test("haystack 合并多个字段并忽略空字段", () => {
  assert.equal(
    core.haystack({ name: " 前田 敦子 ", kana: "まえだ あつこ", nick: "" }),
    "前田敦子まえだあつこ"
  );
  assert.equal(core.haystack({ name: "KONAN", kana: "コナン" }), "konanこなん");
});

test("placeholderSrc 只取名字首字符", () => {
  const svg = decodeURIComponent(core.placeholderSrc("甲乙"));
  assert.ok(svg.includes("甲"));
  assert.ok(!svg.includes("乙"));
});

test("shuffle 用 Fisher-Yates：固定随机数时结果确定", () => {
  const original = Math.random;
  Math.random = () => 0.999;
  try {
    assert.deepEqual(core.shuffle([1, 2, 3]), [1, 2, 3]);
  } finally {
    Math.random = original;
  }
});

test("groupSections 按团体过滤并保留分段序号", () => {
  const sections = [
    { group: "AKB48", label: "1期生", members: [{ id: "a" }] },
    { group: "SKE48", label: "1期生", members: [{ id: "b" }] },
    { group: "AKB48", label: "2期生", members: [{ id: "c" }] },
  ];
  const all = core.groupSections(sections, "all");
  assert.deepEqual(
    all.map((g) => g.group),
    ["AKB48", "SKE48"]
  );
  assert.deepEqual(
    all[0].sections.map((s) => s.index),
    [0, 2]
  );
  assert.deepEqual(
    all[0].sections.map((s) => s.label),
    ["1期生", "2期生"]
  );

  const ske = core.groupSections(sections, "SKE48");
  assert.deepEqual(
    ske.map((g) => g.group),
    ["SKE48"]
  );
  assert.deepEqual(
    ske[0].sections.map((s) => s.index),
    [1]
  );

  assert.deepEqual(core.groupSections(sections, "NMB48"), []);
});

test("normalizeName 归一全部七组汉字变体", () => {
  assert.deepEqual(
    ["﨑", "髙", "邉", "邊", "濵", "德", "瀨"].map((c) =>
      core.normalizeName(c)
    ),
    ["崎", "高", "辺", "辺", "浜", "徳", "瀬"]
  );
});

test("placeholderSrc 转义名字首字符的 XML 特殊字符", () => {
  const cases = [
    ["&B<C>", "&amp;"],
    ["<C>A", "&lt;"],
    [">A<B", "&gt;"],
    ['"A<B', "&quot;"],
  ];
  for (const [name, entity] of cases) {
    const svg = decodeURIComponent(core.placeholderSrc(name));
    assert.ok(svg.includes(entity), `${name} 应输出实体 ${entity}`);
    assert.ok(!/&(?!(amp|lt|gt|quot);)/.test(svg), `${name} 不应出现裸 &`);
  }
});

test("placeholderSrc 对空名与纯空白名回退问号", () => {
  for (const name of ["", "   "]) {
    const svg = decodeURIComponent(core.placeholderSrc(name));
    assert.ok(svg.includes("?"), `${JSON.stringify(name)} 应回退为 ?`);
  }
});

test("shuffle 确实会重排元素顺序", () => {
  const base = [1, 2, 3, 4, 5, 6];
  let changed = false;
  for (let i = 0; i < 30 && !changed; i++) {
    const out = core.shuffle([...base]);
    if (out.join() !== base.join()) changed = true;
  }
  assert.ok(changed, "30 次洗牌应至少出现一次顺序不同");
});

// ---- 成员字幕 module ----
const t = (key, ...args) =>
  args.length ? `[${key}:${args.join(",")}]` : `[${key}]`;
const person = (over = {}) => ({
  name: "甲",
  group: "AKB48",
  generation: "1期生",
  status: "current",
  ...over,
});

test("字幕：现役与毕业的基本形态", () => {
  assert.equal(core.metaText(person(), t, "zh"), "[active]");
  assert.equal(
    core.metaText(person({ status: "former", end: "2012.06.01" }), t, "zh"),
    "[grad_year:2012]"
  );
  assert.equal(core.fullMeta(person(), t, "zh"), "AKB48 · 1期生 · [active]");
  assert.equal(
    core.fullMeta(person({ status: "former", end: "2012.06.01" }), t, "zh"),
    "AKB48 · 1期生 · [grad_year:2012]"
  );
});

test("字幕：来源标注走 i18n，英文用逗号连接", () => {
  const cur = person({ extras: [{ group: "SKE48", current: true }] });
  assert.equal(
    core.metaText(cur, t, "zh"),
    "[src_concurrent:SKE48] · [active]"
  );
  assert.equal(
    core.sourceNote(
      person({
        extras: [
          { group: "A", current: true },
          { group: "B", current: true },
        ],
      }),
      t,
      "en"
    ),
    "[src_concurrent:A, B]"
  );
  const mixed = person({
    status: "former",
    end: "2016.01.01",
    extras: [{ group: "NMB48", current: false }],
  });
  assert.equal(
    core.metaText(mixed, t, "zh"),
    "[src_mixed:NMB48] · [grad_year:2016]"
  );
});

test("字幕：移籍/兼任加入成员的来源与毕业年份", () => {
  const transfer = person({
    generation: "兼任・移籍加入",
    status: "former",
    leave: "兼任解除",
    end: "2015.05.14",
    note: "SKE48 1期",
  });
  assert.equal(core.isTransfer(transfer), true);
  assert.equal(core.metaText(transfer, t, "zh"), "SKE48 1期 · 2015 兼任解除");
  assert.equal(core.posterSub(transfer, t, "zh"), "SKE48 1期 · 兼任解除");
  assert.equal(core.leaveText("兼任解除", t, "en"), "[leave_兼任解除]");
});

test("字幕：海报副标题全分支且不产生 undefined", () => {
  assert.equal(core.posterSub(person(), t, "zh"), "1期生");
  assert.equal(
    core.posterSub(person({ status: "former", end: "2012.06.01" }), t, "zh"),
    "1期生 · 2012 [grad_short]"
  );
  assert.equal(
    core.posterSub(
      person({ status: "former", leave: "卒業", end: "2012.06.01" }),
      t,
      "zh"
    ),
    "1期生 · 2012 卒業"
  );
  assert.equal(
    core.posterSub(person({ status: "former" }), t, "zh"),
    "1期生 · OG"
  );
  assert.equal(
    core.posterSub(
      person({ generation: "兼任・移籍加入", status: "former" }),
      t,
      "zh"
    ),
    ""
  );
  assert.equal(
    core.posterSub(
      person({ extras: [{ group: "SKE48", current: true }] }),
      t,
      "zh"
    ),
    "1期生"
  );
});

test("foldIndex 反转折叠表，haystack 支持简体输入", () => {
  const fold = core.foldIndex({ 边: ["邊", "辺"], 宫: ["宮"], 马: ["馬"] });
  assert.deepEqual(fold, { 邊: "边", 辺: "边", 宮: "宫", 馬: "马" });
  const m = { name: "渡辺麻友", kana: "わたなべ まゆ", nick: "まゆゆ" };
  const hay = core.haystack(m, fold);
  assert.ok(hay.includes("渡辺麻友"));
  assert.ok(hay.includes("渡边麻友"));
});

test("haystack 无折叠表时行为不变", () => {
  assert.equal(
    core.haystack({ name: "高橋みなみ", kana: "たかはし みなみ" }),
    core.normalizeName("高橋みなみ たかはし みなみ")
  );
});

test("持久化：序列化往返与损坏数据安全丢弃", () => {
  const state = {
    size: 16,
    selected: ["a", "b"],
    duel: { order: ["a", "b", "c"], answers: [true] },
  };
  assert.deepEqual(core.deserializeState(core.serializeState(state)), state);
  assert.equal(core.deserializeState("not json"), null);
  assert.equal(core.deserializeState(JSON.stringify({ v: 0, size: 7 })), null);
  assert.equal(core.deserializeState(JSON.stringify({ v: 1, size: 9 })), null);
  const messy = core.deserializeState(
    JSON.stringify({ v: 1, size: 7, selected: [1, "a", null], duel: null })
  );
  assert.deepEqual(messy.selected, ["a"]);
  assert.equal(messy.duel, null);
  const badDuel = core.deserializeState(
    JSON.stringify({
      v: 1,
      size: 7,
      selected: [],
      duel: { order: ["a"], answers: "x" },
    })
  );
  assert.equal(badDuel.duel, null);
});

test("对决进度：32 档最坏 129 与百分比/预计时长", () => {
  assert.equal(core.worstCase(32), 129);
  assert.deepEqual(core.duelProgress(32, 0), {
    answered: 0,
    max: 129,
    percent: 0,
    remaining: 129,
    etaSeconds: 645,
  });
  assert.deepEqual(core.duelProgress(7, 14), {
    answered: 14,
    max: 14,
    percent: 100,
    remaining: 0,
    etaSeconds: 0,
  });
});

test("持久化：32 档对决进度（129 答）可恢复，超出最坏题数丢弃", () => {
  const order = Array.from({ length: 32 }, (_, i) => `id${i}`);
  const answers = [...Array(129)].map(() => true);
  const st = core.deserializeState(
    JSON.stringify({
      v: 1,
      size: 32,
      selected: order,
      duel: { order, answers },
    })
  );
  assert.equal(st.duel.answers.length, 129);
  const tooMany = core.deserializeState(
    JSON.stringify({
      v: 1,
      size: 32,
      selected: order,
      duel: { order, answers: [...answers, true] },
    })
  );
  assert.equal(tooMany.duel, null);
});
