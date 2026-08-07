# W1-PROSE-TICS — round-2 blind packs

15 trials. 5 in each register: **books**, **dialogue**, **journal**. Every trial pairs one of our
shipped passages with one from the reference corpus, length-matched, side randomised on a seeded
shuffle (seed `20260807`).

**These packs were built by the piece's builder and are NOT answered by the builder.** The
round-1 library verdict's blind judgement is recorded void because that critic built its own packs
and then graded them. Answers go in each trial's `answer.md`; the mapping is in
`../prose-tics-r2.reveal/mapping.json` and opening it early contaminates the rest.

For the books register the sample is drawn **only from books this run edited**, so the judge is
looking at the work rather than at untouched text. That makes the test harder for us, not easier.

A judge who wants the measurement rather than the impression should also run:

```
node tools/prose/tic-detector.mjs --self-test
node tools/prose/tic-detector.mjs --out /tmp/r2-check.json
```

and read `reports/prose-tics/W1-PROSE-TICS-report.md` §3 (the falsified priors), §4 (the em-dash
glyph confound) and §9 (what is explicitly not fixed) **after** answering, not before.
