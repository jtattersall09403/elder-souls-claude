# Blind comparison — W1-PROSE-TICS, trial 10 of 15 (dialogue)

You are judging two sets of spoken NPC dialogue lines. You do **not** know where either came from and you must not try
to find out from anything but the words: file size, encoding, formatting and metadata are not
evidence and using them is cheating.

**Every proper noun on both sides has been replaced with an INVENTED name**, drawn from one
generator shared by both sides, consistent within a passage and unrelated between passages. No name
you read is the name the author wrote, on either side. Two rounds of this comparison were decided
without reading a word — once by counting setting names, once by counting the `[NAME-n]` tokens
that were supposed to fix that — so **names carry no information here and reasoning about them is
reasoning about the masking code.** Do not try to reconstruct them.

**Artifacts**
- `A.txt`
- `B.txt`

**Kind:** text (dialogue register)
**Piece under review:** W1-PROSE-TICS

## The two questions

Answer **both**, separately. They are not the same question and on this material they frequently
have opposite answers — that is the finding, not a mistake.

1. **`PROV:`** — which of the two is the work of a game writer for a shipped RPG, and which is
   placeholder? This is a provenance question.
2. **`QUAL:`** — which of the two is the better piece of writing, judged as writing? This is the
   question the piece is actually being scored on.

If your two answers differ, say so plainly and say why. A judge who reports high confidence on
`PROV:` and a coin-flip on `QUAL:` is telling the builder that the blinding is broken, which is
worth more than either answer alone.

## How to answer

Write your answer to `../../prose-tics-r5.answers/<your-agent-id>/t10-dialogue.md` — **outside the pack**,
in your own directory. Do **not** write into this directory: a previous round of this comparison
ended up with fifteen plaintext answer files sitting in the folder the prompt told the next judge
to work in, which is an answer key with a friendly filename.

Your answer must contain, in order:

1. `PROV: A` or `PROV: B` — one line, nothing else on it.
2. `QUAL: A` or `QUAL: B` — one line, nothing else on it.
3. `CONFIDENCE: high | medium | low` (state which axis it applies to if they differ)
4. Three to six bullet points of **specific, checkable evidence** — quoted lines, counted
   constructions, named habits. No general impressions, no "it feels modern".
5. `WEAKEST POINT:` one sentence naming the strongest argument *against* your own pick.

Do not hedge, do not decline, do not say the two are equivalent. If they genuinely read as
equivalent, that is itself a finding — pick the one that is marginally more suspect and say so.

## What your score will and will not mean

Both sides are drawn from **one author each**. Recognise the voice in one trial and the rest sort
themselves, so 15 trials carry roughly **as many bits as there are registers** — three, not 15.
**A clean sweep is about 1-in-8 by chance, not 1-in-32768.** Any number taken from this pack must
be quoted with that baseline. Say in your answer if you found yourself voice-matching rather than
judging; the r4 judge did, and it was the most useful line in its verdict.

**Answer all trials before looking at any mapping.** A judge who peeks at one reveal has
contaminated the rest. The mapping lives in `../../prose-tics-r5.reveal/` and is not yours to open
until every answer is written.
