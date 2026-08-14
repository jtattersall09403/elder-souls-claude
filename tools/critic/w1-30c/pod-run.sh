#!/usr/bin/env bash
# W1-30C critic — the hardware run. Every appearance claim in the verdict comes from here.
#
# W1-30-EVIDENCE.md section 4 permits SwiftShader for determinism, census and boot checks and
# FORBIDS it for any appearance claim. The builder therefore took no appearance evidence at all
# and handed the hardware run to its critic. This is that run.
#
# It never exits non-zero for a failed stage — a Pod that dies mid-script loses every artifact, so
# each stage is time-boxed and allowed to fail, and its status is recorded. The verdict reads the
# artifacts, not this script's exit code. Stages are ordered most-important-first for the same
# reason: if the deadline bites, it bites the cheapest evidence.
set -x
ART="${RUNPOD_ARTIFACT_DIR:?}"
mkdir -p "$ART"
export ELDER_SOULS_MIN_FREE_MB=200
export VT_HARDWARE_GPU=1
DECK=tools/critic/w1-30c/deck-w1-30c.json

note () { echo "[w1-30c] $(date -u +%H:%M:%S) $*" | tee -a "$ART/stages.log"; }
stage () { local n="$1" t="$2"; shift 2; note "BEGIN $n"; timeout "$t" "$@"; note "END $n status=$?"; }
arm () { stage "deck-$1" "${3:-600}" node tools/visual/deck.mjs --deck "$DECK" --profile "$2" --tag "$1" --out "$ART/deck/$1"; }

nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv > "$ART/gpu.csv" 2>&1 || true

# ---- 1. mechanism suite on hardware ---------------------------------------------------------
# The same instrument that ran on SwiftShader. If any mechanism result flips between the two, the
# SwiftShader arm of this verdict is void, and that is the single most important thing to know.
stage mech 420 node tools/critic/w1-30c/mech.mjs --hardware --out "$ART/mech"

# ---- 2. the Deck, child-scoped (R3a): this child's gate shots + the 12-shot census sample ----
# The census sample is seeded by the commit hash, so the builder could not have known which
# twelve shots would be drawn.
arm A-shipping w1-30c-critic 900

# ---- 3. the diffuse-floor removal test, as a 2x2 ---------------------------------------------
# The plan's row: "removing the diffuse floor at visual-foundation.js does NOT collapse facades to
# charcoal in the 8 settlement street shots (mean luma stays >= 0.14)"; null control: "keep the old
# textures and remove the floor; it must collapse".
#
# There are TWO floors, not one. visual-foundation.js consumeStyleboard() carries a role floor
# (.235/.27/.31) and world/province.js _settlementStyleboard() carries a SECOND per-family floor
# (.22-.43) applied to exactly the settlement facades this row measures. Removing one and leaving
# the other is RULES.md rule 6's fourth shape — two guards for one defect — so this runs both.
cp game/src/render/visual-foundation.js /tmp/vf.orig
cp game/src/world/province.js /tmp/prov.orig
restore () { cp /tmp/vf.orig game/src/render/visual-foundation.js; cp /tmp/prov.orig game/src/world/province.js; }
killCfloor () { sed -i "s/const floor=role==='contrast'?.31:role==='secondary'?.27:.235;/const floor=-1;/" game/src/render/visual-foundation.js; }
killPfloor () { sed -i "s/const floor=floorByFamily\[family\];/const floor=-1;/" game/src/world/province.js; }
killTex ()   { sed -i "s/authored=options.authored===false?null:authoredMaps(family)/authored=null/" game/src/render/visual-foundation.js; }

killCfloor;                     grep -c "const floor=-1;" game/src/render/visual-foundation.js > "$ART/patch-B.txt"
arm B-noCfloor w1-30c-floor
killPfloor;                     grep -c "const floor=-1;" game/src/world/province.js > "$ART/patch-C.txt"
arm C-noBothFloors w1-30c-floor
killTex;                        grep -c "authored=null" game/src/render/visual-foundation.js > "$ART/patch-D.txt"
arm D-noFloorsOldTex w1-30c-floor
restore; killTex;               grep -c "authored=null" game/src/render/visual-foundation.js > "$ART/patch-E.txt"
arm E-oldTexFloorsIntact w1-30c-floor
restore

# ---- 4. the family close-up rig, on hardware -------------------------------------------------
# The builder's own permanent instrument, run through hardware GL rather than SwiftShader, so the
# close-up gate's numbers and the contact sheets become appearance-valid — and so the naive
# grouping test has a pack taken on the rasteriser the game ships on. The rig hardcodes the
# deterministic (SwiftShader) Chromium args; patch the EPHEMERAL pod copy only.
sed -i 's/DETERMINISTIC_CHROMIUM_ARGS.slice()/HARDWARE_CHROMIUM_ARGS.slice()/; s/{ headless: true, args:/{ headless: false, args:/; s/DETERMINISTIC_CHROMIUM_ARGS }/DETERMINISTIC_CHROMIUM_ARGS, HARDWARE_CHROMIUM_ARGS }/' tools/assets/family-closeup.mjs
grep -n "HARDWARE_CHROMIUM_ARGS" tools/assets/family-closeup.mjs > "$ART/closeup-patch.txt"
stage closeup 600 node tools/assets/family-closeup.mjs --null-control --out "$ART/closeup"

# ---- 5. rain, on the shipping build ----------------------------------------------------------
stage deck-rain 480 node tools/visual/deck.mjs --deck "$DECK" --profile w1-30c-rain --tag F-rain --out "$ART/deck/F-rain"

du -sh "$ART" >> "$ART/stages.log" 2>&1
note "done"
exit 0
