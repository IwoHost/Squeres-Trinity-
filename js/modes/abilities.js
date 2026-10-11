// Ability War: every square has its own health and speed (like classes), and rolls one of four
// abilities that fit who it is and where it comes from. 8 squares x 4 abilities, so the matchups
// rarely repeat. Squares hurt each other on contact; abilities do the rest.
(function () {
  const SQ = window.SQ;

  // health and speed per square, and its four abilities
  SQ.CLASSES = {
    Red: { hp: 160, speed: 1.0, abilities: ['forgeslam', 'hothead', 'moltentrail', 'volunteer'] },
    Green: { hp: 150, speed: 0.95, abilities: ['seedbomb', 'photosynthesis', 'vinesnare', 'friends'] },
    Blue: { hp: 125, speed: 1.0, abilities: ['predicted', 'databolt', 'rewind', 'firewall'] },
    Yellow: { hp: 140, speed: 1.35, abilities: ['chainlightning', 'overcharge', 'staticfield', 'energydrink'] },
    Purple: { hp: 175, speed: 0.85, abilities: ['royalguard', 'decree', 'crownshield', 'tax'] },
    Cyan: { hp: 140, speed: 1.2, abilities: ['flashfreeze', 'runaway', 'frostarmor', 'coldsnap'] },
    Orange: { hp: 165, speed: 1.05, abilities: ['pietoss', 'trickbox', 'bouncehouse', 'lastlaugh'] },
    Pink: { hp: 150, speed: 1.0, abilities: ['sugarrush', 'sweettalk', 'gumdrop', 'candymines'] },
  };
  // cd: seconds between uses for active abilities (none = always on or triggered)
  SQ.ABILITIES = {
    forgeslam: { name: 'Forge Slam', desc: 'slams the ground, hurting everyone close', cd: 6 },
    hothead: { name: 'Hothead', desc: 'double damage for 5 s, but takes a bit more too', cd: 8 },
    moltentrail: { name: 'Molten Trail', desc: 'leaves burning metal behind' },
    volunteer: { name: 'Volunteer', desc: 'once, when nearly out: heals and shields up' },
    seedbomb: { name: 'Seed Bomb', desc: 'plants thorn bushes that hurt to touch', cd: 5 },
    photosynthesis: { name: 'Photosynthesis', desc: 'slowly heals all the time' },
    vinesnare: { name: 'Vine Snare', desc: 'roots the nearest enemy in place', cd: 5 },
    friends: { name: 'Friends With Everyone', desc: 'takes less damage from everyone' },
    predicted: { name: 'Predicted', desc: 'dodges a third of all hits' },
    databolt: { name: 'Data Bolt', desc: 'shoots bolts at the nearest enemy', cd: 2.2 },
    rewind: { name: 'Rewind', desc: 'once, instead of dying, rewinds 3 seconds' },
    firewall: { name: 'Firewall', desc: 'a shield that blocks everything for 3 s', cd: 8 },
    chainlightning: { name: 'Chain Lightning', desc: 'lightning that jumps between enemies', cd: 4.5 },
    overcharge: { name: 'Overcharge', desc: 'bursts of extra speed and power', cd: 5 },
    staticfield: { name: 'Static Field', desc: 'whoever touches it is stunned' },
    energydrink: { name: 'Energy Drink', desc: 'heals and speeds up (banned in cycle 12)', cd: 6 },
    royalguard: { name: 'Royal Guard', desc: 'two guards circle it and block attacks', cd: 12 },
    decree: { name: 'Royal Decree', desc: 'every enemy slows down by order of the crown', cd: 9 },
    crownshield: { name: 'Crown Shield', desc: 'takes 20% less damage' },
    tax: { name: 'Tax', desc: 'heals for a third of the damage it deals' },
    flashfreeze: { name: 'Flash Freeze', desc: 'freezes the nearest enemy solid', cd: 5 },
    runaway: { name: 'Run Away', desc: 'when hit, blinks away and leaves frostbite' },
    frostarmor: { name: 'Frost Armor', desc: 'blocks one hit every few seconds' },
    coldsnap: { name: 'Cold Snap', desc: 'a freezing pulse that hurts and slows', cd: 4 },
    pietoss: { name: 'Pie Toss', desc: 'pies to the face: enemies cannot see where to go', cd: 3.5 },
    trickbox: { name: 'Trick Box', desc: 'drops fake squares that explode', cd: 7 },
    bouncehouse: { name: 'Bounce House', desc: 'every wall bounce makes the next hit stronger' },
    lastlaugh: { name: 'Last Laugh', desc: 'laughs off some hits, and explodes when knocked out' },
    sugarrush: { name: 'Sugar Rush', desc: 'every hit makes it faster and stronger' },
    sweettalk: { name: 'Sweet Talk', desc: 'charms an enemy so it cannot hurt anyone', cd: 7 },
    gumdrop: { name: 'Gumdrop Shield', desc: 'a sticky shield that soaks up damage', cd: 10 },
    candymines: { name: 'Candy Mines', desc: 'drops candy that explodes when touched', cd: 5 },
  };
  for (const id in SQ.ABILITIES) SQ.ABILITIES[id].id = id;

  const HIT = 14; // contact damage before modifiers

  class AbilityWar {
    constructor(g, rng, opts) {
      opts = opts || {};
      this.g = g;
      this.rng = rng;
      this.blood = new SQ.Blood(200);
      this.teams = opts.teams || SQ.pickTeams(rng, rng.pick([2, 2, 3, 3, 4]));
      this.time = 0;
      this.duration = opts.quick ? 50 : 75;
      this.winner = null;
      this.hazards = [];
      this.shots = [];
      this.zaps = [];
      this.cool = {};
      const spots = rng.shuffle([[250, 250], [750, 750], [750, 250], [250, 750]]);
      this.sq = this.teams.map((t, ti) => {
        const C = SQ.CLASSES[t.base] || { hp: 150, speed: 1, abilities: ['tax'] };
        const ab = SQ.ABILITIES[rng.pick(C.abilities)];
        const a = rng.range(0, 6.28);
        return {
          team: ti, x: spots[ti][0], y: spots[ti][1], vx: Math.cos(a) * 300, vy: Math.sin(a) * 300,
          size: 100, hp: C.hp, maxHp: C.hp, speed: C.speed, ab, cd: rng.range(1.5, 3), alive: true,
          st: { rage: 0, slow: 0, stun: 0, shield: 0, charm: 0, blind: 0, boost: 0 },
          flash: 0, squash: 0, turnT: rng.range(1, 2), hits: 0, used: {}, hist: [], guards: [], pool: 0, stacks: 0, frostT: 0, blinkT: 0, trailT: 0,
        };
      });
      this.title = 'ABILITY WAR';
      this.rules = this.sq.map((s) => [
        { t: `${this.teams[s.team].name}: `, c: this.teams[s.team].color },
        { t: s.ab.name, c: '#ffffff' },
      ]);
      // Royal Guard starts with its guards
      for (const s of this.sq) if (s.ab.id === 'royalguard') this.spawnGuards(s);
    }

    // ---------------- helpers ----------------
    team(s) {
      return this.teams[s.team];
    }
    living() {
      return this.sq.filter((s) => s.alive);
    }
    enemies(s) {
      return this.sq.filter((o) => o.alive && o !== s);
    }
    nearest(s) {
      let best = null;
      let bd = Infinity;
      for (const o of this.enemies(s)) {
        const d = SQ.dist2(o.x, o.y, s.x, s.y);
        if (d < bd) (bd = d), (best = o);
      }
      return best;
    }
    say(s, text) {
      this.g.fx.text(s.x, s.y - s.size * 0.85, text, this.team(s).light, 38);
    }
    heal(s, n) {
      if (!s.alive) return;
      s.hp = Math.min(s.maxHp, s.hp + n);
    }
    spawnGuards(s) {
      s.guards = [0, Math.PI].map((a) => ({ a, alive: true }));
    }
    guardPos(s, gd) {
      const a = gd.a + this.time * 2.6;
      return { x: s.x + Math.cos(a) * 92, y: s.y + Math.sin(a) * 92 };
    }

    // All damage goes through here, so every ability that changes damage works with every other.
    damage(v, amount, src, how) {
      const g = this.g;
      if (!v.alive || amount <= 0) return 0;
      if (src && src.st && src.st.charm > 0 && how === 'hit') return 0;
      if (v.st.shield > 0) {
        g.fx.text(v.x, v.y - 70, 'BLOCKED', '#dfe6ff', 34);
        g.audio.clank();
        return 0;
      }
      if (v.ab.id === 'lastlaugh' && this.rng.chance(0.25)) {
        g.fx.text(v.x, v.y - 70, 'HA HA', '#ffb35c', 34);
        return 0;
      }
      if (v.ab.id === 'predicted' && this.rng.chance(0.33)) {
        g.fx.text(v.x, v.y - 70, 'PREDICTED', '#8fb4ff', 34);
        return 0;
      }
      if (v.ab.id === 'frostarmor' && v.frostT <= 0) {
        v.frostT = 3.5;
        g.fx.text(v.x, v.y - 70, 'FROST ARMOR', '#bdf3ff', 34);
        g.fx.burst(v.x, v.y, '#bdf3ff', 14, 260, 8);
        return 0;
      }
      let d = amount;
      if (src && src.st) {
        if (src.st.rage > 0) d *= 2;
        if (src.st.boost > 0 && src.ab.id === 'overcharge') d *= 2;
      }
      if (v.ab.id === 'hothead' && v.st.rage > 0) d *= 1.1;
      if (v.ab.id === 'friends') d *= 0.72;
      if (v.ab.id === 'crownshield') d *= 0.8;
      if (v.pool > 0) {
        const soak = Math.min(v.pool, d);
        v.pool -= soak;
        d -= soak;
        if (soak > 0) g.fx.text(v.x, v.y - 70, `-${Math.round(soak)} GUMDROP`, '#ff9ac9', 30);
      }
      d = Math.round(d);
      if (d <= 0) return 0;
      // Rewind: instead of dying, go back to how it was 3 seconds ago
      if (v.hp - d <= 0 && v.ab.id === 'rewind' && !v.used.rewind) {
        v.used.rewind = true;
        const past = v.hist.length ? v.hist[0] : { hp: v.maxHp * 0.4, x: v.x, y: v.y };
        v.hp = Math.max(Math.round(v.maxHp * 0.35), past.hp);
        v.x = past.x;
        v.y = past.y;
        g.fx.banner('REWIND', `${this.team(v).name} was not done yet`, this.team(v).color, 1.4);
        g.fx.ring(v.x, v.y, '#8fb4ff', 140);
        g.audio.whoosh();
        return 0;
      }
      v.hp = Math.max(0, v.hp - d);
      v.flash = 1;
      g.fx.text(v.x, v.y - 70, `-${d}`, '#ffffff', d >= 25 ? 50 : 40);
      if (SQ.blood && d >= 8) this.blood.spray(v.x, v.y, src ? v.x - src.x : 1, src ? v.y - src.y : 0, d * 0.6);
      if (src && src.ab && src.ab.id === 'tax' && src.alive) this.heal(src, Math.round(d * 0.3));
      if (src && src.ab && src.ab.id === 'sugarrush' && how === 'hit') {
        src.stacks = Math.min(5, src.stacks + 1);
        src.st.boost = Math.max(src.st.boost, 1.5);
      }
      // Volunteer: once, when nearly out
      if (v.ab.id === 'volunteer' && !v.used.volunteer && v.hp > 0 && v.hp < v.maxHp * 0.3) {
        v.used.volunteer = true;
        this.heal(v, 45);
        v.st.shield = 2;
        g.fx.banner('VOLUNTEERED', `${this.team(v).name} takes their place again`, this.team(v).color, 1.4);
      }
      // Run Away: blink to the far side
      if (v.ab.id === 'runaway' && v.hp > 0 && v.blinkT <= 0) {
        v.blinkT = 2.5;
        if (src && src.alive && src.st) {
          src.st.slow = 2; // frostbite on whoever hit it
          this.damage(src, 14, v, 'zap');
        }
        g.fx.burst(v.x, v.y, '#bdf3ff', 12, 240, 8);
        v.x = SQ.clamp(1000 - v.x + this.rng.range(-80, 80), 70, 930);
        v.y = SQ.clamp(1000 - v.y + this.rng.range(-80, 80), 70, 930);
        v.st.boost = 1.5;
        this.say(v, 'NOPE');
        g.audio.whoosh();
      }
      if (v.hp <= 0) this.knockout(v, src);
      return d;
    }

    knockout(v, src) {
      const g = this.g;
      v.alive = false;
      g.hitstop(0.14);
      g.audio.explode();
      g.cam.shake(14);
      g.fx.burst(v.x, v.y, this.team(v).color, 60, 520, 18);
      if (SQ.blood) {
        g.fx.burst(v.x, v.y, '#b3121f', 40, 560, 12);
        this.blood.splash(v.x, v.y, v.size * 0.8);
      }
      g.fx.flash(0.5, this.team(v).light);
      g.fx.voice(v, 'lose', true);
      g.highlight(v.x, v.y, 2, 1.4, 0.25);
      if (v.ab.id === 'lastlaugh') {
        g.fx.banner('LAST LAUGH', 'HONK', this.team(v).color, 1.2);
        g.fx.ring(v.x, v.y, '#ff8f33', 300);
        g.audio.boom();
        for (const o of this.enemies(v)) if (SQ.dist2(o.x, o.y, v.x, v.y) < 300 * 300) this.damage(o, 60, v, 'blast');
      }
    }

    // ---------------- abilities ----------------
    useAbility(s) {
      const g = this.g;
      const id = s.ab.id;
      const col = this.team(s).color;
      const near = this.nearest(s);
      const label = () => this.say(s, s.ab.name.toUpperCase());
      if (id === 'forgeslam') {
        label();
        g.fx.ring(s.x, s.y, '#ff8f33', 220);
        g.fx.burst(s.x, s.y, '#ffb35c', 26, 420, 10);
        g.cam.shake(12);
        g.audio.boom();
        for (const o of this.enemies(s)) {
          if (SQ.dist2(o.x, o.y, s.x, s.y) > 230 * 230) continue;
          this.damage(o, 30, s, 'blast');
          const a = Math.atan2(o.y - s.y, o.x - s.x);
          o.vx = Math.cos(a) * 600;
          o.vy = Math.sin(a) * 600;
        }
      } else if (id === 'hothead') {
        label();
        s.st.rage = 5;
        g.audio.hit(true);
      } else if (id === 'seedbomb') {
        label();
        for (let i = 0; i < 3; i++) {
          const a = this.rng.range(0, 6.28);
          this.hazards.push({ kind: 'thorns', owner: s, x: SQ.clamp(s.x + Math.cos(a) * 130, 50, 950), y: SQ.clamp(s.y + Math.sin(a) * 130, 50, 950), r: 42, life: 7, t: 0, hit: {} });
        }
        g.audio.pickup();
      } else if (id === 'vinesnare' && near) {
        label();
        near.st.stun = 2;
        this.damage(near, 18, s, 'zap');
        this.zaps.push({ pts: [[s.x, s.y], [near.x, near.y]], color: '#35d97a', t: 0.5, width: 10 });
        g.fx.text(near.x, near.y - 90, 'ROOTED', '#35d97a', 36);
      } else if (id === 'databolt' && near) {
        const a = Math.atan2(near.y - s.y, near.x - s.x);
        this.shots.push({ kind: 'bolt', owner: s, x: s.x, y: s.y, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, dmg: 22, life: 1.5, color: '#8fb4ff' });
        g.audio.pluck(9);
      } else if (id === 'firewall') {
        label();
        s.st.shield = 3;
        g.audio.ding();
      } else if (id === 'chainlightning' && near) {
        label();
        const hitList = [s];
        let from = s;
        for (let k = 0; k < 3; k++) {
          const next = this.enemies(s).filter((o) => !hitList.includes(o)).sort((p, q) => SQ.dist2(p.x, p.y, from.x, from.y) - SQ.dist2(q.x, q.y, from.x, from.y))[0];
          if (!next) break;
          this.zaps.push({ pts: this.bolt(from.x, from.y, next.x, next.y), color: '#ffe066', t: 0.35, width: 6 });
          this.damage(next, 18, s, 'zap');
          hitList.push(next);
          from = next;
        }
        g.audio.slash();
      } else if (id === 'overcharge') {
        label();
        s.st.boost = 3.5;
        g.fx.ring(s.x, s.y, '#ffd23f', 120);
      } else if (id === 'energydrink') {
        label();
        this.heal(s, 25);
        s.st.boost = 2;
        g.audio.pickup();
      } else if (id === 'royalguard') {
        if (s.guards.filter((gd) => gd.alive).length < 2) {
          label();
          this.spawnGuards(s);
        }
      } else if (id === 'decree') {
        g.fx.banner('ROYAL DECREE', 'everyone slows down, by order of the crown', col, 1.3);
        for (const o of this.enemies(s)) {
          o.st.slow = 4;
          this.damage(o, 10, s, 'blast');
        }
        g.audio.boom();
      } else if (id === 'flashfreeze' && near) {
        label();
        near.st.stun = 2.5;
        this.damage(near, 22, s, 'zap');
        g.fx.burst(near.x, near.y, '#bdf3ff', 20, 260, 9);
        g.audio.freeze();
      } else if (id === 'coldsnap') {
        label();
        g.fx.ring(s.x, s.y, '#bdf3ff', 320);
        g.audio.freeze();
        for (const o of this.enemies(s)) {
          if (SQ.dist2(o.x, o.y, s.x, s.y) > 320 * 320) continue;
          this.damage(o, 32, s, 'blast');
          o.st.slow = 2.5;
        }
      } else if (id === 'pietoss' && near) {
        const a = Math.atan2(near.y - s.y, near.x - s.x);
        this.shots.push({ kind: 'pie', owner: s, x: s.x, y: s.y, vx: Math.cos(a) * 650, vy: Math.sin(a) * 650, dmg: 10, life: 1.8, color: '#fff3d6' });
        g.audio.whoosh();
      } else if (id === 'trickbox') {
        label();
        for (let i = 0; i < 2; i++) {
          this.hazards.push({ kind: 'decoy', owner: s, x: SQ.clamp(s.x + this.rng.range(-160, 160), 60, 940), y: SQ.clamp(s.y + this.rng.range(-160, 160), 60, 940), r: 40, life: 10, t: 0 });
        }
      } else if (id === 'sweettalk' && near) {
        label();
        near.st.charm = 3;
        g.fx.text(near.x, near.y - 90, 'CHARMED', '#ff6ac1', 36);
      } else if (id === 'gumdrop') {
        label();
        s.pool = 30;
        g.audio.pickup();
      } else if (id === 'candymines') {
        for (let i = 0; i < 2; i++) this.hazards.push({ kind: 'mine', owner: s, x: SQ.clamp(s.x + this.rng.range(-90, 90), 50, 950), y: SQ.clamp(s.y + this.rng.range(-90, 90), 50, 950), r: 28, life: 12, t: 0 });
        g.audio.itemSpawn();
      }
    }

    // a jagged line between two points, for lightning
    bolt(x0, y0, x1, y1) {
      const pts = [[x0, y0]];
      for (let i = 1; i < 6; i++) {
        const k = i / 6;
        pts.push([x0 + (x1 - x0) * k + this.rng.range(-25, 25), y0 + (y1 - y0) * k + this.rng.range(-25, 25)]);
      }
      pts.push([x1, y1]);
      return pts;
    }

    // ---------------- the match ----------------
    update(dt) {
      const g = this.g;
      const rng = this.rng;
      this.time += dt;
      const alive = this.living();
      for (const s of alive) {
        s.flash = Math.max(0, s.flash - dt * 3);
        s.squash *= Math.exp(-dt * 9);
        for (const k in s.st) s.st[k] = Math.max(0, s.st[k] - dt);
        s.frostT -= dt;
        s.blinkT -= dt;
        // remember where it was, for Rewind
        s.hist.push({ hp: s.hp, x: s.x, y: s.y, t: this.time });
        while (s.hist.length && this.time - s.hist[0].t > 3) s.hist.shift();
        // abilities on a timer
        if (s.ab.cd) {
          s.cd -= dt;
          if (s.cd <= 0) {
            s.cd = s.ab.cd * rng.range(0.85, 1.15);
            this.useAbility(s);
          }
        }
        if (s.ab.id === 'photosynthesis') this.heal(s, 3 * dt);
        if (s.ab.id === 'moltentrail') {
          s.trailT -= dt;
          if (s.trailT <= 0) {
            s.trailT = 0.14;
            this.hazards.push({ kind: 'fire', owner: s, x: s.x, y: s.y, r: 30, life: 2.4, t: 0 });
          }
        }
        if (SQ.blood && s.hp < s.maxHp * 0.35 && Math.random() < dt * 4) this.blood.add(s.x + (Math.random() - 0.5) * 40, s.y + (Math.random() - 0.5) * 40, 3 + Math.random() * 5);
        // movement
        if (s.st.stun > 0) continue;
        let sp = (300 + Math.min(150, this.time * 2)) * s.speed;
        if (s.st.boost > 0) sp *= 1.6;
        if (s.st.slow > 0) sp *= 0.5;
        if (s.ab.id === 'sugarrush') sp *= 1 + s.stacks * 0.06;
        s.turnT -= dt;
        if (s.turnT <= 0) {
          s.turnT = rng.range(1.2, 2.6);
          const t = this.nearest(s);
          let a;
          if (s.st.blind > 0 || !t) a = rng.range(0, 6.28);
          else if (s.ab.id === 'runaway' && s.hp < s.maxHp * 0.4) a = Math.atan2(s.y - t.y, s.x - t.x) + rng.range(-0.6, 0.6);
          else a = Math.atan2(t.y - s.y, t.x - s.x) + rng.range(-0.35, 0.35);
          s.vx = Math.cos(a) * sp;
          s.vy = Math.sin(a) * sp;
        }
        const cur = Math.hypot(s.vx, s.vy) || 1;
        s.vx = (s.vx / cur) * sp;
        s.vy = (s.vy / cur) * sp;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        const h = s.size / 2;
        let wall = false;
        if (s.x < h) (s.x = h), (s.vx = Math.abs(s.vx)), (s.squash = 0.15), (wall = true);
        if (s.x > 1000 - h) (s.x = 1000 - h), (s.vx = -Math.abs(s.vx)), (s.squash = 0.15), (wall = true);
        if (s.y < h) (s.y = h), (s.vy = Math.abs(s.vy)), (s.squash = -0.15), (wall = true);
        if (s.y > 1000 - h) (s.y = 1000 - h), (s.vy = -Math.abs(s.vy)), (s.squash = -0.15), (wall = true);
        if (wall) {
          g.audio.melodyHit((s.x - 500) / 600, true);
          if (s.ab.id === 'bouncehouse') s.stacks = Math.min(6, s.stacks + 1);
        }
      }

      // squares hit each other on contact
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
          this.cool[key] = this.time + 0.4;
          this.clash(a, b);
        }

      this.updateGuards(alive);
      this.updateShots(dt);
      this.updateHazards(dt);
      for (const z of this.zaps) z.t -= dt;
      this.zaps = this.zaps.filter((z) => z.t > 0);
      for (const s of this.living()) {
        const h = s.size / 2;
        s.x = SQ.clamp(s.x, h, 1000 - h);
        s.y = SQ.clamp(s.y, h, 1000 - h);
      }

      const living = this.living();
      if (!this.winner && (living.length <= 1 || this.time >= this.duration)) {
        const pool = living.length ? living : this.sq;
        const score = (s) => (living.length ? s.hp / s.maxHp : 0);
        const top = Math.max(...pool.map(score));
        const tied = living.length === 1 ? [] : pool.filter((s) => score(s) === top);
        if (tied.length >= 2) {
          this.winner = SQ.tieResult(tied.map((s) => this.team(s)), living.length ? 'dead even when time ran out' : 'they took each other out');
          this.winnerEnt = null;
          return;
        }
        const w = living.length === 1 ? living[0] : pool.slice().sort((p, q) => score(q) - score(p))[0];
        this.winner = { team: this.team(w), text: `${this.team(w).name.toUpperCase()} WINS!`, sub: `with ${w.ab.name}` };
        this.winnerEnt = w;
      }
    }

    clash(a, b) {
      const g = this.g;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      g.fx.sparks(mx, my, 14);
      g.cam.shake(6);
      g.hitstop(0.05);
      g.audio.hit(true);
      const order = this.rng.chance(0.5) ? [[a, b], [b, a]] : [[b, a], [a, b]];
      for (const [v, atk] of order) {
        if (!atk.alive || !v.alive) continue;
        let dmg = HIT * (this.rng.chance(0.15) ? 2 : 1);
        if (atk.ab.id === 'bouncehouse' && atk.stacks) {
          dmg += atk.stacks * 8;
          atk.stacks = 0;
        }
        if (atk.ab.id === 'sugarrush') dmg += atk.stacks * 3;
        if (this.damage(v, dmg, atk, 'hit') > 0) atk.hits++;
        // Static Field stuns whoever touches it
        if (v.ab.id === 'staticfield' && v.alive && atk.alive) {
          atk.st.stun = 0.8;
          this.damage(atk, 14, v, 'zap');
          this.zaps.push({ pts: this.bolt(v.x, v.y, atk.x, atk.y), color: '#ffe066', t: 0.25, width: 5 });
        }
      }
    }

    updateGuards(alive) {
      for (const s of alive) {
        for (const gd of s.guards) {
          if (!gd.alive) continue;
          const p = this.guardPos(s, gd);
          for (const o of this.enemies(s)) {
            if (Math.abs(o.x - p.x) < o.size / 2 + 18 && Math.abs(o.y - p.y) < o.size / 2 + 18) {
              gd.alive = false;
              this.damage(o, 10, s, 'guard');
              this.g.fx.burst(p.x, p.y, '#c9b3ff', 14, 260, 8);
              break;
            }
          }
        }
      }
    }

    updateShots(dt) {
      const g = this.g;
      for (const sh of this.shots) {
        sh.life -= dt;
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        if (sh.x < 0 || sh.x > 1000 || sh.y < 0 || sh.y > 1000) sh.life = 0;
        if (sh.life <= 0) continue;
        // guards catch shots aimed at their king
        for (const o of this.living()) {
          if (o === sh.owner) continue;
          for (const gd of o.guards) {
            if (!gd.alive) continue;
            const p = this.guardPos(o, gd);
            if (SQ.dist2(p.x, p.y, sh.x, sh.y) < 30 * 30) {
              gd.alive = false;
              sh.life = 0;
              g.fx.burst(p.x, p.y, '#c9b3ff', 14, 260, 8);
            }
          }
          if (sh.life > 0 && Math.abs(o.x - sh.x) < o.size / 2 + 10 && Math.abs(o.y - sh.y) < o.size / 2 + 10) {
            sh.life = 0;
            this.damage(o, sh.dmg, sh.owner, sh.kind);
            if (sh.kind === 'pie') {
              o.st.blind = 2.5;
              g.fx.text(o.x, o.y - 90, 'PIED', '#fff3d6', 36);
              g.audio.bonk();
            }
            g.fx.burst(sh.x, sh.y, sh.color, 12, 240, 8);
          }
        }
      }
      this.shots = this.shots.filter((s) => s.life > 0);
    }

    updateHazards(dt) {
      const g = this.g;
      for (const hz of this.hazards) {
        hz.t += dt;
        if (hz.t > hz.life) continue;
        for (const o of this.living()) {
          if (o === hz.owner) continue;
          if (Math.abs(o.x - hz.x) > o.size / 2 + hz.r * 0.8 || Math.abs(o.y - hz.y) > o.size / 2 + hz.r * 0.8) continue;
          if (hz.kind === 'fire') {
            if (Math.random() < dt * 3) this.damage(o, 3, hz.owner, 'fire');
          } else if (hz.kind === 'thorns') {
            if ((hz.hit[o.team] || 0) < this.time) {
              hz.hit[o.team] = this.time + 0.6;
              this.damage(o, 9, hz.owner, 'thorns');
            }
          } else {
            // mines and decoys explode
            hz.t = hz.life + 1;
            const r = hz.kind === 'decoy' ? 120 : 90;
            g.fx.ring(hz.x, hz.y, hz.kind === 'decoy' ? '#ff8f33' : '#ff6ac1', r);
            g.fx.burst(hz.x, hz.y, hz.kind === 'decoy' ? '#ffb35c' : '#ffc4e6', 24, 380, 10);
            g.audio.explode();
            g.cam.shake(8);
            for (const e of this.living()) if (e !== hz.owner && SQ.dist2(e.x, e.y, hz.x, hz.y) < (r + 50) * (r + 50)) this.damage(e, hz.kind === 'decoy' ? 25 : 22, hz.owner, 'blast');
            break;
          }
        }
      }
      this.hazards = this.hazards.filter((hz) => hz.t <= hz.life);
    }

    intensity() {
      const low = Math.min(...this.living().map((s) => s.hp / s.maxHp));
      return low < 0.35 || this.time > this.duration - 12 ? 1 : 0.6;
    }

    // ---------------- drawing ----------------
    draw(ctx) {
      ctx.fillStyle = '#101016';
      ctx.fillRect(0, 0, 1000, 1000);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if ((x + y) % 2) ctx.fillRect(x * 100, y * 100, 100, 100);
      this.blood.draw(ctx);
      for (const hz of this.hazards) this.drawHazard(ctx, hz);
      for (const s of this.sq) {
        if (!s.alive) continue;
        const t = this.team(s);
        const sp = Math.hypot(s.vx, s.vy) || 1;
        SQ.drawSquare(ctx, s.x, s.y, s.size, t, {
          lookX: s.vx / sp,
          lookY: s.vy / sp,
          squash: s.squash,
          flash: s.flash,
          mood: s.st.stun > 0 || s.hp < s.maxHp * 0.25 ? 'scared' : s.st.charm > 0 ? 'happy' : 'angry',
          hurt: 1 - s.hp / s.maxHp,
          glow: s.st.rage > 0 || s.st.boost > 0 || s.pool > 0 ? 26 : 0,
          glowColor: s.st.rage > 0 ? '#ff5a2a' : s.pool > 0 ? '#ff9ac9' : '#ffd23f',
          shield: s.st.shield,
          outline: s.st.stun > 0 ? '#bdf3ff' : null,
        });
        this.drawStatus(ctx, s);
        for (const gd of s.guards) {
          if (!gd.alive) continue;
          const p = this.guardPos(s, gd);
          SQ.drawSquare(ctx, p.x, p.y, 30, t, { mood: 'angry' });
        }
        // health bar and ability name above every square
        const w = 110;
        const y = s.y - s.size / 2 - 26;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(s.x - w / 2 - 2, y - 2, w + 4, 14);
        ctx.fillStyle = s.hp / s.maxHp < 0.3 ? '#ff4d5e' : '#35d97a';
        ctx.fillRect(s.x - w / 2, y, w * (s.hp / s.maxHp), 10);
        ctx.font = `700 22px ${SQ.fontBody}`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.strokeText(s.ab.name, s.x, y - 16);
        ctx.fillStyle = t.light;
        ctx.fillText(s.ab.name, s.x, y - 16);
      }
      for (const sh of this.shots) {
        ctx.fillStyle = sh.color;
        ctx.beginPath();
        if (sh.kind === 'pie') {
          ctx.ellipse(sh.x, sh.y, 20, 13, Math.atan2(sh.vy, sh.vx), 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#c96b3c';
          ctx.fillRect(sh.x - 14, sh.y + 4, 28, 6);
        } else {
          ctx.arc(sh.x, sh.y, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(143,180,255,0.35)';
          ctx.beginPath();
          ctx.arc(sh.x - sh.vx * 0.02, sh.y - sh.vy * 0.02, 18, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      for (const z of this.zaps) {
        ctx.strokeStyle = z.color;
        ctx.lineWidth = z.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = Math.min(1, z.t * 4);
        ctx.beginPath();
        z.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    drawStatus(ctx, s) {
      const h = s.size / 2;
      if (s.st.charm > 0) {
        ctx.fillStyle = '#ff6ac1';
        ctx.font = `700 34px ${SQ.fontBody}`;
        ctx.textAlign = 'center';
        ctx.fillText('♥', s.x + Math.sin(this.time * 4) * 20, s.y - h - 50);
      }
      if (s.st.blind > 0) {
        // pie on the face
        ctx.fillStyle = 'rgba(255,243,214,0.92)';
        ctx.beginPath();
        ctx.ellipse(s.x, s.y - 4, h * 0.75, h * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (s.st.slow > 0) {
        ctx.strokeStyle = 'rgba(160,120,255,0.8)';
        ctx.lineWidth = 5;
        ctx.setLineDash([10, 8]);
        ctx.strokeRect(s.x - h - 8, s.y - h - 8, s.size + 16, s.size + 16);
        ctx.setLineDash([]);
      }
      if (s.st.stun > 0) {
        ctx.fillStyle = 'rgba(189,243,255,0.35)';
        ctx.fillRect(s.x - h, s.y - h, s.size, s.size);
      }
    }

    drawHazard(ctx, hz) {
      const fade = Math.min(1, (hz.life - hz.t) / 0.6, hz.t / 0.2);
      ctx.globalAlpha = Math.max(0, fade);
      if (hz.kind === 'fire') {
        ctx.fillStyle = 'rgba(255,110,30,0.55)';
        ctx.beginPath();
        ctx.arc(hz.x, hz.y, hz.r * (0.8 + 0.2 * Math.sin(hz.t * 9)), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,210,90,0.6)';
        ctx.beginPath();
        ctx.arc(hz.x, hz.y, hz.r * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else if (hz.kind === 'thorns') {
        ctx.fillStyle = '#1f6e3a';
        ctx.beginPath();
        ctx.arc(hz.x, hz.y, hz.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#9be37a';
        ctx.lineWidth = 4;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(hz.x + Math.cos(a) * hz.r * 0.6, hz.y + Math.sin(a) * hz.r * 0.6);
          ctx.lineTo(hz.x + Math.cos(a) * hz.r * 1.25, hz.y + Math.sin(a) * hz.r * 1.25);
          ctx.stroke();
        }
      } else if (hz.kind === 'mine') {
        ctx.fillStyle = '#ff6ac1';
        ctx.beginPath();
        ctx.arc(hz.x, hz.y, hz.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 3; i++) ctx.fillRect(hz.x - hz.r * 0.6 + i * hz.r * 0.5, hz.y - 4, hz.r * 0.3, 8);
      } else if (hz.kind === 'decoy') {
        // looks just like its owner, but does not blink
        SQ.drawSquare(ctx, hz.x, hz.y, 80, this.team(hz.owner), { mood: 'happy', alpha: Math.max(0, fade) * 0.9 });
      }
      ctx.globalAlpha = 1;
    }

    drawHud(ctx, y) {
      const rows = this.sq.length;
      const rowH = rows > 3 ? 46 : 54;
      this.sq.forEach((s, i) => {
        const t = this.team(s);
        const yy = y + i * (rowH + 8);
        ctx.globalAlpha = s.alive ? 1 : 0.4;
        ctx.font = `700 26px ${SQ.fontBody}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = t.color;
        ctx.fillText(`${t.name}`, 60, yy + rowH * 0.3);
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.font = `600 22px ${SQ.fontBody}`;
        ctx.fillText(s.ab.name, 60, yy + rowH * 0.78);
        const bx = 380;
        const bw = SQ.W - bx - 170;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(bx, yy + rowH * 0.2, bw, rowH * 0.6);
        ctx.fillStyle = t.color;
        ctx.fillRect(bx, yy + rowH * 0.2, bw * Math.max(0, s.hp / s.maxHp), rowH * 0.6);
        ctx.textAlign = 'right';
        ctx.font = `700 26px ${SQ.fontBody}`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${Math.ceil(s.hp)}/${s.maxHp}`, SQ.W - 50, yy + rowH * 0.5);
        ctx.globalAlpha = 1;
      });
      SQ.outlinedText(ctx, SQ.fmtTime(this.duration - this.time), SQ.W / 2, y + rows * (rowH + 8) + 42, 44, '#ffffff', { stroke: 8 });
    }
  }

  SQ.modes.abilities = { id: 'abilities', name: 'Ability War', create: (g, rng, opts) => new AbilityWar(g, rng, opts) };
})();
