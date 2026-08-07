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

### 4a. What counts as "you are one of them" — a rule that had to be corrected in the engine

`RI-QST03` §C X1 says the lock lands *"permanently, at join time"*, and the engine was reading
those four words wrongly. `QuestEngine.context()` computed

```js
held = Math.max(derivedRank[f], member ? 1 : 0)
```

so a **derived** rank alone closed every rival. Derived rank asks for reputation, an attribute and
a skill — and reputation is paid sideways all over this book. `Q-ASSZ-04 res_hide_vell` pays the
Drowned Court **20** for hiding a witness *on the Assize's own instructions*. Driving the Assize
line through `questOffers()` from a cold start, that single favour derived Drowned Court rank 1,
and the Assize then refused **its own rank-5 quest**:

> *"The Imperial Assize will not deal with you: you are The Drowned Court."*

Four of nine quests on the line went unreachable, to a player who had never joined the Drowned
Court and had done the favour because the Assize told them to.

**The rule, restated:** a rank closes a rival only where the player actually **joined** —
`consequences.joins_faction`, an authored act with a scene around it. Reputation without
membership is a *qualification*: it is what makes you eligible to join, and nothing more.
`heldRank()` in `game/src/sim/quest/machine.js` is the one place that decides this.

This immediately exposed the other half: **nothing in the faction book ever joined a faction.**
`joins_faction` appeared in exactly one file in the whole tree (`mainline-act4.json`). Every
ending of each line's entry quest — `Q-LEDG-00`, `Q-ASSZ-00`, `Q-XULA-00`, seven resolutions —
now carries it, which is correct on its own terms: every one of those endings already ends with
the player taken on ("on the roll of the Assize", "the hollow has named the player", "the Ledger
has a runner it can send again"). The join was in the prose and not in the data.

**Measured after both changes**, `tools/quests/faction-probe.mjs`, all three lines, live:
joining the rival closes the line, and the refusal a giver speaks names who you chose instead —
*"The Xul-Aneekh will not deal with you: you are The Imperial Assize."*

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
distinct favoured skills the player chooses, and a world state. Only the numbers move.

| Rank | Faction rep | Favoured skill #1 | Favoured skill #2 | World state |
|---:|---:|---:|---:|---|
| 0 | 0 | — | — | — |
| 1 | 10 | 20 | — | — |
| 2 | 22 | 25 | 10 | — |
| 3 | 36 | 32 | 15 | — |
| 4 | 52 | 40 | 20 | — |
| 5 | 70 | 50 | 25 | a faction-specific holding, shrine or debt |
| 6 | 90 | 60 | 30 | a `politics` quest resolved in the faction's favour |
| 7 | 112 | 70 | 35 | the incumbent's seat vacant by the player's action |

**Reputation and both skill columns are `RI-QST03` §B unchanged.** Skill 70 at rank 7 sits inside
§A's observed Morrowind ceiling of 70–80 and inside our own cap of 100.

**The attribute column is not in that table, because it is no longer one row of numbers.**

#### The first correction was still a best case, and the live line found it

Round one lowered §B's shared attribute column from 25→75 to 12→24 and asserted the top was
reachable. The assertion compared the rank-7 literal against `creation MAX (19) + 6 per governed
skill in the whole game`: the single best sheet of 240, grinding skills the ladder never grades.
It passed. Then `tools/quests/faction-probe.mjs` drove the Wet Ledger through `questOffers()`
from a cold start and the **derived rank stopped at 3 of 7** — at reputation 112, which *is* the
rank-7 demand — because agility had reached 16 against a demand of 24. **Three of nine quests on
the line were reachable.** This is the brief's own warning arriving on schedule: a gate clamped
against a best case shuts for real characters.

#### The arithmetic nobody had done

An attribute rises by exactly one route: **+1 each time a governed skill crosses a multiple of
15** (`character/derive.js:359`). Nothing else in this build moves one — `ARBITRATION` S2 deleted
Morrowind's level-up multipliers and put nothing in their place.

So take the two skills **the ladder itself grades** from a median starting sheet to the rank-7
demands, 70 and 35. That crosses **four** multiples of 15. A whole faction ladder, played to its
ceiling, pays **+4 attribute** — while the spread between signatures at creation is **6 to 19**.

> **The attribute term cannot carry a rank ladder in this build.** Reputation runs 0 → 112 and
> the skill columns 20 → 70; both scale by an order of magnitude more than the attribute the same
> work earns. Any attribute demand large enough to discriminate between builds is larger than the
> ladder's own work pays for, and therefore locks players out for a reason they cannot act on.

#### What the column asks for now

Per faction, derived rather than declared:

```
attribute(R) = p10 creation favoured attribute
             + multiples of 15 the rank's OWN skill_1/skill_2 demands cross
               from that faction's median starting sheet
             - margin (2)
```

Both inputs are **read from `reports/faction-signature-sweep.json`**, a live sweep of the shipped
character builder over 240 signatures, so the generator cannot drift from the sheet. A rank never
asks for an attribute point the rank's own work has not paid for, and leaves 2 points of room on
top. The emitted columns:

| Faction | favoured attrs | r1 | r2 | r3 | r4 | r5 | r6 | r7 |
|---|---|--:|--:|--:|--:|--:|--:|--:|
| `the_wet_ledger` | agility / personality | 8 | 8 | 9 | 9 | 10 | 12 | 12 |
| `the_imperial_assize` | personality / intellect | 4 | 4 | 5 | 5 | 6 | 8 | 8 |
| `the_xul_aneekh` | willpower / intellect | 8 | 8 | 9 | 9 | 10 | 11 | 11 |
| `deep_kin`, `the_rootkeepers`, `the_ixtu_vakh`, `the_dockhands` | — | 8 | 8 | 9 | 9 | 10 | 11 | 11 |
| `the_drowned_court` | willpower / endurance | 9 | 9 | 10 | 10 | 11 | 12 | 12 |

The Assize's column is the lowest because its favoured attributes are `personality` and
`intellect`, whose **p10 creation value is 6** — a nord salt-blade who decides to become a lawyer
really does start from nothing. That is honest, and it is deliberately preferred to the
alternative, which is a number that reads impressively and shuts the line.

**These are small numbers and that is the finding, not a shortcut.** The gating work is done by
the two columns that can do it. If a later round wants the attribute term to bite, the change
belongs in `character/derive.js` — more governed skills per attribute, or a second earning route
— not in this table.

#### Resolutions have the same failure mode, and it was unguarded

A `resolutions[].requires.attributes` demand is the same kind of number as a rank gate's, and
nothing was checking it. Measured per-attribute ceilings (`base + 6 per governing skill`, p10
sheet): **agility 45, strength 23, willpower 22, personality 18, intellect 18, hist-bond 16,
speed 16, endurance 15, vigour 12, luck 11** — luck is raised by no skill in the game at all.

Two quests on these lines had **no reachable ending whatsoever**, both at a line ceiling:

* `Q-ASSZ-06` asked **personality 20** on all three endings (ceiling 18);
* `Q-XULA-08` — the Xul-Aneekh's last quest — asked **willpower 24** on three of four (ceiling 22).

Both are lowered to sit 2 under the ceiling. The instrument is
`tools/quests/resolution-reachability.mjs`, which fails the build if any quest has no reachable
ending, and reports (without failing) endings that are out of reach for a given sheet — those are
builds the player did not take, which is the point of having four endings. It finds **19** such
endings across the whole book, five of which are on quests this piece does not own.

**Other corrections kept from round one:** `intelligence` → `intellect` everywhere, with a
generator assertion against `progression/attributes.json`; no rank references level, souls, gold
or a quest counter (`gate.js assertNoLevelGate()` throws at construction); and no two factions
share more than 3 favoured skills (`RI-QST03` method 3), which fired immediately — `deep_kin` and
`the_drowned_court` shipped **six identical favoured skills** and `the_dockhands` and
`the_imperial_assize` shared four. The three carried lines now share at most 3.

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

---

## 9. CONSUMPTION — the world-side consumer of each model, and how it was shown

`RI-MTH07`, mandatory under `ARBITRATION.md` §3. Four models ship here. For each: the consumer
that reads it in `game/src/`, and the perturbation that made an offer appear or disappear.

| Model | World-side consumer | Perturbation, and what changed |
|---|---|---|
| `game/data/quests/faction-*.json` | `QuestBook` → `QuestEngine.offers()` | The line is walked from a cold start. At rank 0 the only refusal is *"the topic 'the wet ledger' has not come up yet"*; 9/9 quests become offerable by playing, and 0/9 are offered before it |
| `faction-gates.json` rank ladders | `FactionGates` → `QuestEngine.context()` → `gate.js canOffer()` | Zeroing faction reputation moves the **derived** rank 7 → 0 and closes the standing offer. Rank is never set by the probe; it is always read back |
| `faction-gates.json` exclusivity | `QuestEngine.context()` rivalry derivation → `ctx.locked` → `canOffer()` | Joining the rival closes the line and the giver speaks a reason naming who you chose instead |
| `consequences.world_flags` | `QuestEngine._applyConsequences()` → `sim.quest.flags` | Read back through the new `questWorldFlags()`. 34–38 flags per line are set that the probe never wrote — i.e. raised by the resolutions themselves |

**Instrument:** `tools/quests/faction-probe.mjs`, one real browser, `setRenderRate(0)`, 320×240.
It walks with only what a player can get: a topic somebody said out loud, reputation the quests
award, skills raised through `grantSkillUse()` (never `setSkills`), gold, and the reveals a quest
declares. **It never sets an attribute** — every attribute point the character ends with was
earned by a governed skill crossing a multiple of 15, and the probe reports which crossings.

**Result, all three carried lines: 11/11 checks, exit 0.**

| Check | the_wet_ledger | the_imperial_assize | the_xul_aneekh |
|---|---|---|---|
| quests offerable from a cold start | 0 / 9 | 0 / 9 | 0 / 9 |
| quests offerable after playing | **9 / 9** | **9 / 9** | **9 / 9** |
| top derived rank | 7 (The Ledger) | 7 (Legate of the Assize) | 7 (Xul-Aneekh) |
| resolutions taken requiring violence | **0 / 16** | **0 / 17** | **0 / 16** |
| world flags raised by the resolutions | 38 | 37 | 38 |
| joining the rival closes the line | yes | yes | yes |

The line can be walked end to end without killing anybody. That is a property of the content —
every quest on all three lines has at least one `violence_required: false` ending — and the probe
prefers those endings deliberately so that the property is tested rather than assumed.

**A note on what the probe used to do.** Its first version picked `resolutions.find(available)`
and called `resolve`. Resolutions carry their own `requires`, so every rank-3-and-up quest
refused silently and the line reported "requires Q-LEDG-03 first" eight times over — a defect in
the instrument that looked exactly like a defect in the ladder. It also read requirements off
`questDef()`, which is a deliberately trimmed view carrying neither `requires` nor
`consequences`, and so read `{}` for everything and reported `res_kill_her` as non-violent. Both
are fixed and both are commented at the site. **Confirm the instrument can see the thing before
trusting what it says about it.**
