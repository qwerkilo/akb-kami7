// JS 的圈复杂度（CCN）用 AST 算，不用 lizard。
//
// 为什么：lizard 1.24.0 的 JS 解析器会被正则字面量截断 —— `kanjiNumber` 里的
// `/^(.)?十(.)?$/` 让它被报成 450 行、CCN 14（实际 6 行、CCN 7）；`(expr).filter(...)`
// 形态也会截断（`drawCollage` 实际 11 被报成 6）。复杂度棘轮靠 CCN 守「只许缩小」，
// 被截断的函数会**藏住真实复杂度**（2026-10-04 质检复检发现）。
// Python 侧 lizard 解析正常，继续用它（见 complexity.mjs）。
//
// 口径（与质检复检一致）：if / 三元 / && / || / ?? / for / for-in / for-of / while /
// do-while / catch / case(非 default) 各 +1；嵌套函数独立计算，不计入外层。
import { readFileSync } from "node:fs";
import { parsers } from "prettier/plugins/babel";

const FUNCTION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
  "ObjectMethod",
  "ClassMethod",
  "ClassPrivateMethod",
]);

// 每个节点遍历时按类型 +1；不下钻进嵌套函数（它们自己计）
function countBody(node) {
  let ccn = 1;
  const walk = (n) => {
    if (!n || typeof n.type !== "string") return;
    if (FUNCTION_TYPES.has(n.type)) return; // 嵌套函数独立
    switch (n.type) {
      case "IfStatement":
      case "ConditionalExpression":
      case "ForStatement":
      case "ForInStatement":
      case "ForOfStatement":
      case "WhileStatement":
      case "DoWhileStatement":
      case "CatchClause":
        ccn += 1;
        break;
      case "LogicalExpression":
        if (n.operator === "&&" || n.operator === "||" || n.operator === "??")
          ccn += 1;
        break;
      case "SwitchCase":
        if (n.test) ccn += 1; // default 不算
        break;
      default:
        break;
    }
    for (const key of Object.keys(n)) {
      if (key === "loc" || key === "start" || key === "end") continue;
      const v = n[key];
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v.type === "string") walk(v);
    }
  };
  // 函数体入口：跳过函数自身的参数默认值？babel 的默认值在 params 里，
  // 它们属于函数体语义，计入。
  for (const key of Object.keys(node)) {
    if (["id", "key", "loc", "start", "end", "type"].includes(key)) continue;
    const v = node[key];
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v.type === "string") walk(v);
  }
  return ccn;
}

function nameOf(node, parent) {
  if (node.id && node.id.name) return node.id.name;
  if (node.key && node.key.name) return node.key.name; // 方法 / 属性
  if (node.key && node.key.value) return String(node.key.value);
  if (parent) {
    if (parent.type === "VariableDeclarator" && parent.id?.name)
      return parent.id.name;
    if (parent.type === "AssignmentExpression" && parent.left?.name)
      return parent.left.name;
    if (parent.type === "Property" && parent.key)
      return parent.key.name ?? String(parent.key.value ?? "(anonymous)");
    if (parent.type === "CallExpression") return "(anonymous)";
  }
  return "(anonymous)";
}

/** 返回 [{name, from, to, ccn}]，行号 1 起。 */
export function jsCcn(code) {
  const ast = parsers.babel.parse(code);
  const out = [];
  const visit = (node, parent) => {
    if (!node || typeof node.type !== "string") return;
    if (FUNCTION_TYPES.has(node.type)) {
      out.push({
        name: nameOf(node, parent),
        from: node.loc.start.line,
        to: node.loc.end.line,
        ccn: countBody(node),
      });
      // 继续往下找嵌套函数（它们也要进清单）
      for (const key of Object.keys(node)) {
        if (["id", "key", "loc", "start", "end", "type"].includes(key))
          continue;
        const v = node[key];
        if (Array.isArray(v)) v.forEach((c) => visit(c, node));
        else if (v && typeof v.type === "string") visit(v, node);
      }
      return;
    }
    for (const key of Object.keys(node)) {
      if (["loc", "start", "end"].includes(key)) continue;
      const v = node[key];
      if (Array.isArray(v)) v.forEach((c) => visit(c, node));
      else if (v && typeof v.type === "string") visit(v, node);
    }
  };
  visit(ast, null);
  return out;
}

/** 自检：返回 {ok, failures}。complexity.mjs 会调用它 —— 一个能整体失效还全绿的
 * 守卫比没有守卫更危险（两轴审查实测：jsCcn 直接 return [] 时棘轮仍绿）。 */
export function selfTest() {
  const failures = [];
  const cases = [
    ["function f(){}", 1],
    ["function f(a){ if(a) return 1; }", 2],
    ["function f(a){ return a ? 1 : 2; }", 2],
    ["function f(a){ return a && b || c; }", 3],
    ["function f(a){ for(;;){ while(a){ break; } } }", 3],
    ["function f(a){ try { x(); } catch(e) { y(); } }", 2],
    [
      "function f(a){ switch(a){ case 1: break; case 2: break; default: break; } }",
      3,
    ],
    ["function f(){ const g = () => { if (x) return 1; }; return 0; }", 1], // 嵌套不计入外层
    ["function f(a){ if(a){ const g = (b) => b ? 1 : 0; } }", 2],
  ];
  for (const [src, want] of cases) {
    const got = jsCcn(src)[0].ccn;
    if (got !== want)
      failures.push(`${JSON.stringify(src)} 期望 ${want} 得到 ${got}`);
  }
  // 嵌套函数要各进清单
  const nested = jsCcn("function f(){ const g = () => { if (x) return 1; }; }");
  if (nested.length !== 2 || nested[1].ccn !== 2)
    failures.push(`嵌套函数未独立列出 ${JSON.stringify(nested)}`);
  // 真实文件的回归点：lizard 会截断的两个函数
  const core = readFileSync(new URL("../core.js", import.meta.url), "utf8");
  const kn = jsCcn(core).find((f) => f.name === "kanjiNumber");
  if (!kn || kn.ccn !== 7 || kn.to - kn.from > 10)
    failures.push(`kanjiNumber 口径漂移 ${JSON.stringify(kn)}`);
  return { ok: failures.length === 0, failures };
}

// CLI：`node scripts/ccn.mjs --self-test`
if (process.argv.includes("--self-test")) {
  const r = selfTest();
  for (const f of r.failures) console.error(`✗ ${f}`);
  console.log(r.ok ? "✓ 自检全过" : `✗ ${r.failures.length} 条自检失败`);
  process.exit(r.ok ? 0 : 1);
}
