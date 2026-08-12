# W1-06 corrected-surface M4/M5 constructive residual

Date: 2026-08-11  
Tested implementation commit: `2df978b` (the evidence-stamp follow-up changes text only).  Authority: satisfied `orchestration/plans/W1-06.md`, corrected
S49, RI-CAM01 M4/M5.

## What changed, and what did not

The instrument now treats M4/M5's numbers as distances to the 0.80 m wall's player-facing
surface. M4 therefore uses wall centres -6.40/-0.90 m for surfaces -6.00/-0.50 m. M5 uses centre
-3.40 m for surface -3.00 m and separately asserts that body collision keeps the pivot on the
playable side. `game/src/sim/camera.js`, every population, and every threshold are unchanged.

A transient red seed restored the old centre coordinates (-6.00/-0.50 and -3.00). Both new
`surface_distance_fixture` assertions failed. The transient file was restored and was not retained.

## Constructive residual (authority return, not a relaxed pass)

Command:

```sh
node tools/camera/cam-probe.mjs --probe rate,wall \
  --out /tmp/w1-06-builder/surface-positive-final.json
```

The repaired fixture proves its coordinates and M5 proves the body consumer: minimum pivot-side
clearance was 0.3201 m. Rate/dwell/orientation/FOV/fade checks pass (pull 0.6667 m/f, push
0.0500 m/f, 13.334:1, dwell 7 frames, yaw/pitch drift 0, opacity 0 at the floor). But the unchanged
zero-clip bar is red:

* M4: 1,392 / 2,880 `clip_through` frames; 0 guard frames; 0 floor-emergency frames.
* M5: 133 / 300 `clip_through` frames; 0 guard frames; 0 floor-emergency frames.

This is more specific than a claimed geometric impossibility: the shipping S49 synthetic remains
5/5 green, but the corrected native fixture emits clipping without activating either penetration
flag. Under the plan's explicit stop rule, this surface-registered residual returns to arbitration.
No production-camera edit, local exception, altered denominator, or weaker threshold is proposed.
An authority decision must first reconcile why S49's origin-plus-four-corner guard does not activate
on these native frames; the next builder can then make the authorised narrow repair and rerun the
same command.

## Transient evidence

The following uncommitted JSON files were created and inspected, then left outside the repository:

* `/tmp/w1-06-builder/surface-red-seed.json` — SHA-256
  `edbc4aff0f19ebe715255ce9b15a9ab07297f8ccd971855c2f8e56eaec1e3dd1`.
* `/tmp/w1-06-builder/surface-positive-final.json` — SHA-256
  `3969b55c639176142a3423f9a0b4d71a000920d3852ede267c671d3e2526d2d6`.

Reproduce the red seed on a disposable worktree by changing only the three centre constants in
`cam-probe.mjs` to -6.00/-0.50/-3.00, running the command above, and confirming both
`surface_distance_fixture` checks fail. Do not retain that edit.


## Canonical disposition — S50 (2026-08-12)

S50 resolves this return completely. The emitted clip frames are native hard failures, not allowable
surface-contact frames and not evidence that S49 is inapplicable. M4 establishes a production camera
containment/telemetry defect. M5 establishes the same camera failure and, at its observed 0.3201 m
minimum pivot clearance, a production body-collision feasibility defect because the unchanged
camera-to-head geometry requires a 0.349857... m horizontal boom component before containment is even
considered. The current probe's counts remain valid as hard-fail counts, but its lack of a per-frame
complete legal-set derivation is an instrument defect for assigning each frame to ordinary guard, S49
emergency, or no-legal-pose.

The binding corrected measurement, repair sequence, controls, stop conditions and preserved bars are
stated in ARBITRATION S50 and the satisfied plan's S50 continuation. No threshold, population, native
zero-clip gate, S48 ceiling, S49 pinch/stair authority, pivot-side requirement, or critic allocation is
changed.
