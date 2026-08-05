---
id: RI-CAM04
title: Locked movement, directional roll clips, and the player-side tracking cutoff
kind: number
side: souls
judges: [combat.dodge.directional, combat.attack.tracking, combat.player.movement, combat.attack.commitment]
provenance: constructed
confidence: high
blind_pair: yes
---

> **SEAM S18.** Under lock the camera stops being a viewpoint and becomes the *frame of
> reference for every directional input*. This item owns the character-side consequences.
> **Coordination.** RI-CMB06 §C fixed the frame-of-reference table, the 8-direction
> quantisation, and the movement multipliers; RI-CMB06 §D fixed the three-band steering
> schedule. RI-AI02 §A–§C fixed the tracking-cutoff law for **enemies**. This item is where
> those two meet: it applies AI02's `Tc` discipline to the **player**, reconciles the two
> conventions into one per-attack-class table, and adds the *animation* and *classification*
> requirements neither item covers.

## The bar

Locked on, a Souls character is a fencer: shoulders square to the opponent, feet crossing,
back never turned by accident. Every dodge is a *different animation* — you can tell a left
roll from a back roll from behind, at a glance, which is how you read your own state during
the half-second you are not in control. And every attack you throw steers toward the enemy
for a little while and then **stops**, at a frame you could count, so that a player who
mis-spaces gets a miss and not a free correction.

Get this wrong in three specific ways and the fight dies: the character moon-walks (strafe
animations missing), every dodge looks like a forward roll (directional clips missing), or
attacks track through the whole swing (cutoff missing). The third is the same crime RI-AI02
makes an automatic fail when an *enemy* commits it. The player does not get an exemption.

## The reference artifact

### A. Adopted verbatim from RI-CMB06 §C (not restated as new values)

| Situation | Frame of reference | Facing |
|---|---|---|
| Unlocked, moving | camera-relative | turns to `dir` at ≤ 720 °/s |
| Unlocked, roll | camera-relative, latched frame 1 | **snaps** to `dir` on frame 1 |
| Locked, moving | **target-relative** | held on target |
| Locked, roll, `\|stick\| ≥ 0.5` | **target-relative**, latched frame 1, quantised to 8 × 45° bins | held on target for the whole roll |
| Locked, roll, `\|stick\| < 0.5` | backstep, directly away | held on target |
| Locked, sprinting | camera-relative; faces travel | lock retained, camera still framed |
| Locked, sprint released | target-relative within 6 frames | re-faces at ≤ 720 °/s |

Movement multipliers **[CMB06 §C]**: forward 1.00, diag-fwd 0.92, lateral 0.85, diag-back
0.78, backward 0.70. Roll distance is **not** direction-modified.

### B. Directional roll clips (this item owns the clip contract)

Nine authored clips, all root-motion-authoritative (RI-CMB01 §C.5):

| Bin (target-relative, locked) | Clip id | Used when |
|---|---|---|
| 0° | `roll_f` | forward roll toward the target |
| 45° | `roll_fr` | |
| 90° | `roll_r` | the circling roll — the most-used clip in the game |
| 135° | `roll_br` | |
| 180° | `roll_b` | |
| 225° | `roll_bl` | |
| 270° | `roll_l` | |
| 315° | `roll_fl` | |
| — | `backstep` | `\|stick\| < 0.5` under lock |

**The unlocked/locked asymmetry — state it explicitly, because it is the thing that gets
implemented backwards:**

| Mode | Facing on roll frame 1 | Clip selected |
|---|---|---|
| **Unlocked** | **snaps** to the input direction **[CMB06 §C]** | always `roll_f` (the body has already turned; a directional clip on top would double-rotate) |
| **Locked** | **held on the target** | the bin's clip from the table above |

So: unlocked, the player never sees a side roll, because the character turns first. Locked,
the player *only* sees side rolls, because the character does not turn at all. A build that
plays `roll_f` in both cases has no directional roll; a build that plays a directional clip
in both cases has a character that rolls sideways while facing sideways, and covers 5.20 m
in a direction 90° from the one the animation depicts.

Additional clip requirements:
- Each clip's root-track heading must be within **5°** of its bin centre (RI-CMB06 M4 measures
  the *world* displacement; this measures the *clip*).
- All nine share the frame table of RI-CMB01 §B for the character's equip-load tier — same
  startup, same i-frames, same recovery, same total, per tier. **±0 frames** across directions.
- `HEAVY` and `OVERLOADED` tiers use the same nine clip *ids* with different timing scales
  (RI-CMB01 §B); they are not a reduced set.

### C. Strafe / turn classification (locked locomotion)

Per frame, with `speed > 0.3 m/s`, classify:

```
err        = signed_angle(player_facing, direction_to_target)     # degrees
travel_err = signed_angle(player_facing, velocity_horizontal)     # degrees
class      = STRAFE  if |travel_err| > 30 and |err| <= 12
             TURN    if |yaw_rate| > 5 deg/frame
             FORWARD if |travel_err| <= 30
             BACKPEDAL if |travel_err| > 150
```

| Requirement | Value |
|---|---|
| `p100(\|err\|)` over all locked, non-sprinting, non-rolling, non-committed frames | **≤ 12.0°** |
| Automatic fail threshold on `\|err\|` | **> 25.0°** on any such frame — the character has turned its back |
| Distinct locomotion clips required under lock | `walk_f/b/l/r`, `run_f/b/l/r` — **8 clips minimum**, each with its own footfall pattern |
| `TURN` frames while locked and not sprinting | **0** — under lock the character does not turn, it strafes |
| Moon-walk detector | for each locked locomotion frame, the clip's authored travel heading must be within **25°** of `travel_err`. A `run_f` clip playing while `travel_err = 90°` is a moon-walk. |

### D. The player tracking cutoff — reconciling RI-CMB06 §D with RI-AI02 §C

RI-CMB06 §D gives the player a three-band schedule expressed as fractions of startup.
RI-AI02 §C gives enemies a hard rule `Tc ≤ W − 4` and a *total yaw budget*. Both apply to
the player. The reconciliation, which is binding and replaces neither file's law but
composes them:

```
W    = attack startup in frames (RI-CMB02 §A/§B, after §C modifiers, round-half-up)
b1   = ceil(0.40 * W)                       # end of the fast band  [CMB06 convention]
Tc   = min( floor(0.80 * W), W - 4 )        # cutoff  [CMB06 fraction, AI02 hard rule]
frame 1            : instant snap to target (locked) or soft-lock target (unlocked) [CMB06 §D]
frames 2 .. b1     : <= 180 deg/s  = 3.00 deg/frame
frames b1+1 .. Tc  : <=  45 deg/s  = 0.75 deg/frame
frames Tc+1 .. end : 0 deg/s -- FROZEN, through all remaining startup, active and recovery
bands are truncated at Tc if b1 > Tc
GLOBAL CAP: total post-snap yaw over the whole attack <= 45.0 deg, whichever binds first
```

**Per-class table (R1, one-handed, first hit of the chain).** `W` from RI-CMB02 §A.

| Class | `W` | `b1` | `Tc` | Band-1 frames (°) | Band-2 frames (°) | Budget | Capped |
|---|---|---|---|---|---|---|---|
| Dagger | 6 | 3 | **2** | 2–2 (3.00°) | — | 3.00° | 3.00° |
| Straight sword | 12 | 5 | **8** | 2–5 (12.00°) | 6–8 (2.25°) | 14.25° | 14.25° |
| Spear | 14 | 6 | **10** | 2–6 (15.00°) | 7–10 (3.00°) | 18.00° | 18.00° |
| Axe | 16 | 7 | **12** | 2–7 (18.00°) | 8–12 (3.75°) | 21.75° | 21.75° |
| Halberd | 19 | 8 | **15** | 2–8 (21.00°) | 9–15 (5.25°) | 26.25° | 26.25° |
| Greatsword | 22 | 9 | **17** | 2–9 (24.00°) | 10–17 (6.00°) | 30.00° | 30.00° |
| Ultra greatsword | 29 | 12 | **23** | 2–12 (33.00°) | 13–23 (8.25°) | 41.25° | 41.25° |

The ultra greatsword row reproduces RI-CMB06 §D's worked example (33° / 8.3° / 41.3°) to
within rounding. That is the consistency check on this table, not a coincidence.

**Per-class table (R2, one-handed, uncharged).** `W` from RI-CMB02 §B.

| Class | `W` | `b1` | `Tc` | Band-1 (°) | Band-2 (°) | Budget | **Capped at 45°** |
|---|---|---|---|---|---|---|---|
| Dagger | 14 | 6 | **10** | 15.00° | 3.00° | 18.00° | 18.00° |
| Straight sword | 25 | 10 | **20** | 27.00° | 7.50° | 34.50° | 34.50° |
| Spear | 27 | 11 | **21** | 30.00° | 7.50° | 37.50° | 37.50° |
| Axe | 30 | 12 | **24** | 33.00° | 9.00° | 42.00° | 42.00° |
| Halberd | 34 | 14 | **27** | 39.00° | 9.75° | 48.75° | **45.00°** |
| Greatsword | 40 | 16 | **32** | 45.00° | 12.00° | 57.00° | **45.00°** |
| Ultra greatsword | 52 | 21 | **41** | 60.00° | 15.00° | 75.00° | **45.00°** |

**Why the 45° cap exists.** Without it, a heavy weapon's long windup buys *more* correction,
which inverts the whole risk model: the slowest attacks would be the most forgiving. The cap
also makes the player **stricter than any enemy in the game** — RI-AI02 §C allows trash 60°,
elites 90°, bosses 100°, and designated tracking moves 180°. That asymmetry is deliberate:
the player has a camera, a lock-on, and a stick; the enemy has neither.

**Modifiers.** Rolling / running / jump attacks scale `W` per RI-CMB02 §C; `b1`, `Tc` and
the bands are recomputed from the modified `W`, not scaled. Two-handing does not change `W`
and therefore does not change any cell. Charged R2 charge frames are inserted *after*
startup and are **frozen** (0 °/s) throughout — a charge is not a free aim.

**Steering targets.** Steering is toward the target's **current** position each frame,
rate-limited **[CMB06 §D]**. It is never a `slerp` with a fixed alpha and never a `lookAt`.
Unlocked, the soft-lock envelope is 4.0 m / ±30° **[CMB06 §D]** and the frame-1 snap is the
only instant rotation.

**Steering is 0 °/s, unconditionally, during:** roll (all frames), backstep, heal, stagger,
hitstun, critical/riposte/backstab, `turn_in_place`, and every frame with
`phase ∈ {active, recovery}` **[CMB06 §D + AI02 AP2]**.

### E. Roll-direction correlation (the measurable that catches everything)

Over the 8 bins × 8 camera yaws × {locked, unlocked} = 128 scripted rolls:

| Quantity | Definition | Pass |
|---|---|---|
| `clip_match` | fraction of rolls where the played clip id equals the bin's clip from §B | **1.000** |
| `bin_error` | max over runs of `\|measured target-relative heading − bin centre\|` (locked) | **≤ 5.0°** |
| `camera_variance` | max spread of the target-relative heading for one stick direction across the 8 camera yaws (locked) | **≤ 5.0°** **[CMB06 M4]** |
| `unlocked_camera_dependence` | spread of the *world* heading for one stick direction across 8 camera yaws (unlocked) | **≥ 350°** — i.e. it *must* follow the camera |
| `distance_variance` | spread of roll displacement magnitude across all 128 | **≤ 0.15 m** **[CMB01]** |

## Comparison method

Method script: **`corpus/80-methods/m-cam04-locked-movement.mjs`**. Reads `player`, `input`,
`events` and the requested `camera` + `player.roll_bin` + `player.move_dir_deg` fields.
RI-CMB06 M4 and M6 are **prerequisites**: if they were not run, this item fails closed.

**M1 — Directional clip census (the headline check).** 128 scripted rolls per §E.
- **FAIL** if `clip_match < 1.000`. A single wrong clip is a fail: this is a lookup table.
- **FAIL** if `bin_error > 5.0°` or `camera_variance > 5.0°`.
- **FAIL** if `unlocked_camera_dependence < 350°` (the unlocked roll is not camera-relative).
- **FAIL** if the unlocked runs use anything other than `roll_f`.
- **FAIL** if the locked runs use `roll_f` for a non-0° bin.
- **FAIL** if fewer than 9 distinct clip ids appear across the whole census (the build has
  fewer than nine roll animations).
- Independently: `renderFrame()` + `screenshot()` on frame 8 of a 0°, 90°, 180° and 270°
  locked roll. **FAIL** if a human-visible pose difference is absent between all four
  (a "directional roll" implemented by rotating the same clip's root is a rotated forward
  roll and looks like one — the character's shoulder leads in all four shots).

**M2 — Strafe / turn classification.** Locked, orbit the target at 3 m for 900 frames in
each direction, then approach/retreat for 300 each, on flat ground and on a 20° slope.
- Classify every frame per §C. Report the class histogram.
- **FAIL** if `p100(|err|) > 12.0°` on any qualifying frame; **automatic fail** if > 25.0°.
- **FAIL** if any `TURN` frame occurs while locked and not sprinting.
- **FAIL** if the moon-walk detector fires on > 0.5% of frames.
- **FAIL** if fewer than 8 distinct locomotion clip ids appear.

**M3 — Player tracking cutoff (the AI02 law applied to us).** For each of the 14 rows in §D
(7 classes × R1/R2), with the target strafing laterally at 4 m/s at 3.0 m:
1. Inject the attack while locked. Record `player.yaw_deg` per frame.
2. `Tc_measured` = the last frame (relative to attack start) with `|yaw_rate| > 2.0 °/s`,
   using RI-AI02 §A's definition verbatim.
3. `budget_measured` = `Σ |Δyaw|` over frames 2..end.
- **FAIL** if `Tc_measured ≠ Tc` for any row (**±0 frames**).
- **FAIL** if `budget_measured` exceeds the row's capped budget by > 2.0°.
- **FAIL** if `|yaw_rate|` exceeds 3.00 °/frame in band 1 or 0.75 °/frame in band 2.
- **FAIL** if any frame with `phase ∈ {active, recovery}` has `|yaw_rate| > 2.0 °/s`
  (this is RI-AI02 **AP2** applied to the player and is an **automatic fail**).
- **FAIL** if `Tc > W − 4` for any row (RI-AI02 **AP3**).
- Repeat unlocked with the target at 3 m / 20° off-axis: the frame-1 snap must occur and
  nothing after it may exceed the same budget **[CMB06 M6]**.
- Repeat with rolling / running / jump modifiers: **FAIL** if `Tc` was scaled rather than
  recomputed from the modified `W` (they differ by ≥ 1 frame for every class).

**M4 — Frozen states.** Inject each of: roll, backstep, heal, riposte, and a scripted stagger,
with the target strafing at 6 m/s.
- **FAIL** if `Σ|Δyaw| > 0.5°` over any of those animations.

**M5 — Charged R2.** Hold the heavy attack to full charge (+30 f) with a strafing target.
- **FAIL** if any yaw change occurs during the charge frames.

**M6 — Sprint handoff.** Locked, sprint for 120 frames, release.
- **FAIL** if the character has not returned to target-relative strafing within 6 frames
  **[CMB06 §C]**, or if the return exceeds 720 °/s, or if the lock breaks.

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M1 directional clip census | **30** | `clip_match == 1.000`, 9 clips, locked/unlocked asymmetry correct, visible pose difference |
| M2 strafe/turn classification | 20 | `\|err\| ≤ 12°`, zero TURN frames, 8 locomotion clips, no moon-walk |
| M3 tracking cutoff | **30** | `Tc` exact for all 14 rows, budgets within 2°, zero yaw in active/recovery |
| M4 frozen states | 10 | No steering in roll/heal/stagger/critical |
| M5 charged R2 | 5 | No steering during charge |
| M6 sprint handoff | 5 | 6-frame return, lock retained |

Score = sum of passed weights, 0–100.

- **≥ 90** — parity. **70–89** — gap named. **< 70** — **we lose.**
- **Automatic fail regardless of score:**
  - any yaw change on a frame with `phase ∈ {active, recovery}` (RI-AI02 AP2, player side);
  - `Tc > W − 4` on any attack (RI-AI02 AP3, player side);
  - directional rolls resolved in camera or world space while locked **[CMB06]**;
  - the character turning its back to the locked target (`|err| > 25°`) on any locked,
    non-sprinting, non-rolling frame;
  - fewer than 9 roll clips or fewer than 8 locked locomotion clips;
  - steering implemented as a `slerp`/`lookAt` with no hard cutoff frame.

**Blind pair:** two 14-row `(class, Tc_measured, budget_measured)` tables — ours and one
generated from §D — unlabelled. Discriminating question, written first: *in which of these
games does mis-spacing a big weapon get punished?* A table where the budget grows without
bound with `W` is the tell. Record the pick before the reveal.

## How we lose

1. **No directional roll clips at all.** One `roll_f`, rotated. Every dodge is a forward
   roll with the character facing a different way, which looks like a bug and reads as one.
   The most likely failure in this item and the reason M1 is weighted 30.
2. **Directional clips applied unlocked too.** The mirror error: the character snaps to face
   the input direction (correct, **[CMB06]**) *and then* plays `roll_l`, so it rolls 90°
   from where it is pointing. Symptom: unlocked rolls go the wrong way exactly a quarter of
   the time.
3. **A rotated forward roll sold as a directional roll.** The root heading is right, the
   clip is wrong, and the character does a forward roll sideways. `clip_match` catches the
   id; the screenshot check in M1 catches a build that renamed the clip without animating it.
4. **No strafe animations.** The character moon-walks in every locked fight. RI-CMB06 *How
   we lose* #9 already names it as "the single most visible tell that lock-on was bolted on";
   §C's moon-walk detector is how it stops being a matter of opinion.
5. **`lookAt(target)` on the player every frame while locked.** `|err| == 0` always, which
   passes §C's ≤ 12° bar for the wrong reason — and then the same call keeps running through
   the swing, which M3's active/recovery check catches as an automatic fail. Do not read a
   passing M2 as evidence for M3.
6. **Steering as `slerp(current, toTarget, 0.15)`.** No cutoff frame exists at all, so
   `Tc_measured` comes back as `W + A + Rc`. RI-CMB06 already predicts this one; §D's
   explicit `Tc` per class is what makes it a number rather than an argument.
7. **Cutoff expressed in seconds.** `if (attackTime < 0.2) steer()`. Drifts with frame rate,
   gives a different `Tc` per weapon by accident, and is unmeasurable.
8. **Scaling `Tc` with the attack modifiers instead of recomputing it.** A rolling attack has
   `W × 0.60`; scaling `Tc` by 0.60 gives a different (and always larger) value than
   recomputing `min(floor(0.80 W'), W' − 4)`. Off by 1–3 frames per class, invisible except
   in M3's modifier pass.
9. **No global budget cap**, so an ultra greatsword R2 quietly gets 75° of correction and
   becomes the *easiest* weapon to land. Nobody notices until the balance pass, by which time
   the whole moveset is tuned around a broken premise.
10. **The player exempted from AI02.** The corpus makes untelegraphed enemy tracking an
    automatic fail. A build where the *player* homes through the active frames has the same
    defect pointed the other way, and it destroys RI-AI03's punish windows from the player
    side: every whiff-punish the AI is designed to offer gets corrected into a hit.
11. **Bins computed from the raw stick vector rather than the quantised bin**, so a stick at
    47° plays `roll_fr` but travels at 47°. The 45° quantisation is what makes the input
    learnable by muscle memory.
12. **Locomotion clip set of two** (`run_f`, `run_b`) with lateral movement covered by
    playing `run_f` at 0.85 speed. §C's clip census counts ids for this reason.

## Provenance note

- **[CMB06] rows and values** (§A in full, the 8-bin quantisation, the three-band schedule
  fractions, the 4.0 m/±30° soft-lock envelope, the 720 °/s return rate, the movement
  multipliers) are `constructed` by RI-CMB06 and adopted **verbatim and binding**.
- **[AI02] law** (`Tc` definition as the last frame with `yaw_rate_dps > 2.0`, the hard rule
  `Tc ≤ W − 4`, anti-patterns AP2 and AP3) is `constructed` by RI-AI02 and adopted
  **verbatim and binding**, applied to the player.
- **[CMB01] / [CMB02]** supply the roll frame tables and the startup values `W`. The §D
  tables are **`derived`** from those files' numbers by the formulas stated in §D. A critic
  must recompute them rather than quote them; if RI-CMB02 §A/§B ever changes, every cell in
  §D changes with it and this file must be amended in the same commit.
- **`constructed`, confidence high, and binding — new in this item:** the nine-clip contract
  in §B and the unlocked/locked clip asymmetry; the `Tc = min(floor(0.80 W), W − 4)`
  reconciliation formula; the **45° global steering cap**; the §C classification thresholds
  (12° / 25° / 30° / 5 °/frame / 25° moon-walk / 8-clip minimum); and the §E correlation
  thresholds.
- **`canonical-recall`, confidence medium:** that Souls has distinct front/back/left/right
  roll animations under lock and a single forward roll unlocked, that locked locomotion uses
  a separate strafe clip set, and that attacks stop tracking partway through the windup.
  Recalled, not measured; no frame-exact FromSoft data was consulted or cited.
- **Harness dependency:** requires `player.roll_bin` (the latched 45° bin), `player.anim`
  (already in the schema), and the `camera` channel for the camera-yaw sweeps. Absent them,
  M1 and M3 score **0**, fail-closed.
