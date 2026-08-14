# The first frame of the game — 2026-08-14

**What this is.** The two defects `orchestration/status/SPAWN-YAW.json` left in its `not_done` list
because they were not that agent's file, both of them in the opening seconds:

1. **The census hand-back framing** — the frame at the instant character creation returns control,
   before any door is used. It is the opening shot of the game and it is a wall of storage shelving.
2. **The camera arm at the writ-house doorstep** — the body is turned correctly and looking out over
   the marsh, and the player is not in the frame.

**Both were reproduced. One is fixed. The other is diagnosed and is not fixable by anything this
piece owns, and the diagnosis is the deliverable: it is not a facing bug, it is two buildings built
into each other.**

Tool (committed, re-runnable, bare Node): `tools/harness/opening-frame.mjs`.
Numbers: `reports/opening-frame/opening-frame.json`.

---

## 0. How this was measured, and why not in a browser

The box has been at 4–7 per core against a ceiling of 4.0 all day and starvation has already
produced three false defect reports: a browser that misses its frame budget reports a camera that
never settled as a camera that collapsed. So the failing measurements were taken by **importing the
shipped modules into bare Node** and running the real fixed step by hand — `WorldField`,
`planSettlement`/`settlementSolids` (the same call `world/province.js#settlementSolidsNear()` makes),
`CollisionCell` (the same class `engine.js#_settleSettlementSolids()` constructs), `exitFacing()`,
and **`sim/camera.js#stepCamera()` itself**, sixty times on a real `SimState`. Not a
re-implementation of the arm — the shipped function. Nothing in that path has a frame budget to
miss, so a loaded box changes how long it takes and not what it says.

**The metric for "the player is not in the frame" is the game's own, not an invented one.**
`sim/camera.js#fadeOpacity()` fades the character out as the arm shortens and reaches **zero at
`fade_zero_m` = 0.90 m**, and the renderer consumes `camera.charOpacity` without deciding anything.
`char_opacity: 0` is therefore the shipped build's own statement that the body is not drawn.

---

## 1. Defect 2 first, because it changes what defect 1 even is

### The arm does not collapse because of a tree. It collapses because the doorstep is in a 0.6 m slot between two buildings.

The dispatch warned this might be a cousin of D1 — whose cause turned out to be a *tree* rather than
architecture — and asked that the assumption be checked rather than inherited. It was, and it is a
different cause. Two independent reasons:

**(a) The town collision set contains no vegetation and structurally cannot.** In a settlement
`sim.cell` is the cell `_settleSettlementSolids()` builds from `settlementSolidsNear()`, which is
buildings only; `sim/collision.js`'s own header states the exclusion ("foliage cards … are not in
it and there is no code path that could add them"). D1's tree was at Lilmoth, in the province cell.

**(b) The obstruction was identified by name.** At the shipped exit pose the arm's cast lands in
**`writ-house:+z+`, 0.20 m behind the pivot** — the writ house's own south wall panel.

Now the geometry, from the shipped plan:

| | x range | z range |
|---|---|---|
| `writ-house` footprint | 3800.99 … 3811.01 | 895.50 … **908.50** |
| `barge-hold` footprint (yaw 90) | 3791.99 … **3808.01** | 904.50 … 911.50 |
| the doorstep (`continuity.exterior_spawn`) | **3808.60** | **909.36** |

**The two buildings overlap by 7.02 m × 4.00 m.** The writ house's front wall runs *through* the
barge hold, and its front door at `[3806.25, 0, 908.5]` opens inside it. The exterior spawn is the
one sliver of ground left over: **0.67 m from the writ house's south wall, 0.41 m from the barge
hold's east wall.** A 4.10 m spring arm cannot exist there.

### The full number line, both directions — and there is no answer at this standing point

Per `HAZARDS.md` §0b, a guard that only looks in the direction you expected fails on half the number
line, so all 72 five-degree bearings were scored from the same standing point, running the real
`stepCamera` at each:

```
 bearing      arm      char_opacity   clearance
   0 – 105   0.42–0.77 m      0%        12 m   (the cap — you can see the marsh)
 180 – 300   1.25–3.99 m    12–100%   0.25–0.75 m   (a wall in your face)
 305 – 355   0.68–0.70 m      0%        12 m
```

It is perfectly bimodal and there is no middle. **25 of 72 bearings keep the player drawn; the best
bearing that keeps the player drawn sees 0.75 m; the best bearing that sees anything draws no player
at all.** The shipped exit yaw (70°, `door_to_doorstep`) is in the second camp: 12 m of view,
`arm 0.464 m`, `char_opacity 0`, penetration guard firing.

**So this is not a facing defect and no facing rule can fix it.** `exitFacing()` is doing the right
thing — it maximises what is in front of you, which is the number the door-exit pass moved from
0.50 m to 12 m — and the camera lives *behind* you, where there is 0.6 m of alley.

### The null control here is the plausible wrong answer, and it earns its keep

The trivial control is "no framing at all". The control that matters is **`body_only`**: the yaw
written to `sim.player.yaw` and `combat.player.yaw` and *not* to `sim.camera.yaw`. It passes every
state check anyone would think to write. Measured at the doorstep it comes back **`arm 3.993 m`,
`char_opacity 100%`** — a perfectly healthy camera — with **`clearance 0.25 m`**: the player is
beautifully framed, looking at a wall. A check that reads only the arm would have called that the
fix. That is exactly the shape of the trap this codebase has hit twice.

### What was NOT done, and why, and what would fix it

**The doorstep was not moved.** The dispatch is explicit: *"Do not move where the game starts… Fix
what the player is looking at, not where they are."* So `continuity.exterior_spawn` is byte-for-byte
unchanged, and so is every settlement and interior record.

**The fix, when someone rules on it, is one of two things and neither is a facing:**

- **Separate the two buildings.** `thorn.json`'s `writ-house` (`offset_m [-14, 0, 43]`) and
  `barge-hold` (`offset_m [-20, 0, 49]`) are 7 m × 4 m inside each other. This is the root cause and
  it is a town-layout defect, not an opening defect — the same collision probably reads as a visual
  defect from other angles too, and nothing in the plan pass reported it (`planSettlement` returns no
  `deep_overlaps`/`shrunk` fields at all on this record).
- **Or push the doorstep out.** `exterior_spawn` needs about **4.4 m of free space behind the body**
  along the exit facing for a full arm. It currently has 0.41 m. Moving it ~3.5 m along the door's
  outward normal would do it, and it is worth noting that this field is already a machine-repaired
  value: `exterior_spawn_declared` is `[3806, 0, 900.6]`, on the *opposite face of the building*.

**What would overturn this finding:** a run of `node tools/harness/opening-frame.mjs` in which
`sweep_summary.best_drawn_and_clear` comes back with `clearance_m` above about 6 m. That would mean
a bearing exists that does both and the standing point is fine. It does not today.

---

## 2. Defect 1: the census hand-back — and the yaw was never the problem

### What was actually wrong

The dispatch describes the camera being "pointed at a wall of reed-case shelving", which is exactly
what `docs/shots/2026-08-14-spawn-yaw/hw-desktop-002-writ-house-done.png` shows. The obvious
diagnosis is that the camera is aimed wrong. **Measured, it was not.**

The room's doorway is cut by `render/interior.js#interiorShellPlan()` at the centre of the wall
`continuity.entry_side` names — `"south"`, which `render/exterior.js#entrySideLocal()` maps to **+z**
— so for the writ house it is at local `[0, 1.05, 6.67]`. From the census standing point
`[1.9, 0, 0.3]` that is a bearing of **343.4°**, and the shipped camera sat at **350°**: 6.6° off, in
a horizontal field of view of 79.3°. **The way out was already on the screen.** A fix that only
turned the camera would have moved a number and changed nothing a player can see.

Two things were in the way instead, and both are drawn geometry:

- **`render/places.js#buildWritHouse()` drew the +z wall as one unbroken 11 m slab.** The room had
  **no door in it at all** — four solid walls and a ceiling — while the collision shell had an
  opening there and the world had a door on that face of the building.
- **The wall of reed-cases stood in front of it**: 8.2 m wide, four rows, at `z = 5.9`, dead centre,
  0.77 m in front of the wall the doorway is in.

### The measurement, and it is an occlusion measurement

Rays are cast from the real settled camera pose to a 5 × 7 grid across the doorway aperture, through
the room `buildWritHouse()` actually builds. It has to be against the **drawn** meshes rather than
the collision cell, because `interiorCollisionShapes()` deliberately leaves furniture non-solid — the
shelving is invisible to physics and completely opaque to a player.

The "before" arm is **not a reconstruction**: `--baseline <git-ref>` checks the previous
`render/places.js` straight out of git into the same directory so its relative imports resolve,
imports it, and builds the room from it.

| | doorway visible | what blocked it | walk straight forward |
|---|---|---|---|
| as shipped | **14 %** | 15 of 35 samples: the reed-case cylinders at `z = 5.90` | **misses the doorway by 2.64 m** |
| fixed | **57 %** | the desk and its rail only — which is correct, there is a desk between you and the door | **reaches the doorway** |

The residual 43 % is the desk at `z = 2.6`, cutting the lower rows of the aperture. That is a desk
doing what a desk does, not an occlusion defect.

The "before" 14 % is also generous to the old build: those five clear sight-lines led to a **blank
wall**, because there was no door drawn there to see.

### The second half: where "forward" goes

The camera decides what you see; the **body** decides where the stick takes you. The census left the
body on `player_yaw` 320 — the bearing to the Warden-Scribe, correct for talking to her — so the
first press of the stick in the shipped build walked you **2.64 m wide of the door**, into the wall
beside it. The hand-back now turns the body with the camera, so forward is the way out.

### The fix, and all three yaws

`Engine._censusHandBack()`, called from `censusAnswer()` on the frame the graph runs out of nodes.
It writes **all three** places player facing lives, because writing one is a fix that is silently
inert:

- `combat.player.yaw` — the authority. `combat-bridge.js#mirror()` runs `p.yaw = b.yaw` at the top of
  every step, so a yaw written only to `sim.player` survives exactly one frame.
- `sim.player.yaw` — the mirror, written anyway so single-frame probes read the right value.
- `sim.camera.yaw` — separate, and the one the player sees. Auto-recentre is clamped to 1.5°/frame.

It also re-solves the spring arm (the same writes `_settleCamera()` makes, inline, so the deferred
commit path stays safe) and re-quantises cold state, because `_censusFinish()` quantises *before*
this runs.

It **fails open**, exactly as `exitFacing()` does: a record with no `bounds_m` gets the old
behaviour, and `engine.censusHandBack.applied` says so rather than the fallback being taken
silently.

Where the geometry lives: `character/scene.js#doorwayLocal()` / `#handBackFraming()`, restating
`interiorShellPlan()`'s arithmetic rather than importing it, because `character/` must not depend on
`render/`.

### The null control at this site is uninformative, and that is worth saying

`body_only` at the hand-back scores **identically** to the fix on the occlusion measure — 14 % → 57 %
— because the two camera yaws are 6.6° apart and the occlusion is 5 m away. It differs only in that
the camera takes 5 frames at 1.5°/frame to close the gap, and only if the player walks (auto-recentre
needs the stick held forward for `recentre_gate_frames` = 20 first, so a player who stands still
never arrives at all). **At this site the null control does not separate the arms, and the honest
reading is that the yaw half of this change is small and the drawn-geometry half is the whole fix.**
The same control is decisive at the doorstep (§1), which is why it stays in the tool.

### A related contradiction found and NOT fixed

`writ-house.json`'s `continuity.interior_spawn` is `[0, 0, -4.6]` — hard against the **-z** wall,
11 m from the +z doorway the shell plan cuts and the world door stands on. So `useDoor('writ-house')`
puts you at the opposite end of the room from the door you just walked through. This is the same
`entry_side` / `interior_spawn` disagreement `sim/settlement.js#exitFacing()` documents on **109 of
the 115** records. It is named in the tool's own output so nobody aims at it again, and it is not
touched here: it is the door placement's field, not the opening shot's.

---

## 3. What changed

| file | what |
|---|---|
| `game/src/character/scene.js` | `doorwayLocal()`, `handBackFraming()`, `HAND_BACK_PITCH_DEG` — where the way out is, in the room's own frame |
| `game/src/engine.js` | `_censusHandBack()`, called from `censusAnswer()`; `this.censusHandBack` declared in `loadState` |
| `game/src/render/places.js` | the Writ House gets a doorway, a lintel and a leaf on the wall its record says the door is on; the reed-cases split into two runs around it |
| `tools/harness/opening-frame.mjs` | new; the bare-Node probe, both sites, both null controls, the 72-bearing sweep, the git-baseline occlusion arms |
| `tools/harness/opening-capture.mjs` | per-frame `arm_m` / `char_opacity` / `arm_guard` in the manifest; the hand-back frame now gets the same 8-angle orbit the doorstep does |

The hand-back pitch is `-6°`, which is not a taste call: it is `CAMERA_CONST.recentre_pitch_target_deg`,
the pitch the rig's own auto-recentre walks back to. Handing back at any other pitch means the first
thing the opening shot does on the first press of the stick is drift.

---

## 4. What this pass could not do, plainly

- **The doorstep defect is not fixed.** It is diagnosed to the metre and the fix is named, and it is
  out of this piece's mandate by explicit instruction. Somebody has to rule on it.
- **`buildWritHouse()` has one lamp, at `z = -4`, the far end from the door.** The doorway end of the
  room is lit by the fake window plane above the door and nothing else. A second lamp was
  deliberately *not* added: the file's own comment records a shared policy that this room takes
  `litLights()`'s fail-open hearth rather than inventing private lamps, and quietly breaking a stated
  policy to improve one shot is not a trade worth making without saying so. If the hardware frames
  show the doorway is too dark to read, that policy is the thing to revisit, not this file.
- **The overlap between the writ house and the barge hold was found by this pass and not audited
  across the other seven towns.** `planSettlement()` returns no overlap report on this record at all,
  so "how many other buildings in this world are inside each other" is an open question and a
  one-tool answer for whoever picks it up.
- **The deployed Pages URL was not tested.** Chromium in this container still cannot reach any
  external host (`reports/spawn-truth/…` §5); everything was measured on the local tree, which per
  the repo README is the same directory Pages publishes.
- **Contention.** `tools/contention.mjs --gate` returned WAIT for the whole window in which the local
  capture would have run, which is why the hardware evidence went to a rented Pod (remote load, not
  local) and why every failing measurement in §1 and §2 was taken in bare Node instead.
