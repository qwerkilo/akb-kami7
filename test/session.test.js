const { test } = require("node:test");
const assert = require("node:assert/strict");
const session = require("../session.js");

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    _map: map,
  };
}

const MEMBERS = [];
for (let i = 1; i <= 10; i++) MEMBERS.push({ id: `a${i}`, series: "48g" });
for (let i = 1; i <= 6; i++) MEMBERS.push({ id: `s${i}`, series: "sakamichi" });
for (let i = 1; i <= 3; i++) MEMBERS.push({ id: `l${i}`, series: "love" });
const BY_ID = new Map(MEMBERS.map((m) => [m.id, m]));
const byId = (id) => BY_ID.get(id);

function make(storage = memoryStorage(), byIdFn = byId) {
  return session.create({ storage, byId: byIdFn });
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
  S.startDuel(["a1", "a2"]);
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
  S.startDuel(["a1", "a2", "a3"]);
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
  S.startDuel(["a1", "a2"]);
  S.answer(true);
  assert.equal(S.toggleSelect("a3"), true);
  assert.equal(S.snapshot().phase, "pick");
  S.startDuel(["a1", "a2", "a3"]);
  S.setSize(16);
  assert.equal(S.snapshot().phase, "pick");
});

test("非对决相位 answer/undo/abandon 为 no-op", () => {
  const S = make();
  assert.equal(S.answer(true), false);
  assert.equal(S.undo(), false);
  assert.equal(S.abandonDuel(), false);
  assert.equal(S.startDuel([]), false);
  assert.equal(S.startDuel(["nope"]), false);
  assert.equal(S.startDuel(["a1", "s1"]), false);
});

test("重新选人：放弃对决但保留已选", () => {
  const S = make();
  S.toggleSelect("a1");
  S.toggleSelect("a2");
  S.startDuel(["a1", "a2"]);
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
  S.startDuel(["a1", "a2", "a3"]);
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
    S.startDuel(["a1", "a2", "a3", "a4", "a5"]);
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
  S.startDuel(["a1", "a2", "a3"]);
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
  S.startDuel(["a1", "a2", "a3"]);
  assert.equal(S.undo(), false);
  assert.equal(S.answer(true), true);
  assert.equal(S.undo(), true);
});

test("clearSelection：已选为空但对决进行中时也清空并返回 true", () => {
  const S = make();
  ["a1", "a2", "a3"].forEach((id) => S.toggleSelect(id));
  S.startDuel(["a1", "a2", "a3"]);
  S.clearSelection();
  ["a1", "a2", "a3"].forEach((id) => S.toggleSelect(id));
  const S2 = make();
  S2.startDuel(["a1", "a2", "a3"]);
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
  assert.deepEqual(sel, ["a1", "a2", "a3", "a4", "a5", "a6", "a7"], "必须等于保留的那 7 个 id");
  for (const id of sel) assert.equal(typeof id, "string", "id 不得是 undefined");
});

test("快照与返回值必须是拷贝：改返回值不动内部状态", () => {
  const s = make();
  for (let i = 1; i <= 4; i++) s.toggleSelect(`a${i}`);
  const snap = s.snapshot();
  snap.selected.push("注入");
  snap.selected.reverse();
  assert.deepEqual(s.snapshot().selected, ["a1", "a2", "a3", "a4"], "改快照不得污染内部已选");
  s.startDuel(["a1", "a2"]);
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
  assert.equal(bad.setQuery(null), "", "null 查询应变成空串，不是字符串 undefined");
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
  s.startDuel(["a1", "a2", "a3"]);
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
  s.startDuel(["a1", "a2", "a3"]);
  const duel = s.snapshot().duel;
  assert.equal(duel.step, 1, "新对决从第 1 步开始");
  // max 是**题数**不是人数：3 人两两比较共 3 题
  assert.equal(duel.max, 3, "3 人的精确全序共 3 题");
  assert.equal(duel.remaining, 3, "开局时剩余题数等于总题数");
  assert.equal(duel.percent, 0);
  assert.equal(duel.canUndo, false, "还没作答就不可撤回");
});
