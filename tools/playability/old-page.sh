#!/usr/bin/env bash
# Build a SHADOW TREE for the delete-the-fix on game/index.html.
#
# The shared repo must not be reverted, even for a minute: a dozen agents are reading it and one
# of them has been in this very file today. So the control arm is served from a directory of
# symlinks to the real tree whose ONLY real file is game/index.html — the working-tree page with
# one change undone. The two arms then differ in exactly one function, which is what a
# delete-the-fix is for, and nothing outside this directory changes at all.
#
#   tools/playability/old-page.sh <out-dir> <replacement-index.html>
#
# Prints the shadow root. Serve it with:
#   node tools/playability/notice-over-game.mjs --root <out-dir>
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${1:?usage: old-page.sh <out-dir> <replacement-index.html>}"
IDX="${2:?usage: old-page.sh <out-dir> <replacement-index.html>}"

rm -rf "$OUT"
mkdir -p "$OUT/game"
# Everything at the repo root is a symlink…
for e in "$REPO"/*; do
  n="$(basename "$e")"
  [ "$n" = "game" ] && continue
  ln -s "$e" "$OUT/$n"
done
# …and everything inside game/ is too, except the one file under test.
for e in "$REPO"/game/*; do
  n="$(basename "$e")"
  [ "$n" = "index.html" ] && continue
  ln -s "$e" "$OUT/game/$n"
done
cp "$IDX" "$OUT/game/index.html"
echo "$OUT"
