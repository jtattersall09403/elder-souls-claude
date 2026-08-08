# W1-CROSSING — round 1 verdict

**Piece:** the crossing — `engine._pursue()` / `walkRoute` / `walkPath` steering, `field.clampToDeck`
parapet, the teleport exclusion in `path_m`, and the premise correction that replaced the "57.5°
skirt" with a 471 m viaduct.
**Critic:** `critic-w1-crossing`, fresh context. No part of W1-CROSSING, W1-ROAD-JOIN, W1-01-r4 or
W1-05 was written by me.
**Measured at:** `2fe47f5` (HEAD when the run began).

**Contention (rule 21, and rule 26's "say under what load"):** `node tools/contention.mjs --gate`
returned **exit 3 (WAIT)** at 05:44 and 05:46 — 4.23 and 4.85 per core against a 4.0 ceiling.
**I did not proceed.** I did the offline half of §B and §F until the gate returned **exit 0 (GO)**
at 05:49 at 1.92 per core, and started the crossing walk then; it was GO at every later check. One
browser at a time, chained, never concurrent. **No timing or performance figure appears anywhere in
this verdict**: every number here is a distance in metres, a frame count, an in-world minute
(frames ÷ 3600), an angle, a count or a boolean, and none of them moves with load.

**Status: FAIL. Score 6 / 10, min over axes, against a wave-1 gate of 7.0 — and the headline is
verified.** See the score table for what the two 6s are; they are short and closable, and everything
else in this piece is strong.

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

The brief's question was whether the 2×2 reproduces *because* both arms share state. The builder ran
`NEW/NEW` first and `OLD/OLD` last, in one page, after 180,000 frames of accumulated world clock. So
I ran the same grid **backwards** — `OLD/OLD` first — and re-seeded the world (`setSeed`,
`loadState`, `setTide`, `setTimeOfDay`) before every arm.
`node tools/world/critic-crossing-probe.mjs --deletefix`.

| steering | parapet | builder (order NN, NO, ON, OO) | **critic (order OO, ON, NO, NN, re-seeded)** | critic end |
|---|---|---|---|---|
| OLD | OLD | 550.1 m | **550.1 m** | **(2153.7, 1197.8)** |
| OLD | NEW | 390.1 m | **550.1 m** | (2153.7, 1197.8) |
| NEW | OLD | 1,333.0 m | **1,779.2 m** | (2568.6, 4735) |
| NEW | NEW | 1,327.3 m | **1,779.2 m** | (2568.6, 4735) |

### C1. The teardown is genuine and it is not an order effect — **upheld, and strengthened**

`OLD/OLD` ran **first, from a freshly seeded world**, and returned **550.1 m ending at
(2153.7, 1197.8)** — the published pre-fix distance and the published pre-fix coordinate, to the
metre and to the decimetre. A teardown that reproduces a published number from the *other* end of
the arm order, out of a clean world, is about as strong as this evidence gets. The builder's central
claim in §5 stands.

### C2. The steering is the fix — **upheld**

550.1 m against 1,779.2 m, 3.2×, with 45,117 off-road frames against 21,517 and 37 futile regains
against 0.

### C3. **Three of the builder's four cells do not reproduce, and the parapet arms are byte-identical**

In my grid the parapet changes **nothing at all**: `OLD/OLD` and `OLD/NEW` are the same 550.1 m,
same coordinate, same 45,117 off-road frames, same 37 regains; `NEW/OLD` and `NEW/NEW` are the same
1,779.2 m, same coordinate, same 21,517 frames. Four arms, **two** distinct results.

The builder's grid had four distinct results, and it used the 6 m gap between `NEW/NEW` (1,327.3)
and `NEW/OLD` (1,333.0) as the evidence that the parapet is not load-bearing. **That 6 m is state
noise, not a measurement** — re-seeded, the same two arms are bit-identical. The conclusion is right;
the number offered for it was not measuring what it was said to measure. The same applies to the
160 m between its `OLD/NEW` (390.1) and `OLD/OLD` (550.1), which collapses to zero here.

### C4. **And a defect inside the grid itself: its HP pin does not hold**

`crossing-deletefix.mjs` pins the body with

```js
E._afterStep = function () { orig(); const p = this.sim.player; if (p.hp < p.hpMax) p.hp = p.hpMax; };
```

— `sim.player.hp` only. `crossing-body.mjs`'s pin also writes `combat.player.hp`, and that is the one
that holds: my full crossing walk with the stronger pin recorded `hp_zero_frames: 0` and **0
teleports** over 199,432 frames. With the weaker pin the body still dies: **both `NEW` arms of both
grids carry a death and a ~3.4 km respawn**, which is why their `worst_off_path_m` reads 3,391.93 m
and why their `remaining_points` (315) is better than their walked distance can account for. The
builder footnotes this in its own table (*"died at 1,277 m"*) and then reads the arms as
commensurable anyway.

The headline conclusion survives — a stalled arm at 550 m against a walking arm is not a close call
— but **the grid's per-arm numbers should not be quoted**, and the pin should be the stronger one
before it is re-run.

---

## D. The regain count — I built it, and the answer is that it does not discriminate

### D1. The rebuild

The builder's `C5-REGAIN` returned 2/10 in both arms and it reported that as an **inert control**
rather than publishing the 2. That was the right call and its diagnosis was right too: after the
third shove the body was stuck, so shoves 4–10 re-shoved one stuck body.

`node tools/world/critic-crossing-probe.mjs --regain` fixes exactly that. **Twenty trials, each
independent by construction**: the anchors are spread over the whole 6,903.6 m by *arc length*, and
before every shove the body is teleported back onto the road, its HP re-pinned and the segment
cursor re-seeded at the shove point. A trial is scored on one question — did the projection distance
come back inside 3.5 m within 3,000 frames. Both arms run the identical twenty trials.

| | regained | median frames to regain | metres walked over the 20 trials |
|---|---|---|---|
| shipped steering | **15 of 20** | 649 f (10.8 s) | 1,095.7 m |
| pre-fix steering (control) | **16 of 20** | 786 f (13.1 s) | 868.8 m |

### D2. **The count is delivered. It is still not evidence for the fix — and now we know why**

`R2-CONTROL-BITES` **FAILS**: 15 against 16. My probe is an inert control too, for a different and
more interesting reason than the builder's. **Recovering from one 25 m shove is not the failure mode
the fix addresses.** From 25 m off the road, the old loop's next waypoint is roughly back toward the
road as well, so both steerings walk back. What the old loop cannot do is *keep* following a road
after it has been displaced repeatedly, or when something stands in the way — which is what the 2×2
and the completed crossing measure.

So the honest answer to *"build the regain measurement it could not"* is: **it can be built, it is
built, it returns 15 of 20 with a median recovery of 10.8 s, and it is not a discriminator.** The
acceptance line *"a body that leaves the road demonstrably regains it, with a count"* now has a
count. It should be recorded as a **property of the province**, not as evidence for the steering.

**Where the five failures are, which is the useful part:**

| trial | drop from the road | verdict |
|---|---|---|
| @523 m | **10.8 m** | shoved below the road |
| @875 m | **39.0 m** | shoved off the **471 m / 50.6 m viaduct** — a fall, not a steering failure |
| @2,253 m | **35.3 m** | shoved off the **257 m / 41.2 m viaduct** — same |
| @3,974 m | −0.2 m (flat) | **a genuine regain failure on level ground** |
| @5,389 m | 0.0 m (flat) | **a genuine regain failure on level ground** |

Three of five are bodies 35–39 m below a bridge, which no steering can fix and which is `G4-NO-FALL`
restated. **Two of twenty shoves on flat ground do not come back.** That is the number `G3-REGAIN`'s
63 static places predicts, arriving from a walked body.

### D3. **And the "drowning orbit on demand" figure does not reproduce**

The builder's most quotable secondary number is *"over the identical ten shoves the pre-fix body
walked 7,966.3 m to the fixed body's 788.0 m"*. Over twenty **independent** trials the pre-fix body
walks **868.8 m** to the fixed body's **1,095.7 m** — the fixed body walks *more*. The orbit is a
property of the **situation** (a body 39 m below a viaduct orbits under either steering: 370.4 m for
NEW at @875 m, 364.9 m for OLD) and not of the steering. **7,966.3 m should not be quoted**; it is
one stuck body re-shoved seven times.

### D4. **The leg W1-05 has been blocked on for four sessions — walked, both ways, and it is clear**

The round explicitly did **not** re-walk `soulrest-blackrose`. I did, as a body, in both directions.

| | path | arrived | worst off the road | frames off | deepest water | end offset |
|---|---|---|---|---|---|---|
| `soulrest → blackrose` | 1,765.6 m | **YES** | 1.31 m | **0** | **0.00 m** | 3.03 m |
| `blackrose → soulrest` | 1,765.7 m | **YES** | 1.37 m | **0** | **0.00 m** | 2.99 m |

Against the history: W1-05 had a body run **6,459 m of an 1,841 m leg** and finish in 18 m of sea;
W1-ROAD-JOIN §E found `blackrose → soulrest` **still failing at 6,268.7 m**, called it
direction-asymmetric, and assigned it to this piece. **Both directions now arrive, on the
carriageway, having never touched water.** The steering fix closes the drowning. W1-05's reachability
proof is unblocked on this leg, and my own independent counter (`walked_m` = `naive_sum_m`,
max step 0.173 m / 0.159 m) certifies that neither number contains a teleport — which matters,
because `walkPath` would not have told me (§A3).

---

## E. `C2-NULL-IS-SILENT` — verified broken, and replaced

**The builder's self-report is exactly right and I confirm it from the shipped artifact.**
`reports/w1-crossing/consumption.json`'s C2 bar is `max(0.5, noise_floor × 1.5)`; the noise floor it
read came from the `REPEAT` arm the builder had already invalidated (a body that died and respawned
3.5 km away, reading 4,128.93 m), so **the bar was 6,193 m** and 0.72 m cleared it by four orders of
magnitude. A green check with a bar wide enough to pass anything. It flagged this red in its own
survey rather than presenting it as a result, which is the behaviour the project wants.

**The replacement** (`--null`) measures the floor instead of inheriting it: the *same* walk run twice
with nothing changed at all, compared track-against-track at the same frame, then the null arm and
the positive arm against the same baseline.

| arm | worst divergence from the baseline track |
|---|---|
| **REPEAT** — the same walk, nothing changed | **0.000 m** |
| **NULL** — move `lilmoth-archon` 25 m, a leg the crossing does not use | **0.000 m** |
| P1 — move `stormhold-helstrom`, the leg it does use | **not re-taken — see below** |

**The floor is exactly zero, and that is the finding.** Re-seeded (`setSeed`, `loadState`,
`setTide`, `setTimeOfDay`) the walk is **bit-deterministic**: 14,000 frames, two runs, zero
divergence at every frame. So the correct bar for a null on this fixture is not `max(0.5, floor ×
1.5)` and it is certainly not 6,193 m — **it is 0.000 m**, and the null clears it exactly. That is a
far stronger `C2` than the one shipped, and it is available for free once the floor is measured
instead of inherited.

**What I have not re-taken, and I am saying so rather than filling the cell.** My first `P1` cut was
broken (below), and by the time I had fixed it my browser budget was spent on the reverse-jam arms.
So the **positive** arm of my replacement is not re-run here. It does not change the conclusion —
the road-is-read coupling is independently established by §C's grid, where replacing `_pursue`
alone moves the walk from 1,779.2 m to 550.1 m — but the replacement `C2` is only two-thirds
delivered and the third arm is a round-2 item.

**And my first cut of it failed, which is the point of running it.** I put the road bump at the
perturbed leg's **midpoint** — 1,450 m in — and then compared 14,000-frame walks, which cover 466 m.
The body never reached the bump, so `P1` read **0.000 m** and `N2-POSITIVE-BITES` went red. A probe
whose positive arm has never been seen to move is not a probe; the bump now sits at 12% of the leg,
inside the walked window, and the failure is recorded in the tool's own comment rather than quietly
fixed.

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

## G. Rule 8 — I varied the fixture, and it broke

**The published crossing is the easiest fixture in the project: one fixed route, walked forwards,
at noon, unencumbered, once.** Rule 8 says a still target hides every steering defect. So I moved it.

### G1. **THE CROSSING DOES NOT WALK BACKWARDS**

`--route crossing --reverse` — the same 541 points, same speed, same HP pin, walked Lilmoth →
Stormhold.

| | forwards | **backwards** |
|---|---|---|
| result | **arrived** | **STUCK** |
| distance walked | 6,646.7 m | 5,072.3 m of 6,903.6 m |
| frames | 199,433 | 153,121 |
| ends | (2765.6, 5028.8) — Lilmoth | **(2278.6, 1859.2)** — 1,103.5 m short |
| worst deviation from the road | 1.39 m | **1.35 m** — it was *on* the road when it jammed |
| stuck frames | — | **900 consecutive frames under 1 cm** |
| teleports (critic's own counter) | 0 | 0 |

The body is not lost, not drowned, not off-path and not dead. It is standing 0.62 m from the
centreline, 1,633 m along `stormhold-helstrom`, and it cannot move.

### G2. The cause, and it is a world defect nobody has reported: **the road bridges over itself**

`stormhold-helstrom` switchbacks. Its **point 126** — exactly where the body jams — and its **point
131** are **5.74 m apart horizontally and 7.51 m apart vertically**, and points 129–131 are a
declared 17 m viaduct standing 8 m up. A span's deck slab is `half_width + 0.5 = 3.5 m` wide, so
**the upper limb's deck is laid across the lower limb's carriageway.**

Sampling the centreline through the gap between the declared spans at 1,602 m and 1,664 m:

| m along the leg | `onDeckAt` | ground `heightAt` | bare ground |
|---|---|---|---|
| 1,625 | no | 85.50 | 86.85 |
| 1,630 | no | 85.45 | 85.27 |
| **1,635** | **YES — viaduct, deck_y 91.20, clearance 7.42 m** | **91.20** | 83.78 |
| 1,640 | no | 83.72 | 83.08 |

**A 5.75 m step up and a 7.5 m step down, on the carriageway, over ten metres, inside a declared
span gap.** `step_up_m` is 0.55 and the slope gate refuses above 40°. Walking north the steering
happens to cut the hairpin and miss it; walking south the body walks into it and stops.

This is *not* the defect the round fixed and I am not scoring it against the steering. It is a
`build-roads.mjs` / `field.setRoads` defect — a deck slab applied by proximity with no check that the
segment it is shadowing belongs to a different limb of the same road — and it sits **1.6 km into the
crossing's first leg**.

**The parapet is not the cause, and I proved that rather than assuming it.** `--clamp old` puts the
pre-fix `clampToDeck` from `345dcca` back (install verified: `clamp_is: "OLD"`, 17 spans still
declared) and walks the reverse route again:

| reverse arm | walked | ends | stuck frames |
|---|---|---|---|
| shipped | 5,072.3 m | (2278.6, 1859.2) | 900 |
| **pre-fix `clampToDeck`** | **5,072.3 m** | **(2278.6, 1859.2)** | **900** |

Byte-identical. The blocker is `heightAt`/`onDeckAt` resolving the wrong limb's slab, which the
parapet never touches — a **third** independent confirmation that the parapet fix is not
load-bearing for this route (§C3 is the other two).

### G3. What else I varied

| variation | result |
|---|---|
| `soulrest-blackrose`, forwards | **arrived**, 1,765.6 m, worst off 1.31 m, 0 frames off, deepest water 0.00 m |
| `soulrest-blackrose`, backwards | **arrived**, 1,765.7 m, worst off 1.37 m, 0 frames off, deepest water 0.00 m |
| the crossing at the **jog** (RI-WLD01 M2 step 4, never run by anybody) | **arrived** — see §G4 |
| the crossing at **02:00 in a storm, OVERLADEN** | **arrived** — 71.591 min at 1.5473 m/s — see §G5 |

### G4. The jog — a mandatory RI-WLD01 bar nobody had ever run

RI-WLD01 M2 **step 4** reads, in full: *"Repeat at 3.2 m/s jog. **Pass: 33–41 min.**"* It is not in
the builder's evidence, not in the status file, and not in §P.4. It is part of the method §P.4
claims to have satisfied.

`--speed jog`: **arrived**, 6,645.9 m, 124,639 frames, **34.622 in-world minutes**, mean **3.2000
m/s**, 0.019% of samples under 1.6 m/s, worst deviation 1.38 m, **0 frames off the road, 0
teleports**, ending at (2765.7, 5028.8).

**PASS — 34.622 against a 33–41 min bar**, and −3.7% against RI-WLD01's own declared 35.96 jog
minutes. The distance agrees with the walk to 0.8 m over 6.6 km, which is a useful cross-check in
itself: the same body, at 1.6× the speed, traces the same road.

---

### G5. Night, storm and a full load — and an unplanned CONSUMPTION result

`--time 2 --weather storm --burden 0.9`. The body reports `tier: OVERLADEN`,
`move_mult_applied: 0.72`, `burden_source: "pinned by setBurden()"`.

**It arrived.** 6,646.1 m — 0.6 m from the unladen walk over 6.6 km — in **257,726 frames** and
**71.591 in-world minutes**, at a mean of **1.5473 m/s against 1.9991 unencumbered**, worst deviation
from the road **1.39 m**, **zero frames off the road, zero teleports**, ending at exactly
(2765.6, 5028.8).

Two things follow.

1. **The route survives the variation.** Different clock, different weather, 23% off the walk speed,
   and the body traces the same road to within 0.6 m over 6.6 km with zero frames off it. The
   steering is not tuned to one speed. Note also that RI-WLD01's *fail* condition is ">75 min — the
   hour is being manufactured by friction, not distance": **an overladen traveller in a storm at
   two in the morning still crosses in 71.6 minutes.** The hour has headroom.
2. **`NEXT-DISPATCH` §Q1 says `setBurden()` "has been inert on any stepping run".** On this stepping
   run it is not: the load is applied, held across 20,001 fixed steps, and visible in the walked
   speed. Whoever owns Q1 should re-check it — I am recording the observation, not adjudicating it,
   because it is not my piece.

---

## G6. CONSUMPTION (RI-MTH07) — my own perturbations

Two models ship here and I perturbed both, on top of the builder's own arms.

| model | consumer | my perturbation | result |
|---|---|---|---|
| the road centreline (`roads.json legs[].points`) | the player capsule via `engine._pursue()` | a 25 m raised-cosine bump on the leg the crossing uses, vs. the same bump on a leg it does not, vs. nothing changed — all compared **track against track at the same frame** | §E |
| the structures (`legs[].deck_spans`, `spanFirst`/`spanLast`) | `field.clampToDeck()` / `onDeckAt()` / `heightAt()` on the capsule | **every `deck_span` in the network deleted**, then the same walk | §G7 |
| the burden model (`RI-PRG07` §3) | `engine._burdenMult()` → `traversal.step()` | `setBurden(0.9)` over a **257,726-frame** completed crossing | **1.9991 → 1.5473 m/s, and 55.398 → 71.591 min. The model is read.** |

### G7. The deck arms on the reverse jam

| arm | install verified | walked | ends | stuck frames |
|---|---|---|---|---|
| shipped | — | 5,072.3 m | (2278.6, 1859.2) | 900 |
| **`--clamp old`** (pre-fix `clampToDeck` from `345dcca`) | `clamp_is: "OLD"`, 17 spans still declared | **5,072.3 m** | **(2278.6, 1859.2)** | **900** |
| `--no-deck` (every `deck_span` deleted, `spans_removed: 17`, `spans_left: 0`) | verified installed | **did not finish inside my budget** | — | — |

**The parapet is exonerated as the cause** — byte-identical arms — which is what I set out to test
and is a third independent confirmation that `clampToDeck` is not load-bearing for this route. The
`--no-deck` arm was still walking when my browser budget ran out; **I am reporting that rather than
filling the cell**, because a body with every bridge in the province deleted is walking over open
ravines and its run time is not comparable. The jam's mechanism is already established by direct
measurement of the field (§G2) and by the parapet arm being inert; the `--no-deck` arm would have
been confirmation, not the evidence.

---

## H. Should §P.4 stand as MET?

**Yes — the crossing claim is true and I have now independently walked it. But the paragraph as
written overstates it in two ways and omits a third thing the owner will meet.**

### H1. What is established, by a critic who did not build it

A body walks Stormhold → Lilmoth: **6,646.7 m, 199,433 frames, 55.398 in-world minutes**, settlement
collision ON, mean 1.9991 m/s, 0.063% of 33,238 samples under 1.6 m/s, worst deviation 1.39 m of a
6 m carriageway, **zero frames off the road and zero teleports** — with the zero verified against an
*unbounded* counter that would have caught a jump, and against a forced respawn that it did catch.
RI-WLD01 M2 (52–65 min, 6,300–7,600 m), M3 (≤8%, 2.0 ± 0.05) and M4 (±20% per leg) all pass.
**The hour comes from distance.** That is the whole of §P.4's ask and it is met.

### H2. Two amendments the paragraph needs before the owner reads it

1. **`hp_pinned: true` is missing from §P.4.** The body that walked it was immortal. That is a
   *legitimate* measurement condition — RI-WLD01 M2 step 1 says "combat disabled", the artifact
   declares `hp_pinned: true`, the builder devotes a whole survey section to it, and §P.4 asks
   whether the ground is there, not whether you survive it. **But the paragraph does not say so**,
   and it is the one document the orchestrator acts on and the owner reads. Unpinned, the body dies
   at **1,276.8 m** to regional hazards. The paragraph should carry the condition.
2. **It is forwards-only.** Backwards the same route jams at 5,072.3 m (§G1). "You can walk between
   regions" reads as a symmetric claim and it is not one yet.

### H3. And one thing to add

**Death completes the crossing.** The hearth the province respawns you at is **116.7 m from the
crossing's destination** (§A2). Any measurement of this route that does not exclude teleports will
report an arrival for a body that died on the first leg. The exclusion is in `walkRoute`; it is
**not** in `walkPath` (§A3), and `walkPath` is the verb the reachability and drowning instruments
use. That should be closed before any further reachability number is published.

### H4. My recommendation to the orchestrator, in one line

**Leave §P.4 marked MET, amend its paragraph per H2/H3, and do not gate the README on the reverse
jam — but dispatch the reverse jam, because it is 1.6 km into the first leg of the canonical route
and a player walking home from Lilmoth will meet it.**

---

## Arbitration

- **AR-1 (Souls leakage into the world):** pass, not applicable — no combat mechanic is touched.
  The HP pin is an instrument, declared, and confined to probe tooling.
- **AR-2 (Morrowind leakage into the fight):** pass, not applicable.
- **AR-3 (seam sterility):** `seam_sterile: true`, and legitimately. Locomotion steering over a road
  network creates no interaction crossing the Souls/Morrowind seam. Recorded per §3, not penalised.
- **CONSUMPTION (`RI-MTH07`):** **pass**, on the road model and the structure model, with the null
  bar replaced (§E) and a fresh positive arm of my own (§G5). The builder's own C2 as shipped is
  **not** believable as printed and it says so itself.

---

## Score

**6 / 10, min over axes. FAIL against the wave-1 gate of 7.0 — and the headline is sound.**

| axis | score | why |
|---|---|---|
| the crossing, walked (acceptance 3) | **9** | reproduced independently to the decimal, two counters, M2/M3/M4 all pass |
| honesty and self-report (rule 26) | **9** | four self-reported instrument flaws, two checks red-flagged rather than published, `hp_pinned` declared in the artifact |
| open gaps (G3/G4/G5, stair-grade) | **9** | G3 = 63 and G4 = 488 reproduce exactly; the stair-grade sweep reproduces by re-running the generator; correctly referred, not decided |
| premise correction (acceptance 1) | **7** | right on substance from an independent direction — but one of the three supports §P.4 cites is a counter that is structurally zero |
| delete-the-fix (acceptance 5) | **7** | the teardown reproduces 550.1 m at (2153.7, 1197.8) running *first* from a re-seeded world; three of four cells do not reproduce and the grid's HP pin does not hold |
| regain (acceptance 2) | **7** | correctly declared NOT MET; I built the 20-independent-trial version and it is *still* an inert control — 15/20 against 16/20 — and the 7,966.3 m orbit figure does not reproduce |
| CONSUMPTION (acceptance 4) | **7** | both models genuinely consumed; the shipped C2 bar is broken and the builder says so; replaced here |
| **instrument claims match the code** | **6** | F7/§2c state `walkPath` excludes teleports. **It does not.** The verb carrying the drowning and reachability evidence still adds a respawn to `path_m` |
| **robustness (rule 8)** | **6** | the route was tested in one direction, at one time of day, once. Reversed, it jams at 5,072.3 m on a bridge deck laid across the carriageway |

**This is a FAIL on two specific, short, closable items, not on the engineering.** The crossing is
real, the fix is real, the premise correction is right, and the four-session drowning blocker is
closed. Round 2 is four things:

1. **Port the six-line teleport exclusion from `walkRoute` into `walkPath`**, and correct F7/§2c.
2. **Adjudicate the reverse jam** — `stormhold-helstrom` points 126/131, a 17 m viaduct deck laid
   5.74 m across and 7.51 m above the lower limb of its own switchback.
3. **Replace the vacuous centreline slope-gate counter** (it is 100% exempt by construction) with
   the lateral sweep, and correct the §P.4 paragraph that cites it.
4. **Strengthen `crossing-deletefix.mjs`'s HP pin** to the one `crossing-body.mjs` uses, and re-run
   the grid re-seeded; do not quote its per-arm numbers until then.

## The biggest gap

**`walkPath` still counts teleports as walked distance, and the round says it does not.** Everything
else here is a number that can be re-taken. This one is a false statement about shipped code, in the
piece's own headline finding, about the exact defect the round is famous for, in the verb that
`tools/world/w1-01-r4-soulrest-leg.mjs` uses — the tool this verdict's own §D tells W1-05 to run
next.

## What I could not do

- I did not rebuild **`G5-PARAPET`**'s 93-of-3,500 census; it is the one open count I take on the
  builder's word.
- I did not re-measure the **133.8 ms worst frame**. No timing or performance figure appears
  anywhere in this verdict, deliberately (rule 26).
- I did not run **`tools/run-all.mjs`** (rule 9's aggregation). I ran `boot-check`, `check-data` and
  `road-through-building` — all green, the join is **0 of 10 at HEAD**, so H4's staleness trap has
  not re-sprung.
- I did not judge a blind pack, because this piece ships none (rule 25 not engaged).
