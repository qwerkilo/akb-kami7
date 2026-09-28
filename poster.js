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

  function draw(ctx, opts) {
    const { members, images, title, dateText, hashtag, photoSrc, subOf } = opts;
    const T = resolveTokens(opts.tokens);
    const n = members.length;
    // 几何单一出处：draw 声明画布尺寸并消费它（7/16 高版 = 1920）
    const size = layout(n);
    ctx.canvas.width = size.width;
    ctx.canvas.height = size.height;
    const W = size.width,
      H = size.height;

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

    ctx.strokeStyle = T.colors.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(72, H - 84);
    ctx.lineTo(W - 72, H - 84);
    ctx.stroke();
    ctx.font = `700 22px ${T.fonts.ui}`;
    ctx.fillStyle = T.colors.ink;
    ctx.textAlign = "left";
    ctx.fillText(hashtag, 72, H - 44);
    ctx.textAlign = "right";
    ctx.font = `500 18px ${T.fonts.ui}`;
    ctx.fillStyle = T.colors.muted;
    ctx.fillText(photoSrc, W - 72, H - 44);
  }

  return { layout, draw, defaultTokens };
});
