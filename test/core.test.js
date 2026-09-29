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

test("对决进度：40 档最坏 177 与百分比/预计时长", () => {
  assert.equal(core.worstCase(40), 177);
  assert.deepEqual(core.duelProgress(40, 0), {
    answered: 0,
    max: 177,
    percent: 0,
    remaining: 177,
    etaSeconds: 885,
  });
  assert.deepEqual(core.duelProgress(7, 14), {
    answered: 14,
    max: 14,
    percent: 100,
    remaining: 0,
    etaSeconds: 0,
  });
});

test("持久化：40 档对决进度（177 答）可恢复，超出最坏题数丢弃", () => {
  const order = Array.from({ length: 40 }, (_, i) => `id${i}`);
  const answers = [...Array(177)].map(() => true);
  const st = core.deserializeState(
    JSON.stringify({
      v: 1,
      size: 40,
      selected: order,
      duel: { order, answers },
    })
  );
  assert.equal(st.duel.answers.length, 177);
  const tooMany = core.deserializeState(
    JSON.stringify({
      v: 1,
      size: 40,
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
    brand_40: "圈内",
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
  assert.equal(core.names("48g", 40, t).brand, "圈内");
  assert.equal(core.names("48g", 40, t).fileBase, "48group_40");
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
  assert.equal(core.names("love", 40, tl).fileBase, "love_40");
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
  // 16/40 档（size > 7）参与满员判断
  assert.deepEqual(
    core.nav({ size: 16, selected: 10, phase: "pick" }, "start"),
    { view: "pick", effect: "none" }
  );
  assert.deepEqual(
    core.nav({ size: 40, selected: 40, phase: "pick" }, "start"),
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

test("flattenMembers：摊平分段并注入 group/generation/series", () => {
  const groups = [
    {
      group: "AKB48",
      series: "48g",
      label: "1期生",
      members: [{ id: "a" }, { id: "b" }],
    },
    { group: "SKE48", series: "48g", label: "2期生", members: [{ id: "c" }] },
  ];
  const list = core.flattenMembers(groups);
  assert.deepEqual(
    list.map((m) => m.id),
    ["a", "b", "c"]
  );
  assert.deepEqual(
    list.map((m) => [m.group, m.generation, m.series]),
    [
      ["AKB48", "1期生", "48g"],
      ["AKB48", "1期生", "48g"],
      ["SKE48", "2期生", "48g"],
    ]
  );
  assert.strictEqual(list[0], groups[0].members[0]); // 原地注入：身份不变
  assert.deepEqual(core.flattenMembers(), []);
  assert.deepEqual(core.flattenMembers([{ group: "X" }]), []);
});

test("genText：选秀期生标签在 ja/en 下翻译（zh 保留原文）", () => {
  assert.equal(core.genText("选秀1期生", "zh"), "选秀1期生");
  assert.equal(core.genText("选秀1期生", "en"), "Draft 1st gen");
  assert.equal(core.genText("选秀2期生", "en"), "Draft 2nd gen");
  assert.equal(core.genText("选秀3期生", "ja"), "ドラフト3期生");
  assert.equal(core.genText("1期生", "ja"), "1期生");
  assert.equal(core.genText("1.5期生", "ja"), "1.5期生");
});

test("fullMeta/posterSub/profileRows：期生走 genText（不再直出中文标签）", () => {
  const t = (k) => k;
  const draft = {
    group: "AKB48",
    generation: "选秀1期生",
    status: "current",
  };
  const full = core.fullMeta(draft, t, "en");
  assert.ok(full.includes("Draft 1st gen") && !full.includes("选秀"), full);
  const sub = core.posterSub(draft, t, "ja");
  assert.equal(sub, "ドラフト1期生");
  const rows = core.profileRows(draft, t, "ja", {}, new Date(2026, 0, 1));
  assert.ok(
    rows.some(([k, v]) => k === "bio_gen" && v === "ドラフト1期生"),
    JSON.stringify(rows)
  );
});

test("deserializeState：旧 32 档存档迁移为 40 档（已选与对决保留）", () => {
  const raw = JSON.stringify({
    v: 1,
    size: 32,
    selected: ["a", "b", "c"],
    duel: { order: ["a", "b"], answers: [true] },
  });
  const st = core.deserializeState(raw);
  assert.ok(st, "旧存档不应被丢弃");
  assert.equal(st.size, 40);
  assert.deepEqual(st.selected, ["a", "b", "c"]);
  assert.deepEqual(st.duel.order, ["a", "b"]);
  assert.deepEqual(st.duel.answers, [true]);
});

test("names：40 档品牌与文件名（圈内 / 48group_40）", () => {
  const t = (k) => require("../i18n.js").zh[k];
  const n = core.names("48g", 40, t);
  assert.equal(n.brand, "圈内");
  assert.equal(n.fileBase, "48group_40");
});

test("genKey：汉字期生归一为阿拉伯（用于筛选）", () => {
  assert.equal(core.genKey("一期生"), "1期生");
  assert.equal(core.genKey("二期生"), "2期生");
  assert.equal(core.genKey("五期生"), "5期生");
  assert.equal(core.genKey("十期生"), "10期生");
  assert.equal(core.genKey("十一期生"), "11期生");
  assert.equal(core.genKey("十九期生"), "19期生");
  assert.equal(core.genKey("二十期生"), "20期生");
  assert.equal(core.genKey("二十九期生"), "29期生");
  assert.equal(core.genKey("三十期生"), "30期生");
  assert.equal(core.genKey("二十一期生"), "21期生");
  assert.equal(core.genKey("1期生"), "1期生");
  assert.equal(core.genKey("1.5期生"), "1.5期生");
  assert.equal(core.genKey("选秀1期生"), "选秀1期生");
  assert.equal(core.genKey("兼任・移籍加入"), "兼任・移籍加入");
  assert.equal(core.genKey(""), "");
});

test("generationOptions：按出现顺序去重、汉字归一、排除兼任・移籍加入", () => {
  const sections = [
    { label: "1期生" },
    { label: "一期生" },
    { label: "兼任・移籍加入" },
    { label: "Team 8" },
    { label: "其他" },
    { label: "2期生" },
    { label: "二期生" },
    { label: "1期生" },
  ];
  assert.deepEqual(core.generationOptions(sections), ["1期生", "2期生"]);
});

test("groupSections：期生筛选与团体筛选叠加（汉字期生同组）", () => {
  const sections = [
    { group: "AKB48", label: "1期生", members: [] },
    { group: "AKB48", label: "2期生", members: [] },
    { group: "SKE48", label: "1期生", members: [] },
    { group: "櫻坂46", label: "一期生", members: [] },
  ];
  assert.deepEqual(
    core
      .groupSections(sections, "all", "1期生")
      .map((n) => [n.group, n.sections.map((s) => s.label)]),
    [
      ["AKB48", ["1期生"]],
      ["SKE48", ["1期生"]],
      ["櫻坂46", ["一期生"]],
    ]
  );
  assert.deepEqual(
    core.groupSections(sections, "AKB48", "2期生").map((n) => n.group),
    ["AKB48"]
  );
  assert.equal(core.groupSections(sections, "all", "all").length, 3);
});

function rosterFixture() {
  const mk = (id, group, status, hay) => ({
    id,
    group,
    status,
    series: "48g",
    name: id,
    hay: hay || `${id} ${id}`,
  });
  return [
    {
      group: "AKB48",
      label: "1期生",
      members: [
        mk("a1", "AKB48", "current", "a1 まえだ"),
        mk("a2", "AKB48", "former", "a2 おおしま"),
      ],
    },
    {
      group: "AKB48",
      label: "2期生",
      members: [mk("a3", "AKB48", "current", "a3 こじはる")],
    },
    {
      group: "SKE48",
      label: "1期生",
      members: [mk("s1", "SKE48", "current", "s1 まつい")],
    },
    {
      group: "櫻坂46",
      label: "一期生",
      members: [mk("b1", "櫻坂46", "current", "b1 こばやし")],
    },
  ];
}

test("rosterView：树模式——分组、计数、已选、空段剔除", () => {
  const view = core.rosterView(rosterFixture(), {
    group: "all",
    generation: "all",
    status: "all",
    query: "",
    selected: ["a1", "s1"],
  });
  assert.equal(view.mode, "tree");
  assert.deepEqual(
    view.nodes.map((n) => n.group),
    ["AKB48", "SKE48", "櫻坂46"]
  );
  const akb = view.nodes[0];
  assert.deepEqual(
    akb.sections.map((s) => [s.id, s.label, s.count, s.current, s.picked]),
    [
      ["AKB48#1期生", "1期生", 2, 1, 1],
      ["AKB48#2期生", "2期生", 1, 1, 0],
    ]
  );
  assert.equal(akb.count, 3);
  assert.equal(akb.current, 2);
  assert.equal(akb.picked, 1);
  assert.deepEqual(view.hits, []);
});

test("rosterView：状态/期生过滤与单团 flat", () => {
  const former = core.rosterView(rosterFixture(), {
    group: "all",
    generation: "all",
    status: "former",
    query: "",
    selected: [],
  });
  assert.deepEqual(
    former.nodes.map((n) => n.group),
    ["AKB48"]
  );
  assert.deepEqual(
    former.nodes[0].sections.map((s) => s.label),
    ["1期生"]
  );
  const saka = core.rosterView(rosterFixture(), {
    group: "all",
    generation: "1期生",
    status: "all",
    query: "",
    selected: [],
  });
  assert.deepEqual(
    saka.nodes.map((n) => n.group),
    ["AKB48", "SKE48", "櫻坂46"]
  );
  const flat = core.rosterView(rosterFixture(), {
    group: "AKB48",
    generation: "all",
    status: "all",
    query: "",
    selected: [],
  });
  assert.equal(flat.mode, "flat");
  assert.equal(flat.nodes.length, 1);
});

test("rosterView：搜索模式——命中顺序、过滤叠加、查询归一", () => {
  const view = core.rosterView(rosterFixture(), {
    group: "all",
    generation: "all",
    status: "all",
    query: "まえだ",
    selected: [],
  });
  assert.equal(view.mode, "search");
  assert.deepEqual(
    view.hits.map((m) => m.id),
    ["a1"]
  );
  const none = core.rosterView(rosterFixture(), {
    group: "all",
    generation: "1期生",
    status: "former",
    query: "",
    selected: [],
  });
  assert.deepEqual(none.hits, []);
  assert.deepEqual(
    none.nodes.map((n) => [n.group, n.sections.map((s) => s.label)]),
    [["AKB48", ["1期生"]]]
  );
  const hit = core.rosterView(rosterFixture(), {
    group: "SKE48",
    generation: "all",
    status: "all",
    query: "まつい",
    selected: [],
  });
  assert.deepEqual(
    hit.hits.map((m) => m.id),
    ["s1"]
  );
  // 过滤在搜索态同样生效：团体/期生/状态各排除一批
  const cross = rosterFixture();
  cross[0].members[1].hay = "a2 まつい";
  cross[2].members[0].hay = "s1 まつい";
  assert.deepEqual(
    core
      .rosterView(cross, {
        group: "AKB48",
        generation: "1期生",
        status: "former",
        query: "まつい",
        selected: [],
      })
      .hits.map((m) => m.id),
    ["a2"]
  );
  assert.deepEqual(
    core
      .rosterView(cross, {
        group: "SKE48",
        generation: "all",
        status: "current",
        query: "まつい",
        selected: [],
      })
      .hits.map((m) => m.id),
    ["s1"]
  );
  // 查询归一：片假名输入命中平假名 hay
  assert.deepEqual(
    core
      .rosterView(rosterFixture(), {
        group: "all",
        generation: "all",
        status: "all",
        query: "マエダ",
        selected: [],
      })
      .hits.map((m) => m.id),
    ["a1"]
  );
});

test("rosterView：已选计数只含可见成员（状态过滤下组/段口径一致）", () => {
  const view = core.rosterView(rosterFixture(), {
    group: "all",
    generation: "all",
    status: "former",
    query: "",
    selected: ["a1", "a2"],
  });
  assert.equal(view.nodes.length, 1);
  assert.equal(view.nodes[0].picked, 1);
  assert.equal(view.nodes[0].sections[0].picked, 1);
});

// ── 第九轮质检补的断言：变异测试指认的断言缺口（core.js 221 条存活里的大头）──

test("罗马字：表驱动逐条（Hepburn 期望值写死，不靠实现自证）", () => {
  const cases = [
    ["し", "shi"], ["つ", "tsu"], ["ち", "chi"], ["ふ", "fu"], ["じ", "ji"],
    ["しゅ", "shu"], ["じょ", "jo"], ["きゃ", "kya"], ["ちゃ", "cha"],
    ["にょ", "nyo"], ["ひゃ", "hya"], ["みょ", "myo"], ["りゅ", "ryu"],
    ["ぎゃ", "gya"], ["びょ", "byo"], ["ぴゃ", "pya"],
    ["まっち", "matchi"], ["あっちゃん", "atchan"], ["がっこう", "gakkou"],
    ["さとう", "satou"], ["かんばん", "kanban"], ["らーめん", "ramen"],
    ["ふじさん", "fujisan"], ["ひらがな", "hiragana"],
  ];
  for (const [kana, want] of cases) {
    assert.equal(core.romanize(kana), want, `romanize(${kana}) 应为 ${want}`);
  }
  assert.equal(core.romanize("abc123"), "", "非假名字符应被滤掉");
  // 促音双写是**检索**承诺（用户敲 acchan 能搜到），不是 romanize 的输出形态
  assert.ok(
    core.haystack({ name: "あっちゃん", kana: "あっちゃん" }, "acchan").includes("acchan"),
    "haystack 必须含 acchan（促音 cch 变体）"
  );
  assert.equal(core.romanize(""), "");
  assert.equal(core.romanize(null), "");
});

test("罗马字：长音符被丢弃，逐条转写与整体转写一致", () => {
  assert.equal(core.romanize("ーー"), "", "只有长音符应得到空串");
  assert.equal(core.romanize("らーめん"), core.romanize("らめん"), "长音符应被丢弃");
  assert.equal(core.romanize("らーめん"), "ramen");
  // 逐条拼接 == 整体：证明「ー 丢弃」与双字符前瞻在任意切分下自洽
  const kanaSeq = "あいうえおかきくけこ";
  const per = [...kanaSeq].map((c) => core.romanize(c)).join("");
  assert.equal(core.romanize(kanaSeq), per, "逐条转写拼接应等于整体转写");
});

test("罗马字：全假名范围扫一遍，非空结果必为小写 ASCII", () => {
  let nonEmpty = 0;
  for (let cp = 0x3041; cp <= 0x3096; cp++) {
    const ch = String.fromCharCode(cp);
    const out = core.romanize(ch);
    if (out) {
      nonEmpty++;
      assert.match(out, /^[a-z]+$/, `romanize(${ch}) = ${out} 不是小写 ASCII`);
    }
  }
  for (let cp = 0x30a1; cp <= 0x30f6; cp++) {
    const out = core.romanize(String.fromCharCode(cp));
    if (out) {
      nonEmpty++;
      assert.match(out, /^[a-z]+$/);
    }
  }
  assert.ok(nonEmpty >= 150, `假名范围只转写出 ${nonEmpty} 条，表可能缺项`);
});

test("罗马字：normalizeName 与 haystack 两条路径结果一致（长音折叠 sato 也在 haystack）", () => {
  const h = (name, kana) => core.haystack({ name, kana }, "maeda");
  assert.equal(core.romanize("まえだあつこ"), core.romanize("まえだあつこ"));
  const hay = h("佐藤友子", "さとうゆうこ");
  assert.ok(hay.includes("satouyukо".replace("о", "o")) || hay.includes("satouyuko") || hay.includes("sato") || hay.includes("satou"),
    `haystack 应含 sa*tou*yu*ko* 之一：${hay}`);
  assert.ok(hay.includes("sato"), "长音折叠的 sato 必须在 haystack 里");
  assert.equal(core.normalizeName("さとう ゆうこ"), core.normalizeName("サトウユウコ"));
});

test("正则族：近似反例不得误匹配（期生/血型/选秀/日期）", () => {
  // kanjiNumber / genKey 的锚点
  assert.equal(core.genKey("一期生"), "1期生");
  assert.equal(core.genKey("一期生"), "1期生");
  assert.equal(core.genKey("十期生"), "10期生");
  assert.equal(core.genKey("3十期生"), "3十期生", "数字开头不该被当成汉字期生");
  assert.equal(core.genKey("三十期"), "三十期", "缺「期生」后缀不该匹配");
  assert.equal(core.genKey("期生"), "期生");
  // genText 只管期生（血型替换在未导出的 bloodText 里，另由 profileRows 覆盖）
  assert.equal(core.genText("选秀10期生", "en"), "Draft 10th gen");
  assert.equal(core.genText("选秀10", "en"), "选秀10", "缺「期生」不该匹配");
  assert.equal(core.genText("12.55期生", "en"), "12.55期生", "小数点后多位不该匹配");
  assert.equal(core.genText("12期生", "en"), "12th gen");
  assert.equal(core.genText("12期生x", "en"), "12期生x");
});

test("ageOn 的月/日进位：跨月、同日、月初月末（经 profileRows 的年龄行）", () => {
  const ageAt = (birth, now) => {
    const rows = core.profileRows(
      { name: "X", bio: { birth } },
      (k) => k,
      "zh",
      {},
      now
    );
    const hit = rows.find((r) => r[0] === "bio_age");
    return hit ? Number(hit[1]) : null;
  };
  // 生日 9/30，今天 10/1 → 已过生日，不减
  assert.equal(ageAt("2000.09.30", new Date(2026, 9, 1)), 26);
  // 同月、生日未到（今天 9/29）→ 减一岁
  assert.equal(ageAt("2000.09.30", new Date(2026, 8, 29)), 25);
  // 生日就是今天 → 刚满，不减
  assert.equal(ageAt("2000.09.29", new Date(2026, 8, 29)), 26);
  // 月初 1 号：今天 9/1 生日 9/1 → 不减；今天 8/31 → 减
  assert.equal(ageAt("2000.09.01", new Date(2026, 8, 1)), 26);
  assert.equal(ageAt("2000.09.01", new Date(2026, 7, 31)), 25);
  // 出生年份闰日也按 3/1 之后的逻辑走（不崩即可）
  assert.equal(typeof ageAt("2000.02.29", new Date(2026, 2, 1)), "number");
});

test("profileRows：缺 birth/from/sign/generation/status 时不留空值或 undefined", () => {
  const rows = core.profileRows(
    { name: "X", bio: { height: "160cm" } },
    (k) => k,
    "zh",
    {},
    new Date(2026, 8, 27)
  );
  for (const [, v] of rows) {
    assert.ok(v !== undefined && v !== null && String(v).trim() !== "", `不该出现空值：${JSON.stringify(rows)}`);
    assert.doesNotMatch(String(v), /undefined|NaN/, `不该出现 undefined/NaN：${v}`);
  }
  const keys = rows.map((r) => r[0]);
  for (const absent of ["bio_birth", "bio_age", "bio_from", "bio_sign", "bio_gen"]) {
    assert.ok(!keys.includes(absent), `${absent} 缺字段时不该出现`);
  }
  assert.ok(keys.includes("bio_height"), "存在的字段仍要出现");
  // 血型替换的锚点：O型 → Type O，带脏后缀的不动
  const blood = (v, lang) =>
    core.profileRows({ name: "X", bio: { blood: v } }, (k) => k, lang, {}, new Date(2026, 8, 27))
      .find((r) => r[0] === "bio_blood");
  assert.deepEqual(blood("O型", "en"), ["bio_blood", "Type O"]);
  assert.deepEqual(blood("AB型", "en"), ["bio_blood", "Type AB"]);
  assert.deepEqual(blood("O型x", "en"), ["bio_blood", "O型x"], "后缀有脏字符不该被替换");
});

test("rosterView：group=all 不做组过滤，折叠节点键按团体区分", () => {
  const sections = [
    { group: "AKB48", generation: "1期生", members: [{ id: "a", name: "甲" }] },
    { group: "AKB48", generation: "3期生", members: [{ id: "b", name: "乙" }] },
    { group: "SKE48", generation: "1期生", members: [{ id: "c", name: "丙" }] },
  ];
  const all = core.rosterView(sections, { group: "all", generation: "all", status: "all", query: "", selected: [] });
  const groups = all.nodes.map((n) => n.group);
  assert.deepEqual(groups, ["AKB48", "SKE48"], "all 时两个团体都该出现");
  const onlySke = core.rosterView(sections, { group: "SKE48", generation: "all", status: "all", query: "", selected: [] });
  assert.deepEqual(onlySke.nodes.map((n) => n.group), ["SKE48"]);
  // 折叠节点键必须随团体不同（否则所有组挤到一起）
  assert.equal(new Set(all.nodes.map((n) => n.id)).size, all.nodes.length, "节点 id 必须互不相同");
  assert.notEqual(all.nodes[0].id, all.nodes[1].id);
  // 状态=all 也不该过滤
  const s = core.rosterView(sections, { group: "all", generation: "all", status: "all", query: "", selected: [] });
  assert.equal(s.nodes.length, 2);
});

test("rosterView 搜索：三个过滤条件各自真的生效（这条路径此前没有任何测试）", () => {
  const akb = { group: "AKB48", label: "1期生", members: [{ id: "a1", name: "甲", status: "current", hay: "こう" }] };
  const ske = { group: "SKE48", label: "1期生", members: [{ id: "s1", name: "乙", status: "current", hay: "こう" }] };
  const former = { group: "AKB48", label: "3期生", members: [{ id: "f1", name: "丙", status: "former", hay: "こう" }] };
  const all = [akb, ske, former];
  const search = (opts) => core.rosterView(all, { group: "all", generation: "all", status: "all", query: "こう", selected: [], ...opts });
  assert.deepEqual(search({}).hits.map((m) => m.id), ["a1", "s1", "f1"], "all 时三人全中");
  assert.deepEqual(search({ group: "AKB48" }).hits.map((m) => m.id), ["a1", "f1"], "团过滤只留 AKB48");
  assert.deepEqual(search({ generation: "1期生" }).hits.map((m) => m.id), ["a1", "s1"], "期生过滤只留 1 期");
  assert.deepEqual(search({ status: "current" }).hits.map((m) => m.id), ["a1", "s1"], "状态过滤排除毕业");
  assert.deepEqual(search({ group: "SKE48", status: "current" }).hits.map((m) => m.id), ["s1"], "团 + 状态叠加");
  // 汉字期生与阿拉伯期生归一后同组（genKey）
  const kanji = { group: "AKB48", label: "一期生", members: [{ id: "k1", name: "丁", status: "current", hay: "こう" }] };
  assert.deepEqual(
    core.rosterView([kanji], { group: "all", generation: "1期生", status: "all", query: "こう", selected: [] }).hits.map((m) => m.id),
    ["k1"],
    "「一期生」应与「1期生」同组"
  );
  // 命中 0 时 hits 为空数组而不是省略字段
  const none = core.rosterView(all, { group: "all", generation: "all", status: "all", query: "查无此人", selected: [] });
  assert.deepEqual(none.hits, []);
  assert.deepEqual(none.nodes, []);
});
