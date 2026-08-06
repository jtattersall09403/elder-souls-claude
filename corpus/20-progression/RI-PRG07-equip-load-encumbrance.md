---
id: RI-PRG07
title: Equip load and encumbrance — two ratios, two rulebooks, one breakpoint table
kind: number
side: neutral
judges: [progression.equip_load, combat.dodge, world.traversal, economy.carrying, progression.fatigue]
provenance: constructed
confidence: medium
blind_pair: no
---

## The bar

Souls and Morrowind both make weight matter, and they make it matter in ways that cannot
coexist in one variable. Souls' equip load is a **discrete tier system** governing exactly
one thing — the roll — and it is deliberately blunt: cross 70% and your i-frames drop, and
nothing else in the world changes. Morrowind's encumbrance is a **continuous scalar** that
touches everything: how fast you walk, how fast your Fatigue drains, whether you can jump,
whether you can move at all when you loot one plate cuirass too many. Merge them naively and
you get the Arbitration Rule's worst outcome — a fight where the player's dodge is
continuous, mushy and dependent on how much loot is in their bag.

The reconciliation is **two ratios, cleanly separated by the fight boundary.**
**Equip Load** counts only what is *equipped*, produces four discrete roll tiers, and is the
only weight concept that exists inside `COMBAT`. **Burden** counts *everything carried*,
produces continuous penalties, and is clamped to zero effect the moment a fight starts. A
player hauling ninety kilos of looted swords walks slowly, drains Fatigue fast, is easy to
spot, and — the instant something attacks them — rolls exactly as well as they would with an
empty bag. That is Morrowind everywhere and Souls inside the fight, implemented as two
numbers instead of one compromise.

## The reference artifact

### 1. Maximum equip load

```
maxLoad = 45 + 1.50 × STRENGTH + 0.50 × ENDURANCE
```

STRENGTH governs encumbrance because RI-PRG02 folded Souls' Vitality into it (Morrowind's
ruling); ENDURANCE contributes a minor term so that a stamina build is not weightless.
Neither is soft-capped for this purpose — **equip load is the one uncapped return on
STRENGTH**, which is what makes a pure-strength build worth taking past 40.

| | END 10 | END 20 | END 30 | END 40 | END 60 | END 99 |
|---|---:|---:|---:|---:|---:|---:|
| **STR 10** | 65.0 | 70.0 | 75.0 | 80.0 | 90.0 | 109.5 |
| **STR 18** | 77.0 | 82.0 | 87.0 | 92.0 | 102.0 | 121.5 |
| **STR 25** | 87.5 | 92.5 | 97.5 | 102.5 | 112.5 | 132.0 |
| **STR 30** | 95.0 | 100.0 | 105.0 | 110.0 | 120.0 | 139.5 |
| **STR 40** | 110.0 | 115.0 | 120.0 | 125.0 | 135.0 | 154.5 |
| **STR 55** | 132.5 | 137.5 | 142.5 | 147.5 | 157.5 | 177.0 |
| **STR 70** | 155.0 | 160.0 | 165.0 | 170.0 | 180.0 | 199.5 |
| **STR 99** | 198.5 | 203.5 | 208.5 | 213.5 | 223.5 | 243.0 |

### 2. Ratio 1 — **EQUIP LOAD**: the roll tiers (Souls, inside the fight)

```
equipRatio = (weight of equipped weapons, shields, armour, talismans) / maxLoad
```

Inventory weight is **not** counted. Consumables are **not** counted.

> **AMENDED wave 0 (corpus-audit) — `PROVENANCE-UPGRADE-02-SOULS.md` §7/§11.1, "the corpus's
> worst internal contradiction". RULED IN FAVOUR OF `RI-CMB01`, INCLUDING THE TIER STRUCTURE.**
>
> This table and `RI-CMB01` §B's `ES-ROLL/1` described **two different equip-load systems**, and
> both were written as binding: 5 tiers at 30/55/80/100 vs 4 at 30/70/100; i-frames 13/11/9/7
> vs 13/11/5/0; roll distance, roll stamina and stamina regen all disagreeing as well.
> **The two items' own method scripts fail each other** — `RI-CMB01`'s M5 threshold-cliff check
> fails any build whose i-frame count changes anywhere but 30.00→30.01 and 70.00→70.01, while
> this item's method 4 asserts exactly four transitions at 0.30, 0.55, 0.80 and 1.00. A builder
> could not satisfy both, and this is the likeliest single reason the build would not converge.
>
> The escape clause below ceded the numeric columns and explicitly refused to concede the tier
> structure — **which is precisely what conflicts**, so the conflict was not resolvable by
> reading the items.
>
> **SUPERSEDED IN PART by ARBITRATION seam S23** (orchestrator ruling R2, issued after this
> edit): the split is **by domain**, not wholesale. `RI-CMB01` owns everything the tier does
> **inside the fight** — tier boundaries as they gate roll behaviour, i-frames, roll distance,
> roll stamina, recovery. **This item owns encumbrance outside the fight and MAY KEEP FINER
> GRANULARITY THERE** — carrying capacity, world-map movement, fatigue, what you can loot and
> haul — **provided its extra tiers have no in-fight effect whatsoever.** The 55% and 80% marks
> may therefore survive as out-of-fight encumbrance bands (that is this item's call, and the
> ruling licenses it); what they may not do is change an i-frame count, a roll distance, a roll
> stamina cost or an in-fight regen multiplier. Where the two tables disagree on an in-fight
> number, `RI-CMB01`'s value stands. The §2 table below is therefore the **in-fight** ladder and
> is not independently settable; any out-of-fight ladder this item wants must be stated
> separately and must be provably inert inside the fight.
>
> **Ruling as originally recorded by the audit (now the in-fight half of S23):** under ARBITRATION §1,
> *"equip load changing roll type, distance and recovery"* is **inside the fight** and Souls is
> authoritative there; the canonical path `combat.dodge.equipload` sits in `10-combat` under
> `critic.combat`. The tiers exist for no purpose except to change roll behaviour, so the
> breakpoints are a combat property. This item's own subordination clause is honoured in full —
> it simply reaches one step further than it intended.
>
> **What this item keeps, and it is not nothing:**
> - **BURDEN (§3) and the whole out-of-fight encumbrance economy** — untouched and still owned
>   here. That is the Morrowind half and no combat item speaks to it.
> - **The name `Immobilised`** for the >100% state, adopted as the display name of
>   `RI-CMB01`'s `OVERLOADED`, because it says what happens.
> - **The fall-damage column**, which no combat item states.
> - **The practice of writing `@60 fps` in the header.** This is the only equip-load table in
>   the corpus that states its framerate, and `PROVENANCE-UPGRADE-02-SOULS` §0 recommends it
>   everywhere. `RI-CMB01` §A now does the same.
>
> Method 4's "exactly four transitions at 0.30, 0.55, 0.80, 1.00" is superseded by
> `RI-CMB01` M5's two cliffs. Full reasoning: `CORPUS-COHERENCE-01.md` §9.

| Tier | Ratio | I-frames @60 fps | Roll distance | Roll stamina | Stamina regen | Fall damage |
|---|---|---:|---:|---:|---:|---:|
| **Light** | ≤ **30%** | **13** | **5.20 m** | **22** | ×1.00 | ×0.80 |
| **Medium** | ≤ **70%** | **11** | **4.40 m** | **26** | ×1.00 | ×1.00 |
| **Heavy** | ≤ **100%** | **5** | **2.60 m** | **34** | ×0.80 | ×1.40 |
| **Immobilised** (`OVERLOADED`) | > 100% | **0** — no roll, stumble only | **1.10 m** | **40** | ×0.60 | ×2.00 |

~~| **Light** | ≤ 30% | 13 | 5.2 m | 20 | ×1.00 | ×0.80 |~~
~~| **Medium** | ≤ 55% | 11 | 4.4 m | 22 | ×0.93 | ×1.00 |~~
~~| **Heavy** | ≤ 80% | 9 | 3.5 m | 25 | ×0.85 | ×1.25 |~~
~~| **Overburdened** | ≤ 100% | 7 | 2.4 m | 32 | ×0.70 | ×1.60 |~~
~~| **Immobilised** | > 100% | — no roll, step only | 0.8 m | 40 | ×0.40 | ×2.00 |~~

The fall-damage column is this item's own and is unchanged; every other column is now
`RI-CMB01` §B's `ES-ROLL/1`, restated here for readability and **not independently settable**.

**The i-frame, roll-distance and stamina-cost columns are provisional and subordinate to
`corpus/10-combat/`.** If a combat reference item states different frame counts, that item
wins and these values are amended, not defended. ~~What this item owns and does not concede is
the **tier structure**: four tiers, at 30/55/80/100~~ **The tier structure is also
`RI-CMB01`'s, as of the wave-0 ruling above: four tiers at 30/70/100**, discrete, with no
interpolation between them. A continuous roll quality is Morrowind leakage into the fight
(AR-1), and that clause is unchanged and still right.

### 3. Ratio 2 — **BURDEN**: everything you are carrying (Morrowind, outside the fight)

```
burdenRatio = (weight of ALL carried items, equipped or not) / (maxLoad × 2.5)
```

The 2.5× headroom is deliberate: a character can carry roughly two and a half times what
they can usefully wear, which is what makes hauling loot possible but finite.

| Tier | Ratio | Move speed | Sprint | Fatigue drain | Sneak detection radius | Travel-time modifier | Jump |
|---|---|---:|---|---:|---:|---:|---|
| **Unburdened** | ≤ 60% | ×1.00 | yes | ×1.00 | ×1.00 | ×1.00 | normal |
| **Laden** | ≤ 85% | ×0.90 | yes | ×1.40 | ×1.15 | ×1.12 | −25% height |
| **Overladen** | ≤ 100% | ×0.72 | **no** | ×2.20 | ×1.50 | ×1.35 | **none** |
| **Immobile** | > 100% | **0** | no | — | — | — | none |

**AR-1 GUARD — the single most important rule in this item:** **Burden has exactly zero
effect inside `COMBAT`.** The moment hostile intent begins, every column in §3 is clamped to
its Unburdened value and only §2's tier applies. A player who is Overladen and gets ambushed
rolls at their Equip Load tier, at full speed, with normal stamina. There is no "you are
carrying too much to fight properly". That would be Morrowind's continuous encumbrance
deciding a Souls fight, and it is an automatic fail.

Burden is not a punishment; it is a **logistics problem you solve outside the fight** —
which is precisely why it is the mechanic that gives RI-PRG05's finite merchant gold pools
teeth. You cannot liquidate a dungeon in one trip because you cannot carry a dungeon.

### 4. Representative weights

| Item | Weight |
|---|---:|
| Robe / cloth set (4 pieces) | 12 |
| Hide / leather set | 26 |
| Chitin / scale set | 38 |
| Mail set | 48 |
| Plate set | 78 |
| Dagger | 2 |
| Straight sword | 6 |
| Axe | 9 |
| Halberd | 12 |
| Greatsword | 14 |
| Greataxe | 20 |
| Bow + 60 arrows | 7 |
| Buckler | 4 |
| Kite shield | 9 |
| Greatshield | 18 |
| Talisman / catalyst | 3 |
| Healing draught | 0.5 |
| Alchemy reagent | 0.1 |
| 1,000 gold | 0 *(gold is weightless — a deliberate Souls-side concession; weighted gold would make the RI-PRG05 economy a carrying puzzle)* |

### 5. The six RI-PRG02 builds, resolved

| Build | STR | END | Equipped weight | maxLoad | Ratio | **Tier** |
|---|---:|---:|---:|---:|---:|---|
| Marsh-Runner | 18 | 30 | 22 | 87.0 | 25.3% | **Light** |
| Alchemist-Assassin | 20 | 20 | 24 | 85.0 | 28.2% | **Light** |
| Root-Speaker | 22 | 22 | 26 | 89.0 | 29.2% | **Light** |
| The Fence | 20 | 22 | 30 | 86.0 | 34.9% | **Medium** |
| Sworn Blade | 40 | 26 | 58 | 118.0 | 49.2% | **Medium** |
| Shell-Warden | 55 | 30 | 126 | 142.5 | 88.4% | **Heavy** (~~Overburdened~~ — retiered wave 0; 88.4% is Heavy under RI-CMB01's 30/70/100 ladder) |

Read the last row. **The heaviest build in the game fat-rolls, on purpose, and it is still
viable** — its 924 HP, greatshield stability and poise are the trade for 7 i-frames. The
Light tier at 30% is set so that a robed caster and a lightly-armoured rogue reach it
without spending a single point in STRENGTH, and so that the Fence's one extra armour piece
costs them Light. Those two facts are the whole tuning target for the 30% breakpoint.

### 6. Where the two ratios interact

| Situation | Equip Load | Burden |
|---|---|---|
| Wearing plate, empty bag | Heavy → 5 i-frames (retiered wave 0) | Unburdened → normal walking |
| Wearing robes, bag full of loot | Light → **26 i-frames @60** ~~13~~ *(AMENDED wave 0 (rebase-s22): `RI-CMB01` owns this figure under seam S23 and it was doubled under seam S22; this item restates, it does not set)* | Overladen → 0.72× speed, no sprint, easily spotted |
| Wearing plate, bag full of loot | Heavy | Overladen |
| Any of the above, **in combat** | applies | **suppressed entirely** |

The middle row is the interesting one and the reason the split exists: a light-armoured
thief who has just robbed a vault is slow, loud and visible on the walk home, and lethal the
instant anything jumps them.

## Comparison method

1. **maxLoad formula.** Evaluate the shipped formula across the §1 grid.
   **Assert every cell within 3% of the table.** **Assert maxLoad is strictly increasing in
   both STRENGTH and ENDURANCE**, and **assert it is NOT soft-capped** — check that
   `maxLoad(STR 99) − maxLoad(STR 60)` equals `1.50 × 39` within 3%.
2. **Equip tier breakpoints.** Sweep equipped weight in 0.1 increments from 0 to 1.2 ×
   maxLoad. **Assert exactly four transitions**, at ratios 0.30, 0.55, 0.80 and 1.00, each
   within ±0.005. **Assert the i-frame value is constant within each tier** — sample 50
   points per tier and assert zero variance. Continuous interpolation between tiers is an
   AR-1 fail.
3. **Inventory does not affect the roll.** Equip a fixed loadout at 45% (Medium). Add 200 kg
   of inventory. **Assert the roll tier, i-frame count, roll distance and roll stamina cost
   are byte-identical before and after.** This is the cleanest single test that the two
   ratios are actually separate.
4. **THE AR-1 GUARD.** Load the character to Overladen (burden 95%). Record an input trace
   out of combat, then enter `COMBAT` and replay the identical trace. **Assert that on
   entering combat: move speed multiplier = 1.00, sprint is available, Fatigue drain
   multiplier = 1.00, and sneak-detection multiplier = 1.00.** Then **assert the in-combat
   locomotion and roll traces are byte-identical to the same character carrying nothing.**
   Any divergence is Morrowind encumbrance inside the fight = **automatic fail of the piece.**
5. **Burden tiers.** Sweep total carried weight. **Assert three transitions at burden 0.60,
   0.85, 1.00** and **assert the §3 multipliers within 3%.** **Assert movement is exactly 0
   above 1.00** and that the player is told why in prose, not a red icon.
6. **The six builds.** Instantiate the §5 loadouts. **Assert every ratio is within 1
   percentage point** and **assert every tier assignment matches exactly**, especially
   Shell-Warden = Heavy and Fence = Medium. If the Fence lands on Light, the 30%
   breakpoint has been moved and RI-PRG02's build differentiation is weaker than claimed.
7. **Shell-Warden viability.** Sim the R6 boss with the Shell-Warden loadout (Heavy,
   7 i-frames) 200 times against a competent AI policy. **Assert win rate ≥ 15%** — the
   heaviest legal build must be *hard*, not *impossible*. A 0% win rate means the tier
   penalties are too steep and the heavy branch of the build space is dead.
8. **Gold is weightless.** **Assert carrying 98,000 gold changes neither ratio.**
9. **Subordination check.** Diff §2's i-frame/distance/stamina columns against whatever
   `corpus/10-combat/` states. **If they disagree, this item is amended and the verdict
   records the amendment** — that is a corpus-extension success, not a failure of either
   item. ~~Only the *tier structure* (four tiers at 30/55/80/100) is defended here.~~
   **AMENDED wave 0 (corpus-audit): nothing in §2 is defended here any longer — the tier
   structure is `RI-CMB01`'s too, four tiers at 30/70/100. This step now asserts the columns
   MATCH `RI-CMB01` §B exactly, and the previous "exactly four transitions at 0.30, 0.55, 0.80,
   1.00" assertion is superseded by `RI-CMB01` M5's two cliffs at 30.00 and 70.00.**

## Scoring

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| maxLoad | all cells within 1%, uncapped | within 3% | soft-capped (heavy builds have no reason to exist) |
| Tier discreteness | 4 exact breakpoints, zero in-tier variance | breakpoints ±0.01 | continuous roll quality |
| Ratio separation | inventory provably inert on roll | same | inventory changes the roll |
| **AR-1 guard** | all four multipliers exactly 1.00 in combat | same | **any** burden effect in combat → **automatic fail** |
| Burden tiers | 3 transitions, multipliers within 1% | within 3% | burden does nothing (Souls-only) |
| Six builds | all six ratios within 0.5 pt | within 1 pt | Shell-Warden lands Medium, or Fence lands Light |
| Heavy viability | win rate ≥25% | ≥15% | ≥1 legal build cannot clear the game |

**Failure threshold: any axis below 6.**

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 | 6 / 10 | 8 / 10 |

**Aggregation (a property of this item, not of the critic):** min-over-axes.

## How we lose

- **The two ratios get merged back into one.** Overwhelmingly the most likely failure,
  because one number is simpler and because "why does my bag not affect my dodge" is a
  reasonable-sounding complaint. The instant inventory weight touches the roll, dodging
  becomes a function of how recently you looted, the fight stops being about the fight, and
  AR-1 is violated. Method 3, then method 4.
- **Burden leaks into combat.** The subtler version: someone applies the Overladen speed
  multiplier globally because suppressing it on combat entry causes a visible speed pop.
  They will fix the pop by removing the suppression. Method 4 must be a trace diff.
- **Roll quality goes continuous.** "Lerp i-frames between 11 and 9 across the Medium band"
  sounds smoother and is Morrowind's continuous encumbrance wearing a Souls hat. It also
  destroys the single most legible build decision in the game — *which tier am I in* — which
  players talk about in exactly these four words. Method 2's zero-variance assertion.
- **The breakpoints drift to make heavy armour feel good.** Move Light from 30% to 40% and
  every build in the game is Light, armour weight stops mattering, and STRENGTH's one
  uncapped return becomes worthless. Move it to 20% and only naked casters ever fast-roll.
  Method 6's six-build fixture is the regression test.
- **maxLoad gets soft-capped like every other stat.** It is the only uncapped return in
  RI-PRG02 and that is deliberate — it is the sole reason to take STRENGTH past 40. Cap it
  and the Shell-Warden has no build.
- **The heavy build becomes unplayable.** If 7 i-frames plus a 0.70× stamina regen multiplier
  means the R6 boss is mathematically unwinnable in plate, we have shipped a game with one
  viable armour class and RI-PRG02's six-character claim is a lie. Method 7 is the only
  assertion in this file that requires an actual combat sim, and it is the one most likely to
  be skipped.
- **Gold gets weight "for realism".** 98,000 gold at any non-zero weight turns RI-PRG05's
  economy into an inventory-management minigame and makes the terminal sinks physically
  awkward to purchase. It will be proposed as a Morrowind-authenticity feature. Morrowind
  wins outside the fight, but not every Morrowind detail is worth having.
- **Nobody reads `corpus/10-combat/` and the i-frame numbers diverge silently.** Two
  documents, two sets of frame counts, and the build follows whichever it read last. Method 9
  exists to force the reconciliation into a verdict rather than leaving it latent.

## Provenance note

**Every number here is `constructed`.**

Two structural debts are `canonical-recall`, confidence medium: Dark Souls' discrete
equip-load roll tiers (DS1 at 25/50/100, DS3 at 30/70/100 — our 30/55/80/100 is a
four-tier variant of that idea, not a copy of either), and Morrowind's encumbrance as a
continuous scalar computed from Strength that affects movement, fatigue and the ability to
move at all.

Two original rulings, which should be read as design decisions rather than recollections:

1. **The two-ratio split**, with Burden suppressed entirely inside `COMBAT`. This is the
   whole item and it follows directly from the Arbitration Rule rather than from either
   game.
2. **The 2.5× Burden headroom**, which sets how much loot a character can haul and is
   therefore load-bearing for RI-PRG05's merchant-pool throttle. If merchants feel too
   restrictive in play, this coefficient — not the pools — is the right knob.

Confidence is **medium**. The §1 formula and §2/§3 breakpoints are internally consistent and
cross-checked against RI-PRG02's six builds, but three things are unvalidated: the
**i-frame and roll-distance columns**, which belong to `corpus/10-combat/` and are held here
provisionally; the **item weights in §4**, which must match whatever `corpus/50-world/`
actually places; and **method 7's heavy-build viability**, which cannot be evaluated at all
until a combat sim exists. Until then the Shell-Warden's playability is an assertion, not a
finding.
