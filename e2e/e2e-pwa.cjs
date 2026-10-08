/* PWA 断网端到端验收（npm run e2e:pwa）。检查：
 * 1. SW 注册并接管；2. 断网重载应用可启动、选人、完整走完对决出海报；
 * 3. 浏览过的成员离线有照片、没浏览过的显示占位；4. 离线胶囊随网络切换；
 * 5. 安装入口（合成 beforeinstallprompt）与 iOS 指引浮层；6. 更新横幅（临时副本跑第二版 sw.js）。
 */
const { waitTicker } = require("./_progress.cjs");
const { waitFor, waitForSelector } = require("./_wait.cjs");
const { runSuite } = require("./_suite.cjs");
const { isExpectedNoise } = require("./_noise.cjs");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = require("node:path").join(__dirname, "..");
const TMP = require("node:path").join(
  require("node:os").tmpdir(),
  "akb-pwa-e2e"
);
const PORT = 8781;
const BASE = `http://127.0.0.1:${PORT}/`;

// 页面很长的滚动容器里，Playwright 的 scrollIntoView 会把元素停在视口边缘，
// 正好被 sticky 的段头盖住 → 命中不到。真实用户手动滚不会这样，所以这是脚本问题：
// 先把元素滚到视口中间再点。
async function clickCentered(page, selector) {
  // 滚窗口（不是 scrollIntoView：名册是内部滚动容器，Playwright 的
  // scrollIntoViewIfNeeded 会去滚那个容器，结果元素仍被段头压住）
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const r = el.getBoundingClientRect();
    window.scrollTo(0, r.top + window.scrollY - window.innerHeight / 2);
  }, selector);
  await page.waitForTimeout(150);
  // force：已实测元素在视口中央时 elementFromPoint 命中的就是它自己
  //（页脚安装行没有被任何 sticky 层压住），不 force 是 Playwright 自己的滚动策略问题
  await page.click(selector, { force: true });
}

// 参数顺序是 (cond, label, extra)（本套件的历史写法）—— 记录器是 (label, ok, detail)，
// 这里只做一次适配，不再自己记账（第五轮扫描候选 3）。
// 参数顺序是 (cond, label, extra)（本套件的历史写法）；执行器建好 checker 后这里只做适配。
// 就绪轮询也收进 `_suite.cjs`（此前只有本套件轮询、其余四套件盲等 1200ms）。

// 临时副本：只拷壳，img/ 用软链（85MB 不重复拷）
function buildTemp() {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  // 副本清单从 SHELL_FILES 派生（sw.js 单独处理：它会被换成第二版来触发更新流程）。
  // 手写这份清单等于第三份「哪些文件是壳」——新加一个壳文件就会漏拷，SW 直接装不上。
  const SHELL = require(
    path.join(ROOT, "sw-cache-rules.js")
  ).SHELL_FILES.filter(
    (f) => f !== "./" && f !== "sw.js" && !f.startsWith("icons/")
  );
  for (const f of [...SHELL, "favicon-32.png"]) {
    fs.copyFileSync(path.join(ROOT, f), path.join(TMP, f));
  }
  fs.cpSync(path.join(ROOT, "icons"), path.join(TMP, "icons"), {
    recursive: true,
  });
  try {
    fs.symlinkSync(path.join(ROOT, "img"), path.join(TMP, "img"));
  } catch (_) {}
  fs.writeFileSync(
    path.join(TMP, "sw.js"),
    fs.readFileSync(path.join(ROOT, "sw.js"))
  );
}

async function pickMembers(page, n) {
  for (let i = 0; i < n; i++) {
    await page.locator('.card[aria-pressed="false"]').first().click();
    await page.waitForTimeout(60);
  }
}

buildTemp(); // 临时副本（只拷壳 + img 软链）必须在起服务之前
runSuite({
  name: "pwa",
  expect: 42, // 执行器保证服务器就绪后，「静态服务器就绪」不再占一条检查（原 43）
  port: PORT,
  cwd: TMP,
  body: async ({ browser, checker }) => {
    const ok = (cond, label, extra) => checker.check(label, cond, extra);
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await ctx.newPage();
    const errs = [];
    // 钩住未处理的 Promise 拒绝：断网时它抓到过一个真 bug（字体加载失败 → 海报画不出来）
    await ctx.addInitScript(() => {
      window.__rej = [];
      window.addEventListener("unhandledrejection", (e) => {
        const r = e.reason;
        window.__rej.push(
          String((r && (r.stack || r.message)) || r).slice(0, 300)
        );
      });
    });
    page.on("console", (m) => {
      // 断网阶段的资源加载失败（ERR_FAILED / ERR_INTERNET_DISCONNECTED）与
      // "A network error occurred" 是预期噪声 —— 判定收在 e2e/_noise.cjs。
      // （此前这里注册了**两个条件逐字相同**的 console 监听，错误被记两次。）
      if (m.type() === "error" && !isExpectedNoise(m, { offline: true }))
        errs.push(m.text());
    });
    page.on("pageerror", (e) => {
      console.log(
        "   [pageerror]",
        e.message,
        "\n",
        (e.stack || "").split("\n").slice(0, 4).join("\n")
      );
      errs.push(e.message);
    });
    console.log("\n[1] SW 注册与接管");
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    const controlled = await waitFor(
      page,
      "SW 接管",
      () => navigator.serviceWorker.controller !== null,
      { timeout: 20000 }
    );
    ok(controlled, "页面已被 SW 接管（controller 非空）");
    const cached = await page.evaluate(async () => {
      const keys = await caches.keys();
      const shell = await caches.open(
        keys.find((k) => k.startsWith("akb-shell"))
      );
      return (await shell.keys()).length;
    });
    ok(cached >= 12, `壳已预缓存（${cached} 条）`);

    console.log("\n[2] 断网后完整走完 挑人 → 对决 → 出图");
    // 先等 document.fonts.ready 再量：否则在线侧可能量到 FOUT 期间的回退字体宽度，
    // 而离线侧量的是已应用的网络字体——两者差十几像素，断言变成量时序而不是量字体。
    const measureFonts = () =>
      page.evaluate(async () => {
        await document.fonts.ready;
        return {
          faces: document.fonts.size,
          h1:
            Math.round(
              document.querySelector("h1").getBoundingClientRect().width * 10
            ) / 10,
        };
      });
    let fontOnline = await measureFonts();
    console.log(`  · 在线字体首测 ${fontOnline.faces} 个 face`);
    if (fontOnline.faces === 0) {
      // 已知环境 flake（2026-10-05 实测一次）：Google Fonts 请求偶发失败 → 0 个 face。
      // 重载一次让页面重新拉字体 CSS（SW 已接管，壳从缓存来，不会动状态）。
      await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
      fontOnline = await measureFonts();
      console.log(`  · 重载后复测 ${fontOnline.faces} 个 face`);
    }
    ok(fontOnline.faces > 0, `在线时字体已加载（${fontOnline.faces} 个 face）`);
    // 在线先看几张脸（让照片进缓存），并记下没看过的卡
    await pickMembers(page, 7);
    const seenCount = await page.evaluate(
      () =>
        [...document.querySelectorAll(".card img")].filter(
          (i) => i.naturalWidth > 0
        ).length
    );
    ok(seenCount > 0, `在线时已加载 ${seenCount} 张照片`);
    // 断网前先等 img/full 预热真的落进 SW 缓存：选中成员时 warmPhotos 是异步的
    // （new Image() 在后台拉），立刻断网会把在途请求取消 → 离线海报退回占位。
    // 实测 flake 两次（取样 110 种色）；画布画完就不再重画，所以必须让**画之前**图已在缓存里
    // ——15s 轮询画布救不回来。
    const wantFull = await page.evaluate(
      () =>
        [...document.querySelectorAll('.card[aria-pressed="true"] img')].filter(
          (i) => i.src.includes("/img/thumb/")
        ).length
    );
    const cachedFull = () =>
      page.evaluate(async () => {
        let n = 0;
        for (const name of await caches.keys()) {
          if (!name.startsWith("akb-img-")) continue;
          const c = await caches.open(name);
          n += (await c.keys()).filter((r) =>
            r.url.includes("/img/full/")
          ).length;
        }
        return n;
      });
    let gotFull = 0;
    const fullTick = waitTicker("等待 img/full 预热");
    for (let i = 0; i < 60; i++) {
      gotFull = await cachedFull();
      if (gotFull >= wantFull) break;
      fullTick.tick(`${gotFull}/${wantFull}`);
      await page.waitForTimeout(500);
    }
    fullTick.done(`${gotFull}/${wantFull}`);
    console.log(`  · 断网前 img/full 预热：${gotFull}/${wantFull}`);
    // 同理等字体预热（warmFonts）：它先取 Google Fonts 的 CSS、再分批取 woff2。断网前若
    // CSS 还没进缓存，离线重载会一个 face 都注册不出来（实测 flake：离线 face 0 vs 在线 496，
    // h1 宽 85.1 vs 99）——等「CSS 已缓存 + 首批 woff2 到位」再断网。
    const fontCacheInfo = () =>
      page.evaluate(async () => {
        for (const name of await caches.keys()) {
          if (!name.startsWith("akb-font-")) continue;
          const keys = await (await caches.open(name)).keys();
          return {
            n: keys.length,
            css: keys.filter((r) => r.url.includes("fonts.googleapis.com"))
              .length,
          };
        }
        return { n: 0, css: 0 };
      });
    let gotFonts = { n: 0, css: 0 };
    const fontTick = waitTicker("等待字体预热");
    for (let i = 0; i < 60; i++) {
      gotFonts = await fontCacheInfo();
      if (gotFonts.css > 0 && gotFonts.n >= 17) break;
      fontTick.tick(`${gotFonts.n} 条`);
      await page.waitForTimeout(500);
    }
    fontTick.done(`${gotFonts.n} 条`);
    console.log(
      `  · 断网前字体缓存：${gotFonts.n} 条（其中 CSS ${gotFonts.css} 条）`
    );
    // 找一个在线时也没加载过照片的成员（换个团体搜索，切到从未浏览过的段）
    await ctx.setOffline(true);
    // 曾经在这里加 Network.clearBrowserCache，想让「断网后仍有照片」不被浏览器 HTTP
    // 缓存兜住（两轴实测：删掉图片分类分支、akb-img-v1 归零，这两条断言照样绿）。
    // 撤掉了：清了之后字体断言反而红（Latin 子集的 Nunito 离线没被应用，根因未查明，
    // 见 .scratch/deepening/18-sw-cache-rules.md 的开放问题）。改由 pwa-cache-probe.cjs
    // 单独做这项核对，不拖累主 E2E。
    await page.waitForTimeout(300);
    const chipLive = await page.evaluate(() => ({
      onLine: navigator.onLine,
      shown: !document.getElementById("pwa-chip").hidden,
    }));
    ok(
      chipLive.onLine === false && chipLive.shown,
      "断网瞬间离线胶囊出现（活文档路径）"
    );
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
    await waitForSelector(page, "断网重载后名册", ".card", {
      timeout: 15000,
      hard: true,
    });
    const boot = await page.evaluate(() => ({
      cards: document.querySelectorAll(".card").length,
    }));
    ok(boot.cards > 0, `断网后重载名册仍渲染（${boot.cards} 张卡）`);

    // 断网后现展开一个从未浏览过的段：它的图必然加载失败，靠 .ph 底色兜底（这才是
    // 「没浏览过 → 占位」的真实场景；在线时任何渲染出来的卡都会去加载图）
    const coldGrp = page.locator(".grp[data-group]").last();
    if (
      (await coldGrp.locator(".grp-head").getAttribute("aria-expanded")) ===
      "false"
    ) {
      await coldGrp.locator(".grp-head").click(); // 展开最后一个团
      await page.waitForTimeout(300);
    }
    const coldGen = coldGrp.locator(".gen-head").first();
    if (
      (await coldGen.count()) &&
      (await coldGen.getAttribute("aria-expanded")) === "false"
    ) {
      await coldGen.click(); // 再展开它的第一个期生段
    }
    await page.waitForTimeout(500);
    const cold = await page.evaluate(() => {
      const groups = [...document.querySelectorAll(".grp[data-group]")];
      const card = document.querySelector(
        ".grp[data-group]:last-of-type .card"
      );
      if (!card) return null;
      const img = card.querySelector("img");
      const r = card.getBoundingClientRect();
      return {
        name: card.textContent.trim(),
        w: img ? img.naturalWidth : -1,
        inView: r.top < window.innerHeight && r.bottom > 0,
        ph: getComputedStyle(card.querySelector(".ph") || card).backgroundColor,
      };
    });
    ok(
      !!cold && cold.w === 0,
      `没浏览过的成员断网后无图（${cold ? cold.name + " naturalWidth=" + cold.w : "无卡"}）`
    );
    ok(
      !!cold && /228, 231, 238/.test(cold.ph),
      `占位底色兜底（${cold ? cold.ph : "无"}）`
    );

    const photoSeen = await page.evaluate(() => {
      const img = [...document.querySelectorAll(".card img")].find(
        (x) => x.naturalWidth > 0
      );
      return img ? img.getAttribute("src") : null;
    });
    ok(!!photoSeen, `断网后已浏览成员仍有照片（${photoSeen || "无"}）`);
    await pickMembers(page, 7);
    await page.locator("#start-btn").click();
    // ADR-0019：开始后先过「筛选」这一步，提交才进对决
    await waitForSelector(page, "筛选相位", "#phase-screen:not([hidden])", {
      timeout: 15000,
      hard: true,
    });
    ok(
      (await page.locator(".screen-row").count()) === 7,
      "断网状态下筛选页一屏列出 7 人"
    );
    // 定值门槛：先划够一半才给提交（ADR-0019 改写版）
    let screenGuard = 0;
    while (
      (await page.locator("#screen-submit").isDisabled()) &&
      screenGuard++ < 20
    ) {
      const btn = page
        .locator('[data-cut][aria-pressed="false"]:not([disabled])')
        .first();
      if ((await btn.count()) === 0) break;
      await btn.click();
      await page.waitForTimeout(80);
    }
    await page.locator("#screen-submit").click();
    await waitForSelector(page, "对决开始", "#fighter-a, .fighter", {
      timeout: 15000,
      hard: true,
    });
    // 对决说明卡（v5：只弹一次）先关掉，否则遮罩挡住答题
    if (await page.locator("#duel-intro:not([hidden])").count()) {
      await page.locator('[data-act="intro-go"]').click();
      await page.waitForTimeout(250);
    }
    ok(await page.locator("#fighter-a").isVisible(), "断网状态下对决开始");
    const q0 = await page
      .locator("#step-duel-n")
      .textContent()
      .catch(() => null);
    let guard = 0;
    let answered = 0;
    while (guard++ < 80) {
      // 退出条件用「结果视图真的出来了」（海报画布可见 / 预览图有 src），
      // 不要用步骤条：步骤条会先于视图切换，用它会提前收工、后面的题没答完
      // 判相位，别判 canvas 的 display —— [hidden] 里的 canvas 仍是 display:block，
      // 那样会在第 0 题就误判「结果已出」而提前收工（7 档新流程有 8 题，它只答了 6）
      const resultUp = await page.evaluate(
        () => !document.getElementById("phase-result").hidden
      );
      if (resultUp) break;
      // 作答后卡片有切换动画，等下一对可见再点
      let clicked = false;
      for (const sel of ["#fighter-a", "#fighter-b"]) {
        const el = page.locator(sel);
        if ((await el.count()) && (await el.isVisible())) {
          await el.click();
          answered++;
          clicked = true;
          break;
        }
      }
      if (!clicked) break;
      await page.waitForTimeout(420);
    }
    await waitFor(
      page,
      "海报像素出现（断网前）",
      () => {
        const c = document.querySelector("canvas");
        if (!c || !c.width) return false;
        const g = c.getContext("2d");
        const d = g.getImageData(0, 0, c.width, Math.min(40, c.height)).data;
        for (let i = 0; i < d.length; i += 4)
          if (d[i] || d[i + 1] || d[i + 2]) return true;
        return false;
      },
      { timeout: 15000 }
    );
    await waitFor(
      page,
      "海报图生成",
      () => (document.getElementById("poster-img")?.src || "").length > 100,
      { timeout: 20000 }
    );
    const onResult = await page.evaluate(() => ({
      steps: document
        .querySelector('[data-step="result"]')
        ?.getAttribute("aria-current"),
      imgLen: (document.getElementById("poster-img")?.src || "").length,
      canvas: (() => {
        const c = document.querySelector("canvas");
        if (!c) return null;
        const ctx2 = c.getContext("2d");
        const d = ctx2.getImageData(0, 0, c.width, Math.min(60, c.height)).data;
        let nonEmpty = 0;
        for (let i = 0; i < d.length; i += 4)
          if (d[i] || d[i + 1] || d[i + 2]) nonEmpty++;
        return nonEmpty;
      })(),
    }));
    // 7 档划掉 3 个 → 层级 [4,3] → 上界 5+3 = 8 题（ADR-0019 改写版；旧流程是 14 题）。
    // 实际题数会浮动：mergeSort 的比较次数依赖答案（[1,2] 里 a 胜出就 1 次结束），
    // worstCase 只是上界 —— 所以只判「打完了」+「画布有内容」，不判具体题数。
    ok(
      answered >= 5 && (onResult.canvas || 0) > 100,
      `断网下把对决答完并出图（答了 ${answered} 题，q0=${q0}）`
    );
    ok(
      (onResult.canvas || 0) > 100,
      `断网下海报画布有内容（采样非空像素 ${onResult.canvas}）`
    );
    // 已知 flake（本仓记录过多次）：单次取样会在照片解码完成前读到只有底色的画布
    // （实测 110 种色）。轮询到「色彩种类 > 200」或 15s 超时，再断言最终值 ——
    // 断言的强度不变（仍要求 > 200），只是允许照片晚到。
    const sampleFace = () =>
      page.evaluate(() => {
        const c = document.querySelector("canvas");
        if (!c) return null;
        // 画布中部：7 档金字塔的第一排头像位置，看有没有照片像素（色彩种类多 = 有图）
        const g = c.getContext("2d");
        const d = g.getImageData(
          Math.round(c.width * 0.2),
          Math.round(c.height * 0.12),
          c.width,
          Math.round(c.height * 0.2)
        ).data;
        const kinds = new Set();
        for (let i = 0; i < d.length; i += 4 * 37)
          kinds.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
        return kinds.size;
      });
    let faceOffline = 0;
    const faceTick = waitTicker("等待海报脸部取样");
    for (let i = 0; i < 30; i++) {
      faceOffline = await sampleFace();
      if (faceOffline > 200) break;
      faceTick.tick(`取样 ${faceOffline}`);
      await page.waitForTimeout(500);
    }
    faceTick.done(`取样 ${faceOffline}`);
    ok(
      (faceOffline || 0) > 200,
      `断网下海报脸部区域有照片层次（取样色彩种类 ${faceOffline}）`
    );
    const fontOffline = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        faces: document.fonts.size,
        h1:
          Math.round(
            document.querySelector("h1").getBoundingClientRect().width * 10
          ) / 10,
      };
    });
    ok(
      fontOffline.faces > 0 && Math.abs(fontOffline.h1 - fontOnline.h1) < 2,
      `断网后字体未变样（face ${fontOffline.faces} vs ${fontOnline.faces}，h1 宽 ${fontOffline.h1} vs ${fontOnline.h1}）`
    );

    console.log("\n[3] 离线胶囊随网络切换");
    await ctx.setOffline(false);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 120000 });
    await waitForSelector(page, "恢复在线后页头", ".masthead", {
      timeout: 15000,
      hard: true,
    });
    await waitForSelector(
      page,
      "恢复在线后名册/结果",
      '.card, #result, [data-step="result"]',
      { timeout: 15000, hard: true }
    );
    const chipAfter = await page.evaluate(() => ({
      onLine: navigator.onLine,
      shown: !document.getElementById("pwa-chip").hidden,
    }));
    ok(chipAfter.onLine && !chipAfter.shown, "恢复网络后离线胶囊消失");

    console.log("\n[4] 安装入口与 iOS 指引（合成 beforeinstallprompt）");
    const rowBefore = await page.evaluate(() => {
      const row = document.getElementById("pwa-install");
      const btn = document.querySelector(
        '#pwa-install [data-act="pwa-install"]'
      );
      return {
        hidden: row.hidden,
        clickable: !!btn?.offsetParent,
        text: row.textContent,
      };
    });
    const rowHiddenBefore = rowBefore.hidden;
    const installClickable = rowBefore.clickable;
    const rowText = rowBefore.text;
    // 回归断言（这次修的 bug）：headless / Firefox / macOS Safari 等不触发
    // beforeinstallprompt 的环境里，入口也必须可见可点，否则用户根本装不了
    ok(
      !rowHiddenBefore && installClickable,
      `未捕获安装事件时入口仍可见可点（${(rowText || "").trim().slice(0, 40)}）`
    );
    // 按平台给指引：iPhone 4 步、桌面 Chromium 3 步「其他」、安全上下文不显示原因提示
    const guide = await page.evaluate(async () => {
      document.querySelector('#pwa-install [data-act="pwa-install"]').click();
      await new Promise((r) => setTimeout(r, 250));
      const sheet = document.getElementById("pwa-sheet");
      const out = {
        open: !sheet.hidden,
        title: sheet.querySelector("h3").textContent.trim(),
        steps: [...sheet.querySelectorAll("#pwa-guide-steps li")].map((li) =>
          li.textContent.trim()
        ),
        hintHidden: document.getElementById("pwa-sheet-hint").hidden,
      };
      document.querySelector('[data-act="pwa-ios-close"]').click();
      return out;
    });
    ok(guide.open, `没有安装事件时点「安装」落到指引浮层（${guide.title}）`);
    ok(
      guide.steps.length === 3,
      `桌面 Chromium 走「其他」指引 ${guide.steps.length} 步`
    );
    ok(guide.hintHidden, "安全上下文下不显示「装不了」提示");
    await page.evaluate(() => {
      const e = new Event("beforeinstallprompt");
      e.prompt = () => {
        window.__prompted = true;
      };
      e.userChoice = Promise.resolve({ outcome: "accepted" });
      window.dispatchEvent(e);
    });
    await page.waitForTimeout(200);
    const rowShown = await page.evaluate(
      () => !document.getElementById("pwa-install").hidden
    );
    ok(rowShown, "捕获安装事件后页脚出现安装行");
    await clickCentered(page, '[data-act="pwa-install"]');
    await page.waitForTimeout(250);
    const installedTxt = await page.evaluate(
      () => document.querySelector(".pwa-install-txt").textContent
    );
    // 页面语言随浏览器（此环境是 en），断言中英任一即可
    ok(
      /已安装|Added to your home screen/.test(installedTxt),
      `安装后该行变成已安装态（${installedTxt.trim()}）`
    );
    // iOS 路径：另开一个 iPhone UA 的上下文（iOS 不触发安装事件 → 行直接出现）
    const iosCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      isMobile: true,
      hasTouch: true,
    });
    const iosPage = await iosCtx.newPage();
    const iosErrs = [];
    iosPage.on("pageerror", (e) => iosErrs.push(e.message));
    await iosPage.goto(BASE, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await waitForSelector(
      iosPage,
      "iPhone 安装入口",
      "#pwa-install:not([hidden])",
      {
        timeout: 15000,
        hard: true,
      }
    );
    ok(true, "iPhone UA 下页脚安装行直接出现（无安装事件也有指引入口）");
    await clickCentered(iosPage, '[data-act="pwa-install"]');
    await iosPage.waitForTimeout(300);
    const sheetOpen = await iosPage.evaluate(() => ({
      open: !document.getElementById("pwa-sheet").hidden,
      scrim: !document.getElementById("pwa-scrim").hidden,
      blocked: !!document.elementFromPoint(195, 30)?.closest("#pwa-scrim"),
      steps: document.querySelectorAll(".pwa-sheet ol li").length,
    }));
    ok(sheetOpen.open, "iOS 点「安装」落到四步指引浮层");
    ok(sheetOpen.steps === 4, `指引四步齐（${sheetOpen.steps} 步）`);
    ok(sheetOpen.scrim && sheetOpen.blocked, "遮罩挡住浮层背后的点击");
    await iosPage.keyboard.press("Escape");
    await iosPage.waitForTimeout(200);
    const sheetClosed = await iosPage.evaluate(() => ({
      closed: document.getElementById("pwa-sheet").hidden,
      scrim: document.getElementById("pwa-scrim").hidden,
      focusBack: document.activeElement?.dataset?.act === "pwa-install",
    }));
    ok(sheetClosed.closed && sheetClosed.scrim, "Esc 关浮层并收遮罩");
    ok(sheetClosed.focusBack, "关闭后焦点回到触发按钮");
    ok(
      iosErrs.length === 0,
      "iOS 路径无 JS 报错",
      iosErrs.slice(0, 2).join(" | ")
    );
    console.log("\n[file:// 与照片预热] 两条来自深化㉒ 的守卫");
    // ① file:// 打开：不能注册 SW（那边注册不了、也装不了 PWA），且要给出原因提示
    const fileCtx = await browser.newContext();
    const filePage = await fileCtx.newPage();
    const fileErrs = [];
    filePage.on("pageerror", (e) => fileErrs.push(String(e)));
    await filePage.goto("file://" + path.join(TMP, "index.html"), {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    const fileState = await filePage.evaluate(async () => {
      let reg = null;
      try {
        if ("serviceWorker" in navigator)
          reg = !!(await navigator.serviceWorker.getRegistration());
      } catch (e) {
        reg = "throw";
      }
      // 原因提示在安装浮层里（#pwa-sheet-hint），要先打开浮层
      document.querySelector('#pwa-install [data-act="pwa-install"]').click();
      await new Promise((r) => setTimeout(r, 200));
      const hint = document.getElementById("pwa-sheet-hint");
      return {
        reg,
        hintShown: hint ? !hint.hidden : false,
        hintText: hint ? hint.textContent.trim() : "",
      };
    });
    // file:// 下 serviceWorker API 存在但调用会抛（那边注册不了 PWA）——「没注册成功」都算通过
    ok(
      fileState.reg !== true,
      `file:// 下没有注册 SW（实际 ${fileState.reg}）`
    );
    // 诚实说明：「file:// 下没注册 SW」这条在浏览器里**不可直接观测**——getRegistration() 本来就抛，
    // 而 app.js 的注册 promise 被 catch 住，控制台也没有报错。真正能咬住判定放宽的是
    // 下面那条原因提示：secureCtx 判错时用户看不到「为什么装不了」。（已用变异验证：换成纯
    // window.isSecureContext 就会让提示消失 → 红。）
    ok(
      fileState.hintShown && fileState.hintText.length > 0,
      `file:// 下给出「装不了也不能离线」的原因提示（${fileState.hintText.slice(0, 20)}）`
    );
    await fileCtx.close();

    // ② 选中成员要预热 img/full（海报读 full，名册只渲染 thumb）
    const warmCtx = await browser.newContext();
    const warmPage = await warmCtx.newPage();
    const fullHits = new Set();
    warmPage.on("request", (r) => {
      const m = /img\/full\/([\w-]+)\.webp/.exec(r.url());
      if (m) fullHits.add(m[1]);
    });
    await warmPage.goto(BASE, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });
    await waitForSelector(warmPage, "预热前名册", ".card", {
      timeout: 20000,
      hard: true,
    });
    await warmPage.click(".card");
    await warmPage.waitForTimeout(600);
    ok(fullHits.size > 0, `选中成员预热了 img/full（${fullHits.size} 张）`);
    await warmCtx.close();

    const guideIOS = await iosPage.evaluate(async () => {
      document.querySelector('#pwa-install [data-act="pwa-install"]').click();
      await new Promise((r) => setTimeout(r, 250));
      const sheet = document.getElementById("pwa-sheet");
      const out = {
        steps: [...sheet.querySelectorAll("#pwa-guide-steps li")].length,
        title: sheet.querySelector("h3").textContent.trim(),
      };
      document.querySelector('[data-act="pwa-ios-close"]').click();
      return out;
    });
    ok(
      guideIOS.steps === 4 && /iPhone/.test(guideIOS.title),
      `iPhone 走 4 步分享指引（${guideIOS.title}）`
    );

    // Android / macOS 两个分支此前零断言——用 UA 上下文各跑一遍（步数 + 标题）
    for (const [name, ua, wantTitle] of [
      [
        "Android",
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36",
        /Android/i,
      ],
      [
        "macOS",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
        /Mac/i,
      ],
    ]) {
      const c = await browser.newContext({
        viewport: { width: 390, height: 844 },
        userAgent: ua,
      });
      const pg = await c.newPage();
      await pg.goto("http://127.0.0.1:" + PORT + "/", {
        waitUntil: "domcontentloaded",
        timeout: 120000,
      });
      await pg.waitForTimeout(1200);
      const g = await pg.evaluate(async () => {
        document.querySelector('#pwa-install [data-act="pwa-install"]').click();
        await new Promise((r) => setTimeout(r, 250));
        const sheet = document.getElementById("pwa-sheet");
        const out = {
          title: sheet.querySelector("h3").textContent.trim(),
          steps: sheet.querySelectorAll("#pwa-guide-steps li").length,
          blank: [...sheet.querySelectorAll("#pwa-guide-steps li")].some(
            (li) => !li.textContent.trim()
          ),
          aria: sheet.getAttribute("aria-label"),
        };
        document.querySelector('[data-act="pwa-ios-close"]').click();
        return out;
      });
      ok(
        g.steps === 3 && wantTitle.test(g.title) && !g.blank,
        `${name} 走 3 步指引（${g.title}）`
      );
      ok(
        g.aria === g.title,
        `${name} 指引浮层的 aria-label 与标题一致（${g.aria}）`
      );
      await c.close();
    }
    await iosCtx.close();

    console.log("\n[5] 更新横幅（临时副本换第二版 sw.js）");
    const swPath = path.join(TMP, "sw.js");
    fs.writeFileSync(
      swPath,
      fs
        .readFileSync(swPath, "utf8")
        .replace('const VERSION = "v1"', 'const VERSION = "v2"')
    );
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
    await waitFor(
      page,
      "SW 接管",
      () => navigator.serviceWorker.controller !== null,
      { timeout: 20000, hard: true }
    );
    // 手动触发一次更新检查
    await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      await r.update();
    });
    const bannerShown = await waitFor(
      page,
      "更新横幅出现",
      () => !document.getElementById("pwa-update").hidden,
      { timeout: 20000 }
    );
    ok(bannerShown, "检测到新版本后顶部出现更新横幅（不自动 reload）");
    const stillHere = await page.evaluate(() => ({
      cards: document.querySelectorAll(".card").length,
      step:
        document.querySelector('[data-step="result"][aria-current="step"]') !=
        null,
    }));
    ok(
      stillHere.cards > 0 || stillHere.step,
      "横幅出现时当前页面未被自动刷新（DOM 还在原相位）"
    );
    // 点「刷新」→ 页面 location.reload()。等「导航完成」而不是等横幅重新出现：
    // 后者在新 SW 已经接管、文档重建的时序下不稳定（5 次里崩 2 次，还会连带跳过
    // 后面两条断言）。导航完成后横幅本来就不在。
    // 刷新 = location.reload()。别等导航事件（它在 SW 已接管的时序下不稳，5 次崩 2 次，
    // 还会连带跳过后面的断言）：给文档打一个随机戳，reload 后戳必变。
    await page.evaluate(() => {
      window.__docStamp = Math.random().toString(36);
    });
    // 横幅在文档顶部（position: static，免得盖住同样 sticky 的步骤条），
    // 页面此刻还停在之前的滚动位置 —— 先回到顶部再点。
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator('[data-act="pwa-reload"]').scrollIntoViewIfNeeded();
    // 用 evaluate 触发点击而不是 locator.click：后者会等「scheduled navigation 完成」，
    // 而 reload 恰好是 location.reload()，两者互相等（实测 5 次里 2 次 30s 超时）。
    await page.evaluate(() =>
      document.querySelector('[data-act="pwa-reload"]').click()
    );
    // 断言「文档真的换了」而不是靠选择器等页面就绪：后者在 SW 刚接管的时序下不稳，
    // 而且一旦超时会连带跳过后面两条断言（复核时 5 次里有 2 次这样）。
    const reloaded = await waitFor(
      page,
      "点刷新后新文档",
      () => window.__docStamp === undefined,
      { timeout: 30000 }
    );
    ok(reloaded, "点「刷新」后页面真的重载（新文档）");
    await waitForSelector(page, "重载后 masthead", ".masthead", {
      timeout: 20000,
    });
    const v2 = await page.evaluate(async () => {
      const keys = await caches.keys();
      return keys.filter((k) => k.includes("v2")).length;
    });
    ok(v2 > 0, `点刷新后新版 SW 生效（v2 缓存 ${v2} 个）`);

    console.log("\n[6] 无 JS 报错");
    const rej = await page.evaluate(() => window.__rej || []);
    ok(
      errs.length === 0 && rej.length === 0,
      "无 JS 报错与未处理拒绝",
      [...errs, ...rej].slice(0, 3).join(" | ")
    );
  },
});
