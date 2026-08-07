# W1-LIBRARY round 1 — the in-world library and the book reader

**Items:** `RI-LOR03` (the structure of an in-world book) · `RI-UIX05` (books and readable text)
**Build:** `4c90402` on `claude/morrowind-souls-threejs-game-mou39v` · `boot-check.mjs` **PASS** before and after every engine measurement · loadavg 2.18 at start, 2.56–12.77 across the run
**Score: 3 / 10 — FAIL** (wave-1 gate 7.0; aggregation `min` over the two items)
**Native:** `RI-LOR03` **3 / 5** — *below bar, remedy required* → ladder 6 · `RI-UIX05` **2 of 10 checks determined passing, 6 unmeasured** → ladder 3
**Hard fails triggered: none.** K1's hard-fail band (median outside 60–320) is clear at 126; K9's (ratio < 4) is clear at 30.72; K8 R2/R4/R8 are clear.
**`seam_sterile: true` — measured, not argued.** See §4.

---

## The one-sentence verdict

The prose is the best writing in this build and I could not find a book I did not want to finish —
and **nothing in the running game reads any of it back**: the three non-violent quest resolutions
these books were written to unlock report `you have not learned book_the_court_and_the_tide`
*identically before and after the book is opened and read to the last page in the engine*, and the
116 dialogue topics that 60 books declare they teach produce `topicsKnown: []` after all 60 have
been opened.

---

## What I set out to break, and what happened

| # | Claim attacked | Result |
|---|---|---|
| 1 | "Is it Morrowind-good?" — 13 books read end to end, sampled by a rule fixed in advance | **The writing is excellent and the corpus is still separable at 92.5% by one word** |
| 2 | RI-LOR03 step 2 (blind pair) and step 3 (author-voice), which the builder could not run | Step 3 **passes 13/13**. Step 2's protocol is **void** (no fresh judge available); its finding stands on arithmetic instead |
| 3 | "28 books contradict another book across 24 pairs" | **23 of 24 are genuine and several are excellent. One is a near-copy of its own partner** |
| 4 | "A player can act on 17" — CONSUMPTION, driven in the engine | **0 of 3 knowledge gates reachable; 0 of 116 topics delivered.** Both consumers are dead code |
| 5 | "K1's `p10 ≥ 80` is unsatisfiable as written" | **Not proven, and the builder is charged.** A last-page balancing pass lifts p10 to 82.3 |
| 6 | 37,819 words / 324 pages / 19 Argonian / 16.9% short tail | **All confirmed.** p90 passes only on the tool's own percentile convention |
| 7 | "Both tools `--self-test`; neither can pass a broken corpus" | **Both pass 28/28 on a corpus where every book's text has been swapped with another book's** |

Every probe is declared under `method_deviations`. Every engine number was taken in a real browser
at 320×240 with `setRenderRate(0)`.

---

## 1. Is the writing good, and is it Morrowind-good?

**Sampling rule, fixed before reading and stated here as required:** sort all 65 book ids
alphabetically, take every fifth (indices 0, 5, 10 … 60). Thirteen books, 7,912 words, spanning
102 to 1,466 words. No title influenced the choice.

### The writing itself

It is very good. Not "good for a generated corpus" — good. The register holds for six hundred words
at a time, the authors have positions and grievances, and the endings land:

> *A count is not a number. A count is a number that can be stood behind.*
> — `the-court-and-the-tide`, Undersexton Aveline Rell, for the instruction of clerks

> *Ojal-Weeth ends by saying that if you stand out there with your boots off, the floor is not a
> frightened thing. I have stood out there with my boots off. I agree with him about what it feels
> like. I would only observe that a strongbox does not feel frightened either, and that this is not
> usually taken as evidence about what is inside it.*
> — `the-house-built-in-fear`

> *He said: we did not forget how. We forgot what it was for, and you cannot tell the difference
> from outside, and neither can we.*
> — `the-duskfall-chronicle`

> *The third column is what was done and it has not survived at all. There is one word visible at
> the very bottom of the leaf, below the last name, in the hand of whoever closed the page:
> sufficient.*
> — `ledger-leaf`, 134 words, a scrap

> *an Imperial map of Black Marsh is a picture of eight harbours and a lot of blank paper: they
> draw what is dry, and what is dry here is about a fortieth of what is passable.*
> — `the-polers-book`

RI-LOR03's named failure state — *"books that are three sentences of exposition delivering a quest
hint in an omniscient voice"* — is absent. There is no omniscient voice anywhere in the sample.
Measured quest-hint ratio is **0.0%** against a ≤10% cap.

I read four of Morrowind's own books alongside these (`Vivec and Mephala`, `Confessions of a Skooma
Eater`, `The Pilgrim's Path`, `A Short History of Morrowind`, extracted from the vendored UESP
dump). Morrowind's are frequently flatter and more expository than ours —
*"Morrowind is holy country, and its gods are flesh and blood"* is a wiki sentence. Under
`RI-MTH03` §E that is a reason to distrust me, not to celebrate, and it is recorded as such.

### But: I measured Morrowind's actual books for the first time, and the tell is mechanical

`RI-LOR03` §1's length table is `provenance: canonical-recall, confidence: medium`, and its own
provenance note invites re-measurement if anyone can extract the game's `BOOK` records. The
vendored extract contains them. `tools/uesp/mw-book-stats.py` (written by me, declared) recovers
**241 Morrowind/Tribunal/Bloodmoon books with full text** out of 483 shipped book pages.

| Row | RI-LOR03 §1 (recalled) | Measured (241 books) | |
|---|---:|---:|---|
| p10 | ~90 | **165** | recall is 45% low |
| p25 | ~210 | **299** | recall is 30% low |
| Median | ~520 | **535** | good |
| p75 | ~960 | **1,125** | recall is 15% low |
| p90 | ~1,700 | **1,673** | good |
| Max | ~4,500 | **4,090** | good |
| Mean | ~700 | **770** | good |
| under 150 words | — | **8.7%** | ours is 16.9% |

Then the same tool counted numeral habits, and this is the finding:

| | our 65 books | Morrowind's 241 books |
|---|---:|---:|
| books containing the token **"eleven"** | **49 (75.4%)** | **7 (2.9%)** |
| occurrences | 120 | 7 |
| per 10,000 words | **31.73** | **0.38** |

**An 84× per-word rate.** Length-matched to 90–1,550 words to remove the "our books are longer"
confound: **ours 49 / 62, Morrowind 4 / 197.**

It is in an Imperial surveyor's expense claim (*"I counted eleven distinct habits"*, *"eleven days
and four ladders"*), an Argonian keeper's leave book (*"eleven hands over four hundred years"*), a
poler's manual (*"eleven of us"*), a children's counting rhyme, a toll receipt (*"eleven of us on
the quay saw it"*), a Bravil romance, a gossip sheet (*"eleven is a great many"*), and a clerk's
handbook (*"I have sealed eleven counts in nineteen years"*). Sixty-five in-world authors, one
numeric tic. `nineteen years` appears in two unrelated books as the length of a career.

**This is what RI-LOR03 step 2 asks the critic to record:** *"record what tell separated them — that
tell is the remedy."* The remedy is a lexical de-duplication pass over the numerals, not a rewrite.

---

## 2. RI-LOR03 steps 2 and 3, which the builder could not run

### Step 3 — author-voice: **PASS, 13 / 13**

The item fails the corpus if ≥3 of 12 sampled books have no answer to "what is it wrong about".

| Book | Who wrote it, what they want | What they are wrong about |
|---|---|---|
| `a-page-out-of-something` | An anonymous chapter clerk who wants a decision minuted | That someone in the chapter knows what the Ixt-Shaneekh count is a count of |
| `a-receipt-and-what-is-on-the-back` | A quayside witness with nothing to write on | That eleven witnesses will be enough to make the event survive |
| `crate-tally` | Three hands, the first of which wants the count to be eleven | The first hand is wrong about nine, and asserts it by pressing hard enough to score the paper |
| `ledger-leaf` | The Provincial Office, registering persons | That a register of names is a record of what happened to them; it has also registered someone it has no business registering |
| `on-the-tally-stones` | Aurelia Sitte, wanting her expenses approved | Calls a live Argonian tally-stone an Imperial march-marker "with ornament", having decided what the object was before counting |
| `the-account-the-marsh-keeps` | Marsh-of-Nine, refusing three Imperials and writing for her own | Supplies how people felt at events she was not born for; asserts a border she cannot demonstrate |
| `the-court-and-the-tide` | Undersexton Rell, instructing clerks | Silent on why the procedure exists, which is the question that matters |
| `the-duskfall-chronicle` | Teeus-Ahai, compiling against his keepers' advice | Thinks eleven incompatible accounts is a problem with his sources |
| `the-house-built-in-fear` | Undersexton Bel Mourne, answering a rival | Reasons about a Duskfall-era floor from the burial habits of people four hundred years downstream |
| `the-leave-book-of-thorn` | Eleven keepers, each defending their own leave | The eighth entry believes the measuring was done once because it was written down |
| `the-polers-book` | Eeja-Sul, settling arguments among polers | Prints a route that has been shut nine years because two of his eleven insist otherwise |
| `the-soulrest-sheet` | A Gideon printer selling for one drake | Reports that the Court has CONFIRMED the boxes; the Court has confirmed nothing |
| `valus-survey-fragment` | Serjeant Vale's party, surveying a road | Counts thirteen shafts. The count is wrong and the party could not have known |

Thirteen of thirteen. No omniscient-narrator contamination in the sample.

### Step 2 — blind pair: **protocol VOID, finding stands on arithmetic**

Four packs built mechanically with `tools/blind/make-pair.mjs` at seeds 1101–1104, matched on
`RI-LOR03` step 2's own taxon pairing, reveal keys in sibling `.reveal/` directories,
`answer.md` written and SHA-256'd before any `mapping.json` was opened.

**`RI-MTH03` M2 requires a judge with no knowledge of which side is which, and I built the packs.**
There is no fresh-agent channel available to a critic in this harness, so a self-judgement here
would be `How we lose #1` — the critic peeks — wearing a suit. I record the blind comparison as
**void** and leave the four packs on disk at
`corpus/90-verdicts/wave1/artifacts/W1-LIBRARY-r1/RI-LOR03-t*/` for a round-2 fresh judge.

In its place I pre-registered an arithmetic rule (hashed,
`03d5ac49b50499c08448b141c70a05de1ddcb5dbaeafd8b7f2835717d279d786`, written before any reveal):
*the side with the higher `/\beleven\b/i` rate per 1,000 words is the imitation.* Its output does
not depend on what I know.

| Pack | seed | A rate | B rate | pick | reveal | answer sha256 (first 32) |
|---|---:|---:|---:|---|---|---|
| RI-LOR03-t1 (T1) | 1101 | 1.063 | **0.000** | A | A = ours | `8c36ceffe9cccb90b5cf7f706e76c8d7` |
| RI-LOR03-t3 (T3) | 1102 | 1.605 | **0.000** | A | A = ours | `98535776dadcf2ef9ee36745cd84af36` |
| RI-LOR03-t4 (T4) | 1103 | **0.000** | 2.614 | B | B = ours | `fe994e48f0d5d72df56e3623024df830` |
| RI-LOR03-t7 (T7) | 1104 | 1.101 | **0.000** | A | A = ours | `4cf5b1303d831318670591efcf4d3c2d` |

**4 / 4, and the token is absent from every Morrowind reference.** Corpus-wide the same one-token
rule sorts 65 of ours from 241 of Morrowind's at **92.5% accuracy against a 78.8% majority-class
baseline**. RI-LOR03 step 2's fail clause — *"Fail if the critic sorts ours into a distinct cluster
at better than chance"* — is satisfied by measurement rather than by taste, which is a stronger
result than the protocol was going to produce.

**M6 leak audit, performed, and it found a hole.** The Morrowind side of pack t4 begins
*"othing is more revolting to enslaved by that derivativ moon-sugar"* — a wikitext drop-cap
artefact from the extraction. Extraction damage is a provenance channel our texts cannot have, and
any future text pack drawn from this extract must repair or truncate the first sentence.

---

## 3. Do the contradictions contradict? **23 of 24 yes; one is its partner's own text**

I read the pairs and then measured 7-gram overlap between every declared pair as a copy-paste
detector. Most are genuine, several are excellent, and the two on the house under the Stone Wastes
are the model: `the-house-built-in-reverence` argues from a burial house's habits,
`the-house-built-in-fear` walks the salt crust, paces two miles of hollow floor, finds throttled
intake shafts and facing laid to shed water *away* from the hollow, and concludes it is a container
rather than a threshold. A player could back either and neither book is corrected.

**The exception is `a-progress-ii` ↔ `pilots-chart-book`.** The registered disagreement is *"the
order of the landmarks on the Topal shore run"*, and `a-progress-ii`'s `wrong_on_purpose` field
declares three specific, checkable errors. **None of the three is in the prose.**

| `pilots-chart-book` | `a-progress-ii` |
|---|---|
| "Out of Lilmoth **you keep the fish-drying racks on your right until the smell stops**. That is not a joke and it is not approximate; **the racks run a full half-mile** and the wind off them is **the only landmark you get in the first hour**. **When you can no longer smell them you have cleared the shoal**." | "**One keeps the fish-drying racks on the right until the smell stops.** I record this without embarrassment: it is not a figure of speech, **the racks run a full half-mile**, and the wind off them is **the only landmark to be had in the first hour**. **When one can no longer smell them, one has cleared the shoal**." |
| "**hold the heading you had when you passed the trees, count a slow four hundred, and the Border Falls come up on your left ear before they come up on your eye**" | "**One holds the heading one had at the trees, counts a slow four hundred, and the Border Falls come up on the left ear before they come up on the eye**" |

7-gram overlap **5.36%**, second highest of any pair in the corpus. The declared errors:

- *"meets the landmarks in the eastward order"* — the order is **identical**, phrase for phrase.
- *"hears the Border Falls on the wrong ear"* — **both books say the left ear.**
- *"puts Lilmoth's harbour crane at Archon"* — `game/data/dialogue/rumours.json:75` ships an
  `archon-crane` rumour with a crane crew. Archon has a crane. This is not an error either.

So the joke — the plagiarist who reversed his direction and did not notice — is described in the
metadata and **not written into the book**. The prose is Vane's voice over the pilot's words,
saying the same true things. That matters beyond one pair: `wrong_on_purpose` is the field
`book-stats.py` S4d counts (8, bar ≥6) and it is never checked against the text (§7).

---

## 4. CONSUMPTION — the mandatory check, and the piece fails it twice

`tools/harness/critic-w1-library-consume.mjs`, `critic-w1-library-seam.mjs` → artifacts.
Both driven in a real browser at commit `4c90402`, boot-check PASS either side.

### 4a. The three knowledge-gated resolutions: **0 of 3 reachable**

Read the book, then reach the resolution; and as a control, don't read it. The two runs are
**byte-identical**.

| | `Q-SOUL-02 res_seal` | `Q-LILM-01 res_rootkeepers` | `Q-DEEP-01 res_broker` |
|---|---|---|---|
| book opens in the engine | ✓ 6 pages | ✓ 6 pages | ✓ 6 pages |
| **control** (unread) `why` | `you have not learned book_the_court_and_the_tide` | `you have not learned book_the_rootless_egg` | `you have not learned book_the_sap_and_the_knife` |
| **after reading, in the engine** | *identical* | *identical* | *identical* |
| `questReveal(quest, key)` | throws `no reveal book_the_court_and_the_tide` | throws `no reveal book_the_rootless_egg` | throws `no reveal book_the_sap_and_the_knife` |
| forced `questResolve` | refused | refused | refused |

The mechanism, traced after the measurement: `ctx.knowledge` is assembled in
`game/src/sim/quest/machine.js:142` from **per-quest flags prefixed `know:`** and nothing else;
the only writer of those flags is `reveal()` at `:321`, which throws unless the id appears in that
quest's `deceit.revealed_by`. **None of the three keys appears in any `revealed_by` in any quest
file** — they appear only as `requires.knowledge` strings. `book.knowledge_key` is read by
**zero code in `game/src/`**: the only readers on disk are the builder's own
`tools/analysis/book-budget.mjs:307` and a statistics counter at `game/src/engine.js:5536`.

These are three of the game's non-violent exits. They are permanently closed.

### 4b. `topics_taught`: **116 declared, 0 delivered**

`RI-UIX05` R3's permitted exception is the item's **entire declared AR-3 seam crossing** —
*"Not sterile. R3's exception is the crossing and it is a strong one: reading a book adds a
dialogue topic, and under S13 a topic can be a parley key."*

**60 of 65 books declare `topics_taught`, 116 distinct topics.** `topics_taught` is read by nothing
in `game/src/`. Opened all 60 in the engine:

```
topics_before: []
topics_after:  []
topics_gained_by_reading_every_book: []
```

Therefore **`seam_sterile: true`**, measured. The item's own justification for not being sterile is
the thing that is missing.

---

## 5. Is K1 really unsatisfiable? **No, and the builder is charged**

The builder's claim is that `p10 ≥ 80` words-per-page cannot be met because a book's final page is
partial by construction. Measured in the engine over all 65 books — **65/65 open, 324 pages, the
builder's figure confirmed to the page**:

| | n | p10 | median | p90 | min |
|---|---:|---:|---:|---:|---:|
| all pages (as shipped) | 324 | **62.3** | 126 | 153 | **3** |
| excluding each book's final page | 259 | 95.8 | 130 | 155 | 24 |

The numbers are right. The inference is not. **Thirteen books end on a page under 25 words**,
including a **3-word page** (`the-counting-rhyme`: `[127, 3]`) and a 7-word page
(`prayer-strips-tideway-shrine`: `[85, 89, 7]`). A player turns a page to read three words. That is
precisely the widow `RI-UIX05` §A **B8** already forbids — *"no page begins or ends with a single
line of a paragraph where avoidable"* — and B8 is this item's own row.

I simulated a last-page balancing pass (ordinary book typesetting: pull words back from the
preceding pages until the final page clears the floor) over the **same page counts**:

| Paginator | p10 | median | p90 | K1 verdict |
|---|---:|---:|---:|---|
| as shipped | 62.3 | 126 | 153 | p10 **fails** |
| balance last two pages | 76.0 | 122 | 153 | p10 fails, narrowly |
| balance backwards until the tail clears 80 | **82.3** | 119 | 152.7 | **p10 and p90 both pass**; median 1 short |

`p10 ≥ 80` is therefore satisfiable with the corpus exactly as written. The residual — median 119
against a 120 floor — is recovered by raising page capacity, which currently runs at a median of
126 words against an observed maximum of 172. **K1 is unsatisfiable for this paginator, not as
written, and pagination is squarely inside this item's declared scope** ("LAYOUT CORRECTNESS …
Owner: this item"). No amendment is warranted; the fix is a widow pass.

---

## 6. The numbers

| Claim | Verdict |
|---|---|
| 37,819 words in 65 texts | **Confirmed exactly**, independently recounted |
| median 609, p25 223, short tail 11/65 = 16.9% | **Confirmed** |
| 19 Argonian-authored | **Confirmed as declared** — and see §7: the field is self-declared and unverified against bylines |
| 324 pages, 65/65 open in the engine | **Confirmed in the browser** |
| 24 contradiction pairs | **Confirmed** (`book-stats.py` reports 33 *books* under a bar RI-LOR03 states in *pairs* — the label and the value disagree; immaterial at 24) |
| 0 marker/waypoint/coordinate hits | **Confirmed by `book-budget.mjs`.** `book-stats.py`'s own softer scan does hit once — `march-marker` in `on-the-tally-stones`, a boundary stone, a true false-positive. "0 hits" is true of one scanner, not both |
| §1 percentile table "parsed live from RI-LOR03, not hardcoded" | **Verified**: `parse_reference()` regexes §1's table and the fail bands out of the markdown, and `DEFAULT_BANDS` is only a fallback. Editing the item does move the bar |
| p90 = 1,264 against a bar of 1,200 | **Passes only on the tool's percentile convention.** `pct()` uses a floor-index estimator. Linear interpolation — numpy's and `statistics.quantiles`' default — gives **1,134.8, which fails**. The corpus is inside this bar by choice of estimator, not by margin |

---

## 7. Breaking the two new tools

Both advertise a `--self-test` that mutates the corpus and asserts each mutation is caught. Both
self-tests pass. **Every mutation they run perturbs the exact field the check reads** — flatten the
texts and the length check goes red; delete `contradicts[]` and the contradiction check goes red;
clear `wrong_on_purpose` and the wrong-on-purpose count goes red. Those are tautologies. Neither
tool ever asks whether the metadata corresponds to the prose.

**My mutation, which neither imagined: derange the text.** Every book's `text` is swapped with
another book's (seed 4242, no fixed points). Every other field stays exactly where it is — author,
taxon, `argonian_authored`, `contradicts[]`, `wrong_on_purpose`, `knowledge_key`, `topics_taught`.
After it, every declared contradiction points at prose that says something else entirely, every
"wrong on purpose" book is wrong about nothing, and Deelith-Who-Waits-For-Rain's byline sits on an
Imperial recruitment pamphlet.

```
python3 corpus/80-methods/book-stats.py <deranged>     13 / 13 PASS   exit 0
node tools/analysis/book-budget.mjs --books <deranged> 15 / 15 PASS   exit 0
                                     --corroborate --pagination
```

**28 of 28 checks green on a corpus where the prose has been shuffled.** D3 (corroboration) and D5
(prose directions) return the *identical* values, because both aggregate over the same 65 texts.

**Second mutation:** set `argonian_authored: true` on all 65 books, change no byline.
`S7` goes from 19 to **65 and passes harder**. The check counts a self-declared boolean; nothing
looks at the name on the book.

This is `TOOL-LOOP` rule 3 q2 — *"Can the tool fail?"* Both tools can fail on the register and
neither can fail on the writing, which is what `RI-LOR03` is for.

---

## Arbitration

**AR-1 (Souls leakage into the fight): not applicable.** Nothing in this piece touches combat.

**AR-2 (Morrowind leakage): PASS.** Quest-hint ratio 0.0% (bar ≤10%); books are not carrying the
plot. No marker, waypoint, map-pin or coordinate language in any book text. Book-to-item-description
word ratio 30.72 — lore is where AR-2 wants it, not in item text. `map_exists: false` on the reading
screen (S30). No codex, no summary, no "you have learned", no read/unread marking.

**AR-3: `seam_sterile: true`.** The item declares itself not sterile on the strength of R3's
exception; measured in the engine, that crossing does not exist (§4b). This is reported rather than
failed, per §3, and it is the substance of the biggest gap.

**CONSUMPTION: FAIL.** Two models shipped — `knowledge_key` and `topics_taught` — and neither has a
world-side consumer. Perturbing them changes no entity's behaviour because nothing reads them.

---

## The single biggest remaining gap

**`GAP-W1-LIBRARY-the-library-has-no-reader-on-the-world-side`**

37,819 words in 65 texts, opened 65/65 in the engine across 324 pages, and **the only thing a
player can do with any of it is read it**. Both mechanical consumers the two items name are dead
code:

1. `book.knowledge_key` (65 books, 4 keyed) is read by no file in `game/src/`. Three non-violent
   quest resolutions gate on those keys and are unreachable by any route in the shipped build.
2. `book.topics_taught` (60 books, 116 topics) is read by no file in `game/src/`. This is
   `RI-UIX05` R3's permitted exception and the item's entire declared AR-3 seam crossing.

**Remedy, and it is small.** In `game/src/ui/system.js`'s `open('book', …)` path — the one place
that already resolves a book record and already knows the reader is the player — fire a single
callback into the quest engine on first open of each book id:

- for every `t` in `book.topics_taught`, append to `sim.quest.topicsKnown` through
  `sim/quest/topic-supply.js`'s fold-safe appender (it exists and is already the correct door);
- if `book.knowledge_key` is set, write `know:<key>` into the record of every open quest whose
  `requires.knowledge` names it — or, cleaner, promote `ctx.knowledge` in
  `sim/quest/machine.js:142` to also union a new `sim.quest.booksRead` set, which is one line at
  the read site and one at the assembly site.

Both are additive, neither touches quest data, and the acceptance test is the probe already
written: `node tools/harness/critic-w1-library-consume.mjs` must show `available: true` after
reading and `false` before, and `critic-w1-library-seam.mjs` must show a non-empty `gained`.
Persist `booksRead` in the save, or a load will silently close the doors again.

Until then, RI-UIX05 §D's row *"Books readable before the quest that references them ≥10"* — the row
the item says *"owns whether the reading surface is connected to anything"* — reports 17 by reading
JSON and 0 by asking the game.

---

## Secondary observations

1. **The `skill book` overlay is at 1 of ≥26**, and 65 texts against RI-LOR03 §2's target of 112.
   Both are the builder's own admissions and both stand. The shape is in band; the count is not.
2. **`game/data/world/opacity.json` still does not exist**, so the 24-mystery register cannot be
   verified. Pre-existing, not this builder's, and correctly flagged. `--leak-scan` is **CLEAN**,
   2,607 strings, re-run by me.
3. **RI-LOR03 §1 should be amended** with the measured Morrowind figures in §1 above, old figures
   struck through, per its own provenance note. `tools/uesp/mw-book-stats.py` exists now.
4. **RI-UIX05 §C's prohibition scan should be scoped to element kinds, not page text.** The builder
   reworded three books to avoid a false R1 hit on in-fiction prose ("PREFACE, WHICH THE READER
   WILL SKIP"). Rewording fiction to satisfy a UI scanner is the wrong direction of causation and
   the next library will hit it again.
5. **`book-stats.py` S4a's label and value disagree** — "books that contradict another book"
   compared against `contradiction_pairs_min`, which RI-LOR03 states as a count of *pairs*.
6. **Six of RI-UIX05's ten checks (K2, K3, K5, K6, K7, K10) have been run by nobody.** Line length,
   leading, size, contrast, turn latency, T5 persistence, the pause rule and the art-neutralised
   layout blind pair are all unmeasured on this build. `tools/analysis/text-metrics.mjs` has never
   been pointed at the reading screen. They are scored `unmeasurable ⇒ 0` here and they are the
   round-2 measurement list.

---

## What is genuinely good, and should not be lost in a fix

The builder found and closed eight book ids that shipped quests already required and that did not
exist, three sealed-mystery evidence books, and two disputed registry facts (`CF-D004`, `CF-D006`)
that had no in-world source anywhere in the game. It caught an id collision
(`what-the-water-took`) that would have made one of two books silently unreachable through the
engine's `Map`. It built two instruments for methods that named phantom tools, and the `--compare`
argument really does parse the reference item rather than decorate the command line. The library it
wrote is, sentence for sentence, better than the corpus it is imitating.

None of that is worth anything until something in the game reads it back.
