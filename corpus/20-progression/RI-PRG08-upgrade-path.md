---
id: RI-PRG08
title: The upgrade path — +N tiers, materials, damage progression, and exploration gating
kind: number
side: souls
judges: [progression.upgrade, progression.materials, economy.smithing, world.loot_placement, combat.damage_formula]
provenance: constructed
confidence: medium
blind_pair: no
---

## The bar

The +N upgrade path is the Souls power curve — the half of your strength that does not come
from levelling — and its defining property is that **it is bought with exploration, not with
accumulation.** In Dark Souls, a +10 weapon at soul level 30 is a statement that you went
somewhere. That property is fragile, and it dies in exactly one way: the moment a merchant
sells upgrade materials, exploration becomes optional and the entire power curve reduces to
"farm gold, then shop". Since S15 makes gold our only currency and RI-PRG05 gives it real
purchasing breadth, this pressure will be constant and it must be refused absolutely.

The reconciliation is a clean division of labour that satisfies both parents. **The smith
charges gold for their labour; the world supplies the stone.** Morrowind gets its economy —
you genuinely need money to upgrade, 14,400 gold to take one weapon to +10, 23% of your
lifetime income — and Souls gets its power curve, because all the gold in Black Marsh
cannot conjure a Deep-shard that is sitting behind an optional boss you never fought.
Beneath that sits a hard scarcity budget: **exactly 84 upgrade materials exist in the
world, exactly 2 weapons can ever reach +10, and 64% of the materials are off the critical
path.** A player who walks the main route and never explores finishes with one weapon at
**+8**. A player who explores everything finishes with two at **+10**, a third at **+7**, a
fourth at **+5**. That gap — 10% AR on your main weapon and a whole extra armed build — is
the entire reward structure of exploration, expressed as a number.

## The reference artifact

### 1. Damage progression per tier

```
AR(n) = base × (1 + 0.10·n)  +  base × gradeCoeff × scalingBonus × (1 + 0.08·n)
```

Base damage rises 10% of base per tier; the scaling contribution rises 8% per tier. Two
different rates, so that upgrading a low-scaling weapon is still worthwhile and upgrading a
high-scaling weapon does not run away.

**Worked example: base 130, printed A in STRENGTH (coeff 0.80), wielder at STRENGTH 40
(scalingBonus 0.850) with skill at the weapon's requirement (RI-PRG03 §5).**

| Tier | Base attack | Scaling | **AR** | vs +0 | Material for this step | Smith's fee |
|---|---:|---:|---:|---:|---|---:|
| **+0** | 130.0 | 88.4 | **218** | 1.00× | — | — |
| **+1** | 143.0 | 95.5 | **239** | 1.09× | 1 Silt-shard | 120 g |
| **+2** | 156.0 | 102.5 | **259** | 1.18× | 1 Silt-shard | 200 g |
| **+3** | 169.0 | 109.6 | **279** | 1.28× | 2 Silt-shard | 320 g |
| **+4** | 182.0 | 116.7 | **299** | 1.37× | 2 Bright-shard | 560 g |
| **+5** | 195.0 | 123.8 | **319** | 1.46× | 2 Bright-shard | 800 g |
| **+6** | 208.0 | 130.8 | **339** | 1.55× | 3 Bright-shard | 1,100 g |
| **+7** | 221.0 | 137.9 | **359** | 1.64× | 2 Deep-shard | 1,600 g |
| **+8** | 234.0 | 145.0 | **379** | 1.74× | 3 Deep-shard | 2,200 g |
| **+9** | 247.0 | 152.0 | **399** | 1.83× | 4 Deep-shard | 3,000 g |
| **+10** | 260.0 | 159.1 | **419** | **1.92×** | 1 **Heart-stone** | 4,500 g |

**+0 → +10 is a 1.92× damage multiplier**, and a **cumulative 4 Silt + 7 Bright + 9 Deep +
1 Heart-stone, plus 14,400 gold** in labour.

Compare the two power sources at their extremes. Upgrading from +0 to +10 multiplies your
damage by 1.92×. Taking STRENGTH from 10 to 99 — 89 levels, ~2.3 million souls, the entire
game's soul budget twice over — multiplies the *scaling half* of your AR by 6.25× but the
total AR only from 151 to 260, i.e. **1.72×**. **Upgrading is worth more than the entire
levelling curve**, and it costs 84 pieces of scavenged rock. That ratio is the design, and
it is why the materials must never be for sale.

### 2. The four materials

| Material | Tiers | In world | Where |
|---|---|---:|---|
| **Silt-shard** | +1 → +3 | **34** | R1 8 · R2 9 · R3 7 · R4 5 · R5 3 · R6 2 |
| **Bright-shard** | +4 → +6 | **26** | R2 3 · R3 8 · R4 8 · R5 5 · R6 2 |
| **Deep-shard** | +7 → +9 | **22** | R4 4 · R5 8 · R6 10 |
| **Heart-stone** | +10 | **2** | R5 1 · R6 1 |
| | | **84 total** | |

Names are **placeholders**; `corpus/50-world/` owns the fiction. Renaming must not change a
count.

Each material's distribution is front-loaded to its own tier band and tapers after — Silt is
abundant in R1–R3 and nearly gone by R6 — so that the material you find always matches the
upgrade you can currently use, without ever being *given* by the region you are in.

### 3. The scarcity budget — what 84 materials actually buys

| Sequence | Silt | Bright | Deep | Heart | Feasible? |
|---|---:|---:|---:|---:|---|
| 1st weapon → **+10** | 4 | 7 | 9 | 1 | ✅ (30 / 19 / 13 / 1 left) |
| 2nd weapon → **+10** | 4 | 7 | 9 | 1 | ✅ (26 / 12 / 4 / 0 left) |
| 3rd weapon → **+8** | 4 | 7 | 5 | 0 | ❌ **Deep-shard short by 1** |
| 3rd weapon → **+7** | 4 | 7 | 2 | 0 | ✅ (22 / 5 / 2 / 0 left) |
| 4th weapon → **+5** | 4 | 4 | 0 | 0 | ✅ (18 / 1 / 2 / 0 left) |
| Leftover Silt → 4 more weapons to **+3** | 16 | | | | ✅ (2 / 1 / 2 / 0 left) |

**The final budget on a 100% clear: two weapons at +10, one at +7, one at +5, four at +3.**

- **Heart-stone is the hard wall.** There are two. **Exactly two weapons in the game can ever
  reach +10**, and that decision is permanent (§6). It is intended to be the single most
  consequential irreversible choice a player makes.
- **Deep-shard is the soft wall.** 22 is one short of letting a third weapon reach +8. That
  is not an accident; it is the number that forces a player who wants a third real weapon to
  accept it will always be a step behind.
- **Silt-shard is deliberately abundant.** The 18 spare exist so that a player can take four
  more weapons to +3 and *try them* — experimentation must be cheap, commitment must be
  expensive. That asymmetry is what makes the 19-skill weapon sheet in RI-PRG03 explorable
  rather than a one-way door.

### 4. Exploration gating — the placement rule

| | Materials | Share |
|---|---:|---:|
| On the critical path (reachable without leaving the main route) | **30** | 36% |
| Off the critical path — optional areas, minibosses, tier-3+ locks, hidden routes, non-combat quest rewards | **54** | **64%** |

**Binding placement rules:**

1. **≥ 60% of all upgrade materials must be off the critical path.** This is the item's core
   assertion.
2. **Both Heart-stones are off the critical path.** A player who does not explore cannot
   reach +10 at all.
3. **No material is placed behind a single skill.** Every off-path material has ≥ 2 access
   routes (RI-PRG03 method 8) — a lock *or* a key, a climb *or* a bribe, a fight *or* a
   sneak. Exploration is mandatory; a specific build is never mandatory.
4. **Materials are hand-placed (S12).** No drop tables, no procedural generation, no
   percentage chances.
5. **No respawning enemy ever drops one.** They respawn (S5); the material would too, and
   the wall would become a grind.
6. **A named NPC who can be killed (S10) never carries the only copy of anything.** If a
   material is on a killable NPC, an alternate copy exists elsewhere.

**Critical-path-only outcome:** 12 Silt, 9 Bright, 8 Deep, 0 Heart → **one weapon at +8, and
nothing else upgraded.** AR 379 against the explorer's 419 on the same weapon (−9.6%), and
one armed loadout against four. That is the price of not looking around, and it is designed
to be *felt* rather than *fatal* — a skilled player can finish the game at +8, and should.

### 5. Infusions (the branch)

At **+6** a weapon may be permanently infused, converting some of its scaling.

| Infusion | Effect | Material | In world |
|---|---|---|---:|
| Ember | 35% of physical → fire; STR/AGI scaling −1 grade; +INT scaling C | Ember-core | 1 |
| Rime | 30% → frost; adds frost buildup 45; scaling −1 grade | Rime-core | 1 |
| Venom | adds poison buildup 60; +LUCK scaling C; base −8% | Venom-core | 1 |
| Root | 30% → hist; scaling converts to HIST-BOND at printed grade | Root-core | 1 |

**Four cores exist. Each is unique, unbuyable, and off the critical path.** An infusion is
permanent and cannot be removed or transferred. Infusion does not consume upgrade tiers —
an infused weapon still climbs to +10 on the same material schedule.

### 6. Rules of the forge

| Rule | |
|---|---|
| **Materials are never purchasable** | Not by gold, not by souls, not by barter, not as a quest reward from a merchant, at any disposition or faction rank. **Absolute.** |
| **Materials are never craftable** | No alchemy, no combining three Silt into a Bright, no transmutation |
| **Upgrades are irreversible** | No downgrade, no material reclamation, no transferring +N between weapons |
| **Infusions are irreversible** | Permanent per weapon |
| **Gold is required but never sufficient** | You must have both the material and the fee. A smith with your gold and no stone does nothing |
| **Upgrading requires a smith NPC** | Not a HEARTH, not a menu. Smiths keep shop hours (RI-PRG05 / RI-PRG04 §2) — a badly-timed rest can cost you an upgrade until morning |
| **Smiths can be killed** | (S10) A dead smith's service is gone permanently. There are **5 smiths**; the highest tier one can reach differs (R1 smith caps at +3; only the R5 and R6 smiths work Deep-shard and Heart-stone) |
| **Armour does not upgrade** | Armour is found, not improved. One upgrade axis, not two — the +N curve stays legible |

### 7. Upgrade pace against the region curve

| Region | Expected main-weapon tier | AR (base-130 A/STR-40 example) | Enemy tier faced |
|---|---|---:|---|
| R1 | +1 → +2 | 239 → 259 | 35–190 souls |
| R2 | +3 → +4 | 279 → 299 | 140–520 |
| R3 | +5 → +6 | 319 → 339 | 330–1,250 |
| R4 | +7 | 359 | 760–2,600 |
| R5 | +8 → +9 | 379 → 399 | 1,200–4,200 |
| R6 | +10 | 419 | 2,100–6,200 |

Roughly **+1.7 upgrade tiers per region**, versus **+13.5 character levels per region**
(RI-PRG06). The two curves are deliberately different shapes: levels arrive continuously and
in large numbers, upgrades arrive rarely and land hard. A player should be able to name the
moment they hit +7. They will never name the moment they hit level 58.

## Comparison method

1. **Damage formula.** Load `game/src/data/upgrades.json`. Evaluate AR for the §1 fixture
   (base 130, grade A, STR 40) at every tier. **Assert each within 3% of
   {218, 239, 259, 279, 299, 319, 339, 359, 379, 399, 419}.**
   **Assert `AR(+10) / AR(+0) ∈ [1.85, 2.00]`.**
2. **Material schedule.** **Assert the cumulative cost of +0→+10 is exactly
   {Silt 4, Bright 7, Deep 9, Heart 1}.**
3. **Scarcity budget.** Count every upgrade material in the shipped world data.
   **Assert totals are exactly {34, 26, 22, 2}** (±2 on the first three, **exactly 2** on
   Heart-stone). Then run the §3 greedy allocation. **Assert: exactly 2 weapons can reach
   +10; a 3rd cannot exceed +7; a 4th cannot exceed +5.**
4. **THE PURCHASE ASSERTION.** Scan every merchant inventory, every quest reward, every
   craftable recipe, every container that respawns, and every loot table.
   **Assert zero upgrade materials and zero infusion cores appear in any of them.**
   Then, in a live session, set gold to 10,000,000 and attempt to acquire a Deep-shard
   through every merchant, trainer, faction reward and barter path. **Assert all fail.**
   One success = **automatic fail of this item and of RI-PRG05 by dependency**, and is an
   AR-2 Morrowind-leakage violation of S15.
5. **Exploration gating.** Tag every material placement as on- or off-critical-path using
   the shipped route graph from `corpus/50-world/`. **Assert off-path share ≥ 0.60**
   (target 0.64) and **assert both Heart-stones are off-path.**
6. **Critical-path-only run.** Sim a playthrough that collects only on-path materials.
   **Assert the best achievable weapon tier is +8, not +9 or +10**, and **assert its AR is
   9–12% below the full-clear +10.** If a path-only run reaches +10, exploration is
   decorative.
7. **No respawn farming.** Kill and rest 100 times across the full roster.
   **Assert zero upgrade materials are obtained after the first pass** (S5 interaction).
   **Assert materials-per-hour from any repeatable loop is exactly 0.**
8. **Two-route rule.** For every off-path material, **assert ≥2 distinct access routes**
   exist in the route graph. A material reachable only by Security 80 locks a build out of
   the power curve.
9. **Irreversibility.** Attempt to downgrade, reclaim, or transfer an upgrade and to remove
   an infusion. **Assert all four are impossible** through every UI and data path.
10. **Gold-necessary-but-insufficient.** With 0 gold and a full material set, attempt an
    upgrade: **assert refusal.** With 1,000,000 gold and no material: **assert refusal.**
    **Assert lifetime smith labour for one weapon to +10 = 14,400 g ±5%**, cross-checked
    against RI-PRG05's necessary-spend column.
11. **Pace cross-check.** From the RI-PRG06 sim, record expected main-weapon tier at each
    region boundary. **Assert within ±1 tier of §7** and **assert total tiers gained ≈ 10
    over ≈ 82 levels**, i.e. an upgrade:level ratio in **[1:7, 1:9]**.

## Scoring

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| Damage curve | all tiers within 1%, ratio 1.90–1.95× | within 3%, ratio 1.85–2.00× | <1.4× (upgrades don't matter) or >2.6× (upgrades are the only thing that matters) |
| Scarcity | exact counts, exactly 2 at +10 | ±2 on shards, exactly 2 Heart | any material unbounded in supply |
| **Purchasability** | zero paths, 10M-gold probe fails | same | **any** purchase path → **automatic fail** |
| Exploration gating | off-path ≥0.64, both Hearts off-path | ≥0.60, both Hearts off-path | <0.40 off-path, or a Heart on the critical path |
| Path-only outcome | exactly +8, AR −9 to −12% | +8, AR −7 to −15% | path-only reaches +10 |
| No farming | 0 materials from respawns | same | any respawn-farmable material |
| Two routes | every off-path material ≥2 routes | ≥2 routes | any material behind exactly one skill |
| Irreversibility | all four blocked | all four blocked | any reclaim/respec of upgrades |
| Pace | ratio 1:8, within ±0.5 tier | 1:7–1:9, ±1 tier | upgrades arrive as a lump, or one per level |

**Failure threshold: any axis below 6.** The purchasability axis is binary.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 | 6 / 10 | 8 / 10 |

**Aggregation (a property of this item, not of the critic):** min-over-axes.

## How we lose

- **Materials go on sale.** The defining failure mode of this item, and it will not arrive as
  a decision — it will arrive as a *fix*. "Players who missed the R4 optional area are stuck
  at +6, let's have the R5 smith sell Bright-shards." That one shop entry converts the whole
  power curve into a gold sink, makes exploration optional, gives RI-PRG05's economy a
  power-purchase it must never have, and violates S15's spirit even though no souls change
  hands. Method 4 must be run as a **live 10-million-gold acquisition probe**, not a data
  scan, because the leak will be in a faction reward or a barter special case rather than a
  shop list.
- **Materials become farmable from respawning enemies.** Titanite farming is a real thing in
  Dark Souls and someone will consider it authentic. Our enemies respawn at every rest
  (RI-PRG04), so a droppable material is an infinite material, and the 84-piece scarcity
  budget — which every number in §3 depends on — evaporates. Method 7.
- **Material counts inflate during production.** The 84 total is fragile: every optional area
  a designer adds "needs a reward", and the natural reward is a shard. At 120 materials, four
  weapons reach +10, the Heart-stone decision stops being a decision, and the most
  consequential permanent choice in the game becomes a shrug. Method 3's exact-count
  assertion, and Heart-stone must be exactly 2 with no tolerance.
- **Materials drift onto the critical path.** Also arrives as kindness — "make sure everyone
  gets to +6". If off-path share falls below 40%, exploring stops paying and
  `corpus/50-world/`'s optional content has no mechanical purpose. Method 5.
- **The damage curve is too flat.** At 1.3× from +0 to +10, upgrading does not change how a
  fight feels, and the exploration reward is invisible. Players stop caring about materials
  and the gating accomplishes nothing.
- **The damage curve is too steep.** At 3×, a +10 weapon trivialises everything below its own
  region, levels become irrelevant next to upgrades, and the game becomes a scavenger hunt
  with a combat minigame attached. 1.92× is chosen to be roughly equal to the full levelling
  curve's contribution — two power sources of comparable weight.
- **A respec or reclaim is added.** "Let players move their +10 to a new weapon" destroys the
  Heart-stone decision entirely and, with it, the only permanent commitment in the build
  system. It will be requested constantly. Method 9.
- **A material sits behind exactly one skill.** A Heart-stone behind a tier-5 lock and
  nothing else means Security is not a build choice, it is a tax. Method 8.
- **Armour upgrades get added.** A second +N axis doubles the material economy, halves the
  legibility of the first, and quietly makes the 84-piece budget meaningless because it now
  has to serve two curves.
- **The smith becomes a menu.** Upgrading at a HEARTH instead of a named NPC with shop hours
  removes the Morrowind texture — the walk back, the closed door at 19:05, the smith you
  killed in hour four — and leaves a Souls upgrade screen. The mechanic survives; the world
  around it does not.

## Provenance note

**Every number here is `constructed`.** Nothing is measured from or recalled as a specific
Dark Souls value.

The structural debt is `canonical-recall` at medium confidence: Dark Souls' +N reinforcement
with tiered materials (shard → large shard → chunk → slab), a hard cap at the top gated by a
near-unique material, elemental infusion branches, and upgrading performed by named
blacksmith NPCs. Our schedule is *not* Dark Souls' — DS1 runs to +15 with a different
material ladder and different smiths — and no attempt has been made to match it.

Two original rulings worth flagging:

1. **Gold buys labour, the world buys stone.** This is the item's central reconciliation of
   S15 with the Souls power curve, and it is the reason the smith's 14,400-gold fee sits in
   RI-PRG05's *necessary* spend column rather than its discretionary one.
2. **Exactly two Heart-stones.** Chosen so the +10 decision is a genuine, permanent,
   two-slot commitment rather than a completion checklist. This is the number most likely to
   be argued with and it should be defended.

Confidence is **medium**, for the same structural reason as RI-PRG05 and RI-PRG06: **§2's
distribution and §4's on/off-path split are budgets handed to `corpus/50-world/`, not
measurements of it.** Whether 54 off-path materials can actually be placed in six regions
without feeling like a checklist is a level-design question this item cannot answer. When the
map exists, methods 5, 6 and 8 must be re-run against real placements and this table amended.
The **binding parts that must not move** are the exact material counts (§2), the two-weapon
+10 ceiling (§3), the ≥60% off-path rule (§4), and the absolute unpurchasability (§6) — those
are rules. The per-region distribution is a derived suggestion.
