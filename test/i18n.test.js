const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const I18N = require("../i18n.js");
const root = path.join(__dirname, "..");

test("zh/en/ja 键集合一致（en 允许额外的 leave_* 直译）", () => {
  const zh = Object.keys(I18N.zh).sort();
  for (const lang of ["en", "ja"]) {
    const keys = Object.keys(I18N[lang]).sort();
    const allowed = lang === "en" ? (k) => k.startsWith("leave_") : () => false;
    assert.deepEqual(
      keys.filter((k) => !zh.includes(k) && !allowed(k)),
      [],
      lang
    );
    assert.deepEqual(
      zh.filter((k) => !keys.includes(k)),
      [],
      lang
    );
  }
});

test("index.html 引用的 i18n 键都存在", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const keys = new Set();
  for (const m of html.matchAll(
    /data-i18n(?:-placeholder|-alt|-aria-label)?="([^"]+)"/g
  )) {
    keys.add(m[1]);
  }
  assert.ok(keys.size > 0);
  for (const key of keys) {
    for (const lang of ["zh", "en", "ja"]) {
      assert.ok(I18N[lang][key] != null, `${lang} 缺: ${key}`);
    }
  }
});

test("app.js 中静态引用的文案键都存在", () => {
  const src = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const keys = new Set(
    [...src.matchAll(/\bt\(\s*"([A-Za-z0-9_]+)"(?!\s*\+)/g)].map((m) => m[1])
  );
  assert.ok(keys.size > 0);
  for (const key of keys) {
    for (const lang of ["zh", "en", "ja"]) {
      assert.ok(I18N[lang][key] != null, `${lang} 缺: ${key}`);
    }
  }
});

test("names 组合在 zh/en/ja × 系列 × 档位下都解析出真实文案", () => {
  const core = require("../core.js");
  const expectBrand = {
    zh: {
      "48g-7": "神7",
      "sakamichi-7": "7福神",
      "48g-16": "选拔组",
      "sakamichi-16": "选拔组",
      "48g-40": "圈内",
      "sakamichi-40": "圈内",
      "love-7": "推し 7",
      "love-16": "选拔组",
      "love-40": "圈内",
    },
    en: {
      "48g-7": "Kami 7",
      "sakamichi-7": "7 Fukujin",
      "48g-16": "Senbatsu",
      "sakamichi-16": "Senbatsu",
      "48g-40": "Ranked",
      "sakamichi-40": "Ranked",
      "love-7": "Oshi 7",
      "love-16": "Senbatsu",
      "love-40": "Ranked",
    },
    ja: {
      "48g-7": "神7",
      "sakamichi-7": "7福神",
      "48g-16": "選抜",
      "sakamichi-16": "選抜",
      "48g-40": "圏内",
      "sakamichi-40": "圏内",
      "love-7": "推し7",
      "love-16": "選抜",
      "love-40": "圏内",
    },
  };
  for (const lang of ["zh", "en", "ja"]) {
    const t = (k) => I18N[lang][k];
    for (const series of ["48g", "sakamichi", "love"]) {
      for (const size of [7, 16, 40]) {
        const n = core.names(series, size, t);
        const where = `${lang}/${series}/${size}`;
        for (const [field, v] of Object.entries(n)) {
          assert.equal(typeof v, "string", `${where}/${field}`);
          assert.ok(
            v.length > 0 && !v.includes("undefined"),
            `${where}/${field}=${v}`
          );
        }
        assert.equal(n.brand, expectBrand[lang][`${series}-${size}`], where);
        assert.ok(n.title.endsWith(n.brand), `${where}/title=${n.title}`);
        assert.match(
          n.fileBase,
          /^(48group|sakamichi|love)_(kami7|7fukujin|16|40|7)$/
        );
      }
    }
  }
});

test("简介自由文本对照表：结构合法且覆盖产物中的趣味/特技", () => {
  for (const [src, entry] of Object.entries(I18N.values)) {
    assert.ok(src.length > 0);
    assert.equal(typeof entry.zh, "string", `zh 缺 ${src}`);
    assert.equal(typeof entry.en, "string", `en 缺 ${src}`);
    assert.ok(entry.zh.length > 0 && entry.en.length > 0);
  }
  const memberSrc = fs.readFileSync(path.join(root, "members.js"), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(memberSrc, sandbox);
  const texts = new Set();
  for (const sec of sandbox.window.AKB_GROUPS) {
    for (const m of sec.members) {
      const bio = m.bio || {};
      if (bio.hobby) texts.add(bio.hobby);
      if (bio.skill) texts.add(bio.skill);
    }
  }
  for (const v of texts) {
    assert.ok(I18N.values[v], `缺译文: ${v}`);
  }
});

test("core.js 中静态引用的文案键都存在", () => {
  const src = fs.readFileSync(path.join(root, "core.js"), "utf8");
  const keys = new Set(
    [...src.matchAll(/\bt\(\s*"([A-Za-z0-9_]+)"(?!\s*\+)/g)].map((m) => m[1])
  );
  assert.ok(keys.size > 0);
  for (const key of keys) {
    for (const lang of ["zh", "en", "ja"]) {
      assert.ok(I18N[lang][key] != null, `${lang} 缺: ${key}`);
    }
  }
});

test("无引用的键只允许动态家族（死键守卫）", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const sources = [
    html,
    fs.readFileSync(path.join(root, "app.js"), "utf8"),
    fs.readFileSync(path.join(root, "core.js"), "utf8"),
  ].join("\n");
  const refs = new Set(
    [
      ...html.matchAll(
        /data-i18n(?:-placeholder|-alt|-aria-label)?="([^"]+)"/g
      ),
    ].map((m) => m[1])
  );
  for (const m of sources.matchAll(/\bt\(\s*"([A-Za-z0-9_]+)"(?!\s*\+)/g))
    refs.add(m[1]);
  // 动态家族：键在代码里由前缀拼出来的（bio_、series_、pwa_ 的平台指引步骤…）
  const dynamic =
    /^(bio_|series_|title_prefix_|photo_src|leave_|pwa_(ios|android|macos|other)_s|pwa_guide_title_)/;
  const unreferenced = Object.keys(I18N.zh).filter(
    (k) => !refs.has(k) && !dynamic.test(k)
  );
  assert.deepEqual(unreferenced, []);
});

test("真实字典驱动真实字幕/简介：无 undefined、无缺键", () => {
  const core = require("../core.js");
  const memberSrc = fs.readFileSync(path.join(root, "members.js"), "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(memberSrc, sandbox);
  const members = core.flattenMembers(sandbox.window.AKB_GROUPS);
  assert.ok(members.length > 1000, String(members.length));
  for (const lang of ["zh", "en", "ja"]) {
    const t = (k, ...args) => {
      const v = I18N[lang][k];
      return typeof v === "function" ? v(...args) : v;
    };
    for (const m of members) {
      const outs = [
        core.metaText(m, t, lang),
        core.fullMeta(m, t, lang),
        core.posterSub(m, t, lang),
        ...core.profileRows(m, t, lang, I18N.values).flat(),
      ];
      for (const v of outs) {
        assert.equal(typeof v, "string", `${m.name}/${lang}`);
        assert.ok(v.length > 0, `${m.name}/${lang} 空值`);
        assert.ok(!v.includes("undefined"), `${m.name}/${lang}: ${v}`);
        assert.ok(!v.includes("[object"), `${m.name}/${lang}: ${v}`);
      }
    }
  }
});

test("档位芯片与品牌字面值：40 档 = 圈内 40 / 圈内（三语）", () => {
  assert.equal(I18N.zh.mode_40, "圈内 40");
  assert.equal(I18N.zh.brand_40, "圈内");
  assert.equal(I18N.en.mode_40, "Ranked 40");
  assert.equal(I18N.en.brand_40, "Ranked");
  assert.equal(I18N.ja.mode_40, "圏内 40");
  assert.equal(I18N.ja.brand_40, "圏内");
});

// ── 深化⑳：指引步数表的单一出处 ──
// 这张表以前在 app.js 与本文件各写一份，改 app.js 的 ios: 4 → 5 时本文件全绿
// （它拿自己那份 4 去查键），而线上会多渲染一条 undefined 的空白步骤。
test("指引步数表从 i18n 导出，且各语言键都由它派生（不是各写一份）", () => {
  assert.ok(I18N.GUIDE_STEPS, "i18n.js 必须导出 GUIDE_STEPS");
  assert.deepEqual(Object.keys(I18N.GUIDE_STEPS).sort(), [
    "android",
    "ios",
    "macos",
    "other",
  ]);
  const missing = [];
  for (const lang of ["zh", "en", "ja"]) {
    for (const [plat, n] of Object.entries(I18N.GUIDE_STEPS)) {
      const titleKey =
        plat === "other" ? "pwa_guide_title" : "pwa_guide_title_" + plat;
      if (I18N[lang][titleKey] === undefined)
        missing.push(lang + ":" + titleKey);
      // 步数是几，就该有几条文案；多出的文案键与缺键同样是错
      for (let i = 1; i <= n; i++) {
        const k = "pwa_" + plat + "_s" + i;
        if (I18N[lang][k] === undefined) missing.push(lang + ":" + k);
      }
      const extra = Object.keys(I18N[lang]).filter((k) =>
        k.startsWith("pwa_" + plat + "_s")
      );
      if (extra.length !== n)
        missing.push(`${lang}:${plat} 文案 ${extra.length} 条但步数 ${n}`);
    }
  }
  assert.deepEqual(missing, [], "指引键与步数表不匹配：" + missing.join("、"));
});

test("指引步数与文档口径一致（iOS 四步，其余三步）", () => {
  // 这一份是有意的「规格声明」，不是从生产代码复制的副本：
  // iOS 是四步（分享 → 添加到主屏幕）这条是 docs/agents/pwa.md 写着的平台事实。
  assert.deepEqual(I18N.GUIDE_STEPS, {
    ios: 4,
    android: 3,
    macos: 3,
    other: 3,
  });
});

test("步数表只有一个家：app.js 读 i18n 的，不自持一份", () => {
  // 上面的测试只看得见 i18n 侧；app.js 若偷偷自持一份副本，两边会再次分家
  // （这正是修前的形态：改 app.js 的 ios 步数测试照样全绿）。
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  assert.match(src, /I18N\.GUIDE_STEPS/, "app.js 必须读 I18N.GUIDE_STEPS");
  // 锚定那份表的**形状**，不要全文扫 `ios: <数字>`——无关的普通数据会误报
  assert.doesNotMatch(
    src,
    /\bGUIDE_STEPS\s*=\s*\{/,
    "app.js 不得自持步数表（应来自 i18n）"
  );
});

test("会话接受的语言集合 = i18n 字典的键集合（加第四种语言时两处都要红）", () => {
  // 独立事实源是 i18n 字典本身，不是抄一份 ["zh","en","ja"]
  const SESSION = require("../session.js");
  const I18N = require("../i18n.js");
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  const mk = () => SESSION.create({ storage, byId: () => undefined });
  // i18n.js 除三份语言字典外还导出文案元数据（GUIDE_STEPS / values），
  // 它们不是语言码——按「是不是语言字典」筛出来，而不是硬编码三个码
  const META = new Set(["GUIDE_STEPS", "values"]);
  const langs = Object.keys(I18N).filter((k) => !META.has(k));
  assert.ok(langs.length > 0, "i18n 字典不为空");
  // 判据看**状态**而不是返回值：setLang 对「同值」按约定返回 false（与 setSkin 同形），
  // 那是「没变」不是「不接受」
  for (const l of langs) {
    assert.equal(mk().setLang(l) || true, true);
    assert.equal(mk().snapshot().lang, l, `会话应接受 i18n 里存在的语言 ${l}`);
    const s = mk();
    s.setLang("en" === l ? "ja" : "en"); // 先切走，确保下面那次是真的改
    s.setLang(l);
    assert.equal(s.snapshot().lang, l, `会话应能切到 ${l}`);
  }
  // 反向：会话不得接受字典里没有的语言（探针集合含超集，不与实现耦合）
  const CANDIDATES = ["zh", "en", "ja", "fr", "de", "ko", ""];
  const accepted = CANDIDATES.filter((l) => {
    const s = mk();
    s.setLang(l);
    return s.snapshot().lang === l;
  });
  assert.deepEqual(
    [...accepted].sort(),
    [...langs].sort(),
    "会话接受的语言必须与 i18n 字典的键完全一致"
  );
  // 落盘值也只认这些语言
  storage.setItem("akb-lang", "fr");
  assert.notEqual(mk().snapshot().lang, "fr", "字典外的语言不得从落盘值恢复");
});

// ---- 筛选步文案（ADR-0019）：清单页的五类文案三语齐 ----
test("筛选页文案：三语齐且都是函数/字符串（带参的那几个能插值）", () => {
  const I18N = require("../i18n.js");
  const KEYS = [
    "screen_title",
    "screen_intro",
    "screen_keep",
    "screen_cut",
    "screen_min",
    "screen_reset",
  ];
  for (const lang of ["zh", "en", "ja"]) {
    for (const k of KEYS) {
      assert.ok(I18N[lang][k], `${lang} 缺 ${k}`);
    }
    // screen_intro / screen_min 要能带参
    assert.equal(
      typeof I18N[lang].screen_intro,
      "function",
      `${lang}.screen_intro 应是函数`
    );
    assert.equal(
      typeof I18N[lang].screen_min,
      "function",
      `${lang}.screen_min 应是函数`
    );
  }
  // 三语的实际句子互不相同（防止复制粘贴留了原文）——只比「不相等」不够：
  // 把 ja 换成一句**更短**的中文照样不相等，所以还要各自带语言标记
  const t = (l, k, ...a) =>
    typeof I18N[l][k] === "function" ? I18N[l][k](...a) : I18N[l][k];
  for (const k of [
    "screen_title",
    "screen_reset",
    "screen_keep",
    "screen_cut",
  ]) {
    const vals = ["zh", "en", "ja"].map((l) => t(l, k));
    assert.equal(
      new Set(vals).size,
      3,
      `${k} 三语应互不相同：${JSON.stringify(vals)}`
    );
  }
  for (const k of ["screen_intro", "screen_min"]) {
    const vals = ["zh", "en", "ja"].map((l) => t(l, k, 7));
    assert.equal(
      new Set(vals).size,
      3,
      `${k} 三语应互不相同：${JSON.stringify(vals)}`
    );
  }
  // 语言标记：抄成别的语言就抓得到
  assert.match(t("zh", "screen_keep"), /[\u4e00-\u9fff]/);
  assert.match(t("ja", "screen_keep"), /[\u3040-\u30ff]/);
  // en 允许有破折号等排版符号，只要求「没有未翻译的汉字/假名」
  assert.doesNotMatch(t("en", "screen_keep"), /[\u3040-\u9fff]/);
  assert.match(t("ja", "screen_intro", 7), /[\u3040-\u30ff]/);
  assert.doesNotMatch(t("en", "screen_intro", 7), /[\u3040-\u9fff]/);
  // 带参键要真的用上参数
  assert.match(t("zh", "screen_intro", 7), /7/);
  assert.match(t("en", "screen_min", 7), /7/);
  assert.match(t("ja", "screen_min", 7), /7/);
});

// ---- 架构扫描第 4 项：en 字典表必须保持纯拉丁 ----
// 上一批加的 series_saka_short 写成了「坂道」，于是 en 表 167 个键里出现了唯一一个 CJK 串：
// 同一个 tab 在 560px 断点两侧显示两个名字（Sakamichi / 坂道），旋转手机就变。
// en 界面里出现日文本身不是问题（眉标的「好き顔ソート」是 core.names 拼的，不在表里），
// 但**字典表**是给英文用户的文案来源，里面混一个中文词就是漏。
test("en 字典表不含汉字/假名（en 表是纯拉丁的，别混进中文词）", () => {
  const bad = Object.entries(I18N.en)
    .filter(
      ([, v]) => typeof v === "string" && /[\u3040-\u30ff\u4e00-\u9fff]/.test(v)
    )
    .map(([k, v]) => `${k}=${v}`);
  assert.deepEqual(bad, [], `en 表里混进了 CJK：${bad.join(" ")}`);
});

test("系列短标签在三种语言里都是**同一名字的缩写**（不是另一个词）", () => {
  // 判据取形状而非逐字列表：短标签要么与长标签相同，要么是它的前缀式缩写。
  // 这样加第 4 个系列时新键会自动进来，不用改这里。
  for (const lang of ["zh", "en", "ja"]) {
    const t = (k) => {
      const v = I18N[lang][k];
      return typeof v === "function" ? v() : v;
    };
    // 系列键对从字典里派生（`series_*_short` ↔ `series_*`），不写死列表 ——
    // 写死的话「加第 4 个系列时新键会自动进来」就是假的：i18n 侧加了键，这里不会去看。
    const shortKeys = Object.keys(I18N[lang])
      .filter((k) => /^series_.*_short$/.test(k))
      .sort();
    assert.ok(shortKeys.length > 0, `${lang} 一个 series_*_short 键都没有`);
    for (const short of shortKeys) {
      const long = short.replace(/_short$/, "");
      const s = String(t(short));
      const l = String(t(long));
      assert.ok(s.length > 0, `${lang} ${short} 是空的`);
      // 判据取「子序列」而不是前缀/子串：48G 不是「48 Group」的子串（G 来自 Group），
      // 但它显然是同一个名字的缩写。去掉大小写与标点后按序出现即可 —— 换成另一个词
      // （比如把 Sakamichi 的短标签写成 Idol）就过不了。
      const isAbbrev = (shortS, longS) => {
        const a = shortS.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
        const b = longS.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
        let k = 0;
        for (const ch of b) if (k < a.length && a[k] === ch) k++;
        return k === a.length;
      };
      // 「同一个名字」要跨语言判断：团只有一个身份，短标签可以是**任一语言**那个名字的缩写。
      // （ja 的长标签是「48グループ」纯假名，而 48G 的 G 来自英文 Group —— 只看当前语言
      // 就会把合法缩写判成另一个词。）
      const anyLang = ["zh", "en", "ja"].some((lg) => {
        const v = I18N[lg][long];
        return isAbbrev(s, typeof v === "function" ? v() : v);
      });
      assert.ok(
        anyLang,
        `${lang} ${short}「${s}」不是 ${long} 在任何语言下（${["zh", "en", "ja"]
          .map((lg) => String(I18N[lg][long]))
          .join(" / ")}）的缩写 —— 同一 tab 两个名字 = 旋转手机就变`
      );
    }
  }
});
