#!/usr/bin/env node
// 跑浏览器套件（或任何重活）之前先看一眼机器状态。
//
// 本机 15GB 总量，可用内存掉到 3GB 以下时单次页面导航要 30 秒（正常 ~1 秒），
// 全量 E2E 必然超时 —— 而症状是「goto/reload 超时」，看起来像产品坏了。
// 本项目已经因为这个白烧掉会话里两成的回合（两次都是先追超时、最后才 free -m）。
//
// 用法：node scripts/preflight.mjs [--need-mb 3000]

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { cpus } from "node:os";

const i = process.argv.indexOf("--need-mb");
const need = i > 0 ? Number(process.argv[i + 1]) : 3000;

const mem = readFileSync("/proc/meminfo", "utf8");
const avail = Number(/MemAvailable:\s+(\d+) kB/.exec(mem)?.[1] ?? 0) / 1024;
const total = Number(/MemTotal:\s+(\d+) kB/.exec(mem)?.[1] ?? 0) / 1024;

// 历轮遗留的静态服务器会各占一份内存，且没人记得它们属于哪一轮
let stale = [];
try {
  stale = execSync(
    "ps -eo pid,rss,args | grep -E '[h]ttp\\.server|[s]erve\\.py|[h]ttp-server' || true",
    { encoding: "utf8" }
  )
    .split("\n")
    .filter(Boolean)
    .map((l) => l.trim());
} catch {}

console.log(
  `可用内存 ${avail.toFixed(0)} / ${total.toFixed(0)} MB，CPU ${cpus().length} 核`
);
if (stale.length) {
  const mb =
    stale.reduce((s, l) => s + Number(l.split(/\s+/)[1] ?? 0), 0) / 1024;
  console.log(`遗留静态服务器 ${stale.length} 个（约 ${mb.toFixed(0)} MB）：`);
  for (const l of stale) console.log("  " + l.slice(0, 110));
  console.log(
    "  清理时按端口逐个来 —— 宽泛的 `pkill http` 会误杀用户自己的预览"
  );
}
if (avail < need) {
  console.error(
    `\n✗ 可用内存 ${avail.toFixed(0)}MB < ${need}MB：浏览器套件会超时。先清上面的进程再跑。`
  );
  process.exit(1);
}
console.log(`\n✓ 预算够（要 ${need}MB）`);
