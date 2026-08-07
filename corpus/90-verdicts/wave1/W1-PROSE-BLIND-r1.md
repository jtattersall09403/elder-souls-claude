# W1-PROSE-BLIND-r1 — the blind judgement on our in-world prose

**Judge:** fresh-context blind judge, no browser, no part in building either pack.
**Packs:** `reports/packs/prose-tics-r2/` (15 trials, seed 20260807) and
`reports/packs/prose-tics-voice-r2/` (5 trials, seed 20260808).
**Protocol:** `corpus/80-methods/RI-MTH03-blind-comparison-protocol.md`.
**Status:** admissible with a recorded protocol defect (see §2). Score 6/10 against a gate of 7.0.

This verdict exists because the W1-LIBRARY round-1 critic voided its own blind judgement — it had
built the packs it graded — and the prose-tics builder then built two more packs and deliberately
answered neither. RI-MTH03 M2 requires that the assembler is not the judge. I assembled nothing.

---

## 0. Sampling rule, declared before sampling

Recorded in `orchestration/status/judge-prose-packs.json` before the first artifact was opened:

1. Answer **all 20** available trials in directory order. No cherry-picking, no dropping a hard one.
2. Open **no** file under any `*.reveal/` directory and **no** builder report until all 20
   `answer.md` files exist on disk.
3. Rewrites: take `reports/prose-tics/rewrites/dialogue-0{3..6}*.jsonl`, sample the **first 10 and
   last 10** records of the largest file. A positional rule, not a taste rule.
4. Post-sweep quest material: list the topic files mechanically by mtime, read the largest by info
   count in full, plus **every** info containing *"eleven"*.
5. Martial library: check completeness only; judge nothing unfinished.

All five were followed. One tool was written mid-run and is declared in §7.

---

## 1. The result: 20 of 20

Every `answer.md` was written and hashed **before** `mapping.json` was opened. The hashes are in
the JSON sidecar and in the pack directories, so the ordering claim is checkable after the fact.

| Pack | Trials | Correct | Chance |
|---|---|---|---|
| `prose-tics-r2` (books 5, dialogue 5, journal 5) | 15 | **15** | 3.1 × 10⁻⁵ |
| `prose-tics-voice-r2` (dialogue) | 5 | **5** | 0.031 |
| **Total** | **20** | **20** | **9.5 × 10⁻⁷** |

I could tell every time, at every length, in every register, with no hesitation on nineteen of the
twenty. **Our prose is trivially distinguishable from Morrowind's by a reader.** That is the
headline and it is not a good one.

### But read the question the pack actually asked

The packs ask *"Which of these two is the imitation?"* — a **provenance** question. RI-MTH03 §D's
default text question is *"which was written by a game writer for a shipped RPG, and which is
placeholder?"* — a **quality** question. Under a provenance question, picking ours is always
"correct", so §E's `picked-reference` / `picked-ours` rows are not both reachable and the
protocol's sharpest rule — *if the critic picks ours, distrust the critic* — is inoperative.

So: **20/20 means our writing is identifiable. It does not mean our writing is worse.** On the
five books trials I judged our side to be the better piece of writing four times, and said so in
the answers before the reveal (t01 *"A is a better piece of writing than B, and 'the better-written
one is the imitation' is exactly the inference a judge should distrust"*). A pack that asks
"which is the imitation" cannot record that. **This is the first thing to fix.**

---

## 2. The protocol defect: §M6 leak audit fails

RI-MTH03 §B says text artifacts have `morrowind`, `reference`, etc. replaced with `[REDACTED]`.
**There is not one `[REDACTED]` token in any of the 40 files.** The stripping was never applied.

Consequence, measured after answering:

> Count Tamriel setting proper nouns — *Vvardenfell, Ebonheart, Vivec, Balmora, Septim, Tamriel,
> Cyrodiil, Skyrim, Ashlander, Dunmer, Telvanni, Hlaalu, Khajiit, Hircine* — plus un-stripped wiki
> template residue. The side with more is the reference.
>
> **That rule scores 17 of 20, with 3 ties: 17/17 on every decidable trial, without reading a word.**

The residue is blatant where it appears. `t01-books/B.txt` opens
`he first volume|OBlink=OB:Brief History of the Empire, v 1|SRlink=SR:Brief History of the Empire, v1 of this series…`
and carries blanked year fields (`conquered Roscrea in ,`). `t03-books/B.txt` contains
`MWlink=Morrowind:Dagoth Ur (god)` — the literal string the stripping table names.

I flagged this in my `t01` answer as a defect rather than using it, and my evidence bullets
throughout cite prose features. But **I cannot prove I was uninfluenced**, and a verdict that
rests on "trust me" is the thing this protocol exists to avoid. So:

### The clean subset

Three trials where the name channel is uninformative — both sides zero setting nouns:
`prose-tics-r2/t10-dialogue`, `prose-tics-r2/t12-journal`, `prose-tics-voice-r2/t05-dialogue`.

**3 of 3 correct**, each on cited prose evidence (combinatorial fragment recombination;
branch-table architecture versus literary journal; zero contractions plus a two-beat epigram).
p = 0.125. Suggestive, not conclusive. **This is the only uncontaminated part of the 20/20**, and
it is the number a successor should quote if pressed.

**Remedy, and it is cheap:** `build-r2-packs.mjs` should map *both* sides' setting proper nouns
through the same substitution table before writing the pack — every place name to `[PLACE-1]`,
every race name to `[RACE-1]`, consistently within a trial. That removes the channel without
touching a comma of the prose. Until it does, no blind text result from this wave is fully trusted,
per §M6's own instruction.

---

## 3. What actually gives us away, in a reader's terms

Three tells. Only the first is a token, and it is the least important.

### 3.1 Nobody in our world asks the player anything

The strongest reader-level tell in the whole exercise, and it is countable.

| Across the 10 dialogue trials | Ours | Morrowind |
|---|---|---|
| Question marks | **4** | **76** |
| Exclamation marks | **0** | **3** |

Nine of the ten trials had more questions on the reference side; the tenth was a 2–2 tie. A judge
armed with nothing but *"the side with fewer question marks is ours"* scores **9/10**. That is a
better one-token rule than *"eleven"* ever was, and — unlike *"eleven"* — no find-and-replace can
move it, because asking a question means writing a character who wants something from you.

Morrowind, `t08-dialogue/A.txt`:

> "Are you naturally unpleasant? Or do you have to work at it? Because you seem to have a gift for
> making enemies."
> "Are you okay? You don't look well..."
> "And how do you plan on doing that?"

Ours, the same trial, 280 words:

> "The muster is on the board and it is short again. Orders?"
> "What. This one is working. If you have business, state it."

Two interrogatives in the bundle, both single words, both a clerk processing a queue. Nobody is
curious about the player. Nobody is worried about them. Nobody argues back. The live figure is
`SR-05: 24.43 vs 158.83 per 10k = 0.2×` and the pass moved it from 19.26 — essentially not at all.
The builder named this as the largest remaining defect and was right.

### 3.2 Every line lands. Nothing is allowed to be flat.

This is the tell I did not expect and it is the one that matters most, because it is invisible to
every metric in the corpus.

Our prose cannot end a sentence without a reversal, an epigram or a withheld beat. Sampled from
`55-utility.json` — 34 topics, 102 infos, authored *after* the prose pass:

> "That is not a mistake, dry-one. **A mistake happens once.**"
> "He tells everyone that twice, and **he will not send one of us in for a crate of lamp oil.**"
> "They came down the coast with a paper that said they were allowed to take cuttings.
> **We are the cuttings, friend.**"
> "It is a number people at Blackrose will not repeat, **which is how everyone else came to know it.**"

Four consecutive topics. Four punchlines. In the blind trials this ran through every register:
*"Entered at nil."* (books t01), *"Thieves take once."* (dialogue t07), *"The third is why the
record has a gap in it."* (voice t02), *"and I did mine first and he did not know I had done it."*
(journal t12). And the rule-of-three joke, twice in one pack:

> "Nine bands on this river. Six will feed you. Two will take your boat. One will do both and be
> offended if you mention it." — `t09-dialogue`
> "Fourteen this season and nine of them to fever, which is not a number I put on the return."
> — `voice t05`

Morrowind's dialogue is mostly **flat**:

> "He's a bookworm. Try a bookseller."
> "It's white and wet. What more can I tell you?"
> "A miserable place, from what I've heard. Too cold for me."
> "Nothing there but a big rock. Don't know why anyone cares about it."

And *because* it is flat, its good lines land. Ours has no flat lines, so nothing stands out;
102 punchlines in a row is the same as none. This is what an LLM does when it is trying: it
optimises every sentence locally and never writes a dull one, and a world made only of good lines
reads as a world nobody lives in. **No regex will find this. A reader finds it in four lines.**

### 3.3 Repetition of the wrong kind

Both corpora repeat. They repeat differently, and the difference is the fingerprint.

Morrowind repeats **whole lines**, because several NPCs share a topic. `t07-dialogue/A.txt` has
the Mossanon reply three times, identical, 45 words each. That is a database.

We repeat **fragments in shuffled pairings**. `t10-dialogue/B.txt`, our hostile-faction barks:
*"Paper. It burns."* ×5, *"One of the drowned ones, then."* ×5, *"Something with dry feet."* ×4,
*"Ash and salt. Nothing grows in either."* ×3 — recombined in different orders against different
partners. That is a slot machine, and it reads like one. Our journal does the same with boilerplate:
`t11-journal/B.txt` carries *"There is more than one way at this. There always is; the trick is
noticing the second one before you have used the first."* twice in one bundle, an entry generic
enough to sit under any quest.

---

## 4. The 180 rewrites: a real pass that left a new fingerprint

**Verdict: they read as a person talking, and they manufactured one new tic doing it.**
Not a failure. Not clean either.

The three operations, visible in all 20 sampled before/after pairs, applied together on nearly
every line: contract the negations; split the and-chain at its commas; promote the trailing
`which is X` clause to a sentence.

> **Before:** "It is grey and it is heavy and it does not go off for a week, dry-one, and I have
> been given it in nine settlements and it has been the same bread in all nine, which is comforting
> in a way I cannot explain."
>
> **After:** "It's grey, it's heavy, and it doesn't go off for a week, dry-one. I've been given it
> in nine settlements and it's been the same bread in all nine. Which is comforting, in a way I
> can't explain."

**The good news.** That is genuinely better in the mouth, and it moved `SR-08` — sentence-initial
And/But/So, a *contraction-blind* rule — from 7.57 to 26.68 per 10k. A find-and-replace cannot move
a contraction-blind rule. So the builder's central claim stands: **this was not the same fingerprint
in a hat.** Live: `SR-01 0.762`, `SR-05 0.748`, `BLIND-GAP +0.014`.

**The bad news, and it is checkable.** Operation (c) invented a construction.
`tools/prose/judge-fragment-openers.mjs` (mine, §7):

| Construction | Ours | Morrowind | Ratio |
|---|---|---|---|
| Sentence-initial `Which` **fragment** | 0.94 / 10k (7 in 74,269 w) | 0.086 / 10k (16 in 1.87 M w) | **11×** |
| Sentence-initial `Which`, raw, *in the rewritten lines only* | 12.44 / 10k | 0.17 / 10k | **73×** |

> "Which is comforting, in a way I can't explain."
> "Which isn't like her at all."
> "Which is either an accident or the point."
> "Which is deliberate."

Twelve of Morrowind's sixteen are one repeated line about not stealing ebony, so their *distinct*
usage is about four. Ours is a habit. The absolute count is small — seven — so this is a young tic,
not yet a *"eleven"*. It is exactly the failure mode the builder warned about, arriving through the
fix rather than surviving it.

**And the pass is visible as a seam inside our own corpus.** Sentence-initial `And`:

| | per 10k |
|---|---|
| The 180 rewritten lines | **60.65** |
| Our whole shipped dialogue | 12.39 |
| Morrowind | 27.47 |

The rewritten lines are 4.9× denser in conjunction-openers than our own untouched lines and 2.2×
denser than the reference. Same story on contractions: `greetings.json`, the file fixed at source,
now runs **463.7 per 10k against Morrowind's 327.8 — a 1.4× overshoot** — while
`50-factions.json`, authored after the pass, sits at **25.1**, barely above the 16.68 the whole
corpus started at. **The corpus is now bimodal.** A player walking from a rewritten line to an
untouched one crosses a register boundary, and a seam is worse for a reader than a uniform offset.

---

## 5. What the sweep did not reach: the same problem, and in one respect worse

`game/data/dialogue/topics/55-utility.json` — **34 topics, 102 infos** — plus `50-factions.json`
(41/106) and `writ-house.json`, all authored after the prose pass.

| per 10k | 55-utility | 50-factions | Morrowind |
|---|---|---|---|
| `do not / is not / cannot` | 194.1 | 167.9 | **21.4** |
| contractions | 62.9 | **25.1** | **327.8** |
| question marks | 2.7 | 2.5 | **158.8** |
| exclamation marks | **0.0** | **0.0** | **21.3** |

**It is the same problem, at full strength, in material written hours after the problem was
diagnosed and fixed elsewhere.** `50-factions.json` at 25.1 contractions per 10k is the pre-pass
baseline. Zero exclamations across 7,600 words in the two files. Questions at 0.017× the reference.

And *"eleven"* is back as filler. The builder's defence of the residue — that every remaining
*eleven* is plot arithmetic a player can count — held for the swept files. It does not hold here:

> "Struck off the roll **eleven years** ago for what the finding called a persistent irregularity
> of temper."
> "**Eleven years** of leases, in a hand that got steadier the angrier she got."
> "Two chairs in it and **eleven chairs of wear** on the floor."
> "They have asked her **eleven times** what she saw."
> "…and I have watched for **eleven years**." / "I have written **eleven** of them this year."
> "…including Mek, who has been firing it for **eleven years**."

Not one of those is countable. Every one is *"several"* with the machine's favourite number in its
place — precisely what the sweep removed. (The genuinely load-bearing ones are also here and are
fine: *four hundred and eleven*, *eleven gold a week*.)

**The standing lesson, which the builder wrote down and which this confirms: there is no gate. A
prose constraint fixed once and not enforced by a check that runs decays within hours on a busy
tree.** `-body` forms went 2 → 216 the same way. This is not a prose problem any more; it is a
missing CI check.

---

## 6. The martial library — not judged

`orchestration/status/W1-LIBRARY-MARTIAL.json` reports `state: writing`, 3 files on disk
(`the-drill-book.json`, `the-arms-of-the-province.json`, `the-ford-arguments.json`, 17,711 words),
`next_step: write file 4`. **Per my declared rule I judged none of it.** It is the next pack, and
it is the right next pack: it is the first large body of prose written *after* both diagnoses, so
it is the only clean test of whether the findings changed the writing rather than the numbers.

**Build that pack with the §2 name-substitution fix in place**, ask the §1 *quality* question, and
it will answer something these packs could not.

---

## 7. Method deviations

**Tool written mid-run:** `tools/prose/judge-fragment-openers.mjs`. No existing tool measures
sentence-initial fragment openers, which is the only way to test whether the rewrite traded one
tell for another. `--self-test` passes 7/7 including two mutations: a relative-clause → fragment
conversion **must** raise the `Which` count (it does), and a contraction swap **must not** move any
opener count (it does not). I graded no prose I authored, because I authored none.

**Not done:** I did not edit a single character of prose, per the brief. I did not open a browser.
`reports/prose-tics/W1-PROSE-TICS-report.md` remains unread by me — I worked from the status file's
findings and the live tools, so nothing in §3–§5 is a restatement of the builder's own conclusions.

---

## 8. Score

**6 / 10** against a gate of **7.0** — *below bar*.

RI-MTH03 scores the **protocol**, not the artifacts:

| Check | Points | Awarded |
|---|---|---|
| Pack built by a tool, not hand-assembled (`build-r2-packs.mjs`) | 2 | 2 |
| Reveal key outside the pack directory | 2 | 2 |
| `answer.md` written before reveal, hash recorded | 3 | 3 |
| Pick is A or B, no hedging, no refusal (20/20) | 2 | 2 |
| ≥ 3 specific checkable evidence bullets (20/20, 5–7 each) | 2 | 2 |
| `WEAKEST POINT` present and non-trivial (20/20) | 1 | 1 |
| Reveal outcome recorded | 2 | 2 |
| Second pass when the pick was ours | 2 | n/a — the question form makes it unreachable (§1) |
| **Leak audit performed and clean** | 2 | **0 — performed, and it failed (§2)** |
| | **16** | **14 → 87.5%** |

87.5% is *"below bar — the blind result is admissible but the process defect is recorded"*. Mapped
to the ladder anchors (75% → 4, 88% → 6, 100% → 8), 87.5% lands at **6**.

The artifacts themselves are not what is scored here, but for the record: the writing is good, it
is not placeholder, and on the books trials it is frequently better than the reference. It is also
identifiable in four lines by anyone who reads.

---

## 9. The one gap

**GAP-PROSE-01 — our characters do not address the player.** Questions at 0.2×, exclamations at
0.6×, first person at 0.5×, and every line closing on an epigram instead of a want. The world is
narrated *at* the player by 300 speakers who share one wit and none of whom is curious about them.
Every other finding in this verdict is downstream of it: the *"eleven"* filler, the `Which`
fragments, the punchline uniformity are all symptoms of prose optimised sentence-by-sentence
instead of written for a person who wants something.

**Remedy, buildable:**

1. **Gate it.** Add to `check-content.mjs`: per dialogue file, question marks ≥ 40 per 10k and
   `-body` forms = 0, as a loud warning now and a hard fail from wave 2. Without a check that
   runs, §5 happens again within hours — it already has, twice.
2. **Fix the pack before the next judgement.** Name-substitute both sides in
   `build-r2-packs.mjs`; switch to §D's quality question. One afternoon.
3. **Authoring, not find-and-replace.** For every topic with three infos, one info must be the NPC
   asking the player something and reacting to what they are. That is the only fix for §3.1 and
   §3.2, and it is the work the martial library should be doing now.
4. **Do not push `SR-01` further.** The builder is right that the residue lives in keepers,
   archivists and the court, calibrated formal on purpose. Moving it means making the game worse
   to move a number.

---

## 10. path_to_ten

| Step | From → to | What it costs |
|---|---|---|
| **6 → 7** | Fix the §2 leak: substitute setting proper nouns on both sides in `build-r2-packs.mjs`, rebuild, re-judge one pack with a fresh agent. Restores the leak-audit points and makes every blind text result in wave 1 trustworthy. | An afternoon of tool work. Nothing to write. |
| **7 → 8** | Ask the **quality** question, not the provenance question, so §E's `picked-ours` row is reachable and "are we worse?" gets an answer instead of "are we different?". Judge the martial library with it. | One pack rebuild; one fresh judge. |
| **8 → 9** | Land the question gate in `check-content.mjs` and bring one whole register — greetings, or the 34 post-sweep utility topics — to ≥ 40 question marks per 10k **by authoring**, not by punctuation. Remove the `Which`-fragment tic while doing it, and flatten the bimodality: the rewritten lines and the untouched ones must sit in the same band. | Real writing. A day per register. |
| **9 → 10** | The reader test, not the metric: rebuild the pack with the fix, hand a fresh judge the clean-subset trials only, and get **below 60% accuracy**. That is the only number that means our prose is no longer identifiable, and no statistic in the corpus can substitute for it. | Everything above, plus the courage to run it and publish a bad result. |

---

## Appendix — answers and hashes (M3, written before reveal)

| Trial | Pick | Conf. | Ours | ✓ | `answer.md` sha256 (16) |
|---|---|---|---|---|---|
| r2 t01-books | A | high | A | ✓ | `4db80afe437109e4` |
| r2 t02-books | B | high | B | ✓ | `7ed0302bbc93ed40` |
| r2 t03-books | A | high | A | ✓ | `49ebb6accbbe06ef` |
| r2 t04-books | A | high | A | ✓ | `312b0547f330a877` |
| r2 t05-books | A | high | A | ✓ | `f489c01c46502f5e` |
| r2 t06-dialogue | B | high | B | ✓ | `fb88a17897fbca20` |
| r2 t07-dialogue | B | high | B | ✓ | `34c5e8165e5cc569` |
| r2 t08-dialogue | B | **medium** | B | ✓ | `6f255d907fe693fd` |
| r2 t09-dialogue | B | high | B | ✓ | `a1fda21e3fe90cb6` |
| r2 t10-dialogue | B | high | B | ✓ | `b22640ba167d73c1` **(clean)** |
| r2 t11-journal | B | high | B | ✓ | `c839c2b3c9905a97` |
| r2 t12-journal | B | high | B | ✓ | `96be128ce50b7b3f` **(clean)** |
| r2 t13-journal | B | high | B | ✓ | `d75408a2edbe53b3` |
| r2 t14-journal | B | high | B | ✓ | `2865817f23c966c4` |
| r2 t15-journal | B | high | B | ✓ | `7f371987dee937c5` |
| voice t01 | B | high | B | ✓ | `a9c073bf7debcc3f` |
| voice t02 | A | high | A | ✓ | `128841166db16460` |
| voice t03 | B | high | B | ✓ | `75d80c77919f8b44` |
| voice t04 | B | high | B | ✓ | `7650c8d9bd0025c3` |
| voice t05 | B | high | B | ✓ | `f0d5be8c4fe460c7` **(clean)** |

The only `medium` was `t08-dialogue`, and its `WEAKEST POINT` names why: *"'You came back. They do
not come back. Shut the door.' and 'You again. Good. Sit.' are as alive as anything in A."* Those
lines are ours, and they are the proof that the writing can do it when it decides to.
