---
id: RI-WLD11
title: Environmental hazards — the thirteen, the telegraph law, and the one instant death
kind: structure
side: morrowind
judges: [world.hazard.environment, world.weather.systems, world.terrain.form, world.region.identity]
provenance: constructed
confidence: medium
blind_pair: no
---

## The bar

A hazard is the world's way of having an opinion about where you are. Morrowind's blight storms,
Vvardenfell's ash, the sixth-house diseases and the sheer cost of walking somewhere you were not
meant to be yet are the reason that province feels like a place rather than a level. Modern games
mostly do the opposite: a damage volume with a red vignette, no tell, no counter, and no reason it
is there.

The bar is **thirteen named environmental hazards, one owned by each of the thirteen regions**, each
of which (a) has a **perceptual tell on a channel other than damage**, available at least **2.0 s and
15 m** before it can hurt you, (b) has at least **two counters** that are not "have more health",
(c) costs a **clock, not a health bar** — attrition hazards may take at most **1.2% of max HP per
second** — and (d) is **confined**: no hazard may appear in more than **three** regions, and each
region's signature hazard appears in **no other region at all**.

There is exactly **one** exception to the telegraph law and it is declared, not discovered: the
**voriplasm** of the Deep Marshes, which is an animal, moves toward you, and kills. It is the only
instant death in the province and it has the largest tell in the game — *the ground is walking at
you* — and it exists so that the tier-5 region has one thing that is genuinely not survivable.

Two failure modes bracket this item, and they are the same two that bracket `RI-WLD10`. Too little,
and the world is a flat surface with monsters on it and the danger tiers in `regions.json` mean
nothing. Too much, and every region is a damage volume, the player learns to sprint through
everything with a healing item held down, and hazards become a tax rather than a decision. **A
hazard that cannot be avoided by knowing something is not a hazard, it is weather with damage.**

## The reference artifact

### 1. The taxonomy

| Class | What it does | Damage discipline | Example |
|---|---|---|---|
| `ATTRITION` | chips you while you remain | **≤ 1.2% max HP/s**, never more | salt-storm, cold exposure |
| `GATE` | denies passage until a condition changes | **0 damage** | high tide over a causeway |
| `TRAP` | one discrete event, then over | ≤ **18%** max HP, plus a state | comb collapse, a fall |
| `VECTOR` | inflicts a **named affliction** (`RI-PRG09`) | 0 direct damage | fever fog, dye-fume |
| `STRANDING` | costs you **time and route**, never health | 0 damage | the flats flooding behind you |
| `KILL` | kills | **fatal** | voriplasm — and nothing else |

`GATE` and `STRANDING` doing **zero damage** is deliberate and load-bearing: the tide is the
province's most important hazard and it must never be experienced as a damage-over-time effect. It
costs you the six real minutes `regions.json` already promises for the Eastern Rootlands, and that is
the whole punishment.

### 2. The thirteen — one per region

| # | Region | Tier | Hazard | Class | Tell (channel, lead) | Counters (≥ 2 required) |
|---|---|---:|---|---|---|---|
| 1 | **Western Rootlands** | 1 | **Press-gang water** — Dres slaver punts working the paddy channels at night | `STRANDING` | visual: lantern lines on the water at 200 m; audio: pole-splash cadence | travel by day · Wet Ledger standing · take the root-arch road above the paddies |
| 2 | **Marauder's Coast** | 2 | **The flats flood** — 300 m of walkable mud becomes W4–W5 in one tide phase | `STRANDING` | the tide-pole's painted waterline (`RI-WLD06`); the *sound* of the flats draining | read the pole · wait 12 min · the bone-scaffold high road · a punt (`RI-TRV01` M4) |
| 3 | **Blackwood** | 2 | **Spore bloom** — luminous fungus shelves puff when disturbed within 3 m | `VECTOR` (droops) | visual: shelf gills flare 2.4 s before release; audio: a dry tick | walk wide · burn the shelf · Resist Common Disease · Argonian immunity (`RI-CHR02`) |
| 4 | **The Hive** | 2 | **Comb collapse** — the floor is comb and is load-bearing only sometimes | `TRAP` | visual: comb translucency and cell depth; audio: pitch of your own footfall changes | read the floor · walk the ribs · Acrobatics · a light equip load |
| 5 | **Eastern Rootlands** | 2 | **Cut off by the tide** — paths that exist for 6 of every 12 real minutes | `GATE` | the tide-pole; the stilt-rows visibly rising; the channel note dropping | timing · the barge (`RI-TRV01` BG-LIL-ARC) · swimming · being amphibious |
| 6 | **The Stone Forest** | 3 | **Pair-lightning** — wamasu arc between each other; the arc is the hazard, not the bite | `TRAP` | visual: the two beasts' dorsal lines charge white 1.8 s before discharge; audio: rising whine | break the line between them · kill one · Shock resistance · do not stand between two of anything |
| 7 | **The Salt Hills** | 3 | **Ridge exposure** — the only cold place in Argonia, and it is cold at night | `ATTRITION` 0.8%/s | visual: your own breath fogs; the grass rimes | fire · shelter (watchtowers every third hill) · warm clothing · move by day |
| 8 | **Thornmarsh** | 4 | **The thicket** — black needle-thorn 6 m tall; leaving the cut path costs blood and orientation | `ATTRITION` 0.6%/s + navigational | visual: the knife-marks on stems that mark the cut path; the ash on trodden ground | stay on the path · read the marks · a blade to cut · the Rootway |
| 9 | **Valus Ridge** | 4 | **The fall** — and hackwings that stagger you toward the edge | `TRAP` (fatal above 22 m) | visual: cloud *below* the path; audio: the rock-flute chord at 400 m tells you the height | lock-on to the hackwing · the inland path · Slowfall · poise |
| 10 | **The Clay Moor** | 4 | **Kiln ground and thirst** — floors fired from beneath, no standing water anywhere | `ATTRITION` 1.0%/s on kiln floors | visual: heat shimmer over live kilns; the clay's colour where it is hot | carried water · the fired-cold routes · naga-taught paths · footwear (which Argonians do not wear) |
| 11 | **Crimson Coast** | 4 | **Dye-fume** — open vats, and the guild denies it in writing | `VECTOR` (vat-lung, `RI-PRG09`) | visual: the fume layer sits at chest height and moves with the wind; audio: the harvesters' cough | upwind approach · a mask · Resist Poison · time the sea-squall |
| 12 | **Stone Wastes** | 5 | **Salt-storm** — visibility to 15 m, chip damage, and it hides the enemies too | `ATTRITION` 1.2%/s | visual: the storm wall crossing the crater-fields, 40 s out; audio: the salt hiss | shelter in a crater · a cloak · wait it out · use the cover on the enemies |
| 13 | **The Deep Marshes** | 5 | **Voriplasm** — living mud that moves toward you, swallows, and digests | **`KILL`** | **the largest tell in the game**: a 4 m patch of ground moving at 0.6 m/s toward you, wet-sucking audio at 30 m, and every corpse in the region is inside one | do not be near it · fire (it retreats 8 m) · high ground · levitation |

**Six of the thirteen do no damage at all.** That is the point of the item.

### 3. The laws

| # | Law | Test |
|---|---|---|
| **H1** | **Telegraph.** Every hazard has a tell on a channel *other than* its damage, perceptible **≥ 2.0 s** before the first damage frame and from **≥ 15 m**. | M58 |
| **H2** | **Escapability.** From the first damage frame, an unencumbered player at full stamina must be able to reach a safe cell within **6.0 s** for `ATTRITION`, and to have had **≥ 1.2 s** of avoidance window for `TRAP`. | M59 |
| **H3** | **Counters.** ≥ 2 declared counters per hazard, of which **≥ 1 must be knowledge or routing** (not an item, not a stat). Consumables alone do not satisfy H3. | M60 |
| **H4** | **Attrition is a clock.** ≤ 1.2% max HP/s, and no `ATTRITION` hazard may kill a player at full HP in under **80 s**. | M59 |
| **H5** | **Confinement.** No hazard in more than **3** regions; each region's signature hazard in **exactly 1**. | M57 |
| **H6** | **No scaling.** Hazard magnitudes are fixed. They do not read player level, and a region does not become safer because you levelled (seam **S9**). | M61 |
| **H7** | **Not in the arena.** No hazard volume may overlap a boss arena, a fog-gated encounter volume, or a HEARTH's safe radius. Hazards belong to the world. | M61 |
| **H8** | **One `KILL`.** Exactly one hazard in the province is fatal on contact, it is the voriplasm, and it lives in the tier-5 region. A second is a defect. | M57 |
| **H9** | **Hazards hurt everyone.** Every hazard applies to NPCs and enemies on the same terms. A salt-storm that only damages the player is a difficulty setting wearing a costume. | M62 |

### 4. Where hazards hand off

| Boundary | Owner | This item's obligation |
|---|---|---|
| Water depth, wading, drowning, `MIRED` | **`RI-WLD10`** | hazards read the band; they never redefine it. `MIRED` is a *state*, not a hazard; the voriplasm that eats you while mired is |
| Named diseases, their causes and cures | **`RI-PRG09`** | `VECTOR` hazards name an affliction id and nothing else. Vat-lung's cure is not defined here |
| Weather as a system (rain, storm, fog, cycles) | **`RI-WLD08`** / `world.weather.systems` | this item owns only what weather *does to you* |
| Region identity and the blind test | **`RI-WLD04`** | the hazard is one of the nine axes; it is not restated here |
| Falls as a combat event, hackwing stagger | **`RI-CMB05`** / `RI-AI05` | this item owns the *edge*, not the poise maths |
| Ambient events (the tide turning, fog rolling) | **`RI-WLD08`** E3 | the hazard is the consequence, the event is the announcement |

### 5. The data contract

`game/data/world/hazards.json`, schema `elder-souls/hazards@1`. Absence is exit **10**.

```jsonc
{
  "schema": "elder-souls/hazards@1",
  "hazards": [
    {"id":"voriplasm","name":"Voriplasm","class":"KILL",
     "regions":["The Deep Marshes"],"signature_of":"The Deep Marshes",
     "tell":{"channels":["visual","audio"],"lead_s":6.0,"range_m":30.0},
     "damage":{"kind":"fatal"},
     "counters":["route:high-ground","knowledge:corpse-reading","item:fire","spell:levitate"],
     "applies_to_npcs":true,"scales_with_level":false},
    {"id":"salt-storm","name":"Salt-storm","class":"ATTRITION",
     "regions":["Stone Wastes"],"signature_of":"Stone Wastes",
     "tell":{"channels":["visual","audio"],"lead_s":40.0,"range_m":300.0},
     "damage":{"kind":"pct_max_hp_per_s","value":1.2},
     "counters":["route:crater-shelter","item:cloak","knowledge:storm-cadence"],
     "applies_to_npcs":true,"scales_with_level":false}
    // ... all 13
  ]
}
```

## Comparison method

Script: **`corpus/80-methods/m-wld11-hazard-census.mjs`** (M57; static, no browser — same shape and
exit codes as `m-wld10-water-census.mjs`).

**M57 — The census (static).** Load `game/data/world/hazards.json`; exit **10** if absent.
- **FAIL** if fewer than 13 hazards; if any region in `regions.json` is not the `signature_of`
  exactly one hazard; if any hazard lists > 3 regions; if a signature hazard appears in a second
  region; if more than one hazard has `class: "KILL"`; if the one that does is not `voriplasm` in
  The Deep Marshes; if fewer than 6 hazards have zero damage; if any `ATTRITION` value > 1.2.

**M58 — The telegraph probe (H1).** For each hazard, scenario `wld-hazard-<id>`: approach the
hazard along a scripted straight line at jog speed with a trace running.
- Locate the first frame the tell is emitted (a `hazard_tell` event; see the amendment below) and the
  first frame of damage or state change.
- **FAIL** if the gap `< 120 frames (2.0 s)`, if the tell first appears closer than 15 m, or if the
  tell's only channel is the damage itself.

**M59 — Escapability and the clock (H2, H4).** Stand in each `ATTRITION` hazard at full HP.
- Measure time to death. **FAIL** if `< 80 s`.
- From the first damage frame, run the shortest scripted path to a safe cell. **FAIL** if `> 6.0 s`
  at jog speed with `MEDIUM` equip load.
- For each `TRAP`, measure the avoidance window from tell to unavoidable commitment. **FAIL** if
  `< 1.2 s`.

**M60 — Counters (H3).** For each hazard, execute each declared counter in a scripted run and assert
it measurably reduces damage taken or opens the route.
- **FAIL** if any declared counter does nothing, if fewer than 2 work, or if none of the working
  counters is `route:` or `knowledge:` (a hazard beatable only by consumables is a tax).

**M61 — No scaling, no arenas (H6, H7).** Run M59 at character level 1 and level 60.
- **FAIL** if any hazard magnitude differs.
- Sample every hazard volume against every boss arena, fog-gate volume and HEARTH safe radius.
  **FAIL** on any overlap.

**M62 — Hazards hurt everyone (H9).** Spawn 3 NPCs and 3 enemies inside each `ATTRITION` hazard and
run 600 frames. **FAIL** if their HP is unchanged while the player's falls.

**M63 — The regional spread (S24).** Cross-check against `RI-WLD10` M47 and `RI-WLD04`: compute, per
region, the number of *distinct hazard classes* present.
- **FAIL** if any two regions have an identical hazard-class multiset **and** an identical signature
  hazard class — that is the hazard-shaped form of "everything is swamp with recoloured fog".
- **FAIL** if the six `GATE`/`STRANDING`/`VECTOR` hazards are all in the same three regions.

## Scoring

| Check | Weight | Pass condition |
|---|---:|---|
| **M57** census and confinement | **24** | 13 hazards, one signature each, exactly one `KILL` |
| **M58** telegraph law | 20 | every hazard ≥ 2.0 s / ≥ 15 m on a non-damage channel |
| M59 escapability and the clock | 16 | ≤ 6.0 s escape, ≥ 80 s to death, ≥ 1.2 s trap window |
| M60 counters | 14 | ≥ 2 working, ≥ 1 route-or-knowledge |
| M61 no scaling, no arena overlap | 12 | identical at L1 and L60; zero overlaps |
| M62 hazards hurt everyone | 8 | NPCs and enemies take the same hazard |
| M63 regional spread | 6 | no two regions with the same hazard shape |

- **≥ 85** — the world has opinions.
- **70–84** — playable, gap named.
- **< 70** — **we lose.**

**Automatic fail regardless of score:** a second `KILL` hazard; any untelegraphed damage volume; a
hazard inside a boss arena or a HEARTH radius; a hazard that scales with player level (**S9**, AR-1);
a hazard the player only learns about by dying to it with no tell to have read; a hazard that damages
only the player (**H9**).

## How we lose

- **The red vignette.** A trigger volume, a damage tick, a screen effect, no tell, no counter. It is
  the default output of every engine's volume tool and it is what M58 is aimed at.
- **Everything is swamp with a recoloured fog per region** — the hazard-shaped version: thirteen
  regions, one "poison gas" volume, thirteen tint values. **S24**; M63 and `RI-WLD04`'s blind region
  test are the enforcement.
- **Hazards become DPS.** Someone tunes the salt-storm up because it "isn't threatening", it becomes
  a fight you cannot hit back at, and the player learns to hold a healing item down and walk through
  everything. H4's 1.2%/s ceiling is deliberately low for this reason.
- **Every hazard is a consumable check.** Three potions solve the province, the inventory becomes the
  answer to the world, and knowledge — the thing `RI-WLD06` and `RI-EXP04` are built on — buys
  nothing. H3's route-or-knowledge clause exists for this.
- **The tide becomes damage.** The single most likely specific error: `STRANDING` implemented as
  drowning damage rather than as six lost minutes. It converts the best system in the province into
  the worst kind of hazard, and it makes `RI-TRV01`'s tideway inversion a punishment instead of a
  route.
- **The voriplasm gets nerfed.** It kills a playtester, someone makes it a damage-over-time, and the
  Deep Marshes stop being tier 5. The correct response to "it killed me" is that it is visible from
  30 m and moves at 0.6 m/s.
- **Hazards that only exist in the region brief.** `regions.json` names a hazard for all thirteen
  regions today; the risk is that the *text* ships and the *volume* does not. M57 reads the data
  file, never the brief.
- **The player-only hazard.** The storm strips the player's health and the bandits in it are fine.
  It reads instantly as a game rule rather than as weather, and it is H9's automatic fail.
- **No hazard audio.** Every tell in §2 has an audio channel and audio is unreachable through the
  harness (`HARNESS.md` §3), so **half of every telegraph in this item is structurally unmeasurable**
  and must be signed off by a human. `RI-AUD03` owns it. This item flags it rather than pretending
  M58 covers it.

## Provenance note

- **`constructed`, confidence medium.** The taxonomy, all thirteen hazards, every threshold in §3,
  and the whole of §5 are ours. Confidence is *medium* rather than high because the escape-time and
  telegraph thresholds (6.0 s, 2.0 s, 15 m, 1.2 s, 1.2%/s) are reasoned from the corpus's existing
  locomotion speeds and `RI-AI02`'s telegraph doctrine rather than measured against anything, and
  they are the numbers most likely to move once a human has played a salt-storm.
- **Not ours, cited:** all thirteen regions, their difficulty tiers and their one-line `hazard`
  fields come from `corpus/50-world/regions.json` — this item's §2 is an expansion of that column
  into a testable form and must not contradict it. The Deep Marshes' *"THE GROUND IS AN ANIMAL —
  voriplasm swallows and digests; instant-death sinks"* is quoted from it and is the origin of H8.
  The tide's four states and 12-minute cycle are `RI-WLD08` §1; its amplitude is `RI-WLD10` §7. The
  six-real-minute cut-off in the Eastern Rootlands is `regions.json`'s own figure. Argonian disease
  and poison resistance is `RI-CHR02` (and, upstream, verified UESP: Argonians carry Resist Poison
  100% and Resist Common Disease 75% — `RI-PRG09` §Provenance).
- **`canonical-recall`, confidence medium:** the debt to Morrowind's blight storms and ash storms as
  the model for a region-scale attrition hazard with a visual wall and a mechanical effect. Recalled,
  not verified this session; it shapes the design and is not cited as a number.
- **Deliberate divergence, declared:** Morrowind's blight storms *did* scale in the sense that the
  Ghostfence's failure changed them over the main quest. Ours do not scale with anything, ever
  (**H6/S9**). Region danger is fixed and the player's competence is the variable.
