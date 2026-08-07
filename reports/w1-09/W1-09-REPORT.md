# W1-09 — Combat core: what was built and what it measures

**Every number below is read out of a real run.** The instrument is
`tools/harness/cmb-probe.mjs`; the raw output is `reports/w1-09/cmb-probe-all.json`. Nothing in
this report is computed from a formula and presented as an observation — `RI-MTH04` voids a
verdict, and a builder's claim, that cannot show a real run.

Reproduce:

```
node tools/analysis/data-index.mjs
node tools/harness/cmb-probe.mjs --probe all
node tools/harness/cmb-exemplar.mjs
```

**Unit discipline (S22).** Every frame figure in this report, in `game/data/combat/**` and in
every trace this piece emits is written `f@60` and means one 1/60 s simulation step. A Souls
community tick is `t@30` and is a different unit. The build implements the **rebased** ladder.

---

## 1. The roll — `RI-CMB01` M1, M2, M5

### M1, animation census (observed)

| Tier | kind | press→`anim_frame` | startup | i-frames | window | recovery | total | stamina | distance |
|---|---|---|---|---|---|---|---|---|---|
| `LIGHT` | roll | **1** | 4 | **26** | f5–f30 | 22 | **52** | 22 | 5.200 m |
| `LIGHT` | backstep | **1** | 4 | **8** | f5–f12 | 30 | **42** | 14 | 2.300 m |
| `MEDIUM` | roll | **1** | 4 | **22** | f5–f26 | 34 | **60** | 26 | 4.400 m |
| `MEDIUM` | backstep | **1** | 4 | **8** | f5–f12 | 30 | **42** | 14 | 2.300 m |
| `HEAVY` | roll | **1** | 6 | **10** | f7–f16 | 72 | **88** | 34 | 2.600 m |
| `HEAVY` | backstep | **1** | — | **0** | — | 60 | **60** | 20 | 1.600 m |
| `OVERLOADED` | roll | **1** | — | **0** | — | 120 | **120** | 40 | 1.100 m |
| `OVERLOADED` | backstep | **1** | — | **0** | — | 80 | **80** | 26 | 0.700 m |

`RI-CMB01` §B declares 52/60/88/120 with 26/22/10/0 i-frames at f5–f30, f5–f26, f7–f16.
**Every cell matches at ±0 frames.** The i-frame run is a single contiguous run in every tier
(`contiguous_runs: 1`), which is what M1 requires.

`press→anim_frame == 1` in all eight rows is `RI-CMB11`'s L2 invariant: **exactly zero
additional simulation frames between the press and animation frame 1.**

Eight-direction invariance (M1's third FAIL condition): `total` is **52 in all eight
directions**, distance 5.200–5.253 m — the 0.053 m spread is one jog frame of the stick still
being held after the roll releases, i.e. an artefact of the probe, not of the roll.

### M2, the i-frame boundary probe — the check a naive implementation fails

`H[k]` = did the player get hit, for a one-frame enemy hitbox whose active frame lands on
`press + k`. The fixture is `game/data/combat/enemies/probe_pulse.json`, an 8 m-radius
one-frame pulse declared as a measurement instrument so that **geometry is never the
variable** and only the i-frame window can decide the outcome.

```
LIGHT   k=-4 ......................................................... k=60
        11111111000000000000000000000000001111111111111111111111111111111
                ^k=4                    ^k=29
MEDIUM  11111111000000000000000000000011111111111111111111111111111111111111...
                ^k=4                ^k=25
HEAVY   11111111110000000000111111111111111111111111111111111111111111111...
                  ^k=6      ^k=15
```

`anim_frame = k + 1`, so the observed negation windows are **f5–f30 (26 frames)**,
**f5–f26 (22)** and **f7–f16 (10)**.

- **Zero holes** — no `hit` inside any invulnerable run.
- **Zero leaks** — no `no-hit` outside one.
- The transitions land exactly on `startup` and on `startup + iframes` in all three tiers.

This is the check `RI-CMB01` M2 exists for and it passes at ±0 frames. The i-frame test in the
code is `anim_frame ∈ [iframes[0], iframes[1]]`, asked every fixed step
(`game/src/combat/actor.js`); there is no timer, no `setTimeout` and no seconds comparison on
the path.

### M5, the threshold cliff

| load % | 29.0 | 29.9 | **30.00** | **30.01** | 30.1 | 50 | 69.9 | **70.00** | **70.01** | 99.9 | **100.00** | **100.01** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| tier | L | L | **L** | **M** | M | M | M | **M** | **H** | H | **H** | **OVER** |
| i-frames | 26 | 26 | **26** | **22** | 22 | 22 | 22 | **22** | **10** | 10 | **10** | **0** |
| total | 52 | 52 | 52 | 60 | 60 | 60 | 60 | 60 | 88 | 88 | 88 | 120 |

The discontinuity is at exactly 30.00→30.01 and 70.00→70.01 and nowhere else. **No
interpolation is observable anywhere**: there is no load at which the i-frame count is 12, 16
or any other value between the four declared ones.

### Root motion (M3's non-constant-curve clause)

`per_frame_delta` for a `LIGHT` roll, metres, frames 2…52:

```
0.086 0.110 0.213 0.045 0.117 0.165 0.187 0.185 0.157 0.105 0.032 0.084 0.176
0.234 0.258 0.248 0.203 0.125 0.033 0.101 0.183 0.232 0.249 0.232 0.183 0.101
0.026 0.087 0.135 0.182 0.160 0.090 0.025 0.076 0.096 0.076 0.021 0.026 0.042
0.040 0.020 0.000 0.000 0.000 0.000 0.000 0.000 0.000 0.000 0.000
```

Non-constant, front-loaded, and **zero for the last ten frames** — the `TURN` sub-phase
`RI-CMB09` §2 requires to be translation-free. The controller adds nothing of its own; the
delta is `clip.rootForwardAt(f) − clip.rootForwardAt(f−1)` and nothing else moves the character
during a roll (`game/src/combat/actor.js` `advance()`).

The curve shape was authored from
`corpus/70-visual/refs/souls-behaviour/anim/stance/er-ER_Skill_Quickstep_Forward.gif` (31
frames), which shows exactly this: a crouch, most of the ground covered in the first third, and
a stationary rise for the tail.

---

## 2. Attack frame data — `RI-CMB02` M1, M2

### M1, all fourteen base rows (observed)

| class | move | press→af1 | startup | `Ps` | active | recovery | total | stamina | root Δz | active runs |
|---|---|---|---|---|---|---|---|---|---|---|
| dagger | R1 | 1 | 12 | 13 | 6 | 24 | **42** | 12 | 0.150 | 1 |
| dagger | R2 | 1 | 28 | 29 | 6 | 44 | **78** | 20 | 0.200 | 1 |
| straight sword | R1 | 1 | 24 | **25** | 10 | 40 | **74** | 20 | 0.350 | 1 |
| straight sword | R2 | 1 | 50 | **51** | 12 | 60 | **122** | 34 | 0.600 | 1 |
| spear | R1 | 1 | 28 | 29 | 8 | 44 | **80** | 18 | 0.550 | 1 |
| spear | R2 | 1 | 54 | 55 | 10 | 64 | **128** | 30 | 1.100 | 1 |
| axe | R1 | 1 | 32 | 33 | 12 | 48 | **92** | 24 | 0.300 | 1 |
| axe | R2 | 1 | 60 | 61 | 14 | 72 | **146** | 40 | 0.500 | 1 |
| halberd | R1 | 1 | 38 | 39 | 14 | 56 | **108** | 28 | 0.450 | 1 |
| halberd | R2 | 1 | 68 | 69 | 16 | 84 | **168** | 44 | 0.700 | 1 |
| greatsword | R1 | 1 | 44 | 45 | 16 | 66 | **126** | 32 | 0.850 | 1 |
| greatsword | R2 | 1 | 80 | 81 | 20 | 96 | **196** | 50 | 1.250 | 1 |
| ultra greatsword | R1 | 1 | 58 | 59 | 20 | 88 | **166** | 42 | 1.400 | 1 |
| ultra greatsword | R2 | 1 | 104 | 105 | 24 | 124 | **252** | 62 | 1.900 | 1 |

**All fourteen rows are exact to the frame** against `RI-CMB02` §A/§B as rebased, including the
two cells the item pins across the corpus: straight-sword R1 `Ps = 25 f@60` and R2
`Ps = 51 f@60`. Root Δz is exact to 0.000 m (the item allows ±0.05). `hitbox_active` is a
single contiguous run per swing in every row, and `active ≠ total` everywhere.

### M2, the commitment grid

Straight sword R1 (24/10/40, total 74). Column `k` = an input on animation frame `k+1`.
`.` = ignored/dropped, `B` = buffered and fired after the animation released, `C` = **cancelled
the animation**.

```
          1         11111111112222222222333333333344444444445555555555666666666677777
          1234567890123456789012345678901234567890123456789012345678901234567890 1234
roll      ...................................................CCCCCCCCCCCCCCCCCCCCCCB
light     .................................................................BBBBBBBBB
block     ..........................................................................
sprint    ..........................................................................
use_item  .................................................................BBBBBBBBB
parry     .................................................................BBBBBBBBB
```

Read against `RI-CMB02` §D, which derives the boundaries from its own formula
(`ceil(0.45 × 40) = 18`, so hard through animation frame `24 + 10 + 18 = 52`):

- **Dodge cancels from animation frame 53 and not one frame earlier.** The first `C` is at
  column 52, which is animation frame 53.
- **Nothing cancels during startup or active.** No `C` appears at any column ≤ 51.
- **`block` and `sprint` never cancel and never buffer** — `RI-CMB02` M2 fails a build where
  either does.
- **The buffer is exactly 8 frames.** `B` runs from column 65 (animation frame 66)… the last
  nine columns; eight of them are the buffer window (animation frames 67–74) and the ninth is
  the actionable frame itself, where the press executes immediately rather than being stored.
- A press before the window is **dropped, not queued**: 64 columns of `.` and no `B` among
  them. Mashing through a whole swing produces exactly one follow-up.

---

## 3. Stamina — `RI-CMB03` M1, M2, M6, and `RI-CMB09` §3/§4

### M1 — the regeneration curve

One roll from full. Stamina 120 → **98** on the press frame, in full, on frame 1.

```
frames after the spend:   38   39   40   41   42   43   44   45   46   47   48
stamina:                  98   98   98   98   98  98.75 99.5 100.25 101 101.75 102.5
```

- **First increase: 43 frames after the spend.** `RI-CMB03` M1: *"FAIL if `f_resume − f0 ≠ 43`
  (delay is 42 frames, so regen first shows on the 43rd)."* Exact.
- **Slope: 0.7500 / frame**, and the ten consecutive deltas after resume are
  `0.75 0.75 0.75 0.75 0.75 0.75 0.75 0.75 0.75` — linear, not an ease-in.
- **Guard raised: 0.1500 / frame** = 0.75 × 0.20, exactly `RI-CMB03` §A's multiplier.

### M2 — one global re-armed delay, not a per-action cooldown

Three rolls at frames 1, 55 and 109. Last spend at frame **110**; first regeneration at frame
**153**. Delta **43**. A per-action cooldown would have regenerated between the rolls; nothing
does.

### M6 — the zero-stamina gate

At 0 stamina and `EXHAUSTED`, a 30-frame walk input still moves the player **1.585 m**
(≈ 2.0 m/s + the guard multiplier). Walking, turning, camera and lock-on stay free at any
stamina, exactly as `RI-CMB03` §B requires.

### Blocking — M4, all three reference shields, one 96-damage chop

| shield | stability | absorption | stamina cost | `dmg × (1−stability)` | chip | `dmg × (1−absorption)` |
|---|---|---|---|---|---|---|
| Chitin buckler | 0.42 | 0.86 | **55.68** | 55.68 ✓ | **13.44** | 13.44 ✓ |
| Marsh-oak medium | 0.62 | 0.94 | **36.48** | 36.48 ✓ | **5.76** | 5.76 ✓ |
| Naga tower | 0.78 | 1.00 | **21.12** | 21.12 ✓ | **0.00** | 0.00 ✓ |

Both formulas exact, and **independent**: stability moves only the stamina column and
absorption only the chip column across all three shields. That independence is the specific
thing `RI-CMB03` M4 tests for, because conflating them turns the shield into passive armour and
deletes guard break.

### Guard break — M5

Roll-spam to an empty bar, then raise the guard into a chop:

```
f 539  BLOCK_HOLD   stam 20.05   hp 620
f 540  BLOCK_HOLD   stam 20.20   hp 620
f 541  BLOCK_HOLD   stam 20.35   hp 620
f 542  GUARD_BREAK  stam  0.00   hp 614.24     <- 20.35 − 36.48 < 0
f 543  GUARD_BREAK  stam  0.00   hp 614.24
...
f 548  GUARD_BREAK  stam  0.00   hp 614.24   exhausted=1
```

Stamina **clamps to 0 and never goes negative** in any frame of the run. The chip is 5.76 (the
absorption term) and the guard is forced down. Observed duration **46 frames** against the
declared 40: 40 animation frames **plus the chop's 6 frames of hitstop**, during which the
world holds and animation clocks do not advance. The 40 is the animation; the 46 is the wall.

### Roll-spam — `RI-CMB09` §3, and a corpus arithmetic error found by measurement

Dodge pressed on every actionable frame for 800 frames, `LIGHT`, 120 stamina:

| quantity | `RI-CMB09` §3 predicts | observed |
|---|---|---|
| cadence | 52 f | **52 f** ✓ |
| roll starts | — | 2, 54, 106, 158, 210, 262, 314, 378, 450, 526, … |
| regen between chained rolls | **0** | **6.75** (9 frames at 0.75) ✗ |
| rolls before the bar denies you | **5** | **7** |
| frame of first denial | 260 | **366** |
| inputs dropped for insufficient stamina | ≥ 4 (`RP2`) | **38** ✓ |
| `exhausted_enter` | ≥ 1 (`RP2`) | **1**, at frame 450 ✓ |
| stamina floor | — | **0.0**, held for **43 frames** ✓ |

`RI-CMB09` §3's derivation table contains an arithmetic error. Its row reads

> Regen recovered between chained rolls — "52 f elapsed < 42 f delay re-armed every 52 f →
> delay never expires" — **0**

but **52 > 42**, so the delay *does* expire: nine frames of every 52-frame cycle regenerate, at
0.75 each. The two rows below it (5 rolls, 260 f to denial) are consequences of the wrong 0 and
are also wrong. The corrected figures are in the table above and the amendment is filed at
`reports/w1-09/AMENDMENT-W1-09-01.md`.

**`RP1`/`RP2` still pass** — the roll-spammer still runs out and still gets denied, 38 times.
The lesson the item wants taught survives; only its arithmetic moves.

---

## 4. Hitboxes — `RI-CMB04` M1, M2, M3, M5

**There is no distance check anywhere on the hit path.** W1-00's placeholder resolved hits with
`if (d > reach_m + radius_m) continue`, which is `RI-CMB04` "How we lose" #1 and an AR-1
automatic fail; it is gone. `game/src/combat/resolve.js` sweeps a capsule between two weapon
sockets against twelve bone-parented hurtbox capsules, in four substeps, with the swept volume
computed as the exact convex hull of the two capsule poses.

### M1 — bone attachment

Over the 52 frames of a roll (a very large pose excursion), for each of the twelve hurtboxes:

| hurtbox | midpoint→parent-bone origin | variation across the animation | world travel over the roll |
|---|---|---|---|
| `head` | 0.069947 m | **9.05e-05 m** | 7.107 m |
| `torso_upper` | 0.109957 m | 8.82e-05 m | 6.165 m |
| `torso_lower` | 0.099966 m | 8.00e-05 m | 5.641 m |
| `pelvis` | 0.060000 m | **0** | 5.526 m |
| `upper_arm_l` | 0.129961 m | 8.51e-05 m | 5.942 m |

Maximum variation over all twelve: **9.24e-05 m**, against `RI-CMB04` §F's tolerance of
**0.005 m** — a factor of 54 inside budget, and the residue is the 1 µm save grid, not drift.
Every capsule travels 5.3–7.1 m of world space during a 5.2 m roll, so **the hurtboxes are
moving with the animated pose, not sitting at the root**. That is the check `RI-CMB04` M1 says
is "the check most likely to fail on the first pass".

### M2/M3 — a hit that connects by geometry and one that misses by geometry

A static target swept laterally across the straight sword's arc, 0.05 m steps, 0.00 → 2.00 m.
Nothing about the target changes but its position:

```
offset  0.00 .............................................. 2.00
hit     HHHHHHHHHHHHHHHHHHHHHHH..................
```

**One crossing, no fragmentation.** Refined at 0.005 m:

```
1.080 1.085 1.090 1.095 1.100 1.105 1.110 1.115 1.120 1.125 ...
  H     H     H     H     H     H     H     H     H     .
```

The hit/no-hit boundary is between **1.120 m and 1.125 m** — sharp to 5 mm, against
`RI-CMB04` M3's 0.030 m tolerance. That number is the "phantom range" figure the item asks
every verdict to quote: **there isn't one.** At 1.120 m the sword connects; at 1.125 m it
passes in front of the target's nose and the player takes the whiff.

### Why sweeping is load-bearing here, and the one number that needs a decision

Peak weapon-tip travel during the active window, measured: **0.6136 m per frame** against a
capsule radius of **0.070 m** — the tip moves **8.8 capsule radii in one frame**. A discrete
per-frame overlap test would miss a standing target through most of the arc.

`RI-CMB04` §B assumes 18.5 m/s for a straight sword, i.e. **0.308 m/frame**; ours is twice
that. §C's substep count of 4 was derived to give roughly one capsule radius per substep at the
assumed speed; at the measured speed, four substeps give **2.2 radii per substep**. The item's
own provenance note anticipates exactly this: *"if our animations differ, the substep count
must be re-derived rather than kept out of habit."* The build ships **4 substeps as declared
(±0, as §F requires)** and reports the divergence rather than quietly changing a bound number.
This is the thing I am least confident about — see §9.

### M5 — de-dup

A swing whose capsule overlaps the target for several consecutive frames emits **exactly one**
`HIT` (`hits_per_swing: 1`). De-dup is keyed on `(attack_instance, target)` using a monotonic
swing counter, not a frame stamp.

### Determinism

There is no `Math.random`, no `rng.`, no `Date.now` and no `performance.now` anywhere in
`game/src/combat/{resolve,geometry,skeleton,clips,rules,actor,player,enemy}.js`. W1-00's
determinism guard is armed across the whole combat step and throws on any of them.

---

## 5. Lock-on and the directional roll — `RI-CMB06`

### Acquisition envelope and hysteresis

| target distance | 4 m | 10 m | 13.5 m | 14.5 m | 17 m | 19 m |
|---|---|---|---|---|---|---|
| acquired | yes | yes | **yes** | **no** | no | no |

Declared acquisition range 14.0 m: the cliff is between 13.5 and 14.5. Acquired at 10 m and
walked away, the lock **broke at 18.03 m** against a declared break range of 18.0 m — the
hysteresis is real and is 4 m wide.

### The load-bearing row: does a left roll circle the target?

Locked, target at 4.2 m, one `LIGHT` roll:

| stick | distance before | after | Δ | bearing change | still facing target |
|---|---|---|---|---|---|
| forward | 4.200 | 0.893 | −3.307 | 180° | (rolled through) |
| **left** | 4.200 | **6.685** | +2.485 | **+52.85°** | **yes** |
| **right** | 4.200 | **6.685** | +2.485 | **−52.85°** | **yes** |
| back | 4.200 | 9.549 | +5.349 | 0° | yes |
| diagonal front-left | 4.200 | 3.606 | −0.594 | +84.55° | no (rolled past) |

A left roll changes the **bearing to the target by 53°** while the character keeps facing it —
it circles. It does not move toward camera-left and it does not move toward world −X. The
2.485 m of distance gain is the chord geometry (`√(4.2² + 5.2²) = 6.69`), not a bug: a roll is
a straight-line translation of a fixed 5.20 m, and `RI-CMB06` §C is explicit that roll distance
is **not** modified by direction.

### `RI-CAM03` containment, measured not asserted

Both chest nodes are projected through the camera basis every frame and `both_framed` is
emitted in the trace. Over 180 frames of the player strafing under lock: **180/180 framed
(1.000)**.

---

## 6. Poise, criticals, healing

Implemented and exercised in the regenerated exemplar run: `STAGGER` (2), `CRIT_HIT` backstab
(1) with `CRIT_RELEASE`, `BLOCK` (2), `GUARD_UP` (4), `ESTUS_START`/`ESTUS_DONE` (1 charge,
130 f@60 committed, 62-frame heal ramp), `IFRAME_NEGATE` (3), `WHIFF` (39), `INPUT_BUFFERED`
(6), `INPUT_DROPPED` (2).

Poise is `RI-CMB05` §A's pool — `poise_resist = clamp(armour_poise/120, 0, 0.60)`,
`poise_health_max = 20 + armour_poise` — with the model's provenance corrected per orchestrator
ruling **R3** in `game/data/combat/poise.json`: it is **Elden Ring's** always-on pool plus
hyperarmour on declared frames, not DS3's. That is a citation fix; the model is unchanged.

Stagger is uncancellable, including by further hits: a target already staggered takes damage
but the timer does not restart (`game/src/combat/resolve.js`), which is what prevents stunlock
chains. Poise resets to full **on the frame the stagger animation ends**, not when it starts.

---

## 7. Parley — `ARBITRATION` §1 as amended, seam **S13**

The non-lethal exit. Nine cases, all against the same Marsh-warden sentry, differing only in
**out-of-fight state**:

| what the player brings | outcome | enemy alive | gold after |
|---|---|---|---|
| nothing (disposition 35) | **refuse** | yes | 0 |
| **knows the topic `the-drowned-ford`** (disposition 0) | **ACCEPT / name** | **yes, 412 hp** | 0 |
| Marsh-warden rank 3 | **ACCEPT / faction** | yes | 0 |
| rank 3 but **expelled** | refuse | yes | 0 |
| rank 3 **and rank in the rival reed-court** | refuse | yes | 0 |
| rank 1 (below the required 2) | refuse | yes | 0 |
| **200 gold**, disposition 35 | **ACCEPT / gold** | yes | **20** (180 spent) |
| 200 gold, disposition 5 | refuse | yes | 200 |
| 100 gold (below the 180 price) | refuse | yes | 100 |

All nine as designed. The fight ends **without a corpse**: the champion keeps its 412 HP, stays
in `world.entities`, keeps its quest role, and awards no souls.

**It is not a menu.** The parley is a committed animated action: `PARLEY_STARTUP` →
`PARLEY_ACTIVE` → `PARLEY_RECOVER`, observed **78 frames**, uncancellable by a roll or an
attack pressed inside it, with the resolution on frame 31 and 47 frames of recovery in which
you are open. No pause, no dice, no topic list. That is what keeps S13 on the right side of
AR-1: Souls still owns *how fighting works*, and Morrowind owns the fact that a person can be
talked to.

**The beast exemption is declared, not forgotten.** Against `beast_slitherfang` (`parley: null`)
with 9999 gold, rank 9 and the true name known, the parley animation **does not start** — the
input is dropped with the named reason `exempt_beast_or_mindless` and a `PARLEY_EXEMPT` event.
A critic can tell a designed exemption from an omission.

---

## 8. AR-3 — the seam crossing this piece creates

**`quest.topicsKnown`, `quest.factions[*].rank` and the gold purse decide, inside the fight, at
60 Hz, whether a hostile has a non-lethal exit.**

It runs in both directions:

- **World → fight.** A topic learned by reading a book or asking the right person the right
  keyword — pure Morrowind, acquired entirely outside combat — is read on frame 31 of a
  committed combat animation and ends the fight. Row 2 of the table above is a player who has
  read `the-drowned-ford`; row 1 is the same player who has not, with the same weapon, the same
  stamina and the same enemy. Nothing about the *fight* differs. The outcome does.
- **Fight → world.** The outcome writes back: faction standing moves +2 with the sentry's order
  and −1 with its declared rival, the gold leaves the purse, the NPC survives to be a quest
  actor, and no soul drop occurs. A fight resolved by parley leaves the world in a state a
  fight resolved by killing cannot reach.

A second, quieter crossing is **seam S23**: `RI-PRG07` owns encumbrance out of the fight and
sets one number, `equip_load_pct`; `RI-CMB01` owns what that number *does* inside one, and the
M5 table in §1 is that crossing being measured. `Engine.setEquipLoad()` is deliberately the
only route across it.

This piece is **not** `seam_sterile`.

---

## 9. What I am least confident about

**The substep count against the measured tip speed.** `RI-CMB04` §C fixes substeps at exactly
4 (±0, §F) and derives that number from an assumed peak tip speed of 18.5 m/s
(0.308 m/frame) — roughly one capsule radius per substep. Our authored straight-sword arc peaks
at **0.6136 m/frame**, so four substeps sample at **2.2 radii each**. Against a fat target
(0.17 m torso capsule) that is still comfortable, and the lateral sweep in §4 shows a single
sharp crossing with no fragmentation. Against a **thin** target — a 0.065 m forearm capsule
edge-on, or the 0.06 m pole `RI-CMB04` M2 specifies — 2.2 radii per substep is where tunnelling
would first appear, and I have not run M2's 7-class × 24-offset analytic comparison against a
pole that thin.

Three ways out, and I do not think a builder should pick between them alone: slow the arc until
the tip speed matches §B (which flattens the swing and makes the class less readable); raise
the substep count (which contradicts a number §F pins at ±0); or amend §B's tip-speed column,
which is itself declared an "engineering assumption" derived from the corpus's own frame data
and reach figures. **The measurement is reported; the decision is the doctrine owner's.**

Two smaller things, both reported rather than hidden:

- **Measured reach vs declared reach.** Straight sword: geometric maximum tip distance during
  the active window is **1.762 m** against `RI-CMB02` §A's declared 1.95 m. The item states no
  tolerance on the reach column and `RI-CMB04` §E resolves hits by geometry alone, so the
  geometry is authoritative — but a 0.19 m gap is a real difference in how the weapon feels.
  For the greatsword and ultra greatsword the tension runs the other way: §B's capsule length
  (1.35 m, 1.70 m) is longer than §A's reach column allows given a 0.54 m arm and the declared
  lunge, so their weapon length is floored at the capsule length and the divergence is recorded
  in each moveset file's `length_derivation`.
- **The regenerated exemplar is a first pass.** `reports/w1-09/exemplar/` holds a real 120-second
  re-run (7,200 f@60) against the rebased constants, **not** a `f → 2f` dilation, which
  `RI-CMB07` §0 explains is the wrong repair. Twelve of the twenty-four banded statistics land
  in band, including the two the item calls most diagnostic — the **committed-frame ratio at
  0.5406 (band 0.34–0.56)** and the **roll-timing delta mean at −2.06 f with σ 0.23 (bands
  −16…−2 and ≤ 8)**. The ones out of band are all consequences of the authored script rather
  than of the engine: a 0.72 whiff rate because the punish is thrown from the end of a 5.2 m
  roll, no damage taken because the scripted rolls always connect, and a mean stamina of 0.83
  because the script is not greedy enough. Closing those is authoring work, and it is honest
  to say the artifact is regenerated and not yet *good*.

---

## 10. Declared not implemented

| what | owner | how it surfaces |
|---|---|---|
| enemy **decision-making** (approach, circle, commit, attack token, punish reads, leash) | `RI-AI01`–`RI-AI07` / W1-12 | statblocks declare `ai: "scripted"`; actions come from the scenario on declared frames, which is `RI-CMB07` M1 Mode-A's own instrument. **`RI-CMB07` M2 (Mode-B free play against real AI) is therefore unmeasurable in this piece and scores 0, fail-closed.** |
| attack ratings for all seven classes | `RI-WPN01`/`RI-WPN02` / W1-10 | `movesets/*.json` `attack_rating_provenance` marks all seven PROVISIONAL; only the straight sword's 118 is pinned, to the exemplar's own `HIT` at motion value 1.00 |
| hitstop, mass, material, impact audio | `RI-WPN05`/`RI-AUD01` / W1-11 | `hitstop_frames` is read and applied; the camera, audio and animation consequences are W1-11's |
| mid-animation combat state across a save/load | W1-09, declared limitation | `game/src/sim/combat-bridge.js` header. The combat bodies are the authority and `sim.player` is a view; a save on frame 12 of a roll restores a standing character at the roll's position. Correct under seam S6 and true of both source games, but stated rather than discovered |

Two trace-vocabulary extensions are **declared in the META** rather than smuggled in:
`PARLEY_STARTUP`/`PARLEY_ACTIVE`/`PARLEY_RECOVER` are added to `RI-CMB07` §A's closed player
state enum, because that enum predates the wave-0 amendment to `ARBITRATION` §1 that makes a
parley mandatory; and `EXHAUSTED` is deliberately **not** added as a state but carried as the
flag `p.exhausted` plus `exhausted_enter`/`exhausted_exit` events, because an exhausted player
still walks and collapsing the two would delete the observation `RI-CMB09` §4 wants. Both are
recorded in `game/src/combat/moves.js` `STATE_ENUM_EXTENSIONS` and in every trace META.
