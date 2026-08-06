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

| Kind | What changes | Cost to author | Counts toward |
|---|---|---|---|
| **Clip override** | `anim` points at a new clip with `anim_owner == this weapon` | high (an animator makes a clip) | `UNQ` and `DEV` |
| **Parameter override** | same clip, but ≥1 of: `startup_f`/`active_f`/`recovery_f` differing by ≥3 f; a different `shape`; a different `chains_to`; `hyperarmour.enabled` flipped; `arc_sweep_deg` differing by ≥25°; `root_dz_m` differing by ≥0.15 m | low | `DEV` only |

A change to `motion_value`, `poise_damage`, `stamina`, damage type or scaling is **not an
override**. Those are the numbers; this item is about everything else. A weapon whose only
difference from its baseline is its stat block has `DEV = 0` and fails.

### C. The required deviations (`ES-SUBTLE/1`)

Per weapon, over the 25 mandatory slots (7 for BOW):

| Symbol | Definition | Requirement |
|---|---|---|
| `UNQ` | slots whose clip is used by **this weapon only** in the entire game | **≥ 1** for every weapon; **mean ≥ 2.0** across the roster; **≥ 6** for a signature weapon |
| `DEV` | slots differing from the class baseline by a clip or parameter override | **≥ 4** for every non-baseline weapon |
| `DEV_id` | of those, slots on the **identity list** — `r1.1`, `r1.3`, `r2`, `art.1`, `2h.r2` | **≥ 1** for every non-baseline weapon |
| `SHARE(c)` | number of weapons using clip `c` | **≤ 4** for every clip in the game |
| `VEC(w)` | the 25-tuple of clip ids for weapon `w` | **all 87 must be distinct** — zero collisions |
| `CLIPS(k)/N(k)` | distinct clips in class `k` ÷ weapons in class `k` | **≥ 1.6** |

`DEV_id ≥ 1` is the clause that stops the cheap satisfaction: a team under time pressure will
deviate on `plunge`, `backstep.r1` and `jump.r2` — the three slots nobody looks at — and
leave the light attack, the heavy attack and the weapon art identical across the class. The
identity list is the five slots a player actually spends the game inside.

### D. The headline measurable — the animation reuse index and the separation ratio

**D.1 Animation Reuse Index.**

```
S_total = sum over all weapons of (mandatory slot count)      # 82*25 + 5*7 = 2085
C       = number of distinct clip ids across all movesets
ARI     = C / S_total
```

Two reference points fix the scale:

| Scenario | `C` | `ARI` | Reading |
|---|---|---|---|
| Perfect sharing — each class authors one moveset, every weapon inherits it whole | 357 | **0.171** | "eighty-seven weapons, fifteen movesets". Every stat is different and nothing else is. |
| Perfect uniqueness — every weapon authors every slot | 2085 | **1.000** | Impossible to author and undesirable: classes stop being legible. |

| Threshold | Value | Meaning |
|---|---|---|
| **`ARI ≥ 0.26`** | **PASS** | ≈2.1 unique clips per weapon above the sharing floor |
| `0.20 ≤ ARI < 0.26` | Below bar | Deviation exists but is token |
| **`ARI < 0.19`** | **HARD FAIL** | **This is "forty weapons, three animations."** The roster is at or below the pure-sharing floor; the weapon list is a stat table. |
| `ARI > 0.55` | Below bar (the opposite failure) | Classes have fragmented; a player cannot form a class-level expectation. RI-WPN02's `D_min` will still pass and the game will still feel incoherent. |

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

### E. Worked example — the SSW class, showing what compliance looks like

| Weapon | `baseline_ref` | `UNQ` | `DEV` | `DEV_id` | The deviation, in one sentence |
|---|---|---|---|---|---|
| Imperial garrison sword | *null* | 3 | — | — | The baseline. Its `r1.*` is the reference rhythm for the whole game. |
| Kothringi bronze sword | garrison | 1 | 4 | 1 | `r1.3` is a rising cut (`slash_v`, arc 95°) rather than horizontal: catches a rolling enemy the baseline whiffs. |
| Marsh-guard shortsword | garrison | 1 | 5 | 1 | 2 f faster on every `r1.*`, 0.15 m less reach, `r1.4` legal — the closest thing to a dagger that is still a straight sword. |
| Barsaebic warblade | garrison | 2 | 6 | 2 | `r2` is a two-hit thrust-then-slash (`multi_hit: 2`); `2h.r2` gains hyperarmour the class otherwise lacks. |
| **Oath of the Drowned** *(signature)* | garrison | **7** | 9 | 3 | An entirely authored 1h chain: `r1.1` thrust, `r1.2` horizontal, `r1.3` overhead — the only straight sword that opens with a thrust, so it fights inside a shield. |
| **Hist-sap blade** *(signature)* | garrison | **6** | 8 | 2 | `art.1` is a committed 62 f lunge; `roll.r1` is a spinning low cut with 340° arc that no other SSW has. |
| Fen-warden's sword | garrison | 1 | 4 | 1 | Longest SSW at 2.15 m; `run.r1` is a leaping thrust with root Δz 1.30 m. |
| Rusted levy sword | garrison | 1 | 4 | 1 | Slower recovery on every slot (+4 f), heavier hitstop tier — the "bad" sword that is genuinely different rather than genuinely worse. |

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
- **HARD FAIL** on `ARI < 0.19`, on any `VEC` collision, on any `SHARE(c) > 4`, or on any
  weapon with `UNQ == 0`.

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
from one class, four from a second class, four from a third. Strip weapon names, clip names,
class codes, and all damage/scaling numbers. Hand the critic the twelve traces and ask it to
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
| M1 clip census / `ARI` | 25 | `ARI ≥ 0.26`, no `VEC` collision, no `SHARE > 4`, every weapon `UNQ ≥ 1` |
| M2 clip integrity | 20 | ≤10% forged-unique pairs; no same-id divergence |
| M3 `F87` fingerprint | 25 | `W_min ≥ 0.20`, `W_med ∈ [0.35, 1.00]`, `SEP ≥ 1.4` |
| M4 identity-list audit | 15 | ≥85% of weapons with `DEV_id ≥ 1` |
| M5 signature audit | 5 | Every class has 1–2 |
| M6 blind clustering | 10 | Correct grouping **and** nameable within-group differences |

Max 100.

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
- `ARI < 0.19` — forty weapons, three animations.
- Any `VEC` collision — two weapons with the identical moveset.
- Any clip shared by >4 weapons.
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
