# Blind judgement — pack `w1-22-r3-hard`

- **Judge:** `judge-w1-22-r3`, dispatched blind. I did not build this pack and had no part in
  the W1-22 round-2 critique (rule 25 satisfied).
- **Pack:** `reports/packs/w1-22-r3-hard/` (`PROMPT.md`, `pack.json`, `trials.json`).
- **Reveal:** `reports/packs/w1-22-r3-hard.reveal/` — **not opened** until §4 of this file was
  written. Everything above the `--- REVEAL BOUNDARY ---` line was on disk first.
- Pack `trials_sha256` per `pack.json`: `a45b278d2d2da6a8dbe6f0bd779218968e681066907318f51c57b25ee468ba07`.

---

## 0. Two things that must be said before the answers

### 0a. The dispatch asked a different question from the one the pack asks

I was dispatched to judge **quality**: *"For each trial you will have two recordings, A and B.
One is ours; one is a comparison. Decide which is the better ambience for a Black Marsh swamp
province."* With criteria: place-ness, events caused by presence rather than a loop timer,
deliberate silence, specific Argonian strangeness.

The pack does not ask that. `PROMPT.md` in the pack says, verbatim:

> **For each trial answer SAME (both recordings are the same place) or DIFFERENT (two different
> places), and give one sentence of reason citing at least one number.**

and further:

> A trial where both recordings are the same place may still be two different recordings of it: a
> different roll of the random number generator, or the same place at a different time of day.

There is no ours/reference axis in this pack. `pack.json` has no mapping and the trial objects
carry only `id`, `A`, `B`. A "which is better" answer is not merely unsupported here, it is
unanswerable: in roughly half the trials both recordings are the *same place*, so "which is the
better ambience for Black Marsh" has no defined answer for those trials.

This is the third clause of rule 25 in the flesh — *"a third turned out to be asking a provenance
question when the item specifies a quality one"* — except inverted: here the **dispatch** specifies
a quality question and the **pack** asks an identity question. I have answered the pack's question,
because that is the only question the artifact supports and the only one the reveal key can score.
I flag the mismatch rather than quietly papering over it (rule 26).

**Consequence for whoever commissioned this:** if item W1-22 needs a quality verdict on Black Marsh
ambience, this pack cannot supply one and no score derived from it should be reported as one. A
SAME/DIFFERENT discrimination result is a claim about whether the game's regions are
*distinguishable*. That is a real and useful claim — it is close to the "temporal behaviour alone
separates the regions 92% of the time" finding I was told about — but it is not a claim about
whether any of them is *good*.

### 0b. I did not listen to anything. There is no audio in this pack.

The dispatch said "This is a listening task" and asked me to say plainly whether I judged by ear or
by spectrogram. Neither. `PROMPT.md` states: **"You have no audio."** The pack contains one JSON
file. Each recording is a feature vector: six frequency bands × 120 half-second frames of
median-detrended dB, a broadband track of the same, plus four scalars. Loudness, absolute tone
colour and slow drift have been deliberately removed by the builder.

So the honest description of what I did is: **I judged 28 numeric feature vectors by statistics.**
Not by ear, not by spectrogram, not even from a waveform. Onset counts, inter-onset intervals,
silence ratios, per-band RMS, lag-1/20/60 autocorrelation, and stereo correlation. Anyone reading
"the judge listened to the ambience" off this report would be reading something false.

I also could not follow the dispatch's method step *"write your answer to disk before opening the
next trial"* as literally specified. All 26 trials live in a single 674 KB JSON file; parsing it
opens all 52 recordings at once. There is no way to reveal trial N without revealing trial N+1.
What I did instead: computed the full feature table in one pass, formed and wrote all 26 answers
before opening the reveal directory, and never read anything under `w1-22-r3-hard.reveal/` until
this file's §1–§3 were committed to disk. The ordering guarantee that matters (answers before key)
holds; the per-trial one does not, and the pack's format is why.

I was not tempted to open the key early. The temptation this pack actually offers is different and
worth naming: the recordings repeat across trials (§3.2), so after eight or nine trials you start
recognising a vector you have already scored, and the pull is to answer from the emerging graph
rather than from the numbers in front of you. I did use the graph — as a *consistency check* after
the fact, in §2 — not as the source of any answer.

---

## 1. Answers

Format: `Tnn ANSWER | confidence | reason`. `Rnn` are my own labels for the 28 distinct
recordings the pack contains (see §3.2); they are not in the pack.

```
T01 SAME      | medium      | Both sit fully decorrelated in stereo (+00.3 and +00.0, the only two
                              recordings in the pack under +2.0 apart from one other) and neither has
                              a single band excursion above +1.8 dB.
T02 SAME      | high        | Both are dead mono (+10.0/+10.0), quiet in 52% and 53% of frames, and
                              both fire 3-4 sharp impulses that reach +17.1 and +18.5 dB in the
                              2.5-5 kHz band with nothing whatever below 1 kHz.
T03 SAME      | high        | Per-band onset counts are 21/18/11/13/11/11 against 21/17/10/12/11/12,
                              with identical stereo (+09.7) and IQR +3.3 vs +3.2.
T04 DIFFERENT | high        | A peaks at +21.0 dB in 2.5-5 kHz with 24 broadband onsets; B peaks at
                              +5.5 dB with 8, and B's lag-1 autocorrelation is +0.89 against A's
                              +0.28 - B is a smooth breathing bed, A is an impulsive one.
T05 SAME      | high        | Feature distance 0.17, the smallest in the pack: p95 +2.0 both, stereo
                              +09.9 both, 36 vs 37 onsets, mean inter-onset 3.3 vs 3.2 frames.
T06 DIFFERENT | high        | A is within 0.15 dB of its floor in 64% of frames with zero broadband
                              onsets; B in 4% of frames with 34 onsets in each of the bottom three
                              bands.
T07 DIFFERENT | high        | Distance 6.60, the largest in the pack: B has essentially no energy
                              below 150 Hz (band RMS 0.03) while A sits at 1.57 there.
T08 SAME      | high        | Identical pair to T05 with the sides swapped - the same two vectors,
                              same 0.17 distance.
T09 DIFFERENT | medium      | Both are mono sparse-impulse places, but A is quiet in 52% of frames
                              with crest +17.6 while B is quiet in 96% with crest +23.2; each one's
                              nearest neighbour elsewhere in the pack is a different recording
                              (0.55 and 1.10 away), i.e. two tight clusters, not one loose one.
                              This is the trial I would most expect to be a time-of-day pair.
T10 SAME      | medium-high | Distance 0.33, stereo exactly +07.5 on both, p95 +0.7 and IQR +0.6 on
                              both; the 2.8 dB crest gap (+17.6 vs +20.4) is what holds me off high.
T11 DIFFERENT | high        | Stereo +00.0 against +10.0 - the two extremes of the scale - plus 25%
                              vs 64% silence.
T12 DIFFERENT | high        | Stereo +09.8 against +00.3, and A has 8 onsets at a 14.4-frame spacing
                              against B's 14 at 6.9 with a CV of 0.99.
T13 DIFFERENT | high        | A fires 3 impulses reaching +24.1 dB in 2.5-5 kHz and is otherwise
                              still (p95 +0.8); B has p95 +2.6 and nothing above +1.2 dB in that
                              same band.
T14 DIFFERENT | high        | A has 34 onsets in the 60-150 Hz band at stereo +02.3; B has zero
                              there and is dead mono at +10.0.
T15 DIFFERENT | high        | 8% silence against 64%, and B's 60-150 Hz band RMS is 0.03 against
                              A's 1.19.
T16 SAME      | high        | Distance 0.17: exactly 34 onsets in each of bands 1-3 on both, both
                              dead above 2.5 kHz (band-5 RMS 0.67 vs 0.64, band-6 0.29 vs 0.30),
                              p95 +2.6 both.
T17 SAME      | medium-high | Stereo +07.8 vs +08.0, the same [0,0,3,3,0,0] per-band onset shape -
                              events only in 400-2500 Hz - and band-6 RMS 0.23 vs 0.18.
T18 SAME      | high        | Both are quiet in 96% of frames with p95 and IQR of +0.1, and both
                              place 5 impulses in each of the top two bands.
T19 DIFFERENT | medium-high | B has 37 broadband onsets at a mean spacing of 3.2 frames (1.6 s); A
                              has 8 at 14.4 frames (7.2 s), and A's lag-1 autocorrelation is +0.89
                              against B's -0.63.
T20 SAME      | medium      | Stereo +03.9 vs +03.7 - a band of the scale occupied by only one other
                              pair in the pack - with sparse high-band impulses to +17.3 and +15.1
                              and no onsets below 400 Hz in either.
T21 DIFFERENT | high        | A reaches +24.1 dB in 2.5-5 kHz; B reaches +3.3 dB in the same band,
                              a 21 dB gap in event scale.
T22 SAME      | medium      | Identical pair to T20 with the sides swapped; same reasoning, same
                              +03.9/+03.7 stereo.
T23 DIFFERENT | high        | A has 34 onsets in 60-150 Hz and nothing at all in 400-2500 Hz;
                              B has zero onsets in the bottom band and all of its energy above
                              1 kHz (band-5 RMS 1.93 vs A's 1.33 with a dead midrange).
T24 SAME      | medium      | Stereo is exactly +09.0 on both, a value unique to this pair in the
                              whole pack, and both are near-still beds punctuated by impulses to
                              +25.1 and +24.1 dB. The band-5 RMS gap (2.38 vs 3.32) is real and is
                              why this is medium.
T25 DIFFERENT | high        | Stereo +09.7 against +00.2, with 24 onsets against 5.
T26 SAME      | medium-high | Distance 0.61, stereo +07.9 vs +07.8, both dead above 2.5 kHz
                              (band-6 RMS 0.20 vs 0.23), both with the [0,0,3,3,0,0] onset shape.
```

**Tally as answered: 13 SAME, 13 DIFFERENT.**

Confidence distribution: 13 high, 4 medium-high, 5 medium... (counting: high 17, medium-high 4,
medium 5). The five mediums are T01, T09, T20, T22, T24 — and T20/T22 are one judgement counted
twice, so there are really **four independent calls I am not confident in**: T01, T09, T20/T22, T24.

**Guessed:** none outright, but T09 and T24 are close enough to my SAME/DIFFERENT boundary that I
would not defend them past a coin flip if the boundary moved by 0.3 units.

## 2. Why the answer set is internally consistent

The 26 trials are 26 edges over 28 distinct recordings. My SAME answers assert these place-clusters:

- `{R01,R02}`, `{R03,R04}`, `{R05,R06}`, `{R08,R09}`, `{R11,R19}`, `{R13,R22}`, `{R14,R15}`,
  `{R16,R26}`, `{R20,R21,R28}`, `{R23,R24}`

My DIFFERENT answers assert 13 edges *between* clusters. **No DIFFERENT edge falls inside a cluster
and no SAME edge crosses one.** With 26 constraints over 28 nodes that is not automatic, and it is
the strongest independent evidence I have that the answers are coherent rather than 26 separate
coin-flips.

The distance metric is also cleanly bimodal, which is why I trust the split. Sorted trial distances:

```
0.17 0.17 0.17 0.33 0.61 0.78 0.79 0.91 1.09 1.10 1.42 1.42 1.52  <- my 13 SAME
------------------------ gap: 1.52 to 2.13 ------------------------
2.13 2.15 2.30 2.58 3.29 3.38 3.52 3.84 4.01 4.39 5.59 5.83 6.60  <- my 13 DIFFERENT
```

The gap is 40% wider than any within-group step. The two trials nearest it are T24 (1.52, SAME) and
T09 (2.13, DIFFERENT) — which is exactly where my stated uncertainty sits, so the metric and my
prose agree about where the doubt is.

## 3. Tell audit — I am the check on the builder's audit

The builder claims it checked names, identical pairs, array shapes, value widths, per-trial fields,
ordering and reveal placement. I re-ran those checks from the bytes.

### 3.1 What I confirmed clean

| Channel | Result |
|---|---|
| Recording byte length | **All 52 slots serialise to exactly 6981 bytes.** Confirmed independently. |
| Value string width | **All 43,888 values are exactly 5 characters.** No width channel. |
| Frame count | 120 on every recording. |
| Band count / band edges | 6 / identical `bands_hz` list on every recording. |
| Key order | One distinct key tuple across all 52 recordings; one across all 26 trials (`id`,`A`,`B`). |
| Names/labels | No `name`, `place`, `region`, `time`, `source` or similar field anywhere in `trials.json`. |
| Reveal placement | `w1-22-r3-hard.reveal/` is a sibling of the pack, not a child. Correct per RI-MTH03 §A. |
| Signed zero | Both `"+00.0"` (6061) and `"-00.0"` (1937) occur, so zero formatting is not a channel. |
| Side asymmetry | A is larger than B in 10/26 on crest, 9/26 on stereo, 12/26 on p95, 15/26 on IQR. Mean crest A 14.40 vs B 14.99. Nothing usable. |
| A/B pool separation | Every recording that appears more than once appears on both sides at least once. No side-specific pool. |

The byte-length claim in particular checks out exactly as stated, and the fixed-width dB encoding is
a genuinely good piece of design — it is the mechanism that kills the channel that voided a previous
pack, and it works.

### 3.2 What the builder's audit missed: the pack contains only 28 distinct recordings, and 12 of them are reused

52 slots, **28 distinct recordings**. Reuse map (my labels):

```
R06  x4  T03B T04A T07A T25A        R07  x4  T04B T12A T15A T19A
R09  x3  T05B T08A T19B             R10  x3  T06A T11B T15B
R11  x3  T06B T13B T16A             R16  x3  T13A T21A T24B
R24  x3  T20B T22A T23B
R01 R02 R03 R08 R13 R14 R20 R23  x2 each
```

Two consequences, and the second is the serious one.

**(a) Two trials are exact duplicates of two others with the sides swapped.** T05 and T08 are the
same pair `(R08,R09)`; T20 and T22 are the same pair `(R23,R24)`. So the pack has 24 independent
trials, not 26, and any tally out of 26 double-counts two judgements. A judge who notices this gets
two answers free. I did notice, and I have flagged T22 as "identical pair to T20" rather than
pretending to have judged it afresh.

**(b) Reuse makes the trials non-independent in a way that leaks answers by transitivity.** Because
recordings recur, a judge who has answered enough trials can *derive* later ones without looking at
them. Concretely: once you have answered T03 `(R05,R06)` SAME and T04 `(R06,R07)` DIFFERENT, then
T07 `(R06,R12)` and T25 `(R06,R27)` are constrained by whatever cluster you have already put R06 in.
The 26 answers are not 26 independent bits of evidence about the judge's discrimination; the
underlying degrees of freedom are the 28 recordings' cluster assignment, which is far fewer.

This is not a tell in the "answer without judging" sense — it does not hand you the key — but it
**inflates the apparent score**, which is the same practical harm. A judge who correctly clusters
the 7 hub recordings picks up 22 of the 52 slots on those alone. The builder's audit says it checked
for "identical pairs"; it evidently checked whether A and B within a trial were identical, and did
not check whether recordings recur *across* trials. That is the gap.

### 3.3 The channel that does most of the work, and whether it is legitimate

`stereo_correlation` is very close to a place fingerprint. Within every cluster I formed, it varies
by at most 0.3; between clusters it frequently differs by whole units. Thresholding on
`|Δstereo| ≤ 0.35` alone, with no other feature and no listening whatsoever, reproduces **all 13 of
my SAME answers and 7 of my 13 DIFFERENT answers — 20 of 26** (it fails on T04, T06, T07, T09, T15,
T19, where two different places happen to share a stereo width).

Is that a tell? I do not think it is a *protocol* tell, and I want to be careful here rather than
score a cheap hit. `PROMPT.md` explicitly declares stereo width as retained content — *"how wide the
recording sits in stereo"* — and stereo width is a real acoustic property of a real place, not a
pipeline artifact. Judging by it is judging the recording.

But it is a **design weakness**, for a specific reason: the metric is quantised to 0.1 and is nearly
constant within a place across time-of-day and RNG rolls. That makes it behave like an ID number
that happens to be spelled in decibels. The stated purpose of the pack is to test whether *temporal
behaviour* separates places; on 20 of 26 trials, temporal behaviour never has to be consulted. If
the builder wants the pack to measure what it says it measures, stereo correlation should be jittered
per-take by more than its within-place spread, or dropped.

### 3.4 A quality observation the format permits, offered because the dispatch asked for one

Since I cannot answer the Black Marsh quality question, here is the nearest thing the data supports.
Testing each recording for 30-second self-repetition (does frame *i* equal frame *i+60*?):

```
R28 64% exact   R21 59%   R20 58%   R10 36%   R12 33%   R14 32%   R15 25%   R02 22%   R01 20%
...          R05 1%   R06 2%   R08 2%   R11 2%   R19 2%   R07 4%
```

Three recordings (`R20`, `R21`, `R28` — one place, the stereo-+07.9 one) repeat *more than half*
their band values exactly at a 30-second lag. That is the loop-timer failure mode the dispatch's
quality criteria single out: events recurring because a clock came round, not because something is
there. It is partly confounded with quietness (a silent recording trivially repeats), but R20/R21/R28
are not silent — they are quiet in only 27-32% of frames and have real 400-2500 Hz events. Their
neighbours at similar silence ratios (R01 at 20%, R23 at 18%) repeat at 20% and 10%. So the
repetition is not explained by silence, and that place has a 30-second loop in it.

The contrasting group — R05, R06, R08, R09, R11, R19 — repeats at 1-2%, which is what genuinely
event-driven ambience looks like in this representation.

**This is a finding about the game's ambience, not about the pack, and it is the only quality claim
in this report.** It should not be scored under RI-MTH03.

---
--- REVEAL BOUNDARY — everything above was written to disk before `w1-22-r3-hard.reveal/` was read ---
---

## 4. Reveal and score

*(filled in below after the key was opened)*
