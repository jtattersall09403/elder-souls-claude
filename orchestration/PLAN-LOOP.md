# The plan loop — argue in text before you pay for a browser

**Owner's proposal, adopted with three changes.** Every piece now runs two loops, not one:

```
  plan → fresh reviewer-editor ⇄ fresh reviewer-editor   cheap, text/offline where possible
    ↓                         repeat until satisfied
  build ⇄ build critic       expensive: browsers, hours, 200–450k tokens a side
```

A reviewer-editor both falsifies and, when the repair is ordinary and clear, edits. Independence is
preserved by a simple rule: **an agent may approve the plan version it received, or materially edit
it, but never both.** Any material edit leaves the plan `awaiting-recriticism`; a different fresh
reviewer-editor must approve that version.

## Why — the numbers, not the theory

Pieces here run **4 to 6 rounds**: W1-04 reached round 6, W1-14 round 5, W1-13 and W1-26 round 4.
A build round costs roughly **250–450k tokens on each side** and 40–90 minutes of the box's only
scarce resource, a browser. A plan exchange costs **20–40k and no browser at all.**

And the failures are the shape a plan reviewer catches. Every one of these is real, from one day:

| what failed | could a plan reviewer have caught it? |
|---|---|
| The magic census varied **one dial of three** — duration pinned at 20, area at 0, for four rounds | Yes. *"The item names three dials. Which does your method vary?"* |
| Every magic fixture used a **still target**, so a bolt that could not hit a walking body survived two rounds | Yes. Rule 8 is one sentence: *"does your fixture move?"* |
| The doorstep number was taken **one frame** after the door; at 600 frames it was ten times worse | Yes. *"At what times do you take this reading?"* |
| A blind audio pack **contained no audio** and could not express the question its item asks | Yes, entirely. It cost two rounds. |
| A deploy check asserted *a canvas exists* rather than *pixels are visible* — and passed on a black screen | Yes. *"What would this check say about the failure you are trying to prevent?"* |

None of those needed a browser to find. All needed somebody to read the method against the bar.

## Current-state plans apply to every piece

The plan gate is prospective and applies even when a Wave 1 piece was built or criticised before
this loop existed. Such a piece does not pretend to start over. Its **current-state continuation
plan** reconciles current HEAD, measured evidence, accepted behaviour and unresolved gaps/risks,
then states the next work needed to reach the governing bar. It must name what landed and must be
preserved, what independent evidence already established, what remains unresolved, which old
assumptions are stale, and what the next build/remediation must prove. If the bar is already met,
the plan says so and specifies only legitimate verification/closure; it does not manufacture work.

Until a canonical plan is satisfied, prior build activity never exempts a relevant piece from the
plan gate. `node tools/dispatchable.mjs --wave1-plans` reports the canonical state signals.

The governing bar is not whatever the plan author happened to quote. Derive it from the piece's
canonical owned paths/decomposition and authoritative `judges:` metadata, then read the referenced
items' native predicates, thresholds, populations, comparison methods, hard fails and applicable
later rulings/amendments. The plan summarises the bar; it does not define it.

## The operating rules

**1. Repeat fresh reviewer-editor rounds until satisfied; do not count rounds.** A fresh independent
task reviews each canonical plan against the governing bar and the cost-effective-plan gate below.
If it finds no material defect and makes no material edit, it may mark `satisfied`. If it finds an
ordinary defect whose safe repair is clear, it edits the plan in the same task and leaves it
`awaiting-recriticism`; a different fresh reviewer-editor judges that version. A reviewer-editor
must never approve its own material edit. CARRIED is only for a non-blocking empirical risk that
genuinely cannot be resolved in this phase; it must be visible in the build brief and cannot bypass
a pre-build requirement.

`awaiting-remediation` remains a valid state for already-recorded criticism and for a blocker that
cannot safely be edited in the reviewing task. In particular, the current 2026-08-09 Wave-1 batch
already has a completed criticism round: remediate those recorded findings first, move them to
`awaiting-recriticism`, and only then begin repeated fresh reviewer-editor rounds. Successive rounds
with no substantive progress, repeated disagreement about the same bar, an invalid instrument, or
a seam/ruling/authority ambiguity go to the existing arbiter/ruling mechanism rather than automatic
acceptance or a convenient local interpretation.

**2. The plan's deliverable is not the steps. It is the acceptance, the units and the null.**
Two rounds were lost this week to *definition* disputes rather than build errors — a prop count
where the prose said "overhang" and the code computed "clearance", and a fidelity check measured in
luma where its item specifies ΔE. A plan is not approved until it states:

- **the acceptance number, its predicate and its units** — so the build critic cannot be arguing
  about what was meant;
- **the null control: the arm that must come out worse, and what it would look like if it were
  inert.** Nearly every failure this project has had is a control that could not fail. This is the
  single highest-value line in the whole document;
- **which existing instrument is being reused**, by path. Rule 10: two implementations of one system
  is how this build had a good detection model and a broken one at once.

**3. The plan must be cost-effective as well as bar-sufficient.** Build-ready means a clear,
deliverable, materially cost-effective route from current HEAD to the **same** governing bar. The
bar is never lowered to save tokens. Prefer the minimum sufficient work/evidence set that can prove
the governing predicates: preserve valid current behaviour/evidence, reuse authoritative tools,
fail cheaply before paying for browser/blind/runtime work, bound populations and stopping
conditions, order high-information gates early, and keep optional polish/speculative refactors off
the critical path unless the bar actually requires them.

A reviewer-editor asks both:

1. *Could a competent builder execute this plan exactly as written, get every planned check green,
   and still fail any governing reference-item predicate?* If yes, it is not satisfactory.
2. *Is there a materially cheaper or simpler credible route from current HEAD to the exact same bar
   because the plan duplicates established work/evidence, over-tests, over-builds, uses unnecessarily
   expensive instruments/passes, repeats corpus/browser work, or lacks useful stop/order constraints?*
   If yes and the waste is material, it is not satisfactory.

Do not invent micro-optimisations and do not trade away verification quality. Exact token forecasts
are not required where they would be guesswork; reason from concrete cost drivers and the measured
cost evidence in `COST.md` and this file.

**3a. Every new or materially revised plan allocates builder work and critic work before it can be
reviewed.** The plan must link `orchestration/plans/BUILDER-EXECUTION-CONTRACT.md` and contain a
piece-specific `Builder/critic execution allocation` section. That allocation is part of the first
draft, not a cleanup added after a builder has spent hours executing critic populations.

The builder owns all production implementation, data/content integration and instruments needed to
make the governing methods executable; exhaustive cheap deterministic checks; the smallest
representative live population that proves each changed mechanism through the shipping path; targeted
positive, boundary, refusal/null, motion/time, persistence and rendered-output cases as applicable;
targeted red/delete-the-fix controls; one bounded builder aggregate; and text-only reproduction
evidence. The builder keeps repairing these rows until they pass in the run.

The fresh critic owns exact full populations, complete capture/modality matrices, repeated
trials/seeds/sessions, long-duration journeys, blind/naive/fresh-participant work, independent replay,
final native aggregation, hard-fail assessment, score and verdict. An empirical run expected to take
more than about fifteen minutes belongs to the critic by default unless the piece-specific allocation
explains why one longer run is indispensable to implementation confidence. Binary evidence may be
created locally by a builder for inspection; the repository receives a text report naming what was
created and checked plus exact reproduction commands, not those binaries.

Historical plan prose that assigns a builder a full native population remains the final acceptance
contract and critic instruction unless the piece-specific allocation explicitly retains that
population for the builder. A reviewer-editor treats missing, ambiguous or wasteful allocation as a
material plan defect. It also checks that moving work to the critic has not removed the builder's
obligation to prove the implementation actually works in the running game.

**4. Model choice is evidence, not a judgement call.** Sonnet is *proven* here — Sonnet blog
writers have caught four errors in the orchestrator's own briefs, including a fabricated figure and
a claim that contradicted its own source. Haiku is unproven and no build should be its first job.

| the work | model |
|---|---|
| Designing a measurement, ruling on a seam, writing graded prose, any critic/reviewer | **Opus** |
| A build with a landed plan, an existing instrument, and a machine-checkable acceptance | **Sonnet** |
| One mechanical job, trialled and measured before it is trusted | Haiku, not yet |

## Build loop: independent critic, executable remediation

The plan-side reviewer-editor pattern does **not** extend to production game-code criticism. Once
building begins, keep implementation and judgement separate:

```
  builder
     ↓
  fresh independent build critic
     ├─ PASS → build-satisfied
     └─ FAIL → executable remediation specification
                    ↓
              fresh builder
                    ↓
              fresh build critic
                    ↺ until PASS
```

A build critic must not repair production game code, tune the implementation to its own probe, or
turn itself into the next builder. It may create or repair critic-side measurement tooling when the
method requires that, subject to the normal tool-loop and independence rules, but the game/content
change under judgement remains for a fresh builder. Blind packs remain independently judged: an
agent that built the pack does not judge it.

On FAIL, the critic's deliverable is not merely a diagnosis. It must leave the next builder a
**minimal executable remediation specification covering every material actionable gap it found**,
anchored to authoritative artifacts. Record it in the verdict/status/build handoff used by the
existing workflow, and point at the satisfied plan, governing items, evidence and instruments rather
than restating large source material. It should state:

- **all material actionable gaps found in that critic round**, each tied to the exact governing
  predicate it misses; designate one as `biggest_gap` only where the verdict schema requires that
  ranking field — the schema's single biggest-gap field must never suppress other known blockers;
- what current behaviour/evidence is already good and must be preserved;
- the narrow implementation delta or subsystem seam needed for each gap, without prescribing a
  speculative rewrite when multiple implementations could satisfy the bar;
- the cheapest valid order of work across the gaps: shared/cheap/static/headless gates first, then
  only the browser, blind-judge or runtime evidence genuinely required;
- authoritative instruments/fixtures to reuse by path, including required red/null/delete-the-fix
  and CONSUMPTION evidence;
- exact acceptance, units, population/denominator, hard fails and stop conditions for every gap;
- any dependency, ruling or seam that must be resolved before expensive work proceeds.

The critic must optimise the **whole remediation route** for material cost and deliverability while
keeping the governing bar fixed. It should exploit shared fixes/evidence across gaps where legitimate
and order the work so one cheap gate can invalidate or narrow downstream work. Do not prescribe
duplicate implementation, unnecessary full-corpus reruns, redundant captures, repeated browser
launches, gratuitous exhaustive sweeps, optional polish or broad refactors that do not contribute to
closing a failed predicate. Reuse still-valid evidence and existing instruments where legitimate. If
a cheap gate proves a proposed branch cannot work, stop that branch rather than paying for downstream
browser/blind work.

A failing critic still records one `biggest_gap` when required by the verdict schema, but that is a
**ranking/summary field, not a one-gap work limit**. The executable remediation specification must
carry every material actionable gap discovered in the round so the next builder can fix them in one
coherent, cost-effective pass instead of paying for serial rediscovery across critic rounds. The next
fresh builder consumes the satisfied plan plus this latest complete critic delta, not the entire
historical narrative unless a referenced authority requires it.

This separation deliberately spends a little more context than a critic editing game code itself in
exchange for independent measurement, clean delete-the-fix provenance and uncontaminated blind
judgement. Recover that cost through precise handoff, evidence reuse, cheap-first sequencing and
single-browser/capture-pool discipline rather than by collapsing builder and critic roles.

## The risk this creates, and the guard

Several of the best findings this week were discoverable **only by building**: the ground plane
pinned at zero so no spell could be cast anywhere, a file that existed on disk and not in the repo,
a bolt using pure pursuit. **A plan must never become a commitment device.** So:

> The build agent is **required** to report a plan defect the moment it finds one, and a plan defect
> found at build time is written back into the plan file. A builder that follows a wrong plan
> faithfully has failed; a builder that says "the plan was wrong, here is why" has done its job.

## The shape on disk

- `orchestration/plans/<piece>.md` — the plan. The build brief **points at it** rather than
  restating it (rule 18, which the orchestrator has broken four times).
- The plan carries a `Plan-State:` marker using one of the states below, BLOCKING items resolved,
  CARRIED risks listed, the acceptance table, the null control, a binding piece-specific
  `Builder/critic execution allocation` linked to `BUILDER-EXECUTION-CONTRACT.md`, and the latest
  reviewer outcome.
- Status files mirror `"plan_state"` so dispatch remains machine-readable. Canonical states are
  `awaiting-criticism`, `awaiting-remediation`, `awaiting-recriticism`, and `satisfied`. Absence of
  a canonical plan means `needs-current-state-plan`; `satisfied` means build-ready.
- `awaiting-criticism` means a new plan has not yet received an independent reviewer-editor.
  `awaiting-remediation` means recorded criticism still needs a dedicated remediation/ruling step.
  `awaiting-recriticism` means the plan was materially edited and must be judged by a different fresh
  reviewer-editor before it can become satisfied.
- Build status remains in the existing status/verdict/gap system (`build-awaiting-criticism`,
  `build-blocked`, or `build-satisfied`) rather than a second ledger.
- `node tools/dispatchable.mjs --wave1-plans` reports plan state before any builder category.

## What it is expected to save, stated as an estimate

Plan + review ≈ **60–100k tokens, no browser**. A build round ≈ **600k and a browser**. If the loop
removes **one** round per piece it repays roughly sixfold; the 4-to-6-round pieces suggest it removes
more than one. Speed: it adds ~15 minutes in series and removes 40–90 minute rounds — and because
planning needs no browser, **a whole wave can plan in parallel while builds queue on the box.**

Combining ordinary criticism and remediation in one reviewer-editor round removes another source of
waste: the agent that just paid to reconstruct the bar and understand the defect should normally make
the obvious safe plan edit while that context is live. The independence guard is on approval, not on
editing: the edited version still requires a different fresh reviewer-editor.

### The first measured run — the estimate above was wrong, and low

**W1-HUD-TOAST, the first piece to use this loop.** The plan half alone cost **131k tokens, 40 tool
calls, 10 minutes, no browser** — more than the 60–100k this document estimated for *plan and critic*
together. Assume a full exchange is **200–260k**, not 100k. That is still roughly a quarter of a
build round and it still needs no browser, so the case holds; but the number in the paragraph above
was written before anything had run and it should be read as what it was.

**The full exchange came in at 214k** — plan 131k, plan critic 83k — against the 200–260k this
section revised the estimate to. That revision was taken *before* the critic ran, so the number
above is a prediction that held, not one fitted afterwards.

**What the plan bought, which is the part that decides whether the loop survives.** Before any build
agent was dispatched, offline reading alone established:

- The repair the piece was dispatched for **had already landed**. A build agent would have spent its
  first hour discovering that. This is exactly the waste rule 3z was written for, caught a layer
earlier and for a tenth of the cost.
- The defect was **not** the faction-quest edge case it was dispatched as: **58 of 75 strings (77%)**
on that toast channel overflow the 400 px panel, widest 1013.5 px. The brief's framing was wrong
and the plan corrected it before anyone paid to build against it.
- The landed fix is a **second implementation** — `ui/type.js` already exports `wrap()`,
`ellipsise()` and `normalise()`, and `hud.js` imports `measure`/`drawText` from that same file
before re-implementing greedy wrapping inline. Rule 10 violated *inside the fix*. A build critic
would have found this in round 2; the plan found it in round 0.

**And the shape to keep.** The plan agent wrote down what it was **least sure of** and named the
reviewer's strongest move against its own document. That is not modesty, it is the cheapest possible
way to spend the next exchange: identify genuine uncertainty, assumptions and likely attack surfaces
so the reviewer can start there. Every plan should end with that examination. If rigorous
examination against the governing bar finds no material weak joint, say so with the evidence; do
not invent a weakness any more than a reviewer should invent a gap.

None of this replaces the build-side independence controls. One builder, one separate build critic
with fresh context, delete-the-fix, the CONSUMPTION check, the self-test that goes red on purpose —
all unchanged. This adds a cheap argument in front of an expensive one.
