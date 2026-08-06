---
id: RI-CHR02
title: Race in Argonia — profiles, the reaction matrix, and what your scales cost you
kind: number
side: morrowind
judges: [character.race.profile, character.race.reaction, character.race.dialogue, character.race.access, dialogue.disposition.model, world.faction.presence, progression.gold.economy, crime.guard.response]
provenance: constructed
confidence: medium
blind_pair: no
---

## The bar

In almost every game with a race select, race is a hat. You pick it on a menu, you get
+10 to a stat and a once-a-day power, and from that moment the world is identical. Morrowind
did better than that and still not well: `fDispRaceMod = +5` if the speaker shares your race,
a handful of `Race == Argonian` dialogue filters, and slavery as scenery you could walk past.
This game is set in **Black Marsh in 3E 427**, where House Dres is legally raiding for
Argonian bodies *this season* (RI-LOR02 §1), and the only honest way to build it is to make
race the second-largest input to the world's behaviour after your own actions.

The bar is this: **a Dunmer and a Saxhleel walking into the same room must get a different
room.** Different greeting, different price, different topics, different guard, different
encounter table on the road outside. Not flavour text over identical systems — different
numbers in the same systems, large enough that a player who picks Dunmer knows within ten
minutes that they have chosen a harder and stranger game, and large enough that the choice
is a *build* decision on the same footing as attributes. And it must cut both ways: an
Argonian player is the majority here and gets the province's goodwill, and also gets the
Hist talking to them (RI-LOR05 §4a), the interior's obligations, and a Dres net.

This item is the corpus's largest single **AR-3** contributor. Race is a world property, and
it changes fights — by changing who opens hostile, who can be talked down, and what is on
the road at all.

## The reference artifact

### 1. The ten playable races

Two of them are Argonian, because the Hist decides what hatches and it does not hatch one
thing (CF-004). Race is `what hatched or bore you`; **upbringing is a separate axis** owned by
RI-CHR01 §3 and it enters every table below as a second term.

Attribute deltas are applied to RI-PRG02's flat 10s. **Every race's deltas sum to +12**, so
no race is a strictly better statline; they differ in *shape* only. Skill bonuses set the
named skills to their listed value if currently lower (RI-PRG03 base is 5).

| # | Race | STR | END | AGI | SPD | VIG | WIL | INT | HIST | PER | LCK | Skills raised | Ability / power | Resistance |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|
| 1 | **Saxhleel** (Argonian, marsh-form) | 0 | +2 | +3 | +1 | 0 | 0 | +1 | +4 | 0 | +1 | Sneak 20, Security 15, Survival 20, Athletics 15, Root-Speech 10 | **Amphibious** — unlimited water breathing; no swim stamina drain; stand and act in deep water. **Root-listener** — sapwell rests cost 0 taint and yield one Hist line per new well. | Disease **immune** (CF-046 basis). Poison **75%**. |
| 2 | **Naga** (Argonian, naga-form) | +4 | +3 | +2 | +1 | +2 | 0 | 0 | 0 | −2 | +2 | Claw & Fang 25, Athletics 20, Survival 15, Sneak 10, Marksman 10 | **Amphibious** (as Saxhleel). **Shed** — once per HEARTH rest, break out of grapple/paralysis/bind and gain 3 s of poise immunity. | Disease **immune**. Poison **75%**. Frost **−25% (vulnerable)**. |
| 3 | **Dunmer** | +2 | 0 | +2 | +2 | 0 | +1 | +2 | 0 | 0 | +3 | Blades 20, Marksman 15, Sorcery 15, Athletics 10, Veiling 10 | **Ancestor Guardian** — once per rest, summon a spirit that fights for 30 s. | Fire **75%**. |
| 4 | **Imperial** | +1 | +1 | +1 | +1 | +1 | +1 | +1 | 0 | **+5** | 0 | Speechcraft 25, Mercantile 20, Blades 15, Shieldcraft 15, Warding 10 | **Star of the West** — absorb 30 stamina from a target, out of combat only (an intimidation tool, not a fight tool). **Voice of the Empire** — once per day, one Admire attempt cannot fail. | — |
| 5 | **Nord** | +4 | +4 | 0 | 0 | +3 | 0 | 0 | 0 | −1 | +2 | Greatweapons 25, Axes & Maces 20, Shieldcraft 15, Survival 10, Athletics 10 | **Thunder Fist** — once per rest, 60 shock damage on the next connecting hit. **Woad** — 30 s of +20 poise, once per rest. | Frost **90%**. Shock **50%**. |
| 6 | **Breton** | −1 | 0 | 0 | +1 | 0 | +4 | +4 | +1 | +2 | +1 | Sorcery 20, Warding 20, Veiling 15, Alchemy 15, Speechcraft 10 | **Dragon Skin** — 40 points of magic shield, once per rest. | Magic **50%** (all schools, including our own spells). |
| 7 | **Redguard** | +3 | +4 | +3 | +2 | +2 | −1 | −2 | 0 | 0 | +1 | Blades 25, Axes & Maces 15, Athletics 20, Acrobatics 10, Marksman 10 | **Adrenaline Rush** — once per rest, 30 s of doubled stamina regen. | Disease **75%**. Poison **75%**. |
| 8 | **Khajiit** | 0 | 0 | +5 | +3 | 0 | 0 | +1 | 0 | 0 | +3 | Sneak 25, Acrobatics 20, Security 20, Claw & Fang 15, Marksman 10 | **Night Eye** — toggleable, no cost, permanent. **Land on Your Feet** — fall-damage-free height ×2. | — |
| 9 | **Orsimer** | +5 | +5 | 0 | −1 | +4 | +1 | 0 | 0 | −3 | +1 | Axes & Maces 25, Greatweapons 20, Shieldcraft 20, Survival 10, Athletics 5 | **Berserk** — once per rest, 30 s of +30% melee damage and −30% damage resistance. | Magic **25%**. |
| 10 | **Bosmer** | −1 | 0 | +5 | +2 | 0 | 0 | +1 | 0 | 0 | +5 | Marksman 25, Sneak 20, Acrobatics 15, Alchemy 15, Survival 10 | **Beast Tongue** — once per rest, calm one beast-archetype enemy for 60 s (a real S13 non-lethal exit against the roster's animals, which have no parley). | Disease **50%**. Poison **50%**. |

> **AMENDED wave 1 (`W1-07`, `AMENDMENT-W1-07-02.md`) — three arithmetic corrections
> elsewhere in this item.** §3's RG-COURT row is all zeroes (the row this item's own prose and
> its method 2 both specify; the printed table gave the two Argonian columns +2). §4a's worked
> row C is **24**, not 28 — §3's matrix and §4b's `r = −26` both give 24, and the band and the
> stated consequence are unchanged. §4a's aggregate Saxhleel − Dunmer figure is **+11.75**,
> recomputed from this item's own cells, and method 3's threshold is restated at RI-DLG04's
> ≥ 8. No race profile, matrix cell other than RG-COURT, coefficient or scoring band elsewhere
> is touched.

> **AMENDED wave 1 (`W1-07`, `AMENDMENT-W1-07-01.md`) — one cell.** The Imperial row as
> originally written summed to **11**, not 12, and therefore failed this item's own method-1
> assertion `sum(attribute_deltas) == 12` and RI-CHR01 §2's 112-point invariant. `PER +4` is
> corrected to **`PER +5`**. All nine other rows were recomputed and are unchanged at 12. No
> threshold, matrix cell, skill, ability or resistance anywhere in this item was touched. The
> reasoning for choosing this cell rather than HIST or LCK is in the amendment file.

**Altmer are not playable and the reason is stated rather than shrugged:** this item's value
is the reaction matrix in §3, and a race earns a row there only if enough NPCs in 3E 427
Black Marsh have an *opinion* about it to fill one. Altmer presence in the province is a
handful of Mages Guild scholars; the honest row would be ten zeroes, which is exactly the
"race is a hat" failure this item exists to prevent. If a future wave gives Altmer a
political stake in Argonia, add the race **and its row** in the same change.

**Two abilities are deliberately non-combat** (Star of the West, Beast Tongue's calm) and one
is deliberately anti-combat. This mirrors RI-PRG02's rule that not every line on the sheet
may be a damage line.

### 2. The twelve reaction groups

Every NPC in `game/data/npcs/**` carries exactly one `reaction_group`. This is the axis the
matrix indexes; it is *not* the same as `faction`, because a Gideon dockhand who belongs to no
faction still has a politics.

| Key | Group | Where | Population share |
|---|---|---|---:|
| `RG-DEEP` | Xul-Aneekh / Deep-Kin and interior villagers | Helstrom, Stone Forest, Deep Marshes, Thorn's back tracks | 21% |
| `RG-ROOT` | Rootkeepers and sapwell-keepers | everywhere there is a well | 4% |
| `RG-LUKIUL` | Coastal assimilated Argonians | Gideon, Archon, Lilmoth, Soulrest | 24% |
| `RG-NAGA` | Naga bands and river-crews | Marauder's Coast, the Hive, riverine | 5% |
| `RG-LEDGER` | The Wet Ledger (lukiul + Imperial factors) | Gideon, Lilmoth | 6% |
| `RG-EMPIRE` | Provincial Office, Ninth Cohort, Blackrose staff | Gideon, Stormhold, Blackrose, Archon | 11% |
| `RG-DRES` | Dres salt-factors, ship-crews, raid parties | Crimson Coast, Salt Hills passes, at sea | 4% |
| `RG-BWC` | Blackwood Company, early | Lilmoth, Blackwood | 2% |
| `RG-VAKH` | Ixtu-Vakh, the Sap-Cutters | itinerant | 2% |
| `RG-COURT` | The Drowned Court | Soulrest, and every burial | 3% |
| `RG-TOWN` | Unaligned townsfolk, mixed-race, coastal | all eight settlements | 15% |
| `RG-OUTLAW` | Bandits, smugglers, fences, the Lilmoth rot-quarter | everywhere | 3% |

### 3. **The reaction matrix** — the item's core artifact

`raceReaction[group][race]`, in **disposition points**, added to `npc.baseDisposition` inside
RI-DLG04 §B's `derivedDisposition` **before** every other term. Range is a deliberate
[−40, +14]: wide enough to move a character two full disposition bands, bounded so it can
always be climbed back from by play (§6).

| | Saxhleel | Naga | Dunmer | Imperial | Nord | Breton | Redguard | Khajiit | Orsimer | Bosmer |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **RG-DEEP** | **+14** | +6 | **−40** | −22 | −16 | −14 | −12 | −8 | −18 | −13 |
| **RG-ROOT** | +12 | +8 | **−34** | −16 | −14 | −12 | −12 | −10 | −14 | −11 |
| **RG-LUKIUL** | +9 | −4 | **−28** | −2 | −6 | −4 | −4 | −6 | −10 | −5 |
| **RG-NAGA** | +2 | **+14** | −30 | −20 | −12 | −12 | −8 | +2 | −6 | −9 |
| **RG-LEDGER** | +4 | −8 | −6 | **+8** | +2 | +4 | +2 | −6 | −4 | +2 |
| **RG-EMPIRE** | −6 | **−20** | +2 | **+12** | +8 | +6 | +6 | −10 | +4 | 0 |
| **RG-DRES** | **−30** | −26 | **+12** | +4 | 0 | 0 | −2 | −6 | −4 | −2 |
| **RG-BWC** | −12 | −14 | +2 | +4 | +6 | +2 | +6 | 0 | +6 | **+10** |
| **RG-VAKH** | 0 | +4 | +2 | +2 | +2 | +2 | +2 | +4 | +2 | +2 |
| **RG-COURT** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **RG-TOWN** | +6 | −6 | **−18** | +2 | 0 | 0 | 0 | −4 | −6 | 0 |
| **RG-OUTLAW** | 0 | +6 | −4 | −4 | 0 | 0 | 0 | +4 | +2 | 0 |

**How to read the four load-bearing cells.**

- **Dunmer / RG-DEEP = −40.** The largest number in the corpus's social layer. A Dunmer is
  not disliked in the Helstrom interior; a Dunmer is *the shape of the thing that takes
  children*, and RI-LOR02 §1 establishes that this is happening now, not historically. −40
  drops a default 50-base NPC to 10 — the Hostile band in RI-DLG04 §E — before Personality,
  crime, weapon-drawn or anything else is counted.
- **Naga / RG-EMPIRE = −20.** Canon has the Pocket Guide calling Naga "thugs" (CF-026). We
  reproduce it *as Imperial contempt*, in the mouths of Imperial NPCs and in guard behaviour
  (§5), and never as narration. A Naga player is inside the majority and outside the law.
- **Saxhleel / RG-DRES = −30.** A Saxhleel is not a customer to a Dres factor. They are
  stock. This is the cell that changes an encounter (§4).
- **RG-COURT = all zeroes.** One group in twelve is genuinely indifferent, because the
  Drowned Court buries everyone for a fee and has for four hundred years. A matrix with no
  neutral row is a matrix somebody generated rather than authored.

**The upbringing term** (`character.creation.identity`, RI-CHR01 §3) stacks on top:

| | `interior` | `lukiul` | `foreign-born` | `blackrose` (born in the prison town) |
|---|---:|---:|---:|---:|
| RG-DEEP | **+10** | **−16** | −4 | −6 |
| RG-ROOT | +8 | −10 | −2 | −4 |
| RG-LUKIUL | −8 | **+10** | +2 | 0 |
| RG-LEDGER | −6 | +8 | +4 | 0 |
| RG-EMPIRE | −8 | +4 | +6 | +4 |
| RG-TOWN | −4 | +6 | 0 | −2 |
| all others | 0 | 0 | 0 | 0 |

Upbringing is legal for any race (a Dunmer raised in Lilmoth is `lukiul`; a Saxhleel born in
Cyrodiil is `foreign-born`), and it is the mechanism by which a player can *partly* buy out of
their race — a `lukiul` Dunmer is at −28 −16 = **−44** with the Deep-Kin, and an `interior`
Dunmer, which the fiction supports exactly once (raised by the marsh after a raid went wrong),
is at −40 +10 = **−30**. The axis never fully cancels the race term, and that is the point.

### 4. What the numbers actually do — five measurable consequences

#### 4a. Disposition and therefore content

Worked, at level 1, PERSONALITY 10, no faction, no crime, no disease, weapon sheathed, base
disposition 50, against a Helstrom (`RG-DEEP`, `interior`-typical) rootkeeper:

| Player | race | upbringing | derived disposition | Band (RI-DLG04 §E) | Consequence |
|---|---|---|---:|---|---|
| A | Saxhleel | interior | **74** | Friendly | Personal topics, faction gossip, best prices |
| B | Saxhleel | lukiul | **48** | Neutral | Generic topics, quests offered by rank |
| C | Imperial | foreign-born | **24** | Cold | Terse, punitive barter, **no quest offers** |
| D | Dunmer | foreign-born | **6** | Hostile | Root nine topics only, no services, no barter |
| E | Dunmer | lukiul | **0** | Hostile (floor) | Will not speak past the greeting |

**A and D differ by 68 disposition points on identical stats.** RI-DLG04 §E rule 5 requires the
majority-race player to average ≥ 8 higher than a minority-race player; averaged over all
twelve groups this matrix delivers Saxhleel − Dunmer = **+11.75**, and Saxhleel − Naga = **+3.25**,
which is deliberately *below* the DLG04 floor for that specific pair because Naga are not a
minority in Argonia — they are a feared part of the majority. The floor is a floor on the
*aggregate*, not on every pair, and this item states that reading explicitly so a critic does
not fail us for the Naga row.

#### 4b. Prices

On top of RI-PRG05's disposition/Mercantile multipliers, merchants apply a **standing
surcharge** derived from the same matrix:

```
raceSurcharge(merchant, player):
    r = raceReaction[merchant.reaction_group][player.race]
        + upbringingMod[merchant.reaction_group][player.upbringing]
    buyMult  = clamp(1.00 − 0.006 × r, 0.90, 1.30)
    sellMult = clamp(1.00 + 0.005 × r, 0.78, 1.10)
```

| Player at a Helstrom merchant | r | buy × | sell × | Round-trip vs Saxhleel |
|---|---:|---:|---:|---:|
| Saxhleel, interior | +24 | 0.90 | 1.10 | — |
| Imperial, foreign-born | −26 | 1.16 | 0.87 | **−30%** |
| Dunmer, foreign-born | −44 | 1.26 | 0.78 | **−44%** |

These multiply RI-PRG05's existing terms. A Dunmer with the Fence's Mercantile 100 and
PERSONALITY 60 still buys at `0.80 × 1.26 = 1.008×` in the interior — i.e. **all of the
best social build in the game buys them back to par with an untrained Saxhleel**, and no
further. That is the correct strength: race is a permanent handicap you can pay down, never
erase, and it makes the coast (where the surcharge is mild) economically necessary to a
foreign character in a way it never is to an Argonian one.

**The surcharge is not removable by Mercantile alone.** Three quests each permanently zero one
group's surcharge for the player (`crime.faction.standing`-adjacent; RI-QST05 counts them as
non-violent resolutions). This is the intended repair path and it is content, not a slider.

#### 4c. Dialogue that differs — five channels, all data-driven

| Channel | Rule | Minimum shipped volume |
|---|---|---:|
| **Greetings** | `greetings.json` pools keyed `(reaction_group, disposition_band, player_race_class)` where `player_race_class ∈ {saxhleel, naga, dunmer, imperial, other-foreign}` | ≥ 5 lines per cell; 12 groups × 5 bands × 5 classes = **300 cells, 1,500 lines** |
| **Race-filtered topics** | any topic record may carry `requires.race` / `forbids.race` | ≥ **90** race-filtered topic records, ≥ 30 of them `forbids` |
| **Third-person address** | Deep-Kin and rootkeepers address non-Argonians as `warmblood`, foreign-raised Argonians as `lukiul`, and Naga in the third person; the register is taken from the local corpus (§ Provenance) | ≥ **40** lines |
| **Rumours** | `rumours.json` entries may carry `requires.race`; the same town gossips differently at you | ≥ **2** race-specific rumours per settlement = **16** |
| **Slavery lines** | a Saxhleel or Naga player is asked about, warned about, offered help against, or *mistaken for* escaped stock; a Dunmer player is propositioned, congratulated, spat at, and once quietly asked for a favour | ≥ **60** lines, ≥ 12 of them addressed to a Dunmer player |

Register anchor, from the 3,888-line Argonian corpus on disk: Argonian speakers under duress
name themselves in the **third person** and in the **nominative-plus-status** form —
`"I am Ahaht. Slave."`, `"Morning-Star-Steals-Away-Clouds was sure..."` — and Argonian
self-description is collective: `"We are the People of the Root, called 'Argonians' by the
warmbloods."` Our race-filtered lines must sit in that register or they are not Argonian
lines, they are fantasy-generic lines with a `requires.race` field on them.

#### 4d. Quests that open and close

| Metric | Value | Note |
|---|---:|---|
| Quests with **any** race gate | **34** | of ~180 total |
| Quests **only** an Argonian (either form) can start | **11** | Hist-internal, hatching-pool, rootkeeper business |
| Quests **only** a non-Argonian can start | **7** | Dres factoring, Legion internal, Blackwood Company recruitment |
| Quests **only** a Naga can start | **3** | river-band business, and one where you are the crime |
| Quests a **Dunmer** is locked out of | **9** | of which **4** have an alternate route via a quest-fixed surcharge repair, **5** do not |
| Quests **easier** for a Dunmer (unique route) | **5** | you can walk into a Dres factor's house and be offered wine |
| **Race-locked with no alternative, whole game** | **≤ 12** | hard ceiling; every race must be able to finish the main quest and ≥ 3 factions |

The last row is the guard rail: RI-PRG03's "no build gets locked out" principle applies to race
too. Race redistributes content; it must never subtract more than 12 quests net from any race.

#### 4e. **AR-3 — race changes the fight itself**

Three mechanisms, all of which change what the combat system is handed:

1. **Encounter composition.** The roving `dres-raid-party` encounter (4–6 `INFANTRY` +
   1 `CASTER` + 2 `net-thrower`) spawns in the Rootlands and Salt Hills on a fixed schedule.
   Against a **Saxhleel or Naga player it opens hostile at 28 m and its net-throwers use
   capture behaviour** (bind, not kill — a defeat here is a scripted transport to Archon's
   holds, not a death). Against a **Dunmer, Imperial, Nord, Breton, Redguard, Orsimer or
   Bosmer player it does not aggro at all**: it hails you, and the parley (S13) it offers is
   *a purchase*. Against a **Khajiit player it aggros at 12 m** and does not offer capture,
   because a Khajiit is worth taking too but the Dres do not bother with the pretence.
   Same encounter id, same movesets, three different fights and one non-fight.
2. **Who opens hostile.** `RG-DEEP` war-broods have `hostile_below_disposition: 15`. A Dunmer
   arrives at 6. **Interior war-brood camps are hostile-on-sight to a Dunmer player and
   neutral to everyone else**, which means an entire tier-3/4 region's encounter density is a
   function of the character-creation screen.
3. **Who can be talked out of a fight.** S13 requires a non-lethal exit for anything that
   speaks. The parley's disposition gate is `≥ 30` for a bribe route and `≥ 45` for a
   faction-invocation route. A Dunmer player's race term puts most interior parleys below the
   bribe gate *by itself*, so their non-lethal exits must come from elsewhere — gold (the
   bribe verb is disposition-gated but the **Twin Lamps password is not**), or Veiling, or
   Bosmer-style calm effects, or the one thing that always works: leaving. **Every parley that
   a race term can close must have at least one race-independent alternative**, or the S13
   ruling is unimplemented for that race. This is the strictest constraint in the item.

### 5. Guards, and being visibly the wrong species

Full crime model is `corpus/23-stealth-crime/RI-CRM01`; this section owns only the race terms
it exports.

```
arrestThreshold(guard, player)  =  base[guard.authority] × raceLawFactor[guard.group][player.race]
attackThreshold(guard, player)  =  4 × arrestThreshold(...)
suspicionMultiplier(player)     =  raceSuspicion[guard.group][player.race]
```

`base` is 300 gold of bounty for Imperial authority, 150 for settlement militia, and the
interior has no arrest at all (see below). `raceLawFactor` for Imperial guards
(`RG-EMPIRE`, the only group that arrests):

| Race | lawFactor | Arrest at bounty ≥ | Attack at bounty ≥ | Suspicion × |
|---|---:|---:|---:|---:|
| Imperial | 1.35 | 405 | 1,620 | 0.80 |
| Nord / Breton / Redguard / Bosmer | 1.15 | 345 | 1,380 | 0.90 |
| Dunmer | 1.10 | 330 | 1,320 | 0.95 |
| Orsimer | 0.85 | 255 | 1,020 | 1.20 |
| Saxhleel | 0.70 | 210 | 840 | 1.35 |
| Khajiit | 0.55 | 165 | 660 | 1.55 |
| **Naga** | **0.33** | **99** | **396** | **2.00** |

`suspicionMultiplier` feeds RI-STL01's detection model: it scales how fast a guard's
`alert` rises when you are seen doing something ambiguous, and it is the mechanism by which a
Naga cannot loiter. Concretely: a Saxhleel can stand in an Imperial warehouse for 6.7 s before
a guard challenges; a Naga gets **4.5 s**; an Imperial gets **11.3 s**.

Two clauses that keep this from being merely cruel:

- **The interior does not arrest.** `RG-DEEP` settlements have no bounty, no guards, and no
  jail. They have `blood-price` (RI-CRM01 §6): a debt owed to a family, payable in gold, in
  labour, or in a matching death, and it never expires and never leaves on respawn. A Dunmer
  player is in more danger in Helstrom than a bounty could express, and an Argonian player
  discovers that Imperial jail is the *lenient* system.
- **Race never changes what is a crime.** Only the response. Theft is theft for everyone; a
  Naga is caught faster and arrested cheaper, and that asymmetry is stated in-world by NPCs
  who think it is fine and by NPCs who think it is an outrage.

### 6. Repair paths — race must be a slope, not a wall

| Path | Effect | Where |
|---|---|---|
| **Reputation** | Global Reputation (RI-DLG04 §C `repTerm`) is race-blind; at Reputation 40 it contributes +40 to persuasion ratings, out-weighing a −40 race term in the *persuasion* channel though not in disposition | all |
| **Faction rank** | RI-DLG04 §B's faction term is `(0.5×rank + 1) × 3 × reaction`; Deep-Kin rank 6 against a Deep-Kin NPC is +48, which fully covers a Dunmer's −40 | joining the Xul-Aneekh as a Dunmer is possible, brutal, and one of the game's best stories |
| **Three surcharge quests** | permanently zero one group's price surcharge each | Gideon, Helstrom, Archon |
| **Twin Lamps password** | race-blind, disposition-blind; opens one topic on ~40 NPCs | RI-LOR02 §4.9 |
| **Sap-taint band 4** | `rooted` non-Argonians are addressed by rootkeepers regardless of race, and some Argonians will not be in the room | RI-LOR05 §4a |

The rule the paths encode: **an Argonian player is given the province's goodwill and spends
the game discovering what it costs; a foreign player is given nothing and spends the game
buying in.** Both are twenty-hour arcs. Neither is the easy mode.

## Comparison method

Executable by a fresh agent with this file, `game/data/`, and the harness.

1. **Race table conformance.** Load `game/data/progression/races.json`. **Assert exactly 10
   races**; for each, **assert `sum(attribute_deltas) == 12`**, ≥ 4 skills raised, ≥ 1 ability,
   and that the ability/resistance fields match §1 exactly. **Assert no two races have
   identical skill sets.**
2. **Matrix completeness and shape.** Load `game/data/progression/race-reactions.json`.
   **Assert a full 12 × 10 matrix with no nulls**, values in [−40, +14]. Then the anti-generation
   checks: **assert ≥ 1 row is all zeros** (RG-COURT), **assert σ over all 120 cells ≥ 9.0**,
   **assert no two rows are equal**, and **assert no two columns are equal**. A matrix where
   every foreign race gets the same number is one race with nine skins.
3. **The 68-point test (the item's headline).** Run the disposition oracle from RI-DLG04
   method 1 with the §4a inputs. **Assert derived disposition for (Saxhleel, interior) vs
   (Dunmer, foreign-born) at the same Helstrom rootkeeper differs by ≥ 60 points**, and that
   the two land in different RI-DLG04 §E bands. **Assert the aggregate Saxhleel − Dunmer mean
   over all twelve groups is ≥ 8** — RI-DLG04 §E rule 5's floor. *AMENDED wave 1 (`W1-07`,
   `AMENDMENT-W1-07-02.md` §C): this item claimed +15.3 and asserted ≥ 12 on that basis;
   recomputed from its own 120 cells the mean is **+11.75**, so the assertion is restated at
   the floor it was derived from. The 68-point gap, σ ≥ 9.0 and Dunmer/RG-DEEP = −40 are
   untouched.*
4. **NPC coverage.** `jq` every file under `game/data/npcs/**`. **Assert 100% of NPCs carry a
   `reaction_group` from §2** and that the population shares are within **±4 percentage
   points** of §2's column. A world where 80% of NPCs are `RG-TOWN` has a matrix that never
   fires.
5. **Dialogue volume.** Static analysis over `game/data/dialogue/**`:
   ```
   node tools/analysis/content-stats.mjs --facet race
   ```
   **Assert** ≥ 1,500 greeting lines across ≥ 250 of the 300 §4c cells; ≥ 90 topic records with
   `requires.race` or `forbids.race`, ≥ 30 of them `forbids`; ≥ 16 race-gated rumours spread
   over all 8 settlements; ≥ 60 slavery lines with ≥ 12 addressed to a Dunmer player.
   **Assert no greeting cell is empty for any of the 5 player-race classes at bands 3–5.**
6. **Register conformance (blind, manual).** Sample 30 shipped Argonian-voiced race-filtered
   lines and 30 lines drawn at random from
   `corpus/60-lore/data/argonian-dialogue-corpus.json`. Present unlabelled to a fresh agent and
   ask it to sort them into two piles by author. **Assert ≤ 70% sorting accuracy.** Above that,
   our Argonian voice is distinguishable from Bethesda's and is therefore wrong.
7. **Price assertion.** Harness: `loadState('helstrom-market')`, then for each of the three §4b
   player configurations read the quoted price of a fixed item (a Healing draught, base 60).
   **Assert quotes within 3% of {54, 70, 76} gold** and that sell quotes are
   {66, 52, 47}. Then **assert the Mercantile-100/PER-60 Dunmer buy multiplier is in
   [0.98, 1.05]** — the "best social build reaches par, not advantage" clause.
8. **Encounter-composition test (the AR-3 assertion, mandatory).** For each of
   {Saxhleel, Dunmer, Khajiit}, run the same scenario:
   ```
   node tools/harness/run-headless.mjs --scenario wld-dres-raid-road --seed 1337 \
        --state "race=<r>,upbringing=foreign-born"
   ```
   From `trace.jsonl`: **assert the Saxhleel run contains `enemy_state` transitions to `AGGRO`
   at `dist_m ≥ 26`; assert the Dunmer run contains zero `AGGRO` transitions in 1,800 frames
   and ≥ 1 `parley_offer` event; assert the Khajiit run's first `AGGRO` is at `dist_m ≤ 14`.**
   **Assert the enemy `archetype` and `moveset` ids are identical across all three runs** —
   if the fight itself changed, that is Morrowind leaking into Souls' domain (AR-1), and if
   *nothing* changed, the item's AR-3 claim is fraudulent. Both are fails.
9. **Guard threshold test.** `loadState('stormhold-street')`, set bounty to 250, spawn a guard,
   step 600 frames. **Assert the guard initiates arrest dialogue for a Saxhleel and a Naga and
   does not for an Imperial or a Dunmer.** Repeat at bounty 120: **assert only the Naga is
   arrested.** Then measure loiter-to-challenge time in an owned interior for all ten races and
   **assert the Naga:Imperial ratio is in [2.2, 2.8]** (§5 claims 4.5 s : 11.3 s = 2.51).
10. **No-lockout audit.** From `game/data/quests/**`, compute for each race the count of quests
    with a race gate excluding it and no alternate `resolution`. **Assert ≤ 12 for every race**,
    **assert every race can complete the main quest** (walk the `category: "main"` stage graph
    with each race's flags), and **assert every race can reach rank 5 in ≥ 3 factions.**
11. **S13 parley coverage under race.** For every humanoid encounter with a `parley` block,
    evaluate its gate at each race's worst-case disposition. **Assert every parley has ≥ 1
    route that is not disposition-gated** (password, gold, faction token, knowledge). Any
    encounter where a race term alone closes every non-lethal exit is a **hard fail** — it
    means we shipped a race that must kill.

## Scoring

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| Race profiles | 10 races, sums == 12, all distinct, ≥ 3 non-combat abilities | 10 races, sums == 12, distinct skill sets | races differ only in stats; or one race strictly dominates |
| Matrix shape | σ ≥ 12, all rows & columns distinct, ≥ 1 neutral row | σ ≥ 9, rows distinct | any two foreign races share a column, or σ < 5 |
| Disposition spread | ≥ 60-point Saxhleel/Dunmer gap, 3+ bands represented | ≥ 60-point gap, 2 bands | < 25 points — race is flavour |
| NPC coverage | 100% tagged, shares within ±2 pts | 100% tagged, ±4 pts | > 40% of NPCs in one group |
| Dialogue volume | all §4c minimums met with ≥ 20% headroom | all minimums met | < 50% of any minimum, or zero `forbids.race` records |
| Register (method 6) | ≤ 60% blind sorting accuracy | ≤ 70% | ≥ 85% — our Argonians are not Argonians |
| Prices | all three quotes within 1%, par clause holds | within 3%, par clause holds | no race term in pricing at all |
| **AR-3 encounter test** | three distinct opening behaviours, identical movesets | same | **any moveset/archetype difference (AR-1 fail), or zero behavioural difference (AR-3 sterile) → item fails** |
| Guard thresholds | ratio 2.4–2.6, all ten races distinct-ish | ratio 2.2–2.8 | guards behave identically for all races |
| No lockout | ≤ 6 net-locked quests per race | ≤ 12 | any race cannot finish the main quest → **automatic fail** |
| Parley coverage | 100% of parleys race-independent-routed | 100% | any race-closed parley → **hard fail** |

**Failure threshold: any axis below 6.** The AR-3 axis, the no-lockout axis and the parley axis
are binary and cannot be traded against the others.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 | 6 / 10 | 8 / 10 |

**Aggregation (a property of this item, not of the critic):** min-over-axes.

## How we lose

- **Race becomes a stat block and the matrix is never built.** The single likeliest outcome. A
  builder ships `races.json` with the §1 table in an afternoon, because it is easy and it feels
  like progress, and then the 120-cell matrix and 1,500 greeting lines are "wave 2 content".
  The game then has a race select that does nothing, in a setting where race is the subject.
  Method 2 and method 5 exist to make this visible immediately, and no verdict may pass this
  item on §1 alone.
- **The matrix is generated, not authored.** Someone writes a helper that assigns every
  "foreign" race the same −15 and every Argonian +10. It passes a naive completeness check and
  fails the world: a Nord and a Dunmer are *not* the same problem in Argonia, and the fact that
  they are different is the entire content of the era brief. Caught by the row/column
  distinctness and σ assertions, and only by them.
- **We make Dunmer unplayable rather than hard.** −40 in the interior is a design that requires
  §6's repair paths to actually exist and actually be reachable at level 1–10. If they slip, a
  Dunmer player hits a wall in hour two, cannot buy healing draughts, cannot get a quest, and
  quits. The failure will be reported as "the Dunmer start is too punishing" and the correct
  fix is *more repair content*, not a smaller number. If the numbers get softened instead, the
  item is dead and the setting is decoration.
- **The AR-3 encounter difference is implemented as a stat change.** Someone makes the Dres
  raiders "weaker against Dunmer" or gives them more HP against Argonians. That is Morrowind
  reaching into the fight and it is an automatic AR-1 fail. The legal lever is exclusively
  *whether, when and how they aggro, and what parley they offer*. Method 8 asserts moveset
  identity precisely because this mistake is intuitive and well-meant.
- **Slavery is present as scenery.** Chained NPCs in a corner, one sad line each. RI-LOR02 §
  How-we-lose already names this; here it takes the specific form of a race system whose
  slavery content is 6 lines instead of 60, so a Dunmer player never once has the trade
  addressed *to them*. The 12-lines-addressed-to-a-Dunmer minimum in §4c is the floor, and it
  is a low floor.
- **Naga get folded into Argonian.** It is one more column, one more row, three more quests and
  a lot of dialogue, and it will be cut for scope. Cutting it loses the best structural idea in
  the item — that the majority contains a group the majority itself polices — and it turns
  `arrestThreshold 0.33` into a number nobody can see.
- **The Argonian voice comes out as generic fantasy-noble.** "The roots whisper of your coming,
  outlander." We have 3,888 real Argonian lines on disk and a builder will not open them.
  Method 6 is a blind test specifically because a self-assessment of "does this sound
  Argonian?" always returns yes.
- **Prices are the only thing that differs.** A merchant multiplier is trivially easy and
  everything else in §4 is expensive. A build where race changes gold and nothing else scores
  well on method 7 and is exactly the "race is a hat" game this item exists to prevent.
- **Race gates content and never opens any.** All nine foreign races become subtractive: less
  dialogue, fewer quests, worse prices, no compensation. The 7 non-Argonian-only quests and the
  5 Dunmer-easier routes are the counterweight and they are the first things to be dropped,
  because "content only some players see" is the least efficient content to build. It is also
  the only kind that makes the choice mean anything.
- **Upbringing gets merged into race.** It is a second axis with its own table and it will look
  redundant. Without it there is no `lukiul` Argonian, which is the character the entire
  coast/interior fracture (RI-LOR02 How-we-lose §4) is *about*, and no way for any player to
  partially buy out of their starting standing.

## Provenance note

**The entire reaction matrix, all attribute/skill/ability profiles, the surcharge formula, the
guard `lawFactor` table, every quest count and every dialogue minimum are `constructed`** and
are binding on that basis. No number in this file is measured, and none is Bethesda's.

Structural debts, each `canonical-recall` at **medium** confidence: Morrowind's ten-race
select with attribute/skill/ability/resistance profiles; its `fDispRaceMod` same-race bonus
(carried through unchanged from RI-DLG04, which sources it as `community-data`); its
faction-reaction matrix concept; and its racial powers being once-per-day rather than
build-defining.

Setting facts are inherited, not re-derived, from `corpus/60-lore/RI-LOR01` with the
confidence recorded there: Dres slave-raiding legal and current in 3E 427 (CF-062,
hard-canon); the Hist deciding what hatches, including marsh- and Naga-forms (CF-004,
hard-canon/medium); Imperial sources calling Naga "thugs" (CF-026, the existence hard-canon,
the slur apocryphal — and reproduced here only as in-world Imperial opinion); *lukiul* as a
real and resented category (CF-031, medium); Argonian disease immunity as the Knahaten Flu's
signature (CF-046). The twelve reaction groups are the nine factions of RI-LOR02 §4 plus three
non-faction groups added here.

**The Argonian register claims in §4c are `community-data`** and are the only part of this
item grounded in a real corpus: 3,888 Argonian-voiced lines shipped with Morrowind, extracted
to `corpus/60-lore/data/argonian-dialogue-corpus.json`. The quoted forms
(`"I am Ahaht. Slave."`, `"We are the People of the Root, called 'Argonians' by the
warmbloods."`) are verbatim from that file.

Confidence is **medium**, not high, and the reason is specific: the matrix's *shape* is
argued from the era brief and I am confident in it, but the *magnitudes* — is the Deep-Kin
term −40 or −25? — are unvalidated taste. −40 was chosen because it is the smallest number
that moves a default NPC two full disposition bands, which is the smallest change a player
will reliably notice. The first playtest of a Dunmer start should re-derive it, and the two
things most likely to be wrong are that number and the assumption that §6's repair paths are
reachable early enough to keep a Dunmer start playable.
