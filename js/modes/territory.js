// Tile Wars: each color's square bounces around and steals every tile it hits.
(function () {
  const SQ = window.SQ;

  class Territory {
    constructor(g, rng) {
      this.g = g;
      this.rng = rng;
      const n = rng.pick([2, 2, 3, 4]);
      this.teams = SQ.pickTeams(rng, n);
      this.N = rng.pick([20, 25]);
      this.cell = 1000 / this.N;
      this.duration = rng.pick([45, 60, 60]);
      this.title = 'TILE WARS';
      this.rules = [
        [{ t: 'Every bounce ', c: '#ffffff' }, { t: 'steals', c: '#ffd23f' }, { t: ' a tile', c: '#ffffff' }],
        [{ t: `Most tiles in ${this.duration}s wins`, c: '#ffffff' }],
        [{ t: 'Grab the ', c: '#ffffff' }, { t: 'power-ups', c: '#1fd6f0' }, { t: '!', c: '#ffffff' }],
      ];
      this.grid = new Int8Array(this.N * this.N);
      const vertical = rng.chance(0.5);
      for (let r = 0; r < this.N; r++)
        for (let c = 0; c < this.N; c++) {
          const x = (c + 0.5) / this.N - 0.5;
          const y = (r + 0.5) / this.N - 0.5;
          let t;
          if (n === 2) t = (vertical ? x : y) < 0 ? 0 : 1;
          else if (n === 4) t = (x < 0 ? 0 : 1) + (y < 0 ? 0 : 2);
          else t = Math.floor(((Math.atan2(y, x) + Math.PI) / (Math.PI * 2)) * n) % n;
          this.grid[r * this.N + c] = t;
        }
      this.balls = [];
      this.teams.forEach((t, ti) => {
        let sx = 0;
        let sy = 0;
        let k = 0;
        for (let i = 0; i < this.grid.length; i++)
          if (this.grid[i] === ti) {
            sx += ((i % this.N) + 0.5) * this.cell;
            sy += (Math.floor(i / this.N) + 0.5) * this.cell;
            k++;
          }
        this.addBall(ti, sx / k, sy / k);
      });
      this.time = 0;
      this.items = [];
      this.lock = this.teams.map(() => 0);
      this.nextItem = rng.range(2.5, 4);
      this.counts = this.teams.map(() => 0);
      this.tileFlash = new Float32Array(this.N * this.N);
      this.leader = -1;
      this.winner = null;
      this.wideShot = true;
      this.lastTick = -1;
      this.dirty = [];
      this.recount();
    }

    addBall(ti, x, y) {
      const a = this.rng.pick([1, 3, 5, 7]) * (Math.PI / 4) + this.rng.range(-0.3, 0.3);
      const speed = 520;
      this.balls.push({ team: ti, x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, size: 26, big: 0, boost: 0, frozen: 0, paint: 0, squash: 0, trail: [] });
    }

    recount() {
      const c = this.teams.map(() => 0);
      for (let i = 0; i < this.grid.length; i++) c[this.grid[i]]++;
      this.counts = c;
    }

    cellAt(x, y) {
      const c = Math.floor(x / this.cell);
      const r = Math.floor(y / this.cell);
      if (c < 0 || r < 0 || c >= this.N || r >= this.N) return -1;
      return r * this.N + c;
    }

    update(dt) {
      const g = this.g;
      this.time += dt;
      for (let i = 0; i < this.tileFlash.length; i++) if (this.tileFlash[i] > 0) this.tileFlash[i] = Math.max(0, this.tileFlash[i] - dt * 3);

      this.updateItems(dt);
      this.lock = this.lock.map((v) => Math.max(0, v - dt));

      const steps = 6;
      const sdt = dt / steps;
      for (const b of this.balls) {
        b.big -= dt;
        b.boost -= dt;
        b.frozen -= dt;
        b.paint -= dt;
        b.size = SQ.lerp(b.size, b.big > 0 ? 60 : 26, Math.min(1, dt * 5));
        b.squash *= Math.exp(-dt * 12);
        for (let s = 0; s < steps; s++) this.moveBall(b, sdt);
        b.trail.push(b.x, b.y);
        if (b.trail.length > 16) b.trail.splice(0, 2);
      }
      this.recount();
      const lead = this.counts.indexOf(Math.max(...this.counts));
      if (lead !== this.leader && this.leader !== -1 && this.time > 5) {
        g.fx.text(500, 470, `${this.teams[lead].name.toUpperCase()} TAKES THE LEAD`, this.teams[lead].color, 44);
      }
      this.leader = lead;

      const left = this.duration - this.time;
      if (left < 5.5 && Math.ceil(left) !== this.lastTick && left > 0) {
        this.lastTick = Math.ceil(left);
        g.audio.beep(false);
        g.fx.text(500, 500, String(this.lastTick), '#ffffff', 140);
      }
      if (left <= 0 && !this.winner) {
        const best = this.counts.indexOf(Math.max(...this.counts));
        const pct = Math.round((this.counts[best] / this.grid.length) * 100);
        this.winner = { team: this.teams[best], text: `${this.teams[best].name.toUpperCase()} WINS!`, sub: `${pct}% of the board` };
        this.winnerEnt = this.balls.find((b) => b.team === best);
        this.frozen = true;
      }
    }

    // ---------- power-ups ----------
    updateItems(dt) {
      const g = this.g;
      const rng = this.rng;
      this.nextItem -= dt;
      if (this.nextItem <= 0 && this.items.length < 3 && this.time < this.duration - 4) {
        this.nextItem = rng.range(3, 5.5);
        const type = rng.pick(['speed', 'mega', 'multi', 'bomb', 'freeze', 'paint', 'shield', 'bomb', 'paint']);
        let x, y, tries = 0;
        do {
          x = rng.range(70, 930);
          y = rng.range(70, 930);
          tries++;
        } while (tries < 20 && (this.balls.some((b) => SQ.dist2(b.x, b.y, x, y) < 150 * 150) || this.items.some((it) => SQ.dist2(it.x, it.y, x, y) < 200 * 200)));
        this.items.push({ type, x, y, t: 0, life: 14 });
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
        const b = this.balls.find((b) => Math.abs(b.x - it.x) < b.size / 2 + 24 && Math.abs(b.y - it.y) < b.size / 2 + 24);
        if (b) {
          this.items.splice(i, 1);
          this.collect(b, it);
        }
      }
    }

    collect(b, it) {
      const g = this.g;
      const team = this.teams[b.team];
      const def = SQ.ITEMS[it.type];
      g.audio.pickup();
      g.fx.ring(it.x, it.y, def.color, 70);
      g.fx.burst(it.x, it.y, def.color, 14, 260, 9);
      g.fx.text(it.x, it.y - 50, def.label, def.color, 42);
      if (it.type === 'speed') b.boost = 5;
      else if (it.type === 'mega') b.big = 6;
      else if (it.type === 'shield') {
        this.lock[b.team] = 5;
        g.fx.banner(`${team.name.toUpperCase()} TILES LOCKED`, 'nobody can steal them for 5s', team.color, 1.4);
      }
      else if (it.type === 'paint') b.paint = 3.5;
      else if (it.type === 'multi') {
        if (this.balls.filter((o) => o.team === b.team).length < 4) this.addBall(b.team, b.x, b.y);
      } else if (it.type === 'freeze') {
        g.audio.freeze();
        g.fx.flash(0.3, '#bdf3ff');
        for (const o of this.balls) if (o.team !== b.team) o.frozen = 2.2;
      } else if (it.type === 'bomb') {
        // paints a 5x5 block of tiles around the blast
        g.audio.explode();
        g.cam.shake(10);
        g.hitstop(0.06);
        g.fx.ring(it.x, it.y, team.color, 150);
        const c0 = Math.floor(it.x / this.cell);
        const r0 = Math.floor(it.y / this.cell);
        for (let r = r0 - 2; r <= r0 + 2; r++)
          for (let c = c0 - 2; c <= c0 + 2; c++) {
            if (r < 0 || c < 0 || r >= this.N || c >= this.N) continue;
            const i = r * this.N + c;
            if (this.grid[i] !== b.team) {
              this.grid[i] = b.team;
              this.tileFlash[i] = 1;
              this.dirty.push(i);
            }
          }
      }
    }

    moveBall(b, dt) {
      if (this.frozen || b.frozen > 0) return;
      dt *= b.boost > 0 ? 1.6 : 1;
      const h = b.size / 2;
      const hitAxis = (axis) => {
        // corners of the leading edge
        const pts =
          axis === 'x'
            ? [
                [b.x + Math.sign(b.vx) * h, b.y - h * 0.8],
                [b.x + Math.sign(b.vx) * h, b.y + h * 0.8],
                [b.x + Math.sign(b.vx) * h, b.y],
              ]
            : [
                [b.x - h * 0.8, b.y + Math.sign(b.vy) * h],
                [b.x + h * 0.8, b.y + Math.sign(b.vy) * h],
                [b.x, b.y + Math.sign(b.vy) * h],
              ];
        let hit = false;
        for (const [px, py] of pts) {
          const i = this.cellAt(px, py);
          if (i >= 0 && this.grid[i] !== b.team && this.lock[this.grid[i]] > 0) {
            hit = 'locked';
            continue;
          }
          if (i >= 0 && this.grid[i] !== b.team) {
            this.grid[i] = b.team;
            this.tileFlash[i] = 1;
            this.dirty.push(i);
            hit = true;
            const cx = ((i % this.N) + 0.5) * this.cell;
            const cy = (Math.floor(i / this.N) + 0.5) * this.cell;
            if (Math.random() < 0.35) this.g.fx.burst(cx, cy, this.teams[b.team].light, 3, 120, 7);
            this.g.audio.melodyHit((cx - 500) / 600);
          }
        }
        // with Paint Rush the square plows straight through enemy tiles
        if (hit === 'locked') return true;
        return hit && b.paint <= 0;
      };
      b.x += b.vx * dt;
      if (hitAxis('x')) {
        b.vx = -b.vx;
        b.x += b.vx * dt;
        b.squash = 0.18;
        this.nudge(b);
      }
      b.y += b.vy * dt;
      if (hitAxis('y')) {
        b.vy = -b.vy;
        b.y += b.vy * dt;
        b.squash = -0.18;
        this.nudge(b);
      }
      if (b.x < h) (b.x = h), (b.vx = Math.abs(b.vx));
      if (b.x > 1000 - h) (b.x = 1000 - h), (b.vx = -Math.abs(b.vx));
      if (b.y < h) (b.y = h), (b.vy = Math.abs(b.vy));
      if (b.y > 1000 - h) (b.y = 1000 - h), (b.vy = -Math.abs(b.vy));
    }

    // tiny random angle change so balls never lock into a loop
    nudge(b) {
      const sp = Math.hypot(b.vx, b.vy);
      let a = Math.atan2(b.vy, b.vx) + this.rng.range(-0.06, 0.06);
      // avoid nearly flat angles
      const m = Math.abs(Math.cos(a));
      if (m > 0.96 || m < 0.28) a += 0.2 * this.rng.sign();
      b.vx = Math.cos(a) * sp;
      b.vy = Math.sin(a) * sp;
    }

    intensity() {
      const left = this.duration - this.time;
      if (left < 12) return 1;
      return this.time < 8 ? 0.45 : 0.65;
    }

    invalidate() {
      this.layer = null;
    }

    paintCell(x, i) {
      const c = this.cell;
      const t = this.teams[this.grid[i]];
      const cx = (i % this.N) * c;
      const cy = Math.floor(i / this.N) * c;
      x.fillStyle = t.dark;
      x.fillRect(cx, cy, c + 0.5, c + 0.5);
      x.fillStyle = SQ.rgba(t.color, 0.55);
      x.fillRect(cx + 3, cy + 3, c - 6, c - 6);
    }

    draw(ctx) {
      const c = this.cell;
      // Tiles live on a cached layer; only tiles that change get repainted.
      if (!this.layer) {
        const L = document.createElement('canvas');
        L.width = L.height = Math.round(1000 * SQ.RES * 1.2);
        const x = L.getContext('2d');
        x.scale(L.width / 1000, L.width / 1000);
        for (let i = 0; i < this.grid.length; i++) this.paintCell(x, i);
        this.layer = L;
        this.layerCtx = x;
        this.dirty.length = 0;
      }
      for (const i of this.dirty) this.paintCell(this.layerCtx, i);
      this.dirty.length = 0;
      ctx.drawImage(this.layer, 0, 0, 1000, 1000);
      // freshly stolen tiles pop in
      for (let i = 0; i < this.tileFlash.length; i++) {
        const f = this.tileFlash[i];
        if (f <= 0) continue;
        const t = this.teams[this.grid[i]];
        const k = 1 + 0.35 * SQ.ease.outCubic(f);
        const cx = ((i % this.N) + 0.5) * c;
        const cy = (Math.floor(i / this.N) + 0.5) * c;
        const w = (c - 6) * k;
        ctx.fillStyle = SQ.mixWhite(t.color, f * 0.6);
        ctx.fillRect(cx - w / 2, cy - w / 2, w, w);
      }
      // locked tiles get a white rim
      if (this.lock.some((v) => v > 0)) {
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 3;
        for (let i = 0; i < this.grid.length; i++) {
          const lk = this.lock[this.grid[i]];
          if (lk <= 0 || (lk < 1.2 && Math.floor(lk * 8) % 2)) continue;
          ctx.strokeRect((i % this.N) * c + 4, Math.floor(i / this.N) * c + 4, c - 8, c - 8);
        }
      }
      for (const it of this.items) SQ.drawItem(ctx, it.x, it.y, it.type, it.t, 54, it.life - it.t);
      for (const b of this.balls) {
        const t = this.teams[b.team];
        ctx.strokeStyle = SQ.rgba(t.light, 0.5);
        ctx.lineCap = 'round';
        for (let i = 2; i < b.trail.length; i += 2) {
          ctx.lineWidth = (i / b.trail.length) * b.size * 0.6;
          ctx.beginPath();
          ctx.moveTo(b.trail[i - 2], b.trail[i - 1]);
          ctx.lineTo(b.trail[i], b.trail[i + 1]);
          ctx.stroke();
        }
        const sp = Math.hypot(b.vx, b.vy) || 1;
        SQ.drawSquare(ctx, b.x, b.y, b.size, t, {
          lookX: b.vx / sp,
          lookY: b.vy / sp,
          squash: b.squash,
          outline: b.frozen > 0 ? '#bdf3ff' : '#ffffff',
          mood: b.frozen > 0 ? 'scared' : b.big > 0 || b.paint > 0 ? 'angry' : 'normal',
          glow: b.boost > 0 || b.paint > 0 ? 22 : 12,
          glowColor: b.paint > 0 ? '#a95cff' : b.boost > 0 ? '#ffc21a' : '#ffffff',
        });
      }
    }

    drawHud(ctx, y) {
      const total = this.grid.length;
      const x0 = 60;
      const w = SQ.W - 120;
      let x = x0;
      const h = 64;
      this.teams.forEach((t, i) => {
        const bw = (this.counts[i] / total) * w;
        ctx.fillStyle = t.color;
        ctx.fillRect(x, y, bw, h);
        if (bw > 110) SQ.outlinedText(ctx, `${Math.round((this.counts[i] / total) * 100)}%`, x + bw / 2, y + h / 2 + 2, 38, '#ffffff', { stroke: 8 });
        x += bw;
      });
      ctx.strokeStyle = '#0b0b10';
      ctx.lineWidth = 6;
      ctx.strokeRect(x0, y, w, h);
      SQ.outlinedText(ctx, SQ.fmtTime(this.duration - this.time), SQ.W / 2, y + 120, 56, '#ffffff', { stroke: 10 });
    }
  }

  SQ.modes.territory = { id: 'territory', name: 'Tile Wars', create: (g, rng) => new Territory(g, rng) };
})();
