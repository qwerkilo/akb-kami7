// 会话状态模块（DOM 无关；storage 适配器与成员查询注入；相位/名次/进度由 core 纯函数派生）
(function (root, factory) {
  const core =
    typeof module === "object" && module.exports
      ? require("./core.js")
      : root.AKB_CORE;
  const api = factory(core);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AKB_SESSION = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (CORE) {
  "use strict";

  const SERIES = ["48g", "sakamichi", "love"];
  const SIZES = [7, 16, 40];
  const SKINS = ["classic", "sticker"];
  const LANGS = ["zh", "en", "ja"];
  // 键名住在 core.PREF_KEYS（跨模块契约的单一出处）
  const stateKey = CORE.PREF_KEYS.state;

  function create(opts) {
    // storage 是注入依赖（ADR-0008）：调用方必须给，不再兜一个内存假实现
    const storage = opts.storage;
    const byId = opts.byId || (() => undefined);

    const store = {};
    const state = {
      series: "48g",
      size: 7,
      selected: [],
      filter: "all",
      group: "all",
      query: "",
      open: new Set(),
      duel: emptyDuel(),
      // 筛选步（ADR-0019）：被划掉的已选成员 id；空 = 一个都没划
      cut: [],
      skin: "classic",
      generation: "all",
      // 全局偏好：不随系列切换而变，存储不可用时回落到这些默认值。
      // lang 的默认值由调用方按浏览器语言注入（那是「首次访问选什么」的决定，不是持久化）
      lang: opts.lang || "zh",
      posterStyle: "a",
    };

    function emptyDuel() {
      return { order: [], answers: [] };
    }

    function read(k) {
      try {
        return storage.getItem(k);
      } catch (_) {
        return null;
      }
    }

    function write(k, v) {
      try {
        storage.setItem(k, v);
      } catch (_) {}
    }

    function inSeries(id, series) {
      const m = byId(id);
      return !!m && m.series === series;
    }

    function loadSeries(s) {
      const st = CORE.deserializeState(read(stateKey(s)) || "");
      if (!st) return { size: 7, selected: [], duel: null, cut: [] };
      const selected = st.selected.filter((id) => inSeries(id, s));
      let duel = st.duel;
      if (duel && duel.order.some((id) => !inSeries(id, s))) duel = null;
      // 「划除必须落在已选里」由 core.deserializeState 统一保证（单一出处）；
      // 这里只负责按系列过滤 selected/duel（core 不认识系列）
      return { size: st.size, selected, duel, cut: st.cut || [] };
    }

    function save() {
      write(
        stateKey(state.series),
        CORE.serializeState({
          size: state.size,
          selected: state.selected,
          duel: state.duel.order.length
            ? { order: state.duel.order, answers: state.duel.answers }
            : null,
          cut: state.cut,
        })
      );
    }

    function remember() {
      store[state.series] = {
        size: state.size,
        selected: state.selected.slice(),
        duel: state.duel.order.length
          ? {
              order: state.duel.order.slice(),
              answers: state.duel.answers.slice(),
            }
          : null,
        cut: state.cut.slice(),
      };
    }

    function setDuel(d) {
      if (
        !d ||
        !Array.isArray(d.order) ||
        !d.order.length ||
        d.order.some((id) => !inSeries(id, state.series))
      ) {
        state.duel = emptyDuel();
        return false;
      }
      state.duel = {
        order: d.order.slice(),
        answers: (d.answers || []).slice(),
      };
      return true;
    }

    function clearDuel() {
      const had = state.duel.order.length > 0;
      state.duel = emptyDuel();
      state.cut = [];
      return had;
    }

    // 筛选：划掉 / 恢复一个已选成员。kept = 已选 - 被划；够档位才能提交（ADR-0019）
    function screening() {
      const order = state.selected.filter((id) => !state.cut.includes(id));
      return {
        cut: state.cut.slice(),
        order,
        kept: order.length,
        size: state.size,
        canSubmit: order.length >= state.size,
      };
    }

    function toggleCut(id) {
      if (!inSeries(id, state.series)) return false;
      if (state.cut.includes(id)) {
        state.cut = state.cut.filter((x) => x !== id);
        save();
        return false; // 这次是「恢复」
      }
      if (!state.selected.includes(id)) return false;
      state.cut = state.cut.concat([id]);
      save();
      return true;
    }

    function resetScreening() {
      if (!state.cut.length) return false;
      state.cut = [];
      save();
      return true;
    }

    // 启动：恢复上次系列与两个系列的存档
    const savedSeries = read(CORE.PREF_KEYS.series);
    if (SERIES.includes(savedSeries)) state.series = savedSeries;
    const savedSkin = read(CORE.PREF_KEYS.skin);
    if (SKINS.includes(savedSkin)) state.skin = savedSkin;
    const savedLang = read(CORE.PREF_KEYS.lang);
    if (LANGS.includes(savedLang)) state.lang = savedLang;
    const savedStyle = read(CORE.PREF_KEYS.posterStyle);
    if (opts.posterStyles && opts.posterStyles.includes(savedStyle)) {
      state.posterStyle = savedStyle;
    }
    for (const s of SERIES) store[s] = loadSeries(s);
    state.size = store[state.series].size;
    state.selected = store[state.series].selected.slice();
    state.cut = (store[state.series].cut || []).slice();
    setDuel(store[state.series].duel);

    function snapshot() {
      const duel = state.duel;
      let phase = "pick";
      let duelView = null;
      let ranking = null;
      if (duel.order.length) {
        const r = CORE.replay(duel.order, duel.answers);
        if (r.done) {
          phase = "result";
          ranking = r.order.slice();
        } else {
          phase = "duel";
          const p = CORE.duelProgress(duel.order.length, duel.answers.length);
          duelView = {
            step: duel.answers.length + 1,
            max: p.max,
            percent: p.percent,
            remaining: p.remaining,
            etaSeconds: p.etaSeconds,
            pair: r.pair.slice(),
            canUndo: duel.answers.length > 0,
          };
        }
      }
      return {
        series: state.series,
        size: state.size,
        selected: state.selected.slice(),
        filter: state.filter,
        group: state.group,
        generation: state.generation,
        query: state.query,
        open: [...state.open],
        phase: state.cut.length && !duel.order.length ? "screening" : phase,
        screening: screening(),
        duel: duelView,
        ranking,
        skin: state.skin,
        lang: state.lang,
        posterStyle: state.posterStyle,
      };
    }

    // 海报样式：合法值表由调用方注入（session 不该知道海报模块有哪些样式）
    function setPosterStyle(next) {
      if (!opts.posterStyles || !opts.posterStyles.includes(next)) return false;
      if (next === state.posterStyle) return false;
      state.posterStyle = next;
      write(CORE.PREF_KEYS.posterStyle, next);
      return true;
    }

    function setLang(next) {
      if (!LANGS.includes(next) || next === state.lang) return false;
      state.lang = next;
      write(CORE.PREF_KEYS.lang, next);
      return true;
    }

    function setSkin(next) {
      if (!SKINS.includes(next) || next === state.skin) return false;
      state.skin = next;
      write(CORE.PREF_KEYS.skin, next);
      return true;
    }

    function switchSeries(next) {
      if (!SERIES.includes(next) || next === state.series) return false;
      remember();
      state.duel = emptyDuel();
      state.series = next;
      write(CORE.PREF_KEYS.series, next);
      const st = store[next];
      state.size = st.size;
      state.selected = st.selected.slice();
      state.filter = "all";
      state.group = "all";
      state.generation = "all";
      state.query = "";
      state.open = new Set();
      state.cut = (st.cut || []).slice();
      setDuel(st.duel);
      return true;
    }

    function setGeneration(v) {
      const next = typeof v === "string" && v ? v : "all";
      if (next === state.generation) return false;
      state.generation = next;
      return true;
    }

    function setSize(n) {
      if (!SIZES.includes(n) || n === state.size) return false;
      state.size = n;
      if (state.selected.length > n) state.selected.length = n;
      clearDuel();
      save();
      return true;
    }

    function toggleSelect(id) {
      if (!inSeries(id, state.series)) return false;
      const i = state.selected.indexOf(id);
      if (i >= 0) {
        state.selected.splice(i, 1);
      } else if (state.selected.length >= state.size) {
        return false;
      } else {
        state.selected.push(id);
      }
      clearDuel();
      save();
      return true;
    }

    function setFilter(f) {
      state.filter = f === "current" || f === "former" ? f : "all";
      return state.filter;
    }

    function setGroup(g) {
      state.group = String(g || "all");
      return state.group;
    }

    function setQuery(q) {
      state.query = String(q == null ? "" : q);
      return state.query;
    }

    function toggleOpen(key) {
      if (state.open.has(key)) state.open.delete(key);
      else state.open.add(key);
      return state.open.has(key);
    }

    function startDuel(order) {
      if (!Array.isArray(order) || !order.length) return false;
      if (order.some((id) => !inSeries(id, state.series))) return false;
      state.duel = { order: order.slice(), answers: [] };
      save();
      return true;
    }

    function answer(leftWins) {
      if (snapshot().phase !== "duel") return false;
      state.duel.answers.push(!!leftWins);
      save();
      return true;
    }

    function undo() {
      if (snapshot().phase !== "duel" || !state.duel.answers.length)
        return false;
      state.duel.answers.pop();
      save();
      return true;
    }

    function clearSelection() {
      const had = state.selected.length > 0 || state.duel.order.length > 0;
      if (!had) return false;
      state.selected = [];
      state.duel = emptyDuel();
      save();
      return true;
    }

    function abandonDuel() {
      if (!state.duel.order.length) return false;
      state.duel = emptyDuel();
      save();
      return true;
    }

    return {
      snapshot,
      switchSeries,
      setSize,
      setGeneration,
      toggleSelect,
      setFilter,
      setGroup,
      setQuery,
      toggleOpen,
      setSkin,
      setPosterStyle,
      setLang,
      startDuel,
      toggleCut,
      resetScreening,
      answer,
      undo,
      clearSelection,
      abandonDuel,
    };
  }

  return { create };
});
