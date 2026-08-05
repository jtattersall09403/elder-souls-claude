---
id: RI-PRG03
title: Skills that improve by use — the 19 skills, their rates, and their gates
kind: number
side: morrowind
judges: [progression.skills, progression.scaling, world.locks, world.alchemy, dialogue.persuasion, economy.barter]
provenance: constructed
confidence: high
blind_pair: no
---

## The bar

Seam S3: **skills improve by use, and they gate access and utility — never to-hit.** Both
halves of that sentence are load-bearing and both are easy to get wrong in opposite
directions. Get it wrong toward Souls and skills become a decorative XP counter that
changes nothing; get it wrong toward Morrowind and a level-3 character swings a sword
through a mudcrab five times for nothing and the fight stops being a fight (S1: geometry
decides hits, always, with no exceptions and no hidden multipliers). The reconciliation is
that **skill never touches the hit-test and always touches the payoff.** A swing with
Blades 5 and a swing with Blades 90 connect identically — same hitbox, same active frames,
same stagger — and deal materially different damage, because skill sets the *effective
scaling grade* of the weapon in your hands. Everything else a skill does happens outside
the fight entirely: which locks open, which spells can be equipped at all, how many effects
you read on a plant, whether a guard can be talked down, what a merchant charges. The
result is that "I am good with an axe" is a fact about your character that you built by
swinging an axe for eighteen hours, and it is never a fact about whether the axe hits.

## The reference artifact

### 1. The nineteen skills

Morrowind ships 27, Dark Souls ships 0. We ship **19** — wide enough that no two builds
have the same skill sheet, narrow enough that every one is reachable and every one has a
written gate table below.

| Group | Skill | Governing attribute | Primary gate it controls |
|---|---|---|---|
| **Weapon** | Blades | AGILITY | Straight/curved swords, daggers |
| | Axes & Maces | STRENGTH | Axes, hammers, flails |
| | Polearms | STRENGTH | Spears, halberds, glaives |
| | Greatweapons | STRENGTH | Ultra-greatswords, greataxes, great-hammers |
| | Marksman | AGILITY | Bows, crossbows, thrown |
| | Claw & Fang | AGILITY | Argonian claws, fists, katars *(setting-native)* |
| **Defence** | Shieldcraft | ENDURANCE | Shield stability, parry-window access |
| **Magic** | Sorcery | INTELLECT | Destructive/arcane spell tiers |
| | Root-Speech | HIST-BOND | Restoration & Hist-invocation tiers |
| | Warding | WILLPOWER | Buffs, resist-wards, alteration |
| | Veiling | WILLPOWER | Illusion, silence, invisibility, fear |
| | Alchemy | INTELLECT | Ingredient effects read; potion potency |
| **Body** | Athletics | SPEED | Sprint speed, swim, out-of-fight stamina economy |
| | Acrobatics | AGILITY | Jump height, fall-damage threshold, ledge routes |
| | Survival | VIGOUR | Harvesting, disease resistance, water/food safety |
| **Social & guile** | Sneak | AGILITY | Detection radius, stealth-opener access |
| | Security | AGILITY | Lock tiers, trap disarm |
| | Mercantile | PERSONALITY | Buy/sell multipliers, merchant pool access |
| | Speechcraft | PERSONALITY | Disposition swing per attempt, topic unlocks |

All skills start at **5** unless an origin (`corpus/30-quests/`) raises them; origins may
set up to five skills to 15–25. Skill cap **100**.

### 2. The progression curve — one formula for all nineteen

```
progressToNext(s) = round( 1.6·s + 6 )        # progress points to go from skill s to s+1
```

| Skill level | Points to next | Cumulative from 5 |
|---:|---:|---:|
| 5 | 14 | 0 |
| 20 | 38 | 378 |
| 40 | 70 | 1,442 |
| 60 | 102 | 3,146 |
| 75 | 126 | 4,844 |
| 85 | 142 | 6,176 |
| 99 | 164 | 8,474 (=100) |

The curve is uniform. **Differences between skills live entirely in how many progress
points a use event is worth**, which is tuned to how often that event can occur. This is
the design's whole trick: a lockpick is rare and worth 25 points, a sword hit is common and
worth 1, and both skills climb at a comparable rate for a player who commits to them.

### 3. Use events, point values, and the realistic budget

| Skill | Qualifying event | Points | Realistic lifetime budget (dedicated player) | Reached |
|---|---|---:|---|---:|
| Blades / Axes / Polearms / Greatweapons / Claw&Fang | **connecting** hit on a hostile | 1 | 5,500 hits + 300 ripostes/backstabs @2 | **84** |
| Marksman | connecting shot at range >12 m | 2 | 2,400 shots | 74 |
| Shieldcraft | hit absorbed on shield | 1 | 2,000 blocks | — |
| | successful parry | 3 | 250 parries | **55** |
| Sorcery / Root-Speech / Warding / Veiling | cast that produced a measurable effect | 12 | 450 casts | **79** |
| Alchemy | potion brewed | 35 | 120 potions | — |
| | first brew of a novel recipe | 90 | 12 novel recipes | **78** |
| Security | lock successfully picked | 25 | 180 locks in the world | — |
| | failed pick attempt (lockpick consumed) | 6 | ~170 failures | **80** |
| Sneak | 10 s spent undetected inside a hostile detection cone | 4 | 540 intervals (~90 min) | — |
| | stealth opener / backstab from unaware | 30 | 120 openers | **82** |
| Speechcraft | successful persuade/intimidate/admire attempt | 55 | 80 successes | — |
| | failed attempt (disposition lost) | 15 | 40 failures | **76** |
| Mercantile | per 25 gold of **completed** barter turnover | 1 | 140,000 g lifetime turnover | **80** |
| Athletics | 10 s of sprinting or swimming | 3 | 1,800 intervals (~5 h) | **79** |
| Acrobatics | landed drop >2 m | 8 | 380 drops | — |
| | survived fall >5 m | 20 | 90 falls | **74** |
| Survival | creature harvested | 20 | 190 harvests | — |
| | flora ingredient gathered | 10 | 160 gathers | **79** |

**These ceilings are not simultaneously reachable.** The events compete for the same twenty
hours: you cannot land 5,500 sword hits *and* 2,400 bow shots *and* 450 casts. The realistic
composite profile for a first clear is one focus weapon plus five or six developed
secondaries:

| Skill | Blades | Athletics | Mercantile | Shieldcraft | Security | Speechcraft | Sneak | Alchemy | Survival | Acrobatics |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Typical end | 85 | 84 | 62 | 57 | 45 | 40 | 30 | 25 | 22 | 18 |

**Attribute points earned from this profile: 27** (one per skill crossing 15/30/45/60/75/90),
which is the 25.0% earned fraction that RI-PRG02 §2 depends on. Changing any point value in
the table above changes that number and both items must be re-derived together.

### 4. **The Cost Gate** — the anti-grind rule

Morrowind's worst failure mode is that its best progression strategy is to stand in a
doorway jumping for forty minutes. We close it with one rule:

> **A use event grants progress only if it consumed something the world can run out of.**

| Event consumes | Grants progress? |
|---|---|
| An enemy's health (a connecting hit) | Yes, always |
| A lockpick, a reagent, a scroll, an arrow, Focus (FP) | Yes, always |
| Gold that changed hands in a completed barter | Yes, always |
| An NPC's disposition (persuade success *or* failure) | Yes, always |
| Nothing — jumping in place, casting at a wall, swinging at air, sneaking in an empty room, re-picking an already-open lock, opening and cancelling a trade | **No progress. Zero.** |

Two supporting clamps:

- **Detection requirement.** Sneak accrues only inside a live hostile detection cone.
  Empty-room sneaking is worth nothing.
- **Rest clamp.** Any single skill may gain at most **+3 levels between HEARTH rests**
  (RI-PRG04). This bounds even legal grinding into a rhythm of play rather than a session
  of repetition.

A "use" that costs nothing teaches nothing. That is the whole rule.

### 5. **What weapon skill does to damage — the S3 core mechanic**

Every weapon prints a **skill requirement** `req` alongside its scaling grades. Your skill
in that weapon's class shifts the **effective** grade used in RI-PRG02 §4's damage formula:

| Your skill vs weapon's `req` | Effective grade | Effect |
|---|---|---|
| `skill < req − 20` | printed **− 3 steps** | Weapon is nearly inert; you swing a stick |
| `skill < req − 10` | printed **− 2 steps** | Badly under-skilled |
| `skill < req` | printed **− 1 step** | Under-skilled but usable |
| `req ≤ skill < req + 25` | **printed** | As advertised |
| `skill ≥ req + 25` | printed **+ 1 step** (capped at S) | Mastery |

Grade steps run `E → D → C → B → A → S`; a grade degraded below E becomes **none** (zero
scaling contribution, base damage only).

**Worked example.** A greatsword: base 130, printed **A** in STRENGTH, `req` = 45. Wielder
has STRENGTH 40 (scalingBonus 0.850, RI-PRG02 §4).

| Greatweapons skill | Effective grade | Coefficient | Bonus damage | Total AR |
|---:|---|---:|---:|---:|
| 20 (< req−20) | D | 0.32 | +35 | **165** |
| 32 (< req−10) | C | 0.46 | +51 | **181** |
| 42 (< req) | B | 0.62 | +69 | **199** |
| 50 (≥ req) | A | 0.80 | +88 | **218** |
| 72 (≥ req+25) | S | 1.00 | +110 | **240** |

**Spread from unskilled to mastered: 165 → 240, a 45% damage swing.** Large enough that
picking up an unfamiliar weapon class is a real cost; small enough that a new weapon is
never unusable, so experimenting is possible rather than punished into non-existence.

**The four things this mechanic must never do**, restated because S1 is absolute:

1. Skill never modifies the hit test. Hitboxes and active frames are identical at skill 5
   and skill 100.
2. Skill never adds miss chance, glancing blows, or damage variance.
3. Skill never modifies startup, active, recovery or i-frame counts — those are
   `corpus/10-combat/`'s, and they are fixed per weapon.
4. Skill never modifies stagger, poise damage, or stamina cost. Only the scaling grade.

### 6. Gating thresholds — what every other skill unlocks

Gates are **deterministic**. There is no roll. Below the threshold the action is not
attempted and fails; at or above it, it is available. This keeps Morrowind's breadth
without importing Morrowind's dice.

**Security → lock tiers** (AGILITY also caps the reachable tier per RI-PRG02):

| Lock tier | Security required | AGILITY required | Picks consumed per attempt |
|---:|---:|---:|---:|
| 1 (simple) | 0 | 10 | 1 |
| 2 (sturdy) | 20 | 18 | 1 |
| 3 (warded) | 40 | 26 | 2 |
| 4 (masterwork) | 60 | 38 | 2 |
| 5 (sealed) | 80 | 50 | 3 |

Tier-5 locks (there are **11** in the world) each seal a hand-placed named item. They can
also be opened by a quest key, so Security is a *shortcut*, never a hard wall (S10-adjacent
principle: no build may be locked out of content).

**Sorcery / Root-Speech / Warding / Veiling → spell tiers.** A spell has a skill
requirement; **below it the spell cannot be equipped at all** (not "fails to cast" — it does
not enter the slot). Tier 1 req 0 · Tier 2 req 25 · Tier 3 req 45 · Tier 4 req 65 · Tier 5
req 85. Focus cost per cast is fixed per spell and reduced by `−0.5% per skill point above
the requirement`, floored at −35%.

**Alchemy → ingredient effects read.** <15: 1 effect · 15–34: 2 · 35–59: 3 · 60–84: 4 ·
85+: all effects plus ingredient provenance. Potion potency multiplier
`0.6 + 0.010 × Alchemy` (0.65 at skill 5, 1.10 at 50, 1.60 at 100), multiplied by INTELLECT's
potency term.

**Speechcraft → disposition swing per attempt.** `swing = round(2 + 0.16 × Speechcraft)`
points, doubled on a topic the NPC cares about, halved if faction-hostile. At skill 5 that
is 3 points a try; at 85 it is 16. Topic unlocks at 25 / 50 / 75 open persuasion routes
through quests that `corpus/30-quests/` marks non-combat-resolvable.

**Mercantile → prices and pools.** Feeds the price multipliers in RI-PRG05 directly. Above
Mercantile 40 a merchant will barter with items as part-payment; above 70 you may sell to a
merchant whose pool is exhausted on credit, once per in-game day.

**Sneak → detection.** Detection radius multiplier `1.00 − 0.006 × Sneak` floored at 0.40
(skill 100 ⇒ enemies notice you at 40% of normal range). Stealth openers (the unaware-target
critical, damage owned by `corpus/10-combat/`) require Sneak **≥ 20**. Sneak never makes you
invisible and never affects a hitbox.

**Athletics → traversal.** Out-of-fight sprint speed `1.00 + 0.0035 × Athletics` (1.35× at
100). Sprint stamina drain `−0.30% per point`. Swimming becomes possible in current at
Athletics 30 and against current at 60 — this gates two shortcut routes in
`corpus/50-world/`. Zero effect inside `COMBAT` (AR-1).

**Acrobatics → routes.** Jump height `1.00 + 0.004 × Acrobatics`. Fall-damage-free drop
height `2.0 m + 0.05 m per point` (7 m at skill 100). Nine map shortcuts are gated on
Acrobatics ≥ 45 and three on ≥ 70.

**Survival → the affliction economy** (S11's Morrowind half). Disease contraction chance
`−0.8% per point`; harvest yield `1 + floor(Survival/30)` ingredients per creature; safe
consumption of raw marsh water at ≥ 35.

**Shieldcraft → block and parry.** Shield stability (stamina retained per block)
`+0.35% per point`. **Parry is not available below Shieldcraft 30** — it is an unlock, not
a modifier. Above 30 the parry window is fixed by `corpus/10-combat/` and skill does **not**
widen it. This is the cleanest example of the S3 rule: skill decides *whether you may
attempt* the move; the frame data decides whether the attempt worked.

## Comparison method

1. **Skill inventory.** Load `game/src/data/skills.json`. **Assert exactly 19 skills**, ids
   matching §1, each with a `governing_attribute` from RI-PRG02's ten, and each with a
   non-empty `gates` list. **Assert every skill appears in at least one gate table** — a
   skill that unlocks nothing is decoration.
2. **Curve fidelity.** For `s ∈ [5,99]` compute `round(1.6s + 6)` and compare to shipped
   `progressToNext`. **Assert max relative error ≤ 5%.** **Assert cumulative 5→100 is within
   8% of 8,474.**
3. **S1 PURITY — the critical assertion.** Static check: `grep -rniE
   "skill|proficiency" game/src/` inside the hit-resolution, hitbox, i-frame, poise, stagger
   and stamina-cost modules. **Assert zero reads of any skill value in any of them.**
   Dynamic check: run the combat harness twice against an identical recorded input trace,
   once with all skills at 5 and once at 100. **Assert the hit/miss sequence, contact
   frames, stagger events and stamina timeline are byte-identical**, and that **only the
   damage numbers differ.** Any divergence in contact or timing is an AR-1 Morrowind-leakage
   **automatic fail of the piece.**
4. **Scaling-grade shift.** Instantiate the §5 worked example (base 130, printed A/STR,
   req 45, STR 40). **Assert AR at Greatweapons {20, 32, 42, 50, 72} is within 5% of
   {165, 181, 199, 218, 240}**, and **assert AR(72)/AR(20) ∈ [1.35, 1.55]** — the mastery
   spread must be real but not absolute.
5. **Cost Gate.** Scripted grind attempts, each run for 10 simulated minutes:
   jump in place; cast at a wall with no target; swing at air; sneak in a room with no
   hostiles; pick and re-pick an already-open lock; open and cancel 200 trades.
   **Assert every one produces exactly 0 progress points.** Then **assert the +3-levels-
   per-skill-per-rest clamp fires** by running a legal grind (picking real locks) past it.
6. **Attribute-grant accounting.** Replay the §3 composite profile through the
   15-threshold rule. **Assert it yields 27 ± 3 attribute points**, and cross-check against
   RI-PRG02 method 5's earned-fraction band [0.19, 0.31].
7. **Gate determinism.** For each gate table in §6, call the gated action at
   `threshold − 1` and `threshold`. **Assert failure is total and success is total, 100
   trials each** — a gate that succeeds 40% of the time at `threshold − 1` has smuggled a
   dice roll back in and fails the item.
8. **No hard lockout.** For every tier-5 lock and every skill-gated quest branch, **assert
   at least one alternative route exists** (key, bribe, alternate entrance, combat). A build
   that cannot finish the game is a design failure even if every number is right.

## Scoring

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| Inventory | 19 skills, all gated, all governed | ≥16 skills, all gated | <12, or skills exist with no gate |
| Curve | max error ≤2% | ≤5% | curve is flat or per-skill ad hoc |
| **S1 purity** | traces byte-identical, zero skill reads in combat modules | same | **any** skill read in hit resolution → **automatic fail of the piece** |
| Grade shift | anchors within 3%, spread 1.40–1.50× | within 5%, spread 1.35–1.55× | skill doesn't change damage at all (Souls-only) or changes it >2× (skill replaces build) |
| Cost Gate | all six grinds yield 0, clamp fires | all six yield 0 | any no-cost action grants progress → Morrowind's grind is shipped |
| Determinism | 100/100 fail below, 100/100 pass at | same | any probabilistic gate |
| No lockout | every gate has ≥2 routes | every gate has ≥1 alternative | any content reachable by exactly one skill |

**Failure threshold: any axis below 6.** The S1-purity axis is binary — it has no 6.

## How we lose

- **Skill sneaks into the hit test.** The likeliest form is not a to-hit roll, which
  everyone knows is banned; it is a *damage variance* term — "±10% damage, reduced by
  skill" — which is a to-hit roll wearing a hat. Or a "glancing blow" on low skill. Or
  skill widening the parry window by a few frames because that "feels rewarding". All three
  are AR-1 failures and all three will be introduced by someone trying to make skill feel
  good. Method 3 exists for exactly this and must be run as a *trace diff*, not a code read.
- **The Cost Gate is not implemented and Morrowind's grind ships.** Jumping to raise
  Acrobatics is the canonical embarrassment. It will be reported as a fun easter egg. It is
  a failure: it makes the optimal play repetition, and it inflates the earned-attribute
  stream past the 31% ceiling that RI-PRG02 depends on.
- **Skills exist and gate nothing.** Nineteen counters tick upward, an achievement pops at
  100, and no door, spell, price or conversation ever consults them. This passes methods 1
  and 2 and fails the entire purpose of S3. Only method 1's `gates`-list assertion and
  method 7's live gate probes catch it.
- **Point values are set per-skill by vibes.** Someone tunes Alchemy to 5 points a potion
  because 35 "seems like a lot", and Alchemy now takes 900 potions to reach 50 — nobody ever
  levels it, and one of nineteen build axes is dead. The §3 budget column is the defence:
  every point value must be justified by a stated realistic event count.
- **The grade-shift spread is too wide.** If under-skilled weapons do 30% of listed damage,
  no player ever picks up a new weapon class, and the 19-skill sheet collapses into "the one
  skill I started with". 45% is chosen to be a real cost you can eat for a good weapon.
- **The grade-shift spread is too narrow.** If it is 10%, skill is cosmetic and we have
  shipped Dark Souls with a progress bar.
- **A gate becomes a probability.** "Lockpicking has a success chance based on skill" is
  the single most natural thing to write and it reintroduces Morrowind's dice into a game
  that has abolished them. Deterministic tiers, always. Method 7.
- **A build gets locked out.** Every gate needs a second route or the 19-skill sheet becomes
  a checklist of mandatory investments rather than a set of choices.
- **RI-PRG02 and this item drift.** The 27-earned-attribute-points figure is a *joint*
  output of this item's point values and PRG02's 15-threshold rule. If either is retuned
  alone, both are wrong and nothing will notice until a critic runs method 6.

## Provenance note

**Everything here is `constructed`.** No number is measured or recalled from either game.

Two structural debts are `canonical-recall` (confidence medium): Morrowind's use-based skill
progression with governing attributes and its 27-skill sheet, and Dark Souls' letter-grade
weapon scaling. The **19-skill list, the uniform `1.6s + 6` curve, every point value, the
Cost Gate, the grade-shift table, and every gating threshold are original design for this
project** and are fully binding.

The two decisions most worth re-litigating with evidence (and the two most likely to be
wrong):

1. **The realistic event budgets in §3** are estimates derived from the RI-PRG06 roster
   (≈780 hand-placed enemies, ≈1,400–2,000 kills including respawns, ~5 hits per kill).
   They are arithmetic on a designed roster, not observations of play. Once a playable build
   exists, method 6 should be re-run against telemetry and the point values retuned to hold
   the 27-point / 25% figure.
2. **The 45% mastery spread in §5** is a taste judgement about how punishing weapon
   unfamiliarity should be. It should be validated against real TTK data from
   `corpus/10-combat/` — if 45% moves an R4 enemy from a 4-hit kill to a 6-hit kill, that is
   probably correct; if it moves it from 4 to 9, it is too wide.

Confidence **high** on internal consistency (§3's budgets, §2's curve and RI-PRG02's 27
points are all generated from the same arithmetic and cross-checked), **medium** on the
absolute calibration of the point values.
