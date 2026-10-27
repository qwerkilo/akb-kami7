import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { browserCheck } from "../scripts/preflight.mjs";

const fake = (exe) => () => ({ chromium: { executablePath: () => exe } });

test("浏览器检查：可执行文件在 → ok", () => {
  const dir = mkdtempSync(join(tmpdir(), "preflight-"));
  const exe = join(dir, "headless_shell");
  writeFileSync(exe, "");
  assert.deepEqual(browserCheck(fake(exe)), { ok: true, exe });
});

test("浏览器检查：可执行文件缺失 → 不 ok（重启会清掉浏览器缓存）", () => {
  const exe = join(tmpdir(), "definitely-not-here", "headless_shell");
  const r = browserCheck(fake(exe));
  assert.equal(r.ok, false);
  assert.equal(r.exe, exe);
});

test("浏览器检查：playwright 加载失败 → 不 ok 且带原因（不是静默放行）", () => {
  const r = browserCheck(() => {
    throw new Error("找不到 playwright");
  });
  assert.equal(r.ok, false);
  assert.match(r.error, /playwright/);
});
