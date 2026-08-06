---
id: RI-PRG06
title: Souls yield and the levelling pace curve — per-archetype values, region tiers, expected level
kind: number
side: souls
judges: [progression.souls_yield, progression.pace, world.region_gating, combat.enemy_roster]
provenance: constructed
confidence: medium
blind_pair: no
---

## The bar

This is the item a critic can actually run. Everything else in `20-progression/` is a rule;
this is a **simulation contract**: kill every enemy in region 1 and you will be level 14,
and if you are not, one of us is wrong. It exists because a soul curve without a soul supply
is unfalsifiable — you can write any formula you like and never be caught, because nobody
can say what level the player *should* be. So this item fixes the supply: every archetype's
soul value, every enemy count, every boss, region by region, adding to a world total of
**1,124,285 souls**, which run through RI-PRG01's curve to a **lossless-100%-clear ceiling
of L93** and a **realistic first clear of L82**.

Two constraints shape every number. First, **S9: regions are gated by lethality, never by
level.** No enemy in this game scales to the player, ever. An R5 enemy that kills you at L30
kills you at L30 in every playthrough that ever happens, and its 2,500 souls are 2,500
souls whether you are L12 or L90. That means the expected-level column below is a
*prediction*, not an enforcement — a good player who walks into R4 at L25 will find R4
enemies, not L25 enemies, and this is the entire reason the region ordering has teeth.
Second, **the pace must decelerate smoothly**: about **11 minutes per level in region 1**,
about **20 minutes per level in region 6**. Not flat, which makes level 80 feel like level
8; not cliff-edged, which makes the last region feel like a wall.

## The reference artifact

Machine-readable: **`corpus/20-progression/RI-PRG06-souls-yield.json`**

### 1. The summary table

| Region | Hours | Enemies | Region souls | Cumulative | **Level, 100% clear** | **Level, typical** | Levels gained | **Min/level** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| R1 | 1.8 | 93 | 12,665 | 12,665 | **14** | **11** | 10 | 10.8 |
| R2 | 2.4 | 101 | 41,600 | 54,265 | **29** | **24** | 13 | 11.1 |
| R3 | 3.0 | 100 | 100,460 | 154,725 | **45** | **39** | 15 | 12.0 |
| R4 | 3.6 | 100 | 202,160 | 356,885 | **62** | **54** | 15 | 14.4 |
| R5 | 4.2 | 92 | 290,800 | 647,685 | **77** | **67** | 13 | 19.4 |
| R6 | 5.0 | 90 | 476,600 | 1,124,285 | **93** | **82** | 15 | 20.0 |
| **Total** | **20.0** | **576** | **1,124,285** | | **93** | **82** | | **14.6 avg** |

**"Typical" = 78% of the roster killed × 88.2% soul retention** (the retention figure is
derived in RI-PRG04 §7 from 86 deaths at a 22% second-death rate; the two items must move
together).

**576 unique hand-placed enemies** — **AMENDED wave 0 (corpus-audit): this is the count the
§3 decomposition was *derived at*, not the world census.** The world census is owned by
`RI-WLD07` §§2–3 and `RI-WLD02` D9 and totals **≈ 1,230** (see §7). Per this item's own
provenance note — *"if the map ships 380 or 900 enemies, every soul value must be rescaled to
preserve the cumulative column, which is the binding part"* — the per-archetype values in §3
are rescaled by `576 / N_shipped` and the cumulative column, the levels and the pace curve are
invariant. **576 is a floor on hand-placed enemies, never a ceiling.**

With respawns across ~28 HEARTH rest cycles a player
kills roughly 1,400–2,000 times — the budget RI-PRG03 §3's skill event counts are built on.
(At the reconciled census of ≈1,230 uniques this becomes ≈3,000–4,300 kills, which *over*-delivers
RI-PRG03's skill budget rather than under-delivering it; see §7.)

**L120 requires 2,391,999 souls = 2.13× the entire world.** L120 is an NG+ or
deliberate-farm destination. It is not, and must not become, a first-clear level.

### 2. Souls per archetype, by region tier

Region tiers are defined by soul band, and the bands are deliberately non-overlapping at the
edges so that "am I in the right region" is answerable from a single kill.

| Region | Trash soul band | Miniboss band | Boss | Tier multiplier vs R1 |
|---|---|---|---:|---:|
| R1 | 35 – 190 | 700 – 900 | 3,000 | 1.0× |
| R2 | 140 – 520 | 2,000 – 2,400 | 8,000 | 3.2× |
| R3 | 330 – 1,250 | 4,200 – 5,200 | 20,000 | 7.9× |
| R4 | 760 – 2,600 | 9,000 – 12,000 | 38,000 | 15.5× |
| R5 | 1,200 – 4,200 | 13,000 – 16,000 | 50,000 | 24.4× |
| R6 | 2,100 – 6,200 | 20,000 – 25,000 | 95,000 | 37.4× |

### 3. The full roster

Ordinary enemies are `trash`. All values are **per kill, before the night multiplier.**

**R1 — 93 enemies, 12,665 souls, 1.8 h**

| Archetype | Tier | Count | Souls each | Total |
|---|---|---:|---:|---:|
| swarm-vermin | trash | 34 | 35 | 1,190 |
| bog-thrall | trash | 26 | 90 | 2,340 |
| reed-stalker | trash | 13 | 125 | 1,625 |
| shell-brute | trash | 9 | 190 | 1,710 |
| fen-archer | trash | 8 | 150 | 1,200 |
| bog-thrall-champion | miniboss | 1 | 700 | 700 |
| rootless-hulk | miniboss | 1 | 900 | 900 |
| **R1 boss** | boss | 1 | **3,000** | 3,000 |

**R2 — 101 enemies, 41,600 souls, 2.4 h**

| Archetype | Tier | Count | Souls each | Total |
|---|---|---:|---:|---:|
| carrion-hopper | trash | 30 | 140 | 4,200 |
| mire-raider | trash | 30 | 290 | 8,700 |
| stilt-lancer | trash | 16 | 360 | 5,760 |
| chitin-warden | trash | 12 | 520 | 6,240 |
| hex-chanter | trash | 10 | 430 | 4,300 |
| raider-headman | miniboss | 1 | 2,000 | 2,000 |
| warden-matriarch | miniboss | 1 | 2,400 | 2,400 |
| **R2 boss** | boss | 1 | **8,000** | 8,000 |

**R3 — 100 enemies, 100,460 souls, 3.0 h**

| Archetype | Tier | Count | Souls each | Total |
|---|---|---:|---:|---:|
| husk-drone | trash | 28 | 330 | 9,240 |
| saltwood-knight | trash | 26 | 720 | 18,720 |
| blade-serpent | trash | 18 | 860 | 15,480 |
| marsh-ogrim | trash | 10 | 1,250 | 12,500 |
| plague-adept | trash | 14 | 780 | 10,920 |
| knight-captain | miniboss | 2 | 4,200 | 8,400 |
| ogrim-elder | miniboss | 1 | 5,200 | 5,200 |
| **R3 boss** | boss | 1 | **20,000** | 20,000 |

**R4 — 100 enemies, 202,160 souls, 3.6 h**

| Archetype | Tier | Count | Souls each | Total |
|---|---|---:|---:|---:|
| ash-thrall | trash | 26 | 760 | 19,760 |
| bone-legionary | trash | 28 | 1,500 | 42,000 |
| gloom-hound | trash | 20 | 1,250 | 25,000 |
| tide-giant | trash | 8 | 2,600 | 20,800 |
| vault-sentinel | trash | 14 | 1,900 | 26,600 |
| legion-decurion | miniboss | 2 | 9,000 | 18,000 |
| tide-giant-elder | miniboss | 1 | 12,000 | 12,000 |
| **R4 boss** | boss | 1 | **38,000** | 38,000 |

**R5 — 92 enemies, 290,800 souls, 4.2 h**

| Archetype | Tier | Count | Souls each | Total |
|---|---|---:|---:|---:|
| deep-cultist | trash | 26 | 1,200 | 31,200 |
| obsidian-guard | trash | 26 | 2,500 | 65,000 |
| winged-terror | trash | 16 | 2,300 | 36,800 |
| hist-warped | trash | 14 | 2,900 | 40,600 |
| silt-colossus | trash | 6 | 4,200 | 25,200 |
| guard-praetor | miniboss | 2 | 13,000 | 26,000 |
| warped-progenitor | miniboss | 1 | 16,000 | 16,000 |
| **R5 boss** | boss | 1 | **50,000** | 50,000 |

**R6 — 90 enemies, 476,600 souls, 5.0 h**

| Archetype | Tier | Count | Souls each | Total |
|---|---|---:|---:|---:|
| ruin-sentinel | trash | 24 | 2,100 | 50,400 |
| black-legion | trash | 26 | 3,900 | 101,400 |
| void-adept | trash | 16 | 3,600 | 57,600 |
| hist-abomination | trash | 12 | 4,800 | 57,600 |
| throne-guard | trash | 8 | 6,200 | 49,600 |
| legion-primarch | miniboss | 2 | 20,000 | 40,000 |
| abomination-alpha | miniboss | 1 | 25,000 | 25,000 |
| **R6 final boss** | boss | 1 | **95,000** | 95,000 |

Archetype names are **placeholders**. `corpus/50-world/` and `corpus/60-lore/` own the
fiction; renaming an archetype must not change its count or its soul value.

### 4. Modifiers

| Modifier | Effect on souls | Source |
|---|---|---|
| **Night variant** (21:00–05:00) | **×1.35** | RI-PRG04 §2 — the reward half of resting into darkness |
| **Respawned enemy** | ×1.00 — unchanged | S5 |
| Boss, repeat kill | **Impossible.** Bosses never respawn | S5 |
| Quest reward | **Zero souls, ever.** Quests pay gold and items | S15 / RI-PRG05 |
| Player level | **×1.00 — no scaling of any kind** | **S9** |

**S9, stated as a hard invariant:** no enemy's HP, damage, soul value, aggro radius,
resistance or spawn composition may read the player's level, region-clear count, or elapsed
playtime. There is no rubber band, no catch-up, no "the game noticed you're struggling".
The only thing that changes an encounter is the world clock (night variants), and that is a
choice the player makes.

### 5. The pace curve

| Region | Hours | Levels gained (typical) | **Minutes per level** |
|---|---:|---:|---:|
| R1 | 1.8 | 10 | **10.8** |
| R2 | 2.4 | 13 | **11.1** |
| R3 | 3.0 | 15 | **12.0** |
| R4 | 3.6 | 15 | **14.4** |
| R5 | 4.2 | 13 | **19.4** |
| R6 | 5.0 | 15 | **20.0** |

**10.8 → 20.0 minutes per level, a 1.85× deceleration across twenty hours.** Levels never
stop arriving — even in the last region one lands every twenty minutes — but they visibly
slow, which is what makes the late ones feel like accomplishments rather than ticks. The
deceleration is smooth (worst single-region jump is R4→R5 at 1.35×) because a jump above
1.6× reads as the game running out of content.

### 6. Cross-check: soul income vs the curve

| Cumulative souls | Level (RI-PRG01 curve) |
|---:|---:|
| 5,000 | 8 |
| 20,000 | 18 |
| 60,000 | 30 |
| 120,000 | 41 |
| 250,000 | 54 |
| 500,000 | 70 |
| 800,000 | 83 |
| 1,000,000 | 90 |
| 1,124,285 (world total) | **93** |
| 2,391,999 | 120 |

### 7. Amendment record — the enemy-budget reconciliation (wave 0, corpus-audit)

`RI-PRG06` fixed **576** hand-placed enemies for the whole game. Three world items require
more than that on their own:

| Source | What it requires | Enemies |
|---|---:|---:|
| `RI-WLD07` §2 — 8 Souls-loop dungeons, stated total | exact | **358** |
| `RI-WLD07` §3 — 82 Morrowind interiors (30 caves 3–9, 20 egg-mines 4–10, 16 xanmeer 2–8, 10 dens 5–12, 6 grottoes 0–2) | 252 – 730 | **≈ 491** (midpoint) |
| `RI-WLD02` D9 — 0.7–1.2 hostile groups per minute over `RI-WLD01`'s ~25.35 km one-way trunk road network (211 min at 2.0 m·s⁻¹), at `RI-AI07` §D's mean 1.9 enemies/encounter | 281 – 481 | **≈ 381** |
| **Reconciled world census** | 891 – 1,569 | **≈ 1,230** |

The interiors alone (849) already exceed 576, so the two figures could not both be "the whole
game". **Ruling:**

- **`RI-WLD07` + `RI-WLD02` own the enemy census.** How many enemies exist is a world-design
  fact and belongs to the world items.
- **`RI-PRG06` owns the soul budget and the level curve.** §1's cumulative column
  (1,124,285 souls, L93 at 100% clear / L82 typical, 20.0 h) is the contract and is
  **unchanged by this amendment.**
- **They are joined by a normalisation rule, not by a new argument.** Per-archetype values in
  §3 are *derived*: `souls_each_shipped = souls_each_here × 576 / N_shipped`, applied
  per region so each region's soul total equals §1's Region-souls column exactly. At the
  reconciled census of 1,230 the scale factor is **0.468**.

**Planning figure adopted: 1,230 hand-placed hostile instances (band 891–1,569).** Registered
in `corpus/00-doctrine/constants.json` as `world.enemy_census`, owner `RI-WLD07`.

**What this does *not* change.** No soul total, no level, no hour figure, no pace-curve value,
no scoring threshold in this item. The §3 tables are left standing verbatim as the derivation
of record; §3 is now explicitly one valid decomposition of §1 at N = 576, exactly as the
provenance note already said it was.

**Consequence flagged for RI-PRG03's owner:** the kill count roughly doubles, so RI-PRG03's
skill-event budget (built on ~5 hits × 1,400–2,000 kills) now *over*-delivers. That is a
softer failure than under-delivering and is left as a recorded divergence rather than silently
retuned — RI-PRG03 is not this audit's to re-derive. See CORPUS-COHERENCE-01 §7 (edits not made).

## Comparison method

The harness lives at `corpus/80-methods/sim-souls-yield.md`. Every assertion below runs
against `game/src/data/enemies.json` + `game/src/data/progression.json` with no rendering.

1. **"Kill everything in region 1."** Sum every `souls` value in the shipped R1 roster
   (count × value). **Assert the total ∈ [11,650, 13,680]** (12,665 ±8%). Feed it through
   RI-PRG01's curve. **Assert the resulting level ∈ [13, 15].** This is the item's headline
   assertion and it must be runnable by a fresh agent in under a minute.
2. **Every region, same test.** **Assert cumulative levels after full clear of R1…R6 are
   within ±2 of {14, 29, 45, 62, 77, 93}.**
3. **Typical-player sim.** Run 1,000 Monte Carlo playthroughs: each kills a uniform-random
   74–82% of each region's roster, dies per RI-PRG04 §7's per-region death counts with a
   22% second-death rate, and banks/spends at HEARTHs. **Assert the median final level
   ∈ [78, 86]** and **assert the 10th–90th percentile band is within [72, 92].** A band
   wider than 25 levels means the death model or the roster is too noisy to design against.
4. **Pace curve.** From the same sim, compute minutes-per-level per region.
   **Assert R1 ∈ [9, 13] and R6 ∈ [17, 23].** **Assert the sequence is monotonically
   non-decreasing** and **assert no region-to-region ratio exceeds 1.6×.**
5. **S9 — NO LEVEL SCALING.** Static: `grep -rniE
   "playerLevel|player\.level|soulLevel|scaleTo|levelScal|difficultyScal" game/src/` in the
   enemy spawn, stat, AI and reward modules. **Assert zero hits.** Dynamic: instantiate the
   full R5 roster at player level 10 and at player level 90 and **assert every enemy's HP,
   damage, soul value, aggro radius and resistance values are byte-identical.** Any
   difference is an AR-1 automatic fail of the piece.
6. **Band separation.** For each adjacent region pair, **assert the trash soul bands do not
   overlap by more than 25%** of the lower band's width — a player must be able to tell
   which tier they are in from one kill.
7. **Quest souls are zero.** Scan every quest reward record. **Assert no reward grants
   souls** (S15 / RI-PRG05). Souls come from kills and only kills.
8. **Boss non-respawn.** Rest at a HEARTH 30 times after killing a boss. **Assert the boss
   is dead all 30 times and its souls cannot be re-earned** (S5).
9. **Night multiplier.** Kill the same archetype at 14:00 and at 23:00. **Assert the night
   yield is 1.35× ±0.02** and **assert the night variant's HP/damage deltas match RI-PRG04
   §2 (−15% HP, +18% damage, +10% aggro).**
10. **The L120 guard.** Sum all souls obtainable without repeating a respawnable enemy.
    **Assert the total is < 1.4 × the souls needed for L100** — i.e. a 100% clear must not
    reach L120. **Assert `souls_for_L120 / world_total ∈ [1.8, 2.6]`** (target 2.13).
11. **Joint consistency with RI-PRG01 and RI-PRG04.** **Assert** the retention figure used
    by this sim equals RI-PRG04 §7's within 3 points, and **assert** the curve used equals
    RI-PRG01's shipped table exactly. If any two of the three items disagree, all three are
    failed and re-derived together — they are one system with three documents.

## Scoring

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| Region-1 assertion | total within 3%, level exactly 14 | within 8%, level 13–15 | level outside 11–17 |
| All-region levels | all six within ±1 | within ±2 | any region off by >4 |
| Typical sim | median 80–84, band ≤18 wide | median 78–86, band ≤25 | median <70 (starved) or >100 (flooded) |
| Pace | R1 10–12, R6 18–21, max ratio 1.4× | R1 9–13, R6 17–23, max 1.6× | flat pace, or any ratio >2.0× |
| **S9** | zero level reads, byte-identical rosters | same | **any** level scaling → **automatic fail** |
| Band separation | zero overlap | ≤25% overlap | adjacent tiers indistinguishable |
| Quest souls | zero | zero | any → **automatic fail** (S15) |
| L120 guard | ratio 2.0–2.3× | 1.8–2.6× | 100% clear reaches L115+ |

**Failure threshold: any axis below 6.**

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 | 6 / 10 | 8 / 10 |

**Aggregation (a property of this item, not of the critic):** min-over-axes.

## How we lose

- **Enemy level-scaling gets added.** The single most consequential failure available in
  this item, and the most likely to be introduced with good intentions: "region 5 is too
  hard if you skipped region 3, let's scale it a bit." That one line deletes S9, deletes the
  meaning of every soul value in §3, deletes the reason exploration order matters, and turns
  the game into Oblivion. It is an automatic fail and method 5 must be run as a *byte-diff
  of instantiated rosters*, not a code read — scaling hides in spawn tables and in
  `difficultyMultiplier` config far more often than in an `if (playerLevel)`.
- **Soul values get retuned in a combat pass and nobody re-runs the sim.** A designer doubles
  R4 soul values because R4 "felt unrewarding". The player now enters R5 at L70 instead of
  L54, is soft-capped everywhere, and the last eight hours have no progression at all. The
  numbers in §3 are not combat-feel knobs; they are the input to RI-PRG01's curve, and the
  two must be tuned together. Method 2 is the tripwire.
- **The pace goes flat.** If minutes-per-level is 12 in R1 and 13 in R6, level 82 feels
  exactly like level 8 and twenty hours of progression have no shape. This happens
  automatically if soul values are scaled by the same factor as the curve — the deceleration
  in §5 is deliberate under-supply at the top and it will look like a bug to anyone tuning
  regions in isolation.
- **The pace cliffs.** The opposite: R6 at 40 minutes per level because someone trimmed the
  late roster. The player stops levelling in the final region, which is precisely where a
  Souls game should still be feeding them.
- **Quest rewards start paying souls.** Enormously tempting — it is the obvious way to make
  a quest feel worth doing, and it is an S15 violation *and* it decouples levelling from
  combat, which is the one coupling this whole design rests on. Quests pay gold and items.
- **Bosses become farmable.** A respawning boss at 95,000 souls is a level-per-two-minutes
  machine and every number in this file is instantly fiction.
- **The roster shrinks during production and nobody adjusts values.** 576 enemies is a large
  hand-placed budget. If it lands at 380, the world total falls to ~740,000, the first clear
  lands around L72, and RI-PRG03's skill event budgets (built on ~5 hits × 1,400–2,000 kills)
  all under-deliver too. Method 1 catches the souls; only a careful critic catches that
  RI-PRG03 broke at the same time.
- **The night multiplier is removed as an exploit vector.** It is farmable in principle —
  1.35× on a respawning roster — but it is bounded by the 6-hour rest step and the night
  window. Removing it makes RI-PRG04's clock cost purely a punishment, which is exactly what
  it must not be.
- **A critic checks this file instead of the shipped data.** Every assertion above is written
  against `game/src/data/`. Verifying that this document is internally consistent proves
  nothing; it was generated from a script and it is consistent by construction.

## Provenance note

**Every number in this item is `constructed`.** No soul value, enemy count or hour figure is
recalled from or measured in any shipped game. The *convention* — souls per kill scaling by
roughly 40× from first area to last, bosses worth 10–30× a trash mob, no respawning bosses —
is `canonical-recall` from the Souls series at confidence medium.

Confidence is **medium**, and lower than RI-PRG01's, for a specific reason worth stating
plainly: **the roster in §3 is a budget, not an inventory.** It asserts that
`corpus/50-world/` will contain 576 hand-placed enemies in six regions occupying twenty
hours (**amended: ≈1,230 — see §7; the soul totals are unchanged**). That world does not
exist yet. Three things could invalidate this item and all three
are outside its control:

1. **The real enemy count differs.** If the map ships 380 or 900 enemies, every soul value
   must be rescaled to preserve the cumulative column, which is the binding part. The
   *cumulative souls per region* and the *expected level per region* are the contract; the
   per-archetype breakdown is one valid decomposition of it.
   **RESOLVED wave 0 (corpus-audit): it does differ — the reconciled census is ≈1,230, not
   576. The rescaling this clause anticipated has been applied as a rule in §7; the cumulative
   column is preserved untouched.**
2. **The hour budget differs.** 20.0 hours split 1.8/2.4/3.0/3.6/4.2/5.0 is a target handed
   to the world and quest agents. If R6 is really eight hours, §5's pace curve is wrong even
   though §1's levels are right.
3. **Combat TTK differs.** RI-PRG03's skill budgets assume ~5 hits per ordinary kill. If
   `corpus/10-combat/` lands on 9, the skill curve and this roster disagree.

The **death/retention model is shared with RI-PRG04 §7** and the **curve is shared with
RI-PRG01**. These three items are one system. A critic who fails one and passes the others
has mis-scoped the failure: re-derive all three.
