// Tile Wars: each color's square bounces around and steals every tile it hits.
// Squares grab upgrades that spawn on the board (some are carried and used a moment later),
// and now and then a random event spins up on a roulette and shakes the match up.
(function () {
  const SQ = window.SQ;

  // what can spawn, with weights
  const DROPS = [
    ['grow', 3],
    ['ghost', 3],
    ['turret', 3],
    ['bomb', 3],
    ['grenade', 3],
    ['speed', 2],
    ['multi', 2],
    ['paint', 2],
    ['freeze', 1],
    ['shield', 1],
  ];

  const EVENTS = [
    { id: 'colorSwap', name: 'COLOR SWAP', w: 3 },
    { id: 'placeSwap', name: 'PLACE SWAP', w: 3 },
    { id: 'robinHood', name: 'ROBIN HOOD', w: 2 },
    { id: 'tileRain', name: 'TILE RAIN', w: 2 },
    { id: 'frenzy', name: 'SPEED FRENZY', w: 2 },
    { id: 'giants', name: 'GIANT MODE', w: 2 },
    { id: 'itemRain', name: 'ITEM RAIN', w: 2 },
    { id: 'mirror', name: 'MIRROR FLIP', w: 1 },
  ];

  function weighted(rng, list, wOf) {
    const total = list.reduce((a, x) => a + wOf(x), 0);
    let r = rng() * total;
    for (const x of list) {
      r -= wOf(x);
      if (r <= 0) return x;
    }
    return list[list.length - 1];
  }

  class Territory {
    constructor(g, rng, opts) {
      opts = opts || {};
      this.g = g;
      this.rng = rng;
      this.teams = opts.teams || SQ.pickTeams(rng, rng.pick([2, 2, 3, 4]));
      const n = this.teams.length;
      this.N = rng.pick([20, 25]);
      this.cell = 1000 / this.N;
      this.duration = opts.quick ? 30 : rng.pick([50, 60, 60]);
      this.title = 'TILE WARS';
      this.rules = [
        [{ t: 'Every bounce ', c: '#ffffff' }, { t: 'steals', c: '#ffd23f' }, { t: ' a tile', c: '#ffffff' }],
        [{ t: `Most tiles in ${this.duration}s wins`, c: '#ffffff' }],
        [{ t: 'Grab ', c: '#ffffff' }, { t: 'upgrades', c: '#1fd6f0' }, { t: '. Expect ', c: '#ffffff' }, { t: 'chaos', c: '#ff6ac1' }],
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
      this.turrets = [];
      this.bullets = [];
      this.grenades = [];
      this.lock = this.teams.map(() => 0);
      this.nextItem = rng.range(1.5, 2.5);
      this.nextEvent = rng.range(10, 14);
      this.spin = null;
      this.counts = this.teams.map(() => 0);
      this.tileFlash = new Float32Array(this.N * this.N);
      this.leader = -1;
      this.winner = null;
      this.wideShot = true;
      this.lastTick = -1;
      this.finalTold = false;
      this.dirty = [];
      this.recount();
    }

    addBall(ti, x, y) {
      const a = this.rng.pick([1, 3, 5, 7]) * (Math.PI / 4) + this.rng.range(-0.3, 0.3);
      const speed = 520;
      this.balls.push({
        team: ti,
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        size: 26,
        big: 0,
        boost: 0,
        frozen: 0,
        paint: 0,
        ghost: 0,
        bombFuse: 0,
        grenadeT: 0,
        squash: 0,
        pop: 0,
        trail: [],
      });
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

    setTile(i, team) {
      if (i < 0 || this.grid[i] === team) return false;
      this.grid[i] = team;
      this.tileFlash[i] = 1;
      this.dirty.push(i);
      return true;
    }

    // paints a round area of tiles, used by bombs, grenades and ghost pops
    blast(team, x, y, radiusCells, label) {
      const g = this.g;
      const c0 = Math.floor(x / this.cell);
      const r0 = Math.floor(y / this.cell);
      const R = Math.ceil(radiusCells);
      let n = 0;
      for (let r = r0 - R; r <= r0 + R; r++)
        for (let c = c0 - R; c <= c0 + R; c++) {
          if (r < 0 || c < 0 || r >= this.N || c >= this.N) continue;
          if ((r - r0) * (r - r0) + (c - c0) * (c - c0) > radiusCells * radiusCells) continue;
          const i = r * this.N + c;
          if (this.lock[this.grid[i]] > 0 && this.grid[i] !== team) continue;
          if (this.setTile(i, team)) n++;
        }
      const col = this.teams[team].color;
      g.audio.explode();
      g.cam.shake(12);
      g.hitstop(0.07);
      g.fx.ring(x, y, col, radiusCells * this.cell * 1.2);
      g.fx.ring(x, y, '#ffffff', radiusCells * this.cell * 0.7);
      g.fx.burst(x, y, col, 26, 420, 12);
      g.fx.sparks(x, y, 20, '#fff2a8');
      if (label) g.fx.text(x, y - 40, `${label} +${n}`, '#ffffff', 50);
      return n;
    }

    update(dt) {
      const g = this.g;
      this.time += dt;
      for (let i = 0; i < this.tileFlash.length; i++) if (this.tileFlash[i] > 0) this.tileFlash[i] = Math.max(0, this.tileFlash[i] - dt * 3);

      this.updateItems(dt);
      this.updateEvents(dt);
      this.updateWeapons(dt);
      this.lock = this.lock.map((v) => Math.max(0, v - dt));

      const left = this.duration - this.time;
      if (left <= 10 && !this.finalTold && !this.winner) {
        this.finalTold = true;
        g.fx.banner('FINAL 10 SECONDS', 'everyone speeds up', '#ff4d5e', 1.5);
        g.audio.crowd(1.6);
      }

      const steps = 6;
      for (const b of this.balls) {
        b.big -= dt;
        b.boost -= dt;
        b.frozen -= dt;
        b.paint -= dt;
        b.pop = Math.max(0, b.pop - dt * 3);
        if (b.ghost > 0) {
          b.ghost -= dt;
          // the ghost reappears with a pop that paints the area around it
          if (b.ghost <= 0 && !this.winner) {
            b.pop = 1;
            this.blast(b.team, b.x, b.y, 1.8, 'BOO!');
          }
        }
        if (b.bombFuse > 0) {
          b.bombFuse -= dt;
          if (b.bombFuse <= 0 && !this.winner) this.blast(b.team, b.x, b.y, 3.2, 'BOOM!');
        }
        if (b.grenadeT > 0) {
          b.grenadeT -= dt;
          if (b.grenadeT <= 0 && !this.winner) this.throwGrenade(b);
        }
        b.size = SQ.lerp(b.size, b.big > 0 ? 62 : 26, Math.min(1, dt * 5));
        b.squash *= Math.exp(-dt * 12);
        const sdt = dt / steps;
        for (let s = 0; s < steps; s++) this.moveBall(b, sdt);
        b.trail.push(b.x, b.y);
        if (b.trail.length > 16) b.trail.splice(0, 2);
      }
      this.recount();
      const lead = this.counts.indexOf(Math.max(...this.counts));
      if (lead !== this.leader && this.leader !== -1 && this.time > 5) {
        g.fx.text(500, 470, `${this.teams[lead].name.toUpperCase()} TAKES THE LEAD`, this.teams[lead].color, 44);
        g.fx.voice(this.balls.find((b) => b.team === lead), 'lead');
      }
      this.leader = lead;

      if (left < 5.5 && Math.ceil(left) !== this.lastTick && left > 0) {
        this.lastTick = Math.ceil(left);
        g.audio.beep(false);
        g.fx.text(500, 500, String(this.lastTick), '#ffffff', 140);
      }
      if (left <= 0 && !this.winner) {
        const best = this.counts.indexOf(Math.max(...this.counts));
        const pct = Math.round((this.counts[best] / this.grid.length) * 100);
        const level = this.teams.filter((t, i) => this.counts[i] === this.counts[best]);
        if (level.length >= 2) {
          this.winner = SQ.tieResult(level, `exactly ${this.counts[best]} tiles each`);
          this.winnerEnt = null;
          this.frozen = true;
          this.spin = null;
          return;
        }
        this.winner = { team: this.teams[best], text: `${this.teams[best].name.toUpperCase()} WINS!`, sub: `${pct}% of the board` };
        this.winnerEnt = this.balls.find((b) => b.team === best);
        this.frozen = true;
        this.spin = null;
      }
    }

    // ---------- upgrades on the board ----------
    updateItems(dt) {
      const g = this.g;
      const rng = this.rng;
      this.nextItem -= dt;
      if (this.nextItem <= 0 && this.items.length < 4 && this.time < this.duration - 3) {
        this.nextItem = rng.range(2.2, 4);
        this.spawnItem(weighted(rng, DROPS, (d) => d[1])[0]);
      }
      for (let i = this.items.length - 1; i >= 0; i--) {
        const it = this.items[i];
        it.t += dt;
        if (it.t > it.life) {
          this.items.splice(i, 1);
          continue;
        }
        const b = this.balls.find((b) => Math.abs(b.x - it.x) < b.size / 2 + 24 && Math.abs(b.y - it.y) < b.size / 2 + 24);
        if (b && !this.frozen) {
          this.items.splice(i, 1);
          this.collect(b, it);
        }
      }
    }

    spawnItem(type) {
      const rng = this.rng;
      let x;
      let y;
      let tries = 0;
      do {
        x = rng.range(70, 930);
        y = rng.range(70, 930);
        tries++;
      } while (tries < 20 && (this.balls.some((b) => SQ.dist2(b.x, b.y, x, y) < 150 * 150) || this.items.some((it) => SQ.dist2(it.x, it.y, x, y) < 180 * 180)));
      this.items.push({ type, x, y, t: 0, life: 14 });
      this.g.audio.itemSpawn();
      this.g.fx.ring(x, y, SQ.ITEMS[type].color, 50);
    }

    collect(b, it) {
      const g = this.g;
      g.fx.voice(b, 'item');
      const team = this.teams[b.team];
      const def = SQ.ITEMS[it.type];
      g.audio.pickup();
      b.pop = 1;
      g.fx.ring(it.x, it.y, def.color, 70);
      g.fx.burst(it.x, it.y, def.color, 14, 260, 9);
      g.fx.text(it.x, it.y - 50, def.label, def.color, 42);
      if (it.type === 'speed') b.boost = 5;
      else if (it.type === 'grow') b.big = 10;
      else if (it.type === 'ghost') {
        b.ghost = 4;
        g.audio.whoosh();
      } else if (it.type === 'bomb') b.bombFuse = 1.6;
      else if (it.type === 'grenade') b.grenadeT = 0.9;
      else if (it.type === 'turret') {
        this.turrets.push({ team: b.team, x: it.x, y: it.y, t: 0, life: 8, a: this.rng.range(0, 6.28), fire: 0.3 });
        this.setTile(this.cellAt(it.x, it.y), b.team);
      } else if (it.type === 'shield') {
        this.lock[b.team] = 5;
        g.fx.banner(`${team.name.toUpperCase()} TILES LOCKED`, 'nobody can steal them for 5s', team.color, 1.4);
      } else if (it.type === 'paint') b.paint = 3.5;
      else if (it.type === 'multi') {
        if (this.balls.filter((o) => o.team === b.team).length < 4) this.addBall(b.team, b.x, b.y);
      } else if (it.type === 'freeze') {
        g.audio.freeze();
        g.fx.flash(0.3, '#bdf3ff');
        for (const o of this.balls) if (o.team !== b.team) o.frozen = 2.2;
      }
    }

    // ---------- turrets, bullets and grenades ----------
    throwGrenade(b) {
      // aim at a far enemy tile
      let best = null;
      let bd = -1;
      for (let k = 0; k < 50; k++) {
        const i = this.rng.int(0, this.grid.length - 1);
        if (this.grid[i] === b.team) continue;
        const x = ((i % this.N) + 0.5) * this.cell;
        const y = (Math.floor(i / this.N) + 0.5) * this.cell;
        const d = SQ.dist2(x, y, b.x, b.y);
        if (d > bd && d < 700 * 700) (bd = d), (best = [x, y]);
      }
      if (!best) best = [1000 - b.x, 1000 - b.y];
      this.grenades.push({ team: b.team, x0: b.x, y0: b.y, x1: best[0], y1: best[1], t: 0, dur: 0.85 });
      this.g.audio.whoosh();
    }

    updateWeapons(dt) {
      const g = this.g;
      if (this.frozen) return;
      for (let i = this.turrets.length - 1; i >= 0; i--) {
        const tu = this.turrets[i];
        tu.t += dt;
        tu.a += dt * 2.6;
        tu.fire -= dt;
        if (tu.fire <= 0) {
          tu.fire = 0.26;
          for (const off of [0, Math.PI]) {
            const a = tu.a + off;
            this.bullets.push({ team: tu.team, x: tu.x + Math.cos(a) * 30, y: tu.y + Math.sin(a) * 30, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, life: 1.6 });
          }
          g.audio.tick();
        }
        if (tu.t > tu.life) {
          g.fx.burst(tu.x, tu.y, this.teams[tu.team].color, 16, 260, 10);
          this.turrets.splice(i, 1);
        }
      }
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const bu = this.bullets[i];
        bu.life -= dt;
        bu.x += bu.vx * dt;
        bu.y += bu.vy * dt;
        const c = this.cellAt(bu.x, bu.y);
        if (c < 0 || bu.life <= 0) {
          this.bullets.splice(i, 1);
          continue;
        }
        if (this.grid[c] !== bu.team) {
          if (this.lock[this.grid[c]] <= 0) {
            this.setTile(c, bu.team);
            g.audio.melodyHit((bu.x - 500) / 600, true);
          }
          this.bullets.splice(i, 1);
        }
      }
      for (let i = this.grenades.length - 1; i >= 0; i--) {
        const gr = this.grenades[i];
        gr.t += dt;
        if (gr.t >= gr.dur) {
          this.grenades.splice(i, 1);
          this.blast(gr.team, gr.x1, gr.y1, 2.8, 'GRENADE');
        }
      }
    }

    // ---------- random events ----------
    updateEvents(dt) {
      const g = this.g;
      const rng = this.rng;
      const left = this.duration - this.time;
      if (this.spin) {
        const s = this.spin;
        s.t += dt;
        const idx = Math.floor((1 - Math.pow(1 - Math.min(1, s.t / s.dur), 2.2)) * 18);
        if (idx !== s.idx && s.t < s.dur) {
          s.idx = idx;
          g.audio.tick();
        }
        if (s.t >= s.dur && !s.applied) {
          s.applied = true;
          this.applyEvent(s.pick);
        }
        if (s.t >= s.dur + 1.1) this.spin = null;
        return;
      }
      this.nextEvent -= dt;
      if (this.nextEvent <= 0 && this.time > 8 && left > 9) {
        // not every time: sometimes the roulette simply doesn't come
        if (rng.chance(0.7)) {
          const pick = weighted(rng, EVENTS, (e) => e.w);
          this.spin = { t: 0, dur: 1.7, pick, idx: -1, applied: false, order: rng.shuffle(EVENTS) };
          g.audio.riser(1.7);
          this.nextEvent = rng.range(13, 19);
        } else this.nextEvent = rng.range(5, 8);
      }
    }

    applyEvent(ev) {
      const g = this.g;
      const rng = this.rng;
      g.audio.boom();
      g.fx.flash(0.35);
      const T = this.teams;
      if (ev.id === 'colorSwap') {
        const [a, b] = rng.shuffle(T.map((_, i) => i)).slice(0, 2);
        for (let i = 0; i < this.grid.length; i++) {
          if (this.grid[i] === a) this.setTile(i, b);
          else if (this.grid[i] === b) this.setTile(i, a);
        }
        this.announce(`${T[a].name} ⇄ ${T[b].name}`);
      } else if (ev.id === 'placeSwap') {
        const pos = this.balls.map((b) => [b.x, b.y]);
        const shift = rng.int(1, Math.max(1, this.balls.length - 1));
        this.balls.forEach((b, i) => {
          g.fx.ring(b.x, b.y, T[b.team].color, 50);
          [b.x, b.y] = pos[(i + shift) % pos.length];
          b.pop = 1;
          g.fx.ring(b.x, b.y, T[b.team].color, 70);
        });
        this.announce('everyone teleports');
        g.audio.whoosh();
      } else if (ev.id === 'robinHood') {
        const hi = this.counts.indexOf(Math.max(...this.counts));
        const lo = this.counts.indexOf(Math.min(...this.counts));
        let give = Math.floor(this.grid.length * 0.1);
        const cells = rng.shuffle(Array.from(this.grid.keys()).filter((i) => this.grid[i] === hi));
        for (const i of cells) {
          if (give-- <= 0) break;
          this.setTile(i, lo);
        }
        this.announce(`${T[hi].name} gives tiles to ${T[lo].name}`);
      } else if (ev.id === 'tileRain') {
        for (let k = 0; k < 60; k++) this.setTile(rng.int(0, this.grid.length - 1), rng.int(0, T.length - 1));
        this.announce('random tiles flip');
      } else if (ev.id === 'frenzy') {
        for (const b of this.balls) b.boost = 5;
        this.announce('everyone goes fast');
      } else if (ev.id === 'giants') {
        for (const b of this.balls) b.big = 6;
        this.announce('everyone grows');
      } else if (ev.id === 'itemRain') {
        for (let k = 0; k < 5; k++) this.spawnItem(weighted(rng, DROPS, (d) => d[1])[0]);
        this.announce('grab them quick');
      } else if (ev.id === 'mirror') {
        const copy = this.grid.slice();
        for (let r = 0; r < this.N; r++)
          for (let c = 0; c < this.N; c++) this.setTile(r * this.N + c, copy[r * this.N + (this.N - 1 - c)]);
        for (const b of this.balls) b.x = 1000 - b.x;
        this.announce('the board flips over');
      }
    }

    // the roulette itself shows what happened, underneath the event name
    announce(sub) {
      if (this.spin) this.spin.sub = sub;
    }

    moveBall(b, dt) {
      if (this.frozen || b.frozen > 0) return;
      dt *= (b.boost > 0 ? 1.6 : 1) * (this.finalTold ? 1.25 : 1);
      const h = b.size / 2;
      const hitAxis = (axis) => {
        if (b.ghost > 0) return false; // ghosts drift through everything
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
            this.setTile(i, b.team);
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
      if (left < 12 || this.spin) return 1;
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

      // turrets
      for (const tu of this.turrets) {
        const t = this.teams[tu.team];
        const born = SQ.ease.outBack(Math.min(1, tu.t * 4));
        ctx.save();
        ctx.translate(tu.x, tu.y);
        ctx.scale(born, born);
        if (tu.life - tu.t < 1.5 && Math.floor(tu.t * 8) % 2) ctx.globalAlpha = 0.5;
        SQ.drawTurret(ctx, 56, t.color, t.dark, tu.a);
        // time left
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 40, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - tu.t / tu.life));
        ctx.stroke();
        ctx.restore();
      }
      for (const bu of this.bullets) {
        const t = this.teams[bu.team];
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bu.x - 8, bu.y - 8, 16, 16);
        ctx.fillStyle = t.color;
        ctx.fillRect(bu.x - 5, bu.y - 5, 10, 10);
      }
      // grenades fly in an arc: they grow as they rise
      for (const gr of this.grenades) {
        const k = gr.t / gr.dur;
        const x = SQ.lerp(gr.x0, gr.x1, k);
        const y = SQ.lerp(gr.y0, gr.y1, k);
        const lift = Math.sin(k * Math.PI);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(x, y + 10, 18 * (1 - lift * 0.4), 7, 0, 0, Math.PI * 2);
        ctx.fill();
        // target marker
        ctx.strokeStyle = SQ.rgba(this.teams[gr.team].color, 0.9);
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.arc(gr.x1, gr.y1, 2.8 * this.cell * (1 - k * 0.3), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.save();
        ctx.translate(x, y - lift * 160);
        ctx.rotate(k * 12);
        const s = 1 + lift * 0.8;
        ctx.scale(s, s);
        SQ.drawGrenade(ctx, 40);
        ctx.restore();
      }

      for (const b of this.balls) {
        const t = this.teams[b.team];
        const ghost = b.ghost > 0;
        ctx.strokeStyle = SQ.rgba(t.light, ghost ? 0.2 : 0.5);
        ctx.lineCap = 'round';
        for (let i = 2; i < b.trail.length; i += 2) {
          ctx.lineWidth = (i / b.trail.length) * b.size * 0.6;
          ctx.beginPath();
          ctx.moveTo(b.trail[i - 2], b.trail[i - 1]);
          ctx.lineTo(b.trail[i], b.trail[i + 1]);
          ctx.stroke();
        }
        const sp = Math.hypot(b.vx, b.vy) || 1;
        SQ.drawSquare(ctx, b.x, b.y + (ghost ? Math.sin(this.time * 8) * 4 : 0), b.size, t, {
          lookX: b.vx / sp,
          lookY: b.vy / sp,
          squash: b.squash,
          pop: b.pop,
          alpha: ghost ? 0.45 : 1,
          outline: b.frozen > 0 ? '#bdf3ff' : '#ffffff',
          mood: b.frozen > 0 ? 'scared' : b.big > 0 || b.paint > 0 || b.bombFuse > 0 ? 'angry' : 'normal',
          glow: b.boost > 0 || b.paint > 0 ? 22 : 12,
          glowColor: b.paint > 0 ? '#a95cff' : b.boost > 0 ? '#ffc21a' : '#ffffff',
        });
        this.drawCarried(ctx, b);
      }
    }

    // what a square is holding or powered by, drawn above its head
    drawCarried(ctx, b) {
      const top = b.y - b.size / 2 - 26;
      if (b.bombFuse > 0) {
        const wob = Math.sin(this.time * 30) * 3;
        SQ.drawEmoji(ctx, '💣', b.x + wob, top - 6, 40);
        if (Math.floor(this.time * 12) % 2) {
          ctx.fillStyle = '#fff2a8';
          ctx.fillRect(b.x + 12, top - 32, 8, 8);
        }
        return;
      }
      if (b.grenadeT > 0) {
        ctx.save();
        ctx.translate(b.x, top - 4);
        ctx.rotate(Math.sin(this.time * 14) * 0.3);
        SQ.drawGrenade(ctx, 38);
        ctx.restore();
        return;
      }
      const badges = [];
      if (b.big > 0) badges.push(['🍄', b.big / 10]);
      if (b.ghost > 0) badges.push(['👻', b.ghost / 4]);
      if (b.paint > 0) badges.push(['🖌️', b.paint / 3.5]);
      if (b.boost > 0) badges.push(['⚡', b.boost / 5]);
      badges.forEach(([ic, k], i) => {
        const x = b.x + (i - (badges.length - 1) / 2) * 34;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.arc(x, top, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(x, top, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * SQ.clamp(k, 0, 1));
        ctx.stroke();
        SQ.drawEmoji(ctx, ic, x, top + 1, 20);
      });
    }

    // the event roulette sits over the arena, outside the camera
    drawScreen(ctx) {
      const s = this.spin;
      if (!s) return;
      const A = SQ.ARENA;
      const cy = A.y + A.size * 0.3;
      const done = s.t >= s.dur;
      const intro = SQ.ease.outBack(Math.min(1, s.t / 0.25));
      const outK = done ? 1 - SQ.clamp((s.t - s.dur - 0.7) / 0.4, 0, 1) : 1;
      const name = done ? s.pick.name : s.order[(s.idx < 0 ? 0 : s.idx) % s.order.length].name;
      ctx.save();
      ctx.globalAlpha = outK;
      ctx.translate(SQ.W / 2, cy);
      ctx.scale(intro, intro);
      const w = 800;
      const h = done && s.sub ? 290 : 190;
      ctx.fillStyle = 'rgba(10,10,18,0.88)';
      SQ.roundRect(ctx, -w / 2, -95, w, h, 26);
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = done ? '#ffd23f' : `hsl(${(s.t * 900) % 360}, 90%, 65%)`;
      ctx.stroke();
      SQ.outlinedText(ctx, 'RANDOM EVENT', 0, -52, 34, '#ffd23f', { stroke: 7 });
      const pulse = done ? 1 + 0.12 * Math.sin(Math.min(1, (s.t - s.dur) * 6) * Math.PI) : 1;
      ctx.scale(pulse, pulse);
      SQ.outlinedText(ctx, name, 0, 26, 76, '#ffffff', { stroke: 14 });
      if (done && s.sub) SQ.outlinedText(ctx, s.sub, 0, 128, 40, '#ffffff', { stroke: 8, font: SQ.fontBody, weight: 700 });
      ctx.restore();
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
      const left = this.duration - this.time;
      SQ.outlinedText(ctx, SQ.fmtTime(left), SQ.W / 2, y + 120, 56, left <= 10 ? '#ff4d5e' : '#ffffff', { stroke: 10 });
    }
  }

  SQ.modes.territory = { id: 'territory', name: 'Tile Wars', create: (g, rng, opts) => new Territory(g, rng, opts) };
})();
