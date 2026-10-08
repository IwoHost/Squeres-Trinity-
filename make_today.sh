#!/usr/bin/env bash
# Makes the next day of the posting plan (Linux and Mac). Add options after the name, for example:
#   ./make_today.sh --youtube --instagram --facebook --at 18:00
cd "$(dirname "$0")"
python3 tools/daily.py "$@"
read -rp "Done. Press Enter to close."
