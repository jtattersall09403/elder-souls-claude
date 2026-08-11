# W1-04 persistent production builder — round 9

## Production repair

Execution tree began at required commit `11ae120b81595c00dc7d3f56d520aab89efe8543`. The full S42 denominator is 115 interiors. The current static freeze is GREEN: 115/115 literal RI-WLD13 §4 records, zero orphans, and M71 breach counts N1=2, N2=0, N4=0, N5=0. The runtime census is 115/115 enumerated and 115 own / 0 wrong / 0 absent.

The live real-latch census reproduced the remaining defect specifically at `barge-hold` and `writ-house`: both returned no reachable door. Thorn's two outlying buildings stood beyond its 44 m settlement membership radius, and Writ House collision-settled 2.70 m from its latch while the independently mirrored reach was 2.60 m. The production repair expands Thorn's authored footprint to cover its authored buildings and makes the simulation/planner reach mirrors 3.0 m. A complete rerun is 115/115 own room, zero wrong, zero absent. The four settle checkpoints are 0/0/0/0 bodies in buildings at frames 1/30/120/600.

## Builder-owned rows

- M71: COMPLETE, full 115 population, fail-closed orphan and contract arms retained.
- M72 continuity prerequisite and all-record real-latch entry/exit/restoration/re-entry: COMPLETE, 115/115. The existing tool writes after every eight rows and its partial checkpoint is resumable evidence.
- M74: COMPLETE / native population empty: all 115 records explicitly carry `water_plane_m: null`; no intersecting settlement interior is silently skipped.
- RI-MTH07: COMPLETE at current tree. All 23 live rows are CONSUMED. The independent disconnect run is retained as the applicable red-control arm.
- M73, M75 and M76: the production contracts and consumers remain present, but the exact native capture/traversal/palette populations were not completed in this round. They are **not** promoted from declarations or historical evidence.
- W1-27 dependency: W1-04 supplies its complete current S42 Tier-A contribution of 115 named interiors. The remaining A+B floor and the exterior native POI registry are explicitly owned by W1-02/W1-05 in `orchestration/status/W1-27.json`; shrinking, relabelling, or duplicating interiors as exterior POIs would falsify both denominators.
- RI-WLD03 M13: exact fresh independent blind handoff; NOT_RUN and no builder judgement.

Because exact native M73/M75/M76 remain unfinished, this is an honest repair-cycle checkpoint rather than a self-awarded critic PASS.

## Exact reproduction

```sh
node tools/world/w1-04-r7-freeze.mjs
node tools/world/w1-04-r7-freeze.mjs --self-test-orphan       # expected exit 1
node tools/world/w1-04-r7-freeze.mjs --self-test-contract     # expected exit 1
node tools/check-building-fits-room.mjs
node tools/world/w1-04-r6-census.mjs --json reports/w1-04-r9/census-final.json
node tools/world/w1-04-r6-live.mjs --only L1,L2
node tools/world/w1-04-consumption.mjs --out reports/w1-04-r9/consumption.json
node tools/world/w1-04-consumption.mjs --self-test --out reports/w1-04-r9/consumption-self-test.json
node tools/check-data.mjs
node tools/check-content.mjs
node tools/check-quests.mjs
node tools/check-souls-world.mjs
node tools/boot-check.mjs
```

Reports are transient JSON, not committed binaries. The final commit hash is recorded in the status after commit; each reproduction tool also stamps `git rev-parse HEAD` in its regenerated report.
