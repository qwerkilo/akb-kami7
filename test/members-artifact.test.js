const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const core = require("../core.js");

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
  "=LOVE": 12,
  "≠ME": 12,
  "≒JOY": 13,
  "モーニング娘。": 51,
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
  "=LOVE",
  "≠ME",
  "≒JOY",
  "モーニング娘。",
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
  "=LOVE": "love",
  "≠ME": "love",
  "≒JOY": "love",
  "モーニング娘。": "morning",
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
      assert.equal(typeof m.kana, "string", `kana 缺失: ${m.name}`);
      assert.equal(typeof m.nick, "string", `nick 缺失: ${m.name}`);
      assert.ok(
        m.end === null || typeof m.end === "string",
        `end 类型: ${m.name}`
      );
      assert.ok(m.status === "current" || m.status === "former");
      assert.equal(typeof m.img, "boolean");
      assert.ok(!ids.has(m.id), `重复 id: ${m.id}`);
      ids.add(m.id);
    }
  }
});

test("十三个团体齐备且首个出现顺序固定", () => {
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
  assert.deepEqual([...seen].sort(), ["48g", "love", "morning", "sakamichi"]);
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

test("成员 bio：生年月日基本齐全、出身地多数、字段合法", () => {
  const all = loadGroups().flatMap((g) => g.members);
  assert.ok(all.length > 1000);
  const withBirth = all.filter(
    (m) => m.bio && /^\d{4}\.\d{2}\.\d{2}$/.test(m.bio.birth)
  );
  assert.ok(
    withBirth.length >= all.length - 2,
    `birth 覆盖 ${withBirth.length}/${all.length}`
  );
  const withFrom = all.filter((m) => m.bio && m.bio.from);
  assert.ok(
    withFrom.length >= all.length - 60,
    `from 覆盖 ${withFrom.length}/${all.length}`
  );
  const BIO_KEYS = [
    "birth",
    "from",
    "height",
    "blood",
    "sign",
    "hobby",
    "skill",
    "nick",
    "romaji",
  ];
  for (const m of all) {
    for (const k of Object.keys(m.bio || {})) {
      assert.ok(BIO_KEYS.includes(k), `未知 bio 字段 ${k}（${m.name}）`);
    }
  }
  const love = loadGroups()
    .filter((g) => g.series === "love")
    .flatMap((g) => g.members);
  assert.equal(love.length, 37);
  for (const m of love) {
    assert.ok(m.bio && m.bio.birth, `等爱成员缺生日 ${m.name}`);
    assert.ok(m.bio.from, `等爱成员缺出身地 ${m.name}`);
  }
});

test("img 标志与站内图片文件一致（img:true ⟺ full 与 thumb 都在且非空）", () => {
  const mismatch = [];
  for (const g of loadGroups()) {
    for (const m of g.members) {
      const usable = ["full", "thumb"].every((dir) => {
        const p = path.join(__dirname, "..", "img", dir, `${m.id}.webp`);
        return fs.existsSync(p) && fs.statSync(p).size > 0;
      });
      if (usable !== m.img) mismatch.push(`${m.name}(${m.id}) img=${m.img}`);
    }
  }
  assert.deepEqual(
    mismatch,
    [],
    `img 标志与站内文件不一致：${mismatch.slice(0, 5).join("、")}`
  );
});

test("照片回退链：与站点无关的三段在共享模块，与站点有关的留在 loader（工单 01）", () => {
  const chain = fs.readFileSync(
    path.join(__dirname, "..", "scripts", "photo_chain.py"),
    "utf8"
  );
  const love = fs.readFileSync(
    path.join(__dirname, "..", "scripts", "love_members.py"),
    "utf8"
  );

  // 共享模块里只允许这三段 —— 站点有关的（archived_*）编码的是某个站的 HTML 形状
  const defs = [...chain.matchAll(/^def (\w+)/gm)].map((m) => m[1]).sort();
  assert.deepEqual(
    defs,
    ["cdx_rows", "commons_photo", "wayback_photo"],
    "photo_chain.py 只该有与站点无关的三段（多了说明站点相关的漏进来了，少了说明共享的没搬干净）"
  );
  for (const siteBound of ["archived_photo_pairs", "archived_list_photos"]) {
    assert.ok(
      !chain.includes(siteBound),
      `${siteBound} 是站点相关的，不该在共享模块`
    );
    assert.ok(
      love.includes(siteBound),
      `${siteBound} 丢了 —— 它编码的是等爱旧站的 HTML 形状`
    );
  }

  // 等爱必须真的用上共享模块（否则「搬走」只是复制，两条链会各自漂移）
  for (const fn of ["cdx_rows", "wayback_photo", "commons_photo"]) {
    assert.ok(
      love.includes(`photo_chain.${fn}(`),
      `love_members 必须调 photo_chain.${fn}()，不能自己留一份`
    );
  }
  assert.ok(
    !/^def (cdx_rows|wayback_photo|commons_photo)\(/m.test(love),
    "love_members 里不该还有这三段的定义"
  );
});

test("早安：一系列一团、18 期可筛、成员数落在区间", () => {
  // 人数区间而不是精确值：上游会动（卒业/加入），而「抓到 3 个人」那种塌陷
  // 必须让产物测试红 —— 源门只挡「相对基线腰斩」，首次生成时它根本不响。
  const secs = loadGroups().filter((g) => g.series === "morning");
  assert.equal(secs.length, 1, "早安应是一系列一团（ADR-0021）");
  assert.equal(secs[0].group, "モーニング娘。");
  const members = secs[0].members;
  assert.ok(
    members.length >= 40 && members.length <= 60,
    `早安成员数 ${members.length} 不在 [40, 60]`
  );
  assert.equal(
    members.filter((m) => m.status === "current").length,
    members.length - members.filter((m) => m.status !== "current").length
  );
  // 期生是筛选字段，早安有 18 期 —— 缺了期生就等于「按期筛」这个功能对早安失效
  const gens = new Set(members.map((m) => m.generation).filter(Boolean));
  assert.ok(gens.size >= 10, `早安只认出 ${gens.size} 种期生`);
  // 毕业成员必须带毕业日（站内资料卡按它分组）
  for (const m of members.filter((x) => x.status !== "current")) {
    assert.match(m.end || "", /^\d{4}(\.\d{2}\.\d{2})?$/, `${m.name} 缺毕业日`);
  }
});

function crossSeriesNameCollisions() {
  const seen = new Map();
  for (const sec of loadGroups()) {
    for (const m of sec.members) {
      const key = core.normalizeName(m.name);
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push({ sec, m });
    }
  }
  const out = [];
  for (const [key, hits] of seen) {
    if (hits.length < 2) continue;
    const series = new Set(hits.map((h) => h.sec.series));
    if (series.size < 2) continue; // 同一系列内多段（跨团兼任）不算
    out.push({
      key,
      name: hits[0].m.name,
      series: [...series].join("/"),
      kanaCount: new Set(hits.map((h) => h.m.kana)).size,
    });
  }
  return out;
}

test("现役成员不得跨系列重复；已知的同名不同人按名单放行（ADR-0021 的自动化兑现）", () => {
  // ADR-0021 说「重叠」是本站**不会报错**的隐患：同一个人在两个系列里各有一份档案，
  // 产物测试与源门都不会响。加这条守卫时它立刻抓到一对同名：
  //   HKT48 的 音嶋莉沙（毕业） / =LOVE 的 音嶋莉沙（现役）—— 两个人，同名同假名读音。
  // 所以判据是「**现役**不得跨系列重复」：一个现役同时出现在两个系列的现役名册里
  // 一定是重复档案；而「某系列的毕业者」与「另一系列的现役」同名是现实，不是缺陷。
  const KNOWN_DIFFERENT_PEOPLE = new Set(["音嶋莉沙"]);
  const active = new Map();
  const dupes = [];
  for (const sec of loadGroups()) {
    for (const m of sec.members) {
      if (m.status !== "current") continue;
      const key = core.normalizeName(m.name);
      if (active.has(key))
        dupes.push(`${m.name}（${active.get(key)} / ${sec.series}）`);
      else active.set(key, sec.series);
    }
  }
  assert.deepEqual(dupes, [], `现役跨系列重复：${dupes.join("、")}`);

  // 同名的「不同人」要**显式**放行，且必须同假名读音 —— 否则它就是重复档案。
  // 新增同名对时这条会红，逼人确认它是两个人而不是抓漏了。
  const collisions = crossSeriesNameCollisions();
  const unreviewed = collisions
    .filter((x) => !KNOWN_DIFFERENT_PEOPLE.has(x.key))
    .map((x) => `${x.name} 跨 ${x.series} 同名`);
  assert.deepEqual(unreviewed, [], "跨系列同名未复核");
  // 放行名单里的每一对都必须是「同假名读音的两个人」，不是重复档案。
  // ⚠️ 这条**今天不会红**（数据里没有「同名但假名不同」的对）—— 它是**棘轮**，
  // 对未来数据生效，不是当下的检查。别把它当「已验证」写进提交信息。
  for (const x of collisions.filter((c) => KNOWN_DIFFERENT_PEOPLE.has(c.key))) {
    assert.equal(
      x.kanaCount,
      1,
      `${x.name} 在放行名单里但假名读音不同 —— 那就不是同一个人`
    );
  }
});
