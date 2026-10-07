#!/usr/bin/env node
// 并行跑四个 E2E 套件（`npm run e2e:all`）。
//
// 为什么：四套件串行约 25 分钟（2026-10-05 实测 22:45→23:11），而它们彼此独立 ——
// 端口 8765/8777/8781/8861 互不冲突、pwa 写自己的 tmp 目录。并发数按**可用内存**决定：
// 本机 15GB，可用 <3GB 时单次页面导航要 30 秒（见 scripts/preflight.mjs），
// 四并发硬上只会把「慢」变成「超时」。
//
// 输出：每套件「开始 / 结束（耗时 + 退出码）」各一行（check 数在套件自己的收尾行里，
// 见 e2e/_check.cjs）；失败的套件在结尾聚合其**尾部**输出（不交错四份原始输出 ——
// 四并发下不可读）。任一套件失败则退出码非零。
//
// 不做自动重试：flake 要看得见（本项目 flake 有前科），重试会把它藏起来。
const { spawn } = require("node:child_process");
const { readFileSync, mkdirSync, createWriteStream } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const ROOT = join(__dirname, "..");

// 与 package.json 的四条命令一一对应。**check 数守恒不在这里**（第五轮扫描候选 3）：
// 每个套件在 `runSuite({expect})` 里自报并自检 —— 数守恒由最知道自己的那一方守，
// 这里不再解析收尾行、也不存第二份基线。
// 顺序 = 启动顺序：**长的排前面**（并发数 < 套件数时，短套件排队比长套件排队省时间）。
// 实测（本机 2 并发、5 套件）：长套件排最后那次总耗时 8m54s（它排队等短套件腾位），
// 排前面两次 6m43s / 6m59s —— 跨轮对比、非交替 A/B（review-rules #2），
// 机制是排队论那一句，数字只作参考。
const SUITES = [
  { name: "e2e", script: "e2e/e2e.cjs" },
  { name: "first", script: "e2e/verify-first-screen.cjs" },
  { name: "header", script: "e2e/verify-header.cjs" },
  { name: "v5", script: "e2e/e2e-v5.cjs" },
  { name: "pwa", script: "e2e/e2e-pwa.cjs" },
];

/** 可用内存（MB）→ 并发数：≥6000 → 4；≥3000 → 2；否则串行。 */
function pickParallel(availMb) {
  if (availMb >= 6000) return 4;
  if (availMb >= 3000) return 2;
  return 1;
}

/** 输出尾部 N 行（失败聚合用）。 */
function tailLines(text, n = 25) {
  return String(text || "")
    .trimEnd()
    .split("\n")
    .slice(-n)
    .join("\n");
}

/** 可用内存（MB）—— 与 scripts/preflight.mjs 同一口径（/proc/meminfo 的 MemAvailable）。 */
function availMemMb() {
  const mem = readFileSync("/proc/meminfo", "utf8");
  return Number(/MemAvailable:\s+(\d+) kB/.exec(mem)?.[1] ?? 0) / 1024;
}

function selfTest() {
  const failures = [];
  const eq = (a, b, msg) => {
    if (JSON.stringify(a) !== JSON.stringify(b))
      failures.push(`${msg}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
  };
  eq(pickParallel(7000), 4, "pickParallel(7000)");
  eq(pickParallel(6000), 4, "pickParallel(6000)");
  eq(pickParallel(3500), 2, "pickParallel(3500)");
  eq(pickParallel(3000), 2, "pickParallel(3000)");
  eq(pickParallel(2500), 1, "pickParallel(2500)");
  eq(tailLines("a\nb\nc", 2), "b\nc", "tailLines");
  eq(tailLines("", 3), "", "tailLines 空输入");
  // parseArgs 的退化路径（retro 规则 1：坏参数最容易假绿）——此前 main 内联重写
  // 同一逻辑、parseArgs 没人调用，两轴审查抓到；现在 main 调它、自检覆盖它。
  eq(
    [
      parseArgs(["--max-parallel"]).error !== undefined,
      parseArgs(["--max-parallel", "0"]).error !== undefined,
      parseArgs(["--max-parallel", "x"]).error !== undefined,
      parseArgs(["--only"]).error !== undefined,
    ],
    [true, true, true, true],
    "parseArgs 坏参数要报错"
  );
  eq(
    [
      parseArgs(["--max-parallel", "2"]).maxParallel,
      parseArgs(["--only", "v5,pwa"]).only.has("pwa"),
      parseArgs([]).error === undefined,
      parseArgs(["--max-parallel", "3"]).only === null,
    ],
    [2, true, true, true],
    "parseArgs 正常路径"
  );
  return { ok: failures.length === 0, failures };
}

/** 解析参数：返回 {maxParallel, only, error}。校验失败给 error（调用方 exit 2）。 */
function parseArgs(argv) {
  const mi = argv.indexOf("--max-parallel");
  let maxParallel = null;
  if (mi >= 0) {
    maxParallel = Number(argv[mi + 1]);
    if (!Number.isInteger(maxParallel) || maxParallel < 1) {
      return {
        error: `--max-parallel 需要一个正整数，实得 ${JSON.stringify(argv[mi + 1])}`,
      };
    }
  }
  const oi = argv.indexOf("--only");
  let only = null;
  if (oi >= 0) {
    const val = argv[oi + 1];
    if (!val)
      return { error: "--only 需要一个逗号分隔的套件名（v5,pwa,header,e2e）" };
    only = new Set(val.split(",").map((s) => s.trim()));
  }
  return { maxParallel, only };
}

function runOne(name, args, logPath) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    // 输出**同时**进日志文件：套件卡住时直接 `tail -f` 那个文件就知道卡在哪一步
    // （只在内存里缓冲的话，卡住的套件在结束前什么都看不到 —— 正是「假死」的来源）。
    const log = logPath ? createWriteStream(logPath) : null;
    let out = "";
    const onData = (d) => {
      out += d;
      if (log) log.write(d);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("close", (code) => {
      if (log) log.end();
      resolve({
        name,
        code,
        output: out,
        ms: Date.now() - t0,
      });
    });
  });
}

/** 失败路径的自检：真起一个失败进程，验证退出码、check 数与尾部输出聚合。 */
async function selfTestRun() {
  const failures = [];
  const r = await runOne("fake", [
    "-e",
    "console.log('L1'); console.log('L2'); console.log('245/245 checks passed'); process.exit(1)",
  ]);
  if (r.code !== 1) failures.push(`失败进程的退出码应捕获为 1，实得 ${r.code}`);
  if (tailLines(r.output, 2) !== "L2\n245/245 checks passed")
    failures.push(
      "尾部输出聚合不对：" + JSON.stringify(tailLines(r.output, 2))
    );
  return { ok: failures.length === 0, failures };
}

function fmtMs(ms) {
  const s = Math.round(ms / 1000);
  return s >= 60
    ? `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`
    : `${s}s`;
}

async function main() {
  const argv = process.argv.slice(2);
  const st = selfTest();
  if (!st.ok) {
    console.error("✗ runner 自检失败（结论不可信）：" + st.failures.join("；"));
    process.exit(2);
  }
  if (argv.includes("--selftest")) {
    const rt = await selfTestRun();
    if (!rt.ok) {
      console.error("✗ 失败路径自检失败：" + rt.failures.join("；"));
      process.exit(2);
    }
    console.log("✓ 自检全过（含失败路径）");
    return;
  }
  // 参数校验走 `parseArgs`（单一出处）：缺值/非法值要**明确报错**，不能算出 NaN
  // 然后「0/0 通过、exit 0」（把「失败」记成「通过」正是最坏的假绿方向）。
  // 两轴审查抓到 main 曾内联重写同一逻辑 → 定义与行为会漂，已收回一处。
  const { maxParallel, only, error } = parseArgs(argv);
  if (error) {
    console.error(`✗ ${error}`);
    process.exit(2);
  }
  const suites = only ? SUITES.filter((s) => only.has(s.name)) : SUITES;
  if (!suites.length) {
    console.error(
      "✗ --only 没匹配到任何套件（可选：" +
        SUITES.map((s) => s.name).join(",") +
        "）"
    );
    process.exit(2);
  }

  const LOGDIR = join(tmpdir(), "akb-e2e-logs");
  mkdirSync(LOGDIR, { recursive: true });
  const avail = availMemMb();
  const parallel = maxParallel ?? pickParallel(avail);
  console.log(
    `并行跑 ${suites.length} 个套件（可用内存 ${avail.toFixed(0)}MB → 并发 ${parallel}）`
  );

  if (!suites.length) {
    console.error("✗ 一个套件都没选中 —— 不跑就等于没验证，退出码不能是 0");
    process.exit(2);
  }
  const results = [];
  let next = 0;
  const worker = async () => {
    while (next < suites.length) {
      const suite = suites[next++];
      const logPath = join(LOGDIR, `${suite.name}.log`);
      console.log(
        `▶ [${suite.name}] 开始（${fmtMs(Date.now() - T0)}）日志 ${logPath}`
      );
      const r = await runOne(suite.name, [suite.script], logPath);
      results.push(r);
      const mark = r.code === 0 ? "✓" : "✗";
      // check 数在套件自己的收尾行里（日志文件）；这里只报退出码与耗时
      console.log(`${mark} [${r.name}] · ${fmtMs(r.ms)} · 退出码 ${r.code}`);
    }
  };
  const T0 = Date.now();
  await Promise.all(
    Array.from({ length: Math.min(parallel, suites.length) }, worker)
  );

  const failed = results.filter((r) => r.code !== 0);
  console.log(
    `\n汇总：${results.length - failed.length}/${results.length} 通过 · 总耗时 ${fmtMs(Date.now() - T0)}`
  );
  for (const r of failed) {
    console.log(`\n===== [${r.name}] 失败，尾部输出 =====`);
    console.log(tailLines(r.output, 25));
  }
  process.exit(failed.length ? 1 : 0);
}

// 被 require 时（自检/复用）不执行 main
if (require.main === module) {
  main();
}

module.exports = {
  SUITES,
  parseArgs,
  pickParallel,
  tailLines,
  availMemMb,
  selfTest,
  selfTestRun,
  runOne,
};
