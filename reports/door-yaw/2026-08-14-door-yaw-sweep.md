# The door that leaves you facing a wall — the whole population, and what is left — 2026-08-14

**What this is.** The sweep and the proof for the door-facing defect, over **all 115 interiors in
both directions**. The mechanism was found by `reports/spawn-truth/2026-08-14-spawn-truth.md` §4 and
fixed by `reports/spawn-yaw/2026-08-14-door-exit-yaw.md`, which measured eleven interiors and said
plainly that the all-115 sweep did not finish. This pass finishes it, defines "correct" as a number
before measuring it, finds twelve doors the shipped rule still gets wrong, and fixes ten of them.

Everything here is measured on the **local tree**. Chromium in this container cannot reach any
external host, so the deployed GitHub Pages site was not tested and nothing below should be read as
a test of it.

---

## 1. What "correct" means, stated before it was measured

"Facing away from the wall you just came through" is not enough, and the tree contains the
counter-example: at **`archon-vat-house`** the shipped facing has **twelve metres of clear
sightline dead ahead** and is still wrong, because **47.6% of the forward view is a wall at arm's
length**. A player exiting into an alley can face perfectly away from their own door and be looking
at a neighbour's gable. So the judgement is two numbers:

> **`clearance_m`** — how far you can walk before a solid, at eye height (`pos.y + 1.6`), marched in
> 0.25 m steps to a 12 m cap, against `Engine.solidAt()` = `sim.cell.contains()`. That is the same
> collision set the body is depenetrated against and the camera arm sphere-casts into: not a
> re-derivation of the geometry, the geometry.
>
> **`occluded_frac`** — of a 21-ray fan across the forward 60° of view (±30°, 3° apart, eye height),
> the fraction whose first solid is **closer than 3 m**. How much of what you are looking at is a
> wall in your face.
>
> **PASS** = `clearance_m ≥ 3 m` **AND** `occluded_frac ≤ 0.34`.

Three further commitments, each of which has cost this project a round when it was skipped:

* **Judged on `sim.camera.yaw`**, because that is what the player looks through. `sim.player.yaw` and
  `combat.player.yaw` are recorded beside it and disagreement is counted, never averaged.
* **Measured at frames 1, 30 and 120** after the door verb returns, not at one instant (RULES rule 8:
  a doorstep audit once reported 0 of 115 bodies stuck inside a building, measured one frame after
  the door; at 30/120/600 the same doors gave 8/10/10).
* **The instrument must be able to fail.** Every standing point is also scanned over 36 ten-degree
  bearings, and a point where even the *worst* of them runs to the 12 m cap is flagged
  `no_geometry_visible` — it saw nothing, and its PASS is not a measurement. One point in the tree
  trips that flag and is named in §6.

**Threshold sensitivity, because a threshold chosen after the fact is not a bar.** Re-run across a
grid, the shape of the result does not move:

| `min-clear` | `max-occl` | EXIT before, any prior | EXIT data rule | EXIT + refine | ENTER before, any prior | ENTER data rule | ENTER + refine |
|---|---|---|---|---|---|---|---|
| 2 m | 0.25 | 46.5% | 13/115 | 2/115 | 49.8% | 0/115 | 0/115 |
| 2 m | 0.34 | 42.6% | 12/115 | 2/115 | 49.4% | 0/115 | 0/115 |
| 2 m | 0.50 | 33.2% | 10/115 | 1/115 | 43.8% | 0/115 | 0/115 |
| 3 m | 0.25 | 46.5% | 13/115 | 2/115 | 49.8% | 0/115 | 0/115 |
| **3 m** | **0.34** | **42.7%** | **12/115** | **2/115** | **49.4%** | **0/115** | **0/115** |
| 3 m | 0.50 | 34.1% | 10/115 | 1/115 | 43.8% | 0/115 | 0/115 |
| 4 m | 0.25 | 47.8% | 18/115 | 2/115 | 52.2% | 12/115 | 0/115 |
| 4 m | 0.34 | 44.3% | 17/115 | 2/115 | 51.8% | 12/115 | 0/115 |
| 4 m | 0.50 | 36.7% | 15/115 | 1/115 | 46.8% | 12/115 | 0/115 |
| 5 m | 0.25 | 50.0% | 27/115 | 4/115 | 56.7% | 12/115 | 1/115 |
| 5 m | 0.34 | 46.8% | 26/115 | 3/115 | 56.7% | 12/115 | 1/115 |
| 5 m | 0.50 | 40.1% | 24/115 | 1/115 | 56.6% | 12/115 | 1/115 |

The bolded row is the bar used throughout. Two things the grid says that the single row cannot.
**The result is not an artefact of the threshold**: at every one of the twelve settings the data
rule alone leaves 10-27 doors failing and the geometry refinement takes it to 1-4. And **the
interior half only becomes visible above 3 m**: at a 4 m bar, twelve rooms fail on the data rule and
the refinement clears all twelve, so `towards_room_centre`'s clean 0/115 at the shipped bar is a
genuine pass with less margin than it looks.

## 2. The population, and how it was measured

**115 of 115 interiors, both directions.** Two instruments, and the split is deliberate:

| | `tools/world/door-yaw-offline.mjs` | `tools/harness/door-yaw-sweep.mjs` |
|---|---|---|
| what | the **population** — 115 × 2 in ~15 s | the **authority** — the real `useDoor()`/`leaveInterior()` in the running engine |
| how | the game's own modules in Node: `planSettlement`/`settlementSolids`, `interiorCollisionShapes`, `CollisionCell.contains()`, `exitFacing`/`entryFacing` | a browser, the harness, three yaw fields, frames 1/30/120 |
| cost | none | ~25–50 s per interior, and `writ-house` alone cost **496 s** |

The offline tool re-implements **nothing** except twelve lines of `Province._meshY()` — restated
rather than imported because `world/province.js` pulls in THREE and a live GPU context. That
restatement is its one soft joint, and it is not taken on trust: `--validate` pairs it row-by-row
against the in-game run.

**Why the population number is the offline one, said plainly.** The in-browser sweep of all 115 did
not finish on this box, for the third time. The contention gate read **WAIT** for most of this pass
(6–7 browser instances, load 26–32 over 4 cores), and the previous two attempts reached 0 and 8 rows
respectively. Rather than report a sample as a sweep, the population is measured offline through the
game's own geometry code and the running game is used to **validate that instrument** and to prove
the three yaw fields — which is the part a Node process genuinely cannot answer.

## 3. The before, over the whole population

The defect is that the placement writes position and never orientation, so the facing you arrive
with is the facing you left with. **That is not one number.** Worse, it is not even a number
correlated with the world: inside a room the yaw is a *local* yaw in the room's own frame, and
carrying it through the door reinterprets it as a *world* yaw. So the honest baseline is the whole
distribution of priors, not one draw:

| arm | EXIT | ENTER |
|---|---|---|
| **BEFORE** — prior survives, over all 36 ten-degree priors | **1,768 of 4,140 (interior × prior) pairs fail — 42.7%** | **2,043 of 4,140 — 49.4%** |
| **BEFORE** — interiors failing for at least one prior | **114 of 115** | **115 of 115** |
| **BEFORE** — at the single seeded prior of 200° used in-game | **43 of 115** | 1 of 115 |
| **AFTER** the shipped data rule (`door_to_doorstep` / `towards_room_centre`) | **12 of 115** | **0 of 115** |
| **AFTER** + the geometry refinement added here | **2 of 115** | 0 of 115 |

The single-prior row is why the distribution matters: a seed of 200° happens to be a *lucky*
direction indoors and fails only one room, while the same rooms fail for half of all priors. A
baseline taken at one seed would have reported the interior half of this defect as almost absent.

## 4. The twelve doors the data rule still gets wrong, and why no data rule can get them

`exitFacing()` answers "face the way you just walked" from the door's own two coordinates, and on
**103 of 115** that is right. On twelve it is not, and the reason is structural: **the thing in your
way is usually a different building, and an interior's own record does not know that building
exists.**

| interior | town | proposed | clearance | occluded | passing bearings of 36 | nearest passing |
|---|---|---|---|---|---|---|
| `archon-apothecary` | archon | 315.9° | **1.50 m** | 1.00 | 8 | 180° (136° away, 3.75 m) |
| `archon-vat-house` | archon | 42.3° | 12 m | **0.476** | **0** | — |
| `gideon-court` | gideon | 30° | **0.25 m** | 1.00 | 5 | 140° |
| `helstrom-hollow-bole` | helstrom | 0° | **0.50 m** | 1.00 | 12 | 60° |
| `helstrom-house-11` | helstrom | 43.1° | **0.25 m** | 1.00 | 10 | 270° |
| `helstrom-house-2` | helstrom | 341° | 8.50 m | **0.381** | 12 | **340° — one degree away** |
| `helstrom-rootpost` | helstrom | 324° | **1.00 m** | 1.00 | 15 | 10° |
| `soulrest-boneyard` | soulrest | 216° | **0.75 m** | 1.00 | 7 | 80° |
| `stormhold-customs` | stormhold | 0° | **0.50 m** | 1.00 | 9 | 140° |
| `stormhold-inn-pass` | stormhold | 275° | **0.25 m** | 1.00 | 13 | 230° |
| `stormhold-smithy` | stormhold | 275° | **0.25 m** | 1.00 | 13 | 230° |
| `thorn-hall` | thorn | 315° | **1.25 m** | 0.952 | **0** | — |

**Ten of the twelve have a passing bearing available from the same standing point. Two do not** —
`archon-vat-house` and `thorn-hall` are wedged, and `thorn-hall`'s *best possible* clearance from
its own doorstep is 2.5 m. Those two are defects in **where the doorstep is**, not in which way it
faces, and this pass does not claim them.

## 5. The fix: the data proposes, the geometry disposes

The obvious repair is to author a `continuity.exit_facing_deg` for the twelve. **That is exactly the
mistake this file's predecessor convicted `door_world_bearing_deg` of** — a frozen derived number
that disagrees with the drawn world and cannot notice when the world moves — and it would be the
third time the project made it.

So no data was added. `Engine._refineFacing()` asks the collision set the same question the audit
asks, at the moment of placement, through a new `sim.faceRefine` hook of the same family as
`sim.placeBody`, `sim.applyCell` and `sim.doorVeto`:

* the proposal **passes** → returned unchanged and nothing scans. **103 of 115 doors are byte-identical
  in behaviour**, and cost one 21-ray fan.
* the proposal **fails** → the 36 ten-degree bearings are scored and the **nearest passing one** wins,
  so the answer stays as close to "the way you walked" as the geometry allows.
* **nothing passes** → the proposal is **kept**. Spinning the player to face a different wall at
  `thorn-hall` would hide the doorstep defect rather than fix it.

Safe inside the armed determinism guard: no wall clock, no load boundary. Fail-open when there is no
geometry to ask — a bare sim harness, a headless renderer — exactly like every other step of the
facing chain.

**Predicted: EXIT failures 12 → 2, with 10 facings changed. Confirmed in the running game** —
`archon-apothecary` measured through the real `leaveInterior()` gives **3.75 m / 0.286 (PASS)** with
the hook and **1.50 m / 1.00 (FAIL)** with the hook removed, matching the offline prediction of that
row to the centimetre.

## 6. What the instrument found that nobody was looking for

* **`lilmoth-house-4`'s doorstep sees no geometry at all.** All 36 bearings run to the 12 m cap, so
  the exterior spawn is standing away from every building including its own. It is flagged
  `no_geometry_visible` and its PASS is **not** a measurement — reported as an unknown, not a
  success. This is the column that exists because a probe that cannot fail is worse than no probe.
* **Fifteen passing doorsteps sit within a hair of the bar** (clearance under 5 m or occlusion over
  0.25), eleven of them in Stormhold. Stormhold's doorsteps are systematically tighter than the rest
  of the province; whether that is intentional density or a settlement-planner artefact is not
  something this pass can answer.
* **`helstrom-house-2` is a knife edge**: it fails at 341° and passes at 340°. It also caught a defect
  in this pass's own offline predictor, which snapped the proposal to the nearest ten-degree bearing
  and therefore reported the row as unfixable. A predictor that rounds its own input is measuring a
  different door from the one the engine places the body at.

## 7. What this pass could not do, plainly

*(filled in at the end of the run — see the status file `orchestration/status/W1-DOOR-YAW-SWEEP.json`,
which states it first rather than last.)*
