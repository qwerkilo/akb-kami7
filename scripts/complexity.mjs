#!/usr/bin/env node
// 复杂度趋势守卫：lizard 的 CCN>10 名单不许**变大**。
//
// 为什么是「集合不许变大」而不是「单个函数不许超 N」：本仓的口径是「CCN > 10 才列修」
// （docs/reviews/qa-baseline.md），而那条口径此前**没有任何自动化在守** —— 复杂度涨了没人知道。
// 硬卡一个上限会把「已知的 7 处」变成永久豁免清单；趋势守卫只拦新增，已有热点该怎么拆
// 仍然按质检报告逐个处理。
//
// 用法：
//   npm run complexity          # 对比基线，有新增热点就非零退出
//   node scripts/complexity.mjs --update    # 接受当前名单为新基线（重构降下来后用）
//
// 注意读 lizard 输出时**第一列是 NLOC、第二列才是 CCN**（本项目犯过这个错，一度得出
// 「复杂度没降」的反向结论）。

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const BASELINE = "docs/reviews/complexity-baseline.txt";
const THRESHOLD = 10;
const update = process.argv.includes("--update");

let out = "";
try {
  out = execSync("lizard . -l javascript -l python", { encoding: "utf8" });
} catch (e) {
  // lizard 有超阈值函数时会非零退出，stdout 仍然有效
  out = e.stdout || "";
  if (!out) {
    console.error(
      "✗ lizard 跑不起来（本机没装？）—— npm install --bin-links=false --ignore-scripts"
    );
    process.exit(2);
  }
}

const offenders = new Map();
for (const line of out.split("\n")) {
  // lizard 的列序是 NLOC CCN token PARAM length location —— **7 列**。
  // 早先按 6 列写会把符号列读成 length，生成一份全是数字的基线。
  const m = line.match(
    /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\S+@\S+)$/
  );
  if (!m) continue;
  const [, , ccn, , , , sym] = m;
  if (Number(ccn) <= THRESHOLD) continue;
  offenders.set(sym, Number(ccn)); // 同一个函数可能被列两次（多语言扫描），Set 顺手去重
}

const list = [...offenders.entries()].sort(
  (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
);
const cur = list.map(([s, c]) => `${c}\t${s}`).join("\n") + "\n";

if (update) {
  writeFileSync(BASELINE, cur);
  console.log(`✓ 基线已更新（${list.length} 处 CCN>${THRESHOLD}）`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  writeFileSync(BASELINE, cur);
  console.log(
    `! 基线不存在，已用当前名单建立（${list.length} 处）—— 这次不算失败`
  );
  process.exit(0);
}

const base = new Map(
  readFileSync(BASELINE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => l.split("\t"))
    .map(([c, s]) => [s, Number(c)])
);

const added = list.filter(([s]) => !base.has(s));
const worse = list.filter(([s, c]) => base.has(s) && c > base.get(s));
const better = list.filter(([s, c]) => base.has(s) && c < base.get(s));

console.log(`CCN>${THRESHOLD}：当前 ${list.length} 处，基线 ${base.size} 处`);
for (const [s, c] of list)
  console.log(
    `  ${base.has(s) ? (c > base.get(s) ? "↑" : c < base.get(s) ? "↓" : " ") : "NEW"} ${c}\t${s}`
  );
if (better.length)
  console.log(
    `\n↓ 降了：${better.map(([s, c]) => `${s} ${base.get(s)}→${c}`).join("、")}`
  );

if (added.length || worse.length) {
  console.error(
    `\n✗ 复杂度热点新增或变高：${[...added, ...worse].map(([s, c]) => `${s} ${base.get(s) ?? "—"}→${c}`).join("、")}`
  );
  process.exit(1);
}
console.log("\n✓ 没有新增热点");
