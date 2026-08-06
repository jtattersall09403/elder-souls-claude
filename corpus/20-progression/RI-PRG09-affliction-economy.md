---
id: RI-PRG09
title: The affliction economy — seventeen named diseases, their causes, their cures, and the one that has none
kind: structure
side: morrowind
judges: [progression.affliction.economy]
provenance: constructed
confidence: medium
blind_pair: yes
---

## The bar

Seam **S11** gives Morrowind the affliction economy outright: *"diseases with names, cures, in-world
causes."* `RI-CMB10` owns the other half — the in-fight buildup meter and its proc. This item owns
everything that happens after the fight ends and you are still ill.

Morrowind's diseases are one of the purest examples of what this project is for. They are **not**
damage over time. They are **named** — swamp fever, rockjoint, droops, brown rot — with a *symptom
paragraph written by a physician*, they are caught from a **specific creature** rather than from an
abstraction, they **drain attributes** rather than health, they are **permanent until you do
something about it**, and the something has a price, a place and a person. Rockjoint does not kill
you. It takes 40 points of Agility, and then you notice you cannot carry what you could carry
yesterday.

The bar: **seventeen named afflictions across three tiers**, every one of which (a) drains
**attributes, never HP** — HP is the Souls half's currency and afflictions may not touch it; (b) is
**permanent until cured**, with no timer, no auto-expiry and no clearing on rest or death; (c) names
a **specific in-world vector** — a creature, a place, a trade, a wound; (d) has **at least three cure
routes** at different prices, of which one is free-but-far and one is a shrine; (e) is **visible on
your character and remarked on by NPCs**; and (f) has at least one **in-world text** that describes
it, written by someone with an opinion.

And one of the seventeen has **no cure at all**, is contracted unavoidably during the main quest, is
both a curse and a gift, and is the reason the other sixteen feel like a system rather than a
checklist.

**The single test that separates this from a debuff list:** catching a disease must change how you
*play the world*, not just what a number says. §5 is the mechanism — a drained attribute moves your
carrying capacity, which moves your equip-load tier, which changes your roll. You caught something
from a mire-crab and now you fat-roll. That is the whole point.

## The reference artifact

### 1. The three tiers

| Tier | n | Drain magnitude | Where you catch it | Cured by | Race resistance |
|---|---:|---:|---|---|---|
| **Common** | 12 | 10 – 30 | everywhere; ordinary fauna, water, wounds, trades | *Cure Common Affliction*: potion, spell, shrine, raw ingredient | Saxhleel / Naga **immune** (`RI-CHR02`); Redguard, Bosmer **0.50** |
| **Marsh-blight** | 4 | **40** | tier-4 and tier-5 regions only — the Deep Marshes, the Stone Wastes, voriplasm margins, the dying Hist | *Cure Blight*: a **rarer, dearer** potion; only two shrines in the province carry the rite | Saxhleel / Naga **0.35 only** — the immunity does **not** cover blight |
| **Divine** | 1 | see §3 | one place, once, unavoidably, in the main quest | **nothing** | none |

The tier structure is Morrowind's, deliberately and openly: common / blight / the incurable one. What
is transposed is the *content* — ash becomes root, Red Mountain becomes the Deep Marshes and the
dying Hist of the Stone Wastes.

**Argonian immunity is load-bearing and is not a loophole.** The majority race of the province is
immune to the common tier — twelve of seventeen afflictions never touch a Saxhleel player. That is
canon (verified: Morrowind gives Argonians Resist Common Disease 75%; `RI-CHR02` raised ours to
immune) and it is *why the blight tier exists at 0.35*, why `MIRE-LUNG` is a status rather than a
disease, and why an Argonian player is still a plausible carrier: **you can transmit what you cannot
suffer** (§4).

### 2. The sixteen curable

Attribute names are `RI-PRG02`'s. Drains are **maxima**; the minimum any affliction takes is **10**
(Common) / **20** (Blight), following Morrowind's own floor.

**Common (12)**

| # | Name | Drain | Vector — where it actually comes from | Symptom (the line an NPC or a book gives you) |
|---:|---|---|---|---|
| 1 | **Swamp fever** | STR & END 20 | mire-crabs and mudcrabs, from a wound | high fever and delirium, and no visible sign at all — which is why it spreads |
| 2 | **Rockjoint** | AGI 40 | cart-sized mire-crabs; handling pack animals | painful swelling and immobility of every joint |
| 3 | **Droops** | STR 30 | egg-mine scribs, and the egg-tending trade | weak and flaccid muscle; the arms go first |
| 4 | **Helljoint** | SPD & AGI 10 | hackwings — a bite, or a nest cleared badly | persistent inflammation of the joints; you hear yourself walk |
| 5 | **Ataxia** | STR & AGI 10 | marsh-fish, eaten or handled; the tide-fishers all have it | generalised pain and muscle stiffness |
| 6 | **Greenspore** | PER 20 | Blackwood's luminous fungus shelves | irritability, violent outbursts, mild dementia |
| 7 | **Rattles** | WIL & AGI 10 | chitin hounds | muscle spasms and listlessness |
| 8 | **Rust chancre** | PER & SPD 10 | **wounds taken from rusted Imperial steel** — the only affliction whose vector is an object | swelling, rash, painful spasms |
| 9 | **Brown rot** | STR & PER 10 | the drowned-things of Marauder's Coast, at night | necrosis and sleeplessness |
| 10 | **Collywobbles** | STR, END & SPD 10 | dye-worms; the Crimson Coast harvest | uncontrollable shaking and chronic weariness |
| 11 | **Vat-lung** | END & WIL 20 | **the open dye-vats at Archon** — a trade disease, and the guild denies it in writing | a cough that does not stop, and a taste of metal |
| 12 | **Scale-scour** | PER & LCK 10 | brackish standing water at W1–W2 with `SUCK` substrate (`RI-WLD10`) | the scales lift and shed; humans get it worse and are laughed at for it |

**Marsh-blight (4)** — tier-4 and tier-5 regions only

| # | Name | Drain | Vector | Symptom |
|---:|---|---|---|---|
| 13 | **Rootrot** | HIST & WIL 40 | **the dying Hist of the Stone Wastes** — proximity, or drinking their sap | you dream someone else's dreams and wake further from yourself |
| 14 | **Blackheart** | STR & END 40 | surviving voriplasm contact (`RI-WLD11` #13) | the flesh nearest the contact darkens and stays dark |
| 15 | **Salt-chancre** | PER 40 | salt-storm exposure without shelter | the salt gets under the scales and stays |
| 16 | **Marrow-thirst** | END & SPD 40 | the unnamed things of the Deep Marshes | an unappeasable thirst that water makes worse |

### 3. The Divine affliction — **the Sap**

| Property | Value |
|---|---|
| How you get it | **once, unavoidably, at a fixed point in the main quest** (`RI-QST06`'s architecture owns which) |
| Curable | **no.** Not by potion, spell, shrine, gold, faction or rest |
| Drain | INT, WIL, PER, SPD **−1 per in-game week**, uncapped and permanent |
| Gift | STR & END **+1 per in-game week**, uncapped; **Resist Common Affliction 100%**, **Resist Blight 100%** |
| Lore | it is not a disease. It is what happens to flesh that the Hist has decided about (`RI-LOR05` §4a) |
| Social | every Argonian NPC in the province can see it. Some disposition goes **up**. Some goes sharply down |
| Removed at | never. It is on the character sheet at the last frame of the game |

The Sap is transposed from corprus and keeps its shape exactly — *"technically a blight disease… no
known cure… profoundly affecting a victim's mind and body… the physical effects of the deity's power
on mortal flesh"* — because that shape is the single best idea in Morrowind's affliction system: a
disease that makes you **stronger and stupider forever**, that you did not choose, that the world
recognises, and that no shopkeeper can sell you a way out of.

### 4. The rules

| # | Rule | Why |
|---|---|---|
| **A1** | **Attributes, never HP.** No affliction may damage, drain or cap health. | HP is the Souls half's currency (`RI-CMB10`). Two systems, one resource, is how a seam collapses. |
| **A2** | **Permanent until cured.** No timer, no expiry, no clearing on HEARTH rest, on death, or on load. | An affliction that wears off is a debuff. This is also the S6 clause: afflictions survive death exactly as quest state does (`RI-PRG04`). |
| **A3** | **Deterministic contraction.** Contracted by a `RI-CMB10` proc from a source declaring the affliction id, or by a declared environmental exposure. **Never a roll** (S1 applies inside the fight; S21 keeps the die only where failure is permanent, and this failure *is* permanent — but it is not a *check*, it is a consequence). | The uncertainty is whether the meter fills, not whether the coin lands. |
| **A4** | **Three cure routes minimum**, at different prices, of which **one is free and far** (a shrine you walk to) and **one is a purchase** (`RI-PRG05` prices it in gold). A fourth — a raw ingredient eaten on the spot — exists for 8 of the 12 common afflictions. | S15: gold is the only currency. And a disease with one cure is a fetch quest. |
| **A5** | **Visible and social.** Every affliction renders on the character and is remarked on: a **−15 disposition** floor-effect while visibly afflicted in a settlement, at least **3** NPCs with an affliction-specific greeting, and **≥ 2** service refusals somewhere in the province. | This is the item's AR-3 crossing: an illness changes a conversation. |
| **A6** | **You can carry what you cannot suffer.** An immune character (Saxhleel, or anyone with the Sap) can still be a **vector** for quest and NPC purposes. | It is the only way the immunity is interesting rather than an off switch. |
| **A7** | **In-world text.** Every affliction appears in **≥ 1** book, healer's dialogue topic, or rumour (`RI-LOR03`, `RI-DLG03`), written by someone with a bias. Two of them must **disagree** about a cause (`RI-LOR06`). | Diseases are the corpus's cheapest unreliable-narrator surface. |
| **A8** | **Regional confinement.** No affliction is contractable in more than **3** of the 13 regions; the 4 blight afflictions in **tier-4/5 regions only**. | **S24**. Diseases are one more axis on which the province must not be uniform. |
| **A9** | **No stacking of the same affliction.** Re-contracting refreshes nothing and adds nothing; you either have it or you do not. | Otherwise the economy becomes a damage race, which is A1 by another route. |

### 5. The crossing — why a disease changes your roll

This is the marquee payoff and it must be built deliberately, not discovered.

```
Rockjoint  ->  Agility −40
Agility    ->  (RI-PRG02) carrying capacity
capacity   ->  equip_load% = carried / max_equip_load
equip_load ->  (RI-CMB01, seam S23) LIGHT | MEDIUM | HEAVY | OVERLOADED
tier       ->  i-frames, roll distance, roll recovery, sprint permission
```

A player at 29% load in `LIGHT` who catches rockjoint can cross **into `MEDIUM`, or past 70% into the
fat roll**, and their dodge changes — 26 i-frames become 22, or 10. Three constraints make this a
design rather than a bug:

1. **It must be announced.** `RI-CMB01` already requires the equip-load readout to change colour and
   the roll to change clip at a boundary. Crossing a boundary *because of an affliction* fires the
   same announcement plus a journal line. A silent tier change is a defect.
2. **`RI-CMB01` still owns the boundaries.** The affliction moves the *input* (capacity), never the
   30/70/100 thresholds. S23 is not touched.
3. **It is survivable.** No single common affliction may move a character more than **one** tier from
   a 50%-load baseline; only a blight-tier affliction, or two stacked different afflictions, may
   reach `OVERLOADED`.

Second crossing, smaller and just as good: **Personality drains change prices and persuasion**
(`RI-DLG04`, `RI-PRG05` barter), so greenspore makes the province more expensive. Third:
**HIST drains close Root-Speech options** (`RI-CHR02`), so rootrot literally takes away your ability
to talk to the trees.

### 6. Cure economy

| Route | Availability | Gold | Notes |
|---|---|---:|---|
| **Shrine rite** (Common) | 6 of 8 settlements | **0**, but a walk and a wait | the free-and-far route A4 requires |
| **Shrine rite** (Blight) | **2** settlements only | 0 | the walk is the price, and it is a long one |
| Cure potion, Common | most apothecaries | **35 g** | `RI-PRG05` prices it |
| Cure potion, Blight | 4 vendors province-wide | **180 g** | |
| Cure spell, Common / Blight | Restoration, learnable | Focus | `RI-MAG02` owns the effect |
| Raw ingredient | field-gatherable | 0 | 8 of the 12 common afflictions only; a first-effect ingredient eaten raw, exactly as Morrowind does it |
| **The Sap** | — | — | **nothing, at any price** |

The prices exist so that a disease is a **decision about money and time**, which is the whole reason
S11 gave this half to Morrowind: 35 gold now, or a 20-minute walk to a shrine, or fight the next
three encounters at −40 Agility.

### 7. Data contract

`game/data/progression/afflictions.json`, schema `elder-souls/afflictions@1`. Each record:
`id`, `name`, `tier`, `drains: [{attribute, magnitude}]`, `vectors: [{kind, id, regions[]}]`,
`symptom_text`, `cures: [{route, where, gold}]`, `visible_tell`, `npc_reactions[]`,
`texts[]` (book/topic/rumour ids), `resistances: {race: value}`. Absent fields are fail-closed 0.
Cross-referenced by `RI-CMB10`'s `affliction_id` and by `game/data/combat/enemies/*.json`.

## Comparison method

Static analysis over `game/data/**` (`tools/analysis/content-stats.mjs` and the checks below); no
browser needed for M1–M5.

**M1 — The census.** Load `afflictions.json`; exit **10** if absent.
- **FAIL** if fewer than 17 records; if the tier split is not 12 / 4 / 1; if any record lacks a
  vector, a symptom text, or ≥ 3 cures; if any drain names a non-`RI-PRG02` attribute.
- **FAIL if any affliction drains, caps or scales health** (**A1**, and this is the first thing to
  check because it is the first thing that will be built wrong).

**M2 — Vectors are real.** For every declared vector, resolve it: a creature id must exist in
`game/data/combat/enemies/`, a hazard id in `game/data/world/hazards.json`, a water/substrate
condition in `game/data/world/water.json`, an object in `game/data/items/`.
- **FAIL** on any unresolvable vector — a disease you cannot catch from anything is a list entry.
- **FAIL** if fewer than 40% of roster archetypes transmit at least one affliction, or if any
  affliction is contractable in more than 3 regions (**A8**).

**M3 — Cures resolve and are priced.** For each cure route, resolve the shrine/vendor/spell/ingredient.
- **FAIL** if any affliction lacks a free-and-far route; if any lacks a gold-priced route; if a price
  contradicts `RI-PRG05`; if the blight rite is available in more than 2 settlements; or if the Sap
  has any cure at all.

**M4 — Texts and disagreement.** Grep `game/data/books/`, `dialogue/topics/`, `dialogue/rumours.json`.
- **FAIL** if any affliction has zero in-world text; if fewer than 2 pairs of texts disagree about a
  cause (**A7**, `RI-LOR06`'s instrument); or if all texts share one authorial voice.

**M5 — Race resistance.** Cross-check `afflictions.json` against `RI-CHR02`.
- **FAIL** if Saxhleel/Naga are not immune to all 12 common; if they are immune to any blight; if
  blight resistance is not 0.35; or if any race is immune to the Sap.

**M6 — Permanence (A2), harness.** Contract an affliction, then: HEARTH rest, die, reload a save,
wait 3 in-game days, fast-travel.
- **FAIL** if the affliction clears, weakens, or its drain magnitude changes at any point. Cross-check
  against `RI-QST09`'s persistence diff — an affliction is world state and it is subject to **S6**.

**M7 — The crossing (§5), harness.** Set equip load to 29%, `LIGHT`. Contract rockjoint.
- **FAIL** if the tier does not change; if the roll's i-frames do not change to `MEDIUM`'s; if no
  announcement fires (readout colour, clip change, journal line); if any `RI-CMB01` threshold has
  moved rather than the capacity; or if a single common affliction moves a 50%-baseline character
  more than one tier.
- Cure it. **FAIL** if the tier does not return.

**M8 — Social (A5), harness + static.** With a visible affliction, enter each settlement.
- **FAIL** if disposition does not fall by ≥ 15; if fewer than 3 NPCs have an affliction-specific
  greeting; if fewer than 2 services are refused province-wide; or if the tell is invisible in a
  1280×720 frame at 6 m with the HUD off (`blind_pair: yes` — show an afflicted and a healthy
  character unlabeled and ask which is ill).

## Scoring

| Check | Weight | Pass condition |
|---|---:|---|
| **M1** census and **A1** | **18** | 17 records, 12/4/1, no HP anywhere |
| **M2** vectors resolve | 16 | every vector real; ≥ 40% roster; ≤ 3 regions each |
| M3 cures resolve and are priced | 14 | free-and-far + gold route each; the Sap has none |
| M4 in-world texts and disagreement | 10 | ≥ 1 text each, ≥ 2 disagreeing pairs |
| M5 race resistance | 8 | matches `RI-CHR02` exactly |
| M6 permanence | 12 | survives rest, death, reload, time |
| **M7** the equip-load crossing | **14** | tier moves, announced, reversible |
| M8 social and legibility | 8 | −15 disposition, 3 greetings, 2 refusals, visible |

- **≥ 85** — an economy.
- **70–84** — playable, gap named.
- **< 70** — **we lose.**

**Automatic fail regardless of score:** any affliction that damages HP; any that expires on a timer
or clears on rest, death or load; any contracted by a dice roll; the Sap acquiring a cure; a disease
with no in-world text (**AR-2** — item descriptions or a menu tooltip replacing NPC dialogue as the
lore vector); afflictions invisible on the character.

## How we lose

1. **Diseases become damage over time.** The single most likely failure, because it is what every
   other game means by "poison". It collapses S11's two halves into one, makes `RI-CMB10` redundant,
   and deletes the reason this item exists. A1 and M1 are aimed at nothing else.
2. **They expire.** A 60-second timer, because "permanent debuffs feel bad". They do feel bad. That
   is the economy: the bad feeling is what the 35 gold is for.
3. **One cure, sold everywhere, for 5 gold.** The cure becomes a consumable you carry twelve of and
   the whole system becomes an inventory slot.
4. **Vectors are abstract.** `disease: true` on a damage type, rather than "you got this from a
   mire-crab". Then no NPC can warn you about mire-crabs, no book can be wrong about mire-crabs, and
   the Morrowind-ness evaporates while every number stays correct.
5. **Nobody notices you are ill.** No tell, no greeting, no refusal. The affliction is a line in a
   menu. This is A5 and it is the crossing that makes the system part of the world instead of part of
   the character sheet.
6. **The Argonian immunity is treated as a bug and nerfed.** It removes twelve of seventeen
   afflictions for the province's majority race, which looks like a balance problem and is actually
   the point: it is why the blight tier is only 0.35 resisted, and it is a canon fact
   (**verified**, §Provenance).
7. **The Sap gets a cure.** Somebody will add one, in a side quest, as a reward. It is the one
   affliction whose entire meaning is that gold cannot touch it.
8. **The equip-load crossing is never built** — attributes drain, capacity is a separate number, and
   nothing propagates. §5 becomes a paragraph. This is the difference between an affliction economy
   and a debuff list, and M7 is the only check that sees it.
9. **The crossing is built and never announced**, so the player's roll silently becomes worse and
   they conclude the game is inconsistent. Worse than not building it.
10. **All seventeen written by one voice.** Sixteen symptom paragraphs in identical clinical register,
    which is `RI-DLG08`'s indifference failure arriving through the back door. Morrowind's own entries
    are a physician's notes; ours should include a physician, a Hist-tender who thinks it is a
    judgement, and a Dres overseer who thinks it is malingering — and two of them should be wrong.

## Provenance note

- **`community-data`, confidence high**, verified this session from the vendored UESP extract
  (`corpus/uesp_morrowind_blackmarsh_extract.jsonl.xz` via `tools/uesp/uesp-query.mjs`, 2019-11-07
  dump), pages *Morrowind:Diseases* and *Morrowind:Argonian*:
  - the **three-tier structure** (common / blight / corprus), and that blight is *"more serious, and
    slightly harder to cure"*.
  - that all Morrowind diseases drain **attributes**, not health, with stated maxima and a
    **minimum of 10** (common) / **20** (blight). Ours copies this floor.
  - **Nine of our twelve common names and their drain shapes are Morrowind's own**: swamp fever
    (STR & END 20, from mudcrabs — *"high body temperature and delirium, but there are no easily
    visible signs"*), rockjoint (AGI 40), droops (STR 30), helljoint (SPD & AGI 10), ataxia
    (STR & AGI 10), greenspore (PER 20), rattles (WIL & AGI 10), rust chancre (PER & SPD 10), brown
    rot (STR & PER 10), collywobbles (STR/END/SPD 10). Vectors are **re-pointed** to our fauna;
    magnitudes are **unchanged**.
  - **Blackheart** is Morrowind's blight disease *black-heart* (STR & END 40), renamed by one
    hyphen; the other three blight names are ours, at Morrowind's 40 magnitude.
  - **Corprus**: *"no known cure"*, *"Drain Intelligence, Willpower, Personality & Speed 1"*,
    *"Fortify Strength & Endurance 1"*, *"Resist Common Disease 100%, Resist Blight Disease 100%,
    Resist Corprus Disease 100%"*, contracted **unavoidably during the main quest**, and *"not truly
    a disease at all, but the physical effects of the deity's power on mortal flesh."* **The Sap is
    that record with the deity changed.**
  - **Argonians: Resist Common Disease 75%, Resist Poison 100%** — and *"Altmer, Argonians, Bosmer
    and Redguards each have 75% resistance. You can achieve 100% resistance after a point in the Main
    Quest."* `RI-CHR02` raised ours to outright immunity; §1's blight-at-0.35 clause exists to keep
    the tier meaningful for the province's majority race, and that clause is **ours**.
- **`constructed`, confidence medium:** the four blight afflictions' names and vectors, vat-lung,
  scale-scour, mire-lung's handoff, every cure price, the −15 disposition floor, A5–A9, the whole of
  §5's crossing, and every threshold in the comparison method. Confidence is medium because the
  prices and the disposition penalty are set against `RI-PRG05` and `RI-DLG04` by judgement rather
  than derivation, and because §5's "one tier maximum" bound has not been checked against a real
  equipment table.
- **Cited, not redefined:** the S11 split and S6's persistence clause (`ARBITRATION`); the buildup
  meter and proc that transmits most of these (`RI-CMB10` §5); the attribute list (`RI-PRG02`); the
  equip-load tiers and their announcement (`RI-CMB01`, seam S23); carrying capacity out of the fight
  (`RI-PRG07`); gold prices (`RI-PRG05`); race resistances (`RI-CHR02`); the hazards that transmit
  the environmental ones (`RI-WLD11`); water and substrate conditions (`RI-WLD10`); disposition
  (`RI-DLG04`); unreliable in-world texts (`RI-LOR03`, `RI-LOR06`); the Hist's nature (`RI-LOR05`).
