# W1-PROSE-TICS — blind packs, round 2 of the pack format

15 trials. 5 in each register: **books**, **dialogue**, **journal**. Every trial pairs one of our
shipped passages with one from the reference corpus, length-matched, side randomised on a seeded
shuffle (seed `20260809`).

**These packs were built by the piece's builder and are NOT answered by the builder.** The
round-1 library verdict's blind judgement is recorded void because that critic built its own packs
and then graded them. Answers go in each trial's `answer.md`; the mapping is in
`../prose-tics-r4.reveal/mapping.json` and opening it early contaminates the rest.

## Two things changed since the last pack, and both were forced by its verdict

**1. The question is now a QUALITY question, not a provenance one.** The last pack asked "which of
these two is the imitation?", so picking ours was correct by construction and RI-MTH03 §E's
`picked-ours` row — and the mandatory M5 second pass behind it — could never fire. The judge
scored 20 of 20 and then said the number was worthless, because it had judged OUR side the better
writing on four of the five books trials and the pack had no way to record that. The question is
now §D's: *which was written by a game writer for a shipped RPG, and which is placeholder?* If you
think the placeholder side is the better-written one, say so — that is the finding.

**2. Every proper noun on BOTH sides is masked to `[NAME-n]`.** §B of the protocol required this
and it had never been applied: there was not one redaction token in any of the 40 files of the last
pack, and the judge measured that a rule counting *Vvardenfell / Dunmer / Septim* plus leftover wiki
markup scored **17 of 17 on every decidable trial without reading a word**. That channel is now
closed:

* the masker is generic — it finds proper nouns by capitalisation in non-sentence-initial position,
  and knows only a list of English *function* words, never a list of setting words, so it cannot be
  written to favour one corpus;
* each side's vocabulary is gathered from that side's own corpus alone;
* reference passages still carrying wiki template residue are dropped from the pool entirely
  rather than patched;
* the builder then re-runs the judge's own counting rule over the finished pack and **refuses to
  write it** if either side still shows a setting noun or markup. Re-running that rule by hand over
  this pack gives **0 decidable trials out of 15** — it is now pure chance.

For the books and dialogue registers the sample is drawn **only from documents this piece edited**,
so the judge is looking at the work rather than at untouched text. That makes the test harder for
us, not easier.

A judge who wants the measurement rather than the impression should also run:

```
node tools/check-prose.mjs --self-test
node tools/check-prose.mjs --verbose
node tools/prose/tic-detector.mjs --self-test
```

and read `corpus/90-verdicts/wave1/W1-PROSE-BLIND-r1.md` **after** answering, not before.
