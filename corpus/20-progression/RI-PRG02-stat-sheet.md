---
id: RI-PRG02
title: The stat sheet — ten attributes, soft caps, and scaling grades
kind: number
side: neutral
judges: [progression.attributes, progression.levelup_ui, progression.scaling, combat.damage_formula]
provenance: constructed
confidence: high
blind_pair: no
---

## The bar

Seam S2 splits levelling: **Souls owns the currency and the curve; Morrowind owns the
breadth of the sheet.** RI-PRG01 discharges the first half. This item discharges the
second, and it has one non-negotiable success test: **a finished character must be
describable in a sentence that is not "quality build".** In Dark Souls the entire
vocabulary of character identity is roughly eight nouns — quality, strength, dex, pyro,
int-caster, faith-caster, luck/bleed, hex — and every one of them is a description of *how
you hit things*. That is the correct vocabulary for the ten seconds you are inside a boss
arena, and this item does not touch it: STR/AGI/INT/HIST still resolve damage exactly as
Souls scaling resolves damage. But it is a catastrophically thin vocabulary for the other
eighteen hours, and Morrowind's answer — a sheet where Personality and Speed and Luck are
real, spendable, build-defining resources — is the one we adopt. Ten attributes, each with
at least one effect that matters **outside** the fight and cannot be substituted by any
other attribute, so that "a slow, enormously strong, universally distrusted mercenary" and
"a fast, weak, silver-tongued fence who has never won a straight fight" are both legal,
both viable, and both mechanically distinct in ways a save file can prove.

## The reference artifact

### 1. The ten attributes

All start at **10** (origins in `corpus/30-quests/` may shift up to ±4 across at most four
attributes, net zero). Hard cap **99**. There is no attribute floor below 1 and no way to
reduce an attribute after allocation.

| # | Attribute | Souls ancestor | Morrowind ancestor | Governs (in-fight) | Governs (out-of-fight) |
|---|---|---|---|---|---|
| 1 | **VIGOUR** | Vigor | Endurance | Max HP; bleed & frost resistance | Disease resistance; drowning time |
| 2 | **ENDURANCE** | Endurance | Fatigue/Endurance | Max stamina; stamina regen rate; poise floor | Max Fatigue (S4 second bar); recovery from Fatigue-0 |
| 3 | **STRENGTH** | Strength + Vitality | Strength | STR-scaling damage; shield stability; heavy-weapon requirement | **Max equip load** (RI-PRG07); carry capacity for loot; forcing doors/chests |
| 4 | **AGILITY** | Dexterity | Agility | AGI-scaling damage; bow draw speed; roll distance | Lockpick tier ceiling; pickpocket; trap disarm |
| 5 | **SPEED** | *(none)* | Speed | **Nothing.** *(explicitly)* | Out-of-combat move & sprint speed; swim speed; sprint stamina drain; travel-time modifier on the world map |
| 6 | **WILLPOWER** | Attunement | Willpower | Max Focus (FP); spell-slot count; status-resist (curse, fear, madness) | Resistance to intimidation & illusion in dialogue; Fatigue drain rate |
| 7 | **INTELLECT** | Intelligence | Intelligence | Sorcery scaling | Alchemy potency; number of ingredient effects read; gating on scholarly dialogue topics and unreliable-book comprehension (`corpus/60-lore/`) |
| 8 | **HIST-BOND** *(placeholder name — world agent owns the final name; mechanically the Faith slot)* | Faith | *(none — setting-native)* | Root/restoration & Hist-invocation scaling; miracle-equivalent access | HEARTH attunement quality (RI-PRG04); Hist-related faction rank thresholds |
| 9 | **PERSONALITY** | *(none)* | Personality | **Nothing.** *(explicitly)* | Base disposition of every NPC; buy/sell price multiplier (RI-PRG05); persuasion success band; faction rank requirements; whether a bribe is even offered |
| 10 | **LUCK** | Luck | Luck | Status **buildup** you inflict (bleed/poison/rot); resistance to instant-death effects | Rare hand-placed cache reveal prompts; gambling & wager outcomes; critical-failure avoidance on lockpicks and alchemy |

**Two attributes have zero in-fight effect by design** (SPEED, PERSONALITY). This is
deliberate and load-bearing: it is the structural guarantee that the sheet is broader than
a damage calculator. A build that dumps them is playing a Souls character; a build that
invests in them is playing a Morrowind character; both must be able to finish the game.

**AR-1 guard, explicit:** SPEED must never affect locomotion **inside** the fight. The
moment `COMBAT` is active, movement is animation/root-motion authoritative per the
Arbitration Rule and SPEED's contribution is clamped to zero. A stat that made you circle
a boss faster would be Morrowind contaminating the fight and fails the piece.

### 2. Two streams — where attribute points come from

This is the mechanical heart of S2's split.

| Stream | Source | Rate | Owner |
|---|---|---|---|
| **Bought** | One point per level, freely allocated, spent at a HEARTH | 1 per level; L82 first clear ⇒ **81 points** | Souls |
| **Earned** | A skill crossing any multiple of **15** grants **+1 to its governing attribute**, free and automatic | **27 points** over a typical first clear (RI-PRG03 §3) | Morrowind |

**Design target: earned points are 22–28% of all allocated points.** At the typical first
clear (L82) that is 27 / (81 + 27) = **25.0%**. Big enough that your play style visibly
shapes your sheet — a player who picked every lock in the game arrives with AGILITY they
never bought — and small enough that it never becomes an optimisation to grind rather than
to play. Earned points obey the same 99 cap and cannot be redirected.

Governing attributes for each skill are in RI-PRG03 §2.

### 3. Soft caps — the actual curves

**VIGOUR → max HP.** Base 300 at VIG 10.

| VIG band | HP per point | HP at band end |
|---|---:|---:|
| 10 → 27 | +26 | 742 |
| 27 → 40 | +14 | 924 |
| 40 → 60 | +6 | 1,044 |
| 60 → 99 | +2 | 1,122 |

Sampled: VIG 10 = 300 · 15 = 430 · 20 = 560 · **27 = 742 (soft cap)** · 30 = 784 ·
35 = 854 · **40 = 924 (hard cap)** · 50 = 984 · 60 = 1,044 · 99 = 1,122.
Points 40→99 (59 levels, ~1.9M souls) buy **198 HP**. That is the point: the curve makes
"more HP" a bad answer to a hard boss after 40, and getting better a good one.

**ENDURANCE → max stamina.** Base 80 at END 10.

| END band | Stamina per point | Stamina at band end |
|---|---:|---:|
| 10 → 20 | +4.0 | 120 |
| 20 → 30 | +2.5 | 145 |
| 30 → 40 | +1.2 | 157 |
| 40 → 99 | +0.4 | 181 |

Sampled: END 10 = 80 · 15 = 100 · **20 = 120 (soft cap)** · 25 = 132.5 · **30 = 145
(hard cap)** · 40 = 157 · 99 = 181.
Stamina **regen** rate: `+0.30/s per point from END 10 to END 25`, flat thereafter — a
much harder cap than the pool, because regen is the stat that actually decides fights and
must not be buyable indefinitely. Stamina *behaviour* inside the fight (spend, regen delay
after a swing, block-through) is owned by `corpus/10-combat/`; this item owns only the
pool and regen numbers those systems read.

**Attribute soft caps at a glance:**

| Attribute | Primary soft cap | Hard cap | What happens past hard cap |
|---|---:|---:|---|
| VIGOUR | 27 | 40 | +2 HP/pt (near-worthless) |
| ENDURANCE | 20 | 30 | +1.2 then +0.4 stamina/pt; regen flat past 25 |
| STRENGTH | 40 | 60 | scaling `+0.005/pt`; equip load keeps rising linearly (the one uncapped return) |
| AGILITY | 40 | 60 | scaling `+0.005/pt`; lockpick tier 5 reached at 60, nothing above |
| SPEED | 35 | 50 | move speed capped at 1.28× base; travel-time modifier caps at −18% |
| WILLPOWER | 30 | 50 | +1 spell slot at 15/25/35/50, none after |
| INTELLECT | 40 | 60 | scaling `+0.005/pt`; 4th ingredient effect at 80 is the last unlock |
| HIST-BOND | 40 | 60 | scaling `+0.005/pt` |
| PERSONALITY | 45 | 70 | price multiplier hits its 0.80/0.60 clamps at ~70 |
| LUCK | 30 | 50 | buildup rate flattens; cache-reveal chance caps |

### 4. Scaling grades — what S/A/B/C/D/E actually mean

A weapon's damage against a target is:

```
AR = base_attack + Σ_stat [ base_attack × gradeCoeff(effective_grade) × scalingBonus(stat) ]
```

`gradeCoeff` — the letter, as a number:

| Grade | S | A | B | C | D | E |
|---|---:|---:|---:|---:|---:|---:|
| Coefficient | **1.00** | **0.80** | **0.62** | **0.46** | **0.32** | **0.18** |

`scalingBonus(stat)` — piecewise-linear, normalised 0→1, soft-capping hard at 40:

| Stat | 1 | 10 | 18 | 20 | 25 | 30 | 35 | **40** | 45 | 50 | 60 | 70 | 80 | 99 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Bonus | 0.000 | 0.160 | 0.320 | 0.371 | 0.500 | 0.620 | 0.740 | **0.850** | 0.890 | 0.920 | 0.950 | 0.970 | 0.985 | 1.000 |

**Worked example — a base-130 weapon, bonus damage added by scaling:**

| Grade | stat 25 | stat 40 | stat 60 | stat 99 | gain 40→99 |
|---|---:|---:|---:|---:|---:|
| S | +65 | +110 | +124 | +130 | +20 (18%) |
| A | +52 | +88 | +99 | +104 | +16 |
| B | +40 | +69 | +77 | +81 | +12 |
| C | +30 | +51 | +57 | +60 | +9 |
| D | +21 | +35 | +40 | +42 | +7 |
| E | +12 | +20 | +22 | +23 | +3 |

Read the last column: **59 attribute points past the soft cap buy an S-scaling weapon
+20 damage.** That is the anti-grind guarantee. The soft cap is not a suggestion.

**Effective grade ≠ printed grade.** Per seam S3, the *skill* you have with a weapon class
degrades or promotes its printed scaling grade. Full rules in RI-PRG03 §4; summary: below
the weapon's skill requirement you lose 1–3 grade steps, at requirement + 25 you gain one
(capped at S). This is how a use-based skill affects damage **without ever affecting
whether the swing connects** (S1).

### 5. Six characters who are not "quality build"

The success test for this item. Each is legal, viable, and mechanically distinct.

| Name | Sheet at ~L80 | Plays like |
|---|---|---|
| **The Shell-Warden** | STR 55, VIG 40, END 30, rest ≤14 | Greatshield and greataxe. Max equip load, heaviest armour in the game, cannot pick a lock, cannot afford anything (PER 10, Mercantile 10 ⇒ **1.30× buy / 0.34× sell**), solves quests by killing. |
| **The Fence** | PER 60, AGI 45, SPEED 40, LUCK 35, VIG 25, END 22 | Never wins a straight fight. Sits on both price clamps — **0.80× buy / 0.60× sell**, ~3× the purchasing power of the Shell-Warden — picks tier-5 locks, out-walks pursuit, resolves five of the game's quest lines by talk, bribe and theft. |
| **The Root-Speaker** | HIST 50, WIL 40, VIG 32, END 22, PER 30 | Restoration and Hist-invocation. Deepest HEARTH attunement in the game, holds Hist-faction ranks a fighter can never reach, fragile in the open. |
| **The Alchemist-Assassin** | INT 45, AGI 40, LUCK 40, SPEED 32, VIG 22 | Reads all four effects on every ingredient, poisons weapons for the highest LUCK buildup in the game, sneaks past two thirds of the R5 roster rather than fighting it. |
| **The Marsh-Runner** | SPEED 50, END 30, VIG 30, AGI 30, STR 18 | Fastest traversal in the game (−18% travel time, all Athletics thresholds), light-roll at all times, kills slowly, sees more of the map per hour than anyone. |
| **The Sworn Blade** | STR 40, AGI 40, VIG 32, END 26 | *This is* quality build. It is legal, it is fine, and it is exactly one of six — not the whole menu. |

If a critic cannot construct at least five materially different one-sentence descriptions
from the shipped sheet, this item has failed regardless of every number above.

## Comparison method

1. **Sheet completeness.** Load `game/src/data/stats.json` (or the attribute definition
   module). **Assert exactly 10 attributes exist**, that their ids match the ten above, and
   that every one has a non-empty `effects` list.
2. **Breadth test — the "not just damage" assertion.** For each attribute, classify each
   effect as `in_fight` or `out_of_fight`. **Assert at least 7 of 10 attributes have ≥1
   `out_of_fight` effect**, and **assert exactly 2 attributes (SPEED, PERSONALITY) have
   zero `in_fight` effects.** Then **assert no two attributes have identical effect-key
   sets** — this catches "stats that all do the same thing".
3. **Soft-cap curves.** Compute HP at VIG ∈ {10,20,27,40,60,99} and stamina at
   END ∈ {10,20,30,40,99} from the shipped formula. **Assert HP within 5% of
   {300, 560, 742, 924, 1044, 1122}** and **stamina within 5% of {80, 120, 145, 157, 181}**.
   Then **assert `HP(99) − HP(40) ≤ 0.25 × HP(40)`** — past the hard cap, 59 points must buy
   less than a quarter again. A linear HP curve fails this outright.
4. **Scaling grade separation.** For a base-130 weapon at stat 40, compute bonus damage for
   each grade. **Assert the six values are strictly decreasing and that S ≥ 2.0 × D.**
   Then **assert `bonus(grade, 99) − bonus(grade, 40) ≤ 0.20 × bonus(grade, 40)`** for
   every grade — the soft cap must actually cap.
5. **Two-streams ratio.** Sim or replay a typical first clear (RI-PRG06 typical model).
   Count attribute points from levels vs from skill 15-threshold crossings. **Assert the
   earned fraction is in [0.19, 0.31]** (target 0.250). Below 0.20 the Morrowind half is cosmetic;
   above 0.32 grinding beats playing.
6. **AR-1 guard.** `grep` the movement/locomotion module for any read of the SPEED
   attribute. **Assert SPEED is never read while combat state is active**, or that its
   contribution is explicitly clamped to zero in `COMBAT`. Any in-combat SPEED term is
   Morrowind leakage into the fight = **automatic fail**.
7. **The six-characters test (manual, mandatory).** Hand a fresh agent only
   `game/src/data/stats.json` and ask it to write five *materially different* one-sentence
   character descriptions in which the differentiating clause is **not** about weapon
   damage. **Assert it produces five.** Record them in the verdict. If four or fewer, the
   sheet has failed the breadth mandate of S2 no matter what the curves say.

## Scoring

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| Completeness | 10 attributes, all documented | 10 attributes present | fewer than 8, or Souls' 8 copied verbatim |
| Breadth | ≥8 attributes with out-of-fight effects; 2 with none in-fight | ≥7 / exactly 2 | every attribute is a damage or HP stat |
| Curves | all anchors within 3%; post-cap gain ≤15% | within 5%; post-cap ≤25% | HP or stamina linear in the attribute |
| Grades | strictly decreasing, S ≥ 2.2×D, cap holds | S ≥ 2.0×D, cap holds | grades within 30% of each other (letters are decoration) |
| Two streams | earned fraction 0.22–0.28 | 0.19–0.31 | no earned stream at all (pure Souls) or >0.45 (grind dominates) |
| Six characters | 6 distinct descriptions | 5 | ≤4 → **item fails regardless of all other axes** |

**Failure threshold: any axis below 6.** The six-characters axis is the item's reason for
existing; it cannot be traded against numerical accuracy elsewhere.

## How we lose

- **All ten stats are damage stats with different names.** The single most likely failure.
  A builder implements STR/AGI/INT/HIST properly, then implements SPEED as "+2% attack
  speed" and PERSONALITY as "+3% damage vs humanoids" because those are easy to code and
  easy to feel. The sheet is now Souls' sheet with two dead entries and S2's Morrowind half
  is unbuilt. Caught by method 2 and, decisively, method 7.
- **Out-of-fight effects exist in the data but nothing reads them.** PERSONALITY has a
  documented price multiplier and the merchant code never calls it. This is worse than not
  shipping the stat, because it passes methods 1–2 and fails only method 7 and RI-PRG05's
  price assertions. Critics must verify the *call site*, not the definition.
- **No soft caps.** Linear HP means the answer to every hard encounter is "buy 15 VIGOUR",
  which is both the least interesting answer and the one that makes RI-PRG01's expensive
  late levels feel mandatory rather than optional. Caught by method 3.
- **Grade letters that don't separate.** If S is only 20% better than C, weapon choice
  stops being a build decision and becomes a moveset preference. Caught by method 4.
- **The earned stream is dropped as "confusing".** Skill-threshold attribute grants are fiddly
  to surface in UI. If they get cut, S2's Morrowind half is gone and levelling is pure Dark
  Souls. Caught by method 5.
- **The earned stream is *too* generous** and the optimal play becomes grinding lockpicks
  on a door for forty minutes. Morrowind's own worst failure mode, imported wholesale. This
  is why RI-PRG03 has the Cost Gate, and why method 5 has an upper bound as well as a lower.
- **SPEED leaks into the fight.** Somebody adds SPEED to the movement controller without a
  combat-state check because it "feels bad" that the stat does nothing in a boss arena.
  That is an AR-1 automatic fail and it will be reported as a *feel improvement*.
- **Two attributes are strictly dominated** — nobody ever takes LUCK or WILLPOWER because
  their effects are all conditional. The sheet is nominally 10 wide and practically 8. Only
  method 7, run honestly against a real build spreadsheet, catches this.

## Provenance note

**Everything in this item is `constructed`.** No number here is recalled from, or measured
in, Dark Souls or Morrowind.

The *structure* draws on both — the Souls stat spine (Vigor/Endurance/Strength/Dexterity/
Intelligence/Faith/Vitality-equip-load/Attunement/Luck) and Morrowind's eight attributes
(Strength, Intelligence, Willpower, Agility, Speed, Endurance, Personality, Luck) — and
those lineages are `canonical-recall`, confidence medium. Two reconciliations are original
design decisions and should be read as rulings, not recollections:

1. **STRENGTH absorbs Souls' Vitality.** Morrowind puts encumbrance on Strength; Souls puts
   equip load on a dedicated Vitality stat. We use Strength for both scaling and equip load
   and delete Vitality. This buys a free slot for PERSONALITY without widening the sheet
   past 10, and it is why RI-PRG07's load formula is STR-dominant.
2. **HIST-BOND occupies the Faith slot.** Morrowind has no Faith attribute; Black Marsh has
   the Hist. The mechanical role (a second caster stat, restoration-flavoured, with faction
   gating attached) is Souls' Faith; the fiction is setting-native. **The name is a
   placeholder** — `corpus/50-world/` and `corpus/60-lore/` own the final noun, and renaming
   it must not change any number in this file.

Confidence is **high** on internal consistency (all tables are generated from the stated
formulas and cross-check against RI-PRG01, RI-PRG03, RI-PRG06 and RI-PRG07) and **medium**
on the specific soft-cap locations (27/20/40) — those are Souls-shaped guesses that should
be re-tuned against real combat TTK data from `corpus/10-combat/` once it exists.
