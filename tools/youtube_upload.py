"""Uploads videos to your YouTube channel with the official YouTube Data API. Used by daily.py.

One-time setup (about 10 minutes, free):
  1. pip install google-api-python-client google-auth-oauthlib
  2. Go to https://console.cloud.google.com, create a project, and enable "YouTube Data API v3".
  3. "OAuth consent screen": choose External, fill in the app name, and add your own Google
     account under Test users.
  4. "Credentials" > Create credentials > OAuth client ID > Desktop app. Download the JSON file
     and save it as tools/client_secret.json.
  5. The first upload opens your browser once to let it post to your channel. After that it
     remembers (tools/.youtube_token.json). Both files are private; never share or commit them.

YouTube allows about 6 uploads a day this way. Vertical videos under 3 minutes become Shorts.
Note: while the Google project is unverified, YouTube may lock videos uploaded through it to
private. If that happens, apply for the API audit in the console, or set them public by hand.
"""
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
SECRET = HERE / "client_secret.json"
TOKEN = HERE / ".youtube_token.json"
SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


def service():
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
    except ImportError:
        sys.exit("YouTube upload needs:  pip install google-api-python-client google-auth-oauthlib")
    creds = Credentials.from_authorized_user_file(str(TOKEN), SCOPES) if TOKEN.exists() else None
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
        except Exception:
            creds = None
    if not creds or not creds.valid:
        if not SECRET.exists():
            sys.exit(f"Missing {SECRET}. See the setup steps at the top of tools/youtube_upload.py.")
        creds = InstalledAppFlow.from_client_secrets_file(str(SECRET), SCOPES).run_local_server(port=0)
        TOKEN.write_text(creds.to_json(), encoding="utf-8")
    return build("youtube", "v3", credentials=creds)


def upload(path, title, description, tags, privacy="public", publish_at=None):
    """Uploads one video; returns its id. publish_at (UTC, ISO) needs privacy 'private'."""
    from googleapiclient.http import MediaFileUpload

    clean = lambda s: s.replace("<", "").replace(">", "")
    status = {"privacyStatus": privacy, "selfDeclaredMadeForKids": False}
    if publish_at:
        status["publishAt"] = publish_at
    body = {
        "snippet": {"title": clean(title)[:100], "description": clean(description)[:5000], "tags": tags[:15], "categoryId": "20"},
        "status": status,
    }
    media = MediaFileUpload(str(path), chunksize=-1, resumable=True)
    req = service().videos().insert(part="snippet,status", body=body, media_body=media)
    res = None
    while res is None:
        _, res = req.next_chunk()
    return res["id"]
