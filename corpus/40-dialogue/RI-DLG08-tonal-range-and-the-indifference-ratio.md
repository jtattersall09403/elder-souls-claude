---
id: RI-DLG08
title: Tonal range and the indifference ratio — does the writing have a tone worth having
kind: number
side: morrowind
judges: [dialogue.voice.register, dialogue.greeting.variation, dialogue.lore.vector, journal.entry.voice, coherence.tone.crossregion]
provenance: community-data
confidence: high
blind_pair: yes
---

## The bar

RI-DLG06 asks whether our NPCs sound *different from each other*. The coherence agent asks
whether the tone *drifts*. Nothing in the corpus asks what our tone **is**, or whether it
exists. A build can pass every dialogue item in this directory and be uniformly, competently
earnest: every archetype separable, every register stable, every NPC pleased to see you —
and tonally dead. That build is a modern RPG. Morrowind is not: a world-ending prophecy and
a lost ring are delivered in the same flat voice, and the game does not care whether you are
enjoying yourself.

The headline number is the **indifference ratio**: the share of authored NPC responses that
are *not player-affirming*. Measured over the 28,051 distinct texts of the vendored
`Morrowind.esm` dialogue extraction, it is **0.8746**. Only **12.5%** of Morrowind's lines
contain any warmth toward the player at all; only **1.6%** contain praise of them; **4.9%**
are actively dismissive, contemptuous or threatening; **37.2%** never mention the player in
any grammatical form. Our band is **0.78 – 0.92**, target **0.87**. A build at 0.55 is a
game where everyone is glad you came, and no amount of voice differentiation rescues it.

Around that sit three more requirements. **Anti-registers**: seven detectors — quippy
banter, modern idiom, self-aware humour, exclamation rate, NPCs complimenting the player,
chosen-one deference before it is earned, tutorialising in dialogue — run as a lint that
**fails the build**, with every threshold calibrated so that *Morrowind itself passes it*
(verified: `tone-metrics.py --reference --lint` → `clean`). **Tonal range**: hard counts of
registers other than the dominant one, because a monotone world is as dead as an
inconsistent one — at least three comic NPCs, two frightening texts, two beautiful ones, six
bureaucratic ones, four NPCs who are simply unpleasant to you. And the **good-bad writing
property**: Morrowind's over-formal, occasionally purple, faintly stilted prose is part of
why it is loved, and this item separates that from prose that is merely bad — honestly, with
a three-pile blind test that includes a deliberately-bad arm.

## The reference artifact

### A. Measured Morrowind surface statistics

Source: `corpus/40-dialogue/data/morrowind-dialogue.csv.gz` (69,876 rows). All figures over
the **28,051 distinct `DialogueText` values / 691,257 words** left after exact-text dedupe.
Reproduce with `python3 corpus/80-methods/tone-metrics.py --reference`.

| # | Metric | Morrowind (measured) | **Our band** | Fail |
|---|---|---:|---|---|
| T1 | Mean words per sentence | **8.08** (sd 5.90, median 7) | 7.5 – 10.5 | > 12.0 or < 6.0 |
| T2 | Words per entry, mean / median | **24.64 / 19** | 20 – 34 mean | > 45 or < 14 |
| T3 | Sentences ≤ 6 words | **48.2%** | ≥ 35% | < 25% |
| T4 | Sentences 7–12 words | **34.4%** | 28 – 42% | — |
| T5 | Sentences 13–20 words | **13.3%** | 10 – 22% | — |
| T6 | Sentences > 20 words | **4.19%** | ≥ 3.0% | < 1.5% |
| T7 | Sentences > 30 words | **0.59%** | 0.2 – 2.0% | > 4% |
| T8 | Sentence-length p90 / p95 / p99 | **16 / 20 / 28** | p95 ≥ 17 | p95 < 13 |
| T9 | Sentences carrying ≥ 1 subordinator | **14.4%** | 10 – 24% | > 32% |
| T10 | Subordinators per sentence | **0.163** | 0.11 – 0.28 | > 0.40 |
| T11 | Commas per sentence | **0.459** | 0.35 – 0.70 | > 1.0 |
| T12 | Adjective-index per 100 words *(suffix + closed-list proxy, §F)* | **4.65** | 3.8 – 6.2 | > 7.5 or < 3.0 |
| T13 | Contractions per 1k words | **35.05** (44.3% of texts) | 20 – 50 | < 8 |
| T14 | Second-person tokens per 1k words | **52.69** | 38 – 65 | > 80 |
| T15 | Player-name placeholder per 1k words | **6.43** | 3 – 10 | > 18 |
| T16 | Texts addressing the player at all | **62.8%** | 50 – 72% | > 82% |
| T17 | Exclamation marks per 100 sentences | **3.01** | ≤ 6.0 | > 9.0 |
| T18 | Texts containing any `!` | **5.18%** | ≤ 10% | > 16% |

**Read T1, T3 and T9 together.** Morrowind is *paratactic*: short declaratives, stacked, with
subordination in only one sentence in seven. The recalled impression of Morrowind as
"over-written" is wrong at the sentence level and right at the paragraph level — it says a
lot of things, each of them short. An LLM writing "Morrowind-style" produces the opposite:
long subordinated periods, one per turn. T1/T3/T9 are the three numbers that catch it.

**T13 is a trap for pastiche.** Morrowind contracts constantly (35/1k words, 44% of lines).
A build that bans contractions to sound archaic has invented a register Morrowind does not
have, and T13's floor exists to fail it.

### B. The indifference ratio — definition, decomposition, measured value

**Definition (executable).** For every distinct authored NPC response, six regex tiers are
evaluated (`corpus/80-methods/tone-metrics.py`, §"stance tiers"):

| Tier | Meaning | Morrowind rate |
|---|---|---:|
| `W3` | praise or deference *toward the player* ("well done", "you have earned", "you are the champion") | **1.58%** |
| `W2` | gratitude ("thank you", "we are grateful") | **3.20%** |
| `W1` | service courtesy ("welcome", "what can I do for you", "my friend") | **8.43%** |
| `C1` | dismissal ("leave me alone", "I know nothing", "make it quick") | **3.27%** |
| `C2` | contempt / insult ("get out of my sight", "n'wah", "filthy") | **1.94%** |
| `C3` | threat ("don't come back", "you'll be sorry") | **0.44%** |

A text with any W and no C is `WARM`; any C and no W is `COLD`; both is `MIXED`; neither is
`FLAT`.

```
indifference_ratio  =  1 − WARM / all_texts
```

Warmth must be *earned by an explicit marker*; everything else — flat exposition,
transactional service, refusal, instruction, insult — counts as indifferent. That asymmetry
is deliberate: it is easy to write prose with no warmth markers and hard to fake their
presence, so the metric errs toward the direction the project is *not* at risk of.

**Measured Morrowind:**

| Quantity | Value |
|---|---:|
| `WARM` | 12.54% |
| `COLD` | 4.89% |
| `MIXED` | 0.41% |
| `FLAT` | **82.16%** |
| **indifference ratio** | **0.8746** |
| indifference ratio over player-directed texts only | 0.8056 |
| texts with no player reference of any kind (`non_address_rate`) | 0.3723 (row-weighted: 0.4054) |

**Our bands:**

| # | Metric | Target | Pass band | **Hard fail** |
|---|---|---:|---|---|
| I1 | **indifference_ratio** | **0.87** | **0.78 – 0.92** | < 0.72 or > 0.95 |
| I2 | `warm_rate` | 0.13 | 0.08 – 0.22 | < 0.05 or > 0.28 |
| I3 | `cold_rate` (friction floor) | 0.05 | 0.035 – 0.12 | < 0.020 |
| I4 | `praise_rate` (W3) | 0.016 | ≤ 0.035 | > 0.06 |
| I5 | `non_address_rate` | 0.37 | 0.28 – 0.50 | < 0.20 |
| I6 | Named NPCs who will not help the player at all, at any disposition | ≥ 20 | ≥ 12 | < 6 |
| I7 | Settlements where the *majority* of generic greetings are `FLAT` or `COLD` | all 24 | ≥ 20 of 24 | < 14 |

**I2's floor and I3's floor are the anti-gaming clauses.** The cheap way to a 0.95
indifference ratio is to write nothing warm anywhere, which produces a world of grey
non-people rather than a world that does not revolve around you. Morrowind has Ahnassi and
Drulene Falen as well as Orvas Dren; the band has two sides.

> ⚠ **BAR-CRITIQUE-01's proposed band is wrong and must not be used.** The critique proposed
> "indifference ratio 0.45–0.75", defining it as the fraction of content that never
> references the player. Measured, that fraction in Morrowind is **0.3723** — *below* the
> proposed floor. Morrowind would fail the critique's own bar. This item therefore (a) keeps
> that quantity as `non_address_rate` with a band around its measured value (I5), and
> (b) makes the *headline* indifference ratio a stance measure, not an address measure,
> because what makes Morrowind indifferent is not that it fails to talk to you — it talks to
> you in 62.8% of its lines — but that it is unmoved by you when it does.

### C. The six registers and eighteen exemplar lines

All eighteen are **verbatim** from the vendored corpus; speaker id and source module given so
a critic can re-extract them.

**1 — DEADPAN.** The enormous, the fatal and the miraculous delivered without affect.
> "Among mortals, you are indeed great. Among the ancestors, you are of little account." — `ghost_npc_ane teria`, Morrowind
> "If you kill yourself trying to complete a job that's too difficult for you, it's nobody's fault but your own." — generic, Tribunal
> "It probably is very dangerous. You couldn't have known, but you took a great risk handling it." — generic, Morrowind

**2 — PORTENTOUS.** Scripture, prophecy, apocalyptic agriculture. Unironic, and it works.
> "The wickwheat is winnowed, and under the harrow, the earth is prepared for planting. The n'wah must die, and their flesh serve to sweeten the soil." — `Alvura Othrenim`, Bloodmoon
> "He is the Lord, and Father of the Mountain. He sleeps, but when he wakes, we shall rise from our dreams, shall sweep our land clean of the n'wah." — `dreamer`, Morrowind
> "The ancestors and stars have given me clear signs. The lost prophecies leave no doubt -- the Incarnate shall be an outlander." — `nibani maesa`, Morrowind

**3 — PETTY.** The register of a world whose inhabitants have their own small problems.
> "My cousin claimed he saw a city in the water near Gnaar Mok. He's a drunkard, though, and spends too much time in the sun." — `tolvise othralen`, Tribunal
> "I'm afraid I was rather drunk last night when I ran into Trebonius Artorius, that arrogant fool. It seems that the drink took over my tongue, and I called him a Flat-Head. Now I have a horrid rash." — `tarer braryn`, Morrowind
> "You won't believe what old Avus said yesterday. 'I could live in a nutshell and be consumed with infinite space were it not that I have bad dreams.' What the hell is he talking about?" — generic rumour, Tribunal

**4 — CRUEL.** Contempt aimed at the player, with no combat attached.
> "If you have nothing, you are nothing. Get out of my sight, n'wah." — `Orvas Dren Druglord`, Morrowind
> "Make it quick, n'wah." — `ondres nerano`, Morrowind
> "Idhassi asks that you talk to some other person. Idhassi does not like you. Idhassi wants you to know this, and wants you to go away. Understand?" — `idhassi`, Morrowind

**5 — ABSURD.** Comic without a wink; the joke is not shared with the player.
> "No, no, no. I knew you wouldn't understand. I want a bow that smells faintly of ash yams." — `therana`, Morrowind
> "Oh, dear. This bow smells like ash yams. This isn't any good to me at all. I hate ash yams. If I gave you a little present would you go away and promise never to bring me any ash yams ever again?" — `therana`, Morrowind
> "Have you ever heard of Auriel's Bow? I've heard it's made of ebony and smells of boiled ash yams." — `therana`, Morrowind

**6 — BUREAUCRATIC.** Forms, dues, ranks, jurisdiction. Deliberately boring, and load-bearing.
> "In order to advance to Conjurer, you must pay your Guild Dues of 200 septims. Will you pay these dues now?" — generic Mages Guild, Morrowind
> "You cannot advance until you pay your dues. The Mages Guild Charter only allows us to accept Imperial coin." — generic Mages Guild, Morrowind
> "The punishment for criminals in Morrowind is typically fines and compensation. The fines are collected by the state; the compensation goes to the injured party or his kin." — generic, Morrowind

**Distribution requirement (blind-judged, method T-BLIND below).**

| # | Requirement | Pass | Hard fail |
|---|---|---|---|
| R1 | Registers present at ≥ 5% of a 60-line sample each | ≥ 5 of 6 | ≤ 3 of 6 |
| R2 | Shannon entropy of the 6-register distribution (max 2.585 bits) | ≥ 2.00 | < 1.50 |
| R3 | Largest single register share | ≤ 55% | > 65% |
| R4 | Lines the judge assigns to `none` | ≤ 20% | > 35% |

### D. Tonal range — the required non-dominant content

Counts, over `game/data/**`, of content whose *primary* register is not the dominant one.
Each is a static-analysis census (T5 below), not an opinion.

| # | Slot | Required | Definition a critic can check |
|---|---|---:|---|
| N1 | **Comic NPCs** | ≥ 3 | An NPC with ≥ 15 authored lines whose blind-judged primary register is ABSURD. At least one must be a *quest giver*, so the comedy is not decoration. |
| N2 | **Frightening texts** | ≥ 2 | A book, note or dialogue sequence ≥ 250 words written to disturb, placed where it is found before the thing it describes. |
| N3 | **Beautiful texts** | ≥ 2 | ≥ 150 words, high adjective index (≥ 7/100w) and low subordination — a *deliberate* excursion outside the T12 band, declared as such in the data. |
| N4 | **Bureaucratic NPCs** | ≥ 6 | Primary register BUREAUCRATIC. Plus ≥ 1 quest whose entire content is paperwork (a permit, a levy, a census, a writ) and which is completable without combat. |
| N5 | **Actively unpleasant NPCs** | ≥ 4 | Named, non-hostile, will insult or dismiss the player at *any* disposition, and are never made friendly by disposition alone. |
| N6 | **Boring-on-purpose text** | ≥ 1 | ≥ 600 words of deliberately tedious in-world administration (a ledger, a rota, a tithe roll) that contains exactly one load-bearing fact. |
| N7 | **Registers per settlement** | ≥ 3 distinct primary registers among the named NPCs of each settlement of town size or larger | 24-settlement census |
| N8 | **Bathos count** | ≥ 6 quests where `stakes_stated` and `stakes_actual` differ by ≥ 2 tiers, **≥ 2 in each direction** | stakes tiers 1 personal-trivial / 2 personal-serious / 3 settlement / 4 faction-province / 5 world; both fields declared in the quest data |

N8's two-directional requirement is the point of bathos: Morrowind has both the errand
delivered as prophecy *and* the prophecy delivered as an errand. A build with only the second
is cynical; with only the first, portentous.

### E. Anti-registers — the lint that fails the build

`python3 corpus/80-methods/tone-metrics.py --ours game/data --lint` exits **1** on any
violation. Thresholds are calibrated so the reference corpus passes:
`--reference --lint` prints `clean`. **Any change to a threshold here must be re-verified
against `--reference` in the same commit; a threshold Morrowind fails is a wrong bar.**

| # | Anti-register | Detector | Morrowind (measured) | **Our limit** |
|---|---|---|---:|---|
| A1 | **Modern idiom (hard)** | 36 anachronism probes: `okay`, `yeah`, `cool`, `awesome`, `totally`, `my bad`, `guys`, `pretty much`, `reach out`, `level up`, `XP`, `quest log`, `side quest`, `hit points`, `epic`, `literally`, `vibes`… | **4.962 / 10k words** | ≤ 5.0 / 10k |
| A2 | **Colloquial (soft)** | `kind of`, `sort of`, `stuff`, `guy`, `issue`, `no way`, `whatever`, `hang on`… | **8.376 / 10k** | ≤ 12.0 / 10k |
| A3 | **Quippy banter** | 14 composite quip constructions ("well, that happened", "nailed it", "what could go wrong", "here we go again") | **0.029 / 10k** | ≤ 0.5 / 10k |
| A4 | **Self-aware humour** | `NPC`, `main quest`, `side quest`, `the player`, `respawn`, `loading screen`, `fourth wall`, `press X to` | **0** | **= 0** |
| A5 | **Tutorialising in dialogue** | `press the … button`, `use the … menu`, `hold … to`, `tip:`, `hint:`, `open your inventory`, `check your journal for` | **0** | **= 0** |
| A6 | **Exclamation rate** | `!` per 100 sentences / share of texts containing one | **3.01 / 5.18%** | ≤ 6.0 / ≤ 10% |
| A7 | **Complimenting the player** | tier `W3` rate | **1.58%** | ≤ 3.5% |
| A8 | **Chosen-one deference before it is earned** | 7 probes (`you are the prophesied one`, `we have long awaited you`, `at last you have come`, `you are our only hope`) | 11 distinct texts = **0.04%**, *all late main quest* | **0 occurrences in any content reachable before main-quest act 3**; ≤ 0.10% overall |

**A1 is the finding that mattered most.** The intuition "Morrowind contains no contemporary
idiom" is false. `okay` occurs in **249 distinct texts** — 181 of them in base `Morrowind.esm`,
not the expansions — plus `yeah` ×36, `whatever` ×83, `stuff` ×79, `guy` ×47. An absolute
zero-idiom bar would fail the reference game, which is the definition of a wrong bar. The
limit is therefore a **calibrated band at the measured rate**, and A2 exists to stop the
soft-colloquial channel becoming the loophole.

**A8 is a gate, not a count.** Morrowind *does* eventually let people call you the
Nerevarine — after roughly forty hours and three trials. The failure mode is not that
deference exists; it is that it arrives in hour one. The detector is therefore run twice:
once over all content (rate limit) and once over the sub-graph reachable before the main
quest's act 3 (absolute zero).

### F. The good-bad writing property

Morrowind's prose is stilted, over-formal and occasionally purple, and this is part of why
it is loved. That is a real property and it must not be used as cover for prose that is
simply bad. The distinction is testable on four axes:

| Axis | Good-bad (Morrowind) | Just bad | Detector |
|---|---|---|---|
| **Consistency** | The stiltedness is a *voice* — the same speaker is stilted the same way every time | Stiltedness varies at random within one speaker | RI-DLG06 step 2 per-speaker `w/sent` sd; a speaker with ≥ 20 lines must have sd(w/sent) ≤ 1.6× the corpus sd |
| **Specificity** | Concrete and named: `wickwheat`, `harrow`, `Flat-Head`, `200 septims`, `ash yams` | Abstract and general: "ancient evil", "great power", "dark times" | Proper-noun + concrete-noun density; and a banned-phrase list of 40 fantasy abstractions with a cap of 0.8/10k words |
| **Control** | Long sentences are *rare and deliberate* (4.19% > 20 words, 0.59% > 30) | Long sentences are accidental and ungrammatical | Zero sentences > 60 words; zero run-ons failing a comma-splice check at > 45 words |
| **Commitment** | Says the strange thing flatly and does not apologise for it | Hedges: "somewhat", "rather", "perhaps", "a kind of", "almost as if" | Hedge-adverb density ≤ 2.5× the reference rate |

**The three-pile blind test (T-GOODBAD)** — reusing RI-DLG07's normalisation and judge
protocol, extended with a third arm that RI-DLG07 does not have:

Assemble **36 excerpts**: 12 of ours drawn from the pool the data flags as our most ornate
(`register: portentous|beautiful`), 12 Morrowind excerpts of matched length from §C's source
corpus, and 12 **deliberately bad** excerpts generated for the test — LLM-written
"epic fantasy" prose with no revision pass, matched for length, and committed to
`corpus/40-dialogue/data/badprose-arm.json` *before* the run so it cannot be tuned.
Normalise all 36 per RI-DLG07 §A step 2. Ask a judge who has not seen `corpus/`:

> "These 36 passages come from three different sources. Sort them into three piles of twelve
> and describe each pile in one sentence. Then say, for each pile, whether the writing is
> bad, deliberately old-fashioned, or good."

**Pass:** our 12 are distributed across the Morrowind pile and our own pile, with **≤ 3 of
12 landing in the pile the judge calls "bad"**, and the judge's description of the pile
containing ours cites *deliberate* archaism or formality. **Hard fail:** ≥ 7 of our 12 land
in the bad pile, or the judge sorts our 12 into one clean pile and calls it bad — that is
not good-bad writing, that is a house style of bad writing, and the excuse is void.

## Comparison method

Every step is executable by a fresh agent from the repo root. Steps T1–T3, T5, T7–T9 are
static analysis over `game/data/**` and need no browser (HARNESS §7 makes prose-in-data a
hard requirement; prose assembled at runtime is unmeasurable and scores **0**).

**T1 — Surface statistics.**
```bash
python3 corpus/80-methods/tone-metrics.py --reference --json reports/tone-reference.json
python3 corpus/80-methods/tone-metrics.py --ours game/data --json reports/tone-ours.json
```
The `--ours` path harvests every string under the keys `text|body|line|response|entry|prose|greeting|rumour|rumor` from every `*.json` under `game/data/`, dedupes by exact text, and emits the same metric bundle as `--reference`. Compare against §A. **Report both files' `texts_distinct` and `words`; a run over fewer than 60,000 words of our own dialogue is not a measurement of our tone and must be reported as `insufficient_sample`.**

**T2 — The anti-register lint (build gate).**
```bash
python3 corpus/80-methods/tone-metrics.py --reference --lint   # MUST print "clean"
python3 corpus/80-methods/tone-metrics.py --ours game/data --lint
```
The first invocation is the calibration proof and must be run every time, before the second.
If the reference run is not clean, the thresholds have been edited into a wrong bar and the
item — not the game — is at fault. The second invocation's exit code **is** the gate: exit 1
fails the piece for §E regardless of every other number here.

**T3 — Indifference ratio and its decomposition.** Read `indifference_ratio`, `warm_rate`,
`cold_rate`, `praise_rate`, `non_address_rate` from `reports/tone-ours.json` and score
against I1–I5. Then compute I6 and I7 directly from the data:
```bash
node tools/analysis/content-stats.mjs --dialogue --by-npc --by-settlement \
     --out reports/dialogue-census.json
```
I6 = NPCs whose entire authored line set is `FLAT`/`COLD` at every declared disposition
band. I7 = per-settlement greeting pools (`game/data/dialogue/greetings.json`) classified by
the same six tiers, one row per settlement.

**T4 (T-BLIND) — Register assignment.** Sample **60 dialogue responses + 20 journal entries**
uniformly at random from `game/data/dialogue/**` and `game/data/quests/**.journal`, seeded
and recorded. Normalise per RI-DLG07 §A step 2 (all proper nouns replaced). Hand a fresh
judge the six register names, the eighteen §C exemplars as the calibration key, and this
instruction verbatim:

> "Assign each of the 80 passages to exactly one of: DEADPAN, PORTENTOUS, PETTY, CRUEL,
> ABSURD, BUREAUCRATIC, or NONE. Judge the register of the voice, not the subject matter.
> Then say in one sentence what the dominant register of this world is, and whether it has
> one."

Compute the distribution and its Shannon entropy; score R1–R4. **Calibrate the judge first**
by running the identical instruction over 80 passages drawn from the reference corpus; a
judge assigning > 35% of the *reference* to NONE is unreliable and the result on ours is
void.

**T5 — Tonal-range census (N1–N7).** Static analysis over `game/data/`:
```bash
node tools/analysis/content-stats.mjs --dialogue --by-npc --min-lines 15 \
     --out reports/npc-lines.json
```
For every NPC with ≥ 15 lines, take 3 random lines, run them through the T4 blind procedure,
and record the NPC's primary register. Count against N1, N4, N5, N7. N2/N3/N6 are counted
from `game/data/books/**` and `game/data/dialogue/**` entries carrying the declared
`register` field, and each declared instance must additionally survive a blind check: show
the text to a judge and ask "is this frightening / beautiful / boring?" — a declared
frightening text that no judge finds frightening does not count.

**T6 (T-GOODBAD) — The three-pile blind test.** §F. Uses
`node tools/blind/make-pair.mjs` for assembly and normalisation, extended to three arms; the
bad arm is `corpus/40-dialogue/data/badprose-arm.json` and its git commit hash must predate
the run and be recorded in the verdict.

**T7 — Chosen-one gate (A8).** Build the reachability set of dialogue nodes and journal
entries available before main-quest act 3, from `game/data/quests/**` stage graphs plus
`game/data/dialogue/topics/**` conditions. Run the A8 probes over that subset only. **Any
hit is a hard fail of §E.** Report the reachability set size; a subset smaller than 25% of
all dialogue means the gating is being computed wrongly and the check is void.

**T8 — Bathos count (N8).** Read `stakes_stated` and `stakes_actual` from every quest file;
count `|Δ| ≥ 2` and the sign of each. Cross-check 4 of them by hand against the quest's own
text: a quest declaring `stakes_stated: 5` whose giver's dialogue does not actually make a
world-scale claim is a mis-declaration and a defect.

**T9 — Cross-check against RI-DLG06.** This item's T1 measures the corpus *in aggregate*;
RI-DLG06 measures it *per archetype*. They must agree: the corpus-wide `w_per_sent_mean`
must lie inside the range spanned by RI-DLG06's six archetype bands, and the archetype
spread (≥ 8.0 w/sent) must be reproducible from the same dump. A build passing RI-DLG06 and
failing T1 has archetypes whose weighted mean is nowhere near any of them, which means the
line volumes are wildly lopsided — report which archetype dominates.

**Requested harness / tooling extensions** (none of this item's checks can run without them;
listed here and in the dispatching agent's reply per CORPUS-CONTRACT §5):
1. `tools/analysis/content-stats.mjs` gains `--dialogue --by-npc --by-settlement --min-lines N`.
2. `tools/blind/make-pair.mjs` gains a three-arm mode (`--arms ours,ref,bad`).
3. `getQuestState()` gains a per-quest `stage` integer and an `act` field, so T7's
   reachability set is computable from a run as well as statically.
4. Dialogue and book records in `game/data/` gain optional `register`, and quest records
   gain `stakes_stated` / `stakes_actual` (integers 1–5). These are **data-schema** requests
   on the builder, not harness changes.

## Scoring

Score 0–10 on the weighted mean of the check groups, each scored 0 / 1 / 2 =
fail / pass / exceed: **I1 ×4**, §E lint ×4, R1–R4 ×3, T-GOODBAD ×3, N1–N8 ×2,
T1/T3/T9 ×2, all other T-metrics ×1.

| Score | Condition |
|---|---|
| 10 | I1 within 0.02 of 0.87; lint clean; R2 ≥ 2.3 bits with no register above 45%; T-GOODBAD ≤ 1 of 12 in the bad pile; all of N1–N8 met or exceeded |
| 8 | I1 in band; lint clean; ≥ 5 registers at ≥ 5%; entropy ≥ 2.0; T-GOODBAD ≤ 3 in the bad pile; ≥ 6 of 8 N-slots met |
| 6 | I1 in band; lint clean; 4 registers present; ≤ 3 T-metrics outside band; ≥ 4 N-slots met |
| 4 | I1 in 0.72–0.78 or 0.92–0.95; lint clean; the world has a tone but only one |
| 2 | Lint clean but I1 < 0.72 — every NPC is pleased to see you; or entropy < 1.5 |
| **0 — WE LOSE** | Any of: the lint exits 1 (§E violated); **any A4/A5 hit, or any A8 hit before act 3**; I1 < 0.72 or > 0.95; R3 > 65% (one register is the whole game); T-GOODBAD puts ≥ 7 of our 12 in the bad pile; `--reference --lint` is not clean (the thresholds were tuned rather than calibrated); our dialogue sample is under 60,000 words |

The lint and the good-bad test are **individually disqualifying**. A build that quips is not
this game, and prose that a blind judge sorts into the bad pile is not saved by any number
above it.

## How we lose

- **Everyone is pleased to see you.** The single most likely failure and the reason this
  item exists. An LLM writing 60,000 words of NPC dialogue produces helpful, courteous,
  mildly enthusiastic people, because that is what it was trained to be. Every greeting
  offers assistance; every quest-giver thanks you; every guard is professional but warm.
  I1 lands near 0.55 and every other dialogue item in this directory still passes.
- **Indifference faked by blandness.** The mirror failure, and the one this item's own
  metric invites: write nothing warm, hit 0.95, and ship a world of grey non-people. I2's
  floor (`warm_rate` ≥ 0.05) and I3's floor (`cold_rate` ≥ 0.035) exist for exactly this.
  Morrowind is not cold; it is *indifferent*, which requires both poles to exist.
- **Rudeness as a substitute for indifference.** Making every NPC snarl. That is a different
  game (a Souls hub full of cryptic contempt) and it fails I2's floor and R3.
- **Quips.** "Well, that went well." "Don't ask." A single quippy line in a trailer-facing
  scene will define the game's tone for everyone who sees it. A3's threshold is 0.5/10k
  words against Morrowind's measured 0.029; it is deliberately near-zero.
- **The tone the model reaches for when asked to be "Morrowind-like":** long subordinated
  sentences, archaic diction, no contractions, `thee`/`thou`, and a portentous register
  everywhere. Every one of those is measurably *un*-Morrowind — T1 (8.08 w/sent), T9 (14.4%
  subordinated), T13 (35 contractions/1k), R3 (no register above 55%). Pastiche fails this
  item harder than plain modern prose does.
- **Purple prose defended as "good-bad writing".** The excuse is available the moment §F
  exists, which is why §F ships with a deliberately-bad third arm committed in advance. If
  a judge sorts our ornate excerpts into one pile and calls it bad, we do not get to cite
  Morrowind.
- **Registers that exist only in the register list.** One comic NPC with four lines, one
  "frightening" book that is a monster stat block in prose. N1's ≥15-line minimum, N1's
  quest-giver clause and N2/N3/N6's blind confirmation exist because declaring a register in
  a JSON field is free.
- **Tutorialising smuggled in as characterisation.** "You'll want to hold your shield up
  against that one." A4/A5 are absolute-zero checks because there is no acceptable rate.
- **Chosen-one deference in hour one.** The most seductive failure in an original main quest:
  the opening NPC who tells you the prophecy is about you. Morrowind takes forty hours and
  three trials to say it, and says it grudgingly, through a Temple that spent the whole game
  trying to have you killed for it.
- **Bathos in one direction only.** Six quests where the world-ending threat turns out to be
  a lost shoe reads as contempt for the player. N8's two-directional requirement forces the
  other half: the errand that turns out to matter.
- **The measurement run on 8,000 words.** Every threshold here is a *distribution*, and a
  distribution over 8,000 words of dialogue is noise. T1's `insufficient_sample` clause and
  the score-0 clause make an under-written game fail here rather than pass by accident.

## Provenance note

- **Every figure in §A, §B and §E's "Morrowind (measured)" column is `community-data`,
  confidence high, and was computed this session** — not recalled — from
  `corpus/40-dialogue/data/morrowind-dialogue.csv.gz`, the vendored Kezyma/Morrowind-Voices
  extraction of `Morrowind.esm` / `Tribunal.esm` / `Bloodmoon.esm` dialogue INFO records
  (69,876 rows). The *extraction* is theirs; all arithmetic is ours. Reproduce every number
  with `python3 corpus/80-methods/tone-metrics.py --reference`. Scope: exact-text dedupe →
  28,051 distinct texts / 691,257 words / 85,502 sentences. Tokens `[A-Za-z']+`; sentences
  split on `[.!?]` + whitespace.
- **Scope caveat, and it matters.** The vendored CSV has no `Topic` / `DialogueType` column,
  so greetings, service text, topic responses and quest text **cannot be separated**. §A is
  therefore a measurement of *all authored NPC prose taken together*, which is the right
  scope for a whole-corpus tone bar and the wrong scope for a per-context one. `FactionId`
  is populated on only 2,204 of 69,876 rows, so faction-sliced tone statistics are not
  available from this file and none are claimed. This also means §A's `w_per_sent_mean` of
  8.08 is **not** comparable line-for-line with RI-DLG06 §A's class-filtered figures (which
  range 6.0–17.9 by archetype); T9 exists to reconcile the two scopes rather than pretend
  they are the same number. The `README.md` in that data directory records a further open
  discrepancy with RI-DLG02's word counts that the corpus audit must still rule on.
- **The stance classifier is `constructed` and is a lexicon cascade, not semantics.** Six
  regex tiers, listed in full in `corpus/80-methods/tone-metrics.py`. It has known false
  positives (lore text about "the outlander invaders" scoring `C2`; a shopkeeper's "welcome"
  scoring `W1`) and known false negatives (indifference expressed purely through syntax). It
  is used because it is **deterministic, symmetric and reproducible**: the same instrument
  runs over Morrowind and over us, so a bias applies equally to both sides and the *ratio*
  survives it. Hand-validated on 40 random texts per class this session. It is not a
  sentiment model and must never be reported as one.
- **The adjective index (T12) is a proxy, not a POS measurement.** This machine has no
  `nltk`, `spacy`, `sklearn` or `numpy` (verified 2026-08-06), so §F's and T12's adjective
  counts are a suffix rule (`-ous -ful -less -able -ible -ive -ic -ical -ish -ant -ent -ary
  -ory -al`) plus a 120-word closed list, minus a stoplist. It over-counts nouns in `-al`
  and `-ent`. It is admissible only because it is applied identically to both corpora;
  a critic must not cite 4.65/100w as "Morrowind's adjective density".
- **Everything in §C's register scheme, §D's counts, §E's limits, §F's four axes and every
  band and threshold in §A/§B is `constructed`** for this project and binding per
  CORPUS-CONTRACT §3. The six registers are adapted from BAR-CRITIQUE-01's proposal; the
  eighteen exemplar lines are verbatim `community-data` from the corpus above, quoted with
  speaker id and source module so they can be re-extracted.
- **Two of BAR-CRITIQUE-01's proposed thresholds for this item are rejected on measurement:**
  the indifference band 0.45–0.75 (Morrowind measures 0.3723 on the critique's own
  definition — see §B's warning box), and the implicit assumption that Morrowind contains no
  contemporary idiom (it contains 4.962 hard-idiom hits per 10k words — see §E A1). The
  entropy floor (≥ 2.0 bits), the ≥ 5-of-6 register requirement and the bathos count (≥ 6)
  are adopted as proposed; the "no register above 60%" clause is tightened to 55%.
