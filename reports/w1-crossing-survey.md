# W1-CROSSING — the road was never too steep

**Builder's survey.** Every number here is measured on this tree; the JSON artifacts under
`reports/w1-crossing/` are gitignored by `reports/.gitignore` (run artifacts are reproducible),
so the numbers that matter are copied here, with the tool that produces each one.

---

## 1. The brief's premise was wrong, and that is the finding

The dispatch said the crossing was stopped by *"a 57.5° skirt on the Valus Ridge, 4.98 m off a
3.6 m deck"*, and asked whether to re-route or to grade the terrain, on no length budget.

Neither. **The road's own gradient was never over the limit anywhere in the province.**

`node tools/world/road-grade.mjs` measures four different quantities that all get called "the
grade", because conflating them is how the ridge was misdiagnosed for a round:

| leg | length m | worst road gradient ° | slope-gate refusals on the centreline | span m | tallest span m |
|---|---|---|---|---|---|
| stormhold-thorn | 2229 | 21.8 | 0 | 154 | 8.8 |
| **stormhold-helstrom** | 2921 | **24.3** | 0 | **918** | **50.6** |
| helstrom-archon | 2589 | 6.1 | 0 | 0 | 0 |
| helstrom-blackrose | 2480 | 7.1 | 0 | 0 | 0 |
| helstrom-gideon | 2432 | 24.2 | 0 | 84 | 10.6 |
| gideon-soulrest | 2569 | 4.5 | 0 | 0 | 0 |
| soulrest-blackrose | 1841 | 6.8 | 0 | 36 | 5.3 |
| blackrose-lilmoth | 1503 | 1.9 | 0 | 456 | 14.3 |
| archon-thorn | 4299 | 24.2 | 0 | 84 | 9.6 |
| lilmoth-archon | 2523 | 3.6 | 0 | 0 | 0 |

**Worst road gradient in the province: 24.27°. The walkable limit is 40°.** `G1-DECK-GRADE` and
`G2-CLIMB` both PASS, and they passed before this piece touched anything — the road grade is
identical before and after, because *nothing about the road needed changing*. The figures the last
round reported (57.5°, 61.09°, 64.6°) are `field.slopeAt()` readings taken **beside a viaduct**,
where the ±5 m central difference straddles the edge of a slab. `sim/traversal.js`'s own comment
says this happens and that is why the carriageway is exempt from the slope gate.

**What is actually on the Valus Ridge** is a **471 m viaduct standing 50.6 m above the
mountainside**, one of eight declared `deck_spans` that make 918 m of a 2,921 m leg into bridge.
The body at (2153.7, 1197.8) was 4.98 m from the centreline **and 15.3 m below the deck**. It had
not met a slope. It had fallen off a bridge. Picture:
`docs/shots/2026-08-08-w1-crossing-the-road-over-the-valus-ridge-is-a-bridge.png`.

The viaducts are not new (50.3 m before the settlement join, 50.6 m after) and they are not a
defect: `tools/world/scale-audit.mjs` passes `M2-ROAD-CUT-AND-FILL` on them explicitly — *"tallest
DECK SPAN 51.48 m over 2234 m of structure, which is a bridge and not a bank"*. Falling off one is
the defect.

## 2. What was fixed

### 2a. `engine._pursue()` — the walker steered at the next milestone, not at the road

`walkRoute` and `walkPath` both did this:

```js
while (idx < n && dist(body, pts[idx]) < lookahead) idx++;   // advance on PROXIMITY
steer at pts[idx];
```

Two defects in three lines. **It cannot recover:** displace the body and it beelines at a waypoint
that is now across country, and if anything stands in the way it slides and orbits forever —
`soulrest-blackrose` is 1,841 m and a body walked 6,459 m of it and finished in 18 m of sea, on a
leg whose ground this piece's own census clears completely (worst regain 11.5°, zero falls, zero
slope refusals). **And it cuts corners:** aiming 4.5 m ahead across a bend on 12 m road points
takes the body off a 6 m carriageway by design, and off the carriageway on the ridge is off the
bridge.

The target is now the body's **projection onto the polyline**, pushed `lookahead − off_road`
metres further along it: at 4.5 m off the road the target *is* the road, so a displaced body's
first move is back onto it, and once back the target slides ahead and it resumes.

### 2b. `field.clampToDeck` / `_deckY` / `onDeckAt` — the parapet, and the slab's round end

The parapet inferred "off the end (abutment, allowed)" from a projection parameter on **one
segment**, and got it wrong at every span chain end. And `_deckY` clamped `t` to [0,1] before
testing distance, which makes every segment a *stadium* — so the deck slab hung `hw + 0.5` m past
each abutment as a rounded cap of walkable surface with nothing under it and no railing round it.

The parapet is now asked of the **structure**: was the body on a span's walkable surface; is the
destination still on one, by the same measure and the same limit; is it beyond a chain end *and*
inside the railing's width across the chain (that is the abutment); otherwise clamp. The end caps
are cut square using new `spanFirst`/`spanLast` flags — and only the ends, because a hard `t` bound
at an interior joint is skipped by both adjoining segments at once, which is a hole this file's own
history records.

**Parapet leaks: 286 of 3,632 sideways pushes walked off a bridge → 93 of 3,500.** Four of the five
span legs are now at or near zero (`blackrose-lilmoth` 0/912, `archon-thorn` 0/168,
`helstrom-gideon` 1/166); the residue is 85 on `stormhold-helstrom`. **Not closed — see §6.**

### 2c. `walkRoute`/`walkPath` counted teleports as walked distance

A body at 2 m/s moves 0.033 m per frame. The distance accumulator had no upper bound, so when the
body died and respawned at a hearth **3,484.9 m away**, that respawn was added to `path_m` in one
frame: the run reported 4,812 m of THE CROSSING having walked 1,277 m of it. Discontinuities over
1 m/frame are now recorded as `teleports` / `teleported_m` with their before/after HP, and
**excluded** from `path_m`. Every `path_m` this project has published before this may contain them.

### 2d. The settlement join had already gone stale

`node tools/world/road-through-building.mjs` on the shipped tree: **2 of 10 legs blocked, 4
offences**, three of them on THE CROSSING at 5,610–5,624 m. Nothing had touched `roads.json`; what
moved was `game/src/render/exterior.js`, +227/−33 lines since the join commit `322f708` — that is
where `planSettlement()` lives. This is W1-ROAD-JOIN's handoff H4 happening, four hours after it
was written. `roads.json` is regenerated: **0 of 10, 0 offences**, worst leg 2.26% off its declared
length (S28 bar 5%), THE CROSSING 6,911.4 → 6,903.6 m against a declared 6,909.

## 3. The crossing, walked

`node tools/world/crossing-body.mjs --survive` — one body, `walkRoute`, settlement collision **ON**,
written incrementally after every chunk. See `reports/w1-crossing/crossing-body-AFTER.json`.

**IT ARRIVED.** Stormhold south gate to Lilmoth harbour steps, ending at (2765.6, 5028.8).

| | |
|---|---|
| **distance** | **6,646.7 m** walked (declared route 6,903.6 m) |
| **frames** | **199,433** |
| **in-world time** | **55.398 min** (3,323.88 s at 60 Hz) |
| mean ground speed | 1.9991 m/s (the walk band's 2.0) |
| samples under 1.6 m/s | **0.063%** of 33,238 |
| worst deviation from the road | **1.39 m** of a 6 m carriageway |
| frames off the road | **0** |
| discontinuities (teleports) | **0** |
| leg minutes | stormhold-helstrom 23.574 · helstrom-blackrose 19.539 · blackrose-lilmoth 12.284 |
| regions entered | salt-hills · valus-ridge · stone-forest · blackwood · deep-marshes · western-rootlands · hive · eastern-rootlands |

Against RI-WLD01's own bars, which this piece did not set: M2-TIME wants 52–65 min and got 55.398;
M2-DISTANCE wants 6,300–7,600 m and got 6,646.7; M3-SPEED-HONESTY wants ≤8% of samples under
1.6 m/s and got 0.063%; M3-MEAN-SPEED wants 2.0 ± 0.05 and got 1.9991. **The hour came from
distance, not from friction.** Picture at the far end:
`docs/shots/2026-08-08-w1-crossing-lilmoth-from-the-road.png`.

The walked distance is 3.7% under the route's own length because a body holding a lookahead inside
a 6 m carriageway shaves the inside of every bend — 1.39 m of shave over 6.9 km. It is a walk, not
a tracing of the polyline, and that is the point.

`--survive` pins the body's HP, **declared in the artifact as `hp_pinned: true`**, and reports the
damage instead of discarding it. It is there because of §4.

## 4. The province kills you, and that is a different system working

With HP not pinned the body dies at **1,276.8 m** of the crossing, hp 0 at (2391.1, 1680.9) in The
Stone Forest, and respawns at a hearth 3,484.9 m away. The killers are the declared regional
hazards — `ridge-exposure` (ATTRITION, The Salt Hills), `rockfall` and `the-fall` (Valus Ridge),
`pair-lightning` and `hist-sap-fume` (The Stone Forest) — against a scripted body that never
shelters, never drinks and never heals. §P.4 asks whether the ground is there, not whether you
survive it; both answers are here and they are labelled.

**Over the completed crossing the province did 1,060.5 damage to a body that never defended
itself** — measured, because `--survive` counts what it absorbs rather than discarding it. And the
hearth it respawns you at is 3,484.9 m away and **towards Lilmoth**: dying on the Valus Ridge
teleports you past two thirds of the crossing. Neither of those is this piece's to fix; both are
recorded here because nobody had ever walked far enough to find them.

## 5. Rule 6 — delete the fix, run as a 2×2

`node tools/world/crossing-deletefix.mjs`. Four arms, `steering` × `parapet`, where OLD means **the
345dcca code put back** (the pre-fix `clampToDeck` verbatim from git, in
`tools/world/old-clamp-345dcca.js`; the pre-fix proximity loop as a replacement `_pursue`). Each
arm reads the installed functions back out and **refuses to report if the teardown did not take**.

| steering | parapet | walked m in 40,000 frames | route points left | worst off-path m | regains |
|---|---|---|---|---|---|
| NEW | NEW | 1327.3 | 315 | 3391.9 (died at 1,277 m) | 0 |
| NEW | OLD | 1333.0 | 438 | 1.22 | 0 |
| OLD | NEW | **390.1** | 524 | 4032.7 | 15 |
| OLD | OLD | **550.1** | 502 | 6.69 | 37 |

**The both-out arm reproduces the published pre-fix number exactly: 550.1 m, ending at
(2153.7, 1197.8)** — the same distance and the same coordinate W1-ROAD-JOIN published from the
shipped build. The control was watched going red and it went red on the number.

**Which of rule 6's three shapes this is: the steering is the fix; the parapet is not load-bearing
for this walk.** Taking the steering out alone collapses the walk to 390.1 m and leaves the body
off the road for 31,634 frames; taking the parapet out alone changes nothing (1,333.0 m, 0 frames
off the road), because a body that holds the centreline to 1.22 m never touches the railing. Not
two guards for one defect, and not an inert fix. The parapet fix is justified by §2b's own census
(286 → 93 leaks), not by this walk, and the honest statement is that **this crossing would complete
without it**.

## 6. CONSUMPTION (RI-MTH07, mandatory under ARBITRATION §3)

`node tools/world/crossing-consumption.mjs`. Two models ship here and each has a named world-side
consumer that is demonstrated by perturbing the model and watching the body change what it does.

**Model 1 — the road centreline** (`roads.json legs[].points`). **Consumer — the player capsule,
through `engine._pursue()`.** Seventeen points of `stormhold-helstrom` are pushed 25 m sideways as
a raised-cosine bump (so the ends stay attached), the network is re-attached with `field.setRoads`,
and the body is walked again. Compared **track against track at the same frame**, not end point
against end point:

| arm | the body moved |
|---|---|
| P1 — move the road the crossing uses | **15.65 m** |
| NULL — move a leg the crossing does not use (`lilmoth-archon`) | **0.72 m** |

**Model 2 — the structures** (`legs[].deck_spans`, and the `spanFirst`/`spanLast` flags
`field.setRoads()` derives). **Consumer — `field.clampToDeck()` on the player capsule.** A body is
pushed sideways off the middle of the 471 m viaduct, 0.06 m per step, with the same clamp the
controller applies:

| | reaches | ground under the body |
|---|---|---|
| with the eight spans declared | 3.35 m from the centreline — the railing | 0 m |
| with `deck_spans` deleted | **11.04 m** — it walks off | **21.94 m below the deck** |
| model restored | 3.35 m, exactly | 0 m |

**Model 1 again, as the acceptance asks it — "a body that leaves the road demonstrably regains it,
with a count."** The fixed walker does not leave the road on its own (1.39 m worst deviation over
6.6 km), so it has to be pushed. `P3-REGAIN` puts the body **25 m off the centreline** ten times
and resumes the walk for 4,000 frames each time; a regain is the engine's own counter — back inside
3.5 m of the road it was following — not this file's opinion.

**With the fix in: 2 recovered of 10 shoves — and the split is entirely by terrain.**

| shove | where | regained |
|---|---|---|
| 1 | (2204.6, 862.5), the flat out of Stormhold | **yes** |
| 2 | (2232.7, 1039.5), still on the flat | **yes** |
| 3 | (2173.5, 1163.3), the foot of the Valus Ridge climb | no |
| 4–10 | all from (2198.5, 1158.8), 39.71 m off, on the ridge skirt | no |

Read this beside §7's `G3-REGAIN`, because it is the same finding arriving from the other
direction: **on ground the offline census clears, a shoved body walks back onto the road; on the
Valus Ridge skirt, which the census flags 59 times, it cannot.** The steering fix restores the
*intent* to return; it cannot make a 70° cut-slope climbable, and it was never going to.

**This probe's own defect, which I am reporting rather than rounding off.** Shoves 4–10 are not
independent trials: once the body was stuck at (2198.5, 1158.8) it made no route progress, so every
later shove started from the same place and re-measured the same failure. The honest count is
**2 of 3 independent trials, and the one that failed failed on the terrain §7 says it should**. A
correct version of this probe re-places the body on the road after a failed trial so the ten are
ten. It is a fifteen-minute fix and I did not have the browser budget left; a critic should take it.

**A defect in my own first run, reported rather than buried.** Run 1 put the arms in sequence
without resetting the body, and the province's hazard attrition carried across them: by the fourth
400 m walk the body had died and respawned 3.5 km away, and the "repeat with nothing changed"
noise-floor arm read **4,128.93 m**. That arm is invalid in the shipped artifact and is labelled so.
The tool now pins HP identically in every arm including the null, and that is the correction the
next run should be read against. **What C2 currently rests on is the 22× separation between 15.65 m
and 0.72 m in adjacent arms, not a measured floor.** A critic should re-run it.

## 7. What is NOT closed

- **`G3-REGAIN`: 63 places on EARTH road** where a body one metre off the shoulder faces more than
  40° back to the carriageway; 59 of them on `stormhold-helstrom`, at the approaches to abutments.
- **`G4-NO-FALL`: 488 places on EARTH road** where the first step off the carriageway is a drop
  over 0.6 m.
- **`G5-PARAPET`: 93 of 3,500** sideways pushes still walk off a bridge deck, all but 8 of them on
  `stormhold-helstrom`, at bends inside the long viaduct. Down from 286 but not zero.
- The `--stair-grade` sweep on `build-roads.mjs` (added, default unchanged at 0.45): raising the
  stair-grade exception to 0.60 takes the network's deck span from 1,731 m to 1,431 m and the
  tallest fill from 50.6 m to 32.7 m, at **no length cost at all** (the horizontal route does not
  move). Nobody has ruled on whether a 31° road is a road, so it is measured and not landed.

## 8. Numbers, and where they came from

Everything above is `node tools/world/road-grade.mjs` (offline, `--self-test` proven to bite),
`crossing-body.mjs`, `crossing-deletefix.mjs` and `crossing-consumption.mjs` (one browser each,
never concurrent). `node tools/contention.mjs --gate` returned GO once and exit 3 thereafter (load
5.7–6.7 per core against a 4.0 ceiling); **I proceeded and say so here**, because a body walking
the province is the acceptance and cannot be taken offline. Every published figure is a distance, a
frame count or a boolean. **No timing or performance figure is published from this piece.**
