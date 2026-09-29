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
| Weapon Brawl | Every square gets its own weapon: sword, axe, hammer, spear, daggers, flail, bow or boomerang. Every hit levels the weapon up (longer blades, bigger heads, more daggers, faster arrows). Sometimes everyone gets the same weapon. Last square standing. |
| Bounce Brawl | No weapons and no power-ups: every wall bounce makes a square a little bigger (up to about twice its size), and bigger squares hit harder. Last square standing. |
| Marble Race | Squares tumble down a tall random obstacle course: peg fields, zigzag ramps, spinning bars, pinball bumpers and funnels. The camera follows the leader down. First to the bottom wins. |
| King of the Hill | Whoever is closest to the centre of the zone scores. Squares charge each other to shove rivals out; hard hits leave them dizzy. The zone moves every few seconds and a shockwave sometimes blasts everyone out. |

### Power-ups

Items spawn at random spots and only work when a square touches them. They blink before they disappear.

| Mode | Items |
| --- | --- |
| Color Chase | ⚡ Speed · 🛡️ Shield (can't be tagged) · 💣 Bomb (tags everyone nearby) · ❄️ Freeze (freezes your hunters) · 🧲 Magnet (pulls prey in) · 🍄 Mega (grow bigger) |
| Tile Wars | 🍄 Grow (10s) · 👻 Ghost (drift through everything, then pop and paint) · Turret (placed on the board, sprays tile-stealing shots for 8s) · 💣 Bomb (carried with a lit fuse, then explodes) · Grenade (held, then thrown in an arc at enemy ground) · ⚡ Speed · ✨ Multiball · 🖌️ Paint Rush · ❄️ Freeze · 🛡️ Lock |
| Domain Duel | ❤️ Heal · 🛡️ Shield (invincible anywhere) · ⚡ Speed · 🌐 Expansion (instant 7×7 domain) · 🔥 Rage (double damage) · 🍄 Mega · ❄️ Freeze |
| Square Race | ⚡ Boost · 🔪 Knife · 🍌 Banana · ❄️ Freeze · 🌀 Portal (jump ahead). Items reappear somewhere new after pickup. |
| Weapon Brawl | ⚔️ Weapon crate (new weapon, or +3 levels if it's yours) · ❤️ Heal · ⚡ Speed · 🌵 Spikes · 🛡️ Shield · 🍄 Mega (bigger and hits harder) · 💣 Bomb |

**Tile Wars random events.** Every so often (not every match, and never in the first or last
seconds) a roulette spins and lands on an event: Color Swap, Place Swap, Robin Hood (the leader
gives tiles to last place), Tile Rain, Speed Frenzy, Giant Mode, Item Rain or Mirror Flip. The
last 10 seconds speed everyone up.

**Tournament.** Pick 🏆 Tournament to run the Trinity Cup: 8 colors play 1v1 matches (quarterfinals,
semifinals, final) in random modes, with the bracket shown between matches and a champion screen
at the end. With recording on, every match is saved as its own part, ready for a multi-part series.

**Random** picks a mode and all its settings from the seed. Type a seed to replay a match exactly.

## Music and sound

All built-in music is synthesized live by the game (`js/audio.js`): 12 library tracks in
different styles (synthwave, chiptune, lo-fi, house, epic, bubblegum, dungeon, trap),
plus a generator that writes a new track every time. None of it is sampled from existing
songs, so it is safe to post. The music gets more intense as a match gets close.

Every bounce, tile steal and tag plays the next note of an arpeggio over the chord the music
is on, so a busy match plays a melody that fits the song. Chase combos climb up the scale.

You can also add your own audio files. Only use music you have the rights to.

## Personalities and voice lines

Every color has a personality that changes how it plays and what it says, with its own babble voice:

| Color | Personality | How it plays |
| --- | --- | --- |
| Red | 🔥 Hothead | a little faster, chases and charges hard, rarely runs |
| Green | 🌿 Chill | a little slower, relaxed, polite |
| Blue | 🤓 Brainiac | steady, goes for power-ups |
| Yellow | ⚡ Hyper | fastest, twitchy, loud |
| Purple | 👑 Royal | dramatic, a bit aggressive |
| Cyan | 😰 Scaredy | runs away from everything |
| Orange | 🤡 Clown | wanders randomly, chaotic |
| Pink | 💖 Sweetheart | friendly, apologises when it hits you |

They talk at the start, when they hit or get hit, pick up items, take the lead, win or get knocked
out, and now and then just chat. Speech bubbles are outlined in the speaker's color. Turn them off
with "Voice lines". The differences are small multipliers, so every color can still win.

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
