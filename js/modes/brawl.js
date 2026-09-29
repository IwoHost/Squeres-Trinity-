// Sword Brawl: bouncing squares with spinning swords. Every hit makes the sword longer.
(function () {
  const SQ = window.SQ;
  const DROPS = [
    { type: 'sword', icon: '🗡️' },
    { type: 'heal', icon: '❤️' },
    { type: 'speed', icon: '⚡' },
    { type: 'spikes', icon: '🌵' },
  ];

  class Brawl {
    constructor(g, rng) {
      this.g = g;
      this.rng = rng;
      const n = rng.int(4, 7);
      this.teams = SQ.pickTeams(rng, n);
      this.variant = rng.pick(['sword', 'sword', 'grow']);
      this.title = this.variant === 'sword' ? 'SWORD BRAWL' : 'BOUNCE BRAWL';
      this.rules =
        this.variant === 'sword'
          ? [[{ t: 'Every hit, the ', c: '#ffffff' }, { t: 'sword', c: '#dfe6ff' }, { t: ' grows', c: '#ffffff' }], [{ t: 'Last square standing', c: '#ffffff' }]]
          : [[{ t: 'Every bounce, you ', c: '#ffffff' }, { t: 'grow', c: '#ffd23f' }], [{ t: 'Bigger squares hit harder', c: '#ffffff' }]];
      this.sq = this.teams.map((t, i) => {
        const a = (i / n) * Math.PI * 2;
        const sp = rng.range(250, 300);
        const va = rng.range(0, 6.28);
        return {
          team: i,
          x: 500 + Math.cos(a) * 320,
          y: 500 + Math.sin(a) * 320,
          vx: Math.cos(va) * sp,
          vy: Math.sin(va) * sp,
          speed: sp,
          size: 54,
          hp: 100,
          alive: true,
          sword: null,
          spikes: 0,
          boost: 0,
          flash: 0,
          squash: 0,
          kills: 0,
          hitCool: {},
          dead: 0,
          blink: rng.range(1, 4),
        };
      });
      if (this.variant === 'sword') {
        // two random squares start armed
        rng.shuffle(this.sq)
          .slice(0, 2)
          .forEach((s) => this.giveSword(s));
      }
      this.drops = [];
      this.nextDrop = rng.range(2, 4);
      this.time = 0;
      this.storm = 0; // inset of the shrinking wall
      this.winner = null;
    }

    giveSword(s) {
      if (s.sword) {
        s.sword.len = Math.min(300, s.sword.len + 30);
        return;
      }
      s.sword = { a: this.rng.range(0, 6.28), dir: this.rng.sign(), len: 60, spin: 4.2 };
    }

    bladePts(s) {
      const w = s.sword;
      const r0 = s.size * 0.55;
      const ca = Math.cos(w.a);
      const sa = Math.sin(w.a);
      return [s.x + ca * r0, s.y + sa * r0, s.x + ca * (r0 + w.len), s.y + sa * (r0 + w.len)];
    }

    update(dt) {
      const g = this.g;
      const rng = this.rng;
      this.time += dt;
      if (this.time > 45) this.storm = Math.min(300, this.storm + dt * 7);
      const lo = this.storm;
      const hi = 1000 - this.storm;
      const alive = this.sq.filter((s) => s.alive);

      this.nextDrop -= dt;
      if (this.nextDrop <= 0 && this.drops.length < 3) {
        this.nextDrop = rng.range(3.5, 6.5);
        const d = this.variant === 'sword' ? rng.pick(DROPS) : rng.pick(DROPS.slice(1));
        this.drops.push({ ...d, x: rng.range(lo + 80, hi - 80), y: rng.range(lo + 80, hi - 80), t: 0 });
      }
      for (const d of this.drops) d.t += dt;

      for (const s of this.sq) {
        if (!s.alive) {
          s.dead += dt;
          continue;
        }
        s.flash = Math.max(0, s.flash - dt * 4);
        s.squash *= Math.exp(-dt * 10);
        s.boost -= dt;
        s.blink -= dt;
        if (s.blink < -0.12) s.blink = rng.range(2, 5);
        for (const k in s.hitCool) s.hitCool[k] -= dt;
        const sp = s.speed * (s.boost > 0 ? 1.6 : 1) * (1 + Math.min(0.4, this.time / 150));
        const cur = Math.hypot(s.vx, s.vy) || 1;
        s.vx = (s.vx / cur) * sp;
        s.vy = (s.vy / cur) * sp;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const h = s.size / 2;
        let bounced = false;
        if (s.x < lo + h) (s.x = lo + h), (s.vx = Math.abs(s.vx)), (s.squash = 0.2), (bounced = true);
        if (s.x > hi - h) (s.x = hi - h), (s.vx = -Math.abs(s.vx)), (s.squash = 0.2), (bounced = true);
        if (s.y < lo + h) (s.y = lo + h), (s.vy = Math.abs(s.vy)), (s.squash = -0.2), (bounced = true);
        if (s.y > hi - h) (s.y = hi - h), (s.vy = -Math.abs(s.vy)), (s.squash = -0.2), (bounced = true);
        if (bounced) {
          g.audio.melodyHit((s.x - 500) / 600);
          if (this.variant === 'grow') s.size = Math.min(170, s.size + 3);
          // slight angle change keeps paths interesting
          const a = Math.atan2(s.vy, s.vx) + rng.range(-0.15, 0.15);
          s.vx = Math.cos(a) * sp;
          s.vy = Math.sin(a) * sp;
          if (this.storm > 0) this.damage(s, 2, null);
        }
        if (s.sword) s.sword.a += s.sword.spin * s.sword.dir * dt;
        for (let i = this.drops.length - 1; i >= 0; i--) {
          const d = this.drops[i];
          if (Math.abs(d.x - s.x) < h + 18 && Math.abs(d.y - s.y) < h + 18) {
            this.drops.splice(i, 1);
            this.collect(s, d);
          }
        }
      }

      // body collisions
      for (let i = 0; i < alive.length; i++)
        for (let j = i + 1; j < alive.length; j++) {
          const a = alive[i];
          const b = alive[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const lim = (a.size + b.size) / 2;
          const ox = lim - Math.abs(dx);
          const oy = lim - Math.abs(dy);
          if (ox <= 0 || oy <= 0) continue;
          if (ox < oy) {
            const sx = Math.sign(dx) || 1;
            a.x -= (sx * ox) / 2;
            b.x += (sx * ox) / 2;
            a.vx = -Math.abs(a.vx) * sx;
            b.vx = Math.abs(b.vx) * sx;
          } else {
            const sy = Math.sign(dy) || 1;
            a.y -= (sy * oy) / 2;
            b.y += (sy * oy) / 2;
            a.vy = -Math.abs(a.vy) * sy;
            b.vy = Math.abs(b.vy) * sy;
          }
          a.squash = b.squash = 0.25;
          g.audio.bonk();
          g.cam.shake(3);
          const base = this.variant === 'grow' ? 7 : 3;
          this.damage(b, base * (a.size / 54) + (a.spikes > 0 ? 12 : 0), a);
          this.damage(a, base * (b.size / 54) + (b.spikes > 0 ? 12 : 0), b);
        }

      // sword hits
      for (const s of alive) {
        if (!s.sword || !s.alive) continue;
        const [x0, y0, x1, y1] = this.bladePts(s);
        for (const o of alive) {
          if (o === s || !o.alive) continue;
          // sword vs sword
          if (o.sword && s.team < o.team) {
            const [u0, v0, u1, v1] = this.bladePts(o);
            if (segHit(x0, y0, x1, y1, u0, v0, u1, v1) && !((s.hitCool['c' + o.team] || 0) > 0)) {
              s.hitCool['c' + o.team] = 0.3;
              s.sword.dir *= -1;
              o.sword.dir *= -1;
              g.audio.clank();
              const ix = (x1 + u1) / 2;
              const iy = (y1 + v1) / 2;
              g.fx.sparks(ix, iy, 18, '#fff6b0');
              g.cam.shake(4);
            }
          }
          if ((s.hitCool[o.team] || 0) > 0) continue;
          const h = o.size / 2 + 3;
          let hit = false;
          for (let k = 0; k <= 10; k++) {
            const px = x0 + ((x1 - x0) * k) / 10;
            const py = y0 + ((y1 - y0) * k) / 10;
            if (Math.abs(px - o.x) < h && Math.abs(py - o.y) < h) {
              hit = true;
              break;
            }
          }
          if (!hit) continue;
          s.hitCool[o.team] = 0.4;
          g.audio.slash();
          g.audio.hit(false);
          g.hitstop(0.045);
          g.fx.sparks(o.x, o.y, 12, '#ffffff');
          const kx = o.x - s.x;
          const ky = o.y - s.y;
          const kl = Math.hypot(kx, ky) || 1;
          o.vx = (kx / kl) * o.speed;
          o.vy = (ky / kl) * o.speed;
          this.damage(o, 10 + s.sword.len * 0.03, s);
          s.sword.len = Math.min(300, s.sword.len + 12);

        }
      }

      const living = this.sq.filter((s) => s.alive);
      if (!this.winner && living.length <= 1) {
        const w = living[0] || this.sq.slice().sort((a, b) => b.dead - a.dead)[0];
        this.winner = { team: this.teams[w.team], text: `${this.teams[w.team].name.toUpperCase()} WINS!`, sub: `${w.kills} knockout${w.kills === 1 ? '' : 's'}` };
        this.winnerEnt = w;
      }
      if (!this.winner && living.length === 2 && !this.finalTold) {
        this.finalTold = true;
        g.fx.banner('FINAL TWO', `${this.teams[living[0].team].name} vs ${this.teams[living[1].team].name}`, '#ffd23f', 1.6);
        g.audio.crowd(1.8);
      }
    }

    damage(v, amt, by) {
      if (!v.alive || amt <= 0) return;
      const g = this.g;
      v.hp -= amt;
      v.flash = 1;
      if (amt >= 8) g.fx.text(v.x + (Math.random() - 0.5) * 30, v.y - v.size * 0.7, `-${Math.round(amt)}`, amt >= 15 ? '#ffd23f' : '#ffffff', amt >= 15 ? 40 : 30);
      if (v.hp <= 0) {
        v.hp = 0;
        v.alive = false;
        v.dead = 0;
        g.hitstop(0.14);
        g.audio.explode();
        g.fx.burst(v.x, v.y, this.teams[v.team].color, 60, 520, 14);
        g.fx.ring(v.x, v.y, this.teams[v.team].color, 120);
        g.fx.flash(0.4, this.teams[v.team].light);
        g.cam.shake(14);
        g.fx.text(v.x, v.y, '💀', '#ffffff', 80);
        if (by) {
          by.kills++;
          if (by.kills === 2) g.fx.maybeSay(by, 'streak', 0.9);
          else g.fx.maybeSay(by, 'hunter', 0.4);
        }
        g.highlight(v.x, v.y, 1.9, 1.2, 0.25);
        if (v.sword) this.drops.push({ type: 'sword', icon: '🗡️', x: v.x, y: v.y, t: 0 });
      }
    }

    collect(s, d) {
      const g = this.g;
      g.audio.pickup();
      g.fx.ring(d.x, d.y, '#ffffff', 50);
      if (d.type === 'sword') {
        this.giveSword(s);
        g.fx.text(s.x, s.y - 50, 'SWORD!', '#dfe6ff', 38);
      } else if (d.type === 'heal') {
        s.hp = Math.min(100, s.hp + 30);
        g.fx.text(s.x, s.y - 50, '+30 HP', '#7dffa8', 38);
      } else if (d.type === 'speed') {
        s.boost = 4;
        g.fx.text(s.x, s.y - 50, 'SPEED!', '#ffe066', 38);
      } else if (d.type === 'spikes') {
        s.spikes = 1;
        g.fx.text(s.x, s.y - 50, 'SPIKES!', '#7dffa8', 38);
      }
    }

    intensity() {
      const n = this.sq.filter((s) => s.alive).length;
      return n <= 2 ? 1 : n <= 3 ? 0.8 : 0.6;
    }

    draw(ctx) {
      ctx.fillStyle = '#1b1d27';
      ctx.fillRect(0, 0, 1000, 1000);
      ctx.fillStyle = '#232634';
      for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) if ((r + c) % 2) ctx.fillRect(c * 100, r * 100, 100, 100);
      if (this.storm > 0) {
        ctx.fillStyle = 'rgba(200,30,60,0.35)';
        const s = this.storm;
        ctx.fillRect(0, 0, 1000, s);
        ctx.fillRect(0, 1000 - s, 1000, s);
        ctx.fillRect(0, s, s, 1000 - 2 * s);
        ctx.fillRect(1000 - s, s, s, 1000 - 2 * s);
        ctx.strokeStyle = '#ff5577';
        ctx.lineWidth = 6;
        ctx.strokeRect(s, s, 1000 - 2 * s, 1000 - 2 * s);
      }
      for (const d of this.drops) {
        const s = Math.min(1, d.t * 4);
        ctx.save();
        ctx.translate(d.x, d.y + Math.sin(d.t * 4) * 5);
        ctx.scale(s, s);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.fill();
        SQ.drawEmoji(ctx, d.icon, 0, 2, 42);
        ctx.restore();
      }
      for (const s of this.sq) {
        const t = this.teams[s.team];
        if (!s.alive) {
          if (s.dead < 0.6) SQ.drawSquare(ctx, s.x, s.y, s.size * (1 - s.dead / 0.6), t, { mood: 'dead', alpha: 1 - s.dead / 0.6 });
          continue;
        }
        if (s.sword) this.drawSword(ctx, s);
        if (s.spikes > 0) {
          ctx.fillStyle = '#e8e8f0';
          const h = s.size / 2;
          for (let k = 0; k < 12; k++) {
            const side = k % 4;
            const f = (Math.floor(k / 4) + 0.5) / 3;
            ctx.beginPath();
            const px = side === 0 ? -h + f * s.size : side === 1 ? h : side === 2 ? h - f * s.size : -h;
            const py = side === 0 ? -h : side === 1 ? -h + f * s.size : side === 2 ? h : h - f * s.size;
            const nx = side === 1 ? 1 : side === 3 ? -1 : 0;
            const ny = side === 0 ? -1 : side === 2 ? 1 : 0;
            ctx.moveTo(s.x + px + ny * 8, s.y + py - nx * 8);
            ctx.lineTo(s.x + px + nx * 16, s.y + py + ny * 16);
            ctx.lineTo(s.x + px - ny * 8, s.y + py + nx * 8);
            ctx.fill();
          }
        }
        const sp = Math.hypot(s.vx, s.vy) || 1;
        SQ.drawSquare(ctx, s.x, s.y, s.size, t, {
          lookX: s.vx / sp,
          lookY: s.vy / sp,
          squash: s.squash,
          flash: s.flash,
          blink: s.blink < 0,
          mood: s.hp < 30 ? 'scared' : s.sword ? 'angry' : 'normal',
          glow: s.boost > 0 ? 18 : 0,
        });
        // hp pip over the head
        const w = s.size;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(s.x - w / 2, s.y - s.size / 2 - 16, w, 8);
        ctx.fillStyle = s.hp > 50 ? '#7dffa8' : s.hp > 25 ? '#ffd23f' : '#ff5c5c';
        ctx.fillRect(s.x - w / 2, s.y - s.size / 2 - 16, (w * s.hp) / 100, 8);
      }
    }

    drawSword(ctx, s) {
      const w = s.sword;
      const r0 = s.size * 0.55;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(w.a);
      // motion blur arc
      ctx.strokeStyle = 'rgba(223,230,255,0.15)';
      ctx.lineWidth = w.len;
      ctx.beginPath();
      ctx.arc(0, 0, r0 + w.len / 2, -0.5 * w.dir, 0, w.dir < 0);
      ctx.stroke();
      // blade
      const bw = 10 + w.len * 0.03;
      ctx.fillStyle = '#dfe6ff';
      ctx.strokeStyle = '#3a3f5a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(r0 + 14, -bw / 2);
      ctx.lineTo(r0 + w.len - bw, -bw / 2);
      ctx.lineTo(r0 + w.len, 0);
      ctx.lineTo(r0 + w.len - bw, bw / 2);
      ctx.lineTo(r0 + 14, bw / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // guard and grip
      ctx.fillStyle = '#c9a227';
      ctx.fillRect(r0 + 8, -bw, 8, bw * 2);
      ctx.fillStyle = '#5b3a1e';
      ctx.fillRect(r0 - 6, -4, 14, 8);
      ctx.restore();
    }

    drawHud(ctx, y) {
      const n = this.sq.length;
      const cols = n > 4 ? 2 : 1;
      const rows = Math.ceil(n / cols);
      const colW = (SQ.W - 120 - (cols - 1) * 30) / cols;
      const rowH = Math.min(56, 250 / rows);
      this.sq.forEach((s, i) => {
        const t = this.teams[s.team];
        const cx = 60 + (i % cols) * (colW + 30);
        const cy = y + Math.floor(i / cols) * rowH;
        ctx.globalAlpha = s.alive ? 1 : 0.35;
        ctx.fillStyle = t.color;
        SQ.roundRect(ctx, cx, cy, 34, 34, 7);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(cx + 48, cy + 8, colW - 48, 18);
        ctx.fillStyle = t.color;
        ctx.fillRect(cx + 48, cy + 8, ((colW - 48) * s.hp) / 100, 18);
        ctx.globalAlpha = 1;
        if (!s.alive) {
          SQ.drawEmoji(ctx, '💀', cx + 17, cy + 17, 30);
        }
      });
    }
  }

  function segHit(ax, ay, bx, by, cx, cy, dx, dy) {
    const d = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
    if (Math.abs(d) < 1e-6) return false;
    const u = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / d;
    const v = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / d;
    return u >= 0 && u <= 1 && v >= 0 && v <= 1;
  }

  SQ.modes.brawl = { id: 'brawl', name: 'Sword Brawl', create: (g, rng) => new Brawl(g, rng) };
})();
