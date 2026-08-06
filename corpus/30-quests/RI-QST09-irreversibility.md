---
id: RI-QST09
title: Irreversibility — mutually exclusive resolutions, the state vector, and what death is allowed to touch
kind: structure
side: morrowind
judges: [quests.resolution.exclusive, quests.state.persistence]
provenance: constructed
confidence: high
blind_pair: no
---

## The bar

These are one subject twice. A choice only closes a door if the door **stays closed**, and world
state only matters if something can permanently change it. A build with beautiful mutually exclusive
resolutions and a save system that quietly rebuilds the world on load has neither; a build with
perfect persistence and no exclusive resolutions has nothing worth persisting.

**Part A — the door.** Morrowind's quests fork into outcomes that cannot both happen. Side with the
Camonna Tong or with the Thieves Guild. Deliver the ledger, copy it, or burn it. Advance in House
Redoran and Hlaalu is closed to you forever. The bar is that **≥ 45% of quests carry at least two
mutually exclusive resolutions**, that exclusivity **reaches outside the quest** — closing other
quests, faction lines, merchants, trainers and transport services — that the player can learn a door
is a door **from something a person or a book said**, never from a UI warning, and that the branches
are **measurably different**: an "exclusive" pair leading to the same flags and the same reward is
cosmetic choice, which is the failure this half exists to catch.

**Part B — the state.** Seam **S6** is unusually precise: *"Drop souls, respawn at last bonfire. But:
quest state, journal, faction standing, and world flags persist untouched — Morrowind owns the
save-state semantics."* Nothing in the corpus has written down **what "quest state, journal, faction
standing and world flags" actually enumerates**, and an unenumerated invariant is not an invariant.
§4 is that enumeration: a **28-element state vector** and, for each of the four transitions that can
touch it — death, rest, save/load, quit and reload — an **exhaustive list of what is allowed to
change**. Anything outside the allowed set is a defect, and the check is a diff, not a judgement.

The test that joins the halves: **kill the quest-giver, die, rest, quit, reload — and the door is
still shut.**

## The reference artifact

### 1. What counts as a closed door

A resolution `R` **closes** something if selecting `R` makes it permanently unreachable. Four kinds,
in ascending order of how much they are worth:

| Kind | Closes | Weight | Example |
|---|---|---:|---|
| **K1 in-quest** | ≥ 1 other resolution of the same quest | 1 | you burned the ledger, so you cannot deliver it |
| **K2 cross-quest** | ≥ 1 *other quest*, in whole or in a branch | 3 | the smuggler you turned in is another quest's only source |
| **K3 faction** | a faction line, rank, or the faction itself | 5 | Wet Ledger membership revokes root-speaking (`RI-TRV01` M5) |
| **K4 world** | a **service**: a merchant, a trainer, a transport line, a shrine, a settlement's safety | 8 | the dye-guild burns, and Archon's cure-potion vendor is gone with it |

**Closure score** of a quest = sum of the weights of everything its resolutions close.
**Irreversibility index** of the game = `closed_forever / (closed_forever + reopenable)` over all
closures.

### 2. The exclusivity bars

Computed over `game/data/quests/*.json` using the fields `quest.schema.json` already defines —
`resolutions[].exclusive_with`, `branches[].irreversible`, `mutually_exclusive_with`,
`consequences.world_flags`. **No new schema fields are introduced by this item**; it is a set of
census bars over the schema `RI-QST04` already owns.

| # | Property | Bar | Fails |
|---|---|---|---|
| **X1** | Quests with ≥ 2 mutually exclusive resolutions | **≥ 45%** | choice as decoration |
| **X2** | Quests with a **K2 or higher** closure | **≥ 12** | exclusivity that never leaves its own file |
| **X3** | Quests with a **K3** closure | **≥ 6** | factions that are hats |
| **X4** | Quests with a **K4** closure | **≥ 3** | a world that never loses anything |
| **X5** | **Irreversibility index** | **≥ 0.85** | a game of redemption arcs |
| **X6** | Declared reopenable closures ("redemption paths") | **≤ 2**, each with a stated price in gold, rank or another closure | the same |
| **X7** | Exclusive branches **differing measurably**: ≥ 3 differing `world_flags`, a differing reward, and ≥ 1 differing world entity (an NPC's state, a service, a route) | **100%** of exclusive pairs | the two-doors-one-room failure |
| **X8** | Exclusive resolutions **foreshadowed in-world** before commitment — a topic, rumour, book, letter or ledger that states the exclusivity | **≥ 80%** | a door you could not have known was a door |
| **X9** | Exclusive resolutions announced by a **UI warning** ("this choice is permanent") | **0** | AR-2, without exception |
| **X10** | Quests whose exclusivity is resolvable **without violence** on at least one branch | **≥ 60%** | exclusivity that is only ever "who do you kill" |

**X9 is absolute.** Morrowind never told you. The Redoran quartermaster told you, or a rumour in a
cornerclub told you, or you found out when the Hlaalu door would not open. A "point of no return"
banner is a modern convenience and it is the same class of error as a quest marker.

**X7 is the one that will be quietly failed.** Two resolutions with `exclusive_with` set, identical
consequences, identical rewards, and one differing line of journal text is a schema that says a
choice happened and a world that does not know one did.

### 3. Worked example — the Archon dye-vats

The template every K4 closure should look like. Not a new quest; an illustration of the shape.

| Resolution | Closes | Kind | World delta |
|---|---|---|---|
| `res_report_guild` — bring the guild's own ledger to the Imperial factor | the harvesters' branch; the naga fence line | K2 | guild fined; **vats stay open**; vat-lung keeps spreading; the factor becomes a trainer |
| `res_burn_vats` — fire the strand at low tide | the guild questline entirely; Archon's cure-potion vendor; the dye trade | **K4** | 3 NPCs leave the province; **Archon loses its only apothecary**; `RI-PRG05` loses a price row; the Crimson Coast's lichen recovers over 6 in-game weeks and the region's palette visibly changes |
| `res_take_the_bribe` | both of the above; the harvesters' trust province-wide | K3 | +900 g; Wet Ledger reputation +2; **every lichen-blind beggar in the region refuses to speak to you, permanently** |

Three resolutions, three different provinces afterwards, one of which is measurably poorer. **The
foreshadowing (X8):** the guild's written denial exists as a readable letter *before* the choice, the
harvesters' cough is audible in the street, and a rumour in Archon says *"the vats or the people,
and the guild has already chosen."*

### 4. The state vector (S6)

28 elements. This is what "quest state, journal, faction standing, and world flags" enumerates, and
every one is `getQuestState()`- or `saveState()`-observable.

| # | Element | Observable via |
|---:|---|---|
| 1 | Active quest ids and their current stage | `getQuestState().active[]` |
| 2 | Completed quest ids and which resolution was taken | `.completed[]` |
| 3 | Failed quest ids and which failure state | `.completed[]` / `.flags` |
| 4 | Journal entries, by index, in order, with text | `.journal[]` |
| 5 | World flags | `.flags{}` |
| 6 | Topics known | `.topicsKnown[]` |
| 7 | Faction membership | `saveState()` |
| 8 | Faction rank, per faction | ″ |
| 9 | Faction reputation, per faction | ″ |
| 10 | Expulsions and their status | ″ |
| 11 | Per-NPC disposition | ″ |
| 12 | Named NPCs alive / dead (**S5**: never respawn) | `listEntities()` + save |
| 13 | Quest-actor "thread severed" states (**S10**) | `.flags` |
| 14 | Merchant gold pools and their inventories | save |
| 15 | Trainer used-counts and limits | save |
| 16 | Container contents, per container | save |
| 17 | Items dropped or moved in the world | save |
| 18 | Owned property, and what is inside it | save |
| 19 | Doors and gates unlocked | save |
| 20 | Shortcuts opened in the 8 loop dungeons | save |
| 21 | HEARTHs discovered / lit | save |
| 22 | Transport nodes **walked to** (`RI-TRV01`'s precondition) | save |
| 23 | Crime: bounty, witnesses, writs, jail served (`RI-CRM01`) | save |
| 24 | Afflictions currently carried (`RI-PRG09`, **A2**) | `getPlayerStats()` |
| 25 | Status proc counts since last rest (`RI-CMB10`) | ″ |
| 26 | Souls total, and the bloodstain (position and amount) | ″ |
| 27 | Level, attributes, skills, skill-use progress | ″ |
| 28 | Main-quest crisis stage (the Rootward Tide) | `.flags` |

### 5. The allowed-diff table — what each transition may touch

**A transition may change the elements marked ✔ and nothing else.** Any other element differing
between the before and after snapshots is a defect. This table is the whole of Part B's method.

| Element group | **Death** | **HEARTH rest** | **Save → load** | **Quit → relaunch → load** |
|---|:--:|:--:|:--:|:--:|
| 1–13 quest, journal, flags, topics, faction, NPC life | — | — | — | — |
| 14–15 merchants, trainers | — | ✔ *(gold pools and stock restock on a declared clock)* | — | — |
| 16–18 containers, dropped items, property | — | — | — | — |
| 19–22 doors, shortcuts, HEARTHs, walked-to nodes | — | — | — | — |
| 23 crime and bounty | — | — | — | — |
| 24 afflictions | — | — | — | — |
| 25 status proc counts | — | ✔ *(reset — `RI-CMB10` §2)* | — | — |
| 26 souls and bloodstain | ✔ *(souls → 0, bloodstain placed; a second death loses the first)* | — | — | — |
| 27 level, attributes, skills | — | ✔ *(level-up happens here)* | — | — |
| 28 crisis stage | — | — | — | — |
| Player position | ✔ *(→ last HEARTH)* | — | — | — |
| HP / stamina / flask charges | ✔ *(restored)* | ✔ *(restored)* | — | — |
| Ordinary enemies (**S5**) | ✔ *(respawn)* | ✔ *(respawn)* | — | — |
| **Named NPCs, quest actors, merchants (S5)** | **—** | **—** | **—** | **—** |
| World clock and tide phase | ✔ *(advances; see below)* | ✔ *(advances)* | — | — |

Three clauses that are easy to get wrong and are called out:

- **Death advances the clock.** Respawning is not a rewind: NPC schedules moved, the tide turned, a
  shop shut. `RI-TRV01:241` already relies on this. What death does **not** do is move anything in
  rows 1–25.
- **Save → load must be a byte-identical state**, not an approximation. The tolerance is zero.
- **The tide phase is derived from the world clock**, so it is not a stored element and must not be
  re-randomised on load. A tide that jumps on load means it was never a clock.

### 6. Persistence invariants

| # | Invariant | |
|---|---|---|
| **P1** | Journal indices are **monotonic per quest**. An index already written is never removed and never renumbered. | |
| **P2** | A completed quest **never reopens**; a failed quest never silently becomes completable. | |
| **P3** | A dead named NPC is **never** replaced, respawned or substituted (**S5**), and their inventory stays where it fell. | |
| **P4** | A world flag, once set, is only cleared by an **explicitly declared** quest consequence — never by a system. | |
| **P5** | The state vector round-trips: `loadState(saveState())` is the identity, and two saves taken at the same frame are **byte-identical**. | |
| **P6** | **Save size grows sub-linearly with play time.** A save that grows without bound is storing history rather than state and will eventually fail to load in a browser (`RI-PLT02`). | |
| **P7** | Version tolerance: a save written by build *n* loads in build *n+1* with a **declared** migration, or is rejected loudly. Silent partial loads are the worst failure in this item. | |

## Comparison method

**M1 — The exclusivity census (static).** `node tools/analysis/content-stats.mjs` plus a walk of
`game/data/quests/*.json`. Build the closure graph: for each resolution, resolve every
`exclusive_with`, `mutually_exclusive_with`, and every `consequences.world_flags` entry that gates
another quest, faction line or service.
- Compute X1–X6. **FAIL** on any bar missed.
- **FAIL** if any `exclusive_with` names a resolution that does not exist, or if exclusivity is
  declared asymmetrically (`A` excludes `B` but not the reverse).

**M2 — X7, the difference test (static).** For each exclusive pair, diff the two resolutions'
`consequences`, rewards and world deltas.
- **FAIL** if fewer than 3 `world_flags` differ, if the rewards are equal, or if no world entity
  differs. Report the list of cosmetic pairs by id — that list is the verdict's single most useful
  artifact.

**M3 — X8/X9, foreshadowing (static + harness).** For each exclusive resolution, search
`game/data/dialogue/**`, `books/`, `rumours.json` and the quest's own `directions` and `deceit` block
for a text that states the exclusivity, and check it is reachable **before** the commit journal index.
- **FAIL** if coverage < 80%.
- Run the game to the commit point and capture the screen. **FAIL** if any UI element warns the player
  the choice is permanent (**X9**, AR-2, zero tolerance).

**M4 — X10, non-violent exclusivity (static).** **FAIL** if fewer than 60% of exclusive quests have a
`violence_required: false` branch on at least one exclusive resolution. Cross-check the total against
`RI-QST05`'s ≥ 45% non-combat bar; a contradiction between the two is a corpus defect to file.

**M5 — The four transitions (harness, the core check).** Scenario `qst-persistence`: a seeded save at
a mid-game state with ≥ 6 active quests, ≥ 3 faction memberships, a bounty, an affliction, a dead
named NPC, an opened shortcut, and moved items.
For each transition — **death**, **HEARTH rest**, **save→load**, **quit→relaunch→load**:
1. `saveState()` + `getQuestState()` before.
2. Perform the transition.
3. `saveState()` + `getQuestState()` after.
4. Structural diff over all 28 elements.
- **FAIL** on any element differing that §5 does not mark ✔ for that transition.
- **FAIL** if a marked element does **not** change (souls must actually drop; enemies must actually
  respawn; the clock must actually advance).
- Report the diff verbatim. **An empty diff on save→load is the pass condition and nothing weaker.**

**M6 — Invariants P1–P5 (harness).** Over a 3-hour scripted playthrough with 40 save/load cycles at
random points: assert journal monotonicity, no quest reopening, no named-NPC respawn, no flag
cleared without a declared consequence, and `loadState(saveState())` identity.
- **FAIL** on a single violation. **FAIL** if two saves at the same frame are not byte-identical.

**M7 — P6/P7 (harness).** Save every 10 minutes across the 3-hour run; plot size against play time.
- **FAIL** if growth is super-linear, or if the final save exceeds `RI-PLT02`'s ceiling.
- Load each save under a build with one added quest field. **FAIL** on a silent partial load; a loud
  rejection passes.

**M8 — The joined test.** Kill a quest-giver mid-quest (**S10**). Then: die, rest, quit, relaunch,
load.
- **FAIL** if the "thread of prophecy severed" state is not present in all five snapshots; if the
  quest becomes completable again; if the NPC returns; or if any exclusive resolution the death closed
  becomes selectable.

## Scoring

| Check | Weight | Pass condition |
|---|---:|---|
| M1 exclusivity census X1–X6 | 16 | all bars met, graph well formed |
| **M2** X7 difference test | **16** | zero cosmetic exclusive pairs |
| M3 X8/X9 foreshadowing | 12 | ≥ 80% foreshadowed, **0** UI warnings |
| M4 X10 non-violent branches | 6 | ≥ 60% |
| **M5** the four transitions | **28** | exact diff against §5, both directions |
| M6 invariants P1–P5 | 12 | zero violations over 40 cycles |
| M7 save size and version tolerance | 6 | sub-linear, no silent partial load |
| M8 the joined test | 4 | the door stays shut through all five |

- **≥ 88** — choices are permanent and the world remembers them.
- **75–87** — playable, gap named.
- **< 75** — **we lose.**

**Automatic fail regardless of score:**
- Any element in rows 1–25 changing on **death** (**S6**, and it is the seam this item is written to
  enforce).
- A named NPC, quest actor or merchant respawning (**S5**).
- A UI warning that a choice is permanent (**X9**, AR-2).
- A non-empty diff on **save→load**.
- A silent partial load on a version mismatch (**P7**).
- A completed quest becoming active again, or a journal index being renumbered.
- Any "undo" mechanism for an exclusive resolution beyond the ≤ 2 declared redemption paths.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 75 / 100 | 85 / 100 | 93 / 100 |

**Aggregation (a property of this item, not of the critic):** weighted-sum of passed check weights, max 100 (we-lose floor 75).

## How we lose

1. **Reload-on-load reconstruction.** The world is rebuilt from quest definitions on load and the
   *deltas* — a moved crate, a dead shopkeeper's dropped ring, an opened shortcut — are silently
   dropped. Everything important survives, so it passes casual testing; the world stops being a place
   you have touched. M5's zero-tolerance diff is the only instrument that sees it.
2. **Death as a rewind.** Respawn restores HP, and also restores the enemy you had nearly killed, and
   also restores the door you had opened, and also un-drops the item you had dropped. Each of these is
   one line of "reset the level", and together they gut S6.
3. **Named NPCs respawning with the ordinary ones.** The respawn pass takes the whole entity list.
   S5's exemption is one filter, and it will be forgotten once.
4. **Cosmetic exclusivity.** `exclusive_with` set on two resolutions that produce the same flags and
   the same reward, because it satisfies the schema and the census. It passes X1 and fails X7, and it
   is the single most likely way this item is gamed.
5. **The "point of no return" banner.** Added in playtesting because someone lost a faction. It is
   the most sympathetic possible reason to fail AR-2 and it is still AR-2. The fix is a rumour, not a
   modal.
6. **All exclusivity is who-you-kill.** Every fork is "side with A and kill B". X10 exists because a
   quest resolvable by talk that *also* closes a door is worth three that are not.
7. **Redemption creep.** A quest is added that lets you rejoin the faction you betrayed. Then another.
   The irreversibility index slides from 0.9 to 0.4 over a wave and nobody notices because each
   addition was reasonable. X5 and X6 are the ratchet.
8. **Flags cleared by a system.** A cleanup pass that garbage-collects "stale" flags, an optimisation
   that trims the flag table, a migration that drops unknown keys. P4 and P7 exist for this, and it is
   the failure most likely to be introduced *after* the item passes.
9. **The save grows forever.** Every journal entry, every moved object, every disposition delta
   appended, never compacted; hour 15 takes 4 seconds to load in a browser and hour 30 does not load
   at all. `RI-PLT02` owns the ceiling; P6 owns the shape.
10. **The tide re-randomises on load.** Small, cosmetic-looking, and it is proof that the world clock
    is not the source of truth — which means `RI-TRV01`'s schedules and `RI-WLD08`'s ambient events
    are not either.

## Provenance note

- **`constructed`, confidence high.** The K1–K4 closure taxonomy, the closure score, the
  irreversibility index, every bar X1–X10, the 28-element state vector, the allowed-diff table and
  the invariants P1–P7 are ours. High confidence because every one of them is a **diff or a count over
  data we already require**, not a judgement: M5 in particular is a structural diff with a zero
  tolerance, which is the strongest kind of check this corpus can write.
- **Cited, not redefined:** **S6** (death touches souls and position, never quest state), **S5**
  (named actors never respawn), **S10** (thread-of-prophecy-severed), **S15** (gold is the currency a
  redemption path may cost), and **AR-2** (no modern conveniences) — all `ARBITRATION.md`. The quest
  schema and every field this item counts are `RI-QST04` / `corpus/30-quests/quest.schema.json`;
  **no new schema field is introduced here**. The ≥ 45% non-combat resolution bar is `RI-QST05`'s and
  M4 cross-checks against it rather than restating it. The death loop, bloodstain rules and what a
  HEARTH rest does are `RI-PRG04` §6. Save/load as a *player journey* is `RI-JRN05`, returning after
  a week is `RI-JRN08`, and both are cited rather than duplicated — this item owns the **state vector
  and the allowed-diff table**, which neither of them defines. Faction rivalry locks are
  `RI-QST03`; merchant gold pools are `RI-PRG05`; the walked-it-once precondition is `RI-TRV01`;
  afflictions' permanence is `RI-PRG09` A2; proc counts are `RI-CMB10` §2; the save-size ceiling is
  `RI-PLT02`.
- **`canonical-recall`, confidence medium:** that Morrowind's Great House lines lock each other, that
  the Camonna Tong / Thieves Guild opposition closes content, and that Morrowind never warned you
  before an irreversible choice. These shape §2's bars and are **not** cited as numbers; the X1–X10
  thresholds are ours and were not derived from a census of Morrowind's quests. A successor with
  budget should compute the real figures from
  `corpus/30-quests/data/morrowind-quest-census.json` and either confirm X1's 45% or amend it — that
  is the single most valuable follow-up to this item.
- **Unverifiable, correctly declared:** the 0.85 irreversibility index, the ≤ 2 redemption paths, the
  80% foreshadowing coverage and the K1–K4 weights. Binding because measurable.
