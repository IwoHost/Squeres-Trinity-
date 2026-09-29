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

  // ----- restore preferences -----
  const prefs = store.get('prefs', {});
  Object.assign(game.opts, { mode: prefs.mode || 'random', memes: prefs.memes != null ? prefs.memes : 1, speed: prefs.speed || 1, music: prefs.music || 'shuffle', record: prefs.record != null ? prefs.record : true, autoNext: !!prefs.autoNext });
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
  $('auto').checked = game.opts.autoNext;
  if (prefs.musicVol != null) $('music-vol').value = prefs.musicVol;
  if (prefs.sfxVol != null) $('sfx-vol').value = prefs.sfxVol;
  game.audio.musicVol = +$('music-vol').value;
  game.audio.sfxVol = +$('sfx-vol').value;

  const save = () =>
    store.set('prefs', { ...game.opts, musicVol: +$('music-vol').value, sfxVol: +$('sfx-vol').value });

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
    game.newMatch(seed);
    $('seed').value = '';
    $('seed').placeholder = String(game.seed);
    $('overlay').hidden = true;
    $('save').hidden = true;
    if (game.recorder.active) status('Recording this match…');
    else if (game.opts.record && !game.recorder.supported) status('This browser cannot record video. Try Chrome, Edge or Firefox.', 'bad');
    else status(game.opts.record ? 'The next match will be recorded.' : 'Recording is off.');
  }
  $('start').addEventListener('click', () => start());
  $('overlay-start').addEventListener('click', () => start());
  $('replay').addEventListener('click', () => start(game.seed != null ? game.seed : undefined));

  game.on('done', ({ winner, video }) => {
    $('overlay-title').textContent = winner ? winner.text : 'Match over';
    $('overlay-text').textContent = 'Ready for another one?';
    $('overlay-start').textContent = 'Next match';
    $('overlay').classList.add('compact');
    $('overlay').hidden = !!game.opts.autoNext;
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
  $('save').addEventListener('click', async () => {
    const v = game.video;
    if (!v) return;
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
    status('Video saved to your downloads.');
  });

  function status(text, tone) {
    const el = $('rec-status');
    el.textContent = text;
    if (tone) el.dataset.tone = tone;
    else delete el.dataset.tone;
  }

  // keyboard: space or enter starts a match when nothing is focused
  document.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && document.activeElement === document.body) {
      e.preventDefault();
      start();
    }
  });
})();
