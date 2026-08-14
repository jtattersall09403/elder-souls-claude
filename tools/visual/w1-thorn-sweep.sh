#!/bin/sh
# W1-THORN-PLATES chunk 1 — capture what Thorn looks like NOW.
# Two parts: (A) the real opening path, played; (B) a placed appearance sweep,
# many angles, four times of day, at the six places a player actually stands.
cd /home/user/elder-souls-claude || exit 1
OUT=reports/thorn-plates/frames
mkdir -p "$OUT"
LOG=reports/thorn-plates/capture.log
: > "$LOG"

echo "=== PART A: the real opening path, played (title -> New -> census -> barge hold -> writ house) ===" >> "$LOG"
timeout 900 node tools/harness/spawn-truth-thorn.mjs --out "$OUT/opening" >> "$LOG" 2>&1
echo "part A exit=$?" >> "$LOG"

echo "=== PART B: placed appearance sweep ===" >> "$LOG"
CLAIM='appearance of Thorn and its Tidewrack quay, for the art-direction plate/frame gap in W1-THORN-PLATES'

shoot() { # name x z yaw time pitch
  name=$1; x=$2; z=$3; yaw=$4; t=$5; pitch=${6:-4.3}
  f="$OUT/B-${name}-yaw${yaw}-t${t}.png"
  echo "--- $f" >> "$LOG"
  timeout 300 node tools/harness/shot.mjs --at "$x,$z" --yaw "$yaw" --time "$t" --pitch "$pitch" \
    --evidence appearance --claim "$CLAIM" --out "$f" >> "$LOG" 2>&1
  echo "   exit=$?" >> "$LOG"
}

# 1. Where the player actually walks out: the writ-house door on the Tidewrack quay.
#    Eight yaws at noon = the "rotate the camera around the player" test the owner named.
for Y in 0 45 90 135 180 225 270 315; do shoot quay-writhouse 3806 902 $Y 12; done
# and the same place through the day
for T in 7 17 21; do for Y in 0 90 180 270; do shoot quay-writhouse 3806 902 $Y $T; done; done

# 2. The barge-hold door, eight metres along the same quay — the first door of all.
for Y in 0 90 180 270; do shoot quay-barge 3800 908 $Y 12; done

# 3. The walk in from the quay towards the town.
for Y in 0 90 180 270; do shoot approach 3812 885 $Y 12; done

# 4. Thorn proper: the Rotted Hall, the centre of the place.
for Y in 0 45 90 135 180 225 270 315; do shoot town-hall 3819 867 $Y 12; done
for T in 7 17 21; do for Y in 0 180; do shoot town-hall 3819 867 $Y $T; done; done

# 5. The gate and the boards.
for Y in 0 90 180 270; do shoot town-gate 3808 873 $Y 12; done
for Y in 0 90 180 270; do shoot town-centre 3820 859 $Y 12; done

# 6. Roofline reads: pitch up so the skyline is in frame, from two stands.
for Y in 0 90 180 270; do shoot roofline-quay 3806 902 $Y 12 -8; done
for Y in 0 90 180 270; do shoot roofline-town 3819 867 $Y 12 -8; done

echo "=== DONE ===" >> "$LOG"
ls -1 "$OUT" | wc -l >> "$LOG"
