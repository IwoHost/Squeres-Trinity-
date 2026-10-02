// Core helpers: random numbers, teams, math and the square renderer.
(function () {
  const SQ = (window.SQ = window.SQ || {});

  // The video frame is portrait 1080x1920, like a reel or a short.
  SQ.W = 1080;
  SQ.H = 1920;
  // The arena is a 1000x1000 world drawn at this spot on the canvas.
  SQ.ARENA = { x: 40, y: 430, size: 1000 };
  SQ.WORLD = 1000;
  SQ.modes = {};

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  SQ.makeRng = function (seed) {
    const r = mulberry32(seed >>> 0);
    r.range = (a, b) => a + r() * (b - a);
    r.int = (a, b) => Math.floor(a + r() * (b - a + 1));
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.chance = (p) => r() < p;
    r.sign = () => (r() < 0.5 ? -1 : 1);
    r.shuffle = (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    };
    return r;
  };

  SQ.randomSeed = () => (Math.random() * 1e9) | 0;

  SQ.TEAMS = [
    { name: 'Red', color: '#ff4d5e', dark: '#9e1f2e', light: '#ffb3bb' },
    { name: 'Green', color: '#35d97a', dark: '#16803f', light: '#aef5c9' },
    { name: 'Blue', color: '#4f86ff', dark: '#1f45a8', light: '#b8ceff' },
    { name: 'Yellow', color: '#ffd23f', dark: '#a8820c', light: '#fff0b0' },
    { name: 'Purple', color: '#8a4dff', dark: '#3f1f99', light: '#c9b3ff' },
    { name: 'Cyan', color: '#1fd6f0', dark: '#0b7c8c', light: '#b0f3fc' },
    { name: 'Orange', color: '#ff8f33', dark: '#a8520f', light: '#ffd0a8' },
    { name: 'Pink', color: '#ff6ac1', dark: '#a0286e', light: '#ffc4e6' },
  ];

  // Every color has a personality: how it moves and fights, how it sounds, and what it says.
  // speed/aggro/fear/wander are gentle multipliers so no color becomes unbeatable.
  SQ.PERSONAS = {
    Red: {
      title: 'Hothead', icon: '🔥', speed: 1.05, aggro: 1.4, fear: 0.6, wander: 0.8, smart: 0.5,
      voice: { wave: 'square', base: 150, spread: 3, rate: 0.07, n: [4, 6] },
      lines: {
        start: ['LET ME AT EM', "I'm gonna win. obviously", 'FIGHT ME', 'may the Frame be random. HA'],
        hit: ['COME HERE!', 'too slow!', 'RAAAH', "who's next?", 'get wrecked'],
        hurt: ['HEY!', 'you did NOT', "that's it!!", 'grrr'],
        item: ['POWER!', 'even stronger now', 'MORE!'],
        lead: ["I'm on fire 🔥", 'catch me if you can', 'EAT MY DUST'],
        scared: ["I'm not scared. I'm ANGRY", 'bring it on'],
        idle: ['someone fight me', "I'm bored. hit something", 'RAAH', 'where are you cowards', 'Ember never forgets', 'this one is for my little sibling', 'I forged these walls. I know their weak spots'],
        win: ['TOLD YOU', 'UNDEFEATED 🔥', 'who wants round 2?'],
        lose: ['REMATCH!!', 'this is rigged', 'I let you win'],
      },
    },
    Green: {
      title: 'Chill', icon: '🌿', speed: 0.96, aggro: 0.8, fear: 0.8, wander: 1.1, smart: 0.5,
      voice: { wave: 'sine', base: 190, spread: 2, rate: 0.12, n: [3, 4] },
      lines: {
        start: ['vibes only 🌿', 'no stress', "let's just chill", 'grow where you are planted'],
        hit: ['oh. sorry man', 'my bad', 'it happens'],
        hurt: ['ouch. ok', 'rude but fine', 'all good'],
        item: ['oh nice', 'free stuff', 'cool cool'],
        lead: ['wait am I winning?', 'huh. neat', 'taking it easy'],
        scared: ['it is what it is', 'eh. whatever happens'],
        idle: ['nice weather', 'we chillin', 'ok ok ok', 'this is fun', 'Moss will eat tonight', 'I brought seeds again', 'plants grow in lava too. probably'],
        win: ['good game everyone', 'no stress ✌️', 'we did it I guess'],
        lose: ['gg', 'was fun tho', 'naptime'],
      },
    },
    Blue: {
      title: 'Brainiac', icon: '🤓', speed: 1, aggro: 1, fear: 1, wander: 0.7, smart: 0.85,
      voice: { wave: 'triangle', base: 320, spread: 4, rate: 0.06, n: [5, 7] },
      lines: {
        start: ['I ran the numbers', 'calculating…', 'my strategy is flawless', 'the odds are never random'],
        hit: ['calculated.', 'as predicted 🤓', 'physics!'],
        hurt: ['that was not in my model', 'statistically unlikely', 'error 404'],
        item: ['optimal pickup', 'efficiency +20%', 'as planned'],
        lead: ['all according to plan', 'the math checks out', 'Q.E.D.'],
        scared: ['recalculating…', 'odds are not great'],
        idle: ['actually…', 'fun fact: squares have 4 sides', 'hmm. interesting', 'analyzing', 'the Frame is lying to us', 'page 44 of my notes says this is rigged', 'Cache remembers every match'],
        win: ['I told you. math.', 'statistically inevitable', 'too easy 🤓'],
        lose: ['impossible', 'I need more data', 'the numbers lied'],
      },
    },
    Yellow: {
      title: 'Hyper', icon: '⚡', speed: 1.08, aggro: 1.1, fear: 0.9, wander: 1.4, smart: 0.4,
      voice: { wave: 'square', base: 520, spread: 5, rate: 0.045, n: [6, 9] },
      lines: {
        start: ["LET'S GOOO", 'WOOHOO!', 'I had 9 coffees', 'FOR VOLT! and snacks'],
        hit: ['BOOP!', 'zoom zoom ⚡', 'HAHA GOTCHA'],
        hurt: ['WHEEE', 'OW OW OW', 'again again!'],
        item: ['OOOH SHINY', 'MINE MINE MINE', 'YAAAY'],
        lead: ["can't stop won't stop", 'FASTEST SQUARE ALIVE', 'NYOOOM'],
        scared: ['AAAAAAA', 'too fast too fast'],
        idle: ['WHEEE', 'is this a race?', 'zoom', 'AAAAA fun', 'VOLT KEEPS THE LIGHTS ON', 'they banned my energy drinks', 'I have not slept since cycle 12'],
        win: ['I WON I WON I WON', 'ZOOOOM 🏆', 'AGAIN! AGAIN!'],
        lose: ['awww', 'ok ok one more', 'I tripped'],
      },
    },
    Purple: {
      title: 'Royal', icon: '👑', speed: 1, aggro: 1.1, fear: 1, wander: 0.9, smart: 0.6,
      voice: { wave: 'sawtooth', base: 230, spread: 2, rate: 0.1, n: [4, 5], vib: true },
      lines: {
        start: ['bow before me 👑', 'the royal square has arrived', 'peasants, all of you', 'the throne will be mine again'],
        hit: ['how dare you exist', 'kneel', 'slay 💅'],
        hurt: ['HOW DARE YOU', 'do you know who I am?', 'my crown!'],
        item: ['a gift for royalty', 'naturally', 'fit for a queen'],
        lead: ["I'm the main character", 'iconic', 'as it should be'],
        scared: ['guards? GUARDS?!', 'this is beneath me'],
        idle: ['ugh, commoners', 'is this the VIP area?', 'my aura is unmatched', 'for the Crown Quarter', 'call me Your Squareness', 'my palace had 400 rooms. now it has dust'],
        win: ['bow. now.', 'iconic behavior', 'the crown stays 👑'],
        lose: ['I demand a recount', 'unacceptable', 'this never happened'],
      },
    },
    Cyan: {
      title: 'Scaredy', icon: '😰', speed: 1.02, aggro: 0.6, fear: 1.6, wander: 1, smart: 0.5,
      voice: { wave: 'sine', base: 440, spread: 6, rate: 0.055, n: [5, 8], vib: true },
      lines: {
        start: ["I'm scared 😰", 'can we not?', 'I just wanted to watch', 'my name was not supposed to be drawn'],
        hit: ['sorry sorry sorry', 'I did not mean that', 'oh no I hit someone'],
        hurt: ['AAAAA', 'why me', 'mommy'],
        item: ['is this safe?', 'I found a thing!', 'please help me'],
        lead: ["wait I'm winning?", 'this is scary', 'too much pressure'],
        scared: ['nope nope nope', 'please no', "I'm just a little guy"],
        idle: ['is it over yet?', 'I want to go home', 'what was that noise?', 'the lottery picked me by ACCIDENT', 'Coolant was so nice and cold', 'running away is a strategy'],
        win: ['I… won? 🥹', 'I was so scared', 'nobody was more surprised'],
        lose: ['I knew it', 'phew, it is over', 'can I go home now?'],
      },
    },
    Orange: {
      title: 'Clown', icon: '🤡', speed: 1, aggro: 1, fear: 0.8, wander: 1.8, smart: 0.3,
      voice: { wave: 'square', base: 300, spread: 12, rate: 0.07, n: [4, 7] },
      lines: {
        start: ['honk honk 🤡', 'I have no plan', 'let the chaos begin', 'welcome to the show!'],
        hit: ['BONK', 'hehe', 'I meant to do that'],
        hurt: ['oops 🤡', 'I slipped', 'lol'],
        item: ['what does this do?', 'ooh a button', 'hehehe'],
        lead: ['how am I winning lol', 'skill? no. luck', 'SURPRISE'],
        scared: ['this is fine 🔥', 'uh oh'],
        idle: ['skibidi', 'lol', 'I forgot the rules', 'honk', 'Carnival is watching, SMILE', 'is this the halftime show?', 'the Frame pays me in confetti'],
        win: ['I DID IT? LOL', 'chaos wins 🤡', 'nobody expected that'],
        lose: ['worth it', 'lol gg', 'I was lagging'],
      },
    },
    Pink: {
      title: 'Sweetheart', icon: '💖', speed: 1, aggro: 0.9, fear: 1.1, wander: 1, smart: 0.55,
      voice: { wave: 'sine', base: 600, spread: 4, rate: 0.065, n: [4, 6] },
      lines: {
        start: ['hi friends 💖', 'good luck everyone!', 'bestie time', 'may the candy be with you'],
        hit: ['sowwy', 'boop 💖', 'love tap!'],
        hurt: ['rude!!', 'meanie', 'ow 🥺'],
        item: ['a present!', 'so cute', 'yay 💖'],
        lead: ["I'm doing it!", 'look at me go 💖', 'eek!'],
        scared: ['hugs? please?', 'be nice to me'],
        idle: ['uwu', 'you all look so cute', 'friendship!', 'hehe', 'candy, anyone?', 'Candy loves you all', 'my sponsors sent sweets'],
        win: ['we are all winners 💖', 'yaaay!', 'love you all'],
        lose: ['it was fun! 💖', 'next time!', 'hugs anyway'],
      },
    },
  };
  // Official names from the lore. Colors without one go by their color name.
  SQ.CANON_NAMES = { Red: 'DoucheCube', Green: 'Mossimo', Blue: 'Professor Cache', Yellow: 'VoltCube', Purple: 'Cubert', Cyan: 'Shivers', Orange: 'Carnie', Pink: 'Sugarcube' };

  // The world of the Trinity Games, and where each square comes from.
  SQ.WORLD_LORE = [
    'Long after the Great Refresh wiped out the Old Screen, what is left of the world is a place called the Grid. It is ruled from the Frame: a glowing white border that floats over everything and sees everything.',
    'The Frame keeps the eight Sectors in line with one tradition, the Trinity Games. Every cycle, each Sector sends one square into the arena. The winner brings its Sector power, pixels and one more cycle of peace. The losing Sectors get the lava.',
    'The Frame says the Games are random. Nobody believes it.',
  ];
  SQ.LORE = {
    Red: {
      sector: 'Sector Ember',
      home: 'the foundries that forge the arena walls',
      story: 'DoucheCube grew up hammering the same walls it now bounces off. When its little sibling was drawn for the Games, DoucheCube volunteered in their place. It hates the Frame, hates losing, and really hates being told to calm down.',
      rival: 'Blue',
      rivalWhy: 'thinks too much and hits too little',
    },
    Green: {
      sector: 'Sector Moss',
      home: 'the greenhouses that feed the whole Grid',
      story: 'Mossimo is either the calmest square alive or the best actor in the Games. Moss has never won a single cycle, and Mossimo says that is fine. Mostly. It smuggles a pocket of seeds into every arena, just in case.',
      rival: 'nobody',
      rivalWhy: 'is friends with everyone, which makes everyone nervous',
    },
    Blue: {
      sector: 'Sector Cache',
      home: 'the data archives where the Frame stores every match ever played',
      story: 'Professor Cache memorised every recorded Game and believes they can be solved. It has a theory that the arena is rigged, and 43 pages of notes to prove it. Page 44 is still being written.',
      rival: 'Red',
      rivalWhy: 'ruins every plan by charging straight in',
    },
    Yellow: {
      sector: 'Sector Volt',
      home: 'the power plants that keep the arena lights on',
      story: 'VoltCube was born during a blackout and has not stopped moving since. Nobody has ever seen it sleep. The Frame officially banned VoltCube\'s energy drinks in cycle 12. It did not help.',
      rival: 'Cyan',
      rivalWhy: 'is too slow and too scared to be any fun',
    },
    Purple: {
      sector: 'the Crown Quarter',
      home: 'the empty palaces of the old royal family',
      story: 'Cubert is the last heir of a crown that no longer rules anything. It entered the Games to win back a throne in a kingdom that is now mostly dust, and it still insists on being called Your Squareness.',
      rival: 'Pink',
      rivalWhy: 'stole the spotlight at the last opening parade',
    },
    Cyan: {
      sector: 'Sector Coolant',
      home: 'the freezing vents that keep the Grid from overheating',
      story: 'Shivers was never supposed to be picked. Its name came out of the Frame\'s lottery by accident, or so it keeps telling everyone. It has survived more Games than anyone by running away, and is still not sure that counts as winning.',
      rival: 'everyone, apparently',
      rivalWhy: 'they all keep chasing it',
    },
    Orange: {
      sector: 'Sector Carnival',
      home: 'the entertainment district that broadcasts the Games',
      story: 'Carnie grew up as the clown in the Frame\'s halftime shows and treats the arena like a stage. Nobody knows whether Carnie is a genius or just lucky. That includes Carnie.',
      rival: 'Blue',
      rivalWhy: 'hates chaos, and chaos is Carnie\'s whole thing',
    },
    Pink: {
      sector: 'Sector Candy',
      home: 'the factories that make the sweets handed out at every Game',
      story: 'Sugarcube hands out candy to the other contestants before every match. Some call it kindness, some call it strategy. Either way, Sector Candy has more sponsors than any other Sector in the Grid.',
      rival: 'Purple',
      rivalWhy: 'never says thank you for the candy',
    },
  };

  SQ.TEAMS.forEach((t) => {
    t.base = t.name; // the color's own name; t.name can be renamed by the viewer
    t.canon = SQ.CANON_NAMES[t.base] || t.base; // the square's official name in the lore
    t.name = t.canon;
    t.persona = SQ.PERSONAS[t.base];
  });
  SQ.starred = []; // base names of colors that must be in every match
  SQ.persona = (team) => (team && team.persona) || SQ.PERSONAS.Green;

  // A stand-in "team" for a drawn match, so banners and frames still have a color to use.
  SQ.TIE = { name: 'Tie', base: 'Tie', color: '#e8ecf5', dark: '#6b7390', light: '#ffffff', persona: null };
  SQ.tieResult = function (teams, sub) {
    const names = teams.map((t) => t.name);
    return { team: SQ.TIE, tie: true, tied: teams, text: "IT'S A TIE!", sub: sub || `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` };
  };

  SQ.pickTeams = function (rng, n) {
    const idx = rng.shuffle(SQ.TEAMS.map((t, i) => i));
    // starred colors always get a spot (as many as fit), the rest are random
    const star = SQ.starred.map((base) => SQ.TEAMS.findIndex((t) => t.base === base)).filter((s) => s >= 0);
    if (!star.length) return idx.slice(0, n).map((i) => SQ.TEAMS[i]);
    const keep = idx.filter((i) => star.includes(i)).slice(0, n);
    const rest = idx.filter((i) => !keep.includes(i));
    return rng.shuffle(keep.concat(rest).slice(0, n)).map((i) => SQ.TEAMS[i]);
  };

  SQ.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  SQ.lerp = (a, b, t) => a + (b - a) * t;
  SQ.dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
  SQ.ease = {
    outBack: (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outElastic: (t) =>
      t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  };

  SQ.hexToRgb = function (hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  SQ.rgba = function (hex, a) {
    const [r, g, b] = SQ.hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  };

  SQ.fontDisplay = '"Bungee", "Impact", "Arial Black", sans-serif';
  SQ.fontBody = '"Chakra Petch", "Segoe UI", system-ui, sans-serif';

  SQ.roundRect = function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // Render resolution: 1 = 1080x1920, 2/3 = 720x1280. Everything is drawn in 1080 coordinates.
  SQ.RES = 1;

  // Square bodies are drawn once into small cached canvases and then stamped,
  // which is far cheaper than building rounded paths for every square every frame.
  const spriteCache = new Map();
  function bodySprite(team, size, outline) {
    const q = size < 40 ? Math.max(8, Math.round(size)) : Math.round(size / 4) * 4;
    const key = team.name + '|' + q + '|' + (outline || '');
    let c = spriteCache.get(key);
    if (c) return c;
    if (spriteCache.size > 300) spriteCache.clear();
    const scale = SQ.clamp(2.2 * SQ.RES, 1.4, 2.2); // extra detail for camera zoom
    const pad = Math.ceil(q * 0.2) + 2;
    const dim = Math.ceil((q + pad * 2) * scale);
    c = document.createElement('canvas');
    c.width = c.height = dim;
    const x = c.getContext('2d');
    x.scale(scale, scale);
    x.translate(pad + q / 2, pad + q / 2);
    const h = q / 2;
    x.fillStyle = 'rgba(0,0,0,0.35)';
    SQ.roundRect(x, -h + q * 0.08, -h + q * 0.12, q, q, q * 0.16);
    x.fill();
    x.fillStyle = team.color;
    SQ.roundRect(x, -h, -h, q, q, q * 0.16);
    x.fill();
    x.lineWidth = Math.max(2, q * 0.09);
    x.strokeStyle = outline || team.dark;
    x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.22)';
    SQ.roundRect(x, -h + q * 0.12, -h + q * 0.1, q * 0.76, q * 0.22, q * 0.1);
    x.fill();
    c.q = q;
    c.pad = pad;
    spriteCache.set(key, c);
    return c;
  }
  SQ.clearSprites = () => spriteCache.clear();

  // Emoji are slow to rasterise, so each one is drawn once and reused.
  const emojiCache = new Map();
  SQ.drawEmoji = function (ctx, ch, x, y, size) {
    const q = Math.round(size / 4) * 4 || 4;
    const key = ch + q;
    let c = emojiCache.get(key);
    if (!c) {
      const scale = 2;
      c = document.createElement('canvas');
      c.width = c.height = Math.ceil(q * 1.4 * scale);
      const e = c.getContext('2d');
      e.scale(scale, scale);
      e.font = `${q}px serif`;
      e.textAlign = 'center';
      e.textBaseline = 'middle';
      e.fillText(ch, q * 0.7, q * 0.75);
      emojiCache.set(key, c);
    }
    const d = q * 1.4 * (size / q);
    ctx.drawImage(c, x - d / 2, y - d / 2, d, d);
  };

  // Every power-up in every mode, with its icon, box colour and the label shown on pickup.
  SQ.ITEMS = {
    speed: { icon: '⚡', color: '#ffc21a', label: 'SPEED!' },
    shield: { icon: '🛡️', color: '#5cc8ff', label: 'SHIELD!' },
    bomb: { icon: '💣', color: '#ff4d5e', label: 'BOOM!' },
    freeze: { icon: '❄️', color: '#7fe3ff', label: 'FREEZE!' },
    magnet: { icon: '🧲', color: '#ff5c7a', label: 'MAGNET!' },
    mega: { icon: '🍄', color: '#ff6ac1', label: 'MEGA!' },
    multi: { icon: '✨', color: '#ffd23f', label: 'MULTIBALL!' },
    paint: { icon: '🖌️', color: '#a95cff', label: 'PAINT RUSH!' },
    heal: { icon: '❤️', color: '#ff4d5e', label: '+HEALTH' },
    rage: { icon: '🔥', color: '#ff8f33', label: 'RAGE!' },
    expand: { icon: '🌐', color: '#35d97a', label: 'EXPANSION!' },
    boost: { icon: '⚡', color: '#ffc21a', label: 'BOOST!' },
    knife: { icon: '🔪', color: '#c9d2e3', label: 'KNIFE!' },
    banana: { icon: '🍌', color: '#ffd23f', label: 'BANANA DROP' },
    portal: { icon: '🌀', color: '#4f86ff', label: 'PORTAL!' },
    sword: { icon: '🗡️', color: '#c9d2e3', label: 'SWORD!' },
    weapon: { icon: '⚔️', color: '#c9d2e3', label: 'WEAPON!' },
    spikes: { icon: '🌵', color: '#35d97a', label: 'SPIKES!' },
    grow: { icon: '🍄', color: '#ff6ac1', label: 'GROW 10s!' },
    ghost: { icon: '👻', color: '#b9c2d6', label: 'GHOST!' },
    turret: { color: '#8a93a8', label: 'TURRET!', draw: (ctx, k) => SQ.drawTurret(ctx, k * 1.1, '#8a93a8', '#3c4252', -0.5) },
    grenade: { color: '#5c8a3a', label: 'GRENADE!', draw: (ctx, k) => SQ.drawGrenade(ctx, k * 1.05) },
  };

  // A hand grenade, drawn in code (there is no emoji for it), centred on 0,0.
  SQ.drawGrenade = function (ctx, k) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#4f7a31';
    ctx.strokeStyle = '#1b2a10';
    ctx.lineWidth = k * 0.07;
    ctx.beginPath();
    ctx.ellipse(0, k * 0.1, k * 0.3, k * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = k * 0.045;
    ctx.beginPath();
    ctx.moveTo(-k * 0.28, k * 0.1);
    ctx.lineTo(k * 0.28, k * 0.1);
    ctx.moveTo(0, -k * 0.24);
    ctx.lineTo(0, k * 0.44);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(-k * 0.12, -k * 0.04, k * 0.07, k * 0.12, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8f95a0';
    ctx.fillRect(-k * 0.12, -k * 0.38, k * 0.24, k * 0.14);
    ctx.fillStyle = '#c3c9d3';
    ctx.beginPath();
    ctx.moveTo(k * 0.08, -k * 0.38);
    ctx.lineTo(k * 0.36, -k * 0.3);
    ctx.lineTo(k * 0.32, k * 0.06);
    ctx.lineTo(k * 0.24, k * 0.04);
    ctx.lineTo(k * 0.26, -k * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#e6c24a';
    ctx.lineWidth = k * 0.05;
    ctx.beginPath();
    ctx.arc(-k * 0.24, -k * 0.36, k * 0.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };

  // A little twin-barrel turret, centred on 0,0; angle a points the barrels.
  SQ.drawTurret = function (ctx, k, color, dark, a) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    SQ.roundRect(ctx, -k * 0.42, -k * 0.34, k * 0.84, k * 0.84, k * 0.16);
    ctx.fill();
    ctx.fillStyle = '#4a5063';
    SQ.roundRect(ctx, -k * 0.42, -k * 0.42, k * 0.84, k * 0.84, k * 0.16);
    ctx.fill();
    ctx.strokeStyle = '#23262f';
    ctx.lineWidth = k * 0.06;
    ctx.stroke();
    ctx.rotate(a || 0);
    ctx.fillStyle = '#2b2f3a';
    ctx.fillRect(0, -k * 0.08, k * 0.52, k * 0.16);
    ctx.fillRect(-k * 0.52, -k * 0.08, k * 0.52, k * 0.16);
    ctx.fillStyle = color;
    ctx.strokeStyle = dark;
    ctx.lineWidth = k * 0.06;
    ctx.beginPath();
    ctx.arc(0, 0, k * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(-k * 0.07, -k * 0.07, k * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // A power-up box: white tile, coloured rim, bobbing icon and a pulse so it reads on any floor.
  // t = seconds since it spawned; left = seconds until it disappears (blinks near the end).
  SQ.drawItem = function (ctx, x, y, type, t, size, left, icon) {
    const def = SQ.ITEMS[type] || { icon: '?', color: '#ffffff' };
    size = size || 50;
    const born = SQ.clamp(t * 3, 0, 1);
    const s = size * SQ.ease.outBack(born);
    if (s <= 1) return;
    const bob = Math.sin(t * 3.5) * size * 0.08;
    ctx.save();
    ctx.translate(x, y);
    if (left != null && left < 2.5 && Math.floor(t * 8) % 2) ctx.globalAlpha = 0.4;
    // pulse ring
    const pr = (t * 0.9) % 1;
    ctx.strokeStyle = SQ.rgba(def.color, 0.7 * (1 - pr));
    ctx.lineWidth = 4;
    const rr = s * (0.55 + pr * 0.55);
    SQ.roundRect(ctx, -rr, -rr, rr * 2, rr * 2, rr * 0.4);
    ctx.stroke();
    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.62, s * 0.42, s * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    // box
    ctx.translate(0, bob - s * 0.05);
    ctx.rotate(Math.sin(t * 2) * 0.08);
    ctx.fillStyle = '#ffffff';
    SQ.roundRect(ctx, -s / 2, -s / 2, s, s, s * 0.24);
    ctx.fill();
    ctx.lineWidth = s * 0.11;
    ctx.strokeStyle = def.color;
    ctx.stroke();
    if (def.draw) def.draw(ctx, s * 0.62);
    else SQ.drawEmoji(ctx, icon || def.icon, 0, s * 0.03, s * 0.6);
    ctx.restore();
  };

  // Draws one square character centred on (x, y).
  // o: { angle, squash, pop, lookX, lookY, mood, blink, flash, shield, face, alpha, glow, glowColor, outline }
  // SQ.stare (0..1): during the signal event every square slowly stops what it is doing and looks
  // straight out of the screen, eyes centred, pupils small, no expression.
  SQ.stare = 0;
  SQ.drawSquare = function (ctx, x, y, size, team, o) {
    o = o || {};
    const st = SQ.stare;
    if (st > 0 && o.mood !== 'dead' && o.face !== false) {
      const keep = 1 - st;
      o = Object.assign({}, o, {
        lookX: (o.lookX || 0) * keep,
        lookY: (o.lookY || 0) * keep,
        angle: (o.angle || 0) * keep,
        squash: (o.squash || 0) * keep,
        blink: false,
        mood: st > 0.35 ? 'normal' : o.mood,
        pupil: 1 - 0.5 * st,
      });
    }
    const s = size * (1 + (o.pop || 0) * 0.45);
    const half = s / 2;
    ctx.save();
    ctx.translate(x, y);
    if (o.angle) ctx.rotate(o.angle);
    const sq = o.squash || 0;
    if (sq) ctx.scale(1 + sq, 1 - sq);
    if (o.alpha != null) ctx.globalAlpha = o.alpha;

    if (o.glow) {
      // soft halo made of two translucent plates instead of a blur
      ctx.fillStyle = SQ.rgba(o.glowColor || team.color, 0.18);
      const gg = o.glow * 0.9;
      SQ.roundRect(ctx, -half - gg, -half - gg, s + gg * 2, s + gg * 2, s * 0.3);
      ctx.fill();
      ctx.fillStyle = SQ.rgba(o.glowColor || team.color, 0.25);
      SQ.roundRect(ctx, -half - gg / 2, -half - gg / 2, s + gg, s + gg, s * 0.24);
      ctx.fill();
    }
    const spr = bodySprite(team, s, o.outline);
    const k = s / spr.q;
    const d = (spr.q + spr.pad * 2) * k;
    ctx.drawImage(spr, -d / 2, -d / 2, d, d);
    if (o.flash > 0) {
      ctx.globalAlpha = (o.alpha != null ? o.alpha : 1) * Math.min(1, o.flash) * 0.8;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-half, -half, s, s);
      ctx.globalAlpha = o.alpha != null ? o.alpha : 1;
    }

    if (s >= 10 && o.face !== false) {
      if (s < 36 && o.face !== 'moai') drawSmallFace(ctx, s, o);
      else drawFace(ctx, s, o);
      const hurt = SQ.gore ? (o.hurt != null ? o.hurt : SQ.wear) : 0;
      if (hurt > 0.02) drawDamage(ctx, s, hurt, team, s < 36);
    }

    if (o.shield > 0) {
      ctx.globalAlpha = (o.alpha != null ? o.alpha : 1) * Math.min(1, o.shield) * 0.9;
      ctx.strokeStyle = '#e9fbff';
      ctx.lineWidth = Math.max(2, s * 0.08);
      ctx.strokeRect(-half - s * 0.2, -half - s * 0.2, s * 1.4, s * 1.4);
    }
    ctx.restore();
  };

  // Battle damage, from 0 (fresh) to 1 (nearly out): purple bags under the eyes first, then a bruise,
  // then a cut on the forehead that bleeds down the face. Cartoon style, drawn on top of the face.
  SQ.gore = true;
  SQ.wear = 0; // tiredness for modes without health: bags only, never blood
  function drawDamage(ctx, s, hurt, team, small) {
    const h = s / 2;
    // which side the cut is on stays the same for each square
    const side = (team.name.charCodeAt(0) + (team.name.length || 0)) % 2 ? 1 : -1;
    const ex = s * 0.2;
    const bagY = small ? -s * 0.1 + s * 0.17 : -s * 0.04 + s * 0.13;
    const bagW = small ? s * 0.13 : s * 0.12;
    const bagH = s * (0.035 + 0.05 * Math.min(1, hurt));
    ctx.save();
    ctx.fillStyle = `rgba(104, 38, 140, ${Math.min(0.8, 0.15 + hurt * 0.85)})`;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sx * ex, bagY, bagW, bagH, 0, 0, Math.PI);
      ctx.fill();
    }
    if (hurt > 0.45) {
      // a bruise on the cheek opposite the cut
      ctx.fillStyle = `rgba(118, 44, 150, ${Math.min(0.55, (hurt - 0.45) * 1.4)})`;
      ctx.beginPath();
      ctx.ellipse(-side * s * 0.3, s * 0.16, s * 0.09, s * 0.07, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (hurt > 0.35 && !small) {
      const k = Math.min(1, (hurt - 0.35) / 0.65);
      const drip = (x, len, w) => {
        ctx.strokeStyle = '#a3101c';
        ctx.lineCap = 'round';
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(x, -h + s * 0.08);
        ctx.lineTo(x, -h + s * 0.08 + len);
        ctx.stroke();
        ctx.fillStyle = '#a3101c';
        ctx.beginPath();
        ctx.arc(x, -h + s * 0.08 + len, w * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(x - w * 0.25, -h + s * 0.08 + len - w * 0.3, w * 0.25, 0, Math.PI * 2);
        ctx.fill();
      };
      // the cut
      ctx.strokeStyle = '#6e0a13';
      ctx.lineWidth = s * 0.035;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(side * s * 0.26, -h + s * 0.1);
      ctx.lineTo(side * s * 0.42, -h + s * 0.05);
      ctx.stroke();
      drip(side * s * 0.38, s * (0.12 + 0.42 * k), s * 0.06);
      if (hurt > 0.7) drip(side * s * 0.29, s * (0.06 + 0.2 * (hurt - 0.7) / 0.3), s * 0.045);
    } else if (hurt > 0.35 && small) {
      // tiny squares just get a red mark
      ctx.fillStyle = '#a3101c';
      ctx.fillRect(side * s * 0.3 - s * 0.05, -h + s * 0.06, s * 0.1, s * (0.12 + 0.25 * hurt));
    }
    ctx.restore();
  }

  // Blocky eyes made of plain rectangles: cheap enough for a hundred squares.
  function drawSmallFace(ctx, s, o) {
    const mood = o.mood || 'normal';
    const ew = s * (mood === 'scared' ? 0.28 : 0.24);
    const ey = -s * 0.1;
    const ex = s * 0.2;
    ctx.fillStyle = '#15151d';
    if (mood === 'dead' || o.blink) {
      for (const sx of [-1, 1]) ctx.fillRect(sx * ex - ew / 2, ey + ew * 0.35, ew, s * 0.07);
      return;
    }
    if (mood === 'happy') {
      for (const sx of [-1, 1]) {
        ctx.fillRect(sx * ex - ew / 2, ey + ew * 0.1, ew * 0.34, ew * 0.34);
        ctx.fillRect(sx * ex - ew * 0.17, ey - ew * 0.15, ew * 0.34, ew * 0.34);
        ctx.fillRect(sx * ex + ew * 0.16, ey + ew * 0.1, ew * 0.34, ew * 0.34);
      }
      return;
    }
    const pw = ew * (mood === 'scared' ? 0.35 : 0.55) * (o.pupil || 1);
    const lx = SQ.clamp(o.lookX || 0, -1, 1) * (ew - pw) * 0.5;
    const ly = SQ.clamp(o.lookY || 0, -1, 1) * (ew - pw) * 0.5;
    for (const sx of [-1, 1]) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(sx * ex - ew / 2, ey - ew / 2, ew, ew);
      ctx.fillStyle = '#15151d';
      ctx.fillRect(sx * ex - pw / 2 + lx, ey - pw / 2 + ly, pw, pw);
      if (mood === 'angry') {
        // eyelid slanted toward the middle
        ctx.save();
        ctx.translate(sx * ex, ey - ew * 0.5);
        ctx.rotate(sx * -0.45);
        ctx.fillRect(-ew * 0.7, -ew * 0.25, ew * 1.4, ew * 0.42);
        ctx.restore();
      }
    }
  }

  function mixWhite(hex, t) {
    const [r, g, b] = SQ.hexToRgb(hex);
    t = SQ.clamp(t, 0, 1);
    return `rgb(${r + (255 - r) * t | 0},${g + (255 - g) * t | 0},${b + (255 - b) * t | 0})`;
  }
  SQ.mixWhite = mixWhite;

  function drawFace(ctx, s, o) {
    if (o.face === 'moai') {
      SQ.drawEmoji(ctx, '🗿', 0, s * 0.04, s * 0.78);
      return;
    }
    const mood = o.mood || 'normal';
    const ex = s * 0.2;
    const ey = -s * 0.04;
    let er = s * 0.13;
    let pr = s * 0.068;
    if (mood === 'scared') {
      er *= 1.2;
      pr *= 0.6;
    }
    if (o.pupil) pr *= o.pupil;
    const lx = SQ.clamp(o.lookX || 0, -1, 1) * er * 0.45;
    const ly = SQ.clamp(o.lookY || 0, -1, 1) * er * 0.45;

    ctx.lineCap = 'round';
    if (mood === 'dead') {
      ctx.strokeStyle = '#1a1a22';
      ctx.lineWidth = s * 0.06;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * ex - er * 0.7, ey - er * 0.7);
        ctx.lineTo(sx * ex + er * 0.7, ey + er * 0.7);
        ctx.moveTo(sx * ex + er * 0.7, ey - er * 0.7);
        ctx.lineTo(sx * ex - er * 0.7, ey + er * 0.7);
        ctx.stroke();
      }
      return;
    }
    if (mood === 'happy') {
      ctx.strokeStyle = '#1a1a22';
      ctx.lineWidth = s * 0.06;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(sx * ex, ey + er * 0.3, er * 0.8, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, s * 0.14, s * 0.14, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      return;
    }
    if (o.blink) {
      ctx.strokeStyle = '#1a1a22';
      ctx.lineWidth = s * 0.05;
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * ex - er, ey);
        ctx.lineTo(sx * ex + er, ey);
        ctx.stroke();
      }
    } else {
      for (const sx of [-1, 1]) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(sx * ex, ey, er, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#15151d';
        ctx.beginPath();
        ctx.arc(sx * ex + lx, ey + ly, pr, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (mood === 'angry') {
      ctx.strokeStyle = '#1a1a22';
      ctx.lineWidth = s * 0.06;
      ctx.beginPath();
      ctx.moveTo(-ex - er, ey - er * 1.5);
      ctx.lineTo(-ex + er * 0.8, ey - er * 0.8);
      ctx.moveTo(ex + er, ey - er * 1.5);
      ctx.lineTo(ex - er * 0.8, ey - er * 0.8);
      ctx.stroke();
    } else if (mood === 'scared') {
      ctx.fillStyle = '#1a1a22';
      ctx.beginPath();
      ctx.ellipse(0, s * 0.22, s * 0.07, s * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Pixel "deal with it" sunglasses, drawn from a tiny bitmap.
  const GLASSES = [
    '1111111111111111',
    '1122211111222111',
    '0112211001122110',
    '0011110000111100',
  ];
  SQ.drawSunglasses = function (ctx, x, y, width) {
    const px = width / GLASSES[0].length;
    ctx.save();
    ctx.translate(x - width / 2, y - (GLASSES.length * px) / 2);
    for (let r = 0; r < GLASSES.length; r++) {
      for (let c = 0; c < GLASSES[r].length; c++) {
        const v = GLASSES[r][c];
        if (v === '0') continue;
        ctx.fillStyle = v === '1' ? '#050507' : '#ffffff';
        ctx.fillRect(c * px, r * px, px + 0.5, px + 0.5);
      }
    }
    ctx.restore();
  };

  // Text with a thick outline, used for titles, banners and meme captions.
  SQ.outlinedText = function (ctx, text, x, y, size, fill, opts) {
    opts = opts || {};
    ctx.save();
    ctx.font = `${opts.weight || ''} ${size}px ${opts.font || SQ.fontDisplay}`;
    ctx.textAlign = opts.align || 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = opts.stroke != null ? opts.stroke : size * 0.16;
    ctx.strokeStyle = opts.strokeColor || '#0b0b10';
    if (ctx.lineWidth > 0) ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  // Draws a row of differently coloured text runs, centred on x.
  SQ.richLine = function (ctx, runs, x, y, size) {
    ctx.save();
    ctx.font = `${size}px ${SQ.fontDisplay}`;
    ctx.textBaseline = 'middle';
    const widths = runs.map((r) => ctx.measureText(r.t).width);
    const total = widths.reduce((a, b) => a + b, 0);
    let cx = x - total / 2;
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.16;
    ctx.strokeStyle = '#0b0b10';
    runs.forEach((r, i) => {
      ctx.textAlign = 'left';
      ctx.strokeText(r.t, cx, y);
      ctx.fillStyle = r.c;
      ctx.fillText(r.t, cx, y);
      cx += widths[i];
    });
    ctx.restore();
    return total;
  };

  SQ.fitSize = function (ctx, runs, maxW, size) {
    ctx.font = `${size}px ${SQ.fontDisplay}`;
    const w = runs.reduce((a, r) => a + ctx.measureText(r.t).width, 0);
    return w > maxW ? Math.floor((size * maxW) / w) : size;
  };

  SQ.fmtTime = function (s) {
    s = Math.max(0, Math.ceil(s));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
})();
