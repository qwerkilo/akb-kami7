const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const I18N = require("../i18n.js");
const root = path.join(__dirname, "..");

test("zh/en 键集合一致（en 允许额外的 leave_* 直译）", () => {
  const zh = Object.keys(I18N.zh).sort();
  const en = Object.keys(I18N.en).sort();
  const extra = en.filter((k) => !zh.includes(k));
  assert.deepEqual(
    extra.filter((k) => !k.startsWith("leave_")),
    []
  );
  assert.deepEqual(
    zh.filter((k) => !en.includes(k)),
    []
  );
});

test("index.html 引用的 i18n 键都存在", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const keys = new Set();
  for (const m of html.matchAll(/data-i18n(?:-placeholder|-alt)?="([^"]+)"/g)) {
    keys.add(m[1]);
  }
  assert.ok(keys.size > 0);
  for (const key of keys) {
    assert.ok(I18N.zh[key] != null, `zh 缺: ${key}`);
    assert.ok(I18N.en[key] != null, `en 缺: ${key}`);
  }
});

test("app.js 中静态引用的文案键都存在", () => {
  const src = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const keys = new Set(
    [...src.matchAll(/\bt\("([A-Za-z0-9_]+)"(?!\s*\+)/g)].map((m) => m[1])
  );
  assert.ok(keys.size > 0);
  for (const key of keys) {
    assert.ok(I18N.zh[key] != null, `zh 缺: ${key}`);
    assert.ok(I18N.en[key] != null, `en 缺: ${key}`);
  }
});
