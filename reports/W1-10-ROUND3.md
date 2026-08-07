# W1-10 round 3 — the impact model gets a consumer, and the blade gets its length back

**Piece:** W1-10, weapon movesets and the answer matrix. **Round 3**, after **0/10** (r1) and
**2/10** (r2). Written by the builder; **nothing here is a score.**

The round-2 verdict's single biggest gap:

> **`GAP-W1-weapon-impact-and-material-model-has-no-consumer`** — *"The RI-WPN05 impact and
> material model is a data island, exactly as the 87 movesets were in round 1. Six perturbations
> of the shipped tables; five change nothing."*

and its band label:

> *"the movesets now reach the game and behave as declared in the slot dimension, and the two
> dimensions the player feels — through the hitbox and through impact — are still not connected
> to anything."*

This round closes the impact half and most of the hitbox half. It also found two crashes in the
shipping build, and it contains one experiment that **failed and was reverted**, reported here at
the same length as the successes.

---

## 0. Before anything else — two crashes in the shipping build

Both arrived in `6e359ab` ("Bank in-flight agent work recovered after a container restart") as
halves of an unfinished edit: a function referenced and never defined.

| Crash | Where | Reproduced | Owner |
|---|---|---|---|
| `ReferenceError: advanceAlong is not defined` | `game/src/combat/system.js` `resolveBodyCollision()`, three call sites | node arena at 0.6 / 0.9 / 1.2 m **and** headless Chromium | fixed here |
| `ReferenceError: bodyDamage is not defined` | `game/src/combat/resolve.js:191` | node arena at 0.6 / 0.9 / 1.2 m | supplied by the concurrent W1-09 r4 agent |

`advanceAlong` fires on **every frame on which one body drives its root into another** — i.e. every
lunging attack that closes to contact. In the browser the exception comes out of
`CombatSystem.step` and kills the frame loop. Every measurement in this report was blocked by it.

It is defined here from `hitgeometry.json` §`bodies.separation.driver_carry`'s own published
formula — `push = min(overlap, max_speed/60 + max(0, driver_root_delta · contact_normal))` — with
the bearing taken from `CombatBody.advance()` so the carry is measured on the axis the root
actually travels along.

**Both crashes are in the deletion test below, and case 5 puts `advanceAlong`'s back.**

---

## 1. The named gap: the impact and material model now has a world-side consumer

### 1.1 The consumer, named

| Model | File | World-side consumer | What it changes |
|---|---|---|---|
| `classes.json` `hitstop.attacker[tier][material]` | `game/src/combat/impact.js` `resolveImpact()` | `game/src/combat/resolve.js` step (1b), at the frame a hit resolves → `applyHitstop()` → `CombatBody.hitstopUntil` | how many frames the attacker's animation clock is frozen |
| `hitstop.victim_delta` / `victim_hitstop_mode` | same | same, on the victim's body | RI-WPN05 §A's **bounce** — 0 on stone, metal and shield |
| `materials.multipliers[type][material]` | same | `resolve.js` `dmgWeapon` — applied **before** mitigation | the damage number |
| `hitstop.knockback_m[tier][material]` | same | `applyKnockback(A, B, …)` | who is pushed, and which way |
| `hitstop.deflect` | same | `resolve.js` (1c) `DEFLECT` branch | zero damage, ×1.5 hitstop, +16 f recovery |
| `enemies/*.json` `material` / `material_by_region` | `impact.js` `materialAt()` | `resolve.js` (1b) | which column of the grid this body reads |

`MovesetLibrary`'s five accessors now **delegate to `impact.js`**, so the harness and the fight
cannot disagree: there is one arithmetic and both read it.

### 1.2 Measured in the running browser build

`node tools/harness/wpn-impact-live.mjs` → `reports/W1-10-impact-live.json`, **0 page errors**.
Every cell below is read off the `IMPACT` event in the shipping build's own combat trace.

```
BROWSER attacker hitstop (f@60)
tier          flesh   chitin    stone    metal   shield     wood    water
light             4        6       15        8        8        4        2
medium            8       10       16       12       14        6        2
heavy            12       16       22       18       20       10        4
ultra            16       20       28       24       26       12        4

BROWSER victim hitstop (f@60)   — 0 on stone/metal/shield is §A's bounce
light             8        8        0        0        0        8        0
medium           12       12        0        0        0       10        0
heavy            16       18        0        0        0       14        0
ultra            20       22        0        0        0       16        0
```

The round-2 verdict says the 5×7 grid must be *"recoverable from traces against seven
material-carrying dummies with every cell differing from the flesh column where §A says it
should"*. It is, in the browser, for both grids.

**AR-3, exercised rather than declared** — the crossing this area owns, a lore fact that is also a
combat answer:

| weapon vs `mat_stone` | damage | deflect | hitstop | +recovery |
|---|---|---|---|---|
| `mce_bog_iron_mace` | **64.64** | no | 16 f | 0 |
| `ghm_bog_maul` | **85.32** | no | 22 f | 0 |
| `tsw_bog_rapier` | **0** | **yes** | 15 f | **+16 f** |
| `ssw_garrison_sword` | **0** | **yes** | 15 f | **+16 f** |

A mace beats a stone enemy that a rapier cannot, in the browser, and the reason is in the trace.

**Per-region material on one body:** `ssw_garrison_sword` into `champion_hist_marked` resolves
part `forearm_r`, material `plant`, multiplier ×1.25. Three materials live on that one enemy
(plant limbs, a metal legion cuirass, a flesh head) and the player learns to aim.

### 1.3 Perturbation, six of six — and why the critic's own probe reads 2/6

`node tools/weapons/impact-consumption.mjs` → **17 of 17 perturbations CONSUMED, none inert**,
across the hitstop grid, the victim grid, the knockback table, the deflect block, the material
multipliers, the damage-type map and the per-region assignments.

`node corpus/90-verdicts/wave1/artifacts/W1-10-r2/kritik-consumption3.mjs` — the round-2 critic's
own instrument, run unmodified — still reports **2 of 6**, and that is **a property of the
instrument, not of the build**. It fights `dummy_passive`, which is flesh, and it observes only
`{dmg, hitF, hitstop_held_frames}`:

| its probe | why a correct build cannot move it |
|---|---|
| `hitstop.attacker.*.stone → 99` | a flesh dummy never reads the stone row |
| `hitstop.attacker.*.metal/chitin/wood/shield → 99` | same, four rows at once |
| `hitstop.knockback_m ALL → 9` | knockback moves the **victim's position**, which the probe does not read |
| `hitstop.deflect.hitstop_multiplier → 20` | nothing deflects off flesh |

The two it *can* see — the flesh hitstop column and the material multipliers — both fire.
This is reported rather than worked around, and an amendment is filed (§7).

---

## 2. The hitbox half — S26 contiguity is closed, on the critic's own instrument

`node corpus/90-verdicts/wave1/artifacts/W1-10-r2/kritik-reach.mjs`, **unmodified**, 0.20 m →
5.00 m at 0.05 m, one fight per cell, both sub-probes (C1 blade with root motion suppressed, C2
threat with it on):

```
ACCEPTANCE
 non-contiguous C1 (HARD FAIL if any): []        (round 2: SPR, AXE, HLB)
 non-contiguous C2 (HARD FAIL if any): []        (round 2: SPR, AXE, HLB)
 reach_min > 0.60 m (FAIL if any)    : []        (round 2: AXE 0.85, GHM 0.80, HLB 1.00, MCE 0.75, SPR 1.40)
```

Round 2's eleven weapons with a hole in the middle of their reachable band, and the five classes
that could not hit a man standing against them, are gone. **A spear now hits a man standing
1.4 m in front of it**, and the browser agrees: `spr_drowned_harpoon` hits at every 0.10 m step
from 0.60 m to 2.60 m with no interior gap.

**Provenance, stated exactly.** The acceptance block above is the complete 14-class run on the
build carrying `_bladeLength` with the arc gain still solved against the registry capsule length.
A second full run on the final build (the joint solve of §3) was launched and the box is heavily
contended; at the time of writing it has returned AXE, CGS, CSW, DGR and FST, **all
`contig=true`, `gaps=[]`, `min 0.2`**, agreeing class for class. `reports/W1-10-reach-s26.json`
is that run's output and a reader should prefer it once it exists. The contiguity claim also has
an independent witness that ran to completion on the final build: **deletion-test case 2** (§6),
which reproduces the interior hole on demand by removing the fix and finds none with it in.

The residual, which the fix does **not** close:

```
 |threat_m - (reach + root dz)| > 0.10 m : TSW -0.60  GSW -0.52  UGS -0.40  GHM -0.39
                                          SPR -0.38  CGS -0.30  HLB -0.23  MCE -0.18
                                          CSW -0.13  SSW -0.13          -> 10 of 14 classes
 threat_m spread (need >= 3.0 m)        : 2.8
```

Every one of those is a *shortfall* — the weapon threatens less ground than it declares, never
more. §4 is why, and §7F is why the 3.0 m spread requirement may not be reachable from
`RI-WPN02` §B's own columns in any case.

The mechanism, unchanged from what round 3 shipped earlier: `socketsFor()` returns
`a = GRIP_OFFSET_M` so the hit capsule runs **grip → tip**. `hitbox_span_m` keeps a consumer — it
is now the *edged* span, returned as `edge_from`, and a contact inboard of it deals the class's
`haft_damage_mult`. An axe still only really hurts at the head; it no longer has a hole where its
handle is.

---

## 3. Blade length is a property of the weapon, not of the animation

**Found by this round's own instrument, and it was a hard fail nobody had measured.**

`tools/weapons/fingerprint.mjs` recomputes `SEP` on the repaired measure. It read **0.7205**,
against RI-WPN03 §D.2's `SEP < 1.0` **HARD FAIL**. Decomposing `W_max`:

```
W_max pair: cgs_kings_crescent / cgs_mire_scythe   distance 1.8114
  D5 (reach) contributes 2.634 of the 3.28 squared total — 80%
```

The five curved greatswords all declare `reach_m` 2.75. Their `r1.1` tips swept horizontal radii
of **1.30, 1.55, 1.57, 2.11 and 2.12 m** — an 0.82 m spread inside one class, produced by nothing
but which animation each happened to borrow. `socketsFor()` took the blade length from
`clip.capsuleLength`, and **clips are shared**, so a weapon's blade changed length depending on
what it was swinging.

`MovesetLibrary._bladeLength(weaponId)` now solves the socket-B distance **once per weapon**, so
that the tip's maximum horizontal radius from the actor's own root across the lead slot's active
window equals the weapon's declared `reach_m` — `BAR-CRITIQUE-W1-10-R1` §R4's definition of blade
reach, root translation suppressed by construction. Closed-form `radius(b)` from two rig
evaluations per frame, a 240-step scan for the outer crossing and a 40-step bisection; fixed
length, deterministic, cached.

**It has to be solved jointly with the arc.** Solving the yaw gain against the registry capsule
length and then *playing* the clip at the calibrated one cost **21.12%** arc nonconformance over
606 clips against a 7.26% baseline. `_yawGain` now takes the blade length and keys its cache on
it, and `_bladeLength` builds its own pass-1 clip so there is no cycle. Two fixed-length passes.
Arc nonconformance returns to **7.59%**.

**The cost, stated:** longer blades move faster tips. Socket pose steps over 1.00 m went 31 → 73
of 606, and tip speed over 1.25× the band to 43.9%. The *bone* pose measure — which is the
quantity RI-WPN05 §E.2's row actually names — is 13.37%.

---

## 4. The blade points into the ground — tried, measured, reverted

This is the single biggest remaining player-facing defect, and round 3 **failed to fix it**.

`skeleton.json` §`weapon.blade_axis_note`: *"The blade runs along the grip hand's local -Y."* So
the blade's world direction is entirely the hand's pose, and measured across the active window of
a **horizontal** sweep the hand leaves it **35–41° below horizontal**:

```
cgs_drowned_reaper r1.1, widest active frame:  hand y  0.87 m   tip y  -1.88 m   (under the floor)
hlb_garrison_bill  r1.1, widest active frame:  hand y  0.87 m   tip y  -0.75 m
```

A person occupies roughly 0.2–1.7 m of height. A blade angled 40° into the ground leaves that band
about a metre from the hand **however long it is** — which is why the round-2 verdict measured
*"the halberd's blade reaches 1.45 m against a declared 2.865 m"*, and why lengthening the blade
cannot fix it.

The attempt: `swing.js calibrateBladePitch`, a solved presentation offset on the pitch chain,
targeting blade inclination `= −plane_deg` at the widest active frame — the definition
`plane_deg` already carries in that file's own header. It worked on the inclination and it wrecked
everything else:

| over 606 clips | before | with presentation |
|---|---|---|
| arc nonconforming (±10°) | 7.26% | **40.43%** |
| socket pose teleports > 1.00 m | 31 | **118** |
| tip speed over 1.25× band | ~44% | **60.56%** |

**Reverted.** A note is left at the site so the next attempt does not repeat it. The defect needs
the arm pose reworked — the pitch chain's shares, the extension curve and the twist together —
not a scalar bolted onto the existing chain. This is filed as the round's largest open gap (§8).

Its footprint is visible in the numbers this round did not close: `|threat_m − (reach + root Δz)|`
exceeds the 0.10 m tolerance on **10 of 14** classes (worst TSW −0.60, GSW −0.52, UGS −0.40,
GHM −0.39, SPR −0.38) and the `threat_m` spread is 2.8 m against a ≥3.0 m requirement.

---

## 5. The headline numbers, recomputed on the repaired measure

`node tools/weapons/fingerprint.mjs` → `reports/W1-10-fingerprint.json`.

**The instrument, repaired per `BAR-CRITIQUE-W1-10-R1` §R1**, at both scales:

* `D5` is z-normalised over the **14 melee classes only**, and BOW's cell is substituted with the
  melee mean before the 15-class vector is built;
* the same substitution is applied to the five BOW rows of the **87-weapon `F87`** from which
  `SEP`, `W_min`, `W_med` and `W_max` are computed — the ruling names `D_min` and `SEP` as having
  been read off the broken column, so neither r1's `D_min = 1.629` nor its `SEP = 1.4469` is
  carried forward;
* `Dg` is the **nine** `GRAMMAR_DIMS` over the 14 melee classes, with G7/G8/G9 walked link by link
  on the rig;
* the **observed** column takes `D5`, `D6`, `D7` and G7–G9 from the rig and `D12` from
  `impact.js`. The r2 critic held `D12` at a constant 4 because the impact model had no consumer;
  it is now a real per-class measurement.

| # | Number | r1 published | r2 observed | **r3 observed** | Bar | |
|---|---|---|---|---|---|---|
| 1 | `D_min` | 1.629 *(broken measure)* | 1.3934 | **1.6392** (AXE–MCE) | ≥ 1.6 | **PASS** |
| | `D_med` | — | 4.3396 | **4.4149** | ≥ 3.2 | PASS |
| | classes with no neighbour < 1.6 | — | 10 / 15 | **15 / 15** | ≥ 13 | PASS |
| 2 | `Dg_min` (9 dims, 14 melee) | — | 1.5981 | **1.5511** (SPR–HLB) | ≥ 1.0 | PASS |
| | `Dg_med` | — | — | **4.1865** | — | |
| 4 | `SEP` | 1.4469 *(broken measure)* | NOT RUN | **1.3858** | ≥ 1.4 | **below bar by 0.014** |
| | `B_min` / `W_max` | — | — | 1.3781 / 0.9945 | — | |
| | `W_min` | — | — | **0.1525** | ≥ 0.20 | **below bar** |
| | `W_med` | — | — | **0.5450** | 0.35–1.00 | PASS |
| | `chain_shape_count ≥ 2` | — | — | **8 / 14** | ≥ 7 | PASS |
| | `chain_arc_range ≥ 20°` | — | — | **8 / 14** | ≥ 10 | **FAIL** |

The declared column is reported beside it in the JSON and is diagnostic only: `D_min` 1.6390,
`Dg_min` 1.5241, `SEP` 1.4729.

**`SEP` 1.3858 is reported below bar rather than tuned onto it, and the trade is named.** Before
the joint arc/blade solve of §3 it read **1.4605**, a pass — but that build had 21.1% of its 606
clips sweeping an arc outside ±10° of their declaration, because the gain was solved against one
blade length and the clip was played at another. Solving them together took arc nonconformance to
7.6% and cost 0.075 of `SEP` and two classes of `chain_arc_range`. **Arc conformance was chosen**,
because `arc_sweep_deg` *is* fingerprint dimension D6 and grammar dimension G3, so a roster whose
clips do not sweep what they declare has a fingerprint built on a column the animation ignores —
which is the round-2 verdict's own §"Bar pressure" #3. Both builds' numbers are recorded here so
the trade is auditable rather than asserted; `SEP` is 0.014 short and it is 0.386 above its hard
fail.

**`Dg_min` against the bar critic's witness.** The witness is 1.4445 at a floor design; this
roster measures **1.5511 observed** and **1.5241 declared** on the same nine dimensions. The
ruling holds and round 2's refusal to curve-fit is vindicated a second time — the number was never
the roster's problem, and the repaired instrument says so twice.

**`W_min` 0.1525 is below bar and is named:** `bow_chitin_recurve` / `bow_marsh_longbow` are the
closest pair in the game. Not a hard fail (that is 0.05), and not closed this round.

---

## 4b. Regression — round 2's wins are intact

Round 3 changed `socketsFor`, the arc calibration, `resolve.js`'s hit path and `system.js`'s
collision resolver. Everything round 2 earned was re-measured after those changes:

| Round 2's win | r2 | **r3** |
|---|---|---|
| `equipped_ok` | 87 / 87 | **87 / 87**, zero throws |
| weapon socket geometry sane (`grip < tip`, tip in 0.2–12 m) | — | **87 / 87** |
| `CFS` — contextual slot resolves to a distinct clip **and** a distinct frame triple | 1.0000 | **1.0000** (328 / 328 instances over ROLL, BACKSTEP, SPRINT, AIRBORNE) |
| determinism — same seed, same script, twice | identical | **identical** (event stream and final hp, byte for byte) |
| `verify-frames` — RI-WPN04 §A / RI-WPN02 §B / RI-CMB02 §B | 70/70, 75/75, 42/42 | **70/70, 75/75, 42/42 exact** |
| moveset consumption (7 perturbations of the moveset model) | 7 / 7 | still 7 / 7, now inside the 17 / 17 of §1.3 |

The browser side of this is `tools/harness/wpn-census-live.mjs`, which was re-launched and is slow
under load; the numbers above are the node arena's, and **23 distinct weapons were separately
driven through `setLoadout()` in headless Chromium in this round** — eight in the impact probe and
fifteen in the blind pack — with **0 page errors** in both.

---

## 5a. `CR` — the connect rate, and the second witness for §4

The round-2 verdict proposed a new measure in its bar-pressure section:

> **`CR` (connect rate):** the fraction of scripted `r1.1` presses that damage a stationary dummy
> at the class's own declared reach minus 0.20 m; floor **0.95**.

Built as proposed (`tools/weapons/connect-rate.mjs`, 10 presses per weapon, 82 melee weapons,
plus a `CR_band` reading — the fraction of a 0.20 m → declared-reach sweep at which the weapon
connects at all).

| | value |
|---|---|
| `CR_mean` | **0.4219** (floor 0.95) |
| `CR_min` | 0 |
| weapons below floor | **82 of 82** |
| weapons landing nothing anywhere | **0** |
| `CR_band` mean | 0.828 |

**It fails, and the shape of the failure is the finding.** Sorted by declared reach:

| class | declared reach | `CR` | `CR_band` |
|---|---|---|---|
| AXE | 1.794 | **0.833** | 1.000 |
| SSW | 2.069 | **0.817** | 1.000 |
| CSW | 1.520 | **0.790** | 1.000 |
| DGR | 0.867 | **0.760** | 1.000 |
| GSW | 2.741 | 0.615 | 0.948 |
| MCE | 1.700 | 0.597 | 0.911 |
| FST | 0.990 | 0.577 | 0.875 |
| CGS | 2.750 | 0.250 | 0.790 |
| UGS | 3.033 | 0.145 | 0.867 |
| GHM | 2.148 | 0.083 | 0.703 |
| SPR | 3.283 | 0.060 | 0.494 |
| **HLB** | 2.865 | **0.000** | 0.609 |
| **TSW** | 2.087 | **0.000** | 0.622 |
| **WHP** | 3.600 | **0.000** | 0.616 |

The short weapons connect; **the long ones do not connect at their own declared spacing at all**.
That is precisely what §4 predicts: the tip reaches the declared radius, but by then it is a metre
underground, so the only part of the capsule at a person's height is the part near the hand. `CR`
moved by 0.01 when the blade lengths were fixed (0.4321 → 0.4219), which is the cleanest possible
evidence that blade *length* was never the binding constraint on reach — blade *inclination* is.

**`CR` is a good measure and it should be adopted.** It is one line of harness work, it would have
failed this build in round 1, and it asks the question none of the nine headline numbers asks.

---

## 5b. The blind packs, generated at runtime, motion only

`BAR-CRITIQUE-W1-10-R1` §H1/§R6 makes a pack that could have been built from JSON **VOID, not
PASS**, and names round 1 as the proof: both mandatory blind tests returned PASS on a build where
`setLoadout()` rejected all 87 weapons, because the pick was a recitation of design columns with
the header removed.

`node tools/weapons/blind-pack.mjs` → `reports/w1-10-blind-r3/`. **This tool generates; it does
not score, and the builder that wrote it does not take the test.**

* **Fifteen traces** — twelve for RI-WPN03 M6 (four each from GHM, SPR, TSW: the trio the round-2
  critic separated only 10 of 12) and three for RI-WPN02 — each **1 200 frames**, each produced in
  **headless Chromium against the shipping build** by `setLoadout()` + `queueInputs()` +
  `stepFrames()`. Not the node arena. Not the moveset JSON.
* **Eleven columns and no twelfth:** `f, px, pz, yaw, ax, ay, az, bx, by, bz, target_hp`, read off
  the engine's own combat-trace record (`x.p_pos`, `x.p_yaw`, `x.sockets`, `e[].hp`) rather than
  computed by the probe. Plus the input script, which is identical for every weapon.
* **A leak assertion runs over every trace and fails the run on a match** — five patterns covering
  weapon ids, clip ids, slot ids, the declared columns (`arc_sweep_deg`, `reach_m`, `root_dz_m`,
  `motion_value`, `poise_damage`, the frame triple, `hitbox_span_m`, `weight_tier`, `max_chain`)
  and the shape vocabulary. **PASSED on all 15.**
* Labels assigned by a deterministic SHA-256 shuffle of the weapon id, so the ordering carries no
  information. The key is sealed in a separate file.
* **0 page errors.**

`PACK-SUMMARY.json` gives a reader the shape of each trace without opening one — e.g. `T2` peaks
at 3.624 m of tip radius and 200.9 m/s of tip speed while losing the dummy only 78 hp, and `T11`
reaches 3.021 m at 45.4 m/s and takes 582 hp off it. Those are two different weapons doing two
different things to the same dummy under the same 1 200 frames of input, and neither sentence
needed a design column to write.

---

## 6. The deletion test, applied to this round's own work

Three W1-09 rounds each closed their named gap by moving the defect elsewhere. `tools/weapons/
deletion-test.mjs` does to round 3 what caught them: **delete the fix, re-measure, and require the
number to go back.**

Two things about the instrument itself, because the first version of it was wrong in the way this
project keeps being wrong:

1. **`import('x.mjs?v=rand')` busts one module and leaves its transitive imports cached.** The
   first run reported three of five fixes as "deleting them changes nothing" — because the edited
   `resolve.js` and `system.js` were never re-read. Every measurement now runs in a **fresh node
   process**.
2. **A mutation that matches nothing must throw.** `withEdit` now compares before and after and
   fails the run if the deletion did not land. A deletion test whose deletion silently no-ops is
   exactly the probe that cannot fail.

**Five cases. Five survive.** `reports/W1-10-deletion-test.json`.

### Case 1 — `_bladeLength`

| | shipped | fix deleted |
|---|---|---|
| weapons within 0.10 m of their declared reach | **85 / 87** | **3 / 87** |
| worst reach error | 0.215 m | **1.354 m** |
| worst within-class reach spread | 0.537 m (BOW) | **0.823 m (CGS)** |

**REAL.** Both numbers go back, and they go back to the class the `SEP` decomposition named.

### Case 2 — `socketsFor` `a = GRIP_OFFSET_M` (S26 contiguity)

| | shipped | fix deleted |
|---|---|---|
| `spr_drowned_harpoon` 0.20 → 3.00 m | `11111111111111111111111111111` gaps `[]` | `11111111111100000000000111111` gaps **`[1.4 … 2.4]`** |
| `axe_bog_cleaver` | `11111111111111111000000000000` gaps `[]` | `11111111100111111000000000000` gaps **`[1.1, 1.2]`** |
| capsule near end, worst weapon | 0.553 m | **1.752 m** |
| weapons whose capsule starts beyond 0.60 m | **0** | **63 of 87** |

**REAL.** Deleting it puts an eleven-cell dead band back in the middle of the spear's reach — the
round-2 hard fail, reproduced on demand.

### Case 3 — `resolve.js` resolves the struck region's material

`materialAt(B, part)` replaced with the literal `'flesh'` — exactly the round-2 behaviour:

| against `mat_stone` | shipped | material lookup deleted |
|---|---|---|
| `mce_bog_iron_mace` | dmg **64.64**, material `stone`, hitstop **16 f**, victim hitstop 0, knockback **−0.20** | dmg **43.09**, material `flesh`, hitstop **8 f**, victim hitstop 12, knockback **+0.15** |
| `tsw_bog_rapier` | **DEFLECTS, dmg 0**, hitstop 15 f | **dmg 114.71**, hitstop 4 f |

**REAL.** A stone target stops being stone; the mace loses its advantage, the rapier stops
bouncing, and the knockback changes sign.

### Case 4 — hitstop holds N frames, not N−1

| | shipped | the `+ 1` deleted |
|---|---|---|
| declared `hitstop_f` | 4 | 4 |
| frames actually held | **4** | **3** |

**REAL, and exactly one frame** — the size of the defect the round-2 trace showed as
*"hitstop_f 4 held for 3 frames"*, which was a real shortfall against RI-WPN05 M1's ±0 tolerance
and not a reporting artefact.

### Case 5 — `advanceAlong`

| | shipped | fix deleted |
|---|---|---|
| `ugs_golem_sword` vs a dummy at 0.60 m | no error, 11.65 damage | **`advanceAlong is not defined`**, 0 damage |

**REAL.** The crash comes straight back.

### What the deletion test did NOT find, and that is the point

No case moved a number it was not supposed to move, and **case 2's own reading is the one that
would have caught a relocation**: had the contiguity fix worked by making the capsule longer
rather than by making it whole, the "capsule near end" row would not have moved and only the
gap vector would have. It moved by 1.20 m on the worst weapon and took 63 weapons with it.

---

## 7. Amendments filed

All in `corpus/12-weapons/AMENDMENT-W1-10-03.md`. **Nothing in that file has been applied to any
reference item, and no threshold in it is lowered.**

| § | Against | Finding |
|---|---|---|
| A | `RI-WPN05` §E / §E.2 | the 0.25 m/frame pose ceiling (15 m/s) and the peak-tip-speed band (14–40 m/s) are mutually unsatisfiable of a weapon tip |
| B | `RI-WPN02` §B WHP row | arc 200°, reach 3.60 m and frames 40/10/58 pin a tip speed of 69.3 m/s against §E's 32.5 ceiling; retiming fixes it and breaks RI-WPN04 §A's gated table, so it was reverted |
| C | `RI-WPN02` §D D6 | a horizontal-bearing arc is degenerate above a ~70° swing plane; 25 of the 44 nonconforming clips are that, and 14 more are `plunge` |
| D | `RI-WPN05` §F | `ILS`'s leave-one-out nearest-neighbour recovers **0.0000 by construction** over 35 distinct points — confirming the round-2 critic's filing, with a replacement definition |
| **E** | the r2 verdict's acceptance criterion, `ARBITRATION` §3 | **`kritik-consumption3.mjs` cannot report 6/6 on any correct build.** Four of its six probes perturb rows a flesh dummy never reads or observe quantities it does not record. Proposes a general rule: a CONSUMPTION probe whose fixture cannot read the row, or whose observation vector omits the quantity, is **VOID rather than INERT** |
| **F** | `RI-WPN02` §B / `BAR-CRITIQUE` §R4 | **the `threat_m ≥ 3.0 m` spread is 0.20 m outside what §B's own columns can produce**: declared `WHP 3.80 − FST 1.00 = 2.80`, measured 2.8. Three ways out are set out; the builder argues for measuring the spread over the weapon's whole vocabulary rather than its opener |

E and F are new this round.

---

## 8. What round 3 did not close

Named here rather than left for a critic to find.

1. **THE BLADE POINTS 35–41° INTO THE GROUND** (§4). The largest remaining player-facing defect,
   attempted and reverted with the failure measured. Everything downstream of it stays open:
   `threat_m` conformance fails on 10 of 14 classes, and the `threat_m` spread is 2.8 m — though
   §7F shows the 3.0 m requirement is itself 0.20 m outside what `RI-WPN02` §B publishes.
2. **`W_min` = 0.1525** against a 0.20 PASS bar. `bow_chitin_recurve` and `bow_marsh_longbow` are
   the closest pair of weapons in the game. Not a hard fail; not closed.
3. **`RI-WPN07`'s `RVS` is not measured.** The item is new and its method needs ten `RI-AI05`
   archetype dummies (the build has three real archetypes), a `policy-competent.json` that does
   not exist, an `H.runPolicy()` harness verb that does not exist, and 2 800 traces. It is
   reported as **not reached**, not as passing. `RI-WPN07` is the one item in this area a
   disconnected moveset layer could not have faked, and it is the right next piece of work.
4. **`RI-WPN04` M5 (situational superiority) still has never been run** — the only *quality* bar
   among the five verbs the user named, and `RI-WPN04`'s own "How we lose" #9 predicted it would
   be skipped as too expensive. It has now been skipped in three consecutive rounds, which is the
   prediction coming true.
5. **Recovery arc still exceeds active arc** on 227 of 606 clips by bearing (78 by tip path
   length). Round 3 improved the mechanism — the recovery settles near the follow-through instead
   of resetting the pose — and did not finish the job.
6. **Socket pose steps over 1.00 m: 73 of 606**, up from 31, and tip speed over 1.25× the band on
   43.9%. This is the price of the blade-length fix, and §7A argues the ceiling and the band
   cannot both be met of a weapon tip in any case.
7. **The `Chg` within-class distribution is not published**, so `BAR-CRITIQUE`'s condition 3 for
   clearing this area is unmet.
8. **`SEP` 1.3858 and `chain_arc_range ≥ 20°` 8 / 14** are both below bar and both fell when arc
   conformance was chosen over them (§5). They are a tuning problem — spreading the chain arcs
   inside classes that currently repeat one arc — not a mechanism problem, and they are the
   cheapest two numbers left on the board.

---

## 9. A hazard this round created, and how to avoid it

`tools/weapons/deletion-test.mjs` temporarily **mutates tracked source files** — that is what a
deletion test is. A concurrent agent's `git commit -a` landed **during** case 2's mutation window,
so commit `0e37ae2` captured `game/src/combat/moveset.js` with the S26 contiguity fix *reverted*:

```
HEAD:          a: Math.max(GRIP_OFFSET_M, Math.round((b - span) * 1000) / 1000),   <- the round-2 expression
working tree:  a: GRIP_OFFSET_M,                                                    <- correct
```

The working tree is right and the next commit will carry it. **Do not `git checkout` that file.**

The general rule, offered for `AGENT-PROTOCOL.md`: a tool that mutates tracked source in order to
measure the effect of removing it must either work on a copy of the tree, or run when nothing else
is committing. This one restores the file in a `finally` block and still lost the race, because
the window is milliseconds wide and a commit is atomic across the whole tree.

**A second concurrency note, for whoever reads these numbers.** While this report was being
written a concurrent agent rewrote the chain frame data of **82 of the 87 movesets** (`r1.2` and
`r1.3` startup and recovery — apparently applying `AMENDMENT-W1-10-BAR-01`'s per-class chain
multipliers, which is exactly what that amendment is for). Every headline number in §5 and the
whole of `verify-frames` were **re-run afterwards and are unchanged** — `D_min` 1.6392,
`Dg_min` 1.5511, `SEP` 1.3858, and 70/70 + 75/75 + 42/42 still exact — because the edited fields
are chain frame counts and this round's dimensions read `r1.1`, `r2` and the chain's *geometry*.
`tools/weapons/motion-census.mjs` reads those frames and its figures predate the edit.

---

## 10. Reproducing everything in this report

```
node tools/harness/smoke.mjs                       # boot, 6/6
node tools/weapons/impact-consumption.mjs          # 17/17 CONSUMED
node tools/weapons/impact-census.mjs               # RI-WPN05 M1-M4, M6
node tools/harness/wpn-impact-live.mjs             # the browser confirmation, §1.2
node tools/weapons/fingerprint.mjs                 # D_min, Dg_min, SEP, W_min/W_med, §5
node tools/weapons/motion-census.mjs               # 606 clips, §3 and §4
node tools/weapons/deletion-test.mjs               # §6 — 5/5
node tools/weapons/blind-pack.mjs                  # §5b — generates, does not score
node tools/weapons/connect-rate.mjs                # CR
node tools/weapons/verify-frames.mjs               # 70/70, 75/75, 42/42 exact
node corpus/90-verdicts/wave1/artifacts/W1-10-r2/kritik-reach.mjs        # the critic's S26 sub-probe
node corpus/90-verdicts/wave1/artifacts/W1-10-r2/kritik-consumption3.mjs # the critic's 2/6, §1.3
node corpus/80-methods/m-wpn02-dg-witness.mjs      # the bar's own Dg witness, 1.4445
```

Every instrument this builder wrote is in `tools/weapons/`. **A builder does not grade itself with
them**; they are here so a critic can break the thing they measure on purpose and watch them go
red, which is what §6 does to five of them.
