// Special events: on certain days the squares dress up and the screen gets a few decorations.
// "Auto" picks the event from today's date (Polish dates where it matters, Easter-based ones too); any event can also
// be forced from the Look tab or the script. Nothing here flashes; decorations only drift slowly.
(function () {
  const SQ = window.SQ;

  // When each event is on. Dates are Polish where it matters. When two overlap, the shorter one wins
  // (Christmas beats winter, a single day beats a week).
  const day = (m, d) => ({ len: 1, test: (dt) => dt.getMonth() + 1 === m && dt.getDate() === d });
  const span = (m1, d1, m2, d2) => {
    const a = m1 * 100 + d1;
    const b = m2 * 100 + d2;
    const len = a <= b ? (m2 - m1) * 31 + d2 - d1 + 1 : (12 - m1 + m2) * 31 + d2 - d1 + 1;
    return { len, test: (dt) => {
      const v = (dt.getMonth() + 1) * 100 + dt.getDate();
      return a <= b ? v >= a && v <= b : v >= a || v <= b; // a span can run over New Year
    } };
  };
  // Easter Sunday of a year (Gregorian computus)
  SQ.easterDate = function (y) {
    const a = y % 19;
    const b = Math.floor(y / 100);
    const c = y % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const n = h + l - 7 * m + 114;
    return new Date(y, Math.floor(n / 31) - 1, (n % 31) + 1);
  };
  // days counted from Easter Sunday: Fat Thursday is 52 days before, Easter Monday 1 day after
  const easter = (from, len) => ({ len: len || 1, test: (dt) => {
    const e = SQ.easterDate(dt.getFullYear());
    const diff = Math.round((new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()) - e) / 86400000);
    return diff >= from && diff < from + (len || 1);
  } });

  SQ.EVENTS = {
    newyear: { name: 'New Year', tag: 'NEW YEAR CYCLE', dates: 'Dec 31 - Jan 1', when: span(12, 31, 1, 1) },
    grandma: { name: "Grandma's Day", tag: "GRANDMA'S DAY", dates: 'Jan 21', when: day(1, 21) },
    grandpa: { name: "Grandpa's Day", tag: "GRANDPA'S DAY", dates: 'Jan 22', when: day(1, 22) },
    valentine: { name: "Valentine's Day", tag: "VALENTINE'S CYCLE", dates: 'Feb 14', when: day(2, 14) },
    fatthursday: { name: 'Fat Thursday', tag: 'FAT THURSDAY', dates: 'Thursday before Lent', when: easter(-52) },
    womensday: { name: "Women's Day", tag: "WOMEN'S DAY", dates: 'Mar 8', when: day(3, 8) },
    aprilfools: { name: "April Fools' Day", tag: 'NOTHING IS WRONG', dates: 'Apr 1', when: day(4, 1) },
    easter: { name: 'Easter', tag: 'EASTER CYCLE', dates: 'Easter Saturday and Sunday', when: easter(-1, 2) },
    smigus: { name: 'Smigus-dyngus', tag: 'WET MONDAY', dates: 'Easter Monday', when: easter(1) },
    constitution: { name: 'Constitution Day', tag: '3 MAJA', dates: 'May 3', when: day(5, 3) },
    mother: { name: "Mother's Day", tag: "MOTHER'S DAY", dates: 'May 26', when: day(5, 26) },
    childrensday: { name: "Children's Day", tag: "CHILDREN'S DAY", dates: 'Jun 1', when: day(6, 1) },
    father: { name: "Father's Day", tag: "FATHER'S DAY", dates: 'Jun 23', when: day(6, 23) },
    summer: { name: 'Summer', tag: 'SUMMER CYCLE', dates: 'Jun 24 - Aug 31', when: span(6, 24, 8, 31) },
    halloween: { name: 'Halloween', tag: 'HALLOWEEN CYCLE', dates: 'Oct 25-31', when: span(10, 25, 10, 31) },
    // a day of remembrance: no greeting or decorations on matches; the daily tool makes a quiet video instead
    allsaints: { name: "All Saints' Day", tag: 'ALL SAINTS', dates: 'Nov 1-2', when: span(11, 1, 11, 2), respect: true },
    independence: { name: 'Polish Independence Day', tag: 'INDEPENDENCE DAY', dates: 'Nov 11', when: day(11, 11) },
    birthday: { name: 'Birthday', tag: 'BIRTHDAY CYCLE', dates: 'Nov 29', when: day(11, 29) },
    mikolajki: { name: 'St. Nicholas Day', tag: 'MIKOLAJKI', dates: 'Dec 6', when: day(12, 6) },
    christmas: { name: 'Christmas', tag: 'CHRISTMAS CYCLE', dates: 'Dec 24-26', when: span(12, 24, 12, 26) },
    winter: { name: 'Winter', tag: 'WINTER CYCLE', dates: 'Dec 1 - Feb 28', when: span(12, 1, 2, 29) },
    friday13: { name: 'Friday the 13th', tag: 'FRIDAY THE 13TH', dates: 'any Friday the 13th', when: { len: 1, test: (dt) => dt.getDay() === 5 && dt.getDate() === 13 } },
  };
  // the greeting shown on screen and at the start of the title, and the edition named in the caption
  const HI = {
    newyear: 'Happy New Year', grandma: "Happy Grandma's Day", grandpa: "Happy Grandpa's Day", valentine: "Happy Valentine's Day",
    fatthursday: 'Happy Fat Thursday', womensday: "Happy Women's Day", aprilfools: 'Nothing is wrong', easter: 'Happy Easter',
    smigus: 'Happy Smigus-dyngus', constitution: 'Happy Constitution Day', mother: "Happy Mother's Day", childrensday: "Happy Children's Day",
    father: "Happy Father's Day", summer: 'Happy summer', halloween: 'Happy Halloween', allsaints: 'We remember',
    independence: 'Happy Independence Day', birthday: 'Happy birthday', mikolajki: 'Happy St. Nicholas Day', christmas: 'Merry Christmas',
    winter: 'Stay warm', friday13: 'Good luck',
  };
  const EDITION = { aprilfools: 'Regular edition', friday13: 'Friday the 13th edition', allsaints: "All Saints' edition" };
  for (const id in SQ.EVENTS) {
    const e = SQ.EVENTS[id];
    e.id = id;
    e.hi = HI[id] || e.name;
    e.edition = EDITION[id] || `${e.name} edition`;
  }

  SQ.eventForDate = function (date) {
    let best = null;
    for (const id in SQ.EVENTS) {
      const e = SQ.EVENTS[id];
      if (e.when.test(date) && (!best || e.when.len < best.when.len)) best = e;
    }
    return best;
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

  function santaHat(ctx, s, body, brim) {
    const h = s / 2;
    const lw = s * 0.03;
    ctx.beginPath();
    ctx.moveTo(-s * 0.42, -h + s * 0.06);
    ctx.quadraticCurveTo(-s * 0.1, -h - s * 0.5, s * 0.42, -h - s * 0.3);
    ctx.quadraticCurveTo(s * 0.2, -h - s * 0.12, s * 0.42, -h + s * 0.06);
    ctx.closePath();
    ctx.fillStyle = body || '#e0262f';
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    SQ.roundRect(ctx, -s * 0.5, -h - s * 0.02, s, s * 0.13, s * 0.06);
    ctx.fillStyle = brim || '#f4f4f4';
    ctx.fill();
    ctx.stroke();
    circle(ctx, s * 0.44, -h - s * 0.3, s * 0.08, brim || '#f4f4f4', lw);
  }
  function antlers(ctx, s) {
    const h = s / 2;
    ctx.strokeStyle = '#7a4b25';
    ctx.lineWidth = s * 0.055;
    ctx.lineCap = 'round';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * s * 0.22, -h + s * 0.02);
      ctx.lineTo(sx * s * 0.34, -h - s * 0.3);
      ctx.moveTo(sx * s * 0.29, -h - s * 0.16);
      ctx.lineTo(sx * s * 0.46, -h - s * 0.22);
      ctx.moveTo(sx * s * 0.32, -h - s * 0.24);
      ctx.lineTo(sx * s * 0.22, -h - s * 0.36);
      ctx.stroke();
    }
    circle(ctx, 0, s * 0.1, s * 0.08, '#e0262f', s * 0.02);
  }
  function topHat(ctx, s) {
    const h = s / 2;
    const lw = s * 0.03;
    ctx.save();
    ctx.translate(s * 0.08, 0);
    ctx.rotate(0.12);
    poly(ctx, [[-s * 0.4, -h + s * 0.04], [s * 0.4, -h + s * 0.04], [s * 0.4, -h - s * 0.03], [-s * 0.4, -h - s * 0.03]], '#141418', lw);
    poly(ctx, [[-s * 0.26, -h - s * 0.02], [s * 0.26, -h - s * 0.02], [s * 0.24, -h - s * 0.42], [-s * 0.24, -h - s * 0.42]], '#141418', lw);
    ctx.fillStyle = '#e8c04a';
    ctx.fillRect(-s * 0.255, -h - s * 0.12, s * 0.51, s * 0.07);
    ctx.restore();
  }
  function heart(ctx, x, y, r, fill) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.9);
    ctx.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.7, y - r * 1.3, x, y - r * 0.45);
    ctx.bezierCurveTo(x + r * 0.7, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function hearts(ctx, s) {
    const h = s / 2;
    heart(ctx, s * 0.3, -h - s * 0.1, s * 0.13, '#ff3d6e');
    ctx.lineWidth = s * 0.02;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,90,140,0.4)';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sx * s * 0.3, s * 0.14, s * 0.07, s * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function clown(ctx, s) {
    const h = s / 2;
    const cols = ['#ff4d5e', '#ffd23f', '#35d97a', '#4f86ff', '#c06bff'];
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) circle(ctx, sx * (s * 0.48 + i * s * 0.03), -h + s * (0.12 + i * 0.14), s * 0.1, cols[(i + (sx > 0 ? 2 : 0)) % cols.length], s * 0.02);
    circle(ctx, 0, s * 0.1, s * 0.09, '#ff2a3a', s * 0.02);
    circle(ctx, -s * 0.03, s * 0.07, s * 0.025, 'rgba(255,255,255,0.7)');
  }
  function frosting(ctx, s) {
    const h = s / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-h, -h, s, s);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(-h, -h);
    ctx.lineTo(h, -h);
    const drips = [0.16, 0.26, 0.12, 0.3, 0.14, 0.22];
    for (let i = drips.length - 1; i >= 0; i--) {
      const x0 = -h + (s * (i + 1)) / drips.length;
      const x1 = -h + (s * i) / drips.length;
      ctx.quadraticCurveTo((x0 + x1) / 2, -h + s * drips[i] * 1.6, x1, -h + s * 0.1);
    }
    ctx.closePath();
    ctx.fillStyle = '#ff9ac9';
    ctx.fill();
    const sp = ['#ffffff', '#ffd23f', '#35d97a', '#4f86ff'];
    for (let i = 0; i < 9; i++) {
      ctx.save();
      ctx.translate(-h + s * (0.08 + 0.1 * i), -h + s * (0.05 + (i % 3) * 0.03));
      ctx.rotate(i * 1.7);
      ctx.fillStyle = sp[i % sp.length];
      ctx.fillRect(-s * 0.025, -s * 0.008, s * 0.05, s * 0.016);
      ctx.restore();
    }
    ctx.restore();
  }
  function bunnyEars(ctx, s) {
    const h = s / 2;
    for (const sx of [-1, 1]) {
      ctx.save();
      ctx.translate(sx * s * 0.2, -h + s * 0.04);
      ctx.rotate(sx * 0.18);
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.24, s * 0.1, s * 0.26, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#f6f6f8';
      ctx.fill();
      ctx.lineWidth = s * 0.025;
      ctx.strokeStyle = OUT;
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.24, s * 0.05, s * 0.18, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffb3cf';
      ctx.fill();
      ctx.restore();
    }
  }
  function soaked(ctx, s) {
    const h = s / 2;
    ctx.fillStyle = 'rgba(150,215,255,0.85)';
    for (const [x, y, r] of [[-0.3, -0.36, 0.05], [0.34, -0.2, 0.04], [0.12, 0.36, 0.045], [-0.38, 0.2, 0.035]]) {
      ctx.beginPath();
      ctx.moveTo(x * s, y * s - r * s * 1.8);
      ctx.quadraticCurveTo(x * s + r * s * 1.1, y * s, x * s, y * s + r * s);
      ctx.quadraticCurveTo(x * s - r * s * 1.1, y * s, x * s, y * s - r * s * 1.8);
      ctx.fill();
    }
    // a wet sheen down the face
    ctx.fillStyle = 'rgba(160,220,255,0.18)';
    ctx.fillRect(-h, -h, s, s * 0.35);
  }
  function propellerCap(ctx, s) {
    const h = s / 2;
    const cols = ['#ff4d5e', '#ffd23f', '#35d97a', '#4f86ff'];
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, -h + s * 0.04);
      ctx.arc(0, -h + s * 0.04, s * 0.3, Math.PI + (i * Math.PI) / 4, Math.PI + ((i + 1) * Math.PI) / 4);
      ctx.closePath();
      ctx.fillStyle = cols[i];
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, -h + s * 0.04, s * 0.3, Math.PI, 0);
    ctx.lineWidth = s * 0.025;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    ctx.fillStyle = '#444';
    ctx.fillRect(-s * 0.015, -h - s * 0.36, s * 0.03, s * 0.12);
    ctx.fillStyle = '#ff4d5e';
    ctx.beginPath();
    ctx.ellipse(0, -h - s * 0.36, s * 0.22, s * 0.04, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }
  function beanie(ctx, s, team) {
    const h = s / 2;
    const lw = s * 0.03;
    ctx.beginPath();
    ctx.arc(0, -h + s * 0.08, s * 0.42, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = team.light;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = OUT;
    ctx.stroke();
    SQ.roundRect(ctx, -s * 0.46, -h, s * 0.92, s * 0.14, s * 0.05);
    ctx.fillStyle = team.dark;
    ctx.fill();
    ctx.stroke();
    circle(ctx, 0, -h - s * 0.36, s * 0.09, '#f4f4f4', lw);
    // a scarf in the same colors
    ctx.fillStyle = team.dark;
    ctx.fillRect(-h, s * 0.32, s, s * 0.12);
    ctx.fillStyle = team.light;
    for (let i = 0; i < 5; i++) ctx.fillRect(-h + s * (0.06 + i * 0.2), s * 0.32, s * 0.07, s * 0.12);
    ctx.fillStyle = team.dark;
    ctx.fillRect(s * 0.22, s * 0.36, s * 0.12, s * 0.26);
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
    newyear: topHat,
    valentine: hearts,
    fatthursday: frosting,
    womensday: tulip,
    aprilfools: clown,
    easter: bunnyEars,
    smigus: soaked,
    constitution: cockade,
    childrensday: propellerCap,
    mikolajki: (c, s) => santaHat(c, s),
    christmas: (c, s, t) => (t.base === 'Green' || t.base === 'Cyan' ? santaHat(c, s, '#2f9e44', '#ffd23f') : t.base === 'Orange' || t.base === 'Yellow' ? antlers(c, s) : santaHat(c, s)),
    winter: beanie,
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
  const CONFETTI = {
    birthday: ['#ff4d5e', '#ffd23f', '#35d97a', '#4f86ff', '#ff6ac1', '#1fd6f0'],
    independence: ['#ffffff', '#dc143c'],
    constitution: ['#ffffff', '#dc143c'],
    mother: ['#ff9ac9', '#ffc4e6', '#ff6ac1'],
    womensday: ['#ff9ac9', '#ffc4e6', '#ffe066'],
    newyear: ['#e8c04a', '#f5e6a8', '#c9ccd6', '#ffffff'],
    fatthursday: ['#ff9ac9', '#ffffff', '#ffd23f', '#35d97a', '#4f86ff'],
    easter: ['#bfe8c4', '#ffe7a3', '#ffc4e6', '#c9d8ff'],
  };
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
    } else if (CONFETTI[e.id]) {
      // slowly falling confetti, flakes or petals
      const cols = CONFETTI[e.id];
      const petals = e.id === 'mother' || e.id === 'womensday';
      for (let i = 0; i < 46; i++) {
        const sp = 40 + R(i, 1) * 40;
        const y = ((R(i, 2) * (H + 60) + t * sp) % (H + 60)) - 30;
        const x = R(i, 3) * W + Math.sin(t * 0.8 + i) * 30;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * (0.6 + R(i, 4)) + i);
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = cols[i % cols.length];
        if (petals) {
          ctx.beginPath();
          ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        } else ctx.fillRect(-7, -3.5, 14, 7);
        ctx.restore();
      }
    } else if (e.id === 'christmas' || e.id === 'mikolajki' || e.id === 'winter') {
      // soft snow, and a cold blue tint at the top
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.4);
      g.addColorStop(0, 'rgba(150,190,255,0.12)');
      g.addColorStop(1, 'rgba(150,190,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H * 0.4);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 70; i++) {
        const sp = 25 + R(i, 1) * 35;
        const y = ((R(i, 2) * (H + 40) + t * sp) % (H + 40)) - 20;
        const x = R(i, 3) * W + Math.sin(t * 0.6 + i * 1.3) * 22;
        ctx.beginPath();
        ctx.arc(x, y, 2 + R(i, 4) * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (e.id === 'valentine' || e.id === 'childrensday') {
      // hearts or balloons drifting upwards
      const cols = e.id === 'valentine' ? ['#ff3d6e', '#ff7aa0', '#ffb3c8'] : ['#ff4d5e', '#ffd23f', '#35d97a', '#4f86ff', '#ff6ac1'];
      for (let i = 0; i < 16; i++) {
        const sp = 30 + R(i, 1) * 30;
        const y = H + 60 - ((R(i, 2) * (H + 160) + t * sp) % (H + 160));
        const x = R(i, 3) * W + Math.sin(t * 0.7 + i) * 26;
        ctx.globalAlpha = 0.45;
        if (e.id === 'valentine') heart(ctx, x, y, 14 + R(i, 4) * 12, cols[i % cols.length]);
        else {
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, y + 30);
          ctx.quadraticCurveTo(x + 8, y + 55, x, y + 80);
          ctx.stroke();
          ctx.fillStyle = cols[i % cols.length];
          ctx.beginPath();
          ctx.ellipse(x, y, 22, 28, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    } else if (e.id === 'smigus') {
      // water drops falling
      ctx.fillStyle = 'rgba(140,205,255,0.5)';
      for (let i = 0; i < 40; i++) {
        const sp = 160 + R(i, 1) * 120;
        const y = ((R(i, 2) * (H + 60) + t * sp) % (H + 60)) - 30;
        const x = R(i, 3) * W;
        ctx.beginPath();
        ctx.moveTo(x, y - 12);
        ctx.quadraticCurveTo(x + 6, y, x, y + 6);
        ctx.quadraticCurveTo(x - 6, y, x, y - 12);
        ctx.fill();
      }
    } else if (e.id === 'allsaints') {
      // a quiet evening: dimmer, and a row of grave candles along the bottom whose flames sway
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0, 0, W, H);
      const cols = ['#c21e2e', '#b3122a', '#d14b1f', '#9c1a3a'];
      for (let i = 0; i < 9; i++) {
        const x = 70 + i * ((W - 140) / 8);
        const y = H - 120;
        const g = ctx.createRadialGradient(x, y - 30, 2, x, y - 30, 70);
        g.addColorStop(0, 'rgba(255,170,60,0.22)');
        g.addColorStop(1, 'rgba(255,170,60,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 70, y - 100, 140, 140);
        ctx.fillStyle = cols[i % cols.length];
        SQ.roundRect(ctx, x - 16, y - 22, 32, 44, 6);
        ctx.fill();
        const sway = Math.sin(t * 2 + i * 1.7) * 3;
        ctx.fillStyle = '#ffcf6a';
        ctx.beginPath();
        ctx.moveTo(x, y - 26);
        ctx.quadraticCurveTo(x - 7, y - 36, x + sway, y - 52);
        ctx.quadraticCurveTo(x + 7, y - 36, x, y - 26);
        ctx.fill();
      }
    } else if (e.id === 'friday13') {
      // a darker screen, and a black cat that walks across the bottom now and then
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const x = ((t * 90) % (W + 600)) - 150;
      if (x < W + 150) {
        const y = H - 150;
        const step = Math.sin(t * 8) * 6;
        ctx.fillStyle = '#060608';
        ctx.beginPath();
        ctx.ellipse(x, y, 60, 26, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + 62, y - 22, 22, 0, Math.PI * 2);
        ctx.fill();
        poly(ctx, [[x + 48, y - 36], [x + 54, y - 58], [x + 64, y - 40]], '#060608');
        poly(ctx, [[x + 66, y - 40], [x + 78, y - 58], [x + 80, y - 34]], '#060608');
        ctx.fillRect(x - 40 + step, y + 10, 9, 34);
        ctx.fillRect(x - 15 - step, y + 10, 9, 34);
        ctx.fillRect(x + 25 + step, y + 10, 9, 34);
        ctx.fillRect(x + 42 - step, y + 10, 9, 34);
        ctx.strokeStyle = '#060608';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - 58, y - 6);
        ctx.quadraticCurveTo(x - 100, y - 30 + step, x - 92, y - 70);
        ctx.stroke();
        ctx.fillStyle = '#d6e04a';
        ctx.fillRect(x + 66, y - 26, 6, 4);
        ctx.fillRect(x + 78, y - 26, 6, 4);
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
    if (!e || e.respect) return null;
    const lines = {
      halloween: d.ninthSeen ? 'Everyone dressed up for Halloween. One of them did not.' : 'The Frame allowed costumes this week. It did not allow mercy.',
      summer: 'Summer in the Grid. The arena does not have air conditioning.',
      mother: "Happy Mother's Day. Somewhere in every Sector a mother is watching. She does not like this show.",
      father: "Happy Father's Day. Every square here wanted to make its dad proud.",
      grandma: "Happy Grandma's Day. She knitted everyone a sweater. Nobody survived long enough to wear it.",
      grandpa: "Happy Grandpa's Day. He says the Games were harder in his day.",
      independence: '11 November. Polish Independence Day. Even the Grid takes a moment.',
      birthday: 'Someone in the control room has a birthday today. The Frame allowed hats.',
      newyear: 'A new year in the Grid. Same Games. Same eight Sectors. Fewer squares.',
      valentine: "Valentine's Day. Some of them came in pairs. The Frame only lets one out.",
      fatthursday: 'Fat Thursday. Every square got a paczek. Not all of them got to eat it.',
      womensday: '8 March. Tulips for everyone in the arena, as tradition demands.',
      aprilfools: 'Nothing unusual happened in this cycle. Please disregard the noses.',
      easter: 'Easter in the Grid. The squares were told to look for eggs. There were no eggs.',
      smigus: 'Smigus-dyngus. Everyone in the arena got soaked. That is the tradition.',
      constitution: '3 May. Constitution Day. The Grid has rules too. It just never wrote them down.',
      childrensday: "Children's Day. Everyone got a propeller hat. It did not help them fly away.",
      allsaints: 'Today we remember those who are no longer with us.',
      mikolajki: 'St. Nicholas Day. Everyone got a hat. Nobody got a present.',
      christmas: 'Christmas in the Grid. The Games do not stop. They just wear hats.',
      winter: 'Winter in the Grid. The arena is not heated.',
      friday13: 'Friday the 13th. Something crossed the screen before the match. It was not a contestant.',
    };
    const tags = { halloween: '#halloween', summer: '#summer', mother: '#mothersday', father: '#fathersday', grandma: '#dzienbabci', grandpa: '#dziendziadka', independence: '#11listopada', birthday: '#birthday', newyear: '#newyear', valentine: '#valentinesday', fatthursday: '#tlustyczwartek', womensday: '#dzienkobiet', aprilfools: '#aprilfools', easter: '#easter', smigus: '#smigusdyngus', constitution: '#3maja', childrensday: '#dziendziecka', allsaints: '#wszystkichswietych', mikolajki: '#mikolajki', christmas: '#christmas', winter: '#winter', friday13: '#friday13' };
    return { line: lines[e.id], tag: tags[e.id], hi: e.hi, edition: e.edition };
  };
})();
