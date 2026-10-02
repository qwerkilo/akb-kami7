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

  // 系列 id 的单一出处是 core.SERIES_KEYS（加系列 = 加一行）。原来这里另抄了一份
  // 三个 id 的数组，于是加第四个系列时会「能切但切不动」—— switchSeries 的
  // `SERIES.includes(next)` 直接 return false，点击静默无反应。
  const SERIES = Object.keys(CORE.SERIES_KEYS);
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
      // 筛选步（ADR-0019 改写版）：按轮次分组的划除，每轮是一组 id
      cut: [],
      // 用户是否已点「继续细分」进入下一轮（轮次自动推进，靠它区分「可提交」与「已在下一轮」）
      deeperRound: 0,
      skin: "classic",
      generation: "all",
      // 全局偏好：不随系列切换而变，存储不可用时回落到这些默认值。
      // lang 的默认值由调用方按浏览器语言注入（那是「首次访问选什么」的决定，不是持久化）
      lang: opts.lang || "zh",
      posterStyle: "a",
    };

    function emptyDuel() {
      return { tiers: [], answers: [] };
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

    // ---- 「按系列隔离的状态」这个形状的唯一出处 ----
    // 此前它在 save / remember / boot / 切系列恢复 四处各自列举（读盘方向 loadSeries 也
    // 交回这里），而漏接一个字段的后果是「刷新前后相反」或「切系列就丢」。
    // deeperRound 是本仓的**第三例**（前两例是 selected 与 duel）——
    // 症状：同一状态下 F5 刷新前后相反，或者切一次系列这个决定就变了。
    // 新增按系列字段只改这两个函数。
    function toRecord(src) {
      return {
        size: src.size,
        selected: src.selected.slice(),
        duel: src.duel.tiers.length
          ? {
              tiers: src.duel.tiers.map((x) => x.slice()),
              answers: src.duel.answers.slice(),
            }
          : null,
        cut: src.cut.slice(),
        deeperRound: src.deeperRound,
      };
    }

    // 记录 → state。boot 与切系列恢复共用；duel 交给 setDuel（它负责归一化空形状）。
    function fromRecord(rec) {
      // rec 为 null = 这个系列没有存档（首次访问）。默认形状在这里给，不在读盘处
      // 再列举一份 —— 那正是「同一个形状两个家」的最小复现。
      const r = rec || { size: 7, selected: [], duel: null, cut: [] };
      state.size = r.size;
      state.selected = (r.selected || []).slice();
      state.cut = (r.cut || []).slice();
      state.deeperRound = r.deeperRound || 0;
      setDuel(r.duel);
    }

    // 筛选态归零（三处清零里共有的那两行）。范围差异（要不要连带清已选/对决）、
    // 要不要 save、返回什么，都留在调用点。
    function clearScreening() {
      state.cut = [];
      state.deeperRound = 0;
    }

    function loadSeries(s) {
      const st = CORE.deserializeState(read(stateKey(s)) || "");
      if (!st) return null; // 没有存档时形状交给 fromRecord 的默认值，不在这里列举
      const selected = st.selected.filter((id) => inSeries(id, s));
      let duel = st.duel;
      if (duel && duel.tiers.flat().some((id) => !inSeries(id, s))) duel = null;
      // 不判 duel.tiers.length：deserializeState 已过滤空组并要求 flat 非空，
      // 随后 init 走 setDuel（那里也查过）—— 那道门不可达。
      // 「划除必须落在已选里」由 core.deserializeState 统一保证（单一出处）；
      // 这里只负责按系列过滤 selected/duel（core 不认识系列）
      return {
        size: st.size,
        selected,
        duel,
        cut: st.cut || [],
        deeperRound: st.deeperRound || 0,
      };
    }

    function save() {
      write(stateKey(state.series), CORE.serializeState(toRecord(state)));
    }

    function remember() {
      // 形状由 toRecord 统一给出 —— 这份内存 store 曾经漏过 deeperRound（写档的
      // write() 一直有它），于是「刷新前后相反」。两份形状不一致的典型。
      store[state.series] = toRecord(state);
    }

    function setDuel(d) {
      const tiers =
        d && Array.isArray(d.tiers)
          ? d.tiers.filter((g) => Array.isArray(g) && g.length)
          : [];
      if (
        !tiers.length ||
        tiers.flat().some((id) => !inSeries(id, state.series))
      ) {
        state.duel = emptyDuel();
        return false;
      }
      state.duel = {
        tiers: tiers.map((g) => g.slice()),
        answers: (d.answers || []).slice(),
      };
      return true;
    }

    function clearDuel() {
      const had = state.duel.tiers.length > 0;
      state.duel = emptyDuel();
      clearScreening();
      return had;
    }

    // 筛选（ADR-0019 改写版）：每轮把保留组划掉一半，保留组占据前 K 名。
    // cut 是「按轮次分组」的：rounds[r] = 第 r 轮划掉的人，层级由内到外排。
    // 筛选轮次按「实际已选人数」减半 —— 真实流程里恒等于档位（进筛选的前提就是已选满），
    // 用实际值是为了让「少于档位」也能排（测试与将来的其它入口）
    function nSel() {
      return state.selected.length;
    }

    function screening() {
      const step = CORE.screenStep(nSel(), state.cut, state.deeperRound);
      // cut 报「全部已划的 id」—— UI 要的是「这个人划了没有」；
      // 本轮进度由 need/canCut 表达，分轮结构由 rounds 保留。
      const all = state.cut.flat();
      const pool = state.selected.filter((id) => !all.includes(id));
      return {
        rounds: state.cut.map((r) => r.slice()),
        cut: all,
        pool,
        round: step.round,
        need: step.need,
        canCut: step.canCut,
        size: state.size,
        complete: step.complete,
        filled: step.filled,
        atBoundary: step.atBoundary,
        canRecurse: step.atBoundary && step.canCut > 0,
        // screenTiers 会把 state.cut 的每轮数组直接放进层级里，这里必须拷一层 ——
        // 否则改一次快照就改了会话内部状态（startDuel 还会把别名存进 state.duel.tiers）
        tiers: CORE.screenTiers(state.selected, state.cut).map((t) =>
          t.slice()
        ),
      };
    }

    // 划掉 = 划进当前轮；再点一次 = 从当前轮恢复。超额被定值门槛挡住。
    function toggleCut(id) {
      if (!inSeries(id, state.series)) return false;
      if (!state.selected.includes(id)) return false;
      const step = CORE.screenStep(nSel(), state.cut, state.deeperRound);
      if (step.canCut === 0) return false; // 本轮名额用完（或保留组到下限）→ 划不动
      // 注意：deeperRound 只由 enterNextRound（点「继续细分」）设置 ——
      // 划除本身不设，否则「刚划完一轮」这个边界信号会在第一次划除时就没了。
      const roundIdx = step.round;
      const cur = state.cut[roundIdx] || [];
      const pool = state.selected.filter((x) => !state.cut.flat().includes(x));
      if (cur.includes(id)) {
        state.cut[roundIdx] = cur.filter((x) => x !== id);
        save();
        return false; // 这次是「恢复」
      }
      if (!pool.includes(id)) return false;
      if (cur.length >= step.need) return false; // 定值门槛：不能超额
      state.cut[roundIdx] = cur.concat([id]);
      save();
      return true;
    }

    // 「继续细分」：显式进入下一轮。不设它的话轮次自动推进会丢掉
    // 「本轮刚划完、可以提交」这个信号（core.screenStep 的 deeperRound 参数）。
    //
    // 记的是**轮次号**而不是布尔：全局闩锁会让第二轮之后的边界永久消失
    // （提交禁用 + 「继续细分」按钮不出现 = 静默逼着划到底）。
    function enterNextRound() {
      const sc = screening();
      if (!sc.canRecurse) return false;
      state.deeperRound = sc.round;
      save();
      return true;
    }

    function resetScreening() {
      if (!state.cut.length && !state.deeperRound) return false;
      clearScreening();
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
    fromRecord(store[state.series]);

    function snapshot() {
      const duel = state.duel;
      let phase = "pick";
      let duelView = null;
      let ranking = null;
      if (duel.tiers.length) {
        const r = CORE.replayTiers(duel.tiers, duel.answers);
        if (r.done) {
          phase = "result";
          ranking = r.order.slice();
        } else {
          phase = "duel";
          const p = CORE.tierProgress(duel.tiers, duel.answers.length);
          duelView = {
            step: duel.answers.length + 1,
            max: p.max,
            percent: p.percent,
            remaining: p.remaining,
            etaSeconds: p.etaSeconds,
            pair: r.pair.slice(),
            canUndo: duel.answers.length > 0,
            tier: p.tier,
            tiers: p.tiers,
            tierAnswered: p.tierAnswered,
            tierMax: p.tierMax,
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
        phase: state.cut.length && !duel.tiers.length ? "screening" : phase,
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
      state.filter = "all";
      state.group = "all";
      state.generation = "all";
      state.query = "";
      state.open = new Set();
      fromRecord(st);
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

    // 对决按层级喂：保留组 + 各轮划掉组（由内到外）。跨层级不比较（ADR-0019）。
    //
    // opts.shuffle：出图页的「这几位重新排序」用它重排**每一层内部**的顺序。
    // 层级归属是语义（谁比谁靠前），层内顺序是自由量 —— 洗它不违反「跨层级不比较」。
    // 不传就保持已选顺序：首场对决跟着挑人顺序走，不随机器变。
    function startDuel(opts) {
      if (!state.selected.length) return false;
      if (!screening().complete) return false; // 定值门槛：没划够不给开始排序
      // 不再查 inSeries：selected 只能经 toggleSelect（自带检查）与 loadSeries
      // （按系列过滤）进入，结构上不会跨系列；那个门不可达且无测试覆盖。
      // screening() 给的是拷贝，再拷一层是因为这份要活过整个对决。
      const mix = (opts && opts.shuffle) || null;
      const tiers = screening().tiers.map((t) =>
        mix ? mix(t.slice()) : t.slice()
      );
      state.duel = { tiers, answers: [] };
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
      const had = state.selected.length > 0 || state.duel.tiers.length > 0;
      if (!had) return false;
      state.selected = [];
      state.duel = emptyDuel();
      clearScreening();
      save();
      return true;
    }

    function abandonDuel() {
      if (!state.duel.tiers.length) return false;
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
      enterNextRound,
      answer,
      undo,
      clearSelection,
      abandonDuel,
    };
  }

  return { create };
});
