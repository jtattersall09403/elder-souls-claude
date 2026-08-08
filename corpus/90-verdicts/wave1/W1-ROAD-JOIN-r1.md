# W1-ROAD-JOIN — round 1 verdict

**Piece:** the road/settlement join — `tools/world/build-roads.mjs` reads `planSettlement()` and
re-cuts the trunk road around the buildings it finds.
**Critic:** `critic-road-join`, fresh context, no part of W1-ROAD-JOIN, W1-01-r4 or W1-04 written by me.
**Measured at:** `a2031bb` (HEAD when the run began); `game/src/world/field.js` carried an uncommitted
in-flight change from the sibling piece `W1-CROSSING` for the whole run — declared in full below.
**Status: FAIL. Score 5 / 10, min over axes, against a wave-1 gate of 7.0.**

---

## The headline, and it is not the one the builder published

**The join is stale on the shipped tree, and the tree is red right now.**

`orchestration/status/W1-ROAD-JOIN.json` acceptance 1 reads *"PASS — 0 of 10 legs blocked, 0
named-route offences"*. That was **true when it was taken** and it is **false at HEAD**:

| | legs blocked | named-route offences |
|---|---|---|
| builder's `after.json`, 03:36:01Z | 0 of 10 | 0 |
| **`node tools/world/road-through-building.mjs` at HEAD, now** | **3 of 10** | **5** |
| **the running engine's own predicate at HEAD** (`critic-road-join-ingame.mjs`) | **3 of 10, 13 samples** | crossing 11, long_way 10 |

`THE CROSSING` is offended at **5,610 m**, inside `blackrose-house-0`. Five buildings are on the
trunk road: `blackrose-house-0`, `blackrose-house-1`, `blackrose-rootpost`,
`blackrose-condemned-row`, `blackrose-old-gallows`.

### The cause is not a data edit. It is `planSettlement()` itself.

`tools/world/critic-road-join-stale.mjs` holds `game/data/world/roads.json` **fixed** and swaps
`planSettlement` for one revision after another. Nothing under `game/data/world/settlements/` or
`game/data/world/interiors/` has changed since the join was cut.

| `exterior.js` revision | committed | check view (`{}` interiors) | game view (115 interiors) | total exterior area |
|---|---|---|---|---|
| `322f708` — the join was cut here | 03:15:32Z | 0 of 10 | 0 of 10 | 18,989 m² |
| `345dcca` | 03:35:58Z | 0 of 10 | 0 of 10 | 18,989 m² |
| **`0dc0703`** | **03:39:45Z** | **3 of 10** | **3 of 10** | **20,835 m²** |
| `HEAD a2031bb` | 03:42:17Z | 3 of 10 | 3 of 10 | 20,835 m² |

W1-04 round 4's per-axis shrink (`MIN_ENTERABLE_SPAN_M = 6.0`, one axis rather than two) grew **54
of 202 exteriors and shrank none** — `blackrose-inn` went from a 3.4 × 3.9 m shed to a 13.6 × 6.0 m
terrace, and five of its neighbours with it. Every one of those walls moved without a byte of
settlement data changing.

**The builder saw this door and described the wrong side of it.** Handoff `H4` says the join can go
stale *"if anyone edits `game/data/world/settlements/*.json` or an interior's
`continuity.exterior_footprint_m`"*. The footprints are not data. They are the **output of a
generator**, and the generator moved **twenty-four minutes** after the join was cut. `H4` then
declines to add `road-through-building.mjs` to the gate list — *"that table is generated and the
gate set is not mine to change"* — and that decision is the direct and only reason the tree is red
now. The check is offline, takes under a second, and nothing runs it.

### The remedy is one command, and I have run it

`R-REMEDY` in `reports/critic-road-join/consume.json`: on a scratch copy of the tree exactly as it
stands, `node tools/world/build-roads.mjs` returns the province to **0 of 10 legs blocked, 0
samples**, by both views. The join **mechanism** is sound. What is broken is that nothing re-runs it
and nothing notices.

---

## The attack, item by item

### A. The instrument problem the builder found in its predecessor — checked in its own work

The builder's finding `F1` is that `road-through-building.mjs` calls `planSettlement(doc, {})` while
the game calls `setSettlements(docs, this.data.interiors)` with all 115, and that the builder
therefore cleared the **union** of both footprints. The brief's objection is exact: a union computed
by a **second call to the same generator** is one half checking the other half.

So I did not ask the generator. `tools/world/critic-road-join-ingame.mjs` boots the game, reads
`renderer.province.settlementPlans` **off the running engine** — the plans `Engine._boot()` built
from `this.data.interiors` — reads `engine.data.roads`, samples every leg and both named routes at
1 m, and asks **`province.buildingAt()`**, the engine's own predicate. It then does the harder
version the offline check never attempts: signed clearance from every road sample to the **actual
`settlementSolids()` wall slabs**, the boxes `CollisionCell` is built from, against
`PLAYER_RADIUS_M = 0.32 m`.

**Verdict on the union claim: SOUND, and I can date it.** At `322f708`, where the join was cut, the
check view and the game view **both** read 0 of 10. The union was not a smaller set measured against
itself; it genuinely covered the game. The builder's number was honest.

**Verdict on the instrument: the under-report is real and now measurable.** At HEAD:

- offline check: **7 blocked samples, 4 buildings**
- the game: **13 blocked samples, 5 buildings** — `blackrose-house-1` is **invisible** to the check
- collision reality: **16 samples with less than a body radius to a wall slab**, worst **−0.132 m**
  (the centreline is *inside* a wall face), on 3 legs

The check under-reports the running world by roughly half its samples and can miss a whole building.
`H2` is upheld and is worse than stated.

### B. `road-through-building.mjs --self-test` fails by construction — adjudicated

It does fail: **exit 1**, arm A *"not flagged (PROBE IS BLIND)"*. Its subject is
`stormhold-scribe` across `stormhold-helstrom`, which **was** the shipped defect; on a fixed tree
arm A is clean and flag/clear/identical cannot pass. Its own error message anticipates this.

**Adjudication: a self-test that cannot pass on a fixed tree is a broken instrument, and "I did not
own the file" is a reason to report it, not a reason to leave it broken.** The builder reported it
(`H3`) and pointed at its consumption probe as the retargeted equivalent. That is a *reasonable*
substitute and it is not the same thing: `road-join-consumption.mjs` demonstrates that the **join**
is coupled; it does not demonstrate that the **acceptance instrument** can still see. Those are two
different questions and the tree currently has an answer to neither.

**What should replace it, concretely.** Not a different building — any hard-coded subject rots the
same way. The self-test must **find its own subject at run time**, from the tree, and it must
perturb the world the way the game does. `tools/world/critic-road-join-ingame.mjs --self-test` is a
working example and it passes on a fixed tree:

1. read the plans off the running engine;
2. search all 202 buildings × every leg point for the closest (building, road point) pair;
3. teleport that building onto that point by `offset_m`, **through `province.setSettlements()`** —
   the same call `_boot()` makes — and require the count to rise;
4. restore and require it to return to baseline exactly.

Arm A is then whatever the tree makes it, and the probe cannot go stale. Four lines of the existing
`--self-test` need replacing, in a file that already imports everything required.

### C. Perturbations the system is entitled to reverse

The builder's `P3-GROW` did not bite until it was rewritten, because `planSettlement`'s shrink pass
**legally undid the edit** — a real and well-reported catch. I swept the remaining arms for the same
shape and added an arm designed to have it.

- **`P1-MOVE`, `P2-ADD`** — empirically not reversed: both go red in the BITES arm, so neither is
  vacuous. But the probe only *asserts* survival for `P3`; for `P1`/`P2` it computes
  `effectiveFootprint` and merely logs it. That is one `ck()` away from being airtight and should
  be closed.
- **`NULL`** — proven to bite, and this is the strongest thing in the builder's method. It failed
  first time (a town-scoped zone moved the road 236 m for a perturbation that should have moved it
  none) and forced a redesign of the join from town scope to `INFLUENCE_M = 55 m` road proximity.
  A control that has been seen to fail is evidence; this one has.
- **`NULL-REVERSED` (mine)** — I grew `blackrose-prison`'s declared footprint ×6 to see the shrink
  pass take it back. **It did not**: 13.6 × 15.6 → 21.5 × 33.44 m survives. The per-axis shrink at
  HEAD is materially more permissive than the uniform one the builder measured against, which is
  the same fact that made the join go stale, arriving from a second direction.

### D. The acceptance the builder declares NOT MET, and its argument for it

**The conclusion is right. The argument does not support it, and the stated cause is wrong.**

The builder argues the Valus Ridge stall predates the join from a **centreline slope histogram** —
84 samples over 40° in 79 runs before, 86 in 78 after, *"over the same metres"*. That cannot settle
it: the body stalled **4.98 m off the deck**, on the skirt, and a centreline histogram is blind to
the skirt by construction. *"The same metres"* is also not true — `tools/world/critic-road-join-ridge.mjs`
finds **63.7% of `stormhold-helstrom` moved more than 1 m** (worst 17.91 m), and **95% of
`helstrom-blackrose`** (worst 67.43 m).

The measurement that does settle it is the lateral displacement at the stall itself:

- the joined road passes **4.99 m** from (2153.7, 1197.8); the pre-join road passes **4.88 m**
- **the two roads are 0.21 m apart there**, and the worst displacement anywhere in the 120 m window
  around it is **2.03 m**

**The join did not move the road onto that ground.** Conclusion upheld, by a measurement two orders
of magnitude sharper than the one offered.

**The stated cause is an artefact.** On the bare `WorldField`, with no road corridor attached, the
natural ground at the stall reads **26.57°**, not 57.5° or 61.09°. The 61.09° figure is
`field.slopeAt()` sampling across a slab edge. The sibling piece `W1-CROSSING` reached the same
place independently and further: 918 m of `stormhold-helstrom` is **bridge**, including a 471 m
viaduct standing 50.6 m above the ridge, and the body at the stall was **15.3 m below the road**.
It had not met a slope. It had fallen off a viaduct. Handoff `H1` therefore sends the next builder
after a skirt that is not there. `W1-CROSSING` owns this and I did not touch it.

**One regression the builder did not report, and S28(c) required it to look.** S28 binds a re-cut to
re-verification against *"the full water census, the slope histogram and reachability, not merely
re-timed"*. The builder re-timed. I ran the rest:

- water census (`road-water-audit.mjs`): **0 leg/phase offences** over 4 phases × 10 legs — PASS
- reachability (`scale-audit.mjs` S9-NO-FENCES): **13/13 regions, 8/8 settlements** — PASS
- M36-ROAD-RELIEF **31.8%**, M4 worst leg **2.26%**, crossing **57.59 min** — all PASS

So S28(a) and (b) hold and (c) holds **in fact**. But the slope histogram the ruling asks for shows
two things nobody recorded:

- `blackrose-lilmoth`'s centreline went from **0 m over the 40° walkable limit to 1 m** (39.66° →
  40.41°). The join put a metre of trunk road over the limit.
- `helstrom-blackrose`'s worst skirt at ±5.6 m went **30.27° → 39.72°**, and its centreline
  **29.04° → 37.22°** — a 8–9° steepening that lands 0.28° under the bar.

Neither is fatal. Both are exactly what S28(c) exists to surface, and the piece surfaced neither.

### E. The soulrest finding — the one three agents are waiting on

**The conclusion is right. The evidence offered for it was a control with nothing to remove, and I
have replaced it with one that bites.**

The builder reports `walls_change_the_answer: false` from four arms that came back **pairwise
byte-identical** — A = B at 6,459.8 m, C = D at 6,269 m. Four identical arms is the signature this
project has been burned by before: `RULES.md` rule 6 exists because W1-04's wall-collision control
produced fifteen byte-identical walks and read as a clean negative result. And the builder's own
tree explains why it looks like that here — **at `322f708` the join had removed every building from
`soulrest-blackrose`** (0 of 10 legs, verified in `reports/critic-road-join/stale.json`), so
`__w1_04_townSolids(false)` was switching off walls the road had already been cut away from.

So I re-ran the same tool, unmodified, at HEAD — where the join is stale and **`blackrose-rootpost`
is back on that very leg**:

| arm | | path of an 1,841 m leg | stopped | arrived | drowned |
|---|---|---|---|---|---|
| A | walls **on**, soulrest → blackrose | **3,473.3 m** | (1909.9, 4451) | **YES** | no |
| B | walls **off**, soulrest → blackrose | **3,469.8 m** | (1909.0, 4452.8) | **YES** | no |
| C | walls **on**, blackrose → soulrest | 6,268.7 m | (2198.1, 4952.2) | no | no |
| D | walls **off**, blackrose → soulrest | 6,268.7 m | (2198.1, 4952.2) | no | no |

**A and B now differ** — 3.5 m of path and 2.0 m of final position. The control bites, weakly and
genuinely, and **the answer is still that the walls do not change it**. `any_arm_drowned: false`.

**W1-05 can stop testing the walls, on this evidence rather than on the builder's.** That is the
distinction that matters, and it is the difference between three more agents chasing the right thing
and three more agents trusting a control that had nothing to switch off.

**Two things nobody has recorded yet, and one of them is not this piece's credit.**

- **Arm A now arrives.** The builder's run had A and B both at 6,459.8 m and neither arriving; mine
  reach Blackrose in 3,473 m at 27 HP. The drowning is gone. **This is almost certainly not the
  join.** `game/src/world/field.js` carried `W1-CROSSING`'s uncommitted deck end-cap fix in the
  working tree when I ran, and that piece also has pure-pursuit steering in flight. I am reporting
  the improvement and explicitly **not** claiming it.
- **`blackrose → soulrest` still fails**, identically with walls in and out: 6,268.7 m of an 1,841 m
  leg, at 384 HP, stopped at (2198.1, 4952.2). The body is healthy and lost. That is a steering
  defect, it is direction-asymmetric, and it is `W1-CROSSING`'s.

**One more instrument defect, small and worth fixing while someone is in the file.**
`w1-01-r4-soulrest-leg.mjs` writes `buildings_on_this_leg: ['soulrest-grey-hist', 'blackrose-pawn',
'blackrose-rootpost']` as a **hard-coded constant**. It is not measured. The report asserts three
buildings on the leg whatever is actually there — including on the tree where the answer was zero,
which is the run the `walls_change_the_answer` finding came from.

### F. Walking the crossing end to end

**I did not, and I am saying so rather than grading a number I did not take.**

Three reasons, all real:

1. `node tools/contention.mjs --gate` returned exit 3 for the second half of my run, and I had
   already spent my one over-ceiling browser on the four soulrest arms.
2. `W1-CROSSING` is driving exactly that walk **right now**, with a steering fix and an uncommitted
   change to `game/src/world/field.js`'s deck path sitting in the working tree. A walk taken by me
   would have measured a tree in flux and collided with a live piece the brief told me not to
   collide with.
3. It cannot complete on this artefact anyway. The body is pinned at 550 m of 6,911 m, and if it
   were freed **there is a second wall waiting at 5,610 m** inside `blackrose-house-0`.

What I took instead is the strongest static substitute available, and it is **not** a path solver:
the running engine's own `province.buildingAt()` over the engine's own plans, plus signed clearance
to the actual `settlementSolids()` collision boxes at the body's real 0.32 m radius. That answers
what a walk would have **hit**. It does not answer whether the walker can **get there**, and I am
not claiming it does.

**Nobody has still walked THE CROSSING end to end, and no figure in this verdict should be read as
if somebody had.**

### G. Consumption, with my perturbations

`tools/world/critic-road-join-consume.mjs`, six arms, all on scratch copies; nothing under `game/`
in the real tree was written.

| arm | result |
|---|---|
| `SHIPPED` | 2 of 10 legs, 11 samples — **the artefact under test is red** |
| `R-REMEDY` rebuild at HEAD | **0 of 10, 0 samples** — the mechanism works |
| `R-DETERM` build twice | **byte-identical** — "the road moved" is a measurement of something |
| `TEARDOWN` `--no-join` | **10 of 10, 267 samples**, distinct hash — **I watched my own control go red** |
| `P-BLACKROSE` move `blackrose-east-block` 13.6 m onto `blackrose-lilmoth` | BITES 19 samples (from 11), FOLLOWS 0, **road moved 5.5 m** |
| `NULL-NOREAD` rename every Blackrose building | **byte-identical `roads.json`** |

Two deliberate strengthenings over the builder's probe. `P-BLACKROSE` perturbs a town **other than
Stormhold** — every one of the builder's four arms is in Stormhold, and Blackrose is the town the
join actually fails in. And `NULL-NOREAD` edits a field `planSettlement` does not read and demands
a **byte-identical** file, rather than "moved less than 2 m": a null that has to not move at all is
a stronger control than one that has to move a little.

`BITES` is scored on **samples, not legs**, because the shipped tree is already red in Blackrose and
a leg count cannot see a perturbation getting worse. That is a trap the builder's own probe would
fall into if it were re-run today, and it should be fixed there too.

**CONSUMPTION verdict: PASS.** The world-side consumer is
`render/exterior.js planSettlement()` → `world/province.js settlementSolidsNear()` →
`engine._settleSettlementSolids()` `CollisionCell` → `sim/world-collision.js` capsule push-out, and
the road demonstrably reads the same function. The coupling is **build-time**, which is legitimate
and is the whole reason it can go stale — the road carries the answer, not the code.

---

## Arbitration

- **AR-1 (Souls leakage into the world):** pass, not applicable — no combat mechanic is touched.
- **AR-2 (Morrowind leakage into the fight):** pass, not applicable.
- **AR-3 (seam sterility):** **`seam_sterile: true`, and legitimately.** This is a build-time
  geometry join between two world generators. It creates no interaction that crosses the
  Souls/Morrowind seam. Recorded per §3 rather than penalised; `RI-CMP01`'s project floor governs.
- **CONSUMPTION (`RI-MTH07`):** **pass** — see G.

---

## Score

| axis | score | why |
|---|---|---|
| `RI-WLD01` §4/§5 — the road network as shipped | **5** | M1–M5 all pass and the crossing is 57.59 min, but the artefact runs through five buildings on three legs and `THE CROSSING` is offended at 5,610 m. The defect the piece exists to remove is present at HEAD. |
| `ARBITRATION` S28 compliance | **7** | (a) 57.59 min inside 52–65 and (b) worst leg 2.26% inside 5% both hold. (c) holds in fact but was never run by the piece, and the slope histogram it mandates hides an unreported 39.66° → 40.41° regression. |
| Instrument integrity | **5** | The acceptance number rests on a check that sees roughly half the game's blocked samples, and on a `--self-test` that is broken and was left broken. The union claim means the blindness did not produce a false green *at the time* — that is the only reason this is not lower. |
| CONSUMPTION `RI-MTH07` | **9** | Six independent arms, a byte-identical null, a teardown seen to go red, and coupling demonstrated in a second town. |

**min over axes = 5.** Below the wave-1 gate of 7.0. **FAIL.**

This is a fail on the **state of the artefact**, not on the quality of the engineering. The join is
well-argued, correctly sided on S28, honest about what it could not do, and its two self-caught
control defects (the town-scoped null, the reversible grow) are better method than most pieces
here produce. It is failed because the road it built has houses on it today and nothing on the
tree will ever say so.

---

## The single biggest remaining gap

**`GAP-W1-road-join-has-no-gate`.** A build-time join with no gate is a fix with a half-life. This
one's half-life was **twenty-four minutes**.

**Remedy, concretely and cheaply:**

1. `node tools/world/build-roads.mjs` — restores 0 of 10 today. Verified on a scratch copy
   (`R-REMEDY`).
2. Add `node tools/world/road-through-building.mjs` to the gate set. It is offline, sub-second, and
   already exits non-zero on failure. `INDEX.md`'s table being generated is not a reason not to —
   change the generator's source list.
3. Make the gate ask the **game's** question, not the check's: `planSettlement(doc, interiors)`, or
   the union of both. At HEAD the difference is 6 samples and one whole building.
4. Fix `--self-test` so it finds its subject at run time (see B). A gate whose instrument cannot be
   verified is a gate nobody should trust.

Steps 1 and 2 are perhaps twenty minutes of work and they are the difference between a defect that
was fixed and a defect that is fixed.
