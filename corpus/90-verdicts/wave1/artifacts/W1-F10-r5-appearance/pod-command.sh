set -uo pipefail
ART="$RUNPOD_ARTIFACT_DIR"
mkdir -p "$ART"
nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv > "$ART/gpu.csv" 2>&1 || true

# Record both arms' actor.js before anything is swapped, so a reader can verify which file each
# arm rendered rather than take this script's word for it.
cp game/src/render/actor.js /tmp/actor-treatment.js
sha256sum game/src/render/actor.js tools/visual/fixtures/f10-r5-control-actor.js > "$ART/arm-shas-at-start.txt"

# ARM 1 — AFTER (the tree as committed). First, so a watchdog kill costs the control, not the
# thing under test.
sha256sum game/src/render/actor.js > "$ART/after.actor.sha256"
node tools/visual/f10-r5-appearance.mjs --tag after --gpu hardware --require-hardware \
  --out "$ART/after" > "$ART/after.log" 2>&1
echo "after exit=$?" >> "$ART/exits.txt"

# ARM 2 — BEFORE. Only game/src/render/actor.js is reverted, to b175da8e. Everything else on the
# Pod — engine, UI, data, the capture tool itself, the GPU, the driver, the process — is held
# constant, which is the point of running both arms in one Pod.
cp tools/visual/fixtures/f10-r5-control-actor.js game/src/render/actor.js
sha256sum game/src/render/actor.js > "$ART/before.actor.sha256"
node tools/visual/f10-r5-appearance.mjs --tag before --gpu hardware --require-hardware \
  --out "$ART/before" > "$ART/before.log" 2>&1
echo "before exit=$?" >> "$ART/exits.txt"

cp /tmp/actor-treatment.js game/src/render/actor.js
{ echo "--- after ---"; cat "$ART/after.actor.sha256"; echo "--- before ---"; cat "$ART/before.actor.sha256"; } > "$ART/arm-proof.txt"
ls "$ART/after/frames" | wc -l >> "$ART/arm-proof.txt"
ls "$ART/before/frames" | wc -l >> "$ART/arm-proof.txt"
du -sh "$ART" | tee "$ART/return-size.txt"
