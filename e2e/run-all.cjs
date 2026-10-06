#!/usr/bin/env node
// 并行跑四个 E2E 套件（`npm run e2e:all`）。
//
// 为什么：四套件串行约 25 分钟（2026-10-05 实测 22:45→23:11），而它们彼此独立 ——
// 端口 8765/8777/8781/8861 互不冲突、pwa 写自己的 tmp 目录。并发数按**可用内存**决定：
// 本机 15GB，可用 <3GB 时单次页面导航要 30 秒（见 scripts/preflight.mjs），
// 四并发硬上只会把「慢」变成「超时」。
//
// 输出：每套件「开始 / 结束（check 数 + 耗时）」各一行；失败的套件在结尾聚合其**尾部**
// 输出（不交错四份原始输出 —— 四并发下不可读）。任一套件失败则退出码非零。
//
// 不做自动重试：flake 要看得见（本项目 flake 有前科），重试会把它藏起来。
const { spawn } = require("node:child_process");
const { readFileSync, mkdirSync, createWriteStream } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const ROOT = join(__dirname, "..");

// 与 package.json 的四条命令一一对应；expect 是基线 check 数（数守恒要能一眼看出）
const SUITES = [
  { name: "e2e", script: "e2e/e2e.cjs", expect: 245 },
  { name: "v5", script: "e2e/e2e-v5.cjs", expect: 54 },
  { name: "pwa", script: "e2e/e2e-pwa.cjs", expect: 43 },
  { name: "header", script: "e2e/verify-header.cjs", expect: 72 },
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

/** 从套件输出里抓 check 数。四种套件的收尾行格式各不相同，逐个认。 */
function parseCounts(text) {
  const t = String(text || "");
  let m = t.match(/(\d+)\s*\/\s*(\d+)\s*checks?\s*passed/i);
  if (m) return { passed: +m[1], total: +m[2] };
  m = t.match(/(\d+)\s*\/\s*(\d+)\s*通过/);
  if (m) return { passed: +m[1], total: +m[2] };
  m = t.match(/(\d+)\s*项通过/);
  if (m) return { passed: +m[1], total: +m[1] };
  m = t.match(/全部\s*(\d+)\s*个状态正常/);
  if (m) return { passed: +m[1], total: +m[1] };
  return null;
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
  eq(
    parseCounts("245/245 checks passed"),
    { passed: 245, total: 245 },
    "parseCounts e2e"
  );
  eq(parseCounts("54/54 通过"), { passed: 54, total: 54 }, "parseCounts v5");
  eq(
    parseCounts("43 项通过，0 项失败"),
    { passed: 43, total: 43 },
    "parseCounts pwa"
  );
  eq(
    parseCounts("全部 72 个状态正常（3 语言 × 3 档位 × 4 系列 × 在线/离线）"),
    { passed: 72, total: 72 },
    "parseCounts header"
  );
  eq(parseCounts("没有任何收尾行"), null, "parseCounts 认不出时返回 null");
  // 这一条是被真跑抓出来的 bug：runOne 不 spread suite 时 expect 会丢，于是每个套件
  // 都被误报「与基线不符」（实测 4/4 全过却打了 4 条 ⚠）。
  eq(
    compareCounts([{ name: "a", code: 0, counts: { passed: 54 }, expect: 54 }]),
    [],
    "compareCounts：相符不报"
  );
  eq(
    compareCounts([{ name: "b", code: 0, counts: { passed: 50 }, expect: 54 }])
      .length,
    1,
    "compareCounts：数目不符要报"
  );
  eq(
    compareCounts([{ name: "c", code: 0, counts: null, expect: 54 }]).length,
    1,
    "compareCounts：认不出 check 数要报"
  );
  eq(
    compareCounts([{ name: "d", code: 1, counts: { passed: 54 }, expect: 54 }])
      .length,
    0,
    "compareCounts：失败的套件由失败路径管，不重复报"
  );
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

/** 通过但 check 数与基线不符的套件（数守恒要能一眼看出）。 */
function compareCounts(results) {
  return results.filter(
    (r) => r.code === 0 && (!r.counts || r.counts.passed !== r.expect)
  );
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
        counts: parseCounts(out),
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
  if (!r.counts || r.counts.passed !== 245)
    failures.push("失败进程的输出仍应能解析出 check 数");
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
    `并行跑 ${suites.length} 个套件（可用内存 ${avail.toFixed(0)}MB → 并发 ${parallel}；` +
      `基线 check 数 ${suites.map((s) => `${s.name}=${s.expect}`).join(" ")}）`
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
      r.expect = suite.expect; // runOne 只回通用字段，基线要在这里带上
      results.push(r);
      const counts = r.counts ? `${r.counts.passed}/${r.counts.total}` : "?/?";
      const mark = r.code === 0 ? "✓" : "✗";
      console.log(
        `${mark} [${r.name}] ${counts} · ${fmtMs(r.ms)} · 退出码 ${r.code}`
      );
    }
  };
  const T0 = Date.now();
  await Promise.all(
    Array.from({ length: Math.min(parallel, suites.length) }, worker)
  );

  const failed = results.filter((r) => r.code !== 0);
  const mismatched = compareCounts(results);
  console.log(
    `\n汇总：${results.length - failed.length}/${results.length} 通过 · 总耗时 ${fmtMs(Date.now() - T0)}`
  );
  for (const r of mismatched) {
    console.log(
      `⚠ [${r.name}] check 数与基线不符（期望 ${r.expect}，实得 ${r.counts ? r.counts.passed : "认不出"}）`
    );
  }
  for (const r of failed) {
    console.log(`\n===== [${r.name}] 失败，尾部输出 =====`);
    console.log(tailLines(r.output, 25));
  }
  process.exit(failed.length || mismatched.length ? 1 : 0);
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
  parseCounts,
  compareCounts,
  availMemMb,
  selfTest,
  selfTestRun,
  runOne,
};
