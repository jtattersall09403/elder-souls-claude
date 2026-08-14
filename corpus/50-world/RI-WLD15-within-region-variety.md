---
id: RI-WLD15
title: Within-region variety — the six-minute walk, and the patch-size ceiling
kind: number
side: morrowind
judges: [world.terrain.form, world.region.identity, world.density.handplacement, world.verticality.layout]
provenance: constructed
confidence: high
blind_pair: yes
---

## The bar

Every variety bar in this corpus so far is measured **between** regions or **across** the world.
`RI-WLD04` proves Blackwood is not the Deep Marshes. `RI-WLD12` proves the border between them reads
as a place. `RI-WLD02` proves something is worth walking to every 45 seconds. `RI-WLD07` proves the
world as a whole is not a plane. **None of them measures the six minutes you spend inside one
region**, and that is where the property the owner named actually lives: *"Exploring Morrowind never
felt dull, you were never just walking over samey landscape for ages."*

Morrowind's Ashlands has one palette, one flora set and one weather profile — and it still changes
under your feet every hundred metres, because a foyada is not an ash mire is not an obelisk field is
not the pumice flat between them. **Region identity is a constant; the walk inside it is not.** The
bar: inside any single region, a **720 m (six-minute) walk crosses at least 8 distinguishable ground
states, the longest unchanging stretch has a median of ≤ 90 s, and no walk anywhere in the province
holds one unchanging state for more than 4 minutes.** Expressed as a property of the terrain rather
than of the walk: **no single ground state may cover more than 35% of a region**, and the largest
uniform patch in any region must be **smaller than a six-minute walk across**.

This item is deliberately the *inverse* of `RI-WLD09`. That item requires ≥5 declared void tracts,
≥14% of the landmass, each with a ≥240 s walk carrying no Tier A/B POI — and it is right to. But
emptiness of *things to walk to* is not the same as emptiness of *landscape*, and nothing in the
corpus said so until now. Vvardenfell's Ashlands are empty of POIs and full of landform. **A void
tract is exactly where this item binds hardest**, because a 420-second walk with nothing to find is
the walk on which unchanging ground is most punishing.

## The reference artifact

### 1. The ground state (the unit everything below counts)

A **ground state** is the tuple a player could name if you stopped them and asked *what is it like
right here?* Five components, all coarse on purpose — two points sharing a ground state are two
points that feel the same to stand on:

| # | Component | Values | Read from |
|---|---|---|---|
| 1 | **Substrate** | the region's material set (`FIRM` / `SILT` / `SUCK`, extensible) | `terrain.json` `substrate` |
| 2 | **Standing water** | dry / film (<0.4 m) / wade (0.4–1.2 m) / swim (>1.2 m) | `woff_cm` against ground, per `RI-WLD10` §2 |
| 3 | **Local relief** | height range inside a 100 m box, in **2 m** bands, capped at 9 | `base_dm` |
| 4 | **Macro-form** | plain / crest / hollow / flank, from the point's height against its 100 m mean | `base_dm` |
| 5 | **Enclosure** | fraction of 16 compass rays blocked within 150 m by ground above eye height (1.7 m), in 5 bands | `base_dm` |

Two components are deliberately **absent** from arm A and belong to arm B: **flora and props**, and
**light and weather**. A marsh that is flat, wet and open everywhere can still stop being samey by
changing what grows in it — and arm A cannot see that. **A green arm A is a gate, not a pass.**

### 2. Why 720 m and 90 s

720 m is six minutes at `RI-WLD01`'s 2.0 m/s walk. Six minutes is the unit because it is roughly the
longest any single leg of the road network keeps you inside one region, and because it is the
duration at which a human reports "this has gone on a while". The 90 s median comes from the same
place `RI-WLD02`'s D13 gets its 150 s: below it, monotony is not yet perceptible; above 240 s it is
the complaint verbatim.

### 3. The five thresholds

Measured **per region**, over 24 straight transects of 720 m from random starts on 8 bearings,
sampled every 25 m. All are arm A (static, headless, ~1 s) unless marked.

| # | Metric | Target | Fail | Hard fail |
|---|---|---|---|---|
| **W15-1** | Median longest unchanging-state run, per region | **≤ 90 s** | > 150 s | — |
| **W15-2** | p90 longest unchanging-state run, per region | ≤ 150 s | > 200 s | **> 240 s** |
| **W15-3** | Distinct ground states crossed per 720 m walk | median **≥ 8** | median < 6 | **any walk < 4** |
| **W15-4** | Region ground-state inventory / modal share | **≥ 12 states**, modal ≤ **35%** | < 12 states, or modal > 35% | modal > 60% |
| **W15-5** | *(arm B, rendered)* Distinct rendered views per 720 m walk, by perceptual hash at Hamming ≥ 12 | **≥ 10** | < 7 | **< 4** |
| **W15-6** | *(arm B, rendered)* Longest run of near-identical frames (pHash Hamming < 6) | ≤ 60 s | > 120 s | **> 180 s** |
| **W15-7** | **Inside a declared `RI-WLD09` void tract**, W15-1 and W15-3 apply **unrelaxed** | same | same | same |

W15-7 is the clause that stops the two items cancelling. `RI-WLD09` relaxes POI density inside a
tract; it does not relax landscape. A tract is authored emptiness, not authored sameness.

### 4. What the corpus's own worked example looks like

Vvardenfell's Ashlands, translated into this vocabulary, is roughly: pumice flat (FIRM / dry /
relief 0–1 / plain / open), foyada floor (FIRM / dry / relief 3–5 / hollow / enclosed), foyada wall
(FIRM / dry / relief 5–7 / flank / half-enclosed), ash mire (SILT / film / relief 0–1 / hollow /
open), obelisk field (FIRM / dry / relief 1–2 / plain / half-enclosed), and the Red Mountain flank
(FIRM / dry / relief 6–9 / flank / open). **Six states in one region with one palette.** That is the
shape of the answer, and it costs no new art — the same ash material, arranged into different
landforms, at different enclosures.

## Comparison method

**M-W15-1 — arm A, the static monotony probe** (`corpus/80-methods/m-wld15-monotony.mjs`).
```
node corpus/80-methods/m-wld15-monotony.mjs --selfcheck      # must exit 0 before any run is quoted
node corpus/80-methods/m-wld15-monotony.mjs --json <out>
```
Reads `game/data/world/terrain.json`, computes the ground state at every land cell, runs the 24
transects per region, and reports W15-1 to W15-4 with the failing regions named. Exit 0 pass, 1
fail, **2 could-not-measure** — a missing world is reported as an absence, never as a pass (rule 24).

**The selfcheck is mandatory before quoting a number.** It builds two synthetic worlds — one with a
single repeated ground state, one with an aperiodic varied one — and asserts the instrument fails the
first and passes the second. A run of the probe whose selfcheck was not executed is not evidence
(rule 4); the negative control exists because a variety metric that cannot fail on a flat plane is
the exact instrument this project has shipped before.

**M-W15-2 — arm B, the rendered walk** (browser; run `node tools/contention.mjs --gate` first).
1. For each region, take the 3 transects that scored **worst** on arm A plus 3 random ones.
2. Walk each at 2.0 m/s, capturing 1280×720 at **4 s intervals** (every 8 m), eye 1.7 m, fixed
   forward yaw, daytime, weather sampled from the region profile. HUD off.
3. Compute a 64-bit perceptual hash per frame. Report W15-5 (distinct views at Hamming ≥ 12) and
   W15-6 (longest run at Hamming < 6).
4. **Publish the worst run as a contact sheet.** A strip of 20 near-identical frames is the single
   most legible artefact this item can produce and belongs in the verdict.
5. Per directive §2 (2026-08-14), a still from one angle is not a measurement — the sequence is.

**M-W15-3 — the delete-the-fix control.** When a builder claims to have fixed a region, re-run arm A
with their change reverted **on a copy** and confirm the old numbers return. A variety improvement
that survives its own removal was carried by something else (rule 6).

**M-W15-4 — the void-tract cross-check.** For every tract in `game/data/world/voids.json`, run arm A
restricted to the tract polygon and assert W15-1 and W15-3 unrelaxed (W15-7). Report per tract.

**M-W15-5 — blind pair.** Present a judge with two unlabelled 20-frame strips, one from our worst
region walk and one from a Morrowind walk of the same length, and ask *which walk shows more
different places?* Record the blind pick before the reveal (`RI-MTH03`).

## Scoring

| Score | Condition |
|---|---|
| 10 | Every region: W15-1 ≤ 75 s, W15-3 median ≥ 10, W15-4 ≥ 16 states and modal ≤ 25%; arm B W15-5 ≥ 12; void tracts clean |
| 8 | Every region meets W15-1 ≤ 90 s, W15-2 ≤ 150 s, W15-3 median ≥ 8 and no walk < 4, W15-4 ≥ 12 / ≤ 35%; arm B W15-5 ≥ 10 |
| 6 | ≤ 3 regions over target on W15-1 or W15-3, none in hard fail; arm B run and W15-5 ≥ 7 |
| 4 | Arm A run and reported honestly; ≥ 4 regions over target; no arm B |
| 2 | Arm A run; ≥ 2 regions in hard fail |
| **0 — WE LOSE** | Any of: a region's modal ground state covers > 60% of it; any 720 m walk crosses **1** ground state; any p90 run > 240 s in a **declared void tract**; the probe was run without its selfcheck; the world has no terrain data and the item was scored anything other than `not_run` |

**Native → ladder anchors** (`SCORING.md` §1.2): the bands above are already 0–10 native.

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 | 6 / 10 | 8 / 10 |

**Aggregation:** band, per region, worst-region-wins. A world with twelve varied regions and one
that is a single repeated state has a monotony problem, not an average.

## How we lose

- **Variety that exists but is arranged in patches bigger than a walk.** This is the measured state
  of the tree today and it is the subtle failure: `deep-marshes` holds **93** distinct ground states
  and still contains a 275-second walk that crosses **one**. Counting a region's inventory and
  calling it varied is the mistake W15-1 and W15-2 exist to catch. **Inventory is not itinerary.**
- **One noise field per region.** The cheapest way to build thirteen regions is one terrain generator
  with thirteen parameter sets. It produces exactly this signature: a high global state count, a
  huge modal patch, and walks that never leave it.
- **Passing arm A and shipping a bare plain.** Arm A cannot see flora, props or light. A region can
  clear every static threshold on landform alone and still be six minutes of the same three meshes.
  W15-5/W15-6 are not optional decoration; they are the half of the item that sees what a player sees.
- **Fixing it by adding POIs.** A landmark every 200 m does not make the ground between them change,
  and `RI-WLD02` already pays for landmarks. Answering a monotony finding with density inflation
  satisfies neither item and is the failure `RI-WLD02` M7 is separately scanning for.
- **Fixing it by adding noise.** Doubling the detail amplitude changes the relief band everywhere at
  once and moves W15-3 without producing a single *place*. The tell is W15-4 improving while W15-1
  does not: more states, same patches. **Landform is composed, not dialled.**
- **Declaring the monotonous stretches as void tracts.** `RI-WLD09` rewards declared emptiness, so
  the tempting move is to draw a polygon around the flat part. W15-7 is why that does not work.
- **Measuring only the road.** Roads are cut along terrain and see the least varied slice of it.
  Transects here are random-bearing on purpose; a road-only variant of this probe would pass a world
  that is monotonous everywhere a player actually wanders.
- **Vertical regions scoring well for the wrong reason.** A mountain has a big height range and can
  still be one long uniform flank — `valus-ridge` today has a **79%** modal share and the worst walks
  in the province, while topping every `RI-WLD07` verticality target. High relief is not variety.

## Provenance note

- `constructed` (binding): the ground-state definition and all five components, the 720 m/six-minute
  window, every threshold in §3, the scoring bands, and W15-7's non-relaxation inside void tracts.
  Nothing upstream publishes a within-region variety metric; these numbers are ours and are binding
  because they are measurable.
- `derived`, high confidence: the thresholds were set **after** measuring the shipped tree at commit
  `cf2755a` with `m-wld15-monotony.mjs`, so that the bar sits above the current build without being
  unreachable — two regions (`crimson-coast`, `hive`) already meet W15-1, and the synthetic varied
  control reaches 50 s. They are calibration, not aspiration. The measured baseline is in
  `reports/BAR-AUDIT-WORLD-20260814.md` §4.
- `canonical-recall`, confidence medium: the Ashlands worked example in §4 — foyadas, ash mires,
  obelisk clusters and the Red Mountain flank as distinct ground states inside one region. The
  place-type list is corroborated by `corpus/50-world/data/morrowind-region-census.json`, which
  mines a `Foyadas` place-type heading unique to Red Mountain from the UESP extract; the *ground
  state* reading of them is recalled from play and not verified this session.
- The owner's framing in §The bar is quoted from `orchestration/OWNER-DIRECTIVES-2026-08-14.md` §6.
