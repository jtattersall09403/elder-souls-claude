# AMENDMENT-W1-06-02 — the absolute 0.90 m boom floor conflicts with four prescribed zero-clip fixtures

**State:** REQUESTED — unresolved authority boundary. No production threshold or predicate has been changed.

**Filed by:** W1-06 production builder, starting commit `1378e2a7372d4e3c819f81986b65979524ae08a7`

## Smallest blocked predicate

RI-CAM01 fixes `arm_min_m = 0.90` as an absolute per-frame floor and defines any camera-origin or near-plane containment as `clip_through`. M3/M4/M5 require `Σ clip_through == 0`. The prescribed populations also put solid geometry closer than the legal camera position can be for some mandatory orientations:

1. M4 moves a wall to 0.50 m behind the pivot while holding the view toward the character. A camera constrained to the same boom ray at `arm_len_m >= 0.90` must be at least 0.40 m beyond the wall before accounting for the 0.10 m near plane.
2. M5 reverses the player into a backing wall while forbidding auto-yaw/pitch drift. Once the wall-to-pivot clearance is below the minimum boom plus near plane, the same containment is unavoidable.
3. The required 1.20 m pinch has only 0.60 m centreline-to-jamb clearance. Mandatory eight-yaw traversal includes lateral views whose 0.90 m boom (plus shoulder and near-plane width) cannot fit.
4. A 30° stair changes walking-surface height by about 0.52 m over a 0.90 m boom. The mandatory eight-yaw traversal includes a downhill-moving/back-uphill view, placing the legal minimum camera in the rising stair collision volume.

These are geometric impossibilities, not smoothing defects. The starting-commit reproduction records 12 clipped M4 frames, backing-wall clipping, 123 pinch clip frames, and 617 stair clip frames while the emitted flag agrees with an independent point-containment derivation. S48 explicitly preserves both the 0.90 m floor and zero clipping, but resolves only the crawl ceiling and says these populations remain red; it does not state which quantity yields in these four constructions.

## Requested ruling

Choose exactly one coherent authority change:

- **Architecture/fixture alternative (preferred):** keep the 0.90 m floor and zero-clip law; require every scored collision surface to remain outside the complete swept camera origin/near-plane envelope for every prescribed yaw, and replace impossible fixture endpoints/dimensions with the smallest conforming dimensions. Preserve the moving-wall motion/rate measurement by stopping its scored inward sweep at that envelope rather than 0.50 m.
- **Emergency-boom alternative:** keep every existing fixture dimension and zero-clip law; authorise the penetration guard alone to violate 0.90 m only as far as required to clear the origin and near plane, and amend the absolute-floor hard fail accordingly.

Do **not** grant bounded clipping. Do not weaken `clip_through`, remove a yaw, exclude a route, or shrink a denominator.

## Reversal evidence

A constructive trace using the shipped fixed pivot, fixed shoulder, `arm_len_m >= 0.90`, unchanged yaw/pitch, and unchanged origin-plus-four-corners predicate that produces zero containment for each of the four exact configurations above overturns this request without an amendment.
