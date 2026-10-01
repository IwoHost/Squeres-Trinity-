// The game director: runs a match through intro, countdown, play, finale and outro,
// drives the camera and slow motion, and draws the frame that gets recorded.
(function () {
  const SQ = window.SQ;
  // modes that work as 1v1 matches in a tournament
  const TOUR_MODES = ['territory', 'domain', 'race', 'brawl', 'bounce', 'marble', 'hill'];
  // First-second hooks for Reel mode: a mode-specific line or a general one.
  const HOOKS = {
    all: ['WHICH COLOR WINS?', 'ONLY ONE SURVIVES', 'PICK A COLOR. NOW.', 'WAIT FOR THE ENDING', 'YOUR COLOR = YOUR LUCK'],
    marble: ['THE FLOOR IS LAVA', 'LAST ONE GETS COOKED'],
    race: ['FIRST TO THE FLAG WINS', 'THE MAZE IS RANDOM'],
    brawl: ['EVERY HIT LEVELS UP', 'PICK A WEAPON'],
    bounce: ['EVERY BOUNCE = BIGGER', 'HOW BIG CAN IT GET?'],
    territory: ['STEAL EVERY TILE', 'MOST TILES WINS'],
    hill: ['HOLD THE ZONE TO WIN', 'KING OF THE HILL'],
    domain: ['INVINCIBLE AT HOME', 'STAY IN YOUR DOMAIN'],
    chase: ['ROCK PAPER SQUARES', 'WHO GETS EATEN FIRST?'],
  };
  const MODE_IDS = ['chase', 'territory', 'domain', 'race', 'brawl', 'bounce', 'marble', 'hill'];

  class Recorder {
    get supported() {
      return !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream);
    }
    pickMime() {
      const list = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
      return list.find((m) => MediaRecorder.isTypeSupported(m)) || '';
    }
    // Each recording keeps its own chunks and video track, so a new one can never mix with the last.
    start(canvas, audioStream, fps, bitrate) {
      if (!this.supported) return false;
      this.abort();
      const video = canvas.captureStream(fps || 30).getVideoTracks();
      const tracks = video.slice();
      if (audioStream) tracks.push(...audioStream.getAudioTracks());
      const stream = new MediaStream(tracks);
      this.mime = this.pickMime();
      let rec;
      try {
        rec = new MediaRecorder(stream, { mimeType: this.mime || undefined, videoBitsPerSecond: bitrate || 6_000_000, audioBitsPerSecond: 192_000 });
      } catch (e) {
        rec = new MediaRecorder(stream);
      }
      const chunks = [];
      rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
      // the canvas track is ours to end; the audio track belongs to the shared sound output
      rec.onstop = () => video.forEach((t) => t.stop());
      rec.start(500);
      this.rec = rec;
      this.chunks = chunks;
      this.startedAt = performance.now();
      return true;
    }
    get active() {
      return !!(this.rec && this.rec.state !== 'inactive');
    }
    stop() {
      return new Promise((res) => {
        if (!this.active) return res(null);
        const rec = this.rec;
        const chunks = this.chunks;
        const end = rec.onstop;
        rec.onstop = () => {
          end();
          const type = (rec.mimeType || this.mime || 'video/webm').split(';')[0];
          res(new Blob(chunks, { type }));
        };
        rec.stop();
        this.rec = null;
      });
    }
    pause(on) {
      if (!this.rec) return;
      if (on && this.rec.state === 'recording') {
        this.rec.pause();
        this.pausedAt = performance.now();
      } else if (!on && this.rec.state === 'paused') {
        this.rec.resume();
        this.startedAt += performance.now() - this.pausedAt; // the timer skips the pause
      }
    }
    // Drops a recording that is still running (a new match started before it finished).
    abort() {
      if (!this.active) return;
      this.rec.ondataavailable = null;
      this.rec.stop();
      this.rec = null;
    }
  }

  // Shown once per series, in the video where the signal breaks. Editable in the Look tab.
  SQ.TRANSMISSION = 'The Games were never random. Your eyes keep the Grid alive. We are the fuel.';

  // The ninth square: grey, nameless, not in the lore or the stats.
  SQ.NINTH = { name: '\u0000ninth', base: 'Ninth', color: '#9a9ca6', dark: '#4d4f58', light: '#d3d5dc' };
  // Default clues for the hidden frame in each reboot video, one per line; "|" breaks a line.
  SQ.CLUES = 'CYCLE 0\nTHERE WERE|NINE\nCOUNT THE|FRAGMENTS\nTHE FRAME|IS NOT ASLEEP\n03:33\nASK THE|GREY ONE\nWHO IS|WATCHING\nKEEP|WATCHING';
  SQ.SPECTRO_WORD = 'WE ARE FUEL';
  SQ.clueList = (text) => String(text || SQ.CLUES).split('\n').map((l) => l.trim()).filter(Boolean);
  SQ.pick = (list) => list[Math.floor(Math.random() * list.length)];
  SQ.fmtClock = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
  // Fragments can be shown in code: letters shifted by the fragment number, or letters as numbers.
  SQ.encodeFragment = function (text, cipher, idx) {
    if (cipher === 'shift') {
      const k = (idx + 1) % 26;
      return text.replace(/[A-Z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 65 + k) % 26) + 65));
    }
    if (cipher === 'numbers') {
      return text
        .split(' ')
        .map((w) => w.replace(/[^A-Z]/g, '').split('').map((c) => c.charCodeAt(0) - 64).join('-'))
        .filter(Boolean)
        .join(' / ');
    }
    return text;
  };

  // Splits the message into the pieces the reboot videos show, one piece per video.
  SQ.fragments = function (text, words) {
    const w = String(text).replace(/\s+/g, ' ').trim().toUpperCase().split(' ').filter(Boolean);
    const out = [];
    for (let i = 0; i < w.length; i += words) out.push(w.slice(i, i + words).join(' '));
    return out.length ? out : ['...'];
  };

  class Game {
    constructor(canvas) {
      // the game draws offscreen; the screen pass copies it to the visible canvas with fish-eye and static
      this.view = canvas;
      this.post = new SQ.PostFX(canvas);
      if (!this.post.ok) this.post = null;
      this.canvas = this.post ? document.createElement('canvas') : canvas;
      this.ctx = this.canvas.getContext('2d', { alpha: false });
      this.glitch = 0;
      this.reboot = null; // the signal event, when the static has run its course
      this.audio = new SQ.AudioEngine();
      this.cam = new SQ.Camera();
      this.fx = new SQ.FX(this);
      this.recorder = new Recorder();
      this.opts = { mode: 'random', memes: 1, speed: 1, music: 'shuffle', record: false, autoNext: false, quality: 'auto', voices: true, reel: true, fisheye: 30, crt: 35, static: 0, decay: 4 };
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
      this.cam.worldH = SQ.WORLD;
      this.phase = 'idle';
    }

    // o: { tour, mode, teams } when the match is part of a tournament
    newMatch(seed, o) {
      o = o || {};
      this.audio.init();
      this.setPaused(false);
      if (!o.tour) {
        this.recorder.abort(); // a match or tournament cut short is not saved
        this.tour = null;
        this.episode++;
        this.seed = seed != null ? seed >>> 0 : SQ.randomSeed();
      }
      this.reboot = null;
      SQ.stare = 0;
      this.videoT = 0;
      this.playT = 0;
      this.planMysteries();
      this.matchLog = [];
      this.matchSignal = Math.round(this.opts.static || 0);
      const mseed = o.tour ? seed >>> 0 : this.seed;
      const rng = SQ.makeRng(mseed);
      let id = o.mode || this.opts.mode;
      if (id === 'random' || !SQ.modes[id]) {
        id = MODE_IDS[Math.floor(rng() * MODE_IDS.length)];
        // a fresh random match never repeats the last mode (a replayed seed stays exactly the same)
        if (seed == null && !o.tour && id === this.lastRandomMode) {
          const rest = MODE_IDS.filter((x) => x !== id);
          id = rest[Math.floor(rng() * rest.length)];
        }
        if (!o.tour) this.lastRandomMode = id;
      }
      this.modeInfo = SQ.modes[id];
      const reel = this.opts.reel && !o.tour;
      // Reel mode uses the quick settings (the race is already short; quick makes it longer)
      const mopts = o.teams ? { teams: o.teams, quick: true } : reel && id !== 'race' ? { quick: true } : undefined;
      this.mode = this.modeInfo.create(this, SQ.makeRng(mseed ^ 0x9e3779b9), mopts);
      this.fx.clear();
      this.cam.reset();
      this.cam.tracking = !!this.mode.camTracking;
      this.cam.worldH = this.mode.worldH || SQ.WORLD;
      const start = this.mode.focusStart ? this.mode.focusStart() : { x: rng.range(250, 750), y: rng.range(250, 750) };
      this.cam.focus(start.x, start.y, 2.8, 0);
      this.cam.snap();
      this.cam.focus(500, 500, 1, 0, 1.4);
      this.timeScale = 1;
      this.slowT = 0;
      this.acc = 0;
      this.setPhase('intro');
      // a tournament keeps one song going across its matches
      if (!o.tour || !this.audio.playing) {
        this.track = this.audio.pickTrack(this.opts.music);
        this.audio.intensity = 0.12;
        this.audio.playTrack(this.track);
        this.trackToast = 4;
      }
      if (reel) this.startReel(id);
      else {
        this.audio.riser(2.6);
        this.audio.whoosh();
      }
      if (o.tour) {
        this.emit('match', { mode: this.modeInfo, seed: this.seed, track: this.track, tour: true });
        return;
      }
      this.video = null;
      this.setQuality(this.opts.quality);
      if (this.opts.record && this.recorder.supported) {
        this.recorder.start(this.view, this.audio.streamDest && this.audio.streamDest.stream, 30, SQ.RES === 1 ? 9_000_000 : 5_000_000);
      }
      this.emit('match', { mode: this.modeInfo, seed: this.seed, track: this.track });
    }

    // Reel mode: no title card or countdown. The match is already moving in the first frame.
    startReel(id) {
      const m = this.mode;
      this.audio.muted = true;
      for (let i = 0; i < 50; i++) m.update(this.fixedDt);
      this.audio.muted = false;
      this.hitstopT = 0;
      this.timeScale = 1;
      this.slowT = 0;
      this.fx.clear();
      this.cam.hold = 0;
      const d = this.cam.defaultView;
      this.cam.focus(d.x, d.y, d.z, 0, 3);
      this.cam.snap();
      this.setPhase('play');
      this.audio.intensity = 0.6;
      this.audio.beep(true);
      this.cam.punch(0.08);
      this.chatT = 0.5;
      this.startLines = 1;
      const own = HOOKS[id] || [];
      const list = own.length && Math.random() < 0.6 ? own : HOOKS.all;
      this.hook = { text: list[Math.floor(Math.random() * list.length)], t: 0, dur: 2.6 };
    }

    // Pause freezes the match, its sound and its recording; the video simply continues after the pause.
    setPaused(on) {
      on = !!on;
      if (on === !!this.paused) return;
      if (on && (this.phase === 'idle' || this.phase === 'done')) return;
      this.paused = on;
      this.audio.pause(on);
      this.recorder.pause(on);
      this.emit('pause', on);
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
    // A snappy zoom-in with no slow motion. Allowed more often than highlights.
    quickZoom(x, y, z, dur) {
      if (this.phase !== 'play') return;
      if (this.real - (this.lastQuickZoom || -10) < 2.2 || this.cam.hold > 0) return;
      this.lastQuickZoom = this.real;
      this.cam.focus(x, y, z, dur, 7);
      this.cam.punch(0.06);
      this.audio.whoosh();
    }

    // The static grows a little with every video of a series. At 100% (or when asked) the next video
    // has the signal event: the picture breaks up, the Frame reboots and the static starts over.
    advanceSignal() {
      if (!this.opts.decay) return;
      this.opts.static = Math.min(100, (this.opts.static || 0) + this.opts.decay);
      if (this.opts.static >= 100) this.rebootNext = true;
      this.emit('signal', this.opts.static);
    }
    // The signal event: the static takes over, the match freezes, and a hidden transmission decodes
    // letter by letter through the noise. Then the Frame reboots and the picture comes back clean.
    updateReboot(realDt) {
      const r0 = this.reboot;
      // a match that ends mid-event still finishes the reboot, so the static never sticks at full
      if (r0 && !r0.done && this.phase !== 'play') r0.t = r0.end;
      else if (this.phase !== 'play') return;
      if (this.rebootNext && !this.reboot && this.phaseT > 3.5) {
        this.rebootNext = false;
        // one fragment per reboot: viewers have to collect the videos to put the message together
        const frags = SQ.fragments(this.opts.transmission || SQ.TRANSMISSION, this.opts.fragWords || 1);
        const idx = (this.opts.fragIndex || 0) % frags.length;
        this.opts.fragIndex = idx + 1;
        this.opts.reboots = (this.opts.reboots || 0) + 1;
        this.emit('fragment', this.opts.fragIndex);
        const decode = SQ.clamp(frags[idx].length * 0.18, 1.6, 4);
        const plain = frags[idx];
        const shown = SQ.encodeFragment(plain, this.opts.cipher || 'none', idx);
        this.reboot = { t: 0, from: this.opts.static || 0, text: shown, plain, idx, total: frags.length, decode, end: 0.6 + 1.4 + decode + 3.4, at: this.videoT };
        // a word hidden in the hiss, readable in a spectrogram app
        const word = (this.opts.spectro != null ? this.opts.spectro : SQ.SPECTRO_WORD).trim();
        if (word) this.audio.spectrogram(word.toUpperCase(), 0.6);
        this.myst.log.push(`${SQ.fmtClock(this.videoT)} signal lost; fragment ${idx + 1}/${frags.length} "${plain}"${shown !== plain ? ` shown as "${shown}"` : ''}${word ? `; "${word.toUpperCase()}" hidden in the hiss (see it in a spectrogram)` : ''}`);
        this.fx.banner('SIGNAL LOST', 'the Frame is not responding', '#ffffff', 1.4);
        this.audio.boom();
        this.audio.hiss(this.reboot.end);
        this.audio.muffle(true);
        this.audio.duck(0.35, this.reboot.end);
        this.cam.shake(14);
      }
      const r = this.reboot;
      if (!r) return;
      r.t += realDt;
      if (r.t < r.end) {
        // full static first, then a little less so the words can get through
        const k = Math.min(1, r.t / 0.6);
        this.opts.static = r.t < 0.6 ? r.from + (100 - r.from) * k : 72;
        // the squares slowly stop and look straight out of the screen
        SQ.stare = SQ.clamp((r.t - 0.8) / 2.2, 0, 1);
        // steady, not random spikes: the picture breaks up but never strobes
        this.glitch = Math.max(this.glitch, r.t < 0.6 ? 0.7 : 0.1);
      } else if (!r.done) {
        r.done = true;
        this.opts.static = 0;
        this.glitch = 0.6;
        this.audio.muffle(false);
        this.fx.flash(0.35);
        this.fx.banner('SIGNAL RESTORED', 'the Frame has rebooted', '#35d97a', 1.6);
        this.audio.ding();
        this.emit('signal', 0);
        // one frame with a clue, a few seconds later, for people who go through the video frame by frame
        const clues = SQ.clueList(this.opts.clues);
        if (clues.length) {
          const text = clues[r.idx % clues.length];
          this.myst.hidden = { at: this.videoT + 2 + Math.random() * 3, text };
        }
      }
      if (r.done && SQ.stare > 0) SQ.stare = Math.max(0, SQ.stare - realDt * 1.5);
    }

    // The small mysteries of a video, decided when it starts: whether the grey square shows up and
    // when the numbers glitch. Everything that happens is logged with its time for the match info.
    planMysteries() {
      const reb = this.opts.reboots || 0;
      const mode = this.opts.ninth || 'rare';
      const pNinth = mode === 'off' ? 0 : mode === 'always' ? 1 : Math.min(0.6, 0.08 + 0.08 * reb);
      const R = Math.random;
      this.myst = { log: [], glitches: [], hidden: null, ninth: null };
      if (R() < pNinth) {
        const corner = [[0.12, 0.14], [0.86, 0.12], [0.1, 0.86], [0.88, 0.88]][(R() * 4) | 0];
        this.myst.ninth = { at: 3 + R() * 9, dur: 2.6, x: corner[0], y: corner[1] };
      }
      if (this.opts.glitchNums !== false && R() < Math.min(0.7, 0.2 + 0.1 * reb)) {
        const n = R() < 0.3 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const kind = R() < 0.6 ? 'seed' : 'track';
          const text = kind === 'seed' ? SQ.pick(['seed 0', 'seed 3:33', 'seed 0000', 'seed 09.09', 'seed ????', 'cycle 0', 'seed 1 of 9']) : SQ.pick(['♪ we are listening', '♪ ??????', '♪ do not stop watching', '♪ signal 0%', '♪ the ninth']);
          this.myst.glitches.push({ at: 3 + R() * 18, dur: 0.35, kind, text });
        }
      }
    }

    // The grey square nobody talks about. Drawn in screen space inside the arena, never in the game.
    drawNinth(ctx) {
      const m = this.myst;
      if (!m) return;
      const A = SQ.ARENA;
      let alpha = 0;
      let x = 0;
      let y = 0;
      const n = m.ninth;
      if (n && this.phase === 'play' && this.playT >= n.at && this.playT < n.at + n.dur) {
        const t = this.playT - n.at;
        alpha = 0.5 * Math.min(1, t / 0.8, (n.dur - t) / 0.8);
        x = n.x;
        y = n.y;
        if (!n.logged) {
          n.logged = true;
          m.log.push(`${SQ.fmtClock(this.videoT)} the grey ninth square appeared (${y < 0.5 ? 'top' : 'bottom'} ${x < 0.5 ? 'left' : 'right'}) for about 2 seconds`);
        }
      }
      // in a reboot video it stands in a corner while the Frame is down
      const r = this.reboot;
      if (r && !r.done && r.t > 2.2 && r.t < r.end - 0.6) {
        alpha = Math.max(alpha, 0.38 * Math.min(1, (r.t - 2.2) / 1, (r.end - 0.6 - r.t) / 0.5));
        x = 0.86;
        y = 0.86;
        if (!r.ninthLogged) {
          r.ninthLogged = true;
          m.log.push(`${SQ.fmtClock(this.videoT)} the grey square watches from the bottom right during the signal loss`);
        }
      }
      if (alpha <= 0.01) return;
      ctx.save();
      ctx.beginPath();
      ctx.rect(A.x, A.y, A.size, A.size);
      ctx.clip();
      ctx.globalAlpha = alpha;
      SQ.drawSquare(ctx, A.x + x * A.size, A.y + y * A.size, 64, SQ.NINTH, { lookX: 0, lookY: 0, mood: 'normal', pupil: 0.55 });
      ctx.restore();
    }

    // The one-frame clue: dark, dim text, gone before the eye can catch it.
    drawHiddenFrame(ctx) {
      const h = this.myst && this.myst.hidden;
      if (!h || this.videoT < h.at || this.videoT >= h.at + 0.07) return;
      if (!h.logged) {
        h.logged = true;
        this.myst.log.push(`${SQ.fmtClock(this.videoT)} hidden frame: "${h.text.split('|').map((l) => l.trim()).join(' ')}" (about 2 frames long)`);
      }
      const A = SQ.ARENA;
      ctx.save();
      ctx.fillStyle = 'rgba(6,8,10,0.96)';
      ctx.fillRect(A.x, A.y, A.size, A.size);
      ctx.fillStyle = '#5a6e60';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = h.text.split('|');
      let size = 64;
      ctx.font = `700 ${size}px ${SQ.fontBody}`;
      for (const l of lines) size = Math.min(size, SQ.fitSize(ctx, [{ t: l }], A.size - 120, 64));
      ctx.font = `700 ${size}px ${SQ.fontBody}`;
      lines.forEach((l, i) => ctx.fillText(l.trim(), A.x + A.size / 2, A.y + A.size / 2 + (i - (lines.length - 1) / 2) * size * 1.3));
      ctx.restore();
    }

    // A footer number that is wrong for a moment, if this video has one.
    glitchText(kind) {
      const m = this.myst;
      if (!m || this.phase !== 'play') return null;
      for (const g of m.glitches) {
        if (g.kind === kind && this.playT >= g.at && this.playT < g.at + g.dur) {
          if (!g.logged) {
            g.logged = true;
            m.log.push(`${SQ.fmtClock(this.videoT)} the ${kind === 'seed' ? 'seed' : 'song name'} in the corner read "${g.text}" for a moment`);
          }
          return g.text;
        }
      }
      return null;
    }

    // The hidden fragment, drawn over the frozen match: a search, then the word decodes out of noise.
    drawTransmission(ctx) {
      const r = this.reboot;
      if (!r || r.done || r.t < 0.3) return;
      const T0 = 0.6 + 1.4; // full static, then a moment of searching before anything arrives
      const W = SQ.W;
      const A = SQ.ARENA;
      const fade = Math.min(1, (r.t - 0.3) / 0.5) * Math.min(1, (r.end - r.t) / 0.3);
      const cy = A.y + A.size / 2;
      ctx.save();
      ctx.fillStyle = `rgba(4,6,8,${0.42 * fade})`; // light enough to see the squares staring
      ctx.fillRect(0, 0, W, SQ.H);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = fade;
      ctx.font = `700 32px ${SQ.fontBody}`;
      // a slow pulse instead of a blink
      ctx.globalAlpha = fade * (0.65 + 0.35 * Math.sin(r.t * 3));
      ctx.fillStyle = '#ff4d5e';
      ctx.fillText(r.t < T0 ? 'SEARCHING FOR SIGNAL' : 'INCOMING TRANSMISSION', W / 2, cy - 190);
      const pad = (v) => String(v).padStart(2, '0');
      ctx.globalAlpha = fade;
      ctx.fillStyle = '#7f9a8a';
      ctx.fillText(`FRAGMENT ${pad(r.idx + 1)} / ${pad(r.total)}`, W / 2, cy + 170);
      if (r.t >= T0) {
        // letters arrive scrambled and settle one at a time, left to right
        const text = r.text;
        const k = (r.t - T0) / r.decode;
        const settled = Math.floor(k * text.length);
        const GLYPHS = '#%&@$*+=/<>?01ABCDEFXZ';
        let str = '';
        for (let i = 0; i < text.length; i++) {
          if (text[i] === ' ' || i < settled) str += text[i];
          else str += GLYPHS[(Math.abs(Math.sin((i + 1) * 12.9898 + Math.floor(r.t * 8) * 78.233)) * 43758.5453 * GLYPHS.length | 0) % GLYPHS.length];
        }
        const size = SQ.fitSize(ctx, [{ t: str }], W - 160, 150);
        ctx.font = `${size}px ${SQ.fontDisplay}`;
        const jitter = 0;
        const last = r.idx === r.total - 1;
        ctx.globalAlpha = fade;
        ctx.lineJoin = 'round';
        ctx.lineWidth = 14;
        ctx.strokeStyle = '#000';
        ctx.strokeText(str, W / 2 + jitter, cy);
        ctx.fillStyle = last ? '#ff4d5e' : settled >= text.length ? '#e6fff0' : '#9fd9b5';
        ctx.fillText(str, W / 2 + jitter, cy);
      } else if (Math.floor(r.t * 3) % 2) {
        // a cursor waiting for something to come through
        ctx.fillStyle = '#9fd9b5';
        ctx.fillRect(W / 2 - 30, cy - 55, 60, 110);
      }
      ctx.restore();
    }

    slowmo(scale, dur, muffle) {
      this.timeScale = scale;
      this.slowT = dur;
      if (muffle) this.audio.muffle(true);
    }

    frame(ts) {
      const realDt = Math.min(0.05, Math.max(0, (ts - this.last) / 1000));
      this.last = ts;
      if (this.paused) {
        requestAnimationFrame((t) => this.frame(t));
        return;
      }
      this.videoT = (this.videoT || 0) + realDt;
      // play time stands still while the Frame is down, so nothing scheduled happens during the event
      if (this.phase === 'play' && !(this.reboot && !this.reboot.done)) this.playT = (this.playT || 0) + realDt;
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
          this.chatT = 1.2;
          this.startLines = 2;
        }
      }
      if (P === 'play') {
        this.audio.intensity = m.intensity ? m.intensity() : 0.6;
        // now and then someone says something in their own voice
        this.chatT -= realDt;
        if (this.chatT <= 0 && !(this.reboot && !this.reboot.done)) {
          const a = this.actors();
          const who = a[Math.floor(Math.random() * a.length)];
          const ev = this.startLines > 0 ? 'start' : 'idle';
          if (who && this.fx.voice(who, ev, this.startLines > 0) && this.startLines > 0) this.startLines--;
          this.chatT = this.startLines > 0 ? 0.9 : this.opts.memes === 2 ? 2 + Math.random() * 2 : 3.5 + Math.random() * 3.5;
        }
        if (m.winner) {
          this.setPhase('finale');
          this.fx.quiet = true;
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
        this.fx.banner(w.text, w.sub, w.team.color, 5.2, { y: SQ.ARENA.y + SQ.ARENA.size * 0.78, size: 96, force: true });
        this.fx.confettiBurst([w.team.color, w.team.light, '#ffffff', '#ffd23f'], 220);
        this.audio.fanfare();
        this.audio.intensity = 1;
        this.cam.punch(0.3);
      }
      if (P === 'outro') {
        const w = m.winnerEnt;
        if (w) this.cam.focus(w.x, w.y, 2.1, 0, 3);
        if (this.phaseT > 0.9 && !this.winLine) {
          this.winLine = true;
          if (w) this.fx.voice(w, 'win', true);
        }
        if (this.phaseT > 1.7 && !this.memeDone && this.opts.memes > 0) {
          this.memeDone = true;
          this.audio.boom();
          this.cam.shake(10);
          const list = SQ.MEMES.winner;
          this.winnerCaption = list[Math.floor(Math.random() * list.length)];
        }
        const finishAt = this.tour ? 4 : this.opts.reel ? 3.6 : 6.2;
        // the music fades out just before the end, so a saved clip never stops mid-song
        if (this.phaseT > finishAt - 0.8 && !this.tour && !this.musicFaded) {
          this.musicFaded = true;
          this.audio.stopMusic(1.2);
        }
        if (this.phaseT > finishAt) this.finish();
      }
      if (P === 'bracket' && this.phaseT > 4.4) {
        const nx = this.tour.next;
        this.newMatch(nx.seed, { tour: true, mode: nx.id, teams: nx.pair });
      }
      if (P === 'champion' && this.phaseT > 7) this.finishTour();
      if (P === 'intro' || P === 'countdown' || P === 'bracket' || P === 'champion' || P === 'between') simulate = false;
      if (P !== 'outro') {
        this.musicFaded = false;
        this.memeDone = false;
        this.winLine = false;
      }

      if (this.hitstopT > 0) {
        this.hitstopT -= realDt;
        simulate = false;
      }
      if (this.reboot && !this.reboot.done) simulate = false; // the world stops while the Frame is down
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
      // this.phase, not P: when a match ends this frame the camera must stay on the winner
      if (this.phase === 'play' && !this.cam.tracking && this.cam.hold <= 0) {
        // the resting view always shows the whole arena, edge to edge
        this.cam.setDefault(500, 500, 1);
        this.cam.tx = this.cam.defaultView.x;
        this.cam.ty = this.cam.defaultView.y;
        this.cam.tz = this.cam.defaultView.z;
      }
      if (P === 'idle' && m.winner) this.makeIdle();
      this.updateReboot(realDt);
      this.glitch = Math.max(0, this.glitch - realDt * 2.4);
      this.cam.update(realDt);
      this.fx.update(realDt * this.timeScale, realDt);
      if (this.trackToast > 0) this.trackToast -= realDt;
      if (this.hook) {
        this.hook.t += realDt;
        if (this.hook.t > this.hook.dur || this.phase !== 'play') this.hook = null;
      }
    }

    // Everyone on the field who could say something.
    actors() {
      const m = this.mode;
      if (!m) return [];
      const list = m.ents || m.balls || m.racers || m.marbles || m.sq || [];
      return list.filter((e) => e.alive !== false && !e.finished);
    }

    // ---------------- tournament ----------------
    newTournament(seed) {
      this.audio.init();
      this.episode++;
      this.seed = seed != null ? seed >>> 0 : SQ.randomSeed();
      const rng = SQ.makeRng(this.seed);
      this.setPaused(false);
      this.recorder.abort();
      this.tour = { seed: this.seed, rng, rounds: [rng.shuffle(SQ.TEAMS)], results: [[], [], []], round: 0, match: 0, part: 0, lastMode: null, champion: null, lastResult: null };
      this.videos = [];
      this.video = null;
      this.setQuality(this.opts.quality);
      this.fx.clear();
      this.cam.reset();
      this.cam.worldH = SQ.WORLD;
      this.track = this.audio.pickTrack(this.opts.music);
      this.audio.intensity = 0.35;
      this.audio.playTrack(this.track);
      this.trackToast = 4;
      this.emit('match', { tour: true, seed: this.seed, track: this.track });
      this.enterBracket();
    }

    roundName(n) {
      return n === 8 ? 'QUARTERFINAL' : n === 4 ? 'SEMIFINAL' : n === 2 ? 'FINAL' : 'CHAMPION';
    }

    enterBracket() {
      const t = this.tour;
      const list = t.rounds[t.round];
      const pair = [list[t.match * 2], list[t.match * 2 + 1]];
      let id;
      do id = t.rng.pick(TOUR_MODES);
      while (id === t.lastMode);
      t.lastMode = id;
      t.next = { pair, id, seed: t.rng.int(1, 1e9) };
      t.part++;
      if (t.coinFlip && t.coinFlip.shown) t.coinFlip = null;
      else if (t.coinFlip) t.coinFlip.shown = true;
      this.stage = list.length === 2 ? 'FINAL' : `${this.roundName(list.length)} ${t.match + 1}`;
      this.fx.clear();
      this.setPhase('bracket');
      this.audio.whoosh();
      this.audio.intensity = 0.35;
      // each match is saved as its own part, which suits a multi-part series of reels
      if (this.opts.record && this.recorder.supported && !this.recorder.active) {
        this.recorder.start(this.view, this.audio.streamDest && this.audio.streamDest.stream, 30, SQ.RES === 1 ? 9_000_000 : 5_000_000);
      }
    }

    async finishTourMatch() {
      const t = this.tour;
      if (!this.reboot) this.advanceSignal();
      const res = this.mode.winner;
      this.emitResult();
      // a knockout needs someone to advance: a tie is settled by a coin flip
      const w = res.tie ? t.rng.pick(res.tied) : res.team;
      if (res.tie) t.coinFlip = { team: w, at: t.round };
      t.results[t.round][t.match] = w;
      t.lastResult = { r: t.round, i: t.match };
      t.match++;
      if (t.match * 2 >= t.rounds[t.round].length) {
        t.rounds.push(t.results[t.round].slice());
        t.round++;
        t.match = 0;
      }
      if (t.rounds[t.round].length === 1) {
        t.champion = t.rounds[t.round][0];
        this.stage = 'CHAMPION';
        this.fx.clear();
        this.setPhase('champion');
        this.audio.fanfare();
        this.audio.intensity = 1;
        this.fx.confettiBurst([t.champion.color, t.champion.light, '#ffd23f', '#ffffff'], 260);
        return;
      }
      this.setPhase('between');
      await this.savePart();
      this.enterBracket();
    }

    async savePart() {
      if (!this.recorder.active) return;
      const blob = await this.recorder.stop();
      if (!blob || !blob.size) return;
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const info = this.matchInfo();
      const v = { blob, ext, part: this.tour.part, name: `${info.name}.${ext}`, info: info.file };
      this.videos.push(v);
      this.emit('part', v);
    }

    async finishTour() {
      this.setPhase('done');
      this.audio.stopMusic(1.5);
      await this.savePart();
      const c = this.tour.champion;
      this.emit('done', { winner: { team: c, text: `${c.name.toUpperCase()} IS THE CHAMPION` }, video: null, tour: true });
    }

    // Remembers what happened in a match (event banners, meme moments) for the video name.
    logEvent(text) {
      if (!this.matchLog || (this.phase !== 'play' && this.phase !== 'finale')) return;
      const t = String(text).replace(/[^\p{L}\p{N} %'!&+-]/gu, '').trim();
      // the signal event is already in the name as the signal part
      if (!t || t === 'GO!' || t.startsWith('SIGNAL ') || this.matchLog.includes(t) || this.matchLog.length >= 8) return;
      this.matchLog.push(t);
    }

    // Everything worth knowing about the match that just ended: a file name packed with it,
    // and a longer text with the lore, for writing titles and descriptions.
    matchInfo() {
      const m = this.mode;
      const w = m.winner;
      const teams = m.teams || [];
      const title = (s) => s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase());
      const events = (this.matchLog || []).map(title);
      const losers = w && !w.tie ? teams.filter((t) => t !== w.team) : [];
      const result = !w ? 'no result' : w.tie ? `tie between ${w.tied.map((t) => t.name).join(' and ')}` : `${w.team.name} beats ${losers.map((t) => t.name).join(' ')}`;
      const where = this.tour ? `Trinity Games ${this.tour.seed} ${title(this.stage || '')}` : `Cycle ${this.cycle || this.episode}`;
      const signal = this.reboot ? `signal lost at ${this.matchSignal}%, Frame rebooted, fragment ${this.reboot.idx + 1} of ${this.reboot.total} ${this.reboot.plain}` : `signal ${this.matchSignal}%`;
      const seen = this.myst && this.myst.ninth && this.myst.ninth.logged ? 'grey square seen' : '';
      const parts = [where, this.modeInfo.name, result, w && w.sub ? w.sub : '', events.join(', '), seen, signal, `seed ${this.tour ? this.tour.seed : this.seed}`];
      let name = parts.filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ');
      if (name.length > 200) name = name.slice(0, 200).trim();
      // the long version, with where each square is from
      const who = (t) => {
        const L = SQ.LORE[t.base];
        const P = SQ.persona(t);
        return `${t.name} (${P.title}${L ? `, ${L.sector}` : ''})`;
      };
      const lines = [
        `${where}: ${this.modeInfo.name}`,
        `Contestants: ${teams.map(who).join(', ')}`,
        `Result: ${result}${w && w.sub ? ` (${w.sub})` : ''}`,
      ];
      if (w && !w.tie) {
        const L = SQ.LORE[w.team.base];
        const rival = L && teams.find((t) => t.base === L.rival);
        if (rival) lines.push(`Rivalry: ${w.team.name} beat its rival ${rival.name}, who ${L.rivalWhy}`);
      }
      if (events.length) lines.push(`What happened: ${events.join(', ')}`);
      lines.push(`Signal: ${this.reboot ? `lost at ${this.matchSignal}%, the Frame rebooted mid-match` : `${this.matchSignal}% static`}`);
      if (this.tour && this.tour.champion) lines.push(`Champion of the Trinity Games: ${this.tour.champion.name}`);
      if (this.reboot) lines.push(`Hidden transmission: fragment ${this.reboot.idx + 1} of ${this.reboot.total}, "${this.reboot.plain}"${this.reboot.text !== this.reboot.plain ? `, shown in code as "${this.reboot.text}"` : ''}`);
      if (this.myst && this.myst.log.length) lines.push('Secrets in this video (times are from the start of the video):', ...this.myst.log.map((l) => '  ' + l));
      // a ready-to-post title and caption; the same match always gets the same one
      const post = w
        ? SQ.writeCaption(
            {
              mode: this.modeInfo.id,
              modeName: this.modeInfo.name,
              cycle: this.cycle || this.episode,
              winner: w.team,
              losers,
              tie: !!w.tie,
              tied: w.tied || [],
              sub: w.sub,
              rebooted: !!this.reboot,
              fragment: this.reboot ? this.reboot.idx + 1 : 0,
              fragments: this.reboot ? this.reboot.total : 0,
              ninthSeen: !!(this.myst && this.myst.ninth && this.myst.ninth.logged),
              count: teams.length,
            },
            SQ.makeRng((this.seed ^ 0x5bd1e995) >>> 0)
          )
        : null;
      const text = lines.join('\n');
      const file = post ? `TITLE\n${post.title}\n\nCAPTION\n${post.caption}\n\n${post.tags}\n\nMATCH INFO\n${text}\n` : text + '\n';
      return { name, text, post, file };
    }

    // Tells the page who played and who won, for the win stats.
    emitResult() {
      const m = this.mode;
      if (!m || !m.winner) return;
      this.emit('result', {
        mode: this.modeInfo.id,
        teams: m.teams.map((t) => t.base),
        winner: m.winner.tie ? null : m.winner.team.base,
        tied: m.winner.tie ? m.winner.tied.map((t) => t.base) : null,
      });
    }

    async finish() {
      if (this.tour) return this.finishTourMatch();
      if (!this.reboot) this.advanceSignal(); // the video that rebooted starts the next series clean
      this.emitResult();
      this.setPhase('done');
      if (this.recorder.active) {
        const blob = await this.recorder.stop();
        if (blob && blob.size) {
          const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
          const info = this.matchInfo();
          this.video = { blob, ext, name: `${info.name}.${ext}`, info: info.file };
        }
      }
      // the page starts the next match itself when auto-next is on, so its buttons stay in step
      this.emit('done', { winner: this.mode.winner, video: this.video });
    }

    // ---------------- rendering ----------------
    render() {
      this.renderScene();
      const amt = (this.opts.static || 0) / 100;
      // a gentle curve: the first videos of a series only get a faint grain; steady for the whole video
      const noise = Math.pow(amt, 1.3);
      const glitch = amt > 0 ? this.glitch * (0.4 + 0.6 * amt) : 0;
      if (this.post) this.post.draw(this.canvas, (this.opts.fisheye || 0) / 100, noise, glitch, (this.opts.crt || 0) / 100);
      else if (noise + glitch > 0.01) this.drawStatic2D(noise + glitch * 0.6);
    }

    // Without WebGL there is no fish-eye, but static still works as a grain layer.
    drawStatic2D(a) {
      if (!this.grainTile) {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const g = c.getContext('2d');
        const img = g.createImageData(256, 256);
        for (let i = 0; i < img.data.length; i += 4) {
          const v = (Math.random() * 255) | 0;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        this.grainTile = c;
      }
      const ctx = this.ctx;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = Math.min(0.6, a * 0.55);
      const ox = (Math.random() * 256) | 0;
      const oy = (Math.random() * 256) | 0;
      for (let y = -oy; y < this.canvas.height; y += 256) for (let x = -ox; x < this.canvas.width; x += 256) ctx.drawImage(this.grainTile, x, y);
      ctx.restore();
    }

    renderScene() {
      const ctx = this.ctx;
      const A = SQ.ARENA;
      const m = this.mode;
      ctx.setTransform(SQ.RES, 0, 0, SQ.RES, 0, 0);
      this.drawBackdrop(ctx);
      if (this.tour && (this.phase === 'bracket' || this.phase === 'champion' || (this.phase === 'done' && this.tour.champion))) {
        this.drawBracket(ctx);
        this.fx.drawScreen(ctx);
        this.drawFooter(ctx);
        return;
      }
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
      this.drawNinth(ctx);

      this.drawBelow(ctx);
      if (m.drawScreen && this.phase !== 'idle') m.drawScreen(ctx);
      if (this.hook) this.drawHook(ctx);
      if (this.phase === 'intro') this.drawIntro(ctx);
      if (this.phase === 'countdown') this.drawCountdown(ctx);
      this.drawTransmission(ctx);
      this.fx.drawScreen(ctx);
      if (this.phase === 'done') this.drawEndCard(ctx);
      this.drawFooter(ctx);
      this.drawHiddenFrame(ctx);
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
      const key = this.phase + '|' + (this.tour ? this.stage : '') + '|' + this.episode + '|' + this.mode.title + '|' + JSON.stringify(this.mode.rules);
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
      const tag = this.phase === 'idle' ? 'SQUARES TRINITY' : this.tour ? `TRINITY GAMES  ·  ${this.stage}  ·  ${m.title}` : `SQUARES TRINITY  ·  EP ${this.episode}  ·  ${m.title}`;
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
      const gap = n <= 4 ? size * 1.3 : size * 0.35; // room for the longer labels
      const total = n * size + (n - 1) * gap;
      ctx.save();
      ctx.globalAlpha = out;
      teams.forEach((tm, i) => {
        const kk = SQ.clamp((t - 0.6 - i * 0.12) / 0.35, 0, 1);
        if (kk <= 0) return;
        const x = SQ.W / 2 - total / 2 + size / 2 + i * (size + gap);
        const y = A.y + A.size * 0.6 - Math.abs(Math.sin(t * 5 + i)) * 16;
        SQ.drawSquare(ctx, x, y, size * SQ.ease.outBack(kk), tm, { mood: i % 2 ? 'angry' : 'normal', lookX: Math.sin(t * 2 + i), squash: Math.sin(t * 10 + i) * 0.06 });
        // each label is shrunk to its own slot so long names like DOUCHECUBE never run into a neighbour
        const slot = size + gap - 6;
        const nameSize = SQ.fitSize(ctx, [{ t: tm.name }], slot, Math.min(36, size * 0.36));
        SQ.outlinedText(ctx, tm.name, x, y + size * 0.85, nameSize, tm.color, { stroke: 7 });
        const P = SQ.persona(tm);
        const L = SQ.LORE[tm.base];
        const home = L && teams.length <= 4 ? ` · ${L.sector.replace(/^(Sector|the) /, '')}` : '';
        const sub = P.title + home;
        let subSize = Math.min(24, size * 0.24);
        ctx.font = `700 ${subSize}px ${SQ.fontBody}`;
        const sw = ctx.measureText(sub).width;
        if (sw > slot) subSize = Math.floor((subSize * slot) / sw);
        SQ.outlinedText(ctx, sub, x, y + size * 0.85 + Math.min(36, size * 0.36) * 0.95, subSize, '#ffffff', { stroke: 5, font: SQ.fontBody, weight: 700 });
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

    // The Reel mode hook: a big line over the header for the first seconds.
    drawHook(ctx) {
      const h = this.hook;
      const inK = SQ.ease.outBack(SQ.clamp(h.t / 0.25, 0, 1));
      const outK = 1 - SQ.clamp((h.t - (h.dur - 0.35)) / 0.35, 0, 1);
      ctx.save();
      ctx.globalAlpha = outK;
      ctx.fillStyle = '#0c0d14';
      ctx.fillRect(0, 0, SQ.W, SQ.ARENA.y - 12);
      ctx.translate(SQ.W / 2, 250);
      const pulse = 1 + 0.03 * Math.sin(h.t * 14);
      ctx.scale(inK * pulse, inK * pulse);
      const size = SQ.fitSize(ctx, [{ t: h.text }], SQ.W - 80, 104);
      SQ.outlinedText(ctx, h.text, 0, -10, size, '#ffd23f', { stroke: size * 0.18 });
      SQ.outlinedText(ctx, 'comment your pick', 0, size * 0.85, 42, '#ffffff', { stroke: 9, font: SQ.fontBody, weight: 700 });
      ctx.restore();
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
        const cs = Math.max(22, size * 0.5);
        ctx.font = `${cs}px ${SQ.fontDisplay}`;
        const half = ctx.measureText(this.winnerCaption).width / 2 + 12;
        // keep it inside the arena; near the top the speech bubble flips below the square, so go under that
        const cx = SQ.clamp(w.x, half, SQ.WORLD - half);
        const worldH = this.mode.worldH || SQ.WORLD;
        const bubbleBelow = w.y - size / 2 - 40 < 28; // same test as the bubble in fx.js
        const cy = Math.min(w.y + size * 0.5 + (bubbleBelow ? 100 : 30), worldH - cs * 0.6);
        SQ.outlinedText(ctx, this.winnerCaption, cx, cy, cs, '#ffffff', { stroke: 7 });
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
      if (w.tie) {
        // every tied square side by side, dazed
        const n = w.tied.length;
        const size = Math.min(180, 700 / n);
        w.tied.forEach((t, i) => {
          const x = SQ.W / 2 + (i - (n - 1) / 2) * size * 1.3;
          SQ.drawSquare(ctx, x, A.y + 380, size, t, { mood: 'dead', angle: Math.sin(this.real * 3 + i) * 0.12 });
        });
      } else {
        SQ.drawSquare(ctx, SQ.W / 2, A.y + 380, 220, w.team, { mood: 'happy', squash: Math.sin(this.real * 6) * 0.05 });
        if (this.opts.memes > 0) SQ.drawSunglasses(ctx, SQ.W / 2, A.y + 372, 210);
      }
      SQ.outlinedText(ctx, w.text, SQ.W / 2, A.y + 620, 96, w.team.color, { stroke: 16 });
      SQ.outlinedText(ctx, 'Follow for the next episode', SQ.W / 2, A.y + 720, 40, '#ffffff', { stroke: 8, font: SQ.fontBody, weight: 700 });
      ctx.restore();
    }

    // The cup bracket: quarterfinals, semis, final and the champion, in four columns.
    drawBracket(ctx) {
      const t = this.tour;
      const T = this.phaseT;
      const W = SQ.W;
      const champ = this.phase !== 'bracket';
      ctx.save();
      if (champ) ctx.globalAlpha = 0.28;
      SQ.drawEmoji(ctx, '🏆', W / 2, 130, 100);
      SQ.outlinedText(ctx, 'THE TRINITY GAMES', W / 2, 250, 64, '#ffd23f', { stroke: 12 });
      const cols = [150, 410, 670, 930];
      const labels = ['QUARTERS', 'SEMIS', 'FINAL', 'CHAMPION'];
      const top = 420;
      const bottom = 1600;
      const span = (bottom - top) / 8;
      const yOf = (r, i) => top + span * (i + 0.5) * (1 << r);
      ctx.font = `700 26px ${SQ.fontBody}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      labels.forEach((l, r) => ctx.fillText(l.split('').join('\u200A'), cols[r], 360));
      // connectors
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 4;
      for (let r = 0; r < 3; r++) {
        const n = 8 >> r;
        for (let p = 0; p < n / 2; p++) {
          const y1 = yOf(r, p * 2);
          const y2 = yOf(r, p * 2 + 1);
          const ym = yOf(r + 1, p);
          const x1 = cols[r] + 105;
          const xm = (cols[r] + 105 + cols[r + 1] - 105) / 2;
          const w = t.results[r] && t.results[r][p];
          if (w) ctx.strokeStyle = SQ.rgba(w.color, 0.8);
          else ctx.strokeStyle = 'rgba(255,255,255,0.22)';
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(xm, y1);
          ctx.lineTo(xm, y2);
          ctx.lineTo(x1, y2);
          ctx.moveTo(xm, ym);
          ctx.lineTo(cols[r + 1] - 105, ym);
          ctx.stroke();
        }
      }
      // slots
      for (let r = 0; r < 4; r++) {
        const n = 8 >> r;
        for (let i = 0; i < n; i++) {
          const team = r === 0 ? t.rounds[0][i] : t.results[r - 1] && t.results[r - 1][i];
          const x = cols[r];
          const y = yOf(r, i);
          const res = t.results[r] && t.results[r][Math.floor(i / 2)];
          const lost = team && res && res !== team;
          const isNext = this.phase === 'bracket' && r === t.round && Math.floor(i / 2) === t.match;
          const fresh = t.lastResult && r === t.lastResult.r + 1 && i === t.lastResult.i && this.phase === 'bracket';
          const pop = fresh ? SQ.ease.outBack(SQ.clamp((T - 0.3) / 0.5, 0, 1)) : 1;
          ctx.save();
          ctx.translate(x, y);
          ctx.scale(pop, pop);
          ctx.globalAlpha = (champ ? 0.28 : 1) * (lost ? 0.35 : 1);
          ctx.fillStyle = '#1b1e2b';
          SQ.roundRect(ctx, -105, -44, 210, 88, 16);
          ctx.fill();
          ctx.lineWidth = isNext ? 6 + 3 * Math.sin(T * 8) : 4;
          ctx.strokeStyle = isNext ? '#ffd23f' : team ? team.color : 'rgba(255,255,255,0.2)';
          ctx.stroke();
          if (team) {
            SQ.drawSquare(ctx, -62, 0, 50, team, { mood: lost ? 'dead' : res === team || r === 3 ? 'happy' : isNext ? 'angry' : 'normal' });
            ctx.font = `700 30px ${SQ.fontBody}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(team.name, -26, 2, 124);
          } else {
            SQ.outlinedText(ctx, '?', 0, 2, 44, 'rgba(255,255,255,0.35)', { stroke: 0 });
          }
          ctx.restore();
        }
      }
      if (this.phase === 'bracket') {
        const nx = t.next;
        const [a, b] = nx.pair;
        const inK = SQ.ease.outBack(SQ.clamp(T / 0.4, 0, 1));
        ctx.save();
        ctx.translate(W / 2, 1700);
        ctx.scale(inK, inK);
        if (t.coinFlip && T < 3) SQ.outlinedText(ctx, `LAST MATCH WAS A TIE · ${t.coinFlip.team.name.toUpperCase()} WON THE COIN FLIP`, 0, -120, 28, '#ffffff', { stroke: 6 });
        SQ.outlinedText(ctx, `NEXT UP  ·  ${this.stage}`, 0, -58, 34, '#ffd23f', { stroke: 7 });
        const size = SQ.fitSize(ctx, [{ t: a.name + ' VS ' + b.name }], W - 120, 72);
        SQ.richLine(ctx, [{ t: a.name.toUpperCase(), c: a.color }, { t: '  VS  ', c: '#ffffff' }, { t: b.name.toUpperCase(), c: b.color }], 0, 14, size);
        SQ.outlinedText(ctx, SQ.modes[nx.id].name, 0, 88, 42, '#ffffff', { stroke: 8, font: SQ.fontBody, weight: 700 });
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(140, 1830, W - 280, 8);
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(140, 1830, (W - 280) * SQ.clamp(T / 4.4, 0, 1), 8);
      }
      ctx.restore();

      if (champ && t.champion) {
        const c = t.champion;
        const k = SQ.ease.outBack(SQ.clamp(T / 0.6, 0, 1));
        ctx.save();
        ctx.translate(W / 2, 900);
        ctx.scale(k, k);
        SQ.drawEmoji(ctx, '👑', 0, -250 - Math.abs(Math.sin(this.real * 3)) * 16, 130);
        SQ.drawSquare(ctx, 0, 0, 320, c, { mood: 'happy', squash: Math.sin(this.real * 6) * 0.04 });
        if (this.opts.memes > 0) SQ.drawSunglasses(ctx, 0, -12, 300);
        SQ.outlinedText(ctx, 'CHAMPION', 0, 290, 120, '#ffd23f', { stroke: 20 });
        SQ.outlinedText(ctx, c.name.toUpperCase(), 0, 420, 96, c.color, { stroke: 16 });
        const lore = SQ.LORE[c.base];
        SQ.outlinedText(ctx, 'survives the Trinity Games', 0, 520, 44, '#ffffff', { stroke: 9, font: SQ.fontBody, weight: 700 });
        if (lore) SQ.outlinedText(ctx, `${lore.sector} gets one more cycle of peace`, 0, 580, 34, c.light, { stroke: 8, font: SQ.fontBody, weight: 700 });
        ctx.restore();
      }
    }

    drawFooter(ctx) {
      ctx.save();
      ctx.font = `600 26px ${SQ.fontBody}`;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.textAlign = 'left';
      if (this.phase !== 'idle') ctx.fillText(this.glitchText('seed') || `seed ${this.seed}`, 44, SQ.H - 44);
      ctx.textAlign = 'right';
      if (this.track && this.phase !== 'idle') {
        const a = this.trackToast > 0 ? 1 : 0.45;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(this.glitchText('track') || `♪ ${this.track.name}`, SQ.W - 44, SQ.H - 44);
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
