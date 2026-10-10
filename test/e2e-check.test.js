// 共享检查记录器（`e2e/_check.cjs`）的单测 —— 第五轮扫描候选 3。
//
// 它替掉的是「四套件各写一份收尾 + runner 四条正则反解 + expect 第三份」；
// 所以这里钉：计数、收尾行、exit code、数守恒自检、失败日志、detail 截断。
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  createChecker,
  summaryLine,
  failLogPath,
} = require("../e2e/_check.cjs");

/** 收集打印行（不落真实 stdout）。 */
function makePrinter() {
  const lines = [];
  return { lines, print: (s) => lines.push(String(s)) };
}

test("收尾行格式统一：[名字] N/M 通过", () => {
  assert.equal(summaryLine("v5", 54, 54), "[v5] 54/54 通过");
  assert.equal(summaryLine("header", 71, 72), "[header] 71/72 通过");
});

test("计数与 exit code：全过 0、有失败 1", () => {
  const { print } = makePrinter();
  const c = createChecker({ name: "x", print, logFile: null });
  c.check("a", true);
  c.check("b", false, "详情");
  c.check("c", true);
  assert.equal(c.done(), 1);

  const ok = createChecker({ name: "y", print, logFile: null });
  ok.check("a", true);
  assert.equal(ok.done(), 0);
});

test("数守恒：声明 X 实得 Y → 也算失败（多了/少了都红）", () => {
  const { lines, print } = makePrinter();
  const fewer = createChecker({ name: "s", expect: 3, print, logFile: null });
  fewer.check("a", true);
  fewer.check("b", true);
  assert.equal(fewer.done(), 1, "少了要红");
  assert.ok(
    lines.at(-1).includes("⚠ 数守恒不符（声明 3 实得 2"),
    "收尾行本身要带判定：" + lines.join(" / ")
  );

  const { lines: l2, print: p2 } = makePrinter();
  const more = createChecker({
    name: "s",
    expect: 1,
    print: p2,
    logFile: null,
  });
  more.check("a", true);
  more.check("b", true);
  assert.equal(more.done(), 1, "多了也要红");
  assert.ok(
    l2.at(-1).includes("声明 1 实得 2"),
    "收尾行本身要带判定：" + l2.join(" / ")
  );
});

test("失败列表与失败日志都出声（日志写失败也不崩）", () => {
  const { lines, print } = makePrinter();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "akb-check-"));
  const logFile = path.join(dir, "fails.log");
  const c = createChecker({ name: "z", print, logFile });
  c.check("好", true);
  c.check("坏", false, "爆炸了");
  assert.equal(c.done(), 1);
  assert.ok(
    lines.some((l) => l.includes("失败 1 条")),
    "失败列表"
  );
  assert.ok(
    lines.some((l) => l.includes("坏  — 爆炸了")),
    "失败条目带 detail"
  );
  assert.match(fs.readFileSync(logFile, "utf8"), /坏  — 爆炸了/);

  // 日志路径不可写（目录不存在）也不能把失败路径杀掉
  const c2 = createChecker({
    name: "z",
    print,
    logFile: "/nonexistent-dir/x.log",
  });
  c2.check("坏", false);
  assert.equal(c2.done(), 1);
});

test("detail 截断：超长 detail 不进日志与打印", () => {
  const { lines, print } = makePrinter();
  const c = createChecker({ name: "t", print, logFile: null });
  c.check("坏", false, "x".repeat(500));
  c.done();
  const failLine = lines.find((l) => l.includes("坏"));
  assert.ok(failLine.length < 300, "打印要截断：" + failLine.length);
});

test("failLogPath 由 tmpdir 派生、每套件一份、目录存在", () => {
  const p = failLogPath("v5");
  assert.ok(p.startsWith(os.tmpdir()), "不许写死路径：" + p);
  assert.ok(
    p.endsWith("e2e-fails-v5.log"),
    "每套件一份（并行时条目可归属）：" + p
  );
  assert.ok(fs.existsSync(path.dirname(p)), "目录要被创建");
});

test("失败即时写 + 构造时清空（旧 e2e.cjs 的行为；崩在 done() 前也留痕）", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "akb-check-"));
  const logFile = path.join(dir, "fails.log");
  fs.writeFileSync(logFile, "上一轮的历史\n");
  const { print } = makePrinter();
  const c = createChecker({ name: "x", print, logFile });
  assert.equal(fs.readFileSync(logFile, "utf8"), "", "构造时清空");
  c.check("坏", false, "爆炸");
  assert.match(
    fs.readFileSync(logFile, "utf8"),
    /坏  — 爆炸/,
    "未 done 也已写"
  );
  c.done();
  // done() 不重复追加（即时写已覆盖）
  assert.equal(fs.readFileSync(logFile, "utf8").trim().split("\n").length, 1);
});

test("done() 幂等：重复调用不重复打印/写日志", () => {
  const { lines, print } = makePrinter();
  const c = createChecker({ name: "y", print, logFile: null });
  c.check("坏", false);
  const first = c.done();
  const after = lines.length;
  assert.equal(c.done(), first);
  assert.equal(lines.length, after, "第二次 done() 不再打印");
});
