---
id: RI-WPN02
title: Weapon-class differentiation — fifteen classes and the behavioural fingerprint distance between them
kind: number
side: souls
judges: [weapon.class.taxonomy, weapon.class.differentiation, weapon.class.reach, weapon.moveset.slots, combat.weapon.identity, combat.frames.timing]
provenance: constructed
confidence: high
blind_pair: yes
---

## The bar

Picking up a different weapon must feel like being handed a **different problem**, not a
different number. A player who has spent an hour with a straight sword and then equips a
great hammer should be wrong-footed for the next five minutes: the openings they had learned
are gone, the spacing they had internalised is wrong, and the enemies that were easy are now
hard while the enemies that were hard are now easy. That reversal is the whole point of a
weapon class, and it is produced by **arc, reach, commitment and poise** — not by attack
power.

"Good" means: fifteen classes whose behaviour, measured from traces with the damage numbers
stripped out, cluster into fifteen separable groups; where at least five distinct axes of
difference are in play (timing, arc geometry, root displacement, chain grammar, hyperarmour
availability); and where no two classes can be told apart *only* by how much damage they do.
The headline number is a **behavioural fingerprint distance** computed exactly the way
RI-AI05 M1 computes it for enemy archetypes, because a project with two different statistical
methods for the same question has one method and one alibi.

Below the floor defined in §D, two weapon classes are **the same weapon with different
numbers**, and this item fails outright.

## The reference artifact

### A. The fifteen classes (`ES-CLASS/1`)

Codes are normative and are the `class` enum in `corpus/12-weapons/moveset.schema.json`.
Black Marsh dressing is flavour and carries no authority; the lore items own it.

| Code | Class | Weight tier | Role — the problem it hands the player | Black Marsh dressing |
|---|---|---|---|---|
| DGR | Dagger | light | "Can you get behind it?" — fastest startup, worst reach, best crit multiplier | knapped obsidian, root-thorn |
| SSW | Straight sword | light | The control: every other class is a deviation from this one | Imperial issue, Kothringi bronze |
| CSW | Curved sword | light | "Can you fight a crowd without a big weapon?" — wide arc, 4-chain, no thrust | Naga sickle-blade |
| TSW | Thrusting sword | light | "Can you attack from inside a guard?" — narrowest arc, longest light reach, parry class | Xanmeer needle |
| FST | Fist / claw | light | "Can you live at zero range?" — 5-chain, lowest reach, lowest poise damage | Hist-bonded talon |
| SPR | Spear | medium | "Can you win by never being reached?" — thrust from behind a shield | marsh-lance, fisher's gig |
| AXE | Axe | medium | "Can you trade once and win?" — high poise damage per stamina | shell-splitter |
| MCE | Mace | medium | "Can you fight armour and stone?" — blunt, best material bonus (RI-WPN05 §B) | bog-iron flail-head |
| WHP | Whip | medium | "Can you use a weapon with no defensive answer?" — 3.6 m, unblockable-around-shields, 6 poise damage | hide-lash, root-tendril |
| HLB | Halberd | medium | "Can you control a lane?" — sweeping reach, the widest medium arc | Dunmer garrison bill |
| GSW | Greatsword | heavy | "Can you commit?" — the first class with 2h R1 hyperarmour | Barsaebic memorial blade |
| CGS | Curved greatsword | heavy | "Can you fight three things at once?" — 340° spin, 2-chain, no thrust | reaper of the drowned |
| GHM | Great hammer | heavy | "Can you break something that will not break?" — highest poise damage in the game | Xanmeer pile-driver |
| UGS | Ultra greatsword | ultra | "Can you be right once?" — longest commitment, largest root lunge | root-golem's sword |
| BOW | Bow | ranged | "Can you answer a thing that will not come to you?" — the only class with no melee grammar | horn-and-sinew, chitin recurve |

BOW is the one class with a reduced mandatory slot table (RI-WPN01 §A, seven slots). It
exists because RI-PRG05 already prices arrows as a recurring gold sink and RI-AI05 populates
five regions with A5 RANGED and A8 CASTER enemies; without it the player has an economy for
a verb they do not have (BAR-CRITIQUE-01 rank 9).

### B. The differentiation matrix — `ES-CLASSMATRIX/1`

**Authority note.** RI-CMB02 §A/§B is authoritative for the seven rows it publishes (DGR,
SSW, SPR, AXE, HLB, GSW, UGS) and those cells are reproduced here **unchanged**, marked ⚓.
The eight new rows are this item's extension of `ES-FRAMES/1` and are marked ✚. If a cell
here ever disagrees with RI-CMB02, RI-CMB02 wins and this file is amended.

One-handed, first hit of the chain, at 60 Hz — all frame counts `f@60`.

> **REBASED — AMENDED wave 0 (rebase-s22), ARBITRATION seam S22.** Every frame column below is
> **doubled**, in lockstep with `RI-CMB02` §A/§B, which owns the seven ⚓ rows. The `↩ was` note
> at the end of each row carries the pre-rebase values. **Reach, arc sweep, motion value, poise
> damage, stamina, max chain and root displacement are not frame data and are unchanged.**
> Hyperarmour windows are **re-derived** through `[ceil(0.60 × startup), startup + active]`, not
> scaled; ⚠ marks the six windows where re-derivation and a naive ×2 differ by a frame.

| Code | ⚓/✚ | R1 startup | R1 total | R2 startup | R2 total | Reach (m) | **Arc sweep (°)** | MV R1 | Poise dmg R1 | Stamina R1 | Max chain | Root Δz R1 (m) | `r1.1` shape | 1h R2 hyperarmour |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DGR | ⚓ | **12** | **42** | **28** | **78** | 1.05 | 70 | 0.72 | 8 | 12 | 4 | 0.15 | `slash_d` | none |  ↩ *was 6/21/14/39*
| FST | ✚ | **14** | **44** | **32** | **82** | 0.90 | 45 | 0.55 | 5 | 9 | **5** | 0.10 | `smash` | none |  ↩ *was 7/22/16/41*
| CSW | ✚ | **20** | **64** | **44** | **114** | 1.75 | 155 | 0.90 | 16 | 17 | 4 | 0.30 | `slash_h` | none |  ↩ *was 10/32/22/57*
| TSW | ✚ | **22** | **66** | **46** | **110** | 2.20 | **10** | 0.95 | 12 | 16 | 3 | 0.65 | `thrust` | none |  ↩ *was 11/33/23/55*
| SSW | ⚓ | **24** | **74** | **50** | **122** | 1.95 | 110 | 1.00 | 22 | 20 | 3 | 0.35 | `slash_h` | **f30–f62** |  ↩ *was 12/37/25/61, HA f15–f31*
| SPR | ⚓ | **28** | **80** | **54** | **128** | **3.10** | **8** | 1.00 | 18 | 18 | 3 | 0.55 | `thrust` | **f33–f64** ⚠ |  ↩ *was 14/40/27/64, HA f17–f32*
| AXE | ⚓ | **32** | **92** | **60** | **146** | 1.80 | 130 | 1.15 | 28 | 24 | 3 | 0.30 | `slash_d` | **f36–f74** |  ↩ *was 16/46/30/73, HA f18–f37*
| MCE | ✚ | **34** | **96** | **64** | **156** | 1.70 | 95 | 1.20 | 32 | 25 | 3 | 0.28 | `smash` | **f39–f80** ⚠ |  ↩ *was 17/48/32/78, HA f20–f40*
| HLB | ⚓ | **38** | **108** | **68** | **168** | 2.85 | 145 | 1.25 | 34 | 28 | 3 | 0.45 | `sweep` | **f41–f84** ⚠ |  ↩ *was 19/54/34/84, HA f21–f42*
| WHP | ✚ | **40** | **108** | **60** | **148** | **3.60** | 200 | 0.80 | **6** | 22 | 3 | 0.20 | `lash` | none |  ↩ *was 20/54/30/74*
| GSW | ⚓ | **44** | **126** | **80** | **196** | 2.60 | 175 | 1.45 | 42 | 32 | 3 | 0.85 | `slash_d` | **f48–f100** |  ↩ *was 22/63/40/98, HA f24–f50*
| CGS | ✚ | **48** | **136** | **88** | **214** | 2.75 | **340** | 1.35 | 38 | 34 | **2** | 0.70 | `spin` | **f53–f110** ⚠ |  ↩ *was 24/68/44/107, HA f27–f55*
| GHM | ✚ | **52** | **148** | **96** | **232** | 2.30 | 120 | 1.60 | **52** | 38 | **2** | 0.60 | `smash` | **f58–f116** |  ↩ *was 26/74/48/116, HA f29–f58*
| UGS | ⚓ | **58** | **166** | **104** | **252** | 2.95 | 210 | 1.75 | 58 | 42 | 3 | **1.40** | `slash_v` | **f63–f128** ⚠ |  ↩ *was 29/83/52/126, HA f32–f64*
| BOW | ✚ | *draw* **48** | **92** | *aimed* **48+90** | **236** | **22.0** proj. | 0 | 0.85 / 1.35 | 4 | 14 | 1 | 0.00 | `shoot` | none |  ↩ *was draw 24 / 46 / aimed 24+45 / 118*

Derived constraints that must hold after any retune (recomputed by the critic, never trusted):

| Quantity | Requirement | Rationale |
|---|---|---|
| `recovery / startup`, R1, every melee class | ≥ **1.40** *(ratio — invariant under S22)* | RI-CMB02 §E, extended to fifteen |
| `recovery / startup`, R2, every melee class | ≥ **1.15** *(ratio — invariant under S22)* | RI-CMB02 §E |
| `active / total`, every row | ≤ **0.16** *(ratio — invariant under S22)* | RI-CMB02 §E |
| R2 startup − R1 startup, every melee class | ≥ **16 f@60** ~~8 f~~ | RI-CMB02 §E (rebased). Verified: smallest is DGR at 16 |
| R1 startup spread across the 14 melee classes | ≥ **46 f@60** ~~23 f~~ (FST 14 → UGS 58 is 44; **DGR 12 → UGS 58 is 46**) | RI-CMB02 §E (rebased). The spread is carried by DGR, exactly as before — the constraint is met on the nose, exactly as before |
| Arc sweep spread | ≥ **300°** (SPR 8 → CGS 340) *(degrees — not frame data, unchanged under S22)* | Geometry must be an axis, not a footnote |
| Reach spread, melee | ≥ **2.5 m** (FST 0.90 → WHP 3.60) | Spacing must be a build decision |
| Classes with 1h R2 hyperarmour | between **5 and 9** of 14 | Universal hyperarmour deletes the trade decision; none deletes heavy weapons |
| Distinct `r1.1` shapes across the roster | ≥ **6** of the 10 enum values | Fourteen classes all slashing is one class |

**⚠ Adjacent-startup rule, amended in scope.** RI-CMB02 §E requires ≥2 f of R1 startup
between *adjacent* classes. At seven classes that is a good separability proxy. At fifteen it
is arithmetically hostile — the ~~6→29 f~~ **12→58 f@60** window cannot hold fourteen classes at
~~≥2 f~~ **≥4 f@60** apart without inflating the spread past readability. *(AMENDED wave 0
(rebase-s22): the impossibility is a statement about ratios of separations and survives the
rebase intact — 14 gaps of ≥4 f need 56 f of range and there are 46.)* **This item therefore declares that RI-CMB02
§E's adjacent-startup rule binds the seven-class spine only**, and that separability for the
extended roster is carried by §D's fingerprint distance instead, which measures the thing the
rule was a proxy for. This is an amendment request against RI-CMB02, recorded in the reply of
the agent that wrote this file; until it is granted, a critic must score the adjacent-startup
rule against the spine seven and report the extension separately.

### C. Class-specific rules that are not numbers

| Code | Rule |
|---|---|
| DGR | Crit multiplier ×1.4 over baseline (RI-CMB05 owns the base). `r1.4` legal. |
| FST | `r1.*` alternates hands; `multi_hit: 2` on `r1.3`. Cannot be two-handed — `two_hand` equips a **second** fist and switches to a distinct 5-slot table. The one class where §B's 2h column is replaced rather than modified. |
| CSW | No `thrust` shape anywhere in its table. `roll.r2` legal (arc ≥ 120). |
| TSW | Parry-capable in the offhand (RI-WPN06 §D). Counter-damage ×1.35 against an enemy in `windup`. |
| SPR | The only melee class that may attack **through** a raised shield in the offhand without lowering it (`requires: [offhand_free]` is absent from its `r1.*`). |
| AXE | `r2` is a `slash_v` overhead, not a bigger `r1`. Poise damage per stamina point is the highest of the mediums. |
| MCE | Material multiplier applies (RI-WPN05 §B): ×1.35 vs `stone`, ×1.25 vs `chitin`, ×0.90 vs `flesh`. The only class whose damage depends on what it hits. |
| WHP | Cannot be parried. Cannot parry. Ignores shield guard-angle entirely (wraps around). `poise_damage` 6 — it will never stagger anything, which is the cost of 3.6 m. |
| HLB | `sweep` shape hits all targets in the arc (`multi_hit: 1` per target, RI-CMB02 §D.4 de-dup still applies). |
| GSW | First class with 2h `r1.*` hyperarmour (RI-CMB02 §C: f14–f30). |
| CGS | `spin` shape: 340° means the hitbox passes **behind** the player. `max_chain 2`; the second hit is a full 360°. |
| GHM | Highest poise damage in the game. `guardbreak` variant is `shoulder`, not `kick`. |
| UGS | Largest root lunge (1.40 m R1, 1.90 m R2). Two-handing is effectively mandatory: 1h requires Strength ≥ a threshold owned by RI-PRG02. |
| BOW | `bow.quick` fires from the hip in **36 f@60** ~~18 f~~ with MV 0.85; `bow.aimed` draws for up to **90 f@60** ~~45 f~~ to MV 1.60 and enters a shoulder-cam (RI-CAM04 owns the camera behaviour of aimed fire). Consumes `ammo`. No `guardbreak`. |

### D. The headline measurable — behavioural fingerprint distance

Reusing RI-AI05 M1's statistical method verbatim, so the two rosters are commensurable.

**The vector** (12 dimensions, all extracted from harness traces and the declared moveset,
never from source):

| # | Dimension | Source |
|---|---|---|
| D1 | `r1_startup` | trace |
| D2 | `r1_recovery / r1_startup` | trace |
| D3 | `r2_startup − r1_startup` | trace |
| D4 | `max_chain_len` | trace (mash probe) |
| D5 | `reach_m` — distance at which `r1.1` first connects with a dummy | trace (reach sweep) |
| D6 | `arc_sweep_deg` — total angular travel of the hitbox capsule across the active window | trace (hitbox records) |
| D7 | `root_dz_r1` | trace (position deltas) |
| D8 | `motion_value_r1` | declared + damage-implied |
| D9 | `stamina_r1` | trace (`stamina` delta) |
| D10 | `poise_damage_r1` | trace (dummy `poise_cur` delta) |
| D11 | `hyperarmour_slot_fraction` — slots of the mandatory 25 with `hyperarmour.enabled` | declared + trace-confirmed |
| D12 | `hitstop_flesh_f` | trace (RI-WPN05 §A) |

**The computation:**

```
1. For each of the 15 classes, run the standard probe (§ Comparison method M1) and
   build the 12-vector.
2. Z-normalise each dimension across the 15 classes (mean 0, sd 1, population sd).
3. For every unordered pair (i, j), D(i,j) = Euclidean distance in R^12.
4. D_min = min over all 105 pairs.   <-- THE HEADLINE NUMBER
5. D_med = median over all 105 pairs.
```

| Threshold | Value | Meaning |
|---|---|---|
| **`D_min ≥ 1.6`** | **PASS** | Every pair of classes is a different problem |
| `1.0 ≤ D_min < 1.6` | Below bar | Two classes are close enough that a player would not reliably notice the swap; name the pair and remedy it |
| **`D_min < 1.0`** | **HARD FAIL** | Two classes are **the same weapon with different numbers**. The item fails regardless of every other check. |
| `D_med ≥ 3.2` | required alongside | A roster can have one good separation and be mush elsewhere |
| `≥ 13 of 15` classes with no neighbour closer than 1.6 | required | Two borderline classes are a tuning job; three are a design failure |

**Anti-gaming clause — the shape-only distance.** D5, D8, D9, D10 and D12 all scale with
weapon weight, so a roster that varies *only* mass passes on correlated dimensions. Compute a
second distance `Dg` over the **grammar dimensions only** — D4 (chain length), D6 (arc),
D7 (root displacement), D11 (hyperarmour fraction), D2 (recovery ratio) — z-normalised
independently.

| Threshold | Value | Meaning |
|---|---|---|
| **`Dg_min ≥ 1.0`** | **PASS** | Classes differ in *grammar*, not just in mass |
| **`Dg_min < 0.5`** | **HARD FAIL** | The roster is one weapon on a weight slider |

`Dg` is the check that catches the most likely honest failure: a competent team building
fifteen genuinely different-feeling *numbers* and one animation philosophy.

## Comparison method

Script: **`corpus/80-methods/m-wpn02-class-fingerprint.mjs`**

**M1 — The standard class probe.** For each of the 15 classes, using the class **baseline
weapon** (the one with `baseline_ref: null`) at upgrade **+0**, on the `wave-standard-build`
fixture at region-entry level (fixture pinning per BAR-CRITIQUE-01 W8):
```js
await H.setSeed(1337); await H.loadState('wpn-dummy-arena');
// A: frame census — single R1, single R2, from idle, one-handed
// B: mash probe — 'light' every 8 frames for 600 frames (chain length + termination)
//    [AMENDED wave 0 (rebase-s22): was every 4 frames for 300; the probe must outlast the
//     rebased UGS R2 at 252 f@60]
// C: reach sweep — teleport to 0.6 m, step out in 0.05 m increments, single R1 each,
//    record the largest distance at which an `events[].type == 'hit'` fires
// D: arc sweep — read every hitbox record across the active window, compute the total
//    angular travel of the capsule's midpoint about the player's Y axis
// E: hitstop — frames between the `hit` event and the next change in `anim_frame`
```
Emit one `elder-souls/trace@1` file per class per sub-probe; all 75 traces go in the run
directory and are cited in the verdict by `run_id`.

**M2 — Fingerprint distance.** Build the 12-vector per class, z-normalise, compute all 105
pairwise distances. Then repeat over the five grammar dimensions for `Dg`.
- Report the full 15×15 distance matrix, `D_min`, `D_med`, `Dg_min`, and the identity of the
  closest pair.
- Apply §D's thresholds. **`D_min < 1.0` or `Dg_min < 0.5` is a hard fail of the item.**

**M3 — Matrix conformance.** Diff every measured cell against §B.
- **FAIL** any frame count off by ≥1 f, reach off by >0.10 m, arc off by >10°, root Δz off
  by >0.05 m, motion value off by >0.02, poise damage off by >1.
- **FAIL** the item if >2 of 15 classes fail conformance.

**M4 — Derived-constraint recomputation.** Recompute every row of §B's constraints table
from M1's census, not from the declared data.
- **FAIL** on any violated row. These are ratios and spreads; they cannot be satisfied by
  accident.

**M5 — Shape census.** From the declared movesets, count distinct `r1.1` shapes and confirm
each matches the observed hitbox geometry: `thrust` ⇒ arc < 20°, `spin` ⇒ arc > 300°,
`sweep`/`slash_h` ⇒ 90°–200°, `smash`/`slash_v` ⇒ arc < 130° with root Δz < 0.7.
- **FAIL** any class whose declared shape and measured arc disagree. A weapon labelled
  `thrust` that sweeps 140° is mislabelled data, and mislabelled data is how a critic gets
  lied to without anyone lying.

**M6 — The wrong-footing probe (the player-facing version of D_min).** Script an identical
30-second combat sequence against one A1 INFANTRY dummy — the same input script, frame for
frame — once per class. Record hits landed, hits whiffed, damage taken, stamina bottom-outs.
- **PASS** if the outcome distribution across the fifteen classes has a coefficient of
  variation ≥ 0.35 on hits-landed and ≥ 0.40 on damage-taken.
- **FAIL** if any two classes produce identical hit/whiff sequences. Identical inputs
  producing identical outcomes with different weapons means the weapon is not in the loop.

**M7 — Determinism.** All of M1 at five seeds; footers must match (HARNESS.md §8 D5).

### Harness extensions this method requires

1. `player.hitboxes[].angle_deg` — the capsule midpoint's yaw about the player's Y axis, per
   active frame. Without it, D6 (arc sweep) must be reconstructed from world positions and a
   yaw, which is lossy and disputable.
2. `player.hitstop_f: int` in the frame record — frames of hitstop currently applied.
3. A `weapon` block in the frame record: `{class, weapon_id, stance, upgrade}`. Today the
   trace does not say what the player is holding.
4. Scenario `wpn-dummy-arena` (shared with RI-WPN01).
5. `getPlayerStats()` must include `equipped: {right, left, ammo}`.

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M2 fingerprint distance (`D_min`, `D_med`) | 25 | `D_min ≥ 1.6`, `D_med ≥ 3.2`, ≥13 clean classes |
| M2 grammar distance (`Dg_min`) | 15 | `Dg_min ≥ 1.0` |
| M3 matrix conformance | 20 | ≤2 classes failing |
| M4 derived constraints | 15 | All nine rows hold |
| M5 shape census | 10 | ≥6 distinct shapes; every declared shape matches its measured arc |
| M6 wrong-footing probe | 15 | CV thresholds met; no identical outcome pairs |

Max 100.

| Native | Verdict band |
|---|---|
| ≥ 85 | Meets the bar |
| 62–84 | Below bar — named remedy required |
| < 62 | Loses outright |

**Native-to-ladder mapping (SCORING.md §1.2 / BAR-CRITIQUE-01 W7):**

| Ladder | Native score |
|---|---|
| 4 | 62 |
| 6 | 75 |
| 8 | 90 |

**Hard fails regardless of score:**
- `D_min < 1.0` — two classes are the same weapon with different numbers.
- `Dg_min < 0.5` — the roster is one weapon on a weight slider.
- Fewer than 12 melee classes present at all.
- Any class whose `arc_sweep_deg` is 0 while its shape is not `thrust` or `shoot` — a hitbox
  that does not travel is a trigger volume, not a swing (RI-CMB04).
- Reach measured from a fixed radius rather than from the weapon's bone chain (all classes
  share a reach).
- Any class stat that varies with player level (ARBITRATION S9 / AR-1).

**Blind pair:** hand the critic three unlabelled 20-second traces from three classes, with
weapon names, clip names and all damage numbers stripped, and ask it to describe three
different fighting styles. If it cannot distinguish them, we lose — regardless of what
`D_min` said. (This is BAR-CRITIQUE-01's proposed RI-CMB11 blind test, adopted verbatim.)

## How we lose

1. **Fifteen classes, one animation rig.** One `attack` clip retimed by `mixer.timeScale`,
   with reach as a capsule length parameter. Every fingerprint dimension that is not a scalar
   collapses; `Dg_min` lands near 0.2. This is the single most likely outcome of a naive
   Three.js build and the reason `Dg` exists.
2. **Differentiation by damage.** The team varies motion value, poise damage and stamina —
   the three easiest numbers — and leaves arc, root motion, chain length and hyperarmour
   identical. `D_min` may pass on correlated mass dimensions while the game feels like one
   weapon. `Dg_min` is the only check that fires.
3. **Arc sweep is never implemented.** The hitbox is a static capsule in front of the player,
   enabled for the active frames. Then CGS's 340° spin does not exist, HLB cannot control a
   lane, WHP has no reason to be in the game, and D6 is a constant column — which
   z-normalises to NaN and should be reported as such rather than dropped.
4. **Reach as a number, not as geometry.** `if (dist < weapon.reach) hit()`. The spear's 3.1 m
   then hits through a pillar, and M1's reach sweep passes while RI-CMB04's swept-volume test
   fails. Reach must be a consequence of the bone chain, and the two items must be run
   together.
5. **The bow is cut in scope review.** It is the most expensive class (projectiles, ammo,
   aim camera, a whole second input mode) and the least visible. Cutting it re-opens
   BAR-CRITIQUE rank 9 and leaves A5 RANGED with no answer, which RI-WPN01 M5 hard-fails.
6. **Whip and fist are cut as "gimmicks".** They are the two classes carrying the extremes of
   the reach spread; without them the spread requirement fails and the roster compresses into
   "small sword, big sword, pointy stick".
7. **Two-handing folded into class identity.** UGS is "the two-handed one" and GSW is "the
   one-handed one", so the 2h table is authored once and shared. RI-WPN06 owns this failure;
   here it shows up as D11 being bimodal instead of graded.
8. **Chain length uniform at 3.** The easiest field in the table to leave alone. FST's 5 and
   CGS/GHM's 2 are the only things making D4 a real dimension, and a build that "simplifies"
   them turns a 12-dimensional fingerprint into an 11-dimensional one without telling anyone.
9. **Mace's material multiplier never lands** because the material system in RI-WPN05 §B is
   not built. MCE then differs from AXE by four small numbers and becomes the pair that sets
   `D_min`. The critic should expect AXE–MCE and GSW–CGS to be the two closest pairs and
   should look at them first.
10. **Retuning to pass.** Someone reads `D_min = 1.3`, finds the closest pair, and widens one
    number until it reads 1.6. The `Dg` check, the `D_med` requirement and the M6
    wrong-footing probe exist together so that the cheapest fix is not the passing fix.

## Provenance note

`provenance: constructed`, confidence **high**. The fifteen-class taxonomy, the codes, every
✚ frame cell, all arc-sweep values, reach values, root displacements, chain lengths, the
twelve fingerprint dimensions and every threshold in §D are **defined for this project**. No
FromSoftware source publishes a fingerprint metric, an arc-sweep table, or these class
boundaries; none of these numbers is a measurement of any shipped game.

Seven rows (⚓) are reproduced unchanged from RI-CMB02 §A/§B, which is itself `constructed`.
The statistical method in §D is RI-AI05 M1's, adopted deliberately and without modification
beyond the dimension list, so that "fingerprint distance" means one thing in this corpus.

Grounding is `community-data`, confidence **medium**:
- Elden Ring's community motion-value data is organised as ~40 weapon classes covering 400+
  weapons, with *"each weapon class hav[ing] their own uniform motion values for each of
  their attacks, with some outliers"* — i.e. class is the unit of moveset identity and
  within-class outliers are the exception, which is exactly the structure §A and RI-WPN03
  encode ([Motion Value — Eldenpedia](https://eldenring.wiki.gg/wiki/Motion_Value);
  [Motion Values Viewer — Tarnished Traveler](https://tarnishedtraveler.com/elden-ring-motion-values-viewer/)).
- Straight swords are documented as *"mostly slashes, with thrusts on every odd one-handed
  heavy attack, light rolling attack, every third dual wield attack, and dual wield backstep
  attacks"* — a class whose identity is a *pattern of shapes across slots*, not a damage
  band. That observation is why `shape` is a required per-slot field rather than a per-weapon
  one ([Straight Swords — Elden Ring Wiki, Fextralife](https://eldenring.wiki.fextralife.com/Straight+Swords)).
- Hyperarmour in Dark Souls 3 is reported as available on *"Ultra Greatswords, Great Hammers,
  2-handed Greatswords and certain weapon arts"*, with active poise on UGS / great hammer /
  greataxe R1s, two-handed greatsword R1s, and fully charged R2s; per-class poise multipliers
  are cited by the community as ×1.0 for greatswords and ×1.5 for halberds. That distribution
  — hyperarmour concentrated in the heavy end, arriving first on two-handed R1s, and always
  present on a fully charged R2 — is the qualitative shape §B's hyperarmour column and
  RI-WPN01 §C.4 encode; the numbers themselves are ours
  ([Poise — Dark Souls 3 Wiki, Fextralife](https://darksouls3.wiki.fextralife.com/Poise);
  [Hyper armor and how it works — Steam Community](https://steamcommunity.com/app/374320/discussions/0/1333474229077569339)).

Cross-dependencies: RI-CMB02 wins on the ⚓ rows and on the readability contract; RI-CMB04
wins on hitbox geometry and therefore on how D6 is measured; RI-CMB05 wins on hyperarmour
semantics; RI-PRG02 owns the Strength threshold referenced in §C UGS; RI-PRG08 owns upgrade
levels and the +0 pin in M1; RI-CAM04 owns the aimed-fire camera. The two extensions this
item makes to RI-CMB02 — the eight ✚ rows, and the scope amendment to §E's adjacent-startup
rule — are **amendment requests**, not unilateral changes, and are recorded as such.
