---
id: RI-DLG06
title: Dialogue voice differentiation — measurable style fingerprints per speaker archetype
kind: number
side: morrowind
judges: [dialogue.voice, dialogue.writing, npc.character, lore.register]
provenance: community-data
confidence: high
blind_pair: yes
---

## The bar

An Ordinator does not sound like a beggar. In Morrowind this is not a vibe — it is
*measurable*, and the numbers are enormous. A Temple Ordinator's mean sentence is **17.9
words**; a slave's is **6.0**. A Savant's vocabulary is `conditioned, organic, phenomenon,
culturally, aristocracy`; a guard's is `thirsty, booze, violated, surrender, sentence`. An
Ashlander says "outlander" **5.15 times per thousand words**, seven times the corpus rate,
and never says "sera". A Khajiit refers to himself in the third person — "%Name has heard
nothing of the murder. %Name minds %Name's business." — at **3.8 self-references per
thousand words**. These are fingerprints, and a critic can compute every one of them from a
text dump in under a minute. **This is the most common failure mode in AI-authored dialogue
and the easiest to hide behind volume**: 20,000 words in which every NPC is a mildly
formal, mildly helpful narrator with a different name. The bar is that our archetypes are
separable by a blind judge from three lines apiece, and separable by a classifier from
surface statistics alone.

## The reference artifact

### A. Measured Morrowind fingerprints

Computed over the deduplicated Morrowind dialogue corpus. `w/entry` = mean words per
response; `w/sent` = mean words per sentence; `≤6w` / `>20w` = share of sentences that short
or that long; `STTR` = standardised type-token ratio over 500-token windows (size-independent
lexical variety).

**By class filter (generic dialogue):**

| Archetype | n words | w/entry | **w/sent** | sd | ≤6w | >20w | STTR |
|---|---:|---:|---:|---:|---:|---:|---:|
| **Savant** (scholar) | 17,287 | 58.6 | **17.8** | 8.5 | 4.8% | 32.0% | 0.520 |
| **Ordinator** (Temple enforcer) | 233 | 23.3 | **17.9** | 6.4 | 7.7% | 30.8% | 0.511 |
| **Noble** | 2,308 | 39.1 | **16.3** | 6.3 | 2.8% | 24.6% | 0.475 |
| **Beggar/Pauper** | 733 | 33.3 | **13.8** | 6.0 | 3.8% | 17.0% | 0.470 |
| **Commoner** | 1,008 | 36.0 | **11.7** | 6.9 | 24.4% | 14.0% | 0.491 |
| **Miner** | 1,373 | 31.9 | **10.2** | 6.0 | 37.3% | 6.0% | 0.350 |
| **Publican** | 928 | 29.9 | **10.1** | 5.8 | 31.5% | 4.3% | 0.528 |
| **Guard** | 3,890 | 22.1 | **7.8** | 4.7 | 48.6% | 2.8% | 0.409 |
| **Slave** | 707 | 15.4 | **6.0** | 3.6 | 69.5% | 0.8% | 0.314 |

**Spread across archetypes: 6.0 → 17.9 = 11.9 words of mean sentence length.** That is the
number a critic should have in mind when reading our corpus.

**By named individual (speaker-unique dialogue):**

| Speaker | Archetype | n words | w/entry | w/sent | ≤6w | >20w | STTR |
|---|---|---:|---:|---:|---:|---:|---:|
| Vivec | god-king | 3,776 | 58.1 | 11.4 | 31.0% | 11.7% | 0.460 |
| Hasphat Antabolis | scholar-warrior | 2,279 | 43.0 | 11.3 | 25.4% | 12.4% | 0.516 |
| Aryon | Telvanni wizard-lord | 3,878 | 27.1 | 10.4 | 24.1% | 4.0% | 0.448 |
| Nileno Dorvayn | House steward | 2,890 | 20.5 | 9.4 | 27.2% | 3.9% | 0.460 |
| Ajira | apprentice | 1,663 | 20.0 | 9.3 | 33.0% | 2.2% | 0.391 |
| Caius Cosades | spymaster | 8,309 | 49.5 | **9.0** | **41.9%** | 5.9% | 0.473 |
| Eydis Fire-Eye | guild steward | 1,959 | 21.8 | 8.7 | 35.7% | 2.2% | 0.463 |
| Sharn gra-Muzgob | necromancer | 1,206 | 35.5 | 8.4 | 51.0% | 7.0% | 0.544 |
| Sugar-Lips Habasi | Khajiit thief-boss | 1,154 | 18.6 | **7.9** | 39.7% | 0.7% | 0.419 |
| Divayth Fyr | ancient wizard | 1,772 | 32.2 | **6.5** | **59.4%** | 1.5% | 0.521 |

Read Caius and Divayth Fyr against Hasphat. Caius says a *lot* (49.5 words per response)
in *very short* sentences (9.0, 42% of them six words or fewer) — a spy who briefs you.
Divayth Fyr says 32 words per response in 6.5-word sentences, 59% of them clipped — an
immortal who cannot be bothered. Hasphat says 43 words in 11.3-word sentences with 12% long
ones — a man who writes monographs. **Same word volume, three completely different mouths.**

**Address form and self-reference, per 1,000 words** (the cheapest, sharpest signal):

| Group | outlander | sera | pilgrim | friend | citizen | fetcher | n'wah | %PCName | self-in-3rd-person |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| corpus baseline | 0.75 | 0.10 | 0.18 | 1.24 | 0.08 | 0.04 | 0.17 | 4.04 | 0.04 |
| **Ashlander** | **5.15** | 0.00 | 0.00 | 1.17 | 0.00 | 0.00 | 0.00 | 2.05 | 0.00 |
| **Ordinator (class)** | 0.00 | 0.00 | **12.88** | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| **Noble (class)** | **3.44** | 0.00 | 0.00 | 0.43 | **1.29** | 0.00 | 0.00 | 0.00 | 0.00 |
| **Khajiit (race)** | 0.08 | 0.00 | 0.00 | **8.18** | 0.00 | 0.00 | 0.00 | **7.43** | **3.78** |
| **Thieves Guild** | 0.11 | 0.05 | 0.05 | **4.52** | 0.00 | 0.00 | 0.27 | 4.57 | 0.00 |
| **Slave (class)** | 0.00 | **0.80** | 0.00 | 3.22 | 0.00 | 0.00 | 0.00 | 4.02 | high (verb forms) |
| **Temple** | 1.08 | 0.04 | **1.32** | 0.20 | 0.08 | 0.00 | 0.08 | 2.83 | 0.00 |
| **Redoran** | **1.70** | 0.10 | 0.46 | 0.77 | 0.05 | 0.00 | 0.00 | 4.93 | 0.00 |
| **Imperial Legion** | 0.05 | **0.40** | 0.05 | 0.96 | 0.10 | **0.15** | 0.00 | 2.78 | 0.00 |
| **Hlaalu** | 0.39 | 0.09 | 0.04 | 0.83 | 0.00 | 0.13 | **0.35** | 4.00 | 0.00 |
| **Telvanni** | 0.97 | 0.00 | 0.00 | **0.10** | 0.25 | 0.00 | 0.00 | 2.55 | 0.10 |

Telvanni say "friend" at **one twelfth** the corpus rate and one eightieth the Khajiit rate.
That single cell is a character.

**Characteristic lexicon** (words with the highest frequency lift over the corpus baseline,
proper nouns and stopwords excluded):

| Archetype | Marker lexicon (lift ×) |
|---|---|
| **Savant / scholar** | conditioned ×26, organic ×24, phenomenon ×23, culturally ×23, aristocracy ×23, sparsely ×21, proportional ×19, observers ×19 |
| **Noble** | kinsmen ×107, holdings ×88, rights ×36, retainers ×35, wealth ×33, loyalty ×31, traditions ×28, clan ×21 |
| **Guard** | thirsty ×109, violated ×102, booze ×91, court ×80, surrender ×64, sentence ×64, laws ×40, alcohol ×36 |
| **Slave** | sneaks ×623, freed ×382, freedom ×219, sees ×130, thinks ×78, boss ×76, escape ×49, free ×48 |
| **Beggar** | vampirism ×241, necromancy ×75, blood ×38, cure ×27, disease ×17, blight ×14 |
| **Ashlander** | gulakhan ×19, ashkhan ×19, khans ×19, tribe ×17, initiation ×16, counsel ×16, unites ×16 |
| **Telvanni** | rudimentary ×22, schematics ×21, antecedents ×23, chronicles ×22, trinkets ×21, chores ×21 |
| **Khajiit** | understands ×25, hopes ×21, smuggle ×25, samples ×35, leaves ×20 (+ third-person self-reference) |
| **Thieves Guild** | doin' ×24, clink ×24, ledger ×22, goblet ×25, ours ×13, smuggle ×17 |

Note the **Slave** row: `sneaks, sees, thinks, puts, takes, comes` — third-person singular
verb forms at 100–600× baseline. That is not a vocabulary, it is a *grammar*: the slave
speaks about himself as "he". The same construction drives the Khajiit fingerprint. **The
strongest voice signals in Morrowind are grammatical, not lexical.**

### B. Our required archetypes and their fingerprint targets

Six archetype slots, mapped to our Black Marsh setting in `corpus/60-lore/`. Each must hit
its band. Bands are constructed but calibrated directly on §A.

| # | Archetype (function) | **w/sent** | ≤6w | >20w | w/entry | STTR | Required address form | Required grammar tic |
|---|---|---:|---:|---:|---:|---:|---|---|
| 1 | **Zealot / law-enforcer** (Ordinator-analogue) | **16–19** | ≤10% | ≥25% | 20–30 | ≥0.48 | a religious/legal title for the player ("pilgrim", "citizen of the covenant"), ≥ 8/1k | impersonal passive; imperatives with a legal object |
| 2 | **Wizard-lord / arcane aristocrat** (Telvanni-analogue) | **10–13** | 20–30% | ≤6% | 25–35 | ≥0.44 | *no* familiar address; "outlander"-class term ≥ 0.8/1k; "friend" ≤ 0.2/1k | subordinate clauses; conditional mood; never explains |
| 3 | **Foreign trader / smuggler** (Khajiit-analogue) | **7–9** | 35–45% | ≤2% | 15–25 | 0.38–0.46 | "friend" ≥ 5/1k; player's name ≥ 5/1k | **third-person self-reference ≥ 2.5/1k** |
| 4 | **Beggar / destitute** | **12–15** | ≤10% | 12–20% | 25–40 | ≥0.45 | "sera"/deferential form ≥ 1/1k | conditional pleading; gratitude formulas; runs on |
| 5 | **Guard / soldier** | **7–9** | ≥45% | ≤4% | 18–26 | 0.38–0.45 | rank-neutral or "citizen"; ≤ 0.2/1k familiar terms | imperative mood; procedural legal nouns |
| 6 | **Scholar / archivist** (Savant-analogue) | **16–19** | ≤8% | ≥28% | 45–65 | ≥0.50 | none; addresses the *topic*, not the player | nominalisations; qualifications ("generally", "in most accounts") |

**Separation requirements (all binding):**

- **Global spread**: `max(w/sent) − min(w/sent) ≥ 8.0`. Morrowind's is 11.9.
- **Pairwise separation**: for every pair of archetypes, `|Δ w/sent| ≥ 2.0` **or**
  `|Δ ≤6w| ≥ 15pp` **or** `|Δ STTR| ≥ 0.06`. No two archetypes may be statistically
  indistinguishable on all three.
- **Lexicon**: each archetype must have **≥ 5 marker words at lift ≥ 5×** over our own
  corpus baseline, excluding proper nouns and stopwords.
- **Address**: each archetype must have **≥ 1 address form at ≥ 1.0/1k that is ≤ 0.3/1k in
  at least four of the other five archetypes.**
- **Grammar tic**: each archetype must have **one syntactic marker** (not just a word list)
  that a critic can regex. This is the requirement that separates real voice work from a
  thesaurus pass.
- **Named-NPC variance within an archetype**: the three most talkative NPCs of each
  archetype must not all sit within ±1.0 w/sent of the archetype mean. Morrowind's guild
  stewards (Eydis 8.7, Nileno 9.4, Ranis 8.6) cluster; its wizards (Aryon 10.4, Divayth Fyr
  6.5, Sharn 8.4) emphatically do not. **At least 2 named NPCs in the game must sit ≥ 3.0
  w/sent away from their archetype's centroid** — a character who breaks their own type.

## Comparison method

**Step 1 — dump with archetype labels.**
```
node tools/corpus/dump-dialogue.mjs --out /tmp/d.tsv --with-archetype
# text \t actor_id \t archetype \t faction \t is_named
```

**Step 2 — compute fingerprints.** `tools/corpus/style-fingerprint.py`:
```python
import csv, re, statistics, collections
D=list(csv.DictReader(open('/tmp/d.tsv'),delimiter='\t'))
tok=lambda t: re.findall(r"[A-Za-z']+", t.lower())
sen=lambda t: [s for s in re.split(r'(?<=[.!?])\s+', t.strip()) if tok(s)]
def fp(texts):
    texts=list(dict.fromkeys(texts)); W=[]; SL=[]; WPE=[]
    for t in texts:
        k=tok(t); W+=k; WPE.append(len(k))
        SL+=[len(tok(s)) for s in sen(t)]
    win=[W[i:i+500] for i in range(0,len(W)-499,500)]
    sttr=statistics.mean(len(set(w))/500 for w in win) if win else len(set(W))/max(1,len(W))
    return dict(words=len(W), wpe=statistics.mean(WPE), wps=statistics.mean(SL),
                sd=statistics.pstdev(SL),
                short=sum(1 for x in SL if x<=6)/len(SL),
                long=sum(1 for x in SL if x>20)/len(SL), sttr=sttr)
G=collections.defaultdict(list)
for r in D: G[r['archetype']].append(r['text'])
F={a:fp(v) for a,v in G.items() if len(' '.join(v).split())>=400}
for a,f in sorted(F.items(), key=lambda kv:-kv[1]['wps']):
    print(f"{a:26s} w={f['words']:6d} w/entry={f['wpe']:5.1f} w/sent={f['wps']:5.1f} "
          f"<=6w={f['short']:.1%} >20w={f['long']:.1%} STTR={f['sttr']:.3f}")
sp=max(f['wps'] for f in F.values())-min(f['wps'] for f in F.values())
print("SPREAD", round(sp,2), "PASS" if sp>=8.0 else "FAIL")
import itertools
for a,b in itertools.combinations(F,2):
    d1=abs(F[a]['wps']-F[b]['wps']); d2=abs(F[a]['short']-F[b]['short']); d3=abs(F[a]['sttr']-F[b]['sttr'])
    if not (d1>=2.0 or d2>=0.15 or d3>=0.06):
        print("NOT SEPARATED:",a,b,round(d1,2),round(d2,3),round(d3,3))
```

**Step 3 — address-form and grammar-tic matrix.** Build the §A-style table for our corpus:
per-1,000-word rate of every declared address form × every archetype, plus each declared
grammar tic as a regex. Required: the diagonal dominates — each archetype's own marker is
≥ 3× its rate in the median other archetype.

**Step 4 — lexicon lift.** Same computation as §A: per archetype, top-16 words by
`(freq_in_archetype / freq_in_corpus)`, excluding stopwords and proper nouns (a word is
proper if it appears capitalised mid-sentence in > 60% of occurrences). Required: ≥ 5 words
at lift ≥ 5×, and **a human must read the list and confirm it is thematic, not incidental**
— `kinsmen, holdings, retainers, loyalty` is a voice; `the, and, is` is a small sample.

**Step 5 — the classifier test (automated separability).**
```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_score
X=[r['text'] for r in D]; y=[r['archetype'] for r in D]
v=TfidfVectorizer(ngram_range=(1,2), min_df=2, sublinear_tf=True)
print("6-class CV accuracy:", cross_val_score(LogisticRegression(max_iter=2000), v.fit_transform(X), y, cv=5).mean())
```
Required: **≥ 0.60** six-class accuracy (chance = 0.167). Below 0.35 the archetypes are not
distinguishable by any surface signal and the item fails outright. *Also report accuracy
with all proper nouns masked* — if accuracy collapses when names are masked, the classifier
was reading names, not voices, and only the masked number counts.

**Step 6 — the blind archetype test (the human one, and the sharpest).**
Prepare a card per archetype: **3 response lines, no names, no place names, no attribution,
no quest content.** Shuffle the 18 lines. Hand a judge the six archetype *descriptions*
(one sentence each, no style hints) and the 18 shuffled lines, and give exactly this
instruction:

> "Below are eighteen lines of dialogue from a role-playing game, and six descriptions of
> the kinds of people who live in it. Assign every line to exactly one description, three
> lines per description. Do not guess from subject matter — assign on how the person
> speaks. When you are done, write one sentence per description explaining what in the
> language made you assign those three lines."

Required: **≥ 14/18 lines correct (≥ 5 of 6 archetypes fully correct)**, and the judge's
explanations must cite *language* features (sentence length, address, grammar), not content.
Run the identical test on the Morrowind reference lines in §C of RI-DLG07 to calibrate the
judge; if the judge scores below 14/18 on the reference set, the judge is unreliable and
the result on ours is void.

**Step 7 — the one-voice smell test.** Sample 30 random lines from across all archetypes,
strip attribution, and ask a judge: *"How many different people wrote/speak these?"*
An answer of "one" or "two" is a fail regardless of every number above.

## Scoring

| Check | Pass | Hard fail |
|---|---|---|
| Global spread ≥ 8.0 w/sent | yes | < 5.0 |
| Pairwise separation (all 15 pairs) | 15/15 | ≥ 4 pairs unseparated |
| Lexicon: ≥5 markers at ≥5× per archetype | 6/6 archetypes | ≤ 3 archetypes |
| Address matrix diagonal ≥ 3× | 6/6 | ≤ 3 |
| Grammar tic present & regexable | 6/6 | ≤ 3 |
| Classifier accuracy (names masked) | ≥ 0.60 | < 0.35 |
| Blind archetype test | ≥ 14/18 | ≤ 10/18 |
| Type-breaking named NPCs | ≥ 2 | 0 |
| One-voice smell test | judge says ≥ 4 voices | judge says ≤ 2 |

**PASS** = 8 or 9 checks pass, no hard fail. **MARGINAL** = 6–7. **FAIL** = ≤ 5, or any
hard fail. The blind archetype test and the classifier test are individually disqualifying:
if a human cannot tell our NPCs apart and a linear model cannot either, nothing else in this
file matters.

## How we lose

- **One voice, six nameplates.** The default failure. Every NPC speaks in the same
  mid-length, mildly helpful, faintly formal register, differing only in what they talk
  about. Symptom: spread < 3.0 w/sent; classifier accuracy collapses to ~0.2 with names
  masked; the blind judge assigns lines by subject matter and says so in their explanations.
- **Voice = vocabulary swap.** The guard says "citizen" and the wizard says "outlander" and
  otherwise both produce 12-word sentences with identical syntax. Passes the address matrix,
  fails the spread and the grammar-tic requirement. **This is the sophisticated version of
  the failure and the one most likely to slip through** — hence step 3 requires a *syntactic*
  marker per archetype, not a lexical one.
- **Accents instead of voices.** Dropped g's, "aye", phonetic spelling, and a Khajiit who
  says "this one" every second sentence. Morrowind's Khajiit third-person is a grammatical
  rule applied consistently, not a tic sprayed on top. Overuse is as detectable as absence:
  cap third-person self-reference at 8/1k (Morrowind's Khajiit sit at 3.8).
- **No short-sentence archetype.** LLM-written dialogue drifts long. If no archetype lands
  under 9 w/sent with ≥ 40% of sentences at six words or fewer, we have no guard, no slave,
  no Caius, no Divayth Fyr — and the whole distribution collapses toward 12–14.
- **No long-sentence archetype either.** Equally: nothing above 16 w/sent with ≥ 25% of
  sentences over 20 words means no scholar, no zealot, no noble, and lore delivery has
  nowhere to live.
- **Uniform entry length.** Everything 25–35 words. Caius says 49.5, Habasi says 18.6.
  Volume-per-turn is itself a voice parameter.
- **Every character is polite.** Nobody refuses, nobody condescends, nobody is bored by you.
  Divayth Fyr's 59.4% clipped sentences *are* his contempt.
- **Archetype centroids with no outliers.** Every wizard sits within a hair of the wizard
  mean. Real casts have a Divayth Fyr who breaks the type — hence the ≥2 type-breakers rule.
- **Fingerprints achieved by post-processing.** Someone writes one voice and then runs a
  "make this terser" pass over the guard lines. It will hit the sentence-length band and
  fail the lexicon lift and the grammar tic, because the *content* of what a guard notices
  (booze, courts, sentences, surrender) did not change. Step 4's human read is the check.
- **Gaming the classifier.** Injecting a rare token into each archetype to spike accuracy.
  Step 5's masked run plus step 6's human blind test are both required precisely so that no
  single number can be optimised into a pass.

## Provenance note

- **Every number in §A is `community-data`, confidence high.** They are statistics I
  computed directly over a community extraction of `Morrowind.esm`/`Tribunal.esm`/
  `Bloodmoon.esm` dialogue: <https://github.com/Kezyma/Morrowind-Voices>,
  `Progress/Archive/Morrowind.csv` (speaker-attributed, 12,854 distinct texts / 375,025
  words) and `Progress/Archive/Morrowind Generic.csv` (4,444 distinct texts / 129,871
  words, carrying `GenClass` / `GenFaction` / `GenRank` / `GenCell` filter columns).
  Method: exact-text dedupe; tokens = `[A-Za-z']+`; sentences split on `[.!?]` + whitespace;
  STTR over non-overlapping 500-token windows; lift = archetype rate ÷ corpus rate with
  add-one smoothing, excluding stopwords and words capitalised mid-sentence in >60% of
  occurrences.
- **Caveat on small samples.** The Ordinator class filter carries only **233 words** (10
  entries) and the Pauper class **733**. Their sentence-length and STTR figures are
  directionally right but statistically thin, and their lexicon lift is unusable (the
  Ordinator "lexicon" degenerates to stopwords). Where this file leans on Ordinators it
  leans on `w/sent`, `>20w` and the "pilgrim" address rate (12.88/1k), all of which are
  robust to sample size in a way the lexicon is not. **Confidence medium** for those two
  rows specifically; high for Savant, Noble, Guard, Slave, and every faction and race row,
  all of which exceed 700 words and most of which exceed 10,000.
- **Caveat on class filters.** A class-filtered generic entry is dialogue *written for* that
  class, which is exactly the authorial voice signal we want; it is not a transcript of
  everything an Ordinator says (much of which comes from unfiltered global entries and would
  dilute the fingerprint). This makes §A a measurement of **authorial intent per archetype**,
  which is the right target for a writing bar.
- **Everything in §B — the six archetype slots, all bands, the separation rules, the
  type-breaker rule — is `constructed`** for this project, calibrated on §A. Binding
  regardless (CORPUS-CONTRACT §3).
- The verbatim example lines quoted in §A's prose ("%Name has heard nothing of the murder.
  %Name minds %Name's business.") are `community-data`, from the same extraction.
