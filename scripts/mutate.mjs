#!/usr/bin/env node
// 变异验证：把「这条守卫真的会红吗」从手工活变成一条命令。
//
// 为什么需要它（本项目反复踩过的坑，全部源于手搓这个脚本）：
//   ① 变异没真的打上（锚点没命中 / Prettier 重排过）→「变异存活」与「没应用」结果完全一样；
//   ② 判据数错（在 TAP 输出里数字面量 "^not ok"，而 TAP 里没有 ^）→ 全报存活；
//   ③ 还原时存的是「上一次变异」而不是原始文件 → 变异留在工作区里；
//   ④ 忘了还原 → 下一个测试在脏文件上跑，结论互相污染。
//
// 用法：
//   node scripts/mutate.mjs --mutate <文件> <旧文本> <新文本> [--mutate ...] [--dry-run] -- <测试命令...>
//   例：node scripts/mutate.mjs \
//         --mutate style.css "gap: 5px" "gap: 8px" \
//         --mutate core.js "const SCREEN_STOP = 4" "const SCREEN_STOP = 9" \
//         -- node --test test/style-artifact.test.js test/core.test.js
//
// 语义：
//   * 每个变异单独跑一次测试命令，**跑完立刻还原**（变异之间不叠加）；
//   * 「变异被杀」= 该次测试命令退出码非 0；
//   * 全部变异被杀 → 退出码 0；只要有一个存活 → 退出码 1 并逐条列出；
//   * 任何异常路径（Ctrl-C、被杀、测试命令抛错）都会先还原再退出。
//
// 退出码：0 全被杀 / 1 有存活或用法错 / 2 锚点没命中或文件没真变（视为工具失败，不当成存活）

import { spawnSync } from "node:child_process";
import {
  readFileSync,
  writeFileSync,
  copyFileSync,
  mkdtempSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const argv = process.argv.slice(2);
const mutations = [];
let dryRun = false;
let testCmd = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--mutate")
    (mutations.push({ file: argv[i + 1], from: argv[i + 2], to: argv[i + 3] }),
      (i += 3));
  else if (a === "--dry-run") dryRun = true;
  else if (a === "--") ((testCmd = argv.slice(i + 1)), (i = argv.length));
}
if (!mutations.length || !testCmd.length) {
  console.error(
    "用法：node scripts/mutate.mjs --mutate <文件> <旧> <新> [--mutate ...] [--dry-run] -- <测试命令>"
  );
  process.exit(1);
}

const backups = new Map();
let restored = false;
function restoreAll() {
  if (restored) return;
  restored = true;
  for (const [file, bytes] of backups) {
    try {
      writeFileSync(file, bytes);
    } catch (e) {
      console.error(`!! 还原失败 ${file}：${e.message}`);
    }
  }
}
for (const sig of ["SIGINT", "SIGTERM", "exit"])
  process.on(sig, () => {
    if (sig !== "exit") restoreAll();
  });
process.on("uncaughtException", (e) => {
  restoreAll();
  console.error(e);
  process.exit(2);
});

// 快照原始内容（内存），并在磁盘留一份独立副本 —— 两者都要，用来抓「还原写错文件」
for (const m of mutations) {
  // 每个变异都要拿到自己的备份路径（同一文件可能出现多次），但原始内容只存一份
  if (!backups.has(m.file)) backups.set(m.file, readFileSync(m.file));
  const tmp = join(mkdtempSync(join(tmpdir(), "mutate-")), "orig");
  copyFileSync(m.file, tmp);
  m.__backup = tmp;
}

const results = [];
let toolFailed = false;

for (const [idx, m] of mutations.entries()) {
  const name = m.__name || `变异 #${idx + 1}（${m.file}）`;
  const original = backups.get(m.file);
  const hits = original.toString("utf8").split(m.from).length - 1;
  if (hits !== 1) {
    console.error(
      `✗ ${name}：锚点在 ${m.file} 里命中 ${hits} 次（必须恰好 1 次）`
    );
    toolFailed = true;
    continue;
  }
  const mutated = original.toString("utf8").replace(m.from, m.to);
  writeFileSync(m.file, mutated);
  // 「文件真的变了」自检：锚点命中不等于内容变了（例如 from === to）
  const onDisk = readFileSync(m.file, "utf8");
  if (onDisk === original.toString("utf8")) {
    console.error(`✗ ${name}：写入后内容与原始相同 —— 变异等于没打上`);
    (restoreAll(), writeFileSync(m.file, original));
    toolFailed = true;
    continue;
  }
  if (dryRun) {
    console.log(`· ${name}：锚点命中且已写入（--dry-run，未跑测试）`);
    writeFileSync(m.file, original);
    continue;
  }
  const r = spawnSync(testCmd[0], testCmd.slice(1), {
    stdio: "pipe",
    encoding: "utf8",
  });
  // 立刻还原，并用磁盘那份独立副本交叉核对还原是否忠实
  writeFileSync(m.file, original);
  const after = readFileSync(m.file);
  const ref = readFileSync(m.__backup);
  const restoreOk = after.equals(ref);
  const killed = r.status !== 0;
  results.push({ name, killed, restoreOk, status: r.status });
  console.log(
    `${killed ? "✓ 被杀" : "✗ 存活"}  ${name}  (测试退出码 ${r.status}${restoreOk ? "" : " ⚠ 还原后与快照不一致"})`
  );
  if (!restoreOk) toolFailed = true;
}

restoreAll();

const survived = results.filter((r) => !r.killed);
if (toolFailed) {
  console.error("\n工具自身失败（锚点/写入/还原），以上结论不可信 —— 退出码 2");
  process.exit(2);
}
console.log(
  `\n${results.length - survived.length}/${results.length} 个变异被杀${survived.length ? "，存活：" + survived.map((r) => r.name).join("、") : ""}`
);
process.exit(survived.length ? 1 : 0);
