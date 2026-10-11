#!/usr/bin/env node
// 复杂度趋势守卫：CCN>10 名单不许**变大**。
// JS 用 AST 算（lizard 的 JS 解析会被正则字面量截断，见 scripts/ccn.mjs 头注释）；
// Python 用 lizard（解析正常）。
//
// 为什么是「集合不许变大」而不是「单个函数不许超 N」：本仓的口径是「CCN > 10 才列修」
// （docs/reviews/qa-baseline.md），而那条口径此前**没有任何自动化在守** —— 复杂度涨了没人知道。
// 硬卡一个上限会把「已知的 7 处」变成永久豁免清单；趋势守卫只拦新增，已有热点该怎么拆
// 仍然按质检报告逐个处理。
//
// 用法：
//   npm run complexity          # 对比基线，有新增热点就非零退出
//   node scripts/complexity.mjs --update    # 接受当前名单为新基线（重构降下来后用）
// 跑绿时若有改进（CCN 下降，或整条掉出名单），会自动把基线收紧到当前（写文件）；
// 跑红时不动文件。收紧失败也拦不住 —— 下次跑绿还会再收。
//
// 注意读 lizard 输出时**第一列是 NLOC、第二列才是 CCN**（本项目犯过这个错，一度得出
// 「复杂度没降」的反向结论）。

import { execSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { jsCcn, selfTest } from "./ccn.mjs";

const BASELINE = "docs/reviews/complexity-baseline.txt";
const THRESHOLD = 10;
const update = process.argv.includes("--update");

// 先自检 CCN 计算器本身：它能整体失效还让棘轮全绿（变异 jsCcn→[] 实测存活）。
const st = selfTest();
if (!st.ok) {
  console.error("✗ CCN 自检失败（结论不可信）：" + st.failures.join("；"));
  process.exit(2);
}

// Python 侧自检：lizard 解析失效时名单会静默少一批（基线的键消失且没人比较 → 全绿）。
// fixture 里 3 个 if → CCN = 3 + 1 = 4；对不上就拒绝出结论。
const LIZARD_KEY = /^(.+?)@(\d+)-(\d+)@(.+)$/;
function lizardSelfTest() {
  const dir = mkdtempSync(join(tmpdir(), "ccn-"));
  const file = join(dir, "fixture.py");
  writeFileSync(
    file,
    "def _ccn_fixture(a):\n    if a == 1:\n        return 1\n    if a == 2:\n        return 2\n    if a == 3:\n        return 3\n    return 0\n"
  );
  try {
    let out;
    try {
      out = execSync(`lizard "${file}" -l python`, { encoding: "utf8" });
    } catch {
      return { ok: false, failures: ["lizard 跑不起来（本机没装？）"] };
    }
    for (const line of out.split("\n")) {
      const m = line.match(
        /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\S+@\S+)$/
      );
      if (!m || !LIZARD_KEY.exec(m[6])) continue;
      return Number(m[2]) === 4
        ? { ok: true }
        : { ok: false, failures: [`_ccn_fixture CCN=${m[2]}（期望 4）`] };
    }
    return { ok: false, failures: ["fixture 没有出现在 lizard 输出里"] };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const pst = lizardSelfTest();
if (!pst.ok) {
  console.error(
    "✗ Python 复杂度自检失败（结论不可信）：" + pst.failures.join("；")
  );
  process.exit(2);
}

const offenders = new Map();
const add = (name, file, ccn, from, to) => {
  if (ccn <= THRESHOLD) return;
  const key = `${name}@${file}`;
  const prev = offenders.get(key);
  // 同名取 CCN 更高者（匿名函数重名、多语言扫描重列都靠这条）
  if (!prev || ccn > prev.ccn)
    offenders.set(key, { ccn, from, to, file, name });
};

// JS：AST 口径。生成的 data 文件（members.js/simplified.js）是数组字面量，跳过。
const jsFiles = [
  ...readdirSync(".").filter(
    (f) => f.endsWith(".js") && f !== "members.js" && f !== "simplified.js"
  ),
  ...readdirSync("test")
    .filter((f) => f.endsWith(".js"))
    .map((f) => `test/${f}`),
];
for (const f of jsFiles) {
  let fns;
  try {
    fns = jsCcn(readFileSync(f, "utf8"));
  } catch (e) {
    console.error(`✗ JS 解析失败（${f}）：${e.message}`);
    process.exit(2);
  }
  for (const fn of fns) add(fn.name, `./${f}`, fn.ccn, fn.from, fn.to);
}

// Python：lizard。排除 e2e/：测试脚本是顺序检查序列，CCN 天然高。
let out = "";
try {
  out = execSync("lizard . -l python -x '*/e2e/*'", { encoding: "utf8" });
} catch (e) {
  out = e.stdout || "";
  if (!out) {
    console.error("✗ lizard 跑不起来（本机没装？）");
    process.exit(2);
  }
}
const KEY = /^(.+?)@(\d+)-(\d+)@(.+)$/;
for (const line of out.split("\n")) {
  // lizard 的列序是 NLOC CCN token PARAM length location —— 6 列（5 个数字 + 符号）。
  const m = line.match(
    /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\S+@\S+)$/
  );
  if (!m) continue;
  const [, , ccn, , , , sym] = m;
  const at = KEY.exec(sym);
  if (!at) continue;
  const [, name, from, to, file] = at;
  add(name, file, Number(ccn), from, to);
}

const list = [...offenders.entries()].sort(
  (a, b) => b[1].ccn - a[1].ccn || a[0].localeCompare(b[0])
);
const cur =
  list.map(([k, v]) => `${v.ccn}\t${k}\t${v.from}-${v.to}`).join("\n") + "\n";

if (update) {
  // 保留原有 `#` 注释行（登记口径/债的说明），只换数据行
  const header = existsSync(BASELINE)
    ? readFileSync(BASELINE, "utf8")
        .split("\n")
        .filter((l) => l.startsWith("#"))
        .join("\n")
    : "";
  writeFileSync(BASELINE, header ? header + "\n" + cur : cur);
  console.log(
    `✓ 基线已更新（${list.length} 处 CCN>${THRESHOLD}，身份=名字@文件）`
  );
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  writeFileSync(BASELINE, cur);
  console.log(
    `! 基线不存在，已用当前名单建立（${list.length} 处）—— 这次不算失败`
  );
  process.exit(0);
}

// 基线行：`CCN<TAB>名字@文件<TAB>起-止`。兼容旧格式（`CCN<TAB>名字@起-止@文件`）：
// 那时行号混在身份里，无法与新格式逐字比较，所以格式一换就要求重新落基线。
const base = new Map(
  readFileSync(BASELINE, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#")) // 允许注释行（登记口径/债的说明）
    .map((l) => l.split("\t"))
    .map(([c, k]) => [k, Number(c)])
);

const added = list.filter(([k]) => !base.has(k));
const worse = list.filter(([k, v]) => base.has(k) && v.ccn > base.get(k));
const better = list.filter(([k, v]) => base.has(k) && v.ccn < base.get(k));

console.log(`CCN>${THRESHOLD}：当前 ${list.length} 处，基线 ${base.size} 处`);
for (const [k, v] of list)
  console.log(
    `  ${base.has(k) ? (v.ccn > base.get(k) ? "↑" : v.ccn < base.get(k) ? "↓" : " ") : "NEW"} ${v.ccn}\t${k}\t${v.from}-${v.to}`
  );
if (better.length)
  console.log(
    `\n↓ 降了：${better.map(([k, v]) => `${k} ${base.get(k)}→${v.ccn}`).join("、")}`
  );

// 掉出名单（≤阈值）的旧键：不在 list 里、没人跟它比较 —— 不剪就会永远挂在基线里。
const stale = [...base.keys()].filter((k) => !list.some(([lk]) => lk === k));
if ((better.length || stale.length) && !added.length && !worse.length) {
  // 棘轮收紧：跑绿时把基线降到当前 —— 否则「降下去、又涨回旧峰值之内」会永远显示
  // 「↓ 降了」且 exit 0（第八轮扫描抓到：load_fetcher.fetch 基线 12 / 现 6）。
  const header = readFileSync(BASELINE, "utf8")
    .split("\n")
    .filter((l) => l.startsWith("#"))
    .join("\n");
  writeFileSync(BASELINE, header ? header + "\n" + cur : cur);
  console.log(
    `↓ 已收紧基线：${[...better.map(([k]) => k), ...stale].join("、")}`
  );
}

if (added.length || worse.length) {
  console.error(
    `\n✗ 复杂度热点新增或变高：${[...added, ...worse].map(([k, v]) => `${k} ${base.get(k) ?? "—"}→${v.ccn}`).join("、")}`
  );
  process.exit(1);
}
console.log("\n✓ 没有新增热点");
