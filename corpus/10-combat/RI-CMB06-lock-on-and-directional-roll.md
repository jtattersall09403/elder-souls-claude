---
id: RI-CMB06
title: Lock-on — acquisition, camera behaviour, directional roll semantics, and soft-lock steering
kind: number
side: souls
judges: [combat.lockon, combat.camera, combat.player.movement, combat.player.tracking, combat.input.direction]
provenance: constructed
confidence: medium
blind_pair: yes
---

## The bar

Lock-on converts a third-person action game into a **duel**. Once engaged, "forward" stops
meaning "the way the camera points" and starts meaning "toward that thing", and every
directional input — walk, roll, backstep, attack — is reinterpreted in that frame of
reference. Getting this right is what makes circling an enemy feel like fencing rather than
like driving. Getting it wrong is invisible in a screenshot and ruinous in play: a roll that
goes the wrong way once per fight destroys the player's trust in the input system
permanently.

"Good" means: the lock is a hard commitment with hysteresis, so it neither drops when the
enemy steps behind a pillar for four frames nor clings to a corpse; the camera *follows*
with a spring rather than snapping, and frames both fighters rather than staring at one; a
left roll under lock circles the target rather than moving toward some compass bearing; and
an attack started without lock-on snaps toward a nearby target on its first frame and then
**stops steering**, so that spacing remains the player's responsibility rather than the
game's.

## The reference artifact

### A. Acquisition and retention (`ES-LOCK/1`)

| Parameter | Value | Notes |
|---|---|---|
| Acquisition range | **14.0 m** | Root-to-root |
| Acquisition cone | **±40°** horizontal, **±30°** vertical, from camera forward | Target's chest node must be inside |
| Line of sight required to acquire | **yes** | Single ray, camera node → target chest node |
| Break range (hysteresis) | **18.0 m** | Deliberately > acquisition range |
| LOS grace before break | **30 frames (0.5 s)** | Enemy passing behind a pillar does not drop the lock |
| Break on target death | on the target's death frame | Auto-reacquire is **disabled** — see below |
| Break on player death / bonfire rest / cutscene | immediate | |
| Manual toggle | lock button press | Press to acquire nearest valid, press again to release |
| Auto-reacquire after target dies | **never** | The lock releases and the player must press again. Auto-hopping to the next enemy is forbidden: it steals the player's decision at the most dangerous moment of a group fight |
| Targets valid | hostile, alive, not `DORMANT`, not a friendly NPC | Merchants and quest actors are never lockable (ARBITRATION §1 keeps the world Morrowind's) |

**Target selection on acquisition:** among valid targets, minimise
`score = angle_from_camera_forward_deg + 2.0 × distance_m`. Report the score of the chosen
target in the `LOCK_ON` trace event.

**Target switching:** right-stick displacement ≥ **0.60** in a direction; the new target must
lie within **±55°** of that screen-space direction from the current target; cooldown
**12 frames** between switches. No switching during any committed animation state.

### B. Camera under lock

| Parameter | Value |
|---|---|
| Aim point | `lerp(player_chest, target_chest, 0.35)` + `(0, 0.25 m, 0)` |
| Yaw follow | critically damped spring, **half-life 0.120 s** |
| Pitch follow | critically damped spring, **half-life 0.180 s** |
| Boom length | **3.6 m** at target distance ≤ 4 m, ramping linearly to **5.2 m** at 14 m |
| Boom collision | sphere cast, radius **0.28 m**; normal minimum **0.9 m**. RI-CAM01 §C's S49 penetration guard alone may use the greatest clear below-floor length when the unchanged origin/near-plane envelope cannot clear at any length ≥0.9 m; zero clipping remains absolute. |
| Vertical framing | target chest held between **38%** and **62%** of screen height |
| Player right-stick input while locked | ignored for camera (used for target switching only) |
| FOV | **unchanged** by lock (no dolly-zoom, no punch-in) |
| Max camera yaw rate | **420 °/s** — the spring is clamped so a fast-orbiting enemy cannot whip the camera |

**The camera never teleports.** On acquisition it springs from its current orientation to the
locked orientation over the half-life above; there is no cut, no snap, no instant look-at.

### C. Directional semantics — the table that matters

Let `stick` be the movement-stick vector, `cam` the camera basis, `tgt` the vector from
player to locked target (horizontal, normalised).

| Situation | Frame of reference for the movement/roll direction | Character facing |
|---|---|---|
| **No lock**, moving | camera-relative: `dir = cam.right × stick.x + cam.forward × stick.y` | turns to `dir` at ≤ 720 °/s |
| **No lock**, roll | `dir` as above, latched on frame 1; if `stick == 0`, backstep | snaps to `dir` on roll frame 1 |
| **Locked**, moving | **target-relative**: `forward = tgt`, `right = tgt × up` | held facing the target |
| **Locked**, roll, `|stick| ≥ 0.5` | **target-relative**, latched on frame 1, quantised to **8 directions** (45° bins) | held facing the target for the whole roll |
| **Locked**, roll, `|stick| < 0.5` | backstep, directly away from target | held facing the target |
| **Locked**, sprinting | camera-relative; character faces travel direction | lock **retained**, camera still framed on target |
| **Locked**, sprint released | returns to target-relative strafing within 6 frames | re-faces target at ≤ 720 °/s |

The load-bearing row is the fourth. **A left roll under lock circles the target.** It does not
move toward camera-left, and it does not move toward world −X. The player's mental model is
polar coordinates centred on the enemy, and every input must honour that.

Movement speed multipliers while locked (strafing costs you):

| Direction (target-relative) | Multiplier |
|---|---|
| Forward | 1.00 |
| Diagonal forward | 0.92 |
| Lateral | **0.85** |
| Diagonal back | 0.78 |
| Backward | **0.70** |

Roll distance (RI-CMB01 §B) is **not** modified by direction — a lateral roll under lock
covers the same 5.20 m at `LIGHT` as a forward roll. Only walk/run speed is directional.

### D. Soft-lock steering during attacks

This is the rule that decides whether spacing is a skill.

```
On the FIRST frame of any attack animation:
    if locked:
        yaw := yaw toward the locked target        (instant, on this frame only)
    else:
        candidates := hostiles within 4.0 m and within +/-30 deg of player forward
        if candidates nonempty:
            yaw := yaw toward argmin(angle)        (instant, on this frame only)  # SOFT LOCK

Thereafter, for the rest of the animation, the maximum yaw rate is:
    frames [2 .. 0.40*startup]        : 180 deg/s     toward target
    frames (0.40*startup .. 0.80*startup] :  45 deg/s toward target
    frames (0.80*startup .. end]      :    0 deg/s    -- FROZEN
```

| Parameter | Value |
|---|---|
| Soft-lock acquisition radius (unlocked) | **4.0 m** |
| Soft-lock acquisition cone (unlocked) | **±30°** |
| Frame-1 snap | instant, one frame, both locked and soft-locked |
| Steering, first 40% of startup | **180 °/s** |
| Steering, next 40% of startup | **45 °/s** |
| Steering, last 20% of startup, all active and all recovery frames | **0 °/s** |
| Steering during roll / backstep / heal / stagger / critical | **0 °/s** |

Worked: an ultra greatsword R1 has 29 startup frames (RI-CMB02 §A). Steering is 180 °/s for
frames 2–12 (max 33°), 45 °/s for frames 13–23 (max 8.3°), and zero from frame 24 onward.
Total post-snap correction available: **41.3°**. A player who strafes wider than that during
the windup is missed — which is the entire skill of fighting a big weapon.

Steering is toward the target's **current** position each frame, but it is rate-limited, not
a `lookAt`. And it never exceeds the caps above, no matter how far the target has moved.

### E. What lock-on explicitly does NOT do

| Forbidden | Because |
|---|---|
| Enlarge hitboxes or hurtboxes | RI-CMB04 §D.4 — no aim assist, ever |
| Increase damage, poise damage, or reach | Lock is a camera and input mode, not a buff |
| Auto-face during active or recovery frames | §D freezes yaw; the swing goes where it was aimed |
| Slow time, ease the enemy's timing, or reduce enemy aggression | |
| Auto-hop to a new target when the current one dies | §A |
| Prevent the player from walking off a ledge | Lock does not restrict movement |
| Persist through a bonfire rest, death, or area transition | |

## Comparison method

Script: **`corpus/80-methods/m-cmb06-lockon.mjs`**

Harness: headless Node + Three.js, fixed 60 Hz, seeded, scripted stick and button input,
emitting `es-combat-trace/1` (RI-CMB07) with `p.lock`, `p.yaw_deg`, camera transform, and
`LOCK_ON` / `LOCK_BREAK` / `LOCK_SWITCH` events.

**M1 — Acquisition envelope.** Place one target on a polar grid: distance 2→20 m in 0.5 m
steps × bearing −90°→+90° in 5° steps. Press lock at each pose.
- Build the boolean field `A[d][θ]`.
- **FAIL** if the `true` region is not exactly `d ≤ 14.0 ∧ |θ| ≤ 40°`, within one grid cell.
- Repeat with an occluding wall: **FAIL** if any occluded pose acquires.

**M2 — Hysteresis and grace.** Acquire at 10 m, then walk the target away in a straight line.
- **FAIL** if the lock breaks at any distance < 18.0 m (±0.2 m).
- Then re-acquire and pass the target behind a pillar for 20, 29, 30, 31 and 40 frames.
- **FAIL** unless the lock survives ≤ 30 and breaks at 31.

**M3 — No auto-hop.** Lock target A with target B 3 m away; kill A.
- **FAIL** if `p.lock` is non-zero on the frame after A's death, or if any `LOCK_ON` event
  fires without a corresponding button press in the input script.

**M4 — Directional roll semantics (the headline check).** Locked onto a stationary target,
with the camera deliberately rotated to 8 different yaws relative to the target:
1. For each of the 8 stick directions × 8 camera yaws (64 runs), inject a roll.
2. Record the world-space displacement vector of the roll from the trace.
3. Convert to target-relative polar angle.
- **FAIL** if the target-relative angle for a given stick direction varies by more than **5°**
  across the 8 camera yaws. (This is the check that catches camera-relative or world-relative
  roll under lock, which is the most common and most damaging error in this item.)
- **FAIL** if the 8 measured angles are not within 5° of the 8 × 45° bins.
- **FAIL** if roll distance varies by more than 0.15 m across directions.
- Repeat unlocked: **FAIL** if the roll is *not* camera-relative there.

**M5 — Camera spring.** Acquire lock with the camera 120° away from the target bearing.
- Sample camera yaw per frame; fit an exponential.
- **FAIL** if the measured half-life differs from 0.120 s by more than 15%.
- **FAIL** if the camera reaches its final orientation in ≤ 2 frames (a snap).
- **FAIL** if yaw rate exceeds 420 °/s on any frame.
- Orbit the target around the player at 3 m and 300 °/s: **FAIL** if the camera exceeds the
  rate clamp or if the target leaves the 38–62% vertical framing band by more than 10%.

**M6 — Soft-lock steering envelope.** Unlocked, with a target at 3 m and 20° off-axis:
1. Inject an attack; record player yaw per frame.
- **FAIL** if the frame-1 snap does not occur, or exceeds one frame.
- Then, target moving laterally at 4 m/s: record total yaw change after frame 1.
- **FAIL** if the total exceeds the §D budget for that weapon by more than 2°.
- **FAIL** if any yaw change occurs on or after `first_active`.
- Repeat with the target at 5.0 m and at 35° off-axis: **FAIL** if a soft-lock snap occurs
  (both are outside the 4.0 m / ±30° envelope).

**M7 — Movement multipliers.** Locked, walk in each of the 8 target-relative directions for
120 frames; measure displacement.
- **FAIL** on any multiplier deviating by more than 3% from §C.

**M8 — No aim assist.** Re-run RI-CMB04's M3 boundary-sharpness test with lock-on engaged.
- **FAIL** if the measured hit/no-hit crossing offset differs at all from the unlocked run.

### CONSUMPTION (`RI-MTH07` / `ARBITRATION` §3) — *(ADDED wave 1, BAR-CRITIQUE-W1-09-R1 §R4)*

`ARBITRATION` §3's CONSUMPTION check landed in wave 1 and reached the combat **critics** through
the doctrine while reaching **none of the items in `corpus/10-combat/`**. The consequence was
visible immediately: `W1-09` round 3 enumerated six models by its own choice, found two with
`coupling == 0`, and recorded the result as `partial` — a disposition `RI-MTH07` does not have,
because its threshold is binary. Which models must be enumerated, and what a zero costs, are
properties of the item, not of the critic's diligence. So, for this item:

1. **Enumerate exhaustively** every model this item requires to act — every table, curve, window
   and constant it publishes that the running game must read — and list it in the verdict. A
   sample is not an enumeration.
2. **Perturb and observe** per `RI-MTH07` §B: two well-separated values, everything else held
   fixed, an **entity-side** observable (a state transition, an hp change, a position, a denied
   input), plus the null control. `"the trace carries it"` is not a consumer; a trace is an
   observer.
3. **Apply the consequence.** Any `coupling == 0` scores **that dimension 0**, fail-closed, and
   appears in the piece's `status_reasons`. There is no `partial`.
4. **Report the coupling table in the verdict**, as data, not in prose.

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M1 acquisition envelope | 10 | Exact, LOS respected |
| M2 hysteresis and grace | 10 | 18.0 m break, 30 f grace |
| M3 no auto-hop | 5 | Lock releases on target death |
| M4 directional roll semantics | **30** | Target-relative, camera-invariant, 8 bins |
| M5 camera spring | 15 | Spring not snap, rate clamped, framing held |
| M6 soft-lock steering | 20 | Frame-1 snap only, budget respected, frozen from `first_active` |
| M7 movement multipliers | 5 | Within 3% |
| M8 no aim assist | 5 | Hit geometry identical locked and unlocked |

- **≥ 90** — parity.
- **70–89** — gap named, remediable.
- **< 70** — **we lose.**
- **Automatic fail regardless of score:**
  - directional rolls under lock resolved in camera space or world space;
  - `lookAt(target)` called on the player during attack active or recovery frames;
  - lock-on granting any combat advantage other than camera and input framing;
  - auto-reacquire on target death;
  - a lock that breaks the instant line of sight is lost;
  - camera snapping on acquisition.

**Blind pair:** give the critic two M4 result tables — 64 rows of (stick direction, camera
yaw, resulting target-relative roll angle) — unlabelled, and ask which belongs to a game
where you can trust your thumb. Record the blind pick before the reveal.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 70 / 100 | 80 / 100 | 92 / 100 |

**Aggregation (a property of this item, not of the critic):** weighted-sum of passed check weights, max 100.

## How we lose

1. **Camera-relative rolls under lock.** By far the most likely failure, because the unlocked
   path is written first and the locked path reuses it. Symptom: the player circles left,
   the camera swings, and now "roll left" rolls *into* the enemy. The player will describe
   this as "the controls are drunk" and will be right. M4 is weighted at 30 for this reason.
2. **World-relative rolls.** The even lazier variant, where stick-left is −X. Works perfectly
   until the player turns around.
3. **`camera.lookAt(target)` every frame.** One line, instant, and it makes the camera a
   turret: it snaps on acquisition, whips when the enemy dashes, and induces motion sickness.
   The spring in §B is not polish; it is the difference between a playable and an unplayable
   camera.
4. **Player `lookAt(target)` every frame.** The corresponding character-side error. The player
   pivots mid-swing to follow the enemy, spacing becomes meaningless, and every miss becomes
   a hit. This also silently breaks RI-CMB02's commitment rule and RI-AI03's punish windows.
5. **No hysteresis.** Acquisition and break at the same range, so a target at exactly 14 m
   flickers the lock on and off every few frames, strobing the camera.
6. **Lock drops on the first frame of lost LOS**, so fighting anything near a pillar is
   unplayable.
7. **Auto-hop to the next enemy on kill**, which is a convenience feature everywhere else and
   a betrayal here: the camera whips to a target the player did not choose, at the exact
   moment they were about to heal.
8. **Aim assist smuggled in.** "Lock-on widens the hitbox slightly so attacks feel better."
   It makes the geometry in RI-CMB04 unmeasurable and it is an automatic fail.
9. **Strafe animations missing**, so the character moon-walks sideways while facing forward.
   Cosmetic, but it is the single most visible tell that lock-on was bolted on.
10. **Soft-lock with no envelope.** An unlocked attack that snaps to the nearest enemy at any
    distance and any angle, so the player can never deliberately swing at empty air, can
    never bait, and gets dragged 180° around by an enemy behind them.
11. **Steering implemented as a `slerp` toward the target with a fixed alpha**, which has no
    frame budget and no hard cutoff, so a fast enemy is tracked through the entire swing.
    §D's three-band rate limit with a hard zero is specified as bands precisely because a
    single lerp constant cannot express "and then stop".
12. **Right stick doing camera and target-switching at once**, so nudging the camera swaps
    targets mid-fight.

## Provenance note

`confidence: medium`, and split.

- **`canonical-recall`, confidence medium:** the qualitative model — that Souls games use a
  hard target lock with a spring-followed camera that frames both combatants; that under lock
  the movement and roll frame of reference becomes target-relative rather than camera-relative,
  quantised into eight directions; that a neutral-stick dodge under lock is a backstep away
  from the target; that sprinting temporarily overrides target-relative movement while keeping
  the lock; that lock is retained through brief occlusion; that attacks snap toward a nearby
  target on their first frame and then track only weakly and briefly; and that lock-on confers
  no combat advantage beyond framing. No frame-exact community frame data was consulted for
  this item, and none is cited.
- **`constructed`, confidence high, and binding:** every number. The 14.0/18.0 m acquisition
  and break ranges, the ±40°/±30° cone, the 30-frame LOS grace, the target-selection score
  function, the 0.60 switch threshold and 12-frame cooldown, all camera spring half-lives,
  boom lengths, the 420 °/s clamp and the 38–62% framing band, every directional movement
  multiplier, the 4.0 m / ±30° soft-lock envelope, and the three-band steering rate schedule
  (180 / 45 / 0 °/s at 40% / 40% / 20% of startup) are ours. The steering schedule in
  particular is referenced by RI-CMB02 §D.2 and any amendment must touch both files.

The 41.3° total steering budget quoted in §D for the ultra greatsword is `derived` — computed
from this item's rate bands and RI-CMB02's 29-frame startup. It will change if either changes,
and a critic should recompute it rather than quote it.
