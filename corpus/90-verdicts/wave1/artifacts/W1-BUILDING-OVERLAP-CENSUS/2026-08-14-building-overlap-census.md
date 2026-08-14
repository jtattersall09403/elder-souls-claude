# How many buildings in this world are inside each other? — 2026-08-14

**Commissioned by** `orchestration/status/RULING-D1-BUILDING-OVERLAP.json`, which found the Writ
House and the barge hold at Thorn — the first two structures a player meets, in the town the game
starts in — overlapping by 7.02 × 4.00 m, with the writ house's front door opening *inside* the
barge hold. The ruling's own words: *"one overlap found by accident, in the first two buildings
anybody looked at closely, in a world of eight settlements, is not evidence of one overlap — it is
evidence that nobody has counted. The census is worth more than the fix."*

It was right. **The answer is 83.**

Measured at `350c18a7`. Tools, all committed and re-runnable in bare Node:

| | |
|---|---|
| the census | `tools/world/building-overlap-census.mjs` (`--self-test`: 10 arms) |
| the delete-the-fix | `tools/world/thorn-quay-deletefix.mjs` (6 arms) |
| the standing gate | `tools/check-building-overlap.mjs` (`--self-break`) |
| numbers | `corpus/90-verdicts/wave1/artifacts/W1-BUILDING-OVERLAP-CENSUS/` |

---

## 0. What I could not do

- **No hardware frames.** Every number here is offline geometry and the *shipped* `stepCamera()`
  stepped by hand in bare Node — not a re-implementation, the shipped function. The box was at
  **11 browser instances and load 12.35 per core against a ceiling of 4.0** for the whole run, and
  the shared capture daemon's own status read **5 browser boots, 10 errors, 0 captures**. A starved
  browser reports a camera that never settled as a camera that collapsed, which is the exact failure
  that produced three false defect reports on this box in one day. Frames are owed and are not
  claimed.
- **82 of the 83 overlaps are not fixed.** This piece fixes the one pair the ruling names and
  freezes the rest behind a ratchet. §4 says why the rest is a separate piece and what it costs.
- **The yaw-blindness is diagnosed, not repaired.** `planSettlement()`'s shrink pass and
  `province.js#_deepOverlaps()` are both wrong in the same way (§2). Repairing the resolver re-plans
  all eight towns, and both files have five live pieces editing them.
- **A vacuous counter found in passing, and not fixed** — not this piece's file. All 115 interiors
  are native RI-WLD13 records, so every one of them takes `applyInteriorBounds()`'s native branch
  and `continue`s. That branch increments `out.doorsteps_standable_own_door++` **unconditionally**.
  The join therefore reports *"115 doorsteps that put the body outside it"* having tested none of
  them, and the whole round-6 doorstep derivation below it — the ring search, the standability
  predicate, the nearest-door predicate, the bounded repair loop — is **dead code on the shipped
  world**.

---

## 1. What counts as an overlap

A real town has buildings that share a wall, terraces, lean-tos and porches under an upper storey.
Thorn's own record says so in as many words: *"Every structure is a lean-to and none is
free-standing."* A census that folds those in inflates its own number and is worth nothing. So:

The measure is **separation depth** — the minimum translation distance (SAT) that would pull the two
*oriented* rectangles apart. Not intersection area: a long thin graze between two big buildings has a
large area and is architecturally nothing.

| separation depth | class | counted? |
|---|---|---|
| ≤ 0 | disjoint or touching | no |
| ≤ 0.36 m | `shared_wall` — 0.36 m is the shipped `SHELL_WALL_T`, so two buildings whose wall slabs coincide | **no** |
| ≤ 1.50 m | `borderline` — a porch, an eave, a lean-to leaning. Above the 1.10 m of roof overhang `settlementSolids()` itself adds, below the 5.00 m `MIN_ENTERABLE_SPAN_M` floor, so it cannot hide a whole room | **no, reported separately** |
| > 1.50 m | `overlap` — more than a wall, an eave and a porch: one building's floor area is inside another's | **yes** |

`kind: "structure"` pairs (wells, posts, racks, kerbs) are censused **separately** and never folded
into the headline: `settlementSolids()` gives them no footprint box at all, only feature volumes from
`structureCollisionLocal()`, so their declared footprint is a plot, not a mass.

Two aggravating flags ride on top, because they are what a player meets: **`door_inside_other`** (a
building's door point is inside another building's footprint — the Thorn defect exactly) and
**`centre_inside_other`** (swallowed).

**The instrument goes red.** `--self-test` runs 10 arms and two of them exist to stop it being a
second copy of the experiment: one requires the axis-aligned and the yaw-90 arms to **disagree**, and
one requires the yaw-blind AABB view to **miss** the pair the oriented view catches. It also checks
the polygon clipper against an analytic answer (two squares at 45°, area `100(2√2 − 2)`).

---

## 2. The count

| settlement | buildings | mass | **OVERLAP** | borderline | shared wall | door inside another | centre inside another |
|---|---|---|---|---|---|---|---|
| archon | 22 | 16 | **15** | 2 | 1 | 3 | 3 |
| blackrose | 22 | 16 | **8** | 9 | 0 | 4 | 5 |
| gideon | 22 | 16 | **6** | 2 | 1 | 2 | 0 |
| helstrom | 40 | 32 | **7** | 0 | 0 | 2 | 0 |
| lilmoth | 33 | 23 | **19** | 2 | 2 | 10 | 7 |
| soulrest | 15 | 10 | **12** | 2 | 1 | 1 | 4 |
| stormhold | 33 | 23 | **3** | 1 | 1 | 0 | 0 |
| thorn | 18 | 13 | **13** | 6 | 0 | 3 | 4 |
| **total** | **205** | **149** | **83** | **24** | **6** | **25** | **23** |

**Eight of eight settlements.** 25 buildings have a door inside another building. The deepest is
Soulrest at **8.64 m**; four separate Soulrest pairs sit at exactly that depth, which is the
signature of a generated ring.

### Why nobody counted: the resolver measures a rectangle the world does not have

`planSettlement()` **already has** an overlap resolver — the per-axis shrink pass at
`MAX_OVERLAP_FRAC = 0.45` — and `province.js#_deepOverlaps()` **already has** a counter for what it
failed to resolve. Both compare **axis-aligned** footprints:

```js
const Dx = Math.abs(a.x - c.x), Dz = Math.abs(a.z - c.z);
const Sx = (aw + cw) / 2,       Sz = (ad + cd) / 2;
```

`settlementSolids()` — the geometry the player collides with — and `buildSettlementExterior()` — the
geometry the player sees — both **rotate the footprint by `yaw_deg`**:

```js
const wx = b.x + cx * c + cz * s, wz = b.z - cx * s + cz * c;
```

So for any building whose yaw is not a multiple of 180 the resolver and its counter are measuring a
rectangle that is not in the world. **At yaw 90 the width and the depth swap.** Thorn's barge hold is
declared 7.00 × 16.02 and stands 16.02 × 7.00. The resolver checked the wrong pair of axes, found no
problem, and the counter agreed with it.

- **63 of the 83 are invisible to the shipped check.** `_deepOverlaps()` would report 22.
- **71 of the 83 involve at least one yawed building.**
- The shipped counter is also only ever written onto a render summary (`g.userData.exterior`), so
  even the 20 it can see are reported to nothing that fails.

This is the same shape as the doorway defect the ruling records from the other side: *a yaw-only fix
would have moved a number and changed nothing, because the thing the number described was not drawn.*
Here a number was drawn and nothing described it.

---

## 3. The ruling's falsifier, answered

> *"If the census finds that overlaps are pervasive **and load-bearing** — i.e. settlements have been
> authored ON TOP of overlapping footprints and separating them breaks street layouts, quest
> coordinates or door registrations across many towns — then separation stops being a two-number fix
> and becomes a layout migration."*

**Pervasive: yes, decisively.** 83 across 8 of 8 settlements. The ruling's premise — one accidental
overlap — is dead, and it should be read as overturned in that half. Thorn alone has 13, and the pair
the ruling names is only the **tenth deepest of them**.

**Load-bearing: no, not in the way the falsifier feared — so the ruling's instruction stands.**
`planSettlement()`'s comment is explicit that positions are never moved and only sizes are touched,
and the shrink has floors (`MIN_ENTERABLE_SPAN_M` 5.0 m, `MIN_FOOTPRINT_M` 3.4 m). Take every
building in an overlapping pair to its floor — the most a size-only resolver can ever do — and
re-measure:

- **72 of 83 separate.** Reachable without moving a single position, so no street layout, quest
  coordinate or door registration changes at all.
- **11 need a position moved.** Six of those are authored at a centre gap of **1.0 m or less**, and
  `thorn-gate` / `thorn-house-0` are at the **identical** `offset_m` `[-6.86, 0, 8.6]` with the
  identical yaw — two buildings at the same spot, 100% of the smaller inside the larger.

So the majority is a **code defect in one function**, not a layout defect, and the correct global fix
does not touch settlement data at all.

**But the falsifier was right about a cost the ruling did not anticipate.** Moving one building is
**not** a two-number edit. All 115 interiors are native RI-WLD13 records, so `door_world_pos`,
`apertures[].world_pos`, `exterior_door`, `continuity.exterior_spawn` and `exterior_spawn_declared`
are **world coordinates in the interior record that do not follow `offset_m`**, on top of `door` and
`door_declared` in the settlement document. That is nine values for one building, and it is exactly
the door-registration coupling the falsifier named.

**Ruling, and it is reversible.** Separate at Thorn, as ruled — done, §4. Freeze the other 82 behind
a gate — done, §5. Schedule the class as its own piece, whose first move is the resolver, not the
data: making the shrink pass yaw-aware is one function and reaches 72 of 83 without touching a
settlement file. What would overturn *that*: if a yaw-aware shrink at the shipped
`MAX_OVERLAP_FRAC = 0.45` turns out to leave most pairs still over the 1.50 m bar — the tolerance
permits 45% of the smaller span, which is a lot — then the tolerance is the defect and the piece is a
policy change plus 11 hand-placed buildings instead.

---

## 4. The Thorn separation

**Ruled: separate the buildings, do not move `exterior_spawn`. Done — and the barge hold is what
moved.**

The writ house's `continuity.exterior_spawn` is the one the ruling means, so the writ house had to
stay: moving it would have dragged its doorstep with it. The barge hold moved **+8 m in z**, a pure
translation, so every relative geometry it owns — its door on its own wall, its doorstep in front of
that door, its cargo hatch — is preserved exactly. Only its relation to the writ house changes. Nine
values, in two files.

**The +8 m was measured, not argued.** Seven candidate offsets were scored on a hard-linked control
clone with the shipped `stepCamera()` over all 72 bearings:

| candidate | bearings drawing the player | bearings with a full arm | best drawn-and-clear | barge doorstep → writ door |
|---|---|---|---|---|
| baseline | 25/72 | 21 | 3.99 m / **0.75 m** | 7.70 m |
| +6 z | 42/72 | 26 | 3.99 m / 12.0 m | 6.43 m |
| −9 x | 46/72 | 41 | 3.99 m / 12.0 m | 15.90 m |
| −6 x +6 z | 46/72 | 41 | 3.99 m / 12.0 m | 12.34 m |
| **+8 z (shipped)** | **46/72** | **36** | **3.99 m / 12.0 m** | **7.16 m** |
| −6 x +8 z | 46/72 | 41 | 3.99 m / 12.0 m | 12.74 m |
| −12 x | 46/72 | 41 | 3.99 m / 12.0 m | 18.80 m |

The last column is why `+8 z` won over the westward moves that score a little better on arm length.
`barge-hold.json`'s own note records an authored relationship — *"the door out of the hold is the door
into the writ house queue, which is why `exterior_spawn` here and `writ-house`'s `exterior_door` are
eight metres apart on the same quay"* — and the opening stages the barge hold and then the writ house.
`+8 z` ties the best score on every camera measure while keeping that walk at **7.16 m against the
authored 8**. The westward candidates turn it into a 16–19 m trek across the quay for nothing.

### What changed at the doorstep

| | before | after |
|---|---|---|
| the pair | **7.02 × 4.00 m inside each other** | disjoint, 4.00 m of street |
| writ house's door | **inside the barge hold** | outside every building |
| bearings that keep the player drawn | 25 / 72 | **46 / 72** |
| best bearing that draws the player *and* sees | 3.99 m arm, **0.75 m** of view | 3.99 m arm, **12.0 m** (the cap) |
| clearance across all 72 bearings | `<1 m`: 41, `1–2 m`: 7, `12 m`: 24 — **nothing in between at all** | `<1`: 19, `1–2`: 9, `3–4`: 9, `4–5`: 3, `5–6`: 2, `7–8`: 2, `11–12`: 1, `12`: 27 |

The report that commissioned this named its own falsifier: *"a run in which
`sweep_summary.best_drawn_and_clear` comes back with `clearance_m` above about 6 m. That would mean a
bearing exists that does both and the standing point is fine. It does not today."* **It does now:
12.0 m at yaw 95.** And the scan is no longer bimodal — there were three occupied clearance buckets
and no middle; there are now eight, with 17 bearings in the middle that had nothing in it.

`node tools/check-building-fits-room.mjs`, `check-data`, `check-souls-world` and `check-save-shape`
are all green afterwards.

### The residual, stated plainly

**At the shipped exit facing the player is still not drawn**, and separating the buildings did not fix
that. `exitFacing()` returns yaw 70 from `door_to_doorstep`, and the arm there goes 0.46 m → **0.90 m**
— better, and still exactly at `fade_zero_m = 0.90`, so `char_opacity` is 0. The obstruction is named
and it is not the barge hold: `writ-house:+z+`, the writ house's **own** south wall panel, because
`exterior_spawn` sits 0.68 m in front of it.

That is a doorstep-placement question and the ruling forbids this piece touching it. What has changed
is that it is now **fixable**, which is precisely what the previous agent correctly reported it was
not: before, no bearing existed that both drew the player and saw anything, so no facing rule could
help. Now 46 bearings draw the player and yaw 95 does both. **The follow-up is a facing rule at the
writ-house doorstep, and it will work.**

### Delete-the-fix

`node tools/world/thorn-quay-deletefix.mjs` — 6 of 6, on a hard-linked control clone. It asserts the
teardown **actually happened** (all nine values changed on disk) before measuring anything, so an
inert control cannot be reported as a clean negative:

```
PASS  all nine values reverted on the copy — 9/9
PASS  the overlap returns — torn down 7.01 x 4.01 m; fixed disjoint
PASS  and it is the report's 7.02 x 4.00 m
PASS  the writ house's door is inside the barge hold again
PASS  best_drawn_and_clear collapses — torn down 0.75 m, fixed 12 m
PASS  the sweep goes bimodal again — torn down 0 bearings in the middle, fixed 17
PASS  and fewer bearings keep the player drawn — torn down 25/72, fixed 46/72
```

---

## 5. The standing gate

`tools/check-building-overlap.mjs`, wired into `.githooks/pre-commit` on commits that touch
`game/data/world/settlements/`, `game/data/world/interiors/` or `render/exterior.js`. ~2 s, JSON
only, no browser.

**It is a ratchet, not an assertion, and that is deliberate.** RULES.md rule 13 forbids landing a
fail-closed assertion before the data it demands exists, and 82 overlaps exist. A gate demanding zero
would throw for every agent on the box and be disabled within the hour — this project has shipped one
of those. So it fails only when the world gets **worse**: a settlement's count goes up, a pair
overlaps that was not overlapping at the freeze, or a door ends up inside another building. It
reports improvements without failing and asks to be re-frozen. Baseline:
`corpus/50-world/data/building-overlap-baseline.json`, frozen at 82.

**It fires, and you can watch it.** `--self-break` builds a control clone, puts the barge hold back
where it was, and requires the check to go red there and stay green on the shipped tree — exiting
non-zero if either arm disappoints:

```
self-break — the Thorn barge hold put back on top of the writ house, on a copy:
  sabotaged tree: 3 regression(s)
      thorn: counted overlaps went UP, 12 -> 13
      new overlapping pair: thorn:barge-hold|writ-house
      a door is now inside another building: thorn:writ-house
  shipped tree:   0 regression(s)
```

Three independent detectors fire, not one. **Non-blocking**, following `check-quests`' stated
precedent — town geometry belongs to several live pieces at once and banking in-flight work is worth
more than a clean tree. **Reversible:** promote it to blocking once the remaining 82 have been
resolved and the floor is low enough that a red here is always a real regression rather than
somebody's work in progress.
