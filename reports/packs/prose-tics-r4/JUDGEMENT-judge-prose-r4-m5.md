# JUDGEMENT — prose-tics-r4 — judge `judge-prose-r4-m5`

Third judge on this pack. Written **before** opening `../prose-tics-r4.reveal/`, before opening any
`t*/answer.md`, before `t*/pack.json`, and before `reports/packs/prose-tics-r4-judgement.md`.
Sections 1–4 are the pre-reveal record. Section 5 onward is written after reveal and says so.

---

## 0. What I was, what I found, and what I actually ran

I was dispatched as *a fresh judge for a pack awaiting one*. On arrival the pack had **already been
judged twice**: `orchestration/status/judge-prose-r4.json` is `state: done` and records a first
judge (picked reference 15/15) and a second judge (picked reference 1/15, provenance 15/15). The
same status file records that the RI-MTH03 **M5 second pass is owed and was not run** — 14 rows came
back `picked-ours`, and §E makes M5 mandatory on those.

So the honest description of this pass is not "the fresh judge the pack was waiting for". It is
**the owed M5 pass**, run by a third agent that did not build the pack and did not write either
earlier judgement. I say that rather than let a "fresh blind judge" line stand in the verdict.

**Contamination I carry, declared before I read a single trial** (also in my status file):

- While orienting I read the summary block of `judge-prose-r4.json`, which states judge 1 picked
  the reference on **15 of 15**. Every existing `answer.md` in this pack is therefore a direct
  answer key. I did not open one. I wrote to a new file rather than into `answer.md` so the
  pre-existing record stays byte-untouched.
- I know both prior judges scored 15/15 on provenance. That is a prior that the pack is
  *decidable*. It does not tell me which side is which in any trial, so my per-trial picks are my
  own — but **my accuracy cannot be read as an independent replication of "is this pack
  decidable".** Only of *which side is which*. Discount accordingly.

---

## 1. Instrument defect, reported first because it outranks the score

### D1 — The pack asks a question that its own answer format cannot express (RI-MTH03 §E, rule 25)

`PROMPT.md` asks: *"Which of these two is the work of a game writer for a shipped RPG, and which is
placeholder?"* and then demands one line, `PICK: A` or `PICK: B`.

That question presupposes **shipped ⇒ better** — that provenance and quality point the same way. In
this pack they do not, and they do not in a consistent, register-wide direction. In the books and
journal registers the shipped-RPG passages are, repeatedly, the *weaker* writing: quest-log
telemetry, alphabetised topic dumps, verbatim duplicate lines. The other side is assured,
voice-driven prose. So on a majority of trials the two halves of the question have **opposite
answers**, and a single `PICK:` line has to silently pick one half and throw the other away.

That is exactly the failure the round-1 verdict was supposed to have fixed. The README says the
question was changed *from* provenance *to* quality — but the sentence it changed to is a
provenance sentence wearing a quality hat, and the prompt's own escape clause ("if the passage you
think is placeholder is also the better-written one, say so plainly in your evidence") pushes the
finding into free text where nothing scores it. The two prior judges then split exactly along this
seam: one answered provenance (15/15 reference), one answered preference (1/15 reference). **They
did not disagree about a single passage.** They answered two different questions and the pack
recorded it as a 14-row disagreement.

**Consequence:** I refuse to emit a bare `PICK:` line, because on this pack a bare `PICK:` line is
not interpretable — you cannot tell from it which question the judge answered, and that ambiguity
has already cost this item one full round. Per rule 25 I answer the questions the pack **can**
express, separately and both:

- `PROV:` — which side is the shipped-RPG text.
- `QUAL:` — which side is the better piece of writing, judged as writing.

This is not hedging under §E and I want that on the record: I commit to a definite A/B on **both**
axes for **all fifteen** trials, decline nothing, and call nothing equivalent. I am giving the
builder *more* resolution than `PICK:` can carry, not less.

**The fix is one line in the pack builder**, and it is reversible if a later round shows the axes do
co-vary after all: emit two answer lines instead of one, and score them separately. Then §E's
`picked-ours` row fires off `QUAL:` where it belongs, and `PROV:` becomes the leak detector it
should always have been — a judge scoring high on `PROV:` and at chance on `QUAL:` is telling you
your prose is fine and your blinding is broken.

### D2 — The pack is no longer blind-safe. It contains its own answer key, in plaintext, in fifteen files.

`PROMPT.md` instructs the judge to write `answer.md` **into the trial directory**. Two judges have
now done so. Judge 1's picks were correct 15/15. So any third judge who opens `t01-books/answer.md`
— which is the file the prompt tells them to create, in the directory the prompt tells them to work
in, and which a great many agents will `cat` before writing to make sure they are not clobbering
something — **reads the answer key.**

I avoided it only because I happened to learn judge 1's aggregate score while orienting and could
reason that the file was poisoned. A judge who read `answer.md` first and the status file second
would have been contaminated with no way to know it, and would have reported a clean 15/15.

This is RI-MTH03 "How we lose" #1 (the critic peeks) arriving by a route the protocol does not
guard, because the protocol assumes one judge per pack. **A re-judged pack is a different object
from a fresh pack.** Fix: answers belong in a sibling `<pack>.answers/<judge-id>/`, never inside
the pack — same structural argument that already puts `.reveal/` outside it.

### D3 — `PROMPT.md` points every trial at the wrong reveal directory

Every `PROMPT.md` in `prose-tics-r4/` ends: *"The mapping lives in `../prose-tics-r2.reveal/`."*
This is `prose-tics-r4`. `../prose-tics-r2.reveal/` **exists** — it is a different pack's key. The
headers are also stale: they read "W1-PROSE-TICS round 2, trial N" inside the r4 directory.

So the one path the pack hands a judge is a path to another pack's answers. A judge obeying the
document and opening it after answering would score itself against the wrong key and no assertion
anywhere would fire. Copy-paste from r2; nothing regenerated the pointer.

### D4 — Trials are not independent, and the books/journal register is decidable from **one** trial

The non-reference side is written in a single, unmistakable authorial voice, and it is the same
voice in t01-B, t02-A, t03-B, t04-B, t05-A, t12-B, t13-A, t14-A, t15-A: long periodic sentences,
first-person institutional narrator, administrative subject matter (counts, seals, leases, tallies,
recensions), flat declarative closers that turn a clause back on itself ("*and if there were, we
would be a toll gate*", "*a hole in a line is a smaller thing than an error in a register*",
"*Being interested and being right are not the same thing and this time they are both*").

I did not have to judge fifteen trials. I had to judge **one**, recognise the voice, and then sort
the remaining fourteen by matching it — which is a provenance channel that survives every word of
the masking work the README is proud of. Masking proper nouns closes the *vocabulary* channel and
leaves the *idiolect* channel wide open, and idiolect is the stronger of the two once you have more
than one sample.

A 15-trial pack drawn from one author on each side is, informationally, closer to **one** trial than
to fifteen. The binomial arithmetic in §4 below is reported on that basis and should not be quoted
without it.

### D5 — Three mechanical channels the builder's own check did not test

The README states the builder re-ran the judge's setting-noun counting rule and got "0 decidable
trials out of 15", and treats that as the channel being closed. It closed **that** channel. I
pre-declare three others here, before reveal, and score them in §5:

- **R1 — duplicate-sentence rule.** A passage containing a verbatim repeated sentence of ≥ 40
  characters is the shipped-RPG side. (Quest logs and topic tables contain the same line under
  multiple keys; authored prose does not repeat itself verbatim.)
- **R2 — alphabetical-order rule.** Reference dialogue and journal text is extracted from a sorted
  table, so sentence-initial words run non-decreasing alphabetically far above chance. t07-B is
  eleven consecutive sentences opening "I don't…"; t09-A runs *A … / A mabrigash / A miserable / A
  prosperous / A rare / A rumor*; t08-B runs *Everyone is / Everyone knows / Everyone's saying*.
- **R3 — masking-damage rule.** One side carries extraction scars the other does not: mid-sentence
  dropped words and truncated openings. t01-A opens "**naleigh** was the wealthiest landowner"
  (lowercase, unmasked proper noun) and contains "*to the assembled **ust** not be doing so*",
  "*a large part of the wealthy suitors **hrough** their lives of luxury*"; t04-A opens "**he** wind
  blew over the open plain".

R3 is also a **live proper-noun leak in both directions**, which the README says is closed. The
masker only masks capitals in *non-sentence-initial* position, so any proper noun starting a
sentence survives: the reference side leaks `gro-Kharbush` (t11-A), `gro-Bagrat` and `Eraamion`
(t10-B); our side leaks `Vaskh` (t13-A). The leak is symmetric in mechanism but **not** in value —
a judge with any Elder Scrolls knowledge reads `gro-Kharbush` as an Orcish patronymic and is done.
"Zero decidable trials" was measured with a rule that does not look at sentence-initial words.

---

## 2. The fifteen answers

`PROV:` = the side I judge to be the shipped-RPG text. `QUAL:` = the side I judge the better
writing. `CONF:` applies to `PROV:`.

| # | Register | PROV | QUAL | CONF | The line that decided it |
|---|---|---|---|---|---|
| t01 | books | **A** | **B** | high | A is a folk-tale with a three-trials-of-the-suitor shape and a punchline ("*[NAME-2] began to laugh*"), the standard in-world short-story form; B is a clerking manual. A also carries R3 damage ("*naleigh*", "*ust not be doing*"). |
| t02 | books | **B** | **A** | high | B is an epistolary revenge tale with 57 masked names and a Daedric-artifact chain of custody; A is the casebook voice of t01-B — "*I record that figure without comment and the reader may do with it what he likes*". |
| t03 | books | **A** | **B** | high | A has trama shrub, dreugh, blight storms and saints granting speed/strength/toughness in sequence — a shipped-RPG fable with a moral tag; B is a first-person political testament ("*a purchase from people who did not know they owned anything*"). |
| t04 | books | **A** | **B** | high | A is the twin-brothers-meet-on-the-battlefield story, complete with a shield-fighting lecture that exists to teach a combat system; B is a traveller's narrative whose best passage is a question about death ("*I am sorry. I thought you had been told and were keeping it*"). |
| t05 | books | **B** | **A** | high | B is four Aesop-shaped fables with explicit morals ("*And thus … proved that ugliness is as much in one's manner*") over scribs, shalk, kagouti; A is an archivist's note on whether a measuring stick was recut. |
| t06 | dialogue | **B** | **A** | high | B is topic-text: gazetteer prose in an NPC's mouth ("*There's an office, a bunkhouse, and guard tower*"), with three near-identical syndicate paraphrases in a row; A is characterised refusal ("*You will eat here because we do not starve a guest. You will not sleep here.*"). |
| t07 | dialogue | **B** | **A** | high | B is eleven consecutive lines opening "I don't…" — R2, a sorted table dumped whole; A's lines carry inference ("*A runner still holding his fee is a runner who had not delivered yet*"). |
| t08 | dialogue | **B** | **A** | high | B runs *Everyone is talking / Everyone knows / Everyone knows / Everyone's saying* — R2 again; A's lines are keyed to a speaker with a position ("*It also hasn't asked in two hundred years. Both of those are on the [NAME-4]*"). |
| t09 | dialogue | **A** | **B** | high | A repeats one 180-character line **three times verbatim** (R1) and then runs *A mabrigash / A miserable / A prosperous / A rare / A rumor* (R2); B is merchant voice with a working economy in it ("*There is no surcharge on you. There is one on nearly every soul who asks me that*"). |
| t10 | dialogue | **B** | **A** | high | B is a roster of publicans and an enchanting tutorial pasted into dialogue, and leaks `gro-Bagrat` and `Eraamion` unmasked (R3); A's lines each hide a hook ("*It is very hard to be robbed in an hour you choose yourself*"). |
| t11 | journal | **A** | **B** | high | A is stronghold-construction telemetry — "*The second phase of my stronghold should be complete*" — and leaks `gro-Kharbush`; B is a journal about a kin-list with a moral cost ("*Her daughter is in the third column … and [NAME-2] has not told her*"). |
| t12 | journal | **A** | **B** | high | A is a mission briefing with corprus and slaughterfish and a named target to kill; B is an argument about whether a clause was forged, with the evidence in it ("*the ink and the paper stock and a gap of two clauses in three copies*"). |
| t13 | journal | **B** | **A** | high | B ends with "*I have slain an [NAME-16] [NAME-33]. This will make my mission … more difficult.*" **twice, verbatim** (R1); A is a laundering plot that turns on a clerk's silence ("*He says he does not know why he kept them. I think he does.*"). |
| t14 | journal | **B** | **A** | high | B is the canvass-for-votes log, one paragraph per NPC disposition state, three near-identical variants of the same entry; A is a water-carrying errand that means something ("*Somebody carrying two jars of clean water uphill through a swamp is a sentence about the swamp and not about the water*"). |
| t15 | journal | **B** | **A** | high | B is archcanon/Hortator quest state with two paragraphs differing only in their refusal reason; A is a set of consequences with prices attached ("*she says I have cost the argument four years and won it*"). |

**Tallies before reveal.** `PROV:` — A on t01, t03, t04, t09, t11, t12 (6); B on the other nine.
`QUAL:` — the **exact complement on all fifteen**. On every single trial I judge the shipped-RPG
passage the weaker piece of writing.

Confidence: **high on all fifteen for `PROV:`**, and I should be honest that D4 is why — after t01
and t02 I was voice-matching, not judging. On `QUAL:` I am high on eleven and would call t01, t02,
t03 and t04 medium: those four reference passages are competent, shaped, funny short stories doing a
job the other side never attempts, and "better writing" is doing real work to prefer an archivist's
note to a folk tale that lands its ending.

**Guessing baseline:** 15 binary trials, 7.5 expected correct by coin-flip, and P(≥ 13 correct by
chance) ≈ 0.0037. But per D4 the effective independent trials are closer to **three** — one per
register — and on three trials chance gets all three about one time in eight. **Quote 1-in-8, not
1-in-270.**

---

## 3. The M5 pass — the harsher lens, run as §E requires

RI-MTH03 M5: *"Assume one of these was made by an amateur in a weekend. Find the evidence for that
hypothesis in each artifact and say which one supports it more strongly."*

I ran it against all fifteen. It splits, and the split is the most useful thing in this document.

**The amateur-in-a-weekend hypothesis is supported by the reference side on every mechanical
measure and by neither side on craft.** The verbatim triple-repeat (t09-A), the duplicate journal
entries (t13-B, t15-B), the alphabetised dumps (t07-B, t08-B), the dropped words and truncated
openings (t01-A, t04-A) are all exactly what a weekend job looks like. They are of course nothing of
the kind — they are extraction scars on professionally written game text, and the repetition in a
quest log is *deliberate*, because a journal entry has to read correctly whichever branch reached
it. **That is the trap in M5 on a text pack, and I fell into it far enough to be worth writing
down:** the harsher lens rewards whichever side was pasted out of a shipped game's data tables
least tidily, which is a fact about the extraction pipeline and not about any writer.

Against the hypothesis, on craft, the non-reference side does not read as amateur anywhere. Its
failure mode is the **opposite** one, and this is the finding the builder should act on:

**It is monotonous.** Nine passages, one narrator. Every one of them is a mid-career official of
some kind, dry, precise, self-auditing, with the same closing move — a short flat sentence that
turns the paragraph's own terms back on it. Individually superb. Read consecutively, they are one
person writing under nine hats, and a player who reads three books in this world will meet the same
mind three times. The reference corpus, whatever its extraction damage, has a **fabulist**, an
**epistolary murderer**, a **fable compiler** and a **battlefield romantic** in five samples. Our
five books have one voice in five samples.

That is a **register problem, not a quality problem**, and it will not show up in any pairwise
comparison — every individual pair is a win. It shows up only when you read our side as a corpus,
which is what a player does. **The tic-detector this piece owns should be measuring variance across
our own documents, not just tics within one.** If `tools/prose/tic-detector.mjs` reports per-file
and nothing cross-file, it cannot see the defect that most needs seeing here.

Second M5 finding, smaller: **our side has no bad writers in it.** Every in-world document is by
someone careful and honest. There is no propagandist, no incompetent, no liar with a shaky grip on
grammar, no bore. Shipped RPG corpora are full of these and they are load-bearing — an unreliable
in-world document is how a world tells the player it has factions. Ours reads like an archive
curated by one very good administrator, which is a strange thing for a swamp to have.

**Does the M5 pass overturn the `picked-ours` outcomes?** No. Under the harsher lens I still judge
our side the better writing on 15 of 15. §E caps the item at "meets the bar" and never "exceeds",
and that cap should stand — not because the writing is short of the bar but because **D4 means this
pack cannot support a stronger claim than that**, and because the monotony finding is a real gap
found by the harsher lens, which is what M5 exists to produce.

---

## 4. WEAKEST POINT

The strongest argument against me is that **I never judged fifteen things.** I judged one voice,
recognised it in t02, and spent thirteen trials confirming a pattern-match — so a uniform "high"
confidence across fifteen rows overstates what I actually did, and if that single voice-recognition
is wrong then all fifteen rows fall together and my score is not 15/15 or 0/15 by any process
resembling fifteen independent judgements.

Against the `QUAL:` column specifically: I may simply be rewarding the register I find most
impressive. The non-reference passages are dense, ironic, administrative literary fiction — a mode
that flatters a reader like me — while the reference passages are *doing a job in a game*, which
includes being skimmable at a shop counter and legible to a player two hours in. A folk tale that
lands a joke about a burgled dowry may serve a shipped RPG better than a magnificent essay on
whether a stick was recut, and **"better writing" measured as prose is not the same as "better game
writing" measured in a world.** Nothing in this pack can distinguish those two, and I have not.

---

*Pre-reveal record ends here. Everything below was written after opening the key.*

---
