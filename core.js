(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AKB_CORE = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // variant kanji people often type with the common form (山崎 → 山﨑, 高橋 → 髙橋)
  const VARIANTS = {
    﨑: "崎",
    髙: "高",
    邉: "辺",
    邊: "辺",
    濵: "浜",
    德: "徳",
    瀨: "瀬",
  };

  const VARIANT_RE = new RegExp(
    `[${Object.keys(VARIANTS)
      .map((c) => c.replace(/[\\^\]\[-]/g, "\\$&"))
      .join("")}]`,
    "g"
  );

  function normalizeName(s) {
    return s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[\u30A1-\u30F6]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) - 0x60)
      )
      .replace(VARIANT_RE, (c) => VARIANTS[c]);
  }

  // ---- 罗马字检索（假名 → 罗马字：Hepburn 主形 + 常见异形；长音/促音/ん 变体） ----
  const ROMAJI = {
    ぁ: "a",
    あ: "a",
    ぃ: "i",
    い: "i",
    ぅ: "u",
    う: "u",
    ぇ: "e",
    え: "e",
    ぉ: "o",
    お: "o",
    か: "ka",
    き: "ki",
    く: "ku",
    け: "ke",
    こ: "ko",
    が: "ga",
    ぎ: "gi",
    ぐ: "gu",
    げ: "ge",
    ご: "go",
    さ: "sa",
    し: "shi",
    す: "su",
    せ: "se",
    そ: "so",
    ざ: "za",
    じ: "ji",
    ず: "zu",
    ぜ: "ze",
    ぞ: "zo",
    た: "ta",
    ち: "chi",
    つ: "tsu",
    て: "te",
    と: "to",
    だ: "da",
    ぢ: "ji",
    づ: "zu",
    で: "de",
    ど: "do",
    な: "na",
    に: "ni",
    ぬ: "nu",
    ね: "ne",
    の: "no",
    は: "ha",
    ひ: "hi",
    ふ: "fu",
    へ: "he",
    ほ: "ho",
    ば: "ba",
    び: "bi",
    ぶ: "bu",
    べ: "be",
    ぼ: "bo",
    ぱ: "pa",
    ぴ: "pi",
    ぷ: "pu",
    ぺ: "pe",
    ぽ: "po",
    ま: "ma",
    み: "mi",
    む: "mu",
    め: "me",
    も: "mo",
    ゃ: "ya",
    や: "ya",
    ゅ: "yu",
    ゆ: "yu",
    ょ: "yo",
    よ: "yo",
    ら: "ra",
    り: "ri",
    る: "ru",
    れ: "re",
    ろ: "ro",
    ゎ: "wa",
    わ: "wa",
    ゐ: "i",
    ゑ: "e",
    を: "o",
    ん: "n",
    ゔ: "vu",
    きゃ: "kya",
    きゅ: "kyu",
    きょ: "kyo",
    ぎゃ: "gya",
    ぎゅ: "gyu",
    ぎょ: "gyo",
    しゃ: "sha",
    しゅ: "shu",
    しょ: "sho",
    しぇ: "she",
    じゃ: "ja",
    じゅ: "ju",
    じょ: "jo",
    じぇ: "je",
    ちゃ: "cha",
    ちゅ: "chu",
    ちょ: "cho",
    ちぇ: "che",
    ぢゃ: "ja",
    ぢゅ: "ju",
    ぢょ: "jo",
    にゃ: "nya",
    にゅ: "nyu",
    にょ: "nyo",
    ひゃ: "hya",
    ひゅ: "hyu",
    ひょ: "hyo",
    びゃ: "bya",
    びゅ: "byu",
    びょ: "byo",
    ぴゃ: "pya",
    ぴゅ: "pyu",
    ぴょ: "pyo",
    みゃ: "mya",
    みゅ: "myu",
    みょ: "myo",
    りゃ: "rya",
    りゅ: "ryu",
    りょ: "ryo",
    ふぁ: "fa",
    ふぃ: "fi",
    ふぇ: "fe",
    ふぉ: "fo",
    てぃ: "ti",
    でぃ: "di",
    とぅ: "tu",
    どぅ: "du",
    うぃ: "wi",
    うぇ: "we",
    うぉ: "wo",
    ゔぁ: "va",
    ゔぃ: "vi",
    ゔぇ: "ve",
    ゔぉ: "vo",
  };
  const ROMAJI_ALT = {
    し: "si",
    ち: "ti",
    つ: "tu",
    ふ: "hu",
    じ: "zi",
    ぢ: "di",
    づ: "du",
    を: "wo",
    しゃ: "sya",
    しゅ: "syu",
    しょ: "syo",
    しぇ: "sye",
    じゃ: "zya",
    じゅ: "zyu",
    じょ: "zyo",
    じぇ: "zye",
    ちゃ: "tya",
    ちゅ: "tyu",
    ちょ: "tyo",
    ちぇ: "tye",
  };
  const ROMAJI_ALT_TABLE = { ...ROMAJI, ...ROMAJI_ALT };

  function romanize(s, alt) {
    const table = alt ? ROMAJI_ALT_TABLE : ROMAJI;
    const src = String(s == null ? "" : s)
      .toLowerCase()
      .replace(/[\u30A1-\u30F6]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) - 0x60)
      )
      .replace(/[^ぁ-ゖー]/g, "");
    let out = "";
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (c === "ー") continue;
      if (c === "っ") {
        const next =
          ROMAJI_ALT_TABLE[src.slice(i + 1, i + 3)] ||
          ROMAJI_ALT_TABLE[src[i + 1]] ||
          "";
        out += next[0] || "";
        continue;
      }
      const pair = table[src.slice(i, i + 2)];
      if (pair) {
        out += pair;
        i++;
        continue;
      }
      out += table[c] || "";
    }
    return out;
  }

  function romajiForms(s) {
    const collapse = (f) =>
      f.replace(/ou/g, "o").replace(/oo/g, "o").replace(/uu/g, "u");
    const splitN = (f) => f.replace(/n(?=[aiueoy])/g, "nn");
    const geminate = (f) => f.replace(/tch/g, "cch");
    const forms = [];
    for (const f of [romanize(s), romanize(s, true)]) {
      const c = collapse(f);
      forms.push(f, c, splitN(f), splitN(c), geminate(f), geminate(c));
    }
    return [...new Set(forms)].filter(Boolean);
  }

  function haystack(member, fold) {
    // 昵称只显示第一个、其余作为别名 —— 别名仍要搜得到（早安 spec 决定 3）。
    const aliases = Array.isArray(member.nick_aliases)
      ? member.nick_aliases
      : [];
    const base = normalizeName(
      [member.name, member.kana, member.nick, ...aliases]
        .filter(Boolean)
        .join(" ")
    );
    const parts = [base];
    if (fold) parts.push([...base].map((c) => fold[c] || c).join(""));
    const romaji = romajiForms(base).join(" ");
    if (romaji) parts.push(romaji);
    return parts.join(" ");
  }

  function foldIndex(simpMap) {
    const out = {};
    for (const [sim, forms] of Object.entries(simpMap || {})) {
      for (const form of forms) out[form] = sim;
    }
    return out;
  }

  function flattenMembers(groups) {
    const list = [];
    for (const g of groups || []) {
      for (const m of g.members || []) {
        // 回填，不是覆写：48G/坂道/等爱 的成员不带这三项（由段补），
        // 而早安成员自带期生、段的 label 是团名 —— 覆写会把「10期生」冲成
        // 「モーニング娘。」，只有浏览器路径看得见（单测不经这里）。
        m.group = m.group || g.group;
        m.generation = m.generation || g.label;
        m.series = m.series || g.series;
        list.push(m);
      }
    }
    return list;
  }

  function isVisible(member, filter) {
    return filter === "all" || member.status === filter;
  }

  function placeholderSrc(name) {
    const ch =
      String(name || "")
        .trim()
        .charAt(0) || "?";
    const safe = ch.replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
    );
    // core 无 DOM、不读 CSS：占位色与 style.css 的 --placeholder/-ink、poster 令牌默认值保持同值
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320"><rect width="240" height="320" fill="#e4e7ee"/><text x="120" y="184" font-size="96" text-anchor="middle" fill="#9aa0b0" font-family="sans-serif">${safe}</text></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function photoSrc(member, size) {
    return member.img
      ? `img/${size}/${member.id}.webp`
      : placeholderSrc(member.name);
  }

  function kanjiNumber(s) {
    const d = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    const m = /^(.)?十(.)?$/.exec(s);
    if (!m) return d[s] || 0;
    return (m[1] ? (d[m[1]] || 1) * 10 : 10) + (m[2] ? d[m[2]] || 0 : 0);
  }

  // 期生筛选键：汉字期生归一为阿拉伯（櫻坂/日向坂的「一期生」与乃木坂的「1期生」同组）
  function genKey(label) {
    const v = String(label == null ? "" : label);
    const m = /^([一二三四五六七八九十]+)期生$/.exec(v);
    if (!m) return v;
    return `${kanjiNumber(m[1])}期生`;
  }

  const TRANSFER_GENERATION = "兼任・移籍加入";

  // 「这个标签是期生吗」的正向判据，不再用黑名单：黑名单里原本只有三个
  // （兼任・移籍加入 / Team 8 / 其他），早安又添了两个团名 —— 每加一个系列就得
  // 往黑名单里补一条，漏补时下拉里就列出一个团名。形状判据不会烂。
  // 站里所有段标签里**不是**期生的就那五个，其余都以「期生」结尾（选秀N期生也算）。
  function isGenerationLabel(v) {
    return String(v == null ? "" : v).endsWith("期生");
  }

  // 期生有两个存放处，工单 04 之前只有第一个：
  // - 段 label（48G / 坂道 / 等爱：一段一期生）
  // - 成员字段（早安：18 期要逐人存，段的 label 是团名）
  // 收成一处，否则早安的期生下拉里列出来的是团名、选中任何一项都筛不出人。
  function sectionGen(s, m) {
    return genKey((m && m.generation) || s.label || "");
  }

  // 筛选下拉的期生选项：按数据出现顺序去重。groupFilter 给了就只算那个团的 ——
  // 决定 2（℃-ute 没有期生 → 控件不出现）就靠这一条。
  function generationOptions(sections, groupFilter) {
    const out = [];
    const seen = new Set();
    const add = (label) => {
      if (!isGenerationLabel(label)) return;
      const key = genKey(label);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(key);
    };
    for (const s of sections) {
      if (groupFilter && groupFilter !== "all" && s.group !== groupFilter)
        continue;
      add(s.label);
      for (const m of s.members || []) add(m.generation);
    }
    return out;
  }

  function groupSections(sections, groupFilter, genFilter) {
    const wantGen = genFilter && genFilter !== "all" ? genFilter : null;
    const groups = [];
    const byGroup = new Map();
    sections.forEach((s, index) => {
      if (groupFilter !== "all" && s.group !== groupFilter) return;
      // 期生在成员上时不能整段丢掉（那样一个匹配的人都没有），要留下段只留人
      const members = wantGen
        ? (s.members || []).filter((m) => sectionGen(s, m) === wantGen)
        : s.members;
      if (wantGen && !members.length) return;
      if (!byGroup.has(s.group)) {
        const node = { group: s.group, sections: [] };
        byGroup.set(s.group, node);
        groups.push(node);
      }
      byGroup.get(s.group).sections.push({ index, label: s.label, members });
    });
    return groups;
  }

  // ---- 名册投影：过滤/计数/已选一次算清（纯数据；m.hay 由 app 预计算） ----
  // 名册投影分两条代码路径：搜索扁平、树/单团共用（group 决定 mode 标签）。
  function viewSearch(sections, f, q) {
    const hits = [];
    for (const s of sections) {
      if (f.group !== "all" && s.group !== f.group) continue;
      const wantGen = f.generation !== "all" ? f.generation : null;
      for (const m of s.members) {
        if (wantGen && sectionGen(s, m) !== wantGen) continue;
        if (isVisible(m, f.status) && (m.hay || "").includes(q)) hits.push(m);
      }
    }
    return { mode: "search", nodes: [], hits };
  }

  // 单个期生段：可见成员为空时返回 null（整段不进结果）
  function sectionRow(node, s, status, selSet) {
    const members = s.members.filter((m) => isVisible(m, status));
    if (!members.length) return null;
    let current = 0;
    let picked = 0;
    for (const m of members) {
      if (m.status === "current") current++;
      if (selSet.has(m.id)) picked++;
    }
    return {
      id: `${node.group}#${s.label}`,
      label: s.label,
      members,
      count: members.length,
      current,
      picked,
    };
  }

  function viewSections(sections, f, selSet) {
    const nodes = [];
    for (const node of groupSections(sections, f.group, f.generation)) {
      const secs = [];
      let count = 0;
      let current = 0;
      let picked = 0;
      for (const s of node.sections) {
        const row = sectionRow(node, s, f.status, selSet);
        if (!row) continue;
        secs.push(row);
        count += row.count;
        current += row.current;
        picked += row.picked;
      }
      if (!secs.length) continue;
      nodes.push({
        id: `g:${node.group}`,
        group: node.group,
        sections: secs,
        count,
        current,
        picked,
      });
    }
    return nodes;
  }

  function rosterView(sections, opts) {
    const o = opts || {};
    const f = {
      group: o.group || "all",
      generation: o.generation || "all",
      status: o.status || "all",
    };
    const q = normalizeName(o.query || "");
    if (q) return viewSearch(sections, f, q);
    const selSet = new Set(Array.isArray(o.selected) ? o.selected : []);
    return {
      mode: f.group === "all" ? "tree" : "flat",
      nodes: viewSections(sections, f, selSet),
      hits: [],
    };
  }

  function* mergeSort(a) {
    if (a.length <= 1) return a;
    const mid = a.length >> 1;
    const L = yield* mergeSort(a.slice(0, mid));
    const R = yield* mergeSort(a.slice(mid));
    const out = [];
    let i = 0,
      j = 0;
    while (i < L.length && j < R.length) {
      const leftWins = yield [L[i], R[j]];
      out.push(leftWins ? L[i++] : R[j++]);
    }
    return out.concat(L.slice(i), R.slice(j));
  }

  function replay(order, answers) {
    const g = mergeSort(order);
    let r = g.next();
    for (const a of answers) {
      if (r.done) break;
      r = g.next(a);
    }
    return r.done
      ? { done: true, order: r.value }
      : { done: false, pair: r.value };
  }

  function worstCase(n) {
    return n <= 1 ? 0 : worstCase(n >> 1) + worstCase(n - (n >> 1)) + n - 1;
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---- 成员字幕（卡片/对决/结果/海报共用） ----

  function isTransfer(m) {
    return m.generation === TRANSFER_GENERATION;
  }

  function leaveText(reason, t, lang) {
    return lang === "en" ? t("leave_" + reason) || reason : reason;
  }

  function yearLeave(m, t, lang) {
    if (m.leave) {
      const label = leaveText(m.leave, t, lang);
      return m.end ? `${m.end.slice(0, 4)} ${label}` : label;
    }
    return m.end ? t("grad_year", m.end.slice(0, 4)) : t("graduated");
  }

  function sourceNote(m, t, lang) {
    if (m.extras && m.extras.length) {
      const sep = lang === "en" ? ", " : "、";
      const groups = m.extras.map((e) => e.group).join(sep);
      if (m.status === "current" && m.extras.every((e) => e.current))
        return t("src_concurrent", groups);
      if (m.status === "current") return t("src_transferred", groups);
      return t("src_mixed", groups);
    }
    return m.note || "";
  }

  function metaText(m, t, lang) {
    const src = sourceNote(m, t, lang);
    const prefix = src ? `${src} · ` : "";
    if (m.status === "current") return `${prefix}${t("active")}`;
    if (isTransfer(m)) {
      const parts = [src, yearLeave(m, t, lang)].filter(Boolean);
      return parts.join(" · ") || t("transfer");
    }
    return `${prefix}${yearLeave(m, t, lang)}`;
  }

  function fullMeta(m, t, lang) {
    const parts = [m.group, genText(m.generation, lang)];
    const src = sourceNote(m, t, lang);
    if (src) parts.push(src);
    if (m.status === "current") parts.push(t("active"));
    else parts.push(yearLeave(m, t, lang));
    return parts.filter(Boolean).join(" · ");
  }

  function posterSub(m, t, lang) {
    const gen = genText(m.generation, lang);
    if (m.status === "current") return gen;
    if (isTransfer(m)) {
      return m.leave
        ? `${sourceNote(m, t, lang)} · ${leaveText(m.leave, t, lang)}`
        : sourceNote(m, t, lang);
    }
    if (m.leave) return `${gen} · ${yearLeave(m, t, lang)}`;
    return `${gen} · ${m.end ? m.end.slice(0, 4) + " " + t("grad_short") : "OG"}`;
  }

  // ---- 命名（随系列/档位变化的品牌、标题、标签与文件名；文案仍来自 i18n） ----
  // 每个系列的**全部**命名差异都收在这一张表里。加系列 = 加一行，
  // 而不是再往嵌套三元里塞一层 —— 三个系列时那串三元已经 CCN 12（棘轮红线），
  // 加第四个必超。牌位相关的键（选拔组 / 圈内 / 神7）四个系列共用，不在这里分叉。
  const SERIES_KEYS = {
    "48g": {
      brand7: "brand_7",
      label: "series_48g",
      short: "series_48g_short",
      tag: "#48Group",
      filePrefix: "48group",
      titlePrefix: "title_prefix_48g",
      slug7: "kami7",
    },
    sakamichi: {
      brand7: "brand_7fukujin",
      label: "series_saka",
      short: "series_saka_short",
      tag: "#Sakamichi",
      filePrefix: "sakamichi",
      titlePrefix: "title_prefix_saka",
      slug7: "7fukujin",
    },
    love: {
      brand7: "brand_7oshi",
      label: "series_love",
      short: "series_love_short",
      tag: "#イコノイジョイ",
      filePrefix: "love",
      titlePrefix: "title_prefix_love",
      slug7: "7",
    },
    // 早安没有「选拔组」文化 —— 7 档叫 Modeshi 7（推し 7），
    // 那是它唯一能与「7」对话的制度（grilling R2-Q1）。
    morning: {
      brand7: "brand_7modeshi",
      label: "series_morning",
      short: "series_morning_short",
      tag: "#モーニング娘。",
      filePrefix: "morningmusume",
      titlePrefix: "title_prefix_morning",
      slug7: "modeshi7",
    },
  };

  function names(series, size, t) {
    const k = SERIES_KEYS[series] || SERIES_KEYS["48g"];
    // 注意这三个 t(...) 各自独立成句（而不是 t(cond ? "brand_40" : …)）：
    // 死键守卫的 grep 是 `\bt\(\s*"key"`，键写在调用实参的三元里它就看不见了 ——
    // 我第一版写成 `t(size === 40 ? …)`，brand_16/brand_40 立刻变成「无人引用的键」。
    const brand =
      size === 40 ? t("brand_40") : size === 16 ? t("brand_16") : t(k.brand7);
    const seriesLabel = t(k.label);
    // 窄屏用的短标签：390px 放不下全长（en「=LOVE Family」右边缘到 457 > 视口 390），
    // 而品牌还随系列变宽（神7 79 / 7福神 123 / 推し 7 132），所以 tab 必须有短形。
    const seriesShort = t(k.short);
    const tag = k.tag;
    return {
      brand,
      seriesLabel,
      seriesShort,
      title: `${t(k.titlePrefix)} ${brand}`,
      eyebrow: `${seriesLabel} 好き顔ソート`,
      shareTags: `${tag} #好き顔ソート`,
      posterTags: `${tag}  #好き顔ソート`,
      fileBase:
        size === 7 ? `${k.filePrefix}_${k.slug7}` : `${k.filePrefix}_${size}`,
    };
  }

  // ---- 简介（字段组装 + 值本地化；文案经 t，自由文本经 values 对照表） ----
  const PREFECTURES = {
    北海道: ["北海道", "Hokkaido"],
    青森県: ["青森县", "Aomori"],
    岩手県: ["岩手县", "Iwate"],
    宮城県: ["宫城县", "Miyagi"],
    秋田県: ["秋田县", "Akita"],
    山形県: ["山形县", "Yamagata"],
    福島県: ["福岛县", "Fukushima"],
    茨城県: ["茨城县", "Ibaraki"],
    栃木県: ["栃木县", "Tochigi"],
    群馬県: ["群马县", "Gunma"],
    埼玉県: ["埼玉县", "Saitama"],
    千葉県: ["千叶县", "Chiba"],
    東京都: ["东京都", "Tokyo"],
    神奈川県: ["神奈川县", "Kanagawa"],
    新潟県: ["新潟县", "Niigata"],
    富山県: ["富山县", "Toyama"],
    石川県: ["石川县", "Ishikawa"],
    福井県: ["福井县", "Fukui"],
    山梨県: ["山梨县", "Yamanashi"],
    長野県: ["长野县", "Nagano"],
    岐阜県: ["岐阜县", "Gifu"],
    静岡県: ["静冈县", "Shizuoka"],
    愛知県: ["爱知县", "Aichi"],
    三重県: ["三重县", "Mie"],
    滋賀県: ["滋贺县", "Shiga"],
    京都府: ["京都府", "Kyoto"],
    大阪府: ["大阪府", "Osaka"],
    兵庫県: ["兵库县", "Hyogo"],
    奈良県: ["奈良县", "Nara"],
    和歌山県: ["和歌山县", "Wakayama"],
    鳥取県: ["鸟取县", "Tottori"],
    島根県: ["岛根县", "Shimane"],
    岡山県: ["冈山县", "Okayama"],
    広島県: ["广岛县", "Hiroshima"],
    山口県: ["山口县", "Yamaguchi"],
    徳島県: ["德岛县", "Tokushima"],
    香川県: ["香川县", "Kagawa"],
    愛媛県: ["爱媛县", "Ehime"],
    高知県: ["高知县", "Kochi"],
    福岡県: ["福冈县", "Fukuoka"],
    佐賀県: ["佐贺县", "Saga"],
    長崎県: ["长崎县", "Nagasaki"],
    熊本県: ["熊本县", "Kumamoto"],
    大分県: ["大分县", "Oita"],
    宮崎県: ["宫崎县", "Miyazaki"],
    鹿児島県: ["鹿儿岛县", "Kagoshima"],
    沖縄県: ["冲绳县", "Okinawa"],
  };

  const ZODIAC = {
    おひつじ座: ["白羊座", "Aries"],
    おうし座: ["金牛座", "Taurus"],
    ふたご座: ["双子座", "Gemini"],
    かに座: ["巨蟹座", "Cancer"],
    しし座: ["狮子座", "Leo"],
    おとめ座: ["处女座", "Virgo"],
    てんびん座: ["天秤座", "Libra"],
    さそり座: ["天蝎座", "Scorpio"],
    いて座: ["射手座", "Sagittarius"],
    やぎ座: ["摩羯座", "Capricorn"],
    みずがめ座: ["水瓶座", "Aquarius"],
    うお座: ["双鱼座", "Pisces"],
  };

  const MONTHS_EN = [
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

  function bioDate(v, lang) {
    const m = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(v || "");
    if (!m) return v || "";
    const y = m[1],
      mo = +m[2],
      d = +m[3];
    if (lang === "en") return `${MONTHS_EN[mo - 1]} ${d}, ${y}`;
    if (lang === "ja") return `${y}年${mo}月${d}日`;
    return `${y}/${mo}/${d}`;
  }

  function ageOn(birth, now) {
    const m = /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/.exec(birth || "");
    if (!m) return null;
    const y = +m[1],
      mo = +m[2],
      d = +m[3];
    const n = now || new Date();
    let age = n.getFullYear() - y;
    if (n.getMonth() + 1 < mo || (n.getMonth() + 1 === mo && n.getDate() < d))
      age--;
    return age;
  }

  function localized(map, v, lang) {
    if (lang === "ja") return v;
    const pair = map[v];
    return pair ? pair[lang === "en" ? 1 : 0] : v;
  }

  function bloodText(v, lang) {
    if (!v || lang !== "en") return v;
    return v.replace(/^([ABO]+)型$/, "Type $1");
  }

  function ordinal(n) {
    return n === "1" ? "st" : n === "2" ? "nd" : n === "3" ? "rd" : "th";
  }

  function genText(v, lang) {
    if (!v) return v;
    const draft = /^选秀(\d+)期生$/.exec(v);
    if (draft) {
      if (lang === "ja") return `ドラフト${draft[1]}期生`;
      if (lang === "en") return `Draft ${draft[1]}${ordinal(draft[1])} gen`;
      return v;
    }
    if (lang !== "en") return v;
    const m = /^(\d+)(?:\.(\d))?期生$/.exec(v);
    if (!m) return v;
    if (m[2]) return `${m[1]}.${m[2]} gen`;
    return `${m[1]}${ordinal(m[1])} gen`;
  }

  function profileRows(m, t, lang, values, now) {
    const bio = m.bio || {};
    const rows = [];
    const push = (key, value) => {
      if (value) rows.push([t(key), String(value)]);
    };
    const text = (v) => {
      if (!v) return "";
      const entry = values && values[v];
      return entry ? entry[lang] || v : v;
    };
    push("bio_birth", bioDate(bio.birth, lang));
    const age = ageOn(bio.birth, now);
    if (age != null) push("bio_age", age);
    if (bio.from) push("bio_from", localized(PREFECTURES, bio.from, lang));
    push("bio_height", bio.height);
    push("bio_blood", bloodText(bio.blood, lang));
    if (bio.sign) push("bio_sign", localized(ZODIAC, bio.sign, lang));
    push("bio_hobby", text(bio.hobby));
    push("bio_skill", text(bio.skill));
    push("bio_nick", m.nick);
    push("bio_group", m.group);
    if (m.generation) push("bio_gen", genText(m.generation, lang));
    if (m.status === "current") push("bio_status", t("active"));
    else if (m.status) push("bio_status", yearLeave(m, t, lang));
    push("bio_romaji", bio.romaji);
    return rows;
  }

  // ---- 持久化（localStorage 序列化；损坏/过期数据安全丢弃） ----
  const STATE_VERSION = 1;
  const SIZES = [7, 16, 40];

  function serializeState(state) {
    return JSON.stringify({
      v: STATE_VERSION,
      size: state.size,
      selected: state.selected,
      duel: state.duel || null,
      // 划除按轮次分组（ADR-0019 改写版）；旧存档是平面数组 → 迁移成单个轮次
      cut:
        state.cut && state.cut.length && !Array.isArray(state.cut[0])
          ? [state.cut]
          : state.cut || [],
      // 用户为第几轮点过「继续细分」。不落盘的话刷新会忘掉这个选择：
      // 提交口重新打开、「继续细分」也回来，同一轮的两个出口在刷新边界上不一致。
      deeperRound: state.deeperRound || 0,
    });
  }

  function deserializeState(raw) {
    try {
      const s = JSON.parse(raw);
      if (!s || s.v !== STATE_VERSION) return null;
      // 旧 32 档存档迁移为 40 档（已选与对决保留）
      const size = s.size === 32 ? 40 : s.size;
      if (!SIZES.includes(size)) return null;
      const selected = Array.isArray(s.selected)
        ? s.selected.filter((x) => typeof x === "string").slice(0, size)
        : [];
      // 对决：旧格式是扁平的 order（= 单层级），新格式是按层级分组的 tiers
      let duel = null;
      if (s.duel) {
        const tiers = Array.isArray(s.duel.tiers)
          ? s.duel.tiers.filter((g) => Array.isArray(g) && g.length)
          : Array.isArray(s.duel.order) && s.duel.order.length
            ? [s.duel.order]
            : [];
        const flat = tiers.flat();
        const cap = tiers.reduce((sum, g) => sum + worstCase(g.length), 0);
        if (
          flat.length &&
          flat.every((x) => typeof x === "string") &&
          Array.isArray(s.duel.answers) &&
          s.duel.answers.length <= cap &&
          s.duel.answers.every((x) => typeof x === "boolean")
        ) {
          duel = { tiers, answers: s.duel.answers };
        }
      }
      // 划除必须落在已选里（脏存档会被过滤掉，而不是带进会话）。
      // 旧格式是平面 id 数组 → 视为「全部在第一轮」。
      const flat = Array.isArray(s.cut)
        ? s.cut.filter((x) => typeof x === "string" && selected.includes(x))
        : [];
      const nested =
        Array.isArray(s.cut) && Array.isArray(s.cut[0]) ? s.cut : null;
      // 还要跨轮去重：同一个人出现在两轮 → screenTiers 会把他放进两层
      // → 对决里同一张脸出现两次、海报出现重复。应用自己产生不了这种数据
      // （toggleCut 要求 id 在本轮 pool 里），但手改存档可以。
      const cut = clampCut(selected, nested ? nested : [flat], size);
      return {
        size,
        selected,
        duel,
        cut,
        deeperRound:
          Number.isInteger(s.deeperRound) && s.deeperRound > 0
            ? s.deeperRound
            : 0,
      };
    } catch (err) {
      return null;
    }
  }

  // ---- 对决进度（剩余按最坏题数估算，ETA 按经验 5s/题） ----
  const SECONDS_PER_DUEL = 5;

  function duelProgress(size, answered) {
    const max = worstCase(size);
    const done = Math.max(0, Math.min(answered, max));
    const remaining = max - done;
    return {
      answered: done,
      max,
      percent: max ? Math.round((done / max) * 100) : 0,
      remaining,
      etaSeconds: remaining * SECONDS_PER_DUEL,
    };
  }

  // 逐层对决的进度：题数上限是各层级组大小之和（筛到哪一轮决定问多少题）
  function tierProgress(tiers, answered) {
    const max = tiers.reduce((sum, g) => sum + worstCase(g.length), 0);
    const done = Math.max(0, Math.min(answered, max));
    const remaining = max - done;
    // 当前在第几层 / 该层内第几题（由答案数跨层累加得出）
    let tier = 0;
    let local = done;
    for (const g of tiers) {
      const w = worstCase(g.length);
      if (local <= w) break;
      local -= w;
      tier += 1;
    }
    return {
      answered: done,
      max,
      percent: max ? Math.round((done / max) * 100) : 0,
      remaining,
      etaSeconds: remaining * SECONDS_PER_DUEL,
      tier,
      tiers: tiers.length,
      tierAnswered: local,
      tierMax: worstCase(tiers[tier] ? tiers[tier].length : 0),
    };
  }

  // ---- 对决里程碑（50% 只庆祝一次；刷新进入已越过的对决只标记不庆祝） ----
  const HALFWAY_PERCENT = 50;

  function milestone(percent, shown) {
    if (shown) return { shown: true, celebrate: false };
    if (!(percent >= HALFWAY_PERCENT))
      return { shown: false, celebrate: false };
    return { shown: true, celebrate: true };
  }

  // ---- 筛选：逐轮二分（ADR-0019 改写版） ----
  // 保留组剩 SCREEN_STOP 人就停：4 人以下组内排序的边际收益极小
  // （保 3 → 3 题 vs 保 4 → 5 题，差 2 题却少一个完整名次）。
  const SCREEN_STOP = 4;

  // 划除数据的**唯一清洗口**：三层都要夹，缺一层就有看得见的症状。
  //   ① 成员归属 —— 划掉的人必须在已选里；
  //   ② 跨轮去重 —— 同一人出现在两轮会被 screenTiers 放进两层（对决里同一张脸出现两次、
  //      海报出现重复）；
  //   ③ 每轮人数 —— 上限是 screenRounds(size).cuts[r]（每轮划掉的一半）。
  // 越界形状的来源：旧扁平 cut 迁移（把全部 id 塞进第一轮）、手改存档、以及
  // session.setSize 缩小档位（selected 被截断、cut 却留着旧档位的 id）。
  // 后果不是「数据脏」而是**同一屏两个数字打架**：提交按钮按计划算、细条按实际层级算。
  // deserializeState（load 路径）与 session.setSize（运行路径）都必须过这里 ——
  // 只在 load 路径夹，setSize 之后仍然会分叉。
  // 配额必须按**实际已选人数**算，不能按档位：`screenStep` 拿的是实际人数（少于档位
  // 也要能排），两套基准会让夹出来的层级下一步根本不认 —— 表现为「同一屏两个数字打架」。
  function clampCut(selected, cutRounds, size) {
    const sel = Array.isArray(selected) ? selected : [];
    const basis = Math.min(
      typeof size === "number" ? size : sel.length,
      sel.length
    );
    const quotas = screenRounds(basis).cuts;
    const rounds = Array.isArray(cutRounds) ? cutRounds : [];
    const seen = new Set();
    const out = [];
    rounds.slice(0, quotas.length).forEach((ids, r) => {
      const kept = (Array.isArray(ids) ? ids : [])
        .filter((x) => {
          if (typeof x !== "string" || !sel.includes(x) || seen.has(x))
            return false;
          seen.add(x);
          return true;
        })
        .slice(0, quotas[r]); // 第 r 轮上限（两件事一趟做完：过滤 + 截断）
      if (kept.length) out.push(kept); // 空轮次丢掉（否则 screenTiers 会多一层空的）
    });
    return out;
  }

  // 一档位完整筛到停的轮次计划
  function screenRounds(size) {
    const cuts = [];
    let kept = Math.max(0, size);
    while (kept > SCREEN_STOP) {
      const c = Math.floor(kept / 2);
      cuts.push(c);
      kept -= c;
    }
    return { cuts, kept };
  }

  // 当前这一轮的进度：cutRounds 是「按轮次分组的已划 id」。
  // deeperRound = 用户为「哪一轮」点过继续细分。轮次是自动推进的，所以「本轮刚划完、
  // 可以提交」和「已经在下一轮里」必须由这个显式信号区分 —— 否则 complete 会在轮次
  // 推进的瞬间丢掉，用户就没法在第一轮就提交（Q5 批准的是「可提交 or 继续细分」二选一）。
  //
  // 它必须**按轮**记而不是全局布尔：全局闩锁会让第二轮之后的边界永久消失
  // （提交禁用 + 「继续细分」按钮不出现 = 静默逼着划到底）。每轮都要能二选一。
  function screenStep(size, cutRounds, deeperRound) {
    const rounds = Array.isArray(cutRounds) ? cutRounds : [];
    let pool = Math.max(0, size);
    let round = 0;
    let cut = 0;
    // 「刚推进过一轮」：轮次一推进 cut 就归零，所以这是唯一能识别
    // 「上一轮刚划完、用户还没决定要不要继续细分」的信号
    let justAdvanced = false;
    for (const ids of rounds) {
      if (pool <= SCREEN_STOP) break;
      const inRound = new Set(ids).size;
      if (inRound < Math.floor(pool / 2)) {
        cut = inRound; // 这一轮还没划够，停在轮内
        break;
      }
      // 继续迭代时 cut 必为初始的 0：非零只在下面那个 break 分支写入（那里已退出）
      pool -= inRound;
      round += 1;
      justAdvanced = true;
    }
    if (pool <= SCREEN_STOP) {
      return {
        round,
        need: 0,
        cut: 0,
        canCut: 0,
        pool,
        complete: true,
        filled: true,
        atBoundary: true, // 保留组到下限，没有更深的轮次了
      };
    }
    const need = Math.floor(pool / 2);
    // 划掉的必须是这一轮池子里的人；越界的忽略。
    // 「定值门槛」由 toggleCut 拒绝超额来守（canCut 归零），所以这里 cut ≤ need。
    const filled = cut >= need;
    // 刚划完一轮、且这一轮一个都还没划 → 二选一（提交 or 再细分）。
    // 「已经进这一轮并划了几个」本身就说明用户往下走了，不能算边界。
    // deeperRound === round 表示用户就是为这一轮点过「继续细分」→ 本轮不给出提交。
    const deeperHere = deeperRound === round;
    const atBoundary = justAdvanced && cut === 0 && !deeperHere;
    return {
      round,
      need,
      cut,
      canCut: Math.max(0, need - cut),
      pool,
      filled,
      atBoundary,
      // 提交门槛：本轮划够、或者刚划完一轮还没决定要不要继续 → 都能提交
      complete: filled || atBoundary,
    };
  }

  // 层级：由内到外（最内层 = 前 K 名，越早划的组越靠后）
  function screenTiers(selected, cutRounds) {
    const rounds = (Array.isArray(cutRounds) ? cutRounds : []).filter(
      (x) => x.length
    );
    const gone = new Set(rounds.flat());
    const inner = selected.filter((id) => !gone.has(id));
    return [inner, ...rounds.slice().reverse()];
  }

  // 题数上限 = 各层级组大小之和（筛到哪一轮决定问多少题）
  // 筛选按钮上的「约 N 题」是**预测**：本轮填满之后会是什么题数。
  // 预测与实际（tierProgress 用 screenTiers 算）必须一致，所以两边必须用**同一个基准** ——
  // 池子大小（实际已选人数），不是档位。少选的存档形状下两者曾算出两个数（34 vs 49）。
  // 注意 `roundsDone` 是「已完成轮数」（screenStep 的 round）；按钮只在 complete 时显示
  // 题数，那时预测恰好等于实际 —— 这条恒等由 core.test.js 钉住。
  function tierQuestionMax(selected, cutRounds, roundsDone) {
    const pool = (Array.isArray(selected) ? selected : []).length;
    const { cuts } = screenRounds(pool);
    const done = typeof roundsDone === "number" ? roundsDone : cuts.length;
    const used = cuts.slice(0, done);
    // 层级 = [最内层保留组, ...各轮划掉组（倒序）]；kept 按「实际用了几轮」算 ——
    // 筛得浅题数反而多，所以不能拿完整计划的 kept。
    const kept = pool - used.reduce((a, b) => a + b, 0);
    return [kept, ...used.slice().reverse()].reduce(
      (sum, n) => sum + worstCase(n),
      0
    );
  }

  // 逐层排序：对手只来自同一层级（跨层级比较会推翻「保留组占据前 K 名」）
  function* rankTiers(tiers) {
    const out = [];
    for (const g of tiers) out.push(yield* mergeSort(g));
    return out.flat();
  }

  function replayTiers(tiers, answers) {
    const g = rankTiers(tiers);
    let r = g.next();
    for (const a of answers) {
      if (r.done) break;
      r = g.next(a);
    }
    return r.done
      ? { done: true, order: r.value }
      : { done: false, pair: r.value };
  }

  // ---- 导航相位（view 转移表；view 不持久化，刷新由相位恢复。ADR-0013） ----
  // screening = 清单筛选那一站（ADR-0019）：挑人之后、排序之前，独立可续玩
  const NAV_VIEWS = ["pick", "screening", "duel", "result"];

  function navState(ctx) {
    const c = ctx || {};
    const size = c.size > 0 ? c.size : 7;
    const selected = c.selected > 0 ? c.selected : 0;
    return {
      view: NAV_VIEWS.includes(c.view) ? c.view : "pick",
      phase: NAV_VIEWS.includes(c.phase) ? c.phase : "pick",
      size,
      selected,
      step: c.step,
      full: selected >= size,
      // 筛选门槛（ADR-0019 改写版）：本轮划够一半或已到「刚划完一轮」边界。
      // 旧口径是 kept >= size，而 kept = 已选 − 已划 ≤ size → 恒为「只有全留才能提交」。
      canScreen: c.canScreen === true, // 缺省即「不提交」（脏调用保守回退）
    };
  }

  const stay = (s) => ({ view: s.view, effect: "none" });
  const dropDuel = (s) =>
    s.phase === "pick" ? stay(s) : { view: "pick", effect: "abandon" };

  const NAV_RULES = {
    boot: (s) => ({ view: s.phase, effect: "none" }),
    sync: (s) =>
      s.view === s.phase && s.view !== "pick"
        ? stay(s)
        : { view: "pick", effect: "none" },
    pick: (s) =>
      s.view === "result"
        ? { view: "pick", effect: "abandon" }
        : { view: "pick", effect: "none" },
    // 进筛选：已选满即可（划不划是用户的事，门槛在提交时）
    screen: (s) =>
      s.phase === "screening"
        ? { view: "screening", effect: "none" }
        : s.full
          ? { view: "screening", effect: "none" }
          : stay(s),
    // 提交筛选：门槛是「本轮划够一半」（不是「留下的人够档位」——那个条件恒真/恒假）
    rank: (s) =>
      s.view === "screening" || s.phase === "screening"
        ? s.canScreen
          ? { view: "duel", effect: "start" }
          : stay(s)
        : s.phase === "duel"
          ? { view: "duel", effect: "resume" }
          : stay(s),
    // 步骤条 ②：还没开始就去筛选页（ADR-0019 改写版），对决中才是对决。
    // 相位是 screening 时也要回筛选页 —— 从挑人页点 ② 之前相位已经是 screening 了。
    duel: (s) =>
      s.phase === "duel"
        ? { view: "duel", effect: "none" }
        : s.phase === "screening"
          ? { view: "screening", effect: "none" }
          : s.phase === "pick" && s.full
            ? { view: "screening", effect: "none" }
            : stay(s),
    result: (s) =>
      s.phase === "result" ? { view: "result", effect: "none" } : stay(s),
    start: (s) =>
      s.phase === "duel"
        ? { view: "duel", effect: "resume" }
        : s.phase === "screening"
          ? { view: "screening", effect: "none" }
          : s.full
            ? { view: "screening", effect: "none" }
            : stay(s),
    resume: (s) =>
      s.phase === "duel" ? { view: "duel", effect: "none" } : stay(s),
    drop: dropDuel,
    restart: dropDuel,
    leave: () => ({ view: "pick", effect: "none" }),
    resort: (s) =>
      s.phase === "result" ? { view: "duel", effect: "start" } : stay(s),
    advance: (s) =>
      s.phase === "result"
        ? { view: "result", effect: "none" }
        : s.phase === "duel"
          ? { view: "duel", effect: "none" }
          : stay(s),
  };

  function nav(ctx, intent) {
    const s = navState(ctx);
    const rule = Object.prototype.hasOwnProperty.call(NAV_RULES, intent)
      ? NAV_RULES[intent]
      : null;
    return rule ? rule(s) : stay(s);
  }

  function steps(ctx) {
    const s = navState(ctx);
    return [
      {
        key: "pick",
        active: s.view === "pick",
        enabled: true,
        badge: `${s.selected}/${s.size}`,
      },
      {
        key: "duel",
        active: s.view === "duel" || s.view === "screening",
        enabled:
          s.phase === "duel" ||
          s.phase === "screening" ||
          (s.phase === "pick" && s.full),
        badge: s.phase === "duel" && s.step != null ? s.step : null,
      },
      {
        key: "result",
        active: s.view === "result",
        enabled: s.phase === "result",
        badge: null,
      },
    ];
  }

  return {
    SERIES_KEYS,
    normalizeName,
    haystack,
    romanize,
    flattenMembers,
    genText,
    foldIndex,
    isVisible,
    placeholderSrc,
    photoSrc,
    groupSections,
    genKey,
    generationOptions,
    rosterView,
    replay,
    replayTiers,
    screenRounds,
    screenStep,
    screenTiers,
    clampCut,
    tierQuestionMax,
    tierProgress,
    worstCase,
    shuffle,
    milestone,
    nav,
    steps,
    serializeState,
    deserializeState,
    duelProgress,
    isTransfer,
    leaveText,
    yearLeave,
    sourceNote,
    // 持久化键名的单一出处（全局偏好 vs 按系列存档）。它们是跨模块的契约：
    // session.js 读写、app.js 的粘滞标记、SW 缓存名、E2E 脚本都按这些名字找。
    PREF_KEYS: {
      lang: "akb-lang",
      skin: "akb:skin",
      series: "akb:series",
      posterStyle: "akb:poster-style",
      coach: "akb:coach:v1",
      duelIntro: "akb:duelintro:v1",
      state: (s) => `akb:state:v2:${s}`, // 按系列存档
    },
    metaText,
    fullMeta,
    posterSub,
    names,
    profileRows,
  };
});
