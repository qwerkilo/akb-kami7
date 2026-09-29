const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const rel = (p) => path.join(ROOT, p);

// PNG 尺寸：只读 IHDR，不引第三方依赖
function pngSize(p) {
  const b = fs.readFileSync(p);
  assert.equal(b.slice(1, 4).toString("ascii"), "PNG", `${p} 不是 PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function manifest() {
  return JSON.parse(fs.readFileSync(rel("manifest.webmanifest"), "utf8"));
}

test("manifest 关键字段齐备且面向独立窗口", () => {
  const m = manifest();
  for (const k of [
    "name",
    "short_name",
    "start_url",
    "scope",
    "display",
    "theme_color",
    "background_color",
    "icons",
  ]) {
    assert.ok(m[k], `manifest 缺字段 ${k}`);
  }
  assert.equal(m.display, "standalone");
  assert.equal(
    m.start_url,
    "./",
    "start_url 应用相对路径（GitHub Pages 子路径）"
  );
  assert.equal(m.scope, "./");
  assert.ok(
    Array.isArray(m.icons) && m.icons.length >= 2,
    "至少要 192 与 512 两档图标"
  );
  assert.ok(
    m.icons.some((i) => String(i.purpose || "").includes("maskable")),
    "缺 maskable 图标（Android 自适应图标会裁掉边缘）"
  );
});

test("manifest 声明的图标都在盘上，像素尺寸与声明一致", () => {
  for (const i of manifest().icons) {
    const p = rel(i.src);
    assert.ok(fs.existsSync(p), `图标缺失：${i.src}`);
    const size = pngSize(p);
    const want = String(i.sizes).split("x").map(Number);
    assert.deepEqual(
      [size.w, size.h],
      want,
      `${i.src} 实际像素与声明 ${i.sizes} 不符`
    );
  }
});

test("apple-touch-icon 与 favicon 存在且尺寸正确", () => {
  // iOS 对 apple-touch-icon 有尺寸要求，所以这两个也要钉住（不在 manifest.icons 里，
  // 上面那例覆盖不到）
  for (const [f, n] of [
    ["icons/apple-touch-icon.png", 180],
    ["favicon-32.png", 32],
  ]) {
    const p = rel(f);
    assert.ok(fs.existsSync(p), `缺 ${f}`);
    const size = pngSize(p);
    assert.deepEqual([size.w, size.h], [n, n], `${f} 尺寸应为 ${n}x${n}`);
  }
});

test("sw.js 可编译，且在 install 期就 skipWaiting（页面只决定何时刷新）", () => {
  const src = fs.readFileSync(rel("sw.js"), "utf8");
  assert.doesNotThrow(() => new Function(src), "sw.js 不能编译");
  // 位置比存在更重要：原来只断言全文含 "skipWaiting"，被 install 里的调用满足，
  // 而那条没人发的 message 死协议也算「有」——断言守错了地方。
  const install = /addEventListener\(\s*["']install["'][\s\S]*?\n\}\);/.exec(
    src
  );
  assert.ok(install, "sw.js 找不到 install 监听器");
  assert.ok(
    /self\.skipWaiting\(\)/.test(install[0]),
    "install 段里没有 self.skipWaiting()：新版本无法立即激活"
  );
  assert.ok(
    !/skip-waiting/.test(src),
    "sw.js 仍有那条没人发的 skip-waiting 死协议（本项目不依赖它）"
  );
});
