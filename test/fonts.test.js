import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import CORE from "../core.js";
import I18N from "../i18n.js";

// Dela 只画固定字符（.kami 品牌 / 安装指引标题 / 海报里的数字）。
// 用 Google Fonts 的 text= 子集把它的 CSS 从 ~112KB 压到 ~1KB；
// 代价是「漏一个字就回退 Zen」——所以这里把必需字符从品牌串派生出来逐个比对。
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const links = [
  ...new Set(
    [...html.matchAll(/https:\/\/fonts\.googleapis\.com\/css2\?[^"']+/g)].map(
      (m) => m[0]
    )
  ),
];
const dela = links.filter((u) => u.includes("family=Dela+Gothic+One"));
const rest = links.filter((u) => u.includes("family=Zen+Kaku+Gothic+New"));

function requiredChars() {
  const chars = new Set("0123456789");
  for (const lang of ["zh", "en", "ja"]) {
    const t = (key, ...args) => {
      const v = I18N[lang][key];
      return typeof v === "function" ? v(...args) : v;
    };
    for (const series of Object.keys(CORE.SERIES_KEYS)) {
      for (const size of [7, 16, 40]) {
        for (const value of Object.values(CORE.names(series, size, t))) {
          if (typeof value !== "string") continue;
          for (const ch of value) chars.add(ch);
        }
      }
    }
    for (const ch of I18N[lang].pwa_guide_title) chars.add(ch);
  }
  return [...chars];
}

test("Dela 用 text= 子集，且覆盖全部品牌/标题/数字字符", () => {
  assert.equal(dela.length, 1, "Dela 只应有一条字体链接");
  const url = new URL(dela[0]);
  const text = url.searchParams.get("text");
  assert.ok(
    text,
    "Dela 链接必须带 text= 参数（否则又回到 112KB 的全子集 CSS）"
  );
  const missing = requiredChars().filter((ch) => !text.includes(ch));
  assert.deepEqual(
    missing,
    [],
    "品牌/标题里出现了 text= 没覆盖的字符（会回退 Zen）——更新 index.html 的 text="
  );
});

test("正文字体（Zen/Nunito）绝不能带 text= 子集", () => {
  // 成员名是动态数据，text= 会让未列出的字回退系统字体（离线/海报都会退化）。
  assert.ok(rest.length >= 1, "Zen/Nunito 的字体链接不见了");
  for (const u of rest) {
    assert.equal(
      new URL(u).searchParams.get("text"),
      null,
      "正文/成员名字体不能带 text= —— 它要覆盖任意成员名"
    );
  }
});

test("Zen 不请求 500 档（首访实测 0 个 500 face 被绘制）", () => {
  assert.ok(rest.length >= 1, "Zen/Nunito 的字体链接不见了");
  for (const u of rest) {
    const weights = new URL(u).searchParams
      .getAll("family")
      .map((f) => f.replace(/ /g, "+"));
    assert.ok(
      weights.every((f) => !f.includes("Zen+Kaku+Gothic+New:wght@500")),
      "Zen 500 没有实际渲染，保留它只会多下载一份 CSS"
    );
    assert.ok(
      weights.some((f) => f.includes("Zen+Kaku+Gothic+New:wght@700;900")),
      "Zen 必须保留 700/900 两档"
    );
  }
});
