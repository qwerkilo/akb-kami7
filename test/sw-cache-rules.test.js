const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const rel = (f) => path.join(ROOT, f);

// 缓存分类规则是纯函数，页面与 service worker 两个全局域都能载入：
// sw.js 用 importScripts 引入，node 测试直接 require。
const RULES = require("../sw-cache-rules.js");

const req = (url, extra = {}) => ({
  method: "GET",
  mode: "no-cors",
  url,
  ...extra,
});
const loc = { origin: "https://example.test" };

test("导航请求与壳文件走 network-first（shell）", () => {
  for (const url of [
    "https://example.test/",
    "https://example.test/index.html",
    "https://example.test/style.css",
    "https://example.test/app.js",
    "https://example.test/core.js",
    "https://example.test/manifest.webmanifest",
    "https://example.test/icons/icon-192.png",
  ]) {
    // mode: navigate 一律 shell；其余靠文件名在 SHELL_NAMES 里
    const mode =
      url.endsWith("/") || url.endsWith("index.html") ? "navigate" : "no-cors";
    assert.equal(
      RULES.classify(req(url, { mode }), loc)?.kind,
      "shell",
      `${url} 应走 shell`
    );
  }
});

test("站内图片走图片桶，带 FIFO 封顶", () => {
  for (const url of [
    "https://example.test/img/full/m8393c0805d.webp",
    "https://example.test/img/thumb/m8393c0805d.webp",
  ]) {
    const plan = RULES.classify(req(url), loc);
    assert.equal(plan?.kind, "img", `${url} 应走图片桶`);
    assert.equal(plan.cap, RULES.IMG_CAP);
    assert.ok(plan.cap > 0 && plan.cap <= 1000, "图片封顶应在合理量级");
  }
});

test("跨源只收字体域，其余跨源直连不过缓存", () => {
  for (const host of RULES.FONT_HOSTS) {
    const plan = RULES.classify(req(`https://${host}/anything`), loc);
    assert.equal(plan?.kind, "font", `${host} 应走字体桶`);
    assert.equal(plan.cap, RULES.FONT_CAP);
    assert.ok(
      plan.cap > 0,
      "字体桶必须有封顶（ADR-0016 的约束，原来没有守卫）"
    );
  }
  // 黑名单（!sameOrigin 就收）会让字体桶变成杂物箱：接 CDN 或加一张外部图就中招
  for (const url of [
    "https://cdn.example/lib.js",
    "https://images.example/photo.jpg",
    "https://example.test.evil.tld/x.css",
  ]) {
    assert.equal(
      RULES.classify(req(url), loc),
      null,
      `${url} 不该进任何缓存桶`
    );
  }
});

test("其余同源杂项与非 GET 都直连", () => {
  for (const url of [
    "https://example.test/favicon-32.png",
    "https://example.test/robots.txt",
    "https://example.test/docs/spec.md",
  ]) {
    assert.equal(RULES.classify(req(url), loc), null, `${url} 不该被缓存`);
  }
  assert.equal(
    RULES.classify(req("https://example.test/app.js", { method: "POST" }), loc),
    null,
    "非 GET 不该被缓存"
  );
  assert.equal(
    RULES.classify(
      req("https://example.test/img/full/x.webp", { method: "HEAD" }),
      loc
    ),
    null,
    "HEAD 不该被缓存"
  );
});

test("CACHE_OF 的 kind→桶映射覆盖 classify 可能返回的每个 kind", () => {
  // sw.js 里 CACHE_OF[plan.kind] 缺键时会 TypeError，respondWith 从不调用 →
  // 浏览器按「无人处理」直连，**静默失去缓存**。这个耦合跨两个文件，node 能守，E2E 守不到。
  const swSrc = fs.readFileSync(rel("sw.js"), "utf8");
  const keys = new Set(
    [.../CACHE_OF\s*=\s*\{([^}]*)\}/.exec(swSrc)[1].matchAll(/(\w+)\s*:/g)].map(
      (m) => m[1]
    )
  );
  const urls = [
    ["https://example.test/", { mode: "navigate" }],
    ["https://example.test/app.js"],
    ["https://example.test/img/full/x.webp"],
    ["https://fonts.googleapis.com/css2?family=X"],
  ];
  for (const [url, extra = {}] of urls) {
    const plan = RULES.classify(req(url, extra), loc);
    assert.ok(plan, `${url} 应有分类结果`);
    if (plan.kind === "shell") continue; // 走 networkFirst，不查 CACHE_OF
    assert.ok(
      keys.has(plan.kind),
      `sw.js 的 CACHE_OF 缺 kind=${plan.kind}（${url}）`
    );
  }
});

test("SHELL_FILES 覆盖全部壳文件且都真实存在", () => {
  const listed = RULES.SHELL_FILES.filter((f) => f !== "./").map((f) =>
    f.replace(/^\.\//, "")
  );
  // 图标从 manifest 派生（不是写死三条）：manifest 声明的图标必须逐个进预缓存清单，
  // 否则装到桌面后图标 404——写死清单时「manifest 加了图标但清单没加」会全绿。
  const manifest = JSON.parse(
    fs.readFileSync(rel("manifest.webmanifest"), "utf8")
  );
  const onDisk = [
    "index.html",
    "style.css",
    "manifest.webmanifest",
    ...fs
      .readdirSync(ROOT)
      .filter((f) => f.endsWith(".js") && f !== "sw.js")
      .sort(),
    ...manifest.icons.map((i) => i.src.replace(/^\.\//, "")),
  ].sort();
  assert.deepEqual(
    [...listed].sort(),
    onDisk,
    "SHELL_FILES 与盘上壳文件不一致"
  );
  for (const f of listed) {
    assert.ok(fs.existsSync(rel(f)), `SHELL_FILES 指向不存在的文件：${f}`);
  }
});

test("路径以 / 结尾的同源请求不是壳文件（SHELL_NAMES 里不能有空串）", () => {
  // 守卫：SHELL_FILES 的 "./" 必须被过滤掉，否则 basename 为 "" 的路径
  // （如 /foo/）会被误判成壳文件、按 network-first 服务
  const names = RULES.SHELL_FILES.filter((f) => f !== "./").map((f) => f.split("/").pop());
  assert.ok(!names.includes(""), "壳文件名清单里不得有空串（./ 未被过滤）");
  for (const url of [
    "https://example.test/",
    "https://example.test/foo/",
    "https://example.test/a/b/c/",
    "https://example.test/icons/",
  ]) {
    assert.equal(
      RULES.classify(req(url), loc),
      null,
      `${url} 不是壳文件（navigate 之外的按需请求应直连）`
    );
  }
  // 导航请求仍然是壳
  assert.equal(RULES.classify(req("https://example.test/foo/", { mode: "navigate" }), loc)?.kind, "shell");
});
