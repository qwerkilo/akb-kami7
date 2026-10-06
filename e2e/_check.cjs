// 「记一次检查」的唯一出处（第五轮架构扫描候选 3）。
//
// 此前四个套件各写一份「检查记录 + 收尾」：四种收尾行格式（`N/M checks passed` /
// `N/M 通过` / `N 项通过，M 项失败` / `全部 N 个状态正常`），`run-all.cjs` 用四条正则
// 反解，`SUITES[].expect` 又是计数的第三份 —— 同一事实三种表示。
//
// 现在：计数、失败列表、失败日志、收尾行与 exit code 都在这里；套件只声明自己的
// `EXPECT`（数守恒由最知道自己的那一方守）。
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { elapsed } = require("./_progress.cjs");

/**
 * 失败日志路径：tmpdir 派生 + 确保目录存在（不能写死 /tmp/opencode —— CI 上没有）。
 * **每个套件一份**：并行四套件共写一个文件时条目无法归属（两轴审查）。
 */
function failLogPath(name = "all") {
  const dir = path.join(os.tmpdir(), "akb-e2e-logs");
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
  return path.join(dir, `e2e-fails-${name}.log`);
}

function summaryLine(name, passed, total) {
  return `[${name}] ${passed}/${total} 通过`;
}

/** 打印与日志里的 detail 截断长度（一处）。 */
const TRUNC = 200;

/**
 * 建一个检查记录器。返回 `{ check, done }`：
 * - `check(label, ok, detail)` 记一条（FAIL 会打印并收集 detail）；
 * - `done()` 打印失败列表 + 收尾行，追加失败日志，返回 exit code。
 *
 * `expect` 给了就做**数守恒自检**（声明 X 实得 Y → 也算失败）。
 */
function createChecker({
  name,
  expect = null,
  logFile = failLogPath(name),
  print = console.log,
} = {}) {
  // 每轮清空（第五十四轮审查的落地项）：跨轮历史混在一起时无法判断本轮失败
  try {
    fs.writeFileSync(logFile, "");
  } catch {}
  const results = [];
  const append = (line) => {
    // 失败日志是诊断，不能反过来杀死失败路径（写失败也吞）
    try {
      fs.appendFileSync(logFile, line + "\n");
    } catch {}
  };
  const check = (label, ok, detail = "") => {
    const text = String(detail ?? "");
    results.push({ label, ok: !!ok, detail: text });
    const tail = ok || !text ? "" : `  — ${text.slice(0, TRUNC)}`;
    print(`[${elapsed()}] ${ok ? "PASS" : "FAIL"}  ${label}${tail}`);
    // 失败**即时**写（旧 e2e.cjs 的行为）：套件在 done() 前崩了，这一轮失败仍留痕
    if (!ok) append(`${label}  — ${text.slice(0, TRUNC)}`);
  };
  let exitCode = 1; // done() 之前退出（崩溃）按失败算
  let finished = false;
  const done = () => {
    if (finished) return exitCode; // 幂等：重复调用不重复打印/写日志
    finished = true;
    const failed = results.filter((r) => !r.ok);
    const total = results.length;
    const passed = total - failed.length;
    const mismatch = expect !== null && total !== expect;
    if (failed.length) {
      print(`失败 ${failed.length} 条：`);
      for (const r of failed) {
        print(
          `  - ${r.label}${r.detail ? `  — ${r.detail.slice(0, TRUNC)}` : ""}`
        );
      }
    }
    if (mismatch) {
      print(
        `check 数守恒：${name} 声明 ${expect} 实得 ${total}（删/漏了检查？）`
      );
    }
    print(summaryLine(name, passed, total));
    exitCode = failed.length || mismatch ? 1 : 0;
    return exitCode;
  };
  return { check, done };
}

module.exports = { createChecker, failLogPath, summaryLine };
