// 海报绘制 module（无 DOM 依赖，canvas ctx 由调用方注入；node:test 用假 ctx 验证布局与字幕）
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AKB_POSTER = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const C = {
    floor: "#edeff3",
    card: "#ffffff",
    ink: "#1c1e2b",
    muted: "#6b6f80",
    line: "#d5d9e2",
    pink: "#e4007f",
    tape: "#f4c20d",
  };
  const UI_FONT =
    '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif';
  const JP_FONT =
    '"Zen Kaku Gothic New","Hiragino Sans","Yu Gothic","Meiryo",' + UI_FONT;
  const DISPLAY = '"Dela Gothic One",' + JP_FONT;

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

  function slot(ctx, im, m, rank, x, y, w, h, big, compact, subOf) {
    ctx.save();
    ctx.shadowColor = "rgba(28,30,43,.18)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    roundRect(ctx, x, y, w, h, 10);
    ctx.fillStyle = C.card;
    ctx.fill();
    ctx.restore();

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
      ctx.font = `700 ${Math.round(h / 3)}px ${JP_FONT}`;
      ctx.fillText(String(m.name || "?").charAt(0), x + w / 2, y + h / 2);
    }
    ctx.restore();

    const tw = big
      ? 118
      : compact
        ? rank <= 3
          ? 52
          : 44
        : rank <= 3
          ? 76
          : 64;
    const th = big ? 70 : compact ? (rank <= 3 ? 38 : 32) : rank <= 3 ? 56 : 48;
    const padX = big ? 14 : compact ? 7 : 10;
    const padY = big ? 18 : compact ? 10 : 14;
    const tx = x - padX,
      ty = y - padY;
    tape(ctx, tx, ty, tw, th, big ? C.pink : C.tape, -0.06);
    ctx.save();
    ctx.translate(tx + tw / 2, ty + th / 2);
    ctx.rotate(-0.06);
    ctx.fillStyle = big ? "#fff" : C.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (big) {
      ctx.font = `400 44px ${DISPLAY}`;
      ctx.fillText("1", -26, 3);
      ctx.font = `700 15px ${UI_FONT}`;
      ctx.fillText("CENTER", 22, 2);
    } else {
      const numSize = compact ? (rank <= 3 ? 22 : 19) : rank <= 3 ? 34 : 28;
      ctx.font = `400 ${numSize}px ${DISPLAY}`;
      ctx.fillText(String(rank), 0, 3);
    }
    ctx.restore();

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = C.ink;
    const nameBase = big ? 44 : compact ? 20 : rank <= 3 ? 32 : 26;
    const nameSize = fitText(ctx, m.name, w + 10, nameBase, 700, JP_FONT);
    ctx.fillText(m.name, x + w / 2, y + h + nameSize + 14);
    const sub = String(subOf(m) || "");
    const subBase = big ? 20 : compact ? 13 : 17;
    const subSize = fitText(ctx, sub, w + 10, subBase, 500, UI_FONT);
    ctx.fillStyle = C.muted;
    ctx.fillText(
      compact ? clipText(ctx, sub, w + 10, subBase, 500, UI_FONT) : sub,
      x + w / 2,
      y + h + nameSize + subSize + 22
    );
  }

  function placeRow(ctx, imgs, members, start, count, y, w, h, gap, subOf) {
    const total = count * w + (count - 1) * gap;
    let x = (ctx.canvas.width - total) / 2;
    for (let i = 0; i < count; i++) {
      const idx = start + i;
      if (!members[idx]) continue;
      slot(
        ctx,
        imgs[idx],
        members[idx],
        idx + 1,
        x,
        y,
        w,
        h,
        false,
        false,
        subOf
      );
      x += w + gap;
    }
  }

  function drawSeven(ctx, members, imgs, subOf) {
    const W = ctx.canvas.width;
    const fy = 262;
    const bigW = 392,
      bigH = 523,
      sideW = 272,
      sideH = 363,
      gap = 22;
    const fx = (W - (bigW + sideW * 2 + gap * 2)) / 2;
    const sideY = fy + bigH - sideH;
    if (members[1])
      slot(
        ctx,
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
    const by = fy + bigH + 150;
    placeRow(ctx, imgs, members, 3, 4, by, 216, 288, 26, subOf);
  }

  function drawSixteen(ctx, members, imgs, subOf) {
    const W = ctx.canvas.width;
    const fy = 210;
    const bigW = 300,
      bigH = 400,
      sideW = 220,
      sideH = 294,
      gap = 18;
    const fx = (W - (bigW + sideW * 2 + gap * 2)) / 2;
    const sideY = fy + bigH - sideH;
    if (members[1])
      slot(
        ctx,
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
    const midY = fy + bigH + 92;
    placeRow(ctx, imgs, members, 3, 6, midY, 148, 198, 14, subOf);
    const backY = midY + 198 + 78;
    placeRow(ctx, imgs, members, 9, 7, backY, 128, 170, 12, subOf);
  }

  function drawThirtyTwo(ctx, members, imgs, subOf) {
    const W = ctx.canvas.width;
    const cols = 8,
      margin = 72,
      gap = 16;
    const w = (W - margin * 2 - gap * (cols - 1)) / cols;
    const h = (w * 4) / 3;
    const rowPitch = h + 88;
    const startY = 300;
    for (let i = 0; i < members.length; i++) {
      const r = Math.floor(i / cols),
        c = i % cols;
      const x = margin + c * (w + gap);
      const y = startY + r * rowPitch;
      slot(ctx, imgs[i], members[i], i + 1, x, y, w, h, false, true, subOf);
    }
  }

  function draw(ctx, opts) {
    const { members, images, title, dateText, hashtag, photoSrc, subOf } = opts;
    const W = ctx.canvas.width,
      H = ctx.canvas.height;
    const n = members.length;

    ctx.fillStyle = C.floor;
    ctx.fillRect(0, 0, W, H);

    const tall = n > 7 && n <= 16;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = C.ink;
    fitText(ctx, title, W - 144, tall ? 56 : 64, 900, UI_FONT);
    ctx.fillText(title, 72, tall ? 100 : 118);
    tape(
      ctx,
      72,
      tall ? 116 : 136,
      Math.min(ctx.measureText(title).width * 0.72, 520),
      12,
      C.pink,
      -0.012
    );
    ctx.font = `500 24px ${UI_FONT}`;
    ctx.fillStyle = C.muted;
    ctx.fillText(dateText, 72, tall ? 168 : 190);

    if (n <= 7) drawSeven(ctx, members, images, subOf);
    else if (n <= 16) drawSixteen(ctx, members, images, subOf);
    else drawThirtyTwo(ctx, members, images, subOf);

    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(72, H - 84);
    ctx.lineTo(W - 72, H - 84);
    ctx.stroke();
    ctx.font = `700 22px ${UI_FONT}`;
    ctx.fillStyle = C.ink;
    ctx.textAlign = "left";
    ctx.fillText(hashtag, 72, H - 44);
    ctx.textAlign = "right";
    ctx.font = `500 18px ${UI_FONT}`;
    ctx.fillStyle = C.muted;
    ctx.fillText(photoSrc, W - 72, H - 44);
  }

  return { layout, draw };
});
