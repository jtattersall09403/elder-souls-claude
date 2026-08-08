# W1-26 r4 — what is in here

`trace.jsonl` is **deliberately not committed** from either `jrn01-still*` run: 14 MB and 20 MB
respectively, and both are regenerable by the command recorded in `journey.json` `args`. The
`m4_clause1` row in `journey.json` carries everything the trace was read for — the frame window,
the entity-side samples, the field-writing events found in it, and the teardown's own trace.

| file | what it is |
|---|---|
| `verify.json` | 14/14. Consumption (`RI-MTH07`) and delete-the-fix for every r4 repair. |
| `opening-play.json` | 10/10 with the rewritten P9, played through real DOM input in play mode with no flags. |
| `opening-play-redteam-plant.json` | `--red-team=plant`: P9 goes red on a planted instruction, no collateral. |
| `jrn01-still/journey.json` | `m4_clause1` as a still-driver build bound. PASS: 60 s still, 7 entity-side samples, nothing asked. |
| `jrn01-still-teardown/journey.json` | the same run under `--still-fire-a-field`. **FAIL**, which is the control going red. |
