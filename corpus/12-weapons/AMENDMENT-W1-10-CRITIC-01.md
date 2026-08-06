---
id: AMENDMENT-W1-10-CRITIC-01
title: Two defects in RI-WPN03's own thresholds, found by measuring against them
area: 12-weapons
judges: [weapon.identity.withinclass, weapon.animation.reuse]
targets: [RI-WPN03]
reason: corpus_hole
provenance: constructed
confidence: high
filed_by: critic.weapons, wave 1, piece W1-10
status: amendment request — not applied unilaterally (CORPUS-CONTRACT §5)
---

## Why this exists

`WEAPON-CRITIC.md` §5 makes interrogating the bar a mandatory half of this role's job, and
requires at least one **concrete proposed amendment** with the section and the replacement text.
These are the two defects the wave-1 measurement actually exposed. Both are defects in the
*item*, not in the build, and `SCORING.md` §0's closing rule applies: *"An item that cannot reach
10 because the corpus is broken is a corpus bug. Fix the corpus."*

Evidence for both: `corpus/90-verdicts/wave1/artifacts/W1-10/static-census.json`, produced by
`node tools/harness/critic-w1-10-static.mjs`.

---

## Defect 1 — `ARI`'s hard-fail bar is unreachable by any conforming roster

### The measurement

`RI-WPN03` §C caps clip sharing at `SHARE(c) ≤ 4`. §A fixes the census at fifteen classes with
4–8 weapons each, and `RI-WPN01` §A fixes the mandatory slot count at 25 (7 for BOW), giving
`S_total = 2085`.

A class of `N` weapons cannot put all `N` on one clip once `N > 4`. The **minimum** distinct-clip
count any roster satisfying §C can have is therefore

```
C_min = Σ over classes of  25 × ceil(N_k / 4)          (7 × ceil(5/4) for BOW)
      = 664
ARI_min = 664 / 2085 = 0.3185
```

Both published bars sit **below** that floor:

| Bar | Value | Reachable? |
|---|---|---|
| `ARI > 0.55` — over-fragmentation | 0.55 | yes |
| `ARI ≥ 0.26` — PASS | 0.26 | **always true** |
| `ARI < 0.19` — HARD FAIL | 0.19 | **unreachable** |

The measured build sits at `ARI = 0.4547`, comfortably inside a band it could not have left. The
number the item calls its headline — *"this is 'forty weapons, three animations'"* — cannot fire
on any roster that obeys the item's own `SHARE` cap. `ARI`'s §D.1 reference table computes the
"perfect sharing" floor as 0.171 by assuming one moveset per class, which is exactly the
arrangement `SHARE(c) ≤ 4` forbids. The two sections were written against each other.

### Proposed replacement — RI-WPN03 §D.1, thresholds table

Replace the table with:

| Threshold | Value | Meaning |
|---|---|---|
| **`ARI ≥ 0.42`** | **PASS** | ≈2.1 unique clips per weapon above the **SHARE-capped** floor of 0.3185 |
| `0.35 ≤ ARI < 0.42` | Below bar | Deviation exists but is token |
| **`ARI < 0.32`** | **HARD FAIL** | At or below the floor `SHARE(c) ≤ 4` already guarantees — the sharing cap is doing all the work and nobody authored anything |
| `ARI > 0.60` | Below bar (the opposite failure) | Classes have fragmented |

and replace the §D.1 reference-point table's "perfect sharing" row with:

| Scenario | `C` | `ARI` | Reading |
|---|---|---|---|
| The `SHARE ≤ 4` floor — every class shares as hard as §C permits | 664 | **0.319** | "eighty-seven weapons, twenty-three movesets". The cheapest roster this item's own rules allow. |

**Consequence for the wave-1 measurement:** the build's 0.4547 still passes, by 0.035 rather
than by 0.195. That is the point — the bar becomes capable of failing something.

---

## Defect 2 — nothing in the corpus measures the chain, and the chain is what a player learns

### The measurement

`RI-WPN03` §D.2's `F87` vector and `RI-WPN02` §D's 12-vector are built from `r1.1` and from
per-weapon scalars (reach, hyperarmour fraction, hitstop tier). `max_chain_len` is the only
dimension that looks past the first hit, and it is a single integer. Measured on this build,
12 of 15 classes are chain-3, so `D4` carries almost no variance and `Dg_min` lands at 0.8999
— below its own pass bar — substantially *because* the only grammar dimension that could
separate AXE from HLB after the first swing is a constant.

Two weapons whose entire chain after the first hit is identical are, to both fingerprints,
indistinguishable. That is the tenth-hour failure `CRITIC-DOCTRINE` §2.1 rung 5 asks for, and
no number in the seven headline measures would catch it.

### Proposed addition — RI-WPN03, new §D.3

> ### D.3 The chain rhythm distance
>
> For each weapon, form the chain rhythm vector
>
> ```
> Rh(w) = [ recovery_f(r1.i) / startup_f(r1.i)          for i in 1..max_chain      ]
>      ++ [ startup_f(r1.i+1) − recovery_f(r1.i)        for i in 1..max_chain − 1  ]
> ```
>
> padded to the roster's longest chain with the weapon's own `r1.1` ratio. Z-normalise across
> the 87 and compute pairwise distances exactly as §D.2 does.
>
> | Threshold | Value | Meaning |
> |---|---|---|
> | **`Rh_med` within class ∈ [0.25, 0.90]** | **PASS** | The subtlety band, applied to the sentence rather than to the word |
> | **`Rh_min` within class ≥ 0.10** | **PASS** | No two weapons of a class have the same rhythm |
> | **`Rh_min` within class < 0.03** | **HARD FAIL** | Two weapons of one class are the same sentence with different nouns |
>
> `Rh` is computed from the declared moveset alone and requires no harness extension, so it is
> measurable on the day it is adopted.

### Why this is the right shape

Both existing fingerprints answer *"is this a different weapon?"*. `Rh` answers *"is this a
different thing to press four times?"*, which is the question a player asks in hour ten and the
one the user's phrase **"attack pattern"** actually names. It is also the only proposed measure
here that would fail a build whose every other number passes.

---

## Provenance

`provenance: constructed`, confidence **high**. `C_min = 664` and `ARI_min = 0.3185` are
arithmetic consequences of `RI-WPN03` §A's census and §C's `SHARE` cap and are checkable by hand.
The replacement `ARI` bands preserve the item's original *intent* (≈2.1 authored clips per weapon
above the floor) recomputed against the correct floor. `Rh`, its vector definition and all three
of its thresholds are defined here and are new; no FromSoftware source publishes anything of the
kind, and the [0.25, 0.90] band is set by analogy with §D.2's `W_med ∈ [0.35, 1.00]` rather than
measured from anything.

Cross-dependencies: `RI-WPN03` owns both sections and wins on any conflict; `RI-WPN01` §A owns
the 25-slot count that sets `S_total`; `RI-WPN02` §B owns the chain-length column `Rh` reads.
