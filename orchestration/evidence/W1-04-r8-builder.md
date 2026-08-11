# BUILDER DELIVERY COMPLETE — W1-04

## Production/content changes

The complete S42 shipped denominator remains eight settlement documents and 115 interiors. All 115 interiors now have an exterior building row, including `barge-hold`, `thorn-house-0`, and `writ-house`. Every interior and matching exterior carries the literal RI-WLD13 §4 native contract. `planSettlement()` reads footprint dimensions from the exterior record and `applyInteriorBounds()` treats native interior records as inputs, rather than deriving their geometry from the exterior at load time.

The native static audit at the delivery tree reports 115/115 contract-complete, zero orphans, zero N2/N4/N5 breaches, and two N1 breaches (1.74%, within the native 2% allowance). The full continuity census reports 115/115 enumerated, 115 own-door re-entries, zero collision/footprint/wall failures at the authored doorstep, zero prop overhangs, and zero lamps outside their rooms.

## Builder-admissible rows

- RI-WLD13 M71: GREEN on the complete 115-record population. The freeze tool now computes N1/N2/N4/N5 per row and publishes worst N1 rows.
- RI-WLD13 M72 continuity prerequisite: GREEN offline across all 115 doors (own identity and standable authored return point). Native five-cycle/seeded-60 browser timing and state-diff evidence remains NOT_RUN because the contention gate returned WAIT at 11 browser instances; this builder did not launch a twelfth browser.
- RI-WLD13 M73: NOT_RUN. It requires capture evidence; the builder did not replace it with text or self-judge it.
- RI-WLD13 M74: the shipped S42 water-intersecting native population is zero (`water_plane_m: null` for every settlement interior), so no native W1-04 row is exercised. Sibling loop/water obligations remain with their authoritative evidence.
- RI-WLD13 M75/M76: native fields are complete across the denominator (23/115 seamless, 58/115 see-into, satisfying S42's proportional record thresholds). Browser traversal, transition-cost, visibility, and palette measurements remain NOT_RUN rather than inferred from declarations.
- RI-MTH07 and NPC/schedule/property/lock/faction/persistence consumers: reuse the current r7 live 23/23 consumption evidence and 9/9 invertible controls. The production delta preserves those consumer seams; a fresh live rerun was attempted only after static work but did not complete under browser contention, so historical evidence is not promoted to current acceptance.
- Mixed rows: the r7 20-judge applicability ledger is retained. No sibling system was rebuilt and no sibling historical score was promoted. Rows requiring current-commit independent sibling or browser evidence remain NOT_RUN.
- RI-WLD03 blind M13 remains NOT_RUN for a fresh independent judge. No builder PASS is claimed.

## Controls

`w1-04-r7-freeze.mjs --self-test-orphan` and `--self-test-contract` each exit non-zero. The shipped arm is GREEN. `w1-04-r6-census.mjs` and `check-building-fits-room.mjs` jointly consume the authored native records through the production planner/door table and are GREEN. The historical r6 delete-fix remains useful sibling evidence for the old runtime derivation, but it is not claimed as a control for the new native authored seam.

## Reproduction

```sh
node tools/world/w1-04-r7-freeze.mjs
node tools/world/w1-04-r7-freeze.mjs --self-test-orphan   # expected non-zero
node tools/world/w1-04-r7-freeze.mjs --self-test-contract # expected non-zero
node tools/check-building-fits-room.mjs
node tools/world/w1-04-r6-census.mjs --json reports/w1-04-r8/census.json
node tools/check-data.mjs
node tools/check-content.mjs
node tools/check-quests.mjs
node tools/check-souls-world.mjs
node tools/boot-check.mjs
```

Reports are transient per the binary/evidence rule. `reports/w1-04-r7/freeze.json` and `reports/w1-04-r8/census.json` contain the enumerated measurements and commit field when regenerated.

## Exact critic handoff

A fresh W1-04 critic should first run the freeze shipped and two self-test arms, then falsify the independent-authoring claim by tracing `planSettlement()` and `applyInteriorBounds()`. Run the census and `check-building-fits-room`; require 115/115 own re-entry and zero settle/prop/lamp failures. When contention permits, run the native seeded-60 five-cycle M72 state/clock journey, M73 capture population, M75 traversal/transition/visibility, M76 street visibility/palette, and current live RI-MTH07 suite. Reuse current sibling evidence for rows that read no W1-04-owned producer. Send WLD03 blind material to a fresh judge. Do not infer PASS from this builder delivery.
