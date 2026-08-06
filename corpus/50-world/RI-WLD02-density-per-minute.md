---
id: RI-WLD02
title: Density per minute of travel — the headline world metric
kind: number
side: morrowind
judges: [world.density, world.placement, world.poi, world.encounters, world.sightlines]
provenance: constructed
confidence: high
blind_pair: no
---

## The bar

Vvardenfell's real achievement is not its size, it is that **you cannot walk for one minute without
something asking to be walked to**. That is the property we are copying, and it is measurable. The
governing number is **Time To Next Interesting Thing (TTNIT)**: from any point on the road network,
walking forward at 2.0 m/s, the time until the player enters the 40 m discovery radius of an unvisited
point of interest must have a **median ≤ 45 s and a 90th percentile ≤ 90 s**. Supporting that, the road
corridor must carry **≥15 POIs per kilometre**, the world must hold **≥300 named locations
(20.7 / km²) and ≥600 unnamed interactive landmarks**, and at any point on walkable ground **at least
two distinct landmark silhouettes must be visible**. "Dense" never means trees. A tree is not a POI. A
rock is not a POI. Density is *authored reasons to change direction*.

## The reference artifact

### 1. What counts as a POI (the definition the critic counts against)

A POI is a world entity carrying a `poi` tag and satisfying **all three**:

1. **Visible or discoverable** — it has a silhouette readable at ≥60 m, *or* it is signposted /
   mentioned in dialogue / marked by a track.
2. **Has a reason** — reaching it yields at least one of: a named interior door, a hand-placed named
   item, an NPC with dialogue, a readable (book/note/inscription/grave-marker), a bonfire, a quest
   trigger, a unique creature, or a shortcut.
3. **Is authored** — it is a placed, individually-edited entity, not an instance of a scatter system.

**Explicitly NOT POIs:** trees, rocks, grass, generic clutter props, ambient wildlife, respawning
ordinary enemies with no loot, terrain features with nothing on them, and anything emitted by a
procedural scatter pass. A critic finding scatter props tagged `poi` fails the piece outright.

**Tiers:**

| Tier | Definition | Discovery radius | World target | Fail floor |
|---|---|---|---|---|
| **A — Named interior** | Named, has a door to an interior cell (settlement building, cave, tomb, xanmeer, dungeon) | 40 m | **250** (160 settlement + 90 wilderness) | 150 |
| **B — Named exterior site** | Named, no interior: shrine, wreck, camp, standing stone, gibbet, egg-clutch, bonfire, wayshrine, ruin-field | 40 m | **210** | 126 |
| **C — Unnamed authored landmark** | Unnamed but individually placed and interactive: a lootable corpse with a note, a rare alchemy node, a lone enemy at a fire, a fallen idol, a trapped chest, a hanging cage | 25 m | **600** | 360 |
| | **Total** | | **1,060** | 636 |

Named locations (A+B) = **460**, i.e. **31.7 / km²** — above Vvardenfell's ≈23/km², because our land
area is smaller and our regions are more differentiated. Total POI density = **73 / km²**.

### 2. Headline density targets

| # | Metric | Target | Fail below | How it's counted |
|---|---|---|---|---|
| D1 | **TTNIT median** (walk 2.0 m/s on roads) | **≤ 45 s** | > 75 s | scripted walk, 40 m radius, unvisited only |
| D2 | **TTNIT p90** | **≤ 90 s** | > 150 s | same |
| D3 | **POIs per km of road corridor** (±40 m of road centreline) | **≥ 15** | < 9 | static count from world data |
| D4 | **POIs per minute of road walking** (any tier, ±40 m) | **≥ 1.4** | < 0.8 | = D3 × 0.12 |
| D5 | **Tier A or B per 4 minutes of road walking** | **≥ 1.0** | < 0.5 | scripted walk |
| D6 | **Wilderness landmarks per km²** (Tier A+B, outside settlement radius) | **≥ 18** | < 10 | static count |
| D7 | **Named interiors per settlement** | capital 26 / city 18 / town 12 / village 7 / minor 3 | −40% of target | count doors |
| D8 | **Named NPCs per settlement** | capital 45 / city 30 / town 20 / village 12 / minor 5 | −40% | count actors with unique names |
| D9 | **Hostile groups per minute of wilderness road walking** | **0.7 – 1.2** | < 0.4 or > 2.0 | aggro events / min |
| D10 | **Hostile groups per minute inside a Souls-loop dungeon** | **2.0 – 3.5** | < 1.2 | aggro events / min |
| D11 | **Creature sightings per minute in wilderness** (hostile + ambient) | **≥ 3.0** | < 1.5 | entities entering frustum |
| D12 | **Sightline rule** — distinct landmark silhouettes visible from a random walkable point | **≥ 2**, at 95% of sample points | < 2 at >20% of points | raycast test, below |
| D13 | **Longest "nothing" stretch** on **settled-region** road network | **≤ 150 s** with no POI in 40 m | > 240 s | scripted walk, **outside declared void tracts** |
| **V5** | **Share of road-network kilometres with TTNIT > 3 min** (the negative-space floor) | **≥ 12%** | < 6% | scripted walk, whole network |
| **V6** | **Regions with median TTNIT > 2 min** | **≥ 2** | < 1 | scripted walk, per region |

> **AMENDED wave 0 (corpus-audit) — BAR-CRITIQUE-01 W2, and the direct RI-WLD02 / RI-WLD09
> contradiction (queue B2).** As written, D1, D2 and D13 were **global** floors: TTNIT median
> ≤45 s, p90 ≤90 s, longest nothing-stretch ≤150 s, *everywhere*. Three consequences, all bad:
>
> 1. **Deliberate emptiness became illegal.** Vvardenfell is not uniformly dense — Molag Amur,
>    the deep Ashlands and Sheogorad are long, hostile and empty, and that emptiness is where
>    scale, dread and the relief of arrival come from. A 150-second global cap forbids the Deep
>    Marshes from being the Deep Marshes.
> 2. **It invited the exact failure M7 exists to catch.** The cheapest way to satisfy a p90 is
>    to sprinkle. This item was simultaneously demanding POI inflation and scanning for it.
> 3. **It contradicted `RI-WLD09` outright.** RI-WLD09 §B4 requires ≥5 declared void tracts
>    totalling ≥14% of the landmass, each with a ≥240 s empty walk. **A critic handed both
>    items had to fail one of them**, and would have failed RI-WLD09, because this item is
>    older and has a scripted walk behind it.
>
> **Ruling: `RI-WLD09` wins on emptiness; this item wins on density; the two are made
> commensurable rather than one being deleted.** Density is a *rhythm*, and the original bar
> measured only its mean. Applied here exactly as RI-WLD09 §B4's "consequential amendment"
> specifies:
>
> - **D1, D2 and D13 are now settled-region thresholds**, scored over the road network
>   **outside** the void tracts declared in `game/data/world/voids.json`.
> - **V5 and V6 are added as peers of D1** — the negative-space floor. It is now possible to
>   fail this item for having *too little* emptiness, which is the correction.
> - **Inside a declared tract**, D13's cap rises 150 s → **600 s** and D9's hostile-group floor
>   drops 0.4 → **0.15** per minute.
> - **The score-0 clause `D3 < 9` is scoped to non-void road kilometres** (see §Scoring).
> - A tract only counts as declared if it passes RI-WLD09's V1–V9, including the witness-prop
>   rule. **Undeclared or failing emptiness is still measured by the settled-region
>   thresholds**, so "declare a void over the land we did not build" is not an escape.
>
> Full reasoning: `CORPUS-COHERENCE-01.md` §7.

### 3. Budget reconciliation (so the targets are provably achievable and provably not padded)

| Quantity | Value |
|---|---|
| Trunk road network | 25,331 m |
| Full road + track network target | 34,000 m |
| POIs within 40 m of a road (55% of total) | 583 |
| ⇒ POIs per km of road | **17.1** ✅ (target ≥15) |
| ⇒ POIs per minute of road walking (120 m/min) | **2.05** ✅ (target ≥1.4) |
| Off-road POIs | 477 over 14.5 km² = 33/km² |
| Mean off-road POI spacing | √(1/33) km ≈ **174 m** ≈ 87 s of blind cross-country walking |
| Wilderness Tier A+B (460 named − 160 settlement interiors − ~20 in-settlement Tier B) | 280 over ~13 km² non-settlement land = **21.5/km²** ✅ (target ≥18) |
| Hostile groups on roads (1 per 150 m) | ~227 groups, 1–4 each ⇒ ~450 wilderness enemies |
| Dungeon enemies (90 wilderness interiors × ~9) | ~810 |

### 4. Vvardenfell's approximate figures (the thing we are matching)

| Vvardenfell quantity | Figure | Provenance |
|---|---|---|
| Caves | 92 | community-data |
| Daedric ruins | 25 | community-data |
| Ancestral tombs | ~50 | canonical-recall |
| Dwemer ruins | ~25 | canonical-recall |
| Dunmer strongholds | 6 | canonical-recall |
| Imperial forts | ~10 | canonical-recall |
| Settlements (all sizes incl. camps and Velothi hamlets) | ~50 | canonical-recall |
| Shipwrecks, egg-mines, misc named exteriors | ~50 | canonical-recall |
| **≈ Total named exterior locations** | **≈ 300** | derived |
| Land area | ≈13–14 km² | derived (RI-WLD01) |
| **⇒ named locations per km²** | **≈ 22** | derived |
| NPCs on Vvardenfell (incl. guards/extras) | 2,824 | community-data |
| NPCs in Balmora alone | 94 | community-data |

### 5. Per-region POI allocation (sums to the world targets)

Tier A is split into settlement interiors (from the RI-WLD03 template, for every named and minor
settlement lying in that region) and wilderness interiors (caves, tombs, xanmeer chambers, loop-dungeons).

| Region | Land km² | A: settlement | A: wilderness | **Tier A** | Tier B | Tier C | Difficulty tier |
|---|---|---|---|---|---|---|---|
| Western Rootlands | 1.17 | 39 | 6 | **45** | 28 | 82 | 1 |
| The Stone Forest | 1.80 | 32 | 11 | **43** | 26 | 78 | 3 |
| Blackwood | 2.07 | 21 | 12 | **33** | 30 | 88 | 2 |
| The Salt Hills | 0.94 | 18 | 6 | **24** | 16 | 46 | 3 |
| Thornmarsh | 1.08 | 10 | 7 | **17** | 14 | 40 | 4 |
| Stone Wastes | 0.81 | 10 | 6 | **16** | 8 | 28 | 5 |
| Crimson Coast | 0.63 | 12 | 4 | **16** | 6 | 20 | 4 |
| The Deep Marshes | 1.26 | 6 | 8 | **14** | 18 | 48 | 5 |
| Eastern Rootlands | 1.44 | 3 | 8 | **11** | 22 | 62 | 2 |
| The Clay Moor | 0.81 | 6 | 5 | **11** | 12 | 32 | 4 |
| Valus Ridge | 1.71 | 0 | 10 | **10** | 25 | 60 | 4 |
| Marauder's Coast | 0.49 | 3 | 4 | **7** | 4 | 10 | 2 |
| The Hive | 0.31 | 0 | 3 | **3** | 1 | 6 | 2 |
| **Total** | **14.52** | **160** | **90** | **250** | **210** | **600** | |

Settlement-interior allocation: Helstrom 26 (Stone Forest); Lilmoth 18 + Blackrose 12 (Western
Rootlands); Stormhold 18 (Salt Hills); Gideon 12 (Blackwood); Archon 12 (Crimson Coast); Thorn 7
(Thornmarsh); Soulrest 7 (Stone Wastes); plus the 16 minor settlements at 3 each — 3 in Blackwood,
3 in Western Rootlands, 2 each in the Stone Forest / Deep Marshes / Clay Moor, and 1 each in
Thornmarsh, Marauder's Coast, Stone Wastes and Eastern Rootlands.

## Comparison method

**M6 — The scripted walk (the critic's primary instrument).**
1. Load world data. Build the road graph. Generate a walk route covering **100% of trunk road legs**
   in both directions (≈50.7 km, ≈7 h sim-time at 2.0 m/s — run headless at fixed timestep, not real time).
2. Drive the capsule at exactly 2.0 m/s. Combat disabled; enemies still spawn and aggro-log.
3. Every 0.5 s, record: position, the set of `poi`-tagged entities within 40 m (25 m for Tier C), the
   set of entities in the camera frustum, and any aggro state transitions.
4. Screenshot every 15 s at 1280 × 720, eye height 1.7 m, FOV 70°, facing travel direction.
5. Compute D1–D6, D9, D11, D13 directly from the log.
6. **Reject any POI counted more than once**; TTNIT is over *unvisited* POIs only.

**M7 — Anti-scatter audit.** Sample 60 random `poi`-tagged entities. For each, dump its transform,
mesh id and component list. **Fail the piece if >5 of 60** are (a) instances of a mesh appearing >40
times in the world with identical component sets, or (b) have no interaction component, no interior
door, no dialogue actor, no readable and no loot. This is the "dense means trees" trap; it is the most
important single check in this file.

**M8 — Sightline test (D12).** Sample 200 uniformly random walkable points. At each, cast 72 rays in a
horizontal fan (5° apart) plus 3 elevation bands (0°, +5°, +12°), max range 900 m. Count distinct
entities hit that are tagged `landmark` (xanmeer, tower, tree-of-note, ruin, settlement silhouette,
rock flute, kiln smoke, hive). **Pass: ≥2 distinct landmarks at ≥95% of points, ≥1 at 100%.**
Report the median count; target median ≥3.

**M9 — Cross-country TTNIT.** Repeat M6 along 20 straight-line transects of 800 m each, at random
bearings from random road points, ignoring roads. **Pass: median TTNIT ≤ 90 s, p90 ≤ 180 s.** Cross-
country is allowed to be sparser than the road; it is not allowed to be empty.

**M10 — Settlement counts (D7, D8).** For each of the 24 settlements, count: building meshes, doors
that load an interior cell, actors with unique names, actors with ≥1 non-shared dialogue topic.
Compare against the per-tier template in `settlements.json`.

**M11 — Encounter rate (D9, D10).** From the M6 aggro log, compute hostile-group aggro events per
minute, segmented by region and by interior/exterior. Also compute the *idle* fraction: proportion of
walk time with zero hostiles within 60 m. **Pass: idle fraction 0.55–0.80 on roads** — below 0.55 the
overworld has become a Souls corridor (an AR-2 Morrowind-leakage violation in reverse); above 0.80 it
is empty.

## Scoring

Score 0–10 on the weighted mean of D1–D13 **plus V5 and V6** (each scored 0/1/2 →
fail/pass/exceed), weights: D1 ×3, D3 ×3, D12 ×2, D7 ×2, D8 ×2, **V5 ×2, V6 ×1**, all others ×1.
D1, D2 and D13 are computed over **settled-region** road kilometres only (amended wave 0, W2).

| Score | Condition |
|---|---|
| 10 | Every metric passes, TTNIT median ≤30 s, D12 median ≥4 landmarks, M7 clean |
| 8 | All metrics at target; M7 ≤2/60 flagged |
| 6 | D1/D2 pass, ≤3 other metrics below target |
| 4 | TTNIT median 45–75 s, or D3 in 9–15 |
| 2 | TTNIT median >75 s but POIs exist |
| **0 — WE LOSE** | Any of: M7 flags >5/60 (scatter tagged as POI); **D3 < 9 over non-void road kilometres** (fewer than 9 POIs per km of settled road — amended wave 0, W2); D12 fails at >20% of points (you can stand somewhere and see nothing worth walking to); the total named-location count is below the fail floor of 276 (A+B); **V5 < 6% — a world with no negative space anywhere is as broken as one with no density, and this clause is what makes that failable** |

## How we lose

- **"Dense" meaning trees.** 400,000 instanced palms and 12 things to do. This is the default failure of
  every procedurally-vegetated world and M7 exists solely to catch it. Foliage density is *art*
  (RI-WLD04); it contributes exactly zero to this item's score.
- **POI inflation.** Tagging every rock as a POI to make D3 pass. M7 samples and dumps components.
- **Uniform density.** Every kilometre of road identically eventful, so nothing is a journey and
  arriving anywhere feels like nothing. V5/V6 exist for this, and before the wave-0 amendment
  this item actively mandated it.
- **Voids declared over land nobody built.** The inverse cheat, once emptiness became legal.
  `RI-WLD09` V1–V9 — especially the witness-prop rule (≥6 authored, non-POI props per km²:
  *emptiness somebody walked through has litter in it, and unbuilt terrain is spotless*) — is
  what separates the two, and an undeclared or failing tract falls back to this item's
  settled-region thresholds.
- **Density that is all in the towns.** 460 named locations, 400 of them inside the 8 settlements, and
  25 km of empty road between them. D6 and D13 catch this.
- **Density that is all on one road.** The Helstrom–Gideon Imperial road is beautiful and the Clay Moor
  track is 36 minutes of nothing. M6 walks *every* leg in both directions for this reason.
- **Repetition read as density.** Forty identical "bandit camps" with the same three tents and the same
  loot. They count as POIs by the letter of the definition and they are worthless. Enforced by
  RI-WLD05's uniqueness inventory and by M7's "mesh appearing >40 times with identical components" clause.
- **Nothing on the skyline.** Flat marsh with fog at 120 m. D12 fails, the player has no reason to pick
  a direction, and RI-WLD06 (navigation without markers) becomes unsatisfiable. Density and
  navigability are the same problem seen twice.
- **Enemy density used as a substitute for content density.** Making the road fun by putting a fight
  every 60 m. That is a Souls corridor, and per the Arbitration Rule Souls does not own the overworld.
  M11's idle-fraction band catches it from both sides.
- **Counting the same POI on the way out and the way back** to hit D4. Deduplication is mandatory.

## Provenance note

- `community-data`, confidence medium: Vvardenfell's 92 caves, 25 Daedric ruins, 2,824 NPCs, and
  Balmora's 94 NPCs, from UESP/Fandom category counts and forum tallies retrieved 2026-08-05.
- `canonical-recall`, confidence medium: the counts for ancestral tombs (~50), Dwemer ruins (~25),
  strongholds (6), forts (~10), settlements (~50) and misc named exteriors (~50). These are recalled,
  not verified, and the ≈300 total therefore carries ±20% error. The derived ≈22 named locations/km²
  is correspondingly ±25%. **A critic must not present ≈300 or ≈22/km² as measured facts.**
- `constructed` (binding): the POI definition and its three-clause test, the tier system and discovery
  radii, every target and fail floor in §2, the 1,060-POI budget, the per-region allocation, and all
  measurement procedures M6–M11. TTNIT is a metric invented for this project; it exists because
  "density" is otherwise unfalsifiable, and it is binding precisely because it can be counted.
- The budget reconciliation in §3 is `derived` arithmetic from the constructed budget and the
  RI-WLD01 road lengths; it is included so a critic can verify the targets are internally consistent
  rather than aspirational.
