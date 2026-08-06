---
id: RI-CRM01
title: Crime, witnesses and justice — the bounty schedule, the report chain, the arrest, and what jail takes
kind: number
side: morrowind
judges: [crime.witness.model, crime.bounty.schedule, crime.guard.response, crime.arrest.interaction, crime.jail.consequence, crime.persistence.death, crime.faction.standing, world.persistence.state]
provenance: constructed
confidence: medium
blind_pair: no
---

## The bar

A crime system is the only mechanism a game has for making the world's *opinion of you* into a
number that acts. Dark Souls has none, and correctly: Lordran contains no functioning society
to offend. Morrowind has one, and it is the reason its world is a place rather than a level —
you can rob a house, be seen, be chased, be arrested, choose to pay or to fight the guard who
arrested you, go to jail, come out worse at something, and find that a faction has noticed. All
of that is outside the fight, so Morrowind wins outright.

The bar has four parts:

1. **A witness is a person, not a flag.** Somebody has to *see* you and then *get to a guard*.
   The gap between those two events is where the entire system's texture lives — and it is where
   seam **S10** bites, because killing the witness is a legitimate response and the game must
   handle it as design rather than as an exploit.
2. **Bounty is world state, not run state.** Seam **S6** gives Souls the death consequence and
   explicitly keeps quest state, journal, faction standing and world flags for Morrowind.
   **Bounty is world state and therefore survives death, respawn, and the corpse run.** A game
   in which dying launders your crimes is a game in which nothing you do in a town is real.
3. **The arrest is an interaction with three real answers.** Pay, resist, or serve. Each has a
   cost the other two do not, and none of them is strictly best.
4. **Consequences keep accruing during a fight.** ARBITRATION §1 as amended: *"crime, witnesses,
   bounty and faction standing all keep accruing mid-fight. The world does not pause because you
   drew a weapon."* This item is the one that has to actually implement that sentence.

## The reference artifact

### 1. The bounty schedule

All values in gold. Calibrated against `RI-PRG05`: lifetime income **98,000 g**, necessary sinks
**62,100 g**, and `RI-CHR02` §5's arrest thresholds (Imperial player 405, Saxhleel 210, Naga 99).

| # | Crime | Bounty | Notes |
|---:|---|---:|---|
| 1 | Trespass, reported | **5** | Only from `ALARM`, never from `CHALLENGE` (`RI-STL02` §4) |
| 2 | Trespass, restricted Legion/Provincial zone | **200** | `ALARM` on sight, no challenge |
| 3 | Petty theft (`value_g` < 25) | **10 + value_g** | |
| 4 | Theft | **25 + value_g** | Uncapped in `value_g`; the 11 tier-5 items run 800–3,400 g |
| 5 | Lockpicking observed | **50** | Per lock, not per attempt |
| 6 | Pickpocketing, caught | **100** | Plus `fDispPickPocketMod −25` (`RI-DLG04` §A) |
| 7 | Assault — a blow landed on a non-hostile person | **150** | Per *encounter*, not per hit |
| 8 | Assault causing unconsciousness / yield | **300** | |
| 9 | **Murder — unnamed NPC** | **1,000** | |
| 10 | **Murder — named NPC** | **1,600** | S5: named NPCs never respawn. This is permanent. |
| 11 | **Murder — guard, Legion soldier, or Provincial official** | **2,500** | |
| 12 | Murder — a witness *mid-report* (§3) | **1,000, and the suppressed bounty is applied at ×2** | The S10 clause. See §3c. |
| 13 | Resisting arrest (drawing on an arresting guard) | **+500** | Added to the existing bounty, not replacing it |
| 14 | Escaping custody / jailbreak | **+1,500** | |
| 15 | Cutting a sapwell without a rootkeeper (`RI-LOR05` §4b) | **1,200** + interior blood-price (§6) | The only crime that is a crime in *both* legal systems |
| 16 | Freeing a legally-held slave, in Dres-chartered territory | **900** | And it is the right thing to do, and the game says so through other characters |
| 17 | Smuggling (caught with contraband at a customs post) | **400 + 2 × cargo value** | |

**Bounty never decays with time.** There is no "wait three days and it goes away". It is
cleared only by paying, by serving, by an expiation quest (§8), or by a faction (`RI-CRM02`).
Morrowind's bounty did not decay either, and the reason is that a decaying bounty makes the
optimal response to every crime *walking into the wilderness for a while*, which is not a
consequence, it is a loading screen.

**Bounty is per-jurisdiction, not global.** Three jurisdictions:

| Jurisdiction | Covers | Enforces |
|---|---|---|
| **Imperial** | Gideon, Stormhold, Blackrose, Archon, Lilmoth (nominally), all roads with milestones | Legion and settlement militia; the schedule above |
| **Settlement** (Thorn, Soulrest) | the settlement and 400 m around it | militia only; ×0.6 on the schedule; no jail — pay or leave |
| **Interior** (Helstrom, Deep Marshes, Stone Forest, all `RG-DEEP` ground) | — | **No bounty. No guards. No jail.** Blood-price instead (§6). |

Crossing from one jurisdiction to another does not clear anything, and a guard in Gideon does
not care what you did in Thorn — but the *rumour* travels (`dialogue.rumour.distribution`), and
at Imperial bounty ≥ 2,000 your name appears in every settlement's rumour pool.

### 2. Who is a witness

A witness is created when an NPC satisfies **all** of:

```
witness(npc, crime_frame):
    npc.alive
    AND npc.civ_state advanced to CHALLENGE or ALARM this frame due to the crime's contextWeight
    AND line of sight from npc's eye node to the player chest node at crime_frame
    AND V >= 0.10                                    # RI-STL01 §2 -- you were visible enough
    AND dist <= 1.4 x R(npc)                         # RI-AI01 §B sight radius, per archetype
```

Plus two special cases:

- **Hearing-only witnesses.** An NPC who did not see you but heard a `death` event within 20 m
  becomes a **partial witness**: they cannot name you, and their report produces a bounty at
  **×0.4** with no identification (see §3d).
- **Guards are always full witnesses** when the geometry is satisfied, at `V ≥ 0.05`.

**Animals, mounts and hostile enemies are never witnesses.** Neither are the dead — a corpse is
evidence (§3e), not a witness.

Each witness record carries `{eid, crime_id, frame_seen, identified: bool, reported: bool}`.
`identified` is true iff `V ≥ 0.30` at `crime_frame` — you were seen clearly enough to be named.
An unidentified witness still reports; the bounty lands as **"person or persons unknown"** and
guards do not approach you for it, but it counts toward the settlement's alarm state and toward
`RI-STL01` §7's S-4 zone memory.

### 3. The report chain — the gap that makes the system a system

**A crime does not create a bounty. A report does.** This is the single most important
structural decision in the item, and everything interesting downstream follows from it.

#### 3a. How a report happens

| Route | Condition | Latency |
|---|---|---|
| **Shout** | witness is within 25 m of any guard, with LOS or through ≤ 1 wall | **1.2 s** |
| **Run to a guard** | witness paths to the nearest guard within **400 m** | path time at their run speed (3.4 m/s), typically **6–90 s** |
| **Guard is the witness** | — | **0 s** |
| **Delayed report** | no guard within 400 m: the witness continues their schedule and reports at their **next contact with a guard**, up to 24 in-game hours | minutes to hours |
| **Never** | witness dies, is calmed (`Veiling` school), is bribed (§3b), or the crime was in the Interior jurisdiction | — |

While `reported == false` the witness is in a visibly distinct state: they stop their schedule,
face you or the nearest exit, and **run**. A fleeing witness is legible from across a street,
and that legibility is what makes the next thirty seconds a decision.

#### 3b. The four legitimate responses to a witness

| Response | Requirement | Effect | Cost |
|---|---|---|---|
| **Let them go** | — | Bounty applies at full | gold |
| **Talk them down** | reach them, disposition ≥ 40 after the crime's `fDispStealing` hit, Speechcraft attempt (`RI-DLG04`) | Witness un-flags; permanent `+1` to their "knows something about you" counter, used by 4 quests | a persuasion attempt, retryable only once per witness |
| **Bribe them** | reach them, gold ≥ `2 × the bounty they would cause` | Witness un-flags | double the bounty, but no bounty, no guard, no faction hit |
| **Kill them** | — | See §3c | see §3c |

**The bribe is deliberately more expensive than the bounty.** Paying 2× to avoid a bounty is
only worth it when the bounty is not the real cost — when you are a Legion officer whose
expulsion threshold is close, when a faction is watching, or when you cannot afford to be
*known*. That is the correct shape: it is a decision, not arithmetic.

#### 3c. **S10 — killing the witness is a legitimate response, and here is what it costs**

Seam S10 says you can kill anyone. A crime system that treats witness-murder as an exploit to be
patched is fighting its own ruling. So it is supported, it works, and it is **priced**.

```
Kill a witness before `reported == true`:
  - the suppressed bounty is NOT applied ................ you got away with the first crime
  - a NEW bounty of 1,000 (unnamed) or 1,600 (named) is created,
    but ONLY IF this killing is itself witnessed or discovered (§3e)
  - the suppressed bounty is applied at x2 IF the killing is witnessed  ... crime #12
  - the victim is dead permanently if named (S5)
  - faction consequences (§7) fire on the killing regardless of witnesses,
    IF the victim belonged to a faction that keeps a roll -- which four of nine do
  - the corpse becomes evidence (§3e)
```

**The design intent, stated plainly:** killing a witness in an empty room, hiding the body, and
walking away **works, completely, with zero bounty**. That is not a bug and the game will not
punish it with an invisible flag. What it costs you is: a named person is permanently gone from
the world along with their quests, their shop, their dialogue and whatever they knew; four of
nine factions keep a roll and will notice a member missing; and you have created a corpse which
somebody will find. The murder route is *efficient* and it *hollows out the world*, and a player
who takes it repeatedly ends the game in a province with fewer people in it. `RI-QST05`'s
"thread of prophecy severed" machinery already exists for the quest-critical cases.

**Required content, not just mechanics:** ≥ 6 NPCs must be able to comment on a settlement that
has lost people, and ≥ 2 quests must have a stage that only fires in a settlement with ≥ 3
unexplained named deaths. A murder spree that nobody in the world can talk about is a mechanic
without a world attached.

#### 3d. Partial reports

An unidentified or hearing-only witness produces bounty at ×0.4, attributed to nobody. This
matters because it means **a careful criminal generates a settlement that is nervous rather than
a wanted poster**: guards at raised baseline alert (`RI-STL01` S-4), higher `contextWeight` for
20 in-game minutes, rumours that change, and no arrest. Being *suspected* and being *wanted* are
different states and the game must have both.

#### 3e. Corpses are evidence

| Property | Value |
|---|---|
| Discovery | any NPC entering LOS within 12 m of a corpse with `V_corpse ≥ 0.15` (light applies) |
| On discovery | a `corpse_found` event; if the victim was named, bounty **500** attributed to unknown, plus the §3c ×2 clause if the finder also saw you |
| Decay | corpses persist **72 in-game hours** in interiors, **12** outdoors (scavengers), then despawn leaving a `death_flag` that never expires |
| Moving a body | permitted: grab and drag at 0.6 m/s, `contextWeight` 3.50 while dragging. Water and the 82 caves are the intended disposal |
| `death_flag` | permanent world state. Rootkeepers, the Drowned Court and 3 quests read it. **The Drowned Court knows how many people have died in a settlement and will tell you, for a fee** — which is the best diegetic detective mechanic the setting offers and it costs almost nothing to build |

### 4. Guard response

Thresholds come from `RI-CHR02` §5 and are not restated in full. The response ladder:

| Bounty vs threshold | Guard behaviour |
|---|---|
| `0 < bounty < arrestThreshold` | Guards use a distinct greeting (*"I know your face"*), refuse 2 topic classes, prices +8%. **No arrest.** |
| `arrestThreshold ≤ bounty < attackThreshold` | On entering a guard's `CHALLENGE` cone, the guard **approaches, sheathed, and initiates the arrest dialogue** (§5). They do not attack. They will follow you for 45 s and give up. |
| `bounty ≥ attackThreshold` (= 4 × arrest) | Guards attack on sight. This is a Souls fight against a `RI-AI05` archetype and Souls owns every frame of it — **but the parley (S13) is still available**, and for guards it is "surrender", which routes back to §5's jail option. |
| Any bounty, inside a Legion fort or the Provincial Office | Arrest on sight regardless of threshold |

**Guards do not level-scale (S9)** and are not invincible. A Legion `ELITE` at region tier 3 is a
real fight at level 12 and trivial at level 50, which means the *practical* consequence of
crime changes over a playthrough — early it is genuinely dangerous, late it is a moral and
social cost rather than a lethal one. That is correct and intended: by hour thirty the reason
not to murder a shopkeeper should not be that the guards can beat you.

### 5. The arrest interaction — three answers

The arresting guard opens a dedicated dialogue. It is not a menu overlay; it is
`RI-DLG04`-shaped dialogue with three topics and no timer.

| Answer | Requirement | Effect |
|---|---|---|
| **"I'll pay."** | gold ≥ bounty | Bounty → 0. **Every item with `stolen_from` set is confiscated**, including from containers you own. Gold is deducted. Disposition of the arresting guard +5. No time passes. |
| **"I'll not."** (resist) | — | Bounty **+500** immediately (crime #13). Guard enters `AGGRO`. All guards within 40 m enter `AGGRO`. The Souls fight begins and this item's authority ends until it resolves. |
| **"Take me in."** (serve) | — | §6. Bounty → 0, stolen goods confiscated, **time passes**, skills change. |
| *(insufficient gold to pay)* | — | The "pay" topic is present but the guard refuses it by name and says how short you are. **It is never hidden** — a greyed-out option that does not explain itself is a UI failure, not a design one. |

**Two escape hatches, both gated on things you built:**

- **Faction invocation.** If you hold rank ≥ 4 in a faction with standing in that jurisdiction,
  a fourth topic appears: the guard defers. Usable **3 times per faction, per playthrough**, and
  each use costs 1 rank-progress. This is `RI-CRM02`'s territory and is the cleanest
  demonstration in the game that faction rank is power rather than a title.
- **Speechcraft.** At Speechcraft ≥ 60 and disposition ≥ 55, one Persuade attempt may reduce the
  bounty by 40% (not clear it). Retryable **never**.

### 6. Jail — what serving takes

```
days_served = clamp( ceil(bounty / 100), 1, 90 )
```

| Bounty | Days | What happens |
|---:|---:|---|
| 150 | 2 | |
| 1,000 | 10 | one murder |
| 2,500 | 25 | killing a guard |
| 9,000+ | 90 (cap) | |

**The skill cost, and it is deterministic — no roll** (per the `RI-STL02` §3 ruling and proposed
seam **S21** (~~S20~~ — renumbered wave 0 by the corpus audit; S20 is era authority), since jail is not a retryable failure):

| Effect | Rule |
|---|---|
| **Lost** | **−1 level per 2 days served**, taken from your **highest** skill among the six you cannot practise in a cell: Athletics, Acrobatics, Mercantile, Speechcraft, Marksman, Survival. Ties broken by the skill list order in `RI-PRG03` §1. Skills cannot fall below 5. |
| **Gained** | **+1 level per 3 days served** to **Sneak**, and **+1 per 4 days** to **Security**. Prison teaches exactly two things and this is not a joke — it is the mechanism by which a jail sentence is a *character event* rather than a fine. |
| **Not touched** | attributes, souls, level, equipment, journal, quest state |
| **Confiscated** | all `stolen_from` items; lockpicks and probes; **not** your weapons and armour (returned at the gate, in Morrowind's tradition) |
| **Time** | the world clock advances the full sentence. **Quest timers run.** A 25-day sentence can and should fail a timed quest, and 6 quests in the game have timers short enough for this to bite. |
| **Where** | Blackrose Prison for Imperial sentences ≥ 20 days — and you come out through the town of Blackrose, which is 1,503 m from Lilmoth and probably not where you were |

**The deterministic-highest-skill rule is the important detail.** Morrowind removed a *random*
skill point, which is a die whose failure is permanent — arguably legitimate under **S21** — but
which is also unreadable: you cannot plan around it and you cannot feel it. Taking from your
best non-cell skill is legible, plannable, and hurts a social build far more than a fighter,
which is the right asymmetry for a punishment administered by a society.

### 7. Faction consequences

Four of the nine factions (`RI-LOR02` §4) keep a roll and react to crime; five do not.

| Faction | Reacts to | Threshold | Consequence |
|---|---|---:|---|
| **Ninth Cohort / Provincial Office** | any Imperial bounty | 300 | rank progress frozen |
| | | 1,200 | **expulsion** (`quests.faction.expulsion`) |
| | murder of a Legion soldier | any | immediate expulsion, permanent |
| **The Wet Ledger** | theft from a Ledger member or warehouse | any | −2 ranks |
| | Imperial bounty | 2,500 | expulsion — *"you have become expensive"* |
| **The Drowned Court** | `death_flag` count in a settlement you were in | 5 | **not expulsion** — they raise their prices and start asking you questions they already know the answers to |
| **The Xul-Aneekh (Deep-Kin)** | Imperial bounty | **any** | **+2 disposition per 500 g of Imperial bounty**, capped +12. Being wanted by the Empire is a reference. |
| The Sap-Cutters, Blackwood Company, Dres, rootkeepers, Shadowscales | — | — | do not track Imperial crime at all |

The Deep-Kin row is the item's AR-3 contribution: **an Imperial bounty makes an entire region's
population like you more**, which changes `hostile_below_disposition` checks, which changes
which war-brood camps open hostile — a crime committed in Gideon changing a fight in the Stone
Forest.

### 8. Blood-price — the interior's system

The interior has no bounty because it has no state. It has **blood-price**: a debt to a family.

| Property | Value |
|---|---|
| Created by | killing, maiming, theft from a household, or cutting a sapwell, witnessed by anyone at all |
| Amount | the Imperial schedule ×1.4, expressed in gold **or** in labour **or** in a matching death |
| Held by | a named family, forever. **It does not decay, is not cleared by death, is not cleared by paying an Imperial bounty, and cannot be paid to a guard because there is not one.** |
| Enforced by | the family. 2–5 named kin who will find you: they appear in encounter tables in the interior regions and, at blood-price ≥ 2,000, on the coast roads as well |
| Cleared by | paying the family in person (gold or a named service), a rootkeeper's arbitration quest, a ku-vastei ruling (`RI-CRM02`), or the family's extinction — which creates a new blood-price with whoever is left |
| Visible | `getQuestState().flags` carries `bloodprice.<family>` with an amount |

**A Dunmer player in the interior is one bad decision from a permanent hunting party**, and an
Argonian player discovers that Imperial jail — ten days and a skill point — is the *lenient*
system. That contrast is the whole reason both exist.

### 9. **Persistence across death — the S6 specification**

| State | Survives death? | Rule |
|---|---|---|
| **Bounty (all three jurisdictions)** | **YES, in full** | Bounty is world state under S6. Dying does not pay it, reduce it, or hide it. |
| **Blood-price** | **YES, in full** | |
| Witness records with `reported == false` | **YES** | A witness who was running to a guard when you died is still running. The report lands while you are at the well. |
| `stolen_from` on carried items | **YES** | Items are not dropped on death; only souls are (S6) |
| Corpse `death_flag`s | **YES, permanently** | |
| Zone alert (`RI-STL01` S-4) | **YES**, and its 180 s timer keeps running | |
| Guard `AGGRO` at the moment of death | **NO** — resets to the ladder in §4 | You respawn at a well; guards return to post. The bounty that made them hostile is intact, so they will do it again. |
| Souls carried | **NO** — S6, dropped at the bloom | |

**The one special case, and it is the best interaction in the item:** if you die **while an
arresting guard is in the arrest interaction or in `AGGRO` from an arrest**, and the killing blow
came from a guard, you do **not** respawn at your sapwell. You wake in **jail**, sentence
already begun, per §6. Souls' death rule and Morrowind's justice system meet here and neither
loses: it is still a death, it still costs your souls, and the world still did the thing the
world does. A player's first experience of this — dying to a Legion patrol in Stormhold and
opening their eyes in Blackrose, eleven days later, three regions away, with a quest failed —
is the single most Morrowind moment the crime system can produce.

## Comparison method

**Harness extensions required** (with `RI-STL01`/`RI-STL02`): trace events `crime`, `witness`,
`report`, `bounty_change`, `arrest`, `jail_serve`, `corpse_found`, `bloodprice`; a
`getCrimeState()` method returning
`{bounty:{imperial,settlement:{},}, bloodprice:{}, witnesses:[{eid,crime_id,identified,reported}], death_flags:{}}`;
and `setBounty(jurisdiction, n)` for scenario setup.

1. **Schedule conformance.** For each of the 17 crimes, script the act in an isolated scenario
   and read `getCrimeState().bounty`. **Assert exact match to §1**, and **assert crime #4 scales
   with `value_g`** by testing three items at 10/200/3,400 g.
2. **A crime with no witness generates nothing.** `loadState('gideon-empty-house')`, steal 20
   owned items with no NPC in the interior. **Assert bounty == 0 and `witnesses == []`**, and
   **assert all 20 carry `stolen_from`.** If merely *taking* an owned object generates bounty,
   the witness model does not exist and the item fails at the first check.
3. **The report chain.** `loadState('gideon-street-witness')`: one civilian, one guard 120 m
   away. Commit theft in the civilian's LOS. **Assert**: a `witness` event fires the same frame;
   `reported == false`; the civilian's state changes to fleeing and their path target is the
   guard; bounty remains **0** until a `report` event fires; the delay is within 10% of
   `120 / 3.4 = 35.3 s`. Then repeat with the guard 20 m away and **assert the shout route fires
   at 1.2 s ± 2 frames**. Then repeat with no guard within 400 m and **assert bounty stays 0
   for ≥ 60 s** and lands on the witness's next guard contact.
4. **S10 — the witness-murder assertion (mandatory).** Same scenario. Kill the witness before
   the report lands, with no other NPC in LOS. **Assert final bounty == 0**, **assert a
   permanent `death_flag`**, and **assert the victim does not respawn after 3 HEARTH rests**
   (S5). Then repeat with a second civilian watching: **assert bounty == 1,000 + 2 × the
   suppressed theft bounty.** Then **assert ≥ 6 NPCs have a dialogue line conditioned on
   `settlement_death_flags ≥ 3`** and **assert ≥ 2 quests have such a stage** — the content
   half of the ruling, which is the half that will be missing.
5. **Corpse evidence.** Kill an unwitnessed named NPC indoors, leave, wait 4 in-game hours for a
   schedule tick. **Assert `corpse_found` fires and bounty 500 attributed to unknown.** Repeat
   after dragging the corpse into water: **assert no discovery in 72 in-game hours** and
   **assert the `death_flag` exists anyway.** Then **assert the Drowned Court NPC will sell the
   settlement's death count and that it matches `getCrimeState().death_flags`.**
6. **Identification split.** Commit the same theft at `V = 0.45` and `V = 0.18`. **Assert
   `identified == true/false` respectively**, **assert the bounty ratio is 1 : 0.4**, and
   **assert guards approach in the first case and not the second**, while `RI-STL01`'s S-4 zone
   alert fires in both.
7. **Guard ladder.** For each of the 10 races, set bounty to `0.5×`, `1.5×` and `5×` that race's
   `arrestThreshold` (`RI-CHR02` §5) and step 600 frames in a guard's cone. **Assert the three
   behaviours are: greeting-only / arrest-dialogue-sheathed / `AGGRO`.** **Assert the arrest
   guard never draws a weapon in band 2**, and **assert a surrender parley exists in band 3.**
8. **The arrest, all three answers.** From an identical save with bounty 800 and 6 stolen items:
   - **Pay:** **assert** gold −800, bounty 0, all 6 items gone, world clock unchanged.
   - **Resist:** **assert** bounty 1,300, guard `AGGRO`, and every guard within 40 m `AGGRO`
     within 30 frames.
   - **Serve:** **assert** §6's full ledger (below).
   - With gold 700: **assert the pay topic is present, is refused in dialogue, and the refusal
     text names the shortfall.**
9. **Jail ledger.** Serve a 1,000 g bounty (10 days). **Assert**: bounty 0; world clock +10
   days; **−5 levels** taken from the highest of the six cell-blocked skills, one at a time,
   deterministically (re-run with a different seed and **assert an identical outcome** — this is
   the **S21** assertion); **Sneak +3, Security +2**; stolen items gone; lockpicks gone; weapons and
   armour returned; attributes/souls/level unchanged; **assert ≥ 1 quest timer advanced** by
   scripting a 25-day sentence against a known timed quest and asserting failure.
10. **PERSISTENCE — the S6 assertion (mandatory).** Accrue bounty 1,600 in Imperial and 900
    blood-price. Die three times: to an enemy, to a fall, and to a guard mid-arrest.
    - **Assert bounty and blood-price are byte-identical in `getCrimeState()` after each
      death.**
    - **Assert `stolen_from` items are still carried.**
    - **Assert `death_flag`s persist.**
    - **Assert the third death lands the player in jail** (§9's special case) rather than at the
      sapwell, with the sentence already running.
    Then `saveState()` / `loadState()` round-trip and re-assert everything. **A bounty that does
    not survive a death or a save is an automatic fail of the piece.**
11. **Mid-fight accrual (the ARBITRATION §1 amendment).** Start a fight with a hostile in a
    street with 3 civilians. During `COMBAT`, steal from a container and land a blow on a
    civilian. **Assert `crime` and `witness` events fire while `player.state` is a combat state**
    and that bounty changes on those frames. If the crime system is suspended during `COMBAT`,
    the amended §1 is unimplemented and this axis scores 0.
12. **Faction consequences.** For each of the four tracking factions, cross its threshold and
    **assert the stated consequence fires and is visible in `getQuestState().flags`.** For the
    Deep-Kin: **assert disposition rises +2 per 500 g of Imperial bounty, capped +12**, and
    **assert at least one war-brood camp's `hostile_below_disposition` check flips** as a
    result — the AR-3 assertion.
13. **Blood-price.** Kill an interior NPC witnessed. **Assert zero bounty**, **assert
    `bloodprice.<family>` == 1.4 × 1,000 = 1,400**, **assert 2–5 named kin enter the region's
    encounter tables within 24 in-game hours**, **assert it survives death and save**, and
    **assert paying an Imperial bounty does not touch it.**

## Scoring

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| Schedule | all 17 exact, value-scaling correct | all 17 within 5% | fewer than 8 crime types |
| Witness model | full geometry + partial + identification split | full geometry, identification split | crime → bounty with no witness at all |
| **Report chain** | all 5 routes, latencies within 5% | shout + run + guard-is-witness | bounty applies instantly on the crime frame |
| **S10 handling** | murder suppresses bounty; ≥6 NPC lines + ≥2 quest stages on death counts | murder suppresses bounty; ≥3 NPC lines | witness-murder still generates the bounty → the ruling is fought instead of implemented |
| Corpse evidence | discovery, dragging, water disposal, Drowned Court readout | discovery + permanent `death_flag` | corpses despawn with no trace |
| Guard ladder | 3 bands × 10 races verified, surrender parley present | 3 bands verified | guards attack at any bounty |
| Arrest | 3 answers + 2 escape hatches, refusal text names shortfall | 3 answers | one answer (a fine) |
| Jail | full ledger, deterministic, quest timers bite | full ledger, deterministic | jail is a fade-to-black with no cost |
| **Persistence** | all rows of §9 verified, incl. the die-in-arrest → jail case | bounty + blood-price + `stolen_from` survive death and save | **bounty cleared by death → automatic fail** |
| Mid-fight accrual | crimes and witnesses fire during `COMBAT` | same | crime suspended in combat → ARBITRATION §1 unimplemented |
| Faction | 4 tracking factions, Deep-Kin AR-3 flip verified | 4 factions react | crime has no faction consequence |
| Blood-price | full system, kin encounters, arbitration routes | exists, persists, has ≥1 clearing route | interior uses the Imperial bounty system |

**Failure threshold: any axis below 6.** Persistence, S10 handling and mid-fight accrual are
binary.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 | 6 / 10 | 8 / 10 |

**Aggregation (a property of this item, not of the critic):** min-over-axes.

## How we lose

- **Bounty applies on the crime frame and the whole item collapses.** `bounty += 25` inside the
  take-verb is four characters of work and it deletes the report chain, the fleeing witness, the
  bribe, the talk-down, the S10 decision, the partial report and the identification split — that
  is, everything that makes this a system rather than a fine. It will be written first as a
  placeholder and it will never be replaced, because from the outside it looks like the crime
  system works.
- **Witness-murder is "fixed".** A playtester kills a witness, gets away with it, and reports it
  as an exploit. Somebody adds "crimes are always registered, witnesses just accelerate it", and
  S10 is now a ruling the code disagrees with. The correct response to that playtest note is to
  point at the six NPC lines about the missing people, and if those lines do not exist yet then
  the report is *right* — the mechanic shipped without its consequence.
- **Bounty is cleared by death.** The single likeliest S6 misreading, and an easy one: death
  resets the world to bonfire state, so surely it resets *everything*? S6 says otherwise in
  writing, and the practical effect of getting it wrong is that the optimal response to any
  crime is suicide. It also silently destroys `RI-CRM02`'s writ economy. Method 10 is binary for
  this reason.
- **The crime system is suspended during combat.** A perfectly reasonable engineering decision —
  the civilian state machine is expensive, combat is the hot path, gate it. It contradicts the
  amended ARBITRATION §1 by name, and its visible symptom is that you can commit any crime you
  like as long as something is fighting you.
- **Jail is a fade-to-black.** Time passes, bounty clears, nothing else happens, because the
  skill deduction touches the progression system and the quest-timer advance touches the quest
  system and neither owner wants to be called by the crime system. Then jail is strictly better
  than paying, everyone serves every sentence, and the arrest has one answer again.
- **The skill loss becomes random.** Morrowind's own implementation, and it will be cited as
  precedent. It is unreadable and unplannable, and under the **S21** principle it is *defensible*
  (jail is not retryable) which makes it a genuinely close call — but "you lose your best social
  skill" is a punishment a player can understand, resent and plan around, and "you lost a point
  of something" is noise.
- **Blood-price is cut as a duplicate of bounty.** It is a second justice system with its own
  data, its own enforcers and its own clearing routes, serving four regions, and it will look
  like scope. Cutting it means the interior either gets Imperial guards — which contradicts
  `RI-LOR02` §3's *"the Empire has never held it"* — or gets no consequences at all, and a third
  of the map becomes a place where nothing you do matters.
- **No one in the world can talk about crime.** Every mechanic in §1–§9 ships and the dialogue
  system knows nothing about it: no guard greeting change, no rumour shift at bounty 2,000, no
  Drowned Court death count, no Deep-Kin approval. Crime becomes a number in a menu. This is the
  failure mode that scores well on ten of twelve axes and produces a dead world.
- **The die-in-arrest → jail case is never built.** It is one special case in the death handler
  and it is the most memorable thing in the item. It will be cut because it complicates
  respawn, which is Souls-owned code that nobody wants a Morrowind system reaching into.

## Provenance note

**Everything in this item is `constructed`**: the 17-crime schedule, the witness predicate,
the report chain and its latencies, the S10 pricing, corpse evidence, the guard ladder, the
three arrest answers, the jail ledger, the faction thresholds, blood-price, and the persistence
table.

Values adopted from other items, inheriting their provenance: arrest and attack thresholds and
`raceSuspicion` (`RI-CHR02` §5, `constructed`); `contextWeight`, civilian states and the S-4
zone memory (`RI-STL01`, `constructed`); `stolen_from` and trespass classes (`RI-STL02`,
`constructed`); `fDispPickPocketMod = −25` and `fDispStealing = −0.5/gold` (`RI-DLG04` §A,
`community-data` — real Morrowind GMSTs); the 98,000/62,100 g economy frame (`RI-PRG05`,
`constructed`); sight radii and cones (`RI-AI01`, `constructed`); the nine factions
(`RI-LOR02` §4, `constructed`).

Structural debts, `canonical-recall`, confidence **medium**: Morrowind's crime system as a
whole — a per-jurisdiction gold bounty, guards who offer pay/resist/jail, jail time computed
from bounty with a random skill point lost per day, stolen goods confiscated on arrest, and
bounty that does not decay. Those are recalled, not verified, and this item deliberately
diverges on the two points that matter (the report chain, and deterministic skill loss) rather
than reproducing them.

The **S10 handling in §3c is a design ruling** made by this item under ARBITRATION §5 rung 3,
and it should be read as such: the corpus said "you can kill anyone" and did not say what
happens when the person you kill is about to report you. The answer here — it works, and it
costs you a person the world cannot replace — is arguable, and the arguable part is whether the
×2 clause in crime #12 is the right lever.

Confidence **medium**. The structure I hold firmly. The calibration is unvalidated, and the two
numbers most likely to be wrong are the 1,000 g murder bounty (which, against a 405 g Imperial
arrest threshold, means a single murder makes an Imperial player arrestable but not attackable —
that may be too soft) and `days = bounty / 100`, which produces a 90-day cap that no playtest has
ever justified.
