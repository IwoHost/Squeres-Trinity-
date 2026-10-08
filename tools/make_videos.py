#!/usr/bin/env python3
"""Make a batch of Squares Trinity videos without touching the browser.

Each video is saved with a .txt next to it: a ready title, caption and hashtags, plus the match
info (who won, what happened, any secrets and their times).

Setup, once:
    pip install playwright
    python -m playwright install chromium

Examples:
    python tools/make_videos.py                     5 reels, random modes, into ./videos
    python tools/make_videos.py -n 10               10 reels
    python tools/make_videos.py -n 3 --mode marble  3 marble races
    python tools/make_videos.py --mode tournament   one tournament, every match its own part
    python tools/make_videos.py --reboot            the first video plays the reboot event
    python tools/make_videos.py --promo all         the Meet the Sectors promo with all eight squares
    python tools/make_videos.py --promo each        eight promos, one square each
    python tools/make_videos.py -n 6 --static 25 --per-video 15 --words 3 --fragment 1
                                                    six videos, the sixth one reboots with the first three words

The script keeps its own settings between runs (static level, which fragment is next, the cycle
count) in tools/.profile, so a series carries on from one run to the next. Your settings from the
Look tab in your own browser are not shared with it; use the options below instead.
"""
import argparse
import base64
import pathlib
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
PROMO = ["all", "each", "memorial", "red", "green", "blue", "yellow", "purple", "cyan", "orange", "pink"]
MODES = ["random", "chase", "territory", "domain", "race", "brawl", "bounce", "marble", "hill", "tournament"]


def main():
    ap = argparse.ArgumentParser(description="Make a batch of Squares Trinity videos.")
    ap.add_argument("-n", "--count", type=int, default=5, help="how many videos (default 5)")
    ap.add_argument("--mode", choices=MODES, default="random", help="game mode (default random, never the same twice in a row)")
    ap.add_argument("--out", default="videos", help="folder for the videos (default ./videos)")
    ap.add_argument("--quality", choices=["720", "1080"], default="1080", help="video size (default 1080)")
    ap.add_argument("--no-reel", action="store_true", help="full matches with the intro, instead of short reels")
    ap.add_argument("--speed", type=float, choices=[1, 1.5, 2], default=1, help="match speed (default 1)")
    ap.add_argument("--static", type=int, help="set the static level (0-100) before the first video")
    ap.add_argument("--per-video", type=int, help="static added after every video (0, 2, 4, 8 or 15)")
    ap.add_argument("--reboot", action="store_true", help="the first video plays the reboot event")
    ap.add_argument("--fisheye", type=int, help="fish-eye strength 0-100")
    ap.add_argument("--crt", type=int, help="CRT strength 0-100")
    ap.add_argument("--glitch", type=int, help="always-on glitch strength 0-100")
    ap.add_argument("--overlay", choices=["on", "off"], help="camera overlay: REC, camera number, signal bars, timecode")
    ap.add_argument("--event", help="special event: auto (by date), off, or one of: newyear grandma grandpa valentine fatthursday womensday aprilfools easter smigus constitution mother childrensday father summer halloween allsaints independence birthday mikolajki christmas winter friday13")
    ap.add_argument("--words", type=int, choices=[1, 2, 3], help="words of the hidden message per reboot (changing it starts the message over)")
    ap.add_argument("--fragment", type=int, help="which fragment the next reboot shows, from 1")
    ap.add_argument("--cipher", choices=["none", "shift", "numbers"], help="how the fragment is shown: plain, letters shifted, or letters as numbers")
    ap.add_argument("--grey", choices=["rare", "always", "off"], help="how often the grey square shows up")
    ap.add_argument("--gore", choices=["off", "bruises", "on"], help="battle damage: off, bruises only, or on (bruises and blood)")
    ap.add_argument("--promo", choices=PROMO, help="make the Meet the Sectors promo instead of matches: all eight, each one, or one color; memorial makes the quiet All Saints' video")
    ap.add_argument("--headless", action="store_true", help="no browser window (can be choppy on some computers)")
    ap.add_argument("--browser", help="path to a Chrome or Chromium program to use instead of finding one")
    a = ap.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("Playwright is missing. Run:  pip install playwright  and then  python -m playwright install chromium")

    out = pathlib.Path(a.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    page_url = (ROOT / "index.html").as_uri()
    profile = ROOT / "tools" / ".profile"

    with sync_playwright() as pw:
        args = ["--autoplay-policy=no-user-gesture-required"]
        ctx = None
        common = dict(headless=a.headless, args=args, viewport={"width": 1280, "height": 900}, ignore_https_errors=True)
        # a browser you named, else your installed Chrome or Edge (smoothest), else the one Playwright downloaded
        tries = [{"executable_path": a.browser}] if a.browser else [{"channel": "chrome"}, {"channel": "msedge"}, {}]
        for extra in tries:
            try:
                ctx = pw.chromium.launch_persistent_context(str(profile), **common, **extra)
                break
            except Exception as e:
                last_error = e
        if ctx is None:
            sys.exit(f"Could not start a browser ({str(last_error).splitlines()[0]}). Run:  python -m playwright install chromium")
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(page_url)
        page.wait_for_function("() => window.SQ && SQ.game && SQ.makeOne", timeout=30000)
        page.wait_for_timeout(1500)  # let the fonts arrive

        settings = {
            "record": True,
            "autoNext": False,
            "reel": not a.no_reel,
            "mode": a.mode,
            "speed": a.speed,
            "quality": a.quality,
        }
        for key, val in (("static", a.static), ("decay", a.per_video), ("fisheye", a.fisheye), ("crt", a.crt), ("glitchFx", a.glitch), ("event", a.event), ("cipher", a.cipher), ("ninth", a.grey)):
            if val is not None:
                settings[key] = val
        if a.overlay is not None:
            settings["feed"] = a.overlay == "on"
        if a.gore is not None:
            settings["gore"] = "full" if a.gore == "on" else a.gore
        if a.words is not None:
            settings["fragWords"] = a.words
            settings["fragIndex"] = 0
        if a.fragment is not None:
            settings["fragIndex"] = max(0, a.fragment - 1)
        page.evaluate(
            """([s, reboot]) => {
                Object.assign(SQ.game.opts, s);
                SQ.game.setQuality(s.quality);
                if (reboot) SQ.game.rebootNext = true;
            }""",
            [settings, a.reboot],
        )
        if not page.evaluate("() => SQ.game.recorder.supported"):
            sys.exit("This browser cannot record video. Install Chrome, or run:  python -m playwright install chromium")

        if a.promo:
            jobs = ["Red", "Green", "Blue", "Yellow", "Purple", "Cyan", "Orange", "Pink"] if a.promo == "each" else [""] if a.promo == "all" else ["memorial"] if a.promo == "memorial" else [a.promo.capitalize()]
        else:
            jobs = [None] * (1 if a.mode == "tournament" else a.count)
        total = len(jobs)
        what = "promo" if a.promo else "tournament" if a.mode == "tournament" else "video"
        print(f"Making {total} {what}{'s' if total != 1 and what != 'tournament' else ''} into {out}")
        state = {}
        for i, who in enumerate(jobs):
            t0 = time.time()
            res = page.evaluate("(w) => SQ.makePromo(w)", who) if who is not None else page.evaluate("() => SQ.makeOne()")
            for f in res["files"]:
                (out / f["name"]).write_bytes(base64.b64decode(f["data"]))
                if not f["name"].endswith(".txt"):
                    print(f"  {i + 1}/{total}  {f['name']}  ({time.time() - t0:.0f}s)")
            state = res
            page.wait_for_timeout(800)

        print(f"Done. Static is now {state.get('static', 0)}%, cycle {state.get('cycle', 0)}, next fragment {state.get('fragment', 0) + 1}.")
        ctx.close()


if __name__ == "__main__":
    main()
