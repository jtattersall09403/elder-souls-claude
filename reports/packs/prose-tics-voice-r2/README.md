# W1-PROSE-TICS — round-2 blind packs, the DIALOGUE VOICE pass

5 trials, all in the **dialogue** register. Each pairs a 260-word bundle of our shipped NPC lines
with a length-matched bundle from the reference corpus, side randomised on a seeded shuffle
(seed `20260808`).

**These packs were built by the piece's builder and are NOT answered by the builder.** The round-1
library verdict's blind judgement is recorded void because that critic built its own packs and then
graded them. Answers go in each trial's `answer.md`; the mapping is in
`../prose-tics-voice-r2.reveal/mapping.json` and opening it early contaminates the rest.

**Our side is drawn only from dialogue files this pass edited**, so the judge is looking at the
work. That makes the test harder for us, not easier. Note that the bundles will still contain
lines the pass deliberately left formal — the sapwell keepers, the House factors and the court are
*supposed* to sound written, and a pass that flattened them would have broken the game to move a
number. If a trial is decided on one of those lines, that is a legitimate finding and should be
said plainly.

This pack is **separate from** `reports/packs/prose-tics-r2/` (15 trials, books/dialogue/journal),
which covers the earlier pass and is still unanswered. Both are live. Neither has been answered by
anyone who built them.

A judge who wants the measurement rather than the impression should run:

```
node tools/prose/spoken-register.mjs --self-test
node tools/prose/spoken-register.mjs
node tools/prose/tic-detector.mjs --self-test
```

and read `reports/prose-tics/W1-PROSE-TICS-report.md` §11–§14 **after** answering, not before —
particularly §12, which reports the pre-registered predictions this pass got *wrong*, and §14,
which says plainly what is still not fixed and why fixing it would be a mistake.
