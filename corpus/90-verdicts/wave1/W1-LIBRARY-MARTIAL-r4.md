# W1-LIBRARY-MARTIAL — round 4 verdict (prose pass)

**Critic:** fresh context, no part of the authoring. **Commit judged:** `3d4c88d`.
**Bar:** wave-1 gate 7.0, **min over axes**.
**Score: 5.4 — FAIL.** Prose quality axis 8.4; files-and-consumption axis 9.0; **voice-distinctness
axis 5.4**, and the min is the score.

---

## 0. What the hand-off asked for, and the answer

The piece's own `next_step` says, verbatim:

> "The critic should read the PROSE, not the gate: the gate now says these seven files are clean
> and that is exactly the claim a blind reader has to falsify."

I read all 43 texts. **The writing is the best in this library and among the best things in this
repository.** It is also carrying a fingerprint that identifies all 43 as one hand, and every
component of that fingerprint sits in exactly the place `tools/check-prose.mjs` does not look.

The gate is green because it is counting characters. That was the hypothesis in my brief; it is
now measured, against Morrowind's own 241 shipped books rather than against an assertion.

---

## 1. The checkable claims — all three hold

| Claim | Verified how | Result |
|---|---|---|
| Every file exists and is **tracked by git** | `node tools/check-shipped-files.mjs`; `git ls-files --error-unmatch` on each | **PASS.** 7/7 tracked. No black screen risk. |
| **43 martial texts** | my own count over the seven files | **43.** 50,472 words. Matches. |
| **CONSUMPTION (RI-MTH07)** | census of every book id against all of `game/data/**` and `game/src/**` | **43/43 surfaced.** Zero orphans. |
| `check-prose` clean on the seven | `node tools/check-prose.mjs` | **PASS** — none of the seven appears in the 67 remaining corpus-wide regressions. |

**The consumer, named by path.** Each martial text is named by a `readable[].book` record in
`game/data/world/interiors/*.json` (e.g. `stormhold-praetorium.json` carries
`standing-instruction-for-auxiliaries`). `game/src/render/interior.js:751-770` puts that onto
`placements.readables[].book`; `game/src/engine.js:5504-5514` spawns it as a prop with
`readable_book`; `game/src/engine.js:2435-2445` opens the book screen on `interact` and emits the
event; `game/src/engine.js:4582` is what turns the reach prompt from *take* into *read*. That is a
real coupling chain, not a label. It was then demonstrated by perturbation — see §5.

`the-articles-of-the-wet-ledger` is listed in the status file as its own output but lives inside
`game/data/books/the-long-service.json`. Not a defect; noting it so the next agent does not go
looking for a file that was never meant to exist.

---

## 2. The gap — the fingerprint the gate cannot see

`node tools/lore/critic-martial-r4-fingerprint.mjs --mw=<dump> --selftest`
(reference: `python3 tools/uesp/mw-book-stats.py --dump <dir>`, the same 241 books RI-LOR03 §1 was
re-measured against).

| | Morrowind, 241 books | **Ours — 43 martial** | Ours — rest of library (119) |
|---|---|---|---|
| Bare Arabic numerals / 10k words *(era dates excluded)* | **9.3** | **128.5** | 24.9 |
| Texts containing any bare numeral | **15.4 %** | **81.4 %** | 12.6 % |
| Texts with ≥2 ALL-CAPS section headings | **2.1 %** | **65.1 %** | 8.4 % |
| Headings carrying a `, WHICH …` appositive | **1** | **60** | 10 |

**13.8× on numerals. 31× on caps headings. 60× on the heading appositive.** And the third column
is the control that makes it a finding about *this block* rather than about house style: the rest
of this project's own library sits within 2.7× and 4× of Morrowind on the same two axes.

**Instrument honesty (rule 4).** The tool exits **2** with no reference corpus rather than printing
our numbers with no bar beside them (verified). It exits **1** on the tree (verified). Its
`--selftest` arm feeds the *martial* arm the reference texts and the row collapses exactly onto the
Morrowind row (9.3 / 15.4 % / 2.1 %) — so the arm is reading the text, not the label.

### 2a. The numerals are a gate artifact, and the prose shows the seam

`check-prose`'s RULE-06 penalises **spelled** counts `four`…`twenty`. De-spelling is therefore the
cheapest way to turn that row green, and it is what happened — the status file records it as a
success: *"RULE-06 spelled counts 90.77 → 52.42."* The cost is visible inside single sentences:

> "Every file is to carry **2** bills and they are to be given to the **two** largest men in it,
> not the **two** cleverest." — `standing-instruction-for-auxiliaries`

> "Water bottle, **2 — two**, not one, and a quartermaster who issues one is to be reported."
> — `standing-instruction-for-auxiliaries`

The second one is the artifact caught in the act: the emphatic spelled form was needed for the
meaning and the numeral was needed for the gate, so the text carries both, three words apart.

Elsewhere it simply damages the voice. A serjeant writing by hand in the back of his own drill
book writes "I have talked to **3** men who were", "I have said this to **2** officers", "it takes
about **4** seconds", "**6** times in **22** years". A printed Bravil romance writes "there were
**20** of them" and "**8** feet of ash". Nobody has ever written like that; Morrowind's authors
certainly do not, at 9.3 per 10k.

### 2b. The `, which …` tic did not go away — it moved into the headings

The status file reports RULE-17 (`, which is/was`) and RULE-28 (sentence-final `, which …`) cleared
in the body prose. They are alive and dense one line above it, where the sentence-level detector
never goes: **60 of 188 headings**. An Argonian armoury-keeper, a Wayrest fencing master, an
Imperial prefect, a Dunmer noble's smith and a hunter at the Thornmarsh edge all reach for the same
construction:

```
THREE ABREAST, WHICH IS THE ONLY FORMATION THERE IS.        [Beem-Ei, Argonian, Helstrom]
THE PARRY, WHICH IS THE WHOLE SCHOOL.                       [Vaneia Corr, Imperial, Lilmoth]
CARE, WHICH IS THE PART THEY DO NOT READ.                   [Sees-The-Grain-Turn, Argonian, Archon]
GOING DOWN, WHICH IS THE PART THAT KILLS PEOPLE.            [Aneesh-Doon, Argonian, Ixt-Shaneekh]
VIII. THE MEASURE, WHICH IS THE WHOLE OF FENCING …          [Maestro Vare, Breton, Wayrest]
```

And **58 of 188 headings begin with the word WHAT**, across 24 of the 43 texts:
`WHAT A PARRY IS` · `WHAT A GIG IS` · `WHAT A HORN BOW IS` · `WHAT BOG-IRON IS` · `WHAT THE HOLD IS`
· `WHAT AN ARMOURY IS FOR` · `WHAT IT'S GOOD FOR` · `WHAT THESE THINGS ARE` · `WHAT THE WORK IS`.
That is not a house of writers. That is one writer with 43 masks and a template.

### 2c. Confirmed by a shared image nobody could have shared

Beem-Ei, who keeps the armoury at Helstrom, and Ivas, a Dunmer serjo's smith at Blackrose, both
invent the same original metaphor for the guard-angle rule, in the same anatomy:

> "Every shield covers a wedge, with the point of the wedge at your shoulder and the wide end out
> in front of you" — `the-door-that-walks`

> "A shield covers a wedge with the point at the shoulder, and the top edge of that wedge is where
> its owner has to lift" — `on-the-bog-iron-mace`

`wedge` appears 14 times across 4 texts by 4 unrelated authors. The mechanic
(`game/data/weapons/offhand.json`'s guard angle) is showing through the fiction.

---

## 3. The worst paragraph, and the best

### Worst

> "A door alone is a slow person carrying a wall. **Two doors are 2 slow people carrying 2 walls**
> with a gap between them, and the gap is where you will be killed."
> — Beem-Ei, `the-door-that-walks`

Three occurrences of the number two in one sentence, in two different notations, the first spelled
because it starts the sentence and the next two in Arabic because RULE-06 counts spelled ones. It
is the single most damaged sentence in 50,000 words and it is damaged by nothing but a gate. The
sentence is also, underneath the notation, a good sentence — which is what makes it the worst
paragraph rather than merely a bad one: this is the prose paying a tax to a checker.

### Best

> "That is the sentence. Everything the great shields have ever been for is in that sentence. A
> door is not a defence for the person carrying it. **A door is a piece of wall that has agreed to
> walk**, and its purpose is to cover the people who cannot cover themselves — the spear behind
> you, the bow behind the spear, the one carrying water, the young."
> — Beem-Ei, `the-door-that-walks`

Same text, four hundred words earlier. A practitioner's argument, an image nobody has written
before, and a martial fact that is really a political one.

Two more, so the reading is not carried by one book:

> "At the end he came over and asked me one question. He said: what would you take out of it? … I
> said section 9. He looked at me for a long time and then he said: **so would I, and I can't.**"
> — Attus Brell, `the-serjeants-answer`

> "Because a story with one woman in it is a story your Empire can carry. A story about 30 people
> deciding something together, with no one to punish and no one to negotiate with, is the exact
> thing your Office has been unable to find a signatory for in 300 years. **We made the story small
> on purpose.** It was the second thing we did that week and it has worked better than the gates."
> — Neekus-Ei, `the-water-does-not-take-sides`

That last one is the high-water mark of the whole library. It is an Argonian explaining, flatly and
without being asked, that the province manufactured its own folklore as a security measure, and the
game never says whether he is right.

---

## 4. The Morrowind axes, judged individually

| The thing that makes it Morrowind | Verdict |
|---|---|
| **Texts disagree with each other and with the player** | **Excellent.** The Reman Ford is six irreconcilable accounts of one afternoon — a prefect's reconstruction, a weir-household's rebuttal, a torn day-book, an unactioned Office minute, an unsigned deposition, and a muster leaf whose last hand has gone through the paper writing `42 is not 151!`. Neither side is ratified. |
| **The author has a position and an axe to grind** | **Excellent.** Bylines carry the grievance: *"has been asked to stop writing to the Office about this"*, *"formerly of Wayrest, and he would like that mentioned"*, *"dictated to the cohort clerk at Thorn because he does not write"*, *"who was 4 years old in 3E 391 and says so on the first page"*. |
| **The strange stated flatly, never explained** | **Good.** The Thorn lintel's third line and the men who touch it going out and not coming in; a depot book that has no record of the gate it is written in; the Shadowscale report's §VI AGAINST MYSELF, which lists the three things its own conclusion cannot hold and then stops. Nothing winks. |
| **A treatise by someone who fights, with a practitioner's errors** | **Excellent, and this is the round's real achievement.** Berethun Cray refuses to demonstrate the high grip and says exactly why (*"a demonstration proves what the two men in it can do and not what the method can do"*) — and he is wrong about the grip, and the fen lad who beats him is in the next file. No stat-block-in-prose anywhere: I scanned for `poise / stamina / startup / recovery / frames / degrees` and found only the words used in their English senses. |
| **Names, measures and dates from inside the world** | **Weak — see §2, and §4a.** |
| **The Argonian frame not decoration** | **Partial — see §4a.** |

### 4a. The Black Marsh frame is the thinnest part of the writing

15 of 43 texts are Argonian-authored (35 %), which is defensible for a Legion library. But across
**50,472 words**: `Hist` 8 occurrences in 6 texts; `Naga` 1; `egg` 1; `Jel` 0; `hatching` 0;
`Saxhleel` 0.

**`sap-fall`: 0.** RI-LOR02 §7 makes the sap-fall count one of only *two* legal date forms in this
project, and the rest of the library uses it — `quest-keys.json` beautifully (*"Nine sap-falls have
gone since, and a sap-fall is not a year of yours and I will not pretend it converts"*),
`the-books-in-evidence.json` and `the-occupation.json` too. Not one of the fifteen Argonian martial
authors reaches for their own calendar. They count in Imperial years and Imperial seasons: "19
seasons", "36 years", "third generation", "at 11". The outsiders' categories fit these Argonians
perfectly, which is the one thing the brief says they must not do.

**An-Xileel absence is correct and is not counted against the piece.** My own brief listed it as an
expected marker; RI-LOR02 §2 forbids it (*"The An-Xileel do not exist yet (CF-067) … We must never
name them"*). The piece is right and the brief was wrong. Saying so plainly rather than scoring a
compliance as a gap.

---

## 5. Consumption, demonstrated rather than asserted

`node tools/lore/critic-martial-r4-consume.mjs` — four arms, adapted with structure intact from
W1-23 round 5's probe: **A** shipped, **B** a marker sentence injected at the head of each target
book's `text` (must reach the screen), **C** the same press from `reach_m + 3 m` (must open
nothing), **D** the book *record* deleted on a copy (must open nothing — a stricter teardown than
removing the placement, because it proves the screen is fed by the record and not by a string
cached in the interior file). Six legs across four settlements, martial texts only. Results in
`reports/w1-library-martial-r4/consume.json`.

**Incidental finding, reported because it belongs to a live neighbour and not to me:**
`tools/lore/critic-w1-23-r5-consume.mjs` **cannot run on HEAD.** Its self-audit block scans its own
non-comment bytes for `'openMenu'` and `'__ENGINE'` — and the loop that lists those two strings is
itself a non-comment line, so `body.includes("'openMenu'")` always matches the guard. Verified:
exit 2, zero legs, every time. A guard that can only ever fire on itself. My copy assembles the
names from fragments and runs. That piece's author should know before its verdict cites numbers the
file as it stands cannot produce.

---

## 6. An undeclared cross-file collision that is worth more declared than swept

Four martial author names are also four of the seven names in
`game/data/books/the-books-in-evidence.json:the-cutters-list` — a keepers' register of people who
opened a Hist well untaught, each entry ending in a death:

| Name | In the martial library | In the cutters' list |
|---|---|---|
| Ganeeth-Ei | writes vol. III of his memoir at 61, at his sister's house at Hollow-Reeds | *"Killed at the Bone Ladder in the same season"* |
| Weeth-Ei-Vakh | teaches the claw at Helstrom, getting old | *"Walked into the marsh in the wet season and was not looked for"* |
| Ojal-Aneesh | shell-cutter at Hollow-Reeds | *"a sexton of the Drowned Court … Died in his bed at Soulrest"* |
| Teeus-Ahai | compiler, "against the advice of everyone at Soulrest" | *"Hanged at Gideon under the Provincial Office, for a different matter"* |

No `contradicts` edge, no canon-fact, no note in either file. I could not establish which was
written first — both landed on 2026-08-07 and the authored history is buried under bank commits.

**This is a gift, not a bug.** Under RI-LOR06 and Morrowind's own convention (*"No book is
corrected"*), a player who reads the memoir and then the register learns that the man who printed
three volumes about thirty years in the Ninth was killed at the Bone Ladder opening a well — and
the game never says which is true. That is the single most Morrowind thing in the whole martial
expansion and **it happened by accident.** The danger is precisely that: undeclared, the next agent
who runs a name-uniqueness sweep will "fix" it. Declare it, do not resolve it.

---

## 7. Scoring

**Min over axes, per the brief, so a green file-count cannot average away a prose finding.**

| Axis | Score | Basis |
|---|---:|---|
| Files shipped, tracked, counted | 9.0 | 7/7 tracked, 43/43 counted, claims match |
| Consumption (RI-MTH07) | 9.0 | 43/43 surfaced; coupling chain named by path; perturbed and controlled |
| **Prose quality on its own axis** | **8.4** | Four texts I would put beside Morrowind's best; a practitioner's errors; no stat-block-in-prose; disagreement everywhere |
| **Voice distinctness / does it read as one hand** | **5.4** | 13.8× / 31× / 60× against the reference on three independent fingerprints, with the rest of this library as a clean control |
| Black Marsh grounding | 6.2 | 15/43 Argonian-authored, but Hist 8× in 50k words and sap-fall zero |
| **OVERALL (min)** | **5.4** | **FAIL against the wave-1 gate of 7.0** |

**This is a FAIL on a piece whose writing is very good, and both halves of that are true.** A
builder reading only the number will draw the wrong conclusion. The remedy is small, mechanical and
does not touch a single argument, image or joke in the corpus.

---

## 8. Biggest gap and remedy

**GAP-W1-library-martial-single-hand-fingerprint.**

Three edits, none of which rewrites a sentence:

1. **Re-spell the numerals.** Restore spelled forms in narrative prose across the 43 texts, keeping
   Arabic figures only where a document would really carry them — `the-muster-leaf`,
   `the-weapon-rack-tally-at-thorn`, the handbill's stoppages, the day-book, registry numbers and
   `3E` dates. Target ≤ 30 per 10k, which is where the rest of this library already sits.
   **This will re-redden `check-prose` RULE-06, and that is the correct outcome:** the rule's own
   reference is Morrowind, and Morrowind spells them. Re-baseline RULE-06 against
   `tools/uesp/mw-book-stats.py`'s measured distribution (`one` 68.0 % → `thirteen` 2.9 %, smooth
   decay, no bump) rather than against a flat penalty. That is the arbitration this piece's
   successor should file, not another sweep.
2. **Break the heading template.** Drop ≥2-caps-heading texts from 65 % to ≤ 20 %; delete the
   `, WHICH …` appositive from at least 45 of the 60 headings; leave at most 12 headings beginning
   with `WHAT`. Several of these texts should have no headings at all — a hunter's oral teaching, a
   nephew's account of two uncles arguing, and a letter found folded in a helmet do not come with a
   table of contents.
3. **Give the Argonians their calendar.** Convert Imperial-year counts to sap-falls in at least 8
   of the 15 Argonian-authored texts, and let at least one refuse to convert, the way
   `quest-keys.json` already does.

**Acceptance, re-measurable by the next critic in one command:**
`node tools/lore/critic-martial-r4-fingerprint.mjs --mw=<dump>` **exits 0** — numerals ≤ 3× and
caps-headings ≤ 3× the Morrowind reference — with `sap-fall` ≥ 8 in the martial set and
`check-prose` still clean on everything except a deliberately re-baselined RULE-06.

**And extend the gate so this cannot recur silently:** `tools/check-prose.mjs` reads sentences and
never reads a heading, which is why 60 instances of a tracked tic sat in plain sight through a
round whose entire subject was tics. Headings are prose.

---

## 9. What I could not do

- **No blind pack.** Rule 25 forbids me judging a pack I build, `create_session` is approval-gated
  (rule 0), and the round-1 method's blind pair against real Morrowind books therefore did not
  happen here. The piece's own `notes_for_successor` §5 already names this as the one measurement
  that would settle whether these are books or filler, and it is still not done. **My prose score
  of 8.4 is a sighted reading and is weaker evidence than a blind pass would be** — I say so rather
  than let it stand as equivalent. What I *can* say is that the tell a blind judge would use is now
  measured and published above, and it is not "yours all sound informative": it is the numerals and
  the headings.
- **No timing figure is reported anywhere in this verdict**, per rule 26.
- I ran `tools/readables/mk-papers.mjs` by accident while probing for `--help`. It is deterministic
  and `git status --porcelain game/data/` came back empty; nothing in the tree moved. Reported
  because a silent one is not a result.
- I did not establish the authorship order of the §6 name collision. Both files landed the same day
  and the authored history is under bank commits.
