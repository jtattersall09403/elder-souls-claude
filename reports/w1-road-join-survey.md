# W1-ROAD-JOIN — the road went through the house

**Commit** `322f708` (the join) and follow-ups. Every JSON artifact this cites lives under
`reports/w1-road-join/` and is **gitignored by design** (`reports/.gitignore`: run artifacts are
reproducible from the tools). This file is the versioned home for the numbers.

Re-make any of them with:

```
node tools/world/build-roads.mjs                 # the joined generator (--no-join for the off arm)
node tools/world/road-through-building.mjs       # the acceptance instrument (W1-01 r4's, unmodified)
node tools/world/road-join-deletefix.mjs --base 69e6ffa
node tools/world/road-join-consumption.mjs
node tools/world/crossing.mjs --route crossing --speed walk
node tools/world/w1-01-r4-soulrest-leg.mjs
node tools/world/road-join-chart.mjs             # the picture, offline
```

## The defect

`tools/world/build-roads.mjs` routed roads over the terrain. `planSettlement()` planted houses on
the same ground afterwards. **Neither generator had ever been shown the other's output and nothing
performed the join.** Ten of ten built legs passed through at least one building; 16 offences on the
two named routes; a body on THE CROSSING got 39 m of 6,816 m.

## The decision: the road yields

Routing consumes the settlement plan. Not one building moves.

1. **`ARBITRATION` S28 already ruled the axis** — *"settlement positions are authoritative and
   immovable, but the route between any two of them may be re-cut freely"*, subject to the crossing
   staying in its 52–65 minute band and no leg moving more than 5% from its declared length.
2. `planSettlement()` says the same in its own words: positions are `RI-WLD03` R4's spatial proof of
   the town's power reading. A house is *where* it is on purpose; a road is only a way of getting
   somewhere.
3. `planSettlement()` is pure and runs in the browser per boot. Making it avoid roads would put the
   whole road network inside a function whose contract is "data in, placements out".

**It is not a detour.** Only the part of a leg within 55 m of a building is re-cut, on a 1 m grid
where the footprints are the walls, then string-pulled so the road hugs the corners of the gaps.
The road goes *between* the houses and becomes the street.

**The footprints are the union of `planSettlement(doc, interiors)` and `planSettlement(doc, {})`.**
The offline check passes an empty interiors map; the game passes all 115. They disagree for **114 of
202** buildings and the game's is usually bigger (`stormhold-scribe` is 10.0 × 11.5 m to the check,
12.4 × 14.4 m to the body). Clearing only the check's footprints would have given a green check and
a body still in a wall.

**One gate.** `Thorn`'s declared centre is 7.11 m inside `thorn-hall`, so a leg ending at the
settlement position ends inside the mayor's hall however it is routed. The *terminus* moves 10 m
onto the square and is emitted as `road_anchor`. The settlement does not move. Seven of eight towns
are untouched.

## Acceptance

| | before | after |
|---|---|---|
| `road-through-building.mjs` legs blocked | **10 of 10** | **0 of 10** |
| named-route offences | 16 | 0 |
| a body on THE CROSSING, walls on | **39.0 m** | **550.1 m** |
| what stopped it | 59 solid shapes of `settlement:stormhold` | **0 solid shapes** |
| THE CROSSING, built | 6,816 m / 56.80 min | 6,911.4 m / 57.59 min |
| THE LONG WAY, built | 9,367.3 m | 9,480.8 m |
| trunk network | 25,056.9 m | 25,393.1 m |
| worst leg error vs `RI-WLD01` §4 | 1.78% | 2.26% |

`RI-WLD01` declares the crossing at 6,909 m / 57.6 min: the joined network is **2.4 m** off it.

### 5. The leg-length change table

Every leg, `RI-WLD01` §4 declared against built, before and after. S28's bar is 5% per leg.

| leg | declared | before | after | Δ m | Δ % | err vs declared, after | worst clearance |
|---|---|---|---|---|---|---|---|
| stormhold-thorn | 2229 | 2224.8 | 2229.0 | +4.2 | +0.19% | 0.00% | 1.16 m |
| stormhold-helstrom | 2921 | 2877.1 | 2921.0 | +43.9 | +1.53% | 0.00% | 1.15 m |
| helstrom-archon | 2589 | 2549.8 | 2589.5 | +39.7 | +1.56% | +0.02% | 1.15 m |
| helstrom-blackrose | 2485 | 2457.2 | 2489.8 | +32.6 | +1.33% | +0.19% | 1.11 m |
| helstrom-gideon | 2378 | 2368.3 | 2431.7 | +63.4 | +2.68% | **+2.26%** | 1.11 m |
| gideon-soulrest | 2562 | 2538.8 | 2568.5 | +29.7 | +1.17% | +0.25% | 1.14 m |
| soulrest-blackrose | 1841 | 1808.2 | 1841.0 | +32.8 | +1.81% | 0.00% | 1.11 m |
| blackrose-lilmoth | 1503 | 1481.7 | 1500.6 | +18.9 | +1.28% | −0.16% | 1.10 m |
| archon-thorn | 4299 | 4228.8 | 4299.0 | +70.2 | +1.66% | 0.00% | 1.33 m |
| lilmoth-archon | 2523 | 2522.2 | 2523.0 | +0.8 | +0.03% | 0.00% | 1.10 m |

No leg swings wide: the largest single re-cut costs 63 m on a 2.4 km leg. The metres the re-cut
spends or saves are put back **outside** the towns by a clearance-aware length correction, so the
declared error is *smaller* after the join than before on nine legs of ten. `helstrom-gideon` is the
exception — no clean correction existed for it, so it is left 2.26% long rather than paid for with a
wall, and that is reported rather than hidden.

Clearance bar is 1.10 m from the centreline to a wall face (body 0.32 m + wall slab 0.18 m = 0.50 m
geometric minimum, plus slack for a walker that steers 4.5 m ahead and cuts corners). **0 samples
below the bar**, swept at 0.5 m.

### 3. Delete-the-fix — three arms, three distinct worlds

`tools/world/road-join-deletefix.mjs`. Each arm builds its own `roads.json`, installs it, hashes what
is actually on disk, and runs the **unmodified** instrument as a subprocess.

| arm | generator | sha | legs blocked | offences |
|---|---|---|---|---|
| on | `build-roads.mjs` | `b872678a06e89455` | 0 / 10 | 0 |
| off-flag | `build-roads.mjs --no-join` | `3d7c87403d7c6df9` | **10 / 10** | **16** |
| off-git | `git show 69e6ffa:…` — the pre-change file | `699abf8113b3f554` | **10 / 10** | **16** |

7 of 7 checks pass, including `OFF-ARMS-AGREE` (the flag is a faithful teardown of the real change,
not just of my own boolean) and `NO-INERT-CONTROL` (three distinct hashes — every arm measured its
own world, taken from the filesystem per arm and not from a variable the setup could have left
pointing at one file).

**Finding the base was not trivial.** Eight successive orchestrator `git add -A` banks between
02:17Z and 02:31Z committed `build-roads.mjs` mid-edit under other agents' messages, so
`git log -- <path>` names commits that already carry half the change. The base was found by grepping
every recent commit for the task id: `69e6ffa`, 02:15:23Z.

### 4. Consumption — `RI-MTH07`, `ARBITRATION` §3

`tools/world/road-join-consumption.mjs`, 11 of 11. Each perturbation is read off the **independent**
instrument and off the rebuilt geometry, never off the generator's own summary.

| perturbation | unrebuilt (must go red) | rebuilt (must go green) | road moved |
|---|---|---|---|
| P1 move a building onto the road | 2 of 10 blocked | 0 of 10 | **33.24 m** |
| P2 add a building astride it | 2 of 10 blocked | 0 of 10 | **28.07 m** |
| P3 grow an interior's `exterior_footprint_m` | **2 of 10 by the game's predicate, 0 by the offline check** | 0 of 10 | **22.30 m** |
| NULL — a building moved 250 m into open country, 217 m from any road point | 0 of 10 | 0 of 10 | **0.00 m anywhere on the network** |

P1's red/green pair is also the **retargeted `--self-test`**: `road-through-building.mjs`'s own arm A
*was* the shipped defect, so on a fixed tree it cannot flag and the self-test fails by construction
(its code anticipates this — *"retarget this test"*). NULL supplies the third leg of
flag / clear / everything-else-identical.

Two defects were found by these controls and the design changed because of them:

- **The NULL control caught my own join.** The re-cut zone was originally scoped *by town*, with the
  radius taken from the town plus its farthest building. Moving one outbuilding 800 m out inflated
  Stormhold's zone to 845 m, swallowed most of two legs into one grid solve and moved the road
  236 m for a perturbation that should have moved it none. Zones are now scoped by **road proximity
  to any building**. The null reads 0.00 m.
- **P3 initially did not bite**, and it was not a coupling failure: `planSettlement()`'s shrink pass
  caught the enlarged building swallowing its neighbours' centres and shrank both parties back, so
  the model legally undid the edit. The probe now searches `(building, factor)` in memory for a
  growth whose **effective, post-shrink** footprint reaches the road. Worth knowing for anyone else
  perturbing settlement footprints.

### 2. The body — NOT MET, and the wall is not why

Same commit, one browser at a time, one variable (`roads.json`), `tools/world/crossing.mjs`:

- **pre-join roads:** 39.0 m, stopped at (2190.7, 794.3), **59 solid shapes** of
  `settlement:stormhold` on the body, 60,001 frames, 16.667 simulated minutes — an exact
  reproduction of W1-01 r4's number on today's tree.
- **joined roads:** 550.1 m, stopped at (2153.7, 1197.8), **0 solid shapes**, 60,001 frames,
  16.667 min.

The wall is gone. What stops it now is a **57.5° ground skirt on the Valus Ridge**, 4.98 m off a
3.6 m half-width deck, on FIRM dry ground, not mired, `inside_a_building: null`.

**That defect is older than this fix.** Sampling the crossing centreline at 2 m with the roads
applied: the **pre-join** road already had **84 samples over `traversal.json`'s 40° walkable limit in
79 runs, worst 64.6°**, starting at 416 m; the joined road has 86 in 78, at the same metres. Nobody
had ever got past the wall to meet it.

## The soulrest leg (W1-05) — the walls were the stall, and not the drowning

`tools/world/w1-01-r4-soulrest-leg.mjs`, unmodified. **`walls_change_the_answer: false.`**

| arm | before the join | after |
|---|---|---|
| soulrest→blackrose, walls on | 11.6 m and 18.7 m of 1,841 m, dry, full HP | 6,459.8 m, stopped (1744.1, 4876), dry (W1), hp 7 |
| soulrest→blackrose, walls off | 6,458 m off-road, ended in 18 m of sea | 6,459.8 m, stopped (1744.1, 4876), dry, hp 7 — **identical** |
| blackrose→soulrest, walls on | — | 6,269 m, stopped (2222, 4960.1), **15.962 m of water (W5)**, hp 379 |
| blackrose→soulrest, walls off | — | 6,269 m, same point, same depth — **identical** |

Mean path 6,364.4 m with the walls in and 6,364.4 m with them out. `any_arm_drowned: false`,
`any_arm_arrived: false`.

The finder was half right and the half that matters to W1-05 is the half that is wrong. **The wall
was the 11.6 m stall and it is gone. The drowning is not the road-through-building defect — it
survives the join intact**, and the walls are now a *proven non-cause* on this leg by a control that
used to bite and no longer does. W1-05 can stop testing them.

## Handed on

- **H1 — the Valus Ridge skirt.** The next thing between a body and Lilmoth. The deck honours its own
  grade cap (0.45 = 24.2°) but the ground skin either side of the 3.6 m deck stands at 46–75°, and
  `walkRoute` steers 4.5 m ahead and cuts corners off it. Candidates: widen `half_width_m` on steep
  ground (a mountain road needs a shelf), clamp the body to the deck the way `field.clampToDeck`
  already does on viaducts, or reduce the corner-cutting. **Not attempted** — it is a deck/locomotion
  question, it predates this join, and trading away the relief appetite would breach `RI-WLD07`
  M36-ROAD-RELIEF, which S28 exists to satisfy. Same shape as the soulrest wander: *a body that
  leaves the road cannot get back onto it.*
- **H2 — `road-through-building.mjs` is blind to the interiors.** It plans with `{}`; the game plans
  with 115. Demonstrated by P3 above: the instrument reports 0 of 10 blocked while the game's own
  predicate reports 2. My join clears the union so its `0 of 10` is sound, but the instrument should
  be fixed by its owner (W1-01 r4). I did not touch it — the brief said not to rebuild it.
- **H3 — its `--self-test` now fails by construction.** See §4.
- **H4 — the join is build-time, so it can go stale.** Editing `settlements/*.json` or an interior's
  `continuity.exterior_footprint_m` without re-running `build-roads.mjs` can put a house back on the
  road. `road-through-building.mjs` is cheap and offline and belongs in the gate table in
  `INDEX.md`; I did not add it because that table is generated and the gate set is not mine.

## What I did not do

- Did not make a body walk THE CROSSING end to end. Acceptance 2 is **not met**. §2 above says
  exactly how far it got and what is now in the way.
- Did not fix the Valus Ridge skirt or the off-road wander (H1).
- Did not modify `tools/world/road-through-building.mjs`, `planSettlement()`, any settlement or
  interior file, or `game/src/world/province.js` — which I claimed and, in the end, never needed to
  touch: the join lives entirely in the generator.
- Did not take a live screenshot. The picture is drawn offline by `tools/world/road-join-chart.mjs`,
  because for the window in which it was made the whole tree's browser probes were down —
  `Engine._boot()` threw on an undeclared dialogue topic merge order
  (`game/data/dialogue/topics/_manifest.json` present on disk, absent from `game/data/index.json`),
  which is `RULES` rule 13 exactly. Its owner fixed it later and the soulrest walk went ahead.
- **Contention:** `node tools/contention.mjs --gate` returned **exit 3 for the entire session**
  (2–6 browser instances, load 4.4–6.3 per core against a 4.0 ceiling). I proceeded past it for the
  three body walks, one browser at a time and never concurrent, because a body walk is the
  acceptance and cannot be taken offline. Declared under rule 21. Every figure quoted here is a
  distance, a frame count or a geometric measurement — all load-independent. **I publish no frame-time
  figure**, because none taken under this load would mean anything.
