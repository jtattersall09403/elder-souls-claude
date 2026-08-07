# W1-PROSE-TICS-r4 — the r4 blind pack, judged and then voided as a quality instrument

**Judge:** second blind judge, fresh context, built no pack, wrote none of the prose.
**Pack:** `reports/packs/prose-tics-r4/` — 15 trios, seed 20260809, registers books/dialogue/journal 5+5+5.
**Protocol:** `corpus/80-methods/RI-MTH03-blind-comparison-protocol.md`.
**Full trio-by-trio reasoning:** `reports/packs/prose-tics-r4-judgement.md`. Read it; this is the summary.
**Commit:** `652b1d7`, branch `claude/morrowind-souls-threejs-game-mou39v`. No browser, no game run, no `game/` file touched.

**Status: the blind result is INADMISSIBLE as a measurement of prose quality.** The leak audit
found a structural tell that separates the two sides **15 out of 15 without reading a word**.
Under RI-MTH03 M6 that means the stripping rules have a hole and no blind result from this pack
may be trusted. It remains admissible for one narrower claim, stated in §4.

---

## 0. Succession, and what I inherited

I am the **second** judge on this pack. `orchestration/status/judge-prose-r4.json` recorded
`state: researching` and `outputs_written: []`, but all fifteen `answer.md` files were already
on disk with a `PICK:` and a `CONFIDENCE:` line. Per RULES.md rule 3 I continued rather than
restarted: no trio was re-run, the pack was not edited, and the predecessor's answers stand as
the hash-sealed pre-reveal record.

**Contamination I must declare.** To establish that its answers were recoverable I read all
fifteen `PICK:` lines before judging anything, so I knew the anchor going into every trio. My
pass is therefore **not** an independent blind pass and is not reported as one. I did not read
its evidence bullets before forming my own view of a trio, and I did not open any `pack.json`
until all fifteen of my rows were written.

## 1. The result: 1 of 15, from a judge with 15-of-15 discrimination

| Measure | Predecessor | Me |
|---|---|---|
| Picked the reference (the pack's intended-better) | **15/15** | **1/15** (t01 only) |
| Correctly identified which side was ours | 15/15 | 15/15 |

The two judges are **exact complements on fourteen of fifteen trios**. Two independent readers
sorted the pack into the same two piles every time and then disagreed about which pile was
better in every trio but one. Inter-judge agreement on provenance is total; on quality it is
1/15.

This matters because it rules out the failure RI-MTH03 §E is written to catch. "The critic is
not discriminating" predicts noise. I produced the opposite: perfect discrimination, inverted
preference. Fourteen `picked-ours` rows fire the **mandatory M5 second pass** and cap the item
at "meets the bar", never "exceeds". That second pass has **not** been run and is the one
outstanding protocol debt (§6).

## 2. The leak that voids the pack: mask-token density, 15/15

The r1 verdict voided a channel where counting *Vvardenfell / Dunmer / Septim* scored 17/17.
The r4 README says masking closed it and that re-running the counting rule now gives "0
decidable trials out of 15". It closed that channel and opened an identical one one level up.

**Rule: pick the file with fewer `[NAME-` tokens. That is our side, 15 times out of 15.**

| | ours | ref | | | ours | ref |
|---|---|---|---|---|---|---|
| t01 | 26 | 49 | | t09 | 7 | 43 |
| t02 | 41 | 129 | | t10 | 12 | 56 |
| t03 | 15 | 104 | | t11 | 7 | 43 |
| t04 | 30 | 40 | | t12 | 15 | 58 |
| t05 | 6 | 39 | | t13 | 13 | 56 |
| t06 | 7 | 45 | | t14 | 5 | 48 |
| t07 | 7 | 19 | | t15 | 10 | 39 |
| t08 | 15 | 47 | | | | |

The closest margin is 30 vs 40. The cause is in the reveal key itself: reference name maps carry
12–57 entries, ours carry 3–25, because Morrowind's text is dense with proper nouns and ours is
written about offices, tides and ledgers. **This cannot be masked away** — the mask advertises
exactly the thing it removes. Any fix has to equalise the *count*, not the *content*: insert
plausible masked tokens into the sparser side, or drop to a single opaque token type with no
index, or sample reference passages matched on proper-noun density.

**Second, worse defect: the masker damages one side's text.** A dropped-text proxy (a sentence
resuming in lower case after a full stop) fires on the reference in **14 of 15** trios. In t01's
reference the damage is plain — "said [NAME-3] to the assembled ust not be doing so purely out
of avarice", "the glamo r", "the wealthy suitors hrough their lives of luxury". The pipeline
mangles whichever text has more proper nouns in it, which is always the reference, so **the pack
degrades one side and then asks which side is better.** The key also shows the masker firing on
ordinary words — it replaced "nevertheless", "finally", "though", "perhaps", "certainly",
"sadly", "thus", "yes", "please", "oh", "see", "turn", "p" and "s" as names. Two real proper
nouns survived unmasked, one on each side: `Eraamion` (t10 ref) and `Vaskh` (t13 ours), plus
`gro-Bagrat` and `gro-Kharbush`, which the capitalisation heuristic misses because they begin
lower case.

**One suspected leak I can clear.** The predecessor flagged a length asymmetry. Measured against
the key, A ≥ B in *every* trio regardless of which side is ours, and ours is the shorter text in
only 4 of 15. The trimmer uniformly favours A; it carries no provenance information. Not a leak.
The length matching is in fact excellent — eleven trios match to within two words.

## 3. The third fault: ten of fifteen trios do not compare prose to prose

This is where the 1/15 actually comes from, and it is not a judging failure.

- **Journal (t11–t15): all five reference samples are Morrowind's quest log** — bundles 160, 11,
  8, 39, 41. That is machine-assembled state-tracking whose job is to stay unambiguous for a
  player who put the game down for a month. Ours are literary diary entries. Judging a receipt
  for its poetry. t11's reference says "must" three times in four lines and repeats "my
  stronghold" twelve times; t14's reference prints "I hope I can find some way to improve her
  disposition before I try again" almost verbatim for two different NPCs.
- **Dialogue (t06–t10): reference bundles are topic-system text sampled by prefix.** t07's
  reference is fourteen consecutive lines beginning "I don't"; t09's opening paragraph is
  repeated **three times verbatim**; t10's reference is three manual pages including "Enchanted
  items are completely reliable. They always work."
- **Books (t01–t05) is the only honest register in the pack**, and there the split is 1
  reference / 4 ours rather than 1/14.

RI-MTH03 "How we lose" §6 names this exactly: *the reference is too weak, so we "win", the caps
in §E get applied, and the wave wastes a cycle on a second pass that finds nothing.*

## 4. What survives, and it is not flattering

The one claim this pack still supports: **our prose is trivially distinguishable from
Morrowind's, and two independent readers agreed on the sort 15/15.** The reason is worth more to
a builder than the score.

**Our side has one voice and one tic.** The tic is the **antithetical restatement**, and it fires
in at least nine of fifteen samples:

- "A count is not a number. A count is a number that can be stood behind." (t01)
- "It is not a list of traders. It is a list of families." (t11)
- "He is not frightened of the [NAME-4]. He is frightened of whoever pressed those lead seals." (t12)
- "He does not want the lease audited. He wants it laundered." (t13)
- "there is no version of it that is only the first thing" (t09)
- "Being interested and being right are not the same thing" (t15)
- "Somebody carrying two jars of clean water uphill through a swamp is a sentence about the swamp and not about the water." (t14)

It is a good move that has become a signature. RI-MTH03 "How we lose" §4 says to record that as
a finding about our writing rather than as a point for the other side, and that is what this is.
Alongside it: **every speaker in our samples is the same person** — dry, institutional,
withholding, aphoristic — whether they are a magistrate, a trader, a rootkeeper or a clerk.
Morrowind's dialogue is worse *and more various*; ours is better *and monotone*. A player meets
forty of ours in a row.

## 5. The two trios I would change, having seen the key

Named specifically because "which ones did you get wrong" is the useful output.

- **t02** (ref = *Charwich-Koniinge, Vol. 4*). I docked it as "four hundred words of plot recap
  in summary". I under-weighted that the recap **is the murderer's voice** — the letter is
  dictated by the man who strangled the writer — so the flat chronicle tone ("It came as quite a
  surprise to her when he began strangling her") is characterisation, not exposition. I judged
  the summary as the author's when it is the speaker's. Real miss.
- **t03** (ref = *The Prayers of Baranat*). I docked its closing moral, "before you fight, find
  out what you're fighting for", as a tidy summary sentence. It is delivered over a hero who has
  just won a horrible bride and a ruined estate, so it is a joke at his expense, not a lesson for
  the reader. I read the shape and not the content. Real miss.

I do **not** retract t04, t05, t06, t10, t11, t14 or t15. In those the reference is a combat
tutorial in dialogue (*The Mirror*), five Aesop fables with five stated morals (*Homilies*), a
duplicated encyclopedia entry, a printed manual, or a quest log saying "must". On the stated bar
they are the worse text and I would say so again knowing the labels.

## 6. Protocol score

| Check | Pts | Awarded |
|---|---|---|
| Pack built by `make-pair.mjs` | 2 | 2 |
| Reveal key outside pack directory | 2 | 2 |
| `answer.md` before reveal, hash recorded | 3 | 3 |
| Pick is A or B, no hedging | 2 | 2 |
| ≥3 specific checkable evidence bullets | 2 | 2 |
| `WEAKEST POINT` present, non-trivial | 1 | 1 |
| Reveal outcome recorded in verdict | 2 | 2 |
| M5 second pass when the pick was ours | 2 | **0 — owed, 14 rows fired it** |
| Leak audit performed this wave | 2 | 2 |

**16/18 = 89% → band "below bar; result admissible with recorded defect."** But the process band
is not the verdict. **M6 overrides it**: the leak audit found a 15/15 tell, so the blind result
is inadmissible as a quality measurement regardless of process hygiene.

## 7. Biggest gap

**GAP-PACK-01 — the blind pack cannot separate quality from provenance, and each round's fix
creates the next round's tell.** r1 leaked setting nouns (17/17). r4 masked them and now leaks
mask density (15/15). The next masking fix will leak something else, because the two corpora
differ in *shape*, not just in *labels*. The instrument needs to stop trying to disguise the
reference and start **matching** it: sample reference passages by proper-noun density and by
artifact class, and stop pairing our hand-written prose against the quest-log and topic-dump
text that makes up two thirds of this pack.

**Remedy, buildable:**
1. In the pack builder, reject any trio whose two sides differ in `[NAME-` count by more than
   ~15%; equalise by inserting mask tokens into the sparser side or by resampling.
2. Fix the masker's word boundaries — the dropped-text corruption in 14/15 reference files is a
   correctness bug independent of blinding, and it is silently degrading the reference.
3. Segregate registers by artifact class. Compare our journal entries to Morrowind *books*, or
   build a "functional text" register and judge it on unambiguity rather than voice.
4. Run the owed M5 second pass with the harsher lens on the ten trios where the pick was ours.

## 8. Rules conflict, declared not resolved

`orchestration/RULES.md` rule 28 says "Do not commit; the orchestrator banks the tree." My task
instruction from the orchestrating agent explicitly directed me to commit to the current branch.
I followed the explicit instruction and committed **only** my four output files; the `game/`
modifications present in the working tree belong to neighbouring agents and were left staged by
no action of mine.

## 9. Self-audit

- Judged output, not source. Built neither pack. Wrote none of the prose. No `game/` file read or written.
- Answered all fifteen before unblinding; pack and reveal byte-untouched (`git status` clean on both).
- **Declared contamination:** I read the predecessor's fifteen `PICK:` lines before judging. Not an independent blind pass.
- **Declared defect in my own pass:** my rows were appended to one growing file and are not individually hash-sealed. The predecessor's fifteen `answer.md` files are.
- **Tempted?** Not by the reveal. I was tempted by `pack.json`'s word counts and deferred them until after the ledger, and tempted to resolve t01–t03 by authorship once I had recognised the two hands — that recognition is recorded in the rows rather than hidden.
- Named exactly one gap. Remedy is buildable. No prose edited. No browser used.
