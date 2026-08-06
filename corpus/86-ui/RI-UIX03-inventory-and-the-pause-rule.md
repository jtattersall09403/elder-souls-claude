---
id: RI-UIX03
title: Inventory, encumbrance, and the menu-pause rule (S14) — plus the level-up screen
kind: structure
side: neutral
judges: [ui.menu.inventory, ui.menu.levelup, combat.pause.policy, progression.equipment.encumbrance]
provenance: constructed
confidence: medium
blind_pair: yes
---

> **ARBITRATION: this item is `neutral` and resolves S14 explicitly**, because S14 is one line
> and is routinely read as two incompatible things.
>
> **S14 as written:** *"SOULS. Inventory does not pause the world during combat. Outside
> combat, Morrowind-style leisure is fine."*
>
> **The resolution this item adopts, stated before anything else so it is not re-litigated:**
> S14 is a ruling about **time**, not about **availability**. The inventory screen is
> **always openable**. What changes at the combat boundary is whether the simulation stops:
>
> | | Simulation | Screen | Owner |
> |---|---|---|---|
> | **Outside combat** | **paused** — frame counter static | full Morrowind inventory, leisurely, as long as you like | MORROWIND |
> | **Inside combat** | **runs at 60 Hz** — frame counter advances normally | the same screen, translucent, non-occluding | SOULS |
>
> The consequence is the intended one and it is Souls' actual answer: the menu is available in
> a fight and *nobody uses it*, because the fight continues while you read. We do not need a
> rule forbidding in-combat inventory management. We need the world to keep moving, and the
> player will write the rule themselves. **A design that blocks the menu instead of running the
> world has substituted a restriction for a consequence, and fails M-P2.**
>
> `ui.menu.levelup` is judged here (§E) as the other menu screen governed by the same rule and
> by S15.

## The bar

Morrowind's inventory is **a place of stuff**. It is not a grid of icons and a stat delta; it is
a list of named, weighed, individually-described objects you have picked up and are now carrying
around, and the fact that you are carrying them *costs* you. Encumbrance is visible, permanent
and consequential; a player who has looted a dungeon walks home slowly and knows exactly why.
Items have descriptions written by a person, and the descriptions are about the object rather
than about its damage-per-second.

There is a trap here and AR-2 names it explicitly: *"item descriptions replacing NPC dialogue as
the primary lore vector"* is **automatic-fail Souls leakage**. Souls tells its story through item
text because it has no dialogue to speak of; Morrowind has 1.87 million words of dialogue
(RI-AUD05 §Provenance) and its item descriptions are correspondingly terse. Our items may be
described richly and may be strange — they must not become where the lore lives. That is a
measurable ratio, and it is M-L1.

## The reference artifact

### §A — The pause rule (S14), stated as frame arithmetic

| # | Property | Requirement |
|---|---|---|
| P1 | Outside combat, `mode == 'inventory'` | `getFrame()` **does not advance** while the screen is open |
| P2 | **Inside combat**, `mode == 'inventory'` | `getFrame()` advances at exactly **1 per fixed step**, indistinguishable from `mode == 'world'` |
| P3 | Combat definition | ARBITRATION §1: any hostile in `alert_state == AGGRO` within the encounter volume, or <5 s since the last one de-aggroed |
| P4 | Transition mid-menu | if combat *begins* while the screen is open outside combat, the simulation resumes on the frame the first hostile enters AGGRO, with the screen still open. No forced close, no warning modal |
| P5 | Occlusion in combat | the screen renders at ≤ **55%** opacity over ≤ **60%** of screen area, and the centre 40%×40% remains legible — the player must be able to *see themselves die* |
| P6 | Input in combat | combat inputs remain live while the screen is open. `roll`, `block` and `light` are not swallowed by the menu; the menu uses `menu`, `interact` and directional inputs only |
| P7 | Equip commitment | changing an equipped weapon or armour piece costs an **animation-committed** action of ≥ 30 frames during which the player is vulnerable (ARBITRATION §1, "Animation": committed actions). Consuming a quick-slot item is governed by RI-UIX01 E5 and `combat.heal.charges` |
| P8 | No time dilation | there is no slow-motion, no 0.25× "tactical" mode, no partial pause |

P5 and P6 together are what make the rule a *consequence* rather than a *punishment*. A menu
that occludes the fight and eats your roll input is not Souls' design; it is a trap. Souls lets
you open the menu and lets you die with your eyes open.

**P4 is the case everyone forgets.** The player opens the inventory in a quiet room; a patrol
walks in. The correct behaviour is that time simply starts, silently. A modal saying "combat
started!" is a HUD element announcing world state, which is the RI-UIX01 X-series problem
wearing a different hat.

### §B — Inventory content and structure (Morrowind side)

| # | Property | Requirement |
|---|---|---|
| C1 | Item identity | every item is a record in `game/data/items/**` with `id`, `name`, `weight`, `value_gold`, `description` (S12: hand-placed, named, weird — **no procedural drop tables**) |
| C2 | Weight is real | every item has a nonzero weight except a closed list (letters, keys, gold) |
| C3 | Encumbrance visible | current / maximum load shown as a number *and* a bar, on the inventory screen at all times, plus the RI-UIX01 E9 HUD indicator |
| C4 | Encumbrance consequential | crossing the load threshold changes roll distance and stamina cost (`progression.equipment.encumbrance`, split ruling — Souls owns what it does to the roll, Morrowind owns the breadth of what you can carry) |
| C5 | Categories | ≥ **8** categories (weapon, armour, clothing, potion, ingredient, book, tool, misc, quest) — the Morrowind breadth, not a three-tab Souls loadout |
| C6 | Sort and search | sortable by name / weight / value / value-per-weight, and text-searchable. Value-per-weight is the specific Morrowind affordance: it is how you decide what to leave behind |
| C7 | Item detail | selecting an item shows: name, weight, value, condition/durability if applicable, and the full `description` string, unabbreviated and untruncated |
| C8 | Containers | corpses, chests and barrels use the **same screen** in a two-panel take/put layout, and the container's contents are hand-placed (S12) |
| C9 | No auto-loot-all-and-sort | a "take all" affordance may exist; an automatic inventory-management system that decides what is junk may not. What you carry is a decision |
| C10 | Gold | shown as a number, not as an item with weight (S15: gold is the only currency) |

### §C — The item-description budget (AR-2)

| Metric | Value | Hard fail |
|---|---|---|
| Mean item `description` length | **12–45 words** | > 90 words mean |
| Longest single item description | ≤ **120 words** | > 250 |
| `Σ item description words / Σ dialogue words` | ≤ **0.05** | ≥ **0.20** |
| Items whose description contains a proper noun found in **no** dialogue topic and **no** book | ≤ **10%** of items | > 40% |
| Items with an empty or templated description (`"A sword."`) | **0** | > 25% |

The third row is the AR-2 detector and the fourth is its subtler companion. A game can keep item
text short and *still* make it the lore vector, by putting facts there that appear nowhere else —
which is precisely Souls' technique. Requiring that item text's proper nouns are mostly
*corroborated* elsewhere (in dialogue or in a book, per RI-LOR03) forces items to **allude** to
the world rather than to **constitute** it.

The fifth row points the other way, and both bounds are real: `"A sword."` is not Morrowind
either. Morrowind's descriptions are terse and *specific*.

### §D — What the inventory must never be

| # | Forbidden | Why |
|---|---|---|
| N1 | A 3D item-inspection turntable as the primary view | it is a Souls/modern affordance; the list is the Morrowind object. A turntable may exist as a secondary view |
| N2 | Item rarity colours (grey/green/blue/purple/orange) | S12: hand-placed and named, not tiered. Rarity colour *is* a procedural drop table's UI even when the loot is hand-placed |
| N3 | Comparison arrows (`+4 ▲`) against currently equipped | reduces an object to one number; and with S1/S3, weapon skill does not roll to-hit, so the number is not even the whole story |
| N4 | Stat-total optimisation readouts ("best in slot") | |
| N5 | Auto-equip-best | C9 |
| N6 | Weightless quest items | a courier's parcel that costs nothing to carry is not a parcel. The C2 exemption list is closed and short |
| N7 | Any element that pauses the world in combat | P2 |

### §E — The level-up screen (`ui.menu.levelup`)

Governed by **S2** (split: Souls owns the currency and the curve, Morrowind owns the breadth of
the stat sheet), **S15** (souls level you and *only* level you; gold is the only currency) and
the pause rule above. RI-PRG01 owns the cost curve and RI-PRG02 owns the stat sheet; this item
owns **the screen**.

| # | Property | Requirement |
|---|---|---|
| L1 | **Where it lives** | at a HEARTH shrine only (Souls bonfire-level-up). Not from the pause menu, not anywhere in the world |
| L2 | Pause | HEARTH shrines are safe by construction, so the screen pauses. If a hostile can reach the shrine, §A applies and the screen does not pause |
| L3 | What it shows | current level, souls held, souls to next level (RI-PRG01), the full attribute list (RI-PRG02), and the derived values each attribute moves |
| L4 | Souls are spent, gold is not shown | S15. A gold figure on the level-up screen is a category error and is a **hard fail** — it is the exact confusion S15 was decreed to prevent |
| L5 | Breadth is visible | all ten attributes are on screen simultaneously with their current values. A three-stat "class" summary fails S2's Morrowind half |
| L6 | Consequence is legible | selecting an attribute shows what changes and by how much, **before** confirming, including the derived combat values |
| L7 | No respec on this screen | if respec exists it is a separate in-world service with a gold cost and a named NPC (Morrowind economy), never a menu button |
| L8 | Soft caps are visible | RI-PRG02's soft caps are shown as a marker on the attribute, not discovered by experiment |

**L4 is the check to run first**, because it is one boolean and it detects the single most likely
S15 violation in the whole project: a level-up screen that shows gold is a level-up screen where
someone was thinking of gold as a progression currency.

## Comparison method

1. **Static content census** (no browser):
   ```bash
   node tools/analysis/content-stats.mjs --items game/data/items/ --dialogue game/data/dialogue/
   # -> {items, categories, weightless, desc_words:{mean,max,p95}, empty_desc,
   #     dialogue_words, ratio, uncorroborated_proper_nouns}
   ```
   Covers C1, C2, C5, C10 and all of §C. `uncorroborated_proper_nouns` requires a proper-noun
   extraction over item descriptions cross-referenced against dialogue topics and
   `game/data/books/`.

2. **P1/P2 — the pause rule.** This is the item's central measurement and it is exact:
   ```bash
   node tools/harness/run-headless.mjs --scenario ui-inventory-pause --seed 1337 --ui-state
   ```
   `ui-inventory-pause` does, in one run:
   - out of combat: `openMenu('inventory')`, `stepFrames(120)`, assert `getFrame()` unchanged;
   - `closeMenu()`, `aggro(e0)`, `openMenu('inventory')`, `stepFrames(120)`, assert
     `getFrame()` advanced by exactly **120**;
   - P4: out of combat with the menu open, `aggro(e0)`, `stepFrames(60)`, assert the frame
     counter advanced by 60 and `mode` is still `'inventory'`.

   Report the raw frame counts, not a boolean. A partial pause (advancing 30 of 120) is a
   distinct and more insidious failure than a full pause and must be visible.

3. **P5 — occlusion.** Capture `ui_inventory_combat` with the menu open mid-fight; compute the
   menu's opacity from the UI-layer difference (RI-UIX02 §C) and its area fraction; assert the
   centre 40%×40% has ≥ 30% of its pixels contributed by the world layer.

4. **P6 — input liveness.** With the menu open in combat, `queueInputs([{f:0,tap:'roll',hold:3}])`
   and assert a `roll_start` event appears in the trace.

5. **P7 — equip commitment.** Equip a different weapon from the menu during combat; assert the
   trace shows a committed state of ≥30 frames with `iframe: false`.

6. **§D forbidden set.** From `getUIState()` element `kind`s and text: search for rarity colour
   classes, comparison-arrow glyphs (`▲▼`, `+N/-N` adjacent to a stat), and any element with
   kind `auto_equip` or `best_in_slot`. Plus a pixel check for N2: sample the item-list rows'
   text colours across ≥40 items and assert ≤3 distinct hues (a rarity system produces five).

7. **§E level-up.** `openMenu('levelup')` at a HEARTH shrine:
   - **L4:** assert no element's `text` matches `/\bgold\b|\bdrakes?\b|\bseptims?\b/i` and no
     element `kind` is `currency_gold`. One boolean, run first.
   - **L5:** count attribute elements on screen simultaneously; must be 10 (RI-PRG02).
   - **L6:** select an attribute without confirming; assert ≥1 derived-value preview element
     appears and that the trace shows no `level_up` event.
   - **L3:** cross-check the displayed souls-to-next-level against RI-PRG01's curve at that
     level; a mismatch is a hard fail of L3 (the number is decorative).

8. **Blind pair.** Assemble our inventory screenshot against a Morrowind inventory screenshot,
   unlabelled, per RI-MTH03. **Judge on structure only** — density, category breadth, presence of
   weight and value, the shape of the item detail panel. This is `blind_pair: yes` for *layout*;
   the **art** of the screen is RI-UIX06's business and is judged under a separate declaration.

## Scoring

| ID | Check | Pass | Hard fail |
|---|---|---|---|
| M-P1 | Pause outside combat | frame delta 0 over 120 frames | — |
| M-P2 | **No pause in combat** | frame delta exactly 120 over 120 | any delta < 120 (including partial) |
| M-P3 | P4 transition, P6 input liveness, P8 no dilation | all three clean | menu blocks combat input |
| M-P4 | P5 occlusion | ≤55% opacity, ≤60% area, centre legible | full-screen opaque menu in combat |
| M-P5 | P7 equip commitment | ≥30 committed frames | instant equip swap |
| M-C1 | Item data (C1, C2, C5, C10) | ≥8 categories, weights present, gold not an item | procedural drop tables (S12 fail) |
| M-C2 | Encumbrance (C3, C4) | number + bar + HUD; threshold changes roll | encumbrance not implemented |
| M-C3 | Screen affordances (C6, C7, C8, C9) | all four | no item detail panel |
| M-L1 | **Item-description budget (§C)** | all five rows in band | ratio ≥ 0.20 → **AR-2 automatic fail** |
| M-D1 | Forbidden set (§D) | 0 hits | N2 rarity colours or N7 |
| M-E1 | Level-up L4 (no gold) | no gold element | any gold element → **S15 hard fail** |
| M-E2 | Level-up L1, L3, L5, L6, L8 | all five | curve mismatch, or <10 attributes shown |
| M-E3 | Level-up L2, L7 | both | respec as a menu button |

Native scale **checks passed / 13**. 13/13 → meets the bar (ceiling 8). 9–12 → below bar, remedy
required (ceiling 6). ≤8 → loses outright (ceiling 4). Any hard fail caps at 2; M-L1 and M-E1
additionally trigger AR-2 / S15 failure of the piece.

**Unimplemented scores 0** on every check it touches. An inventory that exists but has no
container screen scores 0 on M-C3, not "partial credit".

**What we lose looks like:**
```
M-P2 frame delta with menu open in combat: 0 of 120       -> HARD FAIL
M-P4 menu is full-screen opaque
M-C1 categories: 3 (Weapons / Armor / Consumables)
M-L1 item desc mean 118 words; ratio items:dialogue = 0.61 -> AR-2 FAIL
     uncorroborated proper nouns: 71% of items
M-D1 rarity hues detected: 5
M-E1 level-up screen shows "Gold: 4,120"                   -> S15 HARD FAIL
=> AR-2 + S15. Capped at 2. This is a Souls inventory: three tabs, rarity
   colours, and the game's lore is in the item text because there is no
   dialogue to put it in.
```

## How we lose

- **The pause is implemented once, for the whole game.** `if (menuOpen) return;` at the top of
  the update loop is one line, is obviously correct, and silently deletes S14. It will be
  written in wave 1 by someone who has not read this file, and it will never look wrong because
  a paused menu is what every game does. M-P2 reports raw frame counts for exactly this reason:
  the failure is total, not marginal, and a boolean would hide how total.
- **The half-fix.** Someone reads S14, disallows opening the menu in combat, and considers it
  handled. It is not the ruling and it is a worse game: a restriction where there should be a
  consequence. Detection is that M-P2 cannot even run — the scenario fails at `openMenu` — and
  a critic must score that as a fail rather than as unmeasurable.
- **Item descriptions become the lore.** The most seductive failure in this file. Writing 1,000
  evocative item descriptions is *fun*, it is fast, and it produces a game that reads like
  Souls, which is a compliment right up until AR-2 fires. The ratio in §C is the guard, and the
  uncorroborated-proper-noun row is the one that catches the sophisticated version — short
  descriptions that still carry facts found nowhere else.
- **Encumbrance is added as a number and not as a consequence.** C3 passes, C4 does not: the
  bar fills, nothing happens at the threshold, and the player learns to ignore it. This is the
  standard fate of encumbrance systems and it is why C4 is scored against the roll rather than
  against the UI.
- **Rarity colours arrive with a loot pass.** They are the single most established convention in
  RPG inventory UI and they will feel like a usability improvement. They are S12's drop-table
  model expressed as CSS, and they make a hand-placed named object into a tier.
- **The level-up screen shows gold** because the same header component is reused from the
  merchant screen. It is a two-minute mistake that inverts S15 in the player's mental model,
  and it is why M-E1 is one boolean run first rather than a nuanced judgement.
- **The menu occludes the fight and eats inputs**, so P2 technically passes — the world runs —
  but the player cannot see or respond to it. This passes M-P2 and fails the intent. M-P4 and
  M-P3 exist as the intent's proxies, and a critic that runs M-P2 alone will report a pass on a
  build that is unplayable.
- **`value_per_weight` sorting is dropped as a niche feature.** It is the specific affordance
  that makes a Morrowind inventory a decision rather than a list, and it is one line of sort
  code. Its absence is not noticed because nothing breaks; the loot economy just quietly stops
  having a shape.

## Seam (AR-3)

**Not sterile.** The pause rule *is* the seam: one screen, one set of contents, and the only
thing that changes at the combat boundary is whether time passes. A Morrowind object — the
leisurely, weighed, over-full inventory — is made dangerous by a Souls rule, without either side
giving anything up. Secondarily, C4 ties encumbrance (Morrowind breadth: carry what you like) to
roll distance (Souls: `combat.dodge.equipload`), so a decision made calmly in a menu changes the
i-frame economy of a fight three regions later.

## Provenance note

`provenance: constructed`, `confidence: medium`.

The **Morrowind inventory properties** (C1–C10) are `canonical-recall` — the categorised list,
per-item weight and value, value-per-weight sorting, the two-panel container screen, terse
authored descriptions — and are high-confidence as structure. The **S14 resolution in the
front-matter block is a construction and is the most consequential judgement in this file**: S14's
text settles pausing and is silent on availability, and this item resolves the silence toward
"always openable, never paused in combat" on the argument that Souls achieves its restriction
through consequence rather than prohibition. A future critic may reasonably challenge that
reading; if it is overturned, the correct route is a new seam ruling in ARBITRATION §2, not a
change here.

**Constructed numbers:** the 12–45 word description band, the 0.05 ratio and 0.20 hard fail, the
10% uncorroborated-proper-noun ceiling, the 55%/60%/40% occlusion figures, the ≥30-frame equip
commitment, and the ≥8 categories. The 0.05 ratio is the weakest of these and deserves an
explicit caveat: it was chosen as "clearly an order of magnitude below dialogue" rather than
derived, and it is sensitive to how much dialogue actually ships. If the game ships with far
less dialogue than planned, the ratio passes trivially while the *intent* — dialogue is the
primary lore vector — fails. A critic seeing M-L1 pass on a build with thin dialogue should
check the absolute dialogue word count against `RI-DLG`'s bar before believing it.

**Harness additions requested:** `getUIState()` (RI-UIX01), and **`openMenu(name)` /
`closeMenu()`** — `name ∈ {inventory, journal, book, levelup, dialogue, map}`, returning the new
`mode`. Without deterministic menu navigation none of §A is measurable, since scripted input
(HARNESS.md §4) can open a menu but cannot reliably navigate to a specific screen.
