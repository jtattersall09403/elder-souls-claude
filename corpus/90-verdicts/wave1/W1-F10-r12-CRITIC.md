# W1-F10-r12 — CRITIC

**Piece:** F10 round 12, the crowd's breathing · **Branch** `codex/wave1-build-experiment` ·
**Judged at** `b70fafc6`, HEAD moved to `55c629a0` mid-run and **no judged file moved with it**
(`git log --oneline b70fafc6..HEAD -- game/src/render/actor.js game/src/render/renderer.js
tools/visual/f10-r12-crowd-motion.mjs tools/visual/f10-r12-motion-pixels.mjs` is empty).

**Verdict: FAIL — ART 2/10 × FIDELITY 3/10, an ordered pair, never averaged. Neither moved.**
**The round's gap is CLOSED. RI-VIS10 goes 3 of 18 → 4 of 18. Both readings band at ART 2.**

---

## The short version

Round 11 gave 408 people 392 different stands and froze every one of them: *0 of 60 drawn NPCs changed
any bone in a second, worst change exactly 0 radians.* Round 12 made them breathe, and it works.
Measured in my own browser session at the r10 stand: **27 of 27 drawn NPCs change a non-foot bone over
60 sim frames — 100.00% against a 90% bar** — with the player control still moving 0.015456 m in the
same session. **C3 passes on all three arms for the first time since the check gained an NPC arm.**

Three things I found that the round did not.

1. **Its pixel control cannot fail.** `f10-r12-motion-pixels.mjs:104` is
   `diff(imgs[0].img, imgs[0].img)` — the same decoded buffer twice. It reads 0 by arithmetic. The
   round offered it as proof *"the capture is deterministic"*; it would read 0 on a broken decode, a
   non-deterministic rasteriser, or a camera that moved. **I shot the control it needed** — same sim
   frame, `stepFrames(0)`, render again, capture again — and got **0 changed pixels of 2,073,600 with
   byte-identical PNGs (md5 `a5c6c873…` twice)**. The conclusion is true. The proof was worth nothing.
   Filed as **HAZARDS §30**.
2. **Nobody had asked where the changed pixels were.** Lilmoth is a stilt town over water with
   foliage on the horizon; 2% of a frame changing proves motion of *something*. My capture records
   every drawn NPC's screen box, projected from bone world matrices, at every shot. **82.28%–85.66% of
   the changed pixels land inside boxes covering 9.09%–9.36% of the frame — an enrichment of
   8.93×–9.32×.** That is the sentence the round wanted: the breathing reaches the screen, *on the
   people*.
3. **The third replication does not exist.** The round claims L1–L3 in three sessions —
   `live2`, `stability`, `timing-after`. `timing-after/` is not on disk, not in `HEAD`, and never
   committed; its own `what_i_could_not_do` says that run never finished. Two sessions are
   verifiable. I produced a third myself, and it reproduces to the last digit — which is
   *determinism*, not statistical independence, and that is the property the round should have claimed.

---

## Job 2 — the self-test arm that is the whole proof: **it does fail the old design, three ways**

`HAZARDS §28` claims arm 9 replays the real clock jump (24 → 84) and is *required* to fail the modulo
stagger the round started with. I did not read it; I falsified it. Two control clones per §22
(`git archive HEAD game tools`, no `.git`, each running **the clone's own copy** of the tool against
the clone's own `game/`), differing from HEAD only in `poseStatic`'s re-solve condition:

| design | arm 9 `starved_of_120` | arm 9 |
|---|---|---|
| shipped **window** (`win !== winPrev`) | **0** | green |
| **modulo** (`t % N === bucket`) — the round's first design | **106** | **RED** |
| re-solve branch **deleted** — the r11 behaviour | **120** | **RED** |

106/120 = 11.7% survival, matching both the one-in-eight-buckets expectation and the round's own live
7.41%. **And arm 9 is the only one of the fifteen that catches it:** in the modulo clone, 13 of 15 arms
stay green (the fourteenth, arm 2, fails only because `git archive game tools` does not carry the
corpus artifact it re-derives). Arms 1b, 5, 6 and 8a — the ones that *look* like they should catch a
starved scheduler — all pass the broken design, because every one of them advances the clock densely or
re-solves a fresh actor. **That is §28's rule proved on its own example, and it is the best piece of
method in twelve rounds of F10.**

Both clones record `commit: unknown`, which also closes the half of `HAZARDS §22`'s discriminator the
round could argue but not measure.

---

## Job 1 — the crowd, on my own numbers

My own session, `--stages=census,stability`, manifest `commit: 55c629a036…, dirty: false`:

| quantity | reading |
|---|---|
| npc meshes / visible / **DRAWN** | 60 / 31 / **27** |
| C3 (b2), DRAWN | **27 of 27 = 100.00%** (bar ≥ 90%) |
| per-person worst non-foot change, 60 frames | **0.6735° – 1.5261°**, median 1.098°, **zero people at zero** |
| `t_solved` before → after | **24 → 84 on all 27** — the sporadic jump, survived |
| player control (required to disagree) | 0.015456 m |
| C3 (b1), DRAWN | 27 of 27, **27 distinct pose signatures over 27 people** |
| planting, 31 visible | 0.088203 – 0.091260 m |

**The stagger trap the brief named — a crowd breathing in step — checked four ways, all my own runs.**
Distinct loop phases over the 408: **95 at t=0** (the offset is an integer in a 96-frame loop, so 95 of
96 slots are occupied and sharing is unavoidable), **392 at t=600**, **391 at t=6000** — the per-person
*rate* pulls them apart. Self-test 4b requires the pairwise gaps to move and **4c is its
required-to-disagree control**: pin every rate to 1.0 and the same gaps come back frozen. Buckets:
8 of 8 occupied at `[60, 56, 51, 44, 47, 48, 51, 51]`, worst single-settlement share **0.2549**
(gideon) against a 0.55 bar. Live: 27 distinct signatures on 27 people at one instant.

**And the same person is deterministic**, which is the half that is easier to fail: self-test 1a (same
person twice at t=0, bit-identical), arm 2 (round 11's banked 408 rows re-derive with **0 mismatched**),
and the stability arms below.

**Amplitude, said plainly because the round did not publish the distribution:** this is a breath of
**0.67°–1.53° of bone rotation per person per second**. It is subtle, and a reader expecting a visible
weight-shift will be disappointed by the frames. It is nonetheless real and it demonstrably reaches the
screen — which is exactly what the attribution arm establishes, and why I set the new amplitude floor
at 0.25° rather than higher. What this crowd still does *not* do: shift weight foot to foot, turn a
head, fold an arm, or use its hands. The stand breathes; it is still one behaviour at 408 phases.

---

## Job 5 — the S59 clause (b) ruling: **upheld, and the substitute is stronger**

Clause (b) asks for *"60 of 60 bit-identical"* bones across an interval; arm (b2), filed in the same
verdict, requires the bones to differ across an interval. Both cannot hold. **A builder rewriting a
preservation clause it cannot meet is exactly what S59 exists to police**, so I checked the reasoning
rather than the conclusion.

The test is the clause's own stated reason, which the r11 critic wrote down: *"a crowd that re-rolls on
stream-in is a worse defect than a crowd that is still."* That is about being dealt a new **hand** —
weight side, depth, phase offset, rate, head aim, torso twist, stoop, arm/elbow/splay draws — not about
being at the same point in a breath. The round's split runs exactly along that line, and it is
**strictly stronger on the property the clause protects**: two different hands could in principle land
on the same bone signature, whereas comparing the seeded record directly cannot.

**And the round's one labelled inference converts.** It reported bones bit-identical on 31 of 60 across
all three attacks, guessed that 31 is the drawn population, added a per-visibility split to its
instrument and never got a browser slot. I ran it:

| arm (pinned sim frame 84) | identity | bones, **DRAWN** | bones, invisible-never-advanced |
|---|---|---|---|
| REBUILD | **60 of 60** | **27 of 27** | 4 of 33 |
| TRAVEL (2.4 km and back) | **60 of 60** | **27 of 27** | 4 of 33 |
| SAVE / RELOAD | **60 of 60** | **27 of 27** | 4 of 33 |

27 + 4 = 31, exactly. The strongest arm is SAVE/RELOAD for the reason the round gives and I confirmed
in the source it cites: `loadState()` resets `sim.frame` to 0, so the clock is destroyed and rebuilt and
every person still comes back with the same dealt hand.

---

## Job 3 — the 29 under the Topal

**The diagnosis is right, and it is sourced from a comment that predicted it.** `sim/npc.js:302
applyPresence` sets `visible = false` for anybody whose `at` names a cell the player is not in; the
function's own header at `:290` says, verbatim, *"For somebody whose record names an interior that
place is an INTERIOR-LOCAL coordinate, which as a world coordinate is a few metres from the world
origin."* My census reproduces it: 29 invisible, **28 within 5 m of the world origin**, ground
−41.134 to −40.725 m. Not a spawn defect, not pooling. The cheap half is correctly built — the diff
shows `mesh.visible = …` moved from *after* `poseStatic` to *before* it, so the gate reads this frame.

**Ruling: yes to deferring, no to forgetting — with one correction.** Not building a mesh for an absent
person is a renderer streaming change that touches perception and collision through `sim.npcs`; it is
not F10's gap, and declining it is §1.3's third guard applied by a builder to itself. But *"~48% of the
stance budget"* is `29/60` **of meshes** — arithmetic about actors skipped, not a reading of time — and
should stop being quoted as a measurement. And the defect does hide something: **four NPCs are
`visible === true` at ≈(4906, −594) on ground −33 m, 6 km from the stand and outside the province's own
x extent.** They are drawn, nobody owns them, and they have survived three verdicts.

The round's own overturn condition — an NPC becoming visible with a one-frame pop — **I did not test,
and it is not met by me.**

---

## Job 4 — the budget clause

See `artifacts/W1-F10-r12-critic/timing/`. **The round's before/after pair was pointed at the wrong
base:** `git diff --stat caa8b01b..HEAD -- game/` shows `sky.js` (98 lines) and `lighting-recipes.js`
(8) changed too, from a sibling's F4 work, so a pair against `caa8b01b` measures the stance advance
**and** the sky and attributes the sum to F10. My BEFORE arm is HEAD with **one branch removed** —
`poseStatic`'s re-solve `else if` — so the two trees are bit-identical in every other respect, and
because both clones record `commit: unknown` the tool publishes the sha256 of the `actor.js` it loaded
instead (`764785073dee` after, `877bd274bb89` before). Both arms run their own copy of the tool,
launched concurrently so both see the same load, `stepFrames(1)` + `renderNow()` per frame so the sim
clock advances by exactly 1 per render and the one-in-eight cadence is exercised the way gameplay
exercises it — and not the way `stepFrames(60)` does, which is the whole of §28.

---

## The eighteen checks

**4 of 18 pass: B3, C1, C3, E2.** DESIGN = 10 × 4/18 = **2.22**. Thirteen censuses published (ten
mine, three carried from r10 and declared as carried), so the twelve-census floor is cleared.

| | result | value |
|---|---|---|
| B1 | fail | not run — no fresh judge (rule 0e), **fifth verdict** |
| B2 | fail | 6 of 10 — **carried from r10** |
| B3 | **pass** | crest/snout/tail geometry — carried, contours confirmed on my three bearings |
| B4 | fail | 1 of 7 — carried; my own look at 3.4 m agrees |
| C1 | **pass** | R 7.32 / 7.49 / 7.68 over 82 readings, 82 of 82 in band; 928–930 px figure, 123–125 px head |
| C2 | fail | median IoU **0.8574**, max **1.0000** over 552 pairs — unchanged, and `f10-silhouette.mjs:117` still poses through `poseFromRig`, so it cannot see the shipped path |
| **C3** | **PASS** | (a) pass · (b1) 27 of 27 · (b2) 27 of 27 — **the first C3 pass since the check gained an NPC arm** |
| C4 | fail | not run — no fresh judge |
| D1 | fail | 0 — `ls game/data/` is 22 entries and none is a garment vocabulary |
| D2 | fail | census not published — bounded, **fourth verdict** |
| D3 | fail | 2 of 8 materials (`reed`, `chitin`; `xanmeer` is a clone of `darkStone`) |
| D4 | fail | not run — no fresh judge |
| D5 | fail | census not published — bounded |
| E1 | fail | 32 actors / 408 = 1 per 12.75 (need 34); `townsman` 97 = 23.8%; **drawn arm 14 bodies = 1 per 29.14** |
| E2 | pass | 14 distinct rendered bodies among 97 townsmen — passes because E1's pool is small enough to exhaust |
| E3 | fail | 3 build bands of 5; no child, no stooped-old axis |
| E4 | fail | 93 identical pairs within 15 m |
| E5 | fail | saxhleel and dunmer draw no body another Helstrom race does not |

**A correction the round's file needs:** it says *"C2 is the check RI-VIS10's own scoring names as one
of the four whose failure keeps a piece out of the 7-8 band."* Read this turn, RI-VIS10's scoring table (line 385, after my own amendment shifted it down):
`| 7–8 | 2–4 failing, none of them B1, B3, D2 or E1 |`. **C2 is not one of the four. E1 is** — which the
round itself says correctly two entries later. A slip, but it argued for a piece of work on a premise
that is not in the item.

---

## The gap: **the crowd breathes and there are still fourteen people in it**

Three rounds have now improved how the **fourteen** bodies stand. The stance work is finished; C3
passes on every arm and there is nothing left in it to buy. Every remaining point in this item is bought
with geometry, and E1 is the largest block of it: **14 distinct rendered bodies for 408 records, one per
29.14, against a bar of one per 12**, with 93 identical pairs standing within 15 m of each other and
three build bands of five. In my own orbit at b000 the tell is visible without a measurement — in the
row of four under the overhang, the two leftmost figures are the same body at slightly different phases
of the same breath, and the difference between them is smaller than the difference a viewer needs to
believe they are two people.

§F ranks this **second of ten** by how fast a viewer notices, and unlike stillness it gets *worse* the
longer they watch, because recognising a repeat requires having seen the original.

**Remedy, preservation clauses and DONE conditions: see `biggest_gap.remedy` in the JSON.**

---

## The bar was extended, and it is not what carries the pass

`RI-VIS10` C3 arm (b2) now also requires **(b2-ii)** an amplitude floor of **0.25°** per counted person
and **(b2-iii)** an attribution arm — ≥ 60% of changed pixels inside drawn NPCs' screen boxes at ≥ 3×
enrichment, against a determinism control that is **two independent renders of the same sim frame**,
explicitly excluding a buffer compared with itself. ADD-only; (b1), the ≥ 90% clause and arm (a) are
untouched.

**Unlike the last two amendments to this row, mine does not fail the build that prompted it** — so the
guard that matters is the other one: C3's pass above is scored on the bar exactly as the r11 critic left
it and would stand if my amendment were deleted. `CRITIC-DOCTRINE` §1.3 forbids a bar a critic writes
from being the reason anything passes, and it is not.

---

## What I could not do, as plainly as what I did

1. **B1, C4, D4** — no fresh judge. Rule 0e. **The orchestrator owes all three for the fifth verdict
   running**: 17% of this item's score that no critic this project has ever spawned could reach.
2. **D2 and D5** — deliberately not run and bounded, **fourth round**. The wardrobe half of RI-VIS10
   has never been measured by anybody, and I did not fix that.
3. **RI-VIS08 not run**, so FIDELITY is not mine; the ordered pair's second number is the standing
   verdict's.
4. **No paid hardware**, so no appearance claim: my eight frames establish what is in shot, where bones
   are, whether they move and which pixels changed — nothing about how anything looks.
5. **B2, B3, B4 are carried from r10**, not re-derived; I shot no character-against-a-void pair.
6. **Lilmoth, not Helstrom** — the second-largest settlement, fourth verdict running. Helstrom's 78 are
   covered offline at 100% and never in the running game.
7. **I did not test the one-frame-pop overturn condition** for the 29 at the origin; my account of why
   it would be a phase jump rather than a pose jump is a source diagnosis, not a measurement.
8. **I did not build an independent second instrument for the offline 408-row census** — I re-ran the
   round's own tool, whose arm 2 re-derives round 11's banked rows with 0 mismatches. Same population by
   a different route, not a second instrument.
9. **My frame-time pair isolates the re-solve branch** and therefore does *not* answer how much all of
   `caa8b01b..HEAD` costs. It should not be read as answering it.

**And the blind census in my brief was wrong, so I re-derived it rather than passing it on.** 141
entries across 73 verdict files is right. **108** `not_possible`, not 105. **"0 run" is an artefact of
reading `blind_status`, a key only 11 of the 141 entries use** — 135 use `status`, and 27 of those read
`done` plus one `answered-and-revealed`. `grep -rl "blind_pair: yes"` matches 106 files; a front-matter
walk gives **80** reference items, not 81. The rule-0e hole is real and total for the fresh-judge checks
this item needs. **The claim that no blind comparison has ever run in this project is false and should
stop being repeated.**
