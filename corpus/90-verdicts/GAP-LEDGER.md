# GAP LEDGER

> **GENERATED FILE — DO NOT HAND-EDIT.** Regenerate with `node tools/gap-ledger.mjs`.
> Canonical data: `corpus/90-verdicts/GAP-LEDGER.json`. Source: every verdict's
> `biggest_gap` (opens) and `gap_closure[]` (closes). Rules: `SCORING.md` §5.

Generated: 2026-08-06T10:54:01Z · verdicts read: 0 · waves: (none)

**The three rules that matter**
1. Every verdict opens exactly one gap. A verdict with no gap is void.
2. A gap is closed only by a **later wave's critic**, re-measuring the gap's own
   `acceptance` condition — **never** by the agent that built the fix.
3. Every open gap on a subsystem path is handed to that path's next builder **up
   front**, as required work (`BUILDER-PROMPT-TEMPLATE.md`).

| total | open | partially-closed | closed | superseded | invalid |
|---:|---:|---:|---:|---:|---:|
| 0 | 0 | 0 | 0 | 0 | 0 |

## Open gaps — required work for the next wave

_No verdicts have been filed yet. This ledger fills itself as critics emit verdicts into `corpus/90-verdicts/<wave>/<piece_id>.json`._

## Open gaps grouped by subsystem path (the builder hand-off)

_None._

## Closed and superseded

_None yet._

## Warnings

_None._
