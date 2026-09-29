// King of the Hill: hold the zone alone to score. Squares shove each other out of it.
(function () {
  const SQ = window.SQ;

  class Hill {
    constructor(g, rng, opts) {
      opts = opts || {};
      this.g = g;
      this.rng = rng;
      this.teams = opts.teams || SQ.pickTeams(rng, rng.int(4, 6));
      this.target = opts.quick ? 6 : 8;
      this.title = 'KING OF THE HILL';
      this.rules = [
        [{ t: 'Closest to the ', c: '#ffffff' }, { t: 'center', c: '#ffd23f' }, { t: ' scores', c: '#ffffff' }],
        [{ t: `First to ${this.target} points wins`, c: '#ffffff' }],
      ];
      const n = this.teams.length;
      this.sq = this.teams.map((t, i) => {
        const a = (i / n) * Math.PI * 2 + rng.range(0, 0.4);
        return {
          team: i,
          x: 500 + Math.cos(a) * 380,
          y: 500 + Math.sin(a) * 380,
          vx: 0,
          vy: 0,
          size: 58,
          score: 0,
          dashT: rng.range(0.2, 0.9),
          squash: 0,
          flash: 0,
          blink: rng.range(1, 4),
          crowned: 0,
        };
      });
      this.zone = { x: 500, y: 500, half: 150 };
      this.nextZone = null;
      this.moveT = rng.range(11, 14);
      this.waveT = rng.range(14, 20);
      this.wave = null;
      this.king = -1;
      this.time = 0;
      this.duration = opts.quick ? 40 : 60;
      this.winner = null;
      this.cool = {};
    }

    inZone(s, z) {
      z = z || this.zone;
      return Math.abs(s.x - z.x) < z.half && Math.abs(s.y - z.y) < z.half;
    }

    update(dt) {
      const g = this.g;
      const rng = this.rng;
      this.time += dt;
      const Z = this.zone;

      // the zone moves now and then; its next spot shows up a few seconds early
      this.moveT -= dt;
      if (this.moveT < 3 && !this.nextZone) {
        let x;
        let y;
        do {
          x = rng.range(220, 780);
          y = rng.range(220, 780);
        } while (Math.hypot(x - Z.x, y - Z.y) < 280);
        this.nextZone = { x, y, half: Z.half };
        g.fx.text(x, y, 'ZONE MOVING', '#ffd23f', 42);
        g.audio.whoosh();
      }
      if (this.moveT <= 0 && this.nextZone) {
        Object.assign(Z, this.nextZone);
        this.nextZone = null;
        this.moveT = rng.range(11, 15);
        g.fx.ring(Z.x, Z.y, '#ffd23f', Z.half * 1.4);
        g.audio.ding();
      }
      // shockwave from the zone pushes everyone out
      this.waveT -= dt;
      if (this.waveT <= 0) {
        this.waveT = rng.range(14, 20);
        this.wave = { t: 0 };
        g.fx.banner('SHOCKWAVE!', 'everyone gets blasted out', '#1fd6f0', 1.2);
        g.audio.boom();
        g.hitstop(0.06);
        for (const s of this.sq) {
          const dx = s.x - Z.x;
          const dy = s.y - Z.y;
          const d = Math.hypot(dx, dy) || 1;
          s.vx += (dx / d) * 1100;
          s.vy += (dy / d) * 1100;
          s.squash = 0.3;
        }
      }
      if (this.wave) {
        this.wave.t += dt;
        if (this.wave.t > 0.6) this.wave = null;
      }

      for (const s of this.sq) {
        s.squash *= Math.exp(-dt * 9);
        s.flash = Math.max(0, s.flash - dt * 3);
        s.blink -= dt;
        if (s.blink < -0.12) s.blink = rng.range(2, 5);
        s.dashT -= dt;
        s.stun = (s.stun || 0) - dt;
        if (s.dashT <= 0 && s.stun <= 0) {
          // dash toward the zone, or charge a rival who is standing in it
          const inside = this.inZone(s);
          const rivals = this.sq.filter((o) => o !== s && this.inZone(o));
          let tx = Z.x + rng.range(-60, 60);
          let ty = Z.y + rng.range(-60, 60);
          const P = SQ.persona(this.teams[s.team]);
          if (rivals.length && rng.chance(Math.min(0.95, (inside ? 0.8 : 0.5) * P.aggro))) {
            const o = rivals.sort((a, b) => SQ.dist2(a.x, a.y, s.x, s.y) - SQ.dist2(b.x, b.y, s.x, s.y))[0];
            tx = o.x;
            ty = o.y;
            s.charging = 0.5;
          }
          const dx = tx - s.x;
          const dy = ty - s.y;
          const d = Math.hypot(dx, dy) || 1;
          const power = (inside && !rivals.length ? 250 : rng.range(560, 760)) * (0.85 + 0.15 * P.aggro) * P.speed;
          s.vx += (dx / d) * power;
          s.vy += (dy / d) * power;
          s.dashT = inside ? rng.range(0.5, 1) : rng.range(0.6, 1.3);
        }
        s.charging = (s.charging || 0) - dt;
        const fr = Math.exp(-dt * 1.8);
        s.vx *= fr;
        s.vy *= fr;
        const sp = Math.hypot(s.vx, s.vy);
        if (sp > 1300) (s.vx *= 1300 / sp), (s.vy *= 1300 / sp);
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const h = s.size / 2;
        if (s.x < h) (s.x = h), (s.vx = Math.abs(s.vx) * 0.8), (s.squash = 0.2), g.audio.melodyHit(-0.8, true);
        if (s.x > 1000 - h) (s.x = 1000 - h), (s.vx = -Math.abs(s.vx) * 0.8), (s.squash = 0.2), g.audio.melodyHit(0.8, true);
        if (s.y < h) (s.y = h), (s.vy = Math.abs(s.vy) * 0.8), (s.squash = -0.2), g.audio.melodyHit(0, true);
        if (s.y > 1000 - h) (s.y = 1000 - h), (s.vy = -Math.abs(s.vy) * 0.8), (s.squash = -0.2), g.audio.melodyHit(0, true);
      }

      // shoves
      const S = this.sq;
      for (let i = 0; i < S.length; i++)
        for (let j = i + 1; j < S.length; j++) {
          const a = S[i];
          const b = S[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const lim = (a.size + b.size) / 2;
          if (Math.abs(dx) >= lim || Math.abs(dy) >= lim) continue;
          const d = Math.hypot(dx, dy) || 1;
          const nx = dx / d;
          const ny = dy / d;
          const push = (lim - Math.max(Math.abs(dx), Math.abs(dy))) / 2 + 0.5;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) {
            const k = -rel * 1.2;
            a.vx -= k * nx;
            a.vy -= k * ny;
            b.vx += k * nx;
            b.vy += k * ny;
            a.squash = b.squash = 0.25;
            const key = i + '-' + j;
            if (-rel > 300 && (this.cool[key] || 0) < this.time) {
              this.cool[key] = this.time + 0.25;
              g.audio.hit(-rel > 700);
              g.fx.sparks((a.x + b.x) / 2, (a.y + b.y) / 2, 10, '#ffffff');
              g.cam.shake(-rel > 700 ? 6 : 3);
              const victim = Math.hypot(a.vx, a.vy) > Math.hypot(b.vx, b.vy) ? a : b;
              if (-rel > 550) victim.stun = 0.9;
              if (-rel > 800) {
                g.hitstop(0.05);
                g.fx.text(victim.x, victim.y - 50, 'YEET', '#ffd23f', 40);
                g.fx.maybeSay(victim, 'elim', 0.25);
              }
            }
          }
        }
      for (const s of S) {
        const h = s.size / 2;
        s.x = SQ.clamp(s.x, h, 1000 - h);
        s.y = SQ.clamp(s.y, h, 1000 - h);
      }

      // scoring
      const inside = S.filter((s) => this.inZone(s));
      this.contested = inside.length > 1;
      // whoever is closest to the middle holds the hill; full speed when alone
      const king = inside.slice().sort((a, b) => SQ.dist2(a.x, a.y, Z.x, Z.y) - SQ.dist2(b.x, b.y, Z.x, Z.y))[0] || null;
      if (king) king.score += dt * (this.contested ? 0.6 : 1);
      for (const s of S) s.crowned = Math.max(0, s.crowned - dt * 3);
      if (king) king.crowned = 1;
      const kt = king ? king.team : -1;
      if (kt !== this.king) {
        if (king && this.time > 1) {
          g.fx.text(king.x, king.y - 60, 'NEW KING', this.teams[kt].color, 38);
          if (Math.random() < 0.5) g.fx.voice(king, 'lead');
          g.audio.pickup();
        }
        this.king = kt;
      }
      // points tick up with a pluck
      for (const s of S) {
        const whole = Math.floor(s.score);
        if (whole > (s.lastWhole || 0)) {
          s.lastWhole = whole;
          g.audio.pop(Math.min(9, whole), (s.x - 500) / 600);
          if (whole === this.target - 2) g.fx.text(s.x, s.y - 60, 'MATCH POINT', '#ff4d5e', 36);
        }
      }

      if (!this.winner) {
        const best = S.slice().sort((a, b) => b.score - a.score)[0];
        if (best.score >= this.target || this.time >= this.duration) {
          this.winner = { team: this.teams[best.team], text: `${this.teams[best.team].name.toUpperCase()} WINS!`, sub: `${best.score.toFixed(1)} points on the hill` };
          this.winnerEnt = best;
        }
      }
    }

    intensity() {
      const top = Math.max(...this.sq.map((s) => s.score));
      return top > this.target * 0.7 ? 1 : this.contested ? 0.8 : 0.6;
    }

    draw(ctx) {
      ctx.fillStyle = '#20242f';
      ctx.fillRect(0, 0, 1000, 1000);
      ctx.fillStyle = '#262b38';
      for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) if ((r + c) % 2) ctx.fillRect(c * 50, r * 50, 50, 50);
      const Z = this.zone;
      const kingT = this.king >= 0 ? this.teams[this.king] : null;
      const col = kingT ? kingT.color : this.contested ? '#ffffff' : '#ffd23f';
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
      ctx.fillStyle = SQ.rgba(col, 0.16 + 0.08 * pulse);
      ctx.fillRect(Z.x - Z.half, Z.y - Z.half, Z.half * 2, Z.half * 2);
      ctx.strokeStyle = col;
      ctx.lineWidth = 8;
      ctx.setLineDash(this.contested ? [24, 16] : []);
      ctx.lineDashOffset = -this.time * 60;
      ctx.strokeRect(Z.x - Z.half, Z.y - Z.half, Z.half * 2, Z.half * 2);
      ctx.setLineDash([]);
      if (!kingT) SQ.drawEmoji(ctx, '👑', Z.x, Z.y, 70);
      if (this.contested) SQ.outlinedText(ctx, 'CONTESTED', Z.x, Z.y - Z.half - 30, 34, '#ffffff', { stroke: 7 });
      if (this.nextZone) {
        const N = this.nextZone;
        const blink = Math.floor(this.time * 6) % 2;
        ctx.strokeStyle = blink ? 'rgba(255,210,63,0.9)' : 'rgba(255,210,63,0.35)';
        ctx.lineWidth = 5;
        ctx.setLineDash([16, 12]);
        ctx.strokeRect(N.x - N.half, N.y - N.half, N.half * 2, N.half * 2);
        ctx.setLineDash([]);
        SQ.outlinedText(ctx, String(Math.max(1, Math.ceil(this.moveT))), N.x, N.y, 80, '#ffd23f', { stroke: 12 });
      }
      if (this.wave) {
        const k = this.wave.t / 0.6;
        ctx.strokeStyle = `rgba(31,214,240,${1 - k})`;
        ctx.lineWidth = 18 * (1 - k);
        const r = Z.half + k * 600;
        ctx.strokeRect(Z.x - r, Z.y - r, r * 2, r * 2);
      }
      for (const s of this.sq) {
        const t = this.teams[s.team];
        const sp = Math.hypot(s.vx, s.vy) || 1;
        SQ.drawSquare(ctx, s.x, s.y, s.size, t, {
          lookX: s.vx / sp,
          lookY: s.vy / sp,
          squash: s.squash,
          blink: s.blink < 0,
          mood: s.stun > 0 ? 'dead' : s.charging > 0 ? 'angry' : s.crowned > 0 ? 'happy' : 'normal',
          angle: s.stun > 0 ? Math.sin(this.time * 20) * 0.25 : 0,
          glow: s.crowned > 0 ? 20 : 0,
          glowColor: '#ffd23f',
        });
        if (s.crowned > 0) SQ.drawEmoji(ctx, '👑', s.x, s.y - s.size / 2 - 16 - Math.abs(Math.sin(this.time * 6)) * 6, 40);
      }
    }

    drawHud(ctx, y) {
      const S = this.sq;
      const n = S.length;
      const cols = n > 3 ? 2 : 1;
      const rows = Math.ceil(n / cols);
      const colW = (SQ.W - 120 - (cols - 1) * 30) / cols;
      const rowH = Math.min(60, 230 / rows);
      S.forEach((s, i) => {
        const t = this.teams[s.team];
        const cx = 60 + (i % cols) * (colW + 30);
        const cy = y + Math.floor(i / cols) * rowH;
        ctx.fillStyle = t.color;
        SQ.roundRect(ctx, cx, cy, 34, 34, 7);
        ctx.fill();
        const bw = colW - 48 - 60;
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(cx + 48, cy + 8, bw, 18);
        ctx.fillStyle = t.color;
        ctx.fillRect(cx + 48, cy + 8, bw * Math.min(1, s.score / this.target), 18);
        SQ.outlinedText(ctx, String(Math.floor(s.score)), cx + 48 + bw + 32, cy + 18, 28, '#ffffff', { stroke: 6 });
        if (s.crowned > 0) SQ.drawEmoji(ctx, '👑', cx + 17, cy - 4, 22);
      });
    }
  }

  SQ.modes.hill = { id: 'hill', name: 'King of the Hill', create: (g, rng, opts) => new Hill(g, rng, opts) };
})();
