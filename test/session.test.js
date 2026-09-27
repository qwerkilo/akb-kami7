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
    query: "",
    open: [],
    phase: "pick",
    duel: null,
    ranking: null,
  });
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
  assert.equal(S.setSize(32), true);
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
