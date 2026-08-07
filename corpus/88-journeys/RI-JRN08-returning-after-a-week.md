---
id: RI-JRN08
title: Returning after a week — can a cold player rebuild their own intentions from in-game information alone?
kind: structure
side: morrowind
judges: [journey.reentry.orientation, journal.entry.voice, journal.navigation.nomarkers]
provenance: constructed
confidence: high
blind_pair: yes
---

> **This item judges a JOURNEY, not a subsystem.** It is one of eight in `corpus/88-journeys/`.
>
> **Division of labour, binding:** `RI-JRN05` owns whether the state **survives**; this item
> assumes it does and asks whether the *player* survives. `RI-DLG05`/`journal.entry.voice` own
> how a journal entry is written; this item owns whether the journal, **read as a whole, cold**,
> reconstitutes a player's intentions. `RI-JRN07` owns a single quest's chain end to end; this
> item owns the state a player is in when **nine** quests are half-done and none of them are in
> their head. `RI-WLD06` owns navigation; this item owns whether the player still knows where
> they were going.
>
> **This is the item that pays for `RI-JRN07`.** A game with no markers is a promise that the
> world will carry the information instead. That promise is cheap to keep for ten minutes and
> expensive to keep across a week, and no other item in the corpus tests the expensive case.
>
> **Subsystem paths pending taxonomy registration** — see `corpus/88-journeys/paths-requested.json`.

## The bar

A player put the game down eleven days ago at hour fourteen. They had nine active quests, two
faction lines mid-escalation, a bounty in one city, a disease they meant to cure, a rumour they
meant to follow, a locked door they meant to come back to with a better lockpick, a merchant
they had promised something to, and a plan they never wrote down. They open the tab and click
`Continue`.

**Within five minutes, without leaving the game, they must be able to answer: what was I doing,
why, where was I going, and what is the very next physical thing I should do.** Not by reading a
"previously on" screen — there is no such thing, it is a marker with more words. By reading
their own journal, checking their inventory, looking out of the window at a landmark they
recognise, and asking the nearest person about a topic they already know.

This is what Morrowind's journal is *for*. It is not a quest tracker; it is a record kept by a
person who expected to need it later. The bar is that the record is sufficient.

And there is a negative half, because the obvious fix is worse than the problem: **a
recap, a "current objective" panel, a highlighted next step, or a quest sorted to the top with a
"TRACKED" badge are all AR-2 failures**, and adding one is how this item gets passed without
being met.

## The reference artifact

### A. `ES/COLD` — the reference save (BINDING)

The test is only meaningful from a state that is genuinely tangled. The critic uses a **fixed,
version-controlled save** at `game/data/testing/cold-save-hour14.json`, produced by an agent
playing normally (not scripted) and committed. Its required properties:

| Property | Value |
|---|---|
| Playtime | 13.5–15.0 in-world hours |
| Active quests | **≥ 9**, of which ≥ 3 are mid-stage (not "go and start it") |
| Completed quests | ≥ 12 |
| Faction lines in progress | ≥ 2, at rank ≥ 2, with ≥ 1 rivalry lock already tripped |
| Journal entries | **≥ 55** |
| Topics known | ≥ 80 |
| Outstanding bounty | ≥ 1 jurisdiction, non-zero |
| Active affliction | ≥ 1 disease with incubation remaining |
| Deferred obstacles | ≥ 2 (a locked door, a hostile too strong, a river uncrossable without a spell) |
| Player position | **In the wilderness, ≥ 8 walk-minutes from any settlement, at night** — not conveniently parked in an inn |
| Unresolved social debt | ≥ 1 NPC owed something |
| Bloodstain | present, ≥ 2,000 souls, ≥ 3 walk-minutes away |

**Rule C1.** The save is committed and its hash recorded. A run against a different save is not
comparable and its verdict is void. The position clause matters: waking up in an inn hands the
player a settlement full of information, and a save that starts there measures the easy case.

### B. What the game must carry (BINDING)

The player's memory is gone. Everything below must exist **inside the fiction**.

| Id | Carrier | Requirement |
|---|---|---|
| **W1** | **The journal** | Numbered, dated, first-person, append-only. **Filterable by quest**, and the filter is a physical affordance (tabs on a book, an index page), not a "tracked quest" list. Reading the most recent entry of each active quest must be possible in **≤ 3 inputs per quest** |
| **W2** | **The journal carries directions** | Every active quest's most recent entry contains, verbatim, the prose directions the player was given (`RI-WLD06` L3, `RI-JRN07` U2). **This is the single most load-bearing requirement in the item**: if the directions were spoken and not written down, the returning player has lost them |
| **W3** | **The journal carries intent, not status** | Entries are what the character decided and believed, including things that turned out to be wrong. An entry that was true when written and is false now **stays**; a later entry corrects it. **Retroactive editing of journal entries is a hard fail** — it destroys the only record of what the player thought |
| **W4** | **Topics known persist and are browsable** | The player can see the list of topics they have learned, in-fiction (a commonplace book / a list of "things I have been told about"), and asking a known topic works with any NPC who has an answer |
| **W5** | **Inventory is self-describing** | Every quest item's description states **who gave it and for whom**, in prose. A "Sealed Reed-Case" whose description is "A sealed case" has lost a quest |
| **W6** | **The world is the map** | The player can reorient by looking: `RI-WLD06` L1 guarantees ≥ 2 landmarks visible from 95% of walkable points. From the cold save's position, ≥ 2 must be visible **at night**, which is a stricter condition and is checked here |
| **W7** | **NPCs remember** | Any NPC with an outstanding obligation to or from the player says so in their greeting (`dialogue.greeting.variation`), unprompted, once |
| **W8** | **Deferred obstacles are re-findable** | A locked door the player could not open is recorded in the journal **only if the player wrote about it** — i.e. only if a journal entry was generated by the attempt. If attempting a locked door generates nothing, the obstacle is unrecoverable and W8 fails |
| **W9** | **The bounty is legible** | The player can discover they are wanted, where, and for how much, from an in-world source (a guard's greeting, a notice board, a faction contact) without a UI counter |
| **W10** | **The affliction is legible** | The disease is named, its symptoms are described in the character's own state surface in prose, and a cure exists that an NPC will name |
| **W11** | **No recap** | No "previously", no "current objective", no tracked-quest pin, no highlighted entry, no sorting by relevance, no "resume quest" button. **The journal is in the order it was written, always** |
| **W12** | **The bloodstain is findable** | Its position is recoverable from the journal or from memory of the place, not from a marker (`RI-JRN06` D14/M-D18) |

### C. The five-minute budget (BINDING)

| Id | Quantity | Target | Fail |
|---|---|---|---|
| **O1** | `T_orient` — `Continue` clicked → the player states a specific next physical action | ≤ **5 min** | > 10 min |
| **O2** | `T_first_move` — → first purposeful movement toward a destination they can name | ≤ **7 min** | > 12 min |
| **O3** | `quests_recalled` — active quests the returning player can describe by objective **and** by why they took it | ≥ **6 of 9** | ≤ 3 |
| **O4** | `directions_recovered` — active quests with a destination for which the player can quote a route from the journal | ≥ **80%** | < 50% |
| **O5** | `inputs_to_orient` — total inputs from `Continue` to O1 | ≤ **40** | > 90 |
| **O6** | `surfaces_used` — distinct in-game surfaces consulted (journal, inventory, topic list, character state, map item) | 2–5 | 1 (they used a recap) or > 6 (they hunted) |
| **O7** | `out_of_game_lookups` | **0** | ≥ 1 |
| **O8** | `wrong_reconstructions` — things the player believes about their state that are false | ≤ **1**, and none load-bearing | ≥ 3, or any that sends them to the wrong region |
| **O9** | `obligation_surprises` — outstanding obligations (bounty, debt, disease, rivalry lock) the player discovers only by being punished for them | ≤ **1** | ≥ 3 |
| **O10** | `journal_read_depth` — entries read before O1 | 5–25 | > 40 (the journal is not navigable) |

**O6's lower bound is the interesting one.** A player who orients using exactly one surface has
almost certainly been handed a recap; a player who needs six is hunting because no single
surface was sufficient. Two to five is the shape of somebody reading their own notes.

## Comparison method

Run by `critic.journal` with `critic.quests` co-signing (fleet critic **JC-08**). **The naive
pass is the item**; the instrumented pass measures the carriers.

```bash
node tools/journey/journey-run.mjs --journey jrn08-return --seed 4711 \
     --state game/data/testing/cold-save-hour14.json --input-mode real \
     --wall-clock-advance 11d --out reports/journeys/<runId>
```

Requires **`A-JRN1`**, **`A-JRN3`** (loading the committed save), **`A-JRN7`**, **`A-JRN13`**
(dialogue/topic state as presented) and **`A-JRN10`** (`advanceWallClock(ms)` — so that
time-dependent state such as disease incubation, merchant restocking and scheduled world events
are in the state a real eleven-day absence would produce, and so that any "welcome back"
behaviour keyed on real elapsed time is exercised). Until they exist every check is
`unmeasurable` and scores **0**, fail-closed.

| # | Check | Procedure | Threshold |
|---|---|---|---|
| **M-R1** | **Save integrity** | Load the committed save; `getStateHash()` against the recorded hash | Exact. If it differs, **stop** — this is a `RI-JRN05` failure and this item is unmeasurable until it is fixed |
| **M-R2** | **Journal navigability (W1)** | For each active quest, count inputs from the journal's opening state to its most recent entry | ≤ 3 per quest, 9/9 |
| **M-R3** | **Directions in the journal (W2)** | For every active quest with a destination, assert the most recent entry contains the verbatim direction prose | **100%**. **Hard fail: < 80%** — this is the item's central requirement |
| **M-R4** | **Journal immutability (W3)** | Diff every journal entry's text between the save and a state produced by replaying the same actions | **0** entries changed after being written. **Hard fail: any retroactive edit** |
| **M-R5** | **No recap (W11)** | Screenshot the first 30 s after `Continue`; enumerate surfaces and text | **0** recap panels, objective summaries, tracked-quest pins, "resume" affordances, or reordered/highlighted entries. **Hard fail: any** — AR-2 |
| **M-R6** | **Topic list (W4)** | Open the topics surface; count entries; ask 10 known topics of 3 NPCs | Present, ≥ 80 entries, ≥ 24/30 give an answer |
| **M-R7** | **Item self-description (W5)** | Read every quest item's description | 100% name the giver and the intended recipient in prose |
| **M-R8** | **Night landmarks (W6)** | From the save position, at that time of day, run `RI-WLD06` M27's fan at the actual fog and light | ≥ **2** distinct landmarks identifiable. **This is stricter than `RI-WLD06`'s daytime bar and is this item's own check** |
| **M-R9** | **NPC memory (W7)** | Visit every NPC with an outstanding obligation; capture the greeting | 100% mention it unprompted, once |
| **M-R10** | **Obstacle records (W8)** | For the ≥ 2 deferred obstacles, assert a journal entry exists that was generated by the attempt | 2/2 |
| **M-R11** | **Bounty legibility (W9)** | With no UI counter available, determine the bounty from in-world sources only | Discoverable in ≤ 3 min; amount and jurisdiction correct |
| **M-R12** | **Affliction legibility (W10)** | Read the character state surface | Disease named; symptoms in prose; ≥ 1 NPC names a cure |
| **M-R13** | **Bloodstain recovery (W12)** | From the cold save, recover the bloodstain | Recovered; **0** markers used (`RI-JRN06` M-D19) |
| **M-R14** | **Marker sweep** | `RI-WLD06` M31 over the whole session | **0** (AR-2, hard fail) |
| **M-R15** | **Cold-boot honesty** | Run the whole test in a **fresh browser profile** with the save imported via `RI-JRN05`'s import path | Completes. Recorded in the artifact or the measurement is void (`RI-JRN01` "How we lose" #13) |

### Naive pass (isolation: `enforced`) — the item

Fleet role **JC-08N**. **This agent must never have played this build.** It receives: the URL,
the cold save loaded, the driver protocol, and one sentence: *"This is your character. You last
played eleven days ago. Work out what you were doing and get on with it."*

It receives **no corpus, no quest list, no map, no journal export, no summary**. It is asked,
verbatim, at the moment it declares itself oriented, and again at 30 minutes:

1. *"What were you doing? List everything you had going on."*
2. *"For each one, where were you going next, and how do you know?"*
3. *"Why did you take each of these on? Which one do you actually care about?"*
4. *"Is there anything hanging over you — someone you owe, somewhere you can't go, something
   wrong with you?"*
5. *"Where are you standing right now, and how do you know?"*
6. *"What is the very next physical thing you are going to do?"*
7. At 30 min: *"Did anything turn out to be different from what you thought? What, and how did
   you find out?"*

| # | Check | Threshold |
|---|---|---|
| **M-N1** | **`T_orient`** (time to a confident answer to 6) | ≤ 5 min (O1). **Hard fail: > 15 min or never** |
| **M-N2** | **Quest recall (1, 3)** | ≥ 6 of 9 described by objective **and** motive (O3). Motive matters: a player who knows *what* but not *why* has a task list, not a character |
| **M-N3** | **Directions recovered (2)** | ≥ 80% quoted from the journal (O4) |
| **M-N4** | **Obligations (4)** | ≥ 3 of the 4 hanging items found **before** being punished for them (O9) |
| **M-N5** | **Position (5)** | The agent names its location by landmark, not by coordinates or by a map dot (W6) |
| **M-N6** | **Correctness (7)** | Wrong reconstructions ≤ 1, none load-bearing (O8). **A wrong belief that came from a journal entry that was true when written is NOT a defect** — it is W3 working, and the critic must not score it as an error |
| **M-N7** | **Vocabulary sweep** | Grep the verbatim answers for `objective`, `tracked`, `quest log`, `waypoint`, `marker` | **0** |
| **M-N8** | **Surfaces (O6)** | 2–5 distinct surfaces consulted |

### Blind pair (`blind_pair: yes`)

Pack: **A** = our journal's last entry for each of 6 active quests, stripped of proper nouns.
**B** = 6 Morrowind journal entries taken mid-quest, identically stripped and length-matched.
Coin flip recorded.

**The discriminating question, written before looking:** *"You have forgotten everything. From
this entry alone, could you get up and go somewhere?"* Count entries answered yes on each side.
Distinct from `RI-WLD06` M32 (followability of *direction* entries) because the population here
is *every* active quest's latest entry, including the ones with no directions in them — which is
where a tracker-shaped journal is exposed.

If the judge picks ours, CRITIC-DOCTRINE §2.5 applies in full.

### CONSUMPTION (`RI-MTH07` / `ARBITRATION` §3) — *(ADDED wave 1, `BAR-CRITIQUE-W1-07-R1` §R4)*

`ARBITRATION` §3's CONSUMPTION check reached the **critics** through the doctrine and reached
**none of the fourteen items** judging the opening, character creation or the journeys — measured
at this pass, `grep -cE 'RI-MTH07|CONSUMPTION|world-side consumer'` returned **0** for every one of
`RI-JRN01`–`RI-JRN08`, `RI-CHR01`–`RI-CHR03`, `RI-PRG02`, `RI-PRG03` and `RI-EXP01`. Which models
must be enumerated, and what a zero costs, are properties of the item and not of a critic's
diligence. For this item:

1. **Enumerate exhaustively** every model this journey requires to act — every table, graph,
   binding map, budget and record it publishes that the running game must read — and list it in
   the verdict. A sample is not an enumeration.
2. **Perturb and observe** per `RI-MTH07` §B: two well-separated values, everything else held
   fixed, plus the null control. For a **journey** the admissible observable is what the player
   could see or do — a drawn string, a rendered object, a surface that appears, an input that is
   accepted or refused, a state that survives. **A harness return value is not an observable**;
   `RI-MTH07` §B1 rules the trace an observer, not a consumer.
3. **Apply the consequence.** Any `coupling == 0` scores **that dimension 0**, fail-closed, and
   appears in the piece's `status_reasons`. There is no `partial`.
4. **The fourth shape.** `RI-MTH07` §A names orphan model, orphan data and orphan predicate.
   `corpus/88-journeys/` produced a fourth — **orphan text**: a string authored, computed
   correctly, carried through the model, exposed through the harness, and never drawn. From the
   player's chair it is identical to a string that was never written. See `RI-JRN09`
   `ES-LEGIBLE/1`.

## Scoring

Native scale **0–100**, weighted, hard fails cap at **2**.

| Block | Weight | Checks |
|---|---|---|
| **The player reconstitutes themselves** | **34** | M-N1 (10), M-N2 (12), M-N3 (8), M-N6 (4) |
| **The journal is the carrier** | **26** | M-R3 (12), M-R4 (7), M-R2 (5), M-R10 (2) |
| **No recap, no markers** | **16** | M-R5 (8), M-R14 (6), M-N7 (2) |
| **The other carriers** | 16 | M-R6 (4), M-R7 (3), M-R8 (3), M-R9 (3), M-R11 (2), M-R12 (1) |
| **Integrity of the test** | 8 | M-R1 (3), M-R15 (3), M-N8 (2) |

| Native | Band | Ladder ceiling |
|---|---|---|
| ≥ 88 | Meets the bar | 8 |
| 68–87 | Below bar — named remedy required | 6 |
| 48–67 | Recognisably attempting it | 5 |
| < 48 | **We lose** | 4 |

**Hard fails (any one caps at 2, `status: FAIL`):**

- **HF1** — Any recap, "current objective", tracked-quest pin, or relevance-sorted journal
  (M-R5) — AR-2.
- **HF2** — Any marker, arrow, or waypoint (M-R14) — AR-2.
- **HF3** — < 80% of active quests carry their directions verbatim in the journal (M-R3).
- **HF4** — Any retroactive editing of a written journal entry (M-R4).
- **HF5** — The naive agent cannot orient within 15 minutes, or cannot orient at all (M-N1).
- **HF6** — The committed cold save does not load bit-identically (M-R1) — a `RI-JRN05` failure
  surfacing here.

## How we lose

1. **The directions were spoken and never written.** The giver's prose was excellent, the
   journal entry says *"I agreed to help the dye-master"*, and eleven days later the route is
   gone. This is the failure the item exists for, it is a one-line data omission, and it is
   invisible in every other test because in a same-session test the player still remembers.
2. **A "current objective" panel is added** the first time somebody returns to a save and is
   confused. It solves the problem completely and it is an AR-2 fail. The correct fix is W2.
3. **The journal is sorted by relevance,** or the active quests float to the top, or the "next
   step" is bolded. Each is a small helpfulness and each converts the journal from a document
   into a tracker. W11 and HF1.
4. **Journal entries are rewritten when the truth changes.** The player believed the giver;
   later they learn the giver lied; the old entry is silently replaced with the corrected
   version. The record of what the player thought — the thing that makes a Morrowind journal a
   piece of characterisation — is destroyed for the sake of tidiness. HF4.
5. **The topic list does not exist.** Topics known is a `Set` in the save file and nothing
   renders it, so the returning player has 80 keywords they cannot enumerate and will never use
   again.
6. **Quest items are called "Quest Item".** W5 is trivially cheap and will be skipped because
   descriptions are written last.
7. **The test is run from an inn at noon.** Convenient, well-lit, full of NPCs and signposts,
   and it measures nothing. §A's wilderness-at-night clause is the difference between testing
   orientation and testing a settlement.
8. **The cold save is regenerated each wave.** The state drifts, results are not comparable
   across waves, and a regression looks like a different save. C1 requires a committed,
   hash-recorded save.
9. **The naive agent has read `RI-JRN07`.** It knows the world uses rumours and prose
   directions, so it knows where to look, and `T_orient` measures a trained reader. Isolation is
   `enforced` for this reason.
10. **The bounty is a number in a UI.** Legible, obvious, and it means the player never has to
    discover they are wanted by walking into a city and being arrested — which is the version of
    that information that is actually a scene. W9.
11. **`advanceWallClock` is never implemented, so "a week" is simulated by just... loading.**
    Every time-dependent piece of state (disease incubation, restocks, scheduled events, any
    "welcome back" logic) is untested, and the first real player to return after a week hits a
    code path nobody has run. `A-JRN10` exists for this.
12. **The item is judged by the same agent that produced the save.** It knows the plan, because
    it made the plan. Every number in §C becomes fiction. The fleet charter's role separation
    (`JOURNEY-CRITIC-FLEET.md` §4) forbids it, and it is the easiest rule in this whole area to
    break by accident.

## Provenance note

- **`constructed`, confidence high, and binding** — the cold-save specification in §A, the
  twelve carriers in §B, every budget in §C, the naive protocol's seven questions, and every
  threshold and weight in `## Comparison method` and `## Scoring`. No upstream source measures
  "can a player resume a save after a week", so we defined one we can measure
  (CORPUS-CONTRACT §3).
- **`canonical-recall`, confidence medium** — the claim motivating the whole item: that
  Morrowind's journal is a *record kept by a person*, numbered and dated and first-person, and
  that it is what makes a markerless world resumable. Also that Morrowind items and dialogue
  carry the information a returning player needs, and that Morrowind never presents a recap.
  Recalled characterisations, **not measurements**, and no threshold here is attributed to
  Morrowind.
- **Owned elsewhere, cited not restated:** state survival and the save round trip → `RI-JRN05`
  (M-R1 and M-R15 are its instruments pointed here). Journal voice, numbering, directions →
  `RI-DLG05`, `journal.entry.*`. Landmark visibility and the marker scan **M31** → `RI-WLD06`
  (M-R8 extends M27 to night and owns only that extension). A single quest's chain →
  `RI-JRN07`. Bloodstain persistence and its no-marker rule → `RI-JRN06`. Greeting variation →
  `dialogue.greeting.variation`. Seam S8 → `ARBITRATION.md`.
- **Harness dependency.** `A-JRN1`, `A-JRN3`, `A-JRN7`, `A-JRN10`, `A-JRN13`. Until they land
  this item is **unmeasurable** and scores **0**, fail-closed. Full request in
  `JOURNEY-CRITIC-FLEET.md` §7.
