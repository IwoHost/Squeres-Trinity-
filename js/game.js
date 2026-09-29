// The game director: runs a match through intro, countdown, play, finale and outro,
// drives the camera and slow motion, and draws the frame that gets recorded.
(function () {
  const SQ = window.SQ;
  const MODE_IDS = ['chase', 'territory', 'domain', 'race', 'brawl'];

  class Recorder {
    get supported() {
      return !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream);
    }
    pickMime() {
      const list = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
      return list.find((m) => MediaRecorder.isTypeSupported(m)) || '';
    }
    start(canvas, audioStream, fps, bitrate) {
      if (!this.supported) return false;
      const tracks = canvas.captureStream(fps || 30).getVideoTracks();
      if (audioStream) tracks.push(...audioStream.getAudioTracks());
      const stream = new MediaStream(tracks);
      this.mime = this.pickMime();
      this.chunks = [];
      try {
        this.rec = new MediaRecorder(stream, { mimeType: this.mime || undefined, videoBitsPerSecond: bitrate || 6_000_000, audioBitsPerSecond: 192_000 });
      } catch (e) {
        this.rec = new MediaRecorder(stream);
      }
      this.rec.ondataavailable = (e) => e.data && e.data.size && this.chunks.push(e.data);
      this.rec.start(500);
      this.startedAt = performance.now();
      return true;
    }
    get active() {
      return !!(this.rec && this.rec.state === 'recording');
    }
    stop() {
      return new Promise((res) => {
        if (!this.active) return res(null);
        this.rec.onstop = () => {
          const type = (this.rec.mimeType || this.mime || 'video/webm').split(';')[0];
          res(new Blob(this.chunks, { type }));
        };
        this.rec.stop();
      });
    }
  }

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.audio = new SQ.AudioEngine();
      this.cam = new SQ.Camera();
      this.fx = new SQ.FX(this);
      this.recorder = new Recorder();
      this.opts = { mode: 'random', memes: 1, speed: 1, music: 'shuffle', record: false, autoNext: false, quality: 'auto' };
      this.setQuality('auto');
      this.fixedDt = 1 / 60;
      this.hitstopT = 0;
      this.acc = 0;
      this.timeScale = 1;
      this.slowT = 0;
      this.phase = 'idle';
      this.phaseT = 0;
      this.real = 0;
      this.lastHighlight = -10;
      this.episode = 0;
      this.listeners = {};
      this.idleMode = null;
      this.last = performance.now();
      this.makeIdle();
      requestAnimationFrame((t) => this.frame(t));
    }

    // 720p on phones keeps things smooth; 1080p on computers.
    setQuality(q) {
      this.opts.quality = q;
      const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      const res = q === '1080' ? 1 : q === '720' ? 2 / 3 : coarse || window.innerWidth < 900 ? 2 / 3 : 1;
      if (res === SQ.RES && this.canvas.width === Math.round(SQ.W * res)) return;
      SQ.RES = res;
      this.canvas.width = Math.round(SQ.W * res);
      this.canvas.height = Math.round(SQ.H * res);
      SQ.clearSprites();
      this.backdrop = null;
      this.headerCache = null;
      if (this.mode && this.mode.invalidate) this.mode.invalidate();
    }

    // Freezes the simulation for a split second on big impacts.
    hitstop(d) {
      this.hitstopT = Math.max(this.hitstopT, d);
    }

    on(ev, fn) {
      (this.listeners[ev] = this.listeners[ev] || []).push(fn);
    }
    emit(ev, data) {
      (this.listeners[ev] || []).forEach((f) => f(data));
    }

    // A calm preview behind the start screen.
    makeIdle() {
      const seed = SQ.randomSeed();
      this.mode = SQ.modes.chase.create(this, SQ.makeRng(seed));
      this.modeInfo = SQ.modes.chase;
      this.phase = 'idle';
    }

    newMatch(seed) {
      this.audio.init();
      this.episode++;
      this.seed = seed != null ? seed >>> 0 : SQ.randomSeed();
      const rng = SQ.makeRng(this.seed);
      let id = this.opts.mode;
      if (id === 'random') id = MODE_IDS[Math.floor(rng() * MODE_IDS.length)];
      this.modeInfo = SQ.modes[id];
      this.mode = this.modeInfo.create(this, SQ.makeRng(this.seed ^ 0x9e3779b9));
      this.fx.clear();
      this.cam.reset();
      this.cam.tracking = !!this.mode.camTracking;
      const start = this.mode.focusStart ? this.mode.focusStart() : { x: rng.range(250, 750), y: rng.range(250, 750) };
      this.cam.focus(start.x, start.y, 2.8, 0);
      this.cam.snap();
      this.cam.focus(500, 500, 1, 0, 1.4);
      this.timeScale = 1;
      this.slowT = 0;
      this.acc = 0;
      this.setPhase('intro');
      this.track = this.audio.pickTrack(this.opts.music);
      this.audio.intensity = 0.12;
      this.audio.playTrack(this.track);
      this.audio.riser(2.6);
      this.audio.whoosh();
      this.trackToast = 4;
      this.video = null;
      this.setQuality(this.opts.quality);
      if (this.opts.record && this.recorder.supported) {
        this.recorder.start(this.canvas, this.audio.streamDest && this.audio.streamDest.stream, 30, SQ.RES === 1 ? 9_000_000 : 5_000_000);
      }
      this.emit('match', { mode: this.modeInfo, seed: this.seed, track: this.track });
    }

    setPhase(p) {
      this.phase = p;
      this.phaseT = 0;
      this.emit('phase', p);
    }

    // Director hook used by modes: zoom to a moment, optionally in slow motion.
    highlight(x, y, z, dur, slow) {
      if (this.phase !== 'play') return;
      // crowded modes keep the full arena in view; zooming would crop squares at the edges
      if (this.mode && this.mode.wideShot) return;
      if (this.real - this.lastHighlight < 6) return;
      this.lastHighlight = this.real;
      this.cam.focus(x, y, Math.min(z, 1.8), dur, 3.5);
      if (slow) this.slowmo(Math.max(0.45, slow), dur * 0.7);
    }
    slowmo(scale, dur, muffle) {
      this.timeScale = scale;
      this.slowT = dur;
      if (muffle) this.audio.muffle(true);
    }

    frame(ts) {
      const realDt = Math.min(0.05, Math.max(0, (ts - this.last) / 1000));
      this.last = ts;
      this.real += realDt;
      this.phaseT += realDt;
      if (this.slowT > 0) {
        this.slowT -= realDt;
        if (this.slowT <= 0) {
          this.timeScale = 1;
          this.audio.muffle(false);
        }
      }
      this.tick(realDt);
      this.render();
      requestAnimationFrame((t) => this.frame(t));
    }

    tick(realDt) {
      const m = this.mode;
      const P = this.phase;
      let simulate = P === 'play' || P === 'finale' || P === 'outro' || P === 'idle' || P === 'done';
      if (P === 'intro' && this.phaseT > 2.8) {
        this.setPhase('countdown');
        this.countN = 3;
        this.audio.beep(false);
        this.audio.roll(2.4);
        this.cam.punch(0.12);
      }
      if (P === 'countdown') {
        const n = 3 - Math.floor(this.phaseT / 0.8);
        if (n !== this.countN && n > 0) {
          this.countN = n;
          this.audio.beep(false);
          this.cam.punch(0.12);
        }
        if (this.phaseT >= 2.4) {
          this.setPhase('play');
          this.audio.beep(true);
          this.audio.intensity = 0.5;
          if (!m.wideShot) this.cam.punch(0.1);
          this.cam.shake(8);
          this.fx.flash(0.35);
          this.fx.banner('GO!', null, '#ffd23f', 0.9, { size: 150 });
        }
      }
      if (P === 'play') {
        this.audio.intensity = m.intensity ? m.intensity() : 0.6;
        if (m.winner) {
          this.setPhase('finale');
          this.slowmo(0.25, 1.5, true);
          const w = m.winnerEnt;
          this.cam.tracking = false;
          if (w) this.cam.focus(w.x, w.y, 2.3, 0, 3);
          this.audio.crowd(2);
          this.fx.flash(0.5, m.winner.team.light);
        }
      }
      if (P === 'finale' && this.phaseT > 1.5) {
        this.setPhase('outro');
        const w = m.winner;
        this.fx.banner(w.text, w.sub, w.team.color, 5.2, { y: SQ.ARENA.y + SQ.ARENA.size * 0.78, size: 96 });
        this.fx.confettiBurst([w.team.color, w.team.light, '#ffffff', '#ffd23f'], 220);
        this.audio.fanfare();
        this.audio.intensity = 1;
        this.cam.punch(0.3);
      }
      if (P === 'outro') {
        const w = m.winnerEnt;
        if (w) this.cam.focus(w.x, w.y, 2.1, 0, 3);
        if (this.phaseT > 1.7 && !this.memeDone && this.opts.memes > 0) {
          this.memeDone = true;
          this.audio.boom();
          this.cam.shake(10);
          const list = SQ.MEMES.winner;
          this.winnerCaption = list[Math.floor(Math.random() * list.length)];
        }
        if (this.phaseT > 5.4) this.audio.stopMusic(1.2);
        if (this.phaseT > 6.2) this.finish();
      }
      if (P === 'intro' || P === 'countdown') simulate = false;
      if (P !== 'outro') this.memeDone = false;

      if (this.hitstopT > 0) {
        this.hitstopT -= realDt;
        simulate = false;
      }
      if (simulate && m) {
        const speed = P === 'idle' ? 0.6 : this.opts.speed;
        this.acc += realDt * this.timeScale * speed;
        let steps = 0;
        while (this.acc >= this.fixedDt && steps < 8) {
          if (P === 'idle' && m.winner) break;
          m.update(this.fixedDt);
          this.acc -= this.fixedDt;
          steps++;
        }
        if (steps >= 8) this.acc = 0;
      }
      if (P === 'play' && !this.cam.tracking && this.cam.hold <= 0) {
        // the resting view always shows the whole arena, edge to edge
        this.cam.setDefault(500, 500, 1);
        this.cam.tx = this.cam.defaultView.x;
        this.cam.ty = this.cam.defaultView.y;
        this.cam.tz = this.cam.defaultView.z;
      }
      if (P === 'idle' && m.winner) this.makeIdle();
      this.cam.update(realDt);
      this.fx.update(realDt * this.timeScale, realDt);
      if (this.trackToast > 0) this.trackToast -= realDt;
    }

    async finish() {
      this.setPhase('done');
      if (this.recorder.active) {
        const blob = await this.recorder.stop();
        if (blob && blob.size) {
          const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
          this.video = { blob, ext, name: `squares-trinity-${this.modeInfo.id}-${this.seed}.${ext}` };
        }
      }
      this.emit('done', { winner: this.mode.winner, video: this.video });
      if (this.opts.autoNext) {
        setTimeout(() => {
          if (this.phase === 'done' && this.opts.autoNext) this.newMatch();
        }, 2500);
      }
    }

    // ---------------- rendering ----------------
    render() {
      const ctx = this.ctx;
      const A = SQ.ARENA;
      const m = this.mode;
      ctx.setTransform(SQ.RES, 0, 0, SQ.RES, 0, 0);
      this.drawBackdrop(ctx);
      this.drawHeader(ctx);

      // arena frame with a soft halo
      const lead = m.winner ? m.winner.team.color : '#e8d7f1';
      ctx.fillStyle = SQ.rgba(lead, 0.08);
      ctx.fillRect(A.x - 34, A.y - 34, A.size + 68, A.size + 68);
      ctx.fillStyle = SQ.rgba(lead, 0.14);
      ctx.fillRect(A.x - 20, A.y - 20, A.size + 40, A.size + 40);
      ctx.fillStyle = lead;
      ctx.fillRect(A.x - 10, A.y - 10, A.size + 20, A.size + 20);

      ctx.save();
      ctx.beginPath();
      ctx.rect(A.x, A.y, A.size, A.size);
      ctx.clip();
      this.cam.apply(ctx, A);
      m.draw(ctx);
      this.fx.drawWorld(ctx);
      this.drawWinnerMeme(ctx);
      ctx.restore();

      this.drawBelow(ctx);
      if (this.phase === 'intro') this.drawIntro(ctx);
      if (this.phase === 'countdown') this.drawCountdown(ctx);
      this.fx.drawScreen(ctx);
      if (this.phase === 'done') this.drawEndCard(ctx);
      this.drawFooter(ctx);
    }

    drawBackdrop(ctx) {
      if (!this.backdrop) {
        const c = document.createElement('canvas');
        c.width = Math.round(SQ.W * SQ.RES);
        c.height = Math.round(SQ.H * SQ.RES);
        const b = c.getContext('2d');
        b.scale(SQ.RES, SQ.RES);
        const g = b.createLinearGradient(0, 0, 0, SQ.H);
        g.addColorStop(0, '#0c0d14');
        g.addColorStop(1, '#141726');
        b.fillStyle = g;
        b.fillRect(0, 0, SQ.W, SQ.H);
        b.fillStyle = 'rgba(255,255,255,0.035)';
        for (let y = 30; y < SQ.H; y += 120) for (let x = 30; x < SQ.W; x += 120) b.fillRect(x, y, 22, 22);
        this.backdrop = c;
      }
      ctx.drawImage(this.backdrop, 0, 0, SQ.W, SQ.H);
    }

    drawHeader(ctx) {
      // The header only changes when the rules change, so outside the intro it is cached.
      if (this.phase === 'intro') return this.drawHeaderLive(ctx);
      const key = this.phase + '|' + this.episode + '|' + this.mode.title + '|' + JSON.stringify(this.mode.rules);
      if (!this.headerCache || this.headerCache.key !== key) {
        const c = document.createElement('canvas');
        c.width = Math.round(SQ.W * SQ.RES);
        c.height = Math.round(SQ.ARENA.y * SQ.RES);
        const h = c.getContext('2d');
        h.scale(SQ.RES, SQ.RES);
        this.drawHeaderLive(h);
        this.headerCache = { key, c };
      }
      ctx.drawImage(this.headerCache.c, 0, 0, SQ.W, SQ.ARENA.y);
    }

    drawHeaderLive(ctx) {
      const m = this.mode;
      const A = SQ.ARENA;
      // top tag line
      ctx.save();
      ctx.font = `700 26px ${SQ.fontBody}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      const tag = this.phase === 'idle' ? 'SQUARES TRINITY' : `SQUARES TRINITY  ·  EP ${this.episode}  ·  ${m.title}`;
      ctx.fillText(spaced(tag), SQ.W / 2, 66, SQ.W - 120);
      // tri-color strip
      const sw = 60;
      ['#ff4d5e', '#35d97a', '#4f86ff'].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(SQ.W / 2 - sw * 1.5 + i * sw, 96, sw, 8);
      });
      ctx.restore();

      const lines = m.rules || [];
      const n = lines.length;
      const top = 130;
      const avail = A.y - top - 30;
      let size = Math.min(72, Math.floor(avail / Math.max(n, 2) / 1.18));
      for (const l of lines) size = Math.min(size, SQ.fitSize(ctx, l, SQ.W - 100, size));
      const lh = size * 1.18;
      const y0 = top + (avail - lh * n) / 2 + lh / 2;
      lines.forEach((l, i) => {
        let dx = 0;
        let alpha = 1;
        if (this.phase === 'intro') {
          const k = SQ.clamp((this.phaseT - 0.3 - i * 0.18) / 0.4, 0, 1);
          dx = (1 - SQ.ease.outBack(k)) * -SQ.W * 0.6;
          alpha = k;
        }
        ctx.globalAlpha = alpha;
        SQ.richLine(ctx, l, SQ.W / 2 + dx, y0 + i * lh, size);
      });
      ctx.globalAlpha = 1;
    }

    drawBelow(ctx) {
      const A = SQ.ARENA;
      const y = A.y + A.size + 64;
      if (this.phase === 'idle') return;
      SQ.outlinedText(ctx, 'Who will win?', SQ.W / 2, y, 58, '#ffffff', { stroke: 10 });
      if (this.mode.drawHud) {
        ctx.save();
        this.mode.drawHud(ctx, y + 62);
        ctx.restore();
      }
    }

    drawIntro(ctx) {
      const A = SQ.ARENA;
      const t = this.phaseT;
      const m = this.mode;
      ctx.save();
      ctx.fillStyle = `rgba(8,8,14,${0.55 * (1 - SQ.clamp((t - 2.3) / 0.5, 0, 1))})`;
      ctx.fillRect(A.x, A.y, A.size, A.size);
      const k = SQ.clamp(t / 0.5, 0, 1);
      const out = 1 - SQ.clamp((t - 2.4) / 0.4, 0, 1);
      ctx.globalAlpha = out;
      const cy = A.y + A.size * 0.36;
      ctx.translate(SQ.W / 2, cy);
      ctx.rotate(-0.04);
      ctx.scale(SQ.ease.outBack(k), SQ.ease.outBack(k));
      SQ.outlinedText(ctx, this.modeInfo.name.toUpperCase(), 0, 0, 100, '#ffd23f', { stroke: 18 });
      ctx.restore();
      // contestants
      const teams = m.teams || [];
      const n = teams.length;
      const size = Math.min(110, 760 / n);
      const gap = size * 0.35;
      const total = n * size + (n - 1) * gap;
      ctx.save();
      ctx.globalAlpha = out;
      teams.forEach((tm, i) => {
        const kk = SQ.clamp((t - 0.6 - i * 0.12) / 0.35, 0, 1);
        if (kk <= 0) return;
        const x = SQ.W / 2 - total / 2 + size / 2 + i * (size + gap);
        const y = A.y + A.size * 0.6 - Math.abs(Math.sin(t * 5 + i)) * 16;
        SQ.drawSquare(ctx, x, y, size * SQ.ease.outBack(kk), tm, { mood: i % 2 ? 'angry' : 'normal', lookX: Math.sin(t * 2 + i), squash: Math.sin(t * 10 + i) * 0.06 });
        SQ.outlinedText(ctx, tm.name, x, y + size * 0.85, Math.min(36, size * 0.36), tm.color, { stroke: 7 });
      });
      ctx.restore();
      if (t > 1.2) {
        const kk = SQ.clamp((t - 1.2) / 0.4, 0, 1);
        ctx.save();
        ctx.globalAlpha = kk * out;
        SQ.outlinedText(ctx, 'WHO WILL WIN?', SQ.W / 2, A.y + A.size * 0.84, 64, '#ffffff', { stroke: 12 });
        ctx.restore();
      }
    }

    drawCountdown(ctx) {
      const A = SQ.ARENA;
      const local = (this.phaseT % 0.8) / 0.8;
      const n = 3 - Math.floor(this.phaseT / 0.8);
      if (n <= 0) return;
      ctx.save();
      ctx.globalAlpha = 1 - local * 0.6;
      ctx.translate(SQ.W / 2, A.y + A.size / 2);
      const s = 1.6 - SQ.ease.outCubic(Math.min(1, local * 2)) * 0.6;
      ctx.scale(s, s);
      SQ.outlinedText(ctx, String(n), 0, 0, 260, ['#35d97a', '#ffd23f', '#ff4d5e'][n - 1], { stroke: 30 });
      ctx.restore();
    }

    drawWinnerMeme(ctx) {
      if (this.phase !== 'outro' && this.phase !== 'done') return;
      const w = this.mode.winnerEnt;
      if (!w || this.opts.memes === 0) return;
      const t = this.phase === 'done' ? 99 : this.phaseT;
      const k = SQ.clamp((t - 0.8) / 0.9, 0, 1);
      if (k <= 0) return;
      const size = w.size || 30;
      const gy = w.y - size * 0.04 - (1 - SQ.ease.outCubic(k)) * 320;
      SQ.drawSunglasses(ctx, w.x, gy, size * 0.95);
      if (this.winnerCaption) {
        SQ.outlinedText(ctx, this.winnerCaption, w.x, w.y + size * 0.5 + 30, Math.max(22, size * 0.5), '#ffffff', { stroke: 7 });
      }
    }

    drawEndCard(ctx) {
      const A = SQ.ARENA;
      const w = this.mode.winner;
      if (!w) return;
      const k = SQ.clamp(this.phaseT / 0.4, 0, 1);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(8,8,14,0.6)';
      ctx.fillRect(A.x, A.y, A.size, A.size);
      SQ.drawSquare(ctx, SQ.W / 2, A.y + 380, 220, w.team, { mood: 'happy', squash: Math.sin(this.real * 6) * 0.05 });
      if (this.opts.memes > 0) SQ.drawSunglasses(ctx, SQ.W / 2, A.y + 372, 210);
      SQ.outlinedText(ctx, w.text, SQ.W / 2, A.y + 620, 96, w.team.color, { stroke: 16 });
      SQ.outlinedText(ctx, 'Follow for the next episode', SQ.W / 2, A.y + 720, 40, '#ffffff', { stroke: 8, font: SQ.fontBody, weight: 700 });
      ctx.restore();
    }

    drawFooter(ctx) {
      ctx.save();
      ctx.font = `600 26px ${SQ.fontBody}`;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.textAlign = 'left';
      if (this.phase !== 'idle') ctx.fillText(`seed ${this.seed}`, 44, SQ.H - 44);
      ctx.textAlign = 'right';
      if (this.track && this.phase !== 'idle') {
        const a = this.trackToast > 0 ? 1 : 0.45;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`♪ ${this.track.name}`, SQ.W - 44, SQ.H - 44);
      }
      ctx.restore();
    }
  }

  function spaced(s) {
    return s.split('').join(' ');
  }

  SQ.Game = Game;
  SQ.MODE_IDS = MODE_IDS;
})();
