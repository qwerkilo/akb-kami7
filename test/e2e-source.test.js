// e2e/ 的源码形状守卫（retro 2026-10-06）：**等待可以失败，但不可以沉默**。
//
// 主套件 21 分钟里有 18 分钟是 9 次 ready() 各烧满 120s 超时 —— 名册的
// `<img loading="lazy">` 在视口外永不加载、条件恒假，而 `.catch(() => {})` 把超时吞掉：
// 不报错、不失败，只是安静地烧。这个形状不许再回来。
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const DIR = path.join(__dirname, "..", "e2e");

test("e2e 里的等待不许裸吞超时（.catch(() => {}) 要带标签）", () => {
  const offenders = [];
  for (const f of fs.readdirSync(DIR).sort()) {
    if (!f.endsWith(".cjs") || f === "_wait.cjs") continue; // _wait.cjs 是收口处
    fs.readFileSync(path.join(DIR, f), "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (/\.catch\(\(\) => \{\}\)/.test(line))
          offenders.push(`${f}:${i + 1}`);
      });
  }
  assert.deepEqual(
    offenders,
    [],
    '等待失败必须出声：用 e2e/_wait.cjs 的 waitFor/waitForSelector，或 .catch(() => noteTimeout("标签"))'
  );
});

/** 单个文件里「没界」或「超时被静默忽略」的等待调用（返回违规描述列表）。 */
function unboundedWaits(src, f) {
  const offenders = [];
  const re = /\.(waitForFunction|waitForSelector)\(/g;
  let m;
  while ((m = re.exec(src))) {
    // 按**括号配平**截出整个调用（回调体里也有 ")"，"找到第一个 );" 会截错）
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < src.length; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")" && --depth === 0) break;
    }
    const stmt = src.slice(m.index, i + 1);
    const line = src.slice(0, m.index).split("\n").length;
    if (!/timeout/.test(stmt)) {
      offenders.push(`${f}:${line} ${m[1]} 无 timeout`);
      continue;
    }
    // Playwright 的签名是 (fn, arg, options)：options 放**第二参**会被当成 arg、
    // 超时静默失效（两轴审查：仓内曾有 3 处这种写法）。检查调用尾部两参是
    // `null, { … timeout … }` —— 比切分全部实参简单，够用。
    if (
      m[1] === "waitForFunction" &&
      !/,\s*null\s*,\s*\{[^}]*timeout[^}]*\}\s*\)$/.test(stmt)
    ) {
      offenders.push(
        `${f}:${line} waitForFunction 第二参必须是 null（options 放第三参）`
      );
    }
  }
  return offenders;
}

test("e2e 的等待都有界（不许无 timeout 的 waitForFunction/waitForSelector）", () => {
  const offenders = [];
  for (const f of fs.readdirSync(DIR).sort()) {
    if (!f.endsWith(".cjs") || f === "_wait.cjs") continue;
    offenders.push(
      ...unboundedWaits(fs.readFileSync(path.join(DIR, f), "utf8"), f)
    );
  }
  assert.deepEqual(
    offenders,
    [],
    "等待要么没界、要么超时被静默忽略（options 要在第三参）"
  );
});

test("e2e 的脚本都能过语法检查；runner 能被 require（工具坏了 check 不该全绿）", () => {
  const { spawnSync } = require("node:child_process");
  const offenders = [];
  for (const f of fs.readdirSync(DIR).sort()) {
    if (!f.endsWith(".cjs")) continue;
    const r = spawnSync(process.execPath, ["--check", path.join(DIR, f)], {
      encoding: "utf8",
    });
    if (r.status !== 0) offenders.push(`${f}: ${r.stderr.split("\n")[0]}`);
  }
  assert.deepEqual(
    offenders,
    [],
    "语法错误要在 check 里红，不要等跑起来才发现"
  );
  // run-all.cjs 有 `require.main === module` 守卫 → require 它是安全的，能抓
  // 「函数漏了/名字写错」这类**加载期**错误（本批真实踩过：parseArgs 漏了，
  // 而 npm run check 全绿，直到下一次真跑才炸）。
  assert.doesNotThrow(() => require(path.join(DIR, "run-all.cjs")));
});

const HELPERS = [
  "waitFor",
  "waitForSelector",
  "noteTimeout",
  "ready",
  "blockStarter",
  "elapsed",
  "waitTicker",
];

/** 一个脚本从 _wait/_progress 里 import 了哪些名字。 */
function importedHelpers(src) {
  const names = new Set();
  for (const line of src.split("\n")) {
    if (
      !line.includes('require("./_wait.cjs")') &&
      !line.includes('require("./_progress.cjs")')
    )
      continue;
    const m = line.match(/\{([^}]*)\}/);
    if (m) m[1].split(",").forEach((x) => names.add(x.trim()));
  }
  return names;
}

/** 裸用（不是 obj.method）的共享助手名。 */
function bareUses(src, name) {
  return new RegExp(`(?<![.\\w])${name}\\s*\\(`).test(src);
}

test("e2e 脚本用到的共享助手必须真的 import 了（本批踩过：waitFor 漏 import）", () => {
  const offenders = [];
  for (const f of fs.readdirSync(DIR).sort()) {
    if (!f.endsWith(".cjs") || f === "_wait.cjs" || f === "_progress.cjs")
      continue;
    // 剥注释再扫：注释里提到 `ready(` 不是「用了它」（本仓记录过守卫扫到注释的坑）
    const src = fs
      .readFileSync(path.join(DIR, f), "utf8")
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const imported = importedHelpers(src);
    for (const h of HELPERS) {
      if (bareUses(src, h) && !imported.has(h)) offenders.push(`${f}: ${h}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "用了共享助手却没 import → 跑起来才 ReferenceError"
  );
});

test("检查记录只有一处：runner 不解析收尾行、套件不自报收尾（第五轮扫描候选 3）", () => {
  const strip = (src) =>
    src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const runner = strip(fs.readFileSync(path.join(DIR, "run-all.cjs"), "utf8"));
  for (const dead of ["parseCounts", "compareCounts", "expect:"]) {
    assert.ok(
      !runner.includes(dead),
      `run-all.cjs 不许再有 ${dead} —— 数守恒由套件自报（runSuite({expect})）`
    );
  }
  // 记录器与退出码的接线在**执行器**里（套件只声明 expect）
  const suite = strip(fs.readFileSync(path.join(DIR, "_suite.cjs"), "utf8"));
  assert.match(suite, /createChecker\(/, "_suite.cjs 建记录器");
  assert.match(
    suite,
    /checker\.done\(\)/,
    "_suite.cjs 把 checker.done() 接到退出码"
  );
  // 派生自磁盘（不手抄套件清单 —— 手抄的会与现状脱节，本轮扫描候选 6/7 的教训）
  const suites = fs
    .readdirSync(DIR)
    .filter(
      (f) => f.endsWith(".cjs") && !f.startsWith("_") && f !== "run-all.cjs"
    );
  assert.ok(
    suites.length >= 5,
    `套件太少（${suites.length}）—— 守卫本身坏了？`
  );
  for (const f of suites) {
    const src = strip(fs.readFileSync(path.join(DIR, f), "utf8"));
    // 承重点三条：走执行器、带数守恒声明、不许自己记账
    assert.match(
      src,
      /runSuite\(/,
      `${f} 必须走 e2e/_suite.cjs 的 runSuite（生命周期只有一处）`
    );
    assert.match(src, /expect:\s*\d+/, `${f} 必须声明 expect（数守恒）`);
    assert.ok(
      !src.includes("createChecker("),
      `${f} 不许自己建记录器 —— 执行器建好交给 body`
    );
    assert.ok(
      !src.includes("checker.done("),
      `${f} 不许自己接退出码 —— 执行器按 checker.done() 退出`
    );
    // 收尾行只许在 _check.cjs 拼（模板串与双引号都算）
    assert.ok(
      !/console\.log\([^)]*通过/.test(src),
      `${f} 不许自己 console.log 收尾行 —— 走 e2e/_check.cjs`
    );
    for (const bit of ["checks passed", "项通过", "个状态正常"]) {
      assert.ok(!src.includes(bit), `${f} 不许自己拼收尾行（含「${bit}」）`);
    }
  }
});

test("等待只有一个入口：套件不许裸 waitForFunction/waitForSelector、不许自己实现 ready（候选 4）", () => {
  // 派生自磁盘（不手抄套件清单 —— 手抄的会与现状脱节：此前缺 verify-first-screen.cjs，
  // 第六轮扫描候选 7 抓到的就是这个）
  const suites = fs
    .readdirSync(DIR)
    .filter(
      (f) => f.endsWith(".cjs") && !f.startsWith("_") && f !== "run-all.cjs"
    );
  assert.ok(
    suites.length >= 5,
    `套件太少（${suites.length}）—— 守卫本身坏了？`
  );
  for (const f of suites) {
    const src = fs.readFileSync(path.join(DIR, f), "utf8");
    assert.ok(
      !src.includes("waitForFunction"),
      `${f} 不许裸 waitForFunction —— 走 e2e/_wait.cjs 的 waitFor（软/hard）`
    );
    assert.ok(
      !/\.waitForSelector\(/.test(src),
      `${f} 不许裸 waitForSelector —— 走 e2e/_wait.cjs 的 waitForSelector`
    );
    assert.ok(
      !/function ready\(|const ready\s*=/.test(src),
      `${f} 不许自己实现 ready —— 它收在 e2e/_wait.cjs`
    );
  }
  // 软/硬两种形态都在 _wait.cjs 里
  const wait = fs.readFileSync(path.join(DIR, "_wait.cjs"), "utf8");
  assert.match(wait, /function waitFor\(/, "waitFor 在 _wait.cjs");
  assert.match(
    wait,
    /function waitForSelector\(/,
    "waitForSelector 在 _wait.cjs"
  );
  assert.match(wait, /function ready\(/, "ready 在 _wait.cjs");
  assert.match(wait, /hard/, "硬等待（hard: true）在 _wait.cjs");
});

test("套件生命周期只有一处：不许手写 spawn(serve.py)/process.exit，必须走 runSuite（候选 2）", () => {
  const strip = (src) =>
    src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  // 派生自磁盘（不手抄套件清单 —— 手抄的清单会与现状脱节，本轮扫描候选 6/7 的教训）
  const suites = fs
    .readdirSync(DIR)
    .filter(
      (f) => f.endsWith(".cjs") && !f.startsWith("_") && f !== "run-all.cjs"
    );
  assert.ok(
    suites.length >= 5,
    `套件太少（${suites.length}）—— 守卫本身坏了？`
  );
  for (const f of suites) {
    const src = strip(fs.readFileSync(path.join(DIR, f), "utf8"));
    assert.ok(
      !src.includes("serve.py"),
      `${f} 不许手写 serve.py 的 spawn —— 起服务收在 e2e/_suite.cjs`
    );
    assert.ok(
      !/process\.exit\(/.test(src),
      `${f} 不许自己 process.exit() —— 退出码由执行器按 checker.done() 给`
    );
    assert.match(src, /runSuite\(/, `${f} 必须走 e2e/_suite.cjs 的 runSuite`);
  }
  const suite = strip(fs.readFileSync(path.join(DIR, "_suite.cjs"), "utf8"));
  assert.ok(suite.includes("serve.py"), "_suite.cjs 负责起服务（唯一出处）");
  assert.ok(
    suite.includes("process.exit"),
    "_suite.cjs 负责退出码（唯一出处）"
  );
  assert.ok(suite.includes("finally"), "_suite.cjs 的清理必须在 finally 里");
});

test("页面操作词汇只有一处：五个共享操作不许在套件里重复定义（候选 3）", () => {
  const strip = (src) =>
    src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const names = [
    "openFilterPanel",
    "openMore",
    "fillScreening",
    "passScreening",
    "goToPick",
    "firstScreenGeo",
    "firstScreenOk",
  ];
  const ui = strip(fs.readFileSync(path.join(DIR, "_ui.cjs"), "utf8"));
  const defs = [...ui.matchAll(/function\s+(\w+)\s*\(/g)].map((m) => m[1]);
  assert.deepEqual(
    defs.sort(),
    [...names].sort(),
    `_ui.cjs 的函数集合必须恰好是这五个（实得 ${defs.join(", ")}）`
  );
  const suites = fs
    .readdirSync(DIR)
    .filter(
      (f) => f.endsWith(".cjs") && !f.startsWith("_") && f !== "run-all.cjs"
    );
  assert.ok(
    suites.length >= 5,
    `套件太少（${suites.length}）—— 守卫本身坏了？`
  );
  for (const f of suites) {
    const src = strip(fs.readFileSync(path.join(DIR, f), "utf8"));
    for (const n of names) {
      assert.ok(
        !new RegExp(`function ${n}\\(`).test(src),
        `${f} 不许重复定义 ${n} —— 走 e2e/_ui.cjs（同一约定写两遍、改一处就静默失效）`
      );
    }
    // 名字级：用到哪个就必须从 ./_ui.cjs 解构引入哪个（文件级 require 检查会被
    // 「解构里删掉一个、调用还在」骗过）
    // 取**全部** require("./_ui.cjs") 解构行的并集：prettier 会把长解构折成多行、
    // 套件也可能分两处引入（曾只取第一个 match → 第二处被当成「没引入」）
    const imported = [
      ...src.matchAll(/\{([^}]*)\}\s*=\s*require\("\.\/_ui\.cjs"\)/g),
    ].flatMap((m) =>
      m[1]
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    );
    for (const n of names) {
      if (new RegExp(`\\b${n}\\b`).test(src)) {
        assert.ok(
          imported.includes(n),
          `${f} 用到 ${n} 就必须从 ./_ui.cjs 解构引入`
        );
      }
    }
  }
});

test("存储种子协议只有一处：e2e/ 不许出现键字面量（候选 4）", () => {
  const strip = (src) =>
    src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const core = require("../core.js");
  // 清单从产品计算（含按系列存档的**前缀**）—— 手写键名时 PREF_KEYS 一改就静默失效：
  // 种子落空 → 应用回落默认档位 → 矩阵塌成 7 档、断言照样全绿。
  const keys = [
    ...Object.values(core.PREF_KEYS).filter((v) => typeof v === "string"),
    core.PREF_KEYS.state(""),
  ];
  assert.ok(
    keys.length >= 7,
    `键清单太少（${keys.length}）—— PREF_KEYS 被清空？`
  );
  // 扫描集含 `_store.cjs` 自己：唯一知道键名的地方若被写死，本批要消灭的漂移类会原地复活
  // （`_` 前缀的助手此前被排除在外 —— 两轴审查抓的正是这个缺口）。
  // 已知边界：strip 的 `//` 注释剥离会误剥字符串里的 `//`（如 URL 同行），文本守卫的固有边界。
  const suites = fs
    .readdirSync(DIR)
    .filter(
      (f) => f.endsWith(".cjs") && !f.startsWith("_") && f !== "run-all.cjs"
    );
  assert.ok(
    suites.length >= 5,
    `套件太少（${suites.length}）—— 守卫本身坏了？`
  );
  for (const f of [...suites, "_store.cjs"]) {
    const src = strip(fs.readFileSync(path.join(DIR, f), "utf8"));
    for (const k of keys) {
      assert.ok(
        !src.includes(`"${k}"`) &&
          !src.includes(`'${k}'`) &&
          !src.includes("`" + k + "`"),
        `${f} 不许出现键字面量 ${k} —— 走 e2e/_store.cjs（键从 core.PREF_KEYS 派生）`
      );
    }
    // 用了 _store 的 API 就必须真的 require 它（注释掉 require 后 `S.` 会运行时崩 ——
    // 只有这条抓得住）；种入存储的套件还必须走 _store（直接 require core 自建载荷也不行）
    const usesStore =
      /\bS\.(prefKey|stateKey|statePayload|seedPrefs|seedStates)\(/.test(src);
    if (
      f !== "_store.cjs" &&
      (usesStore || src.includes("localStorage.setItem"))
    ) {
      assert.ok(
        src.includes('require("./_store.cjs")'),
        `${f} 用了 _store 的 API（或直接种存储）就必须 require _store.cjs`
      );
    }
  }
  const store = strip(fs.readFileSync(path.join(DIR, "_store.cjs"), "utf8"));
  assert.match(
    store,
    /require\("\.\.\/core\.js"\)/,
    "_store.cjs 必须从产品派生键"
  );
});

test("首屏判据只有一处：两个套件都必须调 _ui.cjs 的 firstScreenGeo（候选 5）", () => {
  for (const f of ["e2e.cjs", "verify-first-screen.cjs"]) {
    const src = fs.readFileSync(path.join(DIR, f), "utf8");
    assert.ok(
      /firstScreenGeo/.test(src) && /firstScreenOk\(/.test(src),
      `${f} 必须用 _ui.cjs 的 firstScreenGeo/firstScreenOk（首屏判据不许再抄一份）`
    );
  }
  const ui = fs.readFileSync(path.join(DIR, "_ui.cjs"), "utf8");
  assert.match(ui, /function firstScreenOk\(/, "firstScreenOk 在 _ui.cjs");
});

test("预期噪声判定只有一处：e2e/ 不许再写噪声字面量（候选 6）", () => {
  const strip = (src) =>
    src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const bits = [
    "Failed to load resource",
    "net::ERR",
    "A network error occurred",
  ];
  const suites = fs
    .readdirSync(DIR)
    .filter(
      (f) => f.endsWith(".cjs") && !f.startsWith("_") && f !== "run-all.cjs"
    );
  assert.ok(
    suites.length >= 5,
    `套件太少（${suites.length}）—— 守卫本身坏了？`
  );
  for (const f of suites) {
    const src = strip(fs.readFileSync(path.join(DIR, f), "utf8"));
    for (const b of bits) {
      assert.ok(
        !src.includes(b),
        `${f} 不许写噪声字面量「${b}」—— 判定收在 e2e/_noise.cjs`
      );
    }
    if (/page\.on\("console"/.test(src)) {
      assert.ok(
        src.includes('require("./_noise.cjs")'),
        `${f} 注册了 console 监听就必须用 _noise.cjs 的判定`
      );
    }
  }
  const noise = strip(fs.readFileSync(path.join(DIR, "_noise.cjs"), "utf8"));
  for (const b of bits) {
    assert.ok(noise.includes(b), `_noise.cjs 应当包含「${b}」`);
  }
});

test("每个 E2E 套件都进了 run-all（漏一个 = 全量跑不到它）", () => {
  const runner = fs.readFileSync(path.join(DIR, "run-all.cjs"), "utf8");
  const suites = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".cjs") && !f.startsWith("_"))
    .filter((f) => f !== "run-all.cjs")
    .filter((f) =>
      fs.readFileSync(path.join(DIR, f), "utf8").includes("runSuite(")
    );
  assert.ok(
    suites.length >= 5,
    `套件太少（${suites.length}）—— 守卫本身坏了？`
  );
  for (const f of suites) {
    assert.ok(
      runner.includes(`e2e/${f}`),
      `${f} 有 createChecker 却没进 run-all —— 全量并行跑不到它`
    );
  }
});
