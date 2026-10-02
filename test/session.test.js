const { test } = require("node:test");
const assert = require("node:assert/strict");
const session = require("../session.js");
const core = require("../core.js");

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    _map: map,
  };
}

// 夹具要能表达真实档位（7/16/40），否则 16 档以上的用例测不到「一轮划不完」
// （原来只有 a1–a10，a11 之后 toggleCut 一律被 inSeries 拒掉，测试会假红）
const MEMBERS = [];
for (let i = 1; i <= 40; i++) MEMBERS.push({ id: `a${i}`, series: "48g" });
for (let i = 1; i <= 40; i++)
  MEMBERS.push({ id: `s${i}`, series: "sakamichi" });
for (let i = 1; i <= 40; i++) MEMBERS.push({ id: `l${i}`, series: "love" });
const BY_ID = new Map(MEMBERS.map((m) => [m.id, m]));
const byId = (id) => BY_ID.get(id);

const POSTER_STYLES = ["a", "b", "c", "d"];

function make(storage = memoryStorage(), byIdFn = byId) {
  return session.create({ storage, byId: byIdFn, posterStyles: POSTER_STYLES });
}

// startDuel 不再收 order（ADR-0019 改写版）：对手来自「已选 + 筛选层级」。
// 这层适配让既有测试继续用它想表达的语义：拿这几个人开一场对决。
function startOn(S, ids) {
  const had = new Set(S.snapshot().selected);
  ids.forEach((id) => {
    if (!had.has(id)) S.toggleSelect(id); // 已选的别再 toggle（会取消选中）
  });
  // 定值门槛：划掉保留组的一半才允许开始排序（ADR-0019 改写版）
  const sc = () => S.snapshot().screening;
  let guard = 0;
  while (sc().canCut > 0 && guard++ < 80) {
    const next = sc().pool.find((id) => !sc().cut.includes(id));
    if (!next) break;
    S.toggleCut(next);
  }
  return S.startDuel();
}

test("初始会话：48g / 7 档 / 空已选 / pick 相位", () => {
  const s = make().snapshot();
  assert.deepEqual(s, {
    series: "48g",
    size: 7,
    selected: [],
    filter: "all",
    group: "all",
    generation: "all",
    query: "",
    open: [],
    phase: "pick",
    duel: null,
    ranking: null,
    skin: "classic",
    lang: "zh",
    posterStyle: "a",
    screening: {
      rounds: [],
      cut: [],
      pool: [],
      round: 0,
      need: 0,
      canCut: 0,
      size: 7,
      // 已选为空 → 池子到下限，门是开的（但 startDuel 另有一道「得有人」的门）
      complete: true,
      filled: true,
      atBoundary: true,
      canRecurse: false,
      tiers: [[]],
    },
  });
});

test("皮肤：默认 classic、切换持久化、同值与非法值拒绝", () => {
  const storage = memoryStorage();
  let S = make(storage);
  assert.equal(S.snapshot().skin, "classic");
  assert.equal(S.setSkin("sticker"), true);
  assert.equal(S.snapshot().skin, "sticker");
  assert.equal(S.setSkin("sticker"), false);
  assert.equal(S.setSkin("neon"), false);
  assert.equal(S.snapshot().skin, "sticker");
  S = make(storage);
  assert.equal(S.snapshot().skin, "sticker");
});

test("皮肤：存储损坏时回退 classic", () => {
  const storage = memoryStorage();
  storage.setItem("akb:skin", "bogus");
  assert.equal(make(storage).snapshot().skin, "classic");
});

test("选人：满员拒绝、可取消、跨系列与未知 id 拒绝", () => {
  const S = make();
  for (const m of MEMBERS.slice(0, 7)) assert.equal(S.toggleSelect(m.id), true);
  assert.equal(S.toggleSelect("a8"), false);
  assert.equal(S.snapshot().selected.length, 7);
  assert.equal(S.toggleSelect("s1"), false);
  assert.equal(S.toggleSelect("nope"), false);
  assert.equal(S.toggleSelect("a1"), true);
  assert.equal(S.snapshot().selected.includes("a1"), false);
});

test("档位：切换与缩小时截断已选", () => {
  const S = make();
  S.setSize(16);
  for (const m of MEMBERS.slice(0, 10)) S.toggleSelect(m.id);
  assert.equal(S.setSize(7), true);
  assert.equal(S.snapshot().size, 7);
  assert.equal(S.snapshot().selected.length, 7);
  assert.equal(S.setSize(40), true);
  assert.equal(S.setSize(9), false);
});

test("筛选与展开：易失状态由模块持有", () => {
  const S = make();
  S.setFilter("current");
  S.setGroup("AKB48");
  S.setQuery("まゆ");
  assert.equal(S.toggleOpen("g:AKB48"), true);
  const s = S.snapshot();
  assert.equal(s.filter, "current");
  assert.equal(s.group, "AKB48");
  assert.equal(s.query, "まゆ");
  assert.deepEqual(s.open, ["g:AKB48"]);
  assert.equal(S.toggleOpen("g:AKB48"), false);
});

test("对决：推进、进度派生、撤回与完成直达结果", () => {
  const S = make();
  S.toggleSelect("a1");
  S.toggleSelect("a2");
  startOn(S, ["a1", "a2"]);
  let s = S.snapshot();
  assert.equal(s.phase, "duel");
  assert.deepEqual(s.duel, {
    step: 1,
    max: 1,
    percent: 0,
    remaining: 1,
    etaSeconds: 5,
    pair: ["a1", "a2"],
    canUndo: false,
    tier: 0,
    tiers: 1,
    tierAnswered: 0,
    tierMax: 1,
  });
  assert.equal(S.undo(), false);
  assert.equal(S.answer(true), true);
  s = S.snapshot();
  assert.equal(s.phase, "result");
  assert.deepEqual(s.ranking, ["a1", "a2"]);
  assert.equal(s.duel, null);
});

test("切系列：各自保留已选与对决进度，互不串写", () => {
  const S = make();
  S.toggleSelect("a1");
  S.toggleSelect("a2");
  S.toggleSelect("a3");
  startOn(S, ["a1", "a2", "a3"]);
  S.answer(false);
  assert.equal(S.switchSeries("sakamichi"), true);
  let s = S.snapshot();
  assert.equal(s.series, "sakamichi");
  assert.equal(s.selected.length, 0);
  assert.equal(s.phase, "pick");
  S.toggleSelect("s1");
  S.toggleSelect("s2");
  S.toggleSelect("s3");
  assert.equal(S.switchSeries("48g"), true);
  s = S.snapshot();
  assert.equal(s.series, "48g");
  assert.deepEqual(s.selected, ["a1", "a2", "a3"]);
  assert.equal(s.phase, "duel");
  assert.equal(s.duel.step, 2);
  assert.equal(s.duel.canUndo, true);
  assert.equal(S.switchSeries("nope"), false);
});

test("改选或改档位作废进行中的对决", () => {
  const S = make();
  S.toggleSelect("a1");
  S.toggleSelect("a2");
  startOn(S, ["a1", "a2"]);
  S.answer(true);
  assert.equal(S.toggleSelect("a3"), true);
  assert.equal(S.snapshot().phase, "pick");
  startOn(S, ["a1", "a2", "a3"]);
  S.setSize(16);
  assert.equal(S.snapshot().phase, "pick");
});

test("非对决相位 answer/undo/abandon 为 no-op", () => {
  const S = make();
  assert.equal(S.answer(true), false);
  assert.equal(S.undo(), false);
  assert.equal(S.abandonDuel(), false);
  assert.equal(startOn(S, []), false, "没选人就没有对决");
  assert.equal(startOn(S, ["nope"]), false, "未知 id 进不了已选");
  // 新契约下 order 不再由调用方传入 → 跨系列/未知 id 结构上进不来（selected 已按系列过滤）
  assert.equal(startOn(S, ["a1", "s1", "nope"]), true);
  assert.deepEqual(S.snapshot().selected, ["a1"]);
});

test("重新选人：放弃对决但保留已选", () => {
  const S = make();
  S.toggleSelect("a1");
  S.toggleSelect("a2");
  startOn(S, ["a1", "a2"]);
  assert.equal(S.abandonDuel(), true);
  const s = S.snapshot();
  assert.equal(s.phase, "pick");
  assert.deepEqual(s.selected, ["a1", "a2"]);
});

test("重建实例（刷新）：恢复系列、已选与进行中/已完成的对决", () => {
  const storage = memoryStorage();
  let S = make(storage);
  S.toggleSelect("a1");
  S.toggleSelect("a2");
  S.toggleSelect("a3");
  startOn(S, ["a1", "a2", "a3"]);
  S.answer(true);
  S = make(storage); // 进行中 → 回到原题号
  let s = S.snapshot();
  assert.equal(s.phase, "duel");
  assert.equal(s.duel.step, 2);
  assert.equal(s.duel.canUndo, true);
  assert.deepEqual(s.duel.pair, ["a1", "a2"]);
  assert.equal(S.undo(), true);
  s = S.snapshot();
  assert.equal(s.duel.step, 1);
  assert.equal(s.duel.canUndo, false);
  assert.deepEqual(s.duel.pair, ["a2", "a3"]);
  let guard = 0;
  while (S.snapshot().phase === "duel" && guard++ < 10) S.answer(true);
  S = make(storage); // 已完成 → 直达结果
  assert.equal(S.snapshot().phase, "result");
  assert.deepEqual([...S.snapshot().ranking].sort(), ["a1", "a2", "a3"]);
  assert.equal(S.switchSeries("sakamichi"), true);
  S.toggleSelect("s1");
  S = make(storage); // 系列持久化
  assert.equal(S.snapshot().series, "sakamichi");
  assert.deepEqual(S.snapshot().selected, ["s1"]);
});

test("损坏与越权数据安全丢弃", () => {
  const cases = [
    ["not json", null],
    [JSON.stringify({ v: 0, size: 7 }), null],
    [JSON.stringify({ v: 1, size: 9 }), null],
  ];
  for (const [raw] of cases) {
    const storage = memoryStorage();
    storage.setItem("akb:state:v2:48g", raw);
    const s = make(storage).snapshot();
    assert.deepEqual(s.selected, []);
    assert.equal(s.phase, "pick");
  }
  const storage = memoryStorage();
  storage.setItem(
    "akb:state:v2:48g",
    JSON.stringify({
      v: 1,
      size: 7,
      selected: ["a1", "s1", "a2", 5],
      duel: { order: ["s1", "a1"], answers: [true] },
    })
  );
  const s = make(storage).snapshot();
  assert.deepEqual(s.selected, ["a1", "a2"]);
  assert.equal(s.phase, "pick");
  assert.equal(s.duel, null);
});

test("storage 异常时不崩溃", () => {
  const boom = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
  };
  const S = make(boom);
  assert.equal(S.toggleSelect("a1"), true);
  assert.equal(S.snapshot().selected.includes("a1"), true);
  assert.equal(S.switchSeries("sakamichi"), true);
});

test("答案序列一致：同序列还原同一次序", () => {
  const run = (pickAnswer) => {
    const S = make();
    ["a1", "a2", "a3", "a4", "a5"].forEach((id) => S.toggleSelect(id));
    startOn(S, ["a1", "a2", "a3", "a4", "a5"]);
    let guard = 0;
    while (S.snapshot().phase === "duel" && guard++ < 20) {
      S.answer(pickAnswer(S.snapshot()));
    }
    return S.snapshot().ranking;
  };
  const alwaysLeft = () => true;
  const leftUnlessA3 = (s) => s.duel.pair[0] !== "a3";
  const a = run(alwaysLeft);
  assert.deepEqual(a, run(alwaysLeft));
  const b = run(leftUnlessA3);
  assert.deepEqual([...b].sort(), ["a1", "a2", "a3", "a4", "a5"]);
  assert.notDeepEqual(a, b);
});

test("清空已选：清除当前系列全部已选并作废进行中的对决", () => {
  const S = make();
  S.toggleSelect("a1");
  S.toggleSelect("a2");
  S.toggleSelect("a3");
  startOn(S, ["a1", "a2", "a3"]);
  S.answer(true);
  assert.equal(S.clearSelection(), true);
  let s = S.snapshot();
  assert.deepEqual(s.selected, []);
  assert.equal(s.phase, "pick");
  assert.equal(s.duel, null);
  assert.equal(S.clearSelection(), false);
});

test("清空只影响当前系列", () => {
  const storage = memoryStorage();
  const S = make(storage);
  S.toggleSelect("a1");
  S.switchSeries("sakamichi");
  S.toggleSelect("s1");
  assert.equal(S.clearSelection(), true);
  assert.deepEqual(S.snapshot().selected, []);
  S.switchSeries("48g");
  assert.deepEqual(S.snapshot().selected, ["a1"]);
  const again = make(storage);
  assert.equal(again.snapshot().series, "48g");
  assert.deepEqual(again.snapshot().selected, ["a1"]);
});

test("系列白名单支持等爱（love），状态独立持久化", () => {
  const storage = memoryStorage();
  let S = make(storage);
  assert.equal(S.switchSeries("love"), true);
  S.toggleSelect("l1");
  assert.equal(S.snapshot().series, "love");
  assert.deepEqual(S.snapshot().selected, ["l1"]);
  S = make(storage);
  assert.equal(S.snapshot().series, "love");
  assert.deepEqual(S.snapshot().selected, ["l1"]);
});

test("未知 id 在未满员时也拒绝（不被满员掩蔽）", () => {
  const S = make();
  assert.equal(S.toggleSelect("nope"), false);
  assert.deepEqual(S.snapshot().selected, []);
});

test("startDuel 拷贝传入顺序（外部数组变更不影响对决）", () => {
  const S = make();
  ["a1", "a2", "a3"].forEach((id) => S.toggleSelect(id));
  const order = ["a1", "a2", "a3"];
  assert.equal(S.startDuel(order), true);
  order.reverse();
  assert.deepEqual(S.snapshot().duel.pair, ["a2", "a3"]);
});

test("answer/undo 返回值语义：应用为 true，非对决相位为 false", () => {
  const S = make();
  assert.equal(S.answer(true), false);
  ["a1", "a2", "a3"].forEach((id) => S.toggleSelect(id));
  startOn(S, ["a1", "a2", "a3"]);
  assert.equal(S.undo(), false);
  assert.equal(S.answer(true), true);
  assert.equal(S.undo(), true);
});

test("clearSelection：已选为空但对决进行中时也清空并返回 true", () => {
  const S = make();
  ["a1", "a2", "a3"].forEach((id) => S.toggleSelect(id));
  startOn(S, ["a1", "a2", "a3"]);
  S.clearSelection();
  ["a1", "a2", "a3"].forEach((id) => S.toggleSelect(id));
  const S2 = make();
  startOn(S2, ["a1", "a2", "a3"]);
  assert.equal(S2.clearSelection(), true);
  assert.equal(S2.snapshot().duel, null);
});

test("恢复：答案数多于排序实际消耗时不崩，快照仍给完整名次", () => {
  const storage = memoryStorage();
  const ids = ["a1", "a2", "a3", "a4", "a5"];
  storage.setItem(
    "akb:state:v2:48g",
    JSON.stringify({
      v: 1,
      size: 7,
      selected: ids,
      duel: { order: ids, answers: Array(8).fill(true) }, // 8 = worstCase(5)：多于实际消耗
      //（全左胜只消耗 5 次）
    })
  );
  const s = make(storage).snapshot();
  assert.equal(s.phase, "result");
  assert.deepEqual(s.ranking, ids);
});

test("会话：旧 32 档存档迁移为 40 档并保留已选", () => {
  const storage = memoryStorage();
  storage.setItem(
    "akb:state:v2:48g",
    JSON.stringify({ v: 1, size: 32, selected: ["a1", "a2"], duel: null })
  );
  const s = make(storage).snapshot();
  assert.equal(s.size, 40);
  assert.deepEqual(s.selected, ["a1", "a2"]);
});

test("会话：期生筛选可设、切换系列复位（易失）", () => {
  const S = make();
  assert.equal(S.setGeneration("1期生"), true);
  assert.equal(S.snapshot().generation, "1期生");
  assert.equal(S.setGeneration("1期生"), false);
  S.switchSeries("sakamichi");
  assert.equal(S.snapshot().generation, "all");
  // 易失：重建实例（模拟刷新）后仍为 all
  S.setGeneration("1期生");
  const again = session.create({ storage: S.storage || memoryStorage(), byId });
  assert.equal(again.snapshot().generation, "all");
});

// ── 第九轮质检补的断言：变异测试指认的 session.js 缺口 ──

test("缩档截断保留的是前 N 个 id，不会留下空洞（海报会印出空名）", () => {
  const s = make();
  s.setSize(16); // toggleSelect 不允许超过当前档位，先升档才选得到 10 人
  for (let i = 1; i <= 10; i++) s.toggleSelect(`a${i}`);
  assert.equal(s.snapshot().selected.length, 10);
  s.setSize(7);
  const sel = s.snapshot().selected;
  assert.equal(sel.length, 7);
  assert.deepEqual(
    sel,
    ["a1", "a2", "a3", "a4", "a5", "a6", "a7"],
    "必须等于保留的那 7 个 id"
  );
  for (const id of sel)
    assert.equal(typeof id, "string", "id 不得是 undefined");
});

test("快照与返回值必须是拷贝：改返回值不动内部状态", () => {
  const s = make();
  for (let i = 1; i <= 4; i++) s.toggleSelect(`a${i}`);
  const snap = s.snapshot();
  snap.selected.push("注入");
  snap.selected.reverse();
  assert.deepEqual(
    s.snapshot().selected,
    ["a1", "a2", "a3", "a4"],
    "改快照不得污染内部已选"
  );
  startOn(s, ["a1", "a2"]);
  const snap2 = s.snapshot();
  // 快照里的 duel 是派生视图（pair 是当前那一对），改它不得污染后续快照
  snap2.duel.pair.reverse();
  snap2.duel.pair[0] = "注入";
  const live = s.snapshot().duel;
  assert.notEqual(live.pair[0], "注入", "改快照里的 duel.pair 不得污染内部");
  assert.equal(live.step, 1, "改快照不得推进对决进度");
});

test("setter 的入参归一化：非法值一律回落到 all / 空串", () => {
  const s = make();
  s.setFilter("current");
  s.setGeneration("1期生");
  s.setGroup("AKB48");
  s.setQuery("ま");
  // setFilter/setGroup/setQuery 返回**归一化后的值**，setGeneration 返回布尔——
  // 两个契约都钉住（调用方按返回值刷新 UI，语义不同就是 bug）
  const bad = make();
  assert.equal(bad.setFilter("垃圾"), "all", "非法筛选值应归一化为 all");
  assert.equal(bad.setFilter("current"), "current");
  assert.equal(bad.setFilter(undefined), "all", "undefined 应归一化为 all");
  bad.setGeneration("1期生");
  assert.equal(bad.setGeneration(""), true, "空串应归一化为 all 并生效");
  assert.equal(bad.snapshot().generation, "all");
  bad.setGeneration("1期生");
  assert.equal(bad.setGeneration("1期生"), false, "同值应是 no-op");
  bad.setGeneration("1期生");
  bad.setGeneration(null);
  assert.equal(bad.snapshot().generation, "all", "null 应归一化为 all");
  assert.equal(
    bad.setQuery(null),
    "",
    "null 查询应变成空串，不是字符串 undefined"
  );
  assert.equal(bad.setQuery(0), "0", "数字查询应转成字符串");
  assert.equal(bad.setGroup("AKB48"), "AKB48");
  assert.equal(bad.setGroup(0), "all", "0 应归一化为 all");
  assert.equal(bad.setGroup(""), "all");
  assert.ok(s.snapshot().filter === "current", "合法值不应被归一化掉");
});

test("切系列复位全部易失筛选（filter/group/generation/query 四个字段）", () => {
  const s = make();
  s.setFilter("former");
  s.setGroup("SKE48");
  s.setGeneration("1期生");
  s.setQuery("ま");
  s.switchSeries("sakamichi");
  const snap = s.snapshot();
  assert.equal(snap.filter, "all");
  assert.equal(snap.group, "all");
  assert.equal(snap.generation, "all");
  assert.equal(snap.query, "");
});

test("切当前系列 / 设当前档位是 no-op：不动状态、不返回 true", () => {
  const s = make();
  for (let i = 1; i <= 3; i++) s.toggleSelect(`a${i}`);
  startOn(s, ["a1", "a2", "a3"]);
  const before = s.snapshot();
  assert.equal(s.switchSeries("48g"), false, "切到当前系列应返回 false");
  const after = s.snapshot();
  assert.deepEqual(after.selected, before.selected, "no-op 不得清空已选");
  assert.ok(after.duel, "no-op 不得丢弃进行中的对决");
  assert.equal(s.setSize(7), false, "设成当前档位应返回 false");
  assert.deepEqual(s.snapshot().selected, before.selected);
  assert.ok(s.snapshot().duel, "no-op 不得丢弃进行中的对决");
});

test("持久化的键名被钉住（改名会让老用户丢数据）", () => {
  const storage = memoryStorage();
  const s = make(storage);
  s.setSize(16);
  s.setSkin("sticker");
  s.switchSeries("sakamichi");
  const keys = [...storage._map.keys()];
  assert.ok(keys.includes("akb:series"), `应有 akb:series，实际 ${keys}`);
  assert.ok(keys.includes("akb:skin"), `应有 akb:skin，实际 ${keys}`);
  assert.ok(
    keys.some((k) => k.startsWith("akb:state:v2:")),
    `应有 akb:state:v2:<series>，实际 ${keys}`
  );
});

test("新建会话：已选、答案、排序都是空（不是 undefined）", () => {
  const s = make();
  const snap = s.snapshot();
  assert.deepEqual(snap.selected, []);
  assert.equal(snap.duel, null);
  assert.equal(snap.ranking, null);
  assert.deepEqual(snap.open, []);
  // 快照里的 duel 是派生视图（不含内部 answers 字段），这里只钉「开局」这一面
  startOn(s, ["a1", "a2", "a3"]);
  const duel = s.snapshot().duel;
  assert.equal(duel.step, 1, "新对决从第 1 步开始");
  // max 是**题数**不是人数：3 人两两比较共 3 题
  assert.equal(duel.max, 3, "3 人的精确全序共 3 题");
  assert.equal(duel.remaining, 3, "开局时剩余题数等于总题数");
  assert.equal(duel.percent, 0);
  assert.equal(duel.canUndo, false, "还没作答就不可撤回");
});

// ── 全局偏好收进会话（深化㉓）：海报样式与语言此前各自在 app.js 里裸读裸写 ──
test("海报样式：set → snapshot 往返并落盘", () => {
  const storage = memoryStorage();
  const s = make(storage);
  assert.equal(s.snapshot().posterStyle, "a", "默认是金字塔样式");
  assert.equal(s.setPosterStyle("c"), true);
  assert.equal(s.snapshot().posterStyle, "c");
  assert.equal(storage.getItem("akb:poster-style"), "c");
});

test("海报样式：非法值与重复值都返回 false 且不写盘", () => {
  const storage = memoryStorage();
  const s = make(storage);
  assert.equal(s.setPosterStyle("zzz"), false);
  assert.equal(s.snapshot().posterStyle, "a");
  s.setPosterStyle("b");
  const before = storage.getItem("akb:poster-style");
  assert.equal(s.setPosterStyle("b"), false, "同值不重写");
  assert.equal(storage.getItem("akb:poster-style"), before);
});

test("语言：set → snapshot 往返并落盘，非法值被拒", () => {
  const storage = memoryStorage();
  const s = make(storage);
  assert.equal(s.setLang("ja"), true);
  assert.equal(s.snapshot().lang, "ja");
  assert.equal(storage.getItem("akb-lang"), "ja");
  assert.equal(s.setLang("fr"), false, "只认 zh/en/ja");
  assert.equal(s.snapshot().lang, "ja");
});

test("新建会话时从落盘值恢复海报样式与语言（非法值回落默认）", () => {
  const storage = memoryStorage();
  storage.setItem("akb:poster-style", "d");
  storage.setItem("akb-lang", "en");
  assert.equal(make(storage).snapshot().posterStyle, "d");
  assert.equal(make(storage).snapshot().lang, "en");
  storage.setItem("akb:poster-style", "nope");
  storage.setItem("akb-lang", "de");
  const s = make(storage).snapshot();
  assert.equal(s.posterStyle, "a");
  assert.equal(s.lang, "zh");
});

test("存储不可用时海报样式与语言回落到默认值而不抛", () => {
  const broken = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("denied");
    },
  };
  const s = make(broken);
  assert.equal(s.snapshot().posterStyle, "a");
  s.setPosterStyle("b");
  s.setLang("en");
  assert.equal(s.snapshot().posterStyle, "b", "本次会话内仍然生效（内存）");
  assert.equal(s.snapshot().lang, "en");
});

test("app.js 不得自己碰 akb: 键（持久化只有一个家：注入的 storage 适配器）", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  // 注释里可以出现键名（说明「谁在写它」），它不会真的写盘——先剥掉再匹配
  const code = (p) =>
    fs
      .readFileSync(path.join(__dirname, "..", p), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
  const src = code("app.js");
  // 锚定形状：localStorage 之后紧跟 akb 开头的键就是自己开了后门
  // （akb- 同时覆盖 akb-lang 与 akb:skin 两种前缀）
  assert.doesNotMatch(
    src,
    /localStorage\.\w+\(\s*["'`]akb[-:]/,
    "app.js 不得直接读写 akb 开头的键"
  );
  assert.doesNotMatch(
    src,
    /["'`]akb[-:]/,
    "app.js 不得出现 akb 开头的键名字面量（应走 core.PREF_KEYS）"
  );
  // 注入契约的两个静默失败口：漏注入时 session 会静默拒绝（样式切换点了没反应 /
  // 语言落到硬编码的 zh），而它们此前只有不入仓的 E2E 抓得到 → 搬进 npm test
  assert.match(
    src,
    /lang:\s*preferLang\(\)/,
    "app.js 必须注入浏览器语言探测结果"
  );
  assert.match(
    src,
    /posterStyles:\s*window\.AKB_POSTER\.styles/,
    "app.js 必须注入海报样式的合法值表"
  );
  // 键名只该出现在 core.PREF_KEYS 那种集中处，且要真的用上了
  assert.match(
    src,
    /PREF_KEYS\./,
    "app.js 的粘滞标记键应从 core 的 PREF_KEYS 取"
  );

  // session.js 同理：键名只该从 core.PREF_KEYS 取，写死字面量等于又开一个家
  const sess = code("session.js");
  assert.doesNotMatch(
    sess,
    /["'`]akb[-:]/,
    "session.js 不得写死键名（应走 core.PREF_KEYS）"
  );
  assert.match(
    sess,
    /PREF_KEYS\./,
    "session.js 必须真的用上 core 的键名来源（否则「一个都不读」也算过）"
  );
});

test("注入的默认语言是首次访问的落点（浏览器语言探测在 app 侧）", () => {
  // 回归：opts.lang 曾被忽略，导致日文浏览器首屏落到硬编码的 "zh"
  const s = session.create({
    storage: memoryStorage(),
    byId,
    posterStyles: POSTER_STYLES,
    lang: "ja",
  });
  assert.equal(s.snapshot().lang, "ja");
  // 落盘值仍然优先于注入值
  const storage = memoryStorage();
  storage.setItem("akb-lang", "en");
  const t = session.create({
    storage,
    byId,
    posterStyles: POSTER_STYLES,
    lang: "ja",
  });
  assert.equal(t.snapshot().lang, "en", "用户自己选过就以落盘值为准");
});

// ---- 筛选步（ADR-0019 改写版）：逐轮二分，保留组占据前 K 名 ----
test("筛选：每轮划掉保留组的一半，划够才进入下一轮", () => {
  const S = make();
  S.setSize(16); // 挑人上限就是档位人数，所以要先切到 16 档
  for (let i = 1; i <= 16; i++) S.toggleSelect("a" + i);
  const sc = () => S.snapshot().screening;
  let v = sc();
  assert.equal(v.round, 0, "还没开始");
  assert.equal(v.need, 8, "16 档第一轮要划 8");
  assert.equal(v.canCut, 8);
  assert.equal(v.complete, false, "没划够不能开始排序");
  for (let i = 1; i <= 8; i++) assert.equal(S.toggleCut("a" + i), true);
  v = sc();
  assert.equal(v.round, 1, "第一轮完成");
  assert.equal(v.need, 4, "第二轮从 8 人里划 4");
  assert.equal(v.canCut, 4);
  // 刚划完一轮、还没点「继续细分」→ 二选一：现在就能提交，也可以再细分
  assert.equal(v.atBoundary, true);
  assert.equal(v.complete, true, "刚划完一轮 → 可提交（34 题）");
  assert.equal(v.canRecurse, true, "也可以继续细分");
  for (let i = 9; i <= 10; i++) assert.equal(S.toggleCut("a" + i), true);
  v = sc();
  assert.equal(v.atBoundary, false, "已经在第二轮里划了几个 → 不是边界了");
  assert.equal(v.complete, false, "第二轮没划够 → 不给提交");
  for (let i = 11; i <= 12; i++) assert.equal(S.toggleCut("a" + i), true);
  v = sc();
  // round = 已完成的轮数（0 起）；「到底」由 need/canCut 归零 + complete 表达
  assert.equal(v.round, 2, "两轮都划完");
  assert.equal(v.pool.length, 4, "保留组剩 4（SCREEN_STOP）");
  assert.equal(v.need, 0);
  assert.equal(v.canCut, 0, "到底了就划不动了");
  assert.equal(v.complete, true);
  assert.equal(S.toggleCut("a13"), false, "到底后划不动");
});

test("筛选：定值门槛 —— 划够一半后再划不动了（超额被拒）", () => {
  const S = make();
  for (let i = 1; i <= 7; i++) S.toggleSelect("a" + i);
  for (let i = 1; i <= 3; i++) S.toggleCut("a" + i);
  assert.equal(S.snapshot().screening.canCut, 0, "7 档第一轮只准划 3");
  assert.equal(S.toggleCut("a4"), false, "第 4 个被门槛挡住");
  assert.deepEqual(S.snapshot().screening.cut, ["a1", "a2", "a3"]);
});

test("筛选：已划掉的人再点一次是恢复（且恢复的是当前轮）", () => {
  const S = make();
  S.setSize(16); // 挑人上限就是档位人数
  S.setSize(16); // 挑人上限就是档位人数
  for (let i = 1; i <= 16; i++) S.toggleSelect("a" + i);
  S.toggleCut("a1");
  assert.deepEqual(S.snapshot().screening.cut, ["a1"]);
  assert.equal(
    S.toggleCut("a1"),
    false,
    "再点 = 恢复（返回 false 表示本轮没划掉它）"
  );
  assert.deepEqual(S.snapshot().screening.cut, []);
});

test("筛选：划除按轮次分组保存，层级由内到外", () => {
  const S = make();
  S.setSize(16); // 挑人上限就是档位人数
  for (let i = 1; i <= 16; i++) S.toggleSelect("a" + i);
  for (let i = 1; i <= 8; i++) S.toggleCut("a" + i); // 第一轮
  for (let i = 9; i <= 12; i++) S.toggleCut("a" + i); // 第二轮
  const v = S.snapshot().screening;
  assert.deepEqual(v.rounds, [
    ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"],
    ["a9", "a10", "a11", "a12"],
  ]);
  // 最内层 = a13..a16（前 4 名），最后轮的 a9..a12 排其后，最早轮的 a1..a8 垫底
  assert.deepEqual(v.tiers, [
    ["a13", "a14", "a15", "a16"],
    ["a9", "a10", "a11", "a12"],
    ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"],
  ]);
});

test("筛选：进度随存档走，新会话恢复得到（含轮次结构）", () => {
  const storage = memoryStorage();
  let S = make(storage);
  S.setSize(16);
  for (let i = 1; i <= 16; i++) S.toggleSelect("a" + i);
  for (let i = 1; i <= 8; i++) S.toggleCut("a" + i);
  for (let i = 9; i <= 10; i++) S.toggleCut("a" + i);
  S = make(storage);
  const v = S.snapshot().screening;
  assert.equal(v.round, 1);
  assert.equal(v.need, 4);
  assert.equal(
    v.cut.length,
    10,
    "cut 报全部已划的 id（UI 判断「这人划了没」）"
  );
  assert.equal(v.complete, false);
  assert.deepEqual(v.rounds[0].length, 8);
  assert.deepEqual(v.rounds[1], ["a9", "a10"]);
});

test("筛选：改已选 / 改档位 / 清空都会作废筛选与对决", () => {
  const storage = memoryStorage();
  const S = make(storage);
  S.setSize(16); // 挑人上限就是档位人数
  for (let i = 1; i <= 16; i++) S.toggleSelect("a" + i);
  S.toggleCut("a1");
  S.toggleSelect("a16"); // 取消选中一人
  assert.deepEqual(S.snapshot().screening.rounds, [], "改已选 → 划除作废");
  S.toggleCut("a1");
  S.setSize(40);
  assert.deepEqual(S.snapshot().screening.rounds, [], "改档位 → 划除作废");
  S.clearSelection();
  const v = S.snapshot().screening;
  assert.deepEqual(v.rounds, []);
  assert.equal(v.round, 0);
  assert.equal(v.canCut, 0, "已选清空 → 没有可划的");
  assert.equal(
    v.complete,
    true,
    "池子空了 → 门是开的（startDuel 另有「得有人」的门）"
  );
});

test("筛选：提交后按层级喂对决，题数上限是各组之和", () => {
  const S = make();
  for (let i = 1; i <= 7; i++) S.toggleSelect("a" + i);
  S.toggleCut("a1");
  S.toggleCut("a2");
  S.toggleCut("a3");
  assert.equal(S.snapshot().screening.complete, true, "7 档划 3 个即可");
  S.startDuel();
  const snap = S.snapshot();
  assert.equal(snap.phase, "duel");
  assert.equal(snap.duel.max, 8, "组 [4,3] → 5+3 = 8 题（不是 14）");
  assert.ok(
    snap.duel.tier >= 0 && snap.duel.tier < snap.duel.tiers,
    "报出当前在第几层"
  );
});

test("筛选：划掉的必须是本系列已选的人", () => {
  const S = make();
  for (let i = 1; i <= 7; i++) S.toggleSelect("a" + i);
  assert.equal(S.toggleCut("s1"), false, "坂道的人不在已选里");
  assert.equal(S.toggleCut("a9"), false, "本系列但不在已选里的人");
  assert.deepEqual(S.snapshot().screening.cut, []);
});

// ---- S3（Standards 轴实缺）：enterNextRound 必须按轮生效，且要有守卫 ----
test("筛选：继续细分按轮生效 —— 40 档每轮划完都还能二选一", () => {
  const S = make();
  S.setSize(40);
  for (let i = 1; i <= 40; i++) S.toggleSelect("a" + i);
  // 只划够本轮的名额就停手（真实用户不会一口气划到底 —— 划够后主按钮已可提交）
  const cutThisRound = () => {
    const v = S.snapshot().screening;
    for (let i = 0; i < v.need; i++) {
      const cur = S.snapshot().screening;
      const next = cur.pool.find((id) => !cur.cut.includes(id));
      if (!next) break;
      S.toggleCut(next);
    }
  };
  const v0 = S.snapshot().screening;
  assert.equal(v0.need, 20, "40 档第一轮划 20");

  cutThisRound();
  let v = S.snapshot().screening;
  assert.equal(v.round, 1);
  assert.equal(v.complete, true, "R1 划够可提交");
  assert.equal(v.canRecurse, true, "R1 划够可以再细分");
  assert.equal(S.enterNextRound(), true, "点继续细分成功");
  assert.equal(
    S.snapshot().screening.complete,
    false,
    "点了之后这一轮不再可提交"
  );

  cutThisRound();
  v = S.snapshot().screening;
  assert.equal(v.round, 2, "进到第二轮");
  assert.equal(v.complete, true, "R2 划够照样能提交（全局闩锁会在这里失败）");
  assert.equal(v.canRecurse, true, "R2 划够照样能继续细分");

  assert.equal(S.enterNextRound(), true);
  cutThisRound();
  v = S.snapshot().screening;
  assert.equal(v.round, 3);
  assert.equal(v.complete, true, "R3 划够照样能提交");
  assert.equal(v.canRecurse, true, "R3 也一样");
});

test("筛选：不能递归时点「继续细分」返回 false（不静默推进）", () => {
  const S = make();
  S.setSize(16);
  for (let i = 1; i <= 16; i++) S.toggleSelect("a" + i);
  // 还没划够 → 不是边界 → 按钮不出现，调用也该被拒
  assert.equal(S.enterNextRound(), false, "第 1 轮没划够时不能进入下一轮");
  assert.equal(S.snapshot().screening.round, 0, "轮次没有被动过");
});

// ---- S2（Standards 轴实缺）：快照的层级必须是拷贝 ----
test("筛选：快照的 rounds / tiers 改不动会话内部状态", () => {
  const S = make();
  S.setSize(16);
  for (let i = 1; i <= 16; i++) S.toggleSelect("a" + i);
  for (let i = 1; i <= 8; i++) S.toggleCut("a" + i);
  const before = S.snapshot().screening;
  const roundsBefore = JSON.stringify(before.rounds);
  before.tiers[1].push("zzz");
  before.rounds[0].push("yyy");
  const after = S.snapshot().screening;
  assert.equal(
    JSON.stringify(after.rounds),
    roundsBefore,
    "改快照的 tiers/rounds 动到了内部状态"
  );
  assert.equal(after.tiers.flat().includes("zzz"), false, "tiers 被污染");
  assert.equal(after.cut.includes("yyy"), false, "rounds 被污染");
});

// ---- S7（Standards 轴实缺）：跨轮越界门要有守卫 ----
test("筛选：第 1 轮划掉的人，在第 2 轮点「留」不生效", () => {
  const S = make();
  S.setSize(16);
  for (let i = 1; i <= 16; i++) S.toggleSelect("a" + i);
  for (let i = 1; i <= 8; i++) assert.equal(S.toggleCut("a" + i), true);
  // 第 2 轮：a1 已在第 1 轮被划掉，点它必须无效（它不在本轮保留组里）
  assert.equal(S.snapshot().screening.round, 1, "已进第 2 轮");
  assert.equal(S.toggleCut("a1"), false, "跨轮点划掉无效");
  const v = S.snapshot().screening;
  assert.deepEqual(
    v.rounds[0],
    ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"],
    "第 1 轮没被动"
  );
  assert.equal(v.rounds.length, 1, "第 2 轮压根没被创建（还没往里划过）");
  // 同理，非已选成员也划不动
  assert.equal(S.toggleCut("a99"), false, "未选的人划不动");
});

// ---- 「这几位重新排序」必须真的重新洗牌（Spec 轴实缺） ----
test("重新排序：注入的 shuffle 只打乱层内顺序，层级归属不变", () => {
  const mk = (shuffle) => {
    const S = make();
    S.setSize(7);
    for (let i = 1; i <= 7; i++) S.toggleSelect("a" + i);
    for (let i = 1; i <= 3; i++) S.toggleCut("a" + i);
    assert.equal(S.startDuel({ shuffle }), true);
    return S.snapshot().duel;
  };
  // 不洗牌：内层（保留组 a4..a7）按已选顺序，第一对是 a4 / a5
  const plain = mk(null);
  assert.equal(plain.tiers, 2, "两层（保留组 + 划掉组）");
  assert.deepEqual(plain.pair, ["a4", "a5"], "未洗牌时第一对取保留组前两人");
  // 倒序洗牌：内层变成 a7,a6,a5,a4 → 第一对是 a7 / a6
  const rev = mk((a) => a.slice().reverse());
  assert.equal(rev.tiers, 2, "层数不变（洗牌不改变层级结构）");
  assert.equal(rev.max, plain.max, "题数上界不变");
  assert.deepEqual(rev.pair, ["a7", "a6"], "倒序洗牌后第一对换成内层末尾两人");
});

test("重新排序：不传 shuffle 时保持确定性（首场对决不随机器变）", () => {
  const mk = () => {
    const S = make();
    S.setSize(7);
    for (let i = 1; i <= 7; i++) S.toggleSelect("a" + i);
    for (let i = 1; i <= 3; i++) S.toggleCut("a" + i);
    S.startDuel();
    return S.snapshot().duel.pair;
  };
  assert.deepEqual(mk(), mk(), "同一份已选 → 同一场第一对");
});

test("筛选：点「继续细分」后刷新，那一轮仍不给出提交", () => {
  const st = memoryStorage();
  const S = session.create({ storage: st, byId, posterStyles: POSTER_STYLES });
  S.setSize(16);
  for (let i = 1; i <= 16; i++) S.toggleSelect("a" + i);
  for (let i = 1; i <= 8; i++) S.toggleCut("a" + i);
  assert.equal(S.enterNextRound(), true);
  assert.equal(
    S.snapshot().screening.complete,
    false,
    "点之前：这一轮不给提交"
  );
  // 同一条存档重开会话（模拟刷新）
  const T = session.create({ storage: st, byId, posterStyles: POSTER_STYLES });
  const v = T.snapshot().screening;
  assert.equal(
    v.complete,
    false,
    "刷新后仍然不给提交（否则两个出口在刷新边界上不一致）"
  );
  assert.equal(v.canCut, 4, "本轮名额还是 4");
});

// ---- 架构扫描第 2 项：切系列不能把「我为这一轮点过继续细分」这个决定弄丢 ----
// 背景：deeperRound 有两条路。localStorage 走 write()/loadSeries()，存了也读了；
// 但 switchSeries 走的是内存里的 store[s]（remember 写、switchSeries 读），
// 而 remember() 当时漏了 deeperRound → 切一次系列，这个决定就变了；
// F5 刷新又会从 localStorage 读回来 → 同一状态下「刷新前后相反」。
//
// 注意顺序：要先切到另一个系列再在那边选人。反过来（留在 48g 里 setSize(16) 想给坂道
// 准备人）不成立：setSize 会把当前系列的已选清掉，切回来 cut 是 0 —— 我第一版就是这么
// 写错的，第一条断言「complete」还假绿通过，只有「已划人数」那条抓住。
const cutRound = (S) => {
  const cur = S.snapshot().screening;
  for (let i = 0; i < cur.need; i++) {
    const c = S.snapshot().screening;
    const next = c.pool.find((id) => !c.cut.includes(id));
    if (!next) break;
    S.toggleCut(next);
  }
};

test("筛选：切系列往返后 deeperRound 不变（提交门槛不能刷新前后相反）", () => {
  const S = make();
  S.setSize(40);
  for (let i = 1; i <= 40; i++) S.toggleSelect("a" + i);
  cutRound(S);
  assert.equal(S.snapshot().screening.complete, true, "R1 划够可提交");
  assert.equal(S.enterNextRound(), true, "点继续细分");
  const before = S.snapshot().screening;
  assert.equal(before.complete, false, "点了之后本轮必须再划够");
  const cutBefore = before.cut.length;

  S.switchSeries("sakamichi");
  S.setSize(16);
  for (let i = 1; i <= 16; i++) S.toggleSelect("s" + i); // 坂道这边也要有真实状态（夹具里坂道是 s1–s40）
  S.switchSeries("48g");

  const after = S.snapshot().screening;
  assert.equal(after.cut.length, cutBefore, "切回原系列后已划人数不变");
  assert.equal(after.complete, false, "切回原系列后仍应是「本轮还要再划够」");
  assert.equal(after.round, before.round, "轮次不变");
});

test("筛选：切到另一个系列不该继承上一个系列的 deeperRound", () => {
  const S = make();
  S.setSize(40);
  for (let i = 1; i <= 40; i++) S.toggleSelect("a" + i);
  cutRound(S);
  assert.equal(S.enterNextRound(), true, "48g 在第 1 轮点继续细分");
  assert.equal(S.snapshot().screening.round, 1, "48g 现在在第 1 轮");

  // 坂道也走到第 1 轮的边界：若它继承了 48g 的 deeperRound=1，边界会被压掉 → canRecurse 假
  S.switchSeries("sakamichi");
  S.setSize(16);
  for (let i = 1; i <= 16; i++) S.toggleSelect("s" + i);
  const v0 = S.snapshot().screening;
  assert.equal(v0.round, 0, "新系列从第 0 轮开始");
  assert.equal(v0.cut.length, 0, "新系列没有已划");
  cutRound(S);
  const v1 = S.snapshot().screening;
  assert.equal(v1.round, 1, "坂道也进了第 1 轮");
  assert.equal(v1.complete, true, "坂道第 1 轮划够可提交");
  assert.equal(
    v1.canRecurse,
    true,
    "坂道自己的边界没被 48g 的 deeperRound 压掉"
  );
});

test("筛选：切走再切回，48g 仍能接着划完并提交（端到端不丢进度）", () => {
  const S = make();
  S.setSize(40);
  for (let i = 1; i <= 40; i++) S.toggleSelect("a" + i);
  cutRound(S);
  S.enterNextRound();
  S.switchSeries("sakamichi");
  S.setSize(16);
  for (let i = 1; i <= 16; i++) S.toggleSelect("s" + i);
  S.switchSeries("48g");
  // 回来后继续划完这一轮，应该能提交
  cutRound(S);
  const v = S.snapshot().screening;
  assert.equal(v.complete, true, "切回来接着划完即可提交");
  assert.equal(S.startDuel(), true, "能开始排序");
});

// ---- 累计审查：我一度以为「夹子只在 load 路径、setSize 是第二个来源」 ----
// 复核后是错的：setSize 调 clearDuel()，而 clearDuel 会把 cut 整个清空
// （session.js:142-148），所以「旧档位的 cut 残留」这个形状通过 session 走不到。
// 我据此加的死代码与空转测试已删。这里钉住**真正成立**的那件事 ——
// 换档位就丢筛选进度，所以两个口径不会因为旧 cut 残留而分叉。
test("缩小档位会清空筛选进度：旧档位的 cut 不会残留（按钮与细条因此恒等）", () => {
  const S = make();
  S.setSize(40);
  for (let i = 1; i <= 40; i++) S.toggleSelect("a" + i);
  let guard = 0;
  while (guard++ < 40) {
    const sc = S.snapshot().screening;
    if (!sc.canCut) break;
    const next = sc.pool.find((id) => !sc.cut.includes(id));
    if (!next) break;
    S.toggleCut(next);
  }
  const before = S.snapshot().screening;
  assert.equal(before.complete, true, "40 档划满 4 轮后可提交");
  assert.deepEqual(
    before.tiers.map((t) => t.length),
    [3, 2, 5, 10, 20],
    "五层"
  );

  assert.equal(S.setSize(16), true);
  const sc = S.snapshot().screening;
  assert.equal(sc.round, 0, "换档位回到第 0 轮");
  assert.deepEqual(
    sc.tiers.map((t) => t.length),
    [16],
    "层级里没有旧档位的组"
  );
  assert.equal(sc.tiers.flat().length, 16, "层级并集 = 已选 16 人");
  const strip = sc.tiers.reduce((sum, g) => sum + core.worstCase(g.length), 0);
  assert.equal(
    core.tierQuestionMax(S.snapshot().selected, S.snapshot().cut, sc.round),
    strip,
    "按钮题数与细条题数一致（候选 2 之后两者同源，不再可能分叉）"
  );
});
