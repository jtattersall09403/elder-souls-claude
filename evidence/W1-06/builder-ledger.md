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

## Persistent continuation — starting commit reproduction and authority boundary (2026-08-11)

The complete governing collision census was reproduced before making any production change with:

```sh
node tools/run.mjs -- node tools/camera/cam-probe.mjs \
  --probe clip,rate,wall \
  --out evidence/W1-06/mechanical/collision-reproduction-1378e2a.json
```

At exact starting commit `1378e2a7372d4e3c819f81986b65979524ae08a7`, the result is **2,456** clip frames: cistern 1,716, stair 617, rig pinch 123, and zero in mangrove, boardwalk, and boss arena. The earlier 2,726 artifact is not relabelled or overwritten: its additional 270 boardwalk frames do not reproduce on this exact later tree, whose integrated boardwalk fixture no longer places a hut across its spine. The M4 moving wall still clips on 12 frames and M5 backing-wall clipping still reproduces. The emitted clip flag agrees with the independent origin/near-plane containment derivation, so this is not an instrument false positive.

Diagnosis reached the genuine corpus-authority boundary recorded in `reports/w1-06/AMENDMENT-W1-06-02-arm-floor-zero-clip.md`. The prescribed moving-wall endpoint, backing-wall reversal, 1.20 m pinch and eight-yaw 30° stair population each include configurations whose solid is inside the swept envelope of a fixed-ray camera constrained to an absolute 0.90 m boom. No predicate, population, denominator, route, arm threshold, or clipping label was changed. Because S48 explicitly resolves only the crawl ceiling, a further ruling is required before production can legally choose whether architecture/fixtures or the emergency boom yields.

All perceptual packs remain unscored. Mechanical work that depends on a green collision prerequisite is intentionally not represented as complete.

## S49 production continuation — 2026-08-11

The merged S49 ruling is now implemented in the shipping camera path. The ordinary spring target
and 0.90 m floor are unchanged. When the origin-plus-four-near-plane-corner envelope is contained,
the guard independently searches the unchanged boom ray. It crosses the floor only if no clear
candidate exists from 0.90 m through the desired length, selects the greatest clear candidate that
also preserves the camera-to-head minimum, emits both `arm_penetration_guard` and
`arm_floor_emergency`, and clears the emergency flag while returning under ordinary push-out.

`node tools/camera/s49-penetration-guard.mjs` is the bounded production-path proof. Its five rows
cover an open-world refusal, necessity, zero clipping, maximality at the next millimetre, and a
settled late-frame return after the obstacle is removed. All five pass. Replacing only
`game/src/sim/camera.js` with the starting-HEAD version makes the same instrument exit 1: the
emergency remains at 0.90 m, emits neither flag and reports `clip_through: true`. This is the
targeted delete-the-fix red arm; the positive and delete outputs were inspected from `/tmp` and
are intentionally not committed as generated evidence.

Deterministic generation and cheap gates pass: `gen-cells.mjs --check`, the live camera-module
height table and moving-target trace, `check-data`, `check-content`, and `check-quests`. The quest
gate retains its pre-existing warning about twelve document reveals but exits green.

### Canonical dependency block on browser/native completion

The exact merged HEAD stores `game/src/engine.js` as 300,062 bytes of non-JavaScript data
(SHA-256 `9777c138f6fd210815a9a8d594ccb4df24ed3921e9501eb93e4a48f012bad7d2`). The blob is identical
in both parents of PR #134 and first appears in merge `e0b0313`; both parents of that earlier merge
contain readable JavaScript with different hashes. `node --check game/src/engine.js` fails at byte
one, Chromium reports `SyntaxError: Invalid or unexpected token` for `/src/engine.js`, and the
harness never appears. Therefore every browser-backed native method, rendered sample, mode/
transition matrix, full collision census and browser aggregate is canonically unavailable on the
required branch. Restoring either pre-merge parent would arbitrarily discard the other parent's
merged engine work, so this camera builder records the exact dependency rather than inventing a
cross-piece merge ruling. All independent visual/blind rows remain critic handoff and unscored.
