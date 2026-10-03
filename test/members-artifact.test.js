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

// 团体清单 = **规格**（顺序 / 人数快照 / 系列）。加团只改这一张表；
// 三张派生视图保持既有消费点不变。人数快照随上游变，改数据时一起改。
const MANIFEST = [
  { group: "AKB48", count: 340, series: "48g" },
  { group: "SKE48", count: 233, series: "48g" },
  { group: "NMB48", count: 210, series: "48g" },
  { group: "HKT48", count: 119, series: "48g" },
  { group: "NGT48", count: 90, series: "48g" },
  { group: "STU48", count: 96, series: "48g" },
  { group: "SDN48", count: 46, series: "48g" },
  { group: "乃木坂46", count: 100, series: "sakamichi" },
  { group: "櫻坂46", count: 58, series: "sakamichi" },
  { group: "日向坂46", count: 46, series: "sakamichi" },
  { group: "=LOVE", count: 12, series: "love" },
  { group: "≠ME", count: 12, series: "love" },
  { group: "≒JOY", count: 13, series: "love" },
  { group: "モーニング娘。", count: 51, series: "morning" },
  { group: "℃-ute", count: 8, series: "morning" },
  { group: "アンジュルム", count: 26, series: "morning" },
  { group: "Juice=Juice", count: 19, series: "morning" },
  { group: "つばきファクトリー", count: 17, series: "morning" },
  { group: "BEYOOOOONDS", count: 11, series: "morning" },
  { group: "OCHA NORMA", count: 10, series: "morning" },
  { group: "ロージークロニクル", count: 9, series: "morning" },
  { group: "Berryz工房", count: 7, series: "morning" },
  { group: "カントリー・ガールズ", count: 4, series: "morning" },
  { group: "こぶしファクトリー", count: 7, series: "morning" },
];
const GROUP_ORDER = MANIFEST.map((m) => m.group);
const GROUP_COUNTS = Object.fromEntries(
  MANIFEST.map((m) => [m.group, m.count])
);
const SERIES_OF = Object.fromEntries(MANIFEST.map((m) => [m.group, m.series]));

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

test("团体齐备且首个出现顺序固定", () => {
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

test("早安家族：十一个团、跨团合并只留一份、期生只有モーニング娘。有", () => {
  // 顺序从文件顶部的 GROUP_ORDER 派生（同文件里不再存第二份）；那份顺序是规格，
  // 由「各团人数与快照一致」等测试钉住，不靠这里再抄一遍。
  const ORDER = GROUP_ORDER.filter((g) => SERIES_OF[g] === "morning");
  const secs = loadGroups().filter((g) => g.series === "morning");
  assert.equal(
    secs.length,
    11,
    "早安系列应有 11 段（ADR-0021 修订 2：收叶不收伞）"
  );
  // 用 join 比字符串而不是 deepEqual：这些数组来自 vm 沙箱、是不同的 Array 实例，
  // assert/strict 的 deepEqual 会按原型判不等（原测试就是这么写的）。
  assert.equal(
    secs.map((s) => s.group).join("/"),
    ORDER.join("/"),
    "段顺序跟 GROUPS 配置走"
  );
  // label 与 group 都要钉：label 是界面上的段头、也是 flattenMembers 回填期生的
  // 来源（只钉 group 的话把 label 改成别的团名不会有任何测试红，变异实测存活）。
  assert.equal(
    secs.map((s) => s.label).join("/"),
    ORDER.join("/"),
    "段的 label 就是团名（界面段头）"
  );
  // 每团人数与快照一致（快照在文件顶部；上游变动时一起改）
  assert.equal(
    secs.map((s) => s.members.length).join("/"),
    ORDER.map((g) => GROUP_COUNTS[g]).join("/"),
    "每团人数与快照一致"
  );

  const byGroup = Object.fromEntries(secs.map((s) => [s.group, s.members]));
  // 已停止活动的四团全员毕业（决定 3；℃-ute 先例，站内只有 current/former 二值）
  for (const g of [
    "℃-ute",
    "Berryz工房",
    "カントリー・ガールズ",
    "こぶしファクトリー",
  ]) {
    assert.ok(
      byGroup[g].every((m) => m.status !== "current"),
      `${g} 应全员毕业（不是一两个）`
    );
  }
  // 七个现役团各自有现役（℃-ute/Berryz/カントリー/こぶし 不在此列）
  for (const g of [
    "モーニング娘。",
    "アンジュルム",
    "Juice=Juice",
    "つばきファクトリー",
    "BEYOOOOONDS",
    "OCHA NORMA",
    "ロージークロニクル",
  ]) {
    assert.ok(
      byGroup[g].some((m) => m.status === "current"),
      `${g} 应有现役`
    );
  }
  // 期生只有モーニング娘。有（决定 4）；其余十团一期都没有是事实，钉住它
  // 是为了将来有新人加入时不误判成解析坏了。
  assert.ok(
    new Set(byGroup["モーニング娘。"].map((m) => m.generation).filter(Boolean))
      .size >= 10,
    "モーニング娘。应认出 ≥10 期"
  );
  for (const g of ORDER.slice(1)) {
    assert.equal(
      new Set(byGroup[g].map((m) => m.generation).filter(Boolean)).size,
      0,
      `${g} 不该有期生`
    );
  }

  // 跨团合并（决定 2）：同一人只留一份，保留最近归属。这 6 人是真实数据里的
  // 转籍者（含与既有两团的合并：森戸知沙希→モーニング娘。、嗣永桃子→Berryz工房）。
  const MERGED = {
    森戸知沙希: "モーニング娘。",
    井上玲音: "Juice=Juice",
    梁川奈々美: "Juice=Juice",
    稲場愛香: "Juice=Juice",
    船木結: "アンジュルム",
    嗣永桃子: "カントリー・ガールズ",
  };
  const where = new Map();
  for (const s of secs) for (const m of s.members) where.set(m.name, s.group);
  for (const [name, group] of Object.entries(MERGED)) {
    assert.equal(where.get(name), group, `${name} 应合并进 ${group}`);
    assert.equal(
      secs.reduce(
        (n, s) => n + s.members.filter((m) => m.name === name).length,
        0
      ),
      1,
      `${name} 应只出现一次`
    );
  }

  // 身高「有就显示、没有就不占位」（决定 3）：列在哪些团的源里有是事实
  assert.equal(
    byGroup["モーニング娘。"].filter((m) => (m.bio || {}).height).length,
    0,
    "モーニング娘。的源没有身高列"
  );
  assert.equal(byGroup["℃-ute"].filter((m) => (m.bio || {}).height).length, 5);
  assert.equal(
    byGroup["BEYOOOOONDS"].filter((m) => (m.bio || {}).height).length,
    11
  );

  // 毕业日按源里有无：℃-ute「解散時」那张表**没有**毕业日列，那 5 人的 end 必然空
  // —— 空是事实，不许编。但「有过期在籍」那张表里有 → 那 3 人必须有。
  const cute = byGroup["℃-ute"];
  const cuteWithEnd = cute.filter((m) => m.end);
  assert.equal(
    cuteWithEnd.length,
    3,
    `℃-ute 有毕业日的应是 3 人，实际 ${cuteWithEnd.length}`
  );
  for (const m of cuteWithEnd) {
    assert.match(m.end, /^\d{4}\.\d{2}\.\d{2}$/, `${m.name} 毕业日格式`);
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
