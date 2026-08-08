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
