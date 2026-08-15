# SEALED — do not open until every judgement is captured to disk

`RI-VIS06` §D, row "Key read before judging": the coin-flip key is written before the run and read
only after the answer is captured. Opening this directory before the five answers exist **voids the
run**, and it is a void condition the item states explicitly rather than a matter of taste.

## What is in here

- `pairNN.reveal/mapping.json` — which of `A.png` / `B.png` is ours, per pair, plus the seed.
- `PAIRING-KEY.json` — the resolved table, including the counterbalanced side plan and the byte
  equalisation record.
- `pairing-r2.json` — the pairing table itself, which names our frame and the reference plate for
  every pair. Ruling **S51**: this is a key, not a manifest, and it must never travel with the pack.
- `pairNN.reveal/crop-record.json` — the crop boxes and the recorded mismatches.
- `pairNN.reveal/make-pair.{PROMPT.md,pack.json}` — relocated out of the pack directories, because
  §A gives the judge "the two images, the prompt below, and **nothing else**", and `make-pair.mjs`
  writes its own generic prompt which is not Protocol A's.

## The honest limit on this seal, stated rather than implied

**This is a directory in a git repository, not a locked box.** It is committed so that it cannot be
lost to a container restart, and `../COMMITMENT.json` records the sha256 of every mapping at
pack-build time, so a mapping cannot be silently rewritten after the answers are in. Neither of
those stops a judge that goes looking from reading it.

What actually keeps the run blind is that **each judge is handed two absolute file paths and the
verbatim prompt, and nothing else** — the same discipline r1 ran under, where no judge mentioned the
setting and none went near the key. If a judge's answer shows any sign of having read this
directory, the run for that pair is discarded with the reason recorded (§Comparison method step 4),
not quietly re-asked.
