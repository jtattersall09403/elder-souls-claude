---
id: RI-WLD12
title: Region borders — the transition zone, the staggered crossover, and the announced tier jump
kind: number
side: morrowind
judges: [world.region.transition]
provenance: constructed
confidence: medium
blind_pair: yes
---

## The bar

`RI-WLD04` proves each of the thirteen regions is a different place. This item is about the **fifty
metres where one becomes another**, and it exists because that is where a hand-made world and a
generated one are most easily told apart.

A texture swap is a border where **everything changes at once, at a line you cannot see**. You walk,
the ground material changes, the grass mesh changes, the ambient audio cross-fades, the fog colour
lerps, the fauna spawn table flips — all at the same coordinate, in the same step, with nothing in
the world marking it. It is the single cheapest way to build a border and it reads instantly as a
data structure.

Morrowind's borders are not that. You leave the Ascadian Isles by climbing, and the comberry thins
before the ash arrives; you know you are in the Ashlands when the *sound* stops, which is later than
when the ground changed. The West Gash meets the Bitter Coast in a band of mangrove and rock where
both are true.

The bar: **every one of the province's region borders is either a physical form you can see from
400 m or is marked by a built threshold object**; the nine `RI-WLD04` axes **cross over at different
places**, spread over at least 25 m of standard deviation, never together; every border with a
danger-tier jump of **≥ 2** is **announced in the fiction** — a corpse, a cairn, a warning, a change
in what walks the road — and never by a level check (**S9**); and crossing is **continuous** — no
hitch, no fade to black, no loading door, no invisible wall.

And the test that fails a swap in one shot: **screenshot the border, show it to a fresh judge with no
labels, and ask "is this one place or two?"** A border you cannot see is not a border, and a border
you can see from a single frame is the thing Morrowind actually did.

## The reference artifact

### 1. The three kinds of border

| Kind | Form | Transition width | Where it belongs |
|---|---|---:|---|
| **`HARD`** | a landform or built thing you cross in a step: a ridge line, a river, a treeline, a wall, a shore, a gate | **0 – 20 m** | wherever the map has real geography |
| **`GRADED`** | a genuine blend zone: both regions' flora present, ground materials interleaved, both fauna possible | **120 – 180 m** | between two regions that really are neighbours in kind |
| **`MARKED`** | a graded border with a **built threshold object** carrying the announcement | 60 – 120 m + the object | wherever a `GRADED` border would otherwise be invisible |

| # | Bar | Value | Fails |
|---|---|---|---|
| **B1** | Borders that are `HARD` | **≥ 40%** | a province of gradients with no geography |
| **B2** | Borders with **no** landform and **no** threshold object | **0** | the texture swap |
| **B3** | `GRADED` transition width | 120 – 180 m | a 10 m "blend" is a swap with a lerp on it |
| **B4** | Distinct threshold-object *types* in use | **≥ 6** | one cairn mesh, twenty placements |
| **B5** | Borders reachable by the trunk road network (`RI-WLD01`) that are **unmarked** | **0** | the road tells you nothing |

**The threshold-object vocabulary** (≥ 6 types must be in use, and each belongs to somebody):

| Object | Who built it | Where |
|---|---|---|
| Imperial **border cairn** | the Empire, badly maintained | Salt Hills / Valus Ridge / Blackwood approaches |
| **Root-gate** — an arch of trained Hist root | Argonians, grown not built | every Rootlands border |
| **Tide-pole** with a painted waterline | villagers | every tidal border (`RI-WLD06`, `RI-WLD10` §7) |
| **Knife-marked stem** | the Thorn path-cutters | Thornmarsh, all sides |
| **Kiln-slag heap** | the naga | Clay Moor borders |
| **Bone-line** — leviathan ribs set upright | Marauder's Coast folk | the coast's landward edge |
| **Salt-glass marker** | nobody; the crater-fields made them | Stone Wastes |
| **A corpse in a cage** | the Dres | the Deep Marshes' approaches, and it is a warning |

### 2. The staggered crossover — the item's core rule

The nine `RI-WLD04` axes (palette, flora, fauna, architecture, ambient audio, weather, hazard,
danger tier, *only-here* element) **must not cross over at the same place**.

```
For a traverse of a border along a line perpendicular to it, sampled every 2 m:
    c[a] = the position, in metres along the traverse, at which axis `a` is
           more region-B than region-A (>50% of samples in a 20 m window)

    BAR:  stddev( c[a] over the 9 axes ) >= 25 m        # GRADED and MARKED borders
          stddev( c[a] over the 9 axes ) >= 8 m         # HARD borders
    BAR:  max(c) - min(c) >= 60 m                       # GRADED and MARKED
    BAR:  no two axes cross within 3 m of each other more than twice per border
```

**The canonical order, and it is a design not an accident:** ground and flora cross **first**
(they are the terrain), architecture and the *only-here* element cross **last** (they are the
statement), fauna and audio cross **in between**, and the danger tier crosses at the **narrowest
point** — the pass, the ford, the gate — so that the moment the world becomes more dangerous is a
place with a name.

This one measurement is what separates a border from a swap, and it is computable from a scripted
walk with no human in the loop.

### 3. The announced tier jump (S9)

`regions.json` gives every region a difficulty tier from 1 to 5. Adjacent tiers differ by up to 4
(Western Rootlands 1 → Deep Marshes 5 is not adjacent, but Blackwood 2 → Valus Ridge 4 is).

| # | Rule | Value |
|---|---|---|
| **T1** | Every border with `|Δtier| ≥ 2` carries **≥ 2 in-world warnings** within 100 m of the crossing, on **different channels** | a corpse or a wreck; a threshold object with a mark on it; an NPC line or rumour naming the place; a visible change in what walks the road |
| **T2** | The first hostile encounter beyond such a border is **≥ 40 m** from it | no ambush at the threshold — the player must be allowed to look, and to turn round |
| **T3** | **Nothing gates the crossing.** No level check, no soft wall, no "you are not ready" message, no scaled enemies | **S9**, and it is an AR-1/AR-2 automatic fail |
| **T4** | The tier jump is **survivable to observe**: from the border, a player of the lower region's expected level can see ≥ 100 m into the higher region and retreat | the Souls contract — you are allowed to go, you are told what it costs |
| **T5** | ≥ 3 borders in the province have a **lower** tier on the far side | a monotonic difficulty ramp is a corridor, not a map |

### 4. Continuity of crossing

| # | Rule |
|---|---|
| **C1** | No loading screen, no fade, no door, no interior cell at a region border. Crossing is one continuous traverse. |
| **C2** | Both regions' asset sets are resident throughout the transition zone — the streaming boundary and the *visual* boundary must not coincide, and the streaming boundary must be **≥ 150 m** from the visual one. |
| **C3** | **No invisible walls at a border.** Where a border is impassable it is impassable because of a landform you can see (a cliff, deep water, a thicket) and the same landform blocks an arrow and an enemy. |
| **C4** | Fog, colour grading and ambient light interpolate over **≥ 80 m**, never at the axis crossover point — otherwise the grade *is* the border and B2 is failed by a post-process. |
| **C5** | The tide (`RI-WLD10` §7) does not stop at a region border; the two tidal Padomaic regions share one phase, the two tidal Topal regions share the other body's phase, and there is no discontinuity in water height across the line. |

## Comparison method

**M64 — The border inventory (static + harness).** From `regions.json` AABBs and the shipped
navmesh, enumerate every adjacent region pair with a walkable connection; for each, resolve its
declared kind, transition width, and threshold objects from `game/data/world/regions.json` /
`pois.json`.
- **FAIL** on B1–B5: `HARD` share < 40%; any border with neither landform nor object; a `GRADED`
  width outside 120–180 m; fewer than 6 object types; any road-borne border unmarked.
- **FAIL** if any adjacency present on the navmesh is undeclared in data, or vice versa.

**M65 — The staggered-crossover traverse (the core check).** For each border, scripted walk along the
perpendicular, 400 m, sampling every 2 m: ground material id, flora species histogram, fauna spawn
table, nearest-architecture class, ambient audio bed id *(declared, not heard)*, weather profile,
hazard set, danger tier, and presence of each region's `only_here` element.
- Compute `c[a]` and the statistics in §2. **FAIL** on any bar.
- **FAIL** if `stddev(c) < 5 m` on any border — that is a texture swap and it is the automatic fail.
- Report the nine crossover positions per border. That table is the verdict's most useful artifact.

**M66 — Tier announcement (T1–T5).** For every border with `|Δtier| ≥ 2`: sample a 100 m radius for
warning objects, query dialogue and rumour data for lines naming the far region, and run a scripted
approach recording the distance to first hostile contact.
- **FAIL** on fewer than 2 warnings, on two warnings sharing a channel, on first contact < 40 m, on
  any level check or scaled enemy at the crossing, or on a sightline into the far region < 100 m.
- **FAIL** if fewer than 3 borders in the province descend in tier (**T5**).

**M67 — Continuity (C1–C5).** Drive a 400 m traverse of every border with a trace running and
`getWorldStats()` sampled every 20 m.
- **FAIL** on any load event, fade, or cell transition (**C1**).
- **FAIL** if either region's asset residency drops inside the transition zone, or if the residency
  change point is within 150 m of the visual crossover (**C2**).
- **FAIL** if the traverse is blocked by a collider with no visible mesh (**C3**), or if a projectile
  passes where the player cannot.
- Sample fog/grade parameters along the traverse. **FAIL** if their interpolation spans < 80 m or is
  centred on the crossover (**C4**).
- Sample water height across every tidal border at all four tide states. **FAIL** on any
  discontinuity (**C5**).

**M68 — The one-place-or-two test (`blind_pair: yes`).** Capture 1920×1080 frames at the crossover
point of every border, eye height 1.7 m, HUD off, facing along the border and across it (2 shots
each), mixed time of day.
- Show each unlabeled to a fresh judge: *"is this one place or two? If two, point at what told you."*
- **PASS: ≥ 80% answered "two" AND ≥ 70% name an object or a landform**, not a colour.
- **FAIL** if ≥ 25% answer "one", or if the most common named cue across the whole set is fog or
  colour — that means the province's borders are a grade, and `RI-WLD04`'s blind region test is
  passing on a post-process.

**M69 — Interleave with `RI-WLD04`.** Sample 3 screenshots *inside* the transition zone of each border
and add them to `RI-WLD04`'s blind region-identification set.
- **FAIL** if region identification inside transition zones falls below **60%** — a border may be
  ambiguous, but it must not be *unrecognisable*: a player standing in one must still be able to say
  which two regions they are between.

**M70 — Audio (declared unmeasurable).** The ambient bed is one of the nine axes and audio is
unreachable through the harness (`HARNESS.md` §3). M65 samples the **declared** bed id from data, not
the sound. `RI-AUD03` owns whether the crossfade is any good.
- **FAIL** only if the declared bed does not change across a border at all, or if all thirteen
  regions declare the same bed.

## Scoring

| Check | Weight | Pass condition |
|---|---:|---|
| M64 inventory B1–B5 | 16 | every border has a form or an object |
| **M65** staggered crossover | **30** | stddev ≥ 25 m graded / ≥ 8 m hard; span ≥ 60 m |
| M66 tier announcement | 16 | 2 channels, 40 m grace, no gate, 3 descents |
| M67 continuity | 14 | no load, no invisible wall, streaming ≠ visual |
| **M68** one-place-or-two | **16** | ≥ 80% "two", ≥ 70% naming an object |
| M69 identifiable inside the zone | 6 | ≥ 60% |
| M70 declared audio change | 2 | the bed changes |

- **≥ 85** — the province has edges.
- **70–84** — playable, gap named.
- **< 70** — **we lose.**

**Automatic fail regardless of score:** `stddev(c) < 5 m` on any border (the texture swap); any
border with neither a landform nor a threshold object; a level check, soft wall or scaled enemy at a
crossing (**S9**, AR-1); a loading screen or fade at a region border; an invisible wall; fog or
colour grading as the *only* cue on ≥ 3 borders.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 70 / 100 | 80 / 100 | 92 / 100 |

**Aggregation (a property of this item, not of the critic):** weighted-sum of passed check weights, max 100.

## How we lose

1. **The texture swap.** Every axis flips at one coordinate because that is what a region lookup
   returns. It is the default behaviour of every region system ever written, and M65 exists for
   nothing else.
2. **The fog border.** All the axes are staggered correctly, and then a per-region fog colour and
   colour grade is applied at the region lookup, so the *only* thing the player perceives is a
   post-process wiping across the screen. This is the specific failure **S24** names — *"a region that
   is only distinguishable by fog colour is a defect"* — arriving at the border instead of in the
   middle of the region. C4 and M68's "name what told you" clause are the guards.
3. **The blend with nothing in it.** A 150 m gradient of interpolated ground textures and no object,
   no landform, no cairn, nobody's work. Technically staggered, perceptually nothing. B2 fails it.
4. **The invisible wall at the tier jump.** Someone will stop the player leaving the tier-1 region,
   because a playtester died. It is the single most Souls-violating thing in this item: the contract
   is that you may go, and that the world told you.
5. **The ambush at the threshold.** A hostile placed 5 m past the border, which converts an
   announcement into a trap and teaches the player not to explore. T2's 40 m is the fix.
6. **Monotonic difficulty.** Tier 1 → 2 → 3 → 4 → 5 radially, so the map is a corridor with an angle.
   T5 requires three borders where crossing makes the world *safer*, because that is what makes a map
   a map.
7. **The streaming boundary and the visual boundary in the same place.** Assets pop in exactly where
   the region changes, so every border hitches and every border announces itself as a data structure.
   C2's 150 m separation is cheap and will be skipped.
8. **Threshold objects that are all one mesh.** Twenty border cairns, placed. B4's six types exist
   because a border object should say *who built it*, and eight different peoples' markers is
   `RI-WLD05`-grade strangeness for almost no cost.
9. **Borders that only exist on roads.** The 21% of the province that a road touches has cairns and
   the rest has nothing, so anyone walking cross-country experiences pure swaps. M64 enumerates every
   walkable adjacency, not every road.
10. **Audio never changes.** Structurally invisible to the harness, so it will be the last thing built
    and the first thing cut. M70 checks only the declared id; a human must check the sound.

## Provenance note

- **`constructed`, confidence medium.** The three border kinds, every bar B1–B5, the staggered-crossover
  statistic and its thresholds (25 m / 8 m / 60 m), T1–T5, C1–C5 and the eight threshold-object types
  are ours. Confidence is *medium* because the crossover thresholds are reasoned from the corpus's own
  scale — 25 m is ~12 s of walking at `world.walk_speed_mps` 2.0, chosen so the staggering is
  *experienced* as sequence rather than as noise — and not derived from any measurement of Morrowind.
  A successor with the Morrowind data could measure real crossover spreads on Vvardenfell's borders
  and either confirm or amend §2; that is the highest-value follow-up.
- **Cited, not redefined:** the thirteen regions, their nine axes, their difficulty tiers and their
  `only_here` elements are `RI-WLD04` / `corpus/50-world/regions.json` — **this item introduces no new
  region property**. The blind region-identification test is `RI-WLD04`'s and M69 feeds it rather than
  restating it. Seam **S9** (regions gated by lethality, never by level-scaling) and **S24** (the
  regions must read as different places, and fog colour is not a difference) are `ARBITRATION.md`.
  Walk speed and the trunk road network are `RI-WLD01` / `constants.json`. Wayfinding objects,
  including the tide-pole, are `RI-WLD06`. Tide phase and the two seas are `RI-WLD10` §7/§9. Streaming
  and hitches are `RI-PLT03`; ambient audio is `RI-AUD03`. The capture protocol for M68 is
  `HARNESS.md` §6's world viewpoint set.
- **`canonical-recall`, confidence medium:** that Vvardenfell's borders stagger — comberry thinning
  before ash appears, the insect layer dropping out of the Ashlands' audio bed after the ground has
  already changed, the West Gash/Bitter Coast overlap. Recalled, not verified this session, and it is
  the *design* rationale for §2 rather than a number cited in it.
- **Unverifiable, correctly declared:** the 40% `HARD` share, the 120–180 m graded width, the 80%/70%
  M68 thresholds, the 40 m encounter grace, the 150 m streaming separation and the 80 m grade
  interpolation. Binding because measurable.
