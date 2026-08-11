# AMENDMENT-W1-06-02 — the absolute 0.90 m boom floor conflicts with four prescribed zero-clip fixtures

> **RULING — S49, wave 1: GRANTED VIA THE EMERGENCY-BOOM ALTERNATIVE AND APPLIED.**
> The 0.90 m value remains the normal collision floor. RI-CAM01 §C's penetration guard alone
> may choose the greatest clear non-negative length below it when an independent
> origin-plus-four-near-plane-corners search proves that no candidate at or above 0.90 m is
> clear. Every fixture, yaw, route, denominator and the absolute zero-clip law remain unchanged.
> See ARBITRATION S49 for the complete necessity, maximality, telemetry, recovery, hard-fail and
> reversal contract.

**Filed by:** W1-06 production builder, starting commit `1378e2a7372d4e3c819f81986b65979524ae08a7`

## Smallest blocked predicate

RI-CAM01 fixed `arm_min_m = 0.90` as an absolute per-frame floor and defines any camera-origin or near-plane containment as `clip_through`. M3/M4/M5 require `Σ clip_through == 0`. The prescribed populations also put solid geometry closer than the legal camera position can be for some mandatory orientations:

1. M4 moves a wall to 0.50 m behind the pivot while holding the view toward the character. A camera constrained to the same boom ray at `arm_len_m >= 0.90` must be at least 0.40 m beyond the wall before accounting for the 0.10 m near plane.
2. M5 reverses the player into a backing wall while forbidding auto-yaw/pitch drift. Once the wall-to-pivot clearance is below the minimum boom plus near plane, the same containment is unavoidable.
3. The required 1.20 m pinch has only 0.60 m centreline-to-jamb clearance. Mandatory eight-yaw traversal includes lateral views whose 0.90 m boom (plus shoulder and near-plane width) cannot fit.
4. A 30° stair changes walking-surface height by about 0.52 m over a 0.90 m boom. The mandatory eight-yaw traversal includes a downhill-moving/back-uphill view, placing the legal minimum camera in the rising stair collision volume.

These are geometric impossibilities, not smoothing defects. The starting-commit reproduction records 12 clipped M4 frames, backing-wall clipping, 123 pinch clip frames, and 617 stair clip frames while the emitted flag agrees with an independent point-containment derivation. S48 preserved both the 0.90 m floor and zero clipping, but resolved only the crawl ceiling and did not decide which quantity yields in these four constructions.

## Authority resolution

S49 selects the **emergency-boom alternative** because moving the scored surfaces outside the complete swept envelope would preserve the arithmetic while deleting the collision stressor. That would make M4/M5 and the mandatory eight-yaw pinch/stair rows incapable of falsifying the guard against the exact close-geometry condition they prescribe.

The resolution is deliberately narrower than “the arm may go below 0.90 m”:

- 0.90 m remains the normal sphere-cast target and floor.
- A below-floor value is admissible only on a same-frame penetration-guard event after an independent containment search proves there is no clear candidate from 0.90 m through the desired length.
- The guard chooses the greatest clear non-negative length below 0.90 m. It may not cross the pivot, slide, orbit, change yaw/pitch/FOV/mode, or accept clipping.
- Both `camera.arm_penetration_guard` and `camera.arm_floor_emergency` must identify the frame. The critic independently re-derives necessity and maximality rather than trusting either flag.
- The ordinary push-out dwell/rate returns the arm once a clear candidate at or above 0.90 m exists.
- Existing at/below-floor exposure bands, camera-to-head distance, third-person-only rule, all exact fixture dimensions, all eight yaws, and every denominator remain binding. If no non-negative point clears the complete envelope, `clip_through` remains a hard fail.

The ruling is applied in ARBITRATION S49, RI-CAM01 §A/§C/M2/M5, RI-CMB06 §B's shared boom row, and RI-CAM05 §D/§F/M4/M7. No production implementation or generated status/index file is part of this authority resolution.

## Reversal evidence

A constructive trace using the shipped fixed pivot, fixed shoulder, `arm_len_m >= 0.90`, unchanged yaw/pitch, and unchanged origin-plus-four-corners predicate that produces zero containment for each of the four exact configurations above overturns S49. A later explicit camera-geometry amendment may also supersede it if it preserves the exact populations and zero-clip law.
