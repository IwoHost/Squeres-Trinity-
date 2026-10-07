#!/usr/bin/env python3
"""Make today's posts with one command: the next day of the posting plan, ready to upload.

    python tools/daily.py              make the next day of the plan
    python tools/daily.py --status     where you are in the plan and what comes next
    python tools/daily.py --day 12     make day 12 (the plan then carries on from day 13)
    python tools/daily.py --youtube --instagram --facebook   also post today's videos everywhere
    python tools/daily.py --youtube --facebook --instagram --at 18:00
                                       YouTube and Facebook get them now and publish them at 18:00;
                                       Instagram has no scheduling, so the script waits until
                                       18:00 and posts then (leave the window open)
    python tools/daily.py --upload-only   post the last day you made, without making it again
                                       (anything already posted is skipped)

On Windows you can double-click make_today.bat instead.

Every day gets its own folder in ./posts with the videos, their caption files, and POST.txt: all
the titles, captions and hashtags of the day in one place, for posting on TikTok and Instagram.

The plan: day 0 is the Meet the Sectors promo. Days 1-7 are the warm-up week (faint static, no
battle damage, one cube spotlight a day). Days 8-37 are the 5 chapters of 6 videos; the 6th video
of each chapter loses its signal and shows the next 3 words of the message. Battle damage turns
to bruises in chapter 1 and to full in chapter 3. Special events (Halloween and the rest) switch
on by themselves on their dates.

Uploading needs a one-time setup per platform: YouTube in tools/youtube_upload.py, Instagram and
Facebook in tools/meta_upload.py. Set UPLOAD_TO below and a plain double-click posts everywhere.
"""
import argparse
import datetime
import json
import pathlib
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
STATE = ROOT / "tools" / ".daily_state.json"
POSTS = ROOT / "posts"

# Your look. Change these and every new day uses them.
LOOK = ["--fisheye", "20", "--crt", "100", "--glitch", "40", "--overlay", "on", "--event", "auto"]

# Where to post every day without typing it: any of "youtube", "instagram", "facebook".
UPLOAD_TO = []
# Post at this time instead of right away (HH:MM, your time), or None for right away.
POST_AT = None

CUBES = ["red", "green", "blue", "yellow", "purple", "cyan", "orange", "pink"]


def build_plan():
    """A list of days; each day is a list of (what, make_videos arguments)."""
    days = [[("Meet the Sectors promo (pin it)", ["--promo", "all"])]]
    # warm-up week: static creeps up 3% a day, no reboot, no battle damage
    for d in range(1, 8):
        match = ["-n", "1", "--gore", "off", "--grey", "rare", "--cipher", "none"]
        if d == 1:
            match += ["--static", "0", "--per-video", "3", "--words", "3", "--fragment", "1"]
        if d in (1, 4):
            match += ["--mode", "territory"]
        days.append([(f"warm-up match {d}/7", match), (f"spotlight: {CUBES[d - 1]}", ["--promo", CUBES[d - 1]])])
    # the 5 chapters
    chapters = [
        {"gore": "bruises", "cipher": "none", "grey": "rare"},
        {"gore": "bruises", "cipher": "none", "grey": "rare"},
        {"gore": "on", "cipher": "shift", "grey": "rare"},
        {"gore": "on", "cipher": "shift", "grey": "rare"},
        {"gore": "on", "cipher": "numbers", "grey": "always"},
    ]
    for c, ch in enumerate(chapters, 1):
        for d in range(1, 7):
            match = ["-n", "1", "--gore", ch["gore"], "--cipher", ch["cipher"], "--grey", ch["grey"]]
            if d == 1:
                # the static starts the chapter at 25% and climbs 15% a video; the 6th video reboots
                match += ["--static", "25", "--per-video", "15", "--fragment", str(c)]
            if d in (1, 4):
                match += ["--mode", "territory"]
            what = f"chapter {c}, video {d}/6" + (f" (SIGNAL LOST: fragment {c} of 5, pin it)" if d == 6 else "")
            jobs = [(what, match)]
            if c == 1 and d == 1:
                jobs.append(("spotlight: pink", ["--promo", "pink"]))
            days.append(jobs)
    return days


def load_state():
    try:
        return json.loads(STATE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"next_day": 0, "made": {}}


def save_state(state):
    STATE.write_text(json.dumps(state, indent=2), encoding="utf-8")


def read_caption(txt):
    """TITLE, CAPTION and hashtags from a caption file; the secrets and match info never leave it."""
    title, caption, tags = "", "", ""
    for block in txt.read_text(encoding="utf-8").split("\n\n"):
        lines = block.strip().split("\n")
        head = lines[0].strip()
        if head == "TITLE":
            title = "\n".join(lines[1:]).strip()
        elif head == "CAPTION":
            caption = "\n".join(lines[1:]).strip()
        elif head == "HASHTAGS":
            tags = " ".join(lines[1:]).strip()
        elif head.startswith("#") and not tags:
            tags = block.strip()
    return title, caption, tags


def full_caption(title, caption, tags):
    return "\n\n".join(x for x in (title, caption, tags) if x)


def publish_time(at):
    """The next moment it is HH:MM here (at least 15 minutes away)."""
    h, m = (int(x) for x in at.split(":"))
    now = datetime.datetime.now().astimezone()
    t = now.replace(hour=h, minute=m, second=0, microsecond=0)
    if t <= now + datetime.timedelta(minutes=15):
        t += datetime.timedelta(days=1)
    return t


def post_day(out, videos, targets, at):
    """Posts the day's videos; remembers what went where in uploaded.json, so nothing posts twice."""
    log_file = out / "uploaded.json"
    try:
        log = json.loads(log_file.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        log = {}
    when = publish_time(at) if at else None
    if when:
        print(f"Posting time: {when.strftime('%Y-%m-%d %H:%M')}")

    def done(v, where, ref):
        log.setdefault(v.name, {})[where] = ref
        log_file.write_text(json.dumps(log, indent=2), encoding="utf-8")

    failed = False
    for v in videos:
        title, caption, tags = read_caption(v.with_suffix(".txt"))
        mine = log.get(v.name, {})
        print(f"\n{v.name}")
        for where in targets:
            if where in mine:
                print(f"  {where}: already posted, skipped")
                continue
            if where == "instagram" and when:
                continue  # posted at the time, below
            try:
                if where == "youtube":
                    from youtube_upload import upload

                    utc = when.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if when else None
                    ref = upload(v, title or v.stem, f"{caption}\n\n{tags} #Shorts".strip(), [t.lstrip("#") for t in tags.split()], "private" if when else "public", utc)
                    print(f"  youtube: https://youtube.com/shorts/{ref}")
                elif where == "facebook":
                    from meta_upload import upload_facebook

                    ref = upload_facebook(v, full_caption(title, caption, tags), when.timestamp() if when else None)
                    print(f"  facebook: posted (video {ref})")
                else:
                    from meta_upload import upload_instagram

                    ref = upload_instagram(v, full_caption(title, caption, tags))
                    print(f"  instagram: posted (id {ref})")
                done(v, where, ref)
            except Exception as e:  # one platform failing should not stop the others
                failed = True
                print(f"  {where}: FAILED: {e}")
    if "instagram" in targets and when:
        waiting = [v for v in videos if "instagram" not in log.get(v.name, {})]
        if waiting:
            print(f"\nWaiting until {when.strftime('%H:%M')} to post on Instagram. Leave this window open.")
            while datetime.datetime.now().astimezone() < when:
                time.sleep(20)
            from meta_upload import upload_instagram

            for v in waiting:
                try:
                    ref = upload_instagram(v, full_caption(*read_caption(v.with_suffix(".txt"))))
                    print(f"  instagram: posted {v.name}")
                    done(v, "instagram", ref)
                except Exception as e:
                    failed = True
                    print(f"  instagram: FAILED for {v.name}: {e}")
    if failed:
        print("\nSomething did not post. Fix it and run:  python tools/daily.py --upload-only")


def main():
    plan = build_plan()
    ap = argparse.ArgumentParser(description="Make the next day of the posting plan.")
    ap.add_argument("--status", action="store_true", help="show where you are in the plan")
    ap.add_argument("--day", type=int, help=f"make this day (0-{len(plan) - 1}) instead of the next one")
    ap.add_argument("--youtube", action="store_true", help="post the videos on YouTube")
    ap.add_argument("--instagram", action="store_true", help="post the videos as Instagram Reels")
    ap.add_argument("--facebook", action="store_true", help="post the videos as Reels on your Facebook page")
    ap.add_argument("--at", help="publish at this time (HH:MM, your time) instead of right away")
    ap.add_argument("--upload-only", action="store_true", help="post the last day you made, without making it again")
    ap.add_argument("--headless", action="store_true", help="no browser window")
    ap.add_argument("--browser", help="path to a Chrome or Chromium program")
    a = ap.parse_args()

    state = load_state()
    targets = [t for t in ("youtube", "instagram", "facebook") if getattr(a, t) or t in UPLOAD_TO]
    at = a.at or POST_AT
    if a.upload_only:
        made = sorted(int(d) for d in state["made"])
        if a.day is None and not made:
            sys.exit("No day has been made yet.")
        day = a.day if a.day is not None else made[-1]
        out = POSTS / f"day{day:02d}"
        videos = sorted(p for p in out.glob("*") if p.suffix in (".mp4", ".webm"))
        if not targets or not videos:
            sys.exit("Nothing to post: say where (--youtube, --instagram, --facebook) and make sure the day has videos.")
        print(f"Posting day {day} to: {', '.join(targets)}")
        post_day(out, videos, targets, at)
        return
    day = state["next_day"] if a.day is None else a.day
    if a.status:
        print(f"Next up: day {day} of {len(plan) - 1}.")
        for i in range(day, min(day + 7, len(plan))):
            print(f"  day {i}: " + ";  ".join(what for what, _ in plan[i]))
        return
    if day >= len(plan):
        sys.exit("The plan is finished. Time for the next arc (or start over with --day 0).")

    out = POSTS / f"day{day:02d}"
    out.mkdir(parents=True, exist_ok=True)
    before = set(out.iterdir())
    print(f"Day {day}: " + ";  ".join(what for what, _ in plan[day]))
    for what, args in plan[day]:
        cmd = [sys.executable, str(ROOT / "tools" / "make_videos.py"), "--out", str(out), *LOOK, *args]
        if a.headless:
            cmd.append("--headless")
        if a.browser:
            cmd += ["--browser", a.browser]
        print(f"\n== {what}")
        if subprocess.run(cmd).returncode != 0:
            sys.exit(f"Making '{what}' failed. Fix the problem and run the same day again with --day {day}.")

    videos = sorted(p for p in out.iterdir() if p not in before and p.suffix in (".mp4", ".webm"))
    post = [f"DAY {day}  ({datetime.date.today().isoformat()})", ""]
    for v in videos:
        title, caption, tags = read_caption(v.with_suffix(".txt"))
        post += [f"--- {v.name}", title, "", caption, "", tags, ""]
    (out / "POST.txt").write_text("\n".join(post), encoding="utf-8")
    state["next_day"] = day + 1
    state["made"][str(day)] = datetime.datetime.now().isoformat(timespec="minutes")
    save_state(state)
    print(f"\nDay {day} is ready in {out}  (captions for all of it in POST.txt)")

    if targets:
        print(f"Posting to: {', '.join(targets)}")
        post_day(out, videos, targets, at)
    print("Next up: day", state["next_day"])


if __name__ == "__main__":
    main()
