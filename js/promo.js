// "Meet the Sectors": a promo video that introduces the contestants instead of playing a match.
// The full version shows all eight, about 3 seconds each, and ends on a grid of them. A single
// version spotlights one square with its story. Both are recorded like a match and get a caption.
(function () {
  const SQ = window.SQ;
  const P = SQ.Game.prototype;

  const INTRO = 2.6; // "EIGHT SECTORS. ONE COMES OUT."
  const EACH = 3.2; // one square, full version
  const OUTRO = 4.6; // the grid of eight
  const SINGLE = 13; // one square with its story
  const MEMORIAL = 20; // a day of remembrance: no match, the squares stand still with candles

  // Splits text into lines that fit maxW with the current font.
  function wrap(ctx, text, maxW) {
    const lines = [];
    let line = '';
    for (const w of String(text).split(' ')) {
      const t = line ? `${line} ${w}` : w;
      if (line && ctx.measureText(t).width > maxW) {
        lines.push(line);
        line = w;
      } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }
  const nameOf = (base) => {
    const t = SQ.TEAMS.find((x) => x.base === base);
    return t ? t.name : base;
  };

  // only: a color's base name ('Red', ...) for the single version; empty for all eight
  P.newPromo = function (only) {
    this.audio.init();
    this.setPaused(false);
    this.recorder.abort();
    this.tour = null;
    this.reboot = null;
    SQ.stare = 0;
    const memorial = String(only || '').toLowerCase() === 'memorial';
    const team = only && !memorial ? SQ.TEAMS.find((t) => t.base === only || t.name.toLowerCase() === String(only).toLowerCase()) : null;
    this.promo = { team, memorial, list: SQ.TEAMS.slice(), t: 0, at: -1, ninth: null, log: [], done: false };
    this.promo.dur = memorial ? MEMORIAL : team ? SINGLE : INTRO + EACH * 8 + OUTRO;
    this.videoT = 0;
    this.playT = 0;
    this.myst = { log: [], glitches: [], hidden: null, ninth: null };
    this.fx.clear();
    this.cam.reset();
    this.video = null;
    this.setQuality(this.opts.quality);
    if (memorial) {
      // no music on a day of remembrance
      this.track = null;
      this.audio.stopMusic(0.5);
    } else {
      this.track = this.audio.pickTrack(this.opts.music);
      this.audio.intensity = 0.35;
      this.audio.playTrack(this.track);
    }
    this.trackToast = 0;
    this.setPhase('promo');
    if (this.opts.record && this.recorder.supported) {
      this.recorder.start(this.view, this.audio.streamDest && this.audio.streamDest.stream, 30, SQ.RES === 1 ? 9_000_000 : 5_000_000);
    }
    this.emit('match', { mode: { name: 'Meet the Sectors' }, seed: 0, track: this.track });
  };

  // which part of the video we are in: { kind: 'intro' | 'card' | 'grid', i, t }
  P.promoPart = function () {
    const pr = this.promo;
    if (pr.memorial) return { kind: 'memorial', t: pr.t };
    if (pr.team) return { kind: 'card', team: pr.team, i: pr.list.indexOf(pr.team), t: pr.t, len: SINGLE, single: true };
    if (pr.t < INTRO) return { kind: 'intro', t: pr.t };
    const k = pr.t - INTRO;
    const i = Math.floor(k / EACH);
    if (i < 8) return { kind: 'card', team: pr.list[i], i, t: k - i * EACH, len: EACH };
    return { kind: 'grid', t: k - 8 * EACH };
  };

  P.tickPromo = function (realDt) {
    const pr = this.promo;
    if (pr.done) {
      this.fx.update(realDt, realDt);
      this.updateGlitchFx(realDt);
      return;
    }
    pr.t += realDt;
    if (pr.memorial) {
      this.fx.update(realDt, realDt);
      if (pr.t >= pr.dur) this.finishPromo();
      return;
    }
    const part = this.promoPart();
    // a sound and a little life at the start of every card
    const key = part.kind + (part.i != null ? part.i : '');
    if (key !== pr.at) {
      pr.at = key;
      if (part.kind === 'card') {
        this.audio.whoosh();
        setTimeout(() => this.audio.babble(part.team.persona && part.team.persona.voice), 350);
      } else if (part.kind === 'grid') {
        this.audio.riser(1.2);
      } else this.audio.beep(false);
    }
    if (part.kind === 'intro') {
      const n = Math.min(8, Math.floor(part.t / 0.16));
      if (n > (pr.pops || 0)) {
        pr.pops = n;
        this.audio.pop(n);
      }
    }
    // the grid has nine places and eight contestants; for a moment the last one is not empty
    pr.ninthUp = part.kind === 'grid' && part.t > 2.3 && part.t < 3.5;
    if (pr.ninthUp && !pr.ninthLogged) {
      pr.ninthLogged = true;
      this.myst.log.push(`${SQ.fmtClock(this.videoT)} a grey square stands in the ninth place of the grid for about a second, and the camera label reads CAM 09`);
    }
    this.fx.update(realDt, realDt);
    this.updateGlitchFx(realDt);
    if (pr.t >= pr.dur - 1.4 && !pr.fading) {
      pr.fading = true;
      this.audio.stopMusic(1.4);
    }
    if (pr.t >= pr.dur) this.finishPromo();
  };

  P.promoInfo = function () {
    const pr = this.promo;
    if (pr.memorial) {
      const souls = isSouls();
      const name = `No Games Today - ${souls ? "All Souls' Day" : "All Saints' Day"} - ${new Date().toISOString().slice(0, 10)}`;
      const title = souls ? '2 November. No games today.' : '1 November. No games today.';
      const caption = `${souls ? "All Souls' Day" : "All Saints' Day"}.\nToday there are no matches. Today we remember those who are no longer with us, and light a candle for them.\nThe Games return tomorrow.`;
      const tags = souls ? '#zaduszki #allsoulsday' : '#wszystkichswietych #allsaintsday';
      return { name: name.replace(/[\\/:*?"<>|]/g, ''), file: [`TITLE\n${title}`, `CAPTION\n${caption}`, `HASHTAGS\n${tags}`].join('\n\n') };
    }
    const ev = SQ.eventCaption(SQ.event, {});
    const tags = `#squares #simulation #animation #trinitygames #lore${ev ? ' ' + ev.tag : ''}`;
    let title;
    let caption;
    let name;
    if (pr.team) {
      const t = pr.team;
      const L = SQ.LORE[t.base] || {};
      title = `${t.name} of ${L.sector || 'the Grid'}.`;
      caption = `${L.story || ''}\nRival: ${L.rival && SQ.LORE[L.rival] ? nameOf(L.rival) : L.rival || 'none'}.\nWho are you sending in?`;
      name = `Sector File - ${t.name} of ${L.sector || 'the Grid'}`;
    } else {
      title = 'Eight Sectors. One comes out.';
      caption = 'Every day the Frame takes one square from each Sector of the Grid. These are the ones it took. Pick your Sector.\nComment your color.';
      name = 'Meet the Sectors - Squares Trinity';
    }
    if (ev) {
      title = `${ev.hi}. ${title}`;
      caption = `${ev.edition}.\n${caption}\n${ev.line}`;
    }
    const lines = [`TITLE\n${title}`, `CAPTION\n${caption}`, `HASHTAGS\n${tags}`];
    if (this.myst.log.length) lines.push(`SECRETS (do not post)\n${this.myst.log.join('\n')}`);
    return { name: name.replace(/[\\/:*?"<>|]/g, ''), file: lines.join('\n\n') };
  };

  P.finishPromo = async function () {
    const pr = this.promo;
    pr.done = true;
    pr.ninthUp = false;
    this.setPhase('done');
    if (this.recorder.active) {
      const blob = await this.toMp4(await this.recorder.stop());
      if (blob && blob.size) {
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        const info = this.promoInfo();
        this.video = { blob, ext, name: `${info.name}.${ext}`, info: info.file };
      }
    }
    this.emit('done', { winner: null, video: this.video, promo: true });
  };


  // 2 November is All Souls' Day; every other day the remembrance video speaks of All Saints'
  function isSouls() {
    const d = new Date();
    return d.getMonth() === 10 && d.getDate() === 2;
  }

  // The remembrance video: no game. The eight squares stand still with their eyes closed, a candle in
  // front of each, and a few quiet lines of text appear one after another. No static, no glitches.
  // The words are about real people, never the lore: this is not a joke day.
  P.drawMemorial = function (ctx, t) {
    const A = SQ.ARENA;
    const W = SQ.W;
    const fadeIn = (from, len) => SQ.clamp((t - from) / (len || 1.2), 0, 1);
    const out = 1 - SQ.clamp((t - (MEMORIAL - 1.5)) / 1.5, 0, 1);
    const souls = isSouls();
    ctx.save();
    ctx.globalAlpha = out;
    ctx.font = `700 26px ${SQ.fontBody}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('S Q U A R E S   T R I N I T Y', W / 2, 66);
    ctx.globalAlpha = out * fadeIn(0.2);
    SQ.outlinedText(ctx, 'NO GAMES TODAY', W / 2, 210, 96, '#ece6da', { stroke: 14 });
    SQ.outlinedText(ctx, souls ? "2 NOVEMBER  ·  ALL SOULS' DAY" : "1 NOVEMBER  ·  ALL SAINTS' DAY", W / 2, 318, 38, '#cfc6b4', { stroke: 8, font: SQ.fontBody, weight: 700 });
    ctx.globalAlpha = out;
    // a quiet frame instead of the bright arena
    ctx.fillStyle = 'rgba(120,112,130,0.25)';
    ctx.fillRect(A.x - 10, A.y - 10, A.size + 20, A.size + 20);
    ctx.fillStyle = '#0c0d13';
    ctx.fillRect(A.x, A.y, A.size, A.size);
    ctx.save();
    ctx.beginPath();
    ctx.rect(A.x, A.y, A.size, A.size);
    ctx.clip();
    ctx.globalAlpha = out * fadeIn(1, 1.5);
    SQ.outlinedText(ctx, 'A MOMENT OF SILENCE', W / 2, A.y + 90, 32, 'rgba(236,230,218,0.7)', { stroke: 0, font: SQ.fontBody, weight: 700 });
    const list = this.promo.list;
    for (let i = 0; i < list.length; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = A.x + 125 + col * 250;
      const y = A.y + 270 + row * 380;
      ctx.globalAlpha = out * fadeIn(1.5 + i * 0.25, 1.5);
      SQ.drawSquare(ctx, x, y, 130, list[i], { mood: 'normal', blink: true, squash: Math.sin(this.real * 1.2 + i) * 0.01 });
      // the candle in front of each of them
      const cy = y + 112;
      const g = ctx.createRadialGradient(x, cy - 30, 2, x, cy - 30, 60);
      g.addColorStop(0, 'rgba(255,170,60,0.25)');
      g.addColorStop(1, 'rgba(255,170,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 60, cy - 90, 120, 120);
      ctx.fillStyle = '#b3122a';
      SQ.roundRect(ctx, x - 16, cy - 20, 32, 42, 6);
      ctx.fill();
      const sway = Math.sin(this.real * 2 + i * 1.7) * 3;
      ctx.fillStyle = '#ffcf6a';
      ctx.beginPath();
      ctx.moveTo(x, cy - 24);
      ctx.quadraticCurveTo(x - 7, cy - 34, x + sway, cy - 50);
      ctx.quadraticCurveTo(x + 7, cy - 34, x, cy - 24);
      ctx.fill();
      ctx.font = `700 24px ${SQ.fontBody}`;
      ctx.fillStyle = 'rgba(236,230,218,0.6)';
      ctx.fillText(list[i].name, x, cy + 52, 230);
    }
    ctx.restore();
    // the words, one after another
    const y0 = A.y + A.size + 60;
    ctx.globalAlpha = out * fadeIn(3);
    SQ.outlinedText(ctx, 'Today there are no matches.', W / 2, y0, 44, '#ffffff', { stroke: 8, font: SQ.fontBody, weight: 700 });
    ctx.globalAlpha = out * fadeIn(7);
    SQ.outlinedText(ctx, 'Today we remember those', W / 2, y0 + 68, 36, '#e6e0d4', { stroke: 7, font: SQ.fontBody, weight: 600 });
    SQ.outlinedText(ctx, 'who are no longer with us.', W / 2, y0 + 112, 36, '#e6e0d4', { stroke: 7, font: SQ.fontBody, weight: 600 });
    ctx.globalAlpha = out * fadeIn(12, 1.5);
    SQ.outlinedText(ctx, 'We remember.', W / 2, y0 + 196, 58, '#ffcf6a', { stroke: 10 });
    ctx.restore();
  };

  // ---------------- drawing ----------------
  P.drawPromo = function (ctx) {
    const pr = this.promo;
    if (pr.memorial) return this.drawMemorial(ctx, pr.done ? pr.dur - 1.6 : pr.t);
    const part = pr.done ? (pr.team ? { kind: 'card', team: pr.team, t: 99, len: 99, single: true } : { kind: 'grid', t: 99 }) : this.promoPart();
    const A = SQ.ARENA;
    const W = SQ.W;
    // header
    ctx.save();
    ctx.font = `700 26px ${SQ.fontBody}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const tagline = `${SQ.event && !SQ.event.respect ? SQ.event.edition.toUpperCase() : 'SQUARES TRINITY'}  ·  SECTOR FILES`;
    ctx.fillText(tagline.split('').join(' '), W / 2, 66, W - 120);
    ['#ff4d5e', '#35d97a', '#4f86ff'].forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(W / 2 - 90 + i * 60, 96, 60, 8);
    });
    ctx.restore();
    let head = 'MEET THE SECTORS';
    let sub = 'eight go in, one comes out';
    if (part.kind === 'card' && !part.single) {
      head = `FILE ${part.i + 1} OF 8`;
      sub = 'meet the sectors';
    } else if (part.single) {
      head = 'SECTOR FILE';
      sub = `contestant ${part.i + 1} of 8`;
    } else if (part.kind === 'grid') {
      head = 'PICK YOUR SECTOR';
      sub = 'comment your color';
    }
    SQ.outlinedText(ctx, head, W / 2, 220, SQ.fitSize(ctx, [{ t: head }], W - 120, 110), '#ffd23f', { stroke: 18 });
    SQ.outlinedText(ctx, sub.toUpperCase(), W / 2, 330, 40, '#ffffff', { stroke: 8, font: SQ.fontBody, weight: 700 });

    // the screen
    const lead = part.team ? part.team.color : '#e8d7f1';
    ctx.fillStyle = SQ.rgba(lead, 0.1);
    ctx.fillRect(A.x - 30, A.y - 30, A.size + 60, A.size + 60);
    ctx.fillStyle = lead;
    ctx.fillRect(A.x - 10, A.y - 10, A.size + 20, A.size + 20);
    ctx.save();
    ctx.beginPath();
    ctx.rect(A.x, A.y, A.size, A.size);
    ctx.clip();
    ctx.fillStyle = '#10121c';
    ctx.fillRect(A.x, A.y, A.size, A.size);
    // a faint grid, like the arena floor
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if ((x + y) % 2) ctx.fillRect(A.x + x * 100, A.y + y * 100, 100, 100);
    if (part.kind === 'intro') this.drawPromoIntro(ctx, part);
    else if (part.kind === 'card') this.drawPromoCard(ctx, part);
    else this.drawPromoGrid(ctx, part);
    ctx.restore();
    this.drawFeed(ctx);
    // below the screen
    if (part.kind === 'card') this.drawPromoFacts(ctx, part);
    else this.drawPromoBelow(ctx, part);
    this.fx.drawScreen(ctx);
    this.drawFooter(ctx);
  };

  P.drawPromoIntro = function (ctx, part) {
    const A = SQ.ARENA;
    const cx = A.x + A.size / 2;
    const list = this.promo.list;
    const size = 92;
    const gap = 112;
    list.forEach((t, i) => {
      const k = SQ.clamp((part.t - i * 0.16) / 0.35, 0, 1);
      if (k <= 0) return;
      const x = cx + (i - 3.5) * gap;
      const y = A.y + A.size * 0.62 + Math.sin(this.real * 3 + i) * 6;
      ctx.save();
      ctx.translate(x, y);
      const s = SQ.ease.outBack(k);
      ctx.scale(s, s);
      SQ.drawSquare(ctx, 0, 0, size, t, { mood: 'normal', blink: Math.sin(this.real * 1.3 + i * 2) > 0.985 });
      ctx.restore();
    });
    const a = SQ.clamp((part.t - 0.2) / 0.4, 0, 1);
    ctx.globalAlpha = a;
    SQ.outlinedText(ctx, 'EIGHT SECTORS.', cx, A.y + A.size * 0.3, 104, '#ffffff', { stroke: 16 });
    ctx.globalAlpha = SQ.clamp((part.t - 1.1) / 0.4, 0, 1);
    SQ.outlinedText(ctx, 'ONE COMES OUT.', cx, A.y + A.size * 0.42, 104, '#ff4d5e', { stroke: 16 });
    ctx.globalAlpha = 1;
  };

  P.drawPromoCard = function (ctx, part) {
    const A = SQ.ARENA;
    const t = part.team;
    const L = SQ.LORE[t.base] || {};
    const per = t.persona || {};
    const cx = A.x + A.size / 2;
    // slides in from the right, leaves to the left (the single version only arrives)
    const inK = SQ.ease.outCubic(SQ.clamp(part.t / 0.45, 0, 1));
    const outK = part.single ? 0 : SQ.ease.inOut(SQ.clamp((part.t - (part.len - 0.35)) / 0.35, 0, 1));
    const dx = (1 - inK) * 900 - outK * 900;
    // a soft spotlight in the square's color
    const g = ctx.createRadialGradient(cx + dx, A.y + 400, 40, cx + dx, A.y + 400, 520);
    g.addColorStop(0, SQ.rgba(t.color, 0.28));
    g.addColorStop(1, SQ.rgba(t.color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(A.x, A.y, A.size, A.size);
    // the square, breathing, eyes following nothing in particular
    const size = 330;
    const bob = Math.sin(this.real * 2.2) * 10;
    ctx.save();
    ctx.translate(cx + dx, A.y + 380 + bob);
    SQ.drawSquare(ctx, 0, 0, size, t, {
      mood: 'normal',
      squash: Math.sin(this.real * 4.4) * 0.025,
      lookX: Math.sin(this.real * 0.9) * 0.5,
      lookY: Math.cos(this.real * 0.7) * 0.2,
      blink: Math.sin(this.real * 1.7) > 0.97,
    });
    ctx.restore();
    // name, sector and what kind of square it is
    const nameSize = SQ.fitSize(ctx, [{ t: t.name.toUpperCase() }], A.size - 100, 104);
    SQ.outlinedText(ctx, t.name.toUpperCase(), cx + dx * 1.1, A.y + 680, nameSize, t.color, { stroke: 18 });
    SQ.outlinedText(ctx, (L.sector || '').toUpperCase(), cx + dx * 1.2, A.y + 790, 50, '#ffffff', { stroke: 10, font: SQ.fontBody, weight: 700 });
    if (per.title) SQ.outlinedText(ctx, `THE ${per.title.toUpperCase()}`, cx + dx * 1.3, A.y + 870, 38, t.light, { stroke: 8, font: SQ.fontBody, weight: 700 });
  };

  // under the screen on a card: where it is from and who it cannot stand; the single version tells its story
  P.drawPromoFacts = function (ctx, part) {
    const t = part.team;
    const L = SQ.LORE[t.base] || {};
    const A = SQ.ARENA;
    const W = SQ.W;
    const top = A.y + A.size + 60;
    const a = SQ.clamp((part.t - 0.4) / 0.4, 0, 1) * (part.single ? 1 : 1 - SQ.clamp((part.t - (part.len - 0.35)) / 0.3, 0, 1));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const rival = L.rival && SQ.LORE[L.rival] ? nameOf(L.rival) : L.rival;
    if (part.single) {
      // the story types itself out, smaller if it is a long one
      let fs = 36;
      let lines;
      for (;;) {
        ctx.font = `600 ${fs}px ${SQ.fontBody}`;
        lines = wrap(ctx, L.story || '', W - 140);
        if (lines.length * fs * 1.28 <= 250 || fs <= 26) break;
        fs -= 2;
      }
      const lh = Math.round(fs * 1.28);
      const total = (L.story || '').length;
      let shown = Math.floor(SQ.clamp((part.t - 0.8) / 6.5, 0, 1) * total);
      lines.forEach((l, i) => {
        const s = l.slice(0, Math.max(0, shown));
        shown -= l.length + 1;
        ctx.lineWidth = 7;
        ctx.strokeStyle = '#0b0b10';
        ctx.strokeText(s, W / 2, top + i * lh);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(s, W / 2, top + i * lh);
      });
      const y = top + lines.length * lh + 34;
      ctx.globalAlpha = a * SQ.clamp((part.t - 7.6) / 0.5, 0, 1);
      if (rival) SQ.outlinedText(ctx, `RIVAL: ${String(rival).toUpperCase()}`, W / 2, y, 38, '#ff4d5e', { stroke: 8, font: SQ.fontBody, weight: 700 });
      ctx.globalAlpha = a * SQ.clamp((part.t - 9) / 0.5, 0, 1);
      SQ.outlinedText(ctx, 'Who are you sending in?', W / 2, y + 62, 40, '#ffd23f', { stroke: 8, font: SQ.fontBody, weight: 700 });
    } else {
      ctx.font = `600 36px ${SQ.fontBody}`;
      const home = wrap(ctx, `From ${L.home || 'the Grid'}.`, W - 140);
      home.forEach((l, i) => {
        ctx.lineWidth = 7;
        ctx.strokeStyle = '#0b0b10';
        ctx.strokeText(l, W / 2, top + i * 46);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(l, W / 2, top + i * 46);
      });
      const y = top + home.length * 46 + 40;
      if (rival) {
        SQ.outlinedText(ctx, `RIVAL: ${String(rival).toUpperCase()}`, W / 2, y, 38, '#ff4d5e', { stroke: 8, font: SQ.fontBody, weight: 700 });
        ctx.font = `600 32px ${SQ.fontBody}`;
        const why = wrap(ctx, `because it ${L.rivalWhy}`, W - 160);
        why.forEach((l, i) => {
          ctx.lineWidth = 6;
          ctx.strokeStyle = '#0b0b10';
          ctx.strokeText(l, W / 2, y + 52 + i * 42);
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ctx.fillText(l, W / 2, y + 52 + i * 42);
        });
      }
    }
    ctx.restore();
  };

  P.drawPromoGrid = function (ctx, part) {
    const A = SQ.ARENA;
    const list = this.promo.list;
    const cell = A.size / 3;
    for (let i = 0; i < 9; i++) {
      const x = A.x + (i % 3) * cell + cell / 2;
      const y = A.y + Math.floor(i / 3) * cell + cell / 2 - 24;
      if (i < 8) {
        const t = list[i];
        const k = SQ.clamp((part.t - i * 0.08) / 0.35, 0, 1);
        ctx.save();
        ctx.translate(x, y + Math.sin(this.real * 2.5 + i) * 5);
        const s = SQ.ease.outBack(k);
        ctx.scale(s, s);
        SQ.drawSquare(ctx, 0, 0, 128, t, { mood: 'normal', blink: Math.sin(this.real * 1.3 + i * 2) > 0.985 });
        ctx.restore();
        ctx.globalAlpha = k;
        const ns = SQ.fitSize(ctx, [{ t: t.name.toUpperCase() }], cell - 30, 34);
        SQ.outlinedText(ctx, t.name.toUpperCase(), x, y + 92, ns, t.color, { stroke: 7 });
        ctx.globalAlpha = 1;
      } else {
        // the ninth place: empty, except for about a second when something grey stands in it
        const a = 0.42 * SQ.clamp(Math.min((part.t - 2.3) / 0.3, (3.5 - part.t) / 0.3), 0, 1);
        if (a > 0.01) SQ.drawSquare(ctx, x, y, 128, SQ.NINTH, { mood: 'normal', alpha: a });
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.setLineDash([14, 12]);
        ctx.lineWidth = 4;
        ctx.strokeRect(x - 75, y - 75, 150, 150);
        ctx.setLineDash([]);
      }
    }
  };

  P.drawPromoBelow = function (ctx, part) {
    const A = SQ.ARENA;
    const W = SQ.W;
    const y = A.y + A.size + 90;
    if (part.kind === 'grid') {
      const a = SQ.clamp((part.t - 0.6) / 0.4, 0, 1);
      ctx.globalAlpha = a;
      SQ.outlinedText(ctx, 'Comment your color.', W / 2, y, 64, '#ffffff', { stroke: 12 });
      ctx.globalAlpha = SQ.clamp((part.t - 1.4) / 0.4, 0, 1);
      SQ.outlinedText(ctx, 'NEW CYCLE DAILY', W / 2, y + 100, 42, '#ffd23f', { stroke: 9, font: SQ.fontBody, weight: 700 });
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = SQ.clamp((part.t - 1.6) / 0.4, 0, 1);
      SQ.outlinedText(ctx, 'One from each Sector of the Grid.', W / 2, y, 42, '#ffffff', { stroke: 9, font: SQ.fontBody, weight: 700 });
      ctx.globalAlpha = 1;
    }
  };
})();
