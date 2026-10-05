// 海报绘制 module（无 DOM 依赖，canvas ctx 由调用方注入；node:test 用假 ctx 验证布局与字幕）
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AKB_POSTER = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function defaultTokens() {
    const ui =
      '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif';
    const jp =
      '"Zen Kaku Gothic New","Hiragino Sans","Yu Gothic","Meiryo",' + ui;
    return {
      colors: {
        floor: "#f5f1e6",
        card: "#ffffff",
        ink: "#20242e",
        muted: "#6f6a60",
        line: "#cfc7b8",
        pink: "#e4007f",
        tape: "#ffe08a",
        placeholder: "#e4e7ee",
        placeholderInk: "#7e8390",
      },
      fonts: { ui, jp, display: '"Dela Gothic One",' + jp },
      cardStroke: 3,
    };
  }

  function resolveTokens(tokens) {
    const d = defaultTokens();
    if (!tokens) return d;
    return {
      colors: { ...d.colors, ...(tokens.colors || {}) },
      fonts: { ...d.fonts, ...(tokens.fonts || {}) },
      cardStroke:
        typeof tokens.cardStroke === "number"
          ? tokens.cardStroke
          : d.cardStroke,
    };
  }

  function layout(count) {
    return { width: 1080, height: count > 7 && count <= 16 ? 1920 : 1440 };
  }

  // 页框：左右边距与页脚基线（内容不得越过的界线）的单一出处
  function frame(W, H) {
    return { margin: 72, right: W - 72, footerTop: H - 84 };
  }

  function cover(ctx, im, x, y, w, h) {
    const s = Math.max(w / im.width, h / im.height);
    const sw = w / s,
      sh = h / s;
    const sx = (im.width - sw) / 2;
    const sy = Math.max(0, Math.min(im.height - sh, (im.height - sh) * 0.28));
    ctx.drawImage(im, sx, sy, sw, sh, x, y, w, h);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fitText(ctx, text, maxW, size, weight, family) {
    let s = size;
    do {
      ctx.font = `${weight} ${s}px ${family}`;
      if (ctx.measureText(text).width <= maxW) break;
      s -= 2;
    } while (s > 12);
    return s;
  }

  function clipText(ctx, text, maxW, size, weight, family) {
    const s = fitText(ctx, text, maxW, size, weight, family);
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= maxW) return text;
    let out = text;
    while (out.length > 1 && ctx.measureText(out + "…").width > maxW)
      out = out.slice(0, -1);
    return out + "…";
  }

  function tape(ctx, x, y, w, h, color, angle) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
  }

  // 卡片面板：阴影 + 底 + 描边（cardStroke 语义单点；阴影参数由各样式传入）
  function panel(ctx, T, x, y, w, h, r, opts) {
    const o = opts || {};
    ctx.save();
    if (o.color) {
      ctx.shadowColor = o.color;
      ctx.shadowBlur = o.blur;
      ctx.shadowOffsetY = o.dy;
    }
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = T.colors.card;
    ctx.fill();
    ctx.restore();
    const sw = o.stroke == null ? T.cardStroke : o.stroke;
    if (sw > 0) {
      ctx.save();
      roundRect(ctx, x, y, w, h, r);
      ctx.lineWidth = sw;
      ctx.strokeStyle = T.colors.ink;
      ctx.stroke();
      ctx.restore();
    }
  }

  function topRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // 「照片或占位」的唯一绘制点：五个样式（卡片 / 杂志 hero / 领奖台 / 榜单紧凑行 /
  // 拼贴拍立得）都走它，所以「没照片」的结果不再取决于样式。圆角与裁剪仍归调用点。
  function photo(ctx, T, im, box, name) {
    const { x, y, w, h } = box;
    if (im) {
      cover(ctx, im, x, y, w, h);
      return;
    }
    // 整段包在 save/restore 里：调用点虽然都已在自己的 save 里，但这让 photo()
    // 不依赖调用点是否已 save（否则 fillStyle 会漏给下游绘制）。
    ctx.save();
    ctx.fillStyle = T.colors.placeholder;
    ctx.fillRect(x, y, w, h);
    // 首字：框高的三分之一、封顶 96px。封顶的理由是杂志 hero 的框高能到 1083px
    // （/3 会写出 361px 的巨字压掉名次角标），a/7 的冠军卡 523px（174 → 96）。
    // 低于 6px 就只留底色：那种尺寸的字是噪点，不是信息。
    const size = Math.min(Math.round(h / 3), 96);
    if (size >= 6) {
      ctx.fillStyle = T.colors.placeholderInk;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${size}px ${T.fonts.jp}`;
      // trim 与名册占位（core.js 的 placeholder 路径）一致：全空白名字画「?」而非空白
      const ch = String(name || "")
        .trim()
        .charAt(0);
      ctx.fillText(ch || "?", x + w / 2, y + h / 2);
    }
    ctx.restore();
  }

  function slotCard(ctx, T, im, m, x, y, w, h, compact, photoH) {
    const ph = photoH || h;
    panel(ctx, T, x, y, w, h, 10, {
      color: "rgba(28,30,43,.18)",
      blur: 24,
      dy: 10,
      stroke: compact ? Math.min(2, T.cardStroke) : T.cardStroke,
    });

    ctx.save();
    if (ph < h) topRoundedRect(ctx, x, y, w, ph, 10);
    else roundRect(ctx, x, y, w, h, 10);
    ctx.clip();
    photo(ctx, T, im, { x, y, w, h: ph }, m.name);
    ctx.restore();
  }

  function tapeGeom(big, compact, rank) {
    if (big) return { w: 118, h: 70, padX: 14, padY: 18, num: 44 };
    if (compact)
      return rank <= 3
        ? { w: 52, h: 38, padX: 7, padY: 10, num: 22 }
        : { w: 44, h: 32, padX: 7, padY: 10, num: 19 };
    return rank <= 3
      ? { w: 76, h: 56, padX: 10, padY: 14, num: 34 }
      : { w: 64, h: 48, padX: 10, padY: 14, num: 28 };
  }

  function rankTape(ctx, T, rank, x, y, big, compact) {
    const g = tapeGeom(big, compact, rank);
    const tx = x - g.padX;
    const ty = y - g.padY;
    tape(ctx, tx, ty, g.w, g.h, big ? T.colors.pink : T.colors.tape, -0.06);
    ctx.save();
    ctx.translate(tx + g.w / 2, ty + g.h / 2);
    ctx.rotate(-0.06);
    ctx.fillStyle = big ? "#fff" : T.colors.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (big) {
      ctx.font = `400 44px ${T.fonts.display}`;
      ctx.fillText("1", -26, 3);
      ctx.font = `700 15px ${T.fonts.ui}`;
      ctx.fillText("CENTER", 22, 2);
    } else {
      ctx.font = `400 ${g.num}px ${T.fonts.display}`;
      ctx.fillText(String(rank), 0, 3);
    }
    ctx.restore();
  }

  function labelSizes(big, compact, rank) {
    if (big) return { name: 44, sub: 20 };
    if (compact) return { name: 20, sub: 13 };
    return rank <= 3 ? { name: 32, sub: 17 } : { name: 26, sub: 17 };
  }

  function slotLabel(ctx, T, m, rank, x, y, w, h, big, compact, subOf) {
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = T.colors.ink;
    const sizes = labelSizes(big, compact, rank);
    const nameSize = fitText(ctx, m.name, w + 10, sizes.name, 700, T.fonts.jp);
    ctx.fillText(m.name, x + w / 2, y + h + nameSize + 14);
    const sub = String(subOf(m) || "");
    const subSize = fitText(ctx, sub, w + 10, sizes.sub, 500, T.fonts.ui);
    ctx.fillStyle = T.colors.muted;
    ctx.fillText(
      compact ? clipText(ctx, sub, w + 10, sizes.sub, 500, T.fonts.ui) : sub,
      x + w / 2,
      y + h + nameSize + subSize + 22
    );
  }

  function slot(
    ctx,
    T,
    im,
    m,
    rank,
    x,
    y,
    w,
    h,
    big,
    compact,
    subOf,
    hideText
  ) {
    slotCard(ctx, T, im, m, x, y, w, h, compact);
    rankTape(ctx, T, rank, x, y, big, compact);
    if (hideText) return;
    slotLabel(ctx, T, m, rank, x, y, w, h, big, compact, subOf);
  }

  function placeRow(ctx, T, imgs, members, start, count, y, w, h, gap, subOf) {
    const total = count * w + (count - 1) * gap;
    let x = (ctx.canvas.width - total) / 2;
    for (let i = 0; i < count; i++) {
      const idx = start + i;
      const colX = x;
      x += w + gap;
      if (!members[idx]) continue;
      slot(
        ctx,
        T,
        imgs[idx],
        members[idx],
        idx + 1,
        colX,
        y,
        w,
        h,
        false,
        false,
        subOf
      );
    }
  }

  function podium(ctx, T, members, imgs, subOf, geo) {
    const W = ctx.canvas.width;
    const { fy, bigW, bigH, sideW, sideH, gap } = geo;
    const fx = (W - (bigW + sideW * 2 + gap * 2)) / 2;
    const sideY = fy + bigH - sideH;
    if (members[1])
      slot(
        ctx,
        T,
        imgs[1],
        members[1],
        2,
        fx,
        sideY,
        sideW,
        sideH,
        false,
        false,
        subOf
      );
    if (members[2])
      slot(
        ctx,
        T,
        imgs[2],
        members[2],
        3,
        fx + sideW + gap + bigW + gap,
        sideY,
        sideW,
        sideH,
        false,
        false,
        subOf
      );
    slot(
      ctx,
      T,
      imgs[0],
      members[0],
      1,
      fx + sideW + gap,
      fy,
      bigW,
      bigH,
      true,
      false,
      subOf
    );
  }

  function drawSeven(ctx, T, members, imgs, subOf) {
    const fy = 262;
    const bigW = 392,
      bigH = 523,
      sideW = 272,
      sideH = 363,
      gap = 22;
    podium(ctx, T, members, imgs, subOf, { fy, bigW, bigH, sideW, sideH, gap });
    const by = fy + bigH + 150;
    placeRow(ctx, T, imgs, members, 3, 4, by, 216, 288, 26, subOf);
  }

  function drawSixteen(ctx, T, members, imgs, subOf) {
    const fy = 210;
    const bigW = 300,
      bigH = 400,
      sideW = 220,
      sideH = 294,
      gap = 18;
    podium(ctx, T, members, imgs, subOf, { fy, bigW, bigH, sideW, sideH, gap });
    const midY = fy + bigH + 92;
    placeRow(ctx, T, imgs, members, 3, 6, midY, 148, 198, 14, subOf);
    const backY = midY + 198 + 78;
    placeRow(ctx, T, imgs, members, 9, 7, backY, 128, 170, 12, subOf);
  }

  const PYRAMIDS = {
    32: {
      rows: [1, 3, 5, 7, 9, 7],
      weights: [1.45, 1.33, 1.21, 1.09, 0.97, 0.85],
    },
    40: {
      rows: [1, 3, 5, 7, 9, 11, 4],
      weights: [1.5, 1.4, 1.3, 1.2, 1.1, 1.0, 0.9],
    },
  };
  const PYRAMID_NAMED_ROWS = 4;

  function drawPyramid(ctx, T, members, imgs, subOf) {
    const P = PYRAMIDS[members.length] || PYRAMIDS[32];
    const rows = P.rows;
    const weights = P.weights;
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const top = 200;
    const bottom = frame(W, H).footerTop;
    const U = bottom - top;
    const margin = 56;
    const gap = 10;
    const wSum = weights.reduce((a, b) => a + b, 0);
    const textZone = rows.map((_, i) => (i < PYRAMID_NAMED_ROWS ? 42 : 8));
    const avail = W - margin * 2;
    const raw = rows.map((n, i) =>
      Math.min((avail - gap * (n - 1)) / n, ((U * weights[i]) / wSum) * 0.86)
    );
    for (let i = 1; i < raw.length; i++) raw[i] = Math.min(raw[i], raw[i - 1]);
    const heightSum = raw.reduce((a, w) => a + (w * 4) / 3, 0);
    const textSum = textZone.reduce((a, b) => a + b, 0);
    const f = (U - textSum) / heightSum;
    let y = top;
    let idx = 0;
    for (let r = 0; r < rows.length; r++) {
      const n = rows[r];
      const cw = raw[r] * f;
      const ch = (cw * 4) / 3;
      const total = n * cw + (n - 1) * gap;
      let x = (W - total) / 2;
      for (let i = 0; i < n; i++) {
        if (members[idx])
          slot(
            ctx,
            T,
            imgs[idx],
            members[idx],
            idx + 1,
            x,
            y,
            cw,
            ch,
            false,
            true,
            subOf,
            r >= PYRAMID_NAMED_ROWS
          );
        x += cw + gap;
        idx++;
      }
      y += ch + textZone[r];
    }
  }

  function posterFooter(ctx, T, W, H, hashtag, photoSrc) {
    const fr = frame(W, H);
    ctx.strokeStyle = T.colors.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fr.margin, fr.footerTop);
    ctx.lineTo(fr.right, fr.footerTop);
    ctx.stroke();
    ctx.font = `700 22px ${T.fonts.ui}`;
    ctx.fillStyle = T.colors.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(hashtag, fr.margin, H - 44);
    ctx.textAlign = "right";
    ctx.font = `500 18px ${T.fonts.ui}`;
    ctx.fillStyle = T.colors.muted;
    ctx.fillText(photoSrc, fr.right, H - 44);
  }

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
    fitText(ctx, title, W - fr.margin * 2, tall ? 56 : 64, 900, T.fonts.ui);
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
    const rows = n <= 7 ? 1 : n <= 16 ? 2 : 3;
    const cols = Math.max(2, Math.ceil((n - 1) / rows));
    const gap = 8;
    const labelH = 30;
    const cw = (W - M * 2 - gap * (cols - 1)) / cols;
    const ch = cw * 1.333;
    const gridH = rows * (ch + labelH) + (rows - 1) * 12;
    const heroH = Math.max(220, fr.footerTop - heroY - gridH - 48);

    ctx.save();
    roundRect(ctx, M, heroY, W - M * 2, heroH, 8);
    ctx.clip();
    photo(
      ctx,
      T,
      images[0],
      { x: M, y: heroY, w: W - M * 2, h: heroH },
      members[0].name
    );
    ctx.restore();
    const capH = 84;
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = T.colors.ink;
    ctx.fillRect(M, heroY + heroH - capH, W - M * 2, capH);
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.fillStyle = T.colors.tape;
    ctx.font = `400 58px ${T.fonts.display}`;
    ctx.fillText("1", M + 28, heroY + heroH - 22);
    ctx.fillStyle = T.colors.card;
    ctx.font = `700 40px ${T.fonts.jp}`;
    ctx.fillText(
      clipText(ctx, members[0].name, W - M * 2 - 200, 40, 700, T.fonts.jp),
      M + 96,
      heroY + heroH - 30
    );
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.font = `500 22px ${T.fonts.ui}`;
    ctx.fillText(
      `${members[0].group} ・ ${String(subOf(members[0]) || "")}`,
      M + 96,
      heroY + heroH - 64
    );
    ctx.restore();

    const gy = heroY + heroH + 36;
    for (let i = 1; i < n; i++) {
      const k = i - 1;
      const x = M + (k % cols) * (cw + gap);
      const y = gy + Math.floor(k / cols) * (ch + labelH + 12);
      slotCard(ctx, T, images[i], members[i], x, y, cw, ch, true);
      ctx.save();
      roundRect(ctx, x + 6, y + 6, 46, 24, 12);
      ctx.fillStyle = rankColor(i + 1, T);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `800 15px ${T.fonts.ui}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), x + 29, y + 19);
      ctx.restore();
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = T.colors.ink;
      const ns = fitText(ctx, members[i].name, cw, 17, 700, T.fonts.jp);
      ctx.font = `700 ${ns}px ${T.fonts.jp}`;
      ctx.fillText(members[i].name, x + cw / 2, y + ch + ns + 8);
    }
    posterFooter(ctx, T, W, H, hashtag, photoSrc);
  }

  // ---- 样式 C：榜单领奖台（前三放大 + 双栏紧凑榜） ----
  const MEDALS = { 1: "#e8b64c", 2: "#b9c0c9", 3: "#c98a5b" };

  // 前三样式共享的产品规则：前 7 名用品牌粉，其余用墨色（样式 a 的名次胶带自成一套）
  function rankColor(rank, T) {
    return rank <= 7 ? T.colors.pink : T.colors.ink;
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

    const listTop = 268 + podH + 80;
    const count = n - 3;
    if (count <= 4) {
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
        ctx.textAlign = "center";
        ctx.fillStyle = rankColor(i + 1, T);
        ctx.font = `400 34px ${T.fonts.display}`;
        ctx.fillText(String(i + 1), x + 34, y + cardH2 - 14);
        ctx.textAlign = "left";
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
      posterFooter(ctx, T, W, H, hashtag, photoSrc);
      return;
    }
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

  function collageRows(n) {
    if (n <= 7) return [4, 3];
    if (n <= 16) return [6, 5, 5];
    if (n <= 32) return [7, 7, 6, 6, 6];
    return [8, 8, 8, 8, 8];
  }

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
      Math.min(19, g.cw * 0.16),
      700,
      T.fonts.jp
    );
    ctx.font = `700 ${ns}px ${T.fonts.jp}`;
    ctx.fillText(m.name, -g.cw / 2 + 12, g.cardH / 2 - 16);
    ctx.beginPath();
    ctx.arc(g.cw / 2 - 30, g.cardH / 2 - 30, 17, 0, Math.PI * 2);
    ctx.fillStyle = rankColor(idx + 1, T);
    ctx.fill();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `400 22px ${T.fonts.display}`;
    ctx.fillStyle = "#fff";
    ctx.fillText(String(idx + 1), g.cw / 2 - 30, g.cardH / 2 - 29);
    if (idx % 5 === 2 || idx % 7 === 3) collageTape(ctx, T, g);
    ctx.restore();
  }

  function drawCollage(ctx, T, opts, W, H) {
    const { members, images, title, dateText, hashtag, photoSrc } = opts;
    const n = members.length;
    const fr = frame(W, H);
    ctx.fillStyle = T.colors.floor;
    ctx.fillRect(0, 0, W, H);
    collageDots(ctx, T, W, H);
    collageHeader(ctx, T, title, dateText, n, fr, W);

    const rows = collageRows(n);
    const perRow = Math.max(...rows);
    const gap = 18;
    const cw = (W - 80 - gap * (perRow - 1)) / perRow;
    const photoH = (cw - 24) * 1.333;
    const cardH = photoH + 52;
    const top = 300;
    const avail = fr.footerTop - top;
    const step = cardH + 26;
    const blockH = rows.length * cardH + (rows.length - 1) * 26;
    const y0 = top + Math.max(0, (avail - blockH) / 2);
    const jitter = [0, 14, -10, 18, -6, 10, -14];
    let idx = 0;
    for (let r = 0; r < rows.length; r++) {
      const y = y0 + r * step;
      const rowN = rows[r];
      const rowW = rowN * cw + (rowN - 1) * gap;
      const x0 = (W - rowW) / 2;
      for (let c = 0; c < rowN; c++, idx++) {
        const m = members[idx];
        if (!m) continue;
        collageCard(ctx, T, m, images[idx], idx, {
          x: x0 + c * (cw + gap) + jitter[(c + r) % jitter.length] * 0.8,
          y,
          cw,
          cardH,
          photoH,
          rot: (((c * 7 + r * 5) % 11) - 5) * 0.008,
        });
      }
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    posterFooter(ctx, T, W, H, hashtag, photoSrc);
  }

  const STYLES = ["a", "b", "c", "d"];

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
            : drawClassic;
    fn(ctx, T, opts, size.width, size.height);
  }

  return { layout, draw, defaultTokens, styles: STYLES };
});
