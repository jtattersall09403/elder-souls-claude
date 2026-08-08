# SUPERSEDED — closed, not awaiting a judge

**Do not spend a judge on this pack.** It has fifteen trials and zero answers, so a file-state
reading correctly reports it as unanswered — but unanswered is not the same as owed, and this one is
not owed.

Two independent reasons:

1. **It is the pre-masking pack.** There is not one redaction token in any of its thirty passages.
   The round-1 judge measured what that costs: a rule counting *Vvardenfell / Dunmer / Septim* plus
   leftover wiki markup scored **17 of 17 on every decidable trial without reading a word**
   (`corpus/90-verdicts/wave1/W1-PROSE-BLIND-r1.md` §2). Any score taken here would be a score for
   that rule.
2. **It asks the provenance question**, "which of these two is the imitation?", under which picking
   ours is correct by construction. RI-MTH03 §E's `picked-ours` row and the mandatory M5 second pass
   behind it can never fire, so the protocol's sharpest rule — *if the critic picks ours, distrust
   the critic* — is inoperative.

Its corpus is also stale: the round-2 successor pass rewrote roughly 380 dialogue lines across
nineteen files after this pack was built.

**Judge `reports/packs/prose-tics-r5/` instead** — gated by `tools/blind/leakcheck.mjs`, proper
nouns re-named rather than redacted, two answer axes, answers written outside the pack.

Kept only so the three pack generations can be compared.

Closed by `W1-PROSE-TICS-r4-instrument`, 2026-08-08.
