# W1-04 persistent production builder — round 10 native completion

## Execution commit and repair

This continuation began at the required `1378e2a7372d4e3c819f81986b65979524ae08a7` tree. The missing runtime consumers were the RI-WLD13 `seamless` and `see_into` fields: data declared 23/115 and 58/115, but no renderer observation named transition/fade, doorway exterior visibility, or the real-interior impostor palette. `Renderer.setInteriorContinuity()` now consumes those fields for every interior cell, including the non-generic `writ-house` cell. The harness exposes the renderer-side observation together with the live shared sun bearing and aperture luminance. The cut/restored arm mutates both fields on a live record, observes both rows go red, restores them, and observes both return.

## Exact browser populations

`tools/world/w1-04-r10-native.mjs` launches one native Chromium instance after the contention gate and writes after every M73 row. It enumerates the full 115-record runtime manifest.

* **M73:** 24 unique, population-wide deterministic samples × four exact hours × clear/storm = **192/192** observations. Entry is established while the door is open, then the already-running interior is observed under the required hour/weather. Every row carries the live renderer sun bearing, aperture luminance, weather/hour and a SHA-256 observation trace. No entry refused, no sampled aperture was invariant across time, every storm arm changed interior aperture luminance, and every sun-bearing observation was present.
* **M75:** **115/115** settlement interiors traversed; every traversal entered and changed the drawn scene. **23/115** are seamless, meeting S42's ceil(20%)=23 threshold; those 23 report zero transition frames and exterior visibility at the doorway. All 115 report ≤30 transition frames and ≤12 fade frames.
* **M76:** **115/115** street-facing records observed; **58/115** are see-into, meeting S42's ceil(50%)=58 threshold. Every positive record uses the real interior as its matched impostor and reports palette distance 0.00 ≤0.20.

The committed JSON is `reports/w1-04-r10/native-populations.json`. The tool deliberately commits no bitmap. Its population, per-row observation hashes, exact commands, thresholds and control are reviewable and reproducible.

## Regressions and consumption

After the production change: static freeze is GREEN at 115/115, zero orphans and zero incomplete contracts; building fit is 115/115; offline re-entry is 115 own / 0 wrong / 0 absent; live real-latch re-entry is 115/115; settle checkpoints are 0/0/0/0 at frames 1/30/120/600; the room builder read 14,847 meshes across 115/115 rooms; and RI-MTH07 is 23/23 CONSUMED. Orphan and contract injections exit red, and the consumption disconnect self-test remains red as prescribed.

## RI-WLD03 M13 blind handoff

`tools/world/w1-04-m13-pack.mjs` produces eight uniform 512×512 label-free SVG plans in a shuffled A–H pack, a separate reveal mapping, SHA-256 inventories, the exact judge prompt and a tell audit. The SVGs contain no settlement names, labels, icons, UI, metadata, or palette/size tell. The builder has not opened the pack as a judge and records judgement **NOT_RUN**.

The owned 8-plan layout-reading leg is ready for a fresh judge. The second 16-plan median-rank leg still requires the separately licensed Morrowind top-down reference fixture (Balmora, Ald'ruhn, Sadrith Mora, Vivec, Pelagiad, Maar Gan, Gnisis, Seyda Neen); it is explicitly `not_run`, not inferred or self-authored. This is genuinely independent/reference evidence, not a missing W1-04 producer.

## Mixed-row handoff

The freeze classifies RI-AI07, RI-CAM05, RI-CHR02, RI-CRM01, RI-DLG02, RI-DLG03, RI-LOR06, RI-QST03, RI-QST07, RI-QST08, RI-STL02, RI-TRV01 and RI-WLD07 as mixed. Every W1-04-owned producer/consumer represented in the 23-row consumption suite is complete. Dialogue prose, quest resolution quality, combat encounter composition, camera judgement, external lore, transport-network topology and loop-dungeon predicates remain sibling evidence; no sibling score is inferred here. RI-LOR01/02/04 and RI-PRG03 are wholly external.

## Reproduction

```sh
node tools/contention.mjs --gate
node tools/world/w1-04-r10-native.mjs
node tools/world/w1-04-m13-pack.mjs
node tools/world/w1-04-r7-freeze.mjs
node tools/world/w1-04-r7-freeze.mjs --self-test-orphan       # expected exit 1
node tools/world/w1-04-r7-freeze.mjs --self-test-contract     # expected exit 1
node tools/check-building-fits-room.mjs
node tools/world/w1-04-r6-census.mjs --json reports/w1-04-r10/census-final.json
node tools/world/w1-04-r6-live.mjs --only L1,L2
node tools/world/w1-04-consumption.mjs --out reports/w1-04-r10/consumption.json
node tools/world/w1-04-consumption.mjs --self-test --out reports/w1-04-r10/consumption-self-test.json
node tools/check-data.mjs
node tools/check-content.mjs
node tools/check-quests.mjs
node tools/check-souls-world.mjs
node tools/boot-check.mjs
```

Independent M13 judgement remains pending and is not self-awarded.
