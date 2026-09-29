// Square Race: a random maze, breakable brick gates, items, first to the flag wins.
(function () {
  const SQ = window.SQ;
  const FLOOR = 0;
  const WALL = 1;
  const BRICK = 2;
  const FINISH = 3;
  const ITEMS = [
    { type: 'boost', icon: '⚡' },
    { type: 'knife', icon: '🔪' },
    { type: 'banana', icon: '🍌' },
    { type: 'freeze', icon: '❄️' },
  ];

  class Race {
    constructor(g, rng) {
      this.g = g;
      this.rng = rng;
      this.mw = rng.pick([5, 6, 6, 7]);
      this.T = this.mw * 2 + 1;
      this.tile = 1000 / this.T;
      this.buildMaze();
      const n = rng.int(4, 6);
      this.teams = SQ.pickTeams(rng, n);
      this.title = 'SQUARE RACE';
      this.rules = [[{ t: 'Choose a square', c: '#ffffff' }], [{ t: 'First to the ', c: '#ffffff' }, { t: 'flag', c: '#ffd23f' }, { t: ' wins', c: '#ffffff' }]];
      const size = Math.min(34, this.tile * 0.42);
      const [sc, sr] = this.startTile;
      this.racers = this.teams.map((t, i) => ({
        team: i,
        x: (sc + 0.5) * this.tile + ((i % 3) - 1) * size * 0.9,
        y: (sr + 0.5) * this.tile + (Math.floor(i / 3) - 0.5) * size * 0.9,
        vx: 0,
        vy: 0,
        size,
        accel: rng.range(560, 640),
        max: rng.range(230, 262),
        boost: 0,
        knife: 0,
        stun: 0,
        spin: 0,
        frozen: 0,
        finished: false,
        place: 0,
        trail: [],
        stuckT: 0,
        lastX: 0,
        lastY: 0,
        squash: 0,
        blink: rng.range(1, 4),
      }));
      // keep everyone inside the start tile; overlaps between racers resolve on the first frame
      const t0 = this.tile;
      for (const p of this.racers) {
        const h = p.size / 2 + 1;
        p.x = SQ.clamp(p.x, sc * t0 + h, (sc + 1) * t0 - h);
        p.y = SQ.clamp(p.y, sr * t0 + h, (sr + 1) * t0 - h);
      }
      this.items = [];
      const floors = [];
      for (let r = 1; r < this.T; r += 2) for (let c = 1; c < this.T; c += 2) if (this.dist[r * this.T + c] > 3 && this.dist[r * this.T + c] < this.dist[sr * this.T + sc] - 2) floors.push([c, r]);
      rng.shuffle(floors)
        .slice(0, rng.int(4, 7))
        .forEach(([c, r]) => this.items.push({ ...rng.pick(ITEMS), x: (c + 0.5) * this.tile, y: (r + 0.5) * this.tile, t: rng.range(0, 3), respawn: 0 }));
      this.bananas = [];
      this.time = 0;
      this.duration = 80;
      this.places = [];
      this.winner = null;
      this.leader = -1;
      this.camTracking = true;
    }

    idx(c, r) {
      return r * this.T + c;
    }

    buildMaze() {
      const rng = this.rng;
      const T = this.T;
      const m = this.mw;
      const grid = new Uint8Array(T * T).fill(WALL);
      this.bhp = new Float32Array(T * T);
      const seen = new Uint8Array(m * m);
      const stack = [[0, m - 1]];
      seen[(m - 1) * m] = 1;
      grid[this.idx(1, (m - 1) * 2 + 1)] = FLOOR;
      while (stack.length) {
        const [cx, cy] = stack[stack.length - 1];
        const nb = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].filter(([dx, dy]) => {
          const nx = cx + dx;
          const ny = cy + dy;
          return nx >= 0 && ny >= 0 && nx < m && ny < m && !seen[ny * m + nx];
        });
        if (!nb.length) {
          stack.pop();
          continue;
        }
        const [dx, dy] = rng.pick(nb);
        const nx = cx + dx;
        const ny = cy + dy;
        seen[ny * m + nx] = 1;
        grid[this.idx(cx * 2 + 1 + dx, cy * 2 + 1 + dy)] = FLOOR;
        grid[this.idx(nx * 2 + 1, ny * 2 + 1)] = FLOOR;
        stack.push([nx, ny]);
      }
      // extra openings create shortcuts and alternate routes
      const extra = rng.int(m, m * 2);
      for (let k = 0; k < extra; k++) {
        const c = rng.int(1, T - 2);
        const r = rng.int(1, T - 2);
        if (grid[this.idx(c, r)] !== WALL) continue;
        const horiz = grid[this.idx(c - 1, r)] !== WALL && grid[this.idx(c + 1, r)] !== WALL && grid[this.idx(c, r - 1)] === WALL && grid[this.idx(c, r + 1)] === WALL;
        const vert = grid[this.idx(c, r - 1)] !== WALL && grid[this.idx(c, r + 1)] !== WALL && grid[this.idx(c - 1, r)] === WALL && grid[this.idx(c + 1, r)] === WALL;
        if (horiz || vert) grid[this.idx(c, r)] = FLOOR;
      }
      this.grid = grid;
      this.startTile = [1, (m - 1) * 2 + 1];
      // finish: the cell farthest from the start
      let d = this.bfs([this.startTile]);
      let far = 0;
      let fi = 0;
      for (let i = 0; i < d.length; i++) if (d[i] < 1e9 && d[i] > far && (i % T) % 2 === 1 && Math.floor(i / T) % 2 === 1) (far = d[i]), (fi = i);
      this.finishTile = [fi % T, Math.floor(fi / T)];
      grid[fi] = FINISH;
      this.dist = this.bfs([this.finishTile]);
      // brick gates on corridors along the main path
      const path = [];
      let [c, r] = this.startTile;
      while (this.dist[this.idx(c, r)] > 0) {
        let best = null;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const j = this.idx(c + dx, r + dy);
          if (this.dist[j] < this.dist[this.idx(c, r)]) best = [c + dx, r + dy];
        }
        if (!best) break;
        [c, r] = best;
        if ((c + r) % 2 === 1) path.push([c, r]); // corridor tiles between cells
      }
      const gates = rng.shuffle(path.slice(2, -1)).slice(0, rng.int(2, 3));
      this.brickColors = [];
      for (const [gc, gr] of gates) {
        const i = this.idx(gc, gr);
        grid[i] = BRICK;
        this.bhp[i] = rng.int(4, 7);
        this.brickColors[i] = rng.pick(['#e8b400', '#1fb8c9', '#1f9e5a', '#d62d3a', '#6c4bd8']);
      }
    }

    bfs(starts) {
      const T = this.T;
      const d = new Float64Array(T * T).fill(1e9);
      const q = [];
      for (const [c, r] of starts) {
        d[this.idx(c, r)] = 0;
        q.push([c, r]);
      }
      let h = 0;
      while (h < q.length) {
        const [c, r] = q[h++];
        const cd = d[this.idx(c, r)];
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nc = c + dx;
          const nr = r + dy;
          if (nc < 0 || nr < 0 || nc >= T || nr >= T) continue;
          const j = this.idx(nc, nr);
          if (this.grid[j] === WALL || d[j] <= cd + 1) continue;
          d[j] = cd + 1;
          q.push([nc, nr]);
        }
      }
      return d;
    }

    solid(c, r) {
      if (c < 0 || r < 0 || c >= this.T || r >= this.T) return true;
      const v = this.grid[this.idx(c, r)];
      return v === WALL || v === BRICK;
    }

    progress(p) {
      const c = Math.floor(p.x / this.tile);
      const r = Math.floor(p.y / this.tile);
      const d = this.dist[this.idx(SQ.clamp(c, 0, this.T - 1), SQ.clamp(r, 0, this.T - 1))];
      return p.finished ? -1000 + p.place : d < 1e9 ? d : 999;
    }

    update(dt) {
      const g = this.g;
      const rng = this.rng;
      this.time += dt;
      const t = this.tile;
      for (const it of this.items) {
        it.t += dt;
        if (it.respawn > 0) it.respawn -= dt;
      }
      for (const p of this.racers) {
        p.squash *= Math.exp(-dt * 10);
        p.blink -= dt;
        if (p.blink < -0.12) p.blink = rng.range(2, 5);
        if (p.finished) {
          p.vx *= 0.9;
          p.vy *= 0.9;
          p.spin += dt * 6;
          continue;
        }
        p.boost -= dt;
        p.knife -= dt;
        p.stun -= dt;
        p.frozen -= dt;
        const c = Math.floor(p.x / t);
        const r = Math.floor(p.y / t);
        if (p.stun <= 0 && p.frozen <= 0) {
          // steer toward the neighbouring tile that is closest to the flag
          const here = this.dist[this.idx(c, r)];
          let bx = 0;
          let by = 0;
          let bd = here;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const nc = c + dx;
            const nr = r + dy;
            if (nc < 0 || nr < 0 || nc >= this.T || nr >= this.T) continue;
            const d = this.dist[this.idx(nc, nr)];
            if (d < bd) (bd = d), (bx = dx), (by = dy);
          }
          let tx = (c + 0.5 + bx) * t;
          let ty = (r + 0.5 + by) * t;
          // stay centred in the corridor when moving along it
          const ax = tx - p.x;
          const ay = ty - p.y;
          const l = Math.hypot(ax, ay) || 1;
          const wob = Math.sin(this.time * 3 + p.team * 2) * 0.35;
          const acc = p.accel * (p.boost > 0 ? 1.8 : 1);
          p.vx += ((ax / l) + wob * (ay / l)) * acc * dt;
          p.vy += ((ay / l) - wob * (ax / l)) * acc * dt;
        } else if (p.stun > 0) p.spin += dt * 14;
        if (p.frozen > 0) {
          p.vx *= 0.8;
          p.vy *= 0.8;
        }
        const max = p.max * (p.boost > 0 ? 1.7 : 1);
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > max) (p.vx *= max / sp), (p.vy *= max / sp);
        p.vx *= Math.exp(-dt * 0.8);
        p.vy *= Math.exp(-dt * 0.8);
        this.moveAxis(p, p.vx * dt, 0);
        this.moveAxis(p, 0, p.vy * dt);
        if (p.stun <= 0) p.spin *= Math.exp(-dt * 8);

        p.trail.push(p.x, p.y);
        if (p.trail.length > 24) p.trail.splice(0, 2);

        // unstick
        p.stuckT += dt;
        if (p.stuckT > 1.5) {
          if (SQ.dist2(p.x, p.y, p.lastX, p.lastY) < 30 * 30) {
            const a = rng.range(0, 6.28);
            p.vx += Math.cos(a) * 300;
            p.vy += Math.sin(a) * 300;
          }
          p.stuckT = 0;
          p.lastX = p.x;
          p.lastY = p.y;
        }

        // items
        for (const it of this.items) {
          if (it.respawn > 0) continue;
          if (Math.abs(it.x - p.x) < t * 0.35 && Math.abs(it.y - p.y) < t * 0.35) {
            it.respawn = 8;
            this.useItem(p, it);
          }
        }
        for (let b = this.bananas.length - 1; b >= 0; b--) {
          const bn = this.bananas[b];
          if (bn.owner === p && bn.age < 1) continue;
          if (Math.abs(bn.x - p.x) < p.size * 0.7 && Math.abs(bn.y - p.y) < p.size * 0.7) {
            this.bananas.splice(b, 1);
            p.stun = 1.1;
            p.vx *= -0.3;
            p.vy *= -0.3;
            g.audio.slip();
            g.fx.text(p.x, p.y - 40, 'SLIPPED!', '#ffe066', 34);
            g.fx.maybeSay(p, 'elim', 0.35);
          }
        }

        // finish
        if (this.grid[this.idx(Math.floor(p.x / t), Math.floor(p.y / t))] === FINISH) {
          p.finished = true;
          this.places.push(p);
          p.place = this.places.length;
          g.fx.burst(p.x, p.y, this.teams[p.team].color, 40, 400, 12);
          if (p.place === 1) {
            g.audio.ding();
            this.winner = { team: this.teams[p.team], text: `${this.teams[p.team].name.toUpperCase()} WINS!`, sub: `finished in ${this.time.toFixed(1)}s` };
            this.winnerEnt = p;
          } else {
            g.audio.pickup();
            g.fx.text(p.x, p.y - 40, ['', '1st', '2nd', '3rd', '4th', '5th', '6th'][p.place], '#ffffff', 40);
          }
        }
      }
      for (const bn of this.bananas) bn.age += dt;

      // racer vs racer
      const R = this.racers;
      for (let i = 0; i < R.length; i++)
        for (let j = i + 1; j < R.length; j++) {
          const a = R[i];
          const b = R[j];
          if (a.finished || b.finished) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const lim = (a.size + b.size) / 2;
          if (Math.abs(dx) > lim || Math.abs(dy) > lim) continue;
          const d = Math.hypot(dx, dy) || 1;
          const nx = dx / d;
          const ny = dy / d;
          const push = (lim - d) / 2;
          this.moveAxis(a, -nx * push, 0);
          this.moveAxis(a, 0, -ny * push);
          this.moveAxis(b, nx * push, 0);
          this.moveAxis(b, 0, ny * push);
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) {
            a.vx += rel * nx;
            a.vy += rel * ny;
            b.vx -= rel * nx;
            b.vy -= rel * ny;
            if (rel < -80) g.audio.bonk();
          }
          for (const [atk, vic] of [
            [a, b],
            [b, a],
          ]) {
            if (atk.knife > 0 && vic.stun <= 0) {
              atk.knife = 0;
              vic.stun = 1.6;
              vic.vx = (vic.x - atk.x) * 12;
              vic.vy = (vic.y - atk.y) * 12;
              g.audio.slash();
              g.audio.hit(false);
              g.hitstop(0.06);
              g.fx.sparks(vic.x, vic.y, 14, '#ffffff');
              g.fx.text(vic.x, vic.y - 40, 'STABBED!', '#ff6b6b', 38);
              g.fx.maybeSay(vic, 'elim', 0.6);
              g.highlight(vic.x, vic.y, 2.4, 0.8, 0.35);
            }
          }
        }

      // leader and camera
      const order = R.slice().sort((a, b) => this.progress(a) - this.progress(b));
      this.order = order;
      const lead = order[0];
      if (lead.team !== this.leader && this.leader !== -1 && this.time > 2 && !this.winner && this.time - (this.leadTold || 0) > 2.5) {
        this.leadTold = this.time;
        g.fx.text(lead.x, lead.y - 50, 'NEW LEADER', this.teams[lead.team].color, 34);
        g.audio.whoosh();
      }
      this.leader = lead.team;
      // Close follow cam on the two front runners.
      const pack = order.filter((p) => !p.finished).slice(0, 2);
      if (pack.length) {
        const fx = pack.reduce((s, p) => s + p.x, 0) / pack.length;
        const fy = pack.reduce((s, p) => s + p.y, 0) / pack.length;
        const spread = pack.length > 1 ? Math.max(Math.abs(pack[0].x - pack[1].x), Math.abs(pack[0].y - pack[1].y)) : 0;
        g.cam.setDefault(fx, fy, SQ.clamp(1000 / (spread + 520), 1.25, 1.9));
      }

      if (!this.winner && this.time >= this.duration) {
        this.winner = { team: this.teams[lead.team], text: `${this.teams[lead.team].name.toUpperCase()} WINS!`, sub: 'time up: closest to the flag' };
        this.winnerEnt = lead;
      }
    }

    moveAxis(p, dx, dy) {
      const t = this.tile;
      p.x += dx;
      p.y += dy;
      const h = p.size / 2;
      const c0 = Math.floor((p.x - h) / t);
      const c1 = Math.floor((p.x + h) / t);
      const r0 = Math.floor((p.y - h) / t);
      const r1 = Math.floor((p.y + h) / t);
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++) {
          if (!this.solid(c, r)) continue;
          if (dx > 0) (p.x = c * t - h - 0.01), (p.vx = -Math.abs(p.vx) * 0.45), (p.squash = 0.2);
          else if (dx < 0) (p.x = (c + 1) * t + h + 0.01), (p.vx = Math.abs(p.vx) * 0.45), (p.squash = 0.2);
          if (dy > 0) (p.y = r * t - h - 0.01), (p.vy = -Math.abs(p.vy) * 0.45), (p.squash = -0.2);
          else if (dy < 0) (p.y = (r + 1) * t + h + 0.01), (p.vy = Math.abs(p.vy) * 0.45), (p.squash = -0.2);
          const i = this.idx(c, r);
          if (this.grid[i] === BRICK) this.hitBrick(i, p, Math.abs(dx + dy) / Math.max(0.001, this.g.fixedDt));
          return;
        }
    }

    hitBrick(i, p, speed) {
      if (speed < 60 && p.knife <= 0) return;
      if ((p.brickCool || 0) > this.time) return;
      p.brickCool = this.time + 0.18;
      const g = this.g;
      const dmg = p.knife > 0 ? 99 : 1;
      this.bhp[i] -= dmg;
      const t = this.tile;
      const cx = ((i % this.T) + 0.5) * t;
      const cy = (Math.floor(i / this.T) + 0.5) * t;
      g.fx.burst(cx, cy, this.brickColors[i], 6, 200, 10);
      g.audio.brick();
      g.cam.shake(2);
      if (this.bhp[i] <= 0) {
        this.grid[i] = FLOOR;
        g.fx.burst(cx, cy, this.brickColors[i], 30, 380, 16);
        g.fx.text(cx, cy - 30, 'SMASH!', '#ffffff', 44);
        g.audio.explode();
        g.cam.shake(10);
        g.hitstop(0.08);
        this.layer = null;
        g.highlight(cx, cy, 2.2, 0.7, 0.4);
        this.dist = this.bfs([this.finishTile]);
      }
    }

    useItem(p, it) {
      const g = this.g;
      g.audio.pickup();
      g.fx.ring(it.x, it.y, '#ffffff', 40);
      if (it.type === 'boost') {
        p.boost = 2.5;
        g.fx.text(p.x, p.y - 40, 'BOOST!', '#ffe066', 36);
      } else if (it.type === 'knife') {
        p.knife = 6;
        g.fx.text(p.x, p.y - 40, 'KNIFE!', '#ff6b6b', 36);
      } else if (it.type === 'banana') {
        this.bananas.push({ x: p.x - p.vx * 0.15, y: p.y - p.vy * 0.15, owner: p, age: 0 });
        g.fx.text(p.x, p.y - 40, 'BANANA DROP', '#ffe066', 32);
      } else if (it.type === 'freeze') {
        g.audio.freeze();
        g.fx.text(p.x, p.y - 40, 'FREEZE!', '#bdf3ff', 36);
        for (const o of this.racers) if (o !== p && !o.finished) o.frozen = 1.3;
        g.fx.flash(0.35, '#bdf3ff');
      }
    }

    intensity() {
      if (this.winner) return 1;
      const lead = this.order ? this.order[0] : null;
      if (lead && this.progress(lead) < 12) return 1;
      return this.time < 6 ? 0.5 : 0.7;
    }

    invalidate() {
      this.layer = null;
    }

    draw(ctx) {
      const t = this.tile;
      // The maze itself is drawn once into a cached layer; bricks change, so they are drawn live.
      if (!this.layer) {
        const L = document.createElement('canvas');
        L.width = L.height = Math.round(1000 * SQ.RES * 1.9);
        const x = L.getContext('2d');
        x.scale(L.width / 1000, L.width / 1000);
        this.drawMaze(x, false);
        this.layer = L;
      }
      ctx.drawImage(this.layer, 0, 0, 1000, 1000);
      this.drawMaze(ctx, true);
      this.drawActors(ctx);
    }

    drawMaze(ctx, bricksOnly) {
      const t = this.tile;
      if (!bricksOnly) {
        ctx.fillStyle = '#c9c1b0';
        ctx.fillRect(0, 0, 1000, 1000);
      }
      for (let r = 0; r < this.T; r++)
        for (let c = 0; c < this.T; c++) {
          const v = this.grid[this.idx(c, r)];
          const x = c * t;
          const y = r * t;
          if (bricksOnly && v !== BRICK) continue;
          if (v === FLOOR || (v === BRICK && !bricksOnly)) {
            ctx.fillStyle = '#ecebe6';
            ctx.fillRect(x - 0.5, y - 0.5, t + 1, t + 1);
          } else if (v === FINISH) {
            const k = 4;
            for (let a = 0; a < k; a++)
              for (let b = 0; b < k; b++) {
                ctx.fillStyle = (a + b) % 2 ? '#111' : '#fff';
                ctx.fillRect(x + (a * t) / k, y + (b * t) / k, t / k + 0.5, t / k + 0.5);
              }
          } else if (v === BRICK) {
            ctx.fillStyle = '#ecebe6';
            ctx.fillRect(x, y, t, t);
            const col = this.brickColors[this.idx(c, r)];
            ctx.fillStyle = col;
            ctx.fillRect(x + 2, y + 2, t - 4, t - 4);
            ctx.strokeStyle = 'rgba(0,0,0,0.45)';
            ctx.lineWidth = 2.5;
            const rows = 4;
            for (let k = 1; k < rows; k++) {
              ctx.beginPath();
              ctx.moveTo(x + 2, y + (k * t) / rows);
              ctx.lineTo(x + t - 2, y + (k * t) / rows);
              ctx.stroke();
            }
            for (let k = 0; k < rows; k++) {
              const off = k % 2 ? t / 4 : t / 2;
              ctx.beginPath();
              ctx.moveTo(x + off, y + (k * t) / rows);
              ctx.lineTo(x + off, y + ((k + 1) * t) / rows);
              if (k % 2) {
                ctx.moveTo(x + off + t / 2, y + (k * t) / rows);
                ctx.lineTo(x + off + t / 2, y + ((k + 1) * t) / rows);
              }
              ctx.stroke();
            }
            SQ.outlinedText(ctx, String(Math.ceil(this.bhp[this.idx(c, r)])), x + t / 2, y + t / 2, t * 0.4, '#ffffff', { stroke: 6 });
          }
        }
      if (bricksOnly) return;
      // wall edges
      ctx.strokeStyle = '#2b2a28';
      ctx.lineWidth = 4;
      for (let r = 0; r < this.T; r++)
        for (let c = 0; c < this.T; c++) {
          if (this.grid[this.idx(c, r)] !== WALL) continue;
          const x = c * t;
          const y = r * t;
          ctx.beginPath();
          if (!this.isWall(c, r - 1)) ctx.moveTo(x, y), ctx.lineTo(x + t, y);
          if (!this.isWall(c, r + 1)) ctx.moveTo(x, y + t), ctx.lineTo(x + t, y + t);
          if (!this.isWall(c - 1, r)) ctx.moveTo(x, y), ctx.lineTo(x, y + t);
          if (!this.isWall(c + 1, r)) ctx.moveTo(x + t, y), ctx.lineTo(x + t, y + t);
          ctx.stroke();
        }
    }

    drawActors(ctx) {
      const t = this.tile;
      // flag
      const [fc, fr] = this.finishTile;
      SQ.drawEmoji(ctx, '🏁', (fc + 0.5) * t, (fr + 0.5) * t - Math.abs(Math.sin(this.time * 3)) * 6, t * 0.5);

      for (const it of this.items) {
        if (it.respawn > 0) continue;
        ctx.save();
        ctx.translate(it.x, it.y + Math.sin(it.t * 4) * 4);
        ctx.rotate(Math.sin(it.t * 2) * 0.2);
        ctx.fillStyle = 'rgba(80,60,200,0.18)';
        ctx.beginPath();
        ctx.arc(0, 0, t * 0.3, 0, Math.PI * 2);
        ctx.fill();
        SQ.drawEmoji(ctx, it.icon, 0, 2, t * 0.42);
        ctx.restore();
      }
      for (const bn of this.bananas) SQ.drawEmoji(ctx, '🍌', bn.x, bn.y, t * 0.36);

      for (const p of this.racers) {
        const tm = this.teams[p.team];
        // speed streak behind the racer
        if (p.trail.length > 4) {
          ctx.fillStyle = SQ.rgba(tm.color, 0.45);
          ctx.beginPath();
          const tx = p.trail[0];
          const ty = p.trail[1];
          const ang = Math.atan2(p.y - ty, p.x - tx) + Math.PI / 2;
          const w = p.size * 0.45;
          ctx.moveTo(p.x + Math.cos(ang) * w, p.y + Math.sin(ang) * w);
          ctx.lineTo(tx, ty);
          ctx.lineTo(p.x - Math.cos(ang) * w, p.y - Math.sin(ang) * w);
          ctx.fill();
        }
        const sp = Math.hypot(p.vx, p.vy) || 1;
        SQ.drawSquare(ctx, p.x, p.y, p.size, tm, {
          lookX: p.vx / sp,
          lookY: p.vy / sp,
          angle: p.spin,
          squash: p.squash,
          mood: p.finished ? 'happy' : p.stun > 0 ? 'dead' : p.knife > 0 ? 'angry' : p.frozen > 0 ? 'scared' : 'normal',
          blink: p.blink < 0,
          glow: p.boost > 0 ? 20 : 0,
          outline: p.frozen > 0 ? '#dff8ff' : null,
        });
        if (p.knife > 0) {
          ctx.save();
          ctx.translate(p.x + p.size * 0.55, p.y - p.size * 0.3);
          ctx.rotate(Math.sin(this.time * 10) * 0.4);
          SQ.drawEmoji(ctx, '🔪', 0, 0, p.size * 0.8);
          ctx.restore();
        }
      }
    }

    isWall(c, r) {
      if (c < 0 || r < 0 || c >= this.T || r >= this.T) return true;
      return this.grid[this.idx(c, r)] === WALL;
    }

    drawHud(ctx, y) {
      const order = this.order || this.racers;
      const n = order.length;
      const w = (SQ.W - 120 - (n - 1) * 14) / n;
      order.forEach((p, i) => {
        const tm = this.teams[p.team];
        const x = 60 + i * (w + 14);
        ctx.fillStyle = tm.color;
        SQ.roundRect(ctx, x, y, w, 96, 14);
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#0b0b10';
        ctx.stroke();
        const lbl = p.finished ? ['', '1st', '2nd', '3rd', '4th', '5th', '6th'][p.place] : `#${i + 1}`;
        SQ.outlinedText(ctx, lbl, x + w / 2, y + 36, 34, '#ffffff', { stroke: 7 });
        SQ.outlinedText(ctx, tm.name, x + w / 2, y + 74, 22, '#ffffff', { stroke: 5, font: SQ.fontBody, weight: 700 });
      });
      SQ.outlinedText(ctx, SQ.fmtTime(this.duration - this.time), SQ.W / 2, y + 160, 48, '#ffffff', { stroke: 9 });
    }
  }

  SQ.modes.race = { id: 'race', name: 'Square Race', create: (g, rng) => new Race(g, rng) };
})();
