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
    const src = fs.readFileSync(path.join(DIR, f), "utf8");
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
