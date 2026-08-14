# verdict-doctype-20260814 — document-type split for the verdict schema

**Status:** starting
**Branch:** `codex/wave1-build-experiment`
**Task id:** `verdict-doctype-20260814`

## Problem

4 of the 9 remaining fresh-checkout verdict FAILs are not critic verdicts:
`W1-PROSE-BLIND-r1`, `W1-PROSE-TICS-r4`, `W1-22-B2-blind` (blind-pack judgements) and
`W1-TOUCH-r1` (declares `elder-souls/verdict@1`, implements a different layout).
Two incompatible document types share one schema name.

## Plan

1. Census every JSON in `corpus/90-verdicts/**` for actual top-level field layout; cluster into types.
2. Design an additive `schema` discriminator; give each type its own required-fields set.
   Existing conformant verdicts must stay valid unchanged (no `schema` key required => defaults to
   critic verdict). Score series must stay comparable.
3. `W1-TOUCH-r1`: label honestly or declare which fields are missing + owner. No fabrication.
4. Schema fix for "NOT READ - quarantined": a legitimate non-reading must be expressible.
5. `--self-test` arms that genuinely disagree, incl. blind judgement accepted as judgement /
   rejected as critic verdict.
6. Fresh-checkout FAIL before/after via `git archive <tree> | tar -x` into empty dir.

## Constraints

- Nothing new on the commit path (rule 13). CI only.
- Do not edit other agents' judgements to make them pass.
- Re-verify every edit against the pushed remote (concurrent banking reverted a predecessor's edits).

## files_claimed

- `corpus/00-doctrine/verdict.schema.json`
- `corpus/00-doctrine/judgement.schema.json`
- `tools/verdict-validate.mjs`
- `orchestration/status/VERDICT-DOCTYPE-20260814.md`
- `reports/ci-triage/DOCTYPE-20260814.md`

## files_touched

- `orchestration/status/VERDICT-DOCTYPE-20260814.md`

## next_step

Census document shapes.
