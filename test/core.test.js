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
