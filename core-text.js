// 成员字幕 / 命名之外的自由文本 / 简介字段。纯函数，无 DOM。
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AKB_CORE_TEXT = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const TRANSFER_GENERATION = "兼任・移籍加入";

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
    // 文字只列「非自家团」（groups 含自家团 —— 全部隶属的字面义）；三个分支判据不变。
    const others = (m.groups || []).filter((g) => g.group !== m.group);
    if (others.length) {
      const sep = lang === "en" ? ", " : "、";
      const groups = others.map((g) => g.group).join(sep);
      if (m.status === "current" && m.groups.every((g) => g.current))
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

  return {
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
  };
});
