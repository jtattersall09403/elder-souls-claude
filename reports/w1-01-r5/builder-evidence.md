# W1-01 r5 builder evidence — current integrated HEAD

Commit under test before this delivery: `091a6ce` (`work`), with builder changes dirty where stated.
No binary evidence is committed; JSON outputs are transient under `reports/w1-01-r5/` and are reproducible with the commands below.

## Builder-admissible results

- PASS — `scale-audit.mjs`: all 20 aggregate rows, including 4825×5540 m bounds, 14.31 km² land, eight settlement centroids at 0 m error, 7.46 min maximum habitation gap, 34.1% road relief, 13/13 regions, 8/8 settlements, 99.3% raster reachability, no non-tideway water offences, and 16/16 declared spans consumed.
- PASS — `road-water-audit.mjs`: zero non-tideway leg/phase offences over ten legs and four tides.
- PASS — water census: WCI 0.294, spread 0.86, five dry, two bone-dry, two drowned, eleven classes and five tidal regions.
- PASS — hazard census: 19 hazards, one KILL, eight zero-damage and signatures in 13/13 regions.
- PASS — travel static: 5 modes, 26 stations, 68 services, 17 lines, connected density 0.357, seven water legs, tariffs 12/45/90 and 17/17 additive line tickets.
- PASS — region axes (`region-axes.json` reports `pass: true`).
- PASS — road/building shipped arm: zero named-route offences and zero of ten legs through a building. Its formerly stale control is repaired to inject `stormhold-scribe` onto the road, observe RED, move it 1,000 m away, observe GREEN, and hold every unrelated offence invariant.
- PASS — `boot-check.mjs` after the instrument edits.

## Builder-actionable RED and genuine cross-piece invalidation

The current integrated live crossing is RED before this delivery changes production: the capsule stalls after 17.7 m at `(2157, 761.9)` with 105 settlement solid shapes nearby. It therefore cannot produce the native crossing time/distance/speed rows. The offline building-footprint join is green, proving that its population omits a live solid class and cannot stand in for the body walk. This is a W1-01 traversal finding at the W1-04 settlement-continuity/W1-05 road join; no W1-04 or W1-05 production contract was overwritten here.

The native 900-frame span push is also RED on current integrated HEAD. The corrected probe measures distance to the realised span polyline rather than to a single midpoint tangent (the old method falsely called curved, on-deck motion a leak). Current production still permits sustained exits, so the row remains RED. A 300-frame diagnostic briefly held 32/32 after experimental production changes, but the required 900-frame rerun falsified that candidate; those experimental production edits were reverted rather than shipped.

`road-grade.mjs` remains RED on earth-road shoulder regain/fall rows (54 regain samples, 491 fall-step samples) and its short-step parapet approximation. Its injected bent-road self-test passes.

## Controls exercised

- `road-through-building.mjs --self-test`: injected defect RED; moved-building arm GREEN; unrelated population invariant.
- `road-grade.mjs --self-test`: 6.09° → 78.75° and aggregate RED; unrelated legs invariant.
- Parapet candidate: 300-frame positive arm temporarily 0/32 leaks, but the governing 900-frame arm went RED. Candidate production was deleted/reverted; this prevented an inert or under-duration fix from landing.
- Existing scale consumers: 16/16 spans read by `field.onDeckAt`; census-only declarations were not promoted to live PASS.

## Independent-only rows — NOT_RUN

The builder did not judge any pack. RI-WLD04 M17 day/night/worst-weather human classification; RI-AI05 ten-plus-ten role clustering; both RI-WLD10 curve and image comparisons; M56 interleaved ranking; and RI-CAM02 mass-series comparison are all `NOT_RUN`. No independent PASS is claimed. Current source populations were not sealed because the prerequisite live traversal aggregate is RED.

## Future independent critic entry point

After a fresh builder closes the live settlement-solid crossing, 900-frame parapet population, and earth-shoulder rows, start at `orchestration/plans/W1-01.md` step 1 on that commit. Re-run static aggregates first, reuse native traces/captures for steps 9–11, validate tells/wrong populations, then dispatch fresh independent judges for WLD04 M17, AI05, both WLD10 comparisons and CAM02. The final aggregate must fail closed for every missing judgement.
