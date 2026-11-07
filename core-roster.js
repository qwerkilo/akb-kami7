// 名册投影：扁平化、期生/团分组、搜索与树/单团两种视图。纯函数，无 DOM。
(function (root, factory) {
  const api = factory;
  if (typeof module === "object" && module.exports)
    module.exports = { create: api };
  else root.AKB_CORE_ROSTER = { create: api };
})(typeof globalThis !== "undefined" ? globalThis : this, function (deps) {
  "use strict";
  const { normalizeName } = deps;

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

  // 一人多团（转籍者）：记录只留一份（最近归属），但**每个待过的团都该看到他** ——
  // 按团筛选时把其他团里 groups 含本团的人补进来。选人按 id，补进来不会产生重复。
  function crossGroupMembers(sections, groupFilter) {
    const out = [];
    const seen = new Set();
    for (const s of sections) {
      if (s.group === groupFilter) continue;
      for (const m of s.members || []) {
        const gs = Array.isArray(m.groups) ? m.groups : [];
        if (!gs.some((g) => g.group === groupFilter) || seen.has(m.id))
          continue;
        seen.add(m.id);
        out.push(m);
      }
    }
    return out;
  }

  function groupSections(sections, groupFilter, genFilter) {
    const wantGen = genFilter && genFilter !== "all" ? genFilter : null;
    const extra =
      groupFilter !== "all" ? crossGroupMembers(sections, groupFilter) : [];
    const groups = [];
    const byGroup = new Map();
    let extraUsed = false;
    sections.forEach((s, index) => {
      if (groupFilter !== "all" && s.group !== groupFilter) return;
      let members = s.members;
      // 补进来的人只挂到本团的第一个段（单团一段时就是那一段）
      if (extra.length && !extraUsed) {
        members = members.concat(extra);
        extraUsed = true;
      }
      // 期生在成员上时不能整段丢掉（那样一个匹配的人都没有），要留下段只留人
      if (wantGen)
        members = members.filter((m) => sectionGen(s, m) === wantGen);
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
  function searchHit(s, m, f, wantGen, q) {
    if (!isVisible(m, f.status)) return false;
    if (wantGen && sectionGen(s, m) !== wantGen) return false;
    return (m.hay || "").includes(q);
  }

  function viewSearch(sections, f, q) {
    const wantGen = f.generation !== "all" ? f.generation : null;
    const hits = [];
    for (const s of sections) {
      // 段级不整段跳过：转籍者的记录在别的团段里，按团搜也要能搜到（认 m.groups）
      for (const m of s.members) {
        const gs = Array.isArray(m.groups) ? m.groups : [];
        if (
          f.group !== "all" &&
          s.group !== f.group &&
          !gs.some((g) => g.group === f.group)
        )
          continue;
        if (searchHit(s, m, f, wantGen, q)) hits.push(m);
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

  return {
    flattenMembers,
    isVisible,
    placeholderSrc,
    photoSrc,
    groupSections,
    genKey,
    generationOptions,
    rosterView,
  };
});
