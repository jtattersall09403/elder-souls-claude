---
id: RI-PRG04
title: HEARTH — resting, respawn, spacing, and the death→corpse-run→recovery loop
kind: structure
side: souls
judges: [progression.checkpoint, progression.death, world.respawn, world.spacing, progression.flask, world.time]
provenance: constructed
confidence: medium
blind_pair: no
---

## The bar

**`HEARTH` is a placeholder.** `corpus/50-world/` and `corpus/60-lore/` own the final noun
(Hist-shrine, root-fire, whatever the fiction lands on). Renaming it must not change a
single number in this file; every rule below is written against the placeholder so the
rename is a find-and-replace.

The bar is that a HEARTH must carry the whole Souls checkpoint contract — heal, refill,
respawn, level — **without** carrying the one piece of it that seam S7 forbids: it is not a
teleport network. That single subtraction changes everything downstream. In Dark Souls,
bonfire warping means bonfire *density* is nearly free, because distance between them is
collapsible. Here it is not: every metre between two HEARTHs is a metre you walk, so
spacing is the primary dial controlling how much a death costs, and it has to be set by
hand, in minutes, against a real map. Too dense and death is a two-second inconvenience and
the whole Souls tension evaporates; too sparse and death is ten minutes of re-walking
cleared ground, which is not tension, it is tedium. The target is that **an average death
costs about 2.5 minutes of travel plus a re-clear of the enemies between you and where you
fell** — enough that you play carefully, little enough that you are willing to try the boss
again immediately. And on top of the Souls contract, resting carries a Morrowind
consequence that a bonfire never had: it moves the world's clock, and the world notices.

## The reference artifact

### 1. What resting at a HEARTH does

| Effect | Detail | Owner |
|---|---|---|
| **Heal to full** | HP restored to max instantly | Souls |
| **Refill Sap-flask** | All charges restored (§4) | Souls |
| **Restore Focus (FP)** | To max | Souls |
| **Respawn ordinary enemies** | Every non-unique hostile in the world returns, including ones you killed hours ago (S5) | Souls |
| **Level up** | Spend souls, +1 attribute per level, RI-PRG01 curve. **The only place levelling is possible** | Souls |
| **Reset the skill rest-clamp** | RI-PRG03 §4's +3-levels-per-skill budget refreshes | Neutral |
| **Restore Fatigue to full** | The S4 second bar. HEARTH rest and inn lodging are the only full restores | Morrowind |
| **Advance the world clock by 6 in-game hours** | See §2 — this is the cost | Morrowind |
| **Advance untreated disease by one stage** | Named diseases progress; Survival and cures are the counters (S11) | Morrowind |
| **Attune / re-slot spells** | Change equipped spells; HIST-BOND raises the quality of the attunement (RI-PRG02) | Souls |
| **Teleport** | ❌ **NEVER.** No warp between HEARTHs, no warp to a HEARTH, no "return to last rest" item (S7) | — |

**Named NPCs, quest actors, merchants, trainers and bosses NEVER respawn and are NEVER
touched by respawn logic** (S5, absolute). If you killed a merchant in hour three, that
merchant is dead in hour twenty and their shop inventory is on their corpse.

**Resting is free in gold.** The gold-priced alternative is an inn bed (RI-PRG05), and the
distinction is the point — see §3.

### 2. The cost of resting: the world clock

One in-game day = **48 real minutes**. A rest advances the clock **6 in-game hours = 12
real minutes of world time**, instantly.

| Consequence of the clock moving | Effect |
|---|---|
| **Shops open and close** | Merchants trade 07:00–19:00. Rest at 17:00 and the smith you were walking to is shut until morning (RI-PRG05, RI-PRG08 — this is how a rest can cost you an upgrade) |
| **The night roster swaps in** | 21:00–05:00, a defined subset of ordinary enemies is replaced by night variants: **+18% damage, +10% aggro radius, −15% HP**, and **1.35× souls** (RI-PRG06). Resting into night is a risk-for-reward trade, not a punishment |
| **NPC schedules move** | Named NPCs are at different locations; some dialogue topics are only available at certain hours (`corpus/40-dialogue/`) |
| **Timed quest windows tick** | A handful of quests in `corpus/30-quests/` have deadlines measured in in-game days. Resting spends them. **The journal states the deadline in prose; there is no timer UI** (S8) |
| **Disease progresses** | One stage per rest if untreated |
| **Tide state changes** | Three map routes in `corpus/50-world/` are passable only at low tide |

This is the whole reconciliation of "a bonfire, but Morrowind". Resting is not free — but it
costs *time in a living world*, not gold and not a resource. It means a player at 18:40 with
one flask charge left has an actual decision to make, and the decision is legible without a
single number on screen.

### 3. HEARTH rest vs inn lodging

| | HEARTH rest | Inn bed (RI-PRG05: 10–40 g) |
|---|---|---|
| Cost | Free | 10 g common / 40 g private room |
| Heals HP | Yes | Yes |
| Refills Sap-flask | **Yes** | **No** |
| Restores Fatigue | Yes | Yes |
| Respawns enemies | **Yes** | **No** |
| Allows levelling | **Yes** | **No** |
| Advances clock | 6 h, fixed | **Player-chosen, 1–24 h** |
| Sets respawn point | **Yes** | No |
| Available | 28 fixed locations | Settlements only |

The inn exists so that "I need it to be morning" and "I need my flask back" are separable
purchases. Waiting out a shop's opening hours should not cost you a cleared dungeon.

### 4. The Sap-flask

The Estus analogue. Name is `corpus/50-world/`'s to change.

| Property | Value |
|---|---|
| Starting charges | 4 |
| Maximum charges | **12** |
| Charge upgrade item | **Sap-bud** — 8 in the world, hand-placed, **never purchasable** |
| Charges per bud | +1 each (4 → 12) |
| Potency upgrade item | **Heart-resin** — 5 in the world, hand-placed, **never purchasable** |
| Healing per charge | 32% max HP at +0, +7% per resin → **67% at +5** |
| Drink animation | Committed, interruptible by damage, no i-frames — `corpus/10-combat/` owns the frames |
| Refill | HEARTH rest only. Not by inn, not by gold, not by merchant |

Neither flask upgrade is ever buyable with gold or souls. Both are pure exploration rewards,
for the same reason as RI-PRG08's upgrade materials: the two things that most directly
control survivability must be gated by *going places*, not by *accumulating*.

### 5. How many HEARTHs, and where

The world's long axis is **≈55 minutes** of unmodified walking; the critical path traversed
once, unopposed, is **≈95 minutes** across all six regions.

**Total HEARTHs: 28.**

| Region | HEARTHs | Region critical path (min) | Mean spacing (min) | Content hours (RI-PRG06) |
|---|---:|---:|---:|---:|
| R1 | 3 | 11 | 3.7 | 1.8 |
| R2 | 4 | 15 | 3.8 | 2.4 |
| R3 | 5 | 17 | 3.4 | 3.0 |
| R4 | 5 | 16 | 3.2 | 3.6 |
| R5 | 5 | 17 | 3.4 | 4.2 |
| R6 | 6 | 19 | 3.2 | 5.0 |
| **Total** | **28** | **95** | **3.4** | **20.0** |

**Spacing rules** — measured as one-way travel time along the intended route, walking/sprint
mix, no combat, no shortcuts opened:

| Rule | Value |
|---|---|
| Consecutive HEARTHs on the critical path | **3.0 – 5.5 min** |
| Optional or hostile branch to its HEARTH | ≤ **9.0 min** |
| **Absolute minimum** between any two HEARTHs | **2.0 min** — density floor, no exceptions |
| **Absolute maximum** from any reachable point to the nearest HEARTH | **11.0 min** |
| Every boss fog gate | a HEARTH **60 – 110 s** away, with no respawning enemy between them |
| Every settlement with a merchant | exactly **one** HEARTH, at the settlement edge, not the centre |
| Shortcuts | Each region contains **2–3 unlockable shortcuts** that cut a corpse run by 40–70%. Opening one is permanent and survives death |

The boss rule is the important one. A boss retry must cost **under two minutes and zero
combat**, because the boss is the content; the walk is not. Everything else in the spacing
table is tuned so that ordinary death is expensive and boss death is cheap.

### 6. The death loop — exact rules

**On death:**

1. **All unspent souls drop at the death location as one bloodstain.** 100% of them. Not a
   percentage, not a cap.
2. **Respawn at the last HEARTH you rested at** — not the nearest, not the last one you
   walked past. Resting is what sets the point.
3. **All ordinary enemies respawn**, including everything you killed since your last rest.
4. **The clock does NOT advance on death.** Only resting moves time. Dying repeatedly at a
   boss must not burn a quest deadline.
5. **Nothing else is lost.** No gold, no items, no durability, no equipment, no flask
   upgrades, no humanity/hollowing analogue. There is no death spiral.

**What survives death, untouched (S6 — Morrowind owns save-state semantics):**

| Persists | |
|---|---|
| Quest state and every stage flag | Journal entries, numbered and dated |
| Faction standing, rank, expulsions | NPC deaths — permanently dead stays dead |
| Opened shortcuts, unlocked doors, lit paths | Looted containers stay looted |
| World flags (bridges lowered, gates raised) | Disposition changes, bribes paid |
| Discovered dialogue topics and rumours | Skill progress and skill levels |
| Gold, inventory, upgrades, flask charges/potency | Attribute allocations |

**The bloodstain rules:**

| Rule | Detail |
|---|---|
| **Exactly one bloodstain exists at a time** | Global, not per-region |
| **A second death before recovery destroys the first, permanently** | The new bloodstain replaces it. No grace period, no partial carry-over, no item that recovers a lost stain |
| **No timer** | A bloodstain persists across rests, region changes, quits and reloads until recovered or replaced |
| **Recovery is by touch** | Walk into it. No prompt, no cost, no animation, all-or-nothing |
| **Unreachable-death rule** | If you die somewhere that becomes unreachable (a resealed arena, a collapsed route, a one-way drop), the bloodstain relocates to the **nearest reachable point on the path toward it**. Geometry never destroys souls — only a second death does |
| **Death inside a boss arena** | Bloodstain is placed **outside** the fog gate, so recovering it never requires re-entering the fight |
| **Falling / instant-death hazards** | Bloodstain is placed at the last grounded position before the fall, not at the bottom |

### 7. What death actually costs — the balance table

Modelled over a typical first clear: **86 deaths**, with a second death before recovery on
~22% of them.

| Region | Deaths | Avg. unspent souls at death | 2nd-death rate | Souls permanently lost |
|---|---:|---:|---:|---:|
| R1 | 10 | 697 | 0.24 | 1,672 |
| R2 | 12 | 1,907 | 0.23 | 5,262 |
| R3 | 14 | 3,947 | 0.22 | 12,156 |
| R4 | 16 | 6,949 | 0.22 | 24,461 |
| R5 | 16 | 9,996 | 0.21 | 33,587 |
| R6 | 18 | 14,563 | 0.21 | 55,047 |
| **Total** | **86** | — | **0.22** | **132,186** |

**132,186 souls = 11.8% of the world's 1,124,285.** Retention **88.2%** — which is exactly
the 88% figure RI-PRG06's "typical player" model runs on. The two items must be re-derived
together if either moves.

Time cost: 86 deaths × ≈2.5 min average corpse run = **≈3.6 hours**, or **18% of a 20-hour
playthrough**, spent walking back. That is the Souls tax, stated in minutes so it can be
argued with. Boss deaths (a large share of the 86) cost under 2 minutes each by the §5 fog-gate
rule, which is what keeps the number from being far worse.

## Comparison method

1. **Rest effects.** Trigger a HEARTH rest in a headless session with HP/FP/flask/Fatigue at
   partial and 40 ordinary enemies pre-killed. **Assert** HP, FP, flask charges and Fatigue
   are at max; **assert all 40 ordinary enemies are alive again**; **assert every named NPC,
   merchant, trainer, quest actor and dead boss is unchanged.** One respawned merchant =
   S5 violation = automatic fail.
2. **S7 — no teleport.** `grep -rniE "warp|teleport|fast_?travel|travelTo|
   returnTo(Bonfire|Hearth|Checkpoint)" game/src/`. **Assert every hit is inside the
   in-fiction transport module** (RI-PRG05 fares, which are NPC-brokered, cost gold, have
   fixed routes and consume in-game time). **Assert the HEARTH interaction menu exposes no
   destination list of any kind.** A warp menu is an AR-2 Morrowind-leakage automatic fail.
3. **Spacing audit.** Load the shipped HEARTH placements and the navmesh. For all 28, run
   pathfinding to compute one-way travel time at the standard locomotion speed.
   **Assert:** mean critical-path spacing **∈ [3.0, 4.0] min**; no pair closer than
   **2.0 min**; no reachable point further than **11.0 min** from its nearest HEARTH; every
   boss fog gate within **[60, 110] s** of a HEARTH with **zero respawning enemies** on that
   path. **Assert total count ∈ [24, 32].**
4. **Death loop, single death.** Bank N souls, die, **assert** a bloodstain exists holding
   exactly N; **assert** respawn is at the **last rested** HEARTH (deliberately rest at
   HEARTH A, then walk past HEARTH B, then die — assert respawn at A); **assert** gold,
   inventory, durability and flask upgrades are unchanged; **assert the world clock did not
   advance.** Touch the stain, **assert exactly N souls recovered.**
5. **Death loop, double death.** Die with N souls, die again with M before recovering.
   **Assert exactly one bloodstain exists**, holding exactly M, and **assert N is
   unrecoverable by any means** (no item, no shrine, no gold).
6. **Persistence.** Advance 12 quest stages, kill 2 named NPCs, open 3 shortcuts, loot 20
   containers, change 5 dispositions, then die 3 times. **Assert every one of those state
   changes survives**, byte-identical in the save (S6).
7. **Bloodstain edge cases.** Scripted deaths: inside a boss arena, over a bottomless drop,
   in a one-way area sealed behind you. **Assert** the stain is outside the fog gate, at the
   last grounded position, and relocated to the nearest reachable path point respectively —
   and **assert in all three cases the souls are recoverable.**
8. **Clock consequence.** Rest at in-game 17:00. **Assert** the clock reads 23:00, the night
   roster is active, merchants are closed, and any active timed quest has consumed 6 hours.
   Rest 4× in a row: **assert** the clock advances 24 h and returns to the same shop state.
9. **Death-cost sim.** Run the RI-PRG06 harness with the §7 death model (86 deaths, 22%
   second-death rate, per-region banks). **Assert total permanent soul loss ∈ [9%, 15%]** of
   the world budget and **assert the resulting retention is within 3 points of 0.88.**
10. **Flask purity.** **Assert Sap-bud and Heart-resin appear in zero merchant inventories**
    and have no gold or soul price anywhere in the data.

## Scoring

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| Rest effects | all 10 rows correct, named NPCs untouched | all correct | any named NPC/merchant respawns → **automatic fail** |
| S7 | **the transport network of `RI-TRV01` exists and is used** (≥5 modes, ≥17 lines, ≥60 services, all fares > 0, all ride times > 0) **and** every warp code path in the build lies inside the transport module | network present but thin (≥3 modes), **or** a warp path outside the transport module that is not player-reachable | **EITHER** HEARTH menu offers destinations, **OR** warp-to-map-pin / teleport-to-objective exists, **OR** no transport network exists at all → **automatic fail in both directions** |
| Spacing | mean 3.2–3.8, all rules hold | mean 3.0–4.0, no rule broken by >20% | any pair <2.0 min, or any point >11 min, or a boss >2 min from rest |
| Death loop | all of 4/5/7 exact | 4 and 5 exact | souls survive death, or two bloodstains exist, or a lost stain is recoverable |
| Persistence | 100% of state survives | 100% of quest/faction/journal survives | any quest or faction state resets on death → **S6 automatic fail** |
| Clock cost | full consequence chain fires | clock advances and roster swaps | resting has no consequence at all |
| Death cost | loss 11–13%, retention 0.87–0.89 | loss 9–15% | loss <5% (death is free) or >25% (death is a spiral) |
| Flask purity | neither upgrade purchasable | same | either is purchasable → RI-PRG08 §"How we lose" also fails |

> **AMENDED wave 0 (corpus-audit) — INTENT-AUDIT-01 drift **ID-09**, and queue B10. The S7 axis
> scored backwards.** It awarded **10 for "no warp code path exists"** — i.e. its top score for
> the *absence of the system S7 mandates*. S7 says fast travel is **required**: a diegetic,
> node-to-node transport network you pay gold for and physically walk to. Only
> **warp-to-map-pin** is banned. As written, a naive build that shipped a walkable map and
> nothing else scored **10** on this axis.
>
> The verification procedure at §"assert every warp hit is inside the transport module" was
> always correct; the *scale above it* rewarded zero hits. **Every travel check in the corpus is
> now two-directional: it must fail when the network is missing AND when it degenerates into
> warp-to-map-pin.** `RI-TRV01` M1's N-fail/W-fail pair is the reference shape. A verdict
> reporting "no warping found, passes" on a build with zero transport services has scored a 0 as
> a 10 and is **void**.

**Failure threshold: any axis below 6.**

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 | 6 / 10 | 8 / 10 |

**Aggregation (a property of this item, not of the critic):** min-over-axes.

## How we lose

- **HEARTHs get dense because playtesters complain about walking.** This is the single most
  likely failure and it will arrive disguised as a quality-of-life improvement. Twenty-eight
  becomes forty-five, mean spacing drops to 1.8 minutes, and death now costs eleven seconds.
  Every other system in this corpus — soul retention, the 88% figure, the value of a
  shortcut, the tension of walking into a fog gate with three flasks — is calibrated on
  death costing something. Method 3's 2.0-minute floor is the only thing standing in front
  of it, and it must be enforced as a hard build-time assertion, not a guideline.
- **Warp is added "just between discovered HEARTHs".** The most seductive S7 violation,
  because it is *exactly* what Dark Souls does after Anor Londo. It would immediately
  trivialise RI-PRG05's transport fares, gut the map's geography, and make merchant hours
  irrelevant. Method 2, and no exceptions.
- **The clock consequence is cut as annoying.** Resting becomes a pure free heal, the night
  roster is never seen because nobody rests into it, and the Morrowind half of the checkpoint
  is gone. The 1.35× night soul bonus exists specifically so that resting into darkness is a
  choice rather than a mistake — if that bonus is removed, the whole mechanic dies quietly.
- **Death starts costing more than souls.** Someone adds durability loss, or gold loss, or a
  hollowing debuff, "for stakes". Every one of those punishes the player who is already
  struggling and creates the death spiral that Souls games specifically avoid. Souls and
  time. Nothing else.
- **Quest state resets on death.** The likeliest S6 violation: a builder implements
  "world reset to bonfire state" literally and rolls back a quest flag or a door. The player
  loses an hour of quest progress to a fall. Method 6.
- **The bloodstain becomes forgiving.** A grace period, a partial recovery, a "soul-retrieval"
  consumable, a second stain. Each one individually seems kind; together they mean the second
  death never costs anything and the entire corpse-run tension is theatre.
- **The bloodstain becomes unfair.** A stain inside a resealed boss arena, or at the bottom
  of a pit you cannot climb out of, is not difficulty — it is a bug that reads as malice.
  Method 7 covers the three known cases; new geometry will invent more.
- **Boss retries get expensive.** A HEARTH four minutes and six enemies from a fog gate turns
  a fifteen-attempt boss into ninety minutes of walking. This is the most common way a
  Souls-like becomes unpleasant, and it is a *level design* failure that only shows up in
  method 3's fog-gate assertion.
- **Flask upgrades end up in a shop.** Gold becomes the survivability currency, exploration
  becomes optional, and RI-PRG08's entire argument collapses by analogy.

## Provenance note

**Everything here is `constructed`.** The structural debt to Dark Souls' bonfire and
bloodstain — rest heals and refills, rest respawns ordinary enemies, level up at the
checkpoint, drop all souls on death, one bloodstain, lost on second death — is
`canonical-recall` at confidence medium; those are well-known behaviours, but no number in
this file is recalled from a Dark Souls table.

Confidence is **medium** overall, deliberately lower than RI-PRG01/02/03, because **§5's
spacing table is the one part of this corpus that cannot be validated without a real map.**
Every figure in it — 55-minute long axis, 95-minute critical path, 28 HEARTHs, 3.4-minute
mean spacing, the 11-minute worst case — is a target handed to `corpus/50-world/`, not a
measurement taken from it. When the world item lands with real traversal times, method 3
must be re-run and this table amended rather than the map bent to fit it. The spacing
*rules* (2.0 min floor, 11 min ceiling, boss within 110 s) are the binding part; the counts
are derived and should move if the map says so.

The death model in §7 (86 deaths, 22% second-death rate, per-region soul banks) is
`constructed` arithmetic chosen to produce the 88.2% retention that RI-PRG06 assumes. It is
internally consistent and completely unvalidated against human play. It is the first thing
to re-measure once telemetry exists, and the two items must move together.
