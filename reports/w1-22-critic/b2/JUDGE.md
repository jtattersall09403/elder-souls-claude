# How to run this pack (RI-AUD03 B2)

This pack is BUILT AND UNJUDGED. The W1-22 round-1 critic built it and is disqualified from
answering it: it has read RI-AUD03 §B and therefore knows what every region is supposed to sound
like, which is the "blind test run by someone who has read this file" failure the item names.

To run it, hand a FRESH agent — no project material, no corpus access, no path outside this
directory — `PROMPT.md` and `trials.json`, and nothing else. It writes one line per trial into
`answer.md` in this directory. Then, and only then, open `../b2.reveal/mapping.json`.

Record in the verdict: `separation` over the 24 DIFFERENT trials, and `false_different_rate`
over the 8 SAME trials. If the false-different rate exceeds 0.25 the separation figure is
inadmissible — a judge that answers DIFFERENT to everything scores a perfect separation, because
RI-AUD03 B2 as written contains no SAME control.
