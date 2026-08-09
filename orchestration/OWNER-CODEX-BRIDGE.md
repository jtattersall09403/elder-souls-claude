# Temporary owner-driven Codex bridge

**Temporary capacity exception, not doctrine:** owner-reviewed Codex Cloud **planning** tasks may run
at whatever useful concurrency the owner can sustain, with no fixed planning-task cap, provided each
task owns a distinct logical piece, writes only piece-specific planning/status artifacts, and avoids
shared generated/publishing files while the parallel flight is in progress. Review/edit,
remediation and any task that must touch shared state should remain conservatively batched unless
ownership is explicitly disjoint. Quality, independence, evidence and acceptance bars do not
change. Claude Code may ignore/remove this bridge when normal high-parallelism orchestration
resumes.

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

For every plan/review task, derive the governing bar rather than trusting a plan's summary of it:
start from the piece's canonical owned paths/decomposition, follow authoritative `judges:` metadata
and corpus/index references to the governing reference items, then read each item's native methods,
predicates, thresholds, populations, hard fails and applicable later rulings/amendments. A plan may
summarise this material but never becomes the authority for its own bar.

## Interpret the short prompt

- **Plan:** select `needs current-state plan` pieces and write rigorous continuation plans only.
- **Remediate:** select `plan has blocking criticism; awaiting remediation`, resolve the **already
  recorded** blocking findings and perform the cost/deliverability cleanup required below. This is
  not another full independent criticism round. Mark completed plans `awaiting-recriticism`. Do not
  build game code.
- **Review/edit:** in a new independent task/session, select `plan awaiting criticism` or `plan
  awaiting fresh re-criticism`; reconstruct the governing bar independently, review both bar
  sufficiency and cost-effective deliverability, and **edit the plan immediately when an ordinary
  fix is clear**. A reviewer-editor may either approve the version it received unchanged/materially
  unchanged, or materially edit it, but never both: if it makes a material plan change, the result
  must remain `awaiting-recriticism` for a different fresh reviewer-editor. If it finds no material
  defect and makes no material change, it may mark `satisfied`. If a blocker cannot safely be edited
  because authority, a ruling, an instrument or a cross-piece seam is genuinely ambiguous, do not
  choose a convenient answer; record/escalate it through the existing ruling mechanism and leave the
  plan blocked.

The current 2026-08-09 numbered-Wave-1 batch has already received an independent criticism round.
For pieces currently in `awaiting-remediation`, perform **remediation first** against those recorded
findings; do not spend another task re-discovering the same critique. After those remediation PRs
land, use fresh reviewer-editors for every `awaiting-recriticism` piece. From then on, repeat only
fresh reviewer-editor rounds until `satisfied` or legitimately escalated.

A task may process many pieces, but stop at a clean, reviewable boundary before context growth
makes later work shallower. Commit one owner-reviewable batch. The next phase begins only from the
canonical branch after the owner publishes that PR. Plan review is offline where possible;
browser/build evidence stays in the build loop unless plan validity genuinely requires it.

## Cost-effective plan gate

For this owner-driven Codex phase, a plan is not build-ready merely because it can eventually reach
the governing bar. It must describe a **clear, deliverable, materially cost-effective route from
current HEAD to that same bar**. The bar is never lowered to save tokens; efficiency means removing
waste while preserving the required quality, evidence, independence and acceptance strength.

Plan authors, remediators and reviewer-editors must prefer the minimum sufficient work/evidence set
that can prove the governing predicates. In particular they must:

- preserve and reuse current behaviour and still-valid independent evidence instead of rebuilding or
  re-proving it without a concrete reason;
- reuse existing authoritative instruments, fixtures and measurements where valid rather than
  creating parallel implementations or duplicate evidence pipelines;
- avoid redundant agent passes, browser captures, exhaustive sweeps, repeated corpus reads and
  verification that does not change a governing decision;
- use cheap/offline/static checks before expensive browser/runtime/blind-judge work when they can
  eliminate or narrow that work without weakening the bar;
- order build work so high-information, high-risk or gating checks happen early and expensive work
  is not performed for a branch that should already have stopped;
- define bounded populations, stopping conditions and escalation triggers rather than open-ended
  "keep iterating" or gratuitously exhaustive work;
- distinguish work required to **reach** the bar from optional polish, extra confidence or future
  improvements. Optional work must not silently become a build prerequisite;
- avoid speculative refactors, architectural rewrites or new tooling unless they are required by the
  governing bar or are demonstrably cheaper than using the current implementation/instrument;
- keep the builder brief concise enough to execute directly: current state, required deltas,
  dependency/order, acceptance/evidence and stop conditions, without restating large source material.

A reviewer-editor therefore asks **both**:

1. *Could a competent builder execute this plan exactly as written, get every planned check green,
   and still fail any governing reference-item predicate?* If yes, the plan is not satisfactory.
2. *Is there a materially cheaper or simpler credible route from current HEAD to the exact same bar
   because this plan duplicates established work/evidence, over-tests, over-builds, uses unnecessarily
   expensive instruments/passes, or lacks useful stopping/order constraints?* If yes, the plan is not
   satisfactory when the waste is material enough to make it substantially more expensive or less
   deliverable. Do not invent micro-optimisations or trade away verification quality merely to report
   a cost finding.

When either defect is ordinary and the correction is clear, the reviewer-editor should make the
bar-preserving/cost-preserving edit in the same task rather than writing a hand-off essay for another
agent. Any material edit forces `awaiting-recriticism`; only a fresh reviewer-editor may approve that
version. Exact token forecasts are not required where they would be guesswork; reason from concrete
expensive operations (agent passes, browser work, blind judging, corpus breadth, repeated reads,
duplicate implementation, large sweeps) and the repository's actual cost evidence in
`COST.md`/`PLAN-LOOP.md`.

## Build/test loop during and after this bridge

Do **not** apply the plan reviewer-editor role collapse to production game-code criticism. Keep the
build loop role-separated:

```
  builder → fresh independent build critic
                 ├─ PASS → build-satisfied
                 └─ FAIL → executable remediation specification → fresh builder → fresh critic
```

A build critic must not edit the production game/content change it is judging or subsequently grade
its own repair. It may create or repair critic-side measurement tooling when the governing method
requires that, subject to the normal tool-loop and independence rules. An agent that built a blind
pack still does not judge it.

On FAIL, the critic must leave the next builder a **minimal executable remediation specification** in
the normal verdict/status/build handoff. Point at the satisfied plan, governing item, evidence and
instrument instead of restating them. The handoff identifies the single biggest actionable gap, what
must be preserved, the narrow implementation delta/seam, the cheapest valid order of checks,
existing instruments/fixtures to reuse, exact acceptance/population/hard fails/controls, and clear
stop/escalation conditions.

The remediation route itself must be materially cost-effective without lowering the bar: avoid
unnecessary broad refactors, duplicate tooling/evidence, repeated full-corpus/browser runs, redundant
captures, gratuitous sweeps and optional polish. Use cheap/static/headless gates before expensive
browser/blind/runtime work where valid, and reuse still-valid evidence. The fresh builder consumes the
satisfied plan plus the latest critic delta rather than reconstructing the whole historical narrative.

This build-side rule is intended to persist when the temporary Codex bridge is removed; the durable
version lives in `PLAN-LOOP.md`. The bridge repeats it here so interim Codex tasks behave consistently.

## Temporary no-blog/no-illustration rule

For the entire owner-driven Codex bridge phase, suspend the routine progress-blog requirement in
`AGENT-PROTOCOL.md` for Codex tasks. **Do not create an owner-facing blog entry, explanatory
illustration, or progress screenshot merely because a Plan, Review/Edit, Remediate, Build or Critic
task completed.** In particular, do not append routine progress lines to `reports/blog-feed.jsonl`,
do not create `docs/shots/*` illustrations for task summaries, and do not regenerate/publish docs
solely to surface routine task progress.

This is a reporting exception only. It does **not** weaken evidence requirements: if a governing
reference item, comparison method, verdict schema, blind pack, build/critic protocol, or genuine
measurement requires an image or other artifact, produce that evidence in the repository's normal
evidence location. Likewise, do not delete or rewrite existing blog/history artifacts. Dedicated
blogging may resume when normal Claude orchestration resumes or when the owner explicitly asks for
it.

At the end of every Plan, Review/Edit, or Remediate task, run or derive the canonical Wave 1
plan-state inventory from current task HEAD and include a short **Plan-state summary** in both the
task's final response and its PR description. Report counts for `needs-current-state-plan`,
`awaiting-criticism`, `awaiting-remediation`, `awaiting-recriticism`, and `satisfied`, plus the names
of any pieces still requiring action in the current batch. State the owner's next short command
explicitly. If every plan in the current batch is `satisfied`, say so plainly and state that the
owner may move on to the next build-ready work. Do not make the owner maintain a separate tracking
list.

Fresh reviewer-editors may read prior critique/remediation evidence to verify closure but must
independently reconstruct the governing bar and may not adopt the previous author's reasoning as
their own. There is no round ceiling. Escalate stalled repeats, disputed bars, invalid instruments
and seams through the existing ruling mechanism. `CARRIED` cannot bypass a gate required before the
next phase.

## Compatibility and resumption

This bridge adds no parallel workflow and changes no historical conclusion, gap, evidence,
ownership or dispatch record. Verdict schema version 1 remains compatible: historical verdicts
with `biggest_gap` validate unchanged; prospectively, FAIL requires exactly one actionable gap and
an evidence-earned PASS may omit it. The gap ledger simply opens no entry for that PASS. Claude
Code resumes by reading the same canonical artifacts; it may remove only this temporary bridge and
restore its normal concurrency floor, leaving plan/verdict states intact.