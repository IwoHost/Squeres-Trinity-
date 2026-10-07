"""Posts videos as Reels to your Instagram business account and your Facebook page, with Meta's
official Graph API. Used by daily.py; needs nothing to install.

One-time setup (about 15 minutes, free):
  1. Go to https://developers.facebook.com, log in with the Facebook account that runs your page,
     and create an app (type "Business" or "Other"). In the app, add the products
     "Instagram" (API setup with Facebook login) and "Facebook Login for Business" if asked.
  2. Open the Graph API Explorer (Tools > Graph API Explorer), pick your app, and under
     Permissions add: pages_show_list, pages_read_engagement, pages_manage_posts,
     instagram_basic, instagram_content_publish, business_management.
     Click "Generate Access Token" and allow it for your page and your Instagram account.
  3. In the app's Settings > Basic, copy the App ID and App Secret.
  4. Run:  python tools/meta_upload.py setup
     and paste the App ID, App Secret and the token from step 2. It swaps the token for a page
     token that does not expire, finds your Instagram account, and saves it all in
     tools/.meta.json. Keep that file private; never share or commit it.
  5. Check it:  python tools/meta_upload.py test

While the app stays in development mode it can only post to accounts of people who have a
role on the app, which is exactly you, so no review by Meta is needed.

Post a single video by hand:  python tools/meta_upload.py post "posts/day01/some video.mp4"
"""
import json
import pathlib
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
CONFIG = HERE / ".meta.json"
VERSION = "v23.0"  # Graph API version; Meta retires each one after about two years


def _call(method, url, params=None, data=None, headers=None):
    if params:
        url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            return json.loads(r.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        try:
            msg = json.loads(body)["error"]["message"]
        except (ValueError, KeyError, TypeError):
            msg = body[:500]
        raise RuntimeError(f"Meta said: {msg}") from None


def graph(method, path, **params):
    return _call(method, f"https://graph.facebook.com/{VERSION}/{path}", params)


def load():
    if not CONFIG.exists():
        sys.exit(f"Missing {CONFIG}. Run:  python tools/meta_upload.py setup  (steps at the top of tools/meta_upload.py)")
    return json.loads(CONFIG.read_text(encoding="utf-8"))


def setup():
    app_id = input("App ID: ").strip()
    secret = input("App Secret: ").strip()
    short = input("Access token from the Graph API Explorer: ").strip()
    long_user = graph("GET", "oauth/access_token", grant_type="fb_exchange_token", client_id=app_id, client_secret=secret, fb_exchange_token=short)["access_token"]
    pages = graph("GET", "me/accounts", fields="name,access_token,instagram_business_account{username}", access_token=long_user).get("data", [])
    if not pages:
        sys.exit("No Facebook pages found for this token. Did you allow your page when generating the token?")
    for i, p in enumerate(pages, 1):
        ig = p.get("instagram_business_account")
        print(f"  {i}. {p['name']}" + (f"  (Instagram @{ig.get('username')})" if ig else "  (no Instagram linked)"))
    pick = pages[0] if len(pages) == 1 else pages[int(input("Which page? ").strip()) - 1]
    ig = pick.get("instagram_business_account") or {}
    cfg = {"page_id": pick["id"], "page_name": pick["name"], "page_token": pick["access_token"], "ig_id": ig.get("id"), "ig_username": ig.get("username")}
    CONFIG.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    print(f"Saved. Facebook page: {cfg['page_name']}" + (f", Instagram: @{cfg['ig_username']}" if cfg["ig_id"] else ". No Instagram account is linked to this page; link it in the page settings and run setup again."))


def test():
    cfg = load()
    page = graph("GET", cfg["page_id"], fields="name", access_token=cfg["page_token"])
    print(f"Facebook page OK: {page['name']}")
    if cfg.get("ig_id"):
        ig = graph("GET", cfg["ig_id"], fields="username", access_token=cfg["page_token"])
        print(f"Instagram OK: @{ig['username']}")


def _send_file(url, path, token):
    data = pathlib.Path(path).read_bytes()
    return _call("POST", url, data=data, headers={"Authorization": f"OAuth {token}", "offset": "0", "file_size": str(len(data))})


def upload_instagram(path, caption):
    """Posts a Reel; returns the post id. Instagram has no scheduling here: it goes live now."""
    cfg = load()
    tok = cfg["page_token"]
    if not cfg.get("ig_id"):
        raise RuntimeError("No Instagram account is linked to the page. Link it, then run setup again.")
    box = graph("POST", f"{cfg['ig_id']}/media", media_type="REELS", upload_type="resumable", caption=caption[:2200], share_to_feed="true", access_token=tok)
    _send_file(box.get("uri") or f"https://rupload.facebook.com/ig-api-upload/{VERSION}/{box['id']}", path, tok)
    # Instagram processes the video before it can be published
    for _ in range(90):
        st = graph("GET", box["id"], fields="status_code,status", access_token=tok)
        if st.get("status_code") == "FINISHED":
            break
        if st.get("status_code") in ("ERROR", "EXPIRED"):
            raise RuntimeError(f"Instagram could not process the video: {st.get('status')}")
        time.sleep(5)
    else:
        raise RuntimeError("Instagram took too long to process the video.")
    return graph("POST", f"{cfg['ig_id']}/media_publish", creation_id=box["id"], access_token=tok)["id"]


def upload_facebook(path, description, publish_at=None):
    """Posts a Reel on the page; publish_at (unix time) schedules it. Returns the video id."""
    cfg = load()
    tok = cfg["page_token"]
    start = graph("POST", f"{cfg['page_id']}/video_reels", upload_phase="start", access_token=tok)
    _send_file(start.get("upload_url") or f"https://rupload.facebook.com/video-upload/{VERSION}/{start['video_id']}", path, tok)
    done = {"upload_phase": "finish", "video_id": start["video_id"], "description": description[:5000], "access_token": tok}
    if publish_at:
        done.update(video_state="SCHEDULED", scheduled_publish_time=str(int(publish_at)))
    else:
        done["video_state"] = "PUBLISHED"
    graph("POST", f"{cfg['page_id']}/video_reels", **done)
    return start["video_id"]


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else ""
    if what == "setup":
        setup()
    elif what == "test":
        test()
    elif what == "post" and len(sys.argv) > 2:
        sys.path.insert(0, str(HERE))
        from daily import read_caption, full_caption

        v = pathlib.Path(sys.argv[2])
        text = full_caption(*read_caption(v.with_suffix(".txt")))
        print("Instagram:", upload_instagram(v, text))
        print("Facebook:", upload_facebook(v, text))
    else:
        print(__doc__)
