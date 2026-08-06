# Negative evidence — instruments and fixtures named by the reference items that do not exist

Produced by: `ls -la` / `test -e` at 2026-08-06T14:39:20Z, commit 445bfa69412bf2f80ea8334e3b9c6a2d1a341ab4

## Named by the item, absent from the tree

- **ABSENT** `corpus/80-methods/m-cmb07-expand.mjs`
- **ABSENT** `corpus/80-methods/m-cmb07-stats.mjs`
- **ABSENT** `corpus/80-methods/m-cmb07-diff.mjs`
- **ABSENT** `corpus/80-methods/m-cam06-feel.mjs`
- **ABSENT** `tools/platform/perf-run.mjs`
- **ABSENT** `tools/platform/decoupling.mjs`
- **ABSENT** `tools/platform/load-run.mjs`
- **ABSENT** `tools/platform/hitch-census.mjs`
- **ABSENT** `tools/platform/stream-audit.mjs`
- **ABSENT** `tools/journey/journey-run.mjs`
- **ABSENT** `tools/journey/state-diff.mjs`

## Present
- PRESENT `corpus/80-methods/m-cam02-control.mjs`
- PRESENT `tools/platform/calibrate.mjs`
- PRESENT `tools/platform/alloc-probe.mjs`
- PRESENT `tools/harness/seed-sweep.mjs`

## Scenarios registered (RI-CAM02/RI-CAM06 name cam-open-plain, cam-walk-cistern, wld-walk-lilmoth)
```
cmb-duel-infantry.json
cmb-spacing-hold.json
cmb-stamina-drain.json
mth-warmup-noenemy.json
smoke.json
```

## Regions with playable content (RI-PLT03 M-L9/L10/L13/L14 need a border to cross)
```
regions declared in data: 13
arena_flat.json
default.json
dungeon_primary.json
endgame-200q.json
interior_firelit.json
material_showcase.json
npc_showcase.json
settlement_primary_street.json
sv1-midquest.json
sv5-journal-bloodstain.json
swamp_canopy.json
thorn-hall.json
vista_primary.json
water_shallows.json
```

The commands that would have shown the checks:
```
node tools/platform/load-run.mjs --profile phone-mid --network fast3g --cold   # RI-PLT03 M-L1..M-L20
node corpus/80-methods/m-cmb07-diff.mjs                                       # RI-CMB07 M1-M4
node corpus/80-methods/m-cam06-feel.mjs                                       # RI-CAM06 M1-M9
```
