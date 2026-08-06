# GAP LEDGER

> **GENERATED FILE — DO NOT HAND-EDIT.** Regenerate with `node tools/gap-ledger.mjs`.
> Canonical data: `corpus/90-verdicts/GAP-LEDGER.json`. Source: every verdict's
> `biggest_gap` (opens) and `gap_closure[]` (closes). Rules: `SCORING.md` §5.

Generated: 2026-08-06T13:25:04Z · verdicts read: 1 · waves: 1

**The three rules that matter**
1. Every verdict opens exactly one gap. A verdict with no gap is void.
2. A gap is closed only by a **later wave's critic**, re-measuring the gap's own
   `acceptance` condition — **never** by the agent that built the fix.
3. Every open gap on a subsystem path is handed to that path's next builder **up
   front**, as required work (`BUILDER-PROMPT-TEMPLATE.md`).

| total | open | partially-closed | closed | superseded | invalid |
|---:|---:|---:|---:|---:|---:|
| 1 | 1 | 0 | 0 | 0 | 0 |

## Open gaps — required work for the next wave

| Gap | Subsystem path | Sev | Age (waves) | Opened | What | Remedy → acceptance |
|---|---|---|---:|---|---|---|
| `GAP-W1-platform-prng-never-drawn` | `platform.determinism.harness` | blocking | 0 | w1 / w1-00 | The seeded PRNG is reseeded correctly and never drawn from. rng.draws is 0 on every one of 3600 frames in every scenario, state and seed measured. Seeds 1337 and 4242 over a 3600-frame duel differ in exactly one field — .rng.seed, the echo of the input — and in zero simulation fields (r4-seed-sensitivity.txt: 'frames differing in ANY field other than .rng.seed: 0'). RI-MTH02 R4's 5%-of-frames clause is therefore satisfied at 100% by that echo alone, so the rung, tools/harness/determinism.mjs, and any future critic reading either will report seed sensitivity on a build that has none. The build's own ladder prints 'PASS R4 — seed-sensitive ... frames_differing_pct: 100'. | (1) Route at least one simulation quantity through rng.next() inside the fixed step and emit the draw count truthfully — the enemy idle-loop phase offset chosen at spawn is sufficient, cheap, and is exactly the field AM-W1-00-01 wants excluded from R5, so seeding it converts that argument into a measurement. (2) Change tools/harness/determinism.mjs's R4 computation to drop the rng.seed field before counting differing frames, and to fail the rung with reason 'prng_never_drawn' when max(rng.draws) == 0 in either run. (3) Adopt orchestration/amendments/AM-W1-00-C1-mth02-r4-discriminator.md, which states the sharpened rung and moves no threshold. → **Re-run node tools/harness/trace.mjs --scenario cmb-duel-infantry at seeds 1337 and 4242 and diff field-by-field: max(rng.draws) > 0 in both runs, and >= 5% of frames differ in at least one field OTHER than .rng.seed. The second number is currently 0.0% (0 of 3600 frames) and is recorded in r4-seed-sensitivity.txt.** |

## Open gaps grouped by subsystem path (the builder hand-off)

- `platform.determinism.harness` — `GAP-W1-platform-prng-never-drawn`

## Closed and superseded

_None yet._

## Warnings

_None._
