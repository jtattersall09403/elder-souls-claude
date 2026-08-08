# SUPERSEDED — closed, not awaiting a judge

**Judge `reports/packs/prose-tics-r5/` instead.** This pack is kept as evidence and as the record of
three judgements; it must not be dispatched to a fourth.

## Why it is closed

`JUDGEMENT-judge-prose-r4-m5.md` in this directory is the authoritative account. Its finding, in one
line: **counting the `[NAME-n]` redaction tokens and picking the side with more identifies the
reference text 15 times out of 15**, margins 1.6×–7×, median ≈ 3.5×. One shell command, no reading,
no domain knowledge. That is round 1's failure — a pack decidable by counting *Vvardenfell* — coming
back through the machinery installed to fix it: the mask verified what it **contained** and leaked
through how many tokens it **added**.

Running the gate that now exists over this pack
(`node tools/blind/leakcheck.mjs --pack reports/packs/prose-tics-r4`, output preserved at
`../prose-tics-r4.reveal/leakcheck.json`) reproduces that finding and adds **eleven more channels
nobody had tested**. Ten of the twelve are the same marker seen through different statistics:

| channel | score | what it is actually counting |
|---|---|---|
| `redaction_tokens`, `redaction_density` | 15/15 | the marker itself |
| `paren_density` | 15/15 | the brackets in `[NAME-3]` |
| `mean_line_len`, `chars` | 15/15 | the marker is longer than the name it replaced |
| `mean_word_len` | 14/15 | same |
| `uppercase_ratio`, `allcaps_words` | 14/15 | `NAME` is capitals |
| `digit_ratio` | 14/15 | the `-12` is digits |
| `redaction_distinct` | 13/14 | how many distinct names the passage had |
| `mid_sentence_capitals`, `capital_density` | 14/15 | genuine: shipped Morrowind text is name-saturated |

Note the two that did **not** fire: `words` scored 6/11 — the r4 builder's word-count matching
worked — and 26 of the 40 rules scored at chance. The length channel was closed in the one unit
that was measured and wide open in the one that was not.

## Four further defects, from the same judgement

- **D1** the `PICK:` line cannot express the pack's question. Two prior judges "disagreed" on 14 of
  15 rows while agreeing about every passage: one answered provenance (15/15 reference), one
  answered preference (1/15). A whole round lost to an answer format.
- **D2** fifteen plaintext `answer.md` files sit in these trial directories — in the exact filename
  every `PROMPT.md` tells the next judge to create, and which a judge would `cat` before writing to
  check it was not clobbering something. This pack contains its own answer key.
- **D3** every `PROMPT.md` here ends *"The mapping lives in `../prose-tics-r2.reveal/`"* — a
  **different pack's** key. Copy-paste from r2; nothing regenerated the pointer.
- **D4** one author per side, so 15 trials carry roughly 3 trials of information. **The chance
  baseline for a clean sweep is 1-in-8, not 1-in-270 and not 1-in-32768.**

A re-judged pack is a different object from a fresh pack. With three judgements and an answer key
inside it, this one cannot be made blind again for anybody.

## Which scores survive

- **Every `PROV:` (provenance) score from this pack is void.** Three judges scored 15/15 on
  provenance; a five-character shell rule scores the same. Nothing distinguishes reading from
  counting, from inside a single judge or from outside one.
- **The `QUAL:` (quality) results do not survive as a *blind* result and must be re-taken on r5.**
  Judge 2 preferred our side on 14 of 15; judge 3 on 15 of 15. Those are honest expert preferences
  and they are not nothing — but they were formed on a pack where provenance was mechanically
  available on the page, so they are **non-blind** preferences. RI-MTH03's own scoring says what to
  do with that: below 75% of applicable points the blind result is inadmissible and the item falls
  back to non-blind scoring, and the verdict says so.
- **The M5 harsher-lens findings survive in full**, because they are qualitative gap-findings and
  not scores. Two of them are the most useful output of this round and belong in the next builder's
  brief: our fifteen passages share **one narrator's idiolect** (nine of them unmistakably), and our
  corpus contains **no bad writers** — no propagandist, no incompetent, no bore — which a shipped
  RPG corpus needs, because an unreliable in-world document is how a world shows a player it has
  sides. Measure cross-document voice variance, not just within-document tics.
- **The pre-declared-and-failed channels survive as method.** The judge declared four candidate
  leaks and reported that two failed when scored (9/15 and 5/15) as plainly as the one that hit.
  That discipline is now built into `tools/blind/leakcheck.mjs`, which prints every rule's score
  every run, including the ones at chance.

Closed by `W1-PROSE-TICS-r4-instrument`, 2026-08-08.
