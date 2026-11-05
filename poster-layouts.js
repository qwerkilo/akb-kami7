// 海报版式：金字塔 / 杂志 / 榜单 / 拼贴 / 接触印相。
// 由 poster.js 注入核心原语；浏览器与 node 共用同一份版式实现。
(function (root, factory) {
  const api = factory;
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AKB_POSTER_LAYOUTS = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (core) {
  "use strict";
  const {
    defaultTokens,
    resolveTokens,
    layout,
    frame,
    cover,
    roundRect,
    fitText,
    clipText,
    tape,
    panel,
    topRoundedRect,
    photo,
    slotCard,
    tapeGeom,
    rankBase,
    editorialRank,
    editorialNumber,
    rankTape,
    labelSizes,
    slotLabel,
    slot,
    placeRow,
    podium,
    drawSeven,
    drawSixteen,
    drawPyramid,
    posterFooter,
  } = core;
  function drawClassic(ctx, T, opts, W, H) {
    const { members, images, title, dateText, hashtag, photoSrc, subOf } = opts;
    const n = members.length;

    ctx.fillStyle = T.colors.floor;
    ctx.fillRect(0, 0, W, H);

    const tall = H > 1440;
    const fr = frame(W, H);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = T.colors.ink;
    fitText(
      ctx,
      title,
      W - fr.margin * 2,
      tall ? 56 : 64,
      700,
      T.fonts.display
    );
    ctx.fillText(title, fr.margin, tall ? 100 : 118);
    tape(
      ctx,
      fr.margin,
      tall ? 116 : 136,
      Math.min(ctx.measureText(title).width * 0.72, 520),
      12,
      T.colors.pink,
      -0.012
    );
    ctx.font = `500 24px ${T.fonts.ui}`;
    ctx.fillStyle = T.colors.muted;
    ctx.fillText(dateText, fr.margin, tall ? 168 : 190);

    if (n <= 7) drawSeven(ctx, T, members, images, subOf);
    else if (n <= 16) drawSixteen(ctx, T, members, images, subOf);
    else drawPyramid(ctx, T, members, images, subOf);

    posterFooter(ctx, T, W, H, hashtag, photoSrc);
  }

  // 7 人杂志版：主视觉 > 2/3 > 4–7，而不是「一张大图 + 六张同样小的联系表」。
  function drawMagazineSeven(ctx, T, opts, W, H, heroY) {
    const { members, images, subOf } = opts;
    const fr = frame(W, H);
    const M = fr.margin;
    const hero = { x: M, y: heroY, w: 420, h: 560 };
    ctx.save();
    roundRect(ctx, hero.x, hero.y, hero.w, hero.h, 8);
    ctx.clip();
    photo(ctx, T, images[0], hero, members[0].name);
    ctx.restore();
    const capH = 84;
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = T.colors.ink;
    ctx.fillRect(hero.x, hero.y + hero.h - capH, hero.w, capH);
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.fillStyle = T.colors.tape;
    ctx.font = `400 58px ${T.fonts.display}`;
    ctx.fillText("1", hero.x + 28, hero.y + hero.h - 22);
    ctx.fillStyle = T.colors.card;
    ctx.font = `700 32px ${T.fonts.jp}`;
    ctx.fillText(
      clipText(ctx, members[0].name, hero.w - 130, 32, 700, T.fonts.jp),
      hero.x + 96,
      hero.y + hero.h - 30
    );
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.font = `500 18px ${T.fonts.ui}`;
    ctx.fillText(
      `${members[0].group} ・ ${String(subOf(members[0]) || "")}`,
      hero.x + 96,
      hero.y + hero.h - 62
    );
    ctx.restore();

    // 2/3：右侧两张中号，和 4–7 的小号拉开层级
    for (let i = 1; i <= 2; i++) {
      slot(
        ctx,
        T,
        images[i],
        members[i],
        i + 1,
        M + 460,
        heroY + (i - 1) * 340,
        400,
        280,
        false,
        true,
        subOf
      );
    }
    // 4–7：底部一行
    for (let i = 3; i < 7; i++) {
      slot(
        ctx,
        T,
        images[i],
        members[i],
        i + 1,
        M + (i - 3) * 238,
        heroY + 660,
        220,
        293,
        false,
        true,
        subOf
      );
    }
  }

  // 8–40 人杂志版：前 7 名保留 1 / 2–3 / 4–7 三层，其余进底部联系表；
  // 不再让 15/39 张缩成同一尺寸的小格子。
  function magazineHero(ctx, T, g) {
    const { members, images, hero, scale } = g;
    ctx.save();
    roundRect(ctx, hero.x, hero.y, hero.w, hero.h, 8);
    ctx.clip();
    photo(ctx, T, images[0], hero, members[0].name);
    ctx.restore();
    const capH = 64 * scale;
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = T.colors.ink;
    ctx.fillRect(hero.x, hero.y + hero.h - capH, hero.w, capH);
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.fillStyle = T.colors.tape;
    ctx.font = `400 ${Math.round(42 * scale)}px ${T.fonts.display}`;
    ctx.fillText("1", hero.x + 18, hero.y + hero.h - 18);
    ctx.fillStyle = T.colors.card;
    ctx.font = `700 ${Math.round(24 * scale)}px ${T.fonts.jp}`;
    ctx.font = `700 ${Math.round(24 * scale)}px ${T.fonts.jp}`;
    ctx.fillText(members[0].name, hero.x + 62, hero.y + hero.h - 22);
  }

  function magazineTieredRest(ctx, T, g) {
    const { members, images, subOf, M, heroY, hero, scale, fr, W, n } = g;
    const sw = 270 * scale;
    const sh = 300 * scale;
    const sx = M + hero.w + 34;
    for (let i = 1; i <= 2; i++) {
      slot(
        ctx,
        T,
        images[i],
        members[i],
        i + 1,
        sx,
        heroY + (i - 1) * (sh + 60),
        sw,
        sh,
        false,
        true,
        subOf,
        false,
        true
      );
    }
    const mw = 220 * scale;
    const mh = 250 * scale;
    const midY = Math.max(heroY + hero.h, heroY + sh * 2 + 60) + 24;
    for (let i = 3; i < 7; i++) {
      slot(
        ctx,
        T,
        images[i],
        members[i],
        i + 1,
        M + (i - 3) * (mw + 18),
        midY,
        mw,
        mh,
        false,
        true,
        subOf,
        false,
        true
      );
    }
    const restY = midY + mh + 70;
    const restN = n - 7;
    const cols = n <= 16 ? 5 : 9;
    const rows = Math.ceil(restN / cols);
    const gap = n <= 16 ? 18 : 10;
    const rw = (W - M * 2 - gap * (cols - 1)) / cols;
    const rh = Math.min(
      mh * 0.75,
      (fr.footerTop - restY - gap * (rows - 1)) / rows
    );
    for (let i = 7; i < n; i++) {
      const k = i - 7;
      slot(
        ctx,
        T,
        images[i],
        members[i],
        i + 1,
        M + (k % cols) * (rw + gap),
        restY + Math.floor(k / cols) * (rh + gap),
        rw,
        Math.max(20, rh - 56),
        false,
        true,
        subOf,
        false,
        true
      );
    }
  }

  function drawMagazineTiered(ctx, T, opts, W, H, heroY) {
    const { members, images, subOf } = opts;
    const n = members.length;
    const fr = frame(W, H);
    const M = fr.margin;
    const scale = H > 1440 ? 0.9 : 0.55;
    const hero = { x: M, y: heroY, w: 420 * scale, h: 560 * scale };
    magazineHero(ctx, T, { members, images, hero, scale });
    magazineTieredRest(ctx, T, {
      members,
      images,
      subOf,
      M,
      heroY,
      hero,
      scale,
      fr,
      W,
      n,
    });
  }

  // ---- 样式 B：杂志封面（大标题 + 冠军横图 + 联系表网格） ----
  function drawMagazine(ctx, T, opts, W, H) {
    const { members, images, title, dateText, hashtag, photoSrc, subOf } = opts;
    const n = members.length;
    const fr = frame(W, H);
    const M = fr.margin;
    const tall = H > 1440;
    ctx.fillStyle = T.colors.card;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const eyebrowY = tall ? 132 : 110;
    ctx.font = `700 24px ${T.fonts.ui}`;
    ctx.fillStyle = T.colors.muted;
    ctx.fillText(dateText, M, eyebrowY);
    const titleSize = fitText(
      ctx,
      title,
      W - M * 2,
      tall ? 120 : 96,
      900,
      T.fonts.display
    );
    ctx.fillStyle = T.colors.ink;
    ctx.fillText(title, M, eyebrowY + titleSize + 12);
    const ruleY = eyebrowY + titleSize + 44;
    ctx.fillRect(M, ruleY, W - M * 2, 3);

    const heroY = ruleY + 44;
    if (n <= 7) {
      drawMagazineSeven(ctx, T, opts, W, H, heroY);
      posterFooter(ctx, T, W, H, hashtag, photoSrc);
      return;
    }
    drawMagazineTiered(ctx, T, opts, W, H, heroY);
    posterFooter(ctx, T, W, H, hashtag, photoSrc);
  }

  // ---- 样式 C：榜单领奖台（前三放大 + 双栏紧凑榜） ----
  const MEDALS = { 1: "#e8b64c", 2: "#b9c0c9", 3: "#c98a5b" };

  // 前三样式共享的产品规则：前 7 名用品牌粉，其余用墨色（样式 a 的名次胶带自成一套）
  function rankColor(rank, T) {
    return rank <= 7 ? T.colors.pink : T.colors.ink;
  }

  function chartPodium(ctx, T, g) {
    const { members, images, pod, kx, k } = g;
    for (const p of pod) {
      if (!members[p.i]) continue;
      panel(ctx, T, p.x, p.y, p.w, p.h, 18, {
        color: "rgba(28,30,43,.16)",
        blur: 20,
        dy: 8,
      });
      const pad = 12 * k;
      ctx.save();
      roundRect(
        ctx,
        p.x + pad,
        p.y + pad,
        p.w - pad * 2,
        p.h - p.bar - pad,
        12
      );
      ctx.clip();
      photo(
        ctx,
        T,
        images[p.i],
        {
          x: p.x + pad,
          y: p.y + pad,
          w: p.w - pad * 2,
          h: p.h - p.bar - pad,
        },
        members[p.i].name
      );
      ctx.restore();
      if (T.rankStyle === "editorial") {
        editorialNumber(ctx, T, p.i + 1, p.x + 14, p.y + 10, 54 * kx);
      } else {
        ctx.beginPath();
        ctx.arc(
          p.x + p.w / 2,
          p.y + p.h - p.bar / 2 - 2 * k,
          30 * k,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = MEDALS[p.i + 1];
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `400 ${40 * kx}px ${T.fonts.display}`;
        ctx.fillText(String(p.i + 1), p.x + p.w / 2, p.y + p.h - p.bar / 2);
        ctx.textBaseline = "alphabetic";
      }
      ctx.fillStyle = T.colors.ink;
      const ns = fitText(
        ctx,
        members[p.i].name,
        p.w - 20,
        26 * k,
        700,
        T.fonts.jp
      );
      ctx.font = `700 ${ns}px ${T.fonts.jp}`;
      ctx.fillText(members[p.i].name, p.x + p.w / 2, p.y + p.h - 14 * kx);
    }
  }

  function chartFew(ctx, T, g) {
    const { members, images, n, listTop, fr, W, M, k } = g;
    const count = n - 3;
    // 余人少（7 档）：一行大字卡，与领奖台共同纵向居中分布
    const gap2 = 24;
    const cardW = Math.min(300, (W - M * 2 - gap2 * (count - 1)) / count);
    const photoH2 = cardW * 1.34;
    const cardH2 = photoH2 + 44;
    const rowW = count * cardW + (count - 1) * gap2;
    const x0 = (W - rowW) / 2;
    const y = listTop + Math.max(0, (fr.footerTop - listTop - cardH2) / 2);
    for (let i = 3; i < n; i++) {
      const k2 = i - 3;
      const x = x0 + k2 * (cardW + gap2);
      slotCard(
        ctx,
        T,
        images[i],
        members[i],
        x,
        y,
        cardW,
        cardH2,
        false,
        photoH2
      );
      if (T.rankStyle === "editorial") {
        editorialNumber(ctx, T, i + 1, x + 10, y + 8, 30);
      } else {
        ctx.textAlign = "center";
        ctx.fillStyle = rankColor(i + 1, T);
        ctx.font = `400 34px ${T.fonts.display}`;
        ctx.fillText(String(i + 1), x + 34, y + cardH2 - 14);
        ctx.textAlign = "left";
      }
      ctx.fillStyle = T.colors.ink;
      const ns2 = fitText(
        ctx,
        members[i].name,
        cardW - 74,
        24,
        700,
        T.fonts.jp
      );
      ctx.font = `700 ${ns2}px ${T.fonts.jp}`;
      ctx.fillText(members[i].name, x + 62, y + cardH2 - 16);
    }
    ctx.textAlign = "left";
  }

  function chartMany(ctx, T, g) {
    const { members, images, n, listTop, fr, W, M, k, subOf } = g;
    const count = n - 3;
    const cols = count > 30 ? 3 : 2;
    const rows = Math.max(1, Math.ceil(count / cols));
    const listH = fr.footerTop - listTop;
    const rowH = listH / rows;
    const colGap = 24;
    const colW = (W - M * 2 - colGap * (cols - 1)) / cols;
    for (let i = 3; i < n; i++) {
      const idx = i - 3;
      const col = Math.floor(idx / rows);
      const row = idx % rows;
      const x = M + col * (colW + colGap);
      const y = listTop + row * rowH;
      const th = Math.min(rowH - 8, 44 * k);
      const tw = th * 0.79;
      ctx.save();
      roundRect(ctx, x + 46 * k, y + (rowH - th) / 2, tw, th, 4);
      ctx.clip();
      photo(
        ctx,
        T,
        images[i],
        { x: x + 46 * k, y: y + (rowH - th) / 2, w: tw, h: th },
        members[i].name
      );
      ctx.restore();
      ctx.textAlign = "right";
      ctx.fillStyle = rankColor(i + 1, T);
      const rs = fitText(
        ctx,
        String(i + 1),
        40 * k,
        30 * k,
        400,
        T.fonts.display
      );
      ctx.font = `400 ${rs}px ${T.fonts.display}`;
      ctx.fillText(String(i + 1), x + 34 * k, y + rowH / 2 + 10 * k);
      const subMax = colW * 0.34;
      const sub = clipText(
        ctx,
        String(subOf(members[i]) || ""),
        subMax,
        20 * k,
        500,
        T.fonts.ui
      );
      ctx.font = `500 ${20 * k}px ${T.fonts.ui}`;
      const subW = Math.min(ctx.measureText(sub).width, subMax);
      const nameX = x + 46 * k + tw + 12 * k;
      const nameMax = Math.max(20, x + colW - subW - 12 - nameX);
      const name = clipText(
        ctx,
        members[i].name,
        nameMax,
        24 * k,
        700,
        T.fonts.jp
      );
      ctx.textAlign = "left";
      ctx.fillStyle = T.colors.ink;
      ctx.font = `700 ${24 * k}px ${T.fonts.jp}`;
      ctx.fillText(name, nameX, y + rowH / 2 + 9 * k);
      ctx.textAlign = "right";
      ctx.font = `500 ${20 * k}px ${T.fonts.ui}`;
      ctx.fillStyle = T.colors.muted;
      ctx.fillText(sub, x + colW, y + rowH / 2 + 8 * k);
    }
    ctx.textAlign = "left";
  }

  function drawChart(ctx, T, opts, W, H) {
    const { members, images, title, dateText, hashtag, photoSrc, subOf } = opts;
    const n = members.length;
    const fr = frame(W, H);
    const M = fr.margin;
    const k = H / 1440;
    ctx.fillStyle = T.colors.floor;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const ts = fitText(ctx, title, W - M * 2, 58 * k, 900, T.fonts.display);
    ctx.fillStyle = T.colors.ink;
    ctx.fillText(title, M, 108 * k);
    ctx.font = `500 24px ${T.fonts.ui}`;
    ctx.fillStyle = T.colors.muted;
    ctx.fillText(dateText, M, ts + 152 * k);
    // 领奖台横向几何按「可用宽度预算」缩放（kx），与画布高度解耦：
    // 16 档高版（H=1920）不再横向重叠，且整体保持居中
    const kx = Math.min(1.02, (W - 156) / 924);
    const wSide = 250 * kx;
    const wBig = 336 * kx;
    const gapP = 44 * kx;
    const podH = 452 * kx;
    const x2 = 78;
    const x1 = x2 + wSide + gapP;
    const pod = [
      { i: 1, x: x2, y: 340, w: wSide, h: 380 * kx, bar: 74 * kx },
      { i: 0, x: x1, y: 268, w: wBig, h: podH, bar: 92 * kx },
      {
        i: 2,
        x: x1 + wBig + gapP,
        y: 356,
        w: wSide,
        h: 364 * kx,
        bar: 74 * kx,
      },
    ];
    chartPodium(ctx, T, { members, images, pod, kx, k });
    const listTop = 268 + podH + 80;
    const count = n - 3;
    if (count <= 4) {
      chartFew(ctx, T, { members, images, n, listTop, fr, W, M, k, subOf });
    } else {
      chartMany(ctx, T, { members, images, n, listTop, fr, W, M, k, subOf });
    }
    ctx.textAlign = "left";
    posterFooter(ctx, T, W, H, hashtag, photoSrc);
  }

  // ---- 样式 D：贴纸拼贴（拍立得散落 + 胶带） ----
  function collageDots(ctx, T, W, H) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = T.colors.ink;
    for (let y = 24; y < H; y += 34) {
      for (let x = 24; x < W; x += 34) {
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // 行分布按「可用面积」重排：7 人用 3/2/2 放大拍立得（4/3 会在标题下留 270px 空白），
  // 16/32/40 各用 4/6/7 列填满高度；行间允许轻微重叠，才像一叠散落的照片。
  // 贴纸标题 + 右上角人数徽章
  function collageHeader(ctx, T, title, dateText, n, fr, W) {
    const tw = Math.min(W - 144, 480);
    ctx.save();
    ctx.translate(fr.margin, fr.margin);
    ctx.rotate(-0.05);
    panel(ctx, T, 0, 0, tw, 132, 14, {
      color: "rgba(28,30,43,.22)",
      blur: 16,
      dy: 8,
    });
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const ts = fitText(ctx, title, tw - 52, 46, 900, T.fonts.display);
    ctx.fillStyle = T.colors.ink;
    ctx.font = `900 ${ts}px ${T.fonts.display}`;
    ctx.fillText(title, 26, 62);
    ctx.font = `700 22px ${T.fonts.ui}`;
    ctx.fillStyle = T.colors.muted;
    ctx.fillText(dateText, 28, 102);
    ctx.restore();
    ctx.save();
    ctx.translate(fr.right - 170, 96);
    ctx.rotate(0.03);
    roundRect(ctx, 0, 0, 170, 54, 27);
    ctx.fillStyle = T.colors.pink;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `800 26px ${T.fonts.display}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), 85, 28);
    ctx.restore();
  }

  function collageTape(ctx, T, g) {
    ctx.save();
    ctx.translate(-g.cw / 2 + 26, -g.cardH / 2 + 4);
    ctx.rotate(-0.42);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = T.colors.tape;
    ctx.fillRect(-30, -12, 60, 24);
    ctx.restore();
  }

  // 一张拍立得卡：面板 + 照片 + 名字 + 名次角标（+ 偶尔一条胶带）
  function collageCard(ctx, T, m, image, idx, g) {
    ctx.save();
    ctx.translate(g.x + g.cw / 2, g.y + g.cardH / 2);
    ctx.rotate(g.rot);
    panel(ctx, T, -g.cw / 2, -g.cardH / 2, g.cw, g.cardH, 6, {
      color: "rgba(28,30,43,.18)",
      blur: 12,
      dy: 6,
    });
    ctx.save();
    roundRect(ctx, -g.cw / 2 + 12, -g.cardH / 2 + 12, g.cw - 24, g.photoH, 3);
    ctx.clip();
    photo(
      ctx,
      T,
      image,
      { x: -g.cw / 2 + 12, y: -g.cardH / 2 + 12, w: g.cw - 24, h: g.photoH },
      m.name
    );
    ctx.restore();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = T.colors.ink;
    const ns = fitText(
      ctx,
      m.name,
      g.cw - 56,
      Math.min(30, g.cw * 0.13),
      700,
      T.fonts.jp
    );
    ctx.font = `700 ${ns}px ${T.fonts.jp}`;
    ctx.fillText(m.name, -g.cw / 2 + 12, g.cardH / 2 - 16);
    if (T.rankStyle === "editorial" && g.cw < 150) {
      // 小卡把名次放到名字右侧，避免数字压在脸上。
      ctx.textAlign = "right";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = T.colors.pink;
      ctx.font = `700 12px ${T.fonts.ui}`;
      ctx.fillText(
        String(idx + 1).padStart(2, "0"),
        g.cw / 2 - 12,
        g.cardH / 2 - 17
      );
    } else if (T.rankStyle === "editorial") {
      editorialNumber(
        ctx,
        T,
        idx + 1,
        -g.cw / 2 + 8,
        -g.cardH / 2 + 8,
        Math.max(16, Math.min(30, g.cw * 0.2))
      );
    } else {
      ctx.beginPath();
      ctx.arc(g.cw / 2 - 30, g.cardH / 2 - 30, 17, 0, Math.PI * 2);
      ctx.fillStyle = rankColor(idx + 1, T);
      ctx.fill();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `400 22px ${T.fonts.display}`;
      ctx.fillStyle = "#fff";
      ctx.fillText(String(idx + 1), g.cw / 2 - 30, g.cardH / 2 - 29);
    }
    if (idx % 5 === 2 || idx % 7 === 3) collageTape(ctx, T, g);
    ctx.restore();
  }

  // 7 人拼贴：主视觉 > 2/3 > 4–7，三层尺寸，不再把七张拍立得平铺。
  function collageSeven(
    ctx,
    T,
    members,
    images,
    title,
    dateText,
    n,
    fr,
    hashtag,
    photoSrc
  ) {
    collageHeader(ctx, T, title, dateText, n, fr, ctx.canvas.width);
    const hero = {
      x: 72,
      y: 232,
      w: 420,
      h: 560,
      cardH: 560,
      photoH: 508,
      rot: -0.012,
    };
    collageCard(ctx, T, members[0], images[0], 0, { ...hero, cw: hero.w });
    const side = [
      { x: 516, y: 232, w: 270, h: 360, photoH: 308, rot: 0.018 },
      { x: 522, y: 616, w: 270, h: 360, photoH: 308, rot: -0.01 },
    ];
    side.forEach((g, i) =>
      collageCard(ctx, T, members[i + 1], images[i + 1], i + 1, {
        ...g,
        cw: g.w,
        cardH: g.h,
      })
    );
    const mid = { y: 960, w: 220, h: 293, photoH: 241 };
    for (let i = 3; i < 7; i++) {
      collageCard(ctx, T, members[i], images[i], i, {
        x: 72 + (i - 3) * 238,
        y: mid.y,
        cw: mid.w,
        cardH: mid.h,
        photoH: mid.photoH,
        rot: i % 2 ? 0.012 : -0.012,
      });
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    posterFooter(
      ctx,
      T,
      ctx.canvas.width,
      ctx.canvas.height,
      hashtag,
      photoSrc
    );
  }

  // 8–40 人：前 7 名保留三层（1 / 2–3 / 4–7），其余进底部网格；
  // 这样大档位也不会退回「所有卡同样大」的平铺。
  function collageFeatured(
    ctx,
    T,
    members,
    images,
    title,
    dateText,
    n,
    fr,
    hashtag,
    photoSrc
  ) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    collageHeader(ctx, T, title, dateText, n, fr, W);
    const scale = H > 1440 ? 0.9 : 0.55;
    const hero = { x: 72, y: 232, w: 420 * scale, h: 560 * scale };
    collageCard(ctx, T, members[0], images[0], 0, {
      ...hero,
      cw: hero.w,
      cardH: hero.h,
      photoH: hero.h - 52,
      rot: -0.012,
    });
    const sw = 270 * scale;
    const sh = 360 * scale;
    [232, 232 + sh + 20].forEach((y, i) =>
      collageCard(ctx, T, members[i + 1], images[i + 1], i + 1, {
        x: 516,
        y,
        cw: sw,
        cardH: sh,
        photoH: sh - 52,
        rot: i ? -0.012 : 0.015,
      })
    );
    const mw = 220 * scale;
    const mh = 293 * scale;
    const midY = Math.max(hero.y + hero.h, 232 + sh * 2 + 20) + 16;
    for (let i = 3; i < 7; i++) {
      collageCard(ctx, T, members[i], images[i], i, {
        x: 72 + (i - 3) * (mw + 18),
        y: midY,
        cw: mw,
        cardH: mh,
        photoH: mh - 52,
        rot: i % 2 ? 0.012 : -0.012,
      });
    }
    const restY = midY + mh + 24;
    const restN = n - 7;
    const cols = n <= 16 ? 5 : 9;
    const rows = Math.ceil(restN / cols);
    const gap = n <= 16 ? 18 : 10;
    const rw = (W - 144 - gap * (cols - 1)) / cols;
    const rh = Math.min(
      mh * 0.75,
      (fr.footerTop - restY - gap * (rows - 1)) / rows
    );
    for (let i = 7; i < n; i++) {
      const k = i - 7;
      collageCard(ctx, T, members[i], images[i], i, {
        x: 72 + (k % cols) * (rw + gap),
        y: restY + Math.floor(k / cols) * (rh + gap),
        cw: rw,
        cardH: rh,
        photoH: Math.max(20, rh - 52),
        rot: 0,
      });
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    posterFooter(ctx, T, W, H, hashtag, photoSrc);
  }

  function drawCollage(ctx, T, opts, W, H) {
    const { members, images, title, dateText, hashtag, photoSrc } = opts;
    const n = members.length;
    const fr = frame(W, H);
    ctx.fillStyle = T.colors.floor;
    ctx.fillRect(0, 0, W, H);
    collageDots(ctx, T, W, H);
    if (n <= 7) {
      collageSeven(
        ctx,
        T,
        members,
        images,
        title,
        dateText,
        n,
        fr,
        hashtag,
        photoSrc
      );
      return;
    }
    collageFeatured(
      ctx,
      T,
      members,
      images,
      title,
      dateText,
      n,
      fr,
      hashtag,
      photoSrc
    );
  }

  // 接触印相：暗房工作台 —— 黑场、胶片齿孔；行分布由 contactRows 决定。
  // 卡片是白边印相纸，冠军圈用 T.colors.pink；它是唯一不跟皮肤底色走的样式（暗房即约束）。
  function contactRows(n) {
    if (n === 7) return [3, 2, 2];
    if (n === 16) return [4, 4, 4, 4];
    return [6, 6, 6, 6, 6, 6, 4];
  }

  function filmHoles(ctx, W, H) {
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.22)";
    for (let y = 42; y < H - 28; y += 46) {
      roundRect(ctx, 20, y, 12, 8, 2);
      ctx.fill();
      roundRect(ctx, W - 32, y, 12, 8, 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function contactCard(ctx, T, im, m, rank, x, y, w, h, subOf) {
    const labelH = Math.max(34, Math.min(76, h * 0.2));
    panel(ctx, T, x, y, w, h, Math.min(3, T.corner), {
      stroke: T.cardStroke,
    });
    ctx.save();
    roundRect(ctx, x + 3, y + 3, w - 6, h - labelH - 3, 2);
    ctx.clip();
    photo(ctx, T, im, { x, y, w, h: h - labelH }, m.name);
    ctx.restore();

    // 名次：左上角；冠军用白蜡笔圈（不是贴纸、不是色块）
    const numSize = Math.max(16, Math.min(30, w * 0.18));
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `700 ${numSize}px ${T.fonts.ui}`;
    const label = String(rank).padStart(2, "0");
    const tx = x + 8;
    const ty = y + 8;
    ctx.fillStyle = rank === 1 ? T.colors.pink : T.colors.ink;
    ctx.fillText(label, tx, ty);
    if (rank === 1) {
      ctx.strokeStyle = T.colors.pink;
      ctx.lineWidth = Math.max(2, numSize * 0.14);
      ctx.beginPath();
      ctx.arc(
        tx + numSize * 0.72,
        ty + numSize * 0.72,
        numSize * 0.62,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
    ctx.restore();

    // 姓名 + 期生/年份；卡片下沿留白像印相纸的手写栏
    const nameSize = Math.max(12, Math.min(20, w * 0.09));
    const sub = String(subOf(m) || "");
    ctx.save();
    ctx.fillStyle = T.colors.ink;
    ctx.font = `700 ${nameSize}px ${T.fonts.name || T.fonts.jp}`;
    ctx.fillText(
      clipText(ctx, m.name, w - 12, nameSize, 700, T.fonts.name || T.fonts.jp),
      x + 6,
      y + h - labelH + 5
    );
    if (labelH >= 46) {
      ctx.fillStyle = T.colors.muted;
      ctx.font = `500 ${Math.max(9, nameSize - 4)}px ${T.fonts.ui}`;
      ctx.fillText(
        clipText(ctx, sub, w - 12, nameSize - 4, 500, T.fonts.ui),
        x + 6,
        y + h - labelH + 5 + nameSize + 4
      );
    }
    ctx.restore();
  }

  function drawContact(ctx, T, opts, W, H) {
    const { members, images, title, dateText, hashtag, photoSrc, subOf } = opts;
    const n = members.length;
    const fr = frame(W, H);
    ctx.fillStyle = "#101012";
    ctx.fillRect(0, 0, W, H);
    filmHoles(ctx, W, H);

    ctx.save();
    ctx.fillStyle = "#ffffff";
    const titleSize = fitText(ctx, title, W - 220, 74, 700, T.fonts.display);
    ctx.font = `700 ${titleSize}px ${T.fonts.display}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(title, 76, 86);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = T.colors.pink;
    ctx.font = `700 16px ${T.fonts.ui}`;
    ctx.fillText("CONTACT SHEET", 78, 162);
    ctx.fillStyle = "rgba(255,255,255,.58)";
    ctx.font = `500 14px ${T.fonts.ui}`;
    ctx.fillText(dateText, 78, 186);
    ctx.textAlign = "right";
    ctx.fillText(
      `ROLL ${String(n).padStart(2, "0")} / FRAME 01–${String(n).padStart(2, "0")}`,
      W - 78,
      162
    );
    ctx.restore();

    const rows = contactRows(n);
    const maxCols = Math.max(...rows);
    const gap = n === 40 ? 10 : 18;
    const top = 222;
    const bottom = fr.footerTop - 20;
    const rowH = (bottom - top - gap * (rows.length - 1)) / rows.length;
    const cardW = Math.min(
      (W - 156 - gap * (maxCols - 1)) / maxCols,
      rowH * 0.72
    );
    const cardH = Math.min(rowH, cardW * 1.42);
    let idx = 0;
    rows.forEach((count, r) => {
      const total = count * cardW + (count - 1) * gap;
      const x0 = (W - total) / 2;
      const y = top + r * (rowH + gap);
      for (let c = 0; c < count && idx < n; c++, idx++) {
        contactCard(
          ctx,
          T,
          images[idx],
          members[idx],
          idx + 1,
          x0 + c * (cardW + gap),
          y,
          cardW,
          cardH,
          subOf
        );
      }
    });

    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,.52)";
    ctx.font = `500 14px ${T.fonts.ui}`;
    ctx.fillText(`${photoSrc}  ·  ${hashtag}`, 78, H - 36);
    ctx.restore();
  }

  const STYLES = ["a", "b", "c", "d", "e"];

  function draw(ctx, opts) {
    const T = resolveTokens(opts.tokens);
    const size = layout(opts.members.length);
    ctx.canvas.width = size.width;
    ctx.canvas.height = size.height;
    const fn =
      opts.style === "b"
        ? drawMagazine
        : opts.style === "c"
          ? drawChart
          : opts.style === "d"
            ? drawCollage
            : opts.style === "e"
              ? drawContact
              : drawClassic;
    fn(ctx, T, opts, size.width, size.height);
  }
  return { draw, styles: STYLES };
});
