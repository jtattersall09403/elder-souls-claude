#!/bin/sh
# W1-THORN-PLATES chunk 2 — the CORE-12 appearance sweep.
#
# WHY 12 AND NOT 48. `tools/visual/w1-thorn-sweep.sh` (chunk 1) asks for 48 placed frames. On this
# box, under the contention that has held all day (7 browser instances, load ~8.2 against a ceiling
# of 4.0 per core), the shared capture daemon is taking 111-165 s just to BOOT a browser and is
# timing jobs out; chunk 1 could not finish 48, and a before AND an after is 96. This script is the
# subset that still answers the owner's directive — many angles, several times of day, from the
# place the player actually stands — and that can finish TWICE inside one agent's budget.
#
#   $1  output directory (e.g. reports/thorn-plates/frames-before)
#   $2  log file
#
# Every stand is on the Tidewrack quay or the walk in from it, because that is where chunk 2's
# changes land. The town-centre pair is the control: nothing this chunk does should move it much.
cd /home/user/elder-souls-claude || exit 1
OUT=${1:-reports/thorn-plates/frames-core12}
LOG=${2:-reports/thorn-plates/core12.log}
mkdir -p "$OUT"
: > "$LOG"
CLAIM='appearance of Thorn and its Tidewrack quay, for the art-direction plate/frame gap in W1-THORN-PLATES'

shoot() { # name x z yaw time pitch
  name=$1; x=$2; z=$3; yaw=$4; t=$5; pitch=${6:-4.3}
  f="$OUT/${name}-yaw${yaw}-t${t}.png"
  echo "--- $f" >> "$LOG"
  timeout 420 node tools/harness/shot.mjs --at "$x,$z" --yaw "$yaw" --time "$t" --pitch "$pitch" \
    --evidence appearance --claim "$CLAIM" --out "$f" >> "$LOG" 2>&1
  echo "   exit=$?" >> "$LOG"
}

# 1. The writ-house door on the quay — where the player actually walks out. Four yaws at noon:
#    the "rotate the camera around the player" test the owner named.
for Y in 0 90 180 270; do shoot quay-writhouse 3806 902 $Y 12; done
# 2. The same stand through the day.
for T in 7 17 21; do shoot quay-writhouse 3806 902 180 $T; done
# 3. The roofline read from the quay — pitched up so the skyline is in frame.
for Y in 90 270; do shoot roofline-quay 3806 902 $Y 12 -8; done
# 4. The walk in from the quay towards the town.
shoot approach 3812 885 180 12
# 5. Thorn proper. The control: chunk 2 changes the quay, not the Rotted Hall.
for Y in 0 180; do shoot town-hall 3819 867 $Y 12; done

echo "=== DONE ===" >> "$LOG"
ls -1 "$OUT" | grep -c '\.png$' >> "$LOG"
