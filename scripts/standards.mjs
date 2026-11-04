#!/usr/bin/env node
// 编码规范棘轮：只拦「新增/变高」的机械违规，存量登记在基线。
//
// 口径来自 docs/CODING_STANDARDS.md（阿里巴巴 Java 开发手册的可迁移部分）：
// 方法 ≤ 80 行、参数 ≤ 4 个。复杂度、格式化、no-undef 已由其他闸门守，不在这里重复。
//
// 用法：
//   npm run standards          # 对比基线，有新增/变高就非零退出
//   node scripts/standards.mjs --update    # 接受当前违规为新基线（拆分后收缩时用）
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { parsers } from "prettier/plugins/babel";
import { FUNCTION_TYPES, nameOf } from "./ccn.mjs";

const BASELINE = "docs/reviews/standards-baseline.json";
const FILES = [
  "core.js",
  "session.js",
  "app.js",
  "poster-core.js",
  "poster-layouts.js",
  "poster.js",
  "i18n.js",
  "sw.js",
  "sw-cache-rules.js",
];
const MAX_LINES = 80;
const MAX_PARAMS = 4;

function metrics(code) {
  const ast = parsers.babel.parse(code);
  const out = [];
  const visit = (node, parent) => {
    if (!node || typeof node.type !== "string") return;
    if (FUNCTION_TYPES.has(node.type)) {
      const name = nameOf(node, parent);
      if (name !== "(anonymous)") {
        out.push({
          name,
          from: node.loc.start.line,
          lines: node.loc.end.line - node.loc.start.line + 1,
          params: node.params ? node.params.length : 0,
        });
      }
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

function violations() {
  const out = {};
  for (const file of FILES) {
    const code = readFileSync(file, "utf8");
    for (const f of metrics(code)) {
      if (f.lines <= MAX_LINES && f.params <= MAX_PARAMS) continue;
      const key = `${file}::${f.name}`;
      out[key] = {
        lines: Math.max(out[key]?.lines || 0, f.lines),
        params: Math.max(out[key]?.params || 0, f.params),
        from: f.from,
      };
    }
  }
  return out;
}

function compare(current, baseline) {
  const bad = [];
  for (const [key, v] of Object.entries(current)) {
    const b = baseline[key];
    if (!b || v.lines > b.lines || v.params > b.params) {
      bad.push({ key, current: v, baseline: b || null });
    }
  }
  return bad;
}

function main() {
  const current = violations();
  if (process.argv.includes("--update")) {
    writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n");
    console.log(`✓ 已写入 ${BASELINE}（${Object.keys(current).length} 条）`);
    return 0;
  }
  const baseline = existsSync(BASELINE)
    ? JSON.parse(readFileSync(BASELINE, "utf8"))
    : {};
  const bad = compare(current, baseline);
  if (bad.length) {
    console.error("✗ 新增/变高的机械违规（方法 ≤80 行、参数 ≤4）：");
    for (const b of bad) {
      console.error(
        `  ${b.current.lines} 行 / ${b.current.params} 参数  ${b.key}（基线 ${b.baseline ? b.baseline.lines + " 行 / " + b.baseline.params + " 参数" : "无"}）`
      );
    }
    return 1;
  }
  console.log(
    `✓ 无新增机械违规（存量 ${Object.keys(baseline).length} 条，阈值 ${MAX_LINES} 行 / ${MAX_PARAMS} 参数）`
  );
  return 0;
}

process.exit(main());
