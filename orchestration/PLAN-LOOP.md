# The plan loop — argue in text before you pay for a browser

**Owner's proposal, adopted with three changes.** Every piece now runs two loops, not one:

```
  plan  ⇄  plan critic        cheap, text only, no browser, bounded at 2 exchanges
    ↓
  build ⇄  build critic       expensive: browsers, hours, 200–450k tokens a side
```

## Why — the numbers, not the theory

Pieces here run **4 to 6 rounds**: W1-04 reached round 6, W1-14 round 5, W1-13 and W1-26 round 4.
A build round costs roughly **250–450k tokens on each side** and 40–90 minutes of the box's only
scarce resource, a browser. A plan exchange costs **20–40k and no browser at all.**

And the failures are the shape a plan critic catches. Every one of these is real, from one day:

| what failed | could a plan critic have caught it? |
|---|---|
| The magic census varied **one dial of three** — duration pinned at 20, area at 0, for four rounds | Yes. *"The item names three dials. Which does your method vary?"* |
| Every magic fixture used a **still target**, so a bolt that could not hit a walking body survived two rounds | Yes. Rule 8 is one sentence: *"does your fixture move?"* |
| The doorstep number was taken **one frame** after the door; at 600 frames it was ten times worse | Yes. *"At what times do you take this reading?"* |
| A blind audio pack **contained no audio** and could not express the question its item asks | Yes, entirely. It cost two rounds. |
| A deploy check asserted *a canvas exists* rather than *pixels are visible* — and passed on a black screen | Yes. *"What would this check say about the failure you are trying to prevent?"* |

None of those needed a browser to find. All needed somebody to read the method against the bar.

## The three changes to the owner's version

**1. The loop is bounded at two exchanges, and feedback is split.** "Loop until the critic is
satisfied" fights this project's own doctrine: *a critic that cannot find a gap has failed*, so it
will always find something and the loop never closes on its own. So the plan critic marks every
item **BLOCKING** or **CARRIED**. Blocking must be resolved before the build starts. Carried become
**declared risks written into the build brief** — visible, owned, and graded later rather than
argued now. Unbounded becomes bounded with an explicit residue.

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

**3. Model choice is evidence, not a judgement call.** Sonnet is *proven* here — Sonnet blog
writers have caught four errors in the orchestrator's own briefs, including a fabricated figure and
a claim that contradicted its own source. Haiku is unproven and no build should be its first job.

| the work | model |
|---|---|
| Designing a measurement, ruling on a seam, writing graded prose, any critic | **Opus** |
| A build with a landed plan, an existing instrument, and a machine-checkable acceptance | **Sonnet** |
| One mechanical job, trialled and measured before it is trusted | Haiku, not yet |

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
- The plan carries `BLOCKING` items resolved, `CARRIED` risks listed, the acceptance table, the null
  control, and the model the plan critic recommends with its reason.
- `node tools/dispatchable.mjs` reports `needs-plan` before `needs-builder`.

## What it is expected to save, stated as an estimate

Plan + critic ≈ **60–100k tokens, no browser**. A build round ≈ **600k and a browser**. If the loop
removes **one** round per piece it repays roughly sixfold; the 4-to-6-round pieces suggest it removes
more than one. Speed: it adds ~15 minutes in series and removes 40–90 minute rounds — and because
planning needs no browser, **a whole wave can plan in parallel while builds queue on the box.**

### The first measured run — the estimate above was wrong, and low

**W1-HUD-TOAST, the first piece to use this loop.** The plan half alone cost **131k tokens, 40 tool
calls, 10 minutes, no browser** — more than the 60–100k this document estimated for *plan and critic
together*. Assume a full exchange is **200–260k**, not 100k. That is still roughly a quarter of a
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
critic's strongest move against its own document. That is not modesty, it is the cheapest possible
way to spend the critic's exchange — the critic starts at the weakest joint instead of finding it.
Every plan should end with that section, and a plan that claims no weak joint has failed the same
way a critic that finds no gap has failed.

None of this replaces anything. One builder, one separate critic with fresh context, delete-the-fix,
the CONSUMPTION check, the self-test that goes red on purpose — all unchanged. This adds a cheap
argument in front of an expensive one.
