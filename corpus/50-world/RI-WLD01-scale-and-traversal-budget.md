---
id: RI-WLD01
title: World scale, coordinate system and the one-hour traversal budget
kind: number
side: morrowind
judges: [world.scale, world.terrain, world.roads, world.placement, world.traversal, movement.speed]
provenance: constructed
confidence: high
blind_pair: no
---

## The bar

Black Marsh is a **hand-authored landmass of ~14.5 km² inside a 4,825 × 5,540 m world box**, at a scale
where the canonical crossing — Stormhold's south gate to Lilmoth's harbour steps — takes **57.6 minutes
of unbroken walking at 2.0 m/s**, and the longest settlement-to-settlement road path (Thorn to Soulrest)
takes **79 minutes**. The hour is not produced by slowing the player down: the walk speed is Morrowind's
own (2.0 m/s ≈ a base-Speed-40 Dunmer at 140 game units/s), and the distance is Vvardenfell's own
(Vvardenfell's exterior cell grid is ~4.34 × 4.69 km; a measured end-to-end walk of the Morrowind map
takes 59 min 3 s). We are not building a small world and taxing the player's patience; we are building a
world the same physical size as the one the brief invokes. Every position in this file is authoritative:
builders place terrain, roads and settlements **from this table verbatim**, and any later artefact whose
coordinates disagree with `world-scale.json` is the artefact that is wrong.

## The reference artifact

### 1. Derivation of scale

| Step | Value | Source |
|---|---|---|
| Morrowind exterior cell | 8,192 units = 385 ft = **117.3 m** | community-data |
| 1 Morrowind unit | 0.014319 m | derived |
| Morrowind walk velocity | `(race_weight × 100) + Speed` units/s, clamped 100–200 | community-data |
| Base human/Dunmer, Speed 40 | 140 units/s = **2.005 m/s** | derived |
| Vvardenfell cell span | X −16…+20 (37 cells), Y −16…+23 (40 cells) | community-data |
| Vvardenfell bounding box | 37 × 117.3 = **4,340 m**; 40 × 117.3 = **4,692 m** | derived |
| Vvardenfell bbox diagonal | **6,390 m** → 53.2 min at 2.0 m/s | derived |
| Measured Morrowind end-to-end walk | **59 min 03 s** | community-data |
| Convergence check | 53.2 min straight-line vs 59.1 min measured ⇒ road sinuosity ≈ **1.11** on Vvardenfell's best roads | derived |
| **Our scale** | **3.50 m per source-image pixel** (defined) | constructed |

**Cross-check against a Souls level.** A Dark Souls area (Undead Burg, Anor Londo) is a ~200–400 m
critical path with 25–60 enemies, cleared in 15–25 min first time. Our whole world is **~25 km of trunk
road**, i.e. roughly **60–80 Souls-areas' worth of linear extent**. That is the correct ratio: Souls owns
the *inside of the fight*, so Souls-density belongs to our 8 loop-dungeons (RI-WLD07), not to the
overworld. An overworld built at Souls enemy-density would be a corridor, not a world.

### 2. Coordinate system (binding)

```
X = metres EAST      (0 … 4825)
Z = metres SOUTH     (0 … 5540)
Y = metres above sea level (sea level Y = 0; terrain range −40 … +420)
Origin (0,0) = north-west corner of the world box, 250 m of ocean/border margin
               outside the landmass bounding box.
```

Map-image → world transform (source image `black-marsh-map-source.jpg`, 2048 × 1536):

```
X = (px_x - 515) * 3.50 + 250
Z = (px_y -  60) * 3.50 + 250
```

Land bounding box in source pixels: `x ∈ [515, 1750]`, `y ∈ [60, 1500]`.

| Quantity | Value |
|---|---|
| World box | 4,825 × 5,540 m = **26.7 km²** |
| Land bounding box | 4,322 × 5,040 m = 21.8 km² |
| **Walkable land (measured by colour-segmenting the map source)** | **14.5 km²** (66.5% of land bbox) |
| Water + off-map border | 12.2 km² |
| Vvardenfell comparison | bbox 20.4 km², land ≈13–14 km² — **parity** |
| Trunk road network | **25,331 m** (10 legs) |
| Full road + track network target | **≥34,000 m** |
| Movement speeds | walk **2.0**, jog (default, no stamina drain) **3.2**, sprint **5.0** (stamina), swim **1.1**, tide-wade **1.3** m/s |
| Timescale | 20× — 1 real min = 20 game min; **full day = 72 real minutes** |

**Why the hour is quoted at 2.0 m/s, not at the jog.** The brief's "an hour to cross on foot" is a
Morrowind measurement and must be compared to Morrowind's measurement (59 min 03 s at walk). Both
numbers are published below so a critic can check either.

### 3. SETTLEMENT COORDINATE TABLE — LOAD-BEARING

Positions read from the ring-marker beneath each settlement icon on the map source (the cartographic
point, not the icon art). Machine-readable: `corpus/50-world/settlements.json`.

| Settlement | Source px | **X (m)** | **Z (m)** | Tier | Region | Nearest neighbour | Road m | Walk min | Jog min |
|---|---|---|---|---|---|---|---|---|---|
| **Stormhold** | 1064, 206 | **2171.5** | **761.0** | city | The Salt Hills | Thorn | 2,229 | 18.6 | 11.6 |
| **Thorn** | 1535, 234 | **3820.0** | **859.0** | village | Thornmarsh | Stormhold | 2,229 | 18.6 | 11.6 |
| **Gideon** | 569, 821 | **439.0** | **2913.5** | town | Blackwood | Helstrom | 2,378 | 19.8 | 12.4 |
| **Helstrom** | 1090, 781 | **2262.5** | **2773.5** | capital | The Stone Forest | Gideon | 2,378 | 19.8 | 12.4 |
| **Archon** | 1525, 1081 | **3785.0** | **3823.5** | town | Crimson Coast | Lilmoth | 2,523 | 21.0 | 13.1 |
| **Blackrose** | 988, 1260 | **1905.5** | **4450.0** | town | Western Rootlands | Lilmoth | 1,503 | 12.5 | 7.8 |
| **Soulrest** | 618, 1382 | **610.5** | **4877.0** | village | Stone Wastes | Blackrose | 1,841 | 15.3 | 9.6 |
| **Lilmoth** | 1234, 1425 | **2766.5** | **5027.5** | city | Western Rootlands | Blackrose | 1,503 | 12.5 | 7.8 |

### 4. Road network (the Rootway) — legs, sinuosity, times

| From | To | Straight m | Sinuosity | Path m | Walk min | Jog min | Class |
|---|---|---|---|---|---|---|---|
| Stormhold | Thorn | 1,651 | 1.35 | 2,229 | 18.6 | 11.6 | causeway |
| Stormhold | Helstrom | 2,015 | 1.45 | 2,921 | 24.3 | 15.2 | river road |
| Helstrom | Archon | 1,849 | 1.40 | 2,589 | 21.6 | 13.5 | stone road |
| Helstrom | Blackrose | 1,714 | 1.45 | 2,485 | 20.7 | 12.9 | marsh trail |
| Helstrom | Gideon | 1,829 | 1.30 | 2,378 | 19.8 | 12.4 | Imperial road |
| Gideon | Soulrest | 1,971 | 1.30 | 2,562 | 21.4 | 13.3 | coast road |
| Soulrest | Blackrose | 1,364 | 1.35 | 1,841 | 15.3 | 9.6 | rootland track |
| Blackrose | Lilmoth | 1,037 | 1.45 | 1,503 | 12.5 | 7.8 | stilt causeway |
| Archon | Thorn | 2,965 | 1.45 | 4,299 | 35.8 | 22.4 | Clay Moor track |
| Lilmoth | Archon | 1,577 | 1.60 | 2,523 | 21.0 | 13.1 | **tideway — passable only at low tide** |

### 5. Full pairwise road-path table (minutes, walking at 2.0 m/s)

|  | Stormhold | Thorn | Gideon | Helstrom | Archon | Blackrose | Soulrest | Lilmoth |
|---|---|---|---|---|---|---|---|---|
| **Stormhold** | – | 18.6 | 44.2 | 24.3 | 45.9 | 45.1 | 60.4 | **57.6** |
| **Thorn** | 18.6 | – | 62.7 | 42.9 | 35.8 | 63.6 | **79.0** | 56.9 |
| **Gideon** | 44.2 | 62.7 | – | 19.8 | 41.4 | 36.7 | 21.4 | 49.2 |
| **Helstrom** | 24.3 | 42.9 | 19.8 | – | 21.6 | 20.7 | 36.1 | 33.2 |
| **Archon** | 45.9 | 35.8 | 41.4 | 21.6 | – | 33.6 | 48.9 | 21.0 |
| **Blackrose** | 45.1 | 63.6 | 36.7 | 20.7 | 33.6 | – | 15.3 | 12.5 |
| **Soulrest** | 60.4 | 79.0 | 21.4 | 36.1 | 48.9 | 15.3 | – | 27.9 |
| **Lilmoth** | 57.6 | 56.9 | 49.2 | 33.2 | 21.0 | 12.5 | 27.9 | – |

- **THE CROSSING** (canonical, the brief's hour): Stormhold → Helstrom → Blackrose → Lilmoth = **6,909 m, 57.6 min walk, 36.0 min jog.**
- **THE LONG WAY** (extreme): Thorn → Soulrest = **9,477 m, 79.0 min walk, 49.4 min jog.**
- Straight-line extreme: Thorn ↔ Soulrest **5,142 m**; land bbox diagonal **6,640 m**.

### 6. Sixteen minor settlements (density fill — no road leg may have a >8 min gap without habitation)

| Name | X | Z | On leg |
|---|---|---|---|
| Ixtaxh-Tzil | 2988.6 | 929.8 | Stormhold–Thorn |
| Nine-Mud | 2293.3 | 1461.3 | Stormhold–Helstrom |
| The Weeping Ford | 2129.5 | 2206.5 | Stormhold–Helstrom |
| Xal-Ithix | 2938.0 | 3347.5 | Helstrom–Archon |
| Kiln Camp | 3489.8 | 3534.9 | Helstrom–Archon |
| Sunken Barrow | 2224.0 | 3550.5 | Helstrom–Blackrose |
| Mudwater Landing | 1909.0 | 4121.0 | Helstrom–Blackrose |
| Rootway Post | 1617.4 | 2732.8 | Helstrom–Gideon |
| Tenmarch Bridge | 990.6 | 2931.3 | Helstrom–Gideon |
| Hollow-Reeds | 544.0 | 3652.0 | Gideon–Soulrest |
| Bone Ladder | 637.4 | 4380.0 | Gideon–Soulrest |
| Salt-Egg Camp | 1163.5 | 4625.0 | Soulrest–Blackrose |
| Stilt-Row | 2274.7 | 4830.1 | Blackrose–Lilmoth |
| Clayfast | 3718.5 | 2787.5 | Archon–Thorn |
| The Red Wells | 3909.5 | 1749.5 | Archon–Thorn |
| Tideway Shrine | 3207.0 | 4367.4 | Lilmoth–Archon (tideway) |

All sixteen verified ≥80% land within a 63 m radius by colour-segmenting the map source.

### 7. Ten map-derived major landmarks (visible icons on the source map — free sightline anchors)

| Landmark | Source px | X | Z |
|---|---|---|---|
| The Border Falls | 1230, 110 | 2752.5 | 425.0 |
| The Xanmeer of Ix-Thakla | 1052, 395 | 2129.5 | 1422.5 |
| The Counting Obelisk | 1250, 437 | 2822.5 | 1569.5 |
| Wayshrine of the Ninth Root | 1177, 500 | 2567.0 | 1790.0 |
| The Drowned Xanmeer | 1437, 805 | 3477.0 | 2857.5 |
| Ceyatatar-Zel (Ayleid vault) | 853, 819 | 1433.0 | 2906.5 |
| Bloodmarl Isle | 1735, 790 | 4520.0 | 2805.0 |
| Xanmeer of Sunken Teeth | 1142, 1180 | 2444.5 | 4170.0 |
| The Leaning Stone | 825, 1295 | 1335.0 | 4572.5 |
| The Glassed Crater | 655, 1395 | 740.0 | 4922.5 |

## Comparison method

Harness (to be scripted at `corpus/80-methods/M-WLD-walkprobe.md`; until it exists this procedure is
authoritative). The critic loads the built world, runs headless Three.js, and drives an agent capsule.

**M1 — Scale audit (pass/fail, no tolerance for absence).**
1. Load the shipped world data (`world.json` / terrain heightmap / placement manifest).
2. Assert world bounds are `X ∈ [0,4825]`, `Z ∈ [0,5540]` ± 25 m.
3. For each of the 8 settlements in the table above, find the built settlement centroid (mean of its
   building transforms). Compute `|built − table|`. **Pass: every settlement within 60 m. Fail: any
   settlement >150 m off, or missing.**
4. Compute walkable land area: rasterise the navmesh/terrain at 5 m and sum cells above sea level and
   below max walkable slope. **Pass: 13.0–16.0 km². Fail: <10 km² or >20 km².**

**M2 — Traversal budget (the hour).**
1. Path the capsule along the road network Stormhold → Helstrom → Blackrose → Lilmoth using the
   built road spline, ~~no fast travel~~ **transport network disabled for the measurement**, no
   sprint, forced speed 2.0 m/s, collisions on, combat disabled. (**AMENDED wave 0
   (corpus-audit), drift ID-17:** the old wording read as a prohibition. Seam **S7 mandates** the
   transport network — `RI-TRV01` builds it. What this step requires is that the *walk-time
   measurement* is taken on foot, which is a measurement condition, not a design ban.)
2. Record wall-clock/sim-clock elapsed and integrated path length.
3. **Pass: 52–65 minutes and 6,300–7,600 m.** Fail: <45 min (world too small) or >75 min (the hour is
   being manufactured by friction, not distance).
4. Repeat at 3.2 m/s jog. **Pass: 33–41 min.**
5. Re-run with `speed = 2.0` but combat enabled and no route knowledge (agent uses only prose
   directions, see RI-WLD06). Record the *first-crossing* time. Expect 75–110 min. This number is
   reported, not gated.

**M3 — Speed honesty check (anti-cheat).**
Sample the capsule's instantaneous ground speed 10×/s along M2. Compute mean and the fraction of
samples below 1.6 m/s. **Fail if >8% of samples are below 1.6 m/s on road surfaces** — that means the
hour is coming from mud-slowdowns, stair-catching or collision snagging rather than from world extent.

**M4 — Leg-time audit.** For each of the 10 road legs, path along the built road and compare to the leg
table. **Pass: each leg within ±20% of the tabled walk minutes. Fail: any leg >40% off** (roads were
routed carelessly or the road does not exist).

**M5 — Minor-settlement gap rule.** Walk every leg; record the maximum walk-time gap between successive
inhabited places (any settlement, major or minor). **Pass: max gap ≤ 9.0 min. Fail: >12 min.**

## Scoring

Scale is scored 0–10, and it is a **gate**: a failing scale score invalidates every other world score,
because density, region identity and navigation are all measured *per minute of travel*.

| Score | Condition |
|---|---|
| 10 | M1–M5 all pass; crossing 55–60 min; land 14–15 km²; every settlement within 30 m |
| 8 | M1–M5 pass at stated thresholds |
| 6 | One of M4/M5 fails; M1–M3 pass |
| 4 | Crossing outside 45–75 min, or land area outside 10–20 km² |
| 2 | Settlements present but >150 m from table; coordinate table not used |
| **0 — WE LOSE** | Any of: the world is a single flat heightmap with settlement props on it; the crossing is <20 min (a courtyard pretending to be a province); the crossing is >75 min *and* M3 shows sustained sub-1.6 m/s movement (slow walking sold as scale); the coordinate table was ignored and settlements are placed by eye |

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 | 6 / 10 | 8 / 10 |

**Aggregation (a property of this item, not of the critic):** band, and a gate — a failing scale score invalidates every other world score.

## How we lose

- **The empty heightmap.** 14.5 km² of Perlin noise with 8 clusters of boxes on it. Technically 4.8 km
  across, technically an hour to walk, and there is nothing between the boxes. This is the single most
  likely failure and every other WLD item exists to catch it.
- **Scale-cheating.** Shipping a 1.2 km world and setting walk speed to 0.4 m/s. M3 catches this.
- **Friction-cheating.** Shipping a 3 km world but making 40% of the ground "deep mud, 50% speed", so
  the stopwatch reads an hour. M3 catches this too. Mud is legitimate as a *hazard in specific places*
  (Deep Marshes) and illegitimate as a global tax.
- **Coordinate drift.** A builder places Helstrom "roughly in the middle" instead of at (2262.5, 2773.5),
  a second builder places a quest cave relative to their Helstrom, and by wave three nothing lines up
  with the map the player is holding. The table above exists precisely to prevent this; use it verbatim.
- **Sinuosity forgotten.** Roads built as straight lines between settlements. The world then crosses in
  44 minutes instead of 58, the marsh reads as a golf course, and every journey is a boring line.
- **Ocean bloat.** Padding the world box out to 8 km with empty water so the "world size" number looks
  big. Land area, not box area, is the measured quantity.
- **The Y axis ignored.** A world that is 4.8 km wide and 12 m tall. Valus Ridge must actually rise
  (terrain range is specified as −40…+420 m for a reason); see RI-WLD07.
- **Nobody between the towns.** Legs of 20+ minutes with no minor settlement, no shrine, no camp — so
  the world is 8 dense dots joined by 25 km of nothing. M5 catches this.

## Provenance note

- `community-data`: Morrowind cell size (8,192 units = 385 ft), Vvardenfell cell span (−16…+20 / −16…+23),
  Vvardenfell area estimates (20–25.9 km² including water), Morrowind walk-velocity formula and the
  `fMinWalkSpeed`/`fMaxWalkSpeed` 100/200 clamp, the measured 59 min 03 s end-to-end walk, and
  ~2,824 NPCs on Vvardenfell. Sourced from Tom's Hardware/Tamriel Rebuilt forum threads, the OpenMW
  forum "Morrowind Equations" thread, UESP mirrors and howbigisthemap.com. Confidence **medium**;
  these are community measurements, not Bethesda-published figures, and the two independent area
  estimates disagree by ~25%. The *derived* figures (117.3 m cell, 2.005 m/s at Speed 40, 6,390 m
  diagonal, 53.2 min) follow arithmetically and are high-confidence given those inputs.
- `derived-from-map`: all source-pixel readings — settlement ring markers, land bounding box, landmark
  icons, region label positions — were read from `black-marsh-map-source.jpg` at native 2048 × 1536
  with a 128 px reference grid overlaid and confirmed on 5 zoomed crops. Reading error ≈ ±8 px ≈ ±28 m.
- `constructed` (binding): the 3.50 m/px scale, the 250 m ocean margin, the coordinate convention, all
  road legs and their sinuosity factors, the movement speeds, timescale 20, the 16 minor settlements,
  and every pass/fail threshold. None of these exist upstream. They are binding anyway, because a
  constructed bar we can measure beats a real number we can't.
- The 14.5 km² walkable-land figure is `derived`: colour-segmentation of the map source (land = green
  dominance over blue, excluding high-value low-saturation border/parchment), 1.22 M land pixels of a
  1.78 M-pixel land bbox, × (3.5 m)². Systematic error ±8% (JPEG artefacts, cartouche occlusion).
