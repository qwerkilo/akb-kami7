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

function shellFiles() {
  const src = fs.readFileSync(rel("sw.js"), "utf8");
  const m = src.match(/SHELL_FILES\s*=\s*\[([\s\S]*?)\]/);
  assert.ok(m, "sw.js 里找不到 SHELL_FILES");
  return Array.from(m[1].matchAll(/["']([^"']+)["']/g)).map((x) => x[1]);
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

test("apple-touch-icon 与 favicon 存在", () => {
  assert.ok(
    fs.existsSync(rel("icons/apple-touch-icon.png")),
    "缺 apple-touch-icon"
  );
  assert.ok(fs.existsSync(rel("favicon-32.png")), "缺 favicon");
});

test("sw.js 的 SHELL_FILES 与盘上壳文件双向一致", () => {
  const listed = shellFiles()
    .filter((f) => f !== "./" && f !== "/")
    .map((f) => f.replace(/^\.\//, ""));
  // 盘上应当预缓存的：页面、样式、根目录全部脚本、manifest、manifest 引用的图标
  const onDisk = [
    "index.html",
    "style.css",
    "manifest.webmanifest",
    ...fs
      .readdirSync(ROOT)
      .filter((f) => f.endsWith(".js") && f !== "sw.js")
      .sort(),
    ...manifest().icons.map((i) => i.src.replace(/^\.\//, "")),
  ].sort();
  // favicon 由浏览器按需取，不进预缓存清单（不参与 shell 启动）
  assert.deepEqual(
    [...listed].sort(),
    onDisk,
    "SHELL_FILES 与盘上文件不一致：新增/删除壳文件后必须同步 sw.js"
  );
  for (const f of listed) {
    assert.ok(fs.existsSync(rel(f)), `SHELL_FILES 指向不存在的文件：${f}`);
  }
});

test("sw.js 语法可编译，且图片封顶与消息协议在位", () => {
  const src = fs.readFileSync(rel("sw.js"), "utf8");
  assert.doesNotThrow(() => new Function(src), "sw.js 不能编译");
  const cap = src.match(/IMG_CAP\s*=\s*(\d+)/);
  assert.ok(cap && Number(cap[1]) > 0, "sw.js 缺图片封顶条数");
  assert.ok(
    src.includes("skipWaiting"),
    "sw.js 缺 skipWaiting（更新横幅要靠它）"
  );
  assert.ok(src.includes("skip-waiting"), "sw.js 未处理 skip-waiting 消息");
  assert.ok(
    /mode\s*===\s*["']navigate["']/.test(src),
    "sw.js 缺导航请求的 network-first 分支"
  );
});
