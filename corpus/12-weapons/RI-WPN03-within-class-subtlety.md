---
id: RI-WPN03
title: Within-class subtlety — how much two weapons of the same class are allowed to be the same
kind: number
side: souls
judges: [weapon.identity.withinclass, weapon.animation.reuse, weapon.class.differentiation, combat.weapon.identity]
provenance: constructed
confidence: high
blind_pair: yes
---

## The bar

This is the item the user asked for by name: *"each weapon has a subtly unique attack pattern
and unique set of animations."* The word doing the work is **subtly**. Two straight swords
must both be straight swords — same stance, same rhythm, same family of arcs, same place in
the player's mental model — and must still not be the same object in the hand. One is a
half-step longer in the thrust. One's third light attack is a rising cut instead of a
horizontal, so it catches a rolling enemy the other misses. One's heavy is a shoulder-level
stab you can throw from behind a shield. None of those differences is a number in a tooltip;
all of them change which enemy you would rather be holding it against.

The failure this item exists to detect has a name and a shape: **"forty weapons, three
animations."** It is the single most common way a game with a large weapon list turns out to
have three weapons. It is also the cheapest failure to *ship*, because the data looks correct
— forty JSON files, forty names, forty stat blocks — and the deficit lives entirely in the
clip-id column, which nobody reads.

"Good" means: a class has a shared baseline moveset that makes the class legible; **every**
weapon in the game deviates from its baseline on at least four slots, at least one of which
is an animation clip that no other weapon in the game uses; no clip is shared by more than
four weapons; and no two weapons anywhere have the same moveset. The within-class distances
must be small — that is the *subtlety* — but they must never be zero, and the ratio between
the smallest between-class distance and the largest within-class distance is what proves the
classes are still classes.

## The reference artifact

### A. The weapon census — `ES-WEAPONS/1`

Eighty-seven weapons. The counts are binding as a **minimum per class**; the total may grow,
but no class may shrink below its row, because a class with two weapons cannot demonstrate
within-class subtlety at all.

| Class | Weapons | Baseline weapon (the `baseline_ref: null` one) | Signature weapons (≥6 unique clips) |
|---|---|---|---|
| DGR | 6 | knapped shell-knife | 1 |
| SSW | 8 | Imperial garrison sword | 2 |
| CSW | 6 | Naga sickle-blade | 1 |
| TSW | 5 | Xanmeer needle | 1 |
| FST | 4 | wrapped fists | 1 |
| SPR | 7 | fisher's gig | 1 |
| AXE | 6 | shell-splitter | 1 |
| MCE | 6 | bog-iron mace | 1 |
| WHP | 4 | hide-lash | 1 |
| HLB | 6 | garrison bill | 1 |
| GSW | 8 | Barsaebic memorial blade | 2 |
| CGS | 5 | reaper of the drowned | 1 |
| GHM | 5 | pile-driver | 1 |
| UGS | 6 | root-golem's sword | 1 |
| BOW | 5 | horn-and-sinew bow | 1 |
| **Total** | **87** | 15 | **16** |

Names are placeholders owned by the lore items (RI-LOR04 naming conventions); the **counts**
are this item's.

A **signature weapon** is one authored with ≥6 unique clips — a weapon that plays noticeably
differently inside its own class and is worth seeking out. Every class must have **exactly
one or two**. Zero means the class is a stat ladder; three or more means "unique" has stopped
meaning anything and the class has fragmented.

### B. The inheritance model

```
class baseline weapon   ->  authors all 25 mandatory slots.  baseline_ref: null
other weapon in class   ->  baseline_ref: <baseline weapon_id>
                            inherits clip ids slot-by-slot,
                            then OVERRIDES specific slots.
```

An override is one of two kinds, and both count:

> **AMENDED wave 0 (rebase-s22), ARBITRATION seam S22.** This item states few frame figures of
> its own — it defines *divergence* thresholds against `RI-WPN02`/`RI-CMB02` frame data, which
> S22 doubled. **The frame-valued thresholds here are separation bars and are doubled with it;
> the arc-sweep degrees, reach metres, root-displacement metres and every ratio are unchanged.**
> Each rebased cell is marked inline.


| Kind | What changes | Cost to author | Counts toward |
|---|---|---|---|
| **Clip override** | `anim` points at a new clip with `anim_owner == this weapon` | high (an animator makes a clip) | `UNQ` and `DEV` |
| **Parameter override** | same clip, but ≥1 of: `startup_f`/`active_f`/`recovery_f` differing by **≥6 f@60** ~~≥3 f~~ *(AMENDED wave 0 (rebase-s22): a separation bar against rebased frame data)*; a different `shape`; a different `chains_to`; `hyperarmour.enabled` flipped; `arc_sweep_deg` differing by ≥25°; `root_dz_m` differing by ≥0.15 m | low | `DEV` only |

A change to `motion_value`, `poise_damage`, `stamina`, damage type or scaling is **not an
override**. Those are the numbers; this item is about everything else. A weapon whose only
difference from its baseline is its stat block has `DEV = 0` and fails.

### C. The required deviations (`ES-SUBTLE/1`)

Per weapon, over its class's mandatory slots — 25, **23 for CGS and GHM**, 7 for BOW
*(amended wave 1, `BAR-CRITIQUE-W1-10-R1` §R3)*:

| Symbol | Definition | Requirement |
|---|---|---|
| `UNQ` | slots whose clip is used by **this weapon only** in the entire game | **≥ 1** for every weapon; **mean ≥ 2.0** across the roster; **≥ 6** for a signature weapon |
| `DEV` | slots differing from the class baseline by a clip or parameter override | **≥ 4** for every non-baseline weapon |
| `DEV_id` | of those, slots on the **identity list** — `r1.1`, `r1.3`, `r2`, `art.1`, `2h.r2` | **≥ 1** for every non-baseline weapon |
| `SHARE(c)` | number of weapons using clip `c` | **≤ 4** for every clip in the game, **and every one of them in the same class** *(scope added wave 1, `BAR-CRITIQUE-W1-10-R1` §R2)* |
| `VEC(w)` | the 25-tuple of clip ids for weapon `w` | **all 87 must be distinct** — zero collisions |
| `CLIPS(k)/N(k)` | distinct clips in class `k` ÷ weapons in class `k` | **≥ 1.6** |

`DEV_id ≥ 1` is the clause that stops the cheap satisfaction: a team under time pressure will
deviate on `plunge`, `backstep.r1` and `jump.r2` — the three slots nobody looks at — and
leave the light attack, the heavy attack and the weapon art identical across the class. The
identity list is the five slots a player actually spends the game inside.

### D. The headline measurable — the animation reuse index and the separation ratio

**D.1 Animation Reuse Index.**

```
S_total = sum over all weapons of (its class's mandatory slot count)
        = 72*25 + 10*23 + 5*7 = 2065
          # 23 for CGS and GHM: r1.3 / 2h.r1.3 are conditional on max_chain >= 3
          # (RI-WPN01 §A as amended wave 1, BAR-CRITIQUE-W1-10-R1 §R3)
C       = number of distinct clip ids across all movesets
ARI     = C / S_total
```

> ### AMENDED wave 1 by `BAR-CRITIQUE-W1-10-R1` §R2 — `AMENDMENT-W1-10-CRITIC-01` Defect 1, adopted
>
> The defect is upheld and the arithmetic was re-derived independently. §C caps `SHARE(c) ≤ 4`;
> §A fixes the census at fifteen classes of 4–8 weapons; `RI-WPN01` §A fixes the mandatory slot
> count. **`C_min = Σ mandatory_k·⌈N_k/4⌉ = 550 + 92 + 14 = 656`** (the amendment computed 664
> against a flat 25-slot table; the chain-2 ruling in §R3 takes CGS and GHM to 23), so
> `ARI ≥ 0.3177` on any roster obeying this item's
> own sharing cap — and the published `0.26` PASS bar was *always true* while the published
> `0.19` HARD FAIL was *unreachable*. The item's headline number could not fail. The
> `0.171` "perfect sharing" reference point assumed one moveset per class, which is exactly the
> arrangement `SHARE(c) ≤ 4` forbids: the two sections were written against each other.
>
> **One correction to the amendment's premise, which strengthens rather than weakens it.**
> `C_min = 664` assumes sharing is confined *within* a class. Nothing in §C said so — `SHARE`
> was defined over the whole game — so a roster could legally have put a dagger and an ultra
> greatsword on one clip and driven the true floor down to `⌈S_total/4⌉ = 517`, `ARI = 0.2504`.
> That would have been a grotesque design and a passing number. The `SHARE` scope is therefore
> tightened to **within-class** in §C, which is what everyone assumed and nobody wrote, and it
> is what makes the 656 floor — and therefore the replacement bands — real.

| Scenario | `C` | `ARI` | Reading |
|---|---|---|---|
| **The `SHARE ≤ 4` floor** — every class shares as hard as §C permits | 656 | **0.318** | "eighty-seven weapons, twenty-six movesets". The cheapest roster this item's own rules allow. ~~Perfect sharing — one moveset per class, `C` 357, `ARI` 0.171~~ *(struck wave 1: forbidden by §C's own `SHARE` cap)* |
| Perfect uniqueness — every weapon authors every slot | 2065 | **1.000** | Impossible to author and undesirable: classes stop being legible. |

| Threshold | Value | Meaning |
|---|---|---|
| **`ARI ≥ 0.42`** | **PASS** | ≈2.1 authored clips per weapon above the **SHARE-capped** floor of 0.318 |
| `0.35 ≤ ARI < 0.42` | Below bar | Deviation exists but is token |
| **`ARI < 0.33`** | **HARD FAIL** | At or below the floor `SHARE(c) ≤ 4` already guarantees — the sharing cap is doing all the work and nobody authored anything. **This is "forty weapons, three animations."** |
| **`ARI > 0.60`** | **Below bar — the opposite failure, and it is a FAIL, not a warning** | Classes have fragmented; a player cannot form a class-level expectation. RI-WPN02's `D_min` will still pass and the game will still feel incoherent. |

> **On the request to downgrade the over-fragmentation bar to a warning — REJECTED.**
> `AMENDMENT-W1-10-02` §D asked for this on the ground that its remedy (share more clips) is in
> direct tension with *"the `UNQ ≥ 4` and `DEV_id > 0` bars two subsections away"*. There is no
> `UNQ ≥ 4` bar: §C requires `UNQ ≥ 1` per weapon, `mean UNQ ≥ 2.0`, and `DEV ≥ 4` — and `DEV`
> is satisfied by parameter overrides that cost no clips at all. The floors force `ARI` to
> roughly **0.32–0.35**; the fragmentation bar sits at 0.60. The claimed tension is 0.25 wide
> and does not exist, and the shipped W1-10 roster proves it empirically: `ARI = 0.4547` with
> `UNQ` mean 3.70 and zero weapons at `DEV_id == 0`, satisfying both sets of bars at once with
> a quarter of the range to spare. **`WEAPON-CRITIC` §1 corollary 3 is binding — "subtly
> unique" is two-sided, and this is the only bar in the area enforcing the second side.**
> Downgrading it would leave the corpus able to demand more difference and never the right
> amount, which is the failure that charter names.

**D.2 The separation ratio.** Recompute RI-WPN02 §D's 12-dimensional fingerprint, but
z-normalised across all **87 weapons** rather than across 15 class baselines (call this
space `F87`, and its distances `d`).

```
B_min = min d(w1, w2) over pairs in DIFFERENT classes     # between-class floor
W_max = max d(w1, w2) over pairs in the SAME class        # within-class ceiling
W_min = min d(w1, w2) over pairs in the SAME class        # within-class floor
W_med = median d over same-class pairs
SEP   = B_min / W_max
```

| Threshold | Value | Meaning |
|---|---|---|
| **`W_min ≥ 0.20`** | **PASS** | No two weapons in the game are behaviourally identical |
| **`W_min < 0.05`** | **HARD FAIL** | Two weapons are the same weapon |
| **`W_med ∈ [0.35, 1.00]`** | **PASS** | The subtlety band. Below 0.35 the differences are invisible; above 1.00 they are not subtle, they are a class split |
| **`SEP ≥ 1.4`** | **PASS** | Classes are further apart than their members are — the taxonomy holds |
| **`SEP < 1.0`** | **HARD FAIL** | Some pair of weapons from different classes is closer than some pair from the same class. The class system does not exist as a behavioural fact. |

`W_med ∈ [0.35, 1.00]` is the numeric statement of the user's word **subtly**, and it is a
two-sided bar on purpose. This corpus is much better at demanding *more* difference than at
demanding *the right amount*, and "every weapon is a snowflake" is a real way to lose an
eighty-seven-weapon roster.

### D.3 The chain grammar distance — `Chg`

*Added wave 1 by `BAR-CRITIQUE-W1-10-R1` §R2, on `AMENDMENT-W1-10-CRITIC-01` Defect 2.*

**The diagnosis is upheld.** Both existing fingerprints are built from `r1.1` and from
per-weapon scalars. `max_chain_len` is the only dimension that looks past the first hit and it
is one integer taking three values, so two weapons whose entire chain after the first swing is
identical are invisible to every number in this area. That is the tenth-hour failure, and it is
what the user's phrase **"attack pattern"** actually names.

**The instrument filed with it is not adopted.** `Rh` was defined as recovery/startup ratios per
link plus inter-link frame gaps. `RI-CMB02` §C's chain multipliers are **class-uniform**
(hit 2: startup ×0.78, recovery ×1.05; hit 3: recovery ×1.35), so for any conforming build every
`Rh` ratio component is `r1_recovery/r1_startup` times a constant — a rescaling of a dimension
`Dg` already has — and every gap component is a linear function of `r1_startup`, measuring
**−0.97 correlated with startup** across the fourteen melee classes. Adding `Rh` to
`GRAMMAR_DIMS` would have re-imported the single most mass-correlated quantity in the corpus
into the distance that exists to strip mass out, raising `Dg_min` by ~0.14 while contributing
no new grammar information. Both refinements proposed against it are correct in principle and
are carried into the replacement below. The `Rh_min < 0.03` hard fail is **rejected outright**,
not deferred; the reasoning is in §R2 of the ruling.

**The replacement.** For each weapon, form the chain grammar vector from the **measured**
records of its standing chain `r1.1 … r1.max_chain` — hitbox capsule geometry, root track and
swing plane, never the declared JSON:

```
Chg(w) = [ arc_sweep_deg(r1.i)      for i in 1..max_chain ]
      ++ [ root_dz_m(r1.i)          for i in 1..max_chain ]
      ++ [ shape_class(r1.i)        for i in 1..max_chain ]     # one-hot over the 10 shapes
      ++ [ swing_plane_deg(r1.i)    for i in 1..max_chain ]     # inclination of the hitbox
                                                                 # sweep plane from horizontal
```

padded to the roster's longest chain **with the weapon's own last declared link**, not with its
`r1.1` — padding with the opener makes every short-chain weapon look like a weapon that repeats
itself, so the padding rather than the weapon would carry the distance. Z-normalise each
component across the 87 and compute pairwise distances exactly as §D.2 does.

| Threshold | Value | Meaning |
|---|---|---|
| **`Chg_med` within class ∈ [0.30, 1.10]`** | **PASS** | The subtlety band, applied to the sentence rather than to the word |
| **`Chg_min` within class ≥ 0.15** | **PASS** | No two weapons of a class have the same chain |
| `Chg_min` within class < 0.15 | Below bar — **name the pair and remedy it** | Not a hard fail. Wave 1 publishes the measured distribution; a hard fail may be set in wave 2 **from that distribution**, and not by analogy with anything |

**Why this shape and not the frame one.** A chain is a sequence of *shapes*, and this item's own
worked example says so: *"`r1.3` is a rising cut (`slash_v`, arc 95°) rather than horizontal:
catches a rolling enemy the baseline whiffs."* That is a difference in what the swing does, and
`Chg` measures it. A rhythm vector would have scored that weapon **identical** to its baseline —
it changes no frame — and would have hard-failed the class for it. Any measure that punishes a
roster for authoring animation instead of nudging frames has inverted this area's thesis
(`WEAPON-CRITIC` §1 corollary 1).

**`Chg` is also where BOW is honest about itself.** BOW's chain is one link, so `Chg` is all
padding and its within-class distances are structurally zero for all five bows. BOW is therefore
**excluded from `Chg`** and its within-class identity is carried by `UNQ`, `DEV` and `VEC`
alone. A threshold that fires on a class by construction is not measuring that class.

### E. Worked example — the SSW class, showing what compliance looks like

| Weapon | `baseline_ref` | `UNQ` | `DEV` | `DEV_id` | The deviation, in one sentence |
|---|---|---|---|---|---|
| Imperial garrison sword | *null* | 3 | — | — | The baseline. Its `r1.*` is the reference rhythm for the whole game. |
| Kothringi bronze sword | garrison | 1 | 4 | 1 | `r1.3` is a rising cut (`slash_v`, arc 95°) rather than horizontal: catches a rolling enemy the baseline whiffs. |
| Marsh-guard shortsword | garrison | 1 | 5 | 1 | **4 f@60** ~~2 f~~ faster on every `r1.*`, 0.15 m less reach, `r1.4` legal — the closest thing to a dagger that is still a straight sword. |
| Barsaebic warblade | garrison | 2 | 6 | 2 | `r2` is a two-hit thrust-then-slash (`multi_hit: 2`); `2h.r2` gains hyperarmour the class otherwise lacks. |
| **Oath of the Drowned** *(signature)* | garrison | **7** | 9 | 3 | An entirely authored 1h chain: `r1.1` thrust, `r1.2` horizontal, `r1.3` overhead — the only straight sword that opens with a thrust, so it fights inside a shield. |
| **Hist-sap blade** *(signature)* | garrison | **6** | 8 | 2 | `art.1` is a committed **124 f@60** ~~62 f~~ lunge; `roll.r1` is a spinning low cut with 340° arc (unchanged — degrees) that no other SSW has. |
| Fen-warden's sword | garrison | 1 | 4 | 1 | Longest SSW at 2.15 m; `run.r1` is a leaping thrust with root Δz 1.30 m. |
| Rusted levy sword | garrison | 1 | 4 | 1 | Slower recovery on every slot (**+8 f@60** ~~+4 f~~), heavier hitstop tier — the "bad" sword that is genuinely different rather than genuinely worse. |

Class totals: `UNQ` sum 22 across 8 weapons (mean 2.75), `CLIPS(SSW)/N(SSW)` = 22 + 25
shared ÷ 8 = **5.9** (well above 1.6), 2 signature weapons, `VEC` all distinct.

## Comparison method

Script: **`corpus/80-methods/m-wpn03-within-class.mjs`**

**M1 — Static clip census (no browser).** Parse every file in
`game/data/combat/movesets/*.json`.
- Build the multiset of `(weapon_id, slot_id, anim, anim_owner)`.
- Compute `C`, `S_total`, `ARI`; `UNQ`, `DEV`, `DEV_id` per weapon; `SHARE(c)` per clip;
  `CLIPS(k)/N(k)` per class; and the `VEC` collision list.
- Report the clip-share histogram (how many clips are used by 1, 2, 3, 4, 5+ weapons) — it is
  the single artifact that makes the failure visible at a glance and must be pasted into the
  verdict.
- Apply §C and §D.1 thresholds.
- **HARD FAIL** on `ARI < 0.33`, on any `VEC` collision, on any `SHARE(c) > 4`, on any clip
  shared **across classes**, or on any weapon with `UNQ == 0`. *(Bands and sharing scope
  amended wave 1, `BAR-CRITIQUE-W1-10-R1` §R2.)*
- **FAIL** on `ARI > 0.60` — the fragmentation failure. It is a fail, not a warning.

**M2 — Clip integrity (the anti-forgery check).** A clip id is only meaningful if two slots
sharing an id genuinely play the same animation and two slots with different ids genuinely
differ. For every clip id, drive one slot that uses it in the harness and record the
per-frame root track and the per-frame hitbox capsule positions across the full animation.
- **FAIL** if two *distinct* clip ids produce root tracks matching within 0.01 m on every
  frame **and** hitbox paths matching within 0.02 m — the ids are cosmetic and `ARI` is a
  fiction. Report the count of such forged-unique pairs; **HARD FAIL** if it exceeds 10% of
  `C`.
- **FAIL** if two slots sharing one clip id produce *different* tracks — the data is lying in
  the other direction.

> **M2b — the normalised-shape check. AMENDED wave 1 (`BAR-CRITIQUE-W1-10-R1` §R5, hole H4).**
> M2 as written compares root tracks and hitbox paths **in absolute metres**, which two clips
> that are *the same curve at a different size or a different speed* pass trivially — a
> `mixer.timeScale` retime and a uniform scale defeat it by construction, and that is precisely
> the "fifteen classes, one animation rig" failure `RI-WPN02` §"How we lose" #1 names. The W1-10
> critic found this, went past the item, and built the missing check; the finding landed in a
> verdict and never reached the item, which is the *stalled correction* drift the intent
> charter §6 names. It is now part of the method:
>
> Resample every clip's root track and hitbox path to **32 points**, normalise each for both
> **duration and amplitude**, and cluster.
> - Report distinct **speed profiles** and distinct **path shapes** at 2%, 5% and 10%
>   tolerance, against the clip count `C`.
> - **FAIL** if distinct normalised path shapes at 10% tolerance are fewer than **0.20 × C** —
>   at that point the roster is a small number of curves rescaled, whatever the ids say.
> - This runs on the real rig via `H.getClipTrack(clipId)` and cannot be satisfied by editing
>   data. Reference measurement, W1-10: 1 133 clips → 331 distinct path shapes at 10%
>   (`0.29 × C`), 0 forged-unique pairs. That is the number a later roster must not fall below.

This check is the one that decides whether every other number in this item means anything. A
critic that skips it has measured a spreadsheet.

**M3 — The `F87` fingerprint.** Run RI-WPN02 M1's standard probe for **all 87 weapons** at
+0 on the `wave-standard-build` fixture. Build the 12-vector each, z-normalise across the 87,
compute all 3 741 pairwise distances.
- Report `B_min`, `W_min`, `W_med`, `W_max`, `SEP`, and the identity of the pair setting each.
- Apply §D.2 thresholds. **HARD FAIL** on `W_min < 0.05` or `SEP < 1.0`.
- Also report the within-class `W_med` per class; **FAIL** any class outside [0.30, 1.15]
  individually, and **FAIL** the item if >3 classes are outside.

**M4 — Identity-list audit.** For each non-baseline weapon, confirm `DEV_id ≥ 1` by diffing
its `r1.1`, `r1.3`, `r2`, `art.1`, `2h.r2` against the baseline's.
- **FAIL** the weapon on `DEV_id == 0`.
- **FAIL** the item if >15% of weapons fail, and report the per-class rate — a class where
  every weapon fails is a class nobody authored.

**M5 — Signature-weapon audit.** Count weapons with `UNQ ≥ 6` per class.
- **FAIL** any class with 0 or with >2.

**M6 — The blind clustering test.** Generate 20-second combat traces for 12 weapons: four
from one class, four from a second class, four from a third. **AMENDED wave 1
(`BAR-CRITIQUE-W1-10-R1` §R6): the pack must be generated through the runtime a player uses —
`setLoadout()` plus an input script in the live simulation — and must carry no design columns.
Strip weapon names, clip names, class codes, all damage/scaling numbers, and also
`arc_sweep_deg`, `reach_m`, `root_dz_m`, `shape` and every declared frame field.** What remains
is per-frame motion: player and weapon-tip world positions, hitbox capsule poses, target state,
input stream. In W1-10 this test passed 2/2 on a build in which not one of the 87 movesets could
be equipped, because the pack was a JSON file with its header removed; a blind test that passes
when the artifact is unreachable is void, and scores 0 rather than PASS. Hand the critic the twelve traces and ask it to
(a) sort them into three groups and (b) within each group, rank the four by how different
they feel from each other.
- **PASS** if the three-way grouping is exactly correct **and** the critic can name a
  concrete behavioural difference for at least 3 of the 6 within-group pairs it is asked
  about.
- **FAIL** if the grouping is correct but no within-group difference can be named. That is
  precisely "the class is real, the weapons are not" — the exact failure the user named, and
  the reason this test has two halves.
- **FAIL** if the grouping is wrong (that is RI-WPN02's failure surfacing here).

**M7 — Determinism.** M3 at five seeds; footers must match.

### Harness extensions this method requires

1. `player.anim` must carry the **clip id**, not a friendly name, and must be stable across
   runs (already implied by `elder-souls/trace@1` but not stated).
2. A `H.getClipTrack(clipId)` query returning the clip's root track and per-frame hitbox
   capsule poses, so M2 can compare clips without playing all 500+ of them in real time.
   Without it M2 costs ~40 minutes of harness time per wave and will be skipped, which is
   worse than not having the check.
3. `weapon` block in the frame record (shared request with RI-WPN02).

## Scoring

| Check | Weight | Pass condition |
|---|---|---|
| M1 clip census / `ARI` | 22 | `0.42 ≤ ARI ≤ 0.60`, no `VEC` collision, no `SHARE > 4`, no cross-class sharing, every weapon `UNQ ≥ 1` |
| M2 clip integrity | 12 | ≤10% forged-unique pairs; no same-id divergence |
| **M2b normalised-shape census** | **8** | Distinct normalised path shapes at 10% ≥ `0.20 × C` |
| M3 `F87` fingerprint | 22 | `W_min ≥ 0.20`, `W_med ∈ [0.35, 1.00]`, `SEP ≥ 1.4` |
| **D.3 `Chg` chain grammar** | **12** | `Chg_min` within class ≥ 0.15; `Chg_med` ∈ [0.30, 1.10] |
| M4 identity-list audit | 12 | ≥85% of weapons with `DEV_id ≥ 1` |
| M5 signature audit | 4 | Every class has 1–2 |
| M6 blind clustering | 8 | Correct grouping **and** nameable within-group differences |

Max 100. *(Weights re-cut wave 1 by `BAR-CRITIQUE-W1-10-R1` to seat M2b and `Chg`.)*

| Native | Verdict band |
|---|---|
| ≥ 85 | Meets the bar |
| 60–84 | Below bar — named remedy required |
| < 60 | Loses outright |

**Native-to-ladder mapping (SCORING.md §1.2 / BAR-CRITIQUE-01 W7):**

| Ladder | Native score |
|---|---|
| 4 | 60 |
| 6 | 74 |
| 8 | 90 |

**Hard fails regardless of score:**
- `ARI < 0.33` — forty weapons, three animations *(amended wave 1; the old `0.19` could not
  fire on any roster obeying this item's own `SHARE` cap)*.
- Any `VEC` collision — two weapons with the identical moveset.
- Any clip shared by >4 weapons, **or by weapons of more than one class**.
- Distinct normalised path shapes at 10% tolerance below `0.20 × C` (M2b) — the roster is a
  handful of curves rescaled.
- **Any figure in this item reported from `movesets/*.json` alone, with no demonstrated
  world-side consumer** (ARBITRATION §3 CONSUMPTION). `ARI`, `SEP`, `W_min` and `Chg` computed
  against a runtime that cannot equip the weapons are `unmeasurable ⇒ 0`.
- Any weapon with `UNQ == 0`.
- `W_min < 0.05` — two weapons behaviourally identical.
- `SEP < 1.0` — the class taxonomy is not a behavioural fact.
- >10% forged-unique clip pairs in M2 — the clip ids are decorative.
- **Any class with zero signature weapons *and* `CLIPS(k)/N(k) < 1.6`** — that class was
  never authored, only populated.

## How we lose

1. **Eighty-seven JSON files, fifteen movesets.** The default outcome. Content generation
   produces names, damage numbers, weights and scaling grades for eighty-seven weapons in an
   afternoon; producing four animation overrides each takes months. `ARI` lands at 0.171 to
   three decimal places, which is the tell that nobody overrode anything.
2. **Deviating only where it is cheap.** Every weapon gets its four `DEV`s on `plunge`,
   `jump.r2`, `backstep.r1` and `2h.roll.r1`. `DEV` passes; the player never sees a single
   one of them. `DEV_id` is the counter and it is the reason the identity list is exactly
   five slots long.
3. **Fake clip ids.** Someone realises `ARI` is measured from clip ids and generates
   `clip_ssw_r1_1_variant_b` … `variant_h` pointing at the same asset. M2 exists for this and
   it is the only check in the item that cannot be satisfied by editing data.
4. **Parameter overrides used as a substitute for clips.** A weapon whose four `DEV`s are all
   ±3 f frame nudges is legal by `DEV` and contributes nothing to `UNQ`, so the `UNQ ≥ 1`
   floor and the `mean ≥ 2.0` requirement are what actually buy animation work. Expect
   pressure to relax exactly those two numbers, and expect the argument to be "the frame data
   is different, so it *is* a different attack".
5. **Signature weapons eating the budget.** Two heavily authored weapons per class, and the
   other five inherit everything. `UNQ ≥ 1` *per weapon* is a floor, not an average, for this
   reason; a roster can hit `mean UNQ = 2.0` with sixteen signatures and seventy-one clones.
6. **Class fragmentation.** The over-correction. Every weapon gets six unique clips, `ARI`
   climbs past 0.55, and the player can no longer form the expectation "straight swords do
   this" — which was the thing that made a new straight sword legible in the first place.
   `W_med ≤ 1.00` and the `ARI > 0.55` band are the only guards; both are easy to argue away
   because more work looks like more quality.
7. **The class with four weapons that are all the baseline.** WHP and FST have the smallest
   counts and the least glamour. They will be the classes where `CLIPS(k)/N(k)` is 1.0, and
   the per-class `W_med` report exists so a critic sees it rather than seeing the healthy
   roster-wide median.
8. **Upgrade levels standing in for identity.** "The weapons are different — this one scales
   with Dexterity." Scaling grades are explicitly excluded from `DEV` in §B, and a critic
   should expect this to be the first counter-argument offered.
9. **The baseline weapon being the best weapon.** If the baseline out-performs every override
   in its class, nobody uses the authored variants and the within-class work is invisible in
   play. Not measured here (RI-PRG08 and the balance items own it), but a critic should note
   it, because a passing `ARI` with a dominant baseline is a technically-correct failure.
10. **Nobody re-runs M2 after an art pass.** Clip integrity drifts when animations are
    re-exported and two clips converge. The check is cheap only if the harness extension in
    §Comparison method is built; if it is not, this item silently degrades into M1, which is
    the check that can be forged.

## Provenance note

`provenance: constructed`, confidence **high**. The eighty-seven-weapon census, the
inheritance model, the `UNQ`/`DEV`/`DEV_id`/`SHARE`/`VEC` definitions, the identity list, the
Animation Reuse Index and every threshold in §C and §D are **defined for this project**. The
0.171 sharing floor and the 1.000 uniqueness ceiling are arithmetic consequences of the
census and the 25-slot mandatory table, not observations of any game.

Grounding is `community-data`, confidence **medium**, and it is unusually direct for this
corpus because the failure mode is one players complain about in their own words:

- Elden Ring's weapon classes are documented as sharing a base moveset, with *"consistent
  attack values across multiple moves"* per class and individual weapons carrying unique
  variations — the two-layer structure §B encodes
  ([Straight Swords — Elden Ring Wiki, Fextralife](https://eldenring.wiki.fextralife.com/Straight+Swords);
  [Motion Value — Eldenpedia](https://eldenring.wiki.gg/wiki/Motion_Value)).
- Dark Souls' own wiki states the position plainly: *"every weapon has a moveset, and some
  weapons share similar movesets while others have one or more attacks that are completely
  unique"* ([Moveset — Dark Souls Wiki, Fandom](https://darksouls.fandom.com/wiki/Moveset)).
- The complaint that motivates the `UNQ ≥ 1` floor is a real one, recorded about a shipped
  game that is otherwise the reference: of the Knight's Greatsword two-handed light combo,
  players write that *"it's sad that it's only on two swords out of a weapon class with over
  20 weapons"* ([Greatswords — Elden Ring Wiki, Fextralife](https://eldenring.wiki.fextralife.com/Greatswords);
  [Elden Ring weapon moveset discussion](https://www.aoeah.com/news/1123--elden-ring-weapon-moveset-tier-list--top-10-best-weapon-with-unique-movesets)).
  Two authored variants in a twenty-weapon class is a ratio of 0.10; this item's floor of
  `UNQ ≥ 1` **for every weapon** is therefore deliberately stricter than the reference, and
  that is a choice, not an inference. It is affordable here only because our roster is 87
  weapons rather than 400.

Cross-dependencies: RI-WPN02 owns the class taxonomy, the 12-dimensional vector and the
between-class thresholds; RI-WPN01 owns the 25-slot mandatory table that sets `S_total`;
RI-LOR04 owns every weapon name in §A and §E; RI-PRG08 owns upgrade paths and is why upgrade
level is excluded from `DEV`. If the weapon census in §A conflicts with a content-budget
sheet produced under BAR-CRITIQUE-01 G7, the budget sheet wins and this table is amended
downward — but the **per-class minimum of 4 weapons and the `UNQ ≥ 1` floor are not
negotiable against budget**, because a class below either is a class that cannot demonstrate
the property this item exists to measure.
