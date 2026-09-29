// Audio: a procedural music generator (every track is synthesized in code,
// so it is copyright free by construction) plus synthesized sound effects.
(function () {
  const SQ = (window.SQ = window.SQ || {});

  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    harmonic: [0, 2, 3, 5, 7, 8, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    penta: [0, 2, 4, 7, 9, 12, 14],
  };

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // Drum patterns are 16 steps: k = kick, s = snare, c = clap, h = hat, o = open hat, t = tom
  const DRUMS = {
    rock: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '..............x.' },
    four: { k: 'x...x...x...x...', c: '....x.......x...', h: '..x...x...x...x.', o: '..x...x...x...x.' },
    chip: { k: 'x.......x.x.....', s: '....x.......x..x', h: 'x.xxx.xxx.xxx.xx' },
    lofi: { k: 'x......x..x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xx' },
    epic: { k: 'x..x..x...x..x..', t: '..x.....x.x...xx', s: '....x.......x...', h: 'x...x...x...x...' },
    trap: { k: 'x......x..x.....', c: '........x.......', h: 'xxxxxxxxxxxxxxxx' },
    pop: { k: 'x...x...x...x...', c: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' },
  };

  const STYLES = {
    synthwave: { bpm: [98, 112], scale: 'minor', drums: 'rock', lead: 'sawtooth', bass: 'sawtooth', pad: 'sawtooth', arp: true, bassPat: 'eighths', swing: 0, cutoff: 2600 },
    chiptune: { bpm: [132, 150], scale: 'major', drums: 'chip', lead: 'square', bass: 'triangle', pad: 'square', arp: true, bassPat: 'octave', swing: 0, cutoff: 5000 },
    lofi: { bpm: [74, 86], scale: 'dorian', drums: 'lofi', lead: 'triangle', bass: 'sine', pad: 'triangle', arp: false, bassPat: 'roots', swing: 0.2, cutoff: 1400 },
    house: { bpm: [120, 126], scale: 'minor', drums: 'four', lead: 'square', bass: 'sawtooth', pad: 'sawtooth', arp: false, bassPat: 'offbeat', stabs: true, swing: 0.05, cutoff: 2200 },
    epic: { bpm: [86, 98], scale: 'harmonic', drums: 'epic', lead: 'sawtooth', bass: 'sawtooth', pad: 'sawtooth', arp: true, bassPat: 'roots', swing: 0, cutoff: 1800 },
    bubblegum: { bpm: [116, 128], scale: 'major', drums: 'pop', lead: 'triangle', bass: 'square', pad: 'triangle', arp: true, bassPat: 'bounce', swing: 0, cutoff: 3800 },
    dungeon: { bpm: [104, 118], scale: 'phrygian', drums: 'chip', lead: 'square', bass: 'square', pad: 'triangle', arp: true, bassPat: 'octave', swing: 0, cutoff: 3000 },
    trap: { bpm: [140, 150], scale: 'minor', drums: 'trap', lead: 'triangle', bass: 'sub', pad: 'sawtooth', arp: false, bassPat: 'eight08', swing: 0, cutoff: 1600, halftime: true },
  };

  const LIBRARY = [
    { name: 'Neon Drive', style: 'synthwave', seed: 101 },
    { name: 'Pixel Rush', style: 'chiptune', seed: 202 },
    { name: 'Lo-Fi Squares', style: 'lofi', seed: 303 },
    { name: 'Bounce House', style: 'house', seed: 404 },
    { name: 'Arena Anthem', style: 'epic', seed: 505 },
    { name: 'Bubblegum Battle', style: 'bubblegum', seed: 606 },
    { name: 'Dungeon Crawl', style: 'dungeon', seed: 707 },
    { name: '808 Cube', style: 'trap', seed: 808 },
    { name: 'Sunset Pong', style: 'synthwave', seed: 909 },
    { name: 'Final Boss', style: 'epic', seed: 1010 },
    { name: 'Coin Cascade', style: 'chiptune', seed: 1111 },
    { name: 'Midnight Grid', style: 'house', seed: 1212 },
  ];

  const ADJ = ['Turbo', 'Velvet', 'Cosmic', 'Hyper', 'Sugar', 'Chrome', 'Lunar', 'Glitch', 'Rapid', 'Candy', 'Plasma', 'Mega'];
  const NOUN = ['Cubes', 'Corners', 'Pixels', 'Bounce', 'Circuit', 'Arcade', 'Tiles', 'Rush', 'Parade', 'Voltage', 'Dash', 'Blocks'];

  function makeTrack(style, seed, name) {
    const rng = SQ.makeRng(seed);
    const st = STYLES[style];
    const scale = SCALES[st.scale];
    const bpm = Math.round(rng.range(st.bpm[0], st.bpm[1]));
    const root = rng.int(45, 52); // A2..E3
    const progs = [
      [0, 5, 3, 4],
      [0, 3, 4, 4],
      [0, 5, 2, 6],
      [0, 4, 5, 3],
      [0, 6, 5, 4],
      [0, 3, 0, 4],
      [5, 3, 0, 4],
    ];
    const prog = rng.pick(progs);
    // Lead melody: an 8-bar phrase built from a 2-bar motif with variations.
    const motif = [];
    for (let i = 0; i < 32; i++) {
      const strong = i % 4 === 0;
      if (!strong && rng.chance(0.45)) motif.push(null);
      else motif.push(strong ? rng.pick([0, 2, 4]) : rng.int(-1, 6));
    }
    const arpShape = rng.pick([
      [0, 2, 4, 7],
      [0, 4, 2, 4],
      [0, 2, 4, 2],
      [4, 2, 0, 2],
      [0, 4, 7, 4],
    ]);
    return {
      name: name || `${rng.pick(ADJ)} ${rng.pick(NOUN)}`,
      style,
      seed,
      bpm,
      root,
      scale,
      prog,
      motif,
      arpShape,
      st,
      drums: DRUMS[st.drums],
      leadOct: rng.pick([12, 24]),
    };
  }

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.musicVol = 0.45;
      this.sfxVol = 0.9;
      this.hitIndex = 0;
      this.curDeg = 0;
      this.sfxVol = 0.8;
      this.track = null;
      this.playing = false;
      this.intensity = 0.4;
      this.uploads = []; // { name, buffer }
      this.lastSfx = {};
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC());
      this.master = ctx.createGain();
      this.master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 10;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
      this.master.connect(comp);
      comp.connect(ctx.destination);
      if (ctx.createMediaStreamDestination) {
        this.streamDest = ctx.createMediaStreamDestination();
        comp.connect(this.streamDest);
      }
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = this.musicVol;
      this.musicBus.connect(this.master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = this.sfxVol;
      this.sfxBus.connect(this.master);

      // A short generated reverb shared by music and effects.
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this._impulse(1.3);
      this.revSend = ctx.createGain();
      this.revSend.gain.value = 0.28;
      this.revSend.connect(this.reverb);
      this.reverb.connect(this.master);

      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      this.drive = ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) {
        const x = (i / 1023) * 2 - 1;
        curve[i] = Math.tanh(x * 3);
      }
      this.drive.curve = curve;
      this.drive.connect(this.sfxBus);
    }

    _impulse(sec) {
      const ctx = this.ctx;
      const len = Math.floor(ctx.sampleRate * sec);
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      }
      return buf;
    }

    get now() {
      return this.ctx ? this.ctx.currentTime : 0;
    }

    setMusicVolume(v) {
      this.musicVol = v;
      if (this.musicBus) this.musicBus.gain.setTargetAtTime(v, this.now, 0.05);
    }
    setSfxVolume(v) {
      this.sfxVol = v;
      if (this.sfxBus) this.sfxBus.gain.setTargetAtTime(v, this.now, 0.05);
    }

    library() {
      return LIBRARY.map((t, i) => ({ id: 'lib' + i, name: t.name, style: t.style })).concat(
        this.uploads.map((u, i) => ({ id: 'up' + i, name: u.name, style: 'your file' }))
      );
    }

    // choice: 'shuffle' | 'generate' | 'lib3' | 'up0'
    pickTrack(choice) {
      if (choice === 'shuffle') {
        const all = this.library();
        choice = all[Math.floor(Math.random() * all.length)].id;
      }
      if (choice === 'generate') {
        const styles = Object.keys(STYLES);
        return makeTrack(styles[Math.floor(Math.random() * styles.length)], SQ.randomSeed());
      }
      if (choice && choice.startsWith('up')) {
        const u = this.uploads[+choice.slice(2)];
        if (u) return { name: u.name, style: 'your file', file: u.buffer, bpm: 120, root: 57, scale: SCALES.major };
      }
      const lib = LIBRARY[+String(choice).slice(3)] || LIBRARY[0];
      return makeTrack(lib.style, lib.seed, lib.name);
    }

    async addUpload(file) {
      this.init();
      const arr = await file.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(arr);
      const name = file.name.replace(/\.[^.]+$/, '').slice(0, 40);
      this.uploads.push({ name, buffer });
      return 'up' + (this.uploads.length - 1);
    }

    // ---------- music playback ----------
    playTrack(track) {
      this.init();
      if (!this.ctx) return;
      this.stopMusic(0.05);
      this.track = track;
      this.playing = true;
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.0001;
      this.musicGain.gain.exponentialRampToValueAtTime(1, this.now + 0.6);
      this.musicGain.connect(this.musicBus);
      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 18000;
      this.musicFilter.connect(this.musicGain);
      this.musicOut = this.musicFilter;

      if (track.file) {
        const src = this.ctx.createBufferSource();
        src.buffer = track.file;
        src.loop = true;
        src.connect(this.musicOut);
        src.start();
        this.fileSrc = src;
        return;
      }
      this.step = 0;
      this.nextTime = this.now + 0.08;
      clearInterval(this.timer);
      this.timer = setInterval(() => this._schedule(), 25);
      this._schedule();
    }

    stopMusic(fade) {
      clearInterval(this.timer);
      this.timer = null;
      this.playing = false;
      if (this.fileSrc) {
        try {
          this.fileSrc.stop(this.now + (fade || 0.3));
        } catch (e) {}
        this.fileSrc = null;
      }
      if (this.musicGain) {
        const g = this.musicGain;
        g.gain.cancelScheduledValues(this.now);
        g.gain.setValueAtTime(g.gain.value || 0.0001, this.now);
        g.gain.exponentialRampToValueAtTime(0.0001, this.now + (fade || 0.3));
        setTimeout(() => g.disconnect(), ((fade || 0.3) + 0.5) * 1000);
        this.musicGain = null;
      }
    }

    // Muffles the music, e.g. during slow motion.
    muffle(on) {
      if (!this.musicFilter) return;
      this.musicFilter.frequency.setTargetAtTime(on ? 700 : 18000, this.now, 0.08);
    }

    duck(amount, dur) {
      if (!this.musicGain) return;
      const g = this.musicGain.gain;
      g.cancelScheduledValues(this.now);
      g.setTargetAtTime(amount, this.now, 0.03);
      g.setTargetAtTime(1, this.now + dur, 0.25);
    }

    _schedule() {
      const tr = this.track;
      if (!tr || !this.playing) return;
      const stepDur = 60 / tr.bpm / 4;
      while (this.nextTime < this.now + 0.12) {
        let t = this.nextTime;
        if (this.step % 2 === 1) t += stepDur * (tr.st.swing || 0);
        this._playStep(tr, this.step, t, stepDur);
        this.nextTime += stepDur;
        this.step++;
      }
    }

    _playStep(tr, step, t, sd) {
      const s16 = step % 16;
      const bar = Math.floor(step / 16);
      const phraseBar = bar % 8;
      const I = this.intensity;
      const deg = tr.prog[bar % tr.prog.length];
      if (s16 === 0) this.curDeg = deg;
      const out = this.musicOut;
      const noteAt = (degree, oct) => {
        const sc = tr.scale;
        const n = sc.length;
        const idx = ((degree % n) + n) % n;
        const o = Math.floor(degree / n);
        return tr.root + sc[idx] + 12 * (o + (oct || 0));
      };
      const dr = tr.drums;
      const hit = (pat) => pat && pat[s16] === 'x';
      const halftime = tr.st.halftime;

      // drums
      if (hit(dr.k)) this.kick(t, 0.9, out);
      if (hit(dr.s) && I > 0.15) this.snare(t, 0.5, out);
      if (hit(dr.c) && I > 0.15) this.clap(t, 0.45, out);
      if (hit(dr.h) && (I > 0.3 || s16 % 4 === 2)) this.hat(t, 0.16 + (s16 % 2 ? 0 : 0.05), false, out);
      if (hit(dr.o) && I > 0.3) this.hat(t, 0.12, true, out);
      if (hit(dr.t) && I > 0.3) this.tom(t, 0.5, out);
      if (I > 0.85 && s16 >= 12 && phraseBar === 7) this.snare(t, 0.35, out); // fill into the next phrase
      if (s16 === 0 && phraseBar === 0 && I > 0.5) this.crash(t, 0.25, out);

      // bass
      const bp = tr.st.bassPat;
      const rootN = noteAt(deg, -1) + 12;
      let bassHit = false;
      let bn = rootN;
      if (bp === 'eighths') bassHit = s16 % 2 === 0;
      else if (bp === 'octave') {
        bassHit = s16 % 2 === 0;
        if (s16 % 4 === 2) bn += 12;
      } else if (bp === 'roots') bassHit = s16 === 0 || s16 === 10;
      else if (bp === 'offbeat') bassHit = s16 % 4 === 2;
      else if (bp === 'bounce') {
        bassHit = [0, 3, 6, 8, 11, 14].includes(s16);
        if (s16 === 6 || s16 === 14) bn += 7;
      } else if (bp === 'eight08') bassHit = s16 === 0 || s16 === 7 || s16 === 10;
      if (bassHit) {
        if (bp === 'eight08') this.sub(t, mtof(bn - 12), sd * 5, 0.6, out);
        else this.tone(t, mtof(bn), sd * 1.6, { type: tr.st.bass, gain: 0.22, cutoff: 900, q: 6, out });
      }

      // pad chords at bar start
      if (s16 === 0) {
        const chord = [noteAt(deg, 1), noteAt(deg + 2, 1), noteAt(deg + 4, 1)];
        const dur = sd * 16;
        for (const n of chord)
          this.tone(t, mtof(n), dur, { type: tr.st.pad, gain: 0.045, attack: 0.25, release: 0.4, cutoff: tr.st.cutoff * 0.6, detune: 8, out, rev: 0.5 });
      }
      if (tr.st.stabs && [2, 6, 10, 14].includes(s16) && I > 0.3) {
        for (const d of [0, 2, 4]) this.tone(t, mtof(noteAt(deg + d, 1)), sd * 0.8, { type: 'sawtooth', gain: 0.04, cutoff: 2400, out });
      }

      // arpeggio
      if (tr.st.arp && I > 0.25 && (halftime ? s16 % 2 === 0 : true)) {
        const a = tr.arpShape[s16 % tr.arpShape.length];
        const oct = I > 0.8 ? 2 : 1;
        this.tone(t, mtof(noteAt(deg + a, oct)), sd * 0.9, { type: 'square', gain: 0.03, cutoff: tr.st.cutoff, out, rev: 0.35 });
      }

      // lead melody: plays in the second half of each phrase, always when intense
      const leadOn = I > 0.55 ? true : I > 0.3 && phraseBar >= 4;
      if (leadOn) {
        const mi = (bar % 2) * 16 + s16;
        let m = tr.motif[mi];
        if (m != null) {
          if (phraseBar % 4 === 3 && s16 >= 8) m += 2; // phrase variation
          const n = noteAt(deg + m, 0) + tr.leadOct;
          let len = 1;
          while (len < 4 && tr.motif[(mi + len) % 32] == null) len++;
          this.tone(t, mtof(n), sd * len * 0.95, { type: tr.st.lead, gain: 0.07, attack: 0.01, cutoff: tr.st.cutoff * 1.2, detune: tr.st.lead === 'sawtooth' ? 7 : 0, out, rev: 0.45, vibrato: true });
        }
      }
    }

    // ---------- synth voices ----------
    tone(t, freq, dur, o) {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const out = o.out || this.sfxBus;
      const g = ctx.createGain();
      const atk = o.attack || 0.005;
      const rel = o.release || 0.08;
      const peak = o.gain || 0.1;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + atk);
      g.gain.setTargetAtTime(peak * 0.6, t + atk, dur * 0.4);
      g.gain.setTargetAtTime(0.0001, t + dur, rel / 3);
      let node = g;
      if (o.cutoff) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = o.cutoff;
        f.Q.value = o.q || 1;
        g.connect(f);
        node = f;
      }
      if (o.pan && ctx.createStereoPanner) {
        const pn = ctx.createStereoPanner();
        pn.pan.value = SQ.clamp(o.pan, -1, 1);
        node.connect(pn);
        node = pn;
      }
      node.connect(out);
      if (o.rev && this.revSend) {
        const s = ctx.createGain();
        s.gain.value = o.rev;
        node.connect(s);
        s.connect(this.revSend);
      }
      const oscs = [];
      const mk = (det) => {
        const osc = ctx.createOscillator();
        osc.type = o.type || 'sine';
        osc.frequency.setValueAtTime(freq, t);
        if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + (o.slideTime || dur));
        osc.detune.value = det;
        osc.connect(g);
        osc.start(t);
        osc.stop(t + dur + rel + 0.1);
        oscs.push(osc);
      };
      mk(0);
      if (o.detune) mk(o.detune);
      if (o.vibrato && dur > 0.2) {
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = 5.5;
        lg.gain.value = freq * 0.01;
        lfo.connect(lg);
        oscs.forEach((osc) => lg.connect(osc.frequency));
        lfo.start(t + 0.12);
        lfo.stop(t + dur + rel);
      }
    }

    noiseHit(t, dur, o) {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = o.filter || 'bandpass';
      f.frequency.setValueAtTime(o.freq || 1000, t);
      if (o.sweepTo) f.frequency.exponentialRampToValueAtTime(o.sweepTo, t + dur);
      f.Q.value = o.q || 1;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(o.gain || 0.3, t + (o.attack || 0.002));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f);
      f.connect(g);
      g.connect(o.out || this.sfxBus);
      if (o.rev && this.revSend) {
        const s = ctx.createGain();
        s.gain.value = o.rev;
        g.connect(s);
        s.connect(this.revSend);
      }
      src.start(t, Math.random() * 0.5);
      src.stop(t + dur + 0.05);
    }

    kick(t, v, out) {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      o.connect(g);
      g.connect(out || this.sfxBus);
      o.start(t);
      o.stop(t + 0.4);
    }
    snare(t, v, out) {
      this.noiseHit(t, 0.18, { freq: 1900, q: 0.8, gain: v, out, rev: 0.2 });
      this.tone(t, 190, 0.06, { type: 'triangle', gain: v * 0.4, out });
    }
    clap(t, v, out) {
      for (let i = 0; i < 3; i++) this.noiseHit(t + i * 0.011, 0.12 + i * 0.03, { freq: 1300, q: 1.4, gain: v * 0.7, out, rev: 0.3 });
    }
    hat(t, v, open, out) {
      this.noiseHit(t, open ? 0.22 : 0.045, { filter: 'highpass', freq: 7500, gain: v, out });
    }
    tom(t, v, out) {
      this.tone(t, 120, 0.3, { type: 'sine', gain: v, slideTo: 60, slideTime: 0.3, out, rev: 0.4 });
    }
    crash(t, v, out) {
      this.noiseHit(t, 1.4, { filter: 'highpass', freq: 5000, gain: v, out, rev: 0.4 });
    }
    sub(t, f, dur, v, out) {
      this.tone(t, f, dur, { type: 'sine', gain: v, slideTo: f * 0.94, out, release: 0.2 });
    }

    // ---------- sound effects ----------
    _ok(key, gapMs) {
      const n = performance.now();
      if (this.lastSfx[key] && n - this.lastSfx[key] < gapMs) return false;
      this.lastSfx[key] = n;
      return !!this.ctx;
    }

    // A note from the current track's scale, so effects sound in tune with the music.
    scaleFreq(i, oct) {
      const tr = this.track || { root: 57, scale: SCALES.major };
      const sc = tr.scale;
      const n = sc.length;
      const idx = ((i % n) + n) % n;
      return mtof(tr.root + 24 + 12 * (oct || 0) + sc[idx] + 12 * Math.floor(i / n));
    }

    // Bubble pop. Combos climb up the current chord, so streaks sound like a rising run.
    pop(i, pan) {
      if (!this._ok('pop', 35)) return;
      const t = this.now;
      const CLIMB = [0, 2, 4, 7, 9, 11, 14, 16, 18, 21];
      const f = this.scaleFreq(this.curDeg + CLIMB[SQ.clamp(i || 0, 0, CLIMB.length - 1)], 0);
      this.tone(t, f * 0.7, 0.08, { type: 'sine', gain: 0.4, slideTo: f * 1.3, slideTime: 0.05, rev: 0.25, pan });
      this.tone(t, f * 2, 0.04, { type: 'triangle', gain: 0.07, pan });
    }
    // The signature sound: each hit plays the next note of a rising and falling arpeggio
    // over the chord the music is on right now, so a busy match sounds like a melody.
    melodyHit(pan, soft) {
      if (!this._ok('mel', 45)) return;
      const RUN = [0, 2, 4, 7, 9, 11, 14, 11, 9, 7, 4, 2];
      const deg = this.curDeg + RUN[this.hitIndex++ % RUN.length];
      const f = this.scaleFreq(deg, 0);
      const t = this.now;
      const g = soft ? 0.6 : 1;
      // marimba-like: warm fundamental, a quick bright partial and a soft click
      this.tone(t, f, 0.22, { type: 'sine', gain: 0.32 * g, release: 0.35, rev: 0.25, pan });
      this.tone(t, f * 4, 0.03, { type: 'sine', gain: 0.07 * g, release: 0.05, pan });
      this.tone(t, f * 2, 0.06, { type: 'triangle', gain: 0.06 * g, release: 0.1, pan });
    }

    pluck(i) {
      if (!this._ok('pluck', 22)) return;
      const f = this.scaleFreq(i, 0);
      this.tone(this.now, f, 0.09, { type: 'triangle', gain: 0.28, release: 0.15, rev: 0.3 });
      this.tone(this.now, f * 2, 0.03, { type: 'square', gain: 0.03, cutoff: 3000 });
    }
    bonk() {
      if (!this._ok('bonk', 40)) return;
      const t = this.now;
      this.tone(t, 320, 0.09, { type: 'square', gain: 0.1, slideTo: 140, slideTime: 0.08, cutoff: 1800 });
      this.noiseHit(t, 0.05, { freq: 900, gain: 0.15 });
    }
    hit(big) {
      if (!this._ok('hit', 45)) return;
      const t = this.now;
      this.tone(t, big ? 140 : 190, 0.14, { type: 'sine', gain: 0.55, slideTo: 50, slideTime: 0.12 });
      this.noiseHit(t, big ? 0.2 : 0.1, { filter: 'lowpass', freq: 2400, gain: 0.45, rev: 0.2 });
    }
    slash() {
      if (!this._ok('slash', 60)) return;
      this.noiseHit(this.now, 0.16, { filter: 'bandpass', freq: 1200, sweepTo: 6000, q: 2, gain: 0.35 });
    }
    clank() {
      if (!this._ok('clank', 70)) return;
      const t = this.now;
      for (const f of [1250, 1870, 2630]) this.tone(t, f, 0.25, { type: 'square', gain: 0.03, release: 0.3, rev: 0.5, cutoff: 5000 });
      this.noiseHit(t, 0.06, { filter: 'highpass', freq: 3000, gain: 0.25 });
    }
    brick() {
      if (!this._ok('brick', 50)) return;
      const t = this.now;
      this.noiseHit(t, 0.12, { filter: 'lowpass', freq: 1500, gain: 0.5 });
      this.tone(t, 110, 0.08, { type: 'square', gain: 0.08, slideTo: 60 });
    }
    pickup() {
      if (!this._ok('pickup', 80)) return;
      const t = this.now;
      [0, 2, 4, 7].forEach((d, k) => this.tone(t + k * 0.05, this.scaleFreq(d, 1), 0.08, { type: 'square', gain: 0.06, cutoff: 5000, rev: 0.3 }));
    }
    // Animal-Crossing-style babble: a few quick blips in the speaker's own voice.
    babble(v) {
      if (!v || !this._ok('babble', 200)) return;
      const t0 = this.now;
      const n = v.n[0] + Math.floor(Math.random() * (v.n[1] - v.n[0] + 1));
      for (let i = 0; i < n; i++) {
        const f = v.base * Math.pow(2, ((Math.random() * 2 - 1) * v.spread) / 12);
        this.tone(t0 + i * v.rate, f, v.rate * 0.75, {
          type: v.wave,
          gain: v.wave === 'sine' ? 0.12 : 0.05,
          slideTo: f * (1 + (Math.random() - 0.3) * 0.15),
          cutoff: 3200,
          release: 0.03,
          vibrato: v.vib,
        });
      }
    }

    // soft sparkle when a power-up appears
    itemSpawn() {
      if (!this._ok('spawn', 150)) return;
      const t = this.now;
      this.tone(t, this.scaleFreq(this.curDeg + 7, 1), 0.12, { type: 'sine', gain: 0.07, rev: 0.6 });
      this.tone(t + 0.06, this.scaleFreq(this.curDeg + 11, 1), 0.18, { type: 'sine', gain: 0.06, rev: 0.6 });
    }
    ding() {
      if (!this._ok('ding', 80)) return;
      const t = this.now;
      this.tone(t, 1568, 0.5, { type: 'sine', gain: 0.18, release: 0.6, rev: 0.6 });
      this.tone(t, 2349, 0.4, { type: 'sine', gain: 0.07, release: 0.5, rev: 0.6 });
    }
    whoosh() {
      if (!this._ok('whoosh', 250)) return;
      this.noiseHit(this.now, 0.45, { filter: 'bandpass', freq: 300, sweepTo: 3500, q: 1.2, gain: 0.3, attack: 0.15 });
    }
    // The "vine boom": a deep distorted thud with a long tail.
    boom() {
      if (!this._ok('boom', 400)) return;
      const ctx = this.ctx;
      const t = this.now;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(95, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.9);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.9, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
      o.connect(g);
      g.connect(this.drive);
      const s = ctx.createGain();
      s.gain.value = 0.4;
      g.connect(s);
      s.connect(this.revSend);
      o.start(t);
      o.stop(t + 1.4);
      this.noiseHit(t, 0.5, { filter: 'lowpass', freq: 400, gain: 0.5 });
      this.duck(0.5, 0.6);
    }
    explode() {
      if (!this._ok('explode', 120)) return;
      const t = this.now;
      this.noiseHit(t, 0.9, { filter: 'lowpass', freq: 1800, sweepTo: 120, gain: 0.8, rev: 0.4 });
      this.kick(t, 1, this.sfxBus);
    }
    beep(hi) {
      const t = this.now;
      const f = hi ? 1320 : 660;
      this.tone(t, f, hi ? 0.5 : 0.16, { type: 'square', gain: 0.1, cutoff: 4000, rev: 0.4 });
      this.tone(t, f / 2, hi ? 0.5 : 0.16, { type: 'triangle', gain: 0.12 });
      if (hi) {
        this.crash(t, 0.35, this.sfxBus);
        this.kick(t, 1, this.sfxBus);
      }
    }
    riser(dur) {
      if (!this.ctx) return;
      const t = this.now;
      this.noiseHit(t, dur, { filter: 'bandpass', freq: 200, sweepTo: 6000, q: 2, gain: 0.28, attack: dur * 0.9 });
      this.tone(t, 110, dur, { type: 'sawtooth', gain: 0.05, slideTo: 880, slideTime: dur, cutoff: 3000, attack: dur * 0.8 });
    }
    // A short snare roll that builds, used under the countdown.
    roll(dur) {
      if (!this.ctx) return;
      const t = this.now;
      const n = Math.floor(dur * 16);
      for (let i = 0; i < n; i++) {
        const p = i / n;
        this.snare(t + dur * (1 - Math.pow(1 - p, 1.6)), 0.08 + p * 0.3, this.sfxBus);
      }
    }
    fanfare() {
      if (!this.ctx) return;
      const t = this.now + 0.05;
      const seq = [0, 2, 4, 7, 4, 7];
      const lens = [0.12, 0.12, 0.12, 0.3, 0.12, 0.8];
      let tt = t;
      seq.forEach((d, i) => {
        const f = this.scaleFreq(d, 0);
        this.tone(tt, f, lens[i], { type: 'sawtooth', gain: 0.08, detune: 9, cutoff: 3200, rev: 0.5, vibrato: lens[i] > 0.5 });
        this.tone(tt, f * 2, lens[i], { type: 'square', gain: 0.03, cutoff: 4000 });
        tt += lens[i] * 0.95;
      });
      this.crash(t + 0.9, 0.3, this.sfxBus);
      this.kick(t + 0.9, 1, this.sfxBus);
    }
    crowd(dur) {
      if (!this._ok('crowd', 1500)) return;
      const t = this.now;
      for (const f of [420, 620, 900]) this.noiseHit(t, dur || 1.6, { filter: 'bandpass', freq: f, sweepTo: f * 1.3, q: 3, gain: 0.12, attack: 0.4, rev: 0.5 });
    }
    tick() {
      if (!this._ok('tick', 200)) return;
      this.tone(this.now, 2000, 0.03, { type: 'square', gain: 0.05 });
    }
    slip() {
      if (!this._ok('slip', 200)) return;
      this.tone(this.now, 900, 0.35, { type: 'triangle', gain: 0.15, slideTo: 200, slideTime: 0.35 });
    }
    freeze() {
      if (!this._ok('freeze', 200)) return;
      for (let i = 0; i < 5; i++) this.tone(this.now + i * 0.03, 2400 + i * 300, 0.2, { type: 'sine', gain: 0.04, rev: 0.7 });
    }
  }

  SQ.AudioEngine = AudioEngine;
  SQ.MUSIC_LIBRARY = LIBRARY;
})();
