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

  function normalizeName(s) {
    return s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[\u30A1-\u30F6]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) - 0x60)
      )
      .replace(/[﨑髙邉邊濵德瀨]/g, (c) => VARIANTS[c]);
  }

  function haystack(member, fold) {
    const base = normalizeName(
      [member.name, member.kana, member.nick].filter(Boolean).join(" ")
    );
    if (!fold) return base;
    const folded = [...base].map((c) => fold[c] || c).join("");
    return `${base} ${folded}`;
  }

  function foldIndex(simpMap) {
    const out = {};
    for (const [sim, forms] of Object.entries(simpMap || {})) {
      for (const form of forms) out[form] = sim;
    }
    return out;
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
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320"><rect width="240" height="320" fill="#e4e7ee"/><text x="120" y="184" font-size="96" text-anchor="middle" fill="#9aa0b0" font-family="sans-serif">${safe}</text></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function photoSrc(member, size) {
    return member.img
      ? `img/${size}/${member.id}.webp`
      : placeholderSrc(member.name);
  }

  function groupSections(sections, groupFilter) {
    const groups = [];
    const byGroup = new Map();
    sections.forEach((s, index) => {
      if (groupFilter !== "all" && s.group !== groupFilter) return;
      if (!byGroup.has(s.group)) {
        const node = { group: s.group, sections: [] };
        byGroup.set(s.group, node);
        groups.push(node);
      }
      byGroup
        .get(s.group)
        .sections.push({ index, label: s.label, members: s.members });
    });
    return groups;
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
    for (const a of answers) r = g.next(a);
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
  const TRANSFER_GENERATION = "兼任・移籍加入";

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
    const parts = [m.group, m.generation];
    const src = sourceNote(m, t, lang);
    if (src) parts.push(src);
    if (m.status === "current") parts.push(t("active"));
    else parts.push(yearLeave(m, t, lang));
    return parts.filter(Boolean).join(" · ");
  }

  function posterSub(m, t, lang) {
    if (m.status === "current") return m.generation;
    if (isTransfer(m)) {
      return m.leave
        ? `${sourceNote(m, t, lang)} · ${leaveText(m.leave, t, lang)}`
        : sourceNote(m, t, lang);
    }
    if (m.leave) return `${m.generation} · ${yearLeave(m, t, lang)}`;
    return `${m.generation} · ${m.end ? m.end.slice(0, 4) + " " + t("grad_short") : "OG"}`;
  }

  // ---- 命名（随系列/档位变化的品牌、标题、标签与文件名；文案仍来自 i18n） ----
  function names(series, size, t) {
    const saka = series === "sakamichi";
    const brand =
      size === 32
        ? t("brand_32")
        : size === 16
          ? t("brand_16")
          : saka
            ? t("brand_7fukujin")
            : t("brand_7");
    const seriesLabel = t(saka ? "series_saka" : "series_48g");
    const tag = saka ? "#Sakamichi" : "#48Group";
    const filePrefix = saka ? "sakamichi" : "48group";
    return {
      brand,
      seriesLabel,
      title: `${t(saka ? "title_prefix_saka" : "title_prefix_48g")} ${brand}`,
      eyebrow: `${seriesLabel} 好き顔ソート`,
      shareTags: `${tag} #好き顔ソート`,
      posterTags: `${tag}  #好き顔ソート`,
      fileBase:
        size === 7
          ? `${filePrefix}_${saka ? "7fukujin" : "kami7"}`
          : `${filePrefix}_${size}`,
    };
  }

  // ---- 持久化（localStorage 序列化；损坏/过期数据安全丢弃） ----
  const STATE_VERSION = 1;
  const SIZES = [7, 16, 32];

  function serializeState(state) {
    return JSON.stringify({
      v: STATE_VERSION,
      size: state.size,
      selected: state.selected,
      duel: state.duel || null,
    });
  }

  function deserializeState(raw) {
    try {
      const s = JSON.parse(raw);
      if (!s || s.v !== STATE_VERSION || !SIZES.includes(s.size)) return null;
      const selected = Array.isArray(s.selected)
        ? s.selected.filter((x) => typeof x === "string").slice(0, s.size)
        : [];
      let duel = null;
      if (
        s.duel &&
        Array.isArray(s.duel.order) &&
        s.duel.order.length &&
        s.duel.order.every((x) => typeof x === "string") &&
        Array.isArray(s.duel.answers) &&
        s.duel.answers.length <= worstCase(s.duel.order.length) &&
        s.duel.answers.every((x) => typeof x === "boolean")
      ) {
        duel = { order: s.duel.order, answers: s.duel.answers };
      }
      return { size: s.size, selected, duel };
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

  return {
    normalizeName,
    haystack,
    foldIndex,
    isVisible,
    placeholderSrc,
    photoSrc,
    groupSections,
    replay,
    worstCase,
    shuffle,
    serializeState,
    deserializeState,
    duelProgress,
    isTransfer,
    leaveText,
    yearLeave,
    sourceNote,
    metaText,
    fullMeta,
    posterSub,
    names,
  };
});
