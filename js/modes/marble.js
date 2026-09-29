// Marble Race: squares tumble down a tall random obstacle course. First to the bottom wins.
(function () {
  const SQ = window.SQ;
  const GRAV = 1000;
  const SEC_H = 540;

  class Marble {
    constructor(g, rng, opts) {
      opts = opts || {};
      this.g = g;
      this.rng = rng;
      this.teams = opts.teams || SQ.pickTeams(rng, rng.int(5, 8));
      this.title = 'MARBLE RACE';
      this.rules = [[{ t: 'Squares vs gravity', c: '#ffffff' }], [{ t: 'First to the ', c: '#ffffff' }, { t: 'bottom', c: '#ffd23f' }, { t: ' wins', c: '#ffffff' }]];
      this.segs = [];
      this.pegs = [];
      this.bumpers = [];
      this.spinners = [];
      this.sections = opts.quick ? rng.int(4, 5) : rng.int(7, 9);
      this.build();
      this.worldH = this.finishY + 320;
      this.camTracking = true;
      const r = 15;
      const n = this.teams.length;
      this.marbles = this.teams.map((t, i) => ({
        team: i,
        x: 500 + (i - (n - 1) / 2) * 62 + rng.range(-6, 6),
        y: 120 + rng.range(-10, 10),
        vx: rng.range(-40, 40),
        vy: 0,
        r,
        rot: 0,
        finished: false,
        place: 0,
        slow: 0,
        trail: [],
        flash: 0,
      }));
      this.time = 0;
      this.duration = opts.quick ? 50 : 75;
      this.places = [];
      this.winner = null;
      this.leader = -1;
    }

    focusStart() {
      return { x: 500, y: 200 };
    }

    // ---------- course ----------
    wall(x1, y1, x2, y2, w) {
      this.segs.push({ x1, y1, x2, y2, r: (w || 12) / 2 });
    }

    build() {
      const rng = this.rng;
      const L = 30;
      const R = 970;
      this.top = 260;
      const kinds = ['pegs', 'zigzag', 'spinners', 'bumpers', 'funnel', 'mix'];
      let y = this.top;
      let last = '';
      const plan = [];
      for (let s = 0; s < this.sections; s++) {
        let k = s === 0 ? rng.pick(['pegs', 'funnel']) : rng.pick(kinds);
        if (k === last) k = rng.pick(kinds.filter((x) => x !== last));
        last = k;
        plan.push(k);
      }
      // at least two zigzag sections so a race can't be over in a few seconds
      for (let s = 2; plan.filter((k) => k === 'zigzag').length < 2 && s < plan.length; s += 2) plan[s] = 'zigzag';
      for (const k of plan) {
        this['sec_' + k](y, L, R);
        y += SEC_H;
      }
      this.finishY = y + 80;
      // side walls and a floor under the finish line
      this.wall(L - 10, 0, L - 10, this.finishY + 320, 20);
      this.wall(R + 10, 0, R + 10, this.finishY + 320, 20);
      this.wall(L, this.finishY + 300, R, this.finishY + 300, 20);
      // a wide funnel so the start is fair
      this.wall(L, 150, 380, 230, 12);
      this.wall(R, 150, 620, 230, 12);
      // Pegs too close to a wall, bumper or spinner make pockets where marbles get stuck.
      const segD = (p, s) => {
        const dx = s.x2 - s.x1;
        const dy = s.y2 - s.y1;
        const t = SQ.clamp(((p.x - s.x1) * dx + (p.y - s.y1) * dy) / (dx * dx + dy * dy || 1), 0, 1);
        return Math.hypot(p.x - (s.x1 + dx * t), p.y - (s.y1 + dy * t));
      };
      this.pegs = this.pegs.filter(
        (p) =>
          !this.segs.some((s) => segD(p, s) < p.r + s.r + 40) &&
          !this.bumpers.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.r + 40) &&
          !this.spinners.some((sp) => Math.hypot(sp.x - p.x, sp.y - p.y) < sp.len / 2 + p.r + 40)
      );
    }

    sec_pegs(y0, L, R) {
      const rows = 6;
      for (let r = 0; r < rows; r++) {
        const off = r % 2 ? 45 : 0;
        for (let x = L + 60 + off; x < R - 40; x += 90) {
          if (this.rng.chance(0.12)) continue;
          this.pegs.push({ x, y: y0 + 60 + r * 78, r: 12, flash: 0 });
        }
      }
    }

    sec_zigzag(y0, L, R) {
      const rng = this.rng;
      const gap = rng.range(130, 170);
      for (let k = 0; k < 3; k++) {
        const y = y0 + 50 + k * 165;
        if (k % 2 === 0) this.wall(L, y, R - gap, y + 95, 12);
        else this.wall(R, y, L + gap, y + 95, 12);
      }
    }

    sec_spinners(y0, L, R) {
      const rng = this.rng;
      const n = rng.pick([2, 3]);
      for (let i = 0; i < n; i++) {
        const x = L + ((i + 0.5) / n) * (R - L);
        this.spinners.push({ x, y: y0 + 270 + (i % 2 ? 60 : -60), len: rng.range(190, 240), a: rng.range(0, 3.14), w: rng.pick([-1, 1]) * rng.range(1.8, 2.8), r: 7 });
      }
      for (let i = 0; i < 6; i++) this.pegs.push({ x: rng.range(80, 920), y: y0 + (i < 3 ? rng.range(40, 120) : rng.range(420, 500)), r: 12, flash: 0 });
    }

    sec_bumpers(y0) {
      const rng = this.rng;
      const n = rng.int(5, 7);
      let tries = 0;
      while (this.bumpers.filter((b) => b.y > y0).length < n && tries++ < 80) {
        const b = { x: rng.range(110, 890), y: y0 + rng.range(70, 470), r: rng.range(30, 40), flash: 0 };
        if (this.bumpers.some((o) => SQ.dist2(o.x, o.y, b.x, b.y) < 150 * 150)) continue;
        this.bumpers.push(b);
      }
    }

    sec_funnel(y0, L, R) {
      const open = this.rng.range(110, 150);
      const cx = this.rng.range(380, 620);
      this.wall(L, y0 + 60, cx - open / 2, y0 + 300, 12);
      this.wall(R, y0 + 60, cx + open / 2, y0 + 300, 12);
      for (let r = 0; r < 2; r++)
        for (let x = 110 + (r % 2) * 60; x < 900; x += 120) this.pegs.push({ x, y: y0 + 390 + r * 80, r: 12, flash: 0 });
    }

    sec_mix(y0) {
      const rng = this.rng;
      for (let i = 0; i < 12; i++) this.pegs.push({ x: rng.range(70, 930), y: y0 + rng.range(40, 500), r: 12, flash: 0 });
      for (let i = 0; i < 2; i++) this.bumpers.push({ x: rng.range(150, 850), y: y0 + 150 + i * 220, r: 34, flash: 0 });
      this.spinners.push({ x: 500, y: y0 + 270, len: 200, a: 0, w: rng.sign() * 2.2, r: 7 });
    }

    // ---------- physics ----------
    update(dt) {
      const g = this.g;
      this.time += dt;
      for (const sp of this.spinners) sp.a += sp.w * dt;
      for (const p of this.pegs) p.flash = Math.max(0, p.flash - dt * 4);
      for (const b of this.bumpers) b.flash = Math.max(0, b.flash - dt * 4);
      const sub = 3;
      const h = dt / sub;
      for (let k = 0; k < sub; k++) {
        for (const m of this.marbles) this.step(m, h);
        this.marbleCollisions();
      }
      for (const m of this.marbles) {
        m.flash = Math.max(0, m.flash - dt * 3);
        m.rot += (m.vx / m.r) * dt * 0.5;
        m.trail.push(m.x, m.y);
        if (m.trail.length > 20) m.trail.splice(0, 2);
        if (m.finished) continue;
        // nudge anyone who gets stuck on a ledge
        if (Math.hypot(m.vx, m.vy) < 25) m.slow += dt;
        else m.slow = 0;
        if (m.slow > 1) {
          m.vx += this.rng.sign() * this.rng.range(250, 420);
          m.vy -= 320;
          m.slow = 0;
        }
        if (m.y > this.finishY) {
          m.finished = true;
          this.places.push(m);
          m.place = this.places.length;
          g.fx.burst(m.x, m.y, this.teams[m.team].color, 30, 380, 11);
          if (m.place === 1) {
            g.audio.ding();
            this.winner = { team: this.teams[m.team], text: `${this.teams[m.team].name.toUpperCase()} WINS!`, sub: `finished in ${this.time.toFixed(1)}s` };
            this.winnerEnt = m;
          } else {
            g.audio.pickup();
            g.fx.text(m.x, m.y - 40, ordinal(m.place), '#ffffff', 40);
          }
        }
      }

      const order = this.marbles.slice().sort((a, b) => (a.finished || b.finished ? (a.finished ? (b.finished ? a.place - b.place : -1) : 1) : b.y - a.y));
      this.order = order;
      const lead = order[0];
      if (lead.team !== this.leader && this.leader !== -1 && this.time > 2 && !this.winner && this.time - (this.leadTold || 0) > 2.5) {
        this.leadTold = this.time;
        g.fx.text(lead.x, lead.y - 50, 'NEW LEADER', this.teams[lead.team].color, 34);
        g.fx.voice(lead, 'lead');
        g.audio.whoosh();
      }
      this.leader = lead.team;
      // follow the front runner that is still falling
      const f = order.find((m) => !m.finished) || lead;
      g.cam.setDefault(SQ.clamp(f.x, 400, 600), f.y + 110, 1.2);

      if (!this.winner && this.time >= this.duration) {
        this.winner = { team: this.teams[lead.team], text: `${this.teams[lead.team].name.toUpperCase()} WINS!`, sub: 'time up: furthest down' };
        this.winnerEnt = lead;
      }
    }

    step(m, dt) {
      const g = this.g;
      m.vy += GRAV * dt;
      m.vx *= 1 - 0.15 * dt;
      const sp = Math.hypot(m.vx, m.vy);
      if (sp > 820) (m.vx *= 820 / sp), (m.vy *= 820 / sp);
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.y < m.r) (m.y = m.r), (m.vy = Math.abs(m.vy));
      for (const s of this.segs) {
        if (Math.max(s.y1, s.y2) + 40 < m.y - m.r || Math.min(s.y1, s.y2) - 40 > m.y + m.r) continue;
        this.hitSeg(m, s.x1, s.y1, s.x2, s.y2, s.r, 0, 0, 0, 0.35);
      }
      for (const sp2 of this.spinners) {
        if (Math.abs(sp2.y - m.y) > sp2.len) continue;
        const ca = Math.cos(sp2.a) * (sp2.len / 2);
        const sa = Math.sin(sp2.a) * (sp2.len / 2);
        if (this.hitSeg(m, sp2.x - ca, sp2.y - sa, sp2.x + ca, sp2.y + sa, sp2.r, sp2.w, sp2.x, sp2.y, 0.5)) g.audio.bonk();
      }
      for (const p of this.pegs) {
        if (Math.abs(p.y - m.y) > 40) continue;
        const vn = this.hitCircle(m, p, 0.5, 0);
        if (vn > 140) {
          p.flash = 1;
          g.audio.melodyHit((p.x - 500) / 600, vn < 400);
        }
      }
      for (const b of this.bumpers) {
        if (Math.abs(b.y - m.y) > 60) continue;
        const vn = this.hitCircle(m, b, 0.9, 420);
        if (vn > 0) {
          b.flash = 1;
          m.flash = 0.6;
          g.audio.pop(4, (b.x - 500) / 600);
          g.fx.ring(b.x, b.y, this.teams[m.team].color, b.r * 1.3);
        }
      }
    }

    // circle vs segment (optionally spinning around cx, cy at w rad/s)
    hitSeg(m, x1, y1, x2, y2, rad, w, cx, cy, e) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const l2 = dx * dx + dy * dy || 1;
      const t = SQ.clamp(((m.x - x1) * dx + (m.y - y1) * dy) / l2, 0, 1);
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      let nx = m.x - px;
      let ny = m.y - py;
      const d = Math.hypot(nx, ny);
      const lim = m.r + rad;
      if (d >= lim || d === 0) return false;
      nx /= d;
      ny /= d;
      m.x = px + nx * lim;
      m.y = py + ny * lim;
      // surface velocity of a spinning bar
      const svx = w ? -w * (py - cy) : 0;
      const svy = w ? w * (px - cx) : 0;
      const rvx = m.vx - svx;
      const rvy = m.vy - svy;
      const vn = rvx * nx + rvy * ny;
      if (vn < 0) {
        m.vx = rvx - (1 + e) * vn * nx + svx;
        m.vy = rvy - (1 + e) * vn * ny + svy;
        m.vx *= 0.995;
      }
      return -vn > 200;
    }

    hitCircle(m, c, e, kick) {
      let nx = m.x - c.x;
      let ny = m.y - c.y;
      const d = Math.hypot(nx, ny);
      const lim = m.r + c.r;
      if (d >= lim || d === 0) return 0;
      nx /= d;
      ny /= d;
      m.x = c.x + nx * lim;
      m.y = c.y + ny * lim;
      const vn = m.vx * nx + m.vy * ny;
      if (vn < 0) {
        m.vx -= (1 + e) * vn * nx;
        m.vy -= (1 + e) * vn * ny;
      }
      if (kick) {
        m.vx += nx * kick;
        m.vy += ny * kick;
      }
      return Math.max(-vn, kick ? 1 : 0);
    }

    marbleCollisions() {
      const M = this.marbles;
      for (let i = 0; i < M.length; i++)
        for (let j = i + 1; j < M.length; j++) {
          const a = M[i];
          const b = M[j];
          let nx = b.x - a.x;
          let ny = b.y - a.y;
          const d = Math.hypot(nx, ny);
          const lim = a.r + b.r;
          if (d >= lim || d === 0) continue;
          nx /= d;
          ny /= d;
          const push = (lim - d) / 2;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) {
            const j2 = -rel * 0.9;
            a.vx -= j2 * nx;
            a.vy -= j2 * ny;
            b.vx += j2 * nx;
            b.vy += j2 * ny;
            if (-rel > 250) this.g.audio.bonk();
          }
        }
    }

    intensity() {
      if (this.winner) return 1;
      const lead = this.order ? this.order[0] : null;
      if (lead && lead.y > this.finishY - SEC_H * 1.2) return 1;
      return this.time < 5 ? 0.5 : 0.7;
    }

    // ---------- drawing ----------
    draw(ctx) {
      const v = this.g.cam.view();
      const top = v.top - 60;
      const bot = v.bottom + 60;
      // background bands, one tint per section
      const tints = ['#1c2233', '#221c33', '#1c2b2a', '#2b221c', '#1f1c2b', '#2b1c26'];
      for (let y = Math.floor(top / SEC_H) * SEC_H; y < bot; y += SEC_H) {
        const idx = Math.max(0, Math.floor((y - this.top) / SEC_H));
        ctx.fillStyle = y < this.top ? '#1a1d2a' : tints[idx % tints.length];
        ctx.fillRect(0, y, 1000, SEC_H + 1);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      for (let y = Math.floor(top / 100) * 100; y < bot; y += 100) ctx.fillRect(0, y, 1000, 2);
      // finish band
      if (this.finishY > top && this.finishY - 60 < bot) {
        const k = 25;
        for (let i = 0; i < 1000 / k; i++)
          for (let j = 0; j < 2; j++) {
            ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff';
            ctx.fillRect(i * k, this.finishY - 50 + j * k, k, k);
          }
        SQ.outlinedText(ctx, 'FINISH', 500, this.finishY + 80, 64, '#ffd23f', { stroke: 12 });
      }
      // walls
      ctx.lineCap = 'round';
      for (const s of this.segs) {
        if (Math.max(s.y1, s.y2) < top || Math.min(s.y1, s.y2) > bot) continue;
        ctx.strokeStyle = '#0d0f16';
        ctx.lineWidth = s.r * 2 + 6;
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
        ctx.strokeStyle = '#8f9bb8';
        ctx.lineWidth = s.r * 2;
        ctx.stroke();
      }
      for (const sp of this.spinners) {
        if (sp.y < top - sp.len || sp.y > bot + sp.len) continue;
        const ca = Math.cos(sp.a) * (sp.len / 2);
        const sa = Math.sin(sp.a) * (sp.len / 2);
        ctx.strokeStyle = '#0d0f16';
        ctx.lineWidth = sp.r * 2 + 6;
        ctx.beginPath();
        ctx.moveTo(sp.x - ca, sp.y - sa);
        ctx.lineTo(sp.x + ca, sp.y + sa);
        ctx.stroke();
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = sp.r * 2;
        ctx.stroke();
        ctx.fillStyle = '#0d0f16';
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 10, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const p of this.pegs) {
        if (p.y < top || p.y > bot) continue;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.arc(p.x + 2, p.y + 4, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.flash > 0 ? SQ.mixWhite('#1fd6f0', p.flash) : '#e8ecf5';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + p.flash * 0.3), 0, Math.PI * 2);
        ctx.fill();
      }
      for (const b of this.bumpers) {
        if (b.y < top - 50 || b.y > bot + 50) continue;
        const rr = b.r * (1 + b.flash * 0.25);
        ctx.fillStyle = '#0d0f16';
        ctx.beginPath();
        ctx.arc(b.x, b.y, rr + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = b.flash > 0 ? '#ffffff' : '#ff4d8d';
        ctx.beginPath();
        ctx.arc(b.x, b.y, rr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd6e6';
        ctx.beginPath();
        ctx.arc(b.x, b.y, rr * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const m of this.marbles) {
        const t = this.teams[m.team];
        if (m.trail.length > 4) {
          ctx.strokeStyle = SQ.rgba(t.color, 0.35);
          ctx.lineWidth = m.r * 1.2;
          ctx.beginPath();
          ctx.moveTo(m.trail[0], m.trail[1]);
          for (let i = 2; i < m.trail.length; i += 2) ctx.lineTo(m.trail[i], m.trail[i + 1]);
          ctx.stroke();
        }
        const sp = Math.hypot(m.vx, m.vy) || 1;
        SQ.drawSquare(ctx, m.x, m.y, m.r * 2, t, { angle: m.rot, lookX: m.vx / sp, lookY: m.vy / sp, flash: m.flash, mood: m.finished ? 'happy' : sp > 900 ? 'scared' : 'normal' });
      }
    }

    drawHud(ctx, y) {
      const order = this.order || this.marbles;
      const n = order.length;
      const gap = 10;
      const w = (SQ.W - 120 - (n - 1) * gap) / n;
      order.forEach((m, i) => {
        const tm = this.teams[m.team];
        const x = 60 + i * (w + gap);
        ctx.fillStyle = tm.color;
        SQ.roundRect(ctx, x, y, w, 80, 12);
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#0b0b10';
        ctx.stroke();
        SQ.outlinedText(ctx, m.finished ? ordinal(m.place) : `#${i + 1}`, x + w / 2, y + 40, Math.min(32, w * 0.35), '#ffffff', { stroke: 7 });
      });
      // progress track: where everyone is on the way down
      const ty = y + 130;
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(60, ty - 4, SQ.W - 120, 8);
      SQ.drawEmoji(ctx, '🏁', SQ.W - 60, ty - 2, 34);
      for (const m of this.marbles) {
        const k = SQ.clamp((m.y - 120) / (this.finishY - 120), 0, 1);
        const t = this.teams[m.team];
        ctx.fillStyle = t.color;
        ctx.strokeStyle = '#0b0b10';
        ctx.lineWidth = 3;
        SQ.roundRect(ctx, 60 + k * (SQ.W - 150) - 12, ty - 12, 24, 24, 5);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  function ordinal(n) {
    return ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'][n] || `${n}th`;
  }

  SQ.modes.marble = { id: 'marble', name: 'Marble Race', create: (g, rng, opts) => new Marble(g, rng, opts) };
})();
