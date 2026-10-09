#!/usr/bin/env python3
"""Birthday videos: DoucheCube wishes a friend happy birthday, by name, with a voice.

    python tools/birthday.py Szymon --lang pl            make one now (pl or en)
    python tools/birthday.py Szymon --lang en --say Shimon
                                                     --say: how the voice should pronounce the name
    python tools/birthday.py --check                 make the videos for everyone whose birthday is today
    python tools/birthday.py --list                  show the birthday list and who is next
    python tools/birthday.py --install-timer         check every morning by itself (Linux), with a notification

The birthday list is tools/my_birthdays.txt (private: git never uploads it), one friend per line:

    29.11  Szymon  pl
    14.03  Kuba    en  Kooba

day.month, the name as it should be written, pl or en, and optionally how to pronounce it.
Videos go to posts/birthdays. Each one is made once; delete it to make it again.

Needs, once:  pip install --user numpy imageio-ffmpeg playwright
and for the voice the espeak-ng program (Bazzite: brew install espeak-ng; Ubuntu: sudo apt install
espeak-ng; Fedora: sudo dnf install espeak-ng). Without it the video is made without the voice.
"""
import argparse
import base64
import importlib
import datetime
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import wave

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
LIST = HERE / "my_birthdays.txt"
OUT = ROOT / "posts" / "birthdays"
PAGE = HERE / "birthday" / "render.html"
FONTS = HERE / "birthday" / "fonts"
SR = 44100
FPS = 30

SCRIPTS = {
    # (what the voice says, what the speech bubble shows); {say} is the spoken name, {name} the written one
    "en": {
        "voice": "en-us",
        "lines": [
            ("Attention. This is Doosh-cube, from Sector Ember.", "Attention. This is DoucheCube, from Sector Ember."),
            ("I stopped the Games, for one very important message.", "I stopped the Games for one very important message."),
            ("Happy birthday, {say}!", "HAPPY BIRTHDAY, {NAME}!"),
            ("Today, you are the winner. No fighting required.", "Today, you are the winner. No fighting required."),
            ("The other squares want to say something too.", "The other squares want to say something too."),
            ("CHORUS:Happy birthday!", "HAPPY BIRTHDAY!"),
            ("Now go eat some cake. That is an order.", "Now go eat some cake. That is an order."),
        ],
    },
    "pl": {
        "voice": "pl",
        "lines": [
            ("Uwaga. Tu Dusz kjub, z Sektora Ember.", "Uwaga. Tu DoucheCube, z Sektora Ember."),
            ("Zatrzymałem Igrzyska, dla jednej bardzo ważnej wiadomości.", "Zatrzymałem Igrzyska dla jednej bardzo ważnej wiadomości."),
            ("Wszystkiego najlepszego, {say}!", "WSZYSTKIEGO NAJLEPSZEGO, {NAME}!"),
            ("Dzisiaj to ty wygrywasz. Bez żadnej walki.", "Dzisiaj to ty wygrywasz. Bez żadnej walki."),
            ("Reszta kwadratów też chce coś powiedzieć.", "Reszta kwadratów też chce coś powiedzieć."),
            ("CHORUS:Sto lat!", "STO LAT!"),
            ("A teraz idź zjeść tort. To rozkaz.", "A teraz idź zjeść tort. To rozkaz."),
        ],
    },
}


def need(module, pip_name=None):
    try:
        return importlib.import_module(module)
    except ImportError:
        sys.exit(f"Missing {module}. Run:  pip install --user {pip_name or module}")


def find_espeak():
    for p in (shutil.which("espeak-ng"), "/home/linuxbrew/.linuxbrew/bin/espeak-ng", "/opt/homebrew/bin/espeak-ng", "/usr/local/bin/espeak-ng"):
        if p and os.path.exists(p):
            return p
    return None


# ---------------- sound ----------------
def tts(np, espeak, text, voice, pitch, speed, tmp):
    path = pathlib.Path(tmp) / "say.wav"
    subprocess.run([espeak, "-v", voice, "-p", str(pitch), "-s", str(speed), "-a", "180", "-w", str(path), text], check=True)
    with wave.open(str(path)) as w:
        sr = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    t = np.arange(int(len(x) * SR / sr)) * sr / SR
    y = np.interp(t, np.arange(len(x)), x)
    nz = np.where(np.abs(y) > 0.01)[0]
    return y[nz[0]: nz[-1] + 1] if len(nz) else y


def soundtrack(name, say, lang, tmp):
    np = need("numpy")
    espeak = find_espeak()
    if not espeak:
        print("  (no espeak-ng found: making the video without the voice; see the top of tools/birthday.py)")
    S = SCRIPTS[lang]
    mix = np.zeros(int(SR * 60), dtype=np.float32)
    voice = np.zeros_like(mix)
    tl = {"lines": [], "lang": lang, "name_text": name}
    t = 1.2
    for i, (said, shown) in enumerate(S["lines"]):
        said = said.replace("{say}", say)
        shown = shown.replace("{NAME}", name.upper()).replace("{name}", name)
        if said.startswith("CHORUS:"):
            start, length = t + 0.2, 1.2
            if espeak:
                for k, pitch in enumerate([45, 55, 62, 70, 78, 86, 95]):
                    y = tts(np, espeak, said[7:], S["voice"], pitch, 175 + k * 6, tmp) * 0.45
                    off = int((start + k * 0.035) * SR)
                    mix[off: off + len(y)] += y
                    length = max(length, len(y) / SR + k * 0.035)
            tl["chorus"] = [start, start + length]
            tl["lines"].append({"t0": start, "t1": start + length, "text": shown, "chorus": True})
            t = start + length + 0.5
            continue
        if espeak:
            y = tts(np, espeak, said, S["voice"], 28, 150, tmp)
            y = y * (0.82 + 0.18 * np.sin(2 * np.pi * 55 * np.arange(len(y)) / SR))  # a slightly robotic cube
            off = int(t * SR)
            mix[off: off + len(y)] += y * 0.9
            voice[off: off + len(y)] += y
            length = len(y) / SR
        else:
            length = max(1.6, len(shown) * 0.06)
            k = np.arange(int(length * SR)) / SR
            voice[int(t * SR): int(t * SR) + len(k)] += 0.12 * (np.sin(2 * np.pi * 4 * k) > 0)  # the mouth flaps without sound
        tl["lines"].append({"t0": t, "t1": t + length, "text": shown, "name": i == 2})
        if i == 2:
            tl["name"] = t + 0.35 * length
        if i == 6:
            tl["cake"] = t
        t += length + (0.9 if i == 2 else 0.45)
    tl["end"] = t + 0.2
    total = tl["end"] + 4.5
    tl["total"] = total
    mix, voice = mix[: int(SR * total)], voice[: int(SR * total)]

    # Happy Birthday (public domain) as a soft chiptune, quieter while anyone speaks
    NOTE = {"G4": 392.0, "A4": 440.0, "B4": 493.88, "C5": 523.25, "D5": 587.33, "E5": 659.25, "F5": 698.46, "G5": 783.99}
    SONG = [("G4", .75), ("G4", .25), ("A4", 1), ("G4", 1), ("C5", 1), ("B4", 2), ("G4", .75), ("G4", .25), ("A4", 1), ("G4", 1), ("D5", 1), ("C5", 2),
            ("G4", .75), ("G4", .25), ("G5", 1), ("E5", 1), ("C5", 1), ("B4", 1), ("A4", 2), ("F5", .75), ("F5", .25), ("E5", 1), ("C5", 1), ("D5", 1), ("C5", 3)]
    beat = 60 / 116
    music = np.zeros_like(mix)
    pos = 0.3
    while pos < total:
        for n, b in SONG:
            f, d = NOTE[n], b * beat
            k = np.arange(int(d * SR)) / SR
            env = np.minimum(1, k / 0.01) * np.exp(-k * 2.2)
            tone = 0.21 * np.sign(np.sin(2 * np.pi * f * k)) + 0.65 * (2 / np.pi) * np.arcsin(np.sin(2 * np.pi * f * k))
            seg = (tone * 0.6 + 0.5 * np.sin(2 * np.pi * f / 4 * k) * np.exp(-k * 3)) * env * 0.16
            off = int(pos * SR)
            if off >= len(music):
                break
            end = min(len(music), off + len(seg))
            music[off:end] += seg[: end - off]
            pos += d
        pos += beat
    talking = np.convolve(np.abs(mix) + np.abs(voice), np.ones(4410) / 4410, mode="same") > 0.01
    duck = np.convolve(np.where(talking, 0.35, 1.0), np.ones(8820) / 8820, mode="same")
    duck *= np.where(np.arange(len(music)) / SR > tl["end"], 1.5, 1.0)
    mix += (music * duck).astype(np.float32)
    rng = np.random.default_rng(3)
    for at, g in [(tl["name"], 0.5), (tl["end"], 0.6)]:
        n = int(0.25 * SR)
        off = int(at * SR)
        burst = rng.standard_normal(n).astype(np.float32) * np.exp(-np.arange(n) / SR * 18) * g
        mix[off: off + n] += burst[: max(0, min(n, len(mix) - off))]
    mix = np.tanh(mix * 1.1) * 0.92
    track = pathlib.Path(tmp) / "track.wav"
    with wave.open(str(track), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix * 32767).astype(np.int16).tobytes())
    hop = SR // FPS
    tl["mouth"] = [round(float(min(1, np.sqrt(np.mean(voice[i * hop:(i + 1) * hop] ** 2)) * 6)), 3) for i in range(int(total * FPS)) if (i + 1) * hop <= len(voice)]
    return track, tl


# ---------------- picture ----------------
def fonts():
    """Downloads the two fonts once (Bungee and Chakra Petch from Google Fonts) and keeps them next to the page."""
    css = FONTS / "fonts.css"
    if css.exists():
        return
    FONTS.mkdir(parents=True, exist_ok=True)
    ua = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"}
    try:
        src = urllib.request.urlopen(urllib.request.Request("https://fonts.googleapis.com/css2?family=Bungee&family=Chakra+Petch:wght@500;600;700&display=swap", headers=ua), timeout=30).read().decode()
        for i, url in enumerate(re.findall(r"https://fonts\.gstatic\.com[^)]+", src)):
            (FONTS / f"f{i}.woff2").write_bytes(urllib.request.urlopen(urllib.request.Request(url, headers=ua), timeout=30).read())
            src = src.replace(url, f"f{i}.woff2")
        css.write_text(src, encoding="utf-8")
    except Exception as e:  # without them the page falls back to system fonts
        print(f"  (could not download the fonts: {e}; using system fonts)")
        css.write_text("", encoding="utf-8")


BROWSER = None  # a Chrome or Chromium program to use, set with --browser


def render(tl, track, out):
    sp = need("playwright.sync_api", "playwright")
    ff = need("imageio_ffmpeg", "imageio-ffmpeg").get_ffmpeg_exe()
    fonts()
    with sp.sync_playwright() as pw:
        browser = None
        err = None
        for extra in ([{"executable_path": BROWSER}] if BROWSER else [{}, {"channel": "chrome"}, {"channel": "msedge"}]):
            try:
                browser = pw.chromium.launch(args=["--allow-file-access-from-files"], **extra)
                break
            except Exception as e:
                err = err or e
        if not browser:
            sys.exit(f"Could not start a browser ({str(err).splitlines()[0]}). Run:  python -m playwright install chromium")
        page = browser.new_page(viewport={"width": 1080, "height": 1920})
        page.goto(PAGE.as_uri())
        page.evaluate("tl => { window.TL = tl; return window.ready; }", tl)
        proc = subprocess.Popen([ff, "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-", "-i", str(track),
                                 "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
                                 "-shortest", "-movflags", "+faststart", str(out)], stdin=subprocess.PIPE)
        frames = int(tl["total"] * FPS)
        for i in range(frames):
            data = page.evaluate("t => { renderAt(t); return document.getElementById('c').toDataURL('image/jpeg', 0.93); }", i / FPS)
            proc.stdin.write(base64.b64decode(data.split(",", 1)[1]))
            if i % 150 == 0:
                print(f"  {100 * i // frames}%", end="\r", flush=True)
        proc.stdin.close()
        proc.wait()
        browser.close()
    if proc.returncode:
        sys.exit("Making the video failed.")


def make(name, lang, say=None, out=None):
    OUT.mkdir(parents=True, exist_ok=True)
    year = datetime.date.today().year
    out = pathlib.Path(out) if out else OUT / (f"Wszystkiego najlepszego {name} {year}.mp4" if lang == "pl" else f"Happy Birthday {name} {year}.mp4")
    print(f"Making the birthday video for {name} ({lang})...")
    with tempfile.TemporaryDirectory() as tmp:
        track, tl = soundtrack(name, say or name, lang, tmp)
        render(tl, track, out)
    print(f"Ready: {out}")
    return out


# ---------------- the list ----------------
def read_list():
    people = []
    if not LIST.exists():
        return people
    for raw in LIST.read_text(encoding="utf-8").splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        parts = line.split()
        m = re.match(r"^(\d{1,2})[./-](\d{1,2})$", parts[0])
        if not m or len(parts) < 2:
            print(f"  (skipping a line I do not understand: {raw.strip()})")
            continue
        lang = parts[2].lower() if len(parts) > 2 and parts[2].lower() in SCRIPTS else "pl"
        say = " ".join(parts[3:]) if len(parts) > 3 else None
        people.append({"day": int(m.group(1)), "month": int(m.group(2)), "name": parts[1], "lang": lang, "say": say})
    return people


def notify(text):
    if shutil.which("notify-send"):
        subprocess.run(["notify-send", "-a", "Squares Trinity", "Birthday video ready", text], check=False)


def check(do_notify):
    today = datetime.date.today()
    made = []
    for p in read_list():
        if (p["day"], p["month"]) != (today.day, today.month):
            continue
        name = f"Wszystkiego najlepszego {p['name']} {today.year}.mp4" if p["lang"] == "pl" else f"Happy Birthday {p['name']} {today.year}.mp4"
        if (OUT / name).exists():
            continue
        made.append(make(p["name"], p["lang"], p["say"]))
    if made and do_notify:
        notify("It is " + ", ".join(m.stem.split(" ")[-2] for m in made) + "'s birthday. The video is in posts/birthdays.")
    if not made:
        print("No birthdays to make today.")


def show_list():
    people = read_list()
    if not people:
        print(f"The list is empty. Add friends to {LIST}, one per line, like:  29.11  Szymon  pl")
        return
    today = datetime.date.today()

    def next_date(p):
        for y in (today.year, today.year + 1):
            try:
                d = datetime.date(y, p["month"], p["day"])
            except ValueError:
                d = datetime.date(y, 3, 1)  # born on 29 February: 1 March in other years
            if d >= today:
                return d
    for p in sorted(people, key=next_date):
        d = next_date(p)
        days = (d - today).days
        print(f"  {d.strftime('%d.%m')}  {p['name']:<14} {p['lang']}  " + ("TODAY" if days == 0 else f"in {days} days"))


def install_timer():
    if not shutil.which("systemctl"):
        sys.exit("This needs systemd (Linux). On other systems run  python tools/birthday.py --check  once a day.")
    unit = pathlib.Path.home() / ".config" / "systemd" / "user"
    unit.mkdir(parents=True, exist_ok=True)
    (unit / "squares-birthdays.service").write_text(
        f"[Unit]\nDescription=Squares Trinity birthday videos\n\n[Service]\nType=oneshot\nWorkingDirectory={ROOT}\n"
        f"ExecStart={sys.executable} {HERE / 'birthday.py'} --check --notify\n", encoding="utf-8")
    (unit / "squares-birthdays.timer").write_text(
        "[Unit]\nDescription=Check for birthdays every morning\n\n[Timer]\nOnCalendar=*-*-* 08:00:00\nPersistent=true\n\n[Install]\nWantedBy=timers.target\n", encoding="utf-8")
    subprocess.run(["systemctl", "--user", "daemon-reload"], check=True)
    subprocess.run(["systemctl", "--user", "enable", "--now", "squares-birthdays.timer"], check=True)
    print("Done. Every morning at 8:00 (or as soon as the computer is on) it makes the videos for today's birthdays")
    print("and shows a notification. To stop it:  systemctl --user disable --now squares-birthdays.timer")


def main():
    ap = argparse.ArgumentParser(description="DoucheCube birthday videos.")
    ap.add_argument("name", nargs="?", help="make a video for this name now")
    ap.add_argument("--lang", choices=sorted(SCRIPTS), default="pl", help="language (default pl)")
    ap.add_argument("--say", help="how the voice should pronounce the name")
    ap.add_argument("--out", help="where to save the video")
    ap.add_argument("--check", action="store_true", help="make the videos for today's birthdays from the list")
    ap.add_argument("--notify", action="store_true", help="with --check: show a desktop notification")
    ap.add_argument("--list", action="store_true", help="show the birthday list")
    ap.add_argument("--install-timer", action="store_true", help="check every morning by itself (Linux)")
    ap.add_argument("--browser", help="path to a Chrome or Chromium program to use")
    a = ap.parse_args()
    global BROWSER
    BROWSER = a.browser
    if a.install_timer:
        install_timer()
    elif a.list:
        show_list()
    elif a.check:
        check(a.notify)
    elif a.name:
        make(a.name, a.lang, a.say, a.out)
    else:
        ap.print_help()


if __name__ == "__main__":
    main()
