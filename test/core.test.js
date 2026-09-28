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
  const maeda = core.haystack({ name: "前田敦子", kana: "まえだ あつこ" });
  assert.ok(maeda.startsWith("前田敦子まえだあつこ"), maeda);
  assert.ok(maeda.includes("maedaatsuko"), maeda);
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
  const hay = core.haystack({
    name: " 前田 敦子 ",
    kana: "まえだ あつこ",
    nick: "",
  });
  assert.ok(hay.startsWith("前田敦子まえだあつこ"), hay);
  assert.ok(hay.includes("maedaatsuko"), hay);
  const konan = core.haystack({ name: "KONAN", kana: "コナン" });
  assert.ok(konan.startsWith("konanこなん"), konan);
  assert.ok(konan.includes("konan"), konan);
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

test("haystack：无折叠表时仍追加罗马字", () => {
  const hay = core.haystack({ name: "高橋みなみ", kana: "たかはし みなみ" });
  assert.ok(hay.startsWith(core.normalizeName("高橋みなみ たかはし みなみ")));
  assert.ok(hay.includes("takahashiminami"), hay);
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

test("names 组合随系列与档位产出品牌、标题、标签与文件名", () => {
  const DICT = {
    brand_7: "神7",
    brand_7fukujin: "7福神",
    brand_16: "选拔组",
    brand_32: "圈内",
    title_prefix_48g: "我的 48 Group",
    title_prefix_saka: "我的坂道",
    series_48g: "48 Group",
    series_saka: "坂道",
  };
  const t = (k) => DICT[k];
  assert.deepEqual(core.names("48g", 7, t), {
    brand: "神7",
    seriesLabel: "48 Group",
    title: "我的 48 Group 神7",
    eyebrow: "48 Group 好き顔ソート",
    shareTags: "#48Group #好き顔ソート",
    posterTags: "#48Group  #好き顔ソート",
    fileBase: "48group_kami7",
  });
  assert.equal(core.names("sakamichi", 7, t).brand, "7福神");
  assert.equal(core.names("sakamichi", 7, t).fileBase, "sakamichi_7fukujin");
  assert.equal(core.names("sakamichi", 16, t).fileBase, "sakamichi_16");
  assert.equal(core.names("48g", 32, t).brand, "圈内");
  assert.equal(core.names("48g", 32, t).fileBase, "48group_32");
  const LOVE_DICT = {
    ...DICT,
    brand_7oshi: "推し 7",
    series_love: "等爱",
    title_prefix_love: "我的等爱",
  };
  const tl = (k) => LOVE_DICT[k];
  const love7 = core.names("love", 7, tl);
  assert.equal(love7.brand, "推し 7");
  assert.equal(love7.seriesLabel, "等爱");
  assert.equal(love7.title, "我的等爱 推し 7");
  assert.equal(love7.fileBase, "love_7");
  assert.equal(love7.shareTags, "#イコノイジョイ #好き顔ソート");
  assert.equal(love7.posterTags, "#イコノイジョイ  #好き顔ソート");
  assert.equal(core.names("love", 32, tl).fileBase, "love_32");
});

function bioDict(lang) {
  const zh = lang === "zh";
  const dict = {
    bio_birth: zh ? "生年月日" : "Date of birth",
    bio_age: zh ? "年龄" : "Age",
    bio_from: zh ? "出身地" : "Hometown",
    bio_height: zh ? "身長" : "Height",
    bio_blood: zh ? "血液型" : "Blood type",
    bio_sign: zh ? "星座" : "Zodiac",
    bio_hobby: zh ? "趣味" : "Hobbies",
    bio_skill: zh ? "特技" : "Skills",
    bio_nick: zh ? "昵称" : "Nickname",
    bio_group: zh ? "团体" : "Group",
    bio_gen: zh ? "期生" : "Generation",
    bio_status: zh ? "状态" : "Status",
    bio_romaji: zh ? "罗马字" : "Romaji",
    active: zh ? "现役" : "Active",
    grad_year: (y) => (zh ? `${y} 毕业` : `Grad. ${y}`),
    graduated: zh ? "已毕业" : "Graduated",
    grad_short: zh ? "卒业" : "grad.",
  };
  return (k, ...a) => (typeof dict[k] === "function" ? dict[k](...a) : dict[k]);
}

const LOVE_M = {
  name: "大谷映美里",
  kana: "おおたに えみり",
  nick: "みりにゃ",
  group: "=LOVE",
  generation: "1期生",
  status: "current",
  bio: {
    birth: "1998.03.15",
    from: "東京都",
    height: "155cm",
    blood: "O型",
    sign: "うお座",
    hobby: "メイクを楽しむ",
    skill: "ジョッキ持ち",
    romaji: "OTANI EMIRI",
  },
};

const BIO_VALUES = {
  メイクを楽しむ: { zh: "享受化妆", en: "Enjoying makeup" },
};
const NOW = new Date(2026, 8, 27);

test("profileRows：zh 全字段顺序与本地化，未收录译文回退原文", () => {
  const rows = core.profileRows(LOVE_M, bioDict("zh"), "zh", BIO_VALUES, NOW);
  assert.deepEqual(rows, [
    ["生年月日", "1998/3/15"],
    ["年龄", "28"],
    ["出身地", "东京都"],
    ["身長", "155cm"],
    ["血液型", "O型"],
    ["星座", "双鱼座"],
    ["趣味", "享受化妆"],
    ["特技", "ジョッキ持ち"],
    ["昵称", "みりにゃ"],
    ["团体", "=LOVE"],
    ["期生", "1期生"],
    ["状态", "现役"],
    ["罗马字", "OTANI EMIRI"],
  ]);
});

test("profileRows：en 日期/血型/期生/都道府县本地化", () => {
  const rows = core.profileRows(LOVE_M, bioDict("en"), "en", BIO_VALUES, NOW);
  const get = (k) => rows.find((r) => r[0] === k);
  assert.deepEqual(get("Date of birth"), ["Date of birth", "Mar 15, 1998"]);
  assert.deepEqual(get("Hometown"), ["Hometown", "Tokyo"]);
  assert.deepEqual(get("Blood type"), ["Blood type", "Type O"]);
  assert.deepEqual(get("Zodiac"), ["Zodiac", "Pisces"]);
  assert.deepEqual(get("Hobbies"), ["Hobbies", "Enjoying makeup"]);
  assert.deepEqual(get("Skills"), ["Skills", "ジョッキ持ち"]);
  assert.deepEqual(get("Generation"), ["Generation", "1st gen"]);
  assert.deepEqual(get("Status"), ["Status", "Active"]);
});

test("profileRows：缺字段不出现，毕业状态用毕业年", () => {
  const m = {
    name: "大島優子",
    kana: "おおしま ゆうこ",
    nick: "ゆうこ",
    group: "AKB48",
    generation: "2期生",
    status: "former",
    end: "2014.06.09",
    bio: { birth: "1988.10.17", from: "栃木県" },
  };
  const rows = core.profileRows(m, bioDict("zh"), "zh", {}, NOW);
  assert.deepEqual(rows, [
    ["生年月日", "1988/10/17"],
    ["年龄", "37"],
    ["出身地", "栃木县"],
    ["昵称", "ゆうこ"],
    ["团体", "AKB48"],
    ["期生", "2期生"],
    ["状态", "2014 毕业"],
  ]);
  const noBio = core.profileRows(
    { name: "X", group: "AKB48", generation: "1期生", status: "current" },
    bioDict("zh"),
    "zh",
    {},
    NOW
  );
  assert.deepEqual(noBio, [
    ["团体", "AKB48"],
    ["期生", "1期生"],
    ["状态", "现役"],
  ]);
});

test("profileRows：生日未到时年龄减一，未知都道府县回退原文", () => {
  const m = {
    name: "X",
    status: "current",
    bio: { birth: "1998.03.15", from: "海外" },
  };
  const before = core.profileRows(
    m,
    bioDict("zh"),
    "zh",
    {},
    new Date(2026, 2, 1)
  );
  assert.equal(before.find((r) => r[0] === "年龄")[1], "27");
  assert.equal(before.find((r) => r[0] === "出身地")[1], "海外");
});

// ---- 映射表穷举与字幕补口（变异测试指认的断言缺口） ----
const PREF_KEYS = [
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
];
const ZODIAC_KEYS = [
  "おひつじ座",
  "おうし座",
  "ふたご座",
  "かに座",
  "しし座",
  "おとめ座",
  "てんびん座",
  "さそり座",
  "いて座",
  "やぎ座",
  "みずがめ座",
  "うお座",
];

test("简介映射：全部 47 都道府县 zh/en 非空、en 必为罗马字", () => {
  for (const pref of PREF_KEYS) {
    for (const lang of ["zh", "en"]) {
      const rows = core.profileRows(
        { status: "current", bio: { from: pref } },
        bioDict(lang),
        lang,
        {},
        NOW
      );
      const value = rows.find((r) => r[0] === bioDict(lang)("bio_from"))[1];
      assert.ok(value && value.length > 0, `${pref}/${lang} 空`);
      if (lang === "en") assert.notEqual(value, pref, `${pref} 未映射 en`);
    }
  }
});

test("简介映射：全部 12 星座 zh/en 非空", () => {
  for (const sign of ZODIAC_KEYS) {
    for (const lang of ["zh", "en"]) {
      const rows = core.profileRows(
        { status: "current", bio: { sign } },
        bioDict(lang),
        lang,
        {},
        NOW
      );
      const value = rows.find((r) => r[0] === bioDict(lang)("bio_sign"))[1];
      assert.ok(value && value.length > 0, `${sign}/${lang} 空`);
    }
  }
});

test("简介映射：12 个月份英文缩写齐全", () => {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  for (let i = 1; i <= 12; i++) {
    const birth = `2000.${String(i).padStart(2, "0")}.15`;
    const rows = core.profileRows(
      { status: "current", bio: { birth } },
      bioDict("en"),
      "en",
      {},
      NOW
    );
    const value = rows.find((r) => r[0] === "Date of birth")[1];
    assert.ok(value.includes(months[i - 1]), `${birth} → ${value}`);
  }
});

test("期生英文序数：1st/2nd/3rd/4th、带小数与非法输入", () => {
  const gen = (v) =>
    core
      .profileRows(
        { status: "current", generation: v },
        bioDict("en"),
        "en",
        {},
        NOW
      )
      .find((r) => r[0] === "Generation")?.[1];
  assert.equal(gen("1期生"), "1st gen");
  assert.equal(gen("2期生"), "2nd gen");
  assert.equal(gen("3期生"), "3rd gen");
  assert.equal(gen("4期生"), "4th gen");
  assert.equal(gen("1.5期生"), "1.5 gen");
  assert.equal(gen("研究生"), "研究生");
  assert.equal(
    core
      .profileRows(
        { status: "current", generation: "2期生" },
        bioDict("zh"),
        "zh",
        {},
        NOW
      )
      .find((r) => r[0] === "期生")[1],
    "2期生"
  );
});

test("字幕：移籍来源（现役但非全现役）、zh 分隔符与无 extras 回退", () => {
  const transferred = person({
    extras: [
      { group: "AKB48", current: true },
      { group: "NMB48", current: false },
    ],
  });
  assert.equal(
    core.sourceNote(transferred, t, "zh"),
    "[src_transferred:AKB48、NMB48]"
  );
  assert.equal(
    core.sourceNote(transferred, t, "en"),
    "[src_transferred:AKB48, NMB48]"
  );
  const full = person({ extras: [{ group: "SKE48", current: true }] });
  assert.equal(
    core.fullMeta(full, t, "zh"),
    "AKB48 · 1期生 · [src_concurrent:SKE48] · [active]"
  );
  assert.equal(core.sourceNote(person({ note: "旧备注" }), t, "zh"), "旧备注");
});

/* ---------------- 导航相位（view）转移表 ---------------- */

const navCtx = (over = {}) => ({
  view: "pick",
  phase: "pick",
  selected: 0,
  size: 7,
  step: null,
  ...over,
});

test("nav：boot 由相位恢复视图", () => {
  assert.deepEqual(core.nav(navCtx({ phase: "pick" }), "boot"), {
    view: "pick",
    effect: "none",
  });
  assert.deepEqual(core.nav(navCtx({ phase: "duel" }), "boot"), {
    view: "duel",
    effect: "none",
  });
  assert.deepEqual(core.nav(navCtx({ phase: "result" }), "boot"), {
    view: "result",
    effect: "none",
  });
});

test("nav：sync（切换系列）能停住就停住，否则回挑人", () => {
  assert.deepEqual(core.nav(navCtx({ view: "duel", phase: "duel" }), "sync"), {
    view: "duel",
    effect: "none",
  });
  assert.deepEqual(
    core.nav(navCtx({ view: "result", phase: "result" }), "sync"),
    { view: "result", effect: "none" }
  );
  for (const [view, phase] of [
    ["duel", "pick"],
    ["duel", "result"],
    ["result", "pick"],
    ["result", "duel"],
    ["pick", "duel"],
    ["pick", "result"],
  ])
    assert.deepEqual(
      core.nav(navCtx({ view, phase }), "sync"),
      { view: "pick", effect: "none" },
      `${view}/${phase}`
    );
});

test("nav：① 从对决保留进度、从结果丢弃", () => {
  assert.deepEqual(core.nav(navCtx({ view: "duel", phase: "duel" }), "pick"), {
    view: "pick",
    effect: "none",
  });
  assert.deepEqual(core.nav(navCtx({ view: "pick", phase: "duel" }), "pick"), {
    view: "pick",
    effect: "none",
  });
  assert.deepEqual(
    core.nav(navCtx({ view: "result", phase: "result" }), "pick"),
    { view: "pick", effect: "abandon" }
  );
});

test("nav：② 回续 / 开局 / 不可用", () => {
  assert.deepEqual(core.nav(navCtx({ phase: "duel" }), "duel"), {
    view: "duel",
    effect: "none",
  });
  assert.deepEqual(core.nav(navCtx({ phase: "pick", selected: 7 }), "duel"), {
    view: "duel",
    effect: "start",
  });
  assert.deepEqual(core.nav(navCtx({ phase: "pick", selected: 6 }), "duel"), {
    view: "pick",
    effect: "none",
  });
  assert.deepEqual(
    core.nav(navCtx({ view: "result", phase: "result" }), "duel"),
    { view: "result", effect: "none" }
  );
});

test("nav：③ 仅结果相位可去", () => {
  assert.deepEqual(
    core.nav(navCtx({ view: "result", phase: "result" }), "result"),
    { view: "result", effect: "none" }
  );
  assert.deepEqual(core.nav(navCtx({ phase: "pick" }), "result"), {
    view: "pick",
    effect: "none",
  });
  assert.deepEqual(core.nav(navCtx({ phase: "duel" }), "result"), {
    view: "pick",
    effect: "none",
  });
});

test("nav：start 在有对决时回续（不再静默重开）", () => {
  assert.deepEqual(core.nav(navCtx({ phase: "duel" }), "start"), {
    view: "duel",
    effect: "resume",
  });
  assert.deepEqual(core.nav(navCtx({ phase: "pick", selected: 7 }), "start"), {
    view: "duel",
    effect: "start",
  });
  assert.deepEqual(core.nav(navCtx({ phase: "pick", selected: 3 }), "start"), {
    view: "pick",
    effect: "none",
  });
});

test("nav：resume / drop / restart / leave / resort / advance", () => {
  assert.deepEqual(core.nav(navCtx({ phase: "duel" }), "resume"), {
    view: "duel",
    effect: "none",
  });
  assert.deepEqual(core.nav(navCtx({ phase: "pick" }), "resume"), {
    view: "pick",
    effect: "none",
  });
  assert.deepEqual(core.nav(navCtx({ phase: "duel" }), "drop"), {
    view: "pick",
    effect: "abandon",
  });
  assert.deepEqual(
    core.nav(navCtx({ view: "result", phase: "result" }), "restart"),
    { view: "pick", effect: "abandon" }
  );
  assert.deepEqual(core.nav(navCtx({ phase: "pick" }), "restart"), {
    view: "pick",
    effect: "none",
  });
  assert.deepEqual(core.nav(navCtx({ view: "duel", phase: "duel" }), "leave"), {
    view: "pick",
    effect: "none",
  });
  assert.deepEqual(
    core.nav(navCtx({ view: "result", phase: "result" }), "resort"),
    { view: "duel", effect: "start" }
  );
  assert.deepEqual(core.nav(navCtx({ phase: "duel" }), "resort"), {
    view: "pick",
    effect: "none",
  });
  assert.deepEqual(core.nav(navCtx({ phase: "duel" }), "advance"), {
    view: "duel",
    effect: "none",
  });
  assert.deepEqual(core.nav(navCtx({ phase: "result" }), "advance"), {
    view: "result",
    effect: "none",
  });
});

test("nav：缺省字段与非法 intent 保守返回", () => {
  assert.deepEqual(core.nav(undefined, "boot"), {
    view: "pick",
    effect: "none",
  });
  assert.deepEqual(core.nav({}, "pick"), { view: "pick", effect: "none" });
  assert.deepEqual(core.nav(navCtx({ phase: "duel" }), "nope"), {
    view: "pick",
    effect: "none",
  });
});

test("steps：三步的 active / enabled / badge", () => {
  assert.deepEqual(core.steps(navCtx()), [
    { key: "pick", active: true, enabled: true, badge: "0/7" },
    { key: "duel", active: false, enabled: false, badge: null },
    { key: "result", active: false, enabled: false, badge: null },
  ]);
  assert.deepEqual(
    core.steps(navCtx({ view: "pick", phase: "duel", selected: 7, step: 3 })),
    [
      { key: "pick", active: true, enabled: true, badge: "7/7" },
      { key: "duel", active: false, enabled: true, badge: 3 },
      { key: "result", active: false, enabled: false, badge: null },
    ]
  );
  assert.deepEqual(
    core.steps(navCtx({ view: "duel", phase: "duel", selected: 7, step: 2 })),
    [
      { key: "pick", active: false, enabled: true, badge: "7/7" },
      { key: "duel", active: true, enabled: true, badge: 2 },
      { key: "result", active: false, enabled: false, badge: null },
    ]
  );
  assert.deepEqual(core.steps(navCtx({ view: "result", phase: "result" })), [
    { key: "pick", active: false, enabled: true, badge: "0/7" },
    { key: "duel", active: false, enabled: false, badge: null },
    { key: "result", active: true, enabled: true, badge: null },
  ]);
  assert.deepEqual(core.steps(navCtx({ phase: "pick", selected: 7 })), [
    { key: "pick", active: true, enabled: true, badge: "7/7" },
    { key: "duel", active: false, enabled: true, badge: null },
    { key: "result", active: false, enabled: false, badge: null },
  ]);
});

test("milestone：50% 里程碑只庆祝一次，刷新进入已越过只标记", () => {
  assert.deepEqual(core.milestone(0, false), {
    shown: false,
    celebrate: false,
  });
  assert.deepEqual(core.milestone(49, false), {
    shown: false,
    celebrate: false,
  });
  assert.deepEqual(core.milestone(50, false), {
    shown: true,
    celebrate: true,
  });
  assert.deepEqual(core.milestone(90, false), {
    shown: true,
    celebrate: true,
  });
  assert.deepEqual(core.milestone(50, true), {
    shown: true,
    celebrate: false,
  });
  assert.deepEqual(core.milestone(undefined, false), {
    shown: false,
    celebrate: false,
  });
});

test("nav：① 由当前视图决定——相位有结果但人在挑人页时不丢弃", () => {
  assert.deepEqual(
    core.nav(navCtx({ view: "pick", phase: "result" }), "pick"),
    { view: "pick", effect: "none" }
  );
  assert.deepEqual(
    core.nav(navCtx({ view: "duel", phase: "result" }), "pick"),
    { view: "pick", effect: "none" }
  );
});

test("nav/steps：上下文字段非法时保守回退（边界）", () => {
  // 非法/缺省 view、phase → 回退 pick（含 sync 的同相比较）
  assert.deepEqual(core.nav({ view: "", phase: "" }, "sync"), {
    view: "pick",
    effect: "none",
  });
  assert.deepEqual(core.nav({ view: "bogus", phase: "bogus" }, "sync"), {
    view: "pick",
    effect: "none",
  });
  // size 非法不视为满员
  assert.deepEqual(core.nav({ size: 0, selected: 3, phase: "pick" }, "start"), {
    view: "pick",
    effect: "none",
  });
  assert.deepEqual(core.nav({ size: 0, selected: 3, phase: "pick" }, "duel"), {
    view: "pick",
    effect: "none",
  });
  // 相位 result 且满员时 ② 仍不动
  assert.deepEqual(
    core.nav({ view: "result", phase: "result", size: 7, selected: 7 }, "duel"),
    { view: "result", effect: "none" }
  );
  // selected 负值按 0
  assert.deepEqual(
    core.steps({ view: "pick", phase: "pick", size: 7, selected: -1 })[0],
    { key: "pick", active: true, enabled: true, badge: "0/7" }
  );
  // 非 duel 相位不显示题号；duel 相位缺 step 也不显示
  assert.equal(
    core.steps({ phase: "pick", size: 7, selected: 7, step: 5 })[1].badge,
    null
  );
  assert.equal(
    core.steps({ phase: "duel", size: 7, selected: 7, step: null })[1].badge,
    null
  );
  // 16/32 档（size > 7）参与满员判断
  assert.deepEqual(
    core.nav({ size: 16, selected: 10, phase: "pick" }, "start"),
    { view: "pick", effect: "none" }
  );
  assert.deepEqual(
    core.nav({ size: 32, selected: 32, phase: "pick" }, "start"),
    { view: "duel", effect: "start" }
  );
  // 相位有结果、人却在挑人页时，③ 仍指向结果
  assert.deepEqual(core.nav({ view: "pick", phase: "result" }, "result"), {
    view: "result",
    effect: "none",
  });
  // 相位不是对决时 advance 不变
  assert.deepEqual(core.nav({ view: "pick", phase: "pick" }, "advance"), {
    view: "pick",
    effect: "none",
  });
  // 结果相位下 ② 恒不可点（即使满员）；非法视图按 pick 处理
  assert.equal(
    core.steps({ view: "result", phase: "result", size: 7, selected: 7 })[1]
      .enabled,
    false
  );
  assert.equal(
    core.steps({ view: "", phase: "pick", size: 7, selected: 0 })[0].active,
    true
  );
});

test("replay：多余答案被忽略（完成态仍返回完整名次）", () => {
  const order = ["a", "b", "c", "d", "e"];
  const r = core.replay(order, Array(core.worstCase(5)).fill(true));
  assert.equal(r.done, true);
  assert.deepEqual(r.order, order);
});

/* ---------------- 罗马字检索 ---------------- */

test("romanize：主形（Hepburn）、长音/促音/ん/拗音", () => {
  assert.equal(core.romanize("まえだ あつこ"), "maedaatsuko");
  assert.equal(core.romanize("さとう"), "satou");
  assert.equal(core.romanize("しんいち"), "shinichi");
  assert.equal(core.romanize("まっち"), "matchi");
  assert.equal(core.romanize("トモミー"), "tomomi");
  assert.equal(core.romanize("ともちん"), "tomochin");
  assert.equal(core.romanize("きょうこ"), "kyouko");
  assert.equal(core.romanize("ふみか"), "fumika");
  assert.equal(core.romanize("前田まえだ"), "maeda");
  assert.equal(core.romanize(""), "");
  assert.equal(core.romanize(null), "");
  assert.equal(core.romanize("Atsuko!"), "");
});

test("romanize：异形（Kunrei 式）", () => {
  assert.equal(core.romanize("しんいち", true), "siniti");
  assert.equal(core.romanize("ふみか", true), "humika");
  assert.equal(core.romanize("ちさと", true), "tisato");
  assert.equal(core.romanize("つばさ", true), "tubasa");
  assert.equal(core.romanize("まっち", true), "matti");
  assert.equal(core.romanize("じゃん", true), "zyan");
});

test("haystack：并入罗马字变体（长音折叠 / nn 展开 / 异形）", () => {
  const watanabe = core.haystack({
    name: "渡邊麻友",
    kana: "わたなべ まゆ",
    nick: "まゆゆ",
  });
  for (const q of ["watanabe", "watannabe", "mayu", "mayuyu", "watana"])
    assert.ok(watanabe.includes(q), q);
  assert.ok(!watanabe.includes("maeda"));

  const satou = core.haystack({ name: "佐藤", kana: "さとう" });
  assert.ok(satou.includes("satou") && satou.includes("sato"), satou);

  const shin = core.haystack({ name: "新一", kana: "しんいち" });
  assert.ok(
    shin.includes("shinichi") &&
      shin.includes("siniti") &&
      shin.includes("shinnichi"),
    shin
  );
});

test("romanize/haystack：っち 的 cch 拼法、带空格查询、nn∘长音组合", () => {
  assert.equal(core.romanize("まっち"), "matchi");
  const macchi = core.haystack({ name: "町", kana: "まっち" });
  assert.ok(macchi.includes("macchi"), macchi);
  const a = core.haystack({ name: "前田敦子", kana: "まえだ あつこ" });
  assert.ok(a.includes(core.normalizeName("maeda atsuko")), a);
  const atchan = core.haystack({
    name: "前田敦子",
    kana: "まえだ あつこ",
    nick: "あっちゃん",
  });
  assert.ok(atchan.includes("acchan") && atchan.includes("atchan"), atchan);
  const ichiro = core.haystack({ name: "新一郎", kana: "しんいちろう" });
  assert.ok(ichiro.includes("shinnichiro"), ichiro);
});

test("romanize：外来音与长音 ei 不折叠", () => {
  assert.equal(core.romanize("ふぁ"), "fa");
  assert.equal(core.romanize("てぃ"), "ti");
  assert.equal(core.romanize("ゔ"), "vu");
  assert.equal(core.romanize("けいこ"), "keiko");
});

test("haystack：罗马字与简体折叠共存", () => {
  const hay = core.haystack(
    { name: "渡辺麻友", kana: "わたなべ まゆ", nick: "まゆゆ" },
    core.foldIndex({ 边: ["邉", "邊", "辺"] })
  );
  for (const q of ["渡辺", "渡边", "わたなべ", "watanabe"])
    assert.ok(hay.includes(q), q);
});
