---
id: RI-JRN07
title: A quest end to end without markers — rumour, giver, prose, landmark, resolution, journal
kind: structure
side: morrowind
judges: [journey.quest.unmarked, quests.discovery.hooks, journal.navigation.nomarkers]
provenance: constructed
confidence: high
blind_pair: yes
---

> **This item judges a JOURNEY, not a subsystem.** It is one of eight in `corpus/88-journeys/`.
>
> **This is THE Morrowind journey**, and it is the one a modern instinct most easily breaks —
> not by adding a marker (everyone knows not to do that) but by making every link in the chain
> *slightly* easier until the chain is a corridor with the arrows removed.
>
> **Division of labour, binding:** `RI-WLD06` owns **navigation** — the three layers, the
> landmark hierarchy, signpost format, the prose-direction grammar, and **M29, the fresh-agent
> navigation test**. This item **consumes M29 for the navigation leg and does not restate it**.
> `RI-DLG03` owns rumour distribution; `RI-DLG01` owns the topic graph; `RI-QST04` owns quest
> anatomy; `RI-QST05` owns non-combat resolution breadth; `RI-DLG05`/`journal.entry.*` own
> journal voice and numbering. **This item owns the chain**: whether a player who hears a
> sentence in a tavern can, using only what the world tells them, end up standing in the right
> place doing the right thing — and whether the journal they are left with is a record of what
> *they* did.
>
> **Subsystem paths pending taxonomy registration** — see `corpus/88-journeys/paths-requested.json`.

## The bar

A player walks into a settlement they have never been to. They talk to somebody about
`rumours` — not because a UI told them to, but because that is what you do — and hear one
sentence they were not looking for: *"The dye-master in Archon has been buying more salt than a
dyer needs."* Nothing is added to a quest log. No marker appears. Nothing is highlighted.

Hours later, in Archon, they remember the sentence and ask about `salt`. The dye-master denies
it, badly. They ask three other people about the dye-master. One of them has an opinion and a
grudge. From that they get a name and a direction in prose: *"Out past the vat-yard, where the
causeway forks at the tide-pole, go left."* They walk it — twenty minutes, by landmark, past a
signpost, with the prison tower on their right — and find a place that is exactly where the
prose said it would be, containing a thing the prose implied and a person the prose did not
mention.

They resolve it. There are at least three ways: kill, talk, or steal — and one requires
knowing something they could only have learned from a book. Whichever they pick, they walk back
and the world has changed by the amount they changed it. The journal has one new numbered
entry, dated, in first person, written as if by them, and it records **what they did**, not
what the quest system thinks the stage index is.

**The whole journey contains zero pieces of UI that did not exist in 2002.** The bar is that a
fresh agent, given no corpus and no data files, completes it end to end using only in-game text
— and that when it is done, it can say what happened and why, in its own words, without using
the word "objective".

## The reference artifact

### A. `ES/CHAIN` — the six links (BINDING)

Each link is separately checkable and each has a distinct failure mode.

| # | Link | Requirement | Fails when |
|---|---|---|---|
| **L1** | **The rumour** | The quest is discoverable from ≥ 1 rumour or overheard line in a settlement **other than** the giver's, delivered by an NPC who has no stake in it, with **no** journal entry, no flag set, and no UI acknowledgement of any kind. The rumour names a **person or a place**, never a task | A "quest available" indicator appears; or every quest is discovered by walking up to its giver |
| **L2** | **The topic bridge** | The rumour's proper noun becomes a **topic** the player can ask about elsewhere (`dialogue.topics.discovery`). Asking it of ≥ 3 different NPC classes gives ≥ 3 materially different answers, ≥ 1 of which is wrong or self-serving (`dialogue.topics.truth`) | The topic exists but every NPC gives the same paragraph |
| **L3** | **The giver** | Found by asking, not by a marker. Has a name, a place, a job, an opinion about a third party, and **an agenda that is not the one stated** in ≥ 30% of quests (`quests.structure.deceit`) | The giver is standing under a glowing icon at the settlement entrance |
| **L4** | **The directions** | Delivered as prose obeying `RI-WLD06` §4's grammar, spoken by the giver **and** written verbatim into the journal (`RI-WLD06` L3). Reference only sightline landmarks, signposted roads, settlements, water features, cardinal directions and walk-times | The directions say "head to the marked location", or reference something invisible from the route |
| **L5** | **The navigation** | Completed by a fresh agent using only the journal text and what it can see. **Measured by `RI-WLD06` M29 — cited, not restated** | A marker; or prose that is beautiful and unfollowable |
| **L6** | **The resolution and the record** | ≥ 3 materially different resolutions, ≥ 1 non-combat (`RI-QST05`), ≥ 1 gated on knowledge obtainable only elsewhere. Exactly one new journal entry per stage advanced, first person, dated, numbered, recording **the resolution the player chose** | One resolution; or a journal entry that reads *"Objective complete: Speak to the dye-master."* |

### B. `ES/QUEST-SET` — the five test quests (BINDING)

The journey is not measurable on one quest, because a single quest can be hand-polished. The
critic runs **five**, drawn by a recorded seeded sample from `game/data/quests/`, stratified:

| Id | Stratum | Why |
|---|---|---|
| **Q1** | A main-quest stage | The one most likely to have been given a marker "just for the critical path" |
| **Q2** | A faction quest at rank ≥ 3 | Escalation quests are where prose directions get replaced by "return to the guild hall" |
| **Q3** | A side quest whose giver **lies** | Tests L3's agenda and whether the journal records the player's *belief* rather than the truth |
| **Q4** | A quest discovered **only** by rumour, with no giver in the starting settlement | The purest L1/L2 test |
| **Q5** | A quest whose destination is ≥ 15 walk-minutes away and crosses a region border | The one where a marker is most tempting and prose most likely to run out |

**Rule S1.** The five are sampled by seed and **recorded in the verdict before the run**. A
critic that hand-picks quests has measured the best case and its verdict is void
(`RI-MTH04`).

### C. The unmarked-navigation budget (BINDING)

| Id | Quantity | Target | Fail |
|---|---|---|---|
| **U1** | `directions_coverage` — quests with a destination that have a `directions` string | **100%** (`RI-WLD06` M30, cited) | < 100% |
| **U2** | `journal_verbatim` — journal entries whose direction text is character-identical to the spoken prose | **100%** | < 95% |
| **U3** | `topic_bridge_depth` — distinct topics the player must learn and use to get from rumour to giver | **≥ 2**, median over Q1–Q5 | ≤ 1 (the rumour names the giver directly) |
| **U4** | `wrong_answers` — NPC answers to a quest-relevant topic that are false or self-serving | **≥ 1** per quest | 0 across all five |
| **U5** | `resolution_breadth` — materially different resolutions reachable | **≥ 3** per quest, ≥ 1 non-combat | ≤ 2 |
| **U6** | `knowledge_gate` — quests with ≥ 1 resolution gated on information learnable only from a book, a rumour, or a third NPC | **≥ 3 of 5** | ≤ 1 |
| **U7** | `journal_entries_per_stage` | Exactly **1** | ≠ 1 |
| **U8** | `journal_first_person` | **100%** | < 100% |
| **U9** | `marker_count` | **0**, anywhere, at any point | ≥ 1 (AR-2, hard fail) |
| **U10** | `overshoot_ratio` — fresh-agent walk distance ÷ ideal path, median over Q1–Q5 | ≤ **2.0** | > 3.0 |
| **U11** | `backtrack_asks` — times the agent had to return to an NPC to re-ask something the journal should have recorded | ≤ **1** per quest | ≥ 3 |
| **U12** | `dead_end_rate` — quest-relevant topics that resolve to no content ("I know nothing about that") when the player has good reason to expect content | ≤ **0.15** | > 0.30 |

**U12 is the one nobody measures and it is what makes Morrowind's topic system feel alive or
feel like a lookup table that mostly misses.** A world where two of every three reasonable
questions return the universal shrug has technically got a topic graph and has actually got a
wall.

## Comparison method

Run by `critic.quests` with `critic.world` co-signing the navigation leg (fleet critic
**JC-07**). The **naive pass is primary here** — the instrumented pass exists to explain the
naive pass's failures, not to substitute for it.

```bash
node tools/analysis/content-stats.mjs --quests --directions    # U1, U5, U6, U7 — no browser
node tools/journey/journey-run.mjs --journey jrn07-quest --seed 4711 \
     --sample-quests 5 --stratified --input-mode real --out reports/journeys/<runId>
```

Requires **`A-JRN1`**, **`A-JRN7`** (`topic_select`, `journal_write`, `quest_stage` events) and
**`A-JRN13`** (a `getDialogueState()` returning the topic list *as presented*, so the critic
measures what the player could see rather than what the data file contains). Until they exist
the naive checks are `unmeasurable` and score **0**; the static checks (U1, U5, U6, U7) are
measurable today from `game/data/**` alone.

| # | Check | Procedure | Threshold |
|---|---|---|---|
| **M-Q1** | **Static quest audit** | `content-stats.mjs` over all quests: directions coverage, resolution counts, non-combat resolution presence, knowledge gates, journal entries per stage | U1, U5, U6, U7. Runs today, no browser, no harness |
| **M-Q2** | **Prose-grammar audit** | `RI-WLD06` M30 over the five sampled quests | **Cited, not restated.** 100% coverage, 0 banned tokens |
| **M-Q3** | **Journal verbatim** | Diff each journal `directions` text against the giver's spoken line | U2 |
| **M-Q4** | **Rumour reachability (L1)** | For each of Q1–Q5, enumerate every rumour/greeting/overheard line in `game/data/dialogue/` mentioning the quest's key noun; check ≥ 1 lives in a settlement other than the giver's | ≥ 1, 5/5. **Hard fail: any quest with no discovery path other than its giver** |
| **M-Q5** | **No discovery UI** | From the moment a rumour is heard until the giver is met: grep the UI-text stream and diff `getQuestState()` | **0** journal entries, **0** flags set, **0** UI strings. **Hard fail: a "quest discovered" acknowledgement** |
| **M-Q6** | **Topic bridge (L2)** | From the trace, the shortest chain of topics the agent actually used from rumour to giver; and, for each quest-relevant topic, the number of materially different answers across ≥ 3 NPC classes (cosine distance ≥ 0.4 between answer texts) | U3; ≥ 3 distinct answers per bridging topic |
| **M-Q7** | **Falsehood present (L2)** | For each quest, ≥ 1 NPC answer contradicted by an observable fact or by another NPC | U4. **Hard fail: 0 across all five** — a world where everyone is honest is not this world |
| **M-Q8** | **Giver agenda (L3)** | Fraction of the five whose giver's stated goal differs from their actual goal, verified against `quests.structure.deceit` data | ≥ 30% (≥ 2 of 5) |
| **M-Q9** | **Navigation (L5)** | **`RI-WLD06` M29, run on Q1–Q5's destinations.** Cited verbatim, not recomputed | ≥ 9/10 on M29's own sample; 5/5 on these five. Failures attributed by M29's (a)/(b)/(c)/(d) cause codes |
| **M-Q10** | **Overshoot** | Path length walked ÷ ideal, from the trace | U10 |
| **M-Q11** | **Backtracking** | Count returns to a previously-exhausted NPC for information | U11 |
| **M-Q12** | **Dead-end rate** | For every topic the agent tried, whether it returned content or a shrug | U12 |
| **M-Q13** | **Resolution execution** | Complete each quest **twice** by two different routes; diff the resulting world state | Both complete; the diffs differ in ≥ 3 durable fields (`RI-JRN05` §B manifest). **Hard fail: two "different" resolutions producing identical state** — cosmetic branching |
| **M-Q14** | **Knowledge gate is real** | For a knowledge-gated resolution, attempt it on a character who has not learned the fact | Refused or unavailable. **Hard fail: the gate is decorative** |
| **M-Q15** | **Journal record** | For each resolution taken, the resulting entry: numbered, dated, first-person, and containing a token unique to the chosen route | 100%. **Hard fail: an entry that reads the same regardless of route** |
| **M-Q16** | **Marker sweep** | `RI-WLD06` M31 over the whole journey's HUD frames | **0** (U9, AR-2, hard fail) |
| **M-Q17** | **Compass-in-prose sweep** | Grep journal and dialogue for `marker`, `waypoint`, `objective`, `°`, coordinates, `quest log`, `tracked` | **0 hits** |

### Naive pass (isolation: `enforced`) — the primary instrument

Fleet role **JC-07N**. The agent receives: the URL, the driver protocol, one sentence of
premise, and **a save state placing it in a settlement it has not visited, with the rumour
not yet heard**. It receives **no corpus, no quest data, no map, no coordinates, no
screenshots from anyone else**. Its task is stated once:

> *"Find something worth doing in this town, do it, and then tell me what you did."*

That wording is deliberate: it does not name a quest, does not say "complete a quest", and does
not tell the agent that rumours exist. Then, verbatim, before any reveal:

1. *"What did you decide to do, and what made you decide it? Quote the sentence that started it."*
2. *"How did you find the person? List every question you asked and who you asked."*
3. *"How did you find the place? Quote the directions you used and describe what you looked at
   while walking."*
4. *"How many ways could you have finished it? How do you know?"*
5. *"What did you actually do, and what changed because of it?"*
6. *"Read your journal back to me. Does it say what happened?"*
7. *"Was there any moment you were stuck? What unstuck you?"*

| # | Check | Threshold |
|---|---|---|
| **M-N1** | **Completion** | The agent completes a quest end to end using only in-game text. **Hard fail: it cannot** |
| **M-N2** | **Origin (1)** | The quote is a **rumour or overheard line**, not a quest-giver's opening. ≥ 3 of 5 runs |
| **M-N3** | **Bridge (2)** | ≥ 2 topics asked of ≥ 2 different NPCs before finding the giver (U3 corroborated by behaviour) |
| **M-N4** | **Navigation account (3)** | The answer names **≥ 2 physical landmarks** it steered by. An answer that names no landmark means the agent navigated by trial and error and the prose did nothing |
| **M-N5** | **Breadth awareness (4)** | The agent names ≥ 2 alternatives it *considered and could see*. Knowing an alternative existed matters more than the alternative existing |
| **M-N6** | **Journal fidelity (6)** | The agent confirms the journal matches events **and** says it reads like something a person wrote. A "no, it's a status list" is a defect |
| **M-N7** | **Stuck census (7)** | Triaged: legitimate mystery vs defect. Defects ≤ 1; **hard fail ≥ 3, or any that required leaving the game to resolve** |
| **M-N8** | **Vocabulary sweep** | Grep the agent's verbatim answers for `objective`, `marker`, `waypoint`, `quest log`, `tracker` | **0**. If the agent reaches for that vocabulary unprompted, the game taught it that vocabulary |

### Blind pair (`blind_pair: yes`)

Pack: **A** = the journal entries our run produced for one quest, stripped of proper nouns.
**B** = a length-matched sequence of Morrowind journal entries for one quest, identically
stripped. Assignment by recorded coin flip. This is deliberately **narrower** than `RI-WLD06`
M32 (which compares *direction* entries for followability); here the question is authorship.

**The discriminating question, written before looking:** *"Which of these was written by the
person who did the thing, and which was written by the system that tracked it?"*

If the judge picks ours, CRITIC-DOCTRINE §2.5 applies in full.

## Scoring

Native scale **0–100**, weighted, hard fails cap at **2**.

| Block | Weight | Checks |
|---|---|---|
| **The chain holds without markers** | **30** | M-N1 (12), M-Q16 (8), M-Q9 (7), M-Q17 (3) |
| **Discovery is by rumour and topic** | **22** | M-Q4 (6), M-Q5 (5), M-Q6 (5), M-N2 (3), M-N3 (3) |
| **The world lies and the player can tell** | 12 | M-Q7 (5), M-Q8 (4), M-Q12 (3) |
| **Resolution is genuinely broad** | 18 | M-Q13 (8), M-Q14 (5), M-Q1 (5) |
| **The journal is a record, not a tracker** | 12 | M-Q15 (5), M-Q3 (3), M-N6 (4) |
| **The walk works** | 6 | M-Q10 (3), M-Q11 (2), M-N4 (1) |

| Native | Band | Ladder ceiling |
|---|---|---|
| ≥ 90 | Meets the bar | 8 |
| 70–89 | Below bar — named remedy required | 6 |
| 50–69 | Recognisably attempting it | 5 |
| < 50 | **We lose** | 4 |

**Hard fails (any one caps at 2, `status: FAIL`):**

- **HF1** — Any marker, arrow, waypoint, minimap, objective readout or see-through outline
  (M-Q16) — AR-2, and also `RI-WLD06`'s M31 fail.
- **HF2** — The naive agent cannot complete a quest using only in-game text (M-N1).
- **HF3** — A quest with no discovery path other than walking up to its giver (M-Q4).
- **HF4** — A "quest discovered / quest added / objective updated" acknowledgement (M-Q5) —
  also `RI-JRN01` HF3.
- **HF5** — Two "different" resolutions producing identical durable world state (M-Q13).
- **HF6** — A decorative knowledge gate (M-Q14).
- **HF7** — A journal entry identical regardless of the route taken (M-Q15).
- **HF8** — Zero false or self-serving NPC answers across all five quests (M-Q7).
- **HF9** — ≥ 3 defect-class stuck episodes, or any requiring out-of-game information (M-N7).

## How we lose

1. **The marker is removed and the corridor stays.** No arrow, no compass — and the giver is
   the only NPC in the settlement with a greeting, standing on the path from the gate, and the
   destination is the only building in the direction the prose points. Every check about markers
   passes and the journey is a hallway. U3, M-N3 and `overshoot_ratio` are the instruments that
   see this; the marker sweep never will.
2. **"Quest added: The Salt-Buyer."** A toast, because every engine ships one. AR-2, HF4, and it
   costs nothing to not do.
3. **The rumour names the task.** *"You should go help the dye-master in Archon."* This is a
   quest marker made of words. L1 requires the rumour to name a **person or a place** and to
   contain no imperative, and the difference between those two sentences is the difference
   between the two games.
4. **Directions are written after the map.** The route is authored, then a writer is asked to
   describe it, and the description references a bend in the causeway that is not visible and a
   tree that was replaced by a rock in a later pass. `RI-WLD06` M29's cause-code (c) exists for
   this and it will be the most common failure.
5. **Every NPC tells the truth.** Writing a lie means writing the truth as well and making both
   discoverable, which is three times the work. U4/HF8 are deliberately unforgiving because this
   is the single cheapest thing to cut and the single most Morrowind thing in the item.
6. **The topic graph is a lookup table with a 40% hit rate.** The player asks eight sensible
   questions and gets six shrugs, learns that asking is not worth it, and reverts to walking
   until something happens. U12.
7. **Three resolutions, one outcome.** Kill him, pay him, or turn him in — and in all three
   cases the quest completes, the same gold arrives, and the world state differs by one boolean.
   M-Q13 requires the *durable state diff* to differ in ≥ 3 fields, which is the only way to
   tell a branch from a skin.
8. **The knowledge gate is a dialogue option that is always shown.** The player picks *"I know
   about the Hist-oath"* without ever having heard of it. HF6.
9. **The journal is generated from the stage index.** *"12. The Salt-Buyer — Stage 3."* It is
   the cheapest possible implementation, it satisfies "there is a journal", and it is precisely
   the artifact the blind judge will identify as system-written in two seconds.
10. **One quest is polished for the demo.** The critic is shown Q3 because it is the good one.
    S1's seeded stratified sample and its recording-before-the-run exist for exactly that, and
    a verdict without the recorded sample is void.
11. **The naive agent is given the quest name.** *"Complete the salt-buyer quest"* instead of
    *"find something worth doing"*. The entire L1 measurement collapses, because the agent now
    has the noun the rumour was supposed to supply.
12. **Cross-region prose runs out.** Q5's fifteen-minute walk crosses a border and the
    directions become *"head north-east"*, because nobody wrote landmarks for the middle
    third of the route. The agent arrives by dead reckoning and the journey has degraded into
    a compass hunt without a compass — the worst of both designs.

## Provenance note

- **`constructed`, confidence high, and binding** — the six links in §A, the five-quest
  stratified sample in §B, every budget in §C, the naive protocol's seven questions, and every
  threshold and weight in `## Comparison method` and `## Scoring`.
- **`canonical-recall`, confidence medium** — the Morrowind chain this transposes: that quests
  are discovered from `rumours` and overheard talk rather than from a log; that proper nouns in
  dialogue become askable topics; that givers lie; that directions are prose referencing
  landmarks; that the journal is a numbered, dated, first-person document. Recalled, not
  measured. **No threshold here is a claimed measurement of Morrowind** — §C's numbers are ours.
- **Owned elsewhere, cited not restated:** the three navigation layers, landmark hierarchy,
  signpost format, prose-direction grammar, and the fresh-agent navigation test **M29** and
  marker scan **M31** → `RI-WLD06` (M-Q2, M-Q9, M-Q16 are citations of that item's instruments
  and must report its run id). Rumour distribution → `RI-DLG03`. Topic discovery and truth →
  `RI-DLG01`, `dialogue.topics.truth`. Quest anatomy, stages and deceit → `RI-QST04`,
  `RI-QST02`. Non-combat resolution breadth → `RI-QST05`. Journal voice, numbering and
  directions → `RI-DLG05`, `journal.entry.*`. Durable state fields for M-Q13 → `RI-JRN05` §B.
  Seam S8 (no quest markers) → `ARBITRATION.md`.
- **Harness dependency.** M-Q1 runs **today** with no harness. Everything else needs `A-JRN1`,
  `A-JRN7` and `A-JRN13`; until they land those checks are **unmeasurable** and score **0**,
  fail-closed. Full request in `JOURNEY-CRITIC-FLEET.md` §7.
