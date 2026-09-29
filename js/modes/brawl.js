// Weapon Brawl: bouncing squares, each with its own weapon. Every hit levels the weapon up.
(function () {
  const SQ = window.SQ;

  const DROPS = [
    { type: 'weapon', w: 3 },
    { type: 'heal', w: 2 },
    { type: 'speed', w: 1 },
    { type: 'spikes', w: 1 },
    { type: 'shield', w: 1 },
    { type: 'mega', w: 1 },
    { type: 'bomb', w: 1 },
  ];

  // How each weapon behaves. Melee weapons spin around their square; bow and boomerang shoot.
  const WEAPONS = {
    sword: { name: 'Sword', icon: '🗡️', spin: 4.6, dmg: 15 },
    axe: { name: 'Axe', icon: '🪓', spin: 5.2, dmg: 12 },
    hammer: { name: 'Hammer', icon: '🔨', spin: 2.8, dmg: 16 },
    spear: { name: 'Spear', icon: '🔱', spin: 1.9, dmg: 14 },
    dagger: { name: 'Daggers', icon: '🔪', spin: 4.6, dmg: 7 },
    flail: { name: 'Flail', icon: '⛓️', spin: 3.8, dmg: 16 },
    bow: { name: 'Bow', icon: '🏹', dmg: 5, ranged: true },
    boomerang: { name: 'Boomerang', icon: '🪃', dmg: 10, ranged: true },
  };
  const WEAPON_IDS = Object.keys(WEAPONS);

  class Brawl {
    constructor(g, rng, forced) {
      this.g = g;
      this.rng = rng;
      const n = rng.int(4, 7);
      this.teams = SQ.pickTeams(rng, n);
      this.variant = forced || rng.pick(['mixed', 'mixed', 'mixed', 'same']);
      this.sameWeapon = rng.pick(WEAPON_IDS);
      if (this.variant === 'mixed') {
        this.title = 'WEAPON BRAWL';
        this.rules = [
          [{ t: 'Every hit, your ', c: '#ffffff' }, { t: 'weapon', c: '#dfe6ff' }, { t: ' levels up', c: '#ffffff' }],
          [{ t: 'Last square standing', c: '#ffffff' }],
        ];
      } else if (this.variant === 'same') {
        const nm = WEAPONS[this.sameWeapon].name.toLowerCase();
        this.title = `${WEAPONS[this.sameWeapon].name.toUpperCase()} BRAWL`;
        this.rules = [
          [{ t: 'Every hit, the ', c: '#ffffff' }, { t: nm, c: '#dfe6ff' }, { t: ' grows', c: '#ffffff' }],
          [{ t: 'Last square standing', c: '#ffffff' }],
        ];
      } else {
        this.title = 'BOUNCE BRAWL';
        this.rules = [[{ t: 'Every bounce, you ', c: '#ffffff' }, { t: 'grow', c: '#ffd23f' }], [{ t: 'Bigger squares hit harder', c: '#ffffff' }]];
      }
      // in a mixed brawl everyone gets a different weapon while there are enough to go round
      const pool = rng.shuffle(WEAPON_IDS);
      this.sq = this.teams.map((t, i) => {
        const a = (i / n) * Math.PI * 2;
        const sp = rng.range(250, 300);
        const va = rng.range(0, 6.28);
        const s = {
          team: i,
          x: 500 + Math.cos(a) * 320,
          y: 500 + Math.sin(a) * 320,
          vx: Math.cos(va) * sp,
          vy: Math.sin(va) * sp,
          speed: sp,
          size: 54,
          hp: 100,
          alive: true,
          w: null,
          spikes: 0,
          boost: 0,
          flash: 0,
          squash: 0,
          kills: 0,
          hitCool: {},
          dead: 0,
          blink: rng.range(1, 4),
        };
        if (this.variant === 'mixed') this.giveWeapon(s, pool[i % pool.length], 1);
        else if (this.variant === 'same') this.giveWeapon(s, this.sameWeapon, 1);
        return s;
      });
      this.proj = [];
      this.drops = [];
      this.nextDrop = rng.range(2, 4);
      this.time = 0;
      this.storm = 0; // inset of the shrinking wall
      this.winner = null;
    }

    giveWeapon(s, type, lvl) {
      s.w = { type, lvl, a: this.rng.range(0, 6.28), dir: this.rng.sign(), cd: this.rng.range(0.4, 1), t: 0, aim: 0 };
    }

    // Level-dependent sizes. Every hit adds a level, capped so nothing gets silly.
    geo(s) {
      const w = s.w;
      const L = Math.min(w.lvl, 22) - 1;
      const r0 = s.size * 0.55;
      switch (w.type) {
        case 'sword':
          return { r0, len: Math.min(300, 64 + L * 14) };
        case 'axe':
          return { r0, len: Math.min(190, 42 + L * 8) };
        case 'hammer':
          return { r0, len: Math.min(190, 62 + L * 6), hr: Math.min(62, 18 + L * 4) };
        case 'spear': {
          const base = Math.min(330, 100 + L * 11);
          return { r0, len: base * (0.62 + 0.38 * Math.sin(w.t * 7)) };
        }
        case 'dagger':
          return { r0, n: Math.min(9, 2 + L), R: s.size * 0.5 + 38 + Math.min(40, L * 3) };
        case 'flail':
          return { r0, len: Math.min(230, 78 + L * 8), br: Math.min(46, 15 + L * 3) };
        default:
          return { r0 };
      }
    }

    // Points (with a radius) that hurt whatever they touch.
    hitPts(s) {
      const w = s.w;
      if (!w || WEAPONS[w.type].ranged) return [];
      const G = this.geo(s);
      const pts = [];
      const along = (a, from, to, r, n) => {
        for (let k = 0; k <= n; k++) {
          const d = from + ((to - from) * k) / n;
          pts.push({ x: s.x + Math.cos(a) * d, y: s.y + Math.sin(a) * d, r });
        }
      };
      if (w.type === 'sword') along(w.a, G.r0 + 10, G.r0 + G.len, 5, 10);
      else if (w.type === 'axe') for (const off of [0, Math.PI]) along(w.a + off, G.r0 + G.len * 0.75, G.r0 + G.len + 12, 14, 2);
      else if (w.type === 'hammer') pts.push({ x: s.x + Math.cos(w.a) * (G.r0 + G.len), y: s.y + Math.sin(w.a) * (G.r0 + G.len), r: G.hr });
      else if (w.type === 'spear') along(w.a, G.r0 + G.len * 0.5, G.r0 + G.len + 28, 5, 6);
      else if (w.type === 'dagger')
        for (let i = 0; i < G.n; i++) {
          const a = w.a + (i / G.n) * Math.PI * 2;
          pts.push({ x: s.x + Math.cos(a) * G.R, y: s.y + Math.sin(a) * G.R, r: 11 });
        }
      else if (w.type === 'flail') pts.push({ x: s.x + Math.cos(w.a) * (G.r0 + G.len), y: s.y + Math.sin(w.a) * (G.r0 + G.len), r: G.br });
      return pts;
    }

    nearestEnemy(s) {
      let best = null;
      let bd = 1e12;
      for (const o of this.sq) {
        if (o === s || !o.alive) continue;
        const d = SQ.dist2(o.x, o.y, s.x, s.y);
        if (d < bd) (bd = d), (best = o);
      }
      return best;
    }

    update(dt) {
      const g = this.g;
      const rng = this.rng;
      this.time += dt;
      if (this.time > 45) this.storm = Math.min(300, this.storm + dt * 7);
      const lo = this.storm;
      const hi = 1000 - this.storm;
      const alive = this.sq.filter((s) => s.alive);

      // Bounce Brawl stays pure: no power-ups
      if (this.variant !== 'grow') this.nextDrop -= dt;
      if (this.nextDrop <= 0 && this.drops.length < 3) {
        this.nextDrop = rng.range(3.5, 6.5);
        const list = this.variant === 'grow' ? DROPS.filter((d) => d.type !== 'weapon') : DROPS;
        const total = list.reduce((a, d) => a + d.w, 0);
        let r = rng() * total;
        const d = list.find((x) => (r -= x.w) <= 0) || list[0];
        const x = rng.range(lo + 80, hi - 80);
        const y = rng.range(lo + 80, hi - 80);
        const drop = { type: d.type, x, y, t: 0, life: 15 };
        if (d.type === 'weapon') drop.wtype = this.variant === 'same' ? this.sameWeapon : rng.pick(WEAPON_IDS);
        this.drops.push(drop);
        g.audio.itemSpawn();
        g.fx.ring(x, y, SQ.ITEMS[d.type].color, 45);
      }
      for (let i = this.drops.length - 1; i >= 0; i--) {
        this.drops[i].t += dt;
        if (this.drops[i].t > this.drops[i].life) this.drops.splice(i, 1);
      }

      for (const s of this.sq) {
        if (!s.alive) {
          s.dead += dt;
          continue;
        }
        s.flash = Math.max(0, s.flash - dt * 4);
        s.squash *= Math.exp(-dt * 10);
        s.boost -= dt;
        s.shieldT = (s.shieldT || 0) - dt;
        if (s.megaT > 0) {
          s.megaT -= dt;
          if (s.megaT <= 0) s.size = Math.max(30, s.size - 36);
        }
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
          if (this.variant === 'grow') s.size = Math.min(104, s.size + 2);
          // slight angle change keeps paths interesting
          const a = Math.atan2(s.vy, s.vx) + rng.range(-0.15, 0.15);
          s.vx = Math.cos(a) * sp;
          s.vy = Math.sin(a) * sp;
          if (this.storm > 0) this.damage(s, 2, null);
        }
        if (s.w) this.tickWeapon(s, dt);
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

      for (const s of alive) {
        const h = s.size / 2;
        s.x = SQ.clamp(s.x, lo + h, hi - h);
        s.y = SQ.clamp(s.y, lo + h, hi - h);
      }

      this.meleeHits(alive);
      this.updateProjectiles(dt, lo, hi);

      const living = this.sq.filter((s) => s.alive);
      if (!this.winner && living.length <= 1) {
        const w = living[0] || this.sq.slice().sort((a, b) => b.dead - a.dead)[0];
        this.winner = { team: this.teams[w.team], text: `${this.teams[w.team].name.toUpperCase()} WINS!`, sub: `${w.kills} knockout${w.kills === 1 ? '' : 's'}${w.w ? ` · ${WEAPONS[w.w.type].name} LV ${w.w.lvl}` : ''}` };
        this.winnerEnt = w;
      }
      if (!this.winner && living.length === 2 && !this.finalTold) {
        this.finalTold = true;
        g.fx.banner('FINAL TWO', `${this.teams[living[0].team].name} vs ${this.teams[living[1].team].name}`, '#ffd23f', 1.6);
        g.audio.crowd(1.8);
      }
    }

    tickWeapon(s, dt) {
      const w = s.w;
      const def = WEAPONS[w.type];
      w.t += dt;
      if (!def.ranged) {
        w.a += def.spin * w.dir * dt;
        return;
      }
      const tgt = this.nearestEnemy(s);
      if (tgt) w.aim = Math.atan2(tgt.y - s.y, tgt.x - s.x);
      w.cd -= dt;
      if (w.cd > 0 || !tgt) return;
      const L = Math.min(w.lvl, 22) - 1;
      if (w.type === 'bow') {
        w.cd = Math.max(0.45, 1.4 - L * 0.08);
        const shots = L >= 12 ? 3 : L >= 6 ? 2 : 1;
        for (let k = 0; k < shots; k++) {
          const a = w.aim + (k - (shots - 1) / 2) * 0.16;
          this.proj.push({ type: 'arrow', owner: s, x: s.x + Math.cos(a) * s.size * 0.7, y: s.y + Math.sin(a) * s.size * 0.7, vx: Math.cos(a) * 780, vy: Math.sin(a) * 780, a, life: 0.8, hit: {} });
        }
        this.g.audio.slash();
      } else if (w.type === 'boomerang') {
        if (this.proj.some((p) => p.owner === s && p.type === 'boomerang')) return;
        w.cd = Math.max(0.4, 1.6 - L * 0.1);
        const sp = 620 + L * 20;
        this.proj.push({ type: 'boomerang', owner: s, x: s.x, y: s.y, vx: Math.cos(w.aim) * sp, vy: Math.sin(w.aim) * sp, sp, a: 0, out: 0, max: 360 + L * 18, back: false, life: 5, hit: {}, size: Math.min(80, 30 + L * 4) });
        this.g.audio.whoosh();
      }
    }

    meleeHits(alive) {
      const g = this.g;
      const cache = new Map();
      const ptsOf = (s) => {
        if (!cache.has(s)) cache.set(s, this.hitPts(s));
        return cache.get(s);
      };
      for (const s of alive) {
        if (!s.alive || !s.w) continue;
        const P = ptsOf(s);
        if (!P.length) continue;
        for (const o of alive) {
          if (o === s || !o.alive) continue;
          // weapon against weapon: clank and both spin the other way
          if (s.team < o.team && !((s.hitCool['c' + o.team] || 0) > 0)) {
            const Q = ptsOf(o);
            let clash = null;
            for (const p of P) {
              for (const q of Q) {
                const rr = p.r + q.r;
                if (SQ.dist2(p.x, p.y, q.x, q.y) < rr * rr) {
                  clash = [(p.x + q.x) / 2, (p.y + q.y) / 2];
                  break;
                }
              }
              if (clash) break;
            }
            if (clash) {
              s.hitCool['c' + o.team] = 0.3;
              s.w.dir *= -1;
              o.w.dir *= -1;
              g.audio.clank();
              g.fx.sparks(clash[0], clash[1], 18, '#fff6b0');
              g.cam.shake(4);
            }
          }
          if ((s.hitCool[o.team] || 0) > 0) continue;
          const h = o.size / 2;
          const hit = P.some((p) => Math.abs(p.x - o.x) < h + p.r && Math.abs(p.y - o.y) < h + p.r);
          if (!hit) continue;
          s.hitCool[o.team] = 0.4;
          this.landHit(s, o, WEAPONS[s.w.type].dmg + Math.min(s.w.lvl, 22) * 0.6);
        }
      }
    }

    landHit(s, o, dmg) {
      const g = this.g;
      const heavy = s.w && s.w.type === 'hammer';
      g.audio.slash();
      g.audio.hit(heavy);
      g.hitstop(heavy ? 0.07 : 0.045);
      g.fx.sparks(o.x, o.y, heavy ? 20 : 12, '#ffffff');
      if (heavy) g.cam.shake(8);
      const kx = o.x - s.x;
      const ky = o.y - s.y;
      const kl = Math.hypot(kx, ky) || 1;
      o.vx = (kx / kl) * o.speed;
      o.vy = (ky / kl) * o.speed;
      this.damage(o, dmg, s);
      if (s.w) {
        s.w.lvl++;
        if (s.w.lvl % 5 === 0) this.g.fx.text(s.x, s.y - s.size, `${WEAPONS[s.w.type].name.toUpperCase()} LV ${s.w.lvl}`, '#dfe6ff', 32);
      }
    }

    updateProjectiles(dt, lo, hi) {
      const g = this.g;
      for (let i = this.proj.length - 1; i >= 0; i--) {
        const p = this.proj[i];
        p.life -= dt;
        const own = p.owner;
        if (p.type === 'boomerang') {
          p.a += dt * 16;
          if (!p.back) {
            p.out += p.sp * dt;
            if (p.out >= p.max || p.x < lo || p.x > hi || p.y < lo || p.y > hi) p.back = true;
          } else {
            // curve back to the thrower
            const dx = own.x - p.x;
            const dy = own.y - p.y;
            const d = Math.hypot(dx, dy) || 1;
            p.vx += ((dx / d) * p.sp - p.vx) * Math.min(1, dt * 5);
            p.vy += ((dy / d) * p.sp - p.vy) * Math.min(1, dt * 5);
            if (d < own.size * 0.6 || !own.alive) {
              this.proj.splice(i, 1);
              continue;
            }
          }
        } else if (p.x < lo || p.x > hi || p.y < lo || p.y > hi) {
          g.fx.sparks(p.x, p.y, 4, '#d9c6a0');
          this.proj.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.life <= 0) {
          this.proj.splice(i, 1);
          continue;
        }
        let dead = false;
        for (const o of this.sq) {
          if (!o.alive || o === own || p.hit[o.team]) continue;
          // melee weapons can swat arrows out of the air
          if (p.type === 'arrow' && o.w && this.hitPts(o).some((q) => SQ.dist2(q.x, q.y, p.x, p.y) < (q.r + 6) * (q.r + 6))) {
            g.fx.sparks(p.x, p.y, 10, '#fff6b0');
            g.fx.text(p.x, p.y - 30, 'PARRY', '#dfe6ff', 28);
            g.audio.clank();
            dead = true;
            break;
          }
          const r = p.type === 'boomerang' ? p.size * 0.4 : 6;
          const h = o.size / 2 + r;
          if (Math.abs(p.x - o.x) < h && Math.abs(p.y - o.y) < h) {
            p.hit[o.team] = true;
            this.landHit(own, o, WEAPONS[p.type === 'arrow' ? 'bow' : 'boomerang'].dmg + Math.min(own.w ? own.w.lvl : 1, 22) * 0.4);
            if (p.type === 'arrow') {
              dead = true;
              break;
            }
          }
        }
        if (dead) this.proj.splice(i, 1);
      }
    }

    damage(v, amt, by) {
      if (!v.alive || amt <= 0) return;
      const g = this.g;
      if (v.shieldT > 0) {
        if (amt >= 8) g.fx.text(v.x, v.y - v.size * 0.7, 'BLOCKED', '#bfe9ff', 30);
        return;
      }
      if (by && by.megaT > 0) amt *= 1.5;
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
        // the fallen square's weapon drops for someone else to grab
        if (v.w) this.drops.push({ type: 'weapon', wtype: v.w.type, x: v.x, y: v.y, t: 0, life: 15 });
      }
    }

    collect(s, d) {
      const g = this.g;
      g.audio.pickup();
      g.fx.ring(d.x, d.y, SQ.ITEMS[d.type].color, 60);
      g.fx.burst(d.x, d.y, SQ.ITEMS[d.type].color, 12, 240, 9);
      if (d.type === 'weapon') {
        const W = WEAPONS[d.wtype];
        if (s.w && s.w.type === d.wtype) {
          s.w.lvl += 3;
          g.fx.text(s.x, s.y - 60, `${W.name.toUpperCase()} +3 LV`, '#dfe6ff', 38);
        } else {
          const keep = s.w ? Math.max(1, Math.floor(s.w.lvl / 2)) : 1;
          this.giveWeapon(s, d.wtype, keep);
          g.fx.text(s.x, s.y - 60, `${W.name.toUpperCase()}!`, '#dfe6ff', 40);
        }
      } else if (d.type === 'shield') {
        s.shieldT = 4;
        g.fx.text(s.x, s.y - 50, 'SHIELD!', '#5cc8ff', 38);
      } else if (d.type === 'mega') {
        if (!(s.megaT > 0)) s.size += 36;
        s.megaT = 6;
        g.fx.text(s.x, s.y - 60, 'MEGA!', '#ff6ac1', 40);
      } else if (d.type === 'bomb') {
        g.audio.explode();
        g.cam.shake(12);
        g.hitstop(0.06);
        g.fx.ring(d.x, d.y, '#ff4d5e', 220);
        g.fx.text(d.x, d.y - 60, 'BOOM!', '#ffffff', 56);
        for (const o of this.sq) if (o !== s && o.alive && SQ.dist2(o.x, o.y, d.x, d.y) < 230 * 230) this.damage(o, 22, s);
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
      for (const d of this.drops) SQ.drawItem(ctx, d.x, d.y, d.type, d.t, 54, d.life - d.t, d.wtype ? WEAPONS[d.wtype].icon : null);
      for (const s of this.sq) {
        const t = this.teams[s.team];
        if (!s.alive) {
          if (s.dead < 0.6) SQ.drawSquare(ctx, s.x, s.y, s.size * (1 - s.dead / 0.6), t, { mood: 'dead', alpha: 1 - s.dead / 0.6 });
          continue;
        }
        if (s.w) this.drawWeapon(ctx, s);
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
          mood: s.hp < 30 ? 'scared' : s.w ? 'angry' : 'normal',
          glow: s.boost > 0 || s.megaT > 0 ? 18 : 0,
          glowColor: s.megaT > 0 ? '#ff6ac1' : null,
          shield: s.shieldT,
        });
        // hp pip over the head
        const w = s.size;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(s.x - w / 2, s.y - s.size / 2 - 16, w, 8);
        ctx.fillStyle = s.hp > 50 ? '#7dffa8' : s.hp > 25 ? '#ffd23f' : '#ff5c5c';
        ctx.fillRect(s.x - w / 2, s.y - s.size / 2 - 16, (w * s.hp) / 100, 8);
      }
      for (const p of this.proj) {
        ctx.save();
        ctx.translate(p.x, p.y);
        if (p.type === 'arrow') {
          ctx.rotate(p.a);
          drawArrow(ctx);
        } else {
          ctx.rotate(p.a);
          drawBoomerang(ctx, p.size);
        }
        ctx.restore();
      }
    }

    drawWeapon(ctx, s) {
      const w = s.w;
      const G = this.geo(s);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.lineJoin = 'round';
      if (w.type === 'sword') {
        ctx.rotate(w.a);
        motionArc(ctx, G.r0 + G.len / 2, G.len, w.dir);
        const bw = 10 + G.len * 0.03;
        ctx.fillStyle = '#dfe6ff';
        ctx.strokeStyle = '#3a3f5a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(G.r0 + 14, -bw / 2);
        ctx.lineTo(G.r0 + G.len - bw, -bw / 2);
        ctx.lineTo(G.r0 + G.len, 0);
        ctx.lineTo(G.r0 + G.len - bw, bw / 2);
        ctx.lineTo(G.r0 + 14, bw / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#c9a227';
        ctx.fillRect(G.r0 + 8, -bw, 8, bw * 2);
        ctx.fillStyle = '#5b3a1e';
        ctx.fillRect(G.r0 - 6, -4, 14, 8);
      } else if (w.type === 'axe') {
        for (const off of [0, Math.PI]) {
          ctx.save();
          ctx.rotate(w.a + off);
          const e = G.r0 + G.len;
          ctx.fillStyle = '#7a4b26';
          ctx.fillRect(G.r0 - 4, -4, G.len + 8, 8);
          ctx.fillStyle = '#cfd6e4';
          ctx.strokeStyle = '#3a3f5a';
          ctx.lineWidth = 3;
          const hs = 16 + G.len * 0.08;
          ctx.beginPath();
          ctx.moveTo(e - hs * 0.5, -5);
          ctx.lineTo(e + hs * 0.2, -hs * 1.3);
          ctx.quadraticCurveTo(e + hs * 1.3, 0, e + hs * 0.2, hs * 1.3);
          ctx.lineTo(e - hs * 0.5, 5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      } else if (w.type === 'hammer') {
        ctx.rotate(w.a);
        const e = G.r0 + G.len;
        ctx.fillStyle = '#7a4b26';
        ctx.fillRect(G.r0 - 4, -5, G.len, 10);
        ctx.fillStyle = '#6f7788';
        ctx.strokeStyle = '#2b2f3a';
        ctx.lineWidth = 4;
        SQ.roundRect(ctx, e - G.hr * 0.6, -G.hr * 1.1, G.hr * 1.2, G.hr * 2.2, G.hr * 0.25);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(e - G.hr * 0.45, -G.hr * 0.95, G.hr * 0.3, G.hr * 1.9);
      } else if (w.type === 'spear') {
        ctx.rotate(w.a);
        const e = G.r0 + G.len;
        ctx.fillStyle = '#8a5a2b';
        ctx.fillRect(G.r0 - 10, -3.5, G.len + 10, 7);
        ctx.fillStyle = '#dfe6ff';
        ctx.strokeStyle = '#3a3f5a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(e, -11);
        ctx.lineTo(e + 32, 0);
        ctx.lineTo(e, 11);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (w.type === 'dagger') {
        for (let i = 0; i < G.n; i++) {
          const a = w.a + (i / G.n) * Math.PI * 2;
          ctx.save();
          ctx.rotate(a);
          ctx.translate(G.R, 0);
          ctx.rotate((Math.PI / 2) * w.dir);
          ctx.fillStyle = '#dfe6ff';
          ctx.strokeStyle = '#3a3f5a';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(-6, -4);
          ctx.lineTo(18, 0);
          ctx.lineTo(-6, 4);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#5b3a1e';
          ctx.fillRect(-14, -3, 9, 6);
          ctx.restore();
        }
      } else if (w.type === 'flail') {
        ctx.rotate(w.a);
        const e = G.r0 + G.len;
        ctx.strokeStyle = '#9aa3b5';
        ctx.lineWidth = 4;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.moveTo(G.r0, 0);
        ctx.lineTo(e, 0);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#c9ced8';
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(e + Math.cos(a - 0.3) * G.br, Math.sin(a - 0.3) * G.br);
          ctx.lineTo(e + Math.cos(a) * G.br * 1.45, Math.sin(a) * G.br * 1.45);
          ctx.lineTo(e + Math.cos(a + 0.3) * G.br, Math.sin(a + 0.3) * G.br);
          ctx.fill();
        }
        ctx.fillStyle = '#4a5063';
        ctx.strokeStyle = '#1e2129';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e, 0, G.br, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (w.type === 'bow') {
        ctx.rotate(w.aim);
        const bx = s.size * 0.55 + 10;
        const R = 30;
        ctx.strokeStyle = '#8a5a2b';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(bx - R * 0.6, 0, R, -1.1, 1.1);
        ctx.stroke();
        const ex = bx - R * 0.6 + Math.cos(1.1) * R;
        const ey = Math.sin(1.1) * R;
        const pull = Math.max(0, 1 - w.cd / 0.5) * 12;
        ctx.strokeStyle = '#efe6d2';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ex, -ey);
        ctx.lineTo(ex - pull, 0);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        if (w.cd < 0.5) {
          ctx.save();
          ctx.translate(ex - pull + 14, 0);
          drawArrow(ctx);
          ctx.restore();
        }
      } else if (w.type === 'boomerang') {
        if (!this.proj.some((p) => p.owner === s && p.type === 'boomerang')) {
          ctx.rotate(w.aim);
          ctx.translate(s.size * 0.55 + 18, 0);
          ctx.rotate(Math.sin(w.t * 6) * 0.3);
          drawBoomerang(ctx, Math.min(80, 30 + (Math.min(w.lvl, 22) - 1) * 4));
        }
      }
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
        const barX = cx + 48;
        const barW = colW - 48 - (s.w ? 96 : 0);
        ctx.globalAlpha = s.alive ? 1 : 0.35;
        ctx.fillStyle = t.color;
        SQ.roundRect(ctx, cx, cy, 34, 34, 7);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(barX, cy + 8, barW, 18);
        ctx.fillStyle = t.color;
        ctx.fillRect(barX, cy + 8, (barW * s.hp) / 100, 18);
        if (s.w) {
          SQ.drawEmoji(ctx, WEAPONS[s.w.type].icon, barX + barW + 26, cy + 17, 28);
          SQ.outlinedText(ctx, String(s.w.lvl), barX + barW + 70, cy + 18, 26, '#ffffff', { stroke: 6 });
        }
        ctx.globalAlpha = 1;
        if (!s.alive) SQ.drawEmoji(ctx, '💀', cx + 17, cy + 17, 30);
      });
    }
  }

  function motionArc(ctx, r, width, dir) {
    ctx.strokeStyle = 'rgba(223,230,255,0.15)';
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(0, 0, r, -0.5 * dir, 0, dir < 0);
    ctx.stroke();
  }

  function drawArrow(ctx) {
    ctx.strokeStyle = '#8a5a2b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(10, 0);
    ctx.stroke();
    ctx.fillStyle = '#dfe6ff';
    ctx.beginPath();
    ctx.moveTo(8, -7);
    ctx.lineTo(22, 0);
    ctx.lineTo(8, 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(-30, -7);
    ctx.lineTo(-16, 0);
    ctx.lineTo(-30, 7);
    ctx.closePath();
    ctx.fill();
  }

  function drawBoomerang(ctx, size) {
    const k = size / 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#7a4a12';
    ctx.lineWidth = k * 0.5;
    ctx.beginPath();
    ctx.moveTo(-k, k * 0.55);
    ctx.lineTo(0, -k * 0.35);
    ctx.lineTo(k, k * 0.55);
    ctx.stroke();
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = k * 0.32;
    ctx.stroke();
  }

  SQ.modes.brawl = { id: 'brawl', name: 'Weapon Brawl', create: (g, rng) => new Brawl(g, rng) };
  SQ.modes.bounce = { id: 'bounce', name: 'Bounce Brawl', create: (g, rng) => new Brawl(g, rng, 'grow') };
})();
