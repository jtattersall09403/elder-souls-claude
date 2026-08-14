# verdict-doctype-20260814 — document-type split for the verdict schema

**Status:** complete
**Branch:** `codex/wave1-build-experiment`
**Task id:** `verdict-doctype-20260814`
**Full write-up (authoritative):** `reports/ci-triage/DOCTYPE-20260814.md`
**Ruling:** `orchestration/NEXT-DISPATCH.md` § CI-DOCTYPE

## The number

Fresh checkout, the predecessor's way — `git archive <tree> | tar -x` into an empty directory,
`node tools/verdict-validate.mjs --all` **inside it**, never against this working tree.

| | FAIL | OK | SKIP |
|---|---|---|---|
| before, `2776b38` | **9** | 32 | 35 |
| after, `630a46e` | **8** | 33 | 35 |

The 32 that passed before are exactly the same 32 (diffed, not counted), plus
`W1-PROSE-BLIND-r1`. The SKIP set is identical.

Delete-the-fix, executed on copies: deleting the type dispatch returns the sweep to **9**;
deleting the six blind obligations makes `--self-test` exit 1 with
*"a critic verdict was accepted as a blind judgement"*. Both arms genuinely go red.

Score-series comparability, measured not reasoned: `collect()` from `tools/scores.mjs` in both
extracted trees — **69 rows before, 69 after, `JSON.stringify` identical.**

## What shipped

1. **Two document types.** `elder-souls/critic-verdict@1` (unchanged) and
   `elder-souls/blind-judgement@1` (new schema file). Dispatch: `document_type` → registered
   `schema` → a `critic.role` beginning `judge.` → **critic verdict** (the stricter default, so
   omitting the field never buys leniency). `elder-souls/verdict@1` is retired and refused by name.
2. **Six blind obligations from RI-MTH03** — pack, seal, results, leak audit, no-peek,
   admissibility — checked by role against a closed table of the spellings this corpus uses, each
   non-canonical hit warning with the canonical key. Every obligation rejects its own omission
   under `--self-test`.
3. **`reference_items[].not_read: { reason, why }`** — an honest non-reading, on a judgement only,
   carrying no score. Legacy `"NOT READ - quarantined"` grandfathered with a warning; a merely
   missing path is still an error.
4. **`score.overall_0_10: null` with a written note** — a judge may decline to score a piece it
   was quarantined from.
5. **`self_audit` entries may be prose**, not only booleans. (My first draft demanded booleans and
   reproduced the exact bug I was fixing, one level down.)
6. **A strict refinement of a canonical subsystem path warns**; one with no canonical ancestor
   still errors.
7. **Eight new `--self-test` arms** that genuinely disagree, including the same bytes accepted as
   a judgement and rejected as a critic verdict, and the reverse.

Nothing was added to the commit path (rule 13). CI already ran `--self-test` before the sweep; only
its step name changed.

## What I did not do

- Did not repair the remaining 8. Each is a value I did not measure; owners in the report §5.
- Did not register the 3 unmapped subsystem paths (`audio.ambience.events`,
  `audio.ambience.stereo`, `process.blind.protocol`) — a taxonomy decision, RI-MTH05 §C.
- Did not edit any of the four documents, nor `W1-LIBRARY-MARTIAL-r4`.
- Did not migrate the three judgements to canonical spellings; they validate as written.
- No browser, no timing figure.
- `node tools/corpus-index.mjs --strict` exits 1 in this working tree and 0 in both extracted
  trees, before and after — another agent's in-flight corpus edit, not this work.

## Hazards hit — concurrent writes, three times

1. A bank swept the four code files into `0dbc1eb`/`630a46e` under its own message. Nothing lost;
   each diffed against `origin/codex/wave1-build-experiment` byte for byte.
2. **Five documentation files were then silently reverted** — `reports/ci-triage/DOCTYPE-20260814.md`
   was deleted from disk, and `NEXT-DISPATCH.md`, this status file, `tools/gen-index.mjs` and
   `.github/workflows/corpus-gate.yml` rolled back, while `tools/verdict-validate.mjs` and the two
   schemas survived. Owner Directive §6 Ruling O1's failure mode; the agents did share
   `gen-index.mjs`/`INDEX.md`, so it does not disconfirm that ruling. All re-applied and
   re-verified against the pushed remote.
3. A bank's `git add -A` committed `tools/_vv-vacuous.mjs`, my deliberately-sabotaged validator
   copy (the delete-the-fix control arm). Removed under its own commit.

## files_touched

- `tools/verdict-validate.mjs`
- `corpus/00-doctrine/blind-judgement.schema.json`
- `corpus/00-doctrine/verdict.schema.json`
- `tools/gen-index.mjs`
- `.github/workflows/corpus-gate.yml`
- `reports/ci-triage/DOCTYPE-20260814.md`
- `orchestration/NEXT-DISPATCH.md`
- `orchestration/status/VERDICT-DOCTYPE-20260814.md`
- `reports/blog-feed.jsonl`
- `tools/_vv-vacuous.mjs` (deleted)

## files_claimed

None outstanding.

## next_step

Done. The three named follow-ons are in `orchestration/NEXT-DISPATCH.md` § CI-DOCTYPE, in
ascending cost: `W1-PROSE-TICS-r4`'s missing timestamp (one line), `W1-22-B2-blind`'s three
unregistered subsystem paths (one taxonomy decision), and a conformant `W1-TOUCH` round 2.
