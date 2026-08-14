# Status — verdict-evidence recovery (task `verdict-evidence-20260814`) — COMPLETE

Closed the rigour hole `reports/ci-triage/TRIAGE-20260814.md` found: most Wave-1 verdicts cited
evidence that was not in the repository, so nobody but the machine that produced them could check
them. Branch `codex/wave1-build-experiment`.

**Full write-up, with the numbers and the rulings: `reports/ci-triage/EVIDENCE-RECOVERY-20260814.md`.**

## The number that matters

Fresh checkout, taken the way the triage took it — `git archive <tree> | tar -x` into an empty
directory, then `node tools/verdict-validate.mjs --all` inside it. Never measured against this
populated working tree.

| | FAIL | OK | SKIP |
|---|---|---|---|
| **before** | **54** | 22 | — |
| **after** | **9** | 32 | 35 |

Decomposed: 54 → 21 by committing the evidence, → 20 by correcting rotted paths and accepting pins,
→ 9 by gating only the latest round of each piece.

## Done

- [x] 203 cited evidence files committed by name (10.4 MiB); 3 pinned (108.9 MiB).
- [x] Threshold **1 MiB**, set from the measured distribution's largest discontinuity, not chosen.
- [x] Piece-aware review: 166 of 213 citation instances load-bearing; nothing found to be scratch.
- [x] Regeneration command **run**. It does not reproduce W1-25-r1's decisive number — recorded.
- [x] 21 rotted reference-item paths corrected; `#section` anchors resolved in the validator.
- [x] 4 genuinely-gone citations named and ruled: `W1-01.json`, do **not** backfill.
- [x] Superseded-round skip built, with 21 test cases for the naming edge cases.
- [x] 8 real corpus defects triaged: fixed where honest, red with a named owner where not.
- [x] Policy landed in the verdict schema, the critic prompt template, the builder contract,
      `reports/.gitignore` and the CI workflow. Nothing added to the commit path.

## Open, and owned by someone else

- **9 verdicts still red**, each a field whose value is a measurement this task did not take.
  Named with owners in the report §4 and in `orchestration/NEXT-DISPATCH.md`.
- **Four of those nine are not critic verdicts at all** — three blind-pack judgements and one
  document using a third shape under the same schema name. They need a document-type split in the
  schema, not a backfill.
- **W1-25-r1's zero-event trace does not reproduce at HEAD** (0 events in 36,000 frames pinned,
  113 in 3,600 regenerated at the same seed and profile). Needs a fresh W1-25 round.
