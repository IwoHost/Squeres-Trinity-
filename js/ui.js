// Wires the control desk to the game.
(function () {
  const SQ = window.SQ;
  const $ = (id) => document.getElementById(id);
  const game = new SQ.Game($('screen'));
  SQ.game = game;

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('sqt.' + k);
        return v == null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('sqt.' + k, JSON.stringify(v));
      } catch (e) {}
    },
  };

  // ----- music list -----
  function fillMusic(selected) {
    const sel = $('music');
    sel.innerHTML = '';
    const add = (value, label) => {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = label;
      sel.appendChild(o);
    };
    add('shuffle', 'Shuffle the library');
    add('generate', 'Generate a brand new track');
    game.audio.library().forEach((t) => add(t.id, `${t.name} · ${t.style}`));
    sel.value = selected || game.opts.music;
  }

  // ----- win stats, kept in this browser -----
  const MODE_NAMES = { chase: 'Color Chase', territory: 'Tile Wars', domain: 'Domain Duel', race: 'Square Race', brawl: 'Weapon Brawl', bounce: 'Bounce Brawl', marble: 'Marble Race', hill: 'King of the Hill' };
  let stats = store.get('stats', { total: 0, modes: {} });
  const statsSel = $('stats-mode');
  const fillStatsModes = () => {
    statsSel.innerHTML = '';
    const add = (v, label) => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = label;
      statsSel.appendChild(o);
    };
    add('all', 'All modes');
    Object.keys(MODE_NAMES).forEach((k) => add(k, MODE_NAMES[k]));
  };
  fillStatsModes();
  function renderStats() {
    const pick = statsSel.value || 'all';
    const rows = {};
    SQ.TEAMS.forEach((t) => (rows[t.base] = { p: 0, w: 0, t: 0 }));
    for (const [mode, byColor] of Object.entries(stats.modes)) {
      if (pick !== 'all' && pick !== mode) continue;
      for (const [c, r] of Object.entries(byColor)) {
        if (!rows[c]) continue;
        rows[c].p += r.p;
        rows[c].w += r.w;
        rows[c].t += r.t;
      }
    }
    const list = SQ.TEAMS.map((team) => ({ team, ...rows[team.base] })).sort((a, b) => b.w - a.w || b.w / (b.p || 1) - a.w / (a.p || 1));
    const maxW = Math.max(1, ...list.map((r) => r.w));
    const table = $('stats-table');
    table.innerHTML = '<thead><tr><th>Color</th><th>Wins</th><th>Played</th><th>Win %</th><th>Ties</th></tr></thead>';
    const body = document.createElement('tbody');
    for (const r of list) {
      const tr = document.createElement('tr');
      const name = document.createElement('td');
      const sw = document.createElement('i');
      sw.style.background = r.team.color;
      name.append(sw, document.createTextNode(r.team.name));
      const wins = document.createElement('td');
      const bar = document.createElement('span');
      bar.className = 'bar';
      bar.style.width = `${Math.round((r.w / maxW) * 40)}px`;
      wins.append(bar, document.createTextNode(String(r.w)));
      const cell = (v) => {
        const td = document.createElement('td');
        td.textContent = v;
        return td;
      };
      tr.append(name, wins, cell(r.p), cell(r.p ? `${Math.round((r.w / r.p) * 100)}%` : '–'), cell(r.t));
      body.appendChild(tr);
    }
    table.appendChild(body);
    $('stats-note').textContent = `${stats.total} match${stats.total === 1 ? '' : 'es'} counted on this device.`;
  }
  statsSel.addEventListener('change', renderStats);
  game.on('result', (r) => {
    stats.total++;
    const byColor = (stats.modes[r.mode] = stats.modes[r.mode] || {});
    for (const c of r.teams) {
      const row = (byColor[c] = byColor[c] || { p: 0, w: 0, t: 0 });
      row.p++;
      if (r.winner === c) row.w++;
      if (r.tied && r.tied.includes(c)) row.t++;
    }
    store.set('stats', stats);
    renderStats();
  });
  let resetArmed = false;
  $('stats-reset').addEventListener('click', () => {
    if (!resetArmed) {
      resetArmed = true;
      $('stats-reset').textContent = 'Tap again to reset';
      setTimeout(() => {
        resetArmed = false;
        $('stats-reset').textContent = 'Reset stats';
      }, 3000);
      return;
    }
    resetArmed = false;
    stats = { total: 0, modes: {} };
    store.set('stats', stats);
    $('stats-reset').textContent = 'Reset stats';
    renderStats();
  });

  // ----- custom names -----
  const names = store.get('names', {});
  SQ.starred = store.get('stars', []).filter((b) => SQ.TEAMS.some((t) => t.base === b));
  const applyNames = () => {
    SQ.TEAMS.forEach((t) => (t.name = (names[t.base] || '').trim() || t.base));
    game.headerCache = null;
  };
  applyNames();
  SQ.TEAMS.forEach((t) => {
    const row = document.createElement('div');
    row.className = 'name-row';
    const sw = document.createElement('i');
    sw.style.background = t.color;
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.id = 'name-' + t.base.toLowerCase();
    inp.maxLength = 10;
    inp.placeholder = t.base;
    inp.value = names[t.base] || '';
    inp.autocomplete = 'off';
    inp.setAttribute('aria-label', `Name for ${t.base}`);
    inp.addEventListener('input', () => {
      names[t.base] = inp.value.replace(/[^\p{L}\p{N} _.-]/gu, '');
      store.set('names', names);
      applyNames();
      renderStats();
      renderLore();
    });
    const star = document.createElement('label');
    star.className = 'star';
    star.title = `Always include ${t.base}`;
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = 'star-' + t.base.toLowerCase();
    cb.checked = SQ.starred.includes(t.base);
    cb.setAttribute('aria-label', `Always include ${t.base}`);
    cb.addEventListener('change', () => {
      SQ.starred = SQ.starred.filter((b) => b !== t.base);
      if (cb.checked) SQ.starred.push(t.base);
      store.set('stars', SQ.starred);
    });
    const glyph = document.createElement('span');
    glyph.textContent = '★';
    star.append(cb, glyph);
    row.append(sw, inp, star);
    $('names').appendChild(row);
  });

  renderStats();

  // ----- lore -----
  function renderLore() {
    const box = $('lore');
    box.innerHTML = '';
    for (const para of SQ.WORLD_LORE) {
      const p = document.createElement('p');
      p.textContent = para;
      box.appendChild(p);
    }
    for (const t of SQ.TEAMS) {
      const L = SQ.LORE[t.base];
      const P = SQ.persona(t);
      if (!L) continue;
      const d = document.createElement('details');
      const sum = document.createElement('summary');
      const sw = document.createElement('i');
      sw.style.background = t.color;
      const nm = document.createElement('b');
      nm.textContent = `${t.name} · ${P.title}`;
      const sub = document.createElement('small');
      sub.textContent = `from ${L.sector}`;
      sum.append(sw, nm, sub);
      const body = document.createElement('div');
      body.className = 'body';
      const add = (cls, text) => {
        const p = document.createElement('p');
        if (cls) p.className = cls;
        p.textContent = text;
        body.appendChild(p);
      };
      add('meta', `Home: ${L.home}.`);
      add('', L.story);
      const rival = SQ.TEAMS.find((x) => x.base === L.rival);
      add('meta', `Rival: ${rival ? rival.name : L.rival}, who ${L.rivalWhy}.`);
      d.append(sum, body);
      box.appendChild(d);
    }
  }
  renderLore();

  // ----- restore preferences -----
  const prefs = store.get('prefs2', {});
  Object.assign(game.opts, { mode: prefs.mode || 'random', memes: prefs.memes != null ? prefs.memes : 1, speed: prefs.speed || 1, music: prefs.music || 'shuffle', record: prefs.record != null ? prefs.record : true, autoNext: !!prefs.autoNext, quality: prefs.quality || 'auto', voices: prefs.voices !== false, reel: prefs.reel !== false });
  if (game.opts.music.startsWith('up')) game.opts.music = 'shuffle';
  fillMusic();
  const setRadio = (name, value) => {
    const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (el) el.checked = true;
  };
  setRadio('mode', game.opts.mode);
  setRadio('memes', game.opts.memes);
  setRadio('speed', game.opts.speed);
  $('record').checked = game.opts.record;
  $('quality').value = game.opts.quality;
  game.setQuality(game.opts.quality);
  $('auto').checked = game.opts.autoNext;
  $('voices').checked = game.opts.voices;
  $('reel').checked = game.opts.reel;
  $('reel').addEventListener('change', (e) => ((game.opts.reel = e.target.checked), save()));
  $('voices').addEventListener('change', (e) => ((game.opts.voices = e.target.checked), save()));
  if (prefs.musicVol != null) $('music-vol').value = prefs.musicVol;
  if (prefs.sfxVol != null) $('sfx-vol').value = prefs.sfxVol;
  game.audio.musicVol = +$('music-vol').value;
  game.audio.sfxVol = +$('sfx-vol').value;

  const save = () =>
    store.set('prefs2', { ...game.opts, musicVol: +$('music-vol').value, sfxVol: +$('sfx-vol').value });

  document.querySelectorAll('input[name="mode"]').forEach((el) => el.addEventListener('change', () => ((game.opts.mode = el.value), save())));
  document.querySelectorAll('input[name="memes"]').forEach((el) => el.addEventListener('change', () => ((game.opts.memes = +el.value), save())));
  document.querySelectorAll('input[name="speed"]').forEach((el) => el.addEventListener('change', () => ((game.opts.speed = +el.value), save())));
  $('music').addEventListener('change', (e) => {
    game.opts.music = e.target.value;
    save();
    // preview the new track straight away when a match is running
    if (game.phase === 'play' || game.phase === 'countdown') {
      game.track = game.audio.pickTrack(game.opts.music);
      game.audio.playTrack(game.track);
      game.trackToast = 3;
    }
  });
  $('music-vol').addEventListener('input', (e) => (game.audio.setMusicVolume(+e.target.value), save()));
  $('sfx-vol').addEventListener('input', (e) => (game.audio.setSfxVolume(+e.target.value), save()));
  $('record').addEventListener('change', (e) => {
    game.opts.record = e.target.checked;
    save();
    status(game.opts.record ? 'The next match will be recorded.' : 'Recording is off.');
  });
  $('quality').addEventListener('change', (e) => {
    game.opts.quality = e.target.value;
    save();
    // switching mid-recording would break the video, so it waits for the next match
    if (!game.recorder.active) game.setQuality(game.opts.quality);
  });
  $('auto').addEventListener('change', (e) => ((game.opts.autoNext = e.target.checked), save()));

  $('upload').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    let last = null;
    for (const f of files) {
      try {
        last = await game.audio.addUpload(f);
      } catch (err) {
        status(`Could not read ${f.name}. Try an MP3, OGG or WAV file.`, 'bad');
      }
    }
    if (last) {
      game.opts.music = last;
      fillMusic(last);
      status(`Added ${files.length} track${files.length > 1 ? 's' : ''} to the library.`);
    }
    e.target.value = '';
  });

  // ----- matches -----
  function start(seed) {
    const typed = $('seed').value.trim();
    if (seed == null && typed && /^\d+$/.test(typed)) seed = +typed;
    if (game.opts.mode === 'tournament') game.newTournament(seed);
    else game.newMatch(seed);
    keepAwake();
    $('parts').innerHTML = '';
    $('parts').hidden = true;
    $('seed').value = '';
    $('seed').placeholder = String(game.seed);
    $('overlay').hidden = true;
    $('save').hidden = true;
    if (game.recorder.active) status(game.tour ? 'Recording the tournament. Each match is saved as its own part.' : 'Recording this match…');
    else if (game.opts.record && !game.recorder.supported) status('This browser cannot record video. Try Chrome, Edge or Firefox.', 'bad');
    else status(game.opts.record ? 'The next match will be recorded.' : 'Recording is off.');
  }
  $('start').addEventListener('click', () => start());
  $('overlay-start').addEventListener('click', () => start());
  $('replay').addEventListener('click', () => start(game.seed != null ? game.seed : undefined));

  // ----- clip farm: back-to-back matches, each saved as its own file -----
  const farm = { on: false, dir: null, saved: 0, max: 30 };
  if (!window.showDirectoryPicker) {
    $('farm-folder').hidden = true;
  }
  $('farm-folder').addEventListener('click', async () => {
    try {
      farm.dir = await window.showDirectoryPicker({ id: 'squares-clips', mode: 'readwrite' });
      farmStatus(`Clips go to the folder "${farm.dir.name}".`);
    } catch (e) {
      if (e && e.name !== 'AbortError') farmStatus('This browser would not open a folder. Clips will go to Downloads.', 'bad');
    }
  });
  $('farm-start').addEventListener('click', () => {
    if (farm.on) return stopFarm('Clip farm stopped.');
    const max = parseInt($('farm-max').value, 10);
    farm.max = max > 0 ? max : Infinity;
    farm.saved = 0;
    farm.on = true;
    game.opts.record = true;
    $('record').checked = true;
    game.opts.autoNext = false; // the farm starts the next match itself, after saving
    $('auto').checked = false;
    $('farm-start').textContent = 'Stop clip farm';
    farmStatus('Recording clip 1…');
    if (game.phase === 'idle' || game.phase === 'done') start();
  });
  function stopFarm(msg) {
    farm.on = false;
    $('farm-start').textContent = 'Start clip farm';
    farmStatus(msg);
  }
  function farmStatus(text, tone) {
    const el = $('farm-status');
    el.textContent = text;
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }
  function clipName(v) {
    const n = String(farm.saved + 1).padStart(3, '0');
    return `${n}-${v.name.replace(/^squares-trinity-/, '')}`;
  }
  async function farmSave(v) {
    const name = clipName(v);
    try {
      if (farm.dir) {
        const fh = await farm.dir.getFileHandle(name, { create: true });
        const w = await fh.createWritable();
        await w.write(v.blob);
        await w.close();
      } else await saveVideo(Object.assign({}, v, { name }), true);
      farm.saved++;
      v.blob = null; // free the memory once it is on disk
      return true;
    } catch (e) {
      farmStatus(`Could not save ${name}. The farm stopped.`, 'bad');
      stopFarm(`Could not save ${name}. The farm stopped.`);
      return false;
    }
  }

  game.on('done', async ({ winner, video }) => {
    if (farm.on) {
      if (video && !(await farmSave(video))) return;
      game.video = null;
      $('save').hidden = true;
      if (farm.saved >= farm.max) return stopFarm(`Done: saved ${farm.saved} clips.`);
      farmStatus(`Saved ${farm.saved} clip${farm.saved === 1 ? '' : 's'}. Recording the next one…`);
      setTimeout(() => farm.on && start(), 2500);
      return;
    }
    $('overlay-title').textContent = winner ? winner.text : 'Match over';
    $('overlay-text').textContent = 'Ready for another one?';
    $('overlay-start').textContent = game.tour ? 'New tournament' : 'Next match';
    $('overlay').classList.add('compact');
    $('overlay').hidden = !!game.opts.autoNext;
    if (game.tour && game.videos.length) status(`Tournament recorded in ${game.videos.length} parts. Save the ones you want.`);
    if (video) {
      const mb = (video.blob.size / 1048576).toFixed(1);
      $('save').hidden = false;
      $('save').textContent = `Save video (${video.ext.toUpperCase()}, ${mb} MB)`;
      status('Match recorded. Save it before the next one starts.');
    }
  });

  // ----- recording badge -----
  setInterval(() => {
    const on = game.recorder.active;
    $('rec-badge').hidden = !on;
    if (on) $('rec-time').textContent = SQ.fmtTime((performance.now() - game.recorder.startedAt) / 1000 - 0.5);
  }, 250);

  // ----- saving -----
  // one save button per tournament part
  game.on('part', async (v) => {
    if (farm.on) {
      if (await farmSave(v)) farmStatus(`Saved ${farm.saved} clip${farm.saved === 1 ? '' : 's'}. Recording the next one…`);
      return;
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-save';
    b.textContent = `Save part ${v.part}`;
    b.title = `${(v.blob.size / 1048576).toFixed(1)} MB`;
    b.addEventListener('click', () => saveVideo(v));
    $('parts').appendChild(b);
    $('parts').hidden = false;
    status(`Part ${v.part} recorded.`);
  });

  $('save').addEventListener('click', () => saveVideo(game.video));

  async function saveVideo(v, quiet) {
    if (!v || !v.blob) return;
    // Inside a Claude artifact, files are offered through the downloads capability.
    if (window.claude && typeof window.claude.use === 'function') {
      try {
        const dl = await window.claude.use('downloads');
        if (dl) {
          await dl.save({ filename: v.name, data: v.blob });
          status('Video saved.');
          return;
        }
      } catch (err) {
        if (err && err.code === 'declined') return status('Save cancelled.');
        if (err && err.code === 'rejected_extension') return status('This viewer does not accept this video format.', 'bad');
      }
    }
    const url = URL.createObjectURL(v.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = v.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    if (!quiet) status('Video saved to your downloads.');
  }

  function status(text, tone) {
    const el = $('rec-status');
    el.textContent = text;
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  // ----- full screen -----
  const stage = $('stage');
  let barTimer = null;
  function showBar() {
    $('fs-bar').classList.remove('idle-hide');
    clearTimeout(barTimer);
    barTimer = setTimeout(() => $('fs-bar').classList.add('idle-hide'), 2800);
  }
  function enterFull() {
    stage.classList.add('theater');
    document.body.classList.add('theater-on');
    // Native full screen hides the browser bars where it is allowed (not on iPhone);
    // the theater layout above works either way.
    const root = document.documentElement;
    const req = root.requestFullscreen || root.webkitRequestFullscreen;
    if (req && !fullEl()) {
      try {
        const pr = req.call(root, { navigationUI: 'hide' });
        if (pr && pr.catch) pr.catch(() => {});
      } catch (e) {}
    }
    keepAwake();
    showBar();
  }
  function exitFull() {
    stage.classList.remove('theater');
    document.body.classList.remove('theater-on');
    if (fullEl()) {
      const ex = document.exitFullscreen || document.webkitExitFullscreen;
      try {
        const pr = ex.call(document);
        if (pr && pr.catch) pr.catch(() => {});
      } catch (e) {}
    }
  }
  const fullEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  const onFsChange = () => {
    if (!fullEl() && stage.classList.contains('theater')) {
      stage.classList.remove('theater');
      document.body.classList.remove('theater-on');
    }
  };
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
  $('fs-toggle').addEventListener('click', enterFull);
  $('fs-open').addEventListener('click', enterFull);
  $('fs-exit').addEventListener('click', exitFull);
  $('fs-next').addEventListener('click', () => {
    start();
    showBar();
  });
  $('screen').addEventListener('pointerdown', () => {
    if (stage.classList.contains('theater')) showBar();
  });
  $('screen').addEventListener('dblclick', () => (stage.classList.contains('theater') ? exitFull() : enterFull()));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && stage.classList.contains('theater')) exitFull();
    if ((e.key === 'f' || e.key === 'F') && document.activeElement === document.body) stage.classList.contains('theater') ? exitFull() : enterFull();
  });

  // Keep the screen awake while matches play, where the browser allows it.
  let wakeLock = null;
  async function keepAwake() {
    try {
      if (navigator.wakeLock && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => (wakeLock = null));
      }
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && game.phase !== 'idle') keepAwake();
  });

  // keyboard: space or enter starts a match when nothing is focused
  document.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && document.activeElement === document.body) {
      e.preventDefault();
      start();
    }
  });
})();
