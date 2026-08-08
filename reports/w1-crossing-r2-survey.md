# W1-CROSSING round 2 — the province crosses both ways

**Piece:** the crossing, round 2, against verdict `corpus/90-verdicts/wave1/W1-CROSSING-r1.md`
(FAIL, 6/10, min over axes, against a wave-1 gate of 7.0). Plus closing `W1-05`'s mandatory
reachability proof, which round 1 §D4 and `NEXT-DISPATCH` §Q14 unblocked.

**Status file:** `orchestration/status/W1-CROSSING-r2.json`. **WIP until this line is deleted.**

**Contention (rule 21, rule 26).** `node tools/contention.mjs --gate` returned **exit 0 (GO)** at
the start of this round (3 browser instances, load 2.21 over 4 cores against a 4.0 ceiling) and at
every check during it. One browser, kept, for the long sweep; the short arms were chained after it,
never concurrent. **No timing or performance figure appears anywhere in this document** except the
wall-clock cost of the sweep itself, which is labelled as such. Every other number here is a
distance in metres, a frame count, an in-world minute (frames ÷ 3600), an angle, a count or a
boolean, and none of them moves with load.

---

## 0. Round 1's four items

| round 1's four items | outcome |
|---|---|
| 1. Port the teleport exclusion from `walkRoute` into `walkPath`, and correct F7/§2c | **DONE** — with one correction to the framing: the *steering* was never divergent (§2) |
| 2. Adjudicate the reverse jam — `stormhold-helstrom` points 126/131 | **DONE. It is a world defect, and the fix is in the generator** (§1) |
| 3. Replace the vacuous centreline slope-gate counter with the lateral sweep | **DONE, re-taken on this tree** (§5) |
| 4. Strengthen `crossing-deletefix.mjs`'s HP pin and re-run the grid re-seeded | **NOT DONE. I did not re-run that grid at all** (§9) |

---

## 1. THE REVERSE JAM: the road passes over itself

### 1.1 What is there

`tools/world/w1-crossing-r2-overpass.mjs` — new, offline, no browser. It walks every leg's
centreline at 1 m and asks one question per sample: **is the ground here higher than this leg's own
declared road profile, and if so, whose slab is doing it?** An offence is
`heightAt(x, z) − declared_y > 1.0 m` with the shadowing structure a `deck_span` segment belonging
to a different stretch of road.

At the pre-fix tree, **exactly one offence run in the whole 25,390-sample network**:

| leg | metres along | worst burial | road y | deck y | shadowed by | separation |
|---|---|---|---|---|---|---|
| `stormhold-helstrom` | 1,633 – 1,639 | **6.99 m** | 83.92 | 90.92 | its own segment 130 (17 m viaduct) | 0.27 m |

That is the coordinate the round-1 critic's body jammed at, arrived at from a different direction
and with no browser.

**And the geometry is worse than "a switchback whose limbs are 5.74 m apart".** Solving the two
segments directly: `stormhold-helstrom` segment **126→127** and segment **130→131** *cross*, at
**(2280.6, 1862.2)**, with **6.6 m of air between them** — the lower limb at y ≈ 84.5 and the
viaduct deck at y ≈ 91.1. It is not a near miss. **The road is a grade-separated crossing of
itself.**

### 1.2 Why the fix cannot be in `field.js`

`field.heightAt()` is a **heightfield**: one surface per (x, z). Two things resolve the collision
there and both are deliberate and documented:

- `_deckY()` returns the **highest** slab covering the point — *"A BRIDGE DECK IS THE TOP OF THE
  WORLD AT THAT POINT"*;
- `_applyRoads()` breaks a tie between two segments covering a point with equal weight in favour of
  the **higher** one, explicitly because *"taking whichever segment the bucket happened to list
  first made the collision height depend on iteration order"*.

Neither can represent two carriageways at one coordinate, and no ordering of them can: whichever
surface you return, the body on the other limb is either buried or standing on air. I tried the
obvious alternatives on paper before writing anything — nearest-carriageway tie-breaking, a
headroom test that hides a slab standing over a lower road — and each of them fixes the body on the
lower limb by dropping the body on the *upper* one through the deck, because the exclusion zone and
the parapet's `hw + 0.35` do not coincide. **An overpass needs a second surface, and this engine
has one.**

### 1.3 So the invariant is authored instead

`tools/world/build-roads.mjs` gains `selfClearance()`, applied last, on the finished polyline, for
the same reason the settlement join is last:

> no two non-adjacent stretches of one leg may come within `half_width + 0.5 + half_width × 1.15 +
> 0.5` of each other — the deck slab's reach plus the lower carriageway's collision width plus a
> margin, **7.45 m** at `half_width = 3`.

Where they do, the excursion between them is spliced out at the point of closest approach: at a
true crossing that junction *is* the crossing point, so the spliced road passes through where it
used to pass over. The two new edges are densified to the leg's ~12 m point spacing and **nothing
outside the splice moves**, which is what makes the diff readable.

`--no-self-clear` is the delete-the-fix arm, and it is not a debug flag (§7).

### 1.4 What it found and what it cost

**Fifteen places in six legs** were within reach of themselves. Only the one above currently buried
a carriageway; the other fourteen were latent, and two of them were tighter than it —
`archon-thorn` at **0.01 m** and `helstrom-blackrose` at **1.34 m** of closest approach.

| leg | splices | loop removed |
|---|---|---|
| `stormhold-helstrom` | 3 | 93.1 m |
| `soulrest-blackrose` | 4 | 69.4 m |
| `helstrom-blackrose` | 3 | 59.8 m |
| `archon-thorn` | 3 | 54.8 m |
| `blackrose-lilmoth` | 1 | 22.2 m |
| `helstrom-archon` | 1 | 18.8 m |

Against RI-WLD01 §4's declared lengths, every leg stays inside its 5% band — worst
`soulrest-blackrose` at **−3.77%**, then `stormhold-helstrom` **−3.19%**. The trunk network is
25,067.2 m against a declared 25,331 (−1.0%); **THE CROSSING is 6,728.5 m / 56.07 declared walk
minutes** against a declared 6,909 m / 57.6, inside RI-WLD01 M2's 6,300–7,600 m and 52–65 min bars.
`road-through-building.mjs` is **0 offences, 0 of 10 legs**, worst building clearance 1.10 m against
a 1.1 m bar — the splice put nothing into a wall, and that is checked per leg inside the generator
rather than hoped for.

The census after the fix: **0 offence runs, 0 buried samples of 25,071.**

---

## 2. `walkPath` reconciled with `_pursue` — and one correction to round 1's framing

Round 1 §A3 named this the biggest gap in the round, and it was right that the verb was unfixed and
right that it matters most. **One clause in it needs correcting, and correcting it is the
reconciliation the acceptance asks for.**

**The steering was never divergent.** `game/src/engine.js` `walkPath()` line 8392 already reads

```js
const pur = this._pursue(points, st, o.lookahead_m, o.arrive_m);
```

— the same projection-onto-the-path steering `walkRoute` uses, the same function, one
implementation, no second copy. Rule 10's "two parallel implementations of one system" does not
apply here: there is one `_pursue` and both verbs call it.

**What had not been ported is the teleport ACCOUNTING.** `walkPath` had `dist += step` with no
threshold and no `teleports` / `teleported_m` field anywhere in its return. That is now the same
six lines `walkRoute` carries, plus one field `walkRoute` does not need:

- `teleports`, `teleported_m`, `teleport_log` — metres the world *moved* the body, excluded from
  `path_m`;
- **`arrival_is_clean`** — because `walkPath`'s `arrived` is answered against the body's *position*,
  and a respawn moves that too. The hearth this province respawns you at is 116.7 m from THE
  CROSSING's destination (round 1 §A2), so a body that dies on the first leg would otherwise report
  an arrival. `arrived` and `arrival_is_clean` must be read together.

Everything `walkPath` drives is therefore re-run in this round against the fixed verb, per §Q14:
the twenty-two walks of §3, and `W1-05`'s journey (§6).

---

*(§3 onwards land as the browser sweep completes — this file is written incrementally on purpose)*

## 3. The second cause, which round 1 did not find — and which is not the road

With the overpass removed, `stormhold-helstrom` **still did not walk backwards.** Forwards 2,784.9 m
and arrives; backwards 3,393.7 m of a 2,827.9 m leg and never arrives, pinned at **(2298.8,
1842.7)** with `onRoad` true, `onDeck` true, the slope gate never firing, 0 water, 0 teleports, and
a longest stall of 701 frames against a 900-frame abort. Not drowning, not falling, not blocked by a
slope — the gate and the slide are both skipped outright when `onRoad` is true (`sim/traversal.js`
§3 and §6).

### 3.1 The steering is innocent, and I proved it rather than assuming it

`tools/world/w1-crossing-r2-pursue-sim.mjs` transcribes `Engine._pursue` verbatim and drives a
**kinematic point** — 2 m/s straight at whatever target the loop returns, with no terrain, no
collision, no gravity, no parapet, no slope gate and no signature landform. If the walk fails there
it is the pursuit loop, because there is nothing else left.

**All ten legs arrive in both directions.** `stormhold-helstrom` reverse: 2,782.5 m. The largest
cursor jump anywhere in the network is 2 segments. `_pursue` is acquitted.

### 3.2 What was holding the body: the railing, standing between it and its own road

The leg hairpins at point 120 and the **13 m viaduct on segment 120–121 begins at the apex**. Near
any corner the two limbs are within a slab's width of each other — that is true of every corner, at
every turn angle, and no road geometry fixes it. So the deck's slab lies over the earth approach,
and a body on the approach is `onDeckAt` true at **t = 0.37** of the deck segment: neither end of
the chain. `clampToDeck`'s last test asks *"is the destination beyond a chain END?"*, the answer is
no, and every step the body takes toward its own road is read as a step over the **side** and put
back.

Measured one metre off the slab edge: the carriageway continues at **80.07** against a deck at
**80.83**. A **0.76 m kerb**, with `onRoadAt` true. That is not a fall off a viaduct; it is stepping
down a kerb onto the road, and the railing has no business there.

**The fix, in `field.clampToDeck`, deliberately narrow, both halves load-bearing:** let the body go
if the destination is `onRoadAt` **and** the drop to `naturalHeightAt` (terrain + sites + road
corridor, **no slab**, no signature landform) is at most `PARAPET_KERB_M`.

### 3.3 The constant is 4 m and it was 1 m first, because the first value was not enough

At `PARAPET_KERB_M = 1.0` — chosen against `traversal.json`'s `step_up_m` 0.55 and the 0.35 m
airborne threshold — the body was released at the 13 m viaduct and **then pinned 700 m earlier**, at
(2181.0, 1186.8), against the 22 m viaduct on segments 34–36, whose slab overhangs its own approach
by **3.12 m**. Same defect, bigger drop. The game's own answer to *"is a 3 m step down a fall"* is
no: `fall.safe_m` is **4**. So the constant is `fall.safe_m`, it is named and commented as such, and
the failed first value is recorded in the source rather than quietly replaced.

**This is only safe because of the other half of the fix.** A 4 m exemption would open the railing
over a road below — except that a slab may no longer stand over a foreign carriageway at all (§1),
and the overpass census reports **0 offences in 25,071 samples**.

### 3.4 The teardown, with the control watched red

`tools/world/w1-crossing-r2-parapet-trap.mjs`, offline. It sweeps every leg centreline **and ±1, ±2,
±3 m laterally**, offering a one-frame step along the road in each direction, and counts the places
where the railing refuses a step onto carriageway within a kerb of the deck.

| arm | traps at 1 m | traps at 4 m |
|---|---|---|
| **round-1 parapet** (`tools/world/clamp-before-r2.js` — everything round 1 shipped, without this round's exemption) | **9** | **17** |
| round-0 parapet (`old-clamp-345dcca.js`, an independent second control) | 9 | 17 |
| **shipped** | **0** | **0** |

And the railing still works, which is the control for *"did the fix just delete the parapet"*:
**1,700 of 1,720 straight-over-the-side pushes are still refused, worst drop saved 52.9 m.**

**My first cut of this tool reported zero traps on both arms and zero railing refusals.** It sampled
the centreline only — the trapped body was **1.97 m off it** — and pushed sideways one eighth of a
metre, which never leaves a 3.5 m slab. A probe that cannot fail is worse than no probe, and this
one could not fail in exactly the place it was written for. Both defects are recorded in the tool's
own comments rather than quietly fixed.

---

## 5. The tautology, replaced — and a number nobody had

Round 1 §B2 is right and it is still right at this tree: **25,071 of 25,071 centreline samples are
exempt from the slope gate via `onRoadAt`, 100.0000%.** `climb_over_limit` on a centreline is
structurally zero for any road, any terrain, any commit. The replacement is the critic's own lateral
sweep, re-taken here, with its **structure-free control column** so the slab artefact is not
published as terrain:

| lateral offset | gated | refused >40° | worst | **structure-free legs: refused** | **worst** |
|---|---|---|---|---|---|
| 0–3 m | 0 | 0 | — | 0 | — |
| 3.45 m | 17,316 | 9 | 58.61° | **0 / 6,726** | 29.21° |
| **3.5 m** | 37,151 | 740 | 88.31° | **0 / 14,220** | **32.76°** |
| 4 m | 39,055 | 1,124 | 88.27° | **4 / 14,414** | 41.89° |
| 5 m | 49,144 | 1,323 | 88.22° | 41 / 19,621 | 54.75° |
| 6 m | 49,271 | 692 | 88.21° | 45 / 19,691 | 59.87° |

The 88° figures are the slab artefact and are labelled as such. On ground with no structures near
it the gate refuses **nothing at all out to 3.5 m** and starts at 4 m.

### 5.1 And the thing rule 8 says to do to a gate: ask it in both directions

`tools/world/w1-crossing-r2-bothways-gate.mjs`. The gate **is not symmetric** — it returns 0 unless
the step climbs (`if (!(yA > y0)) return 0`), so a 45% descent northbound is a 45% climb southbound.
Every "worst gradient" figure this project has published is a *longitudinal* gradient off
`roads.json`'s own point elevations; it is not the quantity the gate reads, which is `heightAt` —
slabs, site pads and signature landform included — through the secant over 1.5 m.

Swept along every centreline at 0.5 m, in both directions:

| | count |
|---|---|
| samples | 50,140 |
| would refuse walking **forwards** | **102** |
| would refuse walking **backwards** | **186** |
| **refused in one direction only** | **288 — every single one** |

worst 62.92° on `stormhold-helstrom` at (2150.9, 1206.4). **Not one of the 288 refuses both ways.**

**Read this correctly, and it is a counterfactual, not a defect.** The carriageway exemption is
above these lines in `traversal.js`, so none of the 288 bites a body on the road. What the number
is, is the **size of the thing the exemption is carrying** — and the fact that it is 100%
one-directional is the cleanest statement of rule 8 this round produced: a quantity that is zero one
way and 62.92° the other, sampled one way, reads as zero. The three-arm self-test (built road /
every `deck_span` removed / no roads at all — 78 refusals on the bare hillside, worst 57.3°) proves
the sweep is measuring the road and not the mountain.
