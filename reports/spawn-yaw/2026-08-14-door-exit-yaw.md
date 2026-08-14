# The door that leaves you facing a wall — fixed, and measured — 2026-08-14

**What this is.** A build pass acting on the two facts
`reports/spawn-truth/2026-08-14-spawn-truth.md` established by playing the game:

1. **The game starts in Thorn, not Lilmoth.** `game/data/states/default.json` (Lilmoth harbour
   steps) is the harness/debug boot; a player who clicks **New** goes through `censusBegin({})`
   into `barge-hold` and then `writ-house`, both tagged `"settlement": "thorn"`.
2. **Door exits never set yaw.** `useDoor()` and `leaveInterior()` place the body through
   `placeBody()`, which wrote **position and never orientation**, on all 115 interiors.

Three things were done: the yaw defect was fixed and measured; the first-ten-minutes tooling was
retargeted at the real opening and the debug spawn made loud; and the opening was re-photographed
at Thorn. **Where the game starts was not moved** — that is a design decision with a blast radius
and belongs in a ruling, not a patch.

Tools (committed, re-runnable):
`tools/harness/door-exit-yaw.mjs`, `tools/harness/opening-capture.mjs`, `tools/lib/opening.mjs`.

---

## 1. The instrument, and the number it reports

A facing is not an opinion, so the check is a distance:

> **`clearance_m` — how far you can walk before a wall, at eye height, along the way you are
> facing.** Marched in 0.25 m steps out to a 12 m cap against `Engine.solidAt()`, which is
> `sim.cell.contains()` — the *same* collision set the body is depenetrated against and the camera
> arm sphere-casts into, built by `_settleSettlementSolids()` from
> `province.settlementSolidsNear()`. Not a re-derivation of the geometry: the geometry.

A player put down facing a wall measures a fraction of a metre. A player put down facing the
street measures the cap.

Every row is seeded **adversarially**: the body is placed with yaw 200° before the door verb runs,
because the defect is precisely that the prior yaw survives. Any rule that ignores the prior yaw
must be blind to that number, and any rule that does not must show it.

## 2. What the data said, and why the obvious answer was wrong

The obvious primary was `door_world_bearing_deg` — RI-WLD13 §4 requires it, N2 ("the door that
turns you") is the zero-tolerance check on it, and **all 115 interiors carry it**, as do all 115
settlement building rows. It is also, measured against the world that is actually drawn, **wrong in
both directions**:

| interior | `door_world_bearing_deg` | clearance along it | clearance along its reverse |
|---|---|---|---|
| `writ-house` (the first door in the game) | 180° | **0.50 m** | 12 m (cap) |
| `barge-hold` | 90° | **0.75 m** | 12 m (cap) |
| `archon-inn` | 40.1° | 12 m (cap) | 3.75 m |

The reason is archaeology worth writing down, because it is the same shape three times now: the
field is a **frozen derived value**. `tools/world/w1-04-r7-freeze.mjs` wrote it as
`entry_side + continuity.building_yaw_deg`, exactly — checked over the shipped tree, the residual
is 0° on all 115 with `south → 180`. And `entry_side` is itself contradicted by the records it
sits beside: **109 of the 115 declare `"south"` and then put `interior_spawn` against the +z
wall**, while `render/exterior.js#entrySideLocal()` reads `"south"` as `wz = +1`. So the declared
bearing is a second, disagreeing copy of a number the geometry already carries.

**The rule that was shipped instead is geometric.** On the way out:

> **face the way you just walked** — the bearing from `door_world_pos` to
> `continuity.exterior_spawn`, the two numbers the placement itself uses.

and on the way in, in the room's own local frame (an interior is its own cell at its own origin,
so `interior_spawn` is a local coordinate and the yaw is a local yaw):

> **look into the room** — from `interior_spawn` towards the centre of the room's own `bounds_m`.

**Coverage: 115 of 115 resolve on the primary rule, in both directions.** Nothing falls through to
the `entry_side` fallback and nothing falls through to `door_world_bearing_deg`, which is kept last
rather than first. Zero interiors lack the information; the honest answer to "what did you do for
the ones that don't have it" is "there are none, and the chain that would have handled them is
written and unexercised."

## 3. The fix, and the two ways it could have been fake

`game/src/sim/settlement.js` gains `exitFacing(rec)` / `entryFacing(rec)` and passes the answer
through `placeBody(sim, at, yaw)`; `game/src/engine.js#_placeBody(x, y, z, yaw)` writes it.

**It writes three things, and missing any one would have made it inert:**

* `sim.player.yaw` — which is a **mirror**. `combat-bridge.js#mirror()` runs `p.yaw = b.yaw` at
  the top of every step, so a yaw written only here survives exactly one frame and is then quietly
  overwritten. This is the same defect the file's own header comment is about, one field along, and
  it would have passed any single-frame probe.
* `combat.player.yaw` — the body the mirror is a mirror of.
* `sim.camera.yaw` — the load-bearing half. `stepCamera`'s auto-recentre walks the camera towards
  the body at `recentre_yaw_clamp_deg_per_frame` = 1.5°/frame, so a 180° correction would take two
  seconds of the camera grinding round *while the player is still looking at the wall*, which is
  the entire complaint. A cell transition is exactly where a snap is correct — there is no
  continuity of view across a door to preserve — and `_censusPlace()` already snaps both.

Safe inside the armed determinism guard, unlike `teleport()`'s `_settleCamera()`: these are field
writes with no wall clock and no load boundary.

## 4. The measurement, both arms

Driven through the **real** door verbs — `H.enterInterior(id)` then `H.exitInterior()`, which are
`useDoor()` and `leaveInterior()`, the same two functions `stepSettlement()` calls off the
`interact` latch. Not a `teleport()`: `teleport()` takes `opts.yaw` and a door does not, so
measuring the door defect through a teleport measures the instrument.

**The null control is the plausible wrong answer, not the trivial one:** the same yaw the fix
computes, read off the wrong end — a player turned to face the wall they came through. Measured
from the same standing point on the same frame, so two arms that came back equal would convict the
instrument rather than the fix.

**Seven interiors across three towns**, 12 m cap (`reports/door-yaw/smoke-after.json` and
`sample-17-after.json`): `writ-house`, `barge-hold`, `archon-inn`, `archon-apothecary`,
`archon-kiln-house`, `blackrose-clerk`, `blackrose-pawn`.

| arm | median | mean | under 2 m | at the 12 m cap |
|---|---|---|---|---|
| **as shipped** (no yaw written; adversarial prior survives) | 4.5 m | 5.11 | **3/7** | 2/7 |
| **fixed** (`door_to_doorstep`) | **12 m** | **10.50** | **1/7** | **6/7** |
| **null control** (the same yaw, inward) | 6.75 m | 5.68 | 2/7 | 1/7 |
| the declared `door_world_bearing_deg` | 12 m | 7.25 | 3/7 | 4/7 |
| the best of 36 bearings from that point (the ceiling) | 12 m | 12.00 | 0/7 | 7/7 |

Per interior, and the last column is the honest one:

| interior | as shipped | fixed | null inward | best possible |
|---|---|---|---|---|
| `writ-house` — the first door in the game | **0.50** | **12** | 0.25 | 12 |
| `archon-inn` | 0.25 | **12** | 0.25 | 12 |
| `archon-kiln-house` | 4.50 | **12** | 6.75 | 12 |
| `blackrose-clerk` | 5.50 | **12** | 5.25 | 12 |
| `barge-hold` | 12 | 12 | 7.25 | 12 |
| `blackrose-pawn` | 12 | 12 | 12 | 12 |
| **`archon-apothecary`** | 1.00 | **1.50** | **8.00** | 12 |

**The control goes red where it matters.** On the writ house — the door every player opens first —
12 m against 0.25 m is the whole span of the instrument, and `as shipped` sits at the bottom of it.

**And `archon-apothecary` is a real counter-example, reported rather than dropped.** There the fix
gives 1.50 m, its own reverse gives 8 m, and the best available facing from that standing point is
12 m at 220° — which is neither. So the doorstep has a good facing and *no rule derived from the
door geometry alone finds it*: `exterior_spawn` sits at bearing 315.9° from `door_world_pos`,
pointing at something 1.5 m away. That is one of seven, it is a smaller failure than the one being
fixed (1.50 m is not 0.25 m), and it is a named open gap with a number rather than a rounding of
the result. The instrument's `best` column exists precisely so a bad *rule* can be told apart from
a bad *point*, and here it says: bad rule, good point.

**And the fix demonstrably executed**, which is the third failure mode and the nastiest — a number
that moves the right way for a reason that is not your change:

* `yaw written on exit: 3/3`, `on enter: 3/3`, all from source `door_to_doorstep`
* `body yaw == mirror yaw: 3/3` — the combat body carries it, so the mirror cannot undo it
* `camera == body: 3/3` — the camera snapped with it

The rule-comparison columns from the same run, scored from the standing point before any code
change, agree: `from_door` 12 m median on 3/3, `outward` (`door_world_bearing_deg`) 0.75 m median
with 2/3 under 2 m. A `best` column — the best of 36 ten-degree bearings from the same point —
reads 12 m on all three, which is how a bad *rule* is told apart from a bad *point*: these
doorsteps are fine, the facing was not. `inside_a_building` is 0/3, so the exit points are not
buried in masonry either.

## 4a. The opening, re-photographed at Thorn, on real hardware

`tools/harness/opening-capture.mjs` plays the shipping opening — title, `New`, the census graph,
out through the writ house door by `leaveInterior()` — and then photographs it the way owner
directive 2026-08-14 §2 demands rather than the way that got the transparency defect declared
fixed: **eight orbit angles 45° apart around the standing body at the exit moment, thirty seconds
of held-forward walking one frame per second, at a desktop viewport and again at a phone
viewport.** Every frame carries the player's own `facing_yaw_deg` and `clearance_m` in the
manifest, so a picture cannot be argued about without arguing about a number.

It ran **on a rented GPU**, through `tools/visual/gpu-deck.mjs --opening` (new flag; the Deck does
not contain the opening at all, because until yesterday nobody knew where the opening was):

| | |
|---|---|
| renderer | `ANGLE (NVIDIA, Vulkan 1.4.312 (NVIDIA L4), NVIDIA)` — `software_renderer: false` |
| frames | **84** (42 desktop 1280×720, 42 phone 390×844) |
| where | `thorn`, `[3808.6, 13.28, 909.36]` — the writ house's own `exterior_spawn` |
| yaw before the door | **320°** (the census framing, facing the Warden-Scribe's shelves) |
| yaw after the door | **70°**, `yaw_source: door_to_doorstep` |
| worst clearance over all 40 outdoor frames per viewport | **12 m — the cap. Nothing under it.** |
| cost | **three pods, $0.066 in total** — RTX A5000 4.33 min $0.019, an L4 cancelled 40 s in when the phone-viewport defect was spotted (~$0.00), and an L4 5.74 min $0.047. **All three terminated, and in every case the tool re-queried the API and got "not found" back.** No pod is left billing. |

Frames: `docs/shots/2026-08-14-spawn-yaw/` (tracked); full runs in
`reports/runpod-gpu/runs/opening-thorn/` and `opening-thorn3/` (gitignored, reproducible).

**Two things the pictures showed that the numbers did not, and both are recorded rather than
tidied away:**

* **The first hardware run's walk was invalid and its own manifest caught it.** `camera({mode:
  'gameplay'})` releases the position override but leaves `sim.camera.yaw` wherever the last orbit
  put it, and `move: [0, 1]` is forward *relative to the camera* — so thirty seconds of "walking
  out of the door" set off at 315°, the last orbit angle, and hit something at 0.25 m one second
  in. Visible only because `facing_yaw_deg` went 70 → 315 between the orbit and t01s. Fixed (the
  door's pose is stashed and restored) and re-run; that is what the table above reports.
* **The "phone" pass of the first run was not a phone pass.** `launchGame`'s width/height set the
  browser viewport, not the canvas backing store, so the phone PNGs were byte-identical in size to
  the desktop ones. Caught by comparing file sizes, not by anything going red. The tool now sizes
  the canvas per viewport; the corrected run's phone frames are 390×844 and about a third of the
  bytes.

**And one thing the pictures show that is still wrong**, stated plainly: in
`hw-desktop-011-exit-gameplay-camera.png` the player character is **not in frame**. The body is
correctly turned and looking out over the marsh, but the third-person arm is collapsed against the
writ house wall immediately behind it, so the camera sits at the body rather than behind it. That
is the camera arm's problem, not the facing's, it is a cousin of the already-diagnosed D1
camera-burial defect, and this pass did not fix it.

## 5. Retargeting the tooling at the real opening

`tools/lib/opening.mjs` is new and is the shared piece, so this cannot recur one tool at a time:

* `playToWritHouse(g)` — title → `New` → the whole census graph, through the real verbs
  (`titleActivate`, `censusEnter`, `censusAnswer`), with deterministic answers so two runs are
  comparable.
* `leaveWritHouse(g)` — out through `leaveInterior()`, the real placement.
* `startOpening(g, { start })` — one call; `start: 'debug'` opts into the Lilmoth harness boot.
* `debugSpawnBanner()` — the loud part.

`tools/harness/first-ten.mjs` now **defaults to `--start shipping`** and records `start` and
`measures` in its manifest, so a manifest that does not say where it stood cannot be filed. Its D3
street shot is named after the town the census actually reports rather than hard-coded `lilmoth`.

**The debug default was not deleted** — booting to a known world coordinate is the right thing for
a probe measuring terrain, weather or any town that is not Thorn. It is now loud in three places:

1. `game/data/states/default.json` carries `"harness_default": true` and a
   `"not_the_player_start"` paragraph, and its `title` begins `HARNESS DEFAULT — … NOT where the
   game starts.`
2. `game/src/main.js` emits a `console.warn` whenever an **automated** boot takes the default with
   no `?state=`. `launchGame()` collects the page console, so it lands in the log of every tool in
   the fleet that boots without one.
3. `--start debug` prints a nine-line banner.

## 6. What this pass could NOT do, plainly

* **The deployed GitHub Pages site was not tested.** Chromium in this container cannot reach any
  external host — the spawn-truth pass measured this on four different hosts and it is not
  game-specific. Everything here was measured against the **local tree** served by
  `tools/lib/browser.mjs`, which per this repo's README is the same directory Pages publishes.
  That is a strong claim about the build and **not** a test of the deployed site, and it should
  not be read as one.
* **The exit-point *location* was not touched.** The dispatch was explicit: fix the orientation,
  not the location. `inside_a_building` reads 0 on every point measured, so the doorsteps
  themselves look sound, but a full 115-point audit of that specific question is not what this
  pass ran.
* **The census hand-back framing is a separate, unfixed defect.** The spawn-truth report's §3
  first half — the camera left in the dialogue framing facing the Warden-Scribe's shelves at the
  instant control returns, before any door is touched — is `character/scene.js`'s, not
  `settlement.js`'s. This pass did not change it. It is now the *first* thing a player sees that is
  still wrong.
* **A clean, driven walk from the census end-position to the writ house door still fails.** Both
  the spawn-truth tool and the pre-existing `w1-26-r2-arrival.mjs` stick on room geometry at
  `x ≈ 4.17`. This pass drives the door through `exitInterior()` — the same function the latch
  calls — rather than through a walk, and says so; it is not evidence that the door can be walked
  to.
* **The all-115 sweep did not finish, and neither did the 17-interior stratified sample.** On this
  box a `door-exit-yaw` row costs about 5–25 s inside a town you are already standing in and
  **210–280 s for the first interior of a new town**, because the teleport opens a province
  streaming boundary. A full-tree attempt was killed at 35 minutes; a 17-interior sample across all
  eight towns reached 4 rows before this pass ended and was still running. So the numbers above are
  **seven interiors across three towns, not a sweep**, and they are labelled that way everywhere.
  Two consequences were banked so the next attempt is cheaper: the tool now sorts by settlement
  (115 town changes become 8) and **writes its JSON after every row** — the first attempt's 35
  minutes produced zero bytes because the only write was after the loop. `reports/door-yaw/
  sample-17-after.json` holds whatever it reached; re-running `node tools/harness/door-exit-yaw.mjs
  --no-enter` on an idle box is the whole job.
* **Renderer.** Every number in §4 is SwiftShader. §4a is hardware and says so, with the renderer
  string in the manifest and `software_renderer` failing closed on an unknown string.
* **`archon-apothecary`'s facing is not fixed** (§4). One of seven measured, improved from 1.00 m to
  1.50 m where 12 m was available.
* **The camera arm at the writ house doorstep is collapsed** (§4a) and the player is not in the
  first controlled frame. Not touched.
