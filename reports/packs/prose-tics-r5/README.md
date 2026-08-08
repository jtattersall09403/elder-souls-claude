# W1-PROSE-TICS — blind pack `prose-tics-r5`

15 trials across **books**, **dialogue**, **journal**. Each trial pairs one of our passages with
one from the reference corpus. Side randomised on a seeded shuffle (seed `20260810`).

**Built by the piece's builder, answered by nobody who built it** (RULES.md 25). Answers go in
`../prose-tics-r5.answers/<agent-id>/`; the key is in `../prose-tics-r5.reveal/`.

## What this round changed, and why

**1. Proper nouns are RE-NAMED, not redacted.** Two previous rounds were decided without reading a
word: r1 by counting setting names, r4 by counting the `[NAME-n]` tokens introduced to fix r1.
There is no marker in this pack to count. The cost is real and is stated in
`tools/blind/mask-text.mjs`: **the text is altered, not merely redacted**, so nothing about names
is judgeable here.

**2. Passages are paired on proper-noun density and character count, not word count alone.** r4
matched on words — and the gate scores `words` at chance on that pack while `chars` scores 15/15
and `capital_density` 14/15. The cost is a selection bias, stated once: this pack samples the
band where the two corpora are mechanically comparable, so its verdict does not generalise to the
name-saturated end of the reference corpus.

**3. The pack was gated before any judge saw it.** `node tools/blind/leakcheck.mjs --pack
reports/packs/prose-tics-r5` runs ~40 mechanical discriminators and refuses the pack if any decides it. Its output
for this pack is in `../prose-tics-r5.reveal/leakcheck.json` — including every rule that scored at
chance, which is the point.

**4. Two answer axes, not one.** `PROV:` (which is the shipped-RPG text) and `QUAL:` (which is
the better writing). In r4 two judges "disagreed" on 14 of 15 rows while agreeing about every
passage, because a single `PICK:` line could not say which question they had answered.

## The baseline, before anyone quotes a score

One author per side. Recognise the voice once and the rest sort themselves, so 15 trials carry
roughly as many bits as there are registers. **A clean sweep is about 1-in-8 by chance, not
1-in-32768.** Quote 1-in-8.

## Also worth running

```
node tools/blind/leakcheck.mjs --self-test
node tools/blind/mask-text.mjs --self-test
node tools/check-prose.mjs --self-test
node tools/prose/tic-detector.mjs --self-test
```
