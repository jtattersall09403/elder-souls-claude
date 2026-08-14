#!/usr/bin/env bash
# W1-V2-CONTACT-SHADOWS-AO — both arms (AO on/off + null control) AND the delete-the-fix arm,
# all on ONE Pod, ONE GPU, in one run. Pattern copied from
# tools/visual/w1-30-copy-seam-hw.sh (W1-ORPHANED-SURFACE-SHADERS), which is the piece this
# remedy builds on top of.
set -uo pipefail
ART="${RUNPOD_ARTIFACT_DIR:-reports/runpod-gpu/local}"
mkdir -p "$ART"

echo "=== ARM: AFTER (the fix, as uploaded) — AO on/off + null control ===================="
node tools/visual/w1-v2-contact-ao.mjs --hardware-gpu --null-control \
     --out "$ART/after" --width 1280 --height 720 2>&1 | tee "$ART/after.log"
echo "after exit: ${PIPESTATUS[0]}"

echo "=== DELETE THE FIX ==================================================================="
node tools/visual/w1-v2-ao-patch.mjs --revert 2>&1 | tee "$ART/revert.log"
if grep -q "REVERT applied" "$ART/revert.log"; then
  echo "revert applied"
else
  echo "REVERT DID NOT APPLY — the BEFORE arm below is NOT a control"
fi
if grep -q "W1-V2" game/src/render/post/composite.js; then
  echo "MARKER STILL PRESENT — NOT A CONTROL"
else
  echo "marker gone from game/src/render/post/composite.js"
fi

echo "=== ARM: BEFORE (fix deleted, on the SAME hardware) ================================="
node tools/visual/w1-v2-contact-ao.mjs --hardware-gpu \
     --out "$ART/before" --width 1280 --height 720 2>&1 | tee "$ART/before.log"
echo "before exit: ${PIPESTATUS[0]}"

echo "=== RESTORE (so the Pod's own tree is left correct, even though it is ephemeral) ====="
node tools/visual/w1-v2-ao-patch.mjs --apply 2>&1 | tee "$ART/reapply.log"

echo "=== SUMMARY ==========================================================================="
node -e '
const fs = require("fs");
const a = JSON.parse(fs.readFileSync(process.argv[1]+"/after/result.json","utf8"));
const b = JSON.parse(fs.readFileSync(process.argv[1]+"/before/result.json","utf8"));
console.log(JSON.stringify({
  renderer: a.renderer, software_renderer: a.software_renderer,
  after_ao_off: a.ao_off, after_ao_on: a.ao_on,
  after_checks: a.checks, null_control: a.null_control_global_darken,
  before_ao_off: b.ao_off, before_ao_on: b.ao_on, before_checks: b.checks,
}, null, 2));
' "$ART" | tee "$ART/summary.json"
