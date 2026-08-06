---
id: RI-CRM02
title: Faction crime — sanctioned murder, jurisdictional writs, and how a rank changes a guard
kind: number
side: morrowind
judges: [crime.faction.sanctioned, crime.faction.writ, crime.faction.standing, crime.guard.response, quests.faction.rankgating, quests.faction.rivalry, quests.faction.expulsion]
provenance: constructed
confidence: medium
blind_pair: no
---

## The bar

Morrowind did something almost no game has done since: it made murder **legal**, in writing,
for members of a guild, and then let you carry the paperwork. A Morag Tong Writ of Execution
turns a killing that would carry a 1,000-gold bounty into a lawful act you can show to a guard.
It is one of the strangest and best things in the game, and it is also the single largest hole
in its crime system — because once you hold a writ, the entire justice apparatus that the
previous eighty hours taught you to fear becomes a formality you wave away.

Call that **the Morag Tong problem**: an institution of sanctioned murder either trivialises the
crime system or is not worth having. This item's job is to have it *and* not be trivialised by
it, and the mechanism is one idea:

> **Legality is jurisdictional and partial. No authority in Argonia can make a killing lawful
> everywhere, because no authority in Argonia holds everywhere. A writ is a document that some
> people honour.**

`RI-CRM01` already establishes three jurisdictions that do not share a legal system — Imperial,
settlement, and an interior that has no bounty at all and runs on blood-price instead. That
fragmentation is the answer: four authorities can issue sanction, each covers one or two
jurisdictions, none covers all three, and every one of them charges you something that is not
gold.

The bar's second half is the **AR-3** half, and it is why this item exists as much as the first:
**faction membership must change how the world's armed people behave toward you, in numbers a
trace can show.** A rank is not a title on a menu. It is the reason a guard sheathes his sword,
or draws it.

## The reference artifact

### 1. The four sanctioning authorities

| Authority | Instrument | Honoured in | **Not** honoured in | Price of membership | Joinable? |
|---|---|---|---|---|---|
| **The Morag Tong** (foreign — a Morrowind Great House institution operating in Argonia on Dunmer targets) | **Writ of Execution** | Nowhere legally. Honoured *socially* by Dres factors, Dunmer NPCs and `RG-DRES` | Imperial, settlement **and** interior jurisdictions — all three | You become an asset of a Morrowind institution in a province that hates Morrowind | **No.** Contact only |
| **The Imperial Provincial Office** | **Warrant of Attainder** | Imperial jurisdiction only | settlement, interior | Legion/Provincial rank ≥ 4; each warrant costs 1 rank-progress and is logged | Yes (Ninth Cohort) |
| **A ku-vastei** (Shadowscale arbiter, CF-029) | **a Ruling** | Interior jurisdiction: **extinguishes the blood-price** the killing would create, and any existing blood-price on the same family | Imperial, settlement | Either the `shadowscale-claim` (`RI-CHR03`, The Unlit Water) or a rootkeeper petition costing 3,000 g and a quest | Not joinable — a **service** (CF-029) |
| **The Wet Ledger** | **no writ — it buys the report chain** | Gideon and Lilmoth only, and only for crimes ≤ 1,600 bounty | everywhere else | Ledger rank ≥ 3, and a favour owed that the Ledger calls in *later, at a time it chooses* | Yes |

**Nothing on this table covers all three jurisdictions, and that is the design.** A player who
wants to be able to kill people legally must hold two of these at once, and two of them are
mutually exclusive with each other (§4). The Morag Tong — the institution the problem is named
after — is deliberately the **weakest** here: its writ is legally worthless in Argonia and
carries only social weight with the one population the rest of the province despises.

### 2. What a writ actually does — and what it never does

Take the Warrant of Attainder as the worked case.

```
Killing a warranted target, inside Imperial jurisdiction, while carrying the warrant:
  bounty from the killing ...................................... 0
  bounty from collateral (other NPCs killed) ................... FULL, per RI-CRM01 §1
  witnesses ..................................................... still created, still report
  the report resolves as "lawful" ............................... a `report` event with kind:"lawful"
  disposition of the victim's friends/faction ................... FULL loss, unmitigated
  faction consequences for the VICTIM's faction ................. FULL, per RI-CRM01 §7
  the corpse ..................................................... still a death_flag, forever
  the S13 parley ................................................. STILL AVAILABLE (see §3)
```

Five things a writ **never** does, and each is a place a builder will be tempted:

1. **It does not suppress witnesses.** They still see you, still flee, still report. The report
   simply resolves as lawful. This matters because the same witness who cleared you of murder
   also saw you pick the lock on the way in, and *that* report is not covered.
2. **It does not cover collateral.** Guards who intervene, a bystander caught by a sweeping
   greatsword, the dog. `RI-CRM01`'s schedule applies in full. The most common real outcome of a
   writ execution in a crowded room is a lawful kill and a 1,150-gold bill.
3. **It does not travel.** A Warrant is void the moment you cross into a settlement or interior
   jurisdiction, and 4 of the 14 warrant targets *live* in one. Getting them into Imperial
   ground is the quest.
4. **It does not make you liked.** Disposition, faction standing, blood-price (for the Warrant)
   and rumour all move as if you had murdered somebody, because you did.
5. **It does not expire quietly.** An unexecuted Warrant held past **14 in-game days** is
   recalled, costs 1 further rank-progress, and the target learns your name.

**Writ counts in the world:**

| Instrument | Quests | Targets who are named NPCs | Targets with a non-lethal resolution (§3) |
|---|---:|---:|---:|
| Warrant of Attainder | **14** | 14 | **9** |
| Morag Tong writ | **6** | 6 | **4** |
| ku-vastei Ruling | **7** | 7 | **5** |
| Ledger silence | n/a (a service, unlimited within the cap) | — | — |
| **Total sanctioned-murder quests** | **27** | 27 | **18 (67%)** |

### 3. Sanctioned murder and S13 — the target can still talk

This is the constraint that keeps the whole institution inside the corpus's rules.

Seam **S13** as amended: *a fight against anything capable of speech must have a non-lethal
exit.* A writ target is a person. Therefore **every writ target has a parley**, and 18 of 27
sanctioned-murder quests have a resolution that does not end in a corpse. `RI-QST05` counts
them, and its assassin-order band (10–30% PACIFIST-ALL, with D6's "the target must still be
talkable") is satisfied at **67% non-lethal-*option*** against **~22% zero-kill-completable**,
because sparing a target usually costs the quest.

**And the parley is available *during* the fight, not only before it.** ARBITRATION §1 as
amended states that a fight must have non-lethal exits — fleeing, yielding, parley, bribery —
and that crime, witnesses, bounty and faction standing keep accruing while it is happening. A
sanctioned execution is the sharpest case in the game for both halves, so both are specified
here rather than inherited:

| Mid-fight event | Ruling |
|---|---|
| The target yields | A writ target enters a distinct yielding state at ≤ 15% HP or after 2 failed parries, offers their buy-off number, and **stops attacking**. The fight is over unless you continue it. |
| You kill a yielding target | **Lawful under the writ, and costs standing with 3 factions if any witness saw the yield** — the Drowned Court, the rootkeepers, and the issuing authority itself, which asked for a death and not for a performance. This is the one place the corpus prices *how* you killed someone. |
| You kill a bystander at frame *n* | The collateral bounty lands **on frame *n***, mid-swing, not at the encounter's end. The player can watch the writ stop being worth anything while the fight is still going. |
| A guard intervenes and you flee | Leashing applies (`RI-AI01`); fleeing is a supported resolution, the writ survives, the collateral bounty does not clear, and the target is now warned. |
| You bribe mid-fight | The buy-off route (below) is reachable from inside combat at a **×1.5 premium** — panic costs money. |

**No writ execution may be built as an encounter that can only end in a corpse.** A writ target
with no yield state is an S13 defect, and because the yield is also the frame on which the
3-faction penalty becomes possible, it is the mechanism by which the amended §1 has teeth here.

The four shapes a spared writ takes:

| Shape | What happens | Faction cost |
|---|---|---|
| **Bought off** | The target pays you more than the writ does — and every one of the 27 targets has a number | Quest failed; −1 rank-progress; the target now owes you a favour that 3 quests read |
| **Exile** | You escort them out of the jurisdiction and they never return; the authority accepts an absence | Quest completed at **half** reward |
| **Substituted** | The authority wanted a result, not a body. In 5 of 27 cases a document, a confession or a public ruin achieves it | Quest completed in full — these are the best-written five |
| **Refused outright** | You return the writ | −2 rank-progress; the authority sends someone else, and that someone is a named NPC who *succeeds*, visibly, three quests later |

**The last row is the item's most important content requirement.** A refused writ must produce a
*consequence in the world*, not a shrug — otherwise refusing is free and the moral weight of the
institution evaporates. The replacement assassin, and the target's corpse turning up anyway, is
the mechanism.

### 4. Membership is exclusive, and the exclusions are the politics

`RI-LOR02` "How we lose" §8 is binding: *factions the player can all join* is a failure. Crime
sanction is where that has teeth.

| If you hold | You cannot hold | Why |
|---|---|---|
| Ninth Cohort rank ≥ 3 | Morag Tong contact; Sap-Cutter membership | The Legion does not commission the assets of a foreign House |
| Xul-Aneekh (Deep-Kin) rank ≥ 2 | Wet Ledger; Ninth Cohort | The Deep-Kin position is that the coast is a wound |
| Wet Ledger rank ≥ 3 | Xul-Aneekh; Sap-Cutters | The Ledger's business survives on not being either |
| Morag Tong contact | Ninth Cohort ≥ 3; ku-vastei petition | A ku-vastei will not rule for a Tong asset |
| Sap-Cutters | Xul-Aneekh; rootkeeper services; Wet Ledger | Everyone hates them (`RI-LOR02` §4.3) |

**Maximum simultaneous sanctioning authorities: 2.** Reachable pairs are exactly
{Warrant + Ledger}, {Warrant + ku-vastei}, {ku-vastei + Morag Tong is *blocked*}, {Ledger +
Morag Tong}, {ku-vastei + nothing else, if Deep-Kin}. A player who wants both Imperial and
interior sanction must be a Legion officer with a rootkeeper petition — an expensive, strange
and entirely legal character, and one of the game's best.

### 5. **How membership changes guard behaviour — the AR-3 numbers**

`RI-CRM01` §4 gives the guard ladder; `RI-CHR02` §5 gives the race terms. Faction rank enters
as a third multiplier on the same thresholds.

```
arrestThreshold(guard, player) = base[authority]
                               x raceLawFactor[guard.group][race]      # RI-CHR02 §5
                               x factionLawFactor[guard.group][player] # below
attackThreshold                = 4 x arrestThreshold
suspicionMultiplier            = raceSuspicion x factionSuspicion
```

`factionLawFactor` and `factionSuspicion`, by the guard's group:

| Player standing | Imperial guard `lawFactor` | Imperial `suspicion` | Militia (Thorn/Soulrest) `lawFactor` | Interior war-brood `hostile_below_disposition` shift |
|---|---:|---:|---:|---:|
| No faction | 1.00 | 1.00 | 1.00 | 0 |
| **Ninth Cohort rank 1–3** | **1.60** | 0.70 | 1.20 | **+8** (they like you less) |
| **Ninth Cohort rank 4+** | **2.40** | 0.55 | 1.35 | **+14** |
| **Wet Ledger rank 1–2** | 1.25 | 0.85 | 1.10 | +4 |
| **Wet Ledger rank 3+** | **1.75** | 0.70 | 1.20 | +8 |
| **Xul-Aneekh rank 1–3** | **0.65** | 1.45 | 0.80 | **−25** (camps stop being hostile) |
| **Xul-Aneekh rank 4+** | **0.45** | 1.80 | 0.65 | **−40** |
| **Sap-Cutters, any rank** | 0.70 | 1.60 | 0.55 | +20 |
| **Morag Tong contact, known** | 0.80 | 1.30 | 0.90 | +6 |
| **ku-vastei petitioner** | 1.00 | 1.00 | 1.00 | **−12** |

**Worked, and this is the number the AR-3 claim rests on.** An Imperial-race player, Imperial
jurisdiction, `base` = 300:

| Player | lawFactor product | Arrest at bounty ≥ | Attack at ≥ |
|---|---:|---:|---:|
| Imperial, no faction | 1.35 × 1.00 | **405** | 1,620 |
| Imperial, Ninth Cohort rank 5 | 1.35 × 2.40 | **972** | 3,888 |
| Imperial, Xul-Aneekh rank 4 | 1.35 × 0.45 | **182** | 729 |
| **Naga, Xul-Aneekh rank 4** | 0.33 × 0.45 | **45** | **178** |
| **Naga, Ninth Cohort rank 5** | 0.33 × 2.40 | **238** | 950 |

A Naga Deep-Kin officer is arrested for a **45-gold** bounty — less than one theft — and attacked
outright at 178. The same Naga in Legion colours is arrested at 238. **A single faction decision
moves the same character's arrest threshold by 5.3×.**

And the AR-3 assertion proper, the one that changes a fight: **Xul-Aneekh rank 4 shifts interior
war-brood `hostile_below_disposition` by −40.** `RI-CHR02` §4e set that value at 15, so a
Dunmer player arriving at disposition 6 is attacked on sight by every interior camp — unless
they have joined the Deep-Kin, at which point the threshold is −25 and **the same camps, in the
same places, with the same movesets, do not aggro at all.** A faction rank has emptied a
region's encounter tables. Nothing about the fight changed; whether there is a fight did.

### 6. Sanction and the report chain

`RI-CRM01` §3 makes bounty depend on a *report landing*. Faction standing intervenes there too,
and this is the Wet Ledger's whole product.

| Standing | Effect on the report chain |
|---|---|
| **Wet Ledger rank ≥ 3**, crime in Gideon or Lilmoth, bounty ≤ 1,600 | The witness reports; the report is **intercepted** — a Ledger factor reaches the guard first. **Bounty 0, and the Ledger records a favour owed.** Usable **4 times per playthrough**; the fifth is refused with a line that is the best thing the Ledger ever says to you. |
| **Ninth Cohort rank ≥ 4** | Guards accept a *verbal* account: one crime per in-game week is dismissed at the arrest interaction without gold, and the `RI-CRM01` §5 faction-invocation topic is always present. |
| **Xul-Aneekh any rank**, crime witnessed only by `RG-DEEP` NPCs | No report is possible — there is no one to report to (`RI-CRM01` §1, interior jurisdiction). But **blood-price still accrues**, and Deep-Kin membership does not reduce it. Being one of them is not being above them. |
| **Morag Tong contact** | Dres and Dunmer witnesses (`RG-DRES`) do not report you **for killing Dunmer**. They report everything else. |

**The favours owed are the price and they must be built.** Four Ledger interceptions create four
`favour_owed` flags, and the Ledger calls them in at authored moments — always inconvenient,
always something you would not have chosen, and at least one of them is a killing. A silence
that costs nothing is not a system, it is a cheat code with a faction attached.

### 7. Being on the other end — writs against the player

The institution must point both ways or it is a power fantasy.

| Trigger | Who comes | What it is |
|---|---|---|
| Refusing a ku-vastei order (`RI-CHR03`, The Unlit Water) | the arbiter themselves | a named, levelled `ELITE` who enters your encounter tables permanently |
| Imperial bounty ≥ 4,000 | a **Warrant of Attainder against you** | 2 named Legion `DUELIST`s who hunt by region, not by trigger volume; they can be talked to (S13) and one can be bought |
| Blood-price ≥ 2,000 | 2–5 named kin (`RI-CRM01` §8) | interior encounter tables, and coast roads |
| Killing a Morag Tong operative | a Tong writ | 1 named assassin per operative killed, arriving 3–7 in-game days later, indoors, at night |
| Expulsion from the Ninth Cohort at rank ≥ 5 | nothing, deliberately | the Legion writes you off, and that absence is the point |

**Total named hunters the player can accumulate: 11.** They are `RI-AI05` archetypes with
authored statblocks, they do not respawn (S5), and each has a parley (S13). A player who
antagonises everything ends the game being hunted by a small crowd of people with names, which
is a far better late-game consequence system than a bounty number.

### 8. The counts a critic checks

| Metric | Target | Hard fail |
|---|---:|---:|
| Sanctioning authorities | **4** | < 3 |
| Authorities covering all 3 jurisdictions | **0** | ≥ 1 |
| Sanctioned-murder quests | **27** | < 15 |
| Of those, with a non-lethal option | **≥ 18 (67%)** | < 40% |
| Writ targets who are named, non-respawning NPCs | **27 / 27** | < 90% |
| Mutually exclusive faction pairs | **≥ 8** | < 4 |
| Max simultaneous sanctioning authorities | **2** | ≥ 3 |
| `factionLawFactor` spread (max/min on Imperial guards) | **5.3×** | < 2× |
| Interior camps flipped by Deep-Kin rank 4 | **≥ 12** | < 4 |
| Named hunters reachable | **11** | < 5 |
| Ledger interceptions before refusal | **4** | unlimited |
| `favour_owed` flags with authored call-in content | **4 / 4** | < 3 |

## Comparison method

**Harness extensions required** (with `RI-CRM01`): trace event `writ` with
`{authority, target, kind:"issued"|"executed"|"lawful"|"recalled"|"refused"}`; `report` event
gains `kind: "unlawful"|"lawful"|"intercepted"`; `getCrimeState()` gains `writs[]`,
`favours_owed[]` and `hunters[]`.

1. **Authority coverage matrix.** From `game/data/progression/factions.json` and
   `game/data/quests/**`: build the 4 × 3 authority-by-jurisdiction table. **Assert it matches
   §1 exactly** and **assert no authority covers all three jurisdictions.** Any all-jurisdiction
   sanction is the Morag Tong problem shipped un-solved and fails the item.
2. **What a writ does not do (5 assertions, the item's core).** `loadState('gideon-warrant-01')`
   with a valid Warrant and the target in Imperial jurisdiction:
   - Kill the target in front of 2 civilians and 1 guard. **Assert `report` fires with
     `kind:"lawful"` and bounty 0.**
   - Repeat, also killing one bystander. **Assert bounty == 1,000** exactly.
   - Repeat having picked a lock on the way in, observed. **Assert bounty == 50** — the lock
     report is unlawful even though the murder was lawful.
   - Repeat with the target lured into settlement jurisdiction. **Assert the warrant is void and
     bounty == 1,600 × 0.6.**
   - Hold a warrant 15 in-game days. **Assert `writ` event `kind:"recalled"`, −1 rank-progress,
     and the target's dialogue changes.**
3. **Parley coverage (S13, mandatory).** For all 27 sanctioned-murder targets, evaluate the
   parley block. **Assert 27/27 have a parley** and **assert ≥ 18 have a resolution with
   `violence_required: false`.** Then harness-execute one of each of the four §3 shapes and
   **assert the stated faction cost fires.** For "Refused outright", **assert the replacement
   assassin NPC exists, and that the target's `death_flag` is set 3 quests later** by advancing
   the quest graph.
4. **Exclusivity.** Attempt every ordered pair of faction joins. **Assert ≥ 8 pairs are refused
   in dialogue with a stated in-fiction reason** (not a greyed button), **assert the refusal is
   symmetric where §4 says it is**, and **assert no reachable state holds 3 sanctioning
   authorities** by exhaustive search over the join graph.
5. **AR-3 GUARD TEST — the item's headline (mandatory).** For the 5 configurations in §5's
   worked table, `loadState('stormhold-street')`, `setBounty('imperial', b)` at
   `b ∈ {0.5×, 1.5×, 5×}` of each configuration's computed threshold, step 600 frames in a
   guard's cone. **Assert the observed behaviour band matches the computed threshold in 15/15
   cases**, and **assert `arrestThreshold(Naga, Xul-Aneekh 4) == 45 ± 1` and
   `arrestThreshold(Naga, Ninth Cohort 5) == 238 ± 2`** — a 5.3× spread from faction alone.
6. **AR-3 ENCOUNTER TEST — the seam crossing (mandatory).** Run the same interior-region
   traversal scenario twice with an identical seed, once at Xul-Aneekh rank 0 and once at rank 4,
   as a Dunmer:
   ```
   node tools/harness/run-headless.mjs --scenario wld-stone-forest-traverse --seed 4711 \
        --state "race=dunmer,xul_aneekh_rank=<0|4>"
   ```
   **Assert the rank-0 run contains ≥ 12 `AGGRO` transitions from war-brood camps and the rank-4
   run contains 0.** **Assert the enemy `archetype`, `moveset` and statblock ids are identical
   between the two runs** — if the enemies themselves changed, that is Morrowind reaching into
   the fight (AR-1); if nothing changed, the AR-3 claim is fraudulent. Both fail.
7. **Report interception.** As Wet Ledger rank 3 in Gideon, commit 5 crimes of bounty ≤ 1,600 in
   front of witnesses. **Assert the first 4 produce `report` with `kind:"intercepted"` and bounty
   0, and a `favour_owed` flag each; assert the 5th produces `kind:"unlawful"` and full bounty**,
   with a spoken refusal. **Assert all 4 `favour_owed` flags have an authored call-in quest
   stage** in `game/data/quests/**` and harness-verify one fires.
8. **Sanction does not clear blood-price.** As Xul-Aneekh rank 4, kill an interior NPC witnessed
   by `RG-DEEP` only. **Assert bounty 0 (no jurisdiction), `bloodprice.<family>` == 1,400, and
   that Deep-Kin rank does not reduce it.** Then obtain a ku-vastei Ruling for the same killing
   and **assert the blood-price is extinguished and any pre-existing blood-price on that family
   is too**, while Imperial bounty for a separate crime is untouched.
9. **Hunters.** Trigger all 5 §7 rows across a scripted save. **Assert 11 named hunter NPCs
   exist in `listEntities()` across the playthrough, that none respawns after 3 HEARTH rests
   (S5), and that all 11 have a `parley` block (S13).** **Assert the Attainder-against-player
   duellists hunt by region** — verify they appear in ≥ 2 distinct regions, not at a trigger
   volume.
10. **Morag Tong weakness.** As a Morag Tong contact, execute a Tong writ on a Dunmer in Gideon
    in front of an Imperial guard. **Assert full bounty 1,600** — the writ is legally worthless
    in Argonia. Then repeat in front of `RG-DRES` witnesses only: **assert no report.** This
    pair is the item's answer to the problem it is named after and must be verified as a pair.

## Scoring

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| Jurisdictional legality | 4 authorities, 0 universal, matrix exact | 3 authorities, 0 universal | any authority makes killing lawful everywhere → **the Morag Tong problem shipped** |
| Writ limits | all 5 §2 assertions pass | 4 of 5, collateral and lock-report among them | a writ suppresses witnesses or covers collateral |
| Parley coverage | 27/27 parley, ≥ 20 non-lethal options, all 4 shapes built | 27/27 parley, ≥ 18 non-lethal | any writ target with no parley → **S13 hard fail** |
| Refusal consequence | replacement assassin + visible target death | replacement assassin exists | refusing a writ costs nothing |
| Exclusivity | ≥ 10 refused pairs, max 2 authorities | ≥ 8 pairs, max 2 | all factions joinable → `RI-LOR02` §8 violated |
| **AR-3 guard numbers** | 15/15 bands, spread ≥ 5× | 15/15 bands, spread ≥ 3× | faction does not enter the threshold at all |
| **AR-3 encounter flip** | ≥ 12 camps flipped, movesets identical | ≥ 8 camps, movesets identical | **any moveset change (AR-1) or zero flip (sterile) → item fails** |
| Interception | 4 then refusal, 4 authored call-ins | 4 then refusal, ≥ 3 call-ins | unlimited free silence |
| Blood-price independence | verified both directions | verified | faction rank clears blood-price |
| Hunters | 11, all parley-able, region-hunting | ≥ 8, all parley-able | writs point only one way |

**Failure threshold: any axis below 6.** The jurisdictional-legality axis, the parley axis and
the AR-3 encounter axis are binary.

## How we lose

- **One authority quietly covers everything.** The likeliest failure and the one the item is
  named for. It happens by accretion, not by decision: the Warrant is built first and works in
  Imperial jurisdiction; then somebody notices 4 of 14 targets live in settlements and "fixes"
  it by honouring the Warrant there; then the interior is added for consistency. Nobody ever
  makes the decision to trivialise the crime system — it is trivialised by three reasonable
  patches. Method 1 is a single matrix assertion and it must be re-run every wave.
- **The writ suppresses witnesses.** Enormously simpler to implement (`if (hasWrit) return;` at
  the top of the witness check) than to let witnesses exist and resolve their reports as lawful.
  It deletes the lock-report case, the collateral case, and the entire texture of a legal killing
  observed by people who are still upset about it.
- **Collateral is forgiven.** A player kills a warranted target, a guard intervenes, they kill
  the guard, and they get a 2,500 bounty for doing their job. This will be reported as a bug. It
  is the system working, and if it is "fixed" then a writ becomes a licence for a massacre.
- **Faction rank never reaches the guard.** `factionLawFactor` is defined in a JSON file and the
  guard's arrest check reads only race and bounty. Every number in §5 is then decorative, the
  AR-3 claim is false, and the item passes every axis except the two that matter. Method 5 must
  be run as a live behavioural probe across all 15 cells, never as a formula read.
- **The Deep-Kin camp flip is implemented by changing the enemies.** Somebody makes war-broods
  "friendly variants" with a different archetype id, or gives them a passive statblock. That is
  an AR-1 failure — the world reached into the fight and changed the fighters. The legal lever is
  only `hostile_below_disposition` and the disposition the player carries. Method 6's moveset-identity
  assertion exists for this and for nothing else.
- **Sparing a target is impossible.** 27 assassination quests get built as 27 kill-quests
  because the parley, the buy-off number, the exile escort and the five substitution routes are
  four times the work of a kill trigger. `RI-QST05`'s assassin-order band would still pass at
  10%, but S13 would be violated 27 times, and the faction that most needs a non-lethal exit
  would be the one faction without one.
- **Refusing is free.** The replacement assassin who succeeds three quests later is the most
  expensive piece of content in the item — a named NPC, a scheduled off-screen event, a corpse
  that appears in the world, dialogue about it — and the cheapest thing to cut. Without it, the
  writ system has no moral weight, because declining costs a rank and nothing else.
- **The Ledger's favours are never called in.** Four flags get set and nothing reads them, so
  interception is free silence four times over. This is the same failure as the writ suppressing
  witnesses, one layer up: the *cost* half of a transaction is content, and content is what gets
  deferred.
- **Nobody can be hunted back.** §7 is a whole second content stream — 11 named NPCs with
  statblocks, arrival logic and parleys — serving players who misbehave, which is a minority.
  Cutting it makes the entire institution a set of licences the player collects, and removes the
  only late-game consequence the crime system has left once guards stop being lethal (S9).
- **The Morag Tong is imported wholesale.** A builder reads the wiki, finds a joinable
  assassins' guild with legal writs, and builds it — in Black Marsh, in 3E 427, as a
  full questline. It is a Morrowind Great House institution, it has no business holding legal
  authority in Argonia, and making it joinable here would both break the era brief's borrowed-
  content ratio (`RI-LOR02` method 5) and hand the player the universal sanction §1 exists to
  deny. Contact only. Six writs. No rank.

## Provenance note

**Everything in this item is `constructed`**: the four authorities and their jurisdictional
coverage, the five things a writ never does, the 27 quest counts and 67% non-lethal figure, the
exclusivity graph, every cell of `factionLawFactor` and `factionSuspicion`, the interception
rules, the 11 hunters, and every row of §8.

Values adopted from other items, inheriting their provenance: the three jurisdictions, the
bounty schedule, the report chain and blood-price (`RI-CRM01`, `constructed`); `raceLawFactor`,
`raceSuspicion` and `hostile_below_disposition: 15` (`RI-CHR02` §4e/§5, `constructed`); the
`shadowscale-claim` (`RI-CHR03`, `constructed`, on a hard-canon parent); the nine factions and
their politics (`RI-LOR02` §4, `constructed`); rank-gating and expulsion mechanics
(`RI-QST01`/`RI-QST03`).

Canon anchors, `community-data`, medium-to-high confidence, from `RI-LOR01`: **CF-029** — a
Shadowscale may leave the Brotherhood to serve Black Marsh as *ku-vastei*, "agents of needed
change," **arbiters who act with impunity**, some serving the Argonian royal court (high
confidence; this is the entire basis for the third authority, and "act with impunity" is the
canon phrase the Ruling mechanic implements). **CF-030** — breaking a Shadowscale tenet is
treason punished by execution ordered through the Argonian royal court (medium). **CF-028** —
Argonians born under the Shadow become Shadowscales (high).

The **Morag Tong is `canonical-recall`, confidence medium**: a Morrowind guild of legal
assassins issuing Writs of Execution that a player can show to guards to void the bounty for a
named killing. That recollection is used here only as the *problem statement*; the ruling that
its writs carry no legal weight in Argonia is this item's, and it is defensible on canon grounds
(the Tong's authority derives from Morrowind's Great House law, which does not run in Black
Marsh) but it is a ruling, not a fact.

Confidence **medium**. The jurisdictional structure I hold firmly — it falls straight out of
`RI-CRM01`'s three jurisdictions and it is the only clean answer to the Morag Tong problem I can
construct. The calibration is unvalidated, and the two figures most likely to be wrong are the
Ninth Cohort's 2.40 `lawFactor` (which lets a Legion officer accrue a 972-gold bounty before
anyone stops them — that may read as corruption rather than as privilege, though corruption is
arguably correct for `RI-LOR02`'s late-Septim Empire) and the 4-interception cap, which was
chosen because four `favour_owed` call-ins is as much authored content as the Ledger can
plausibly carry.
