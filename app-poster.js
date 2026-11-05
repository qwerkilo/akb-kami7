// 海报画布：图片/字体加载、令牌映射、绘制、保存。
// 版式本身在 poster-*.js；本模块只负责浏览器侧装配。
(function (root, factory) {
  const api = factory;
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AKB_APP_POSTER = { create: api };
})(typeof globalThis !== "undefined" ? globalThis : this, function (deps) {
  "use strict";
  const {
    $,
    AKB_POSTER,
    getRanking,
    exportData,
    fullSrc,
    t,
    series,
    subOf,
    style,
    unveil,
  } = deps;

  const imgCache = new Map();

  function loadImg(src) {
    if (!imgCache.has(src)) {
      imgCache.set(
        src,
        new Promise((res) => {
          const im = new Image();
          im.onload = () => res(im);
          im.onerror = () => res(null);
          im.src = src;
        })
      );
    }
    return imgCache.get(src);
  }

  async function fontsReady() {
    if (!document.fonts) return;
    // 字体加载失败要吞掉：document.fonts.load() 在取不到字体时会 reject，
    // 一路冒泡会让 draw 整条断掉——断网时正是这种情况（字体子集没缓存到），
    // 结果是海报画布一直空白、用户只看到一张空图。
    const wait = Promise.all([
      document.fonts.load(`64px "Dela Gothic One"`),
      document.fonts.load(`700 40px "Zen Kaku Gothic New"`, "渡辺麻友"),
    ]).catch(() => {});
    await Promise.race([wait, new Promise((r) => setTimeout(r, 2500))]);
  }

  function tokens() {
    const d = AKB_POSTER.defaultTokens();
    const cs = getComputedStyle(document.documentElement);
    const v = (name, fallback) =>
      (cs.getPropertyValue(name) || "").replace(/\s+/g, " ").trim() || fallback;
    return {
      colors: {
        floor: v("--floor", d.colors.floor),
        card: v("--card", d.colors.card),
        ink: v("--ink", d.colors.ink),
        muted: v("--muted", d.colors.muted),
        line: v("--line", d.colors.line),
        pink: v("--pink", d.colors.pink),
        tape: v("--lemon", d.colors.tape),
        placeholder: v("--placeholder", d.colors.placeholder),
        placeholderInk: v("--placeholder-ink", d.colors.placeholderInk),
      },
      fonts: {
        ui: v("--font-ui", d.fonts.ui),
        jp: v("--font-jp", d.fonts.jp),
        name: v("--font-poster-name", v("--font-jp", d.fonts.jp)),
        display: v("--font-poster", v("--font-display", d.fonts.display)),
      },
      cardStroke: parseFloat(v("--poster-card-stroke", "3px")) || 0,
      corner: parseFloat(v("--poster-corner", "10px")),
      shadow: v("--poster-shadow", "1") !== "0",
      rankStyle: v("--poster-rank", "tape"),
    };
  }

  async function draw() {
    const ranking = getRanking();
    if (!ranking.length) return;
    const canvas = $("#poster-canvas");
    const ctx = canvas.getContext("2d");
    const [imgs] = await Promise.all([
      Promise.all(ranking.map((m) => loadImg(fullSrc(m)))),
      fontsReady(),
    ]);

    const ex = exportData();
    AKB_POSTER.draw(ctx, {
      members: ranking,
      images: imgs,
      title: ex.title,
      dateText: ex.dateText,
      hashtag: ex.hashtag,
      photoSrc: t(series() === "love" ? "photo_src_love" : "photo_src"),
      subOf,
      tokens: tokens(),
      style: style(),
    });

    try {
      // toDataURL 是同步编码（40 人实测 177–185ms，合成 282–306ms 的长任务）；
      // toBlob 把编码移出主线程，预览用 object URL。下载路径本来就是 toBlob。
      const blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) throw new Error("poster blob is null");
      const url = URL.createObjectURL(blob);
      const img = $("#poster-img");
      if (img.dataset.objUrl) URL.revokeObjectURL(img.dataset.objUrl);
      img.dataset.objUrl = url;
      img.src = url;
      unveil(); // 海报有像素了才揭幕，否则飞过去是一片空白
    } catch (err) {
      $("#poster-img").alt = t("poster_fail");
      console.error(err);
    }
  }

  function save() {
    const canvas = $("#poster-canvas");
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = exportData().fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, "image/png");
  }

  return { draw, save };
});
