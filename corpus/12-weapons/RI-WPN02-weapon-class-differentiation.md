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

> ### The `Reach (m)` column, defined — AMENDED wave 1 by `BAR-CRITIQUE-W1-10-R1` §R4
>
> The ambiguity is real and it was live: the column was used both as a blade length and as an
> effective reach, while M1 sub-probe C measured *the largest distance at which a hit fires*,
> which necessarily includes the attacker's own root lunge. On UGS those two readings differ by
> **1.40 m** — larger than M3's ±0.10 m conformance tolerance by a factor of fourteen, so the
> item would have failed a correct build, or been "fixed" by shrinking a blade. Ruling:
>
> 1. **`Reach (m)` is blade reach**: the maximum distance from the attacker's **root at the
>    frame the attack starts** to the far end of the swept hit volume, **with root translation
>    suppressed** (`H.setRootMotion(false)`, or by subtracting the measured root delta at the
>    contact frame). It is a property of the bone chain, and it must stay independent of
>    `Root Δz`, which is a separate published column and a separate fingerprint dimension. A
>    reach that silently contains the lunge would make D5 and D7 partially the same number.
> 2. **`threat_m = Reach (m) + Root Δz R1 (m)`** is the player-facing spacing figure and is
>    **derived, never authored**. It is what the player actually learns, and it is what the
>    encounter designers must read. The melee `threat_m` spread must be **≥ 3.0 m**
>    (FST 1.00 → WHP 3.80; UGS reaches 4.35).
> 3. **S26 binds here.** Reach is measured **live, at contact range, against a stationary
>    target**, never inferred from this table; the reachable band must be **contiguous**; and
>    the **minimum** reaching distance must be reported alongside the maximum. UGS's 1.40 m R1
>    lunge and 1.90 m R2 lunge are the largest root translations in the game — larger than the
>    1.2 m hole S26 was written for — so this is the first place in the corpus a hitbox with a
>    hole in it should be expected. See M1 sub-probe C as amended.

> ### The `Arc sweep (°)` column governs the tip speed — ARBITRATION seam **S36**, wave 1
>
> **This column won an arbitration and a builder needs to know it did.** `RI-WPN05` §E.2 capped
> peak tip speed at 1.25× a per-weight-tier band, and tip speed is not independent of this table:
> `peak = 1.5 · arc_rad · reach_m · 60 / active_f`, so that cap was a cap on **this column**.
> **S36 rules that §B governs and §E.2's ceiling is re-derived beneath it.**
>
> The decisive measurement is against this table's own spine: at the longest active window §B's
> own `active / total ≤ 0.16` allows, **five of the fourteen melee `r1.1` cells below could not
> meet §E.2 at any tuning** — CSW 42.6 vs 25, SSW 30.6 vs 25, HLB 38.2 vs 32.5, WHP 66.5 vs 32.5,
> CGS 69.9 vs 40 m/s — and three of those five (CSW, WHP, CGS) are classes whose whole §A identity
> is a wide arc. **No cell in this table moves.** `RI-WPN05` §E's peak-tip-speed band ceases to
> bound the roster and survives only as a floor; see that item's §E/§E.2 amendment boxes.
>
> **What S36 does not give this item.** It does **not** excuse a declared arc that sits outside its
> shape's **M5** band — 603 slots currently do, and that is a mislabelling defect judged under M5 at
> the severity its consequence deserves, exactly as M5 says (*"mislabelled data is how a critic gets
> lied to without anyone lying"*). It does **not** settle §B publishing UGS as `slash_v` at 210°
> against M5's `slash_v < 130°`, which is a contradiction **inside this item** and is referred, not
> ruled. Compliance instrument: **`node tools/wpn-tipspeed-s36.mjs --gate`**.

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
| `threat_m` spread, melee | ≥ **3.0 m** *(added wave 1, `BAR-CRITIQUE-W1-10-R1` §R4)* | Blade reach and lunge are two different spacings and a player learns their sum |
| Classes with `chain_shape_count ≥ 2` | ≥ **7** of 14 *(added wave 1, §D)* | Half the roster must do something other than repeat its opening swing |
| Classes with `chain_arc_range ≥ 20°` | ≥ **10** of 14 *(added wave 1, §D)* | A chain whose every link sweeps the same arc is one attack played three times |
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
| D5 | `reach_m` — **blade reach with root translation suppressed**, per §B's Reach definition. **AMENDED wave 1 (`BAR-CRITIQUE-W1-10-R1` §R4): z-normalised over the 14 melee classes and BOW's value substituted with the melee mean before the 15-class vector is built.** BOW's 22.0 m projectile range otherwise removes 85% of this dimension's discrimination from `D_min`, `D_med`, `SEP` and `Dg` alike | trace (reach sweep, §M1 C) |
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

**Anti-gaming clause — the shape-only distance.** D8, D9, D10 and D12 all scale with
weapon weight, so a roster that varies *only* mass passes on correlated dimensions. Compute a
second distance `Dg` over the **grammar dimensions only**, z-normalised independently.

> ### AMENDED wave 1 by `BAR-CRITIQUE-W1-10-R1` §R1 — the threshold stands, the instrument did not
>
> `AMENDMENT-W1-10-02` §A demonstrated that `Dg_min ≥ 1.0` could not be reached from this
> item's own published table without a hyperarmour ladder in which the mace out-armours the
> axe. **That arithmetic was verified independently and it holds.** With the five dimensions
> as originally listed, `Dg_min` over the four pinned dimensions alone measures **0.38–0.40**
> (limiting pair SPR–TSW), the best assignment under any mass-monotone hyperarmour ordering
> is **0.92–0.93**, and the unconstrained optimum of ~1.6 requires exactly the absurdity the
> builder described.
>
> **The ruling is that the pass bar is not what was wrong.** `1.0` is the number that
> separates "these are different grammars" from "these are the same grammar" and it is not
> moved. Three defects in the *dimension set* were what made it unreachable, and all three
> are repaired below:
>
> 1. **Reach was misclassified as a mass dimension and excluded.** Measured across the 14
>    melee classes, `reach_m` correlates with weight tier at **0.586** and with `stamina_r1`
>    at **0.556** — the *weakest* correlation of everything `Dg` excludes (motion value 0.889,
>    poise damage 0.873, stamina 0.935). This item's own §"How we lose" #4 says *"Reach must
>    be a consequence of the bone chain"* — i.e. reach is **geometry, not mass**, and §A
>    defines four of the fifteen classes purely by spacing. Excluding the game's most
>    player-legible geometric property from the geometry distance was a category error.
> 2. **BOW was inside the z-normalisation population.** Its `22.0 m` projectile range against
>    a melee span of 0.90–3.60 m puts the reach mean at 3.57 with sd 4.98, crushing the whole
>    melee roster into a z-span of **0.542** where the melee-only span is **3.599** — a
>    **6.6×** loss of separating power on D5. This defect is **not confined to `Dg`**: D5 is
>    one of the twelve dimensions of `D_min`, and of `RI-WPN03` §D.2's `F87`, so the headline
>    `D_min`, `D_med` and `SEP` have all been reading a reach column with 85% of its
>    discrimination normalised away.
> 3. **Nothing looked past the first hit.** `AMENDMENT-W1-10-CRITIC-01` Defect 2 is upheld:
>    of the five dimensions only `max_chain_len` saw the second swing, and it is one integer
>    taking three values. The remedy adopted is **not** that amendment's `Rh` — see the ruling
>    in `BAR-CRITIQUE-W1-10-R1` §R2, which shows `Rh` is a rescaling of `r1_startup` under
>    this corpus's class-uniform chain multipliers and would have re-imported mass into the
>    anti-mass distance. The remedy is the **chain grammar** triple G7–G9 below: what the
>    chain's shapes, arcs and travel *do*, which is what the user's phrase "attack pattern"
>    names.

**`GRAMMAR_DIMS` — the nine dimensions of `Dg`,** computed over the **14 melee classes only**.
BOW is excluded by §A's own words — *"the only class with no melee grammar"* — and a class with
`arc 0`, `chain 1`, `root 0` and no hyperarmour contributes one constant-outlier row that
inflates `Dg_med` while destroying D5. BOW keeps its place in the 15-class `D` distance.

| # | Dimension | Pinned by §B? | Definition |
|---|---|---|---|
| G1 | D2 `r1_recovery / r1_startup` | **pinned** | as D2 |
| G2 | D4 `max_chain_len` | **pinned** | as D4 |
| G3 | D6 `arc_sweep_deg(r1.1)` | **pinned** | as D6 |
| G4 | D7 `root_dz_m(r1.1)` | **pinned** | as D7 |
| G5 | D5 `reach_m` | **pinned** | blade reach with root translation suppressed — see §B's Reach definition |
| G6 | D11 hyperarmour slot fraction | free | as D11 |
| G7 | `chain_arc_range` | **free** | `max − min` of measured `arc_sweep_deg` across the declared standing chain `r1.1 … r1.max_chain` |
| G8 | `chain_shape_count` | **free** | number of distinct measured `shape` classes across that chain |
| G9 | `chain_root_ratio` | **free** | `Σ root_dz_m(r1.i) ÷ (max_chain × root_dz_m(r1.1))` — does the chain advance, hold ground, or retreat |

G7–G9 are **measured from the mash probe's hitbox records and root track (M1 sub-probe B/D),
never read from the declared JSON.** They are the only free dimensions that a `sed` over
`movesets/*.json` could otherwise move, and the same discipline S26 imposes on reach applies
to them: never infer geometry from a declared value.

| Threshold | Value | Meaning |
|---|---|---|
| **`Dg_min ≥ 1.0`** | **PASS** | Classes differ in *grammar*, not just in mass |
| **`Dg_min < 0.5`** | **HARD FAIL** | The roster is one weapon on a weight slider |

Two derived constraints so the chain triple cannot be carried by one outlier class:

| Quantity | Requirement | Rationale |
|---|---|---|
| Classes with `chain_shape_count ≥ 2` | ≥ **7** of 14 | Half the roster must do something other than repeat its opening swing |
| Classes with `chain_arc_range ≥ 20°` | ≥ **10** of 14 | A chain whose every link sweeps the same arc is one attack played three times |

**Reachability witness (binding — a bar this item cannot show a passing design for is a broken
bar, and that is what §A of `AMENDMENT-W1-10-02` correctly caught).** Under the repaired
dimension set, with a hyperarmour ladder that is plainly narratable — nothing for FST/DGR/CSW,
then 2/4/6/8/8/8/10/14/16/18/20 of the mandatory 25 rising monotonically with mass through
TSW→UGS — and a chain design consistent with every §A role and every §C class rule,
`Dg_min = 1.4445` (limiting pair TSW–SPR) with `Dg_med = 4.227`. The best mass-monotone
assignment reaches 2.35. **The bar passes with room, at a design anyone can write down.**
Reach alone moves the SPR–TSW pair; the chain triple alone moves the AXE–MCE pair; neither
repair is sufficient without the other, which is why both are adopted. The witness arithmetic
is recorded in `BAR-CRITIQUE-W1-10-R1` §R1 and is executable: **`node corpus/80-methods/m-wpn02-dg-witness.mjs`**. Any retune of §B must re-run it, and if a
well-made design can no longer clear 1.0, the ruling reopens rather than the bar falling.

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
// C: reach sweep — AMENDED wave 1 (BAR-CRITIQUE-W1-10-R1 §R4), see the box below
// D: arc sweep — read every hitbox record across the active window, compute the total
//    angular travel of the capsule's midpoint about the player's Y axis.
//    Run D on EVERY link of the chain driven in B, not only on r1.1 — G7/G8/G9 are
//    read from these records.
// E: hitstop — frames between the `hit` event and the next change in `anim_frame`
```

> **Sub-probe C, as amended — the S26 form.** The old sweep started at 0.6 m, stepped
> *outward*, and recorded only *the largest distance at which a hit fires*. That instrument
> cannot see an interior gap, cannot see a minimum reaching distance, and silently folds the
> attacker's root lunge into the number — three defects, of which the first is exactly what
> S26 exists to catch and the third is what made the `Reach (m)` column ambiguous. Replace it
> with:
>
> ```js
> // C1 — blade reach (the §B column). Root motion suppressed.
> //   step the dummy out from 0.20 m to 5.00 m in 0.05 m increments, one R1 per run,
> //   record the hit/no-hit vector over the whole range.
> //   reach_m       = the largest distance at which a hit fires
> //   reach_min_m   = the SMALLEST distance at which a hit fires        <-- S26
> //   contiguous    = the hit set is one unbroken run of increments     <-- S26
> // C2 — threat sweep. Root motion ON, target stationary, same range.
> //   threat_m      = largest hitting distance; must equal reach_m + root_dz_m ± 0.10
> // C3 — body corridor (S26's positive requirement). On every frame where the attacker's
> //   root moved, sweep the attacker's body capsule previous-pose→current-pose against the
> //   target's, and confirm the same volume is used for pushing and for hitting.
> ```
>
> - **HARD FAIL** if `contiguous == false` for any class in either C1 or C2 — an interior
>   dead band is a hitbox with a hole in it (S26), and on this roster the classes to look at
>   first are UGS (1.40 m R1 lunge), GSW (0.85 m) and CGS (0.70 m).
> - **FAIL** if `reach_min_m > 0.60 m` for any melee class — a weapon that cannot hit a target
>   standing against you is the W1-09 defect in a player's hands.
> - **FAIL** if `|threat_m − (reach_m + root_dz_m)| > 0.10 m` — the lunge is not reaching, or
>   is reaching twice.
> - Report `reach_m`, `reach_min_m`, `threat_m` and the contiguity vector per class. **The
>   contiguity vector is a mandatory verdict artifact for this item**, alongside the three
>   `WEAPON-CRITIC` §3.4 already requires.

Emit one `elder-souls/trace@1` file per class per sub-probe; all traces go in the run
directory and are cited in the verdict by `run_id`.

**M2 — Fingerprint distance.** Build the 12-vector per class, z-normalise, compute all 105
pairwise distances. Then compute `Dg` over §D's **nine** `GRAMMAR_DIMS`, across the **14 melee
classes only** *(AMENDED wave 1, `BAR-CRITIQUE-W1-10-R1` §R1)*.
- Report the full 15×15 `D` matrix and the 14×14 `Dg` matrix, `D_min`, `D_med`, `Dg_min`,
  `Dg_med`, and the identity of the closest pair in each.
- Report G7, G8 and G9 per class as a table, with the source hitbox records cited — a chain
  dimension taken from the declared JSON rather than from the trace is a method deviation and
  scores 0 for those three dimensions.
- Apply §D's thresholds. **`D_min < 1.0` or `Dg_min < 0.5` is a hard fail of the item.**
- **`D5` is z-normalised over the melee classes and BOW's cell substituted with the melee
  mean** before the 15-class `D` vector is built. A verdict that normalises D5 over all
  fifteen has measured a reach column with 85% of its discrimination removed and must be
  re-run.

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

**M5b — The heavy is a different sentence, not a longer one.** *(Added wave 1,
`BAR-CRITIQUE-W1-10-R1` §R5, hole H2.)* §C states this rule for AXE alone — *"`r2` is a
`slash_v` overhead, not a bigger `r1`"* — and nothing generalised it, so a roster whose every
heavy attack is its light attack with more frames passed every check in this item. The user
named light and heavy as two of the five things a weapon must own; "present" is not the bar.
For each of the 14 melee classes, drive `r1.1` and `r2` and compare the **measured** records:

- **FAIL** the class unless `r2` differs from `r1.1` on at least one of: `shape` class;
  `arc_sweep_deg` by ≥ 30°; `root_dz_m` by ≥ 0.20 m; or the swing plane's inclination by ≥ 30°.
  Frame counts and motion value do **not** count — they are the numbers, and numbers are not
  variation (`WEAPON-CRITIC` §1 corollary 1).
- **FAIL** the item if more than **2** of 14 classes fail.
- Repeat for `2h.r2` against `2h.r1.1`; those results feed `RI-WPN06`'s `TDV` but are reported
  here, because this is where the shape data lives.

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
| M2 fingerprint distance (`D_min`, `D_med`) | 20 | `D_min ≥ 1.6`, `D_med ≥ 3.2`, ≥13 clean classes |
| M2 grammar distance (`Dg_min`) | 15 | `Dg_min ≥ 1.0` over the nine `GRAMMAR_DIMS`, 14 melee classes |
| M3 matrix conformance | 15 | ≤2 classes failing |
| M4 derived constraints | 12 | All twelve rows hold |
| M5 shape census | 8 | ≥6 distinct shapes; every declared shape matches its measured arc |
| **M5b heavy-vs-light divergence** | **10** | ≤2 of 14 classes with an `r2` that is only a longer `r1.1` |
| M6 wrong-footing probe | 12 | CV thresholds met; no identical outcome pairs |
| **M1 C — reach, minimum reach and contiguity (S26)** | **8** | Every class contiguous; `reach_min_m ≤ 0.60`; `threat_m` arithmetic exact |

Max 100. *(Weights re-cut wave 1 by `BAR-CRITIQUE-W1-10-R1` to seat M5b and the S26 reach
probe without inflating the total.)*

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
- **A non-contiguous reachable band on any class (S26) — an interior dead ring in which an
  attack pushes a target it cannot damage.** *(Added wave 1, `BAR-CRITIQUE-W1-10-R1` §R4.)*
- **Any of `D_min`, `Dg_min`, `D_med` or the G7–G9 chain dimensions reported from declared
  data rather than from a trace produced through the runtime the player uses.** A number
  computed from `movesets/*.json` with the game disconnected is `unmeasurable ⇒ 0`
  (ARBITRATION §3 CONSUMPTION). *(Added wave 1, `BAR-CRITIQUE-W1-10-R1` §R6.)*

**Blind pair:** hand the critic three unlabelled 20-second traces from three classes, with
weapon names, clip names and all damage numbers stripped, and ask it to describe three
different fighting styles. If it cannot distinguish them, we lose — regardless of what
`D_min` said. (This is BAR-CRITIQUE-01's proposed RI-CMB11 blind test, adopted verbatim.)

> **AMENDED wave 1 — `BAR-CRITIQUE-W1-10-R1` §R6. Two binding conditions on the pack.**
> This test passed in W1-10 on a build where **not one of the 87 movesets could be equipped**,
> and the recorded blind description was a recitation of the arc, reach and root columns of a
> JSON file. A blind test that passes when the artifact is unreachable is not testing the
> artifact.
> 1. **The pack must be generated through the runtime a player uses** — `setLoadout()` plus an
>    input script, in the live simulation. A pack generable with the game disconnected is
>    **void**, and the check scores 0, not "pass".
> 2. **The pack must not contain the design columns.** `arc_sweep_deg`, `reach_m`,
>    `root_dz_m`, `shape` and every declared frame field are **stripped**. What the critic gets
>    is what a player gets: per-frame world positions of the player, the weapon tip and the
>    hitbox capsules, the target's state, and the input stream. If a style cannot be described
>    from motion alone, the difference is in the spreadsheet and not in the hand.

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

**AMENDED wave 1 (`BAR-CRITIQUE-W1-10-R1`).** The `GRAMMAR_DIMS` set, G7–G9, the melee-only
`Dg` population, the D5 normalisation rule, the `Reach (m)` / `threat_m` split, the S26 reach
sub-probe, M5b and the two new derived constraints are **defined by that ruling** and are
`constructed`, confidence **high**: every figure in the reachability witness is reproducible by
hand from §B plus the witness's own chain table, and the three correlation figures (reach vs
mass 0.586, motion value 0.889, stamina 0.935) are computed from §B's published columns. The
`Dg_min ≥ 1.0` threshold is **unchanged** and was deliberately not moved; the ruling's position
is that a threshold reached by lowering it has stopped being a bar.

Cross-dependencies: RI-CMB02 wins on the ⚓ rows and on the readability contract; RI-CMB04
wins on hitbox geometry and therefore on how D6 is measured; RI-CMB05 wins on hyperarmour
semantics; RI-PRG02 owns the Strength threshold referenced in §C UGS; RI-PRG08 owns upgrade
levels and the +0 pin in M1; RI-CAM04 owns the aimed-fire camera. The two extensions this
item makes to RI-CMB02 — the eight ✚ rows, and the scope amendment to §E's adjacent-startup
rule — are **amendment requests**, not unilateral changes, and are recorded as such.
