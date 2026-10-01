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

    # the MP4 converter's libraries load only when needed, so they ride along as inert text blocks
    libs = ""
    for src in ("lib/mediabunny.min.js", "lib/mediabunny-aac-encoder.min.js"):
        code = (ROOT / src).read_text(encoding="utf-8").replace("</script", "<\\/script")
        libs += f'<script type="text/plain" data-lib="{src}">{code}</script>\n'
    html = html.replace("<!-- /body -->", libs + "<!-- /body -->") if "<!-- /body -->" in html else html.replace("</body>", libs + "</body>")

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
