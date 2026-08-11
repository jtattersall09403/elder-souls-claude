# W1-06 production-builder delivery — 2026-08-11

Tested tree: the commit produced by this delivery (the pre-commit test runs used
`8a0b034830cb2f4583d26efc45b6663ec8ed7176` plus the engine recovery recorded below).
This is builder evidence only. It awards no critic-owned or blind result.

## Canonical engine dependency recovery

Merged HEAD claimed to resolve the prior browser dependency, but the recovered
`game/src/engine.js` still changed from JavaScript to non-JavaScript bytes immediately after the
comment ending “province of newly built bodies for the price of a”. `node --check` failed there
and no browser camera method could start. The readable merged prefix was preserved and the
remainder was restored from the corresponding suffix in merge parent `5a46984`. The resulting
module passes `node --check game/src/engine.js`, and `node tools/harness/boot-check.mjs` constructs
the engine and receives a harness response. This completes the previously recorded dependency
rather than selecting an entire old parent and discarding the merged prefix.

## Builder production-path runs

* `node tools/camera/s49-penetration-guard.mjs` passes 5/5: open-world refusal, necessity,
  zero clipping, next-millimetre maximality, and late return to the ordinary floor.
* `node corpus/80-methods/m-cam01-rig.mjs --out
  evidence/W1-06/mechanical/builder-final` is now browser-runnable. Its exact output is
  `mechanical/builder-final/m-cam01-rig.json`; 21/28 checks pass and seven remain red.
* `node corpus/80-methods/m-cam03-lockon-framing.mjs --out
  evidence/W1-06/mechanical/builder-final` runs its static and browser legs. The pitch-bias
  population passes 5/5; the browser artifact records 13/19 passing checks and six red checks.
* `node corpus/80-methods/m-cam05-world-camera.mjs --out
  evidence/W1-06/mechanical/builder-final` is now browser-runnable and records 19/24 passing
  checks. The first-person refusal/mode population is wholly green. Dialogue settling and the
  stair population remain red.
* `m-cam06-feel` was terminated after exceeding the contract's approximately 15-minute
  critic-runtime boundary without producing an artifact. It is a long complete population,
  not a builder PASS.

## Genuine canonical block exposed after recovery

The recovered browser path disproves the premise needed to complete S49 on the prescribed native
fixtures. The narrow five-row S49 instrument has a clear non-negative emergency pose, but the
native M4 moving-wall and M5 backing-wall fixtures each still contain frames for which the shipping
guard finds no legal candidate satisfying all three binding conditions: non-negative boom,
origin-plus-four-near-plane-corners clear, and camera-to-head distance at least 0.35 m. The exact
native results remain `clip_through == true` for 12 M4 frames and for M5 frames after the arm reaches
approximately 0.35 m. S49 says such a frame remains a hard fail and authorises neither a negative
boom nor a fixture edit. Therefore those rows are canonically blocked on a constructive authority
resolution; they are not reported green and no local threshold or population was changed.

The larger native census also remains red (2,377 clip frames: cistern 1,698, stair 615, pinch 64),
and exposes independent framing, dialogue-settling and stair-smoothing production misses in the
three committed JSON artifacts. These are preserved as critic/remediation handoff rather than
being hidden by the restored engine. All fresh, blind, visual-scoring and final native aggregation
rows remain critic-owned and `not_run by builder`.

## Canonical disposition — S49 correction, 2026-08-11

The “genuine canonical block” diagnosis above is preserved as the builder's accurate report of the
then-governing authority, but it is superseded for dispatch by corrected ARBITRATION S49. The M4/M5
failures arise from an **instrument fixture-coordinate defect**: the native wall distances denote
the player-facing surface, while `cam-probe.mjs` supplied them as centres of the 0.80 m-thick
`rail_wall`. The realised M4 face ended at 0.10 m rather than 0.50 m; M5 had the same 0.40 m offset
and lacked the required pivot-side/body-collision proof. This creates the observed no-legal-pose
interval when zero clipping, a non-negative boom, complete near-plane clearance and the 0.35 m
camera-to-head floor are all correctly retained. It is neither a production implementation defect
nor authority to edit game collision data or relax a camera threshold.

Canonical reproduction now requires M4 centre endpoints −6.40/−0.90 m and M5 initial centre
−3.40 m for the current 0.40 m half-depth, plus an independent M5 pivot-side assertion. The
committed JSON remains valid evidence that the old instrument fails and must not be relabelled
green. Pinch, stair and every other reported red row remain unresolved on their existing bars.
