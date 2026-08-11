# W1-06 builder ledger

Commit stamp is supplied by `git rev-parse HEAD` in the delivery command log; source hashes are in `source-pack/SHA256SUMS`. This ledger records builder-side execution only and awards no independent PASS.

## Native mechanical rows

| Governing row | Builder result | Evidence / disposition |
|---|---|---|
| RI-CAM01 M1 | PASS after instrument repair | Native census passes geometry except the probe's reversed independent up basis; `tools/camera/cam-probe.mjs` now derives `forward × right`, matching the item's right-handed convention. Re-run required at delivery commit. |
| RI-CAM01 M2 | FAIL | Native cistern: fraction below 1.60 m 0.2755, pinned 0.2523. This cannot be coloured green. |
| RI-CAM01 M2b | NOT_RUN | Native ID-buffer judgement is not implemented by the existing delegate. |
| RI-CAM01 M3 | FAIL | 2,493 clip frames: cistern 1,606; boardwalk 270; stair 617; mangrove/boss/pinch zero. This is a hard fail, not a survey pass. Crawl frames are not separable in the current trace, so no valid cistern subset is claimed green. |
| RI-CAM01 M4 | FAIL | Rate law rows run; moving-wall fixture clips at the unchanged 0.90 m arm floor. |
| RI-CAM01 M5 | FAIL | Yaw/pitch/FOV/fade pass; backing-wall fixture clips at the unchanged 0.90 m arm floor. |
| RI-CAM01 M6 | PASS | Actor collision-layer exclusion passes. |
| RI-CAM01 M7 / RI-MTH01 determinism | NOT_RUN | The combined long run was stopped after 20 minutes without producing an artifact; no inference is made. |
| RI-CAM02 M1 | RUNNABLE / NOT_RUN | `look_stick` is live and prior consumption perturbation is preserved; exact full deflection sweep remains not run. |
| RI-CAM02 M2/M3/M5 | NOT_RUN at delivery commit | Native delegate exists; long combined run produced no artifact and was stopped rather than guessed. |
| RI-CAM02 M4/M6/M7 | NOT_RUN | Native turn/recentre/mouse-stick seam requires a clean rerun. |
| RI-CAM03 M1/M2/M4/M5 | PASS on cheap native pitch instrument; browser rows NOT_RUN | Height law uses live entity `id`; 0.6–8.0 m table is monotone in height and containment is on screen. The distance series has the item's known small 2→3 m non-monotonic kink, recorded rather than hidden. |
| RI-CAM03 SD/SE | PARTIAL | Live target heights are consumed; complete moving-target/browser containment population was not produced. |
| RI-CAM05 M1–M7 | NOT_RUN at delivery commit | Existing native delegate covers modes/stairs/first-person guard; no completed new artifact. The formally disputed crawl remains unchanged under AMENDMENT-W1-06-01. |
| RI-CAM06 M1–M9 | NOT_RUN at delivery commit | Existing native delegate covers feel/coupling/scripted death/fog rows; no completed new artifact. |
| RI-CMB06 camera-relative/target-relative rows | NOT_RUN | Blind M4 is reserved for an independent critic; builder did not score it. |
| RI-AI06 mechanical target containment | PARTIAL | Static height/distance camera law ran; moving decision-clip panel is independent and not builder-scored. |
| RI-CAM07 / RI-VIS08 | NOT_RUN | Native presentation prerequisite and blind visual rows remain independent; no numerical proxy substituted. |
| S18 clauses 1–18 | NOT_RUN as an aggregate | Individual rig/mode/lock/death seams exist, but a complete 18-row native aggregate was not produced; C1 therefore remains red. |
| S25 water/body silhouette | NOT_RUN | Requires native visual judgement against W0–W5; builder did not self-judge it. |
| Native model CONSUMPTION | PASS (builder mechanical) | Native perturbations consumed pivot height, free arm, FOV projection, look rate, and death pitch; 6/6 checks pass in `mechanical/cam-consume.json`. |

## Mechanical hard-fail accounting

The current native collision evidence has seven red checks. The right-handed census defect was in the instrument and is repaired. The other six are not waived: two cistern arm-distribution failures and clip failures in the aggregate, independent origin check, moving-wall rig, and backing-wall fixture. The crawl authority dispute is narrower than these results and cannot excuse boardwalk or stair clipping. No local threshold, arm minimum, rig height, or clip definition was changed.

## Exact independent critic handoff

Use only delivery-commit artifacts and regenerate visual binaries transiently; do not commit captures.

1. **RI-AI06 M4:** critic owns assignment/reveal, 20 naïve decision clips, 20-minute study trace/transition graph, then 20 fresh clips; record answers before reveal; accept only ≤35% naïve and ≥60% post-study.
2. **RI-CAM01 blind pair:** provide two unlabelled same-route `arm_len_m` series (ours and native law). Critic records fast-in/slow-out versus spring pick before reveal; ours-picked invokes the native harsher rerun.
3. **RI-CAM02 blind pair:** provide unlabelled 180° reversal series; critic records mass pick before reveal.
4. **RI-CAM05 M1:** ten matched HUD-off 1920×1080 transient shots, five combat/five exploration; fix the discriminating question before assignment. Better-than-chance sorting fails.
5. **RI-CMB06:** two unlabelled 64-row M4 tables; critic records which permits trustworthy thumb control before reveal.
6. **RI-VIS08:** fresh context-only D1 judge sees only 40 px masks. Separately apply RI-VIS06 Protocol A to `character_closeup`/RI-VIS02 REF-M6 if usable; otherwise native skip, never PASS.
7. **RI-CAM07 M6:** critic records disjoint bifurcation first; judge F2–F5 blind under RI-VIS06 against RI-VIS05 only. Keep fidelity and art scores separate; minimum governs.

Do not dispatch these rows until the mechanical hard fails above are repaired and all source rows have complete commit-stamped artifacts. Builder-authored, context-exposed, leaked, wrong-reference, or self-scored answers are inadmissible and remain `NOT_RUN`.

## Persistent-builder continuation — 2026-08-11

Authority resolution is complete: ARBITRATION S48 granted `AMENDMENT-W1-06-01` via the
level-geometry alternative, raised the crawl clear ceiling to 1.80 m, and preserved the exact
zero-clipping law. The generator and committed camera cell population implement that ruling.

The route consumer now seeds its first ground query from the authored cell ground, preventing
interior routes from beginning on an overhead roof. The boardwalk fixture no longer authors a hut
across its walking spine. These are production and fixture repairs, not threshold changes.

The complete post-repair collision run is preserved in `mechanical/collision-final.json`. It remains
red and therefore initiates another repair cycle: 2,726 clip frames (cistern 1,716; boardwalk 270;
stair 617; rig pinch 123), plus moving-wall and backing-wall fixture failures. The run exposed a
remaining authority-level contradiction: RI-CAM01 fixes an absolute 0.90 m arm floor while its M4
moves a wall to 0.50 m behind the pivot and simultaneously requires the camera/near plane never to
clip. The builder did not hide this by shortening below 0.90 m or weakening `clip_through`.

RI-CAM02 M1/M2/M2b/M3/M5 are complete and green in `mechanical/cam02-final/cam02.json`: the native
M1 population contains 808 rows / 24,240 frames, R² 0.999999999, a radial 0.15 deadzone, nonzero
0.16 diagonal response, and exact 180/120 degree-per-second saturation. Locked M2 correctly applies
its native explicit locked predicate (the [-50,+32] band) rather than mislabelling RI-CAM03 framing
motion as unlocked-input bounce. M4/M6/M7 remain represented by the aggregate camera probe rather
than being silently inferred here.

No independent perceptual or blind row was scored or awarded by this builder. The exact independent
handoff above is unchanged, and no committed PNG/binary was added.
