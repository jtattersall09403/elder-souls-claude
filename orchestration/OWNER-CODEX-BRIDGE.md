# Temporary owner-driven Codex bridge

**Temporary capacity exception, not doctrine:** owner-reviewed Codex Cloud batches may use 1–4
useful agents/tasks instead of the normal 12-agent throughput floor. Quality, independence,
evidence and acceptance bars do not change. Claude Code may ignore/remove this bridge when normal
high-parallelism orchestration resumes.

## Bootstrap and select

Every fresh task reconstructs state from canonical target-branch HEAD. Local-only commits from a
previous Cloud task are not state. Read `RULES.md`, `INDEX.md`, `NEXT-DISPATCH.md`,
`AGENT-PROTOCOL.md`, `PLAN-LOOP.md`, `COST.md`, `EFFORT-POLICY.md`, current `status/`, ownership,
plans, Wave 1 verdicts, the gap ledger, and the doctrine/schema/tooling those files point to. Then
run `node tools/ownership.mjs --conflicts` and `node tools/dispatchable.mjs --wave1-plans`.
Reconcile those results with actual HEAD; do not trust filenames alone. Detect completed,
superseded, stale, abandoned, partial and already-planned work before claiming anything.

Use the existing status/ownership conventions. Each canonical plan contains `Plan-State:` and its
piece status mirrors `plan_state` using the states in `PLAN-LOOP.md`. A missing plan always takes
precedence over `needs-builder`, including for previously built or criticised work.

## Interpret the short prompt

- **Plan:** select `needs current-state plan` pieces and write rigorous continuation plans only.
- **Critique:** in a new independent task/session, select `plan awaiting criticism` or `plan
  awaiting fresh re-criticism`; inspect repository evidence independently and update findings/state.
- **Remediate:** select `plan has blocking criticism; awaiting remediation`, resolve every eligible
  plan finding, and mark `awaiting-recriticism`. Do not build game code.

A task may process many pieces, but stop at a clean, reviewable boundary before context growth
makes later work shallower. Commit one owner-reviewable batch. The next phase begins only from the
canonical branch after the owner publishes that PR. Plan criticism is offline where possible;
browser/build evidence stays in the build loop unless plan validity genuinely requires it.

At the end of every Plan, Critique, or Remediate task, run or derive the canonical Wave 1 plan-state
inventory from current task HEAD and include a short **Plan-state summary** in both the task's final
response and its PR description. Report counts for `needs-current-state-plan`, `awaiting-criticism`,
`awaiting-remediation`, `awaiting-recriticism`, and `satisfied`, plus the names of any pieces still
requiring action in the current batch. State the owner's next short command explicitly. If every
plan in the current batch is `satisfied`, say so plainly and state that the owner may move on to
`Plan the next Wave 1 batch.` Do not make the owner maintain a separate tracking list.

Fresh critics may read prior critique/remediation evidence to verify closure but may not adopt the
author's reasoning as their own. Repeat remediation and fresh criticism without a round ceiling.
Escalate stalled repeats, disputed bars, invalid instruments and seams through the existing ruling
mechanism. `CARRIED` cannot bypass a gate required before the next phase.

## Compatibility and resumption

This bridge adds no parallel workflow and changes no historical conclusion, gap, evidence,
ownership or dispatch record. Verdict schema version 1 remains compatible: historical verdicts
with `biggest_gap` validate unchanged; prospectively, FAIL requires exactly one actionable gap and
an evidence-earned PASS may omit it. The gap ledger simply opens no entry for that PASS. Claude
Code resumes by reading the same canonical artifacts; it may remove only this temporary bridge and
restore its normal concurrency floor, leaving plan/verdict states intact.
