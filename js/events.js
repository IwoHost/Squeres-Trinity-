// Special events: on certain days the squares dress up and the screen gets a few decorations.
// "Auto" picks the event from today's date (Polish dates for the family days); any event can also
// be forced from the Look tab or the script. Nothing here flashes; decorations only drift slowly.
(function () {
  const SQ = window.SQ;

  // m: month 1-12. A range runs from..to inclusive. Single days win over ranges.
  SQ.EVENTS = {
    grandma: { name: "Grandma's Day", tag: "GRANDMA'S DAY", on: [1, 21] },
    grandpa: { name: "Grandpa's Day", tag: "GRANDPA'S DAY", on: [1, 22] },
    mother: { name: "Mother's Day", tag: "MOTHER'S DAY", on: [5, 26] },
    father: { name: "Father's Day", tag: "FATHER'S DAY", on: [6, 23] },
    summer: { name: 'Summer', tag: 'SUMMER CYCLE', from: [6, 24], to: [8, 31] },
    halloween: { name: 'Halloween', tag: 'HALLOWEEN CYCLE', from: [10, 25], to: [10, 31] },
    independence: { name: 'Polish Independence Day', tag: 'INDEPENDENCE DAY', on: [11, 11] },
    birthday: { name: 'Birthday', tag: 'BIRTHDAY CYCLE', on: [11, 29] },
  };
  for (const id in SQ.EVENTS) SQ.EVENTS[id].id = id;

  SQ.eventForDate = function (date) {
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const v = m * 100 + d;
    let range = null;
    for (const id in SQ.EVENTS) {
      const e = SQ.EVENTS[id];
      if (e.on && e.on[0] === m && e.on[1] === d) return e;
      if (e.from && v >= e.from[0] * 100 + e.from[1] && v <= e.to[0] * 100 + e.to[1]) range = e;
    }
    return range;
  };
  // setting: 'auto', 'off' or an event id
  SQ.resolveEvent = (setting, date) => (setting === 'off' ? null : SQ.EVENTS[setting] || (setting === 'auto' || !setting ? SQ.eventForDate(date || new Date()) : null));
  SQ.event = null;

  // ---------------- costumes ----------------
  // Drawn on top of the square in its own coordinates: centred, from -s/2 to s/2, eyes at (±0.2s, -0.04s).
  const OUT = '#14141c';
  function poly(ctx, pts, fill, line) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (line) {
      ctx.lineWidth = line;
      ctx.strokeStyle = OUT;
      ctx.stroke();
    }
  }
  function circle(ctx, x, y, r, fill, line) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (line) {
      ctx.lineWidth = line;
      ctx.strokeStyle = OUT;
      ctx.stroke();
    }
  }
  const top = (s) => -s / 2;

  function partyHat(ctx, s, team) {
    const h = s / 2;
    const lw = s * 0.03;
    ctx.save();
    ctx.translate(s * 0.12, -h + s * 0.02);
    ctx.rotate(0.22);
    poly(ctx, [[-s * 0.2, 0], [s * 0.2, 0], [0, -s * 0.55]], team.light, lw);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = team.dark;
    for (let i = 0; i < 3; i++) ctx.fillRect(-s * 0.3, -s * (0.1 + i * 0.16), s * 0.6, s * 0.06);
    ctx.restore();
    circle(ctx, 0, -s * 0.57, s * 0.07, '#ffffff', lw * 0.8);
    ctx.restore();
  }
  function witchHat(ctx, s) {
    const h = s / 2;
    const lw = s * 0.03;
    poly(ctx, [[-s * 0.48, -h + s * 0.04], [s * 0.48, -h + s * 0.04], [s * 0.42, -h - s * 0.04], [-s * 0.42, -h - s * 0.04]], '#3d2a5c', lw);
    poly(ctx, [[-s * 0.26, -h - s * 0.02], [s * 0.26, -h - s * 0.02], [s * 0.18, -h - s * 0.42], [s * 0.36, -h - s * 0.6], [-s * 0.02, -h - s * 0.46]], '#3d2a5c', lw);
    ctx.fillStyle = '#ff8f33';
    ctx.fillRect(-s * 0.25, -h - s * 0.12, s * 0.5, s * 0.07);
  }
  function horns(ctx, s) {
    const h = s / 2;
    for (const sx of [-1, 1]) poly(ctx, [[sx * s * 0.3, -h + s * 0.03], [sx * s * 0.12, -h + s * 0.03], [sx * s * 0.34, -h - s * 0.26]], '#4a0710', s * 0.03);
  }
  function catEars(ctx, s) {
    const h = s / 2;
    for (const sx of [-1, 1]) {
      poly(ctx, [[sx * s * 0.42, -h + s * 0.04], [sx * s * 0.14, -h + s * 0.04], [sx * s * 0.36, -h - s * 0.24]], '#1b1b22', s * 0.03);
      poly(ctx, [[sx * s * 0.36, -h + s * 0.02], [sx * s * 0.2, -h + s * 0.02], [sx * s * 0.34, -h - s * 0.14]], '#ff9ac9');
    }
    ctx.strokeStyle = 'rgba(20,20,28,0.8)';
    ctx.lineWidth = s * 0.018;
    for (const sx of [-1, 1]) {
      for (const dy of [-0.02, 0.05]) {
        ctx.beginPath();
        ctx.moveTo(sx * s * 0.16, s * (0.14 + dy * 0.5));
        ctx.lineTo(sx * s * 0.44, s * (0.1 + dy));
        ctx.stroke();
      }
    }
  }
  function bolts(ctx, s) {
    const lw = s * 0.025;
    for (const sx of [-1, 1]) {
      poly(ctx, [[sx * s * 0.5, s * 0.06], [sx * s * 0.62, s * 0.06], [sx * s * 0.62, s * 0.18], [sx * s * 0.5, s * 0.18]], '#8b93a6', lw);
      poly(ctx, [[sx * s * 0.62, s * 0.03], [sx * s * 0.68, s * 0.03], [sx * s * 0.68, s * 0.21], [sx * s * 0.62, s * 0.21]], '#b9c0cf', lw);
    }
    // stitches across the forehead
    ctx.strokeStyle = OUT;
    ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, -s * 0.3);
    ctx.lineTo(s * 0.3, -s * 0.3);
    for (let i = -2; i <= 2; i++) {
      ctx.moveTo(i * s * 0.12, -s * 0.35);
      ctx.lineTo(i * s * 0.12, -s * 0.25);
    }
    ctx.stroke();
  }
  function bandages(ctx, s) {
    const h = s / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-h, -h, s, s);
    ctx.clip();
    ctx.fillStyle = 'rgba(240,236,222,0.88)';
    for (const [y, a] of [[-0.36, -0.12], [-0.24, 0.08], [0.26, -0.1], [0.4, 0.14]]) {
      ctx.save();
      ctx.translate(0, s * y);
      ctx.rotate(a);
      ctx.fillRect(-s * 0.7, -s * 0.05, s * 1.4, s * 0.1);
      ctx.restore();
    }
    ctx.restore();
  }
  function vampire(ctx, s) {
    const h = s / 2;
    // a tall collar behind the cheeks, and fangs
    for (const sx of [-1, 1]) poly(ctx, [[sx * s * 0.5, s * 0.1], [sx * s * 0.72, -s * 0.22], [sx * s * 0.62, h], [sx * s * 0.5, h]], '#7a0f1e', s * 0.03);
    for (const sx of [-1, 1]) poly(ctx, [[sx * s * 0.1, s * 0.2], [sx * s * 0.02, s * 0.2], [sx * s * 0.06, s * 0.3]], '#ffffff', s * 0.015);
  }
  function pumpkin(ctx, s) {
    const h = s / 2;
    ctx.strokeStyle = 'rgba(120,50,0,0.45)';
    ctx.lineWidth = s * 0.03;
    for (const x of [-0.3, 0, 0.3]) {
      ctx.beginPath();
      ctx.moveTo(x * s, -h + s * 0.06);
      ctx.quadraticCurveTo(x * s * 1.25, 0, x * s, h - s * 0.06);
      ctx.stroke();
    }
    poly(ctx, [[-s * 0.06, -h + s * 0.04], [s * 0.06, -h + s * 0.04], [s * 0.1, -h - s * 0.16], [s * 0.0, -h - s * 0.18]], '#3f7d2a', s * 0.03);
    ctx.save();
    ctx.translate(s * 0.16, -h - s * 0.08);
    ctx.rotate(-0.4);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.12, s * 0.05, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#5bb33b';
    ctx.fill();
    ctx.restore();
  }
  function batWings(ctx, s) {
    const h = s / 2;
    for (const sx of [-1, 1]) {
      poly(
        ctx,
        [[sx * s * 0.12, -h + s * 0.04], [sx * s * 0.5, -h - s * 0.22], [sx * s * 0.46, -h - s * 0.08], [sx * s * 0.36, -h - s * 0.1], [sx * s * 0.32, -h], [sx * s * 0.22, -h - s * 0.02]],
        '#3d2a5c',
        s * 0.02
      );
    }
  }
  function strawHat(ctx, s) {
    const h = s / 2;
    ctx.beginPath();
    ctx.ellipse(0, -h + s * 0.02, s * 0.62, s * 0.11, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#e8c374';
    ctx.fill();
    ctx.lineWidth = s * 0.03;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    poly(ctx, [[-s * 0.3, -h], [s * 0.3, -h], [s * 0.24, -h - s * 0.26], [-s * 0.24, -h - s * 0.26]], '#efcd85', s * 0.03);
    ctx.fillStyle = '#e04a4a';
    ctx.fillRect(-s * 0.29, -h - s * 0.08, s * 0.58, s * 0.07);
  }
  function shades(ctx, s) {
    ctx.fillStyle = '#101018';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sx * s * 0.2, -s * 0.04, s * 0.16, s * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillRect(-s * 0.06, -s * 0.07, s * 0.12, s * 0.03);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (const sx of [-1, 1]) ctx.fillRect(sx * s * 0.2 - s * 0.09, -s * 0.1, s * 0.05, s * 0.03);
  }
  function goggles(ctx, s) {
    ctx.fillStyle = '#ff8f33';
    ctx.fillRect(-s * 0.5, -s * 0.07, s, s * 0.06);
    for (const sx of [-1, 1]) circle(ctx, sx * s * 0.2, -s * 0.04, s * 0.16, 'rgba(160,230,255,0.35)', s * 0.035);
    // snorkel
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = s * 0.06;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.42, s * 0.05);
    ctx.lineTo(s * 0.42, -s * 0.5);
    ctx.stroke();
  }
  function hibiscus(ctx, s, color) {
    const h = s / 2;
    ctx.save();
    ctx.translate(s * 0.32, -h + s * 0.06);
    for (let i = 0; i < 5; i++) {
      ctx.rotate((Math.PI * 2) / 5);
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.09, s * 0.07, s * 0.1, 0, 0, Math.PI * 2);
      ctx.fillStyle = color || '#ff5d8f';
      ctx.fill();
    }
    circle(ctx, 0, 0, s * 0.045, '#ffe066');
    ctx.restore();
  }
  function tulip(ctx, s) {
    const h = s / 2;
    ctx.save();
    ctx.translate(s * 0.36, -h + s * 0.02);
    ctx.rotate(0.25);
    ctx.strokeStyle = '#3f9d4a';
    ctx.lineWidth = s * 0.035;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.12);
    ctx.lineTo(0, -s * 0.14);
    ctx.stroke();
    poly(ctx, [[-s * 0.09, -s * 0.12], [-s * 0.09, -s * 0.28], [-s * 0.03, -s * 0.22], [0, -s * 0.3], [s * 0.03, -s * 0.22], [s * 0.09, -s * 0.28], [s * 0.09, -s * 0.12], [0, -s * 0.06]], '#ff4f7b', s * 0.02);
    ctx.restore();
    // a little blush
    ctx.fillStyle = 'rgba(255,110,150,0.35)';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sx * s * 0.3, s * 0.14, s * 0.07, s * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function tie(ctx, s, color) {
    const h = s / 2;
    poly(ctx, [[-s * 0.06, h - s * 0.2], [s * 0.06, h - s * 0.2], [s * 0.04, h - s * 0.12], [-s * 0.04, h - s * 0.12]], color, s * 0.02);
    poly(ctx, [[-s * 0.04, h - s * 0.12], [s * 0.04, h - s * 0.12], [s * 0.09, h + s * 0.14], [0, h + s * 0.22], [-s * 0.09, h + s * 0.14]], color, s * 0.02);
  }
  function mustache(ctx, s, color) {
    ctx.fillStyle = color;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sx * s * 0.08, s * 0.13, s * 0.1, s * 0.045, sx * -0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function roundGlasses(ctx, s) {
    ctx.strokeStyle = '#3b2f2a';
    ctx.lineWidth = s * 0.025;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sx * s * 0.2, -s * 0.04, s * 0.155, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-s * 0.05, -s * 0.06);
    ctx.lineTo(s * 0.05, -s * 0.06);
    ctx.stroke();
  }
  function bun(ctx, s) {
    const h = s / 2;
    circle(ctx, 0, -h - s * 0.08, s * 0.14, '#c9ccd6', s * 0.03);
    ctx.fillStyle = '#c9ccd6';
    ctx.fillRect(-s * 0.46, -h, s * 0.92, s * 0.1);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = s * 0.03;
    ctx.strokeRect(-s * 0.46, -h, s * 0.92, s * 0.1);
  }
  function flatCap(ctx, s) {
    const h = s / 2;
    poly(ctx, [[-s * 0.46, -h + s * 0.08], [s * 0.4, -h + s * 0.08], [s * 0.66, -h + s * 0.02], [s * 0.4, -h - s * 0.12], [-s * 0.38, -h - s * 0.12]], '#5b5146', s * 0.03);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = s * 0.02;
    ctx.beginPath();
    ctx.moveTo(-s * 0.3, -h - s * 0.06);
    ctx.lineTo(s * 0.34, -h - s * 0.06);
    ctx.stroke();
  }
  function cockade(ctx, s) {
    const h = s / 2;
    const x = s * 0.32;
    const y = -h + s * 0.14;
    // the ribbon tails, then the white and red rings
    poly(ctx, [[x - s * 0.04, y], [x - s * 0.12, y + s * 0.2], [x - s * 0.04, y + s * 0.16]], '#dc143c', s * 0.015);
    poly(ctx, [[x + s * 0.04, y], [x + s * 0.12, y + s * 0.2], [x + s * 0.04, y + s * 0.16]], '#ffffff', s * 0.015);
    circle(ctx, x, y, s * 0.13, '#ffffff', s * 0.02);
    circle(ctx, x, y, s * 0.08, '#dc143c');
    circle(ctx, x, y, s * 0.03, '#ffffff');
  }

  const COSTUMES = {
    halloween: { Red: horns, Green: bolts, Blue: bandages, Yellow: catEars, Purple: witchHat, Cyan: vampire, Orange: pumpkin, Pink: batWings },
    summer: { Red: strawHat, Green: (c, s) => hibiscus(c, s, '#ff5d8f'), Blue: shades, Yellow: strawHat, Purple: shades, Cyan: goggles, Orange: strawHat, Pink: (c, s) => hibiscus(c, s, '#ffd23f') },
    mother: tulip,
    father: (c, s, t) => (tie(c, s, t.dark), mustache(c, s, '#3a2a20')),
    grandma: (c, s) => (roundGlasses(c, s), bun(c, s)),
    grandpa: (c, s) => (flatCap(c, s), mustache(c, s, '#d8dae2')),
    independence: cockade,
    birthday: partyHat,
  };

  // Called from SQ.drawSquare. The grey square never dresses up.
  SQ.drawCostume = function (ctx, s, team, o) {
    const e = SQ.event;
    if (!e || s < 18 || !team || !SQ.PERSONAS[team.base] || o.face === false) return;
    const c = COSTUMES[e.id];
    const fn = typeof c === 'function' ? c : c && c[team.base];
    if (!fn) return;
    ctx.save();
    ctx.lineJoin = 'round';
    fn(ctx, s, team, o);
    ctx.restore();
  };

  // ---------------- decorations ----------------
  // Drawn over the backdrop, under the arena and the text. Everything moves slowly and smoothly.
  SQ.drawEventDecor = function (ctx, t) {
    const e = SQ.event;
    if (!e) return;
    const W = SQ.W;
    const H = SQ.H;
    const R = (i, k) => {
      const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
      return v - Math.floor(v);
    };
    ctx.save();
    if (e.id === 'halloween') {
      // an orange glow rising from the bottom, and bats drifting across
      const g = ctx.createLinearGradient(0, H * 0.55, 0, H);
      g.addColorStop(0, 'rgba(255,120,30,0)');
      g.addColorStop(1, 'rgba(255,120,30,0.16)');
      ctx.fillStyle = g;
      ctx.fillRect(0, H * 0.55, W, H * 0.45);
      ctx.fillStyle = 'rgba(10,8,14,0.85)';
      for (let i = 0; i < 7; i++) {
        const sp = 40 + R(i, 1) * 50;
        const x = ((R(i, 2) * (W + 200) + t * sp) % (W + 200)) - 100;
        const y = (i < 4 ? 140 + R(i, 3) * 230 : H - 400 + R(i, 3) * 300) + Math.sin(t * 1.3 + i) * 14;
        const sz = 18 + R(i, 4) * 16;
        const flap = Math.sin(t * 7 + i * 2) * 0.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x - sz * 0.6, y - sz * (0.5 + flap), x - sz * 1.3, y - sz * (0.1 + flap));
        ctx.quadraticCurveTo(x - sz * 0.7, y + sz * 0.05, x, y + sz * 0.25);
        ctx.quadraticCurveTo(x + sz * 0.7, y + sz * 0.05, x + sz * 1.3, y - sz * (0.1 + flap));
        ctx.quadraticCurveTo(x + sz * 0.6, y - sz * (0.5 + flap), x, y);
        ctx.fill();
      }
    } else if (e.id === 'summer') {
      const g = ctx.createRadialGradient(W * 0.85, 60, 10, W * 0.85, 60, 520);
      g.addColorStop(0, 'rgba(255,210,90,0.28)');
      g.addColorStop(1, 'rgba(255,210,90,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, 640);
    } else if (e.id === 'birthday' || e.id === 'independence' || e.id === 'mother') {
      // slowly falling confetti, white-red flakes or petals
      const cols = e.id === 'birthday' ? ['#ff4d5e', '#ffd23f', '#35d97a', '#4f86ff', '#ff6ac1', '#1fd6f0'] : e.id === 'independence' ? ['#ffffff', '#dc143c'] : ['#ff9ac9', '#ffc4e6', '#ff6ac1'];
      for (let i = 0; i < 46; i++) {
        const sp = 40 + R(i, 1) * 40;
        const y = ((R(i, 2) * (H + 60) + t * sp) % (H + 60)) - 30;
        const x = R(i, 3) * W + Math.sin(t * 0.8 + i) * 30;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * (0.6 + R(i, 4)) + i);
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = cols[i % cols.length];
        if (e.id === 'mother') {
          ctx.beginPath();
          ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(-7, -3.5, 14, 7);
        ctx.restore();
      }
    } else if (e.id === 'father' || e.id === 'grandma' || e.id === 'grandpa') {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(255,200,140,0.07)');
      g.addColorStop(1, 'rgba(255,200,140,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  };

  // An extra caption line and hashtag for the event, in the same dry voice.
  SQ.eventCaption = function (e, d) {
    if (!e) return null;
    const lines = {
      halloween: d.ninthSeen ? 'Everyone dressed up for Halloween. One of them did not.' : 'The Frame allowed costumes this week. It did not allow mercy.',
      summer: 'Summer in the Grid. The arena does not have air conditioning.',
      mother: "Happy Mother's Day. Somewhere in every Sector a mother is watching. She does not like this show.",
      father: "Happy Father's Day. Every square here wanted to make its dad proud.",
      grandma: "Happy Grandma's Day. She knitted everyone a sweater. Nobody survived long enough to wear it.",
      grandpa: "Happy Grandpa's Day. He says the Games were harder in his day.",
      independence: '11 November. Polish Independence Day. Even the Grid takes a moment.',
      birthday: 'Someone in the control room has a birthday today. The Frame allowed hats.',
    };
    const tags = { halloween: '#halloween', summer: '#summer', mother: '#mothersday', father: '#fathersday', grandma: '#dzienbabci', grandpa: '#dziendziadka', independence: '#11listopada', birthday: '#birthday' };
    return { line: lines[e.id], tag: tags[e.id] };
  };
})();
