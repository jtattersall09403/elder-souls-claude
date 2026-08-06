---
id: RI-QST03
title: Faction gating — rank requirements, exclusivity, expulsion, lockout
kind: structure
side: morrowind
judges: [quests.faction.gating, progression.faction.rank, progression.skills, quests.faction.exclusivity, world.factions]
provenance: community-data
confidence: medium
blind_pair: no
---

## The bar

Per ARBITRATION §1, faction gating is **Morrowind-authoritative**: rank requirements, skill+attribute
thresholds, rivalry locks, and expulsion. The bar is that a player who wants the next rank looks at a
requirement table and sees *which specific skills and attributes they must raise*, plus a reputation
figure earned only by doing the faction's work — never a character level, never a soul count, never a
quest counter alone. Advancement is therefore a **build statement**: you cannot lead the assassins with
a heavy-armour brawler's sheet, and the game says so in numbers before you fail. Membership is scarce:
joining one Great House closes the others permanently, and some jobs foreclose whole guilds without
warning (RI-QST02 D8). Expulsion is real, readmission is finite and priced differently per faction, and
being locked out leaves content permanently unreachable in that save. A game where the player can hold
every rank in every faction has no faction system; it has a checklist.

## The reference artifact

### A. The Morrowind requirement format (the shape we must match)

Every rank in a Morrowind faction is gated on four things simultaneously:

```
rank_n requires:
  faction_reputation >= R_n            # earned only from that faction's quests
  attribute[primary]  >= A_n           # one of the faction's two favoured attributes
  skill[favoured_1]   >= S1_n          # the "primary" skill threshold (the high one)
  skill[favoured_2]   >= S2_n          # a second favoured skill (the low one)
```

Each faction declares **2 favoured attributes** and **6 favoured skills**. Any of the favoured skills
may satisfy the S1/S2 slots, which is why the same rank can be reached by different builds — Fighters
Guild advancement, for example, needs the favoured attributes around 33–34 and one skill at 70–80 by the
top of the ladder, but *which* skill is the player's choice among Axe, Long Blade, Blunt Weapon, Heavy
Armor, Armorer and Block [1]. House Hlaalu's favoured skills are Speechcraft, Mercantile, Marksman,
Short Blade, Light Armour and Security [7] — a different sheet entirely, which is the point.

Observed Morrowind properties, `community-data` / `canonical-recall`:

| Property | Morrowind | Note |
|---|---|---|
| Ranks per faction | 8–10 (index 0–9) | Fighters Guild snippet lists 8 named ranks to Guardian [1]; recall extends to Champion/Master |
| Quests per rank | "typically two or three" [7] | matches our 3.0 mean target (RI-QST01) |
| Attribute ceiling at top rank | ~33–34 for Fighters Guild favoured attributes [1] | low absolute numbers; the *breadth* is the gate, not the height |
| Skill ceiling at top rank | 70–80 in one favoured skill [1] | one deep skill, not six |
| Councilman-tier exception | "The rank of Councilman doesn't require 80 in a skill" [7] | political ranks trade skill for standing |
| Non-stat gate example | Hlaalu Kinsman must build a stronghold before advancing [7] | a *world-state* requirement, not a stat |
| Reputation source | faction quests | Fighters Guild is a known defect: its quests award no reputation [1] — do not copy |

### B. The requirement table format we must match (constructed, binding)

Every joinable faction ships exactly one table in this format, and the UI must be able to render it
verbatim. 8 ranks, index 0–7. `—` means no requirement.

**Format specification** (columns are fixed; any faction table missing a column is out of spec):

| Rank | Rank name | Faction rep | Primary attr (either of 2 favoured) | Favoured skill #1 | Favoured skill #2 | World-state requirement |
|---:|---|---:|---:|---:|---:|---|
| 0 | *Initiate* | 0 | — | — | — | — |
| 1 | *Sworn* | 10 | 22 | 20 | 5 | — |
| 2 | *Hand* | 22 | 24 | 25 | 10 | — |
| 3 | *Confidant* | 36 | 26 | 32 | 15 | — |
| 4 | *Blooded* | 52 | 28 | 40 | 20 | — |
| 5 | *Named* | 70 | 30 | 50 | 25 | one faction-specific world state (a holding, a shrine, a debt paid) |
| 6 | *Councillor's Voice* | 90 | 32 | 60 | 30 | resolved a `politics` quest in the faction's favour |
| 7 | *Seat* | 112 | 34 | 70 | 35 | the incumbent's seat is vacant by the player's action |

Notes binding on all factions:
- Rank *n* requires **all** of: reputation, one of the two favoured attributes at the listed value, and
  two *distinct* favoured skills at the listed values. The player picks which favoured skills.
- Reputation deltas per quest are +4 to +10; the R-column deltas above (10/12/14/16/18/20/22) assume
  roughly 3 quests per rank at ~+5 with slack. **Every faction quest must award reputation** — the
  Morrowind Fighters Guild defect [1] is explicitly rejected.
- The rank-6 political tier may substitute **standing for skill**: a faction may reduce Favoured skill #1
  by up to 15 at rank 6 only, in exchange for an additional world-state requirement (this is the
  Councilman exception [7], generalised).
- **No rank may reference character level, souls, gold-on-hand, or a raw quest counter.** Gold may
  appear only in readmission fees, never in advancement.

### C. Exclusivity rules (constructed, modelled on Morrowind)

| Rule id | Type | Rule | Morrowind analogue |
|---|---|---|---|
| X1 | Hard exclusivity | The three Great-House-analogue factions are mutually exclusive. Joining one sets `locked_out` on the other two **permanently, at join time, with an in-fiction warning spoken by the recruiter** | You can only join one Great House and cannot undo it [6] |
| X2 | Soft exclusivity (earned) | Two guild-tier factions are compatible **until** a specific quest in either line is completed, after which the other is closed | Fighters Guild "Code Book" closes the Thieves Guild [5] |
| X3 | Mediated escape | For every X2 quest there must exist a dissenter-mediated alternate resolution that satisfies the giver without triggering the lock | Percius Mercius' alternates [1][5] |
| X4 | Enemy-pair | Two factions are permanent enemies: membership in one makes the other's members hostile-on-sight and its quests unavailable, no join step required | Morag Tong ↔ Dark Brotherhood [6] |
| X5 | Rank ceiling | A player who is a member of a rival-but-compatible faction is capped at rank 5 in each; ranks 6–7 require sole allegiance, requested explicitly in dialogue | Great House politics; generalised |
| X6 | No overlap laundering | A faction's reputation may never be earned by another faction's quests | Morrowind default |

**Reachability invariant:** the union of all factions reachable in a single save must be a *strict
subset* of the total. Target: a maximally greedy single save reaches **≤ 60%** of all faction quests.

### D. Expulsion and readmission (constructed; Morrowind-derived tiers)

Morrowind's observed behaviour: most factions reinstate once for free and expel permanently on a second
offence; the Thieves Guild tolerates up to five offences but charges heavily to rejoin; House Hlaalu
readmits unlimited times for a fee; House Telvanni readmits unlimited times for free; the Morag Tong
offers no second chance and requires seeking a Master-rank member and raising the topic *make amends*
[6][9].

Our expulsion model:

| Trigger | Applies to |
|---|---|
| E1 Theft from a faction member or faction-owned container, witnessed | all |
| E2 Killing a faction member | all |
| E3 Failing a quest in a way flagged `recoverable: false` with a faction consequence | all |
| E4 Completing a rival faction's X2/X4 quest | X2/X4 pairs |
| E5 Assaulting a faction NPC (no death) | all, on second offence |

| Faction tier | Offences tolerated | Readmission | Cost | On permanent expulsion |
|---|---:|---|---|---|
| Martial guild | 1 | speak to any rank ≥ 5 member, topic `make amends` | 0 gold, −1 rank | quests unavailable; members refuse dialogue beyond greeting; rank retained as a *former* title |
| Thieves-tier | 5 | speak to any rank ≥ 4 member | 200 × current rank gold | as above, plus fences refuse service |
| Merchant House | unlimited | speak to any rank ≥ 6 member | 500 × current rank gold | n/a |
| Wizard House | unlimited | speak to any rank ≥ 6 member | 0 gold ("we do not care") | n/a |
| Assassin order | 0 | none | — | contract taken out on the player: a named hunter NPC spawns and pursues |
| Religious order | 1 | pilgrimage quest (non-combat, unfailable) | 0 gold | shrine services refused game-wide |

**Lockout consequences (what the player actually loses):** faction-only merchants and trainers; the
faction's stronghold/holding; 3–7 unique named rewards per faction (RI-QST08); the faction's rumour
layer in dialogue; and the faction's stance in the main quest's Act IV leverage step (RI-QST06). Lockout
must be *legible*: a locked faction's members still speak one line explaining why they will not deal
with the player, and the journal records the expulsion in first person on the day it happens.

## Comparison method

Requirement tables live in `game/src/data/factions/*.json`; quests in `game/src/data/quests/*.json`.

1. **Every joinable faction has a complete 8-row table with all six requirement columns:**
   ```
   jq -s 'map({id, ranks: (.ranks|length),
               bad_rows: [.ranks[] | select(
                   (.reputation == null) or (.attribute == null) or
                   ((.skills // []) | length) < 2)] | length,
               forbidden: [.ranks[] | select(has("level") or has("souls") or has("quest_count"))] | length})' \
      game/src/data/factions/*.json
   ```
   **Hard fail** if any `forbidden > 0` (level/soul gating — also an AR-2 violation), if `ranks != 8`,
   or if `bad_rows > 0` for ranks ≥ 1.
2. **Monotonic thresholds:** assert reputation, attribute and both skill columns are strictly
   non-decreasing across rank 1→7, with the single permitted exception of Favoured skill #1 at rank 6
   (the Councilman exception), which may dip by ≤ 15 only if that rank has a non-empty
   `world_state_requirement`.
3. **Favoured-skill coherence:** each faction declares 6 favoured skills and 2 favoured attributes; every
   skill named in any rank row must be in that faction's favoured set, and no two factions may share
   more than 3 favoured skills (otherwise the build statements collapse into one).
4. **Reputation is earnable:** for each faction, sum the positive self-deltas available across its quests:
   ```
   jq -s 'map(select(.faction != null))
          | group_by(.faction)[]
          | {faction: .[0].faction,
             earnable: (map(.consequences.faction_reputation[.faction] // 0) | add)}' \
      game/src/data/quests/*.json
   ```
   **Hard fail** if `earnable` for any faction is less than that faction's rank-7 reputation requirement
   — the ladder must be completable — and also **hard fail** if `earnable == 0` (the Fighters Guild bug).
   Warn if `earnable > 1.6 ×` the rank-7 requirement (too much slack means gating is decorative).
5. **Exclusivity actually bites:** compute the greedy-maximal reachable quest set. Build the lock graph
   from `consequences.locks` plus faction-level `exclusive_with`, then:
   ```
   jq -s '[.[] | select(.category=="faction")] | length' game/src/data/quests/*.json
   ```
   and compare against the reachable count from a solver over the lock graph. **Fail if the maximum
   single-save reachable fraction is > 75%**; target ≤ 60%. If it is 100%, the faction system is
   cosmetic.
6. **X3 escape hatches exist:** every quest listed in an X2 pair must have ≥ 2 resolutions, one of which
   does not populate `consequences.locks`:
   ```
   jq -s 'map(select((.consequences.locks // []) | length > 0))
          | map({id, resolutions: (.resolutions|length)})
          | map(select(.resolutions < 2))' game/src/data/quests/*.json
   ```
   Should return `[]` for X2 quests (X1 join-time locks are exempt and are not quests).
7. **Expulsion is implemented, not documented:** grep the faction data for `expulsion` config with
   `offences_tolerated`, `readmission`, and `on_permanent`, one entry per faction; assert the assassin
   tier's `on_permanent` names a spawned pursuer NPC id that exists in the NPC data.

## Scoring

| Band | Condition |
|---|---|
| 9–10 | 8-rank tables, all four gate types per rank, favoured sets distinct, reputation earnable and tight, single-save reachability ≤ 60%, expulsion + readmission + lockout all implemented with in-fiction messaging |
| 7–8 | Tables complete and skill-gated, exclusivity implemented, expulsion implemented but readmission uniform across factions |
| 5–6 | Skill+attribute+reputation gating present but exclusivity is advisory (player can join everything) |
| 3–4 | Reputation-only gating; skills unreferenced |
| 0–2 | Level gating, or "complete 3 quests to advance" |

**Hard fails:** any rank row referencing character level or souls; any faction whose quests award zero
reputation; single-save reachability of 100%; no expulsion path at all.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 | 6 / 10 | 8 / 10 |

**Aggregation (a property of this item, not of the critic):** band.

## How we lose

- **Level gating by accident.** Someone will implement "you must be level 12 for rank 5" because it is
  one integer instead of six, and it is the single most Skyrim thing we could do. It is an AR-2
  auto-fail and the jq check for a `level` key exists solely to catch it.
- **Quest-counter gating.** "Complete 3 quests → next rank" with the skill table shipped as a tooltip
  that does not gate anything. The requirement exists in the data and is never evaluated.
- **Everyone joins everything.** Exclusivity is written into the corpus and then softened in
  implementation because playtesters complain about missing content. The reachability check is the
  defence; the number to watch is 100%.
- **Expulsion with no teeth.** We implement the expelled flag and then let the player rejoin instantly
  by talking to the same NPC, or worse, we never write the expulsion triggers so nothing can expel you.
  Symptom: `offences_tolerated` present in data, no code path sets the counter.
- **Uniform readmission.** All six factions readmit identically, deleting the characterisation that the
  Telvanni analogue does not care, the merchant house sells absolution, and the assassins hunt you.
- **Favoured-skill mush.** All four factions favour Long Blade, Block and Athletics because those are the
  skills we implemented first. Then rank requirements do not express a build at all, and the check on
  ≤ 3 shared skills fails.
- **Silent lockout.** The player is quietly locked out and finds out forty hours later on a wiki. The
  Morrowind version is also silent *in advance* (D8) — but it is loud *after*: the journal records it and
  members tell you why they will not speak to you. Ours will be silent in both directions.
- **Unreachable ranks.** We set rank-7 reputation at 112 and ship 90 points of earnable reputation. The
  earnable-sum check catches this; without it, no one notices until a completionist does.
- **Gold-gated advancement.** Bribing your way to rank 6 because gold is the only currency
  (ARBITRATION S15) and it is easy to wire up. Gold buys readmission, never rank.

## Provenance note

- `community-data`, verified by search this session: Fighters Guild favoured skills (Axe, Long Blade,
  Blunt Weapon, Heavy Armor, Armorer, Block), favoured attributes (Strength, Endurance), the ~33–34
  attribute and 70–80 skill ceilings, and the note that Fighters Guild quests award no reputation [1];
  House Hlaalu favoured skills, "two or three quests per rank", the Councilman skill exception and the
  Kinsman stronghold requirement [7]; single-Great-House membership and the joinable/unjoinable faction
  list [6]; readmission tiers — reinstated once free by default, Thieves Guild 5 offences with a heavy
  fee, Hlaalu unlimited for a fee, Telvanni unlimited free, Morag Tong none and the `make amends` topic
  requiring a Master-rank member [6][9].
- `canonical-recall`, `confidence: medium`: exact rank counts per faction (8–10) and rank names; the
  precise per-rank numeric thresholds in Morrowind's own tables, which are **not** reproduced here —
  section B's numbers are ours, not Bethesda's.
- **Sections B, C and D are `constructed`.** The Morrowind material establishes the *format* (four
  simultaneous gate types, favoured-skill choice, world-state requirements, tiered readmission); the
  numbers, the 8-rank ladder, the X1–X6 rules and the expulsion tiers are set by us and are binding.
- Direct fetches to uesp.net / fandom were refused by egress policy (403 at proxy); cited content is
  from search summaries of those pages. Re-derive with real page access to raise confidence to high —
  in particular, Morrowind's actual per-rank threshold tables should be transcribed into an appendix.

**Sources**
[1] [Morrowind:Fighters Guild — UESP](https://en.uesp.net/wiki/Morrowind:Fighters_Guild) ·
[5] [How to avoid the Morrowind Fighters Guild/Thieves Guild trap — UESP Forums](https://forums.uesp.net/viewtopic.php?f=5&t=41596) ·
[6] [Morrowind:Factions — UESP](https://en.uesp.net/wiki/Morrowind:Factions) ·
[7] [Morrowind:House Hlaalu — UESP](https://en.uesp.net/wiki/Morrowind:House_Hlaalu) ·
[9] [Getting back into factions once you have been expelled — Neoseeker](https://www.neoseeker.com/forums/3222/t281441-getting-back-into-factions-once-you-have-been-expelled/)
