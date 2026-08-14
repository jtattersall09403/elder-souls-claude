# The resolver now measures the rectangle the world draws — and the prize was never there

**W1-OVERLAP-RESOLVER — 2026-08-14. Base commit pinned at `551c9722`; landed at `91b42a6e`.**
Offline: no browser, no GPU pod, no frames, and none are claimed.

---

## 0. What I could not do

The dispatch's headline was **"one fix, 72 pairs, across every settlement"**. The real number is **6**,
and the reason is not that the fix failed. It is that the bound the census computed cannot be reached
by any resolver.

`tools/world/building-overlap-census.mjs#shrinkFeasible()` asked "what if every building in an
overlapping pair went to `MIN_ENTERABLE_SPAN_M` = 5.0 m?" and answered *72 of 83 separate*. **No
native building can go to 5 m.** All 115 shipped interiors are native RI-WLD13 records, so
`applyInteriorBounds()` takes its native branch and returns early — **nothing applies
`interior_bounds_m`**, and the room behind the door cannot be shrunk to follow its building. The real
floor is `room + ROOM_WALL_T + SHELL_WALL_T`, and:

> **227 of the 230 axes of the 115 enterable buildings have one centimetre of slack above it.**

The shipped resolver was already spending that centimetre — its 25 shrunk enterable buildings are each
shrunk by exactly 0.01 m. The size-only lever is not miscalibrated. It is **exhausted by
construction**, because the rooms were authored to fill their buildings to within a centimetre.

Also not done, and stated plainly:

- **The 11 that need a move are not done, and neither are the other 65.** All 76 remaining pairs need
  positions moved, not sizes reduced. The dispatch scoped me out of building moves; that scoping was
  right, but it now covers 76 pairs rather than 11.
- **I contaminated my own baseline tree mid-run.** My arm trees were `cp -al` hard-link clones and two
  later tool-file edits wrote *through* the link into the pinned base. The live repo was never touched.
  The two files that decide every measurement were verified pristine against the sha, the two
  contaminated files were restored from the sha, and the baseline was **re-measured: still exactly 82,
  byte-identical counts** — and independently reconfirmed by the full-teardown delete-the-fix arm.
- **`check-building-fits-room.mjs --self-break` exits 1, and did so before I touched anything.**
  Verified identical on the pinned base and after the fix. Pre-existing, and it is the same vacuity the
  census already reported: on a world of 115 native records the join genuinely does not resize any room,
  so there is nothing for that self-break to break.

---

## 1. The falsifier the census named, answered

> *"If a yaw-aware shrink at the shipped `MAX_OVERLAP_FRAC = 0.45` still leaves most pairs over the
> 1.50 m bar, then the **tolerance** is the defect rather than the orientation."*

**Neither.** The falsifier offered two candidates and the answer is that both are real defects and
neither is the constraint. Measured against a baseline of 82:

| arm | counted overlaps |
|---|---|
| shipped resolver (the baseline) | **82** |
| yaw-aware, tolerance left at `MAX_OVERLAP_FRAC = 0.45` | **82** — clears nothing |
| yaw-**blind**, tolerance in metres — *the matched null control* | **77** — clears 5 |
| yaw-aware, tolerance in metres — **shipped** | **76** — clears 6 |

and the count is **76 for every tolerance between 0.50 m and 1.50 m**. A knob whose entire useful range
moves nothing is not the constraint.

Both diagnoses in the census are nevertheless correct, and both are fixed here:

- **The tolerance at 0.45 is genuinely wrong.** 45% of the smaller span is 4.5 m of interpenetration for
  a pair of 10 m buildings, against a bar of 1.50 m. Made yaw-aware and left at 0.45, the resolver
  clears *nothing at all*. It buys 5 pairs.
- **The orientation is genuinely wrong, and not in doubt.** The resolver and its counter measured a
  rectangle the world does not have; `_deepOverlaps()` reported 22 when the truth was 82; and the
  oriented path draws **21 buildings at a different size** from the yaw-blind one. It buys 1 more pair.

**What is actually the constraint is the lever.** Take the room floor away on a copy and the *same*
resolver clears **68 of 82** — while drawing 66 buildings smaller than the rooms behind their own doors,
which `check-building-fits-room.mjs` fails closed on. That arm is the size of the prize, and it is not
collectable by a resolver.

---

## 2. What shipped

**`game/src/world/footprint.js` — new, and the point of it is that there is now one of it.** The census
had a private copy of this geometry, the resolver had a second, and `_deepOverlaps()` had a third; two
of the three measured a rectangle that is not in the world, and they agreed with each other. The
rotation convention is copied from `settlementSolids()`'s own `push()` rather than re-derived, so a
change there shows up here as a disagreement instead of a silent drift. The census's ten-arm self-test
— including the two arms that *require* the axis-aligned and yaw-90 answers to differ — now exercises
the shipped functions rather than a duplicate of them, and still passes 10/10.

**The shrink pass** is oriented SAT over both buildings' edge normals. It resolves on the axis that
costs the pair least, pulling on each building's own local axis most aligned with that separating
direction — which at yaw 0 on the world-x axis is exactly what the old code did, so this generalises
the shipped rule rather than replacing it. The tolerance is `SEPARATION_TOL_M = 1.45`, **in metres**:
the census's 1.50 m bar with 0.05 m of margin, so the resolver and the check that grades it are in one
currency. A pair settled at exactly the bar rounds back over it — measured, at tolerance 1.50 the count
is 76 but four pairs land on the line.

**`spanFloor(b, k)`** is now per-axis and floored at the room. This is the change that makes the
resolver honest about what it may spend, and it is why the count is 76 and not 13.

**A doorstep pass**, because two fail-closed assertions were green by accident. `stormhold-archive`'s
authored `continuity.exterior_spawn` lies **0.25 m inside its own declared footprint** — the only such
building in the world, counted rather than assumed — and the body does not stand in the archive's wall
today only because the yaw-blind resolver happened to cut that building's depth for an unrelated pair.
`archon-house-1` sits 0.08 m from a doorstep once its neighbours stop being shrunk on the axis the
axis-aligned resolver happened to pick. Ruling D1 is explicit that moving a spawn "converts a visible
geometric fault into an invisible one", so **no doorstep is moved**: the building gives up the span, and
every building the rule touches is named on the plan as `doorstep_limited` rather than silently
compensated.

**`province.js#_deepOverlaps()`** loses its private copy of the axis-aligned arithmetic and counts
`pairDepth()` against the census's own bar. It reported 22 when the truth was 82.

---

## 3. The result

| settlement | before | after |
|---|---|---|
| archon | 15 | **12** |
| blackrose | 8 | 8 |
| gideon | 6 | 6 |
| helstrom | 7 | 7 |
| lilmoth | 19 | **16** |
| soulrest | 12 | 12 |
| stormhold | 3 | 3 |
| thorn | 12 | 12 |
| **total** | **82** | **76** |

**Zero new overlapping pairs in any arm** — shrinking cannot create an overlap, and that was checked
rather than assumed. The counter stops lying: 22 → the true 76. `planSettlement()` for all eight
settlements goes from 16 ms to 32 ms, once, at load, and is cached per settlement.

**It cost almost nothing in building**, which is the same fact as the lever being exhausted: 149 mass
buildings average **97.42%** of their declared footprint, against 97.48% before; worst 36%, against 38%
before.

---

## 4. The statistic that can fail

A falling count is necessary and not sufficient. The only lever is shrinking, so the ratchet could
always be satisfied by ruining the towns — and it would report that as an improvement. So the count is
now asserted **together with what it cost**, in `tools/check-building-overlap.mjs`:

- `SIZE_FLOOR_FRAC = 0.25` — no mass building below a quarter of its declared footprint area;
- `TOWN_MEAN_FLOOR = 0.90` — the world's 149 mass buildings average at least that.

Tripwires, not targets, and silent on the shipped tree *and* on the tree before it (worst 37.8% → 35.96%,
mean 97.5% → 97.4%). **`node tools/check-building-overlap.mjs --self-break-size`** removes the room floor
on a control clone — which clears **63 more overlaps** — and requires both assertions red there and
silent on the shipped tree. It is exactly the failure the dispatch warned about, caught:

```
sabotaged tree: mean 80.9%, worst 22%, 2 size fault(s), and it clears 63 more overlap(s)
    a building is drawn at 22% of its declared footprint, below the 25% floor
    the world's 149 mass buildings average 80.9% ... the resolver is buying separation by shrinking the towns
shipped tree:   mean 97.4%, worst 36%, 0 size fault(s)
```

---

## 5. Delete-the-fix

`node tools/world/overlap-resolver-deletefix.mjs` — **9 of 9**. Every arm from its own control clone,
**head arm included** (HAZARDS §11: four agents changed four files under `game/` in 45 seconds today).

| arm | overlaps |
|---|---|
| head | **76** |
| orientation-off | 77 |
| tolerance-off | 81 |
| orientation-and-tolerance-off | 79 |
| **THE-WHOLE-FIX-DELETED** | **82** |
| room-floor-off | 13 — *and 66 buildings then draw smaller than their own room* |

It is built not to have the three failures rule 6 names. **Not an inert fix:** every arm asserts the
anchors it is about to remove are present, and the tool exits 2 on a tree that never carried the change
rather than reporting a clean negative. **Not an inert control:** every teardown asserts the bytes it
wrote differ from the bytes it read. **And the fix actually ran** — not inferred from the number moving:
9 yawed buildings are shrunk by the oriented path, the doorstep pass names 8 buildings, and the oriented
path draws **21 buildings at a different size** from the yaw-blind arm. A leg that changed the count but
no rectangle would be arithmetic.

This is rule 6's **fourth shape — coupled legs**, and saying so is the honest report: no single-leg arm
returns 82, because each leaves the other standing. Only the full teardown does. The legs are also **not
additive**: `tolerance-off` is 81 and `orientation-and-tolerance-off` is 79, so removing orientation from
an already-broken tolerance *improves* the count. That interaction is real, and it is why the
full-teardown arm exists.

---

## 6. What is left, and it is now the whole class

**76 pairs, all of which need a position moved.** 11 cannot be separated by any size change at all; the
other 65 could be, but only by drawing buildings smaller than the rooms behind their doors. Moving one
building is still the **nine-value edit** the census found — `offset_m`, `door` and `door_declared` in the
settlement document, and `door_world_pos`, `apertures[].world_pos`, `exterior_door`,
`continuity.exterior_spawn` and `exterior_spawn_declared` in the interior record, which are world
coordinates that do not follow `offset_m`.

Two things make that piece much cheaper than 76 hand placements, and whoever takes it should start here:

- **`thorn-gate` and `thorn-house-0` are authored at the identical `offset_m` `[-6.86, 0, 8.6]` with the
  identical yaw.** Two buildings at one spot, 100% of the smaller inside the larger. It is the cheapest
  single fix in the world.
- **Five Blackrose pairs are authored exactly 1.0 m apart** — inn/warders-hall, market/smithy,
  rootpost/clerk, house-0/house-1, condemned-row/old-gallows. That is a generator artefact, not five
  independent authoring mistakes. **Look for the generator before hand-placing ten buildings.**

**The ratchet is re-frozen at 76 and stays non-blocking**, and that is a call, not a default: 76 overlaps
and 24 doors-inside remain, so a fail-closed zero gate would throw for every agent on the box — RULES
rule 13 exactly. It should become blocking when the layout piece lands, not on the resolver's account,
because the resolver cannot get there. What *did* get tighter is the half that matters for that piece:
the ratchet now refuses a lower count that was bought by shrinking, which it could not do before, and the
layout piece will be pulling the other lever.

---

*Evidence: `corpus/90-verdicts/wave1/artifacts/W1-OVERLAP-RESOLVER/` — `deletefix.json`,
`census-after.json`, and the three measured arms. Status and the full could-not-do list:
`orchestration/status/W1-OVERLAP-RESOLVER.json`.*
