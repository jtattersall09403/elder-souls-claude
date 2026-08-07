# W1-PROSE-TICS — the machine's fingerprint, generalised past the books

**Builder report. This piece does not grade itself.** Blind packs for a round-2 judge are in
`reports/packs/prose-tics-r2/`; the judgement is theirs. The library verdict's blind judgement was
recorded *void* precisely because that critic built its own packs, so the packs here contain no
scoring, no answer key visible to the judge, and no claim about who wrote what.

---

## 1. What was being generalised

`corpus/90-verdicts/wave1/W1-LIBRARY-r1.md` found that a **one-token rule separates our books from
Morrowind's at 92.5%**, against a 78.8% majority-class baseline. *"Eleven"* was in 49 of our 65
books and 7 of Morrowind's 241 — **31.73 against 0.38 per 10,000 words, 84× by rate**.

The brief's premise was that there is no reason to think a machine's fingerprint stops at the books.
It does not. It is worse everywhere else, and it is not only "eleven".

## 2. Method, and what was fixed before anything was measured

**Registers are never mixed.** Books against books, dialogue against dialogue, journal against
journal. The registers differ so much that a cross-register comparison produces nonsense.

| register | ours | Morrowind reference |
|---|---|---|
| books | `game/data/books/*.json` `books[].text` — 70 docs, 42,636 w | 242 shipped `{{Game Book}}` pages, `Lore:` text, 185,612 w |
| dialogue | `game/data/dialogue/**` + `game/data/npcs/**.lines.greeting` + `game/data/world/opacity.json` refusals — 2,813 lines, 58,151 w | `corpus/40-dialogue/data/morrowind-dialogue.csv.gz`, 69,876 rows, 1,860,069 w |
| journal | `game/data/quests/*.json` `quests[].journal[].text` — 752 entries, 31,304 w | **3,183 `{{Journal Entries}}` rows** off 393 `Morrowind:`/`Tribunal:`/`Bloodmoon:` quest pages, 92,387 w |
| item | `items[].description`, `weapons[].line` — 131 docs | *none exists* — measured, never scored, and said so |

**The journal reference is new.** The vendored UESP extract has carried real Morrowind quest-journal
prose the whole time and nobody in this project had ever used it. Parsing it needs the template
parameters split at brace depth 0, not on newlines: splitting on `"\n|"` finds 906 of the 3,183
entries and silently under-reports the reference by two thirds. The tool's self-test pins this.

**Rules were pre-registered.** 46 of them, written from prior belief and hashed
(`sha256 45d4d8f3…`) **before any corpus was read**. Only one — `eleven` — was known in advance to
fire, and it is included as a *positive control*, not a discovery.

> **The multiple-comparisons count for this run is 46, and all 46 are reported in
> `reports/prose-tics/final.json`, not just the winners.** Bonferroni two-sided at 0.05/46 is
> z = 3.30. A reader who wants to discount everything below that can.

## 3. The honest half: eight pre-registered priors were wrong

This is reported first because a run that only reports its hits is not pre-registered, it is fishing.

| rule | prior | measured (books) | verdict |
|---|---|---|---|
| RULE-10 "not X but Y" | the signature LLM balance figure | **0.4×** | **Morrowind uses it MORE** |
| RULE-26 tricolon "X, Y and Z" | the rule-of-three habit | **0.5×** | they use it more |
| RULE-15 "which is to say" | the classic essayistic gloss | **zero in our books** | never fired |
| RULE-13 neither…nor | formal paired negation | **zero in ours** | never fired |
| RULE-31 "of course" | knowing aside | 0.1× | wrong direction |
| RULE-25 parentheses | control, expect low both sides | 0.1× | wrong direction |
| RULE-46 sentence-length σ | "generated prose varies less" | ours **14.53** vs ref **9.46** | our books vary **more** |
| RULE-22 paired em-dash aside | the parenthetical-aside habit | **25.9× → 0.9×** once orthography is normalised (§4) | a font, not a habit |

Five of the eight things most confidently said about machine prose on the internet are, against a
real 2002-era reference corpus, either absent from our text or more common in theirs. Two of the
eight were measuring a character encoding.

## 4. The finding that changes what "fix it" means: RULE-21 is a font

The em dash came back at **51× in books and literally infinity in dialogue** — Morrowind's 1.86M
words of dialogue contain **zero** U+2014. That looks like the strongest tell in the run.

It is a character encoding difference.

**Morrowind's text is ASCII and spells the dash `--`:**

| register | our `—` per 10k | their `--` per 10k | **the FIGURE, either spelling** |
|---|---|---|---|
| books | 38.66 | 20.37 | ours 38.66 vs 21.87 = **1.8×** |
| dialogue | 17.69 | 19.04 | ours 17.69 vs 20.17 = **0.9×** |
| journal | 3.21 | 9.53 | ours 3.21 vs 9.85 = **0.3×** |

**In two of three registers we use the dash figure LESS than Morrowind does.** Swapping `—` for `--`
would take a one-token detector from infinity to 1.0 without changing one word of the writing. That
is the exact "same fingerprint in a hat" move the brief forbids, and it was available and tempting.
It was not taken.

**RULE-22 goes the same way, and further.** The paired em-dash aside — *"the thing — not a doctrine,
a fact — that they knew"* — was pre-registered as the parenthetical-aside habit and measured 25.9× in
the baseline. Normalised for orthography it is **0.9× in books, 0.1× in dialogue and 0.2× in
journal**. Morrowind uses the parenthetical aside *five to ten times more often than we do* in spoken
lines and journal entries. Two of the run's most confident priors were the same font twice.

The tool now reports both readings itself (`normaliseOrthography()`, a `confounds[]` block per
register, and four self-test assertions including *"two identical sentences spelled differently
measure the SAME after normalisation"*). It is labelled **POST-HOC** in the output, because quietly
redefining a pre-registered rule after seeing the answer is how a run stops being pre-registered.

What *was* fixed in books is the genuine part: a dash used as a **bullet, a ledger column rule or an
entry tag**, which Morrowind never does. 35 line markers stripped, 14 authored layout rewrites.
Books' dash figure went **1.8× → 1.0×**. The rhetorical asides were left alone, because Morrowind
writes them at the same rate.

## 5. The tic itself, register by register

### 5a. The best separator was never "eleven" — it was the indefinite person

`nobody / anybody / somebody / everybody`, pre-registered as RULE-39 on a hunch, beat the positive
control in every register:

| register | ours per 10k | Morrowind | ratio | doc-presence |
|---|---|---|---|---|
| books | 35.36 | 0.27 | **131×** | 69.2% of our books vs 1.7% of theirs |
| dialogue | 76.31 | 2.23 | **34×** | |
| journal | **63.29** | 0.22 | **292×** | 74.8% of entries vs 0.6% |

**And the fix is not the obvious one.** Morrowind does not avoid the indefinite person — it *spells
it differently*, using the `-one` forms at 8.89 / 33.77 / 5.84 per 10k. Pooling both halves:

| register | pooled indefinite person, before | after | Morrowind |
|---|---|---|---|
| books | 50.13 (5.5×) | **14.54 (1.6×)** | 9.16 |
| dialogue | 86.05 (2.4×) | **10.83 (0.3×)** | 36.00 |
| journal | 77.74 (12.8×) | **14.38 (2.4×)** | 6.06 |

A global `-body` → `-one` swap would have taken RULE-39 to zero and left a 5.5× / 12.8× rule
standing. Every one of the 400+ instances was **recast** — passive, concrete actor, or a different
figure — never exchanged. In dialogue several rewrites deliberately land on `none` / `no one` /
`a soul`, because our spoken lines *under*-use the indefinite person Morrowind actually reaches for
(0.3×); that moves both halves toward the reference at once instead of trading one spike for another.

### 5b. "Eleven" is the length of every career in the province

In dialogue, before this pass, "eleven years" was: the Tribune's time in post, the keeper's time with
the tree, the clerk's wet boots, the arrangement without incident, the scholar's time on the
question, the surveillance file on Wide-Eye Teel, the priest's rites in the vestry, the chapel-well
arrangement, the years listening to a bell, the years carrying up a ramp, the years fencing for the
Ledger, and the years since she came for one season. **Nobody designed that.**

Same in the journal: *eleven days* was how long everything took — adding up the Tally, the writ
through the Assize, the arithmetic, the sick-tent. And *eleven minutes*, *eleven paces*, *eleven
seconds*, *eleven metres*, *eleven hours*, *eleven water-calls*.

All of that is gone. Substitutes were deliberately spread across twelve / fourteen / fifteen /
twenty / thirty / forty / *a dozen* / *most of a season*, because landing them all on "nine" would
move the spike one digit sideways — which is exactly what pre-registered RULE-05 and RULE-06 exist
to catch, and they would have caught it.

### 5c. What was deliberately kept, and why

**Load-bearing quantities are not tics.** A number a player counts, or a quest keys off, is a fact:

* the **eleven burial boxes** (Q-MAIN-02, and a sealed-mystery answer);
* the **eleven live roots**, **eleven keepers at eleven wells**, **eleven steps** to the reservoir floor;
* the **eleven unwritten porters** at **eleven gold a week** (Q-DOCK-01 is *about* the count);
* **four hundred and eleven** on the Blackrose lease register, cross-referenced six times in
  `game/data/quests/blackmarsh-coast.json`; **529 + 411 = 940** has to keep adding up;
* **six hundred and eleven** leased, **eleven names** on Weeja-Sen's hiring list, **eleven thousand**
  behind the sluice, **eleven leaves given in four hundred years** (matching the leave-book of Thorn);
* **Clause eleven** of the treaty — `game/data/dialogue/topics/10-global.json` opens journal
  `q-heirs-clause` on it;
* **Thorn's eleven subjects** — a settlement fact in `game/data/world/settlements/thorn.json`;
* the Knahaten dates **2E 560–601** (real series lore), the ford casualties **151 vs a dozen**
  (declared contradiction CF-060), the tally-stone **41 notches / 374 days**.

### 5d. The most interesting thing in the run

**The machine's favourite number did not stay in the prose. It became the plot.**

After every filler instance is gone, the journal register still carries `eleven` at 29.71 per 10k
against Morrowind's **zero**, and every surviving instance is main-quest arithmetic: eleven boxes →
eleven live roots → eleven keepers → eleven steps. The motif reads as deliberate. It almost
certainly is not: it is the same default that produced eleven-minute tides and eleven-pace patrols,
promoted into design before anyone measured it.

**Renumbering it is a design change**, touching quests, saved states, dialogue and a sealed answer.
It is out of scope for a prose pass and is flagged here for the owner rather than done quietly.

## 6. Before and after

Headline rule, books register — the thing the whole piece exists to move:

| | ours per 10k | Morrowind | ratio | doc accuracy | baseline | **lift** |
|---|---|---|---|---|---|---|
| **RULE-01 `eleven`, W1-LIBRARY r1** | 31.73 | 0.38 | 84× | 0.925 | 0.788 | **+0.137** |
| **RULE-01 `eleven`, now** | 4.69 | 0.38 | 12× | 0.782 | 0.776 | **+0.006** |
| **RULE-39 indefinite person, now** | 0.00 | 0.27 | 0 | 0.763 | 0.776 | **−0.013** |

Dialogue: RULE-01 accuracy 0.973 against a 0.969 baseline — **lift +0.004**, gone.
Journal: RULE-01 accuracy 0.849 against 0.748 — **lift +0.101**, and that residue is §5d.

`-body` forms across the whole shipped corpus: **768 → 2**.

## 7. Instruments

| tool | what it does | can it go red? |
|---|---|---|
| `tools/prose/tic-detector.mjs` | all 46 rules × 3 registers + item, rate/presence/accuracy/z + post-hoc confound pass | **`--self-test`, 40+ assertions.** Injects the tic into a clean corpus and asserts separation degrades; asserts a rule firing on neither side scores 0.50 not 1.00; asserts no rule fires on `"The dog."`; **exits non-zero if a reference corpus is missing rather than passing vacuously.** |
| `tools/prose/apply-rewrites.mjs` | applies *authored* sentences to game JSON without reformatting | `--self-test`. Refuses a missing sentence, refuses an ambiguous one, and the new `occurrences` mode refuses a **wrong declared count in both directions** |
| `tools/prose/strip-line-markers.mjs` | strips a dash used as a line marker; never touches an inline one | `--self-test`, incl. a **regression test for a real bug this tool had** |

**The live end-to-end mutation check.** The self-test proves the statistic goes red on a synthetic
corpus; that is not the same as proving the shipped pipeline does. So the tic was injected into six
real shipped books on disk and the whole pipeline re-run:

```
CLEAN            RULE-01  4.69/10k  presence 12.9%  acc 0.782
                 RULE-39  0.00/10k  presence  0.0%  acc 0.763
INJECT "There were eleven of them and nobody counted twice." into 6 books
AFTER            RULE-01  6.09/10k  presence 20.0%  acc 0.798
                 RULE-39  1.41/10k  presence  8.6%  acc 0.782
```

Both rules moved on rate, on presence and on accuracy. Reverted; verified zero occurrences remain.

**A bug this run found in its own instrument.** `strip-line-markers.mjs` v1 matched an *escaped*
quote inside prose (`\"`) as the opening of a JSON value and silently deleted a real inline dash out
of `marginalia-in-a-borrowed-book` — *"Who has hanged a pirate this year?" — Four.* Caught on
inspection, fixed with a `(?<!\\)` lookbehind, the dash restored, and a named regression test added.
A tool that edits shipped prose and is only checked by the number it produces will do this again.

## 8. Constraints, both re-run after every pass

* **Book contradictions:** `node tools/analysis/book-budget.mjs` — **D4 = 31** (bar ≥ 8; was 28
  before this run, raised by another agent's new books, not by me). No declared `contradicts[]` pair
  had its named fact touched; the sixth/eleventh-volume unit dispute and the soulrest-sheet eleven
  boxes were left verbatim. **S8 = 0.**
* **Sealed-mystery leak scan:** `node tools/world/opacity-resolve.mjs` — **CLEAN**, 24 mysteries, 197
  ids, **132,002 strings scanned against 144 declared n-grams**. This is the scanner that reads
  *every* string regardless of key; the old one harvested a fixed key list of 2,699 and missed 4,292
  more, including 1,102 of dialogue prose under the key `x`. That hole is why 21 `-body` forms in
  `game/data/world/opacity.json` refusal lines had never been looked at by anything.
* `node tools/check-data.mjs` — 503 files, all present.
* `node tools/check-quests.mjs` — 94 quests, hooks and entry topics resolve.
* `node tools/check-content.mjs` — 295 quest resolutions, none lost.
* `node tools/harness/boot-check.mjs` — see §10.

## 9. What is NOT fixed, stated plainly

The brief's finishing condition is that no one-token rule should still separate the corpora. On that
test:

* **books — met.** No one-token rule separates. The top remaining separator, RULE-21, is the glyph
  confound of §4 and measures 1.0× as a figure. Everything above it is phrasal.
* **dialogue — met** for one-token rules. RULE-01 lift is +0.004.
* **journal — not met, and the reason is §5d.** RULE-01 still separates at +0.101 lift because the
  main quest is built on the number. That is a design decision to take, not a sentence to rewrite.

Three phrasal habits remain and are genuinely ours, not artefacts:

1. **`RULE-36` contraction avoidance — the largest single remaining signal.** Our NPCs speak at
   212.21 "do not / is not / cannot" per 10k against Morrowind's 21.39, and use *contractions* at
   19.26 against their **327.77 — 0.06×**. Morrowind's NPCs talk; ours read aloud. This is a real
   register defect, it is bigger than "eleven" ever was, and fixing it is a dialogue-voice pass of
   its own, not a find-and-replace — some speakers (Imperial clerks, keepers) *should* be formal.
2. **`RULE-18` / `RULE-17` / `RULE-28`** — "that is what/why", the mid-sentence "which is", the
   sentence-final wry qualifier. 20–61× in places. These are the house voice; whether they are a
   tic or a style is a judgement, which is why it goes to a judge.
3. **`RULE-08` round hundreds in the journal, 153×.** Concentrated in one load-bearing fact, the
   four-hundred-year span that is the spine of the chronology. This is a *worldbuilding* concentration
   — the corpus over-cites its own canonical numbers — rather than a machine tic, and 22 of the 71
   incidental ones in books were rewritten while 49 load-bearing ones were kept and enumerated.

**The corpus moved under the measurement.** Another agent added
`game/data/books/the-short-forms.json` and `the-casebook-of-the-assize.json` at 14:26, mid-run
(books 65 → 70 docs, 37.9k → 42.6k words), carrying five fresh `-body` forms. They were caught by the
final sweep. Anything landed after that timestamp is unmeasured by this report.

## 10. Everything written

```
tools/prose/tic-detector.mjs           46 rules, 3 registers, confound pass, --self-test
tools/prose/apply-rewrites.mjs         authored-sentence application, --self-test
tools/prose/strip-line-markers.mjs     dash-as-layout only, --self-test
tools/prose/rules.pre-registered.json  46 rules, hashed before measurement
tools/dialogue/gen-greetings.mjs       17 authored fragments rewritten at source
reports/prose-tics/baseline.json       measurement before any change
reports/prose-tics/final.json          measurement after
reports/prose-tics/rewrites/*.jsonl    every authored change, with its reason, replayable
reports/packs/prose-tics-r2/           blind packs for the round-2 judge
```

**Authored rewrites: 617**, across 99 (books numerals, predecessor) + 127 (books indefinite person)
+ 14 (books dash layout) + 22 (books round hundreds) + 180 (journal) + 269 (dialogue) + 24 (final
sweep), plus 35 mechanical line-marker strips and 17 generator fragments that expanded to 146
greeting lines.

Every one names the exact sentence it replaces and can be replayed or reviewed line by line.

---

# Part II — the dialogue voice pass

*Written by the second successor. The container restarted twice; §1–§10 above are the first
builder's and are unmodified. This half takes the one piece §9 left open.*

## 11. What was left, and why it was the whole test

§9 ended with a finishing condition not met: **`RULE-36`, contraction avoidance, separating our NPC
lines from Morrowind's at 0.844 balanced accuracy.** Ours 212.21 "do not / is not / cannot" per
10,000 words against their 21.39; contractions ours 16.68 against their 327.78.

That number has a one-line fix. `s/do not/don't/` across `game/data/dialogue/**` takes it to parity
in about a second **without changing one word of the writing** — the identical move to respelling
`—` as `--`, which this piece already caught itself being offered in §4 and declined.

So before touching anything, **18 SPOKEN-REGISTER rules were pre-registered and hashed**
(`tools/prose/rules.spoken-register.pre-registered.json`). The design is one idea: each rule is
tagged `contraction_blind`, meaning **a contraction swap cannot move it**. Nominalisation density,
sentence-initial conjunctions, discourse openers, front-loaded subordination, questions,
exclamations. If the separation lives only in the *movable* rules, the shortcut really would have
worked and the honest fix would still be to rewrite. If it lives in the blind ones too, the
shortcut is exposed as cosmetic and the size of the gap says by how much.

> **Combined multiple-comparisons count for this piece is 64** (46 + 18). All 64 are reported.
> Bonferroni two-sided at 0.05/64 is z = 3.41.

## 12. The instrument falsified my own pre-registration before I measured anything

`tools/prose/spoken-register.mjs --self-test` applies a mechanical contraction swap to a corpus and
requires every blind rule to measure **identically**. Run against the real 2,813 shipped lines it
went red on two of my own rules:

| rule | I registered it | it is not | why |
|---|---|---|---|
| `SR-14` one/two-word sentence | contraction-blind | **gameable** | *"You do not."* is three words; *"You don't."* is two. The swap **manufactures short sentences**: 862 → 872 hits. |
| `SR-18` mean words per sentence | contraction-blind | **gameable, badly** | corpus total 31,106.29 → 30,461.62. Contraction shortens a sentence by exactly one word per negation. |

Both were reclassified, with **both file hashes recorded** in an `amendment_v2` block, *before* any
ours-vs-Morrowind figure existed. A third fix was a plain bug: `SR-15` was written
`\b(i|me|my|mine)\b` intending case-sensitivity on the first-person pronoun, and the lowercase `i`
in the alternation matched every stray one.

**The `SR-18` finding reaches past this piece.** `game/data/dialogue/speakers.json` calibrates six
speaker archetypes on **words-per-sentence targets measured against Morrowind** — and Morrowind
contracts while we do not. Those targets are measured across an orthographic offset. The file also
names `tools/dialogue/voice-metrics.mjs` as `checked_by` for its separation requirements. **That
tool does not exist on disk.** The archetype targets are verified by nothing.

The remaining 13 blind rules were then verified blind **on the real corpus, not asserted** — all 13
measure identically before and after a mechanical swap of all 2,813 lines. That assertion is now in
the self-test and runs against live text, so it also fails if someone later adds dialogue whose
spelling makes a blind rule gameable.

## 13. The result: our dialogue is not too literary. It is uninvolved.

My central prior was that our NPCs sound written — long, Latinate, subordinated. **It is wrong, and
the reference says so flatly.**

| rule | prior | measured | verdict |
|---|---|---|---|
| `SR-09` abstract nominalisation | ours far higher | 100.94 vs **131.33** = 0.8× | **Morrowind uses more** |
| `SR-11` front-loaded subordinate clause | ours higher | 12.90 vs 31.26 = 0.4× | they use more |
| `SR-18` mean words per sentence | ours much higher | 11.22 vs 10.28 = **1.09×** | near parity, and part of even that is the artefact above |
| `SR-12` hedging | ours higher | 7.57 vs 7.54 = **1.0×** | parity |
| `SR-17` semicolon / colon | ours higher | 1.1× | parity |
| `SR-10` formal subordinator | ours higher | **zero in ours** | never fired |
| `SR-13` imperative opener | Morrowind higher | 1.7× | **backwards** |
| `SR-15` first person | predicted NULL | 0.5×, z = −6.6 | separates — we use *fewer* |

**Eight of thirteen predictions wrong.** Our dialogue is *less* Latinate than a 2002 commercial RPG's.

Every rule that *did* separate is a marker of one person reacting to another, and they all point the
same way:

| what a speaking person does | ours / 10k | Morrowind | ratio |
|---|---|---|---|
| exclaims | **0.34** | 21.25 | **0.02×** |
| asks a question | 19.26 | 158.83 | 0.12× |
| starts a sentence *And / But / So* | 7.57 | 77.09 | 0.10× |
| opens on *well / now / look / listen* | 11.87 | 29.97 | 0.40× |
| says *I* | 153.05 | 329.50 | 0.46× |
| contracts | 16.68 | 327.78 | 0.05× |

The entire 58,000-word corpus contained **two exclamation marks**. Nobody in this province was
reacting to anything. That is the defect, and **no regex can fix it** — you have to write the
speaker back into the line.

### The number the brief asked for

> **BLIND-GAP at baseline: +0.022.**

The best contraction-*movable* separator (`SR-01`, 0.844) beat the best contraction-*blind* one
(`SR-08`, sentence-initial conjunctions, 0.822) by **0.022**. So `s/do not/don't/` would have taken
the headline rule to ~0.50 and left an equally strong separator standing, untouched, pointing at
exactly the same defect. **The shortcut the brief forbids was worth 0.022 of separation.**

*(This number is right only because the tool's first summary was wrong and got caught. `separation()`
scores "fires ⇒ ours", so a rule **Morrowind** uses more scores *below* 0.5 — and the first run read
that as "does not separate", reporting a blind-gap of +0.271. Every rule that most exposes our
dialogue points that way. The statistic is now direction-agnostic with the direction printed.)*

## 14. What was rewritten, what was left, and what is still not fixed

**180 authored rewrites.** 43 fragments in `tools/dialogue/gen-greetings.mjs` — which is a
*generator*, so 43 edits became 1,500 regenerated lines and fixed 40% of the defect at source — plus
28 greetings, 57 topic and rumour lines, 52 character lines, and 2 repairs.

**Selection was by address form, not by taste.** `speakers.json` already keys its six archetypes on
how a speaker addresses you, so the pass used the same key and is auditable line by line:
`dry-one`, `citizen` and non-third-person `Friend` were rewritten; **`supplicant` (rootkeeper),
`provincial` (magister), the court, the House factors and every line in the Argonian third person
("this one") were kept verbatim.** RG-LEDGER's five *cold* lines were kept too — that is a clerk on
duty. A voice pass that flattens the one register in the game which is *meant* to sound written has
done the same damage as the tic it was fixing.

| | before | after | Morrowind | separation |
|---|---|---|---|---|
| `SR-01` contraction avoidance | 212.21 | **155.04** | 21.39 | 0.844 → **0.760** |
| `SR-02` contractions present | 16.68 | **223.60** | 327.78 | 0.822 → **0.646** |
| `SR-08` sentence-initial *And/But/So* | 7.57 | **26.64** | 77.09 | 0.822 → **0.708** |
| `SR-06` exclamation | 0.34 | **12.17** | 21.25 | 0.595 → 0.548 |
| `SR-05` question mark | 19.26 | 24.99 | 158.83 | 0.763 → 0.746 |
| `SR-04` second person | 377.98 | 364.18 | 454.32 | 0.514 → **0.502** (parity) |
| **BLIND-GAP** | **+0.022** | **+0.014** | | |

**The finishing condition is still not met, and it should not be met by me.** `SR-01` separates at
0.760. The remaining negation mass is in `topics/50-mainline` (238/10k), `10-global` (203),
`main-quest-argument` (170), `00-roots` (217) and the `world/opacity` refusals (253) — the keepers,
the archivists, the magisters and the court. Rewriting those would move the number and make the game
worse. **What is left is a design question about how much of this province should sound like a
clerk, not a prose defect.** `SR-05` — our NPCs ask 8× fewer questions than Morrowind's — is the
largest genuinely-remaining defect and is real work for someone.

## 15. Three things that went wrong, reported because they are the useful part

**1. I broke the predecessor's constraint, and *its* check caught me, not mine.** One rewrite
reached for *"nobody"*, handing back one of the 768 `-body` forms §5a removed. My own tool was
happy. Re-running *someone else's* check found it. Repaired by recasting to a concrete actor, **not**
by swapping to *"no one"* — §5a proved that swap leaves a 5.5× rule standing — and logged as its own
file, `dialogue-07-self-regression-repair.jsonl`, rather than folded quietly into a batch.

**2. There are now 216 `-body` forms in `game/data`, and they are not a regression of this pass.**
They arrived with other agents' work *after* the predecessor's sweep: `faction-imperial-assize` 20,
`faction-xul-aneekh` 18, `signposts` 12, `mainline-act5` 9, and 24 in a file that did not exist when
this run started. Zero appear in any of this pass's authored replacement text. **A prose constraint
that is fixed once and not enforced by a check that runs decays within hours on a busy tree.** There
is no gate on `-body` forms. There should be.

**3. The sealed-mystery leak scan went red, and the cause was this piece's own subject.**
`opacity-resolve.mjs` fails a build on any shipped 40-character run of a sealed answer — a
copy-paste detector. It fired on a new dialogue file. The colliding run is
`" that is the whole of the difference bet"`. **There is no secret in it.** It is a connective
phrase, and our prose reuses it so heavily — `RULE-18` measures **24.83 per 10k against Morrowind's
0.45, 55×** — that an innocent new line collided *by chance* with a sealed answer using the same
cadence. **The leak scanner caught our tic, not a leak.** It was fixed as a prose fix, by writing
the line out of the house cadence, which clears the collision and removes one `RULE-18` instance.
An allowlist entry would have hidden both problems and is what a hurried run does.

## 16. Constraints, re-run at the end

* **Sealed-mystery leak scan** — `node tools/world/opacity-resolve.mjs` — **CLEAN**, 24 mysteries,
  197 ids, **133,045 strings against 144 declared n-grams** (up from 132,002; the tree grew under
  the measurement). Two standing warnings, both pre-existing and both non-failures.
* **Book contradictions** — `D4 = 31` (bar ≥ 8), `S8 = 0`, `X2 = 0`. This pass edited **zero books**.
  `book-budget` reports one row out of band, `L8` (70 texts against a target of 112) — a corpus
  **volume** target, pre-existing, and untouchable by a prose pass that adds no books.
* `node tools/check-data.mjs` — 503 files. `node tools/check-quests.mjs` — 94 quests.
  `node tools/check-content.mjs` — 295 resolutions. `node tools/harness/boot-check.mjs` — §17.

## 17. Instruments added by this half

| tool | what it does | can it go red? |
|---|---|---|
| `tools/prose/spoken-register.mjs` | 18 pre-registered rules, blind/non-blind split, BLIND-GAP, `--by-source`, `--examples` | **`--self-test`, 17 assertions.** Asserts blindness **on all 2,813 live shipped lines**; asserts the mutation is not a no-op (SR-01 1234 → 0); asserts a real rewrite *does* move the blind rules so they are not inert; asserts a rule firing on neither side scores 0.50; **exits non-zero rather than passing vacuously if a reference is missing.** It found two of my own rules gameable and one regex bug. |
| `tools/prose/apply-source-rewrites.mjs` | applies authored rewrites to a **generator** (`.mjs`), not to JSON — editing the 1,500 generated lines instead of the 43 fragments is how a fix gets silently reverted by the next build | `--self-test`. Refuses a missing string, refuses an ambiguous one, reports **every** bad record rather than the first, and **reverts** a rewrite that produces invalid JavaScript. |
| `tools/prose/build-r2-packs.mjs` (extended) | over-samples edited documents in **dialogue** as well as books; `--register` builds one register's pack without deleting a pack a judge already holds | self-test now also asserts the dialogue prompt names none of this pass's rules |

**The pack builder's over-sampling was a real hole.** It filtered to edited documents for **books
only**, because the first pass was a books pass. Run unchanged after a *dialogue* pass it would have
handed the judge bundles assembled mostly from lines nobody edited — grading the untouched corpus
and calling it the work.

## 18. For the round-2 judge

`reports/packs/prose-tics-voice-r2/` — **5 dialogue trials**, seed `20260808`, our side drawn only
from files this pass edited, mapping hidden in `…-voice-r2.reveal/`.

**Not answered by the builder.** `reports/packs/prose-tics-r2/` (15 trials) is still live and also
unanswered. The judge should expect some bundles to contain deliberately formal keeper and court
lines; deciding a trial on one of those is a legitimate finding and should be said plainly rather
than counted as a miss.

## 19. The live mutation check, run on shipped text rather than a fixture

The self-test proves the statistic moves on a synthetic corpus. That is not the same as proving the
shipped pipeline does. So 13 real lines in one real shipped file
(`game/data/dialogue/topics/30-texture.json`) were **un-fixed on disk** — contractions expanded,
exclamations flattened, sentences re-joined onto their conjunctions — and the whole pipeline re-run:

```
FIXED     SR-01 155.04/10k  sep 0.760     SR-08 26.80/10k  sep 0.705     BLIND-GAP +0.014
UN-FIXED  SR-01 157.27      sep 0.763     SR-08 25.31      sep 0.718     BLIND-GAP +0.016
```

Every number moved the wrong way, from **13 lines out of 2,947**. The one that matters is `SR-08`:
it is **contraction-blind**, so it could only have moved because the rewrites changed sentence
structure rather than spelling. That is the evidence that this pass did not take the shortcut it
spent §11–§13 arguing against. Reverted; leak scan re-run **CLEAN** and `check-data` clean after
restoring.
