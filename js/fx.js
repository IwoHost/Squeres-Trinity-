// Visual effects: camera, particles, floating text, speech bubbles, banners and memes.
(function () {
  const SQ = (window.SQ = window.SQ || {});
  const W = () => SQ.WORLD;

  class Camera {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = this.tx = 500;
      this.y = this.ty = 500;
      this.zoom = this.tz = 1;
      this.follow = 3;
      this.shakeAmt = 0;
      this.kick = 0; // extra zoom that springs back
      this.hold = 0; // seconds a focus shot stays before returning to the default view
      this.defaultView = { x: 500, y: 500, z: 1 };
    }
    focus(x, y, z, hold, speed) {
      this.tx = x;
      this.ty = y;
      this.tz = z;
      this.hold = hold || 0;
      this.follow = speed || 4;
    }
    setDefault(x, y, z) {
      this.defaultView = { x, y, z };
    }
    snap() {
      this.x = this.tx;
      this.y = this.ty;
      this.zoom = this.tz;
    }
    shake(a) {
      this.shakeAmt = Math.min(16, this.shakeAmt + a * 0.6);
    }
    punch(a) {
      this.kick += a;
    }
    update(dt) {
      if (this.hold > 0) {
        this.hold -= dt;
        if (this.hold <= 0) {
          const d = this.defaultView;
          this.tx = d.x;
          this.ty = d.y;
          this.tz = d.z;
          this.follow = 2.2;
        }
      } else if (this.hold <= 0 && this.tracking) {
        this.follow = 4;
        const d = this.defaultView;
        this.tx = d.x;
        this.ty = d.y;
        this.tz = d.z;
      }
      const k = 1 - Math.exp(-dt * this.follow);
      this.x += (this.tx - this.x) * k;
      this.y += (this.ty - this.y) * k;
      this.zoom += (this.tz - this.zoom) * k;
      if (Math.abs(this.tz - this.zoom) < 0.004) this.zoom = this.tz;
      this.kick *= Math.exp(-dt * 7);
      this.shakeAmt *= Math.exp(-dt * 6);
    }
    get z() {
      return Math.max(1, this.zoom + this.kick);
    }
    // Applies the camera transform. The view never leaves the arena.
    // The part of the world currently on screen, for culling in tall worlds.
    view() {
      const half = W() / 2 / this.z;
      const cy = SQ.clamp(this.y, half, (this.worldH || W()) - half);
      return { top: cy - half, bottom: cy + half };
    }
    apply(ctx, rect) {
      const z = this.z;
      const half = W() / 2 / z;
      const cx = SQ.clamp(this.x, half, W() - half);
      const cy = SQ.clamp(this.y, half, (this.worldH || W()) - half);
      const sx = (Math.random() * 2 - 1) * this.shakeAmt;
      const sy = (Math.random() * 2 - 1) * this.shakeAmt;
      const scale = (rect.size / W()) * z;
      ctx.translate(rect.x + rect.size / 2 + sx, rect.y + rect.size / 2 + sy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
    }
  }
  SQ.Camera = Camera;

  const MEMES = {
    elim: ['💀', 'L', 'skill issue', 'bro fell off', 'emotional damage', 'caught in 4K', 'ratio', 'cooked 🍳', 'NPC behavior', 'bye bye 👋', 'not like this 😭', 'unlucky'],
    hunter: ['ez', 'mine now', 'gg', 'no cap', 'who let bro cook', 'yoink', 'sheesh', 'chat is this real'],
    streak: ['SIGMA', 'AURA +1000', 'HIM', 'UNSTOPPABLE', 'built different', 'goated'],
    lonely: ["it's so over", 'send help', 'alone 🥲', 'plot armor pls'],
    comeback: ["WE'RE SO BACK", 'COMEBACK ARC', 'main character energy'],
    winner: ['GG EZ', 'DEAL WITH IT', 'AURA MAXXED', 'W', 'THE GOAT 🐐', 'FLAWLESS'],
    random: ['6 7', 'bruh', '👁️👄👁️', 'rizz', 'mewing', 'lowkey scared', 'brainrot', 'ohio moment', 'fr fr', 'vibing'],
  };
  SQ.MEMES = MEMES;

  class FX {
    constructor(game) {
      this.g = game;
      this.clear();
    }
    clear() {
      this.parts = [];
      this.texts = [];
      this.bubbles = [];
      this.banners = [];
      this.confetti = [];
      this.flashA = 0;
      this.flashColor = '#fff';
      this.vignette = 0;
      this.vignetteColor = '#ff0033';
      this.bigMeme = null;
    }
    get memeLevel() {
      return this.g.opts.memes;
    }
    burst(x, y, color, n, speed, size) {
      if (this.parts.length > 260) n = Math.min(n, 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = (0.3 + Math.random()) * (speed || 220);
        this.parts.push({
          x,
          y,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v,
          life: 0,
          max: 0.4 + Math.random() * 0.5,
          size: (size || 8) * (0.5 + Math.random()),
          color,
          rot: Math.random() * 6,
          vr: (Math.random() - 0.5) * 12,
          type: 'sq',
        });
      }
    }
    sparks(x, y, n, color) {
      if (this.parts.length > 260) return;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 250 + Math.random() * 450;
        this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.2 + Math.random() * 0.25, size: 3, color: color || '#fff6b0', type: 'spark' });
      }
    }
    ring(x, y, color, r) {
      this.parts.push({ x, y, vx: 0, vy: 0, life: 0, max: 0.45, size: r || 60, color, type: 'ring' });
    }
    text(x, y, str, color, size) {
      this.texts.push({ x: SQ.clamp(x, 140, 860), y: SQ.clamp(y, 60, 960), str, color: color || '#fff', size: size || 34, life: 0, max: 1.1 });
    }
    // Speech bubble that follows an entity.
    say(ent, str, dur, team) {
      if (!ent) return false;
      if (this.bubbles.some((b) => b.ent === ent)) return false;
      if (this.bubbles.length >= 3) return false;
      // don't stack bubbles on top of each other
      if (this.bubbles.some((b) => Math.abs(b.ent.x - ent.x) < 220 && Math.abs(b.ent.y - ent.y) < 90)) return false;
      this.bubbles.push({ ent, str, life: 0, max: dur || 1.6, team: team || this.teamOf(ent) });
      return true;
    }

    teamOf(ent) {
      const m = this.g.mode;
      return m && m.teams && ent && ent.team != null ? m.teams[ent.team] : null;
    }

    // A personality voice line. event: start, hit, hurt, item, lead, scared, idle, win, lose.
    voice(ent, event, force) {
      if (!ent || !this.g.opts.voices) return false;
      const team = this.teamOf(ent);
      if (!team) return false;
      const P = SQ.persona(team);
      const lines = P.lines[event];
      if (!lines) return false;
      if (!force && this.g.real - (this.lastVoice || -9) < 1.1) return false;
      if (!this.say(ent, lines[(Math.random() * lines.length) | 0], force ? 2.2 : 1.8, team)) return false;
      this.lastVoice = this.g.real;
      this.g.audio.babble(P.voice);
      return true;
    }

    // Chance-based reaction: a personality line most of the time, a meme line otherwise.
    maybeSay(ent, kind, p) {
      const lvl = this.memeLevel;
      const voices = this.g.opts.voices;
      if (lvl === 0 && !voices) return false;
      const mult = lvl === 2 ? 2.5 : 1;
      if (Math.random() >= p * mult) return false;
      const map = { elim: 'hurt', hunter: 'hit', streak: 'hit', lonely: 'scared', comeback: 'win', winner: 'win', random: 'idle' };
      if (voices && (lvl === 0 || Math.random() < 0.65) && this.voice(ent, map[kind] || 'idle')) return true;
      if (lvl === 0) return false;
      const list = MEMES[kind];
      return this.say(ent, list[(Math.random() * list.length) | 0]);
    }
    banner(text, sub, color, dur, opts) {
      this.banners.push({ text, sub, color: color || '#fff', life: 0, max: dur || 1.6, opts: opts || {} });
    }
    // A full-screen meme moment: vine boom, zoom punch, red vignette, big caption.
    // Rate limited so it stays special: once every 10 s (6 s on Chaos). Returns whether it played.
    memeMoment(caption, x, y) {
      if (this.memeLevel === 0) return false;
      const gap = this.memeLevel === 2 ? 6 : 10;
      if (this.g.real - (this.lastMeme || -99) < gap) return false;
      this.lastMeme = this.g.real;
      this.g.audio.boom();
      if (!this.g.mode.wideShot) this.g.cam.punch(0.1);
      this.g.cam.shake(10);
      this.vignette = 1;
      this.bigMeme = { caption, life: 0, max: 1.3 };
      return true;
    }
    flash(a, color) {
      this.flashA = Math.max(this.flashA, a);
      this.flashColor = color || '#fff';
    }
    confettiBurst(colors, n) {
      for (let i = 0; i < (n || 160); i++) {
        this.confetti.push({
          x: SQ.W / 2 + (Math.random() - 0.5) * 300,
          y: SQ.H * 0.55,
          vx: (Math.random() - 0.5) * 1600,
          vy: -600 - Math.random() * 1300,
          rot: Math.random() * 6,
          vr: (Math.random() - 0.5) * 16,
          w: 10 + Math.random() * 14,
          h: 6 + Math.random() * 8,
          color: colors[(Math.random() * colors.length) | 0],
          life: 0,
          max: 3 + Math.random() * 2,
        });
      }
    }

    update(dt, realDt) {
      const step = (arr, d, fn) => {
        for (let i = arr.length - 1; i >= 0; i--) {
          const p = arr[i];
          p.life += d;
          if (p.life >= p.max) arr.splice(i, 1);
          else if (fn) fn(p);
        }
      };
      step(this.parts, dt, (p) => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= Math.exp(-dt * 3);
        p.vy *= Math.exp(-dt * 3);
        if (p.rot != null) p.rot += (p.vr || 0) * dt;
      });
      step(this.texts, realDt, (p) => (p.y -= 60 * realDt));
      step(this.bubbles, realDt);
      step(this.banners, realDt);
      step(this.confetti, realDt, (p) => {
        p.vy += 1400 * realDt;
        p.vx *= Math.exp(-realDt * 1.5);
        p.vy *= Math.exp(-realDt * 1.2);
        p.x += p.vx * realDt;
        p.y += p.vy * realDt;
        p.rot += p.vr * realDt;
      });
      if (this.bigMeme) {
        this.bigMeme.life += realDt;
        if (this.bigMeme.life > this.bigMeme.max) this.bigMeme = null;
      }
      this.flashA *= Math.exp(-realDt * 7);
      this.vignette *= Math.exp(-realDt * 2);
    }

    drawWorld(ctx) {
      for (const p of this.parts) {
        const k = 1 - p.life / p.max;
        ctx.globalAlpha = k;
        if (p.type === 'sq') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        } else if (p.type === 'spark') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
          ctx.stroke();
        } else if (p.type === 'ring') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 6 * k;
          const r = p.size * (0.3 + SQ.ease.outCubic(p.life / p.max));
          ctx.strokeRect(p.x - r, p.y - r, r * 2, r * 2);
        }
      }
      ctx.globalAlpha = 1;
      for (const t of this.texts) {
        const k = t.life / t.max;
        const s = t.size * (k < 0.15 ? SQ.ease.outBack(k / 0.15) : 1);
        ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        SQ.outlinedText(ctx, t.str, t.x, t.y, s, t.color);
      }
      ctx.globalAlpha = 1;
      for (const b of this.bubbles) {
        const e = b.ent;
        const k = b.life / b.max;
        const pop = k < 0.12 ? SQ.ease.outBack(k / 0.12) : k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1;
        const size = 30;
        ctx.save();
        ctx.font = `700 ${size}px ${SQ.fontBody}`;
        const w = ctx.measureText(b.str).width + 26;
        const h = size + 18;
        let bx = SQ.clamp(e.x, w / 2 + 6, SQ.WORLD - w / 2 - 6);
        let by = e.y - (e.size || 30) / 2 - h / 2 - 16;
        if (by < h / 2 + 4) by = e.y + (e.size || 30) / 2 + h / 2 + 16;
        ctx.translate(bx, by);
        ctx.scale(pop, pop);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = b.team ? b.team.dark : '#0b0b10';
        ctx.lineWidth = b.team ? 6 : 4;
        SQ.roundRect(ctx, -w / 2, -h / 2, w, h, 14);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-8, h / 2 - 2);
        ctx.lineTo(0, h / 2 + 12);
        ctx.lineTo(8, h / 2 - 2);
        ctx.fill();
        ctx.fillStyle = '#0b0b10';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.str, 0, 1);
        ctx.restore();
      }
    }

    drawScreen(ctx) {
      // banners in the middle of the arena
      const A = SQ.ARENA;
      for (const b of this.banners) {
        const k = b.life / b.max;
        const inK = SQ.clamp(b.life / 0.35, 0, 1);
        const outK = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
        const cy = b.opts.y || A.y + A.size / 2;
        ctx.save();
        ctx.globalAlpha = outK;
        const band = 190;
        ctx.fillStyle = 'rgba(10,10,16,0.72)';
        ctx.fillRect(0, cy - (band / 2) * inK, SQ.W, band * inK);
        ctx.fillStyle = b.color;
        ctx.fillRect(0, cy - (band / 2) * inK, SQ.W, 8 * inK);
        ctx.fillRect(0, cy + (band / 2) * inK - 8 * inK, SQ.W, 8 * inK);
        const s = SQ.ease.outBack(inK);
        const size = b.opts.size || 104;
        ctx.translate(SQ.W / 2, cy - (b.sub ? 18 : 0));
        ctx.scale(s, s);
        SQ.outlinedText(ctx, b.text, 0, 0, size, b.color);
        if (b.sub) SQ.outlinedText(ctx, b.sub, 0, size * 0.62, 40, '#ffffff', { font: SQ.fontBody, weight: 700 });
        ctx.restore();
      }

      if (this.bigMeme) {
        const m = this.bigMeme;
        const k = m.life / m.max;
        const s = 1 + 0.25 * SQ.ease.outCubic(Math.min(1, k * 3));
        ctx.save();
        ctx.globalAlpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
        ctx.translate(SQ.W / 2, A.y + 170);
        ctx.scale(s, s);
        ctx.rotate(-0.05);
        SQ.outlinedText(ctx, m.caption, 0, 0, 92, '#ffffff', { stroke: 18 });
        ctx.restore();
      }

      for (const p of this.confetti) {
        const k = 1 - p.life / p.max;
        ctx.save();
        ctx.globalAlpha = Math.min(1, k * 3);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.rot * 2));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (this.vignette > 0.02) {
        const g = ctx.createRadialGradient(SQ.W / 2, SQ.H / 2, SQ.H * 0.25, SQ.W / 2, SQ.H / 2, SQ.H * 0.7);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, SQ.rgba(this.vignetteColor, 0.55 * this.vignette));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, SQ.W, SQ.H);
      }
      if (this.flashA > 0.01) {
        ctx.globalAlpha = this.flashA;
        ctx.fillStyle = this.flashColor;
        ctx.fillRect(0, 0, SQ.W, SQ.H);
        ctx.globalAlpha = 1;
      }
    }
  }
  SQ.FX = FX;
})();
