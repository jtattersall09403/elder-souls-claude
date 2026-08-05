---
id: RI-CAM03
title: Lock-on framing — the containment law, distance- and size-dependent pitch, switch latency, and the reticle
kind: number
side: souls
judges: [combat.lockon.target, combat.lockon.switch, combat.camera.behaviour, ui.hud.combat]
provenance: constructed
confidence: medium
blind_pair: yes
---

> **SEAM S18.** This item is the sharp end of the ruling: lock-on framing is the single
> camera behaviour a player notices within ten seconds of a boss fight.
> **Coordination with RI-CMB06.** That item already fixed acquisition, retention, break,
> switching thresholds, the aim point, the spring half-lives, the boom ramp and the yaw
> clamp. Those values are **adopted verbatim** here, marked **[CMB06]**, and may not be
> changed by this file. What this item adds is the part RI-CMB06 stated as an *aim rule*
> and did not make into a *containment guarantee*: a camera that aims at a point between
> two fighters does not thereby keep both of them on screen. §C is that guarantee, and
> §D–§F make it measurable.

## The bar

Locked on, the camera has one job and it is not "look at the enemy". It is to hold a frame
in which **both combatants and the space between them are legible**, continuously, while
that space is being violently rearranged. The player must be able to read the enemy's
windup, their own recovery, and the gap, all at once, without ever moving the stick.

That means the target is on screen essentially always — not 96% of the time, because the
4% is the dodge you did not see coming. It means the *player* is on screen too, because a
Souls player reads their own animation to know when they are actionable. It means the frame
adjusts to what it is framing: a rat 2 m away and a 9 m boss 12 m away do not get the same
pitch or the same arm. And it means every one of those adjustments arrives as a smooth,
rate-limited correction, so the camera never whips and never snaps — not on acquisition, not
on a switch, not when the target teleports behind you, not when it dies.

A camera that fails this is not a camera problem. It is a *combat* problem, and it will be
reported as "the boss is unfair".

## The reference artifact

### A. Adopted verbatim from RI-CMB06 (do not restate as new values)

| Parameter | Value | Source |
|---|---|---|
| Acquisition range / cone / LOS | 14.0 m, ±40° h ±30° v from camera forward, single ray camera→chest | **[CMB06 §A]** |
| Target-selection score | `min(angle_deg + 2.0 × dist_m)` | **[CMB06 §A]** |
| Break range (hysteresis) | 18.0 m | **[CMB06 §A]** |
| LOS grace before break | 30 frames | **[CMB06 §A]** |
| Break on target death | on the death frame; **no auto-reacquire, ever** | **[CMB06 §A]** |
| Switch input | right-stick displacement ≥ 0.60, new target within ±55° of that screen direction, 12-frame cooldown, none during committed animations | **[CMB06 §A]** |
| Aim point `A` | `lerp(player_chest, target_chest, 0.35) + (0, 0.25, 0)` | **[CMB06 §B]** |
| Yaw spring half-life | 0.120 s | **[CMB06 §B]** |
| Pitch spring half-life | 0.180 s | **[CMB06 §B]** |
| Boom ramp | 3.60 m at ≤ 4 m target distance → 5.20 m at 14 m, linear | **[CMB06 §B]** |
| Boom collision | sphere cast r = 0.28 m, minimum 0.90 m | **[CMB06 §B]** |
| Vertical framing band | target chest between **38%** and **62%** of screen height | **[CMB06 §B]** |
| Max camera yaw rate under lock | **420 °/s** (7.000 °/frame) | **[CMB06 §B]** |
| FOV under lock | unchanged | **[CMB06 §B]** |
| Right stick while locked | camera authority = none; switching only | **[CMB06 §B]** |

### B. Anchors and screen-space definitions (this item owns them)

| Symbol | Definition |
|---|---|
| `P_a` | the **player** anchor: the `spine2` bone position, projected to NDC |
| `T_a` | the **target** anchor: the target's `chest` node, projected to NDC |
| `T_h` | the **target head** anchor: the target's topmost tell-bearing node (head, or the highest weapon socket for headless archetypes), projected to NDC |
| `onscreen(X)` | 1 if the anchor's NDC lies within `x ∈ [−1, 1], y ∈ [−1, 1]` and `z` is in front of the near plane, else 0 |
| `safe_rect` | NDC `x ∈ [−0.75, +0.75]`, `y ∈ [−0.70, +0.70]` |
| `cover(T)` | fraction of the target's projected bounding box occluded by the **player's own mesh**, from the ID buffer |

`onscreen_fraction(X)` over a run = `Σ onscreen(X) / frames_locked`.

### C. The containment law (the section this item exists for)

Aiming at `A` **[CMB06 §B]** positions the camera. Containment then *corrects* it. Order of
operations, every frame, after the CMB06 springs have run and before RI-CAM01's collision
step:

```
1. yaw, pitch := CMB06 springs toward A          (half-lives 0.120 / 0.180 s)
2. pitch      := pitch + pitch_bias(d, h)        (§D)
3. arm_want   := CMB06 boom ramp(d)              (3.60 -> 5.20 m)
4. project P_a, T_a, T_h
5. if P_a outside safe_rect OR T_a outside safe_rect:
       arm_want  += 0.15                          (per frame, cumulative)
       pitch     += 1.5 deg toward the offending anchor's vertical side
6. else if arm_len > CMB06 boom ramp(d) + 0.02:
       arm_want  -= 0.08                          (per frame, release, slower than grab)
7. arm_want := clamp(arm_want, 0.90, 7.50)
8. arm_len  := ease(arm_len -> arm_want, half-life 0.250 s), rate-clamped:
                 +0.150 m/frame extending, -0.080 m/frame retracting
9. hand off to RI-CAM01 §C collision
```

| Parameter | Value |
|---|---|
| Safe rect | NDC x ±0.75, y ±0.70 |
| Containment arm correction, extend | **+0.150 m/frame** max |
| Containment arm correction, retract | **−0.080 m/frame** max |
| Containment pitch correction | **±1.50 °/frame** max |
| Arm-length change half-life | **0.250 s** |
| Absolute arm max | **7.50 m** |
| Correction is smoothed once | the springs in step 1 are the *only* orientation smoothing. Steps 2 and 5 adjust the **target** of those springs, never the output. Double-smoothing (easing an already-eased value) is a named failure. |

**Hard containment invariant:** if the containment law cannot satisfy both anchors at
`arm_len = 7.50 m`, it prioritises in this order: (1) `T_a` on screen, (2) `P_a` on screen,
(3) `T_h` on screen, (4) anchors inside `safe_rect`. It never sacrifices (1) or (2).

### D. Distance- and size-dependent pitch

`d` = horizontal player-to-target distance in metres. `h` = target's collision height in
metres.

```
pitch_base(d) = clamp(-16.0 + 0.80 * (d - 3.0), -16.0, -2.0)         # degrees
size_bias(h)  = 2.20 * max(0, h - 2.5)                                # degrees, tilts UP
pitch_bias    = pitch_base(d) + size_bias(h)
```

The aim point's vertical component also shifts for large targets, replacing the CMB06
constant `0.35` chest lerp on the **Y axis only**:

```
k(h)  = clamp((h - 2.5) / 4.0, 0, 0.75)
A.y   = lerp(player_chest.y, target_head.y, 0.35 + k(h) * 0.65)
A.xz  = lerp(player_chest.xz, target_chest.xz, 0.35)                  # unchanged [CMB06]
```

Worked values:

| Target | `h` | `d` | `pitch_base` | `size_bias` | net pitch bias | `A.y` lerp weight | boom |
|---|---|---|---|---|---|---|---|
| Marsh rat | 0.6 m | 2.0 m | −16.0° | 0.0° | **−16.0°** | 0.35 | 3.60 m |
| Naga levy (`INFANTRY`) | 1.9 m | 3.5 m | −15.6° | 0.0° | **−15.6°** | 0.35 | 3.60 m |
| Naga levy | 1.9 m | 8.0 m | −12.0° → clamp → −12.0° | 0.0° | **−12.0°** | 0.35 | 4.40 m |
| Elite (2-handed) | 2.6 m | 4.0 m | −15.2° | 0.22° | **−15.0°** | 0.37 | 3.60 m |
| Mid boss | 4.5 m | 6.0 m | −13.6° | 4.40° | **−9.2°** | 0.68 | 3.92 m |
| Great boss | 8.0 m | 10.0 m | −10.4° | 12.10° | **+1.7°** | 0.94 | 4.84 m |
| Great boss, hugged | 8.0 m | 2.5 m | −16.0° | 12.10° | **−3.9°** | 0.94 | 3.60 m |

**The documented degradation.** Against a target with `h ≥ 6.0 m` at `d < 4.0 m`, `T_h` may
leave the frame. This is deliberate, it matches upstream, and it is *bounded*: `T_a` and
`P_a` must still both be on screen, and `T_h` must return within **24 frames** of `d`
crossing back above 4.0 m. Any build that keeps a 9 m boss's head in frame while you hug its
ankle has zoomed out to a strategy-game camera and fails §E's player-legibility bar instead.

### E. On-screen bars (the headline measurables)

Measured over `frames_locked` in each duel scenario.

| Quantity | Pass | Warn | Fail |
|---|---|---|---|
| `onscreen_fraction(T_a)` | **≥ 0.995** | 0.980–0.995 | **< 0.980** |
| `onscreen_fraction(P_a)` | **≥ 0.980** | 0.950–0.980 | **< 0.950** |
| `onscreen_fraction(T_h)`, targets `h < 6.0` | **≥ 0.970** | 0.940–0.970 | < 0.940 |
| `onscreen_fraction(T_h)`, targets `h ≥ 6.0` | **≥ 0.880** | 0.820–0.880 | < 0.820 |
| `fraction(T_a ∈ safe_rect)` | ≥ 0.960 | 0.920–0.960 | < 0.920 |
| `fraction(T_a.y ∈ [38%, 62%] band)` **[CMB06]** | ≥ 0.900 | 0.850–0.900 | < 0.850 |
| `p95(cover(T))` — player's own body occluding the target, `d ≥ 3 m` | ≤ **0.25** | 0.25–0.40 | > 0.40 |
| `p100(camera yaw rate)` **[CMB06 clamp]** | ≤ 7.000 °/frame | — | > 7.000 |

### F. Latency bars

| Event | Requirement | Measured as |
|---|---|---|
| **Acquisition** | both anchors inside `safe_rect` within **30 frames** of the `lock_on` event; **no frame** with `\|Δyaw\| > 7.000°` | first frame after `lock_on` where both are inside |
| **Reframe after a target displacement** | target teleported 90° around the player at `d = 4 m`: both anchors inside `safe_rect` within **22 frames**; `T_a` back inside the 38–62% band within **30 frames** | first satisfying frame after the displacement frame |
| **Switch latency** | after a `lock_switch` event: both anchors inside `safe_rect` within **18 frames** | first satisfying frame after the event |
| **Switch: no camera authority leak** | a right-stick flick that resolves to *no valid target* produces **zero** camera yaw change and **no** lock break | `Σ\|Δyaw\|` over the flick and the following 12 frames ≤ 0.05° |
| **Break** | on `lock_break` the camera **holds** its current yaw and pitch and hands them to the player. `\|Δyaw\|` on the break frame ≤ the previous frame's magnitude; **no snap, no recentre, no orbit**. Arm returns to the free length (RI-CAM01 §A) over a 0.250 s half-life | measured on the break frame and the following 60 |
| **Death of target** | the break is not a cut: the same rule as above, plus **no auto-reacquire** **[CMB06 §A]** | |

### G. The reticle (the only lock-on UI)

| Property | Value |
|---|---|
| Form | one glyph drawn at `T_a`'s projected position |
| Size | **≤ 24 px** at 1920×1080, constant in screen space (no distance scaling) |
| Prediction / lead | **none**. It sits on the anchor's *current* projection, not a predicted one. |
| Fade in | 6 frames on `lock_on` |
| Fade out | 6 frames on `lock_break` |
| Off-screen behaviour | if `T_a` is off screen the reticle is **not drawn**. No edge-clamping, no arrow. (If containment is working, this state is < 0.5% of frames — the reticle's absence is the alarm, not a thing to paper over.) |
| Colour / style | owned by `ui.style.diegesis`; this item fixes only geometry and timing |

**Forbidden, each an automatic fail:** a screen-edge indicator or off-screen arrow pointing
at the target; an outline / rim-light / silhouette shader applied to the locked target; a
"LOCKED ON" text label; a tether line; a lead/prediction reticle; a reticle that scales with
distance; enemy health bars attached to the reticle (a boss bar is a separate HUD element
owned by `ui.hud.combat`, anchored to the screen, not to the target).

## Comparison method

Method script: **`corpus/80-methods/m-cam03-lockon-framing.mjs`**. Requires the `camera`
trace channel including `camera.onscreen` and `camera.lock_target`, plus the requested
`onScreen(eid)` harness method (see §Provenance). Acquisition/retention/break-condition
checks are **RI-CMB06's M1–M3 and M5** and are not re-run here; this item consumes their
result and fails closed if they were not run.

**M1 — On-screen fractions over real duels (the headline).** Run, at seed 1337, for
`frames_locked ≥ 3600` each:
`cmb-duel-infantry`, `cmb-duel-elite`, `cmb-boss-midtier`, `cmb-boss-great` (`h ≥ 6 m`),
`cmb-duel-in-corridor` (a 2.6 m interior), `cmb-duel-on-stair`, `cmb-gang-three`.
- Compute every row of §E.
- **FAIL** on any row landing in its Fail column, in any scenario.
- Report the per-scenario table. The corridor and stair scenarios are the ones that fail; a
  critic that only runs the flat-arena duel has not run this method (CRITIC-DOCTRINE §2.1
  step 2).

**M2 — Pitch law.** For `h ∈ {0.6, 1.9, 2.6, 4.5, 8.0}` × `d ∈ {2, 3, 4, 6, 8, 10, 12, 14}`
(40 poses), place a stationary dummy, lock on, `stepFrames(120)` to settle, `snapshot()`.
- Compute the settled `camera.pitch_deg` minus the pitch that the CMB06 aim-point spring
  alone would give (recompute it from `A` and the camera position).
- **FAIL** if the residual differs from `pitch_bias(d, h)` by > 1.0°.
- **FAIL** if `pitch_deg` is monotone in neither `d` nor `h` (a flat pitch means the law is
  not wired at all).
- **FAIL** if the locked pitch band [−50°, +32°] (RI-CAM02 §B) is exceeded.

**M3 — Containment under adversarial motion.** Scripted target that: orbits the player at
2.5 m at 300 °/s for 300 frames; then charges from 14 m to 1.5 m in 40 frames; then leaps
9 m vertically and lands behind the player; then strafes at 6 m/s at 3 m for 300 frames.
Repeat against `h = 1.9` and `h = 8.0` targets.
- **FAIL** if `onscreen_fraction(T_a) < 0.995` or `onscreen_fraction(P_a) < 0.980`.
- **FAIL** if `p100(camera yaw rate) > 7.000 °/frame` **[CMB06 clamp]**.
- **FAIL** if `arm_len` exceeds 7.50 m or changes faster than +0.150 / −0.080 m/frame.
- **FAIL** if `clip_through` is ever true (RI-CAM01 M3 applies inside lock too).

**M4 — Reframe and switch latency.** Using `teleport()` on the target and `lockOn()` /
scripted right-stick flicks:
- 20 trials of the 90°-displacement reframe. **FAIL** if `p100(reframe_frames) > 22`.
- 20 trials of a switch between two targets 4 m apart at 6 m. **FAIL** if
  `p100(switch_frames) > 18`, or if any switch violates the CMB06 12-frame cooldown, or if
  the switch direction is resolved in world space rather than screen space (test by
  performing the identical flick with the camera at 8 different yaws: the *chosen target*
  must change with the camera).
- 20 trials of a flick into empty space. **FAIL** if `Σ|Δyaw| > 0.05°` or the lock breaks.

**M5 — Break with no snap.** Acquire, then break by each of: manual toggle, walking past
18 m, 31 frames of occlusion, killing the target, player death, bonfire rest.
- **FAIL** if `|Δcamera.yaw_deg|` on the break frame exceeds the mean of the preceding 10
  frames by more than 0.5°.
- **FAIL** if any recentre, orbit, or arm snap occurs within 120 frames of the break.
- **FAIL** if `lockOn` re-fires without an input event (auto-reacquire; also **[CMB06 M3]**).

**M6 — Reticle census.** `setUIVisible(true)`, screenshot at 1920×1080 on 12 sampled frames
per duel scenario, plus 6 frames with `T_a` deliberately off screen.
- Measure the glyph's bounding box in pixels at `d = 3 m` and `d = 13 m`. **FAIL** if it
  exceeds 24 px or if the two sizes differ by > 2 px (distance scaling).
- **FAIL** if any of the forbidden elements in §G appears in any shot.
- **FAIL** if a reticle is drawn on an off-screen-anchor frame.
- Diff the locked and unlocked shots of the same enemy at the same pose: **FAIL** if the
  enemy's own pixels differ (an outline/highlight shader).

**M7 — Player self-occlusion.** From the ID buffer over M1's runs, compute `cover(T)` per
frame at `d ≥ 3 m`. **FAIL** if `p95 > 0.25`. Report `p100` and the frame at which it
occurred; if `p100 == 1.0` the shoulder offset (RI-CAM01 §A) is wrong or is not being
reduced under lock.

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M1 on-screen fractions | **30** | Every §E row out of Fail in all 7 scenarios |
| M2 pitch law | 15 | Residual matches `pitch_bias`, monotone in `d` and `h` |
| M3 containment under adversarial motion | **20** | Fractions held, clamps respected, no clipping |
| M4 reframe / switch latency | 15 | ≤ 22 f reframe, ≤ 18 f switch, screen-space direction, no phantom yaw |
| M5 break with no snap | 10 | No impulse, no recentre, no auto-reacquire |
| M6 reticle census | 5 | Geometry, timing, and none of the forbidden elements |
| M7 self-occlusion | 5 | `p95(cover) ≤ 0.25` |

Score = sum of passed weights, 0–100.

- **≥ 90** — parity. **70–89** — gap named. **< 70** — **we lose.**
- **Automatic fail regardless of score:**
  - `onscreen_fraction(P_a) < 0.950` — the player is being lost off screen; this is the
    `camera.lookAt(target)` signature and it makes the player's own recovery frames
    unreadable, which breaks the Souls contract at its root;
  - `onscreen_fraction(T_a) < 0.980`;
  - any camera *cut* (a single-frame orientation change > 20°) on acquisition, switch,
    break, or target death;
  - the target-switch direction resolved in world space;
  - any of §G's forbidden UI elements;
  - lock-on changing FOV **[CMB06 §B]**;
  - auto-reacquire on target death **[CMB06 §A]**.

**Blind pair:** build two 600-frame `(T_a.x, T_a.y, P_a.x, P_a.y)` NDC tracks for the same
scripted boss encounter — one ours, one generated from §C/§D — and plot both as scatter
clouds with the safe rect drawn, unlabelled. Discriminating question, written first: *in
which of these could a player read both fighters' animations without moving the stick?* A
cloud where the player anchor drifts to the frame edge is the tell. Record the pick before
the reveal; a pick of ours triggers CRITIC-DOCTRINE §2.5.

## How we lose

1. **`camera.lookAt(target)`.** The one-liner. The camera becomes a turret pointed at the
   enemy; the player slides off the bottom of the frame during any approach, and is entirely
   absent whenever the enemy is above them. RI-CMB06 already names this; this item is what
   makes it *falsifiable*, via `onscreen_fraction(P_a)`.
2. **Aiming at the midpoint and calling it framing.** Even RI-CMB06's `lerp(player, target,
   0.35)` aim point does not *guarantee* containment: at 14 m with a 3.60 m boom, a correct
   aim can still put the target outside the safe rect. §C exists because aiming and framing
   are different problems and only the second one is what the player experiences.
3. **A fixed boom.** One arm length for every target. A rat fills 3 px; a 9 m boss fills the
   screen and its head is 400 px above the top edge. The distance ramp is CMB06's; the size
   term in §D is what handles the boss.
4. **No size term at all**, so every boss fight is played by watching a torso. The moment a
   player says "I can't see the wind-up because I can't see its arms", this is the cause.
5. **Zooming out until everything fits.** The opposite failure and a tempting fix: raise the
   arm cap to 15 m and containment is trivially satisfied — and the game becomes a
   strategy-game camera in which the player's own animation is 60 px tall and unreadable.
   The 7.50 m cap plus the §C priority order is the defence.
6. **Double smoothing.** Ease the aim point, then ease the resulting orientation. The camera
   develops a soggy second-order lag, overshoots on every direction change, and the measured
   half-life no longer matches CMB06's 0.120 s. §C step 1's note is not decoration.
7. **Snap on acquisition.** `camera.quaternion.copy(lookAtTarget)` on the lock press. One
   frame, 120° — and every player reports motion sickness. **[CMB06 M5]** measures the
   spring; §F measures the absence of the impulse.
8. **Snap on break.** The forgotten mirror of #7: the code springs *into* lock and then
   restores a stored pre-lock orientation on release. The camera whips back to where it was
   thirty seconds ago.
9. **Auto-recentre firing on break**, because RI-CAM02 §E's gate does not exclude "the frame
   after a lock ended". The player is left running forward, so the sprint gate arms, and the
   camera keeps rotating.
10. **World-space target switching.** `if (stick.x > 0) pick the target with the greater
    world X`. Works while the camera faces +Z and swaps the wrong way the moment you turn
    around. M4's 8-yaw probe is specifically for this.
11. **Switch that steals the camera on a miss.** The flick finds no valid target and the code
    falls back to "nearest", or to a small camera nudge. Both make the right stick unsafe to
    touch mid-fight.
12. **The off-screen arrow.** Someone will add an edge indicator to "help when the target
    leaves the frame". It is a compass marker with a different name, it is AR-2 leakage
    (S8's spirit), and it papers over the containment failure that should have been fixed.
13. **The highlight shader.** Rim-lighting the locked enemy is standard in modern action
    games and it flattens RI-VIS05's art direction and RI-AI02's silhouette-only telegraph
    doctrine at the same time. If the enemy needs an outline to be findable, §E is failing.
14. **Containment implemented by moving the character.** A genuinely creative failure:
    nudging the player's world position to keep them in frame. It is invisible in a
    screenshot and catastrophic in a fight.
15. **Framing computed from bounding spheres in world space** rather than from projected NDC
    anchors, so it is correct at one FOV and one aspect and wrong on a windowed browser
    canvas. §B is defined in NDC for exactly this reason.

## Provenance note

`confidence: medium`, and split three ways.

- **[CMB06] rows in §A** are `constructed` by RI-CMB06 and adopted here **verbatim and
  binding**. This item introduces no competing value for any of them. Amending any of them
  requires amending both files, and invalidates RI-CMB06's M5 and this item's M1/M3.
- **`canonical-recall`, confidence medium:** the qualitative model — that a Souls lock-on
  camera frames both fighters rather than staring at the target, that it pulls back and
  tilts up for large enemies, that the reticle is a single small glyph with no lead and no
  off-screen indicator, that the lock does not auto-hop, and that breaking a lock leaves the
  camera where it was — is recalled, not measured. No frame-exact FromSoft data was consulted.
- **`community-data`, confidence low, context only:** the failure mode in §D's documented
  degradation and in *How we lose* #3/#4 is widely reported upstream — players compare Elden
  Ring's large-enemy framing unfavourably with Dark Souls III's and Sekiro's, specifically
  on the question of whether the camera zooms out enough for massive foes
  ([Elden Ring camera discussion, Steam
  Community](https://steamcommunity.com/app/1245620/discussions/0/3183488724674902773/)).
  That is corroboration that the problem is real and hard, not a source for any number here.
- **`constructed`, confidence high, and binding:** everything in §B–§G. The safe rect
  (±0.75, ±0.70), the containment correction rates (+0.150 / −0.080 m/frame arm, ±1.50
  °/frame pitch), the 0.250 s arm half-life, the 7.50 m cap, the containment priority order,
  `pitch_base` and `size_bias` and the `k(h)` aim-point shift, every threshold in §E, every
  latency in §F (30 f acquire, 22 f reframe, 18 f switch, 24 f head return), and the entire
  reticle spec in §G are ours.
- The §D worked table is `derived` from the formulas above it and RI-CMB06's boom ramp. A
  critic should recompute it rather than quote it.
- **Harness dependency:** requires the `camera` trace channel with `camera.onscreen`
  (per-anchor NDC + on-screen booleans), `camera.lock_target`, `camera.arm_len_m`, and an
  ID-buffer path for `cover(T)`. Absent them, every check scores **0**, fail-closed
  (CRITIC-DOCTRINE §7.3).
