const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadGroups() {
  const src = fs.readFileSync(path.join(__dirname, "..", "members.js"), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(src, sandbox);
  return sandbox.window.AKB_GROUPS;
}

// 48pedia 2026-09-27 抓取、跨团去重后的快照；上游变化时更新此表
const GROUP_COUNTS = {
  AKB48: 340,
  SKE48: 233,
  NMB48: 210,
  HKT48: 119,
  NGT48: 90,
  STU48: 96,
  SDN48: 46,
  乃木坂46: 100,
  櫻坂46: 58,
  日向坂46: 46,
};
const GROUP_ORDER = [
  "AKB48",
  "SKE48",
  "NMB48",
  "HKT48",
  "NGT48",
  "STU48",
  "SDN48",
  "乃木坂46",
  "櫻坂46",
  "日向坂46",
];
const SERIES_OF = {
  AKB48: "48g",
  SKE48: "48g",
  NMB48: "48g",
  HKT48: "48g",
  NGT48: "48g",
  STU48: "48g",
  SDN48: "48g",
  乃木坂46: "sakamichi",
  櫻坂46: "sakamichi",
  日向坂46: "sakamichi",
};

function loadSimplified() {
  const src = fs.readFileSync(
    path.join(__dirname, "..", "simplified.js"),
    "utf8"
  );
  const sandbox = { window: {} };
  vm.runInNewContext(src, sandbox);
  return sandbox.window.AKB_SIMPLIFIED;
}

test("members.js 暴露非空的成员分组", () => {
  const groups = loadGroups();
  assert.ok(Array.isArray(groups));
  assert.ok(groups.length > 0);
});

test("每个分组有 label 与 members，成员字段完整且 id 唯一", () => {
  const groups = loadGroups();
  const ids = new Set();
  for (const section of groups) {
    assert.equal(typeof section.label, "string");
    assert.ok(Array.isArray(section.members));
    for (const m of section.members) {
      assert.equal(typeof m.id, "string");
      assert.equal(typeof m.name, "string");
      assert.ok(m.status === "current" || m.status === "former");
      assert.equal(typeof m.img, "boolean");
      assert.ok(!ids.has(m.id), `重复 id: ${m.id}`);
      ids.add(m.id);
    }
  }
});

test("十个团体齐备且首个出现顺序固定", () => {
  const seen = [];
  for (const section of loadGroups()) {
    if (!seen.includes(section.group)) seen.push(section.group);
  }
  assert.deepEqual(seen, GROUP_ORDER);
});

test("每个分段带 series 且与团体对应", () => {
  const seen = new Set();
  for (const section of loadGroups()) {
    assert.equal(
      section.series,
      SERIES_OF[section.group],
      `${section.group} 的 series 不符`
    );
    seen.add(section.series);
  }
  assert.deepEqual([...seen].sort(), ["48g", "sakamichi"]);
});

test("simplified.js 折叠表结构合法且覆盖常见简体字", () => {
  const pairs = loadSimplified();
  assert.ok(pairs && typeof pairs === "object");
  assert.ok(Object.keys(pairs).length > 100);
  for (const [sim, forms] of Object.entries(pairs)) {
    assert.equal(sim.length, 1, `键应为单个汉字: ${sim}`);
    assert.ok(Array.isArray(forms) && forms.length > 0, `${sim} 缺折叠目标`);
    for (const form of forms) assert.equal(typeof form, "string");
  }
  assert.deepEqual([...pairs["边"]], ["邊", "辺"]);
  assert.ok(pairs["桥"].includes("橋"));
  assert.ok(pairs["宫"].includes("宮"));
});

test("各团人数与快照一致", () => {
  const counts = {};
  for (const section of loadGroups()) {
    counts[section.group] =
      (counts[section.group] || 0) + section.members.length;
  }
  assert.deepEqual(counts, GROUP_COUNTS);
});

test("SDN48 成员全部为毕业", () => {
  const sdn = loadGroups().filter((s) => s.group === "SDN48");
  assert.ok(sdn.length > 0);
  for (const section of sdn) {
    for (const m of section.members) assert.equal(m.status, "former");
  }
});

test("成员字段无 wikitext/排序键残留", () => {
  for (const section of loadGroups()) {
    for (const m of section.members) {
      for (const field of ["name", "kana", "nick"]) {
        const v = m[field] || "";
        assert.ok(
          !/data-sort-value|[\[\]{}|]|<[^>]+>/.test(v),
          `${m.name} 的 ${field} 有残留: ${v}`
        );
      }
    }
  }
});

test("跨团来源以结构化 extras 表示，note 不写死标注文案", () => {
  let withExtras = 0;
  for (const section of loadGroups()) {
    for (const m of section.members) {
      if (m.extras) {
        withExtras++;
        for (const e of m.extras) {
          assert.equal(typeof e.group, "string");
          assert.equal(typeof e.current, "boolean");
        }
      }
      assert.ok(
        !/兼任|移籍/.test(m.note || ""),
        `${m.name} 的 note 含硬编码标注: ${m.note}`
      );
    }
  }
  assert.ok(withExtras > 0, "应存在带 extras 的合并成员");
});

test("每个分段都有期生标签，人物身份（姓名+假名）不重复", () => {
  const people = new Set();
  for (const section of loadGroups()) {
    assert.equal(typeof section.label, "string");
    assert.ok(section.label.length > 0);
    for (const m of section.members) {
      const key = `${m.name}#${m.kana || ""}`;
      assert.ok(!people.has(key), `重复人物: ${key}`);
      people.add(key);
    }
  }
});
