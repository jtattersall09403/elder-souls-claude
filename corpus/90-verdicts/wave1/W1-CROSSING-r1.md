# W1-CROSSING — round 1 verdict

**Piece:** the crossing — `engine._pursue()` / `walkRoute` / `walkPath` steering, `field.clampToDeck`
parapet, the teleport exclusion in `path_m`, and the premise correction that replaced the "57.5°
skirt" with a 471 m viaduct.
**Critic:** `critic-w1-crossing`, fresh context. No part of W1-CROSSING, W1-ROAD-JOIN, W1-01-r4 or
W1-05 was written by me.
**Measured at:** `2fe47f5` (HEAD when the run began). Every browser figure below was taken after
`node tools/contention.mjs --gate` returned **GO**; the two exit-3 readings I got first were waited
out, not proceeded past. See §I.

**Status: PASS with a named defect. Score 7 / 10, min over axes, against a wave-1 gate of 7.0.**

---

## The headline: I walked it, and the numbers are right to the decimal

Nobody had independently walked THE CROSSING. Two rounds of verdicts said so in as many words —
W1-ROAD-JOIN §F: *"Nobody has still walked THE CROSSING end to end, and no figure in this verdict
should be read as if somebody had."* That is no longer true.

`node tools/world/critic-crossing-walk.mjs --route crossing --survive`, my own tool, my own
per-frame accumulator, one browser, artifact written after every chunk:

| | builder | **critic, independently** |
|---|---|---|
| distance | 6,646.7 m | **6,646.7 m** |
| frames | 199,433 | **199,433** |
| in-world time | 55.398 min | **55.398 min** |
| mean ground speed | 1.9991 m/s | **1.9991 m/s** |
| samples under 1.6 m/s | 0.063% of 33,238 | **0.063% of 33,238** |
| worst deviation from the road | 1.39 m | **1.39 m** |
| frames off the road | 0 | **0** |
| teleports | 0 | **0** |
| ends at | (2765.6, 5028.8) | **(2765.6, 5028.8)** |

Region sequence: salt-hills → valus-ridge → stone-forest → blackwood → deep-marshes → blackwood →
western-rootlands → hive → western-rootlands → eastern-rootlands → western-rootlands. Picture from
the road at the arrival: `docs/shots/2026-08-08-critic-w1-crossing-lilmoth-from-the-road.png`.

**Two things I add that the builder did not measure.**

- **My counter is not `walkRoute`'s.** It hangs off `Engine._afterStep` and re-derives the distance
  from the capsule's own position deltas, so the agreement above is two independent counters, not
  one number read twice. It also keeps the **naive** sum — every step with no upper bound, the old
  broken accounting. Over the crossing `naive_sum_m` is **6,646.7 m too**, and the largest single
  frame step in 199,432 frames is **0.295 m**. So the zero is zero because nothing jumped, not
  because jumps stopped being counted. That is the question §A was asked to settle and it is
  settled affirmatively.
- **RI-WLD01 M4 (leg-time audit, ±20%), which nobody ran on a walked body.** Observed against the
  item's own tabled walk minutes: `stormhold-helstrom` 23.574 vs 24.3 (**−3.0%**),
  `helstrom-blackrose` 19.539 vs 20.7 (**−5.6%**), `blackrose-lilmoth` 12.284 vs 12.5 (**−1.7%**).
  All three pass, comfortably.

---

## A. "Zero teleports" — verified, and the fix is not where the round says it is

### A1. The exclusion works, and I watched it catch a real respawn

`--kill-at-m 400` kills the body mid-walk on purpose. This is rule 4: an exclusion branch nobody
has ever seen take is an untested branch.

The body died at **799 m**, at (2211.6, 1329.5), 197.4 m up on the Valus Ridge, and the province
respawned it at (2766.2, 5145.5) — a **3,856.1 m** discontinuity in one frame.

| counter | before the death | after |
|---|---|---|
| `walkRoute.path_m` | 799.0 m | **814.0 m** (+15 m of real walking), `teleports: 1`, `teleported_m: 3856.1` |
| critic's `walked_m` | 799.0 m | **814.0 m** |
| critic's `naive_sum_m` (the old accounting) | 799.0 m | **4,670.1 m** |

Two independent counters agree on 814 and both name 3,856.1 m as moved-not-walked. **The teleport
exclusion is real, it bites, and I have seen it bite.** F7 is upheld.

### A2. And here is why it matters more than the round says

**The hearth the province respawns you at is 116.7 m from the crossing's destination.** The walk
ends at (2765.6, 5028.8); death at 799 m of 6,646 m puts the body at (2766.2, 5145.5). Under the
old accounting a body that died on the ridge would have reported ~4,670 m of crossing walked *and*
been standing at the finish. This is not a rounding defect. It is the difference between a crossing
and a death.

### A3. **THE DEFECT: `walkPath` was never fixed, and the round says it was**

Finding F7 and survey §2c both state, in terms:

> *"`walkRoute` **and `walkPath`** now record those separately as `teleports` / `teleported_m` and
> **EXCLUDE** them from `path_m`."*

`game/src/engine.js` `walkPath()`, at HEAD, line 8334:

```js
      const step = Math.hypot(p.pos[0] - x0, p.pos[2] - z0);
      dist += step; frames++;
```

No threshold, no `jumps`, no `teleports` field anywhere in its return. **`walkPath` still adds a
respawn to `path_m` in a single frame, exactly as `walkRoute` used to.**

This is not cosmetic and it is not confined to this piece:

- `tools/world/w1-01-r4-soulrest-leg.mjs` — the drowning-leg instrument three agents are waiting on
  — drives `walkPath`. Its published 6,459 m / 6,268.7 m figures are *`walkPath` distances*, and
  the round's own headline is that such numbers may contain teleports.
- The verdict's own §D remedy tells W1-05 to re-run that tool. It would re-run it on the unfixed
  counter.
- The round's most-quoted sentence — *"every `path_m` this project published before may contain
  them"* — is now half-retired and reads as fully retired.

I did not edit `game/`. The fix is the six lines already written in `walkRoute` (`if (step > 1) {…}
else dist += step;` plus the three return fields), transplanted. **Until it lands, no `walkPath`
distance in this project is a walked distance**, and my own reverse and single-leg walks below
report the critic counter's `walked_m` alongside `walkPath`'s `path_m` for exactly that reason.

---

## B. The premise correction — adjudicated. Right on the substance, one support is a tautology

`tools/world/critic-crossing-grade.mjs`, offline, my own arithmetic, `--self-test` proven to bite
(bending one leg takes I1 from 24.27° to 89.17°).

### B1. The substance is upheld, three ways, none of them the builder's arithmetic

| claim | builder | **critic, independently** |
|---|---|---|
| worst longitudinal road gradient in the province | 24.27° (`stormhold-helstrom`) | **24.27°, same leg**, against a 40° limit |
| the stall was off a bridge, not on a slope | 4.98 m off, 15.3 m below the deck | **4.97 m off the centreline, 15.61 m below the deck**, inside the declared **471 m / 50.6 m viaduct**; `onDeckAt` false and `onRoadAt` false at the stall |
| the 57.5/61.09/64.6° readings are `slopeAt` straddling a slab | asserted | **reproduced**: `field.slopeAt(2153.7, 1197.8)` at the default ±5 m reads **61.10°**; at r = 2.5 m it reads **73.55°**; on the centreline 4.97 m away it reads 36.01°; on a leg with no structures at all it reads **1.09°** |

**Verdict: there is no 57.5° skirt. The body fell off a viaduct.** Two agents and one orchestrator
brief asserted a skirt; all three were wrong, and the builder is right to have made this the
headline. I reached it from a different direction and got the same answer.

### B2. But one of the three supports §P.4 cites cannot fail

§P.4 and the survey both offer, as a third leg of evidence, *"the slope gate refuses zero samples of
any centreline, before the fix as well as after."*

`sim/traversal.js` exempts a body from the slope gate when `onRoadAt(x, z)` is true. `onRoadAt`
returns true within `half_width × 1.15` of the centreline. **The centreline is where `onRoadAt` is
true by construction.** Measured over all ten legs at 1 m spacing:

```
centreline samples 25,390 — exempt from the slope gate 25,390 — 100.0000%
```

`climb_over_limit` on a centreline is **structurally zero for any road, any terrain, any commit**.
It is not a measurement of this province; it is a restatement of the exemption. Rule 4: *a probe
that cannot fail is worse than no probe.* This one has now shipped as evidence in a status file, a
survey, a verdict-facing brief and the §P gate paragraph.

**The replacement, which does bite.** Sweep the same gate laterally across the carriageway. Because
`climbDeg` itself calls `slopeAt(2.5)`, a critic reporting the raw sweep would make the builder's
own mistake in the other direction — so the right-hand column restricts to the four legs that
declare **zero** `deck_spans`, where there is no slab edge to straddle:

| lateral offset | gated samples (all legs) | refused >40° | worst | **structure-free legs: refused** | **worst** |
|---|---|---|---|---|---|
| 0–3 m | 0 | 0 | — | 0 | — |
| 3.45 m | 17,402 | 9 | 78.65° | **0 / 6,803** | 29.21° |
| **3.5 m** | 37,265 | 744 | 88.31° | **0 / 14,253** | **32.76°** |
| 4 m | 39,228 | 1,125 | 88.27° | **4 / 14,473** | 41.89° |
| 5 m | 49,394 | 1,320 | 88.22° | **41 / 19,712** | 54.75° |
| 6 m | 49,532 | 697 | 88.21° | 45 / 19,782 | 59.87° |

Read the right-hand column: **on ground with no structures anywhere near it, the gate refuses
nothing at all out to 3.5 m and starts refusing at 4 m.** The 88° figures in the left column are
the slab artefact again, and I am labelling them as such rather than publishing them. The province
is walkable where the walker walks; it becomes un-regainable a metre outside the shoulder, which is
exactly what `G3-REGAIN`'s 63 open places are.

### B3. The `--stair-grade` referral, with numbers, not a decision

Reproduced offline by running the generator, not by reading the sweep file:

| | deck span | tallest structure | trunk network | THE CROSSING | worst road gradient |
|---|---|---|---|---|---|
| `--stair-grade 0.45` (shipped) | 1,732 m | 50.6 m | 25,385.3 m | 6,903.6 m | **24.27°** |
| `--stair-grade 0.60` (swept) | **1,431 m** | **32.7 m** | 25,385.3 m | 6,903.6 m | **31.13°** |

The length cost is exactly zero — the horizontal route does not move. `atan(0.45) = 24.23°`,
`atan(0.60) = 30.96°`; the walkable limit is 40°.

**REFERRED, not decided.** The question is *is a 31° road a road* — a sustained one-in-six ramp,
steeper than any road surface currently in the province, in exchange for taking 301 m of viaduct and
17.9 m of fall height out of the world. That is a design call for RI-WLD01's owner. A verdict must
not make it and this one does not.

---

## C. Delete-the-fix, re-run with the arms in the other order

_(see §C table below — filled from `reports/critic-w1-crossing/deletefix.json`)_

---

## D. The regain count, and the leg three agents are waiting on

_(see §D below)_

---

## E. `C2-NULL-IS-SILENT` — replaced

_(see §E below)_

---

## F. The open counts, recomputed

Independently, from `roads.json` and `field.js`, with my own sampling code:

| | builder | **critic** |
|---|---|---|
| `G3-REGAIN` — places one metre off the shoulder facing >40° back to the road | 63 | **63** |
| `G4-NO-FALL` — places where the first step off the carriageway drops >0.6 m | 488 | **488** |

Both reproduce **exactly**, including the distribution (59 of the 63 on `stormhold-helstrom`).
`G5-PARAPET` (93 of 3,500) is a `clampToDeck` census and I did not rebuild it; it is the one open
count I am taking on the builder's word, and I say so.

**These three are honestly reported and correctly left open.** They are also the real residual
risk in §P.4: a player who is knocked a metre off the carriageway at one of 63 places on the
crossing's own first leg cannot walk back up, and at 488 places the first step off is a fall. The
crossing is walkable; its shoulder is not.

---

## G. CONSUMPTION and rule 8 — varying the fixture

_(see §G below)_

---

## H. Should §P.4 stand as MET?

_(see §H below)_
