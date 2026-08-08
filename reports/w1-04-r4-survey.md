# W1-04 round 4 — the building now contains the room

Builder's survey. Every number here is reproducible by the tool named beside it; the JSON the
tools write is under `reports/w1-04-r4/` and is gitignored by `reports/.gitignore` on purpose
(run artifacts are evidence, not source — re-run the tool).

**Base commit `9e962a4`.** The source changes were carried into commit **`a2031bb`** by another
agent's commit taking the whole index — RULES.md rule 17's own failure mode, reported rather than
unpicked, and the content landed intact.

---

## 1. The gap this round exists for

The round-3 verdict, §11: *"41 of 112 enterable buildings now draw an exterior smaller than their
own interior… `blackrose-inn` at 6.3% of the interior's area — a 3.4-metre shed you walk into and
find a 13.6-metre inn."* RI-WLD13 N1 went from vacuous to **false**.

### Measured off the scene graph, not off the data

`tools/world/w1-04-r4-join.mjs` imports `render/exterior.js#buildBuilding` and
`render/interior.js#buildInterior`, builds both trees in bare Node, and measures them:

* the **outside** is the four wall slabs, by name (`shellwall`) — not the roof, not the plinth,
  not a kit mesh parked a metre off the gable;
* the **inside** is the room's shell (`roomshell`) — floor, ceiling, four walls, and not a shelf
  that overhangs one of them.

Both names were added by this round; naming them is what makes the question askable at all.
Previous measurements of N1 divided `bounds_m` by `continuity.exterior_footprint_m`, which are
the same array on 115 of 115 records, so the ratio was 1.000 by construction.

| | at `9e962a4` | now |
|---|---|---|
| enterable buildings measured | 112 | 112 |
| **outside smaller than inside** | **41** | **0** |
| worst area ratio (outside ÷ inside) | **0.0725** `blackrose-inn` | **1.095** |
| median area ratio | 1.0088 | 1.1262 |
| roofs that do not cover their building (raycast, 64 samples) | **62 of 202** (archon 22, helstrom 40) | **0 of 202** |
| worst roof coverage | 0.75 | 1.000 |
| prop builders that throw | 3 (`barrel_row`, `bench_pair`, `bla_prison_block`) | 0 |
| kit ids drawn across the province | 68 of 69 | **69 of 69** |

The 41 and the 0.0725 reproduce the round-3 verdict's own numbers from a different instrument,
which is the only reason to trust either.

## 2. What was changed, and why it is not "grow every shed"

Three levers, in `render/exterior.js` and `world/province.js`:

1. **The shrink is per axis.** It was one scalar applied to both, so resolving a 2.8 m gap in *x*
   by scaling both axes to 0.25 threw away the whole of *z* for nothing. Resolving it in *x*
   alone turns a 13.6 × 15.6 m hall into a **13.6 × 5.0 m terrace** — which is what a dense town
   looks like, and Blackrose's own plan comment says "Blackrose is corridors". Area loss goes
   from `t²` to `t`.
2. **An enterable building has a floor the plan may not push it under** — `MIN_ENTERABLE_SPAN_M
   = 5.0`. Below that the shrink stops and the pair terraces, which is reported as
   `deep_overlaps` rather than hidden.
3. **The room is sized to the building that holds it** — `applyInteriorBounds()`, called from
   `province.js#setSettlements()` on `Engine.data.interiors` **by reference**, so the room that
   shrank shrank for `sim/npc.js` and `sim/settlement.js` too and not only for the picture. It
   **never grows a room**: `min(declared, what the building can hold)`. `continuity.interior_spawn`
   is clamped a metre inside the room that now exists, because a doorstep a metre inside the
   *declared* room is inside the masonry of a smaller one.

**No settlement became a row of identical boxes.** 112 enterable buildings, **34 distinct drawn
footprints**, areas 44.9–251.7 m², and **0 buildings at the floor on both axes** (10 at the floor
on one axis, i.e. terraces).

**What it cost, stated plainly.** 41 rooms are now smaller than their record declares, worst
`archon-market` keeping 17.1% of its declared area (7.3 × 4.98 m). That is the town plan's
conflict made visible instead of hidden: Archon's nearest-neighbour spacing is 2.8 m against a
13.6 m declared footprint, and something has to give. The remaining honest fix is in the data —
re-derive `buildings[].offset_m` with RI-WLD03 R4's legibility rule — and it is not this round's.
`deep_overlaps` is **12**, unchanged from round 3.

## 3. Delete-the-fix, as a 2×2 (RULES.md rule 6)

The fix is two changes, so a single arm would misreport it. Round 3's uniform shrink is
re-created verbatim inside `w1-04-r4-join.mjs`, and each cell rebuilds every plan and every room
from the shipped data with the records restored in between.

| arm | outside < inside | worst outside/inside | smallest room span | worst room keeps |
|---|---|---|---|---|
| **shipped** (per-axis shrink + join) | **0** | 1.095 | 4.64 m | 17.1% |
| join deleted, per-axis shrink kept | **41** | 0.226 | 10.3 m | — |
| round 3's uniform shrink, join kept | **0** | 1.096 | **3.04 m** | **4.2%** |
| both deleted — this is round 3 | **41** | **0.0725** | 10.3 m | — |

This is the **two-guards-for-one-defect** shape, not an inert fix and not an inert control: the
join alone closes containment and leaves 3 m rooms; the shrink alone leaves 41 buildings failing.
Both are load-bearing, for different halves of the same defect.

## 4. The live arm — does the running game do any of this?

`tools/world/w1-04-r4-join.mjs` calls `applyInteriorBounds()` **itself**, so it would pass even if
`province.js` never called it. `tools/world/w1-04-r4-live.mjs` asks the running engine instead —
one browser, launched and kept (see method deviations).

* **S1.** 112 enterable buildings read off the engine's own `settlementPlans` and the interior
  records it is holding: **0 draw an exterior smaller than their own room**, **0 records the
  engine failed to join**, worst live area ratio **1.0887**.
* **S2, the control.** The join undone on the live records and `setSettlements()` re-run:
  **112 of 112 fail**, worst ratio **0.2116**. Restored through the engine's own call: **0 fail**.
  The control has a demonstrated failure mode; it is not a second copy of the experiment.

## 5. Two instruments replaced rather than re-run

**(a) The pixel sweep is unmeasurable and is no longer allowed to report.** The round-3 critic
proved it: 8 of 8 distinct images from **one unchanged room** after two fixed steps, and the
8-town control drew **zero buildings** and still returned 8 distinct images.
`tools/world/w1-04-interior-sweep.mjs` now measures its own noise floor **first** — eight shots of
one room under the identical protocol — and if that is not 1 it prints "UNMEASURABLE", writes no
cross-room number and exits 21.

**(b) The replacement is a geometry signature, and it publishes its floor before its number.**
`__HARNESS.getDrawnSignature()` walks the visible cells' `Object3D` trees and folds a **sorted**
hash over geometry type, geometry parameters, material colour and the transform relative to the
cell root. Nothing in that advances on its own. Offline (`w1-04-r4-join.mjs`, all 115 records):

| arm | must be | measured |
|---|---|---|
| n0 — the same room built twice | 1 | **1** |
| n1 — the null control: 115 doors, one record | 1 | **1** |
| n2 — the 115 shipped records | the number | **115 distinct, largest identical group 1** |

n1 is the arm the pixel sweep failed.

**(c) `interior.meshes` is a build record, and round 2's "92 distinct scene-graph signatures" was
hashed from it.** `getDrawnSignature()` is the scene read that replaces it; S4 of the live arm
empties the room's group behind the world's back and requires the new verb to go to zero while
the old block goes on reporting a room that is not there.

## 6. Also fixed, from the verdict's list

* **`Object.assign(group, {position})`** — three sites in `render/interior.js`. `Object3D.position`
  is not writable, ES modules are strict, and `buildInterior`'s per-prop `catch` substituted a
  crate **without incrementing `props_fallback`**: 34 instances across 22 rooms counted as built.
  Fixed, and the accounting fixed with it — a builder that throws is now counted as a fallback and
  named in `summary.props_threw`. Blackrose draws its eighth kit mesh again: 69 of 69 across the
  province.
* **The roofs.** `hipRoof()` — a four-sided hipped deck that covers the plan, with the dome or
  shell on top of it, so Archon still reads as Archon. The turn goes into the **geometry**, not
  the node: `Object3D` composes `T·R·S`, so rotating the node 45° turns an already-scaled base and
  hands back a diamond over a rectangle. The first version did exactly that and the raycast caught
  it.
* **VP04 is out of the wall.** Moved to `[3859, 15.0, 860]` looking at `[3820, 14.2, 859]`,
  surveyed by `tools/world/w1-04-r4-vp04.mjs` against the same `planSettlement()` the renderer
  builds from: 9.6 m clear of every wall, all 15 of Thorn's buildings inside a 60° cone, nearest
  facade 20.4 m. The old pose is preserved in the viewpoint's own note, because cross-wave
  comparisons cite it.
* **The nulling pattern one verb below the round-3 fix** — `api.js` `__w1_04_perturbSettlement`
  no longer nulls `_townCell` behind `_settleSettlementSolids()`'s back; it clears `_townSolids`
  and calls the method, which owns the handle.
* **`__w1_04_drawBuildings` cuts the solids it used to leave standing.** The round-3 critic
  measured doors 20/20 → 0/20, buildings 15 → 0 and **collision 67 in both arms** — 67 invisible
  solid slabs in an empty street. The default now cuts both; `{visual_only: true}` keeps the old
  behaviour for the arm it is actually right for, and the return value carries `collision_shapes`
  in both cases so a caller can see which world it is in.
* **The vacuous check is gone.** `exterior_restored_on_exit` counted `drawn().agrees` after
  leaving, which is trivially true on every build this piece has ever had — the round-3 critic
  reproduced it 12 live / 12 cut. It now requires three things read off the scene: the room was
  drawn on entry, the room's signature differs from the street's, and the street's signature comes
  back. A door that never drew a room cannot restore the exterior by leaving one, so the control
  arm goes red.
* **A check, not a probe.** `tools/check-building-fits-room.mjs`, wired into
  `tools/check-data.mjs` (which the pre-commit hook already runs on every commit touching
  `game/data/`). `--self-break` runs the same assertion with the join skipped and requires it to
  fail: **112 of 112** fail there. If it ever passes with the join removed, the tool exits
  non-zero to say it is measuring nothing.

## 7. Gates

* `node tools/harness/boot-check.mjs` — **PASS**
* `node tools/check-data.mjs` — **PASS**, including the new rule
* `node tools/world/w1-04-r3-exterior.mjs --offline` — **all 8 assertions PASS**, 202/202 drawn,
  69/69 kit ids, kit exterior==interior 112/112, three perturbations move the graph
* `node tools/world/w1-04-r4-join.mjs` — **exit 0**

## 8. What I did not do

* **`tools/world/w1-04-consumption.mjs` was edited and not re-run.** I replaced its vacuous
  `exterior_restored_on_exit` check with one that reads the scene, and the aggregation itself
  (RULES.md rule 9) has not been run end to end on this tree. The new check degrades to *fail*,
  not to *pass*, if the verb it needs is missing, which is the safe direction — but it is
  unverified and a critic should run it first.
* **The live distinctness sweep is capped.** The full 115-room S3 outlived its wrapper's timeout
  under a loaded box and was re-taken at 40 rooms. The offline arm covers all 115 with the
  identical algorithm, and I have **not** claimed that a live signature equals the offline one for
  the same room — the two traversals start from different roots and I did not prove they agree.
* **`inCoverFraction` on both arms** of the town collision set — still open from round 3.
* **The observed-theft branch** (owner present and watching) — still open from round 3.
* **RI-WLD03 M13**, the blind top-down layout test — still not run, and rule 25 forbids me judging
  a pack I built.
* **The residual 12 deep overlaps and the three townspeople standing in masonry** are not fixed.
  The remedy is in the settlement data — `buildings[].offset_m` re-derived with the legibility
  rule — and this round deliberately did not move a building.
* **No street surface, no paving, no yard.** Unchanged from round 3.
* **No timing figure is published anywhere in this piece** (rule 26).

## 9. Method deviations

* `node tools/contention.mjs --gate` returned **GO** at the start and **WAIT (exit 3)** later — 2
  browser instances, load 5.59 per core against a ceiling of 4.0. Rule 21 permits proceeding if it
  is declared: I did, **once**, with **one browser** kept for the whole run
  (`w1-04-r4-live.mjs`), because the pooled capture daemon's query path is a read-only whitelist
  and every section of the live arm mutates the world. Both pictures went through the **pool** and
  launched nothing.
* `game/src/render/exterior.js` was undeclared by any live piece when I started; I declared it
  before writing (rule 16). It carries the shrink pass, which is where the gap lives.
* **Two of my own probe defects, reported because they cost frames.** (1) The first hip roof
  rotated the node instead of the geometry and produced a diamond over a rectangle; the raycast
  caught it, a bounding box would not have. (2) The first two attempts at the inn photograph came
  back black — once because the hand-picked camera offset was inside the neighbour, once because
  the surveyed point was 5 m from a 13.6 m wall with a 68° lens. The standing point is now
  surveyed **with a range band**, which is the same class of mistake VP04 has now been condemned
  for twice.
