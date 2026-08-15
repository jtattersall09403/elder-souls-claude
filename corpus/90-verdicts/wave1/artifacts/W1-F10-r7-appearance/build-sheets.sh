#!/usr/bin/env bash
# Build the contact sheets this piece was judged from, out of the two returned arms.
#
# Every sheet is a BEFORE/AFTER pair of the same slot, built with the same tool and the same
# scale, so the two can be opened side by side. `contact-sheet.mjs` exists because "I looked at
# the frame" and "I looked at the sequence" stop being distinguishable when the artefact IS the
# sequence — a reviewer handed one still certified a broken thing as fixed on this project.
#
# Usage: bash build-sheets.sh <run-dir> <out-dir>
set -euo pipefail
RUN="${1:?run dir with before/ and after/}"
OUT="${2:?output dir for sheets}"
CS="node tools/visual/contact-sheet.mjs"
mkdir -p "$OUT"

sheet () {  # sheet <slot-match> <cols> <scale> <name>
  local match="$1" cols="$2" scale="$3" name="$4"
  for arm in before after; do
    $CS --in "$RUN/$arm/frames" --match "$match" --cols "$cols" --scale "$scale" --label \
        --out "$OUT/${name}-${arm^^}.png" || echo "  (no frames for $match in $arm)"
  done
}

sheet 'W__'   3 0.5  01-crowd-lilmoth
sheet 'FA__'  4 0.5  02-faces-by-variant
sheet 'FP__'  4 0.5  03-player-face
sheet 'C4__'  4 0.4  04-orbit-npc
sheet 'CP__'  4 0.4  05-orbit-player
sheet 'FS__'  3 0.5  06-feet-on-slope
sheet 'FSF__' 2 0.5  07-figure-on-slope
sheet 'M__'   4 0.4  08-walk-figure
sheet 'MF__'  4 0.5  09-walk-feet

ls -la "$OUT"
