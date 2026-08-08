#!/usr/bin/env bash
# The one command. Serves the game and prints the URL to open.
#
#   ./play.sh                 http://127.0.0.1:8080/index.html
#   ./play.sh --port 8123
#   ./play.sh --host 0.0.0.0  reachable from another machine
#
# Needs node >= 20 and nothing else. No install step, no build step, no network.
set -euo pipefail
cd "$(dirname "$0")"
exec node tools/play.mjs "$@"
