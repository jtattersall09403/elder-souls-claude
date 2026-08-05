---
id: RI-CAM01
title: The third-person rig — pivot, shoulder offset, spring arm, and collision pull-in
kind: number
side: souls
judges: [combat.camera.behaviour]
provenance: constructed
confidence: high
blind_pair: yes
---

> **SEAM S18 IS THE REASON THIS FILE EXISTS.** The game is third-person at all times, and
> the camera must match Dark Souls in all respects. This item owns the *geometry* of the
> rig — where the camera is. RI-CAM02 owns how the player moves it, RI-CAM03 owns lock-on
> framing, RI-CAM05 owns what it does outside the fight, RI-CAM06 owns how it feels.
> Values here are shared with RI-CMB06 §B where that item already fixed them; those cells
> are marked **[CMB06]** and **may not be changed here** — an amendment must touch both files.

## The bar

A Souls camera is a rigid, boring, utterly predictable machine, and that is its entire
virtue. It is a pivot bolted to the character at a fixed height, a fixed offset over one
shoulder, and a straight arm of fixed length behind it. It has no opinions. It does not
frame you, does not drift, does not swing round to show you the pretty thing. The only
thing it ever does on its own is get shorter when something solid is in the way, and it
does that *fast* on the way in and *slowly* on the way out, so that squeezing past a
pillar does not fling the view.

"Good" means: the player, blindfolded to the world, could predict the camera's world
position from the character's position, the two look angles, and a single sphere-cast.
Nothing else is in the equation. Every frame the camera is inside a wall, the game is
unplayable and unmeasurable at once — a screenshot of a shader through a rock face is not
evidence of anything. The count of such frames is **zero**, not "low".

## The reference artifact

### A. `ES-CAM/1` — rig geometry (BINDING)

Character reference height 1.80 m, eye node 1.66 m, chest node 1.38 m, feet at y = 0.

| Parameter | Value | Notes |
|---|---|---|
| Pivot attachment | character **root** transform (XZ), independent of animation root motion within the frame | pivot reads the post-physics controller position, once, after locomotion resolves |
| Pivot height above the character's **ground contact** | **1.55 m** | not above the root; see §B stair rule |
| Pivot horizontal offset | **0** in character space | the pivot is *on* the character; the shoulder offset lives on the camera end, not the pivot |
| Shoulder offset (applied at the camera end, in camera basis) | **+0.42 m** along camera right, **+0.10 m** along camera up | Souls is over the **right** shoulder, never centred |
| Shoulder offset while locked | **+0.26 m** right, **+0.10 m** up | reduced so the framing law in RI-CAM03 is not fighting a large lateral bias |
| Arm length, free camera (unlocked) | **4.10 m** | |
| Arm length, locked | **3.60 m** at target distance ≤ 4 m, ramping **linearly** to **5.20 m** at 14 m **[CMB06]** | |
| Arm length, absolute max (framing-driven, RI-CAM03) | **7.50 m** | only RI-CAM03's containment constraint may request beyond the locked ramp |
| Arm length, absolute min (collision) | **0.90 m** **[CMB06]** | |
| Pitch-dependent arm scale | `1.00` at pitch 0°, `0.82` at pitch −55°, `0.94` at pitch +38°; linear in pitch on each side | stops the camera burying itself in the floor when the player looks down |
| Collision probe | **sphere cast, radius 0.28 m** **[CMB06]** | from pivot toward the desired camera point |
| Vertical FOV | **50.0°**, constant, in every state, forever | see RI-CAM06 §D — FOV variance across a whole run is **zero** |
| Aspect | 16:9 at the canonical 1920×1080 capture (HARNESS §6) | |
| Near plane | **0.10 m** | must be < `arm_min − character_half_width`; 0.90 m arm with a 0.10 m near plane cannot clip the wall the arm just stopped against |
| Far plane | **1200 m** | |

### B. Pivot follow (the only smoothing on the pivot)

| Axis | Rule |
|---|---|
| Horizontal (XZ) | **rigid**. The pivot equals the controller's XZ every frame. No spring, no lag, no lead. A horizontally-lagged pivot is the "camera on a bungee" tell and is an automatic fail. |
| Vertical (Y) | critically damped spring toward `ground_contact_y + 1.55`, **half-life 0.250 s**, with a hard clamp of **±0.55 m** of accumulated lag. Restores to rigid within 0.5 s of the character becoming grounded and level. |
| Airborne | vertical spring half-life relaxes to **0.400 s** while `grounded == false`, so a fall does not pull the camera down the shaft with the character. |
| Reset | on `teleport`, `load`, `bonfire_rest` and death respawn the vertical spring is snapped, not eased. |

The vertical spring is why stairs work. A rigid vertical pivot pumps the whole view once per
tread; a springy horizontal pivot makes strafing feel like ice. Souls does exactly this
asymmetry and it is not optional.

### C. The spring arm — collision, pull-in, push-out (the load-bearing section)

Per frame, in this order:

```
1. desired_len  := f(mode, target_dist, pitch)         # §A, ×pitch scale
2. desired_pos  := pivot + (-forward * desired_len) + shoulder_offset
3. hit          := sphereCast(pivot, desired_pos, r = 0.28)
4. safe_len     := hit ? (hit.dist - 0.02) : desired_len
5. safe_len     := clamp(safe_len, 0.90, 7.50)
6. cur_len      := rate_limit(cur_len -> safe_len)      # §C table
7. penetration guard: if the sphere at cur_len still overlaps solid geometry,
                      set cur_len := overlap-free length IMMEDIATELY, ignoring the rate limit
8. camera_pos   := pivot + (-forward * cur_len) + shoulder_offset
```

| Parameter | Value | Rationale |
|---|---|---|
| **Pull-in** max rate | **40.0 m/s** = **0.667 m/frame** | effectively instant at human speeds, but bounded so a 1-frame sphere-cast spike cannot teleport the camera |
| **Penetration guard** | **unbounded**, same frame | step 7. The rate limit is a smoothing device, never a correctness device. If a rate-limited camera would be inside geometry, correctness wins. |
| **Push-out** dwell | **6 frames** of continuous "no obstruction" before push-out may begin | stops the arm pumping while brushing along a pillar row |
| **Push-out** max rate | **3.0 m/s** = **0.050 m/frame** | the asymmetry: ~13× slower out than in |
| Sphere-cast origin | the pivot, **not** the current camera position | casting from the camera lets it get stranded outside a wall it already passed |
| Cast against | world static collision + large dynamic props. **Never** against characters, creatures, projectiles, foliage cards, or triggers | a boss standing behind you must not yank the camera to 0.90 m |
| Layers excluded, exhaustive | `character`, `creature`, `projectile`, `vfx`, `foliage_card`, `trigger`, `water_surface`, `item_pickup` | |

**Character fade.** As the arm collapses, the character occludes the view. When
`cur_len < 1.30 m`, the player mesh (and attached equipment) dither-fades linearly to
**0.00** opacity at `cur_len == 0.90 m`. Fade is on the material, not a mesh toggle: no
popping, and the character's shadow is **retained** at full opacity throughout (Souls keeps
the shadow; it is how you still read your own animation with your body faded).

**Backing into a wall.** The character reverses into a flat wall. Required behaviour, in
order and exhaustively:

1. The arm collapses at the pull-in rate to the sphere-cast length, floored at 0.90 m.
2. The character fades per the rule above.
3. **The camera yaw does not change.** It does not slide along the wall, does not orbit to
   find a gap, does not "recover" to a clear angle. Auto-yaw-on-collision is the
   Elden-Ring-corner failure and is forbidden here; the player, not the rig, chooses yaw.
4. The pitch does not change.
5. The FOV does not change.
6. `camera.clip_through` stays `false` on every frame.
7. On stepping away, push-out waits the 6-frame dwell, then returns at 0.050 m/frame.

### D. Clipping — the definition that is actually testable

`camera.clip_through` is `true` on a frame iff **any** of the four near-plane corner points
or the camera origin lies inside solid world collision, tested by point-containment against
the same collision set used in §C. This is a per-frame boolean the harness emits. It is not
a heuristic and it is not "does it look wrong".

**The bar is `Σ clip_through == 0` over every scripted traversal in the corpus.** One frame
is a fail. There is no tolerance band, because a single frame of interior-of-rock is a
visible black flash at 60 Hz and a corrupted screenshot in any fidelity capture that lands
on it.

### E. Derived quantities a critic recomputes rather than trusts

| Quantity | Value |
|---|---|
| Camera height above ground at pitch 0, free, unobstructed | `1.55 + 0.10 = 1.65 m` |
| Horizontal distance from character root at pitch 0, free | `4.10 m` |
| Camera height at pitch −55°, free | `1.55 + 0.10 + 4.10 × 0.82 × sin(55°) = 4.40 m` |
| Frames to collapse 4.10 m → 0.90 m at the pull-in rate | `ceil(3.20 / 0.667) = 5 frames` |
| Frames to recover 0.90 m → 4.10 m at the push-out rate | `6 dwell + ceil(3.20 / 0.050) = 6 + 64 = 70 frames` |
| Pull-in : push-out asymmetry ratio | **13.3 : 1** |

Tolerances: distances **±0.02 m**, angles **±0.10°**, rates **±2%**, frame counts **±0**.

## Comparison method

Method script: **`corpus/80-methods/m-cam01-rig.mjs`**. All checks read the `camera` block
of the `elder-souls/trace@1` frame record (see the harness extension request in §Provenance)
via `window.__HARNESS.traceStart({channels:["camera"]})` / `traceDrain()` / `traceStop()`.

**M1 — Static rig census.** `reset({state:"cam-flat-plain"})`, `teleport(0,0)`, no input.
`stepFrames(60)`, then for pitch ∈ {−55, −40, −20, 0, +20, +38} and yaw ∈ {0, 90, 180, 270}:
drive the look with `queueInputs([{f:0,"look":[dy,dp]}])` in ≤ 2 °/frame increments,
`stepFrames` to settle, `snapshot()`.
- Compute `pivot`, `arm_len`, `fov_deg`, `near_m`, `far_m`, shoulder offset (as
  `camera.pos − (pivot − forward·arm_len)` expressed in the camera basis).
- **FAIL** if pivot height ≠ 1.55 m ±0.02, shoulder offset ≠ (+0.42, +0.10) ±0.02,
  `fov_deg` ≠ 50.0 ±0.001, `near_m` ≠ 0.10, `far_m` ≠ 1200.
- **FAIL** if the pitch-dependent arm scale deviates from §A by > 2%.
- **FAIL** if the shoulder offset is 0 (a centred camera is not a Souls camera).

**M2 — Arm-length distribution over a scripted walk (the headline number).** Load
`cam-walk-cistern` (a scripted 5 400-frame route through the tightest authored interior in
the build: doorway, spiral stair, 2.6 m corridor, pillar hall, ledge, low arch) and
`cam-walk-mire` (an exterior route through mangrove roots and a stilt-village underside).
- Emit `arm_len_m` per frame. Report the full histogram at 0.10 m bins plus
  `p05 / p25 / p50 / p95 / min / max`.
- **FAIL** if `min < 0.90 m` (the floor is not being honoured).
- **FAIL** if `max > desired_len + 0.02` on any frame (the arm is being pushed *out* past
  its own target — a sign someone is easing toward a stale desired length).
- Report `fraction(arm_len < 1.60 m)`. RI-CAM05 §D sets the pass band for interiors; this
  item only requires the number be produced.

**M3 — Zero clipping (hard gate).** Over both M2 routes plus `cam-walk-boss-arena`:
- **FAIL** if `Σ camera.clip_through > 0`.
- Independently re-derive the boolean: for 60 evenly spaced frames per route, `renderFrame()`
  and `screenshot()`, and check that no shot's mean luminance is < 2/255 with < 0.5% pixel
  variance (the signature of a fully-enclosed camera). A disagreement between the emitted
  flag and the screenshots is a **harness-integrity failure**, reported under RI-MTH04, not
  a camera failure.

**M4 — Pull-in / push-out rate law.** In `cam-collision-rig`: a wall on a rail moves from
6.0 m behind the character to 0.5 m behind and back, on a scripted 240-frame cycle, 12 times.
- Compute `d[f] = arm_len[f] − arm_len[f−1]`.
- **FAIL** if `max(−d) > 0.667 + 0.001` on any frame **that is not flagged**
  `camera.arm_penetration_guard == true`.
- **FAIL** if `max(+d) > 0.050 + 0.001` on any frame.
- **FAIL** if push-out begins < 6 frames after the last obstructed frame (measure the gap
  between the last frame with `arm_hit == true` and the first frame with `d > 0`).
- **FAIL** if the measured asymmetry ratio `max(−d)/max(+d)` < 8.0. A symmetric spring is
  the single most common wrong answer.

**M5 — Back-into-wall behaviour.** Place the character 3.0 m from a flat wall, camera yaw
set so the wall is directly behind the camera. Walk backwards into it for 120 frames, hold
60, walk forward 120.
- **FAIL** if `|Δcamera.yaw_deg|` summed over the 300 frames exceeds **0.5°** with no look
  input present (auto-yaw-on-collision).
- **FAIL** if `|Δcamera.pitch_deg|` summed exceeds 0.5°.
- **FAIL** if `fov_deg` varies at all.
- **FAIL** if `clip_through` is ever true.
- **FAIL** if the character's material opacity is not < 0.05 on the frames where
  `arm_len ≤ 0.91` (check via `screenshot()` — the player silhouette must be absent from the
  ID buffer) **or** if the character's cast shadow disappears with it.

**M6 — Collision layer discipline.** Spawn an `INFANTRY` directly behind the player at 1.5 m
and `aggro()` it. Then spawn a foliage card and a projectile on the same line.
- **FAIL** if `arm_len` drops below the unobstructed value on any of those frames. The arm
  collides with the world, never with actors.

**M7 — Determinism.** Run `cam-walk-cistern` twice at the same seed as 5 400×`stepFrames(1)`
and once as 90×`stepFrames(60)`.
- **FAIL** if the per-frame `camera` blocks are not byte-identical across all three runs
  (this is HARNESS §8 D5 applied to the camera; it is the proof that the rig is on the fixed
  step and not on `requestAnimationFrame`). See RI-CAM06 M1 for the full treatment.

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M1 static rig census | 15 | Every §A value within tolerance, shoulder offset non-zero |
| M2 arm-length distribution | 10 | Histogram produced; floor and ceiling honoured |
| M3 zero clipping | **30** | `Σ clip_through == 0` on all three routes |
| M4 pull-in / push-out law | **20** | Rates, dwell, and ≥ 8:1 asymmetry |
| M5 back-into-wall | 15 | No auto-yaw, no pitch drift, no FOV change, fade + shadow correct |
| M6 collision layers | 5 | Actors never push the arm |
| M7 determinism | 5 | Byte-identical camera blocks |

Score = sum of passed weights, 0–100.

- **≥ 90** — parity.
- **70–89** — gap named, remediable within a wave.
- **< 70** — **we lose.**
- **Automatic fail regardless of score:**
  - any frame with `clip_through == true`;
  - the camera yaw or pitch changing without look input as a *result of collision*
    (auto-wall-recovery / auto-corner-escape);
  - a symmetric or push-out-faster-than-pull-in spring;
  - `OrbitControls`, `MapControls`, `PointerLockControls` or any other stock Three.js
    controller driving the gameplay camera (detectable from output: OrbitControls produces
    a pivot that is a *fixed world point* rather than the character, and a damping curve
    that is `dt`-driven — M7 and M1 both catch it);
  - the camera pivot lagging horizontally behind the character;
  - a centred (zero shoulder offset) camera;
  - `fov_deg` differing between any two frames of any run.

**Blind pair:** hand the critic two `arm_len_m` time series from the same authored interior
route — one from our build, one generated from §C's law against the route's collision
profile — unlabelled, and ask: *which of these is a camera that gets out of the way fast and
comes back slowly, and which is a spring?* Record the pick before the reveal. Per
CRITIC-DOCTRINE §2.5, a pick of ours triggers the harsher re-run.

## How we lose

Written pessimistically and in advance. A browser Three.js build will do these:

1. **`OrbitControls` bolted on.** It is in every Three.js example, it orbits a *fixed
   target point*, it has `enableDamping` with a per-render-frame lerp, and it has no
   collision at all. Adopting it gets a camera that is wrong in the pivot, wrong in the
   smoothing, wrong in the frame coupling, and clips through everything. This is the single
   most likely failure of the entire camera area.
2. **No collision at all.** The camera is `character.position + offset.applyQuaternion(q)`.
   Walk to a wall and the view is inside the rock. `clip_through` is true for whole seconds.
   M3 is weighted 30 for this reason.
3. **A raycast instead of a sphere-cast.** A single ray from pivot to camera misses the
   corner of a doorframe by 5 cm and the camera's near plane eats it. The 0.28 m sphere is
   what makes the arm respect the *volume* the camera occupies.
4. **Casting from the camera instead of the pivot**, so once the camera is outside a wall
   it stays outside — the classic "camera stuck behind the building" bug.
5. **A symmetric lerp.** `armLen = lerp(armLen, targetLen, 0.2)` — identical in and out.
   Result: brushing a pillar produces a slow pull-in (so the camera is inside the pillar for
   ~10 frames) and a fast push-out (so the view lurches). Both halves are wrong and one lerp
   constant cannot express the fix.
6. **Colliding against the character layer**, so the player's own capsule (or a following
   NPC, or an enemy behind them) collapses the arm to 0.90 m in open ground.
7. **Rigid vertical pivot.** The pivot is `character.position.y + 1.55` with no spring, so
   every stair tread is a 0.18 m vertical jolt at 60 Hz and the whole marsh's boardwalks
   read as a washboard. The 0.250 s half-life exists for the game's most common surface.
8. **Springy horizontal pivot.** The mirror error — someone adds `lerp` to XZ "to smooth it"
   and now the character slides around inside the frame during strafing, which makes
   RI-CAM03's framing law unsatisfiable.
9. **Mesh toggle instead of a fade**, so the character pops out of existence when the arm
   crosses 1.30 m — and pops the shadow with it, so the player loses the ability to read
   their own animation at exactly the moment (jammed in a corner) they need it most.
10. **Near plane left at Three.js's `0.1`… but the arm floor set to 0.3 m**, or vice versa.
    The two numbers are a pair. Any arm floor below `near + character_half_width` puts the
    character's shoulder through the lens.
11. **FOV animated "for feel"** on sprint, on hit, on boss entry. Three separate people will
    each add one. §A says 50.0° forever and RI-CAM06 §D measures the variance at zero.
12. **Auto-wall-recovery imported from Elden Ring.** It is a real FromSoft behaviour and it
    is a real FromSoft complaint. S18 says match Souls "in all respects"; this item exercises
    the corpus's right to pick which respect — we take the spring arm and reject the
    auto-yaw, and we say so out loud rather than shipping it by accident.
13. **Smoothing done in `onBeforeRender`.** Works at 60 Hz on the dev machine, doubles at
    120 Hz, and makes every number in this file unmeasurable. M7 exists to catch it before
    any of the rest is worth reading.

## Provenance note

- **`constructed`, confidence high, and binding:** every number in §A–§E except the cells
  marked **[CMB06]**. The 1.55 m pivot, the +0.42/+0.26 m shoulder offsets, the 4.10 m free
  arm, the 40.0 m/s pull-in, the 3.0 m/s push-out, the 6-frame dwell, the 0.250 s vertical
  spring half-life, the pitch-dependent arm scale, the 1.30 m fade threshold, the near/far
  planes and the collision layer exclusion list are ours. We defined them because no
  upstream number is measurable by us, and a constructed bar we can measure beats a recalled
  one we cannot (CORPUS-CONTRACT §3).
- **[CMB06] cells** (3.60→5.20 m locked ramp, 0.28 m cast radius, 0.90 m minimum) are
  adopted verbatim from RI-CMB06 §B, which fixed them first. Changing them here without
  amending RI-CMB06 invalidates that item's M5.
- **`canonical-recall`, confidence medium:** the qualitative shape — that Souls uses a
  fixed-height pivot with a slight right-shoulder bias, a straight spring arm that collides
  with static world geometry only, a fast pull-in and a slow push-out, a character fade at
  minimum arm length, and no FOV animation — is recalled, not measured. No frame-exact
  FromSoft data was consulted and none is cited.
- **`community-data`, confidence low, context only:** Dark Souls III's default vertical FOV
  is widely reported as **43°** by the community FOV-fix modding effort
  ([Dark Souls III FOV Fix, Nexus Mods](https://www.nexusmods.com/darksouls3/mods/10)). Our
  50.0° is deliberately wider: we render at 16:9 on a browser canvas that is often windowed,
  and the 12-viewpoint fidelity capture set (HARNESS §6) was framed at 50°. **43° is context,
  not our bar.** The "camera auto wall recovery" behaviour discussed under §C.3 and *How we
  lose* #12 is reported by the Elden Ring community as a default-on FromSoft staple and a
  frequent complaint ([Elden Ring — camera snagging on terrain, Steam
  Community](https://steamcommunity.com/app/1245620/discussions/0/3183488224888528710/)).
  We reject it explicitly rather than inheriting it.
- **Harness dependency:** every measurable in this item requires the `camera` trace channel,
  which does not yet exist. Until the harness emits it, this item is **unmeasurable** and
  every check scores **0**, fail-closed, per CRITIC-DOCTRINE §7.3. The requested fields are
  listed in the reply that accompanied this item's creation and must be added to
  `corpus/80-methods/HARNESS.md` §5 by amendment.
