---
id: RI-CAM02
title: Free-camera control and camera-relative movement — deadzone, pitch clamp, turn rate, and auto-recentre
kind: number
side: souls
judges: [combat.player.movement, world.traversal.locomotion, platform.input.pipeline, combat.camera.behaviour]
provenance: constructed
confidence: medium
blind_pair: yes
---

> **SEAM S18.** Third-person at all times. This item owns the *unlocked* camera and the
> input-to-character mapping that hangs off it. Locked behaviour is RI-CAM03 (framing) and
> RI-CAM04 (movement). Rig geometry is RI-CAM01. Frame-coupling is RI-CAM06.

## The bar

Unlocked, a Souls camera is a **manual instrument**. The right stick moves it and nothing
else does, one-to-one, with no acceleration curve on the output and no lag. The left stick
does not steer the camera; it picks a direction *in the frame the camera has drawn*, and
the character turns to face that direction at a bounded rate — so a 180° input produces a
visible pivot or a wide arc, never a snap. Pitch stops hard at fixed angles and stays
stopped, with no elastic overshoot and no slow creep back.

The subtle half is what the camera does when you are *not* touching it. In ordinary walking
it does nothing at all: it stays exactly where the player left it, even while the character
runs a circle around the pivot. It only reasserts itself when the player commits to a
sprint, and then it eases — never snaps — behind the character, and it surrenders that
authority the instant a look input arrives. A camera that constantly noses back behind the
character is a modern-third-person-action import; a camera that never does makes sprinting
across the marsh a chore. The gate between those two states is the whole design.

## The reference artifact

### A. Look input (`ES-CAM/1` §Look)

| Parameter | Value | Notes |
|---|---|---|
| Right-stick radial deadzone | **0.15** | radial, not per-axis; per-axis deadzones produce the classic cross-shaped drift |
| Right-stick outer saturation | **0.95** | magnitudes ≥ 0.95 map to 1.0 |
| Magnitude remap | `m' = clamp((m − 0.15) / 0.80, 0, 1)` then `m'' = m'^2.0` | quadratic response on **magnitude only**; the direction is never reshaped |
| Max yaw rate, stick | **180 °/s** at `m'' = 1` | = 3.000 °/frame |
| Max pitch rate, stick | **120 °/s** at `m'' = 1` | = 2.000 °/frame |
| Mouse sensitivity | **0.120 °/px** horizontal, **0.100 °/px** vertical, at the default setting | linear; **no** mouse acceleration, ever |
| Mouse per-frame cap | **30.0 °/frame** yaw, **20.0 °/frame** pitch | a swipe cannot exceed this; excess is discarded, not accumulated |
| Input-to-camera lag | **0 frames** | the look delta for frame `f` is applied to the camera on frame `f` |
| Output smoothing on manual look | **none** | see RI-CAM06 §C: `corr(input.look.yaw, Δcamera.yaw)` at lag 0 must be ≥ 0.999 |
| Y-axis invert, sensitivity scale | player options, ×0.25 → ×2.00 | options must not change any *law*, only the scale; a critic measures at ×1.00 |

### B. Pitch clamp (hard)

| Bound | Value |
|---|---|
| Minimum pitch (looking down) | **−55.0°** |
| Maximum pitch (looking up) | **+38.0°** |
| Behaviour at the bound | the value **saturates**. No overshoot, no bounce, no easing back, no rubber band. |
| Under lock | the framing law (RI-CAM03 §C) derives pitch and is clamped to **[−50.0°, +32.0°]**, a strictly narrower band |
| During fog-gate / death sequences | RI-CAM06 §F/§G derive pitch; the §B bounds still apply |

**`p100(|pitch|)` must never exceed the bound on any frame of any run in the corpus.** Not
"rarely". A single frame at −55.3° means the clamp is applied after integration instead of
during it, which means a fast enough look input can punch through it.

### C. Movement mapping

Let `s = (sx, sy)` be the post-deadzone movement-stick vector (WASD synthesises the eight
cardinal/ordinal unit vectors, with the same deadzone semantics applied to the synthesised
magnitude of 1.0). Let `cam_fwd` be the camera forward projected onto the ground plane and
renormalised, `cam_right` likewise.

```
dir_world = normalize(cam_right * sx + cam_fwd * sy)          # camera-relative, always
speed_target = f(|s|)                                          # §C table
facing_target = atan2(dir_world.x, dir_world.z)
```

| Movement-stick magnitude `\|s\|` | Gait |
|---|---|
| ≤ 0.15 | idle (deadzone) |
| 0.16 – 0.55 | **walk** — 2.0 m/s (fixed by ARBITRATION seam S17; may not be lowered) |
| > 0.55 | **run** — speed owned by `combat.player.movement` / RI-CMB06 §C, not set here |
| any, with `sprint` held ≥ 12 frames and stamina > 0 | **sprint** — owned by `combat.stamina.costs` |

**Character turning — the bounded-turn law:**

| Condition | Behaviour |
|---|---|
| Moving (`speed > 0.5 m/s`), any facing error | yaw rate-limited toward `facing_target` at **≤ 720 °/s** (12.0 °/frame). The result is a visible arc, not a pivot. |
| Stationary (`speed ≤ 0.5 m/s`) and `\|error\| ≤ 100°` | rate-limited toward `facing_target` at **≤ 480 °/s** (8.0 °/frame), no clip change |
| Stationary and `\|error\| > 100°` | play `turn_in_place_l/r`: an **18-frame root-motion clip** that carries the full rotation. Yaw during it comes from the clip's root track, not from the rate limiter. Uncancellable except by roll and attack (which apply their own frame-1 snap per RI-CMB06 §D). |
| Any committed state (attack, roll, heal, stagger, critical) | facing is owned by that state; this law does not apply |

**Hard rule: the character's facing is never assigned directly from the input direction.**
There is no frame on which `facing := facing_target`. The only instant facing changes in the
whole game are the attack frame-1 snap (RI-CMB06 §D) and the unlocked roll frame-1 snap
(RI-CMB06 §C), both of which are one frame, both of which are owned by that item.

### D. Auto-follow policy — the gate

| State | Camera yaw authority |
|---|---|
| Idle | player only. `auto_follow_gain = 0`. |
| **Walking** | player only. `auto_follow_gain = 0`. The character may walk a full circle around the pivot; the camera does not move. |
| **Running** (`\|s\| > 0.55`, sprint not held) | player only. `auto_follow_gain = 0`. |
| **Sprinting**, gate satisfied | **auto-recentre active** (§E) |
| Locked on | RI-CAM03; player right-stick is target-switching only, never camera yaw |
| Dialogue / menu / rest | RI-CAM05; camera is frozen |

### E. Auto-recentre on sprint

**Gate (all must hold, simultaneously, for ≥ 20 consecutive frames):**

1. `sprint` button held.
2. `speed ≥ 0.90 × sprint_speed`.
3. Movement input is forward-dominant in camera space: `sy ≥ 0.70 × |s|`.
4. No look input above the deadzone in the preceding 20 frames.
5. Not locked on.
6. `grounded == true`.

**Behaviour once engaged:**

| Parameter | Value |
|---|---|
| Yaw target | the character's current facing |
| Yaw easing | critically damped spring, **half-life 0.350 s** |
| Yaw rate clamp | **90 °/s** (1.500 °/frame) |
| Pitch target | **−6.0°** |
| Pitch easing | critically damped spring, **half-life 0.600 s** |
| Disengage | **immediately** — same frame — on any of: look input above deadzone, sprint release, speed dropping below the gate, lock-on, a committed state, leaving `grounded` |
| Re-engage | requires the full 20-frame gate again from scratch |
| Residual after disengage | **none**. No coast, no settle, no "finish the ease". The spring is dropped on the frame the gate fails. |

The 20-frame arming delay and the same-frame disengage are the asymmetry that makes this
tolerable: it takes a third of a second of committed sprinting to hand the camera over, and
zero frames to take it back.

### F. Derived quantities a critic recomputes

| Quantity | Value |
|---|---|
| Frames for a running character to turn 180° | `180 / 12.0 = 15 frames` |
| Frames for a stationary character to turn 180° | 18 (the `turn_in_place` clip) |
| Frames for a stationary character to turn 90° | `90 / 8.0 = 12 frames` (rate-limited, no clip) |
| Max camera yaw travel in one frame, stick | 3.000° |
| Max camera yaw travel in one frame, recentre | 1.500° |
| Recentre: frames to close 90° of yaw error | `≈ 0.350 s half-life ⇒ 90 → 45 in 21 f`, rate-clamped for the first `90×0.5/1.5 ≈ 30 f` — report the measured curve, do not trust this cell |
| Pitch range | 93.0° total; 59% of it is below the horizon |

Tolerances: angles **±0.10°**, rates **±2%**, frame counts **±0**, half-lives **±15%**.

## Comparison method

Method script: **`corpus/80-methods/m-cam02-control.mjs`**. Reads the `camera` block and the
existing `input` and `player` blocks of `elder-souls/trace@1`, plus the requested
`player.move_dir_deg` field (see §Provenance).

**M1 — Deadzone and response curve.** Scenario `cam-open-plain`. For stick magnitude
`m ∈ [0.00, 1.00]` in 0.01 steps, at 8 directions, hold for 30 frames each and measure the
resulting steady-state camera yaw rate.
- **FAIL** if any `m ≤ 0.15` produces a non-zero yaw rate.
- **FAIL** if the deadzone is not radial (test the diagonal at `m = 0.16`: a per-axis
  deadzone gives zero there).
- Fit the measured rate against `180 × ((m−0.15)/0.80)²`. **FAIL** if `R² < 0.99` or if the
  rate at `m = 1.0` differs from 180 °/s by > 2%.
- Repeat for pitch against 120 °/s.

**M2 — Pitch clamp (hard gate).** Inject `look: [0, +40]` (well over the per-frame cap) for
600 frames, then `[0, −40]` for 600 frames, then alternate every frame for 600 frames.
- **FAIL** if `max(pitch_deg) > 38.00` or `min(pitch_deg) < −55.00` on **any** frame.
- **FAIL** if any frame shows pitch moving *away* from the input direction while pinned (a
  bounce), or if pitch changes on a frame with zero look input while pinned (a creep).
- Repeat while locked on: **FAIL** if the locked band [−50, +32] is exceeded.

**M3 — Zero look lag, zero output smoothing.** Inject a step look input:
`look:[3.0, 0]` on frames 0–120, `[0,0]` on 121–240, `[−3.0, 0]` on 241–360.
- Compute `Δyaw[f] = camera.yaw_deg[f] − camera.yaw_deg[f−1]`.
- **FAIL** if `Δyaw` on frame 1 is not 3.000 ±0.001 (a first-frame value of ~0.3 is a lerp).
- **FAIL** if `Δyaw` is non-zero on any frame in 122–240 (a tail is inertia).
- **FAIL** if `argmax_lag corr(input.look.yaw, Δyaw) ≠ 0`.

**M4 — Character turn rate ceiling (the headline check).** From rest, facing +Z, inject
movement input at bearing θ for θ ∈ {45, 90, 135, 180, 225, 270, 315}, once from stationary
and once while already running at full speed in the +Z direction. 14 runs.
- Emit `player.yaw_deg` per frame. Compute `yaw_rate[f]` in °/frame.
- **FAIL** if `p100(yaw_rate) > 12.00 + 0.01` in any running run.
- **FAIL** if `p100(yaw_rate) > 8.00 + 0.01` in any stationary run with `|θ| ≤ 100`.
- **FAIL** if any single frame's yaw change exceeds 30° (a snap) outside the frame-1 snap of
  an attack or unlocked roll.
- **FAIL** if the stationary `|θ| > 100` runs do not use a `turn_in_place_*` clip
  (`player.anim`) of exactly 18 frames.
- Report `angle(input_dir, facing)` over time for each run; the curve must be **monotonically
  non-increasing** and must not reach 0 faster than the rate ceiling permits.

**M5 — No auto-follow while walking (the discriminator).** Hold a movement input that
rotates 1°/frame for 720 frames (the character walks a full circle around the camera pivot),
with **zero** look input, sprint not held.
- **FAIL** if `Σ |Δcamera.yaw_deg| > 0.5°` over the whole 720 frames.
- Repeat at run speed (`|s| = 1.0`, sprint not held): same bar.
- Repeat while strafing sideways for 300 frames: same bar.

**M6 — Auto-recentre gate and curve.** Sprint forward with the camera pre-rotated 90° off
the character's facing.
- **FAIL** if recentre begins before frame 20 of the gate, or after frame 21.
- Fit the yaw curve. **FAIL** if the half-life differs from 0.350 s by > 15%, or if
  `p100(recentre yaw rate) > 1.500 + 0.001 °/frame`.
- Then inject a single 1-frame look input mid-recentre. **FAIL** if any recentre-driven yaw
  occurs on that frame or after it, until the gate re-arms.
- Then release sprint mid-recentre. **FAIL** if any recentre-driven yaw occurs after the
  release frame.
- **FAIL** if recentre engages at any point while: walking, running-without-sprint, locked
  on, airborne, or with `sy < 0.70|s|` (sprint-strafing).

**M7 — Camera-relative, not world-relative.** With the camera at 8 different yaws, inject the
same movement input (stick-forward) and measure the resulting world-space travel bearing.
- **FAIL** if the travel bearing is not within 2° of the camera's yaw in all 8 runs (a
  world-relative mapping gives the same bearing 8 times).
- **FAIL** if `dir_world` uses the camera's un-projected forward (test on a −55° pitch: the
  character must still travel horizontally at full speed, not at `cos(55°)` of it).

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M1 deadzone and response | 10 | Radial, quadratic on magnitude, rates exact |
| M2 pitch clamp | 15 | Never exceeded, no bounce, no creep, locked band narrower |
| M3 zero lag / zero smoothing | 15 | Frame-1 exact, no tail, lag-0 correlation |
| M4 turn rate ceiling | **25** | ≤ 720 °/s moving, ≤ 480 °/s stationary, `turn_in_place` clip present, no snap |
| M5 no auto-follow while walking | **15** | < 0.5° of camera yaw over a full 720-frame circle |
| M6 auto-recentre gate and curve | 15 | 20-frame arm, same-frame disengage, half-life and clamp |
| M7 camera-relative mapping | 5 | Bearing tracks camera yaw across 8 yaws |

Score = sum of passed weights, 0–100.

- **≥ 90** — parity. **70–89** — gap named. **< 70** — **we lose.**
- **Automatic fail regardless of score:**
  - the character's facing being assigned from the input direction on any frame outside the
    two declared one-frame snaps (this is AR-1 territory: it deletes RI-CMB02 §D's
    commitment rule from the outside);
  - pitch exceeding the clamp on any frame;
  - mouse acceleration present at any sensitivity setting;
  - look input smoothed, filtered, or lagged by ≥ 1 frame;
  - the camera auto-following during ordinary walking or running;
  - auto-recentre that cannot be interrupted by a look input on the same frame;
  - movement resolved in world space rather than camera space.

**Blind pair:** hand the critic two `angle(input_direction, character_facing)` time series
for the same scripted 180° reversal at run speed — one from our build, one generated from
§C's law — unlabelled, and ask: *which of these is a character with mass?* A series that
goes 180 → 0 in one frame is the tell. Record the pick before the reveal.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 70 / 100 | 80 / 100 | 92 / 100 |

**Aggregation (a property of this item, not of the critic):** weighted-sum of passed check weights, max 100.

## How we lose

1. **`facing = facing_target` every frame.** One line, and the character becomes a cursor.
   It also silently breaks RI-CMB02 §D (commitment) and RI-AI03's punish windows, because a
   character that can reverse instantly never presents a back. M4 is weighted 25 for this.
2. **`object.lookAt(moveDir)`** — the same failure with a Three.js API on it. `lookAt` has
   no rate, no clip, and no memory of the previous frame.
3. **Per-axis deadzones.** `if (Math.abs(x) < 0.15) x = 0` on each axis independently.
   Diagonal input dies, the stick feels cross-shaped, and M1's diagonal probe catches it.
4. **Deadzone with no remap.** Subtracting the deadzone without rescaling gives a 0.15 dead
   step *and* a maximum of 0.85 — the camera never reaches its top rate.
5. **Mouse acceleration**, either deliberately or by using raw `movementX` accumulated across
   a variable number of render frames per sim step. The per-frame cap in §A exists to make
   the failure bounded and visible rather than occasional and unreproducible.
6. **Pitch clamped after integration**, so a big mouse swipe reaches −70° for one frame
   before being pulled back. Visible as a black flash of underfloor. M2 samples every frame
   for exactly this.
7. **Elastic pitch clamp.** Someone adds a bounce at the limit because it "feels responsive".
   Souls stops dead. This is a feel decision the corpus has already made.
8. **The camera always noses behind the character.** The default `lerp(camera.yaw,
   player.yaw, 0.05)` in every third-person tutorial. It makes it impossible to look at the
   thing you are walking past, it fights the player constantly in interiors, and it is the
   single loudest "this is not Souls" tell in the exploration half of the game. M5 exists
   solely to catch it and it is weighted 15.
9. **Recentre that cannot be interrupted.** The gate engages, the player flicks the stick,
   and the camera keeps rotating for another 0.4 s "to finish the ease". Every player reads
   this as the camera fighting them.
10. **Recentre gated on speed alone**, so it engages during a sprint-strafe or a sprint-turn
    and yanks the view mid-manoeuvre. The forward-dominance term (`sy ≥ 0.70|s|`) is not
    decoration.
11. **`dir_world` built from the camera's un-projected forward vector.** At −55° pitch the
    horizontal component is short, so the character walks at 57% speed while looking down.
    A `.setY(0).normalize()` is required and is trivially forgotten.
12. **Walk speed lowered to make the world feel big.** ARBITRATION S17 forbids it: 2.0 m/s
    is a Souls-side combat-spacing property and the world grows instead.
13. **Turn-in-place implemented as a yaw lerp with a clip played on top**, so the clip's feet
    slide across the ground while the root spins at a different rate. RI-VIS08 C3 measures
    the slide; this item requires the yaw come *from* the root track.

## Provenance note

`confidence: medium`, and split.

- **`canonical-recall`, confidence medium:** the qualitative model — that Souls unlocked
  movement is camera-relative with the character turning to face its velocity at a bounded
  rate; that pitch is clamped hard with more range below the horizon than above; that manual
  look is unfiltered and unlagged; and that a stationary character plays a turn-in-place
  rather than spinning on the spot — is recalled, not measured.
- **A correction to the brief that commissioned this item.** The brief stated that Souls
  "leaves the camera where you put it" and does **not** auto-follow. That is only half true
  and the corpus records the other half: Dark Souls III auto-rotates the camera behind the
  character during movement, with no in-game option to disable it — the community shipped a
  Mod Engine 2 plugin specifically to turn it off
  ([Disable Camera Auto Rotation, Nexus Mods](https://www.nexusmods.com/darksouls3/mods/2028)) —
  and Elden Ring exposes it as a "Camera Auto Rotation" setting that many players turn off
  ([How to Turn Off Automatic Camera Rotation in Elden Ring,
  Twinfinite](https://twinfinite.net/guides/how-turn-off-automatic-camera-rotation-elden-ring/)).
  `provenance: community-data`, confidence medium. §D/§E is our ruling on the collision: we
  keep auto-recentre but **gate it behind a committed sprint**, so the brief's requirement
  (nothing during ordinary walking) and the upstream behaviour (recentring while running
  hard) are both satisfied, and the seam between them is a measurable boolean rather than a
  taste argument.
- **`constructed`, confidence high, and binding:** every number in §A–§F. The 0.15/0.95
  deadzone band, the quadratic magnitude curve, 180/120 °/s stick rates, 0.120/0.100 °/px
  mouse sensitivity, the 30/20 °/frame swipe caps, the −55°/+38° clamp and the narrower
  −50°/+32° locked band, the 0.55 walk/run threshold, the 720/480 °/s turn ceilings, the
  100° turn-in-place threshold and its 18-frame clip, and the entire §E gate (20-frame arm,
  0.350 s / 0.600 s half-lives, 90 °/s clamp, same-frame disengage) are ours.
- The **720 °/s** running turn ceiling is adopted from RI-CMB06 §C, which fixed it first.
  An amendment must touch both files.
- **Harness dependency:** requires the `camera` trace channel and the requested
  `player.move_dir_deg` field. Absent either, every check here scores **0**, fail-closed.
