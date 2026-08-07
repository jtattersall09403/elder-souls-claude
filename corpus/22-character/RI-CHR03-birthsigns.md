---
id: RI-CHR03
title: Birthsigns — the nine tides, three of which take something from you
kind: number
side: morrowind
judges: [character.birthsign.powers, character.birthsign.drawback, progression.build.identity, character.creation.irreversibility, lore.religion.hist]
provenance: constructed
confidence: medium
blind_pair: no
---

## The bar

Morrowind's birthsigns are the best five seconds of character creation in the series, and the
reason is exactly one of them: **The Atronach**. It gives you 150% more magicka and 50% spell
absorption and it takes away *all magicka regeneration, permanently*. It is not a bonus with a
tax attached; it is a different game, chosen in the first minute, by someone who did not yet
know what magicka regeneration was. Twenty-four years later people still describe their
Atronach run. Nobody has ever described their Lady run.

The bar is therefore two things, and the second is the whole item:

1. **Birthsigns must be Hist cosmology, not Imperial constellations.** The Warrior, the Mage
   and the Thief are Cyrodilic star-charts drawn by people who look up. Black Marsh's
   metaphysics run **downward** — the Rootward Tide, the roots that drink, the sap that holds
   pattern (`RI-LOR05` §2). What you were "born under" here is *the state of the tide on the
   day you were drawn from it*. Importing the thirteen Imperial signs into Argonia would be
   the single laziest possible failure and it would contradict a corpus item that already
   exists.
2. **At least two signs must carry a real drawback.** "Real" has a test: a drawback is real if
   a competent player can *lose the run* to it, or if it removes a system rather than reducing
   a number. `−10 Willpower` is not a drawback. `You have no Focus regeneration, ever` is.
   We ship **six** signs with drawbacks, in two flavours — three that take away a mechanic and
   three that attach a condition to the world — and the item's honest risk is that they are
   too strong, not too weak.

This closes the corpus hole `progression.build.identity`: a birthsign is the one build input
that is chosen before you understand it, cannot be respecced, and is legible in play.

## The reference artifact

### 1. The fiction, in one paragraph

An Argonian is drawn from a hatching pool at a moment, and the roots below that pool are at
some state — running full, running out, running the wrong way. That state is **your tide**, and
the rootkeeper who lifts you records it. Non-Argonians are assigned one too: the Warden-Scribe
asks *"which tide were you drawn on"*, converts whatever Imperial sign you name from your own
star-chart onto the marsh's, writes the marsh answer on the writ, and does not care that you
disagree. **The Imperial thirteen exist in-world** — they are named in books, Imperials use
them, and a Cyrodilic priest in Gideon will read your birth-chart for 30 g — and they have
**zero mechanical effect**. That collision is content: it is one of the clearest small
demonstrations in the game that this province runs on its own physics.

### 2. The three families

| Family | The tide was | Character | Drawbacks | Signature slot (`RI-CHR01` §5) |
|---|---|---|---|---|
| **Given** | full, or rising | The root had enough and gave freely. Modest, safe, unglamorous. | none | `given` |
| **Withheld** | out, or dry | The root had nothing to give, so something else filled the space. | **severe, mechanical** | `withheld` |
| **Turned** | running backwards | The tide ran the wrong way and you came up with it. Strange, conditional, political. | **severe, conditional** | `turned` |

Three signs per family, nine total. The Withheld family is the Atronach family and it is where
this item's value is.

### 3. The nine tides

Jel names follow `RI-LOR04` §1–2 (no apostrophes, no `q`/`y`/`f`, modifier-first compounds).

#### Given — no drawback

| Sign | Jel | Power | Numbers |
|---|---|---|---|
| **The Full Root** | `Raj-Xul` | The tithe-gourd holds one more swallow. | **+1 tithe-gourd charge** at every charge tier (`RI-CMB08`). At the game's 4-charge start this is +25% healing throughput; at the 10-charge cap, +10%. Deliberately front-loaded: it is the sign for a first-time player and it gets quietly weaker as you get better. |
| **The Warm Stone** | `Xan-Kheel` | You hatched on sun-warmed xanmeer stone. | **Fire resistance 50%, frost resistance 25%.** Once per HEARTH rest, **purge all status buildup on yourself to zero** (bleed, rot, poison, frost — S11's Souls-side meter, `combat.status.buildup`). |
| **The Long Root** | `Deek-Xul` | Your pool sat under a trade road and the root ran a long way. | **Travel fares −40%** (`RI-PRG05`: cross-map 90 g → 54 g). **+5 disposition with every merchant**, independent of Mercantile. Once per HEARTH rest, **`Root-Return`**: walk back to the last settlement well you rested at — above ground, out of combat, to a place you have been, never into or within a dungeon or arena (S7/S19 compliant, and it is an *effect you have*, not a map pin). |

#### Withheld — the mechanical drawbacks

| Sign | Jel | Power | **Drawback** |
|---|---|---|---|
| **The Dry Well** | `Nu-Ixtu` | **Max Focus ×1.60.** You **absorb 55% of the magnitude** of any spell effect that lands on you, as Focus. | **You have no Focus regeneration of any kind. Ever.** Not passive, not from resting, not from Fatigue, not from ENDURANCE. Focus is refilled **only** by absorption and by consumables. This is the Atronach, ported to our Focus economy and *not softened*: a Dry Well character who walks into a room with no casters in it has whatever Focus they walked in with. |
| **The Spilled** | `Teekh-Nuvei` | Your pattern was never fully drunk, so the tithe does not stick to you properly. **You keep 40% of your dropped tithe on death** instead of 0, and **your bloom never decays** — dying again does not lose the first bloom (`RI-LOR05` §4). | **The wells hold you badly.** You respawn at the **second-nearest** rested sapwell, not the nearest — measured by graph distance over the well network, which in practice means every death costs an extra 90–400 m of walk-back. You **cannot be the target of any recall, intervention, resurrection or summon-to effect**, including The Long Root's `Root-Return` if taken via `Kaal-Kaal`. |
| **The Unlit Water** | `Nu-Shanei` | The Shadow-tide (CF-028). **Permanent −20% enemy detection radius** (multiplies `RI-STL01`'s Sneak term). Once per HEARTH rest, **20 s of true invisibility**, broken by attacking, opening a container, or entering a lit interior. | **The Shadowscales have a claim on you and it is not a metaphor.** You begin with an unremovable `shadowscale-claim` flag on the writ. A ku-vastei arbiter finds you at three fixed story points and **gives you an order** — always a killing, always someone you have met, never someone the game frames as deserving it. Obeying costs a faction. **Refusing costs 15 Reputation and makes the arbiter permanently hostile**: a named, levelled assassin who thereafter appears in your encounter tables for the rest of the game. There is no third option and no way to clear the flag. |

#### Turned — the conditional drawbacks

| Sign | Jel | Power | **Drawback** |
|---|---|---|---|
| **The Backward Tide** | `Vastei-Nu` | The tide ran up instead of down when you were drawn. **Your first HEARTH rest of each in-game day refunds its tithe** — you keep the souls you were carrying through that one rest. Over a typical clear this is worth ≈ 8% of lifetime souls (`RI-PRG06`). | **The marsh re-grows more where you have been.** Ordinary enemy respawn density on rest is **×1.5** for you (S5's Souls-side respawn, `RI-LOR05`'s "the root drank your tithe and is holding more than it was"). Every corpse-run is harder; every farmed area refills faster. It is a straight trade of souls for danger and it is the only sign that makes the game *more* Souls-like. |
| **The Two-Drink** | `Kaal-Kaal` | You were given the sap twice. **Choose a second sign at creation. You receive its power at half magnitude.** | **You receive that second sign's drawback at full magnitude.** Choosing The Dry Well gives you ×1.30 Focus and 27% absorption *and* zero Focus regeneration. Choosing The Unlit Water gives you −10% detection radius and a 10 s invisibility *and* the full Shadowscale claim. Choosing a Given sign gives you half a modest power and nothing else, which is legal, safe, and the reason this sign is not simply the best one. |
| **The Grey Sap** | `Shuja-Vei` | You were drawn from a well that was already dying, and the tree has no purchase on you. **You are immune to sap-taint** (`RI-LOR05` §4a) regardless of race — a Nord Grey Sap rests at wells forever and never hallucinates, never reaches band 3, never sees an enemy model lie. | **The Hist will not speak to you.** Not once, not ever. Rootkeeper disposition **−25** on top of the `RI-CHR02` matrix. **Four quests are closed** (three have an alternate route through the Drowned Court or the Sap-Cutters; **one does not**), and the sap-taint band-4 *rooted* ending path is unreachable. You have bought safety from the game's most interesting corruption mechanic by giving up its most interesting relationship. |

### 4. Balance — what each sign is actually worth

Signs are not equal in power and are not supposed to be; they are equal in **decidability**,
which is the property that a reasonable player can want each one. The estimates below are the
item's binding balance claim and the thing method 3 checks.

| Sign | Family | Combat value | World value | Risk | Who takes it |
|---|---|---:|---:|---:|---|
| The Full Root | Given | ●●●○ | ○○○○ | none | first-time players; anyone struggling |
| The Warm Stone | Given | ●●○○ | ●○○○ | none | the Deep Marshes and the fire bosses |
| The Long Root | Given | ○○○○ | ●●●○ | none | traders, travellers, `RI-QST05` talkers |
| The Dry Well | Withheld | ●●●● *(caster)* / ○ *(non-caster)* | ○○○○ | **very high** | dedicated casters only; a trap for everyone else, on purpose |
| The Spilled | Withheld | ●●○○ | ●○○○ | **high** | players who die a lot and know it |
| The Unlit Water | Withheld | ●●●○ | ●●○○ | **very high** | stealth builds willing to owe someone |
| The Backward Tide | Turned | ○○○○ | ●●●● | **high** | levelling-focused builds; anyone confident in the fight |
| The Two-Drink | Turned | *variable* | *variable* | **variable** | second playthroughs |
| The Grey Sap | Turned | ●○○○ | ●●○○ *(and −●●●)* | **high** | non-Argonian players who want the checkpoint without the cost |

**The Dry Well is deliberately a trap for a non-caster and the item says so out loud.** A
birthsign roster where every sign is good for every build is a roster of nine small bonuses.
The Atronach's design lesson is that the memorable choice is the one you can get *wrong*.
What must be true is that the wrongness is *knowable* — the Warden-Scribe describes each tide in
plain fiction that a careful player can decode ("the root gave you nothing, so nothing runs
back into you") — and *survivable*, which §5 handles.

### 5. Irreversibility and the one re-cut

Birthsign is the only creation input with a reversal path (`RI-CHR01` §7), and it is a quest,
not a service.

| Property | Value |
|---|---|
| Where | The great Hist at Helstrom, in the hollowed bole. Nowhere else. |
| Prerequisite | Rootkeeper disposition ≥ 70, **or** Deep-Kin rank ≥ 4, **or** having completed the Drowned Court's second questline |
| Cost | **All souls currently carried, to a minimum of 25,000**, plus one in-game week during which the character is unplayable (the world advances: quest timers run, two quests can expire) |
| Uses | **Exactly one, per save. Ever.** |
| What it is called | `vastei-eixa` on the largest scale — the tree re-cutting a pattern it holds (`RI-LOR05` §4) |
| What it cannot do | Clear a `shadowscale-claim` already acted on; restore the four quests The Grey Sap closed if they have been failed; change race, upbringing or class |
| The Grey Sap exception | A Grey Sap character **cannot use this** — the Hist will not speak to them. This is stated at creation. |

The re-cut exists for exactly one reason: so that a player who took The Dry Well at minute four
and discovered at hour twelve that they hate casting is not required to restart eighty hours of
world state. It is priced so that it is never a routine optimisation, and it excludes the one
sign whose fiction forbids it.

### 6. Where a birthsign is visible

A birthsign that only appears on the character sheet has failed the same way a class that only
appears on the character sheet has failed (`RI-CHR01` §6.5).

| Channel | Requirement |
|---|---|
| Rootkeepers | can name your tide on sight, unprompted, in the greeting. **≥ 9 lines, one per sign.** |
| Topics | **4 birthsign-gated topics**, 1 quest (`RI-CHR01` §2) |
| The Unlit Water | 3 scripted arbiter encounters + a persistent hostile named NPC — the most content any single sign carries |
| The Grey Sap | 4 closed quests, 3 with alternates; rootkeeper hostility voiced, not silent |
| The Spilled | the respawn well is *narrated* — the keeper of the nearest well tells you, once, that the root would not take you |
| The Imperial thirteen | a Cyrodilic priest in Gideon reads your Imperial chart for 30 g and is **wrong about everything**, verifiably, against your actual sign |

## Comparison method

1. **Roster and cosmology.** Load `game/data/progression/birthsigns.json`. **Assert exactly 9
   signs**, each with `family ∈ {given, withheld, turned}`, 3 per family, a Jel name passing
   `corpus/80-methods/jel-phonotactics.py`, and a `power` block. Then the cosmology check:
   ```
   grep -riE "warrior|mage|thief|lady|steed|lord|apprentice|atronach|ritual|shadow|tower|lover|serpent" game/data/progression/birthsigns.json
   ```
   **Assert zero hits** — an Imperial sign name appearing as one of our nine is an outright
   fail. Then **assert the thirteen Imperial names DO appear** somewhere in
   `game/data/books/**` or `game/data/dialogue/**`, because they exist in-world and a world
   that has never heard of them is as wrong as one that runs on them.
2. **Drawback census — the item's core assertion.** For each sign, classify its drawback as
   `none` / `numeric` / `mechanical` / `conditional`. **Assert ≥ 2 signs have a `mechanical`
   drawback** (the brief's floor) and **assert this build ships 3 `mechanical` + 3
   `conditional` = 6**. Then the reality test, per mechanical drawback: **assert the drawback
   removes a system rather than scaling it.** Concretely, for The Dry Well, run:
   ```
   node tools/harness/run-headless.mjs --scenario prg-focus-regen --state "birthsign=nu-ixtu" --frames 3600
   ```
   and **assert `player.focus` is monotonically non-increasing across all 3,600 frames except
   on `absorb` and `item` events.** A single frame of passive regen means the Atronach was
   softened and the axis scores 0.
3. **The Spilled respawn assertion.** `loadState('rootlands-well-graph')`, rest at wells A and
   B, die between them. **Assert the respawn well is B when A is nearest** (second-nearest by
   graph distance) and that `getPlayerStats().souls` after death is within 1% of 40% of the
   carried amount. Then **assert every recall/intervention/resurrect effect targeting the
   player returns a refusal event, not a silent no-op.**
4. **The Unlit Water claim.** Static: **assert the 3 arbiter encounters exist as quest records
   with both `obey` and `refuse` outcomes**, that `refuse` sets Reputation −15 and spawns a
   named persistent hostile, and that **no data path clears `shadowscale-claim`.** Dynamic:
   refuse once, then **assert the named assassin appears in ≥ 3 later encounter tables.**
5. **Balance decidability.** For each sign, play it (`RI-CHR01` method 6's walk,
   `node tools/quests/viability-walk.mjs`) across the class families the walk's declared sample
   reaches. **Assert every sign is end-to-end viable with ≥ 4 of the 6 families**, and **assert
   The Dry Well is viable with ≥ 1 family and non-viable with ≥ 2** — the trap must be a real trap
   and must not be a universal one. A sign viable with 6/6 families has no drawback that matters.

   > **AMENDED wave 1 — `NEXT-DISPATCH.md` §R, the viability split.** This method used to name the
   > static checker. That tool was rejected five times and is now
   > `tools/analysis/impossibility-screen.mjs`, **a screen**: it may say a sign's demands are
   > impossible, and it is forbidden in code to say a sign is decidable. Decidability is a positive
   > claim, so it is answerable **only** from the walk, and only over the sample the walk declares.
   > If the walk's sample does not reach 6 families for a sign, that is `unmeasurable` for that
   > sign — not a pass and not a fail.

   > **AMENDED wave 1 — `BAR-CRITIQUE-W1-07-R1` §R2.5. While the build-viability tool
   > does not exist, the Decidability axis is `corpus_debt`: removed from the min-over-axes
   > aggregation, reported at `unmeasurable`, and filed against `RI-MTH06` — not scored 0 against
   > the build.** The reasoning is `RI-CHR01` method 6's, in full, and the effect here is the same:
   > this item aggregates min-over-axes, so an axis no build can measure pinned `RI-CHR03`'s native
   > score at **0 for every build that will ever exist**, and did, in both `W1-07` rounds. The
   > axis keeps its `≥ 4 of 6`, `≥ 1 / ≥ 2` and `6/6 ⇒ 0` thresholds verbatim and returns to the
   > min the day the tool does.
6. **Visibility.** Static analysis over `game/data/dialogue/**`: **assert ≥ 9 rootkeeper
   greeting lines keyed on `birthsign`, one per sign; ≥ 4 birthsign-gated topics; ≥ 1
   birthsign-gated quest.** Harness: create a Spilled character, rest, die, **assert a keeper
   line fires exactly once.**
7. **The re-cut.** Harness: satisfy the §5 prerequisite, invoke the re-cut. **Assert souls are
   zeroed with a 25,000 minimum charged, that one in-game week passes on the world clock, that
   two named quest timers advance, and that a second attempt is refused in dialogue.** Then
   **assert a Grey Sap character is refused at the prerequisite stage with a spoken reason.**
8. **Numbers conformance.** Assert against §3 directly: tithe-gourd charges +1 at all tiers;
   fire/frost resistances 50/25; travel fare 90 g → 54 g; max Focus ×1.60 ± 1%; absorption
   55% ± 1%; detection radius ×0.80 ± 1%; respawn density ×1.5 ± 5% measured over 20 rests;
   rootkeeper disposition −25 exactly.
9. **`Kaal-Kaal` composition.** For all 8 second-sign choices: **assert the power is applied at
   half magnitude and the drawback at full.** Specifically **assert `Kaal-Kaal`+`Nu-Ixtu` has
   zero Focus regen** (full drawback) and **×1.30 max Focus** (half power). A build where the
   drawback is also halved has broken the sign's entire premise and made it strictly optimal.

## Scoring

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| Cosmology | 9 Hist-rooted signs; Imperial thirteen present in-world as a wrong system | 9 Hist-rooted signs; no Imperial names in the roster | any Imperial sign shipped as one of ours → **automatic fail** |
| Drawback count | 3 mechanical + 3 conditional | ≥ 2 mechanical | 0–1 real drawbacks → the brief's floor is missed |
| Drawback reality (method 2) | Dry Well shows zero regen frames; all three mechanical drawbacks remove a system | same | any mechanical drawback implemented as a percentage penalty |
| Decidability | every sign viable with 4–6 families; Dry Well non-viable with ≥ 2 | same | every sign viable with all 6 (nine small bonuses) |
| Visibility | all §6 channels shipped, ≥ 20% headroom | all §6 minimums | birthsign appears only on the character sheet |
| Re-cut | exists, priced as §5, one use, Grey Sap refused with a spoken reason | exists, one use | free respec, or no reversal at all |
| Numbers | all within 1% | all within 5% | any sign's headline number missing |
| `Kaal-Kaal` | power halved, drawback full, all 8 combinations correct | same | drawback halved → strictly-best sign |

**Failure threshold: any axis below 6.** The cosmology axis and the drawback-reality axis are
binary.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 0 | 2 | 4 | 6 | 8 |
|---|---|---|---|---|---|
| Native | 0 / 10 | 2 / 10 | 4 / 10 | 6 / 10 | 8 / 10 |

> **AMENDED wave 1 — `BAR-CRITIQUE-W1-07-R1` §R5.** 0 and 2 rungs added; reasoning in full at
> `RI-CHR01`. This item recorded `native_score: 0` in `W1-07` round 2 and was translated to ladder
> **4** on a row that said nothing below 4.

**Aggregation (a property of this item, not of the critic):** min-over-axes, over the axes that are
**measurable**; axes in `corpus_debt` are excluded from the min and reported separately.

### CONSUMPTION (`RI-MTH07` / `ARBITRATION` §3) — *(ADDED wave 1, `BAR-CRITIQUE-W1-07-R1` §R4)*

1. **Enumerate exhaustively:** `birthsigns.json`'s nine records, the three power families, each
   mechanical and conditional drawback, the `Kaal-Kaal` composition rule, the re-cut prerequisite
   and price, the respawn-graph term, and the nine rootkeeper greeting lines.
2. **Perturb and observe** per `RI-MTH07` §B, entity-side, with the null control.
3. **Apply the consequence:** any `coupling == 0` scores **that axis 0**, fail-closed. There is no
   `partial`.
4. **The distinction this item must keep, because wave 1 blurred it.** Round 2 perturbed
   `birthsigns.json` and moved live `focus_max` 74 → 46, with `Kaal-Kaal` composing at exactly
   half — a genuine, well-executed coupling proof, and it should be read as one. **And** across
   everything the critic could drive, **Focus never fell below max**: 90/90 before a cast attempt,
   90/90 after, 90/90 after resting. The Dry Well's drawback is *implemented* and *unobservable*,
   and the verdict recorded `PARTIAL — unobservable`.
   **`RI-MTH07` has no `partial`.** The honest disposition is: `coupling > 0` on the composition
   model (it is), **and** the Drawback-reality axis at **0** by its own method 2, whose assertion is
   about a quantity that must *move*. A drawback that removes a refill you never need has removed
   nothing, which is this item's own definition of a drawback that is not real. The
   cross-piece nature of the cause (something must spend Focus, and that is `W1-14`'s) makes it a
   **seam debt recorded against the `W1-07`↔`W1-14` seam**, per `CORPUS-CONTRACT` §4 rule 1 — not a
   third disposition invented at the item.

## How we lose

- **The Imperial thirteen get shipped with new names.** The Warrior becomes "The Iron Tide",
  The Thief becomes "The Quiet Tide", and the mechanical content is Bethesda's list with a
  reskin. This passes a casual read and fails method 1's second half, because a genuine
  Hist-rooted roster produces signs with *no Imperial analogue at all* — there is no Imperial
  sign that changes which bonfire you respawn at, and there could not be, because the Imperial
  signs are about who you are and ours are about what the ground under you was doing.
- **The drawbacks get softened in the first balance pass.** This is the near-certainty. Someone
  plays a Dry Well fighter for two hours, has a miserable time, and adds "a small amount of
  passive Focus regen so it isn't unfair". The sign is now a straight buff, the item's entire
  value is gone, and the change will be logged as a *bug fix*. Method 2's monotonicity
  assertion is the only thing standing in front of this and it must be run every wave.
- **The Unlit Water's claim is never built.** Three scripted encounters with branching
  outcomes and a persistent hostile NPC is real quest work; a `−20% detection radius` line in a
  JSON file is ten seconds. The sign ships with the power and without the claim, which makes it
  the strictly best stealth choice and deletes the most Morrowind thing in the item — a
  character-creation answer that obligates you to strangers.
- **The Grey Sap's closed quests get alternates "for fairness".** All four get a workaround,
  the drawback becomes "some dialogue is different", and a player can take total immunity to
  the sap-taint system for free. One quest must stay closed. That is the price and it is
  cheap — one quest of ~180.
- **`Kaal-Kaal` halves the drawback too.** The single most likely implementation bug, because
  "apply the second sign at 50%" is one multiplier and applying it asymmetrically is a special
  case. If it lands, Two-Drink is strictly the best sign in the game and eight of the nine are
  dead. Method 9 exists for one line of code.
- **The re-cut becomes a shrine you can visit repeatedly.** It will be requested. Every use
  after the first converts birthsign from an identity into a loadout slot, and then The Dry
  Well is not a trap, it is a tool you equip before boss fights and swap out after.
- **Nine signs, and six of them are ±10% numbers.** The Given family exists to be modest, but
  "modest" and "invisible" are one bad tuning pass apart. The Full Root's +1 charge and The
  Long Root's `Root-Return` are both *structural* rather than percentage effects specifically
  to keep the safe family from becoming the forgettable family. If they get retuned into
  "+5% healing" and "−10% fares", a third of the roster stops being a choice.
- **Nothing in the world reads the sign.** The most quietly damaging outcome: everything in §3
  is implemented perfectly and §6 is not, so the player's tide is a line on a menu they saw
  once. Morrowind's signs had the same weakness and it is the one place where we should
  straightforwardly beat it.
- **The fiction and the mechanic drift apart.** "The Spilled" is *about* a pattern the roots
  never fully drank, which is why the wells hold you badly — if a builder implements the
  respawn penalty as a flat timer instead, the mechanic still exists and the fiction stops
  explaining it, and the sign becomes an arbitrary punishment. Every drawback in §3 is a
  restatement of a `RI-LOR05` clause and must stay one.

## Provenance note

**All nine signs, every number, the three families, the balance table, the re-cut terms and the
visibility requirements are `constructed`** and binding on that basis.

The one **hard-canon** anchor is CF-028 (`community-data`, high confidence, UESP
*Lore:Shadowscales*): Argonians born under the sign of the Shadow are taken at birth and given
to the Dark Brotherhood as Shadowscales, and CF-029/CF-030 give the *ku-vastei* arbiter role
and the brass Sithis medallion. **The Unlit Water is the only sign in this roster with a canon
parent**, and its drawback — a claim on you that you did not agree to — is that canon fact
stated mechanically rather than invented.

The cosmology every other sign is derived from is `RI-LOR05`'s Rootward Tide, which that item
labels `constructed` with the hard-canon substrate cited there (CF-002 sap confers the
hatchling's soul; CF-003 souls return to the Hist and may be re-issued; CF-004 the Hist shapes
what hatches). Jel morphology is `RI-LOR04`, `constructed`, with roots from CF-025
(`community-data`, medium — glosses from summaries).

**The Atronach is `canonical-recall`, confidence medium**: 150% magicka, 50% spell absorption,
zero magicka regeneration. Those three figures are recalled, not verified, and this item uses
them only as a *shape* — our 160%/55%/zero are constructed and deliberately not identical, so
nobody mistakes a recalled number for a measured one.

Confidence is **medium** rather than high for one reason: the balance table in §4 is
unvalidated judgement about relative value, and the specific claim most likely to be wrong is
that The Backward Tide's ×1.5 respawn density is worth ≈ 8% of lifetime souls. That figure is
arithmetic over `RI-PRG06`'s soul-yield model, which is itself constructed, so it is an
estimate built on an estimate. It should be re-derived from a real playthrough before anyone
treats it as a balance fact.
