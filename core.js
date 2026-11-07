(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AKB_CORE = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TEXT =
    typeof module === "object" && module.exports
      ? require("./core-text.js")
      : globalThis.AKB_CORE_TEXT;
  const {
    isTransfer,
    leaveText,
    yearLeave,
    sourceNote,
    metaText,
    fullMeta,
    posterSub,
    genText,
    bioDate,
    ageOn,
    localized,
    bloodText,
    ordinal,
    profileRows,
  } = TEXT;

  const ROSTER =
    typeof module === "object" && module.exports
      ? require("./core-roster.js")
      : globalThis.AKB_CORE_ROSTER;
  const {
    flattenMembers,
    isVisible,
    placeholderSrc,
    photoSrc,
    groupSections,
    genKey,
    generationOptions,
    rosterView,
  } = ROSTER.create({ normalizeName });

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

  // 「っ」促音：后接音节的辅音加倍。表固定用 ROMAJI_ALT_TABLE（与 alt 无关，历史行为）
  function sokuon(src, i) {
    const next =
      ROMAJI_ALT_TABLE[src.slice(i + 1, i + 3)] ||
      ROMAJI_ALT_TABLE[src[i + 1]] ||
      "";
    return next[0] || "";
  }

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
        out += sokuon(src, i);
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

  // ---- 命名（随系列/档位变化的品牌、标题、标签与文件名；文案仍来自 i18n） ----
  // 每个系列的**全部**命名差异都收在这一张表里。加系列 = 加一行，
  // 而不是再往嵌套三元里塞一层 —— 三个系列时那串三元已经 CCN 12（棘轮红线），
  // 加第四个必超。牌位相关的键（选拔组 / 圈内 / 神7）四个系列共用，不在这里分叉。
  // 皮肤的单一出处：session / 测试 / E2E 都从这里取；index.html 的首屏内联白名单
  // 不能 import，由 test/style-artifact.test.js 断言与这里一致。
  const SKINS = ["akb", "classic", "sticker", "glass", "celadon", "pearl"];

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

  // ---- 持久化（localStorage 序列化；损坏/过期数据安全丢弃） ----
  const STATE_VERSION = 1;
  const SIZES = [7, 16, 40];

  // ---- 分享链接（ADR-0025）：编码最终排名，不编码对决答案 ----
  const SHARE_ID_RE = /^m[0-9a-f]{10}$/;
  const SHARE_TITLE_MAX = 24; // 与结果页标题输入框的 maxlength 一致（单测比对 HTML）
  const hasSeries = (key) => Object.hasOwn(SERIES_KEYS, key);

  function cleanTitle(v) {
    return String(v == null ? "" : v)
      .replace(/[\u0000-\u001f]/g, "")
      .trim()
      .slice(0, SHARE_TITLE_MAX);
  }

  function shareIdsOk(ids, size) {
    return (
      Array.isArray(ids) &&
      ids.length === size &&
      new Set(ids).size === size &&
      ids.every((id) => SHARE_ID_RE.test(id))
    );
  }

  function encodeShare(data) {
    const d = data || {};
    if (!hasSeries(d.series) || !SIZES.includes(d.size)) return "";
    if (!shareIdsOk(d.ids, d.size)) return "";
    // 手拼而不是 URLSearchParams：逗号要保持字面量（可读、可手动检查）
    const r = `${d.series}-${d.size}-${d.ids.join(",")}`;
    const title = cleanTitle(d.title);
    return title ? `r=${r}&t=${encodeURIComponent(title)}` : `r=${r}`;
  }

  function decodeShare(search) {
    const p = new URLSearchParams(search || "");
    const m = /^([a-z0-9]+)-(\d+)-(.+)$/.exec(p.get("r") || "");
    if (!m) return null;
    const series = m[1];
    const size = Number(m[2]);
    if (!hasSeries(series) || !SIZES.includes(size)) return null;
    const ids = m[3].split(",");
    if (!shareIdsOk(ids, size)) return null;
    return { series, size, ids, title: cleanTitle(p.get("t")) };
  }

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

  // 对决：旧格式是扁平的 order（= 单层级），新格式是按层级分组的 tiers
  function validDuel(s) {
    if (!s.duel) return null;
    const tiers = Array.isArray(s.duel.tiers)
      ? s.duel.tiers.filter((g) => Array.isArray(g) && g.length)
      : Array.isArray(s.duel.order) && s.duel.order.length
        ? [s.duel.order]
        : [];
    const flat = tiers.flat();
    const cap = tiers.reduce((sum, g) => sum + worstCase(g.length), 0);
    if (!flat.length) return null;
    if (!flat.every((x) => typeof x === "string")) return null;
    if (!Array.isArray(s.duel.answers)) return null;
    if (s.duel.answers.length > cap) return null;
    if (!s.duel.answers.every((x) => typeof x === "boolean")) return null;
    return { tiers, answers: s.duel.answers };
  }

  // 划除必须落在已选里（脏存档会被过滤掉，而不是带进会话）。
  // 旧格式是平面 id 数组 → 视为「全部在第一轮」；再跨轮去重：同一个人出现在两轮
  // → screenTiers 会把他放进两层 → 对决里同一张脸出现两次、海报出现重复。
  // 应用自己产生不了这种数据（toggleCut 要求 id 在本轮 pool 里），但手改存档可以。
  function validCut(s, selected, size) {
    const flat = Array.isArray(s.cut)
      ? s.cut.filter((x) => typeof x === "string" && selected.includes(x))
      : [];
    const nested =
      Array.isArray(s.cut) && Array.isArray(s.cut[0]) ? s.cut : null;
    return clampCut(selected, nested ? nested : [flat], size);
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
      return {
        size,
        selected,
        duel: validDuel(s),
        cut: validCut(s, selected, size),
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

  // ---- 字体子集选择（#4：预热只拉当前页用得上的 unicode-range 子集）----
  function fontRange(t) {
    const p = t.trim().match(/U\+([0-9a-f?]+)(?:-([0-9a-f]+))?/i);
    if (!p) return null;
    const lo = parseInt(p[1].replace(/\?/g, "0"), 16);
    if (p[2]) return [lo, parseInt(p[2], 16)];
    if (p[1].includes("?")) return [lo, parseInt(p[1].replace(/\?/g, "f"), 16)];
    return [lo, lo];
  }

  function faceCovers(face, codes) {
    const m = face.match(/unicode-range:\s*([^;]+)/i);
    if (!m) return true;
    const ranges = m[1].split(",").map(fontRange).filter(Boolean);
    if (!ranges.length) return true;
    for (const c of codes) {
      for (const [lo, hi] of ranges) if (c >= lo && c <= hi) return true;
    }
    return false;
  }

  // 筛选行按钮的「动作 + 原因」键名（锁定 / 本轮名额用尽 / 划掉 / 保留 —— 四选一）。
  // 前两者曾被折叠成同一句文案：未划但名额用尽的行会听到「这一轮已定」，是假陈述。
  function markReasonKey(locked, noQuota, cut) {
    if (locked) return "screen_locked";
    if (noQuota) return "screen_quota";
    return cut ? "screen_keep" : "screen_cut";
  }

  function faceFamily(face) {
    const m = face.match(/font-family:\s*([^;]+);/i);
    if (!m) return "";
    return m[1]
      .split(",")[0]
      .trim()
      .replace(/^["']|["']$/g, "")
      .toLowerCase();
  }

  // @font-face 的权重可能是单值（700）或可变区间（500 900）
  function faceWeightRange(face) {
    const m = face.match(/font-weight:\s*([^;]+);/i);
    const nums = (m ? m[1] : "").match(/\d+/g) || ["400"];
    return [Number(nums[0]), Number(nums[nums.length - 1])];
  }

  function weightDistance(w, [lo, hi]) {
    return w < lo ? lo - w : w > hi ? w - hi : 0;
  }

  // CSS Fonts 4 §5.2：同 family 里取权重距离最近的一档；平局时
  // 目标 > 500 选更大的权重，否则选更小的。旧实现平局全保留，
  // 600 会同时预热 500/700、800 同时预热 700/900（实测多拉 67.5K）。
  function closestWeight(faces, w) {
    const best = Math.min(...faces.map((f) => weightDistance(w, f.wr)));
    const tied = faces.filter((f) => weightDistance(w, f.wr) === best);
    if (tied.length < 2) return tied;
    const pick =
      w > 500
        ? Math.max(...tied.map((f) => f.wr[0]))
        : Math.min(...tied.map((f) => f.wr[1]));
    return tied.filter((f) => (w > 500 ? f.wr[0] : f.wr[1]) === pick);
  }

  // usages: [{ family, weight, chars }] —— 只预热「这个元素真的会用这个 family/weight
  // 渲染」的子集。此前是「任何可见字符 × 所有 family」：标题字体的 CJK 子集被正文
  // 字符全部点亮（实测 154 个 woff2 / 1.5MB，其中大部分是白拉的）。
  function warmUrls(css, usages) {
    const faces = [];
    for (const block of css.split("@font-face").slice(1)) {
      const cut = block.indexOf("}");
      if (cut < 0) continue;
      const face = block.slice(0, cut);
      const mUrl = face.match(/url\((https:\/\/[^)]+\.woff2)\)/);
      if (!mUrl) continue;
      faces.push({
        family: faceFamily(face),
        wr: faceWeightRange(face),
        block: face,
        url: mUrl[1],
      });
    }
    const chosen = new Set();
    for (const u of usages) {
      const famFaces = faces.filter((f) => f.family === u.family);
      if (!famFaces.length) continue;
      const w = Number(u.weight) || 400;
      for (const f of closestWeight(famFaces, w))
        if (faceCovers(f.block, u.chars)) chosen.add(f.url);
    }
    return [...chosen];
  }

  return {
    SERIES_KEYS,
    SKINS,
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
    encodeShare,
    decodeShare,
    SHARE_TITLE_MAX,
    duelProgress,
    isTransfer,
    leaveText,
    yearLeave,
    sourceNote,
    // 持久化键名的单一出处（全局偏好 vs 按系列存档）。它们是跨模块的契约：
    // session.js 读写、app.js 的粘滞标记、SW 缓存名、E2E 脚本都按这些名字找。
    PREF_KEYS: {
      lang: "akb-lang",
      cols: "akb:cols", // 名册卡片大小档位（一排几张卡）
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
    fontRange,
    faceCovers,
    warmUrls,
    markReasonKey,
    profileRows,
  };
});
