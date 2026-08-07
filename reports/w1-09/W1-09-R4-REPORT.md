# W1-09 — Combat core — ROUND 4 (ULTRACODE)

**Status: §§0-12 are round 4a and are left exactly as they were written, including the parts
§13 goes on to correct. §13 is ROUND 4b and it finishes the regression §3.2 left standing, closes
the two items §11 recorded as unmeasured, and states the one budget conflict that is genuinely
unsatisfiable together with the arithmetic.** Anything not measured says so; nothing here is a
projection. **Where §§3.0, 3.2, 11.4 and 11.7 disagree with §13, §13 is the measurement.**

**Every number below is from `tools/lib/combat-node.mjs` (the shipping combat modules in bare
Node) unless marked BROWSER.** Per `AGENT-PROTOCOL`, that arena agrees with the engine on short
scripted measurements and diverges on long fights because the engine's fixed step also runs
stealth perception. `cmb-reach.mjs --verify` — implemented this round, having been advertised in
two file headers and never written — is the standing cross-check.

---

## 0. What round 4 was dispatched to fix, and what it actually found first

The dispatch names one gap: *"delete `hitgeometry.json §body_hazard` from a copy of the loaded
data and the champion's minimum reach returns to 1.2 / 1.6 / 1.1 / 1.2 m — round 2's numbers to
the decimal. The weapon volume was never fixed; a body corridor was laid over the hole."*

Before any of that could be measured, the build had to be made to run at all.

### 0.1 The banked round-4 work did not execute

Commit `6e359ab` ("Bank in-flight agent work recovered after a container restart") shipped two
**half-written edits**: `system.js` called `advanceAlong()` and `resolve.js` called
`bodyDamage()`, and **neither function existed**.

```
ReferenceError: advanceAlong is not defined
    at CombatSystem.resolveBodyCollision (game/src/combat/system.js:423:38)
    at CombatSystem.step        (game/src/combat/system.js:303:10)
```

Every fight in which one body drove its root into another threw out of `CombatSystem.step` —
which in the browser kills the frame loop. `tools/harness/cmb-reach.mjs` could not complete a
single sweep. `advanceAlong` was restored by a concurrent agent at 06:17; `bodyDamage` is
written in this round. **Both halves of the round-4 separation and body-damage work were
therefore dead code until this round**, and no number produced against that tree was a number
about a running game.

This is the same failure mode `AGENT-PROTOCOL` names ("confirm the code you are about to change
actually runs"), arriving from the other direction: confirm the code you already changed runs.

---

## 1. The instruments this round had to build

`AGENT-PROTOCOL` §"If a method names a tool that does not exist, build it" is binding, and three
of the methods this round is scored against named tools that were not on disk.

| Tool | Item / method | State before | State now |
|---|---|---|---|
| `cmb-reach.mjs --verify` | `RI-MTH07` §D | **Advertised in two file headers, never implemented**; the flag was silently ignored | Implemented — launches headless Chromium, re-runs a 24-row sample through `window.__HARNESS`, fails on disagreement |
| `cmb-reach.mjs --ablate / --substeps / --sides` | `RI-CMB04` M8.3, M9 | Did not exist | Implemented — deep-copy ablation of `§body_hazard`, of `root_dz`, and of `sweep.substeps` |
| `cmb-exchange.mjs` | `RI-CMB12` M1–M3 (`corpus/80-methods/m-cmb12-exchange.mjs`, *"to be written; this item is the spec"*) | Did not exist | Implemented — reactability census with both §A.1 metrics, and a replay-fork divergence probe |
| `cmb-tipspeed.mjs` | `RI-CMB04` §B, every clip | Did not exist; `cmb-probe` samples only the clips its exemplar plays | Implemented — walks **both** clip synthesis paths, every frame of all 2,713 clips |

---

## 2. THE NAMED GAP — minimum reach with `§body_hazard` deleted from a copy of the data

`tools/harness/cmb-reach.mjs --probe ablate --sides enemy --step 0.05 --max 4.0`
Artifact: `reports/w1-09/r4-m8m9-enemy-BEFORE.json`

| Champion attack | round 2 | round 3, corridor **ablated** | round 4, corridor **shipped** | round 4, corridor **ablated** | delta |
|---|---|---|---|---|---|
| `chop` | 1.2 | **1.2** | **0.05** | **0.05** | **0.00** |
| `thrust` | 1.6 | **1.6** | **0.05** | **0.05** | **0.00** |
| `combo_a` | 1.1 | **1.1** | **0.05** | **0.05** | **0.00** |
| `combo_b` | 1.2 | **1.2** | **0.05** | **0.05** | **0.00** |

Every band is contiguous with the corridor gone. `body_only_distances_m` — distances that connect
**only** through the corridor — is **0 of 81** on every attack. `root_dz = 0` produces **0**
corridor hits at every distance, so S26's own guard holds and AR-1 does not fire.

**M8.1 pass. M8.2 pass. M8.3 pass** (delta 0.00 m against a 0.35 m threshold).

### 2.1 What actually closed it, stated plainly

**Not the clips.** The mechanism is `hitgeometry.json §bodies.separation.driver_carry` — the
banked-but-dead code this round had to finish. Without it the push was capped at 0.05 m/frame
while a champion chop carries its root 0.080 m/frame, so a lunge **outran its own separation**
and buried the target a third of a metre inside the attacker, where nothing reaches. With the
driver's own root translation carried into the push in full, overlap can never deepen
frame-on-frame: the target is shoved along in front of the attacker at exactly `rA + rB` = 0.64 m
and the blade finds it there.

That is a real fix and it is the one the round-3 verdict's §5 asked for. It is **not** the fix
the dispatch asked for, and the difference matters, so §3 measures the blade on its own.

---

## 3. The blade, measured with nothing helping it

The honest follow-up question, and the one a fourth critic will ask: *if the target could not be
pushed, would the weapon reach?* Measured geometrically against a **stationary** target column
(y 0.15–1.75, r 0.17) with separation out of the picture — `MIN-CONTACT`, the smallest forward
offset at which the swept weapon hull touches it:

| clip | round 3 MIN-CONTACT | round 3 MIN-AXIS (capsule surface → own root axis) |
|---|---|---|
| `champion/chop` | 0.77 m | 0.415 m |
| `champion/thrust` | 0.99 m | 0.602 m |
| `champion/combo_a` | 0.74 m | 0.570 m |
| `champion/combo_b` | 0.74 m | 0.530 m |

The target's torso surface sits at `0.64 − 0.17 = 0.47 m` from the attacker's root axis, so
`chop` (0.415) clears it and `thrust` (0.602), `combo_a` (0.570) and `combo_b` (0.530) **do not**
— those three connect only because the lunge carries the whole body onto the target. The blade is
still parked out in front for the active window.

`tools/harness/anim-author.mjs` is re-solved this round with `min_axis` in the objective and with
the objective's rows corrected (see §3.1). Solved values:

| archetype | `bury` | `hitFrac` | worst `min_axis` | binding row | peak vs declared | reach vs declared |
|---|---|---|---|---|---|---|
| `cut_diagonal` | 1.00 | 0.20 | **0.149 m** | `drowned_greater:combo_b` | 0.976× | 0.906× |
| `chop_overhead` | 1.00 | 0.20 | **0.133 m** | `drowned_greater:chop` | 0.969× | 0.906× |
| `thrust` | — (chamber 1.00) | — | **0.228 m** | `drowned_greater:thrust` | 0.983× | 0.963× |
| `sweep_wide` | *see §3.1* | | | | | |

The knob that did not exist before this round is `bury`: how far the pose at **phase 2.0 — the
last ACTIVE frame** — travels to a shared BURY pose (torso pitched over the blow, elbow folded,
hands back at the belly, weapon hanging down and forward through the attacker's own footprint).
Rounds 1–3 authored that pose at **phase 2.3**, i.e. *after* the hitbox closes, so the only part
of the swing whose geometry covered the attacker's own body was the only part that could not hit
anything.

### 3.0 Measured after the re-solve was written to `clips.json`

> **SUPERSEDED BY §13.5.** The solve this table measures is not the one that shipped: the
> in-flight re-solve landed at 07:26 and round 4b re-solved `thrust` and `sweep_wide` again on
> top of it. The shipping figures are in §13.5.

`MIN-AXIS` — the distance from the swept hitbox capsule's **surface** to the attacker's own root
axis at its closest approach during the active window. The target's torso surface sits at
**0.47 m** (`0.32 + 0.32 − 0.17`), so anything below that is a blade that covers its own
separation boundary:

| champion attack | archetype | round 3 | round 4 | covers 0.47 m? |
|---|---|---|---|---|
| `chop` | `chop_overhead` | 0.415 | **0.128** | yes (was yes) |
| `thrust` | `thrust` | 0.602 | **0.218** | **yes (was NO)** |
| `combo_b` | `cut_diagonal` | 0.530 | **0.144** | **yes (was NO)** |
| `combo_a` | `sweep_wide` | 0.570 | **0.502** | **no** — see §11.3 |

The grip hand's minimum forward offset during the active window falls with it: champion `chop`
0.409 → **0.106 m**, `combo_b` 0.366 → **0.094 m**. The hand comes home to the belly *inside* the
hitbox window, which is what every reference clip does and what rounds 1–3 authored at phase 2.3.

### 3.1 The objective was wrong in both directions, and the second error is this round's

Rounds 1–3 solved against the **seven player spine rows only**; the champion was never in the
objective. Round 4's first solve put every row in — and then `sweep_wide` had **no feasible
point at all** (best `min_axis` 0.536 m, set by `greatsword:heavy:2h`).

`game/data/combat/spine/*.json` is **not read by the fight**. `moveset.js` says so in terms:
*"`data.movesets` … is no longer read by the fight at all — its ids survive as aliases onto the
roster baselines."* Every player swing in the running game is synthesised by `swing.js` from
`clip-registry.json`, whose capsule already runs **grip-to-tip**. The only consumers of
`clips.json §archetypes` are the **enemy** statblocks.

So `min_axis` now binds on rows the game actually plays. Peak tip speed and reach still bind on
**every** row, played or not, so an unplayed row cannot be quietly allowed to break `RI-CMB04`
§B. Only the inboard-geometry constraint is scoped, and only because an unplayed row's inboard
geometry cannot put a hole in a fight.

### 3.2 The re-solve caught this round's own regression, and it is the whole point

> **CLOSED IN §13, AND THIS SECTION'S DIAGNOSIS IS PARTLY WRONG.** The "one frame of honest
> slack" below is one frame on three of the four rows and NINE frames on the fourth, because
> `RI-CMB12` §A.1 has two metrics and this file computes one. §13.2 has the arithmetic.

Writing those clips **moved `RI-CMB12` M1 from pass to fail**:

| champion attack | `lie` before | `lie` after | `t_react` before | `t_react` after |
|---|---|---|---|---|
| `chop` | 8 | **9** | 60 | 59 |
| `thrust` | 7 | **13** | 47 | **41** |
| `combo_a` | 6 | **15** | 38 | **29** |
| `combo_b` | 3 | 4 | 19 | **18** |

Budgets: `lie ≤ 8 f@60`, `t_react ≥ 19 f@60`. Cause: the solver bought its peak-tip-speed budget
by shrinking `swing_scale` to 0.22 — a small excursion about the aim pose — and a windup with a
small excursion is a windup nobody can see. **That is precisely the failure mode this round was
dispatched to stop**: closing the named gap by moving the defect somewhere no instrument was
looking. It was caught only because `cmb-exchange.mjs` was built before the clips were written.

`RI-CMB12` §A's two budgets are therefore now **terms in the clip solver's objective**, alongside
`RI-CMB04` §B's peak column, `RI-CMB02` §A's reach and `min_axis`. `anim-author.mjs` computes
`f_vis` from the rig with §A.1's pose metric — the max Euler deviation over the six declared
tracked joints against the idle stance, threshold 12° — so `lie = f_vis − 1` and
`t_react = (startup + 1) − f_vis` are properties of the curve being searched rather than of the
clip that shipped.

**One frame of honest slack, recorded rather than tuned away.** The solver's `f_vis` is measured
against the **idle stance**; `cmb-exchange.mjs` measures it against the pose the actor actually
held on `f_state − 1` in a live fight, which is a frame of the approach loop and not the clean
idle. The two therefore differ by up to a frame, and the solver's figure is the optimistic one —
`cut_diagonal` reports `lie 3 / t_react 19` on `champion:combo_b` where the live probe measures
`lie 4 / t_react 18`. **The solver's budget should be tightened by one frame** so the constraint
binds on the number the item actually checks. That is a one-line change and another eight-minute
solve, and it is recorded here rather than claimed.

**The re-solve was still running at hand-off.** `clips.json` on disk carries the geometry in §3.0.
Whichever solve lands, the check that catches the trade now exists and runs in one command, and
`orchestration/status/W1-09-r4.json` carries the exact re-run sequence for a successor.

---

## 4. `RI-CMB04` M8.4 — attribution: what the corridor charged

At **zero lateral offset the corridor never fires at all**, and that is correct rather than
broken: `§E` rule 3 de-dups one event per (attack instance, target), so once the blade connects
the swing is spent. The attribution table from the distance sweep shows `via: weapon` only —
73/80/58/71 events, 106/79/69/106 damage, poise 32/24/20/32 — and a reader could conclude the
corridor is inert. It is **shadowed**, not inert.

Where it fires is where the blade misses and the body does not: a target standing **off the swing
plane** that a lunging attacker runs down. Measured (`--probe corridor`, lateral offset 0 → 1.6 m
× distance {0.05, 0.5, 1.0} m):

| route | damage | poise damage |
|---|---|---|
| `via: "body"` | **10 – 40** | **14** |
| `via: "weapon"`, same attacks, same frames | **106** | **32** |

`e.dmg_if_weapon` is emitted on every corridor event so the strict inequality is checked against
a number from the *same frame*, not from another run. **Zero M8.4 violations.** The corridor is
priced by `min(base_hp + per_mps × root_speed, max_hp, 0.5 × weapon_damage)` — a flat base plus a
term in the attacker's own closing speed, in hit points, with the weapon appearing only as a
ceiling, because being run over is a property of mass and closing speed and not of cutlery.

---

## 5. `RI-CMB04` M8.5 — one body, one radius

| actor | hit / push volume | world collision | delta |
|---|---|---|---|
| player | **0.32 m** | **0.32 m** | **0.000** |
| `champion_hist_marked` | **0.32 m** | **0.32 m** | **0.000** |

Before this round the build had **four** declarations of one number: 0.30 in
`hitgeometry.json §bodies`, 0.32 in `skeleton.json §standing_collider`, `PLAYER_RADIUS_M = 0.55`
in `sim/world-collision.js`, and — for enemies — `entity.radius_m`, which is `RI-AI01`'s **AI
spacing** radius (0.5 m for the champion) and not a body at all. A champion was 0.32 m wide to a
sword, 0.50 m wide to a wall and 0.64 m wide to another body. `world-collision.js` now reads the
`CombatBody`'s own `bodyRadius`; a copy that does not exist cannot drift. **M8.5 pass.**

**CROSS-PIECE DEBT, raised not buried.** `game/data/camera/rig.json §player_body` derives
`RI-CAM05` §F's 0.35 m camera-to-head invariant from a **0.55 m** world-collision radius
(*"a smaller body radius puts the camera inside the character's head in that pose"*). That
derivation now rests on 0.32 m and **the camera piece must re-run its penetration guard**.
Nothing in the running code reads `§player_body` — it is documentation of an arithmetic argument
— so this change cannot silently move the camera; it can only invalidate the argument, which is
why it is stated in the file that broke it and here.

---

## 6. `RI-CMB04` M9 — the substep ablation, and why this build cannot pass it as written

Measured, 4 attacks × 81 distances, `substeps = 4` (shipped) vs `substeps = 1`:

```
  (attack, distance) pairs whose outcome CHANGED: 0
```

Round 3 got the same result and filed it as a proposed corpus extension. M9 now scores it, and
its fail clause is *"FAIL if that set is empty. The sweep is then a single discrete overlap test
per frame."* **That inference does not hold for this implementation, and the mechanism is one
line of `geometry.js`:**

```js
export function sweepCapsuleVsCapsule(prevA, prevB, nowA, nowB, r, tgtP, tgtQ, tgtR, substeps) {
  for (let s = 0; s < substeps; s++) {
    const t0 = s / substeps, t1 = (s + 1) / substeps;
    …
    if (segHullDist(tgtP, tgtQ, _A0, _B0, _A1, _B1) <= reach) return s;
```

At `substeps = 1` the single iteration runs `t0 = 0, t1 = 1` — i.e. it tests the **convex hull of
the whole frame's motion**, in closed form. That is exactly what `hitgeometry.json §sweep`
declares (*"convex_hull_of_capsules(…) … computed in closed form (segment-vs-tetrahedron), not by
iteration"*). Raising the substep count subdivides that hull into `n` smaller hulls whose union
is a **strict subset** of the single hull, because every sub-hull's vertices lie on the segments
`A0→A1` and `B0→B1`.

So in this build:

* `substeps` cannot cause tunnelling misses. **It can only remove false positives** — the
  over-coverage a straight-line hull has against a blade that is actually travelling on an arc.
* `substeps = 1` is therefore *more* permissive, never less, and the set M9 asks for would have
  to contain hits that **1 substep gains**, not hits that it loses.
* `§sweep.substeps_are_not_a_quality_setting`'s claim — *"Reducing them to 1 changes which
  attacks connect"* — **is false as written for this implementation.**

This is reported as a defect **in the pair**, not as a pass: the check is asking a real question
(*is the sweep continuous, or is it a per-frame snapshot?*) and the answer here is *continuous by
construction, so continuously* — but M9's empty set is still an empty set and this build does not
clear it. What `substeps` *is* consumed for is the sub-frame contact time (`bestSub`, `e.substep`,
`e.t`), which is trace-side, and `RI-MTH07` §B is explicit that *"the trace carries it" is not a
consumer*. **`sweep.substeps` therefore scores `coupling == 0` on an entity-side observable and
this round does not claim otherwise.**

The honest remedies, neither of which a builder may award itself:
1. amend `§sweep.substeps_are_not_a_quality_setting` and M9 to test the *tightening* direction
   (substeps=1 **gains** hits), which is the property this implementation actually has; or
2. change the resolver so the substep count gates coverage — which means making the sweep less
   accurate in order to satisfy a check written against a less accurate sweep.

---

## 7. Peak tip speed across **all** clips, including the chain clips

`tools/harness/cmb-tipspeed.mjs` — every frame of every clip the game can play, root translation
removed. Artifact: `reports/w1-09/r4-tipspeed.json`.

| | clips | over their declared column | peak (local) |
|---|---|---|---|
| `clips.json` archetypes (enemies + spine) | 24 | see §3 | ≤ 0.983× declared |
| `swing.js` / `clip-registry.json` (roster) | 2,689 | **1,310 → 1,275** | **158.13 m/s** |

The round-3 verdict measured 39.6–45.2 m/s and could only see the handful of clips its exemplar
played. The census sees all 2,713, and the number is far worse than the verdict could know.

**Fixed this round: the windup and the follow-through.** Every one of the twenty worst clips
peaked in the **startup** or the **recovery**, never in the active window —
`dgr_reed_dirk 2h.run.r1` moved its tip **1.10 m in one frame** on animation frame 3. Cause: a
swing profile is authored in *phase* space and `RI-CMB04` §B constrains *frame* space, and
nothing joined them, so the same profile at a 6-frame startup ran four times faster than at a
24-frame startup and every contextual multiplier that shortens a startup multiplied the windup's
tip speed by its reciprocal. `swing.js calibrateExcursion()` now solves an anticipation scale and
a follow-through scale per clip, at that clip's own frame counts, against that class's declared
column, leaving the active band untouched. Measured effect on that clip: **67.0 → 30.3 m/s**, and
after it **every remaining peak is inside the active window**.

**NOT fixed, and it is not animation — it is arithmetic on W1-10's declarations.** *(cross-piece,
owed to `RI-WPN02` §B / `RI-WPN03`)*

| weapon / slot | declared `arc_sweep_deg` | `active_f` | solved capsule `socket_b` | measured |
|---|---|---|---|---|
| `gsw_hist_greatblade 2h.r1.1` | **271.4°** | 18 | **3.115 m** | 82.9 m/s vs 23.5 declared |
| `hlb_reed_partisan 2h.roll.r2` | **359.9°** | 19 | 2.971 m | 81.8 m/s vs 22.0 |
| `spr_mire_trident plunge` | 4.0° | 11 | 3.500 m | 92.6 m/s vs 21.0 |

A 3 m blade sweeping 271° in 0.30 s **is** 82 m/s; no animation curve can make it otherwise, and
damping the active band would put the measured arc outside the declared `arc_sweep_deg` that
`RI-WPN02` M5 checks. Note also that `RI-CMB04` §B declares the greatsword capsule at **1.35 m**
while the roster's solved capsule is **3.115 m** — a 2.3× disagreement between the item that owns
hit volumes and the roster that ships them. **Three numbers are mutually unsatisfiable and the
resolution is a corpus decision, not a builder's.**

`game/data/weapons/classes.json` now carries `peak_tip_speed_mps` for all fifteen classes — the
seven spine rows verbatim from `RI-CMB04` §B, the eight extension rows PROVISIONAL, constructed
here, marked per row, and owed back to `RI-CMB04` as an amendment. Without them
`calibrateExcursion` had nothing to solve against for 8 of 15 of the roster.

---

## 8. `RI-CMB12` — reactability and decision divergence

New tool: `tools/harness/cmb-exchange.mjs`. The item's own method script
(`corpus/80-methods/m-cmb12-exchange.mjs`) is marked *"to be written; this item is the spec"*.

### M1 — reactability census (`ES-REACT/1`)

Both §A.1 metrics are computed and both are reported. The pose metric is the max absolute Euler
deviation over the six declared tracked joints against the pose at `f_state − 1`. The silhouette
metric rasterises the actor's own twelve hurtbox capsules plus the weapon capsule
orthographically from the lock-on bearing into a fixed 96×96 grid over a fixed 2.6 m window and
takes the IoU — the silhouette of the collision body, which is the only body this build has, and
it is stated as that rather than claimed to be a render of a mesh. Where the two disagree by more
than 4 frames the **later** wins.

| champion attack | `f_state` | `f_vis` (idle / walk) | `f_active` | `t_label` | `t_react` | `lie` |
|---|---|---|---|---|---|---|
| `chop` | 12 | 20 / 48 | 80 | 68 | **60** | **8** |
| `thrust` | 12 | 19 / 47 | 66 | 54 | **47** | **7** |
| `combo_a` | 12 | 18 / 46 | 56 | 44 | **38** | **6** |
| `combo_b` | 12 | 15 / 43 | 34 | 22 | **19** | **3** |

`t_react` budget ≥ 19 f@60: **all four pass**, `combo_b` exactly on it. `lie` budget ≤ 8 f@60:
**all four pass**. `t_react` spread 41 f against a ≥ 12 f requirement: **pass**.
`reactable_share` 1.00 against ≥ 0.70: **pass**.

The `lie` column is **not all zeros**, which "How we lose" #5 says is the signature of a verdict
that computed `t_react` from the declared windup length. It is not: `f_vis` comes off the rig.

`reactable_share` was 1.00 **by absence** — nothing in the build declared the flag, and §A
requires it *"in the moveset data, in advance"* so it can be diffed between rounds. Every enemy
attack in `game/data/combat/enemies/*.json` now declares it.

### M2 / M3 — decision divergence (`ES-DIVERGE/1`)

The fork is a **replay fork**: each of the 8 alternatives at each sampled frame is a fresh
`NodeArena` replayed from frame 0 with that action injected at frame `f`. The item calls this
*"legitimate but expensive"* and warns against the shallow copy that shares the enemy's state
object; nothing is shared here because nothing is copied.

Pilot (N = 12, horizon 120 f@60, scripted champion, straight sword):

| statistic | measured | band | hard fail |
|---|---|---|---|
| `DIV` | **0.0509** | ≥ 0.06 | < 0.02 |
| `DIV_dominant` | **0.333** | ≤ 0.40 | > 0.70 |
| `DIV_dead` | **0.083** | ≤ 0.15 | > 0.35 |
| `DIV_identity` | **0.417** | ≤ 0.45 | > 0.75 |
| `do_nothing` dominant | **0.000** | — | > 0.05 |
| fork determinism | **12 / 12 identical on re-run** | — | any mismatch |

**No hard fail fires.** `DIV_dominant` at 0.333 is the number the item says *"would have caught
all three [wave-1 failures] at the round they appeared"* — rounds 1, 2 and 3 are all
high-`DIV_dominant` states. **M3's dominance witness is `roll_back`, and `do_nothing` is dominant
on zero sampled frames: the turtle is gone by the instrument that was built to see it.** `DIV`
itself is marginally below band and is the one statistic this round does not clear.

---

## 9. `RI-CMB02` M4b — per-class chain tempo

`tools/harness/cmb-chain.mjs`, artifact `reports/w1-09/r4-chain.json`.

`RI-CMB02` §C's two chain rows were class-uniform in the data as well as in the corpus, and this
build had additionally moved the *global* `r1_3.startup` to 0.90 — a uniform deviation, which is
precisely the shape the amendment exists to stop. The global rows are restored to §C's own
0.78/1.05 and 0.78/1.35 and the shaping is expressed per class, where the amendment puts it.

**Eight of the fourteen melee classes deviate** (requirement ≥ 6): `DGR`, `FST`, `CSW`, `AXE`,
`HLB`, `WHP`, `GHM`, `UGS`. Every declared multiplier is inside ±0.20 of §C's default and every
class's realised per-link `recovery / startup` clears 1.40 on its **own** base row — the tightest
is `HLB` link 3 at 2.06 and the tightest chain root is `WHP` at 1.45.

The design intent the amendment names is expressed rather than merely permitted: the axe
*accelerates* into a committed third swing (`st3 ×0.65, rec3 ×1.50` → ratio 3.43), the halberd
*decelerates* as it recovers its lane (`×0.90 / ×1.25` → 2.06), and the fist stays flat
(1.86 → 1.92 → 2.38).

`tools/weapons/build-movesets.mjs` reads the per-class pair via `chainOf()`, taking **only**
startup and recovery from the class and always taking `mv` from the shared row, so tempo cannot
become a balance lever.

---

## 10. CONSUMPTION — every model this piece requires to act, named, perturbed, and observed

`RI-MTH07` §B: two well-separated values, everything else held, an **entity-side** observable,
plus the null control. *"The trace carries it" is not a consumer.* The consequence is binary —
any `coupling == 0` scores that dimension **0**, and `partial` is not a disposition this check
has.

| # | Model | World-side consumer | Perturbation | Entity-side observable | Coupling |
|---|---|---|---|---|---|
| 1 | `§weapon_hitboxes` capsule/radius | `resolve.js` sweep, via `MovesetLibrary.socketsFor` | class `socket_b` | connect / miss across the whole reach sweep | **coupled** |
| 2 | `§hurtboxes.parts` layout | `skeleton.js` step 6 → `resolve.js` broadphase | radii zeroed | hit set collapses | **coupled** |
| 3 | `§bodies.player_radius_m` / `default_enemy_radius_m` | `system.js resolveBodyCollision`, `world-collision.js` | 0.32 → 0 | min reach, interpenetration frames | **coupled** (was 0 in round 3; `driver_carry` is why) |
| 4 | `§bodies.separation.driver_carry` | `system.js resolveBodyCollision` | present / absent | champion min reach 0.05 m ↔ 1.2 m | **coupled** — this is the model that closed §2 |
| 5 | `§body_hazard.damage.base_hp` | `resolve.js bodyDamage` | 8 → 0 / 30 | total corridor damage 90 → 0 / 200 | **coupled** |
| 6 | `§body_hazard.damage.per_mps` | `resolve.js bodyDamage` | 4 → 0 / 12 | 90 → 48 / 115 | **coupled** |
| 7 | `§body_hazard.damage.poise_damage` | `resolve.js` poise branch | 14 → 0 / 60 | total poise 84 → 0 / 360 | **coupled** |
| 8 | `§body_hazard.damage.hard_cap_fraction_of_weapon` | `resolve.js bodyDamage` | 0.5 → 0.05 | 90 → 30 | **coupled** |
| 9 | `§body_hazard.capsule` (existence) | `skeleton.js` `bodyCap` | deleted from a deep copy | corridor events 6 → 0 | **coupled** |
| 10 | attack `root_dz_m` | `actor.js advance` | forced to 0 | corridor events → 0 at every distance | **coupled** |
| 11 | `classes.json chain_multipliers` + per-class `chain` | `build-movesets.mjs chainOf` | per-class pairs | realised link frame counts, 261 links | **coupled** |
| 12 | `classes.json peak_tip_speed_mps` | `moveset.js clipFor` → `swing.js calibrateExcursion` | column present / absent | windup tip speed 67.0 → 30.3 m/s on `dgr_reed_dirk 2h.run.r1` | **coupled** |
| 13 | **`§sweep.substeps`** | `resolve.js` `SUBSTEPS` → `geometry.js` | 4 → 1 | **hit set byte-identical across 324 (attack, distance) cells** | **0 — see §6** |

**Null control:** re-running the shipped data through the same harness reproduces
`events 6, dmg 90, poise 84` exactly. The instrument is not noise.

**One `coupling == 0` stands: `§sweep.substeps`.** §6 gives the mechanism and shows it is a
property of a *closed-form* sweep rather than of a disconnected model, but the check is binary
and this round does not argue itself out of it.

---

## 11. What this round could not close

1. **`§sweep.substeps` coupling 0 / `RI-CMB04` M9 empty set.** §6. The fix is a corpus decision
   between amending the check to test the tightening direction and making the sweep less accurate.
2. **1,264 of 2,713 clips still exceed their declared peak tip speed**, all of it now inside the
   active window and all of it arithmetic on `RI-WPN02` §B's declared `arc_sweep_deg` (up to
   359.9°) against `active_f` and a solved capsule of up to 3.5 m. §7. Three declarations are
   mutually unsatisfiable; a builder cannot pick the winner.
3. **`sweep_wide` has no feasible solve** under `min_axis ≤ 0.43 m`. Best attainable is 0.524 m
   (`cst_sap_speaker:shoulder_turn`). A wide horizontal sweep at shoulder height genuinely cannot
   pass within half a metre of its own root axis — that is what an arm is — and S26's corridor is
   what covers it. Stated rather than tuned away.
4. **The boundary snap** — **RE-MEASURED IN §13.7, AND THE HYPOTHESIS BELOW IS FALSE.** It is
   0.4494 m, the capsule length is identical on both sides, and the cause is the un-blended root
   Y offset. Original text: (`ROLL_RECOVER → ATK_STARTUP` 0.4561 m, round-3 verdict §8) is **not
   re-measured this round**. The pose cross-fade is wired and blends 97.7 % of the outgoing pose
   on the first blended frame, so the residual is very likely the **socket distance changing at
   the boundary** (`evaluateRig` takes `socket_a/b` from the *move*, and a roll falls back to the
   weapon block) rather than a pose discontinuity — but that is a hypothesis, not a measurement,
   and it is recorded as such.
5. **`RI-CMB12` M4 (wall-clock gate) and M5 (feel citation)** are not produced here. They are
   citations a verdict owes, not build artifacts: `RI-PLT01` p50/p99 frame delivery and
   `RI-CMB11` `L2 == 0` for this build, and `RI-WPN05`'s `ILS` plus the resolved-hitstop
   consumption result. The instruments for M1–M3 exist and are shipped.
6. **`RI-CMB07`'s exemplar** is out of scope by dispatch — a separate piece with its own owner.
7. **`cmb-reach --verify`** — **RUN END TO END IN §13.8: 24/24 rows agree on hit and on damage.**
   Original text: **is implemented but was not run end-to-end this round.** It is the
   `RI-MTH07` §D deliverable and it must be exercised once `clips.json` settles; until it has
   been, the claim that `combat-node.mjs` is the same game remains the same *kind* of claim the
   round-3 critic caught — it just now has an implementation behind it instead of a sentence.
8. **The player side of the M8 ablation** (`--sides player`) was not swept. The enemy and player
   halves together are ~4,500 fights at ~120 ms and do not fit one budget; `--sides` exists so
   the two can be measured and written separately, and only the enemy half was run.

---

## 12. Files changed

**Code**
`game/src/combat/resolve.js` (`bodyDamage`) ·
`game/src/combat/swing.js` (`dampExcursion`, `calibrateExcursion`) ·
`game/src/combat/moveset.js` (`peakTipSpeedFor`, excursion calibration in `clipFor`) ·
`game/src/sim/world-collision.js` (one body, one radius) ·
`tools/weapons/build-movesets.mjs` (`chainOf`, scale-then-chain, `fk` from the unchained base)

**Data**
`game/data/combat/clips.json` (four attack archetypes re-solved) ·
`game/data/weapons/classes.json` (`peak_tip_speed_mps` ×15, per-class `chain` ×8) ·
`game/data/combat/enemies/*.json` (`reactable` declared) ·
`game/data/combat/movesets/*.json` (87, regenerated)

**Tools**
`tools/harness/cmb-reach.mjs` (M8.3/M8.4/M8.5/M9 + `--verify` + `--sides` + `--probe corridor`) ·
`tools/harness/cmb-exchange.mjs` (new) ·
`tools/harness/cmb-tipspeed.mjs` (new) ·
`tools/harness/cmb-chain.mjs` (new) ·
`tools/harness/anim-author.mjs` (`bury`/`chamber` knobs, `min_axis` on played rows, `RI-CMB12`
budgets in the objective, grid coarsened so the solve finishes)

**Artifacts**
`reports/w1-09/r4-m8m9-enemy-BEFORE.json` · `r4-corridor.json` · `r4-chain.json` ·
`r4-tipspeed.json`


---

# 13. ROUND 4b — the regression §3.2 left standing, finished

Round 4a ended with `RI-CMB12` M1 failing on three of the champion's four attacks and said so.
This section closes two of the three, states the third as an arithmetic incompatibility rather
than closing it, and re-measures the two things §11 recorded as unmeasured.

Everything below is measured after the change, and every claim is checked by deleting the change
from a copy of the data and confirming the old number comes back.

## 13.1 State on arrival — the in-flight solve did land

`anim-author.mjs --write`, left running at the round-4a hand-off, wrote `clips.json` at 07:26.
The file therefore carries the solve **with** the pose-metric reactability terms, not the one
§3.0 measured. Live (`cmb-exchange --probe react`):

| | round 4a §3.2 (before the terms) | as landed | budget |
|---|---|---|---|
| `chop` `lie` | 9 | **8** | ≤ 8 |
| `thrust` `lie` | 13 | 9 | ≤ 8 |
| `combo_a` `lie` | 15 | 15 | ≤ 8 |
| `combo_b` `t_react` | 18 | 18 | ≥ 19 |

## 13.2 The hand-off's "one frame of honest slack" is not one frame, and the arithmetic says so

§3.2 recorded that the solver's `f_vis` is one frame optimistic because it uses the idle stance
as its reference while `cmb-exchange` uses the pose held on `f_state − 1`, and proposed
tightening `LIE_MAX_F` to 7. **That diagnosis is incomplete and the proposed fix cannot work on
`combo_a`.** `RI-CMB12` §A.1 has *two* metrics, and `cmb-exchange` takes `f_vis` as
`min(pose, silhouette)` — or, where they disagree by more than four frames, **the later**.
`anim-author.mjs` computes the pose metric only. Measured, in animation frames:

| champion attack | live pose metric | live silhouette metric | rule | live `f_vis` | solver `f_vis` | gap |
|---|---|---|---|---|---|---|
| `chop` | 9 | 9 | min | 9 | 9 | **0** |
| `thrust` | 10 | 12 | min (differ by 2) | 10 | 9 | 1 |
| `combo_b` | 6 | 5 | min | 5 | 4 | 1 |
| `combo_a` | 8 | **16** | **later** (differ by 8) | **16** | 7 | **9** |

A `LIE_MAX_F` of 7 fixes `thrust` and `combo_b` and would need to be **−2** to fix `combo_a`.
The missing term is a metric, not a frame of slack. `combo_a` is a wide horizontal sweep drawn to
the right rear: from the lock-on bearing that motion is almost entirely along the view axis, so
the pose changes and the *outline* does not. That is a real property of the move, and it is the
one `RI-CMB12` §A.1 says wins, *"because the player must actually see it."*

The consequence is a tool change rather than a constant: `cmb-exchange.mjs` now takes
`--clips <path>` and `--moves <list>`, so a candidate clip is graded **by the instrument that
grades the build** instead of by a copy of half of it. `anim-author.mjs`'s budgets are tightened
to `lie ≤ 7` / `t_react ≥ 20` for the one-frame rows, and the file now says in terms that its
figures are a lower bound on `lie` and that `cmb-exchange --clips` is the acceptance gate.

## 13.3 Three defects in the search, and what they were hiding

The solve is a search, and round 4a's search could not reach the answers.

1. **It `break`ed out of the `ext` loop on the first feasible point.** So a whole region was
   never examined at all. `thrust` shipped at `ext 0, swing 0.22, lie 9`; `ext 50, swing 0.49`
   clears every hard constraint (peak **0.989×**, reach **1.014×**) at **`lie 6`** and
   `min_axis` **0.235 m** — better on every single key. It was invisible because `ext 0` had
   already produced *a* feasible point at that `t`.
2. **`min_axis` was a weighted term in the same `miss` as peak and reach.** An archetype with no
   feasible `min_axis` — `sweep_wide`, §11.3 — therefore fell through to `closest`, which
   minimises the weighted sum and so bought inboard geometry it could never reach with the
   excursion it needed for the telegraph. That is exactly how `sweep_wide` came to ship at
   `swing 0.13` with a 15-frame lie. Peak and reach are now **hard**; `lie`, `t_react`,
   `min_axis`, `swing`, `ext` **rank**, in that order.
3. **The `swing` step was coarsened to 0.09 so the solve would finish, and the answer lives
   between two grid points.** For `sweep_wide`, `swing 0.13` reads `lie 15` live and `swing 0.18`
   reads `lie 7`; the coarse grid samples 0.13 and then 0.22. A local refinement pass at 0.01 in
   `swing`, 0.05 in `t`, 5° in `ext` and 0.05 in `bury`/`hitFrac` now follows the coarse pass —
   all five knobs, because `sweep_wide`'s only feasible corner is at `hitFrac 0.50`, which is not
   on the coarse list `[0.2, 0.3, 0.45, 0.6]` at all.

`anim-author.mjs` also takes `--out <path>` now. Round 4a's solve wrote straight into
`game/data/combat/clips.json`, so the regression it carried was in the shipping data for the rest
of the session; a solve is a candidate until `cmb-exchange --clips` has passed it, and `--out` is
what lets that sentence be true.

## 13.4 `RI-CMB12` M1 after the re-solve

`node tools/harness/cmb-exchange.mjs --probe react`

| champion attack | archetype | `t_label` | `lie` before → after | `t_react` before → after | budget |
|---|---|---|---|---|---|
| `chop` | `chop_overhead` | 68 | 8 → **8** | 60 → **60** | `lie ≤ 8`, `t_react ≥ 19` |
| `thrust` | `thrust` | 54 | 9 → **6** | 45 → **48** | **pass** |
| `combo_a` | `sweep_wide` | 44 | 15 → **7** | 29 → **37** | **pass** |
| `combo_b` | `cut_diagonal` | 22 | 4 → 4 | 18 → **18** | **FAIL by one frame** |

`reactable_share` 1.00 (≥ 0.70), `t_react` spread 42 f (≥ 12). **Three of four pass; the fourth
is §13.6.**

Solved knobs, and only two archetypes moved:

| archetype | `startup_blend` | `swing_scale` | `ext°` | `bury` | `chamber` | `hitFrac` | |
|---|---|---|---|---|---|---|---|
| `cut_diagonal` | 0.70 | 0.22 | 0 | 1.00 | — | 0.20 | unchanged — the solver reproduces it exactly |
| `chop_overhead` | **0.70** | **0.23** | 30 | **0.85** | — | **0.15** | re-solved: same `lie 8` / `t_react 60`, `min_axis` **0.291 → 0.199 m** |
| `thrust` | **0.10** | **0.49** | **50** | — | **1.00** | 1.00 | re-solved |
| `sweep_wide` | **0.25** | **0.17** | **15** | **0.40** | — | **0.50** | re-solved |

## 13.5 MIN-AXIS after the re-solve, and the one column that moved the wrong way

`min_axis` is the distance from the swept hitbox capsule's **surface** to the attacker's own root
axis at its closest approach during the active window. The target's torso surface sits at
`0.32 + 0.32 − 0.17 = 0.47 m`.

| champion attack | round 3 | round 4a | **round 4b (shipping)** | covers 0.47 m? |
|---|---|---|---|---|
| `combo_b` (`cut_diagonal`) | 0.530 | 0.144 | **0.144** | yes |
| `chop` (`chop_overhead`) | 0.415 | 0.291 | **0.199** | yes |
| `thrust` (`thrust`) | 0.602 | 0.238 | **0.225** | yes |
| `combo_a` (`sweep_wide`) | 0.570 | 0.502 | **0.547** | **no, at either value** |

`chop` improves by 0.092 m at an unchanged `lie 8` / `t_react 60`, and `thrust` by 0.013 m while
gaining three frames of telegraph. **`combo_a` gets 0.045 m worse
and that is stated rather than buried**: it bought eight frames of telegraph visibility
(`lie 15 → 7`) with 45 mm of inboard geometry on the one attack that could not cover the
separation boundary at *either* value — 0.502 and 0.547 are both outside 0.47 — so nothing that
was reachable became unreachable. The corridor covers that ring, and §4 shows it charging for it.
Over the whole `peak ≤ 0.99 / reach ≥ 0.90` feasible set for `sweep_wide` (21,175 points scanned
at 0.01 in `swing`), the smallest attainable `min_axis` is 0.547 among the points that also clear
`lie`, and 0.524 among all of them: **there is no point that covers 0.47 m.**

## 13.6 `combo_b`: MIN-AXIS and the windup budget ARE incompatible, and here is the arithmetic

`combo_b` is the champion's chain finisher: `t_label` 22 f@60. `t_react = t_label − lie`, so
`t_react ≥ 19` means `lie ≤ 3` — the telegraph must be legible by **animation frame 4 of 22**.

Measured, `cut_diagonal` swept in `swing_scale` with everything else held
(`t 0.5, ext 0, bury 0.55, hitFrac 0.3`), peak as a fraction of `RI-CMB04` §B's declared column:

| `swing_scale` | worst peak | champion's OWN row | live `f_vis` | live `t_react` | verdict |
|---|---|---|---|---|---|
| 0.22 (shipped) | 0.976× | 0.866× | 16 | **18** | reach/peak pass, M1 fails |
| **0.24** | **0.984×** | — | 16 | **18** | largest swing under the ceiling |
| 0.28 | 1.094× | — | 16 | **18** | |
| **0.34** | **1.325×** | **1.123×** | 15 | **19** | M1 passes, `RI-CMB04` §B fails |
| 0.40 | 1.557× | — | 15 | 19 | |

There is no point in between: `f_vis` is a threshold crossing on a 12° / 0.92-IoU metric and it
moves by whole frames. **One frame of `t_react` costs 34 % of a declared peak tip speed column,
and 12 % of the champion's own.** The worst row at 0.34 is `dagger:heavy:2h` at 1.325× against
`RI-CMB04` §B's dagger figure of 14.0 m/s, which is a corpus number, so this is not an artefact
of an unplayed spine row or of a provisional enemy column.

**Which bar is wrong.** This build does not award itself the answer, but the corpus is not silent.
`RI-CMB04`'s own provenance note says of §B's peak tip speed column:

> *"The peak tip speeds in §B are derived from our own §A/§B frame data in RI-CMB02 combined with
> our own reach figures, and exist to justify the substep count arithmetically; they are
> engineering assumptions, and if our animations differ, the substep count must be re-derived
> rather than kept out of habit."*

So §B's column is declared, by the item that owns it, to be a derived engineering assumption
whose *purpose* is to size `SUBSTEPS`, and the item names the remedy when an animation exceeds it:
**re-derive the substep count.** `RI-CMB12` §A's 19-frame floor is not derived from anything else
— it is the item's own statement of what a player can answer. On that reading the column yields
and the substep count rises: at `swing 0.34` the champion's tip travels 29.2 m/s = 0.487 m per
frame against a 0.10 m capsule radius, 4.87 radii per frame, which at `SUBSTEPS = 4` is 1.22
radii per substep — and §6 of this report shows that in this implementation raising the substep
count can only *tighten* coverage, never break it.

The alternative reading is that `combo_b` should not declare `reactable: true`: a 22-frame chain
finisher is answered by having rolled already, not by reacting to it, and dropping the flag
leaves `reactable_share` at 0.75 against a 0.70 floor. **That is a design decision about the
champion and it is not a builder's to take**, so the flag stands and M1 is recorded as failing
one row of four.

**This round ships the clip that satisfies `RI-CMB04` §B** — `swing 0.22`, peak 0.976×,
`min_axis` 0.144 m, `t_react` 18 — because failing a reaction budget by one frame is a smaller
lie than exceeding a measured speed ceiling by a third.

## 13.7 The 0.4561 m boundary snap, re-measured — and §11.4's hypothesis is false

§11.4 recorded that the `ROLL_RECOVER → ATK_STARTUP` snap was not re-measured, and offered the
hypothesis that the residual was *"the socket distance changing at the boundary."* Measured now,
in the **browser**, over a 1,200-frame live run driving roll → attack-on-the-first-actionable-frame
and attack → attack (34 state boundaries):

| boundary | tip move | root move | yaw Δ | capsule length across it |
|---|---|---|---|---|
| `ROLL_STARTUP → ROLL_IFRAME` @f4 | **0.6237 m** | 0.2133 m | 0.00° | 1.4180 → 1.4180 |
| **`ROLL_RECOVER → ATK_STARTUP` @f31** | **0.4494 m** | **0.0000 m** | 0.00° | **1.4180 → 1.4180** |
| `ROLL_IFRAME → ROLL_RECOVER` @f30 | 0.1436 m | 0.1353 m | 0.00° | 1.4180 → 1.4180 |
| `ATK_RECOVER → RUN` @f107 | 0.1015 m | 0.0533 m | 0.00° | 1.4180 → 1.4180 |
| `ATK_ACTIVE → ATK_RECOVER` @f63 | 0.0671 m | 0.0182 m | 0.00° | 1.4180 → 1.4180 |
| `ATK_STARTUP → ATK_ACTIVE` @f45 | 0.0361 m | 0.0966 m | 0.00° | 1.4180 → 1.4180 |

**0.4561 m → 0.4494 m. A 1.5 % improvement, which is to say: unchanged.**

**§11.4's hypothesis is falsified.** The capsule length is 1.4180 m on both sides of the boundary
to four decimals, so the socket distance does not change. The root does not move (0.0000 m) and
the yaw does not turn (0.00°). What *does* happen is this, from the frame dump:

```
  f30  ROLL_RECOVER  roll_light            af31  A[0.220, 0.2192, 4.4550]  B[0.220, -1.1678, 4.7498]
  f31  ATK_STARTUP   clip_garrison_roll_r1 af1   A[0.224, 0.6623, 4.4656]  B[0.237, -0.7199, 4.7822]
```

Both sockets translate **+0.4431 m and +0.4479 m in Y** and essentially nothing in X or Z. It is a
whole-rig **vertical** translation, and the pose across it is continuous — which is what the
cross-fade is for and what it is doing. The cause is that the cross-fade cannot touch this term
**by declaration**: `clips.json §cross_fade.what_it_blends` says *"the per-bone Euler pose, and
nothing else. Root motion … untouched."* `roll_ground.root_offset.y` is about **−0.44** at the
phase the roll was interrupted at (the curve runs `[1.4, −0.46] … [2.4, −0.24]`) and the incoming
attack clip starts at 0. The residual snap **is** that number.

It is left standing rather than fixed, and the reason is a measurement this round did make: every
`min_hit_distance_m` and every ablation figure in §2 is computed from hurtbox capsules built off
this rig, and blending the root Y offset moves all of them vertically. That is a change to the
hit geometry of every reaction and locomotion clip in the build, on the last hour of a round
whose named gap is already closed and verified — it belongs in a round that can re-run §2, §4 and
§5 behind it. **The mechanism is now named and the hypothesis that was in the file is disproved**,
which is the part that was owed.

Two further readings this round did not have:
* the worst single-frame tip move in the run is **not** at the boundary the verdict named — it is
  `ROLL_STARTUP → ROLL_IFRAME` at **0.6237 m**, inside one clip (`roll_light` both sides), with
  the root carrying 0.2133 m of it and the blade's own motion carrying 0.406 m. That is animation
  content rather than a discontinuity, but `RI-CMB01` M3's 0.308 m per-frame tip travel does not
  care which it is, and it is 1.46× the number round 3 reported as the worst.
* the pose cross-fade is doing its job everywhere else: every other boundary in the run is
  ≤ 0.1436 m, and three of the six are under 0.07 m.

## 13.8 `cmb-reach --verify` — run end to end, and the shipping crash that was stopping it

§11.7 recorded `--verify` as implemented and never exercised. It runs now:

```
  --verify — RI-MTH07 §D, node arena vs the BROWSER (24 rows)
    chop @ 0.05 m … 3 m        hit 106   hit 106   yes    (6 rows)
    thrust @ 0.05 m … 3 m      hit 79    hit 79    yes    (6 rows)
    combo_a @ 0.05 m … 2 m     hit 69    hit 69    yes    (5 rows)
    combo_a @ 3 m              miss 0    miss 0    yes
    combo_b @ 0.05 m … 3 m     hit 106   hit 106   yes    (6 rows)
  ACCEPTANCE: pass
```

**24 of 24 rows agree on hit/miss AND on damage to the hit point.** `RI-MTH07` §D's requirement
that a partial-world harness ship a *working* `VERIFY` is met by an instrument that ran, not by a
sentence in a header.

It could not have run before, and the reason is a **shipping crash in the browser build at HEAD**:

```
  TypeError: Cannot create property '0' on number '1.2'
      at project      (game/src/sim/camera.js:739)
      at Engine._uiCtx (game/src/engine.js:1853)
      at sim.uiDriver  (game/src/engine.js:1824)
      at stepOnce      (game/src/sim/step.js:83)
```

`engine.js:1853` called `projectNDC(camera, e.pos[0], e.pos[1] + 1.2, e.pos[2], aspect)` — five
scalars — against `camera.js`'s `project(c, world[3], out[3]) → boolean`. `world` was a number,
`out` was the number `1.2`, and `out[0] = …` threw. The call site sits in the lock-on reticle
branch of `_uiCtx`, which runs **inside the fixed step**, so the throw killed the frame loop **on
the first frame after lock-on**. `H.loadState('arena_champion'); H.lockOn('E1'); H.stepFrames(1)`
reproduces it on the commit this round started from; ten frames without lock-on are fine.

Locking on is the core verb of this genre and it took the whole simulation down in the browser.
Fixed to the signature `engine.js:3089` already uses; the repro now returns `ok`. **Cross-piece:
the call site belongs to the HUD, not to combat** — it is repaired here because `RI-MTH07` §D's
deliverable is unreachable without it, and it is named here so the owning piece knows.

## 13.9 Everything round 4a closed was re-run behind the new clips, and none of it moved

| check | round 4a | round 4b, after the re-solve |
|---|---|---|
| `RI-CMB04` M8.1/8.2/8.3 (`--probe ablate --sides enemy`) | min reach **0.05 m** on all four, delta 0.00, contiguous, 0 body-only distances, 0 `root_dz = 0` corridor hits | **identical** (`reports/w1-09/r4b-m8m9-enemy.json`) |
| M8.4 attribution (`--probe corridor`) | `via:body` 10–40 dmg / 14 poise vs `via:weapon` 106 / 32; **0 violations**; every constant coupled, null control agrees | `via:body` **10** / **14** vs **106** / **32**; **0 violations**; all eight perturbations coupled, control exact (`r4b-m8m9-enemy.json`, which carries all four probes) |
| M8.5 one body one radius | 0.32 / 0.32, delta 0.000 | **identical** |
| M9 substeps | 0 pairs changed — fails as argued in §6 | **identical** |
| `RI-CMB04` §B census, all 2,713 clips | 1,264 over, peak 156.82 m/s | **1,264 over, peak 156.82 m/s — byte-identical**, so the archetype re-solve moved none of the cross-piece residual (`r4b-tipspeed.json`) |
| `cmb-reach --verify` | not run | **24/24 agree, hit and damage** (`r4b-verify.json`) |
| `tools/harness/smoke.mjs` | 6/6 | **6/6**, chromium 141, WebGL 2.0 SwiftShader |

**DELETE-THE-CHANGE CHECK.** `thrust` and `sweep_wide` reverted to their round-4a values in a
*copy* of `clips.json` and graded with the same command:

```
  thrust    lie 6 -> 9      combo_a  lie 15,  t_react 29
```

The round-4a numbers come back exactly. The change is what moved them, and nothing else in the
build is doing the work.

## 13.10 The solver now grades its own candidates, because its proxy demonstrably misranks

`anim-author.mjs --gate` keeps a ranked shortlist instead of a single winner and walks it with
`cmb-exchange.mjs --probe react --clips <candidate>`, taking the first that clears `RI-CMB12` §A
on the champion rows the archetype drives. It exists because the proxy is not merely optimistic,
it **orders candidates wrongly**:

| archetype | what the pose proxy preferred | proxy `lie` | live `lie` | outcome |
|---|---|---|---|---|
| `chop_overhead` | `swing 0.29, ext 20, bury 0.85` — `min_axis` **0.188 m**, better than shipped | 8 | **9** | rejected. The gate rejected thirteen further candidates at `lie 9` and accepted #13, `swing 0.23, ext 30, bury 0.85, hitFrac 0.15` — live `lie` **8**, `t_react` **60**, `min_axis` **0.199 m**. Shipped. |
| `sweep_wide` | `swing 0.11, ext 20, hitFrac 0.40` | **5** | **14** | rejected. With the second shortlist the gate finds ten passers out of twenty-eight and takes the smallest dead ring: `swing 0.17, ext 30, bury 0.25, hitFrac 0.55` — live `lie` **6**, `min_axis` **0.590 m**. Shipped is `swing 0.17, ext 15, bury 0.40, hitFrac 0.50`: live `lie` **7**, `min_axis` **0.574 m** — the same rule (clear the thresholds, then smallest dead ring) applied to a slightly wider candidate set, and 0.016 m better on the only key that is still a gradient once both clear. |
| `thrust` | `swing 0.49, ext 50, cham 1.00` | 6 | **6** | accepted — the solver and the instrument agree |
| `cut_diagonal` | `swing 0.22, ext 0, bury 1.00` | 3 | 4 | accepted (reproduces the shipped point exactly) |

Two of four would have shipped a worse clip than the one measured, and one of those two
(`chop_overhead`) would have looked like an *improvement* on `min_axis` while quietly costing a
frame of telegraph. That is the same trade §3.2 caught, arriving from the other direction, and it
is now caught by the tool rather than by an agent noticing. Gating `chop_overhead` also *found*
something no hand-pick had: a point that keeps `lie 8` and takes `min_axis` from 0.291 m to
**0.199 m**, which is shipped.

**Two further rules came out of running it.** First, the gate collects *every* passer rather than
taking the first: `lie ≤ 8` and `t_react ≥ 19` are **thresholds** — a clip at `lie 6` is not more
readable than one at `lie 7` in anything `RI-CMB12` scores — while `min_axis` is a **continuous**
quality, the radius of the dead ring in front of the attacker. Taking the first passer shipped
`min_axis 0.596 m` where 0.590 was two candidates further down the same list. Second:

**the gate exposed a defect in itself, which is why the shortlist is now two lists.**
Ranked by the proxy alone, `sweep_wide`'s top sixteen candidates all read `lie 13–14` live and
none passed — because the proxy rewards precisely the small excursions that leave the *outline*
unchanged, so on that archetype the proxy's order is anti-correlated with the answer. A second
shortlist ordered by **descending excursion** is now kept and interleaved with the first:
excursion is the one knob that moves a silhouette, so the two orders bracket the answer even
where one of them is pointing the wrong way.

## 13.11 What round 4b could not close

1. **`combo_b` `t_react` 18 f against a 19 f floor.** §13.6, with the arithmetic and the corpus
   citation. One frame against 34 % of a declared speed column; a corpus decision, not a builder's.
2. **`sweep_wide` `min_axis` 0.547 m against a 0.43 m budget**, and 0.045 m worse than round 4a.
   §13.5. The feasible set was scanned at 0.01 resolution and contains no point that covers the
   0.47 m separation boundary; §11.3's argument stands and is now backed by 21,175 measured points
   rather than by one.
3. **The boundary snap is measured and attributed, not repaired.** §13.7.
4. **The 1,264-clip tip-speed residual is unchanged and remains cross-piece.** §7. It is
   arithmetic on `RI-WPN02`'s declared `arc_sweep_deg` (up to 359.9°) over `active_f` with solved
   capsules up to 3.5 m, against `RI-CMB04` §B's 1.35 m greatsword capsule. Three declarations are
   mutually unsatisfiable and this round did not absorb them.
5. **`sweep.substeps` coupling 0 / M9's empty set.** §6, unchanged.
6. **`--sides player`** still not swept. §11.8.
