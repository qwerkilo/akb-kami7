#!/usr/bin/env node
// 跑浏览器套件（或任何重活）之前先看一眼机器状态。
//
// 本机 15GB 总量，可用内存掉到 3GB 以下时单次页面导航要 30 秒（正常 ~1 秒），
// 全量 E2E 必然超时 —— 而症状是「goto/reload 超时」，看起来像产品坏了。
// 本项目已经因为这个白烧掉会话里两成的回合（两次都是先追超时、最后才 free -m）。
//
// 2026-10-27 补一维：会话/机器重启后 Playwright 的浏览器缓存可能被清空，
// E2E 会直接 0/1（Executable doesn't exist）。preflight 的职责就是「跑之前先看一眼」，
// 所以浏览器可执行文件的存在性也在这里查。
//
// 用法：node scripts/preflight.mjs [--need-mb 3000]

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { cpus } from "node:os";
import { pathToFileURL } from "node:url";
import { loadPlaywright } from "../e2e/_playwright.cjs";

/** 浏览器可执行文件在不在。注入 loader 以便测试（不真起浏览器）。 */
export function browserCheck(load = loadPlaywright) {
  try {
    const pw = load();
    const exe = pw.chromium.executablePath();
    return { ok: existsSync(exe), exe };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

function main() {
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
    console.log(
      `遗留静态服务器 ${stale.length} 个（约 ${mb.toFixed(0)} MB）：`
    );
    for (const l of stale) console.log("  " + l.slice(0, 110));
    console.log(
      "  清理时按端口逐个来 —— 宽泛的 `pkill http` 会误杀用户自己的预览"
    );
  }

  let failed = false;
  if (avail < need) {
    console.error(
      `\n✗ 可用内存 ${avail.toFixed(0)}MB < ${need}MB：浏览器套件会超时。先清上面的进程再跑。`
    );
    failed = true;
  }

  const b = browserCheck();
  if (!b.ok) {
    const why = b.exe ? `（${b.exe}）` : `：${b.error}`;
    console.error(
      `\n✗ Playwright 的 chromium 不可用${why}\n  浏览器套件会直接 0/1。用与缓存配套的版本装：` +
        "`npx playwright@<与已装浏览器配套的版本> install chromium`"
    );
    failed = true;
  }

  if (failed) process.exit(1);
  console.log(`\n✓ 预算够（要 ${need}MB），chromium 在`);
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
