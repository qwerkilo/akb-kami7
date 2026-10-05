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
  // 排除 e2e/：测试脚本是**顺序检查序列**，每个 check 就是一个 if，CCN 天然高
  // （主套件那个 IIFE 42、PWA 42）。棘轮守的是产品代码的形状，不是测试脚本。
  out = execSync("lizard . -l javascript -l python -x '*/e2e/*'", {
    encoding: "utf8",
  });
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

// 身份 = **函数名 + 文件**，行号区间只是元数据。
// 早先身份用 lizard 的整串 `name@start-end@file`，于是任何改动行数的提交（比如在文件
// 上面加几行）都会把老热点报成「NEW」—— 本项目已因此误报过一次
// （stay / bioDict / main 三个老热点的 CCN 一点没变，只是行号挪了）。
const KEY = /^(.+?)@(\d+)-(\d+)@(.+)$/;

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
  const at = KEY.exec(sym);
  if (!at) continue;
  const [, name, from, to, file] = at;
  const key = `${name}@${file}`;
  const prev = offenders.get(key);
  // 同一个函数可能被列两次（多语言扫描）；同名取 CCN 更高者，区间照记
  if (!prev || Number(ccn) > prev.ccn)
    offenders.set(key, { ccn: Number(ccn), from, to, file, name });
}

const list = [...offenders.entries()].sort(
  (a, b) => b[1].ccn - a[1].ccn || a[0].localeCompare(b[0])
);
const cur =
  list.map(([k, v]) => `${v.ccn}\t${k}\t${v.from}-${v.to}`).join("\n") + "\n";

if (update) {
  writeFileSync(BASELINE, cur);
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
    .filter(Boolean)
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

if (added.length || worse.length) {
  console.error(
    `\n✗ 复杂度热点新增或变高：${[...added, ...worse].map(([k, v]) => `${k} ${base.get(k) ?? "—"}→${v.ccn}`).join("、")}`
  );
  process.exit(1);
}
console.log("\n✓ 没有新增热点");
