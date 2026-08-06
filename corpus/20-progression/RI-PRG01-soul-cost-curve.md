---
id: RI-PRG01
title: The soul cost curve — souls-to-next-level, L1 to L140
kind: number
side: souls
judges: [progression.level_cost, progression.levelup_ui, economy.souls]
provenance: constructed
confidence: high
blind_pair: no
---

## The bar

Levelling must feel like a Souls game: one currency, one curve, no piecewise cliffs, and a
cost that grows fast enough that a level bought at 90 is a genuine expedition while a level
bought at 12 is a five-minute errand. The curve is cubic-dominant, so the *marginal* level
never becomes free, and the ratio between the cost of your next level and your last level
stays in a narrow band (1.02–1.10) across the whole range — you should never be able to
point at a level where the curve "opens up". Souls buy levels and **nothing else** (S15):
every soul you earn has exactly one destination, so the curve alone determines the entire
power-acquisition pace of the game. Our game is a 15–25 hour experience against Dark Souls'
~40, so the curve is deliberately *steeper than DS1 in the first 25 levels* (early levels
must be earned, not gifted) and *shallower after 40* (we do not have 40 hours of farm to
amortise a 90,000-soul level). Total cost to any level above 80 sits at a stable 0.68× the
Dark Souls figure — the same shape, two-thirds the mass.

## The reference artifact

### The canonical formula

```
cost(n) = round( 0.015·n³ + 2.00·n² + 55·n + 300 )
```

where `n` is the level **being purchased** (the cost of moving from `n-1` to `n`).
Level 1 is free and is the character's starting level for all origins. There is no
piecewise band, no separate early-game formula, and no cap: the curve is defined for
`n ∈ [2, ∞)` and tabulated to 140.

```
total(L) = Σ  cost(n)   for n = 2..L
```

Full machine-readable table (every level 2–140, with the Dark Souls reference column):
**`corpus/20-progression/RI-PRG01-soul-cost-curve.json`**

### Sampled table — ours vs Dark Souls

`DS` columns use the community-documented Dark Souls formula (identical in DS1 and DS3):
levels 2–12 `0.0068n³ − 0.06n² + 17.1n + 639`; levels 13+ `0.02n³ + 3.06n² + 105.6n − 895`.

| Level | Our cost | Our cumulative | DS cost | DS cumulative | cum. ratio | our cost(n)/cost(n−1) |
|---:|---:|---:|---:|---:|---:|---:|
| 2 | 418 | 418 | 673 | 673 | 0.62 | — |
| 5 | 627 | 2,081 | 724 | 2,794 | 0.74 | 1.10 |
| 10 | 1,065 | 6,483 | 811 | 6,672 | 0.97 | 1.08 |
| 15 | 1,626 | 13,439 | 1,445 | 12,070 | 1.11 | 1.07 |
| 20 | 2,320 | 23,594 | 2,601 | 22,681 | 1.04 | 1.06 |
| 25 | 3,159 | 37,652 | 3,970 | 39,704 | 0.95 | 1.06 |
| 30 | 4,155 | 56,371 | 5,567 | 64,252 | 0.88 | 1.05 |
| 40 | 6,660 | 111,110 | 9,505 | 140,729 | 0.79 | 1.04 |
| 50 | 9,925 | 195,004 | 14,535 | 262,493 | 0.74 | 1.04 |
| 60 | 14,040 | 316,149 | 20,777 | 441,126 | 0.72 | 1.03 |
| 70 | 19,095 | 483,538 | 28,351 | 689,404 | 0.70 | 1.03 |
| 80 | 25,180 | 707,069 | 37,377 | 1,021,310 | 0.69 | 1.03 |
| 90 | 32,385 | 997,538 | 47,975 | 1,452,022 | 0.69 | 1.03 |
| 100 | 40,800 | 1,366,635 | 60,265 | 1,997,921 | 0.68 | 1.03 |
| 110 | 50,515 | 1,826,958 | 74,367 | 2,676,589 | 0.68 | 1.02 |
| 120 | **61,620** | **2,391,999** | 90,401 | 3,506,802 | 0.68 | 1.02 |
| 130 | 74,205 | 3,076,158 | 108,487 | 4,508,543 | 0.68 | 1.02 |
| 140 | 88,360 | 3,894,729 | 128,745 | 5,702,990 | 0.68 | 1.02 |

### Headline numbers to hold onto

| Quantity | Value |
|---|---:|
| Souls to reach L50 | **195,004** |
| Souls to reach L120 | **2,391,999** |
| cost(L120) ÷ cost(L20) | **26.6×** |
| cost(L120) ÷ cost(L2) | **147×** |
| Total souls in the world, one playthrough, zero farming (RI-PRG06) | 1,124,285 |
| Therefore: L120 costs **2.13× the entire world's soul budget** | — |

That last row is the design's spine. **L120 is not a first-clear level.** A perfect,
lossless 100% clear of every enemy in the game lands at **L93**. A realistic first clear
lands at **L82** (RI-PRG06). L120 exists as an NG+/deliberate-farm destination, exactly as
SL120 functions in Dark Souls as a meta target rather than a story-completion level.

### What a level buys

One level = **+1 attribute point**, freely allocated, subject to the attribute caps in
RI-PRG02. This is the Souls half of seam S2: souls own the currency and the curve.
Morrowind owns what the sheet *contains* and supplies a **second, parallel** stream of
attribute points earned by skill use (RI-PRG02 §"Two streams", RI-PRG03) — but that stream
costs no souls and is not part of this curve.

### Where you spend

Only at a HEARTH (RI-PRG04). Levelling is not available from a menu in the field. There is
no un-levelling, no respec item purchasable with gold, and no soul refund.

### Souls are not money

Per S15, decreed: souls level you and **only** level you. There is no merchant who takes
souls, no upgrade that consumes souls, no fast-travel toll in souls, no consumable soul
item that can be sold for gold. A build that "saves souls to buy a weapon" is not a legal
build because the transaction does not exist. Gold does all commerce (RI-PRG05); found
materials do all upgrading (RI-PRG08).

## Comparison method

A fresh agent runs all six assertions. Any failure fails the item.

1. **Formula fidelity.** Load `game/src/data/progression.json`. For every level
   `n ∈ [2,140]`, compute `expected = round(0.015n³ + 2n² + 55n + 300)` and compare to the
   shipped `cost` field. **Assert `abs(shipped − expected) / expected ≤ 0.08` for every n**,
   and `≤ 0.03` for the mean absolute relative error across all 139 levels.
2. **Cumulative anchors.** Compute `total(50)`, `total(80)`, `total(120)` from the shipped
   table. **Assert** `total(50) ∈ [179,400, 210,600]` (195,004 ±8%),
   `total(80) ∈ [650,500, 763,600]`, `total(120) ∈ [2,200,600, 2,583,400]`.
3. **Superlinearity / anti-flatness.** **Assert** `cost(120)/cost(20) ≥ 20` and
   `cost(60)/cost(30) ≥ 3.0`. A linear or logarithmic curve fails here. Also fit
   `log(cost)` against `log(n)` over `n ∈ [40,140]` and **assert the fitted exponent
   ≥ 2.4** (our curve's local exponent there is ~2.6; a quadratic-only curve gives 2.0 and
   fails, a linear curve gives 1.0 and fails badly).
4. **Monotone smoothness.** **Assert** `cost(n) > cost(n−1)` for all n, and that
   `cost(n)/cost(n−1)` never exceeds 1.12 nor falls below 1.015 for `n ≥ 5`. This catches
   piecewise cliffs and any "free level" band.
5. **S15 enforcement — souls are never money.** `grep -rniE
   "soul[s]?_?(cost|price)|price.*souls|souls.*(purchase|buy|shop|vendor|merchant|repair|upgrade|fare|toll)"
   game/src/`. **Assert zero hits outside the level-up module.** Then load the shipped
   merchant/shop/upgrade data files and **assert no record has a currency field whose value
   is `souls`** — every price field must resolve to gold. One hit = automatic fail (this is
   also an AR-2 Morrowind-leakage failure).
6. **Sim cross-check against yield.** Run the RI-PRG06 harness
   (`corpus/80-methods/sim-souls-yield.md`): sum every soul value in the shipped enemy
   roster, feed the total through this curve, and **assert the resulting level is in
   [88, 98]** (our world budget of 1,124,285 souls yields exactly L93). If the roster and
   the curve disagree, one of PRG01/PRG06 is wrong and both must be re-derived together.

## Scoring

Score 0–10 per axis, take the minimum; the item's verdict is the minimum score.

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| Formula match | max rel. error ≤3% at every level | max ≤8%, mean ≤3% | any level off by >8%, or formula not cubic |
| Cumulative anchors | all three within 3% | all three within 8% | any anchor outside 8% |
| Superlinearity | fitted exponent ≥2.5 and ratio ≥25× | exponent ≥2.4, ratio ≥20× | exponent <2.0 (curve is quadratic-or-flatter) |
| Smoothness | ratio band within [1.02, 1.10] | within [1.015, 1.12] | any cliff >1.2 or any plateau <1.0 |
| S15 purity | zero soul-price references anywhere | zero outside level-up | one or more soul purchases exist → **automatic fail of the piece** |

**Failure threshold: any axis below 6.** Axis 5 has no partial credit — a single place
where souls buy a thing fails the whole progression area, not just this item, per AR-2.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 | 6 / 10 | 8 / 10 |

**Aggregation (a property of this item, not of the critic):** min-over-axes — the item's score is the lowest axis, never the mean.

## How we lose

- **The curve goes linear or near-linear.** The likeliest failure: a builder writes
  `cost = 500 * level` because it is one line, and by L90 a level costs 45,000 while an
  ordinary R6 enemy drops 4,000 — twelve kills a level, forever. The whole late game
  becomes free levelling and the difficulty curve inverts. Detected by method 3.
- **A piecewise "early game" band that never closes.** Someone adds a cheap band for
  levels 1–20 to make the tutorial feel good, gets the join wrong, and the discontinuity
  leaves a plateau where five consecutive levels cost the same. Detected by method 4.
- **Soul income is retuned without retuning the curve.** Enemy soul values get buffed for
  "game feel" in a combat pass, nobody re-runs the sim, and the player arrives at region 4
  at L80 with nothing left to spend on. Detected by method 6 — and this is why 6 exists.
- **Souls leak into commerce.** The single most likely S15 violation is not a shop — it is
  a *convenience*: "spend 500 souls to repair here", "spend souls to warp", a boss-soul
  consumable that a merchant will buy for gold. Any of these makes souls fungible and
  destroys the one-currency-one-purpose decree. Detected by method 5.
- **Levels get a second purchase path.** A "training" NPC who grants attribute points for
  gold would bypass the curve entirely and make gold the levelling currency. Training in
  RI-PRG05 raises **skills**, never attributes, precisely to close this hole.
- **Respec is sold.** A gold-priced respec turns every build into every other build and
  erases the commitment that makes the Morrowind breadth in RI-PRG02 mean anything.
- **The table is right and the UI lies.** The level-up screen shows the cost of the *next*
  level while charging for the one after it (off-by-one on `n`), a 3–10% overcharge that no
  player can detect but that method 1 catches immediately if the UI is read rather than the
  data file. Critics must read the shipped data, not the screen.

## Provenance note

The **Dark Souls reference columns are `community-data`**, taken from the community-documented
level-up formula reproduced consistently across the Dark Souls wikis (levels 2–12:
`0.0068n³ − 0.06n² + 17.1n + 639`; levels 13+: `0.02n³ + 3.06n² + 105.6n − 895`), sourced
from [Dark Souls Wiki — Level Up](https://darksouls.fandom.com/wiki/Level_Up),
[Fextralife — Level (DS1)](https://darksouls.wiki.fextralife.com/Level) and
[Fextralife — Level (DS3)](https://darksouls3.wiki.fextralife.com/Level). These are
player-reconstructed fits to FromSoftware's tables, not the shipped tables themselves;
treat them as accurate to a few souls per level, not exact. Confidence: medium.

**Our formula, every number in the "ours" columns, and every threshold in the comparison
method are `constructed`** — designed for this project, chosen to preserve the Souls cubic
shape at 0.68× mass so a 20-hour game reaches a Souls-shaped level ceiling. They are fully
binding: a constructed bar we can measure beats a real number we cannot. Confidence high on
internal consistency (the JSON is generated from the formula and cross-checked against
RI-PRG06's roster), medium on whether 0.68× is the *right* mass — that judgement should be
revisited once RI-PRG06's hour budget is validated against the real map in `corpus/50-world/`.
