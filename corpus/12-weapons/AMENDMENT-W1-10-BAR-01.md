---
id: AMENDMENT-W1-10-BAR-01
title: RI-CMB02 §C's chain multipliers are class-uniform, so every weapon in the game has the same combo rhythm by construction
area: 12-weapons
judges: [combat.frames.timing, weapon.class.differentiation, weapon.identity.withinclass]
targets: [RI-CMB02]
reason: corpus_hole
provenance: constructed
confidence: high
filed_by: bar-critic, wave 1, BAR-CRITIQUE-W1-10-R1 §R5 hole H5
status: amendment request — RI-CMB02 belongs to critic.combat and is not this critic's to edit (CORPUS-CONTRACT §5)
---

## The defect

`RI-CMB02` §C publishes the R1 chain modifiers as **one row per chain position, applied to every
class alike**:

| Modifier | Startup | Active | Recovery | Motion value |
|---|---|---|---|---|
| R1 chain, hit 2 | ×0.78 | ×1.00 | ×1.05 | ×0.95 |
| R1 chain, hit 3 | ×0.78 | ×1.00 | ×1.35 | ×0.90 |

Two consequences follow, and neither is anywhere in the corpus:

**1. Every chain in the game has the same tempo envelope.** For any conforming build, the ratio
of one link's timing to the next is a constant shared by all eighty-seven weapons. A dagger's
four-hit chain and an ultra greatsword's three-hit chain accelerate and decelerate in exactly
the same proportions; the only thing that differs is the scale. The user's direction names
**combos** as one of the five things a weapon must own, and at the level of *rhythm* the corpus
currently guarantees that no weapon owns its combo. This is not a build defect — a builder who
varied the multipliers would be publishing frame data that contradicts `RI-CMB02`, which
`RI-WPN02` §B's authority note forbids.

**2. It makes any frame-arithmetic chain metric circular.** This was found while ruling on
`AMENDMENT-W1-10-CRITIC-01`'s proposed `Rh` vector. Because the multipliers are uniform, `Rh`'s
ratio components reduce to `r1_recovery / r1_startup` times a constant — a dimension the grammar
distance already has — and its inter-link gap components measure **−0.976 correlated with
`r1_startup`**, i.e. mass. Any measure of chain rhythm built from this corpus's frame data is a
restatement of two numbers it already has. That is why `RI-WPN03` §D.3's adopted measure `Chg`
is built from **shape, arc, root travel and swing plane** rather than from frames: with §C as it
stands, frames are the one thing a chain cannot vary.

## What the amendment asks for

`RI-CMB02` §C's two chain rows become a **default**, with a declared per-class deviation budget:

| Field | Proposal |
|---|---|
| Default | ×0.78 / ×1.00 / ×1.05 (hit 2), ×0.78 / ×1.00 / ×1.35 (hit 3) — unchanged, and the value a class inherits if it declares nothing |
| Per-class override | a class may declare its own hit-2 and hit-3 startup and recovery multipliers in `RI-WPN02` §B, within **±0.20** of the default |
| Floor | the `RI-CMB02` §E 6 f@60 startup floor still binds after the multiplier |
| Requirement | **≥ 6 of the 14 melee classes must deviate from the default on at least one multiplier**, so chain tempo is a real axis rather than a permission nobody uses |
| Readability | `recovery / startup ≥ 1.40` (R1) must hold on **every link**, not only on `r1.1` — today it is only checked on the chain root |

Design intent, stated so the amendment is arguable rather than merely arithmetic: an axe's chain
should **accelerate** into a committed third swing (hit 3 startup ×0.65, recovery ×1.50 — a
harder commitment for a bigger payoff), a halberd's should **decelerate** as it recovers its
lane (hit 3 startup ×0.90, recovery ×1.25), and a fist's five-link flurry should stay flat. That
is a difference a player feels in the second hour and none of it is expressible today.

## Why it is filed rather than applied

`RI-CMB02` is owned by `critic.combat` and is authoritative over `RI-WPN02` §B by that item's own
authority note. `CORPUS-CONTRACT` §5 permits a critic to extend the corpus, not to overwrite
another area's published table. The `12-weapons` side of the change — the per-class multiplier
columns in `RI-WPN02` §B and the deviation count — is written and waiting on this ruling; until
it lands, `Chg` and `RI-WPN02` §D's G7–G9 carry the chain axis on geometry alone, which is
correct but is half of what the user asked for.

## Provenance

`provenance: constructed`, confidence **high**. The uniformity of §C's chain rows is a direct
quotation. The −0.976 correlation between `Rh`'s gap components and `r1_startup` is computed
over `RI-WPN02` §B's fourteen melee rows and is reproducible by hand. The proposed ±0.20 budget,
the ≥6-class deviation requirement and the per-link readability rule are defined here and are
new; no upstream source publishes per-class chain multipliers, and the design-intent examples are
illustrations, not measurements.

Cross-dependencies: `RI-CMB02` owns every multiplier and wins outright; `RI-WPN02` §B carries the
per-class columns if granted; `RI-WPN03` §D.3 and `RI-WPN02` §D consume the result.
