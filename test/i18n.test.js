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

test("安装指引的动态键三语齐（平台 × 步骤数）", () => {
  // 这些键在 app.js 里是拼出来的（"pwa_" + plat + "_s" + i），死键守卫查不到它们；
  // 缺一个键 t() 会返回 undefined，而 WebIDL 会把 undefined 变成空字符串——
  // 指引里就会静悄悄多出一条空白步骤。
  const STEPS = { ios: 4, android: 3, macos: 3, other: 3 };
  const missing = [];
  for (const lang of ["zh", "en", "ja"]) {
    for (const [plat, n] of Object.entries(STEPS)) {
      const titleKey =
        plat === "other" ? "pwa_guide_title" : "pwa_guide_title_" + plat;
      if (I18N[lang][titleKey] === undefined)
        missing.push(lang + ":" + titleKey);
      for (let i = 1; i <= n; i++) {
        const k = "pwa_" + plat + "_s" + i;
        if (I18N[lang][k] === undefined) missing.push(lang + ":" + k);
      }
    }
  }
  assert.deepEqual(missing, [], "指引键缺失：" + missing.join("、"));
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
  assert.deepEqual(Object.keys(I18N.GUIDE_STEPS).sort(), ["android", "ios", "macos", "other"]);
  const missing = [];
  for (const lang of ["zh", "en", "ja"]) {
    for (const [plat, n] of Object.entries(I18N.GUIDE_STEPS)) {
      const titleKey = plat === "other" ? "pwa_guide_title" : "pwa_guide_title_" + plat;
      if (I18N[lang][titleKey] === undefined) missing.push(lang + ":" + titleKey);
      // 步数是几，就该有几条文案；多出的文案键与缺键同样是错
      for (let i = 1; i <= n; i++) {
        const k = "pwa_" + plat + "_s" + i;
        if (I18N[lang][k] === undefined) missing.push(lang + ":" + k);
      }
      const extra = Object.keys(I18N[lang]).filter((k) => k.startsWith("pwa_" + plat + "_s"));
      if (extra.length !== n) missing.push(`${lang}:${plat} 文案 ${extra.length} 条但步数 ${n}`);
    }
  }
  assert.deepEqual(missing, [], "指引键与步数表不匹配：" + missing.join("、"));
});

test("指引步数与文档口径一致（iOS 四步，其余三步）", () => {
  // 这一份是有意的「规格声明」，不是从生产代码复制的副本：
  // iOS 是四步（分享 → 添加到主屏幕）这条是 docs/agents/pwa.md 写着的平台事实。
  assert.deepEqual(I18N.GUIDE_STEPS, { ios: 4, android: 3, macos: 3, other: 3 });
});

test("步数表只有一个家：app.js 读 i18n 的，不自持一份", () => {
  // 上面的测试只看得见 i18n 侧；app.js 若偷偷自持一份副本，两边会再次分家
  // （这正是修前的形态：改 app.js 的 ios 步数测试照样全绿）。
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
  assert.match(src, /I18N\.GUIDE_STEPS/, "app.js 必须读 I18N.GUIDE_STEPS");
  assert.doesNotMatch(src, /ios:\s*\d/, "app.js 不得自持步数表（应来自 i18n）");
});
