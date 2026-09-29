// Domain Duel: big squares paint the floor. On their own settled paint they cannot be hurt.
(function () {
  const SQ = window.SQ;
  const SETTLE = 1.4; // seconds before fresh paint counts as your domain

  class Domain {
    constructor(g, rng) {
      this.g = g;
      this.rng = rng;
      const n = rng.pick([2, 2, 2, 3, 4]);
      this.teams = SQ.pickTeams(rng, n);
      this.N = 20;
      this.cell = 50;
      this.title = n === 2 ? `${this.teams[0].name.toUpperCase()} VS ${this.teams[1].name.toUpperCase()}` : 'DOMAIN BRAWL';
      this.rules = [
        [{ t: 'Squares are invincible', c: '#ffffff' }],
        [{ t: 'in their own ', c: '#ffffff' }, { t: 'domain', c: '#ffd23f' }],
        [{ t: 'Grab the ', c: '#ffffff' }, { t: 'power-ups', c: '#1fd6f0' }, { t: '!', c: '#ffffff' }],
      ];
      this.items = [];
      this.nextItem = rng.range(2, 3.5);
      this.owner = new Int8Array(this.N * this.N).fill(-1);
      this.since = new Float32Array(this.N * this.N);
      this.time = 0;
      const corners = rng.shuffle([
        [1, 1],
        [this.N - 5, this.N - 5],
        [this.N - 5, 1],
        [1, this.N - 5],
      ]);
      const maxHp = rng.pick([10, 12, 15]);
      this.maxHp = maxHp;
      this.sq = this.teams.map((t, ti) => {
        const [cx, cy] = corners[ti];
        for (let r = cy - 1; r < cy + 5; r++) for (let c = cx - 1; c < cx + 5; c++) if (r >= 0 && c >= 0 && r < this.N && c < this.N) this.owner[r * this.N + c] = ti;
        const a = rng.range(0, 6.28);
        return {
          team: ti,
          x: (cx + 2) * this.cell,
          y: (cy + 2) * this.cell,
          vx: Math.cos(a) * 320,
          vy: Math.sin(a) * 320,
          size: 110,
          hp: maxHp,
          alive: true,
          safe: true,
          flash: 0,
          squash: 0,
          turnT: rng.range(1.5, 3),
          base: 110,
          shieldT: 0,
          boost: 0,
          rage: 0,
          big: 0,
          frozen: 0,
          hits: 0,
          expanded: false,
        };
      });
      this.since.fill(-10);
      this.cool = {};
      this.duration = 90;
      this.winner = null;
      this.counts = this.teams.map(() => 0);
    }

    update(dt) {
      const g = this.g;
      const rng = this.rng;
      this.time += dt;
      const alive = this.sq.filter((s) => s.alive);
      for (const s of alive) {
        s.flash = Math.max(0, s.flash - dt * 3);
        s.squash *= Math.exp(-dt * 9);
        s.turnT -= dt;
        for (const k of ['shieldT', 'boost', 'rage', 'big', 'frozen']) s[k] -= dt;
        s.size = SQ.lerp(s.size, s.big > 0 ? 160 : s.base, Math.min(1, dt * 4));
        if (s.frozen > 0) continue;
        const sp = (320 + Math.min(160, this.time * 1.6)) * (s.boost > 0 ? 1.6 : 1);
        if (s.turnT <= 0) {
          s.turnT = rng.range(1.6, 3.2);
          let a;
          const others = alive.filter((o) => o !== s);
          // go for a nearby power-up about half the time
          const near = this.items.slice().sort((p, q) => SQ.dist2(p.x, p.y, s.x, s.y) - SQ.dist2(q.x, q.y, s.x, s.y))[0];
          if (near && rng.chance(0.5)) {
            a = Math.atan2(near.y - s.y, near.x - s.x);
            s.turnT = rng.range(1, 1.8);
          } else if (others.length && rng.chance(0.55)) {
            const o = rng.pick(others);
            a = Math.atan2(o.y - s.y, o.x - s.x) + rng.range(-0.3, 0.3);
          } else a = rng.range(0, 6.28);
          s.vx = Math.cos(a) * sp;
          s.vy = Math.sin(a) * sp;
        }
        const cur = Math.hypot(s.vx, s.vy) || 1;
        s.vx = (s.vx / cur) * sp;
        s.vy = (s.vy / cur) * sp;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const h = s.size / 2;
        if (s.x < h) (s.x = h), (s.vx = Math.abs(s.vx)), (s.squash = 0.15), g.audio.melodyHit((s.x - 500) / 600, true);
        if (s.x > 1000 - h) (s.x = 1000 - h), (s.vx = -Math.abs(s.vx)), (s.squash = 0.15), g.audio.melodyHit((s.x - 500) / 600, true);
        if (s.y < h) (s.y = h), (s.vy = Math.abs(s.vy)), (s.squash = -0.15), g.audio.melodyHit((s.x - 500) / 600, true);
        if (s.y > 1000 - h) (s.y = 1000 - h), (s.vy = -Math.abs(s.vy)), (s.squash = -0.15), g.audio.melodyHit((s.x - 500) / 600, true);

        // how much of the footprint is your settled paint?
        let own = 0;
        let tot = 0;
        const c0 = Math.floor((s.x - h) / this.cell);
        const c1 = Math.floor((s.x + h - 1) / this.cell);
        const r0 = Math.floor((s.y - h) / this.cell);
        const r1 = Math.floor((s.y + h - 1) / this.cell);
        for (let r = r0; r <= r1; r++)
          for (let c = c0; c <= c1; c++) {
            if (r < 0 || c < 0 || r >= this.N || c >= this.N) continue;
            const i = r * this.N + c;
            tot++;
            if (this.owner[i] === s.team && this.time - this.since[i] > SETTLE) own++;
          }
        s.safe = s.shieldT > 0 || (tot > 0 && own / tot >= 0.5);
        // paint
        for (let r = r0; r <= r1; r++)
          for (let c = c0; c <= c1; c++) {
            if (r < 0 || c < 0 || r >= this.N || c >= this.N) continue;
            const i = r * this.N + c;
            if (this.owner[i] !== s.team) {
              this.owner[i] = s.team;
              this.since[i] = this.time;
            }
          }
      }

      // collisions between squares
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
            a.squash = b.squash = 0.25;
          } else {
            const sy = Math.sign(dy) || 1;
            a.y -= (sy * oy) / 2;
            b.y += (sy * oy) / 2;
            a.vy = -Math.abs(a.vy) * sy;
            b.vy = Math.abs(b.vy) * sy;
            a.squash = b.squash = -0.25;
          }
          const key = a.team + '-' + b.team;
          if ((this.cool[key] || 0) > this.time) continue;
          this.cool[key] = this.time + 0.35;
          this.clash(a, b);
        }

      for (const s of alive) {
        const h = s.size / 2;
        s.x = SQ.clamp(s.x, h, 1000 - h);
        s.y = SQ.clamp(s.y, h, 1000 - h);
      }
      this.updateItems(dt, alive);
      alive.forEach((s) => (s.alive = s.hp > 0));
      this.counts = this.teams.map(() => 0);
      for (let i = 0; i < this.owner.length; i++) if (this.owner[i] >= 0) this.counts[this.owner[i]]++;
      for (const s of this.sq) {
        if (s.alive && !s.expanded && this.counts[s.team] > this.owner.length * 0.4) {
          s.expanded = true;
          g.fx.banner('DOMAIN EXPANSION', `${this.teams[s.team].name} owns 40% of the arena`, this.teams[s.team].color, 1.8);
          if (g.opts.memes > 0) g.audio.boom();
        }
      }

      const living = this.sq.filter((s) => s.alive);
      if (!this.winner && (living.length <= 1 || this.time >= this.duration)) {
        let w;
        if (living.length === 1) w = living[0];
        else w = (living.length ? living : this.sq).slice().sort((p, q) => q.hp - p.hp || this.counts[q.team] - this.counts[p.team])[0];
        if (w) {
          this.winner = { team: this.teams[w.team], text: `${this.teams[w.team].name.toUpperCase()} WINS!`, sub: living.length === 1 ? 'last square standing' : 'time up: most health left' };
          this.winnerEnt = w;
        }
      }
    }

    clash(a, b) {
      const g = this.g;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      g.fx.sparks(mx, my, 16);
      g.cam.shake(7);
      g.hitstop(0.06);
      if (a.safe && b.safe) {
        g.audio.clank();
        g.fx.text(mx, my - 60, 'BLOCKED', '#dfe6ff', 36);
        return;
      }
      g.audio.hit(true);
      for (const [v, atk] of [
        [a, b],
        [b, a],
      ]) {
        if (v.safe) continue;
        const crit = this.rng.chance(0.15);
        const dmg = (crit ? 3 : 1) * (atk.rage > 0 ? 2 : 1);
        v.hp = Math.max(0, v.hp - dmg);
        v.flash = 1;
        atk.hits++;
        g.fx.burst(v.x, v.y, this.teams[v.team].color, 14, 300, 12);
        g.fx.text(v.x, v.y - 80, crit ? `CRIT -${dmg}` : `-${dmg}`, crit ? '#ffd23f' : '#ffffff', crit ? 54 : 42);
        if (crit) g.highlight(v.x, v.y, 1.7, 0.8, 0.35);
        if (v.hp <= 0) {
          g.hitstop(0.14);
          g.audio.explode();
          g.fx.burst(v.x, v.y, this.teams[v.team].color, 60, 520, 18);
          g.fx.flash(0.6, this.teams[v.team].light);
          g.fx.maybeSay(v, 'elim', 0.8);
          g.highlight(v.x, v.y, 2, 1.4, 0.25);
          // loser's paint becomes the attacker's
          for (let i = 0; i < this.owner.length; i++) if (this.owner[i] === v.team) (this.owner[i] = atk.team), (this.since[i] = this.time);
        } else if (v.hp <= 2) g.fx.maybeSay(v, 'lonely', 0.5);
        else g.fx.maybeSay(atk, 'hunter', 0.15);
      }
    }

    // ---------- power-ups ----------
    updateItems(dt, alive) {
      const g = this.g;
      const rng = this.rng;
      this.nextItem -= dt;
      if (this.nextItem <= 0 && this.items.length < 3) {
        this.nextItem = rng.range(3, 5);
        const type = rng.pick(['heal', 'shield', 'speed', 'expand', 'rage', 'mega', 'freeze', 'expand', 'rage']);
        let x, y, tries = 0;
        do {
          x = rng.range(70, 930);
          y = rng.range(70, 930);
          tries++;
        } while (tries < 20 && (alive.some((s) => SQ.dist2(s.x, s.y, x, y) < 180 * 180) || this.items.some((it) => SQ.dist2(it.x, it.y, x, y) < 220 * 220)));
        this.items.push({ type, x, y, t: 0, life: 15 });
        g.audio.itemSpawn();
        g.fx.ring(x, y, SQ.ITEMS[type].color, 50);
      }
      for (let i = this.items.length - 1; i >= 0; i--) {
        const it = this.items[i];
        it.t += dt;
        if (it.t > it.life) {
          this.items.splice(i, 1);
          continue;
        }
        const s = alive.find((s) => s.hp > 0 && Math.abs(s.x - it.x) < s.size / 2 + 22 && Math.abs(s.y - it.y) < s.size / 2 + 22);
        if (s) {
          this.items.splice(i, 1);
          this.collect(s, it, alive);
        }
      }
    }

    collect(s, it, alive) {
      const g = this.g;
      const team = this.teams[s.team];
      const def = SQ.ITEMS[it.type];
      g.audio.pickup();
      g.fx.ring(it.x, it.y, def.color, 80);
      g.fx.burst(it.x, it.y, def.color, 16, 280, 10);
      g.fx.text(s.x, s.y - s.size * 0.7, def.label, def.color, 44);
      if (it.type === 'heal') s.hp = Math.min(this.maxHp, s.hp + 3);
      else if (it.type === 'shield') s.shieldT = 4.5;
      else if (it.type === 'speed') s.boost = 4;
      else if (it.type === 'rage') s.rage = 6;
      else if (it.type === 'mega') s.big = 6;
      else if (it.type === 'freeze') {
        g.audio.freeze();
        g.fx.flash(0.3, '#bdf3ff');
        for (const o of alive) if (o !== s) o.frozen = 2;
      } else if (it.type === 'expand') {
        // instantly settled domain in a big block around the square
        const c0 = Math.floor(s.x / this.cell);
        const r0 = Math.floor(s.y / this.cell);
        for (let r = r0 - 3; r <= r0 + 3; r++)
          for (let c = c0 - 3; c <= c0 + 3; c++) {
            if (r < 0 || c < 0 || r >= this.N || c >= this.N) continue;
            const i = r * this.N + c;
            this.owner[i] = s.team;
            this.since[i] = this.time - 10;
          }
        g.fx.ring(s.x, s.y, team.color, 200);
        g.fx.banner('DOMAIN EXPANSION', `${team.name} claims the ground`, team.color, 1.5);
        g.audio.boom();
        g.hitstop(0.05);
      }
    }

    intensity() {
      const low = Math.min(...this.sq.filter((s) => s.alive).map((s) => s.hp / this.maxHp));
      return low < 0.35 || this.time > this.duration - 15 ? 1 : 0.6;
    }

    draw(ctx) {
      ctx.fillStyle = '#101016';
      ctx.fillRect(0, 0, 1000, 1000);
      const c = this.cell;
      for (let i = 0; i < this.owner.length; i++) {
        const o = this.owner[i];
        if (o < 0) continue;
        const t = this.teams[o];
        const age = this.time - this.since[i];
        const x = (i % this.N) * c;
        const y = Math.floor(i / this.N) * c;
        ctx.fillStyle = age > SETTLE ? t.dark : SQ.rgba(t.dark, 0.45);
        ctx.fillRect(x, y, c + 0.5, c + 0.5);
      }
      for (const it of this.items) SQ.drawItem(ctx, it.x, it.y, it.type, it.t, 60, it.life - it.t);
      for (const s of this.sq) {
        if (!s.alive) continue;
        const t = this.teams[s.team];
        const sp = Math.hypot(s.vx, s.vy) || 1;
        SQ.drawSquare(ctx, s.x, s.y, s.size, t, {
          lookX: s.vx / sp,
          lookY: s.vy / sp,
          squash: s.squash,
          flash: s.flash,
          mood: s.frozen > 0 || s.hp <= 2 ? 'scared' : s.safe ? 'normal' : 'angry',
          glow: s.safe || s.rage > 0 || s.boost > 0 ? 28 : 0,
          glowColor: s.rage > 0 ? '#ff8f33' : s.boost > 0 ? '#ffc21a' : null,
          shield: s.shieldT,
          outline: s.safe ? '#ffffff' : null,
        });
      }
    }

    drawHud(ctx, y) {
      const rows = this.sq.length;
      const rowH = Math.min(52, 200 / rows);
      this.sq.forEach((s, i) => {
        const t = this.teams[s.team];
        const yy = y + i * (rowH + 10);
        const segs = this.maxHp;
        const w = SQ.W - 120;
        const gap = 6;
        const sw = (w - gap * (segs - 1)) / segs;
        for (let k = 0; k < segs; k++) {
          ctx.fillStyle = k < s.hp ? t.color : 'rgba(255,255,255,0.08)';
          ctx.fillRect(60 + k * (sw + gap), yy, sw, rowH * 0.55);
        }
      });
      SQ.outlinedText(ctx, SQ.fmtTime(this.duration - this.time), SQ.W / 2, y + rows * (rowH + 10) + 50, 48, '#ffffff', { stroke: 9 });
    }
  }

  SQ.modes.domain = { id: 'domain', name: 'Domain Duel', create: (g, rng) => new Domain(g, rng) };
})();
