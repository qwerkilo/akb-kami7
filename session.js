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

  const SERIES = ["48g", "sakamichi"];
  const SIZES = [7, 16, 32];
  const SERIES_KEY = "akb:series";
  const stateKey = (s) => `akb:state:v2:${s}`;

  function create(opts) {
    const storage = (opts && opts.storage) || {
      getItem: () => null,
      setItem: () => {},
    };
    const byId = (opts && opts.byId) || (() => undefined);

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
      if (!st) return { size: 7, selected: [], duel: null };
      const selected = st.selected.filter((id) => inSeries(id, s));
      let duel = st.duel;
      if (duel && duel.order.some((id) => !inSeries(id, s))) duel = null;
      return { size: st.size, selected, duel };
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
      return had;
    }

    // 启动：恢复上次系列与两个系列的存档
    const savedSeries = read(SERIES_KEY);
    if (SERIES.includes(savedSeries)) state.series = savedSeries;
    for (const s of SERIES) store[s] = loadSeries(s);
    state.size = store[state.series].size;
    state.selected = store[state.series].selected.slice();
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
        query: state.query,
        open: [...state.open],
        phase,
        duel: duelView,
        ranking,
      };
    }

    function switchSeries(next) {
      if (!SERIES.includes(next) || next === state.series) return false;
      remember();
      state.duel = emptyDuel();
      state.series = next;
      write(SERIES_KEY, next);
      const st = store[next];
      state.size = st.size;
      state.selected = st.selected.slice();
      state.filter = "all";
      state.group = "all";
      state.query = "";
      state.open = new Set();
      setDuel(st.duel);
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
      toggleSelect,
      setFilter,
      setGroup,
      setQuery,
      toggleOpen,
      startDuel,
      answer,
      undo,
      clearSelection,
      abandonDuel,
    };
  }

  return { create };
});
