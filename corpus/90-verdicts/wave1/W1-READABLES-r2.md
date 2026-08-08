# W1-READABLES round 2 — critique

**The quest reveals and the documents that carry them.** Never judged before.

**Verdict: FAIL at 6.5, min-over-axes, against a wave-1 gate of 7.0.** This is a near miss on a
piece whose central claim is true and reproduces. Two axes sit below the gate and both are cheap
to close.

Commit under test: `64dd5f9` (the tree moved to `6ff493f` and `9aeb839` under me while I worked;
every number below was re-taken and the browser runs are stamped in their own reports).

---

## What is actually true

I rebuilt the piece's headline census from `game/data/**` and `game/src/**` with an instrument the
builder did not write (`tools/quests/critic-unrouted-census.mjs`) and it lands on the same numbers
to the row:

| | builder | critic, independently |
|---|---|---|
| (quest,reveal) pairs a resolution demands | 121 | **121** |
| with a route in play | 100 | **100** |
| with none | 21 | **21** |
| ledger / letter / environment / book | 28/28, 7/7, 16/16, 6/6 | **identical** |
| document rows no resolution demands, unwritten | 12 | **12** |

And I reproduced the world-side proof. `mark-route-world` runs 4 legs and passes 4; the delete-the-
fix on a copy of `game/` with the mark branch in `_takePropPending()` made dead goes **4 of 4 → 0
of 3**, with the fourth leg unreachable because Q-MAIN-12 sits behind a Q-MAIN-11 that can no
longer be finished. That is the number the builder published, taken again.

The piece did the hard thing. 63 of the 121 named sources did not exist — ledgers nobody had
written, four "sources" that were English sentences — and it wrote them, placed them, and routed
them through one line in `CHANNEL_READERS`. That is worth saying plainly before the rest.

---

## A. The prose — 6.5

I read a substantial sample end to end. It is good. It is much better than the failure state
`RI-LOR03` names ("three sentences of exposition delivering a quest hint in an omniscient voice").
The Blackrose counterfoils are the best thing here and the arithmetic is exact — 197 returned plus
411 marked *again* is 608 stubs entered, and the run adds up:

> Note by the third clerk, at the foot of the leaf, and the hand is not a careful one: I have been
> told to write again and I have written it. […] A term is renewed with the leaseholder. Renewed
> with whom, on stub 65?

That last question is the right technique: it points at the fact instead of stating it. The
shortfall series is exact too — 96 parts at reign two, 71 at reign eight, 64 at reign ten; "already
falling by twenty-five parts before the first crew took the first tree, and it has fallen by seven
since" checks to the digit. The daughter's letter earns its ending by not writing it:

> Docketed at the harbour office in the clerk's hand: received, read, no action, filed with the
> minute book.

**Now the countable problems.**

**One document is told by nobody, and it is the one the brief singled out.** In
`the-unsealed-chits`, three days of figures are on the page — 380 taken against 312 entered, 440
against 360, 310 against 248 — and then a paragraph in no one's voice does the division for the
reader:

> The count of chits agrees every day. It is only the figures that do not, and the figures do not
> agree by about a fifth, and it is never the same fifth twice.

The only speaker in that document has already said "I am not a counting man. I can't rule a column
and I don't want to." So the analysis is attributed to nobody, contradicts the document's own
voice, and hands over the exact inference the three rows of numbers were placed there to produce.
This is `RI-LOR03`'s named failure — *"no narrator standing behind it to correct that fact"* —
inverted: a narrator standing behind it to do the reader's arithmetic. It is one paragraph and one
deletion.

**Nineteen of twenty-six documents close on the same beat.** The final paragraph is a statement
about where the paper lives and whether it is locked: *"the hall's copy is not to leave the hall"*,
*"in the same press and are not ruled up"*, *"the bundle is tied with tape, and the tape is not
sealed"*, *"the press is not locked"*, *"kept in the gallery and is not sealed. Anyone of any
hollow may read it and four people ever have"*, *"on the gallery shelf, unlocked"*. Each one is
lovely and the intent is clear — it is an in-fiction excuse for why the player may read a secret.
Read twenty-six in a row and it is one chord struck nineteen times, and the reader learns the shape
by the fourth. `the-wharf-float-book` is the exception that shows the rest how: *"But the pencil is
still on the string by the door"* is an image, not an inventory note.

**All eight questions in the corpus are the same rhetorical figure.** "Renewed with whom, on stub
65?" / "What is weighed on a counting floor?" / "what becomes of these?" / "A shield against what?"
/ "Whose hand takes a matter off a list?" / "Where do you think the fifth went?" / "Whose hand is
against my father's seat?" / "Then how would a reader tell a re-copied clause from a new one?" —
a short interrogative appended after the data, four to eight words, in the marginal-note slot.
Eight different people — a prison clerk, a gate-hand, a garrison clerk, an Assize Legate, a court
clerk, a smuggler, a grieving daughter, a monk — who have never met, all reach for the same figure.
That is one author wearing eight hats. `check-prose` gates on a question *floor*, and the builder's
own status file says the first draft had zero questions and zero exclamations; eight identical
questions is what writing to that floor produces.

**The numeral tic, measured against the corpus's own measured reference.** `RI-LOR03` publishes
`eleven` at **2.9%** of 241 Morrowind books. Across these 26 documents:

| token | share of the 26 documents |
|---|---|
| `four` | **76.9%** |
| `fourth` | **61.5%** |
| `eleven` | **30.8%** (reference: 2.9%) |
| `forty` | 34.6% |
| `ninth` | 30.8% |

`check-prose` reports this file `ok` with "no tic" because `TIC_ELEVEN_FILLER` was deliberately
narrowed to `eleven` before a noun of degree, and the eleven motif is a declared design decision I
am not relitigating. But five of the twelve elevens here are `eleven <span>` — *eleven days late*,
*eleven years*, *eleven seasons*, *eleven paces*, *eleven-year leaf* — which is the filler shape the
rule was narrowed away from, and nothing in the gate looks at `four` at all. Four clerks in
succession, the fourth clerk, Book four, Fourth day, four returns, four hundred and eleven, four
hundred years, four seats, four seasons, the fourth writ, four of the nine are mine, four people
ever have. Handed one of these and one of Morrowind's unlabelled, I would pick ours.

Five of twenty-six also open with an unattributed explainer paragraph telling the reader what kind
of document this is — *"The stub is what is left in the book when the lease is torn out"*, *"A chit
is written at the gate by the hand who takes the toll"*. A stub book does not explain what a stub
is. The other twenty-one open with a proper document heading and are right.

**Lines that tell the player what to conclude: eight, across twenty-six documents.** Most are
in-fiction and defensible (a clerk's protest note is a real document form). Two are not:
`the-unsealed-chits` above, and the kin list's second hand, which delivers the conclusion in the
second person — *"A list of who will be listened to is a list of the people you send to persuade. A
list of who is related is a list of the people you can hold answerable"* — after the data (31 of 40
names carry a kin) has already said it.

---

## B. The chain number, and the `questNote` at line 262 — 8.0

**The brief's premise is misdirected, and I checked rather than assumed.** `H.questNote` does not
appear in `tools/quests/document-route-world.mjs` at all. The 5 → 10 → 28 headline was never
touched by it. The unconditional call is only in `mainline-chain-floor.mjs`, which reports 0/40 and
which the builder correctly says it does not own.

I still tested it, because `hooks.json` has 121 `entry_topics` rows and
`Q-MAIN-05#30 -> the-cutting-yard` is exactly the topic Q-MAIN-06 opens on, so the hand-feed has a
plausible path into the offer gate. `tools/quests/critic-chain-headless.mjs --no-topic-grant`
reproduces `mainline-chain-floor`'s grant regime — only the bootstrap topic, and the AddTopic graph
must carry the rest — and the four arms are **byte-identical with and without the questNote
hand-feed**. It is not carrying the chain. The builder's conclusion is right; its stated reason
("it cannot write a `know:` flag") is right about reveals and beside the point about topics, and it
happens not to matter.

**A finding the builder did not report:** `tools/quests/viability-walk.mjs` lists `questNote` in
`DENIED_VERBS` with the reason *"journal progress the walk decided rather than played … the walk
asserting the thing it is supposed to be measuring"*, while its sibling `mainline-chain-floor.mjs`
calls it unconditionally. Two instruments in the same directory disagree about the same verb. That
is one comment and one flag for whoever owns the walk.

---

## C. The fence, and whether the piece graded itself — 8.0

The builder was right about the mechanism (`mainline-chain-floor`'s allow-list has no
`enterInterior`, no `teleport`, no `stepFrames`) and right to decline to widen someone else's
fence. But the consequence was real: the headline came from **the builder's own tool, extended in
the same round**, and nothing else in the project could check it.

So I did not widen the fence either — I built a different instrument.
`tools/quests/critic-chain-headless.mjs` plays the same 32 quests through the real `QuestEngine`
and the real `gate.js` in node, with no browser and therefore no contention cost:

| arm | builder (browser) | critic (headless) |
|---|---|---|
| `neither` | 5 of 32, stops Q-MAIN-06 on `rev_the_curve_predates` | **5 of 32, same stop, same reveal** |
| `reading_only` | 10 of 32, stops Q-MAIN-11 on `rev_the_rhythm` | **10 of 32, same stop, same reveal** |
| `looking_only` | not run | 5 of 32 — the documents are the first wall |
| `reading_and_looking` | 28 of 32 | 18 of 32 |

**Two of the three published arms reproduce exactly on an instrument the builder did not write.**
The third does not, and the gap is mine: I pass `gates = null`, so faction rank is unrepresentable,
and the browser arm clears Q-MAIN-19 with `res_cutters_rank`, a faction-rank resolution that needs
no reveal at all. I checked that against the builder's own chain artifact rather than assuming it.

**Delete-the-fix, independently:** `--falsify no-books` takes `reading_only` 10 → 5 and
`reading_and_looking` 18 → 5; `--falsify no-router` takes `reading_and_looking` 18 → 10 with the
document half intact. The two halves are separable and both bite.

**And the honest attribution of the 28**, which the builder did not publish. Of the 28 steps the
best arm completed: **12 needed no reveal at all**, 5 were carried by a document, 5 by a mark, 5 by
W1-18's person channel, 1 by the hook table. So 10 of 28 belong to this round — and they are the
ten that move the wall, which is the claim that matters.

---

## D. CONSUMPTION and delete-the-fix — 8.0

`RI-MTH07` is satisfied and I verified it in the running game rather than reading the report.
`mark-route-world` at `64dd5f9`: 4 legs run, 4 pass. `knows [] → ["rev_shaft"]`, refusals naming
`rev_shaft` 2 → 0, screen `world → world`, control 1 out of reach learns nothing, control 2 at the
wrong mark leaves the refusal at 2.

**The teardown bites, and it is not the W1-04 shape.** I made my own copy of `game/` under the
scratchpad, killed the mark branch in `_takePropPending()`, and ran the same tool: **4 of 4 → 0 of
3.** Per rule 6 I checked specifically that the teardown does not null a handle the off-branch tests
for. It does not: in both arms the tool finds the prop, stands 0.9 m from it, and the screen stays
`world` — the mark still spawns and is still reachable. The only thing that changes is what the
press does (`knows [] → []`, refusals 2 → 2). The two arms genuinely differ on the primary
observable in every leg that ran. This is a live fix, not two guards for one defect, and not an
inert control. I confirmed the working tree's index was clean of `game/src/engine.js` before and
after (rule 17).

---

## E. The 21 still unrouted — 6.5, and a correction that costs the next round real work

The count is right: **9 eavesdrop + 1 corpse + 11 person rows = 21**, and 12 unwritten document
rows no resolution demands. My independent census agrees on every one.

**But the builder's list of the 11 missing people is wrong in composition.** It appears to have
been taken from the audit's 15-row print, which includes rows no resolution demands, rather than
filtered to the demanded set. It names three people who block nothing and omits three who block
everything:

| in the builder's list, but in no unrouted demanded row | omitted, and the actual blockers |
|---|---|
| `npc-ineel-sa` | `npc-fourth-day-boatman` — Q-XULA-14 / `rev_the_boat` |
| `npc-widow-tesla-vor` | `npc-high-hollow-speaker` — Q-XULA-12 / `rev_the_high_hollow` |
| `npc-river-band-elder` | `npc-uneel-vaakh-sister` — Q-XULA-11 / `rev_his_sister` |

A next round writing the cast list from the status file builds three people who unblock nothing and
misses three who do. The correct eleven are printed by `node tools/quests/critic-unrouted-census.mjs`.

**A refinement the builder did not make**, which changes the shape of the eavesdrop job: **7 of the
9 eavesdrop rows name NPCs that already exist**, and so does the corpse row. Only `captain-oreem`
and `rootkeeper-under-the-temple` are missing. So the eavesdrop bucket is 7 rows of pure reader work
against `sim/stealth` and 2 of reader-plus-record, not 9 of unknown cost.

### Acceptance numbers for the next round

| bucket | rows | acceptance |
|---|---|---|
| eavesdrop, sources that exist | 7 | a proximity-and-not-noticed reader against `sim/stealth`; `reveal-route-audit` section for `eavesdrop` goes 0/9 → 7/9; a control in which the player is *noticed* learns nothing |
| eavesdrop, sources missing | 2 | records for `captain-oreem`, `rootkeeper-under-the-temple`; then 9/9 |
| corpse | 1 | a search-a-body action; `corpse` 0/1 → 1/1; `npc-sexton-ivo-sarn` already exists |
| person rows with no record | 11 | the eleven names above; `talk_to_target` 18/28 → 28/28, `rival_npc` 22/23 → 23/23 |
| all four | 21 | `reveal-route-audit` exits **0** for the first time |
| unwritten document rows | 12 | no resolution demands any of them; not blocking, and `check-quests` names all twelve every run |

---

## F. The two browser defects — 8.0, both hold

Re-taken in the running game with one browser
(`tools/quests/critic-readable-slots-and-marks.mjs`, report under
`reports/runs/CRITIC-W1-READABLES/`), and deliberately wider than the builder's check.

**F1 — the slot allocator.** Not just the room that broke: **all 83 interiors that carry a
readable**. Zero have a pair under 2.6 m. In the busiest, `soulrest-court-steps`, 15 of 15 declared
readables spawn, I stood at each in turn and pressed the button, and **14 presses opened 14 distinct
documents with no collision**. The defect is gone and the claim that matters — the right document
opens — holds.

**F2 — zero marks after `reset()`.** This is the one that comes back, so I counted it nine times,
not once: **36 marks after each of six consecutive resets**, 7 marks inside
`helstrom-undertemple` (the province set correctly cleared), 36 again on the way out, 36 after a
reset following the round trip. It holds. The fix is three guards — `clearProps()` forgets the flag,
`_ensureProvinceMarks()` distrusts the flag while no mark is in `sim.props`, `_syncCell()` repairs
before `_applyCell()` — which is over-guarded rather than wrong, and I am not scoring that down.

**Two residuals, both small:**

- `soulrest-court-steps`'s closest pair is **exactly 2.6 m** — the allocator is saturated in that
  room at 15 documents. A sixteenth breaks it again with no check to catch it. The 2.6 m minimum
  should be asserted by `check-quests`, not just satisfied.
- `interior-readable:soulrest-court-steps-readable` ("The Chapter's Vote") is the one press that
  opened nothing: it declares a `title` and no `book`, so it is a readable that reads as nothing.
  Pre-existing, not this round's, but it now stands in a room this round crowded.

---

## G. The shared chart font — 6.5, and it is bigger and different from what was reported

The builder reported this and did not fix it, which is the right instinct. But the published
diagnosis is wrong in mechanism and the scope was never checked.

**It is a shear, not a truncation.** The reported cause was "23 characters read as 35, so the last
two pixels of the fifth row of every character are `undefined`". The font is a **25-character 5×5**
bitmap, and the two missing characters are deleted from the **middle** of the string, which shifts
every row below each cut one pixel left. `tools/quests/critic-glyph-audit.mjs` proves this
constructively: for each shipped glyph it searches every pair of deletion positions in the
builder's own re-authored digit and finds the pair that reproduces the shipped string exactly
(digit `3` is the sound glyph with characters 4 and 14 removed; digit `5` with 14 and 19). Three or
four of five rows are wrong per digit, not one corner.

**It is in nine chart tools, not one.** `critic-glyph-audit` reads every tool in the tree that
indexes `bits[j * 5 + i]`: `critic-w1-12-chart`, `w1-01-r4-crossing-chart`, `critic-souls-r3-chart`,
`w1-souls-ledger-chart`, `w1-12-chart`, `w1-13-r4-chart`, `ambience-determinism-chart`,
`ambience-onsets-chart`, `w1-15-r3-chart` — 50-odd glyphs each, all ten digits, all sheared.
`tools/dialogue/w1-17-shot.mjs` is the only chart tool in the repo with a sound font (a real 5×7 at
35 characters) and is untouched. **Every number ever read off a picture produced by those nine tools
is suspect**, and that is the brief's question answered: nine tools, not one.

**And "on letters it is invisible" is falsified by the round's own published picture.** Open
`docs/shots/2026-08-08-w1-readables-r2-the-marks-and-the-ledgers-that-now-exist.png`: the digits are
correct (the fix worked) and the letters are not. "BOOK" reads as **POOK**; "BY CHANNEL" reads as
**PY CHANNEL**; the title runs off the right edge mid-word. The B is drawn as a P. A rule-27
deliverable whose job is to show a non-developer the result is showing them a misspelling.

The narrow fix under the round's own flag is correct and I would not have asked for the 37 letters
to be re-authored by eye. What was missing is one `grep` and one honest sentence about scope.

---

## Biggest gap

**`GAP-W1-READABLES-the-mark-teaches-nothing-to-the-journal`** — `world.quest.journal`

Looking at a mark writes a `know:` flag and **no journal entry**. My own re-run shows it on all four
legs: `journal [10] -> [10]`, before and after, on every one. The person channel writes both — 37
journal entries from play, which is half of what W1-18 was for — and the environment channel writes
one. The builder states this plainly ("I did not author `revealed_by[].journal` indices for any mark
row") and it is the largest hole left in the shipped mechanism.

It matters because Morrowind owns the journal (`ARBITRATION.md` §1) and the doctrine is a numbered,
dated, first-person-authored record of what the character came to know. A character who walks to the
flooding road, watches it fill, and can now argue `res_walk_it` — with a journal that says nothing
happened between opening the quest and finishing it — has a knowledge model the journal cannot
corroborate. It is also the difference between the two channels this project has now built, for no
reason other than that nobody has picked the indices.

**Remedy.** Author `deceit.revealed_by[].journal` for the 16 demanded environment rows (25 mark
placements, 16 of which a resolution demands), against the prose, the way W1-18 hand-picked its 37.
The schema field, the `note()` pre-checks and the `check-quests` guard all already exist; this is
authoring, not building.

**Acceptance:**
1. `reveal-route-audit` section E reports a journal write on every one of its 15 legs, not zero.
2. `mark-route-world` shows `journal [10] -> [10, n]` on all 4 browser legs.
3. `check-quests` stays green and its self-test stays 10/10 (the terminal-entry and
   backwards-write guards already refuse a bad index).
4. `--falsify` the indices away and the journal counts return to zero.

---

## Other gaps

- **`GAP-W1-READABLES-the-handoff-list-names-the-wrong-people`** (`world.quest.reveal_routing`,
  blocking the next round's cheapest task). Three of the eleven names are not blockers and three
  blockers are unnamed. Acceptance: the status file's list matches
  `node tools/quests/critic-unrouted-census.mjs`.
- **`GAP-W1-chart-font-sheared-in-nine-tools`** (`method.instrumentation`, blocking every published
  picture with a number on it). Acceptance: `node tools/quests/critic-glyph-audit.mjs` exits 0.
  The sound 5×5 digits already exist in `reveal-route-chart.mjs`; the 37 letters need one careful
  pass by the font's owner.
- **`GAP-W1-READABLES-slot-separation-is-satisfied-not-asserted`** (`world.readables.placement`).
  The busiest room sits at exactly 2.6 m. Acceptance: `check-quests` fails the commit on any two
  readables in one interior under 2.6 m; proved red by moving one.
- **`GAP-W1-prose-numeral-tic-ungated-on-four`** (`books.content`). `four`/`fourth` in 77%/62% of
  the 26 documents, `eleven` in 31% against `RI-LOR03`'s measured 2.9%. Acceptance: a `check-prose`
  rule over the numeral distribution rather than one narrowed pattern, with the reference published.
- **`GAP-W1-questnote-denied-by-one-tool-called-by-its-sibling`** (`method.instrumentation`,
  cosmetic). One flag on `mainline-chain-floor.mjs:262`.

---

## What I could not do

- **I did not re-run `mainline-chain-floor.mjs`'s 40 signatures with `questNote` removed.** The
  contention gate returned WAIT (exit 3) twice and I spent the browser budget on the two attacks
  that need a browser and cannot be done any other way (D and F). The question is answered on a
  headless instrument under the same grant regime instead, which is corroboration and not proof for
  that tool specifically. It is also of limited value: the tool reports 0/40 either way.
- **My headless `reading_and_looking` arm is 18, not 28**, because it passes `gates = null` and
  cannot represent faction rank. I say so rather than publishing 18 as a correction.
- **I ran one browser at a time and proceeded past the per-core ceiling** for the two `mark-route-
  world` runs (load 6.19–6.52 per core against a ceiling of 4.0, 4–5 instances against 6). Rule 21
  permits it if declared; it is declared here and in my status file. **No timing figure appears
  anywhere in this verdict** — every number is a count or a boolean.
- I did not judge a blind pack (rule 25 — none was built for this piece), and I edited nothing under
  `game/` or in the authored text.

---

## Score

| axis | score |
|---|---|
| `books.content` — the 26 documents | 6.5 |
| `world.quest.reveal_routing` — the census and the hand-off | 6.5 |
| `world.quest.chain_reach` — the 5/10/28 claim | 8.0 |
| `method.consumption` — RI-MTH07 and delete-the-fix | 8.0 |
| `world.readables.placement` — the two browser defects | 8.0 |
| `method.instrumentation` — the chart font and tool honesty | 6.5 |

**Min-over-axes: 6.5. Gate: 7.0. FAIL.**

This is a strong round that misses. The mechanism is real, the content is real, the consumption
proof is real and the delete-the-fix bites. It fails on two things a single sitting closes: a
hand-off list built from the wrong query, and a reporting defect that was found, half-diagnosed and
never scoped. Neither touches the engine.
