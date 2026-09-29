// Color Chase: each color hunts the next one in the cycle. Tagging converts the square.
(function () {
  const SQ = window.SQ;
  const PICKUPS = [
    { type: 'speed', icon: '⚡' },
    { type: 'shield', icon: '🛡️' },
    { type: 'bomb', icon: '💣' },
    { type: 'freeze', icon: '❄️' },
  ];

  class Chase {
    constructor(g, rng) {
      this.g = g;
      this.rng = rng;
      const n = rng.pick([3, 3, 3, 3, 4, 5]);
      this.teams = SQ.pickTeams(rng, n);
      this.title = n === 3 ? 'ROCK · PAPER · SQUARES' : `${n}-WAY CHASE`;
      this.rules = this.teams.map((t, i) => [
        { t: t.name, c: t.color },
        { t: ' chases ', c: '#ffffff' },
        { t: this.teams[(i + 1) % n].name, c: this.teams[(i + 1) % n].color },
      ]);
      const total = rng.int(60, 96);
      const per = Math.floor(total / n);
      const layout = rng.pick(['clusters', 'scatter', 'ring']);
      this.ents = [];
      const size = 26;
      for (let ti = 0; ti < n; ti++) {
        const a = (ti / n) * Math.PI * 2 + rng.range(0, 0.5);
        const cx = 500 + Math.cos(a) * 280;
        const cy = 500 + Math.sin(a) * 280;
        for (let k = 0; k < per; k++) {
          let x, y;
          if (layout === 'clusters') {
            x = cx + rng.range(-150, 150);
            y = cy + rng.range(-150, 150);
          } else if (layout === 'ring') {
            const aa = a + rng.range(-0.9, 0.9);
            const rr = rng.range(330, 440);
            x = 500 + Math.cos(aa) * rr;
            y = 500 + Math.sin(aa) * rr;
          } else {
            x = rng.range(40, 960);
            y = rng.range(40, 960);
          }
          this.ents.push({
            id: this.ents.length,
            x: SQ.clamp(x, 30, 970),
            y: SQ.clamp(y, 30, 970),
            vx: rng.range(-50, 50),
            vy: rng.range(-50, 50),
            team: ti,
            size,
            speed: rng.range(150, 180),
            wander: rng.range(0, 6.28),
            boost: 0,
            shield: 0,
            frozen: 0,
            kills: 0,
            flash: 0,
            squash: 0,
            blink: rng.range(1, 5),
            sigma: false,
          });
        }
      }
      this.pickups = [];
      this.nextPickup = rng.range(3, 6);
      this.time = 0;
      this.storm = 720; // radius of the safe zone, shrinks late in the match
      this.combo = 0;
      this.comboT = 0;
      this.lonelyTold = {};
      this.counts = this.teams.map(() => per);
      this.prey = this.teams.map((_, i) => (i + 1) % n);
      this.preyKey = this.prey.join(',');
      this.winner = null;
      this.wideShot = true;
    }

    preyOf(ti) {
      return this.prey[ti];
    }

    // Each color hunts the next color still alive in the cycle. When only two are left
    // and they would hunt each other, the bigger team becomes the hunter.
    relink() {
      const n = this.teams.length;
      const prey = new Array(n).fill(-1);
      const alive = this.teams.map((_, i) => i).filter((i) => this.counts[i] > 0);
      for (const ti of alive) {
        for (let k = 1; k < n; k++) {
          const j = (ti + k) % n;
          if (this.counts[j] > 0) {
            prey[ti] = j;
            break;
          }
        }
      }
      if (alive.length === 2) {
        const [a, b] = alive;
        if (this.counts[a] >= this.counts[b]) prey[b] = -1;
        else prey[a] = -1;
      }
      const key = prey.join(',');
      if (key !== this.preyKey) {
        const changed = this.preyKey != null;
        this.preyKey = key;
        this.prey = prey;
        this.rules = alive
          .filter((ti) => prey[ti] >= 0)
          .map((ti) => [
            { t: this.teams[ti].name, c: this.teams[ti].color },
            { t: ' chases ', c: '#ffffff' },
            { t: this.teams[prey[ti]].name, c: this.teams[prey[ti]].color },
          ]);
        if (changed && alive.length > 1) {
          const hunters = alive.filter((ti) => prey[ti] >= 0);
          if (alive.length === 2 && hunters.length === 1) this.g.fx.banner('FINAL HUNT', `${this.teams[hunters[0]].name} hunts the rest`, this.teams[hunters[0]].color, 1.6);
          else this.g.fx.banner('NEW RULES', 'the chain skips the fallen color', '#ffffff', 1.3);
          this.g.audio.whoosh();
        }
      }
    }

    update(dt) {
      const g = this.g;
      const rng = this.rng;
      this.time += dt;
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
      if (this.time > 35) this.storm = Math.max(170, this.storm - dt * 16);
      const E = this.ents;

      // pickups
      this.nextPickup -= dt;
      if (this.nextPickup <= 0 && this.pickups.length < 3) {
        const p = rng.pick(PICKUPS);
        const r = Math.min(this.storm * 0.6, 380);
        const a = rng.range(0, 6.28);
        this.pickups.push({ ...p, x: 500 + Math.cos(a) * rng.range(0, r), y: 500 + Math.sin(a) * rng.range(0, r), t: 0 });
        this.nextPickup = rng.range(4, 8);
      }

      for (const e of E) {
        e.flash = Math.max(0, e.flash - dt * 3);
        e.pop = Math.max(0, (e.pop || 0) - dt * 4);
        e.squash *= Math.exp(-dt * 10);
        e.boost -= dt;
        e.shield -= dt;
        e.blink -= dt;
        if (e.blink < -0.12) e.blink = rng.range(2, 5);
        if (e.frozen > 0) {
          e.frozen -= dt;
          e.vx *= 0.9;
          e.vy *= 0.9;
          continue;
        }
        const prey = this.preyOf(e.team);
        let best = null;
        let bd = 1e12;
        let pred = null;
        let pd = 1e12;
        let sepX = 0;
        let sepY = 0;
        for (const o of E) {
          if (o === e) continue;
          const d = SQ.dist2(e.x, e.y, o.x, o.y);
          if (o.team === prey && o.shield <= 0) {
            if (d < bd) {
              bd = d;
              best = o;
            }
          } else if (this.preyOf(o.team) === e.team) {
            if (d < pd) {
              pd = d;
              pred = o;
            }
          } else if (o.team === e.team && d < 900) {
            const dd = Math.sqrt(d) || 1;
            sepX += (e.x - o.x) / dd;
            sepY += (e.y - o.y) / dd;
          }
        }
        let dx = 0;
        let dy = 0;
        e.mood = 'normal';
        if (best && bd < 420 * 420) {
          const d = Math.sqrt(bd) || 1;
          dx += ((best.x - e.x) / d) * 1.0;
          dy += ((best.y - e.y) / d) * 1.0;
          e.mood = 'angry';
        }
        if (pred && pd < 190 * 190 && e.shield <= 0) {
          const d = Math.sqrt(pd) || 1;
          const w = 1.5 * (1 - d / 190) + 0.4;
          dx -= ((pred.x - e.x) / d) * w;
          dy -= ((pred.y - e.y) / d) * w;
          e.mood = 'scared';
        }
        e.wander += rng.range(-2, 2) * dt;
        dx += Math.cos(e.wander) * 0.35 + sepX * 0.5;
        dy += Math.sin(e.wander) * 0.35 + sepY * 0.5;
        // keep away from walls
        const m = 70;
        if (e.x < m) dx += (m - e.x) / m;
        if (e.x > 1000 - m) dx -= (e.x - (1000 - m)) / m;
        if (e.y < m) dy += (m - e.y) / m;
        if (e.y > 1000 - m) dy -= (e.y - (1000 - m)) / m;
        // storm pushes inward
        const rc = Math.hypot(e.x - 500, e.y - 500);
        if (rc > this.storm) {
          dx += ((500 - e.x) / rc) * 2;
          dy += ((500 - e.y) / rc) * 2;
        }
        const len = Math.hypot(dx, dy) || 1;
        const sp = e.speed * (e.boost > 0 ? 1.8 : 1) * (this.time > 35 ? 1.15 : 1);
        const k = Math.min(1, dt * 3.2);
        e.vx += ((dx / len) * sp - e.vx) * k;
        e.vy += ((dy / len) * sp - e.vy) * k;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        const h = e.size / 2;
        if (e.x < h) (e.x = h), (e.vx = Math.abs(e.vx)), (e.squash = 0.2);
        if (e.x > 1000 - h) (e.x = 1000 - h), (e.vx = -Math.abs(e.vx)), (e.squash = 0.2);
        if (e.y < h) (e.y = h), (e.vy = Math.abs(e.vy)), (e.squash = -0.2);
        if (e.y > 1000 - h) (e.y = 1000 - h), (e.vy = -Math.abs(e.vy)), (e.squash = -0.2);
      }

      // tags and soft collisions
      for (let i = 0; i < E.length; i++) {
        const a = E[i];
        for (let j = i + 1; j < E.length; j++) {
          const b = E[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const lim = (a.size + b.size) / 2;
          if (Math.abs(dx) > lim || Math.abs(dy) > lim) continue;
          if (this.preyOf(a.team) === b.team && b.shield <= 0) this.convert(a, b);
          else if (this.preyOf(b.team) === a.team && a.shield <= 0) this.convert(b, a);
          else {
            const d = Math.hypot(dx, dy) || 1;
            const push = (lim - d) * 0.5;
            if (push > 0) {
              a.x -= (dx / d) * push;
              a.y -= (dy / d) * push;
              b.x += (dx / d) * push;
              b.y += (dy / d) * push;
            }
          }
        }
        for (let p = this.pickups.length - 1; p >= 0; p--) {
          const pk = this.pickups[p];
          if (Math.abs(pk.x - a.x) < 30 && Math.abs(pk.y - a.y) < 30) {
            this.pickups.splice(p, 1);
            this.collect(a, pk);
          }
        }
      }
      for (const pk of this.pickups) pk.t += dt;
      // pushes between squares must never shove one through the wall
      for (const e of E) {
        const h = e.size / 2;
        e.x = SQ.clamp(e.x, h, 1000 - h);
        e.y = SQ.clamp(e.y, h, 1000 - h);
      }

      this.counts = this.teams.map((_, ti) => E.filter((e) => e.team === ti).length);
      this.relink();
      const alive = this.counts.filter((c) => c > 0).length;
      this.counts.forEach((c, ti) => {
        if (c === 1 && !this.lonelyTold[ti] && alive > 1) {
          this.lonelyTold[ti] = true;
          const lone = E.find((e) => e.team === ti);
          g.fx.maybeSay(lone, 'lonely', 0.9);
          g.highlight(lone.x, lone.y, 2.2, 1.4, 0.35);
          g.fx.text(lone.x, lone.y - 60, 'LAST ONE!', this.teams[ti].color, 40);
        }
      });
      if (alive === 1 && !this.winner) {
        const ti = this.counts.findIndex((c) => c > 0);
        this.winner = { team: this.teams[ti], text: `${this.teams[ti].name.toUpperCase()} WINS!` };
        const top = E.slice().sort((x, y) => y.kills - x.kills)[0];
        this.winnerEnt = top;
      }
    }

    convert(hunter, prey) {
      const g = this.g;
      const oldTeam = this.teams[prey.team];
      const wasLonely = this.counts[hunter.team] === 1;
      prey.team = hunter.team;
      prey.flash = 1;
      prey.pop = 1;
      hunter.kills++;
      hunter.squash = -0.2;
      g.fx.burst(prey.x, prey.y, oldTeam.color, 10, 240, 9);
      g.fx.ring(prey.x, prey.y, this.teams[hunter.team].color, 36);
      this.combo++;
      this.comboT = 0.9;
      g.audio.pop(this.combo - 1, (prey.x - 500) / 600);
      if (this.combo === 10 || this.combo === 25 || this.combo === 50 || this.combo === 100) g.fx.text(prey.x, prey.y - 40, `x${this.combo} COMBO`, '#ffe066', 38);
      if (hunter.kills === 5 && !hunter.sigma && g.opts.memes > 0) {
        // every streaker gets the 🗿 face; only the occasional one gets the full moment
        hunter.sigma = true;
        if (g.fx.memeMoment('SIGMA 🗿', hunter.x, hunter.y)) {
          g.fx.say(hunter, SQ.MEMES.streak[(Math.random() * SQ.MEMES.streak.length) | 0]);
          g.highlight(hunter.x, hunter.y, 1.3, 0.9, 0.5);
        }
      } else if (wasLonely && g.opts.memes > 0) {
        g.fx.say(hunter, SQ.MEMES.comeback[(Math.random() * SQ.MEMES.comeback.length) | 0]);
      } else if (!g.fx.maybeSay(prey, 'elim', 0.05)) g.fx.maybeSay(hunter, 'hunter', 0.03);
    }

    collect(e, pk) {
      const g = this.g;
      const team = this.teams[e.team];
      g.audio.pickup();
      g.fx.ring(pk.x, pk.y, '#ffffff', 50);
      if (pk.type === 'speed') {
        e.boost = 3.5;
        g.fx.text(e.x, e.y - 40, 'SPEED!', '#ffe066');
      } else if (pk.type === 'shield') {
        e.shield = 5;
        g.fx.text(e.x, e.y - 40, 'SHIELD!', '#bdf3ff');
      } else if (pk.type === 'freeze') {
        g.audio.freeze();
        g.fx.text(e.x, e.y - 40, 'FREEZE!', '#bdf3ff');
        for (const o of this.ents) if (this.preyOf(o.team) === e.team && SQ.dist2(o.x, o.y, e.x, e.y) < 260 * 260) o.frozen = 2.5;
        g.fx.ring(e.x, e.y, '#bdf3ff', 260);
      } else if (pk.type === 'bomb') {
        g.audio.explode();
        g.cam.shake(12);
        g.hitstop(0.08);
        g.fx.flash(0.5, team.light);
        g.fx.ring(e.x, e.y, team.color, 170);
        g.fx.text(e.x, e.y - 50, 'BOOM!', '#ffffff', 56);
        let n = 0;
        for (const o of this.ents)
          if (o.team === this.preyOf(e.team) && o.shield <= 0 && SQ.dist2(o.x, o.y, e.x, e.y) < 170 * 170) {
            this.convert(e, o);
            n++;
          }
        if (n >= 3) g.highlight(e.x, e.y, 1.8, 1, 0.4);
      }
    }

    intensity() {
      const alive = this.counts.filter((c) => c > 0).length;
      const minC = Math.min(...this.counts.filter((c) => c > 0));
      if (alive <= 2) return 1;
      return minC < 5 ? 0.8 : 0.55;
    }

    draw(ctx) {
      // floor
      ctx.fillStyle = '#5a5f6e';
      ctx.fillRect(0, 0, 1000, 1000);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 2;
      for (let i = 50; i < 1000; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 1000);
        ctx.moveTo(0, i);
        ctx.lineTo(1000, i);
        ctx.stroke();
      }
      if (this.storm < 700) {
        ctx.save();
        ctx.fillStyle = 'rgba(160,30,70,0.35)';
        ctx.beginPath();
        ctx.rect(0, 0, 1000, 1000);
        ctx.arc(500, 500, this.storm, 0, Math.PI * 2, true);
        ctx.fill('evenodd');
        ctx.strokeStyle = 'rgba(255,120,170,0.8)';
        ctx.lineWidth = 5;
        ctx.setLineDash([18, 12]);
        ctx.beginPath();
        ctx.arc(500, 500, this.storm, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      for (const pk of this.pickups) {
        const bob = Math.sin(pk.t * 4) * 5;
        const s = Math.min(1, pk.t * 4);
        ctx.save();
        ctx.translate(pk.x, pk.y + bob);
        ctx.scale(s, s);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.arc(0, 0, 26 + Math.sin(pk.t * 6) * 3, 0, Math.PI * 2);
        ctx.fill();
        SQ.drawEmoji(ctx, pk.icon, 0, 2, 38);
        ctx.restore();
      }
      for (const e of this.ents) {
        const sp = Math.hypot(e.vx, e.vy) || 1;
        SQ.drawSquare(ctx, e.x, e.y, e.size, this.teams[e.team], {
          lookX: e.vx / sp,
          lookY: e.vy / sp,
          mood: e.frozen > 0 ? 'scared' : e.mood,
          blink: e.blink < 0,
          flash: e.flash,
          pop: e.pop,
          squash: e.squash,
          shield: e.shield,
          face: e.sigma && this.g.opts.memes > 0 ? 'moai' : null,
          glow: e.boost > 0 ? 18 : 0,
          outline: e.frozen > 0 ? '#dff8ff' : null,
        });
      }
    }

    drawHud(ctx, y) {
      const total = this.counts.reduce((a, b) => a + b, 0) || 1;
      const x0 = 60;
      const w = SQ.W - 120;
      let x = x0;
      const h = 64;
      this.teams.forEach((t, i) => {
        const bw = (this.counts[i] / total) * w;
        if (bw <= 0) return;
        ctx.fillStyle = t.color;
        ctx.fillRect(x, y, bw, h);
        if (bw > 70) SQ.outlinedText(ctx, String(this.counts[i]), x + bw / 2, y + h / 2 + 2, 40, '#ffffff', { stroke: 8 });
        x += bw;
      });
      ctx.strokeStyle = '#0b0b10';
      ctx.lineWidth = 6;
      ctx.strokeRect(x0, y, w, h);
    }
  }

  SQ.modes.chase = { id: 'chase', name: 'Color Chase', create: (g, rng) => new Chase(g, rng) };
})();
