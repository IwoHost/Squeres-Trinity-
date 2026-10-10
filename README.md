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
| Bounce Brawl | No weapons and no power-ups: every wall bounce makes a square 10% bigger, with no cap (only the walls stop them), and bigger squares hit harder. Last square standing. |
| Marble Race | Squares tumble down a tall random obstacle course: peg fields, steep zigzag ramps, spinning bars, pinball bumpers, funnels and trapdoor floors that take turns dropping open. Boost rings launch you, mystery portals send you ahead (SHORTCUT!) or back up (UNLUCKY!), and rising lava chases the pack and eliminates stragglers. The camera follows the leader. First to the bottom wins. |
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

## Lore

The squares live in the Grid, ruled by the Frame, a glowing border that sees everything. Every
cycle each of the eight Sectors sends one square into the Trinity Games (the tournament). Each
color has a home Sector, a backstory and a rival, readable in the Lore panel, and some of their
voice lines refer to it. Red (DoucheCube, the mascot) is from Ember (foundries), Green (Mossimo) from Moss (greenhouses),
Blue (Professor Cache) from Cache (archives), Yellow (VoltCube) from Volt (power plants), Purple
(Cubert) from the Crown Quarter (old royals), Cyan (Shivers) from Coolant (freezing vents), Orange
(Carnie) from Carnival (the broadcast district) and Pink (Sugarcube) from Candy (sweet factories).
There is no ninth square.

## Posters

The Posters panel has 11 propaganda posters from the Grid, starring DoucheCube, the mascot: "DoucheCube
wants you", "Volunteer!", "Tune in every cycle", "Follow for the Games", "Send this to a friend who
would lose", "The Frame is watching", "Pick a color, pick a side", "Wanted: Cyan", "The lava is
random", "Obey the bounce" and "Sweets are mandatory". They are 1080×1350 (the 4:5 feed size on
Instagram and Facebook). Type your handle once and it is printed on every poster; tap a poster
to save it as a PNG. Custom names show up on the posters too. Ready-made copies with the default
handle are in `posters/`.

## Custom names

In the Names panel you can rename any color (up to 10 characters), for example to a friend's
nickname. The name is used everywhere: rules, intro, scoreboard, winner text and the tournament
bracket. Tick the star next to a color to put it in every match. Personalities stay with the color.

## Win stats

The Win stats panel next to the game counts wins, matches played, win rate and ties for every
color, overall or per mode. It is stored in this browser only and can be reset. Draws (the last
squares going down together, or an exact tie on points) count as ties; in a tournament a coin flip
decides who advances.

## Memes

With memes on, squares react with captions ("skill issue", "it's so over", "we're so back",
"6 7", "aura +1000"…), a 5-kill streak makes a square glow with a vine-boom, and the winner gets
pixel "deal with it" sunglasses. Everything is drawn in code, so no copyrighted GIFs are used.
**Chaos** makes all of it more frequent.

## Screen: fish-eye, CRT and static

The Look tab gives the game square a fish-eye lens with a light blue glass shade, and a CRT look
(scanlines, a phosphor grid, glow on bright things, a slight color fringe). The text around the
square stays flat. Both are in the recorded video. They need WebGL; without it the static still
shows as grain.

"Glitch" adds a glitch look that is always there: colors slightly apart, a thin tracking line
crawling down, and every few seconds a short hit where slices of the picture jump sideways (more
often the higher it is). Only positions move, never brightness, so it does not flash.

"Camera overlay" makes the match look like camera footage: viewfinder corners, a slowly breathing
REC dot, the camera number, signal bars that drop as the static of the series climbs (none during
the reboot event), and a running timecode with the cycle number. While the grey square is in the
picture the camera number reads 09; the match info notes when.

The static belongs to a series, not a single video: with "Per video" set, every finished video adds
a little more, so a run of posts slowly loses its signal. Within a video it stays steady.

### Special events

On certain days the squares dress up and the screen gets a few slow decorations; the header,
file name and caption mention it too. "Special event" in the Look tab is on Auto (by today's
date) unless you pick one or turn it off; the script takes `--event`.

| Event | When | What changes |
|---|---|---|
| New Year | Dec 31 - Jan 1 | top hats, gold confetti |
| Grandma's Day | Jan 21 | round glasses and a grey bun |
| Grandpa's Day | Jan 22 | flat cap and a grey mustache |
| Valentine's Day | Feb 14 | a heart and a blush, hearts drifting up |
| Fat Thursday | Thursday before Lent (moves with Easter) | pink frosting with sprinkles |
| Women's Day | Mar 8 | tulips, falling petals |
| April Fools' Day | Apr 1 | clown noses and wigs; the header says NOTHING IS WRONG |
| Easter | Easter Saturday and Sunday | bunny ears, pastel confetti |
| Smigus-dyngus | Easter Monday | soaked squares, water drops |
| Constitution Day | May 3 | a white-red cockade, white-red confetti |
| Mother's Day | May 26 | a tulip and a little blush, falling petals |
| Children's Day | Jun 1 | propeller caps, balloons |
| Father's Day | Jun 23 | a tie and a mustache |
| Summer | Jun 24 - Aug 31 | straw hats, shades, flowers, a snorkel; warm sun glow |
| Halloween | Oct 25 - 31 | a costume per color (horns, bolts, bandages, cat ears, witch hat, vampire, pumpkin, bat wings); bats and an orange glow |
| All Saints' Day | Nov 1 - 2 | a day of remembrance: no match, see below |
| Independence Day | Nov 11 | a white-red cockade, white-red confetti |
| Birthday | Nov 29 | party hats and confetti |
| St. Nicholas Day | Dec 6 | Santa hats, snow |
| Christmas | Dec 24 - 26 | Santa hats, elf hats and antlers, snow |
| Winter | Dec 1 - Feb 28 | knitted beanies and scarves, snow |
| Friday the 13th | any Friday the 13th | a darker screen; a black cat walks past |

When two overlap, the shorter one wins (Christmas over winter, a single day over a week). During an event the top line names the edition ("HALLOWEEN EDITION"), the greeting sits in gold
at the bottom ("HAPPY HALLOWEEN"; "MERRY CHRISTMAS", "WE REMEMBER" on All Saints', "NOTHING IS WRONG"
on April Fools'), the title starts with it ("Happy Halloween. DoucheCube survives Cycle 4.") and the
caption opens with "Halloween edition." The grey square never wears a costume.

### All Saints' Day (Nov 1-2): no fighting

On All Saints' and All Souls' Day there is no match. `tools/daily.py` makes a quiet 20-second
remembrance video instead ("NO GAMES TODAY", the eight squares standing still with their eyes
closed and a candle each, "Today we remember those who are no longer with us."), with no music,
static or glitches, and the posting plan waits a day. The words are about real people, not the lore.
In the browser it is "Remembrance" under Promo video; from the script, `--promo memorial`. Matches
made on those days get no greeting, candles or holiday caption.

### Promo video: Meet the Sectors

The Video tab's "Promo video" records an introduction instead of a match, with your Look settings.
"All eight" (about 32 seconds) opens on "Eight Sectors. One comes out.", gives each square a
3-second file card (name, Sector, type, home and rival) and ends on a grid of all eight with
"Comment your color". The grid has nine places; for about a second something grey stands in the
last one and the camera reads CAM 09. Picking one square (about 13 seconds) shows its whole story
instead. Both come with a caption in the match info. From the script: `--promo all`,
`--promo each` (eight videos, one per square) or `--promo red` and so on.

### Battle damage

"Battle damage" (Look tab) has three levels: Off; Bruises only, which keeps the eye bags, bruises
and black eyes but no blood anywhere; and Full (the default), where squares show everything they
have been through:
purple bags under the eyes first, then a bruise and a black eye, then cuts that bleed down the
face, splatter and a nosebleed as they lose health, all in cartoon style. Hits spray blood away from
the hit, badly hurt squares leave a trail, and a knockout leaves a big splash; in the brawls and
Domain Duel the floor keeps every stain. In Bounce Brawl the knocked-out squares stay on the floor
as faded, X-eyed bodies in a spreading pool, so the arena fills up as the fight goes on. Modes without health only get tired eye bags as the
match goes on.

### The signal event and the hidden transmission

When the static reaches 100%, or when you press "Reboot event in next video", the next video
has the signal event: SIGNAL LOST, the match freezes, a hiss and hum take over, and after a
search one fragment of a secret message decodes out of the noise, numbered like
"FRAGMENT 07 / 15". Then the Frame reboots, the picture comes back clean and the static starts
over. Every reboot shows the next fragment, so viewers have to collect the videos and put the
message together, like an ARG. The Look tab shows the full message (you can rewrite it), how many
words each fragment has, and which fragment the next reboot will show; Back, Skip and Start over
move through them. The video name and match info say which fragment a video carried.

## Video names and match info

Every video is named after what happened in it, so it is easy to write titles later, for example:
`Cycle 12 - Marble Race - Pink beats Blue Cyan Purple - finished in 12.5s - Photo Finish - signal 36% - seed 2030.mp4`.
The cycle is the number of matches played on this device. After each match the Video panel
also shows "Match info": the same data plus every square's personality and Sector, any rivalry
that was settled, and whether the Frame rebooted. Copy it into a chat to get lore-style titles
and descriptions.

### Mysteries

Smaller secrets for people who look closely, set in the Extras part of the Look tab:

- During the signal loss every square slowly stops and stares straight out of the screen.
- A grey ninth square with no name sometimes stands in a corner of the arena for a couple of
  seconds. It is not in the lore or the stats. It appears a little more often after every reboot,
  and it always watches from a corner during the signal loss.
- One frame (about 1/15 of a second) a few seconds after the signal comes back shows a dim clue,
  like "THERE WERE NINE". Only someone going through the video frame by frame will see it. One clue
  per reboot, from a list you can edit.
- Fragments can be shown in code: letters shifted by the fragment number (fragment 7 shifts by 7),
  or letters as numbers.
- A word is hidden in the static's sound during the signal loss, readable only in a spectrogram app.
- Sometimes the seed or the song name in the corners shows something wrong for a moment, like
  "seed 3:33" or "we are listening".

The match info after each video lists every secret that happened in it, with its time in the
video.

### Flashing and flicker

Everything is kept gentle for people who are sensitive to flashing light. Screen flashes are never
brighter than 35% and come at most about twice a second. The static is fine mid-grey grain that
doesn't pulse the picture. Torn rows move about three times a second, not every frame. Warning
lights and blinking text fade slowly instead of strobing. A frame-by-frame brightness check of the
signal event, heavy static and matches full of knockouts stays under the common limit of three
flashes per second.

## Controls

The top of the control desk always has New match, Pause (also Space or P during a match), Replay,
Full screen, the speaker volume and the recording status. Pause freezes the match, its sound and
its recording, so the video just continues afterwards. The speaker volume only changes what you
hear; videos always get the full sound. The settings are in tabs: Play, Video, Look, Sound and
World (names, win stats, lore and posters). In full screen on a wide screen, a blurred copy of
the game fills the sides instead of black bars.

## Making videos in bulk

`tools/make_videos.py` plays matches and saves the videos for you, each with a `.txt` next to it:
a ready title, caption and hashtags, plus the match info (who won, what happened, any secrets and
their times). Random mode never plays the same mode twice in a row.

Setup, once (needs Python 3):

    pip install playwright
    python -m playwright install chromium

Then, from the project folder:

    python tools/make_videos.py                     5 reels, random modes, into the folder videos
    python tools/make_videos.py -n 10               10 reels
    python tools/make_videos.py -n 3 --mode marble  3 marble races
    python tools/make_videos.py --mode tournament   one tournament, every match its own part
    python tools/make_videos.py --reboot            the first video plays the reboot event

Other options: `--out FOLDER`, `--quality 720|1080`, `--no-reel`, `--speed 1|1.5|2`,
`--static 0-100`, `--per-video 0|2|4|8|15`, `--fisheye 0-100`, `--crt 0-100`,
`--words 1|2|3` (words of the message per reboot), `--fragment N` (which fragment comes next),
`--glitch 0-100`, `--overlay on|off`, `--cipher none|shift|numbers`, `--grey rare|always|off`, `--gore off|bruises|on`, `--headless`
(no window) and `--browser PATH`. The script keeps its own static level, next fragment and
cycle count between runs, so a series carries on. It plays in real time, so 10 reels take about
5 minutes; leave the window alone while it runs.

### Birthday videos: tools/birthday.py

DoucheCube wishes a friend happy birthday by name, in Polish or English, with a voice: party hat,
sunglasses, a talking mouth, confetti, the other seven squares joining in, a cake, about 30 seconds
at 1080p. `python tools/birthday.py Szymon --lang pl` makes one now (`--say` sets how the voice
pronounces the name, useful in English). Put friends in `tools/my_birthdays.txt` (private, never
uploaded), one per line: `29.11  Szymon  pl`. Then `--check` makes the videos for today's birthdays
into `posts/birthdays`, `--list` shows who is next, and `--install-timer` (Linux) checks every
morning at 8:00 by itself and shows a notification. `tools/daily.py` also runs the check.
Needs `pip install --user numpy imageio-ffmpeg playwright` and, for the voice, the espeak-ng program
(Bazzite: `brew install espeak-ng`); without it the video is made without the voice.

### One command a day: tools/daily.py

`python tools/daily.py` (or `make_today.bat` on Windows, `./make_today.sh` on Linux and Mac) makes the next day of the
posting plan: day 0 is the Meet the Sectors promo, days 1-7 the warm-up week with a cube spotlight
each day, days 8-37 the five chapters. On days with a cube spotlight, the spotlight is joined onto the end of the match, so the day is one
video (the two parts stay in `parts/`). Each day lands in `posts/dayNN` with the videos, their
captions and a `POST.txt` with every title, caption and hashtag of the day. `--status` shows where
you are, `--day N` makes a given day. Your look is set at the top of the script.

`--youtube`, `--instagram` and `--facebook` also post the day's videos there (Instagram and
Facebook as Reels). `--at 18:00` publishes at that time instead: YouTube and Facebook take the
videos right away and schedule them; Instagram has no scheduling, so the script waits until then
and posts (leave the window open). Put the platforms in `UPLOAD_TO` at the top of `tools/daily.py`
and a plain double-click posts everywhere. Every post is noted in the day's `uploaded.json`, so
`--upload-only` can retry a failed upload without posting anything twice. Each platform needs a
one-time setup with its official API: YouTube in `tools/youtube_upload.py`, Instagram and Facebook
(a business Instagram linked to a Facebook page) in `tools/meta_upload.py`. TikTok is still by
hand from `POST.txt`.

In the browser, the clip farm (Video tab) does the same and also saves a caption file with each
clip, and the Match info box after a match starts with the title and caption.

## Video export

Keep "Record each match with sound" on. **Quality** sets the resolution: Auto uses 720p on
phones (smooth) and 1080p on computers; you can force either one. It changes at the next match. When the match ends, press **Save video**. Chrome and
Edge save MP4 where supported, otherwise WebM; Firefox saves WebM. Recording uses the browser's
built-in `MediaRecorder`, so no upload or server is involved.

### MP4 in Firefox

Chrome and Edge record MP4 directly. Firefox can only record WebM, which many sites refuse, so with
"Always save MP4" on (Video tab, on by default) the game converts each Firefox recording to MP4
(H.264 video, AAC sound) right after it ends; the status line shows the progress. It uses the
browser's own video encoder and the bundled Mediabunny library (`lib/`, MPL-2.0). If a browser has
no H.264 encoder, the video is kept as WebM and the status line says so.

## Reel mode

On by default. Matches skip the title card and countdown, so the recording starts with the squares
already moving, and a big hook line ("THE FLOOR IS LAVA", "WHICH COLOR WINS?", "comment your pick")
covers the top for the first seconds. Modes use their quick settings, so most matches last
10-40 seconds, and the winner screen is shorter. Turn it off for the full intro.

## Clip farm

Leave the game running and come back to a folder of clips. In the Clip farm panel, optionally
press **Choose folder** (Chrome and Edge on a computer), set **Stop after**, and press
**Start clip farm**. Every match is recorded and saved as its own numbered file
(`001-marble-123456.mp4`, `002-…`), then the next one starts. Without a chosen folder the clips go
to Downloads; the browser asks once whether the site may download multiple files. Keep the tab
open and visible: browsers pause games in minimised or hidden tabs.

## Code

- `js/core.js`: random numbers, teams and the square renderer (faces, moods, sunglasses)
- `js/audio.js`: music generator and sound effects
- `js/fx.js`: camera, particles, speech bubbles, banners, confetti
- `js/post.js`: the WebGL screen pass (fish-eye, static, glitches)
- `js/modes/*.js`: one file per mode
- `js/game.js`: match director (intro → countdown → play → finale → outro) and recorder
- `js/posters.js`: the propaganda posters and the poster-style DoucheCube
- `js/ui.js`: controls
- `tools/build_single.py`: bundles everything into `dist/squares-trinity.html`

To add a mode, create `js/modes/yourmode.js` with a class that has `teams`, `rules`, `update(dt)`,
`draw(ctx)`, `drawHud(ctx, y)` and sets `winner` when the match is decided, register it in
`SQ.modes`, add it to `SQ.MODE_IDS` in `js/game.js` and add a script tag to `index.html`.
