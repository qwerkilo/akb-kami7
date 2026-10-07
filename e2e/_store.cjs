// E2E 的存储种子协议（第六轮扫描候选 4）。
//
// 键名与载荷此前在 5 个套件手写 11 + 5 处、守卫 0 处。静默假绿路径：`PREF_KEYS` 一改
// （如 v2→v3），所有种子静默失效 → 应用回落默认（7 档/zh/classic）→ header 的「档位」维
// 塌成 7 档、first 同理，而两个套件只断言 tab 可达/见脸/无横滚，照样全绿。
//
// 所以键与载荷都**从产品自身派生**（core.js 可直接 require —— test/core.test.js 即如此）：
// 产品改键名/版本，E2E 自动跟随。守卫在 test/e2e-source.test.js（e2e/ 不许再出现键字面量）。
const core = require("../core.js");

/** 偏好键（lang/skin/series/posterStyle/coach/duelIntro）——给读取/删除用。 */
function prefKey(name) {
  return core.PREF_KEYS[name];
}

/** 按系列存档键。 */
function stateKey(series) {
  return core.PREF_KEYS.state(series);
}

/** 存档载荷：走产品自己的序列化器（形状零重复）。 */
function statePayload({ size, selected = [], duel = null }) {
  return core.serializeState({
    size,
    selected,
    duel,
    cut: [],
    deeperRound: 0,
  });
}

/**
 * 每次导航前种偏好（addInitScript）：`{ lang, skin }`。
 * 只服务「一次种好、多次加载」的矩阵套件 —— 测「刷新续玩」的套件必须用页内 evaluate，
 * 否则每次导航重种会冲掉进度。
 */
function seedPrefs(ctx, prefs) {
  const pairs = Object.entries(prefs).map(([k, v]) => [prefKey(k), v]);
  return ctx.addInitScript((ps) => {
    for (const [k, v] of ps) localStorage.setItem(k, v);
  }, pairs);
}

/** 每次导航前给每个系列种档位/已选（addInitScript）。`selected` 形如 `{ "48g": [id…] }`。 */
function seedStates(ctx, seriesList, { size, selected = {} }) {
  const pairs = seriesList.map((s) => [
    stateKey(s),
    statePayload({ size, selected: selected[s] || [] }),
  ]);
  return ctx.addInitScript((ps) => {
    for (const [k, v] of ps) localStorage.setItem(k, v);
  }, pairs);
}

module.exports = {
  prefKey,
  stateKey,
  statePayload,
  seedPrefs,
  seedStates,
};
