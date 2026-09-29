// Propaganda posters from the world of the Trinity Games, starring DoucheCube in a bolder poster style.
(function () {
  const SQ = window.SQ;
  const PW = 1080;
  const PH = 1350;
  const INK = '#151218';
  const PAPER = '#efe3c8';
  const RED = '#d7263d';
  const GOLD = '#ffd23f';

  const team = (base) => SQ.TEAMS.find((t) => t.base === base);
  const dc = () => team('Red');

  // ---------- drawing helpers ----------
  function rays(ctx, cx, cy, a, b, n, spin) {
    const R = 2400;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + (spin || 0);
      const a1 = ((i + 0.5) / n) * Math.PI * 2 + (spin || 0);
      ctx.fillStyle = i % 2 ? a : b;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R);
      ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R);
      ctx.closePath();
      ctx.fill();
    }
  }

  // printed-paper grain, the same on every render
  function grain(ctx, alpha) {
    const rng = SQ.makeRng(77);
    ctx.save();
    for (let i = 0; i < 9000; i++) {
      ctx.globalAlpha = (alpha || 0.06) * rng();
      ctx.fillStyle = rng() < 0.5 ? '#000' : '#fff';
      ctx.fillRect(rng() * PW, rng() * PH, 2, 2);
    }
    ctx.restore();
  }

  // halftone dots that shrink with distance from (fromX, fromY)
  function halftone(ctx, x, y, w, h, color, maxR, fromX, fromY) {
    const sp = maxR * 2.3;
    const diag = Math.hypot(w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = color;
    let row = 0;
    for (let py = y; py < y + h + sp; py += sp, row++) {
      for (let px = x + (row % 2) * (sp / 2); px < x + w + sp; px += sp) {
        const r = maxR * Math.max(0, 1 - Math.hypot(px - fromX, py - fromY) / diag);
        if (r < 0.6) continue;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function border(ctx, color) {
    ctx.save();
    ctx.strokeStyle = color || PAPER;
    ctx.lineWidth = 22;
    ctx.strokeRect(22, 22, PW - 44, PH - 44);
    ctx.lineWidth = 4;
    ctx.strokeRect(52, 52, PW - 104, PH - 104);
    ctx.restore();
  }

  function text(ctx, str, x, y, size, fill, o) {
    o = o || {};
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    const font = (sz) => `${o.weight || ''} ${sz}px ${o.body ? SQ.fontBody : SQ.fontDisplay}`;
    ctx.font = font(size);
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = 'middle';
    if (o.max) {
      const w = ctx.measureText(str).width;
      if (w > o.max) {
        size = Math.floor((size * o.max) / w);
        ctx.font = font(size);
      }
    }
    ctx.lineJoin = 'round';
    if (o.shadow) {
      ctx.fillStyle = o.shadow;
      ctx.fillText(str, size * 0.06, size * 0.06);
    }
    if (o.stroke) {
      ctx.lineWidth = o.stroke;
      ctx.strokeStyle = o.strokeColor || INK;
      ctx.strokeText(str, 0, 0);
    }
    ctx.fillStyle = fill;
    ctx.fillText(str, 0, 0);
    ctx.restore();
  }

  function stamp(ctx, str, x, y, rot, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = 0.85;
    ctx.font = `44px ${SQ.fontDisplay}`;
    const w = ctx.measureText(str).width + 60;
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.strokeRect(-w / 2, -44, w, 88);
    ctx.lineWidth = 3;
    ctx.strokeRect(-w / 2 + 10, -34, w - 20, 68);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(str, 0, 3);
    ctx.restore();
  }

  // darken (k < 0) or lighten (k > 0) a hex color
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k));
    return `rgb(${ch[0]},${ch[1]},${ch[2]})`;
  }

  // a ribbon banner with folded tails
  function ribbon(ctx, str, cx, cy, w, h, color, fg) {
    const tail = h * 0.9;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6;
    for (const s of [-1, 1]) {
      const x0 = cx + s * (w / 2 - tail * 0.5);
      const x1 = cx + s * (w / 2 + tail);
      ctx.fillStyle = shade(color, -0.35);
      ctx.beginPath();
      ctx.moveTo(x0, cy - h / 2 + h * 0.25);
      ctx.lineTo(x1, cy - h / 2 + h * 0.25);
      ctx.lineTo(x1 - s * tail * 0.45, cy + h * 0.25);
      ctx.lineTo(x1, cy + h / 2 + h * 0.25);
      ctx.lineTo(x0, cy + h / 2 + h * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
    ctx.restore();
    text(ctx, str, cx, cy + 3, h * 0.5, fg, { max: w - 50 });
  }

  // the Frame: a floating square border with an eye in it
  function frameEye(ctx, x, y, s, look) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = s * 0.07;
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-s * 0.36, 0);
    ctx.quadraticCurveTo(0, -s * 0.3, s * 0.36, 0);
    ctx.quadraticCurveTo(0, s * 0.3, -s * 0.36, 0);
    ctx.fill();
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.arc((look || 0) * s * 0.05, 0, s * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc((look || 0) * s * 0.05, 0, s * 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function footer(ctx, handle, color, line) {
    text(ctx, line || 'BY ORDER OF THE FRAME', PW / 2, PH - 150, 30, color, { body: true, weight: 700 });
    text(ctx, handle, PW / 2, PH - 105, 40, color);
  }

  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  function star(ctx, x, y, r, color) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.18);
    ctx.stroke();
  }

  // ---------- the poster mascot ----------
  // A chunky cube with a face, centred on (x, y) with a front face of size s.
  // o: { t (team), face: glare|shout|smug|scared|happy|grin, shades, cap, blush, legs,
  //      pose: point|megaphone|salute|thumb|offer, lookX, lookY, rot, squash }
  // With pose 'offer', o.hand is set to the hand position relative to (x, y).
  function mascot(ctx, x, y, s, o) {
    o = o || {};
    const t = o.t || dc();
    const h = s / 2;
    const d = s * 0.16;
    const lw = Math.max(3, s * 0.034);
    ctx.save();
    ctx.translate(x, y);
    if (o.rot) ctx.rotate(o.rot);
    if (o.squash) {
      ctx.translate(0, h);
      ctx.scale(1 + o.squash, 1 - o.squash);
      ctx.translate(0, -h);
    }
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw;

    if (o.legs) {
      for (const sx of [-1, 1]) {
        ctx.fillStyle = t.dark;
        ctx.fillRect(sx * s * 0.2 - s * 0.035, h - 2, s * 0.07, s * 0.14);
        ctx.strokeRect(sx * s * 0.2 - s * 0.035, h - 2, s * 0.07, s * 0.14);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.ellipse(sx * s * 0.23, h + s * 0.15, s * 0.1, s * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = t.dark;
        ctx.lineWidth = lw * 0.6;
        ctx.stroke();
        ctx.strokeStyle = INK;
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.ellipse(sx * s * 0.23 - s * 0.03, h + s * 0.135, s * 0.035, s * 0.015, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.lineWidth = lw;
    }

    // top and side faces sit behind the front, so it reads as a cube
    ctx.fillStyle = t.light;
    poly(ctx, [[-h, -h], [-h + d, -h - d], [h + d, -h - d], [h, -h]]);
    ctx.fill();
    ctx.stroke();
    const side = [[h, -h], [h + d, -h - d], [h + d, h - d], [h, h]];
    ctx.fillStyle = t.dark;
    poly(ctx, side);
    ctx.fill();
    ctx.save();
    ctx.clip();
    halftone(ctx, h, -h - d, d, s + d, 'rgba(0,0,0,0.35)', s * 0.018, h + d, h);
    ctx.restore();
    poly(ctx, side);
    ctx.stroke();
    ctx.fillStyle = t.color;
    ctx.fillRect(-h, -h, s, s);
    // printed shading on the front: a highlight band and a dotted shadow corner
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(-h + lw, -h + lw, s - lw * 2, s * 0.09);
    halftone(ctx, -h, -h, s, s, 'rgba(0,0,0,0.13)', s * 0.016, h, h);
    ctx.strokeRect(-h, -h, s, s);

    face(ctx, s, o, t.color);
    if (o.cap) cap(ctx, s, d);
    if (o.pose) pose(ctx, s, d, o, t.color);
    ctx.restore();
  }

  // lid line [outer, inner] and optional brow line [outer, inner], in eye radii from the eye centre
  const BROWS = {
    glare: [{ lid: [-0.95, -0.15] }, { lid: [-0.95, -0.15] }],
    shout: [{ lid: [-1.05, -0.5] }, { lid: [-1.05, -0.5] }],
    smug: [{ lid: [-0.35, -0.35] }, { brow: [-1.45, -1.3] }],
    scared: [{ brow: [-1.25, -1.6] }, { brow: [-1.25, -1.6] }],
    grin: [{ brow: [-1.4, -1.25] }, { brow: [-1.4, -1.25] }],
  };

  function face(ctx, s, o, col) {
    const lw = Math.max(3, s * 0.034);
    const ey = -s * 0.03;
    const kind = o.face || 'glare';
    if (o.blush) {
      ctx.fillStyle = 'rgba(255,120,170,0.5)';
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sx * s * 0.3, s * 0.14, s * 0.08, s * 0.045, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (o.shades) {
      for (const sx of [-1, 1]) {
        const cx = sx * s * 0.2;
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.17, ey - s * 0.09);
        ctx.lineTo(cx + s * 0.17, ey - s * 0.09);
        ctx.lineTo(cx + s * 0.14, ey + s * 0.06);
        ctx.quadraticCurveTo(cx, ey + s * 0.12, cx - s * 0.14, ey + s * 0.06);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        poly(ctx, [[cx - s * 0.1, ey - s * 0.07], [cx - s * 0.05, ey - s * 0.07], [cx - s * 0.1, ey + s * 0.04], [cx - s * 0.14, ey + s * 0.02]]);
        ctx.fill();
      }
      ctx.fillStyle = INK;
      ctx.fillRect(-s * 0.05, ey - s * 0.09, s * 0.1, s * 0.035);
    } else if (kind === 'happy') {
      ctx.lineWidth = lw * 1.4;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(sx * s * 0.2, ey + s * 0.03, s * 0.09, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
      ctx.lineWidth = lw;
    } else {
      const br = BROWS[kind] || BROWS.glare;
      const big = kind === 'shout' || kind === 'scared';
      const rx = s * (big ? 0.14 : 0.125);
      const ry = s * (big ? 0.165 : 0.15);
      [-1, 1].forEach((sx, i) => {
        const cx = sx * s * 0.2;
        const lid = br[i].lid;
        const brow = br[i].brow || [lid[0] - 0.12, lid[1] - 0.12];
        const ox = cx + sx * rx * 1.25;
        const ix = cx - sx * rx * 1.25;
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, ey, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.clip();
        const pr = rx * (kind === 'scared' ? 0.3 : 0.5);
        const px = cx + (o.lookX || 0) * rx * 0.45;
        const py = ey + (o.lookY || 0) * ry * 0.4 + (lid ? ry * 0.2 : 0);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(px - pr * 0.35, py - pr * 0.35, pr * 0.28, 0, Math.PI * 2);
        ctx.fill();
        if (lid) {
          ctx.fillStyle = col;
          poly(ctx, [[ox, ey + lid[0] * ry], [ix, ey + lid[1] * ry], [ix, ey - ry * 2], [ox, ey - ry * 2]]);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(ox, ey + lid[0] * ry);
          ctx.lineTo(ix, ey + lid[1] * ry);
          ctx.stroke();
        }
        ctx.restore();
        ctx.beginPath();
        ctx.ellipse(cx, ey, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = lw * 2.3;
        ctx.beginPath();
        ctx.moveTo(ox + sx * rx * 0.05, ey + brow[0] * ry);
        ctx.lineTo(ix - sx * rx * 0.05, ey + brow[1] * ry);
        ctx.stroke();
        ctx.lineWidth = lw;
      });
    }

    const my = s * 0.25;
    if (kind === 'shout') {
      ctx.beginPath();
      ctx.moveTo(-s * 0.17, my - s * 0.07);
      ctx.lineTo(s * 0.17, my - s * 0.07);
      ctx.quadraticCurveTo(s * 0.15, my + s * 0.17, 0, my + s * 0.17);
      ctx.quadraticCurveTo(-s * 0.15, my + s * 0.17, -s * 0.17, my - s * 0.07);
      ctx.closePath();
      ctx.fillStyle = '#3a0b14';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-s * 0.2, my - s * 0.08, s * 0.4, s * 0.05);
      ctx.fillStyle = '#ff7d95';
      ctx.beginPath();
      ctx.ellipse(0, my + s * 0.16, s * 0.1, s * 0.06, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.stroke();
    } else if (kind === 'grin' || kind === 'happy' || o.shades) {
      ctx.beginPath();
      ctx.moveTo(-s * 0.19, my - s * 0.04);
      ctx.quadraticCurveTo(0, my - s * 0.01, s * 0.19, my - s * 0.05);
      ctx.quadraticCurveTo(s * 0.13, my + s * 0.13, 0, my + s * 0.13);
      ctx.quadraticCurveTo(-s * 0.13, my + s * 0.13, -s * 0.19, my - s * 0.04);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.lineWidth = lw * 0.6;
      for (const tx of [-0.09, 0, 0.09]) {
        ctx.beginPath();
        ctx.moveTo(tx * s, my - s * 0.05);
        ctx.lineTo(tx * s, my + s * 0.14);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, my + s * 0.045);
      ctx.lineTo(s * 0.2, my + s * 0.04);
      ctx.stroke();
      ctx.restore();
      ctx.lineWidth = lw;
      ctx.stroke();
    } else if (kind === 'scared') {
      ctx.fillStyle = '#3a0b14';
      ctx.beginPath();
      ctx.ellipse(0, my + s * 0.02, s * 0.05, s * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#bff3ff';
      ctx.beginPath();
      ctx.moveTo(s * 0.4, -s * 0.38);
      ctx.quadraticCurveTo(s * 0.47, -s * 0.26, s * 0.4, -s * 0.22);
      ctx.quadraticCurveTo(s * 0.33, -s * 0.26, s * 0.4, -s * 0.38);
      ctx.fill();
      ctx.stroke();
    } else if (kind === 'smug') {
      ctx.lineWidth = lw * 1.4;
      ctx.beginPath();
      ctx.moveTo(-s * 0.15, my + s * 0.02);
      ctx.quadraticCurveTo(s * 0.04, my + s * 0.08, s * 0.2, my - s * 0.06);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s * 0.18, my - s * 0.1);
      ctx.lineTo(s * 0.23, my - s * 0.03);
      ctx.stroke();
      ctx.lineWidth = lw;
    } else {
      ctx.lineWidth = lw * 1.5;
      ctx.beginPath();
      ctx.moveTo(-s * 0.13, my + s * 0.04);
      ctx.quadraticCurveTo(0, my - s * 0.01, s * 0.13, my + s * 0.04);
      ctx.stroke();
      ctx.lineWidth = lw;
    }
  }

  // officer cap sitting on the top face
  function cap(ctx, s, d) {
    const cx = d * 0.5;
    const cy = -s / 2 - s * 0.01;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.36, cy + s * 0.02);
    ctx.lineTo(cx - s * 0.5, cy - s * 0.2);
    ctx.quadraticCurveTo(cx, cy - s * 0.38, cx + s * 0.5, cy - s * 0.2);
    ctx.lineTo(cx + s * 0.36, cy + s * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = RED;
    ctx.fillRect(cx - s * 0.37, cy - s * 0.06, s * 0.74, s * 0.08);
    ctx.strokeRect(cx - s * 0.37, cy - s * 0.06, s * 0.74, s * 0.08);
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.4, cy + s * 0.02);
    ctx.quadraticCurveTo(cx, cy + s * 0.14, cx + s * 0.4, cy + s * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.3, cy + s * 0.04);
    ctx.quadraticCurveTo(cx, cy + s * 0.1, cx + s * 0.1, cy + s * 0.07);
    ctx.quadraticCurveTo(cx, cy + s * 0.07, cx - s * 0.3, cy + s * 0.04);
    ctx.fill();
    star(ctx, cx, cy - s * 0.14, s * 0.075, GOLD);
  }

  function arm(ctx, pts, s, col) {
    const w = s * 0.1;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [c, ww] of [[INK, w], [col, w - Math.max(3, s * 0.034) * 2]]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = ww;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  function glove(ctx, x, y, r) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function pose(ctx, s, d, o, col) {
    const h = s / 2;
    const lw = Math.max(3, s * 0.034);
    ctx.lineWidth = lw;
    if (o.pose === 'point') {
      // a big fist pointing straight at the viewer
      const hx = s * 0.12;
      const hy = s * 0.63;
      const R = s * 0.17;
      arm(ctx, [[h + d * 0.4, s * 0.15], [h + s * 0.25, s * 0.6], [hx + R * 0.5, hy + R * 0.3]], s, col);
      // fist seen from the front: folded fingers below, index finger aimed at the viewer
      ctx.fillStyle = '#ffffff';
      SQ.roundRect(ctx, hx - R, hy - R * 0.55, R * 2, R * 1.5, R * 0.55);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = lw * 0.7;
      for (const k of [-0.45, 0.05, 0.55]) {
        ctx.beginPath();
        ctx.moveTo(hx + k * R, hy + R * 0.35);
        ctx.lineTo(hx + k * R, hy + R * 0.9);
        ctx.stroke();
      }
      ctx.lineWidth = lw;
      // thumb tucked across the front
      ctx.fillStyle = '#ffffff';
      SQ.roundRect(ctx, hx - R * 1.05, hy + R * 0.05, R * 1.3, R * 0.45, R * 0.22);
      ctx.fill();
      ctx.stroke();
      // the index finger, foreshortened: a round tip with a little shading
      const fx = hx + R * 0.05;
      const fy = hy - R * 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(fx, fy, R * 0.58, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath();
      ctx.arc(fx, fy, R * 0.58 - lw / 2, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.arc(fx, fy - R * 0.08, R * 0.46, 0.85 * Math.PI, 0.15 * Math.PI, true);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.beginPath();
      ctx.arc(fx - R * 0.2, fy - R * 0.2, R * 0.09, 0, Math.PI * 2);
      ctx.fill();
    } else if (o.pose === 'megaphone') {
      const gx = h + s * 0.2;
      const gy = s * 0.04;
      const a = -0.35;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const P = (lx, ly) => [gx + lx * c - ly * sn, gy + lx * sn + ly * c];
      const grip = P(s * 0.08, s * 0.1);
      arm(ctx, [[h + d * 0.4, s * 0.2], [h + s * 0.12, s * 0.3], grip], s, col);
      ctx.fillStyle = GOLD;
      poly(ctx, [P(-s * 0.06, -s * 0.045), P(0, -s * 0.05), P(s * 0.44, -s * 0.18), P(s * 0.44, s * 0.18), P(0, s * 0.05), P(-s * 0.06, s * 0.045)]);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = RED;
      poly(ctx, [P(s * 0.22, -s * 0.11), P(s * 0.3, -s * 0.137), P(s * 0.3, s * 0.137), P(s * 0.22, s * 0.11)]);
      ctx.fill();
      ctx.stroke();
      const B = P(s * 0.44, 0);
      ctx.fillStyle = shade(GOLD, -0.4);
      ctx.beginPath();
      ctx.ellipse(B[0], B[1], s * 0.05, s * 0.18, a, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      glove(ctx, grip[0], grip[1], s * 0.075);
      ctx.lineWidth = lw * 1.3;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(B[0], B[1], s * (0.1 + i * 0.1), a - 0.5, a + 0.5);
        ctx.stroke();
      }
      ctx.lineWidth = lw;
    } else if (o.pose === 'salute') {
      const g = [s * 0.34, -s * 0.44];
      arm(ctx, [[h + d * 0.4, s * 0.15], [h + s * 0.45, -s * 0.05], g], s, col);
      ctx.save();
      ctx.translate(g[0], g[1]);
      ctx.rotate(-0.5);
      ctx.fillStyle = '#ffffff';
      SQ.roundRect(ctx, -s * 0.13, -s * 0.06, s * 0.26, s * 0.12, s * 0.05);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if (o.pose === 'thumb' || o.pose === 'offer') {
      const g = [h + s * 0.32, o.pose === 'thumb' ? s * 0.02 : s * 0.12];
      arm(ctx, [[h + d * 0.4, s * 0.2], [h + s * 0.2, s * 0.25], g], s, col);
      if (o.pose === 'offer') {
        glove(ctx, g[0], g[1], s * 0.08);
        o.hand = g;
      } else {
        ctx.fillStyle = '#ffffff';
        SQ.roundRect(ctx, g[0] - s * 0.045, g[1] - s * 0.22, s * 0.08, s * 0.18, s * 0.04);
        ctx.fill();
        ctx.stroke();
        SQ.roundRect(ctx, g[0] - s * 0.1, g[1] - s * 0.08, s * 0.2, s * 0.16, s * 0.05);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = lw * 0.6;
        for (const k of [-0.02, 0.025]) {
          ctx.beginPath();
          ctx.moveTo(g[0] + s * 0.03, g[1] + k * s);
          ctx.lineTo(g[0] + s * 0.1, g[1] + k * s);
          ctx.stroke();
        }
        ctx.lineWidth = lw;
      }
    }
  }

  // an old television set, with drawShow painting what is on the air
  function tv(ctx, x, y, w, h, drawShow) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 8;
    for (const [ax, ay] of [[x - 120, y - h / 2 - 80], [x + 150, y - h / 2 - 95]]) {
      ctx.beginPath();
      ctx.moveTo(x, y - h / 2);
      ctx.lineTo(ax, ay);
      ctx.stroke();
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.arc(ax, ay, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.lineWidth = 10;
    ctx.fillStyle = INK;
    ctx.fillRect(x - w / 2 + 70, y + h / 2 - 5, 60, 42);
    ctx.fillRect(x + w / 2 - 130, y + h / 2 - 5, 60, 42);
    ctx.fillStyle = '#a45a2f';
    SQ.roundRect(ctx, x - w / 2, y - h / 2, w, h, 46);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    SQ.roundRect(ctx, x - w / 2 + 20, y - h / 2 + 12, w - 40, 22, 11);
    ctx.fill();
    const sx = x - w / 2 + 40;
    const sy = y - h / 2 + 40;
    const sw = w - 220;
    const sh = h - 80;
    ctx.save();
    SQ.roundRect(ctx, sx, sy, sw, sh, 40);
    const g = ctx.createRadialGradient(sx + sw / 2, sy + sh / 2, 20, sx + sw / 2, sy + sh / 2, sw * 0.7);
    g.addColorStop(0, '#4fb3a6');
    g.addColorStop(1, '#0d2b2a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    drawShow(sx + sw / 2, sy + sh / 2, sw, sh);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let yy = sy; yy < sy + sh; yy += 7) ctx.fillRect(sx, yy, sw, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    poly(ctx, [[sx, sy], [sx + sw * 0.45, sy], [sx, sy + sh * 0.6]]);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 10;
    SQ.roundRect(ctx, sx, sy, sw, sh, 40);
    ctx.stroke();
    const kx = x + w / 2 - 90;
    for (const ky of [sy + 70, sy + 190]) {
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(kx, ky, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(kx, ky);
      ctx.lineTo(kx + 22, ky - 22);
      ctx.stroke();
    }
    ctx.lineWidth = 7;
    for (let yy = sy + 280; yy < sy + sh - 20; yy += 26) {
      ctx.beginPath();
      ctx.moveTo(kx - 44, yy);
      ctx.lineTo(kx + 44, yy);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- the posters ----------
  const POSTERS = [
    {
      id: 'wants-you',
      name: 'DoucheCube wants you',
      draw(ctx, h) {
        ctx.fillStyle = PAPER;
        ctx.fillRect(0, 0, PW, PH);
        rays(ctx, PW / 2, 760, '#ead0a6', PAPER, 36);
        halftone(ctx, 0, 0, PW, PH, 'rgba(160,40,40,0.12)', 9, 0, PH);
        text(ctx, dc().name.toUpperCase(), PW / 2, 165, 118, RED, { shadow: INK, max: PW - 170 });
        text(ctx, 'WANTS YOU', PW / 2, 292, 140, INK, { max: PW - 170 });
        mascot(ctx, 510, 745, 360, { face: 'glare', cap: true, pose: 'point', lookY: 0.2 });
        ribbon(ctx, 'TO WATCH THE TRINITY GAMES', PW / 2, 1090, 820, 92, RED, PAPER);
        footer(ctx, h, INK, 'NEW GAMES EVERY DAY · BY ORDER OF THE FRAME');
        grain(ctx, 0.08);
        border(ctx, INK);
      },
    },
    {
      id: 'volunteer',
      name: 'Volunteer for Sector Ember',
      draw(ctx, h) {
        ctx.fillStyle = RED;
        ctx.fillRect(0, 0, PW, PH);
        rays(ctx, 420, 780, '#c01f35', RED, 28, 0.05);
        ctx.fillStyle = PAPER;
        ctx.beginPath();
        ctx.arc(420, 760, 330, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.beginPath();
        ctx.arc(420, 760, 330, 0, Math.PI * 2);
        ctx.clip();
        halftone(ctx, 90, 430, 660, 660, 'rgba(215,38,61,0.3)', 8, 750, 1090);
        ctx.restore();
        ctx.fillStyle = INK;
        poly(ctx, [[0, 1000], [PW, 860], [PW, PH], [0, PH]]);
        ctx.fill();
        text(ctx, 'VOLUNTEER!', PW / 2, 200, 150, PAPER, { stroke: 18, rot: -0.07, max: PW - 150 });
        text(ctx, 'SECTOR EMBER NEEDS YOU', PW / 2, 335, 56, GOLD, { stroke: 12, rot: -0.07, max: PW - 180 });
        mascot(ctx, 380, 790, 340, { face: 'shout', cap: true, pose: 'megaphone', rot: -0.05, lookX: 0.5, lookY: -0.3 });
        text(ctx, 'Take their place. Win their peace.', PW / 2, 1110, 50, PAPER, { body: true, weight: 700, max: PW - 180 });
        footer(ctx, h, PAPER);
        grain(ctx, 0.07);
        border(ctx, PAPER);
      },
    },
    {
      id: 'tune-in',
      name: 'Tune in every cycle',
      draw(ctx, h) {
        ctx.fillStyle = '#1c5c5a';
        ctx.fillRect(0, 0, PW, PH);
        rays(ctx, PW / 2, 760, '#206865', '#1c5c5a', 32);
        text(ctx, 'TUNE IN', PW / 2, 170, 170, GOLD, { stroke: 18, shadow: INK });
        text(ctx, 'EVERY CYCLE', PW / 2, 305, 76, PAPER, { stroke: 12 });
        tv(ctx, PW / 2, 750, 820, 540, (cx, cy) => {
          mascot(ctx, cx - 30, cy + 40, 240, { face: 'grin', shades: true, pose: 'thumb', cap: true });
        });
        text(ctx, 'Watching is patriotic.', PW / 2, 1115, 54, PAPER, { body: true, weight: 700, stroke: 8 });
        footer(ctx, h, PAPER, 'NEW GAMES EVERY DAY · BY ORDER OF THE FRAME');
        grain(ctx, 0.07);
        border(ctx, PAPER);
      },
    },
    {
      id: 'follow',
      name: 'Follow for the Games',
      draw(ctx, h) {
        ctx.fillStyle = GOLD;
        ctx.fillRect(0, 0, PW, PH);
        rays(ctx, PW / 2, 790, '#ffc61a', GOLD, 40);
        halftone(ctx, 0, 0, PW, PH, 'rgba(215,38,61,0.22)', 11, PW, 0);
        text(ctx, 'FOLLOW', PW / 2, 180, 200, INK, { shadow: RED });
        text(ctx, 'FOR THE GAMES', PW / 2, 318, 76, RED, { stroke: 10 });
        mascot(ctx, 500, 790, 390, { face: 'smug', cap: true, pose: 'thumb', lookX: -0.2 });
        text(ctx, 'Loyal viewers get one extra cycle of peace.', PW / 2, 1085, 40, INK, { body: true, weight: 700, max: PW - 180 });
        footer(ctx, h, INK, '(IT IS NOT OPTIONAL)');
        grain(ctx, 0.07);
        border(ctx, INK);
      },
    },
    {
      id: 'share',
      name: 'Send this to a friend',
      draw(ctx, h) {
        ctx.fillStyle = PAPER;
        ctx.fillRect(0, 0, PW, PH);
        rays(ctx, 700, 760, '#ead0a6', PAPER, 30, 0.2);
        text(ctx, 'SEND THIS TO', PW / 2, 160, 100, INK, { max: PW - 170 });
        text(ctx, 'A FRIEND WHO', PW / 2, 268, 100, INK, { max: PW - 170 });
        text(ctx, 'WOULD LOSE.', PW / 2, 378, 112, RED, { shadow: INK, max: PW - 170 });
        mascot(ctx, 360, 800, 330, { face: 'shout', cap: true, pose: 'megaphone', legs: true, lookX: 0.6 });
        text(ctx, 'Sharing is mandatory. So is losing.', PW / 2, 1110, 44, INK, { body: true, weight: 700, max: PW - 180 });
        footer(ctx, h, INK);
        grain(ctx, 0.08);
        border(ctx, INK);
      },
    },
    {
      id: 'frame-watching',
      name: 'The Frame is watching',
      draw(ctx, h) {
        ctx.fillStyle = '#12101c';
        ctx.fillRect(0, 0, PW, PH);
        rays(ctx, PW / 2, 330, '#1d1930', '#12101c', 40);
        frameEye(ctx, PW / 2, 330, 340, -0.4);
        text(ctx, 'THE FRAME', PW / 2, 600, 130, '#ffffff', { stroke: 14 });
        text(ctx, 'IS WATCHING', PW / 2, 725, 110, RED, { stroke: 14 });
        mascot(ctx, 520, 945, 170, { face: 'glare', cap: true, pose: 'salute', legs: true, lookY: -0.8 });
        text(ctx, 'SO SHOULD YOU', PW / 2, 1122, 52, GOLD, { stroke: 8 });
        footer(ctx, h, '#cfc8e6', 'THE TRINITY GAMES · LIVE EVERY CYCLE');
        grain(ctx, 0.08);
        border(ctx, '#cfc8e6');
      },
    },
    {
      id: 'pick-a-side',
      name: 'Pick a color, pick a side',
      draw(ctx, h) {
        ctx.fillStyle = PAPER;
        ctx.fillRect(0, 0, PW, PH);
        rays(ctx, PW / 2, 820, '#e6d6b4', PAPER, 30);
        text(ctx, 'PICK A COLOR.', PW / 2, 170, 110, INK, { max: PW - 170 });
        text(ctx, 'PICK A SIDE.', PW / 2, 290, 110, RED, { shadow: INK, max: PW - 170 });
        const others = SQ.TEAMS.filter((t) => t.base !== 'Red');
        const faces = ['glare', 'scared', 'smug', 'shout', 'grin', 'glare', 'happy'];
        others.forEach((t, i) => {
          const a = Math.PI + (i / (others.length - 1)) * Math.PI;
          const x = PW / 2 + Math.cos(a) * 375;
          const y = 830 + Math.sin(a) * 330;
          mascot(ctx, x, y, 118, { t, face: faces[i % faces.length], lookX: (PW / 2 - x) / 300, lookY: 0.4 });
        });
        mascot(ctx, PW / 2 - 20, 870, 270, { face: 'grin', shades: true, cap: true, pose: 'thumb' });
        text(ctx, 'Comment your color. The Frame is counting.', PW / 2, 1100, 42, INK, { body: true, weight: 700, max: PW - 180 });
        footer(ctx, h, INK);
        grain(ctx, 0.08);
        border(ctx, INK);
      },
    },
    {
      id: 'wanted-cyan',
      name: 'Wanted: Cyan',
      draw(ctx, h) {
        ctx.fillStyle = '#e8d5ac';
        ctx.fillRect(0, 0, PW, PH);
        halftone(ctx, 0, 0, PW, PH, 'rgba(74,46,23,0.12)', 10, PW, PH);
        text(ctx, 'WANTED', PW / 2, 190, 190, '#4a2e17', { max: PW - 150 });
        text(ctx, 'FOR RUNNING AWAY 214 TIMES', PW / 2, 330, 50, '#4a2e17', { max: PW - 170 });
        ctx.fillStyle = '#d9c192';
        ctx.fillRect(PW / 2 - 300, 400, 600, 520);
        ctx.strokeStyle = '#4a2e17';
        ctx.lineWidth = 8;
        ctx.strokeRect(PW / 2 - 300, 400, 600, 520);
        mascot(ctx, PW / 2 - 20, 680, 300, { t: team('Cyan'), face: 'scared', lookX: 0.9 });
        text(ctx, `"${team('Cyan').name.toUpperCase()}" OF SECTOR COOLANT`, PW / 2, 990, 48, '#4a2e17', { max: PW - 170 });
        text(ctx, 'REWARD: 500 PIXELS', PW / 2, 1065, 64, RED, { max: PW - 170 });
        stamp(ctx, `SIGNED: ${dc().name.toUpperCase()}`, PW / 2 + 60, 1172, -0.05, RED);
        text(ctx, h, PW / 2, PH - 88, 36, '#4a2e17');
        grain(ctx, 0.12);
        border(ctx, '#4a2e17');
      },
    },
    {
      id: 'lava-random',
      name: 'The lava is random',
      draw(ctx, h) {
        ctx.fillStyle = '#1a1210';
        ctx.fillRect(0, 0, PW, PH);
        const g = ctx.createLinearGradient(0, 940, 0, PH);
        g.addColorStop(0, '#ff6a2b');
        g.addColorStop(1, '#7a1206');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, PH);
        for (let x = 0; x <= PW; x += 20) ctx.lineTo(x, 970 + Math.sin(x * 0.02) * 22 + Math.sin(x * 0.047) * 10);
        ctx.lineTo(PW, PH);
        ctx.fill();
        ctx.fillStyle = '#ffb347';
        for (const [bx, by, br] of [[180, 1040, 16], [860, 1010, 12], [640, 1060, 9], [330, 1000, 8]]) {
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, Math.PI * 2);
          ctx.fill();
        }
        text(ctx, 'THE LAVA', PW / 2, 180, 150, '#ff6a2b', { stroke: 16 });
        text(ctx, 'IS RANDOM', PW / 2, 330, 130, PAPER, { stroke: 16 });
        text(ctx, '(probably)', PW / 2, 425, 50, GOLD, { body: true, weight: 700 });
        ctx.fillStyle = '#8f9bb8';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 6;
        ctx.fillRect(PW / 2 - 230, 850, 460, 26);
        ctx.strokeRect(PW / 2 - 230, 850, 460, 26);
        mascot(ctx, PW / 2 - 20, 677, 250, { face: 'grin', shades: true, cap: true, pose: 'thumb', legs: true });
        text(ctx, 'Trust the Frame. Keep falling.', PW / 2, 1125, 50, PAPER, { body: true, weight: 700, stroke: 8 });
        text(ctx, h, PW / 2, PH - 100, 40, PAPER, { stroke: 8 });
        grain(ctx, 0.07);
        border(ctx, PAPER);
      },
    },
    {
      id: 'obey-bounce',
      name: 'Obey the bounce',
      draw(ctx, h) {
        ctx.fillStyle = '#1c2340';
        ctx.fillRect(0, 0, PW, PH);
        halftone(ctx, 0, 0, PW, PH, 'rgba(255,255,255,0.06)', 10, 0, 0);
        ctx.strokeStyle = 'rgba(255,255,255,0.28)';
        ctx.lineWidth = 10;
        ctx.setLineDash([2, 28]);
        ctx.lineCap = 'round';
        ctx.beginPath();
        const pts = [[90, 520], [990, 690], [120, 860], [700, 980]];
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
        ctx.stroke();
        ctx.setLineDash([]);
        text(ctx, 'OBEY', PW / 2, 200, 210, GOLD, { stroke: 20, shadow: RED });
        text(ctx, 'THE BOUNCE', PW / 2, 370, 110, PAPER, { stroke: 14 });
        ctx.strokeStyle = PAPER;
        ctx.lineWidth = 10;
        for (const lx of [-90, 0, 90]) {
          ctx.beginPath();
          ctx.moveTo(720 + lx, 500 + Math.abs(lx) * 0.3);
          ctx.lineTo(720 + lx, 560 + Math.abs(lx) * 0.3);
          ctx.stroke();
        }
        mascot(ctx, 700, 830, 290, { face: 'glare', cap: true, squash: 0.12, lookX: -0.8, lookY: 0.4 });
        mascot(ctx, 290, 960, 150, { t: team('Yellow'), face: 'happy', squash: -0.1 });
        text(ctx, 'Every bounce is mandatory.', PW / 2, 1120, 50, PAPER, { body: true, weight: 700, stroke: 8 });
        footer(ctx, h, '#b8c3e6');
        grain(ctx, 0.07);
        border(ctx, '#b8c3e6');
      },
    },
    {
      id: 'sweets-mandatory',
      name: 'Sweets are mandatory',
      draw(ctx, h) {
        ctx.fillStyle = '#ffd6ea';
        ctx.fillRect(0, 0, PW, PH);
        rays(ctx, PW / 2, 780, '#ffc2df', '#ffd6ea', 32);
        halftone(ctx, 0, 0, PW, PH, 'rgba(160,40,110,0.1)', 10, 0, 0);
        text(ctx, 'SWEETS ARE', PW / 2, 175, 120, '#a0286e', { max: PW - 170 });
        text(ctx, 'MANDATORY', PW / 2, 305, 130, INK, { shadow: '#ff6ac1', max: PW - 170 });
        const pink = { t: team('Pink'), face: 'happy', pose: 'offer', blush: true };
        mascot(ctx, 330, 790, 280, pink);
        SQ.drawEmoji(ctx, '🍬', 330 + pink.hand[0], 790 + pink.hand[1] - 60, 90);
        mascot(ctx, 790, 820, 230, { face: 'glare', cap: true, lookX: -1, lookY: 0.2 });
        text(ctx, 'Sector Candy thanks you for your cooperation.', PW / 2, 1090, 40, INK, { body: true, weight: 700, max: PW - 180 });
        footer(ctx, h, '#a0286e');
        grain(ctx, 0.06);
        border(ctx, '#a0286e');
      },
    },
  ];

  SQ.POSTERS = POSTERS;
  SQ.drawPoster = function (canvas, id, handle) {
    const p = POSTERS.find((x) => x.id === id);
    canvas.width = PW;
    canvas.height = PH;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    p.draw(ctx, handle || '@squeretrinity');
  };
})();
