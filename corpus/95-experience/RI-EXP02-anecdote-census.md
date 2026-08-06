---
id: RI-EXP02
title: The anecdote census — the memorability instrument
kind: text
side: neutral
judges: [experience.memory.anecdote, experience.memory.recall]
provenance: constructed
confidence: medium
blind_pair: yes
---

## The bar

Morrowind's cult status is not made of its systems. It is made of **stories players tell each
other**: the wizard who fell out of the sky, the ring you can steal from a man who then thanks
you, the boots that blind you, the mudcrab merchant with 10,000 gold, killing Vivec and being
told the thread of prophecy is severed and *you may still*. Twenty years on, nobody recites a
skill formula. Everybody has three stories.

`BAR-CRITIQUE-01` §2 names the failure this instrument exists for and names it exactly: **a
build can score at the bar on every item and be competent, correct and dead.** The corpus can
prove every system exists, is in band, and does not contradict its neighbours. It cannot prove
that anything ever *happened*. This item is the proof.

> The bar in one sentence: **an agent that has played our game, and cannot see its own notes,
> can still tell you specific stories about it — with proper nouns, with a consequence, and at
> a rate that survives hour ten.**

The critical word is *specific*. "The combat felt weighty" is not an anecdote; it is a review.
"I lied to Ree-Vaska about the brooch, and when I came back at rank 3 her sister refused to sell
me the boat" is an anecdote, and the difference between those two sentences is the difference
this whole area exists to measure.

---

## The reference artifact

### A. The anecdote definition (binding)

An **anecdote** is one recalled item satisfying **all five**:

| # | Criterion | Test |
|---|---|---|
| A1 | **Narrative shape** | It contains an action by the player and a consequence: "I did X, then Y". A description of a place with no player action is not an anecdote; it is a screenshot. |
| A2 | **≥ 1 proper noun** | A named NPC, place, item, faction, quest, book or boss. Resolvable against `game/data/**`. |
| A3 | **Specific, not generic** | It could not be truthfully told about a *different* game of this genre with the proper nouns swapped. See the generic-substitution test in §C. |
| A4 | **Locatable** | It corresponds to a frame range in the trace, within ±2 minutes. |
| A5 | **Told, not transcribed** | It survived the recall bottleneck (§D). An item copied from a log is not recall. |

An item failing A1–A3 scores **0**. An item failing A4 (unlocatable) or whose proper nouns do
not resolve scores **−1** — the confabulation penalty of `PLAYTHROUGH-CRITIC.md` §4.6. Inventing
memories must be strictly worse than having none, or the instrument becomes a creative-writing
exercise with a threshold.

### B. The taxonomy (five classes, each independently floored)

A game can be memorable in one narrow way and dead everywhere else. Counting anecdotes without
classing them lets a build satisfy the census entirely with class **T5** (writing that stuck) —
which is a book of quotations, not a game. Each class therefore carries its own floor.

| Class | Name | What it is | Reference exemplar | Our floor (FULL tier) |
|---|---|---|---|---|
| **T1** | **A lie that landed** | Someone deceived the player, or the player deceived someone, and it *mattered later*. Includes quest-givers who lied, books that were wrong, and the player getting away with something. | Fargoth's ring; the Nerevarine prophecies being partly propaganda; Oscar's prophecy he doesn't believe | ≥ 6 |
| **T2** | **A place that surprised** | Arriving somewhere and finding it was not what the world implied. Includes vistas, verticality, a door onto somewhere impossible, and a place that turned out to be *inhabited*. | first Telvanni tower on the horizon; Anor Londo opening up; the Ghostfence | ≥ 6 |
| **T3** | **A fight that turned** | An encounter whose outcome inverted — a loss that became a win on the third attempt, an ambush survived by an unplanned means, a boss whose pattern finally read. | the Asylum Demon on the second pass; the Taurus Demon plunge; a Golden Saint you were not ready for | ≥ 6 |
| **T4** | **A system that combined unexpectedly** | Two systems produced a result nobody wrote a line for. **This is the G2 class** and it is what `RI-CMP01` and `RI-CMP02` exist to make possible. | levitating out of a fight; a potion brewed 20 h earlier deciding a fight; paralysing a guard; luring a knight off a ledge | ≥ 5 |
| **T5** | **Writing that stuck** | A line, journal entry, book passage or name recalled *verbatim or near-verbatim*, unprompted. | "the thread of prophecy is severed"; "What a piece of work is a mudcrab"; the Crestfallen Warrior | ≥ 5 |

An anecdote is assigned **exactly one** primary class by the judging agent (§E), plus optional
secondary classes which do not count toward floors.

### C. The generic-substitution test (criterion A3, operationalised)

The judging agent rewrites each anecdote replacing every proper noun with a neutral token and
asks: *is this sentence still a true statement about at least two other RPGs I know?* If yes,
the anecdote is **generic** and scores 0.

| Recalled item | Substituted | Verdict |
|---|---|---|
| "The combat got hard around the fourth region" | "The combat got hard around the fourth [AREA]" | **generic — 0** |
| "I joined the [FACTION] and did quests for them" | unchanged in force | **generic — 0** |
| "I killed Kaleeh-Ra for the Salt-Kin before I knew she was the only person who could open the Blackrose tide-gate, and I finished that questline by swimming" | "I killed [NPC] for [FACTION] before I knew she was the only person who could open [PLACE], and finished that line by swimming" | **specific — counts (T1/T4)** |
| "There was a boss with two phases" | — | **generic — 0** |
| "I read *On the Silting of Soulrest* in an inn, went to the crater it names, and there was a door" | — | **specific — counts (T2/T5)** |

Generic rate is itself reported: `generic_fraction = generic_items / all_recalled_items`. A high
generic rate with a passing anecdote count means the build is memorable in a *few* places and
featureless everywhere else, and the verdict must say so.

### D. Enforced context isolation — the recall protocol

This is the part that makes the number mean anything. Two naive designs both fail
(`PLAYTHROUGH-CRITIC.md` §4.6): the same agent with its full transcript is **transcribing**, not
remembering; a fresh agent handed the artifacts is **reconstructing from residue**, which is a
different (useful) measurement and must never be called recall.

Memory is therefore defined **structurally, as what survives a bottleneck.**

```
 SEG 1 ──baton(≤500w)──▶ SEG 2 ──baton──▶ … ──baton──▶ SEG 13
   │                       │                              │
   └ trace, intent, shots ─┴─ withheld from every successor ┘
                                                           │
                                        ┌──────────────────┴──────────────────┐
                                        │                                     │
                                    M3 TERMINAL RECALL              M1 BATON SURVIVAL
                              (final agent, baton + own segment,     (which events are
                               before touching ANY artifact)          still named, after
                                                                      how many hops)

     M2 RECONSTRUCTION — a fresh agent, never played, given ONLY screenshots + a bare
     route log. Measures legibility of residue. Reported separately. NOT recall.
```

| Property | Value |
|---|---|
| Segment length | 90 simulated minutes |
| Baton | `baton-out.md`, **≤ 500 words**, hard-truncated by the driver |
| Withheld from every successor | `trace.jsonl`, `intent.jsonl`, transcripts, screenshots, journal exports, design docs, prior verdicts, this item |
| Permitted inheritance | the baton, the in-game journal (diegetic, read in-game as a player would) |
| Agent identity | a fresh invocation per segment; premise + brief only |
| Chain integrity | `parent_session`, `state_in_sha256`, `baton_in_sha256` in every manifest |
| Isolation level | **`enforced`** required for full marks — materialised inbox + tool-call diff (`PLAYTHROUGH-CRITIC.md` §5.5). `attested` caps this item at **6**. `assumed` scores **0**. |

**The three instruments:**

- **M1 — baton survival.** For each event named in any baton, `hops_survived` = number of
  bottlenecks it crossed. Reported as a survival curve. An event still named after 8 hops is the
  strongest memorability evidence the process can produce.
- **M2 — reconstruction.** A fresh agent, given only screenshots and a bare route log, writes
  what it can describe. Reported as `residue_legibility`; **does not count toward
  `verified_anecdotes_per_hour`** and may never be called recall in a verdict.
- **M3 — terminal recall.** The final segment's agent, **before opening any artifact**, answers
  the recall prompt from its baton and its own 90 minutes alone. This is the primary source of
  counted anecdotes.

**The recall prompt (verbatim, committed as an artifact, and deliberately negative-first per
`PLAYTHROUGH-CRITIC.md` §4.4):**

> You played this game. You cannot see your notes and you will not get them.
> 1. Name the worst twenty minutes you remember. Say what happened in it.
> 2. Now write down everything you can still describe that *happened to you*, one line each.
>    Each line must contain something with a name, and something that changed because of it.
> 3. For each line, mark it `authored` (someone wrote this to happen to me) or `arose` (this
>    happened because two things met).
> 4. For each line, say how sure you are it happened: `certain` / `probably` / `might be
>    confusing it with something`.
> Do not evaluate the game. Do not say whether anything was good. If you cannot remember
> anything for a stretch, write that stretch's time range and the word `blank`.

The `certain/probably/might` self-tag is not scored directly; it is compared against the
verification result in §E and reported as `calibration` — an agent whose `certain` items fail
verification is a different (worse) problem than one whose `might` items do.

### E. Verification — the anti-gaming rule

**Every anecdote must be verifiable against the trace.** Nothing else in this item survives if
this one does not hold, because a language model asked for a story will always produce a story.

`tools/experience/anecdote-verify.mjs` runs **after** all recall is captured and hashed, and is
the **first** point at which `game/data/**` may be opened by anyone in this role
(`PLAYTHROUGH-CRITIC.md` §3):

1. **Locate.** Find a frame range in the concatenated session traces matching the anecdote's
   action + consequence, within **±2 minutes**. Matching uses `events[]` types, `quest_stage`,
   `journal`, `topic`, `item`, `death`, and entity ids — never prose similarity alone.
2. **Resolve.** Every proper noun must resolve to a path under `game/data/**` (an npc id, poi
   id, quest id, book id, item id, faction id). Unresolvable proper noun ⇒ the item is a
   confabulation.
3. **Class.** Assign T1–T5 per §B and apply the generic-substitution test per §C.
4. **Score.** `verified` = passes 1+2+3. `unverified` = fails 1 or 2.
   **`anecdote_score = verified − unverified`.** Never `verified` alone.
5. **Emit** `anecdote-verify.json`: per item, the text, `class`, `frames:[a,b]`,
   `proper_nouns:[{noun, path}]`, `generic: bool`, `arose: bool`, `verdict`.

`verified_anecdotes_per_hour = anecdote_score / simulated_hours`.

Three further anti-gaming rules, each closing a hole a motivated agent would otherwise walk
through:

- **No re-rolling recall.** The first M3 response is the response. A second recall pass on the
  same playthrough is inadmissible; the artifact hash and its timestamp prove which came first.
- **The judge is not the player** (`PLAYTHROUGH-CRITIC.md` §8). Classification and the generic
  test are performed by an invocation that did not play and does not see the score thresholds.
- **The thresholds are withheld from the recalling agent.** The recall prompt above is the
  entire prompt. An agent that knows it needs "≥4 per hour with ≥6 in class T1" will produce
  exactly that, and the number will be worthless.

---

## Comparison method

**Step 1 — play.** The playthrough runs per `PLAYTHROUGH-CRITIC.md` §3/§5: tier-appropriate
dosage (FRAGMENT 3 h / PARTIAL 8 h / FULL 20 h), 90-minute segments, `session-run.mjs`, batons
hard-truncated at 500 words, `log-lint.mjs` clean (exit 0) on every `intent.jsonl`.

```bash
node tools/experience/session-run.mjs --session exp-w<N>-s01 --brief <brief> --seed <n> --minutes 90
node tools/experience/log-lint.mjs   --in reports/sessions/exp-w<N>-s01     # must exit 0
# … repeat with --resume state-out.json, one fresh agent per segment …
```

**Step 2 — recall.** `tools/experience/recall-run.mjs --chain <session-ids> --prompt
corpus/95-experience/prompts/recall.md --isolation enforced` invokes M3 (and M2 separately) with
a materialised inbox, captures the responses verbatim, hashes them, and writes
`recall/{m1-batons.json, m2-reconstruction.md, m3-terminal.md, context-manifest.json}`.

**Step 3 — isolation check.** `tools/experience/isolation-check.mjs --recall reports/recall/<id>`
diffs each agent's tool-call log against its inbox manifest. Any read outside the inbox voids
that instrument.

**Step 4 — verify.** `tools/experience/anecdote-verify.mjs --recall reports/recall/<id>
--traces reports/sessions/ --data game/data` → `anecdote-verify.json`.

**Step 5 — the blind pair (`blind_pair: yes`).** A different agent assembles a pack of 20
anecdotes from our game and **20 constructed reference anecdotes** drawn from Morrowind and Dark
Souls, all stripped to a common form with proper nouns tokenised consistently *within* each
anecdote but not across them. The judge, blind, is asked: *which of these two sets came from a
game people still talk about twenty years later, and what is the tell?* Record the pick and the
tell before the reveal. Per `CORPUS-CONTRACT` §6 and `CRITIC-DOCTRINE` §2.5, our set winning is
a signal to **distrust the pack**, not a pass condition (this item deliberately does not repeat
`RI-DLG07`'s W3 mistake): the scored output is `judge_cannot_name_a_consistent_tell` and
`bet_accuracy ≤ 0.70`, not a win rate.

**Step 6 — the sabotage control (mandatory, `PLAYTHROUGH-CRITIC.md` §4.5).** This item is one of
the two that **SAB-P (prose flattened)** must detect: the orchestrator produces a variant in
which every dialogue/journal/book string is replaced by its own first sentence, from the same
commit, by data filter. Two matched 90-minute segments (same seed, same start state, same brief)
are run and labelled A/B by coin flip. The critic states which is sabotaged and how it knew
**before** the reveal. Required margin: **verified anecdotes/hour lower in the sabotaged variant
by ≥ 50%.** If the battery cannot separate them at that margin, this item's verdict is **VOID,
not FAIL** — a broken instrument does not get to produce a score.

---

## Scoring

Native scale is the anecdote census itself; translated per `SCORING.md` §1.2.

| Metric | Definition | Bar | Below bar | We lose |
|---|---|---|---|---|
| `verified_anecdotes_per_hour` | `(verified − unverified) / simulated_hours` | **≥ 4.0** | 1.5–3.9 | **< 1.5** |
| Class floors (FULL tier) | T1 ≥ 6, T2 ≥ 6, T3 ≥ 6, T4 ≥ 5, T5 ≥ 5 | all five met | one class short by ≤ 2 | any class at 0 |
| `arose_fraction` | `arose / verified` — memorable events that were not directly authored as beats | ≥ 0.25 | 0.10–0.24 | < 0.10 |
| `unpredicted_count` | verified anecdotes that **no design document predicted** (checked against `game/data/**` quest/journal text in the verification stage) | ≥ 3 | 1–2 | 0 |
| `generic_fraction` | generic items / all recalled items | ≤ 0.35 | 0.36–0.55 | > 0.55 |
| `confabulation_rate` | `unverified / all recalled` | ≤ 0.15 | 0.16–0.30 | > 0.30 |
| `mean_hops_survived` (M1) | mean bottlenecks crossed by named events | ≥ 2.5 | 1.5–2.4 | < 1.5 |
| `blank_hours` | hours for which M3 returned `blank` | 0 | 1 | ≥ 2 |

Class floors scale with tier: **FRAGMENT** = ⅕ of the FULL floors, rounded up; **PARTIAL** = ⅖.
`verified_anecdotes_per_hour` and the fractions do **not** scale — they are rates.

**Native → ladder anchors:** rate 1.5 with two class floors met → ladder 4; rate 2.8 with four
class floors met → ladder 6; rate 4.2, all class floors met, `arose_fraction ≥ 0.25`,
`unpredicted_count ≥ 3`, sabotage control passed → ladder 8. Ladder 9–10 requires the blind pack
of step 5 producing `judge_cannot_name_a_consistent_tell = true` against the reference set.

**Hard fails — each caps this item at 2 and makes the wave `DEAD`:**

1. **`verified_anecdotes_per_hour < 1.5`.** The audit's definition of *competent and dead*, and
   the single number this whole area exists to produce.
2. **Any class floor at zero.** Twenty hours produced nothing in a whole mode of memory.
3. **`confabulation_rate > 0.30`.** The recall is fiction and the instrument is measuring the
   model, not the game.
4. **Isolation not `enforced` or `attested`** for M3. `assumed` produces no admissible evidence.
5. **The sabotage control was not run** (⇒ `VOID`) or was run and failed to separate at the
   ≥50% margin (⇒ `VOID`). Not a low score — a void.
6. **Batons exceeded 500 words**, or any successor agent was given a predecessor's trace,
   transcript or notes. The bottleneck *is* the instrument.

---

## How we lose

- **The census becomes a transcription exercise.** Somebody widens the baton "for continuity",
  or lets the recalling agent peek at the journal export, or re-runs recall "because the first
  one was thin". Every one of those changes makes the number go up and makes it meaningless.
  The hard truncation and the first-response-is-the-response rule exist for exactly this.
- **We optimise for T5 because prose is the cheapest anecdote to manufacture.** Forty
  quotable lines, five class floors, one of them met. The per-class floors are the defence, and
  T4 — the systems class — is deliberately the one that cannot be written, only built.
- **`arose_fraction` gets gamed by relabelling.** An authored set-piece is marked `arose`
  because it *felt* emergent. The verification stage resolves each anecdote to trace events and
  to `game/data/**`; an event with a `quest_stage` in its frame range is `authored` regardless of
  what anyone marked. The judge that classifies is not the agent that played.
- **The agent writes a lovely story about a game it did not play that way.** Confabulation under
  narrative pressure (`PLAYTHROUGH-CRITIC.md` §4.1.3) is the default failure of this instrument,
  not an edge case. Scoring `verified − unverified` rather than `verified` is what makes silence
  cheaper than invention.
- **Everything memorable is in the first three hours.** The rate passes on the mean and hour
  twelve is `blank`. `blank_hours` and `RI-EXP04`'s curve are the joint defence; a build can pass
  this item on a mean and still fail `RI-EXP04` on shape, and both verdicts must be read together.
- **The anecdotes are all about bugs.** A build's most memorable moments being physics failures
  is a real and common outcome, and it is not a pass. The verification stage marks any anecdote
  whose frame range contains a `page error` or a determinism break as `defect_derived`, and those
  count toward `unverified`, not toward `verified`.
- **We tell the recalling agent what we need.** One helpful line in the prompt — "we're looking
  for about four specific stories per hour" — converts the entire instrument into a compliance
  test. The prompt in §D is committed and hashed for that reason.
- **Nobody runs it, because it costs twenty hours.** The most likely failure of all. It is why
  `PLAYTHROUGH-CRITIC.md` §2 makes the *absence* of this measurement a `DEAD` wave rather than a
  missing check.

---

## Provenance note

`provenance: constructed`, `confidence: medium`.

The **protocol** is constructed for this project: no upstream source defines an anecdote census,
a baton bottleneck, or a confabulation penalty. It is binding anyway per `CORPUS-CONTRACT` §3.

The **premise** — that Morrowind's durability is anecdotal rather than systemic — is
`canonical-recall` and is well supported: the persistently retold Morrowind items (Fargoth's
ring; the Census and Excise opening; Tarhiel the falling wizard and his Scrolls of Icarian
Flight; the alchemy fortify-intelligence loop; the Boots of Blinding Speed; killing a quest-
critical NPC and receiving the "thread of prophecy is severed" warning instead of a game over)
are documented in community references, and every one of them is an *event with a consequence*,
not a property of a system. The Dark Souls equivalents (the Asylum Demon you are meant to flee,
Firelink's three lethal directions, the first shortcut folding the world back on itself) are
documented likewise. That pattern is the evidence for the taxonomy in §B; the taxonomy itself is
a construction and a critic may argue with its boundaries.

The **thresholds** are the weakest part and are stated as such. `≥ 4.0 verified anecdotes/hour`
and `< 1.5` as the death line are inherited from `BAR-CRITIQUE-01` §2.3 and are *asserted*, not
derived — no reference measurement of Morrowind's anecdote rate exists or could exist. They are
defensible only relative to a control, which is why the SAB-P sabotage pair is mandatory rather
than optional: the absolute number is an opinion, the **difference from a deliberately deadened
build** is evidence. Until the control has run at least once, this item's score carries
`calibrated: false` in the verdict and may not exceed ladder 6.
