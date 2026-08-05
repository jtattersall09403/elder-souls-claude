---
id: RI-PRG05
title: The gold economy — prices, merchant pools, barter, and the regional balance sheet
kind: number
side: morrowind
judges: [economy.gold, economy.barter, economy.merchants, world.transport, progression.training]
provenance: constructed
confidence: medium
blind_pair: no
---

## The bar

Per S15, **gold is the only currency in the game.** That is a much heavier load than gold
carries in Morrowind, where it is one of several ways to get stronger, and an infinitely
heavier load than it carries in Dark Souls, where it does not exist. Everything transactional
runs through it: repairs, arrows, potions, training, beds, transport, bribes, spells,
armour, the smith's labour, land. And it must do all that while satisfying two constraints
that pull against each other. First, gold must **always be worth picking up** — a purse in a
chest in hour nineteen must still mean something, or half the hand-placed loot in
`corpus/50-world/` becomes litter. Second, gold must **never trivialise progression** — no
amount of it may substitute for exploring, levelling or getting better, because the moment
it can, the Souls power curve becomes a shopping trip.

The reconciliation is arithmetic, not rhetoric: **there is deliberately not enough gold.**
Across the whole game a player earns **98,000 gold** and the total price of everything for
sale is **215,000**. You can afford **45.6%** of the shop. Strip out the things you must
buy to function — repairs, ammunition, potions, fares, the smith's fee on your one main
weapon — and you are left with **35,900 gold against a 152,900-gold menu of optional
things: 23.5%.** Gold never trivialises because gold never *finishes*. You do not solve the
economy; you choose within it, forever, and the choices are legible: this land grant, or
your second weapon to +10 and every trainer in the marsh.

## The reference artifact

Machine-readable: **`corpus/20-progression/RI-PRG05-gold-economy.json`**

### 1. The headline balance

| Quantity | Gold |
|---|---:|
| Total income, entire playthrough | **98,000** |
| Necessary sinks (repair, ammo, potions, lodging, fares, smith labour on **one** weapon to +10) | **62,100** |
| **Leftover for everything optional** | **35,900** |
| Discretionary menu (training, bribes, spells, armour, 2nd/3rd weapons, dues, house, land, guild hall) | **152,900** |
| **Total price of everything for sale** | **215,000** |
| **Overall affordability** | **45.6%** |
| **Discretionary affordability** | **23.5%** |

### 2. Price list

| Item / service | Gold (base, before multipliers) |
|---|---:|
| **Ammunition** | |
| Iron arrow | 3 |
| Barbed arrow | 12 |
| Glass-tipped arrow | 40 |
| Steel bolt | 5 |
| **Consumables** | |
| Minor healing draught | 25 |
| Healing draught | 60 |
| Greater healing draught | 150 |
| Cure disease | 90 |
| Antidote | 35 |
| Common alchemy reagent | 8 |
| Rare alchemy reagent | 140 |
| Lockpick | 18 |
| Probe | 22 |
| **Repair** (at a smith; field kits are self-service) | |
| Light weapon, full | 45 |
| Heavy weapon, full | 110 |
| Armour piece, full | 70 |
| Field repair kit (one use, 60% restore) | 95 |
| **Lodging** | |
| Common bed | 10 |
| Private room | 40 |
| **In-fiction transport** (S7 — the only long-distance travel) | |
| Short hop, within region | 12 |
| Regional crossing | 45 |
| Cross-map | 90 |
| **Magic** | |
| Tier-1 spell | 220 |
| Tier-2 spell | 900 |
| Tier-3 spell | 3,400 |
| **Smith labour, per upgrade tier** (material supplied by you — RI-PRG08) | |
| +1 / +2 / +3 | 120 / 200 / 320 |
| +4 / +5 / +6 | 560 / 800 / 1,100 |
| +7 / +8 / +9 | 1,600 / 2,200 / 3,000 |
| +10 | 4,500 |
| *One weapon, +0 → +10, labour only* | **14,400** |
| **Property (terminal sinks)** | |
| Stilt-house deed | 12,000 |
| Land grant | 30,000 |
| Guild-hall endowment | 24,000 |

**Formulaic prices:**

| Service | Formula | Example |
|---|---|---|
| **Skill training** (one skill point, RI-PRG03) | `12 × current_skill_level`, and **never above the trainer's own level in that skill** | Blades 40→50 costs 12×(40+41+…+49) = **5,340 g** |
| **Bribe** | `45 + 9 × (disposition points needed)` | +20 disposition = **225 g** |

**Training raises skills. Training never raises an attribute and never grants a level.**
This is the wall that keeps gold out of RI-PRG01's curve: there is no gold path to an
attribute point except the indirect one — buy skill, cross a 15-threshold, earn the point
(RI-PRG02 §2) — which is capped at one point per 15 skill levels and priced accordingly.

### 3. Barter — the price multipliers

```
buy_mult  = clamp( 1.55 − 0.0060·Disposition − 0.0035·Mercantile − 0.0040·Personality, 0.80, 1.60 )
sell_mult = clamp( 0.22 + 0.0025·Disposition + 0.0022·Mercantile + 0.0018·Personality, 0.20, 0.60 )
```

| Character | Disp | Merc | Pers | buy | sell | Round-trip efficiency |
|---|---:|---:|---:|---:|---:|---:|
| Fresh, no social investment | 40 | 5 | 10 | **1.25×** | **0.35×** | 0.28 |
| The Shell-Warden (RI-PRG02) | 30 | 10 | 10 | **1.30×** | **0.34×** | 0.26 |
| Mid-game generalist | 60 | 45 | 30 | **0.91×** | **0.52×** | 0.57 |
| The Fence (RI-PRG02) | 70 | 62 | 60 | **0.80×** (floor) | **0.60×** (ceiling) | **0.75** |

**The Fence's effective purchasing power is ~2.9× the Shell-Warden's.** That spread is the
justification for PERSONALITY existing as an attribute at all, and it is why RI-PRG02 can
claim a social build is a real build rather than a flavour text.

**The flip invariant, enforced globally:** `max(sell_mult) = 0.60 < min(buy_mult) = 0.80`.
Buying an item and immediately reselling it always loses at least 25% of the outlay. No
disposition, no skill, no faction discount, no quest reward may ever break this. It is the
only thing standing between this economy and an infinite-money exploit.

### 4. Merchant gold pools

A merchant cannot pay you more gold than they have.

| Region | Total merchant gold pool | Merchants |
|---|---:|---|
| R1 | 2,400 | 3 |
| R2 | 4,200 | 4 |
| R3 | 6,800 | 5 |
| R4 | 9,500 | 5 |
| R5 | 12,000 | 6 |
| R6 | 15,000 | 6 |
| **Total** | **49,900** | **29** |

- Pools regenerate **+25% of cap per in-game day** (one in-game day = 48 real minutes,
  RI-PRG04 §2) and never exceed cap.
- A merchant only buys goods in their trade category. A smith will not buy your reagents.
- **Mercantile ≥ 40** unlocks part-payment in goods; **Mercantile ≥ 70** lets you sell to an
  exhausted merchant on credit, once per in-game day.
- Killing a merchant is permitted (S10) and permanently removes their pool, their inventory
  and their repair service from the world. Nothing respawns them (S5).

The pool is a **throttle, not a wall**. Typical sell income across the game is 40,000 gold
against 49,900 of instantaneous liquidity plus regeneration — so a player who sells steadily
is never blocked, and a player who hauls forty looted swords back at once is. That is the
intended behaviour: it makes looting a stream rather than a jackpot, and it is why the
carry-capacity term on STRENGTH (RI-PRG02) has teeth.

### 5. Where gold comes from, and the regional balance sheet

| Region | Caches | Quests | Selling | **Income** | **Necessary spend** | **Margin** | **Running balance** | Merchant pool |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| R1 | 900 | 1,200 | 1,400 | **3,500** | 2,920 | +580 | 580 | 2,400 |
| R2 | 1,800 | 2,600 | 2,900 | **7,300** | 4,920 | +2,380 | 2,960 | 4,200 |
| R3 | 3,000 | 4,500 | 5,000 | **12,500** | 9,560 | +2,940 | 5,900 | 6,800 |
| R4 | 4,200 | 7,000 | 7,800 | **19,000** | 13,100 | +5,900 | 11,800 | 9,500 |
| R5 | 5,500 | 9,500 | 10,500 | **25,500** | 14,300 | +11,200 | 23,000 | 12,000 |
| R6 | 6,800 | 11,000 | 12,400 | **30,200** | 17,300 | +12,900 | **35,900** | 15,000 |
| **Total** | 22,200 | 35,800 | 40,000 | **98,000** | **62,100** | **+35,900** | | 49,900 |

Necessary spend per region breaks down as smith labour on one weapon line (320 / 320 /
2,460 / 3,800 / 3,000 / 4,500), repair, ammunition, potions, lodging and fares.

Read the margin column. **R1's margin is 580 gold** — the player is genuinely poor for the
first two hours, a 45-gold repair is a real decision, and a 220-gold tier-1 spell is a
sacrifice. **R6's margin is 12,900** — a comfortable but not lavish late game where a
30,000-gold land grant is still out of reach unless you gave up training entirely. The
curve of that column is the whole emotional arc of the economy and it must stay monotonic
and always positive: never bankrupt, never rich.

**Gold sources are hand-placed (S12).** No procedural drop tables, no gold-per-kill. Ordinary
enemies drop **souls, not gold** — a corpse may carry a hand-authored purse if the designer
put one there, and most do not. This is the cleanest structural reason gold cannot be farmed:
**there is nothing to farm.** Enemies respawn (S5) and their souls respawn with them; their
hand-placed loot does not.

### 6. The four reasons gold never trivialises

1. **It cannot buy levels.** Souls buy levels and only souls (S15, RI-PRG01). Training buys
   skills, capped and priced steeply.
2. **It cannot buy upgrade materials.** Every +N material is hand-placed and unpurchasable
   (RI-PRG08). Gold buys the smith's *time*; exploration buys the *stone*.
3. **It cannot buy flasks.** Sap-buds and Heart-resin are unpurchasable (RI-PRG04 §4).
4. **It cannot be farmed.** Enemies drop souls; gold is hand-placed and finite; the
   flip invariant makes trading unprofitable; merchant pools throttle liquidation.

Every one of those four is a hard rule with a grep-able assertion below. Remove any one and
the economy becomes solvable, at which point gold stops being a pressure and becomes a
progress bar.

## Comparison method

1. **Balance sheet.** Load `game/src/data/economy.json`. Sum all authored gold sources
   (caches, quest rewards, base value of sellable loot × 0.48 mean sell multiplier).
   **Assert total income ∈ [90,000, 106,000]** (98,000 ±8%). Sum all purchasable prices ×
   expected quantities. **Assert total sinks ∈ [198,000, 232,000].**
   **Assert `income / sinks ∈ [0.38, 0.53]`.** A ratio above 0.75 means the economy is
   solvable and fails.
2. **Per-region solvency.** Compute income − necessary spend for each region.
   **Assert every region's margin is strictly positive** and **assert the running balance is
   monotonically increasing.** **Assert R1's margin ≤ 1,200** (early poverty is required)
   and **assert the final balance ∈ [28,000, 44,000]** — enough for one terminal sink, never
   two.
3. **Barter formulas.** Evaluate both multipliers at the four §3 character rows.
   **Assert within 0.02 of {1.25/0.35, 1.30/0.34, 0.91/0.52, 0.80/0.60}.**
   **Assert the clamps are enforced** by evaluating at Disp/Merc/Pers = 100/100/99 and
   0/0/1 and checking the results are exactly 0.80/0.60 and 1.60/0.20.
4. **THE FLIP INVARIANT.** Fuzz 10,000 random (Disposition, Mercantile, Personality,
   faction-standing, item) tuples. For each, compute `sell_mult(x) / buy_mult(x)`.
   **Assert the maximum over all 10,000 is ≤ 0.76.** Then buy-and-immediately-resell 200
   distinct items in a live session and **assert net gold is negative in all 200 cases.**
   A single positive case is an infinite-money exploit and an **automatic fail**.
5. **S15 — no soul prices.** `grep -rniE "souls" game/src/data/*.json` on merchant,
   training, transport, repair and property records. **Assert zero price fields denominated
   in souls.** Cross-referenced with RI-PRG01 method 5.
6. **The four un-buyables.** **Assert** that no merchant inventory anywhere contains: an
   attribute point, a character level, any RI-PRG08 upgrade material, a Sap-bud, or a
   Heart-resin. Do this by scanning every merchant record's item list against those five
   id-classes. **Assert zero matches.** Any match fails this item **and** RI-PRG01 or
   RI-PRG08 by dependency.
7. **No gold farming.** Run 500 simulated kills of the R1 roster across 20 HEARTH rest
   cycles. **Assert total gold obtained from kills after the first pass is 0** — respawned
   enemies must yield souls and nothing else. **Assert gold-per-hour from any repeatable
   loop is under 150.**
8. **Merchant pools.** **Assert 29 merchants with pools summing to 49,900 ±10%.** Attempt to
   sell 20,000 gold of goods to one merchant: **assert the sale is capped at their pool**,
   **assert regeneration is +25% of cap per in-game day and never exceeds cap**, and
   **assert a killed merchant's pool is permanently gone.**
9. **Training cannot become levelling.** **Assert** the training service exposes no attribute
   or level products, **assert** cost equals `12 × current_skill_level` within 5%, and
   **assert** every trainer refuses to train past their own skill level.
10. **Price call sites (the PRG02 cross-check).** Buy the same item as the Shell-Warden and
    as the Fence. **Assert the prices actually differ by ≥40%.** This verifies PERSONALITY
    and Mercantile are *read by the shop*, not merely defined — the failure RI-PRG02's
    "How we lose" predicts.

## Scoring

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| Balance | income/sinks 0.42–0.50 | 0.38–0.53 | >0.75 (economy solvable) or <0.25 (unplayable poverty) |
| Regional solvency | all margins positive, monotonic, R1 ≤1,200 | all positive | any region bankrupt, or R1 margin >3,000 (no early poverty) |
| Barter | all four rows within 0.01, clamps exact | within 0.02 | prices are flat — Personality/Mercantile do nothing |
| **Flip invariant** | max ratio ≤0.72, 200/200 losses | ≤0.76, 200/200 | **any** profitable flip → **automatic fail** |
| S15 | zero soul prices | zero | any → **automatic fail** (AR-2) |
| Un-buyables | all five absent from every merchant | all five absent | any purchasable → **automatic fail** |
| Farming | repeatable-loop gold <100/h | <150/h | enemies drop gold on respawn |
| Pools | 29 merchants, ±5%, regen exact | ±10% | infinite merchant gold |
| Call sites | ≥40% price spread realised in-game | ≥40% | multipliers defined but unread |

**Failure threshold: any axis below 6.**

## How we lose

- **There is nothing to buy.** The classic Souls-like economy failure: a currency, three
  merchants, two hundred healing herbs and nothing else, and by hour six the player has
  8,000 gold and no reason to pick up more. Every purse in `corpus/50-world/` becomes
  litter and half the reward vocabulary of the world dies. The 152,900-gold discretionary
  menu exists to prevent exactly this, and it must be *implemented*, not merely tabulated —
  method 1 sums shipped prices, not this document's.
- **There is too much to buy and not enough gold, so nothing is worth saving for.** The
  opposite failure and nearly as bad: if the player can afford 4% of the menu, the menu is
  wallpaper and they stop reading it. 23.5% discretionary affordability is chosen so that a
  real purchase is always about two hours away.
- **Gold gets farmable.** Someone adds a small gold drop to ordinary enemies "so combat feels
  rewarding". Enemies respawn at every rest (S5). The economy is now unbounded, the balance
  sheet is fiction, and every price in §2 is meaningless. This is the highest-probability
  failure in this item and method 7 is aimed squarely at it.
- **A profitable flip appears.** Not through the base multipliers — through a *special case*.
  A faction discount stacking below 0.80. A quest reward item with a base value higher than
  its purchase price. A merchant who buys outside their category at full rate. Any one of
  these is an infinite-money machine within ten minutes of a player finding it. Method 4
  must fuzz, not spot-check.
- **Upgrade materials or flask upgrades reach a shop.** Then gold *is* the power curve,
  exploration becomes optional, RI-PRG08 collapses, and we have shipped a Souls-like where
  the correct strategy is to farm a merchant. Method 6.
- **Merchant pools are infinite.** Trivial to implement infinitely and easy to forget. The
  player hauls their entire dungeon back and sells it, gets 30,000 gold in hour eight, and
  the R1–R3 poverty arc — the best part of the economy — never happens.
- **Prices are defined but never read.** PERSONALITY and Mercantile exist in the stat sheet,
  appear in this document's formulas, and the shop UI charges base price to everyone. Passes
  methods 3 and 6; fails only method 10. This is the most likely *silent* failure in the
  whole progression area, because nothing is broken and nothing is missing — a stat is
  simply inert.
- **Training becomes a levelling shortcut.** A trainer who sells attribute points for gold
  routes around RI-PRG01's entire curve. It will be proposed as "a gold sink for the late
  game", and it is the one gold sink we can never have.
- **The terminal sinks are cut for being unfinishable.** The land grant at 30,000 against a
  35,900 leftover looks like bad math to anyone who hasn't read the intent. It is the intent:
  the last purchase must be one you can *just barely* make, once, having given up everything
  else. Cut it and the leftover has nowhere to go and the late economy goes slack.
- **Repair is priced as a nuisance rather than a cost.** At 16,800 lifetime gold, repair is
  27% of necessary spend and the main reason gold keeps mattering in hour eighteen. Make it
  free or trivial (or remove durability) and the recurring half of the economy vanishes,
  leaving only one-off purchases that eventually run out.

## Provenance note

**Every number in this item is `constructed`.** No price, pool, formula or balance figure is
taken from Morrowind or any other game.

Two structural debts are `canonical-recall` at medium confidence: Morrowind's
disposition-and-mercantile-modified barter prices with finite merchant gold pools that
regenerate over time, and Morrowind's training-for-gold service. The *shape* is theirs; the
coefficients, clamps, the flip invariant and the entire balance sheet are ours.

Confidence is **medium**, and specifically lower than RI-PRG01–03, for one reason: the
income side of the balance sheet is a **budget handed to other agents, not a measurement.**
The 22,200 gold of caches presumes `corpus/50-world/` places that much; the 35,800 of quest
rewards presumes `corpus/30-quests/` awards that much; the 40,000 of selling presumes a loot
table of roughly 83,000 gold in base value. **None of those three items exists yet.** When
they do, method 1 must be re-run against the shipped totals and this table amended — the
*ratios* (45.6% overall, 23.5% discretionary, positive-and-monotonic regional margins) are
the binding part and must be preserved; the absolute gold figures are derived and should
move to whatever the real world contains.

The **flip invariant and the four un-buyables are not budgets and do not move.** They are
rules, they follow directly from S15, and they are binding at confidence high.
