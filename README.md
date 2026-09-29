# Squares Trinity

A square battle simulator for making short videos. Every match is randomly generated,
has an intro, a countdown, camera zooms, slow motion, memes and a winner outro, and can
be saved as a 1080×1920 video with sound, ready for Reels, Shorts or TikTok.

## Play

- Open `index.html` in a browser, or
- Download `dist/squares-trinity.html` (everything in one file, works offline) and open it on your phone, or
- Turn on GitHub Pages (Settings → Pages → Source: GitHub Actions). The included workflow publishes the game on every push to `main`.

Tap the full-screen button in the corner of the game (or double-tap it, or press F) to fill
the screen. The whole 9:16 frame always stays visible. Tap the game to bring back the
controls.

## Modes

| Mode | What happens |
| --- | --- |
| Color Chase | Red chases Green, Green chases Blue, Blue chases Red (3 to 5 colors). A tagged square switches color. A storm shrinks the arena late in the match. |
| Tile Wars | Pong-wars style. Each color's square bounces around and steals every tile it hits. Most tiles when the timer ends wins. |
| Domain Duel | Big squares paint the floor. On their own settled paint they cannot be hurt. Segmented health bars and crits. |
| Square Race | A random maze with breakable brick gates. The camera follows the leaders. |
| Sword Brawl | Bouncing squares with spinning swords that grow with every hit, or a variant where every bounce makes you bigger. Last square standing. |

### Power-ups

Items spawn at random spots and only work when a square touches them. They blink before they disappear.

| Mode | Items |
| --- | --- |
| Color Chase | ⚡ Speed · 🛡️ Shield (can't be tagged) · 💣 Bomb (tags everyone nearby) · ❄️ Freeze (freezes your hunters) · 🧲 Magnet (pulls prey in) · 🍄 Mega (grow bigger) |
| Tile Wars | ⚡ Speed · 🍄 Mega · ✨ Multiball (an extra square) · 💣 Bomb (paints a 5×5 block) · ❄️ Freeze (stops the others) · 🖌️ Paint Rush (plow through enemy tiles) · 🛡️ Lock (your tiles can't be stolen for 5s) |
| Domain Duel | ❤️ Heal · 🛡️ Shield (invincible anywhere) · ⚡ Speed · 🌐 Expansion (instant 7×7 domain) · 🔥 Rage (double damage) · 🍄 Mega · ❄️ Freeze |
| Square Race | ⚡ Boost · 🔪 Knife · 🍌 Banana · ❄️ Freeze · 🌀 Portal (jump ahead). Items reappear somewhere new after pickup. |
| Sword Brawl | 🗡️ Sword · ❤️ Heal · ⚡ Speed · 🌵 Spikes · 🛡️ Shield · 🍄 Mega (bigger and hits harder) · 💣 Bomb |

**Random** picks a mode and all its settings from the seed. Type a seed to replay a match exactly.

## Music and sound

All built-in music is synthesized live by the game (`js/audio.js`): 12 library tracks in
different styles (synthwave, chiptune, lo-fi, house, epic, bubblegum, dungeon, trap),
plus a generator that writes a new track every time. None of it is sampled from existing
songs, so it is safe to post. The music gets more intense as a match gets close.

Every bounce, tile steal and tag plays the next note of an arpeggio over the chord the music
is on, so a busy match plays a melody that fits the song. Chase combos climb up the scale.

You can also add your own audio files. Only use music you have the rights to.

## Memes

With memes on, squares react with captions ("skill issue", "it's so over", "we're so back",
"6 7", "aura +1000"…), streaks turn a square into 🗿 with a vine-boom, and the winner gets
pixel "deal with it" sunglasses. Everything is drawn in code, so no copyrighted GIFs are used.
**Chaos** makes all of it more frequent.

## Video export

Keep "Record each match with sound" on. **Quality** sets the resolution: Auto uses 720p on
phones (smooth) and 1080p on computers; you can force either one. It changes at the next match. When the match ends, press **Save video**. Chrome and
Edge save MP4 where supported, otherwise WebM; Firefox saves WebM. Recording uses the browser's
built-in `MediaRecorder`, so no upload or server is involved.

## Code

- `js/core.js`: random numbers, teams and the square renderer (faces, moods, sunglasses)
- `js/audio.js`: music generator and sound effects
- `js/fx.js`: camera, particles, speech bubbles, banners, confetti
- `js/modes/*.js`: one file per mode
- `js/game.js`: match director (intro → countdown → play → finale → outro) and recorder
- `js/ui.js`: controls
- `tools/build_single.py`: bundles everything into `dist/squares-trinity.html`

To add a mode, create `js/modes/yourmode.js` with a class that has `teams`, `rules`, `update(dt)`,
`draw(ctx)`, `drawHud(ctx, y)` and sets `winner` when the match is decided, register it in
`SQ.modes`, add it to `SQ.MODE_IDS` in `js/game.js` and add a script tag to `index.html`.
