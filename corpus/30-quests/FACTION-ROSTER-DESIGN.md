# The faction roster, and why each one is on it

**Owner:** W1-FACTIONS (faction questline builder).
**Status:** design note. Written *before* any content was authored, per the brief.
**Binding on:** `game/data/quests/faction-gates.json`, `game/data/quests/faction-*.json`,
`game/data/progression/factions.json`.
**Judged by:** `RI-QST01` (escalation shape), `RI-QST02` (deceit), `RI-QST03` (gating),
`RI-CRM02` (faction crime and writs), `RI-LOR02` §4 (our factions), `ARBITRATION` §1 (faction
gating is Morrowind-authoritative) and §3 CONSUMPTION.

---

## 0. What this note is answering

`game/data/progression/factions.json` shipped two factions — `house-dres` and
`shadowscale-order` — with three ranks each and **zero quests between them**. That file is a
wave-0 skeleton and says so nowhere; `tools/lib/gamedata.mjs` §90–97 is the only place in the
tree that records the fact, returning it under `.skeleton` and pointing at
`game/data/quests/faction-gates.json` as the ladder of record.

So the first question is not "what factions should we invent". It is **"which of the bodies this
world already has are careers, which are services, and which are weather"** — and the answer has
to come out of `corpus/60-lore/RI-LOR02` §2–§4 and `RI-CRM02` §1/§4, both of which already did
the political work. Inventing a tenth faction here would be exactly the drift
`INTENT-AUDIT-CHARTER` §6 calls **narrowed**: replacing an authored world with a convenient one.

---

## 1. The roster

The brief names six interests that a Black Marsh roster must cover. Each is covered by a body
the corpus already names, and each is placed in one of three tiers.

| Interest the brief names | Body | Tier | Where it comes from |
|---|---|---|---|
| **The Empire's presence** | **The Imperial Assize** (`the_imperial_assize`) — the civil arm of the Provincial Office at Gideon: customs, the toll book, the only courts in the province | **Joinable, full ladder** | `RI-LOR02` §3 Gideon ("Imperial Provincial Office; a Colovian Governor who has not left the compound in two years"); §4.5. `faction-reactions.json` aliases `the_imperial_assize → provincial-office`, `RG-EMPIRE` |
| **The Empire's presence, armed** | **The Ninth Cohort** (`ninth-cohort`) — the Legion, Blackrose, the warrants | **Contact + writs** | `RI-LOR02` §4.5, `CF-C001` (under-manned); `RI-CRM02` §1 row 2 (Warrant of Attainder, 14 quests) |
| **A merchant / salt-and-glass interest** and **an outlaw / smuggler interest** — *the same body, and that is the point* | **The Wet Ledger** (`the_wet_ledger`) — Gideon's lukiul-and-Imperial compact: tolls, warehouses, the Governor's debts, and the report chain it buys | **Joinable, full ladder** | `RI-LOR02` §3 Gideon, §4.2 ("The only faction that will make you rich… every gold it pays you came off a barge that passed a Dres ship at Archon and said nothing"); `RI-CRM02` §1 row 4 and §6 (the Ledger buys the report chain) |
| **The Hist and the tribes** | **The Xul-Aneekh, the Deep-Kin** (`the_xul_aneekh`) — interior isolationists out of Helstrom and the Deep Marshes | **Joinable, full ladder** | `RI-LOR02` §3 Helstrom, §4.1 ("Not evil, not wrong, and willing to kill lukiul children"); `RI-CRM02` §5 (Deep-Kin rank 4 shifts interior `hostile_below_disposition` by −40) |
| **The Hist, tended rather than defended** | **The Rootkeepers** (`the_rootkeepers`) | **Joinable, partial** — ladder present, questline not carried this round | `RI-LOR02` §2 (the Hist speaks "through rootkeepers, sapwells, and dreams") |
| **House Dres and the slave trade** | **House Dres** (`house-dres`) | **Not joinable. Weather.** | See §2 |
| **The Shadowscales** | **`shadowscale-order` / the ku-vastei** | **Not joinable. A service.** | See §3 |
| Salt-and-glass, the heretic end | **The Ixtu-Vakh, the Sap-Cutters** (`the_ixtu_vakh`) | **Joinable, partial** | `RI-LOR02` §4.3 ("the most hated faction in the province and the best-paid") |
| The dead, and what happens to them | **The Drowned Court** (`the_drowned_court`) | **Joinable, partial** | `RI-LOR02` §3 Soulrest, §4.4 |
| Labour | **The Dockhands** (`the_dockhands`) | **Joinable, partial** | Emergent from the Gideon quay quests; `faction-reactions.json` marks it explicitly `null` — "a labour body with no cross-faction politics" |

**Three lines are carried to a rank ceiling this round: the Wet Ledger, the Imperial Assize and
the Xul-Aneekh.** They were chosen because they are the only three that form a *closed triangle*
of mutual exclusion (§4), which is the property `RI-QST01` "How we lose" names as the difference
between a faction system and a checklist.

---

## 2. House Dres is not a career, and the reason is not squeamishness

`RI-LOR02` §2 gives House Dres exactly one want — *"Bodies. Specifically hatchling-to-adult
Argonians"* — and one weakness the player is told to exploit: *"Attack a Hist directly — Dres
slavers are superstitious about the trees and this is exploitable."* Dres has no province-side
institution to climb. Its factors are foreign, transient, and in Argonia on sufferance.

A Dres ladder would therefore have to be **invented whole**, which is the thing this note exists
to refuse. But more importantly it would spend the slave trade badly. Slavery in this game is not
a faction the player might join; it is **the substrate three other ladders are built on**, and it
shows up as the corrupt heart of each of them:

- The **Assize** line's rank 5–7 is the **Blackrose labour-lease** (`RI-LOR02` §3 Blackrose:
  *"prisoners rented out to coastal plantations and, through intermediaries, to Dres factors.
  Legal on paper. Slavery in fact"*). The Assize's corruption reveal **is** Dres, laundered
  through Imperial procedure. The player who climbs the Empire discovers they have been the
  paperwork.
- The **Ledger** line's rank 4–6 is the Archon water-call (`RI-LOR02` §3 Archon: *"Dres ships put
  in at Archon 'for water.' Everyone knows what is in the holds. The captains take the money"*).
  The Ledger's product is silence, and this is what the silence is for.
- The **Xul-Aneekh** line's rank 0–7 is the answer to it, and is wrong in its own way: the
  Deep-Kin's remedy for the coast is to cut the coast off, and the people on the coast are
  Argonians.

So Dres appears in all three lines, is the antagonist of two of them, has a reaction row
(`house-dres`, `RG-DRES`, already in `faction-reactions.json`), and is joinable by nobody. It is
weather. **`house-dres` stays in `progression/factions.json` as a non-joinable body with its
three named ranks intact**, because Dres factors *have* ranks and the player needs to be able to
read one off a person; it simply has no player ladder.

## 3. The Shadowscales are a service, and `RI-CRM02` already ruled it

`RI-LOR02` §4.8 and `RI-CRM02` §1 row 3 are unambiguous: Shadowscales / **ku-vastei** are *"not a
joinable guild but a **service**: an arbiter who arrives when a thing has gone too far."* Their
instrument is **a Ruling**, which extinguishes the blood-price a killing creates in the interior
jurisdiction, and it is priced in either the `shadowscale-claim` birthsign hook (`RI-CHR03`, The
Unlit Water) or a rootkeeper petition costing 3,000 g and a quest.

That is a far better thing to be than a ninth ladder. A ku-vastei is a **quest-giver who cannot
be climbed** — the Morrowind shape `RI-LOR02` calls *"Perfect Morrowind quest-giver, zero
invention cost"* — and their Ruling is a **non-violent resolution that is available to a player
who has never joined anything**. The Xul-Aneekh line uses it exactly once, at rank 6, and it is
the only way to reach that line's best ending without a corpse.

`shadowscale-order` therefore stays in `progression/factions.json` with its three ranks, marked
`joinable: false, kind: "service"`. Its ranks describe the arbiter you are talking to, not a
ladder you may climb.

---

## 4. Mutual exclusion — the triangle

`RI-QST01` "How we lose": *"Four lines that run in parallel and never collide, so the player can
complete all four with no cost. The moment a critic can 100% every faction in one save, the
escalation is decorative."* `RI-QST03` §C sets the reachability invariant at **≤ 60% of all
faction quests in a maximally greedy single save**.

The three carried lines are chosen so that **no two of them can be finished in one save**:

```
                 the_imperial_assize
                   (Empire, Gideon)
                   /              \
        X4 enemy pair          X1 hard group
        (already declared)     "the two courts"
                 /                  \
   the_wet_ledger  ————— X2 ————  the_xul_aneekh
   (tolls, silence)   soft, then    (Helstrom, the interior)
                      hard at r3
```

| Rule | Pair | Bites at | Mechanism | Corpus source |
|---|---|---|---|---|
| **X4** enemy pair | `the_wet_ledger` ↔ `the_imperial_assize` | join time | Already in `faction-gates.json` `exclusivity.enemy_pairs`. `FactionGates.closedBy()` returns it and the recruiter says it out loud | `RI-QST03` §C X4 |
| **X2** earned exclusivity | `the_wet_ledger` ↔ `the_xul_aneekh` | Ledger rank 3 / Deep-Kin rank 2 | `RI-CRM02` §4: *"Xul-Aneekh rank ≥ 2 → cannot hold Wet Ledger"*, *"Wet Ledger rank ≥ 3 → cannot hold Xul-Aneekh"*. Fired by a **quest resolution**, not a menu — `Q-LEDG-03` and `Q-DEEP-03` each lock the other line's rank-3 quest | `RI-QST03` §C X2, `RI-CRM02` §4 |
| **X2** earned exclusivity | `the_imperial_assize` ↔ `the_xul_aneekh` | Assize rank 4 / Deep-Kin rank 4 | The Assize's Blackrose warrant and the Deep-Kin's answer to it are the same event seen from two chairs | `RI-QST02` D5 |
| **X3** mediated escape | all three pairs | — | Every X2 quest has ≥ 2 resolutions and at least one does **not** populate `consequences.locks`. The escape is always a named dissenter's alternate, never a menu | `RI-QST03` §C X3 |
| **X5** rank ceiling | any two compatible memberships | rank 5 | Ranks 6–7 require sole allegiance, asked for explicitly in dialogue | `RI-QST03` §C X5 |

**The consequence, stated as a number a critic can check:** a greedy single save can reach at
most **one** of the three carried lines past rank 3, so the reachable fraction of the three
lines' quests is bounded well under `RI-QST03`'s 60%.

**What joining costs you, in the world and not in a menu** (this is the AR-3 half, and it is
already implemented on the crime side, which is why these three were chosen):

- `RI-CRM02` §5: **Xul-Aneekh rank 4 shifts interior war-brood `hostile_below_disposition` by
  −40.** `RI-CHR02` §4e sets that value at 15, so a Dunmer player at disposition 6 is attacked on
  sight by every interior camp — *unless* they joined the Deep-Kin, at which point the same camps
  with the same movesets do not aggro at all. **A faction rank has emptied a region's encounter
  tables.**
- `RI-CRM02` §5 again: Assize/Cohort rank 4+ multiplies the Imperial arrest threshold by 2.40 and
  the interior's hostility by +14. The same character is arrested at 972 gold in Gideon and
  attacked on sight in the Deep Marshes.
- `RI-CRM02` §6: **Wet Ledger rank ≥ 3 intercepts the report chain** in Gideon and Lilmoth for
  crimes ≤ 1,600 bounty, four times per playthrough.

---

## 5. The rank ladder is being re-derived, and here is the measurement that forces it

`faction-gates.json` is machine-generated by `tools/analysis/gen-faction-gates.mjs` and its own
header says the content is owed: *"Wave-1 pieces W1-2x own the CONTENT of these ladders and
should re-derive every number; what is binding here is the SHAPE."* This is that re-derivation.

**Three defects, all measured against the shipped build, not argued:**

### 5.1 The ladder is unreachable at rank 1 for every character the game can make

`tools/quests/faction-signature-sweep.mjs` drives **240 signatures** (10 races × 4 upbringings ×
6 classes) through the shipped character builder and reads the composed sheet back out of
`getPlayerStats()`. Result:

| Faction | best favoured attribute at creation (min / p10 / median / **max**) | rank-1 asks | signatures meeting it |
|---|---|---:|---:|
| every one of the nine | 3–10 / 6–11 / 10–14 / **19** | **25** | **0 / 240** |

The highest favoured attribute any fresh character in this game has is **19**. Every ladder asks
**25** at rank 1. **Nobody can hold rank 1 in any faction, in any build, at any point before
grinding.** This is the Act IV margin-of-zero failure again, with a margin of −6 and a
denominator of 240 rather than 40.

### 5.2 The top of the ladder is unreachable by arithmetic

Attributes in this game rise by exactly one route: `character/derive.js:359`, **+1 to the
governing attribute each time a governed skill crosses a multiple of 15**. Skills cap at 100.
Governed-skill counts, from `progression/skills.json`:

| Attribute | skills it governs | best-case gain (6 per skill) | ceiling from a 19 start |
|---|---:|---:|---:|
| agility | 6 | +36 | **55** |
| strength | 3 | +18 | **37** |
| intellect / willpower / personality | 2 | +12 | **31** |
| endurance / speed / vigour / hist-bond | 1 | +6 | **25** |
| luck | 0 | 0 | **19** |

The shipped ladder asks **75** at rank 7. **No attribute in this game can reach 75.** For the six
factions whose favoured attributes govern two skills or fewer, the ceiling is 31 — and one of
them (`the_drowned_court`: willpower, endurance) tops out at 31 against a demand of 75.

`RI-QST03` §A records that Morrowind's own top-rank favoured attribute sits at **~33–34**. The
generated column asks **2.2×** the figure of the game it claims to model.

### 5.3 Three factions favour an attribute that does not exist

`gen-faction-gates.mjs` carries a hardcoded `ATTRS` list containing **`intelligence`**. The
sheet's attribute is **`intellect`** (`progression/attributes.json`). `FactionGates.evaluate()`
reads `ctx.attributes['intelligence']`, gets `undefined`, and `num()` returns 0. So
`the_imperial_assize`, `the_xul_aneekh` and `deep_kin` each carry **one dead favoured
attribute**, and because the gate takes the maximum of the two, the Assize's live attribute floor
collapses from 10 to **3**.

### 5.4 The corrected ladder

`RI-QST03` §B's format is kept **verbatim** — reputation, one of two favoured attributes, two
distinct favoured skills the player chooses, and a world state. Only the numbers move, and only
to values §B's own reasoning supports and the measurement above permits.

| Rank | Rank name | Faction rep | Primary attr | Favoured skill #1 | Favoured skill #2 | World state |
|---:|---|---:|---:|---:|---:|---|
| 0 | *(joining rank)* | 0 | — | — | — | — |
| 1 | | 10 | **12** | 20 | — | — |
| 2 | | 22 | **14** | 25 | 10 | — |
| 3 | | 36 | **16** | 32 | 15 | — |
| 4 | | 52 | **18** | 40 | 20 | — |
| 5 | | 70 | **20** | 50 | 25 | a faction-specific holding, shrine or debt |
| 6 | | 90 | **22** | 60 | 30 | a `politics` quest resolved in the faction's favour |
| 7 | | 112 | **24** | 70 | 35 | the incumbent's seat vacant by the player's action |

- **Reputation, skill #1 and skill #2 columns are `RI-QST03` §B unchanged.** Skill 70 at rank 7
  sits inside §A's observed Morrowind ceiling of 70–80 and inside our own cap of 100.
- **The attribute column is lowered from §B's 22→34 to 12→24**, because §B's numbers were written
  against Morrowind's level-up attribute multipliers and `ARBITRATION` S2 deleted those. This is
  the number the brief's own warning is about, so it is set with a **declared margin rather than
  a clamp**: the generator now refuses to emit a ladder whose rank-7 attribute demand is not at
  least **4 under** the reachable ceiling of that faction's best favoured attribute. Against the
  worst-governed attribute in the roster (ceiling 31) that is 24 + 4 ≤ 31, with 7 to spare; the
  Wet Ledger's agility line has 31 to spare. Rank 1 at 12 sits at the *median* of the measured
  creation distribution, so roughly half of all signatures hold rank 1 the moment they join and
  the rest need two attribute points — which is the Morrowind feel: rank 1 is a door, not a wall.
- **Rank 7 is a build statement, not a grind.** A character who favoured the faction's attribute
  at creation (measured max 19) needs +5 to reach 24 — one favoured skill taken to 90. A
  character who favoured against it starts near 3–6 and cannot get there at all, which is exactly
  what `RI-QST03`'s bar means by *"you cannot lead the assassins with a heavy-armour brawler's
  sheet, and the game says so in numbers before you fail."*
- **`intelligence` becomes `intellect` everywhere**, and the generator gains an assertion against
  `progression/attributes.json` so the class of defect cannot recur.
- **No rank references level, souls, gold or a quest counter.** `gate.js assertNoLevelGate()`
  throws at construction if one ever does.
- **Favoured-skill coherence:** no two factions share more than 3 favoured skills
  (`RI-QST03` method 3), asserted in the generator. It fired immediately: `deep_kin` and
  `the_drowned_court` shipped **six identical favoured skills** — the same build statement under
  two names — and `the_dockhands` and `the_imperial_assize` shared four. Four sets were re-cut;
  the three carried lines now share at most **3** (Ledger ∩ Assize = speechcraft, mercantile,
  security) and the interior line shares at most **2** with either.

### 5.5 The duplicate faction

`faction-gates.json` ships **`ixtu_vakh` and `the_ixtu_vakh` as byte-identical ladders under two
ids**, and `deep_kin` as a third ladder for a body `RI-LOR02` §4.1 and
`faction-reactions.json`'s alias table both say **is** the Xul-Aneekh. The alias table already
resolves `deep_kin → xul-aneekh` and `ixtu_vakh → sap-cutters`.

Three things change and one does not:

- **`ixtu_vakh` is gone.** It only ever entered the ladder list because a *reputation delta*
  named it. The generator now distinguishes a faction a quest **belongs to or gates on** (a
  career, gets a table) from one a quest merely **moves the standing of** (weather, gets a row in
  `standing_only`). That is also what unblocked `house_dres`, which the design deliberately gives
  no ladder (§2) and which the old generator would have thrown for.
- **The enemy pair `['the_xul_aneekh','deep_kin']` is removed.** The build declared a faction the
  permanent enemy of itself, which `FactionGates.closedBy()` would have honoured.
- **`deep_kin`'s ladder is now the Xul-Aneekh's ladder** — same favoured attributes, same
  favoured skills, same world-state flags — so a player who advances one advances a body with the
  same build statement, and the skill-overlap assertion is satisfied by declaring them aliases
  rather than by pretending they are different.
- **What does not change:** `deep_kin` still exists as an id, because deleting it would orphan
  `Q-MAG-07`, another piece's quest. `the_xul_aneekh` is the id of record and folding the two is
  owed to the coherence pass.

---

## 6. The escalation shape each line follows

`RI-QST01` Table B, compressed. The item's own target is 24–28 quests per line; **this round
ships 9 per line and that shortfall is declared, not hidden** (see §8).

| Rank | Band | Quests this round | Dominant `task_kind` | Stakes | What changes |
|---:|---|---:|---|---:|---|
| 0 | joining | 1 | `errand` / `delivery` | 1–2 | the faction's texture and geography |
| 1 | sworn | 1 | `investigation` / `retrieval` | 3–4 | route choice only; a rumour of enemies |
| 2 | hand | 1 | `investigation` | 4–5 | **first inconsistency**; a rival speaks unprompted |
| 3 | confidant | 1 | `theft` / `moral_dilemma` | 5–6 | **first deceitful quest lands here at the latest**; the X2 lock arms |
| 4 | blooded | 2 | `dirty_work` | 6–7 | the **dissenter** names the rot and offers alternates |
| 5 | named | 1 | `dirty_work` / `politics` | 7–8 | the player is implicated; they profited |
| 6 | councillor's voice | 1 | `politics` | 8–9 | expose, conceal or inherit; exclusivity closes |
| 7 | seat | 1 | `succession` | 9–10 | the recruiter's fate is the player's decision |

**Each line's dissenter** — the Percius Mercius slot, `RI-QST02` D3 — is a named NPC inside the
faction who is correct and hostile-coded, appears as `deceit.revealed_by[].source` with
`channel: "rival_npc"` on ≥ 3 quests, and whose reveal is cited by `requires_knowing` on a
resolution. A dissenter who only talks is not a dissenter.

| Line | Recruiter (rank 0) | Dissenter (D3) | Corruption reveal lands at | What the rot is |
|---|---|---|---|---|
| The Wet Ledger | Factor Belliene, Gideon toll gate | **Wuleen-Kus** of the low market | **rank 1** (`Q-LEDG-01`, already shipped) | The Ledger's losses are its own thefts, and it has hung them on a man who could not read before |
| The Imperial Assize | Assizer Corvo, Gideon court | **Notary Sedda Vell**, struck off, keeps the old Blackrose day-book | **rank 2** | The labour-lease is slavery with an Imperial seal on it, and the Assize writes the seal |
| The Xul-Aneekh | Speaker Teel-Ashaan, the hollow east of Helstrom | **Ee-Vashum**, a war-brood mother who lost a daughter to the coast and will not have the coast punished for it | **rank 2** | The Deep-Kin's answer to the takers is to drown the people the takers take from |

Both the Assize and the Deep-Kin reveals land at rank 2, inside `RI-QST01`'s hard deadline of
rank 3, and the Ledger's at rank 1.

---

## 7. Two rules this note commits every quest in these lines to

**7.1 Every `opens_by.topic` must exist as a topic id.** The most expensive defect in this
project's history is that the quest and dialogue layers were never joined: **74 of 76
`opens_by.topic` values were unsatisfiable**, invisible because every quest tool seeded the gate
with the quest's own string. `game/src/core/topics.js` now folds slug against prose, and
`game/data/quests/hooks.json` was hand-rewritten so that a quest teaches the keyword of a
**later** quest and never its own. Both properties are preserved here:

- every topic these lines name is written into `game/data/dialogue/topics/50-factions.json`
  with a body — an actual info somebody says, with `to` edges onward;
- every `hooks.json` `entry_topics` row added points **forward**;
- the rank-0 quest of each line owes its topic to **the world** — `opens_by.overheard_from`, the
  rumour layer, and the recruiter's own topic list — and to no quest.

**`hooks.json` must never be regenerated.** `tools/analysis/gen-quest-hooks.mjs` writes the
self-loop form and would re-open the defect. This is recorded here because the file's own `note`
field still says "edit the generator", which is now wrong.

**7.2 Every giver gets a complete NPC record.** Quest offers were race-invariant until W1-07
round 4, and 31 givers had a record with no `reaction_group` while nine had none at all. Every
NPC these lines introduce ships with `id`, `actor`, `race`, `class`, `faction`,
**`reaction_group`**, `settlement`, `disposition`, `topics` and a greeting line — the full record
`Engine._assertGiversAreVisibleToRace()` refuses to boot without.

---

## 8. What this round does not do — declared, not hidden

| Bar | Target | This round | Note |
|---|---|---|---|
| `RI-QST01` quests per line | 24–28 (hard fail < 18) | **9** | The single largest gap. The *shape* is complete — every rank band 0–7 is populated and the escalation, dissenter, deceit and succession beats all land — but the volume is a third of the bar. Three more passes at this line count would clear it. |
| `RI-QST01` joinable factions at ship | 4 | 3 carried, 9 with ladders | The fourth carried line should be the Rootkeepers, whose ladder already exists |
| `RI-QST01` total faction quests | 96–112 | ~38 across the whole book | |
| `RI-QST03` expulsion / readmission | implemented per tier | **not implemented** | §D's expulsion tiers have no data file and no code path. Declared as an open gap, not papered over |
| `RI-CRM02` writ quests | 27 sanctioned-murder quests | **0 authored here** | The Assize line's rank-5 quest issues a Warrant of Attainder as a quest object, which is the hook; the other 26 are unwritten |
| Fold `deep_kin` into `the_xul_aneekh` | one body, one id | **not done** | Would orphan `Q-MAG-07`, another piece's quest. Recorded for the coherence pass |
