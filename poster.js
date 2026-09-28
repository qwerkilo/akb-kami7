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

  function slotCard(ctx, T, im, m, x, y, w, h, compact) {
    ctx.save();
    ctx.shadowColor = "rgba(28,30,43,.18)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    roundRect(ctx, x, y, w, h, 10);
    ctx.fillStyle = T.colors.card;
    ctx.fill();
    ctx.restore();

    if (T.cardStroke > 0) {
      ctx.save();
      roundRect(ctx, x, y, w, h, 10);
      ctx.lineWidth = compact ? Math.min(2, T.cardStroke) : T.cardStroke;
      ctx.strokeStyle = T.colors.ink;
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    roundRect(ctx, x, y, w, h, 10);
    ctx.clip();
    if (im) {
      cover(ctx, im, x, y, w, h);
    } else {
      ctx.fillStyle = "#e4e7ee";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#9aa0b0";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${Math.round(h / 3)}px ${T.fonts.jp}`;
      ctx.fillText(String(m.name || "?").charAt(0), x + w / 2, y + h / 2);
    }
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

  const PYRAMID_ROWS = [1, 3, 5, 7, 9, 7];
  const PYRAMID_WEIGHTS = [1.45, 1.33, 1.21, 1.09, 0.97, 0.85];
  const PYRAMID_NAMED_ROWS = 4;

  function drawThirtyTwo(ctx, T, members, imgs, subOf) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const top = 200;
    const bottom = H - 84;
    const U = bottom - top;
    const margin = 56;
    const gap = 10;
    const wSum = PYRAMID_WEIGHTS.reduce((a, b) => a + b, 0);
    const textZone = PYRAMID_ROWS.map((_, i) =>
      i < PYRAMID_NAMED_ROWS ? 42 : 8
    );
    const avail = W - margin * 2;
    const raw = PYRAMID_ROWS.map((n, i) =>
      Math.min(
        (avail - gap * (n - 1)) / n,
        ((U * PYRAMID_WEIGHTS[i]) / wSum) * 0.86
      )
    );
    for (let i = 1; i < raw.length; i++) raw[i] = Math.min(raw[i], raw[i - 1]);
    const heightSum = raw.reduce((a, w) => a + (w * 4) / 3, 0);
    const textSum = textZone.reduce((a, b) => a + b, 0);
    const f = (U - textSum) / heightSum;
    let y = top;
    let idx = 0;
    for (let r = 0; r < PYRAMID_ROWS.length; r++) {
      const n = PYRAMID_ROWS[r];
      const cw = raw[r] * f;
      const ch = (cw * 4) / 3;
      const total = n * cw + (n - 1) * gap;
      let x = (W - total) / 2;
      for (let i = 0; i < n; i++) {
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
    ctx.strokeStyle = T.colors.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(72, H - 84);
    ctx.lineTo(W - 72, H - 84);
    ctx.stroke();
    ctx.font = `700 22px ${T.fonts.ui}`;
    ctx.fillStyle = T.colors.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(hashtag, 72, H - 44);
    ctx.textAlign = "right";
    ctx.font = `500 18px ${T.fonts.ui}`;
    ctx.fillStyle = T.colors.muted;
    ctx.fillText(photoSrc, W - 72, H - 44);
  }

  function drawClassic(ctx, T, opts, W, H) {
    const { members, images, title, dateText, hashtag, photoSrc, subOf } = opts;
    const n = members.length;

    ctx.fillStyle = T.colors.floor;
    ctx.fillRect(0, 0, W, H);

    const tall = H > 1440;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = T.colors.ink;
    fitText(ctx, title, W - 144, tall ? 56 : 64, 900, T.fonts.ui);
    ctx.fillText(title, 72, tall ? 100 : 118);
    tape(
      ctx,
      72,
      tall ? 116 : 136,
      Math.min(ctx.measureText(title).width * 0.72, 520),
      12,
      T.colors.pink,
      -0.012
    );
    ctx.font = `500 24px ${T.fonts.ui}`;
    ctx.fillStyle = T.colors.muted;
    ctx.fillText(dateText, 72, tall ? 168 : 190);

    if (n <= 7) drawSeven(ctx, T, members, images, subOf);
    else if (n <= 16) drawSixteen(ctx, T, members, images, subOf);
    else drawThirtyTwo(ctx, T, members, images, subOf);

    posterFooter(ctx, T, W, H, hashtag, photoSrc);
  }

  // ---- 样式 B：杂志封面（大标题 + 冠军横图 + 联系表网格） ----
  function drawMagazine(ctx, T, opts, W, H) {
    const { members, images, title, dateText, hashtag, photoSrc, subOf } = opts;
    const n = members.length;
    const M = 72;
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
    const heroH = Math.max(220, H - 84 - heroY - gridH - 48);

    ctx.save();
    roundRect(ctx, M, heroY, W - M * 2, heroH, 8);
    ctx.clip();
    if (images[0]) cover(ctx, images[0], M, heroY, W - M * 2, heroH);
    else {
      ctx.fillStyle = "#e4e7ee";
      ctx.fillRect(M, heroY, W - M * 2, heroH);
    }
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
      ctx.fillStyle = i < 7 ? T.colors.pink : T.colors.ink;
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

  function drawChart(ctx, T, opts, W, H) {
    const { members, images, title, dateText, hashtag, photoSrc, subOf } = opts;
    const n = members.length;
    const M = 72;
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
      ctx.save();
      ctx.shadowColor = "rgba(28,30,43,.16)";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 8;
      roundRect(ctx, p.x, p.y, p.w, p.h, 18);
      ctx.fillStyle = T.colors.card;
      ctx.fill();
      ctx.restore();
      if (T.cardStroke > 0) {
        ctx.save();
        roundRect(ctx, p.x, p.y, p.w, p.h, 18);
        ctx.lineWidth = T.cardStroke;
        ctx.strokeStyle = T.colors.ink;
        ctx.stroke();
        ctx.restore();
      }
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
      if (images[p.i])
        cover(
          ctx,
          images[p.i],
          p.x + pad,
          p.y + pad,
          p.w - pad * 2,
          p.h - p.bar - pad
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

    const listTop = 268 * k + podH + 80 * k;
    const listH = H - 84 - listTop;
    const count = n - 3;
    const rows = Math.max(1, Math.ceil(count / 2));
    const rowH = listH / rows;
    const colW = (W - M * 2 - 24) / 2;
    for (let i = 3; i < n; i++) {
      const idx = i - 3;
      const col = Math.floor(idx / rows);
      const row = idx % rows;
      const x = M + col * (colW + 24);
      const y = listTop + row * rowH;
      const th = Math.min(rowH - 8, 44 * k);
      const tw = th * 0.79;
      if (images[i]) {
        ctx.save();
        roundRect(ctx, x + 46 * k, y + (rowH - th) / 2, tw, th, 4);
        ctx.clip();
        cover(ctx, images[i], x + 46 * k, y + (rowH - th) / 2, tw, th);
        ctx.restore();
      }
      ctx.textAlign = "right";
      ctx.fillStyle = i < 7 ? T.colors.pink : T.colors.ink;
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
      ctx.textAlign = "left";
      ctx.fillStyle = T.colors.ink;
      const ns = fitText(
        ctx,
        members[i].name,
        colW - 200 * k,
        24 * k,
        700,
        T.fonts.jp
      );
      ctx.font = `700 ${ns}px ${T.fonts.jp}`;
      ctx.fillText(
        members[i].name,
        x + 46 * k + tw + 12 * k,
        y + rowH / 2 + 9 * k
      );
      ctx.textAlign = "right";
      ctx.font = `500 ${20 * k}px ${T.fonts.ui}`;
      ctx.fillStyle = T.colors.muted;
      ctx.fillText(
        String(subOf(members[i]) || ""),
        x + colW,
        y + rowH / 2 + 8 * k
      );
    }
    ctx.textAlign = "left";
    posterFooter(ctx, T, W, H, hashtag, photoSrc);
  }

  // ---- 样式 D：贴纸拼贴（拍立得散落 + 胶带） ----
  function drawCollage(ctx, T, opts, W, H) {
    const { members, images, title, dateText, hashtag, photoSrc, subOf } = opts;
    const n = members.length;
    ctx.fillStyle = T.colors.floor;
    ctx.fillRect(0, 0, W, H);
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

    // 贴纸标题
    const tw = Math.min(W - 144, 480);
    ctx.save();
    ctx.translate(72, 72);
    ctx.rotate(-0.05);
    ctx.shadowColor = "rgba(28,30,43,.22)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 8;
    roundRect(ctx, 0, 0, tw, 132, 14);
    ctx.fillStyle = T.colors.card;
    ctx.fill();
    ctx.shadowColor = "transparent";
    if (T.cardStroke > 0) {
      ctx.lineWidth = T.cardStroke;
      ctx.strokeStyle = T.colors.ink;
      ctx.stroke();
    }
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
    ctx.translate(W - 72 - 170, 96);
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

    const rows = n <= 7 ? [4, 3] : n <= 16 ? [6, 5, 5] : [7, 7, 6, 6, 6];
    const perRow = Math.max(...rows);
    const gap = 18;
    const cw = (W - 80 - gap * (perRow - 1)) / perRow;
    const photoH = (cw - 24) * 1.333;
    const cardH = photoH + 52;
    const top = 300;
    const avail = H - 84 - top;
    const jitter = [0, 14, -10, 18, -6, 10, -14];
    let idx = 0;
    for (let r = 0; r < rows.length; r++) {
      const y = top + (r * (avail - cardH)) / (rows.length - 1);
      const rowN = rows[r];
      const rowW = rowN * cw + (rowN - 1) * gap;
      const x0 = (W - rowW) / 2;
      for (let c = 0; c < rowN; c++, idx++) {
        const m = members[idx];
        if (!m) continue;
        const x = x0 + c * (cw + gap) + jitter[(c + r) % jitter.length] * 0.8;
        const rot = (((c * 7 + r * 5) % 11) - 5) * 0.008;
        ctx.save();
        ctx.translate(x + cw / 2, y + cardH / 2);
        ctx.rotate(rot);
        ctx.shadowColor = "rgba(28,30,43,.18)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 6;
        roundRect(ctx, -cw / 2, -cardH / 2, cw, cardH, 6);
        ctx.fillStyle = T.colors.card;
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.save();
        roundRect(ctx, -cw / 2 + 12, -cardH / 2 + 12, cw - 24, photoH, 3);
        ctx.clip();
        if (images[idx])
          cover(
            ctx,
            images[idx],
            -cw / 2 + 12,
            -cardH / 2 + 12,
            cw - 24,
            photoH
          );
        else {
          ctx.fillStyle = "#e4e7ee";
          ctx.fillRect(-cw / 2 + 12, -cardH / 2 + 12, cw - 24, photoH);
        }
        ctx.restore();
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = T.colors.ink;
        const ns = fitText(
          ctx,
          m.name,
          cw - 56,
          Math.min(19, cw * 0.16),
          700,
          T.fonts.jp
        );
        ctx.font = `700 ${ns}px ${T.fonts.jp}`;
        ctx.fillText(m.name, -cw / 2 + 12, cardH / 2 - 16);
        ctx.beginPath();
        ctx.arc(cw / 2 - 30, cardH / 2 - 30, 17, 0, Math.PI * 2);
        ctx.fillStyle = idx < 7 ? T.colors.pink : T.colors.ink;
        ctx.fill();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `400 22px ${T.fonts.display}`;
        ctx.fillStyle = "#fff";
        ctx.fillText(String(idx + 1), cw / 2 - 30, cardH / 2 - 29);
        if (idx % 5 === 2 || idx % 7 === 3) {
          ctx.save();
          ctx.translate(-cw / 2 + 26, -cardH / 2 + 4);
          ctx.rotate(-0.42);
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = T.colors.tape;
          ctx.fillRect(-30, -12, 60, 24);
          ctx.restore();
        }
        ctx.restore();
      }
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    posterFooter(ctx, T, W, H, hashtag, photoSrc);
  }

  // ---- 分派：a=现行金字塔（默认），b=杂志封面，c=榜单领奖台，d=贴纸拼贴 ----
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
