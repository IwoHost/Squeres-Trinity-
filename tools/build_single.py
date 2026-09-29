#!/usr/bin/env python3
"""Bundle index.html and its scripts into one self-contained HTML file.

    python3 tools/build_single.py            -> dist/squares-trinity.html (open it anywhere, even offline)
    python3 tools/build_single.py --artifact -> dist/artifact.html (page body only, for hosts that add their own <head>)
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main():
    artifact = "--artifact" in sys.argv
    html = (ROOT / "index.html").read_text(encoding="utf-8")

    def inline(match):
        src = match.group(1)
        code = (ROOT / src).read_text(encoding="utf-8")
        code = code.replace("</script", "<\\/script")
        return f"<script>/* {src} */\n{code}\n</script>"

    html = re.sub(r'<script src="([^"]+)"></script>', inline, html)

    if artifact:
        html = html.split("<!-- /head -->", 1)[1]
        html = html.split("<!-- /body -->", 1)[0]
        for tag in ("<!-- head/ -->", "</head>", "<body>"):
            html = html.replace(tag, "")
        html = html.strip() + "\n"

    out = ROOT / "dist" / ("artifact.html" if artifact else "squares-trinity.html")
    out.parent.mkdir(exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
