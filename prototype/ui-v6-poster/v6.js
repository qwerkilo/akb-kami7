(() => {
  const W = 1080;
  const H = 1440;
  const INK = "#20242e";
  const MUTED = "#6f6a63";
  const LINE = "#e6e1d6";
  const CREAM = "#f5f1e6";
  const PAPER = "#ffffff";
  const PINK = "#ff2d78";
  const LEMON = "#ffe08a";
  const GOLD = "#e8b64c";
  const SILVER = "#b9c0c9";
  const BRONZE = "#c98a5b";
  const UI = '"Zen Kaku Gothic New", system-ui, sans-serif';
  const DISP = '"Dela Gothic One", "Zen Kaku Gothic New", sans-serif';

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function cover(ctx, img, x, y, w, h, r, focusY) {
    if (!img) {
      ctx.fillStyle = "#ded8cc";
      ctx.fillRect(x, y, w, h);
      return;
    }
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const tr = w / h;
    let sw = iw;
    let sh = ih;
    let sx = 0;
    let sy = 0;
    if (iw / ih > tr) {
      sw = ih * tr;
      sx = (iw - sw) / 2;
    } else {
      sh = iw / tr;
      sy = (ih - sh) * (focusY == null ? 0.18 : focusY);
    }
    ctx.save();
    rr(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    ctx.restore();
  }

  function text(ctx, s, x, y, font, color, align) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align || "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(s, x, y);
  }

  function shrink(ctx, s, font, maxW, start) {
    let size = start;
    for (; size > 9; size -= 2) {
      ctx.font = font.replace("{s}", size);
      if (ctx.measureText(s).width <= maxW) break;
    }
    return font.replace("{s}", size);
  }

  function chip(ctx, x, y, w, h, bg, fg, label, font) {
    rr(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.font = font;
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
  }

  function photoFill(ctx, img, x, y, w, h, r) {
    cover(ctx, img, x, y, w, h, r, 0.12);
  }

  // ---- A 现行金字塔（复用生产 poster.js，贴纸皮肤默认令牌） ----
  function drawA(ctx, ms, imgs, meta) {
    window.AKB_POSTER.draw(ctx, {
      members: ms,
      images: imgs,
      title: meta.title,
      dateText: meta.date,
      hashtag: meta.hashtag,
      photoSrc: meta.credit,
      subOf: (m) => m.generation || "",
    });
  }

  // ---- B 杂志封面：大标题 + 冠军横图 + 31 格小图 ----
  function drawB(ctx, ms, imgs, meta) {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    const M = 64;
    text(ctx, "MY RANKING · 好き顔ソート", M, 118, `700 24px ${UI}`, MUTED);
    text(ctx, "好き顔", M, 262, `400 132px ${DISP}`, INK);
    const w1 = ctx.measureText("好き顔").width;
    text(ctx, "ソート", M + w1 + 18, 262, `400 132px ${DISP}`, PINK);
    const w2 = ctx.measureText("ソート").width;
    text(
      ctx,
      `${meta.sub}`,
      M + w1 + w2 + 36,
      250,
      `700 26px ${UI}`,
      MUTED
    );
    ctx.fillStyle = INK;
    ctx.fillRect(M, 306, W - M * 2, 3);
    text(
      ctx,
      `${meta.title} ・ ${meta.date} ・ ${meta.hashtag}`,
      M,
      352,
      `500 26px ${UI}`,
      MUTED
    );

    const heroY = 392;
    const heroW = W - M * 2;
    const heroH = 520;
    cover(ctx, imgs[0], M, heroY, heroW, heroH, 6, 0.22);
    ctx.fillStyle = "rgba(32,36,46,0.82)";
    ctx.fillRect(M, heroY + heroH - 84, heroW, 84);
    text(ctx, "1", M + 30, heroY + heroH - 22, `400 58px ${DISP}`, LEMON);
    text(ctx, ms[0].name, M + 96, heroY + heroH - 30, `700 40px ${UI}`, "#ffffff");
    text(
      ctx,
      `${ms[0].group} ・ ${ms[0].generation || ""}`,
      M + 96,
      heroY + heroH - 66,
      `500 22px ${UI}`,
      "#d9d5cc"
    );

    const gy = heroY + heroH + 32;
    const cols = 11;
    const gap = 8;
    const cw = (W - M * 2 - gap * (cols - 1)) / cols;
    const ch = cw * 1.333;
    for (let i = 1; i < 32; i++) {
      const k = i - 1;
      const x = M + (k % cols) * (cw + gap);
      const y = gy + Math.floor(k / cols) * (ch + 30);
      photoFill(ctx, imgs[i], x, y, cw, ch, 4);
      chip(
        ctx,
        x + 6,
        y + 6,
        46,
        24,
        i < 7 ? PINK : "rgba(32,36,46,0.78)",
        "#fff",
        String(i + 1),
        `800 15px ${UI}`
      );
      text(
        ctx,
        ms[i].name,
        x + cw / 2,
        y + ch + 21,
        shrink(ctx, ms[i].name, `700 {s}px ${UI}`, cw, 17),
        INK,
        "center"
      );
    }
    text(
      ctx,
      "写真：48pedia.org ・ 権利は各権利者に帰属します",
      M,
      H - 44,
      `500 20px ${UI}`,
      MUTED
    );
  }

  // ---- C 榜单领奖台：前三放大 + 4–32 双栏紧凑榜 ----
  function drawC(ctx, ms, imgs, meta) {
    ctx.fillStyle = "#f2f1ec";
    ctx.fillRect(0, 0, W, H);
    const M = 64;
    text(ctx, meta.title, M, 108, `400 58px ${DISP}`, INK);
    chip(ctx, W - M - 170, 66, 170, 52, PINK, "#fff", "圏内 32", `800 24px ${UI}`);
    text(ctx, `${meta.date} ・ ${meta.hashtag}`, M, 152, `500 24px ${UI}`, MUTED);

    const pod = [
      { i: 1, x: 78, y: 340, w: 250, h: 380, medal: SILVER, bar: 74 },
      { i: 0, x: 372, y: 268, w: 336, h: 452, medal: GOLD, bar: 92 },
      { i: 2, x: 752, y: 356, w: 250, h: 364, medal: BRONZE, bar: 74 },
    ];
    for (const p of pod) {
      ctx.save();
      ctx.shadowColor = "rgba(32,36,46,0.14)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;
      rr(ctx, p.x, p.y, p.w, p.h, 18);
      ctx.fillStyle = PAPER;
      ctx.fill();
      ctx.restore();
      const pad = 12;
      photoFill(ctx, imgs[p.i], p.x + pad, p.y + pad, p.w - pad * 2, p.h - p.bar - pad, 12);
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2, p.y + p.h - p.bar / 2 - 2, 30, 0, Math.PI * 2);
      ctx.fillStyle = p.medal;
      ctx.fill();
      text(
        ctx,
        String(p.i + 1),
        p.x + p.w / 2,
        p.y + p.h - p.bar / 2 + 10,
        `400 40px ${DISP}`,
        "#fff",
        "center"
      );
      text(
        ctx,
        ms[p.i].name,
        p.x + p.w / 2,
        p.y + p.h - 14,
        shrink(ctx, ms[p.i].name, `700 {s}px ${UI}`, p.w - 20, 26),
        INK,
        "center"
      );
    }

    const ly = 800;
    const rowH = 42;
    const colW = (W - M * 2 - 24) / 2;
    for (let i = 3; i < 32; i++) {
      const k = i - 3;
      const col = Math.floor(k / 15);
      const row = k % 15;
      const x = M + col * (colW + 24);
      const y = ly + row * rowH;
      text(
        ctx,
        String(i + 1),
        x + 34,
        y + rowH - 12,
        `400 30px ${DISP}`,
        i < 7 ? PINK : INK,
        "right"
      );
      photoFill(ctx, imgs[i], x + 48, y + 2, 30, 38, 4);
      text(
        ctx,
        ms[i].name,
        x + 90,
        y + rowH - 12,
        shrink(ctx, ms[i].name, `700 {s}px ${UI}`, colW - 210, 24),
        INK
      );
      text(
        ctx,
        ms[i].generation || "",
        x + colW,
        y + rowH - 12,
        `500 20px ${UI}`,
        MUTED,
        "right"
      );
    }
    text(
      ctx,
      "写真：48pedia.org",
      M,
      H - 36,
      `500 20px ${UI}`,
      MUTED
    );
  }

  // ---- D 贴纸拼贴：拍立得散落 + 胶带 + 贴纸标题 ----
  function drawD(ctx, ms, imgs, meta) {
    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(32,36,46,0.07)";
    for (let y = 24; y < H; y += 34) {
      for (let x = 24; x < W; x += 34) {
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const rows = [7, 7, 6, 6, 6];
    let idx = 0;
    const jitter = [0, 14, -10, 18, -6, 10, -14];
    for (let r = 0; r < rows.length; r++) {
      const y = 316 + r * 222;
      const n = rows[r];
      const cw = 138;
      const gap = (W - 80 - n * cw) / (n - 1 || 1);
      for (let c = 0; c < n; c++, idx++) {
        const m = ms[idx];
        if (!m) continue;
        const x = 40 + c * (cw + gap) + jitter[(c + r) % jitter.length];
        const rot = (((c * 7 + r * 5) % 11) - 5) * 0.008;
        ctx.save();
        ctx.translate(x + cw / 2, y + 92);
        ctx.rotate(rot);
        ctx.shadowColor = "rgba(32,36,46,0.18)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 6;
        rr(ctx, -cw / 2, -92, cw, 184, 6);
        ctx.fillStyle = PAPER;
        ctx.fill();
        ctx.shadowColor = "transparent";
        photoFill(ctx, imgs[idx], -cw / 2 + 12, -80, cw - 24, 136, 3);
        text(
          ctx,
          m.name,
          -cw / 2 + 12,
          84,
          shrink(ctx, m.name, `700 {s}px ${UI}`, cw - 52, 19),
          INK
        );
        ctx.beginPath();
        ctx.arc(cw / 2 - 30, 74, 17, 0, Math.PI * 2);
        ctx.fillStyle = idx < 7 ? PINK : INK;
        ctx.fill();
        text(
          ctx,
          String(idx + 1),
          cw / 2 - 30,
          82,
          `400 22px ${DISP}`,
          "#fff",
          "center"
        );
        if (idx % 5 === 2 || idx % 7 === 3) {
          ctx.save();
          ctx.translate(-cw / 2 + 26, -88);
          ctx.rotate(-0.42);
          ctx.fillStyle = "rgba(255,224,138,0.85)";
          ctx.fillRect(-30, -12, 60, 24);
          ctx.restore();
        }
        ctx.restore();
      }
    }
    ctx.save();
    ctx.translate(70, 92);
    ctx.rotate(-0.05);
    ctx.shadowColor = "rgba(32,36,46,0.22)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 8;
    rr(ctx, 0, 0, 480, 132, 14);
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.shadowColor = "transparent";
    text(ctx, "好き顔ソート", 26, 62, `400 46px ${DISP}`, INK);
    text(ctx, `${meta.title} ・ ${meta.date}`, 28, 100, `700 22px ${UI}`, MUTED);
    ctx.restore();
    chip(ctx, W - 250, 96, 178, 56, PINK, "#fff", "圏内 32", `800 26px ${UI}`);
    text(ctx, meta.hashtag, 72, H - 40, `800 26px ${UI}`, MUTED);
    text(ctx, meta.credit, W - 72, H - 40, `500 20px ${UI}`, MUTED, "right");
  }

  const styles = { a: drawA, b: drawB, c: drawC, d: drawD };

  window.V6 = {
    draw(ctx, v, ms, imgs, meta) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      (styles[v] || drawA)(ctx, ms, imgs, meta);
    },
  };
})();
