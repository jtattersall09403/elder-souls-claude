#!/usr/bin/env bash
# W1-ORPHANED-SURFACE-SHADERS — both arms of the copy-seam fix on ONE GPU, in one Pod run.
#
# WHY ONE POD AND NOT TWO. The claim is about appearance, so the two arms must differ ONLY in the
# fix. Two Pods can land on two different GPUs, and this project has already been bitten by a
# software/hardware disagreement on an absolute flicker value. One Pod, one GPU, one driver, one
# browser build; the AFTER arm runs first on the tree as uploaded, then `--revert` deletes the fix
# in place and the BEFORE arm runs on the same hardware minutes later.
#
# The revert is `tools/visual/w1-30-copy-seam-patch.mjs --revert` — the same script that applied
# the change, so the delete-the-fix arm cannot drift from the change it is reversing. It refuses to
# run against moved anchors, so a partial revert is not a possible outcome: it either fully undoes
# the edit or it does nothing and says so.
set -uo pipefail
ART="${RUNPOD_ARTIFACT_DIR:-reports/runpod-gpu/local}"
mkdir -p "$ART"

echo "=== ARM: AFTER (the fix, as uploaded) ==============================================="
node tools/visual/w1-30-surface-orphan-census.mjs --out "$ART/census-after"           2>&1 | tee "$ART/census-after.log"
echo "census-after exit: ${PIPESTATUS[0]}"
node tools/visual/w1-30-surface-consumption.mjs --arm after --gpu hardware --require-hardware \
     --orbit 8 --canvas 960x540 --out "$ART/consumption-after"                        2>&1 | tee "$ART/consumption-after.log"
node tools/visual/deck.mjs --profile smoke --tag after --gpu hardware --require-hardware \
     --out "$ART/deck-after"                                                          2>&1 | tee "$ART/deck-after.log"
node tools/visual/deck-motion.mjs --profile smoke --tag after --gpu hardware --require-hardware \
     --every 1 --sheet-every 6 --out "$ART/motion-after"                              2>&1 | tee "$ART/motion-after.log"

echo "=== DELETE THE FIX =================================================================="
node tools/visual/w1-30-copy-seam-patch.mjs --revert                                  2>&1 | tee "$ART/revert.log"
if grep -q "^REVERT " "$ART/revert.log"; then
  echo "revert applied"
else
  echo "REVERT DID NOT APPLY — the BEFORE arm below is NOT a control"
fi
# Prove the revert reached the FILES, not just the log. Two independent reads: the marker must be
# gone from both sources, and the census below must go red. If the marker is still present the
# arm is a second copy of the positive arm and must not be reported as a control.
for f in game/src/render/visual-foundation.js game/src/render/actor.js; do
  if grep -q "W1-ORPHANED-SURFACE-SHADERS" "$f"; then echo "MARKER STILL PRESENT in $f — NOT A CONTROL"; else echo "marker gone from $f"; fi
done

echo "=== ARM: BEFORE (fix deleted, same GPU) ============================================="
node tools/visual/w1-30-surface-orphan-census.mjs --out "$ART/census-before"          2>&1 | tee "$ART/census-before.log"
echo "census-before exit: ${PIPESTATUS[0]}  (expected non-zero: the orphans are back)"
node tools/visual/w1-30-surface-consumption.mjs --arm before --gpu hardware --require-hardware \
     --orbit 8 --canvas 960x540 --out "$ART/consumption-before"                       2>&1 | tee "$ART/consumption-before.log"
node tools/visual/deck.mjs --profile smoke --tag before --gpu hardware --require-hardware \
     --out "$ART/deck-before"                                                         2>&1 | tee "$ART/deck-before.log"
node tools/visual/deck-motion.mjs --profile smoke --tag before --gpu hardware --require-hardware \
     --every 1 --sheet-every 6 --out "$ART/motion-before"                             2>&1 | tee "$ART/motion-before.log"

# Keep every 6th motion frame; the contact sheets carry the sequence and the raw frames are bulk.
find "$ART/motion-after/frames" "$ART/motion-before/frames" -name '*.png' 2>/dev/null | sort | awk 'NR % 6 != 1' | xargs -r rm -f
du -sh "$ART" | tee "$ART/return-size.txt"
echo "=== DONE ==========================================================================="
