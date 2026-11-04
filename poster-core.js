// 海报绘制核心：令牌、画布布局、绘制原语与通用卡片/领奖台。
// 无 DOM 依赖，canvas ctx 由调用方注入；node:test 用假 ctx 验证。
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AKB_POSTER_CORE = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function defaultTokens() {
    const ui =
      '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif';
    const jp =
      '"Zen Kaku Gothic New","Hiragino Sans","Yu Gothic","Meiryo",' + ui;
    return {
      colors: {
        floor: "#f1e7d8",
        card: "#fffdf7",
        ink: "#2b211b",
        muted: "#71614f",
        line: "#c9b8a4",
        pink: "#e4007f",
        tape: "#f3d98b",
        placeholder: "#e4e7ee",
        placeholderInk: "#7e8390",
      },
      fonts: { ui, jp, name: jp, display: '"Dela Gothic One",' + jp },
      cardStroke: 0,
      corner: 6,
      shadow: true,
      rankStyle: "tape",
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
      corner: typeof tokens.corner === "number" ? tokens.corner : d.corner,
      shadow: tokens.shadow === false ? false : d.shadow,
      rankStyle: tokens.rankStyle || d.rankStyle,
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
    panel(ctx, T, x, y, w, h, T.corner, {
      color: T.shadow ? "rgba(28,30,43,.18)" : null,
      blur: 24,
      dy: 10,
      stroke: compact ? Math.min(2, T.cardStroke) : T.cardStroke,
    });

    ctx.save();
    if (ph < h) topRoundedRect(ctx, x, y, w, ph, T.corner);
    else roundRect(ctx, x, y, w, h, T.corner);
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

  // 名次数字的基准字号：大卡 96；小卡按前三/其余分两档。
  function rankBase(big, compact, rank) {
    if (big) return 96;
    if (compact) return rank <= 3 ? 44 : 36;
    return rank <= 3 ? 64 : 52;
  }

  // 编辑部：把名次做成压在照片上的大号衬线数字（白描边 + 墨色字，证件照底也读得清）
  function editorialRank(ctx, T, rank, x, y, big, compact, w, h) {
    // 小卡上的名次数字不能按「完整卡」的字号画：40 档底部只有 ~96px 宽，
    // 44px 的数字会直接压住脸。字号随卡宽收缩，最小 16px。
    const base = rankBase(big, compact, rank);
    const size = Math.max(16, Math.min(base, (w || 240) * 0.22));
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `400 ${size}px ${T.fonts.display}`;
    const label = String(rank).padStart(2, "0");
    ctx.lineWidth = big ? 7 : 5;
    ctx.strokeStyle = "rgba(255,255,255,.9)";
    const small = !big && w && w < 150;
    const px = x + Math.max(3, (w || 240) * 0.04);
    const size2 = small ? 16 : size;
    ctx.font = `400 ${size2}px ${T.fonts.display}`;
    ctx.strokeText(label, px, y + 2);
    ctx.fillStyle = T.colors.ink;
    ctx.fillText(label, px, y + 2);
    if (big) {
      ctx.font = `700 15px ${T.fonts.ui}`;
      ctx.strokeText("CENTER", x + 14, y + size + 4);
      ctx.fillStyle = T.colors.pink;
      ctx.fillText("CENTER", x + 14, y + size + 4);
    }
    ctx.restore();
  }

  // 编辑部名次数字：白描边 + 墨色，压在照片上也读得清；与 rankStyle=tape 的贴纸章互斥。
  function editorialNumber(ctx, T, rank, x, y, size) {
    ctx.save();
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = `400 ${size}px ${T.fonts.display}`;
    const label = String(rank).padStart(2, "0");
    ctx.lineWidth = Math.max(3, size * 0.08);
    ctx.strokeStyle = "rgba(255,255,255,.9)";
    ctx.strokeText(label, x, y);
    ctx.fillStyle = T.colors.ink;
    ctx.fillText(label, x, y);
    ctx.restore();
  }

  function rankTape(ctx, T, rank, x, y, w, h, big, compact) {
    if (T.rankStyle === "editorial") {
      editorialRank(ctx, T, rank, x, y, big, compact, w, h);
      return;
    }
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
    const nameSize = fitText(
      ctx,
      m.name,
      w + 10,
      sizes.name,
      700,
      T.fonts.name || T.fonts.jp
    );
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
    hideText,
    captionRank
  ) {
    slotCard(ctx, T, im, m, x, y, w, h, compact);
    // 40 档底部小卡：名次移到名字行，不再压在脸上（w<150 时卡内只有照片）。
    if (captionRank && compact && w < 150) {
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      const ns = fitText(
        ctx,
        m.name,
        w - 34,
        14,
        700,
        T.fonts.name || T.fonts.jp
      );
      ctx.fillStyle = T.colors.ink;
      ctx.font = `700 ${ns}px ${T.fonts.name || T.fonts.jp}`;
      ctx.fillText(m.name, x, y + h + ns + 10);
      ctx.textAlign = "right";
      ctx.fillStyle = T.colors.pink;
      ctx.font = `700 12px ${T.fonts.ui}`;
      ctx.fillText(String(rank).padStart(2, "0"), x + w, y + h + ns + 10);
      return;
    }
    rankTape(ctx, T, rank, x, y, w, h, big, compact);
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
  return {
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
  };
});
