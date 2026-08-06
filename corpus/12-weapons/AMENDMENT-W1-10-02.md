---
id: AMENDMENT-W1-10-02
title: Three threshold and authority defects the round-2 build hit head-on, and a position on AMENDMENT-W1-10-CRITIC-01
area: 12-weapons
judges: [weapon.class.differentiation, weapon.moveset.slots, weapon.animation.reuse]
targets: [RI-WPN02, RI-WPN01, RI-WPN03]
reason: corpus_hole
provenance: constructed
confidence: high
filed_by: builder.weapons, wave 1, piece W1-10, round 2 (ULTRACODE)
status: amendment request — not applied unilaterally (CORPUS-CONTRACT §5)
---

## Why this exists

`EFFORT-POLICY.md` §"What escalation actually changes" gives an escalated builder standing to
propose a corpus amendment if it believes a bar is wrong, and requires it to say precisely what
it would need where it cannot close a gap. Three things in this piece could not be closed by
building, and one of them cannot be closed at all as the corpus currently stands. All three are
stated with the arithmetic that proves them, so a bar critic can check them by hand.

The round-2 build's own position on the critic's filed amendment is in §D.

---

## A. `Dg_min ≥ 1.0` is not reachable from RI-WPN02 §B's own published table

### The measurement

`RI-WPN02` §D's grammar-only distance `Dg` is computed over five dimensions of the fifteen class
baselines, z-normalised across the fifteen:

| Dim | What | Where its value comes from |
|---|---|---|
| D2 | `recovery(r1.1) / startup(r1.1)` | **RI-WPN02 §B** publishes R1 startup and R1 total; RI-CMB02 §A publishes R1 active for the seven anchors. **Pinned.** |
| D4 | `max_chain_len` | **RI-WPN02 §B**, "Max chain" column. **Pinned.** |
| D6 | `arc_sweep_deg(r1.1)` | **RI-WPN02 §B**, "Arc sweep" column. **Pinned.** |
| D7 | `root_dz_m(r1.1)` | **RI-WPN02 §B**, "Root Δz R1" column. **Pinned.** |
| D11 | hyperarmour fraction over the mandatory 25 | §B fixes only the *1h R2 hyperarmour* cell. **The one free dimension.** |

Four of the five are transcriptions of the item's own table. `Dg_min` is therefore a function of
`RI-WPN02` §B plus **one** builder-controlled number, and that number is a count out of 25, so it
moves in steps of 0.04.

Three figures, all recomputed from the shipped roster (`node tools/weapons/measure.mjs`):

| Quantity | Value | Limiting pair |
|---|---|---|
| `Dg_min` over the **four pinned dimensions alone** (D11 deleted) | **0.396** | SPR–TSW |
| `Dg_min` at the best **narratable** D11 assignment — exhaustive integer search over ~30 000 assignments, constrained only by "hyperarmour breadth does not decrease with mass" | **0.916** | AXE–HLB |
| `Dg_min` at the unconstrained **continuous** optimum of D11 | 1.601 | GHM–GSW |

The build ships at **0.914**, which is 0.002 off the best assignment that can be written down as a
design rule.

### Why the third row is not the answer

The continuous optimum puts AXE at 0.306, MCE at 0.462, TSW at 0.396, SSW at 0.638 and UGS at
0.527 — a hyperarmour ladder in which the mace has *more* hyperarmour than the axe, the thrusting
sword has more than the halberd, and the ultra greatsword has less than the straight sword. Those
numbers are not a design; they are a curve fit to a distance metric. `WEAPON-CRITIC.md` §5 asks
every critic "which threshold is gameable, and how cheaply" — and the honest answer for `Dg_min`
is: **it is gameable through D11, and reaching its pass bar requires gaming it**, because AXE,
HLB, SSW and MCE form a four-clique in the four dimensions the item itself pinned:

| Pair | D4 chain | D6 arc | D7 root | D2 rec/start |
|---|---|---|---|---|
| AXE / HLB | 3 / 3 | 130 / 145 | 0.30 / 0.45 | **1.500 / 1.474** |
| HLB / SSW | 3 / 3 | 145 / 110 | 0.45 / 0.35 | 1.474 / 1.667 |
| MCE / SSW | 3 / 3 | 95 / 110 | 0.28 / 0.35 | 1.470 / 1.667 |

AXE and HLB are separated, in grammar, by 15° of arc, 15 cm of lunge and **0.026 of a ratio**.
That is not a build defect. It is what RI-WPN02 §B says those two classes are.

### Proposed amendment — RI-WPN02 §D

Either of these, and the item should choose:

**Option 1 (preferred) — give `Dg` a fifth *unpinned* dimension.** Adopt
`AMENDMENT-W1-10-CRITIC-01`'s §D.3 chain-rhythm vector `Rh` as **D13** and add it to the
`GRAMMAR_DIMS` set. It looks past the first hit, it is computed from the declared data, and it is
the only proposed measure in either amendment that separates AXE from HLB on something a player
would feel — the axe's chain accelerates into its third swing and the halberd's does not. This
converts `Dg` from "four pinned columns and a tuning knob" into a real grammar distance.

**Option 2 — restate the band.** Replace the `Dg_min ≥ 1.0` pass bar with

| Threshold | Value | Meaning |
|---|---|---|
| `Dg_min ≥ 0.90` | PASS | Above the four-pinned-dimension floor of 0.396 by a factor of 2.3 |
| `0.60 ≤ Dg_min < 0.90` | Below bar | |
| `Dg_min < 0.50` | HARD FAIL | unchanged |

with the standing note that the bar cannot be raised without either amending §B's arc/root/chain
columns or adding a dimension.

**What I would need to close this without an amendment:** permission to move `RI-WPN02` §B's
published arc, root or chain cell for at least one of AXE, HLB, SSW, MCE. I did not take it. The
table is the item's spine and a builder moving a published cell to make a distance metric pass is
the exact failure `RI-MTH04` calls measurement fraud.

---

## B. RI-WPN01 §A and RI-WPN02 §B disagree about whether a chain-2 class has an `r1.3`

`RI-WPN01` §A slot 3 makes `r1.3` **mandatory on every melee weapon** and describes it as
"terminal for 11 of 15 classes". `RI-WPN02` §B publishes CGS and GHM at `max_chain` **2**, and §C
says it again in words: *"`max_chain 2`; the second hit is a full 360°."* Only nine of fifteen
classes are chain-3. The "11 of 15" is arrived at by counting CGS and GHM as terminating at
`r1.3`, which is exactly what their published chain length says they do not do.

A build must therefore either drop a mandatory slot on ten weapons or publish a chain length that
contradicts §B. Round 1 did the second and was scored for it (`matrix_conformance_failing: 3`).

**What this build did, pending a ruling.** Both, without breaking either: CGS and GHM declare
`r1.3` — all 25 mandatory slots present on all 87 weapons — and terminate the **standing** chain
at `r1.2`, so a mash probe from `r1.1` measures 2. `r1.3` is reached instead out of a dodge:
`roll.r1` and `backstep.r1` chain into it rather than into `r1.2`. The slot is neither missing nor
an orphan, `chainLen(r1.1) == 2` matches §B, and the two heavy classes gain a third sentence that
only exists as a read — which is a defensible reading of what a 2-chain means.

**Proposed amendment — RI-WPN01 §A slot 3.** Change the M/O column from **M** to
**M (classes with `max_chain ≥ 3`)**, exactly as slot 4 (`r1.4`) is already conditioned on the
same column, and correct "terminal for 11 of 15 classes" to "terminal for 9 of 15". If instead
the ruling is that `r1.3` is unconditionally mandatory, then RI-WPN02 §B's CGS/GHM chain column
should read 3 and §C's CGS note should be struck; the two cannot both stand as written.

---

## C. `classes.json`'s R2 active/recovery split was not RI-WPN02's to make

Recorded here rather than in a code comment because it changed 46 weapons' frame data.

`RI-WPN02` §B publishes R2 **startup** and R2 **total** and does not publish the active/recovery
split. `game/data/weapons/classes.json` derived one. On the seven anchor classes that split is
owned by `RI-CMB02` §B, and §B's own authority note says *"if a cell here ever disagrees with
RI-CMB02, RI-CMB02 wins"*. Six of seven disagreed:

| Class | was (active/recovery) | RI-CMB02 §B | total |
|---|---|---|---|
| DGR | 7 / 43 | **6 / 44** | 78 |
| SPR | 9 / 65 | **10 / 64** | 128 |
| AXE | 13 / 73 | **14 / 72** | 146 |
| HLB | 15 / 85 | **16 / 84** | 168 |
| GSW | 17 / 99 | **20 / 96** | 196 |
| UGS | 21 / 127 | **24 / 124** | 252 |
| SSW | 12 / 60 | 12 / 60 ✓ | 122 |

Reconciled to `frames.json` in this round; totals unchanged. **No amendment is requested** — the
corpus was already unambiguous and the build was wrong. It is filed so the eight extension classes
are visibly *not* covered by it: FST, CSW, TSW, MCE, WHP, CGS, GHM and BOW have no RI-CMB02 row,
their split remains derived, and if RI-CMB02 is ever extended to fifteen classes those eight cells
must be re-derived from it and not from here.

---

## D. Position on `AMENDMENT-W1-10-CRITIC-01`

**Defect 1 (`ARI`'s bands are unreachable from below): AGREE, without reservation.** The
arithmetic is right and I re-derived it independently. `RI-WPN03` §C caps `SHARE(c) ≤ 4`; §A fixes
the census at fifteen classes of 4–8 weapons; `RI-WPN01` §A fixes the mandatory slot count at 25
(7 for BOW). `C_min = Σ 25·⌈N_k/4⌉ = 664` and `S_total = 2085`, so `ARI ≥ 0.3185` on any roster
that obeys the item's own sharing cap. Both the 0.26 pass bar and the 0.19 hard-fail bar sit below
that floor. A hard-fail threshold that cannot fire is not a threshold. The replacement bands (pass
0.42, hard fail 0.32) preserve the item's stated intent of ≈2.1 authored clips per weapon above
the floor, recomputed against the correct floor, and this build's 0.4547 still passes under them —
by 0.035 instead of by 0.195, which is the point. **Adopt as filed.**

One addition the critic did not make and the item should: §D.1's *over-fragmentation* bar
(`ARI > 0.55`, now proposed at 0.60) is measured against the same `S_total`, and it is the only
bar in the pair that a builder can fail by trying too hard. It should be stated as a **warning**
rather than a fail, because the remedy for it — sharing more clips — is in direct tension with the
`UNQ ≥ 4` and `DEV_id > 0` bars that sit two subsections away.

**Defect 2 (nothing measures the chain): AGREE, and it is the more important half.** `Rh` as
defined is computable from the declared data on the day it is adopted, and I confirmed the
premise: `D4` is the only dimension in either fingerprint that looks past the first hit, and after
this round's chain repairs it still takes only five distinct values across fifteen classes, nine
of which share one of them. Two proposed refinements:

1. **Make `Rh` a dimension of `Dg`, not only a within-class check.** As filed, `Rh` has thresholds
   for `Rh_med` and `Rh_min` *within* a class and none between classes — so it would catch "two
   weapons of one class are the same sentence" but not "two classes are". §A above shows that the
   second is the live problem: `Dg` has one free dimension and needs a second. Adding `Rh` to
   `GRAMMAR_DIMS` costs nothing and fixes both.
2. **Pad with the weapon's own last link, not its `r1.1` ratio.** As filed, a chain-2 class is
   padded to the roster's longest chain (5) with three copies of its `r1.1` ratio, which makes
   every short-chain weapon look *more* like every other short-chain weapon than it is — the
   padding, not the weapon, would carry the distance. Padding with the last declared link's ratio
   keeps the vector a statement about the weapon.

**On the `Rh_min < 0.03` hard fail: agree it should exist, but not in wave 1.** It is a new
threshold with no measurement behind it — the amendment says so itself (`[0.25, 0.90]` is "set by
analogy … rather than measured from anything"). Adopting a hard fail whose value nobody has
computed against a real roster risks failing a good build for an arbitrary reason, which is the
mirror image of `ARI`'s defect. Recommendation: adopt `Rh` and its two PASS bands in wave 1, run
it, publish the measured distribution, and promote `Rh_min < 0.03` to a hard fail in wave 2 once
there is a number to defend it with.

---

## Provenance

`provenance: constructed`, confidence **high**. Every figure in §A is reproducible with
`node tools/weapons/measure.mjs` against the shipped roster plus the search in this piece's
report; §B's collision is a direct quotation of two items; §C's table is a cell-by-cell diff of
`game/data/weapons/classes.json` against `game/data/combat/frames.json`, both in the tree.
Cross-dependencies: `RI-WPN02` §B owns everything in §A's pinned column and wins on any conflict;
`RI-CMB02` §B owns §C and wins over `RI-WPN02` §B by that item's own authority note;
`RI-WPN03` owns `ARI` and `Rh`.
