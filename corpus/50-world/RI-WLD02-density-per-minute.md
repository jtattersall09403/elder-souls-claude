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
| D13 | **Longest "nothing" stretch** anywhere on the road network | **≤ 150 s** with no POI in 40 m | > 240 s | scripted walk |

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
| Wilderness Tier A+B (460 named − 220 in settlements) | 240 over ~13 km² non-settlement land = **18.5/km²** ✅ (target ≥18) |
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

| Region | Land km² | Tier A | Tier B | Tier C | Difficulty tier |
|---|---|---|---|---|---|
| Blackwood | 2.07 | 14 | 30 | 88 | 2 |
| The Stone Forest | 1.80 | 30 | 26 | 78 | 3 |
| Valus Ridge | 1.71 | 12 | 25 | 60 | 4 |
| Eastern Rootlands | 1.44 | 14 | 22 | 62 | 2 |
| The Deep Marshes | 1.26 | 10 | 18 | 48 | 5 |
| Western Rootlands | 1.17 | 46 | 28 | 82 | 1 |
| Thornmarsh | 1.08 | 14 | 14 | 40 | 4 |
| The Salt Hills | 0.94 | 34 | 16 | 46 | 3 |
| The Clay Moor | 0.81 | 10 | 12 | 32 | 4 |
| Stone Wastes | 0.81 | 12 | 8 | 28 | 5 |
| Crimson Coast | 0.63 | 17 | 6 | 20 | 4 |
| Marauder's Coast | 0.49 | 8 | 4 | 10 | 2 |
| The Hive | 0.31 | 4 | 1 | 6 | 2 |
| **Total** | **14.52** | **225** | **210** | **600** | |

(Tier A here counts wilderness + settlement interiors within each region; 225 + the 25 interiors in
minor settlements not assigned above = 250.)

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

Score 0–10 on the weighted mean of D1–D13 (each scored 0/1/2 → fail/pass/exceed), weights: D1 ×3,
D3 ×3, D12 ×2, D7 ×2, D8 ×2, all others ×1.

| Score | Condition |
|---|---|
| 10 | Every metric passes, TTNIT median ≤30 s, D12 median ≥4 landmarks, M7 clean |
| 8 | All metrics at target; M7 ≤2/60 flagged |
| 6 | D1/D2 pass, ≤3 other metrics below target |
| 4 | TTNIT median 45–75 s, or D3 in 9–15 |
| 2 | TTNIT median >75 s but POIs exist |
| **0 — WE LOSE** | Any of: M7 flags >5/60 (scatter tagged as POI); D3 < 9 (fewer than 9 POIs per km of road); D12 fails at >20% of points (you can stand somewhere and see nothing worth walking to); the total named-location count is below the fail floor of 276 (A+B) |

## How we lose

- **"Dense" meaning trees.** 400,000 instanced palms and 12 things to do. This is the default failure of
  every procedurally-vegetated world and M7 exists solely to catch it. Foliage density is *art*
  (RI-WLD04); it contributes exactly zero to this item's score.
- **POI inflation.** Tagging every rock as a POI to make D3 pass. M7 samples and dumps components.
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
