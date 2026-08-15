set -uo pipefail
ART="$RUNPOD_ARTIFACT_DIR"
mkdir -p "$ART"
nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv > "$ART/gpu.csv" 2>&1 || true

# ── THE CONTROL, AND WHY IT IS A FILE SWAP AND NOT A TREE CHECKOUT ────────────────────────────
# Both arms run BACK TO BACK IN ONE POD, on one GPU, in one process tree, against one snapshot.
# The only thing that differs between them is two files reverted to the pinned baseline blob
# `bb65607a`, verified here by sha256 rather than trusted. Everything else on this Pod — engine,
# world data, UI, the capture tool itself, the driver, the clock — is held byte-identical, which
# a `git checkout` of a whole tree cannot promise (HAZARDS §11, §12).
cp game/src/render/renderer.js /tmp/renderer-treatment.js
cp game/src/render/actor.js    /tmp/actor-treatment.js
sha256sum game/src/render/renderer.js game/src/render/actor.js \
          tools/visual/fixtures/f10-r7-control-renderer.js \
          tools/visual/fixtures/f10-r7-control-actor.js > "$ART/arm-shas-at-start.txt"

# ── ARM 1 — AFTER (the tree as committed). FIRST, so that a watchdog kill costs the control
#    rather than the thing under test.
sha256sum game/src/render/renderer.js game/src/render/actor.js > "$ART/after.shas"
node tools/visual/f10-r7-appearance.mjs --tag after --gpu hardware --require-hardware \
  --out "$ART/after" > "$ART/after.log" 2>&1
echo "after exit=$?" >> "$ART/exits.txt"

# ── ARM 2 — BEFORE. Round 7 removed: the NPC ground placement and the three conform call sites
#    (renderer.js), and the eye and poseStatic's `water` parameter (actor.js).
cp tools/visual/fixtures/f10-r7-control-renderer.js game/src/render/renderer.js
cp tools/visual/fixtures/f10-r7-control-actor.js    game/src/render/actor.js
sha256sum game/src/render/renderer.js game/src/render/actor.js > "$ART/before.shas"
node tools/visual/f10-r7-appearance.mjs --tag before --gpu hardware --require-hardware \
  --out "$ART/before" > "$ART/before.log" 2>&1
echo "before exit=$?" >> "$ART/exits.txt"

# Restore, and prove the restore happened — an arm left swapped would poison anything that ran
# after it on this Pod.
cp /tmp/renderer-treatment.js game/src/render/renderer.js
cp /tmp/actor-treatment.js    game/src/render/actor.js
sha256sum game/src/render/renderer.js game/src/render/actor.js > "$ART/restored.shas"

{ echo "--- after (HEAD) ---";        cat "$ART/after.shas";
  echo "--- before (bb65607a) ---";   cat "$ART/before.shas";
  echo "--- restored ---";            cat "$ART/restored.shas";
  echo "after frames:  $(ls "$ART/after/frames"  2>/dev/null | wc -l)";
  echo "before frames: $(ls "$ART/before/frames" 2>/dev/null | wc -l)"; } > "$ART/arm-proof.txt"
cat "$ART/arm-proof.txt"
du -sh "$ART" | tee "$ART/return-size.txt"
