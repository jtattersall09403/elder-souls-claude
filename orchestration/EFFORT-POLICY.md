# Effort escalation policy for builder agents

> User direction, wave 0: *"set effort level to 'ultra code' for builder agents **when strictly
> necessary** — e.g. for particularly challenging tasks, and for situations where a lower level of
> effort appears to be stuck and isn't improving with rounds of feedback from the critic."*

Escalated effort is expensive. It is also the difference between a piece that converges and a
piece that oscillates. This policy says exactly when to spend it, so the decision is a rule rather
than a mood.

## The three tiers

| Tier | When | How it is dispatched |
|---|---|---|
| **Standard** | The default for every builder piece | `Agent` tool, inherited model and effort |
| **Elevated** | Pre-declared hard pieces (below) | `Agent` with `model: opus` and an explicit rigour framing in the prompt |
| **Ultracode** | Escalation triggers fired (below) | `Workflow` with `effort: 'max'` on the builder stage, or an `Agent` dispatched with maximum-rigour framing and a longer budget; the orchestrator records *why* in the piece's ledger entry |

## Pre-declared hard pieces — start at Elevated, not Standard

These are hard on their face, and starting them cheap wastes a round:

- **`W1-00` harness, determinism, persistence** — everything downstream is inadmissible without it,
  and a determinism bug is invisible until it corrupts a verdict.
- **`W1-04` combat core** — frames, stamina, hitboxes, i-frames, commitment. Souls' authority under
  the arbitration rule lives here, and S22's 60 Hz rebase means every number is load-bearing.
- **`W1-06` camera** — seam S18's eighteen clauses, the lock-on containment law, spring-arm
  collision in three worst-case geometries.
- **`W1-05` weapon movesets** — the fingerprint-distance and animation-reuse bars are statistical,
  so a naive implementation fails them without being obviously wrong.
- **`W1-2x` main quest completability** — the wide-before-deep constraint means this must work end
  to end in wave 1, which is a structural problem, not a content one.
- **Any piece whose reference items carry a hard fail that caps the whole wave.**

## Escalation triggers — move up a tier when any fires

1. **Two consecutive critic rounds with no score improvement** on the same piece. This is the
   user's named case: feedback is arriving and not helping, so more feedback will not help either.
2. **The critic's single biggest gap is unchanged across two rounds.** The builder is not failing to
   *hear* the gap; it is failing to *close* it.
3. **A hard fail that would cap the wave** remains open after one round.
4. **The builder itself reports it is stuck** — a builder that says so honestly should be believed
   and re-dispatched at a higher tier, not re-sent the same prompt.
5. **The piece blocks three or more other pieces** and is late.
6. **A `path_to_ten` debt slips two waves.** Under `SCORING.md` §0 every score below 10 carries a
   remedy and the wave it closes by. Missing that twice means the remedy is wrong or the piece is
   harder than scoped — escalate rather than re-file the same debt a third time.
7. **A verdict comes back `VOID`** for reasons inside the builder's control (unmeasurable output,
   missing harness surface, no artifacts) twice.

## De-escalation

Escalation is per-round, not permanent. A piece that reaches its bar drops back to Standard for
subsequent deepening waves. Escalating a piece that is already converging wastes budget that a
stuck piece needs.

## What escalation actually changes

Not just "try harder". A dispatch at Ultracode must also:

- **Hand the builder every prior critic verdict for that piece**, not only the latest, so it can see
  what it has already tried and failed.
- **State the specific gap that triggered escalation**, quoted from the verdict.
- **Widen the licence**: an escalated builder may refactor across the piece boundary, propose a
  corpus amendment if it believes the bar itself is wrong, and spend rounds on instrumentation
  before writing feature code.
- **Require it to say what it would need** if it still cannot close the gap — a harness surface, a
  doctrine ruling, a corpus amendment, or an honest "this bar is unreachable and here is why".

That last point matters: two of the corpus's best outcomes came from an agent refusing its brief
rather than complying with it — `RI-DLG08` rejecting an indifference band that Morrowind itself
fails, and the audit refusing to half-apply the frame rebase. An escalated builder must have the
same standing.

## Recording

Every escalation is recorded in the piece's ledger entry: which trigger fired, what the unchanged
gap was, and whether escalation actually closed it. If escalation *doesn't* help either, that is a
signal the **bar** is wrong or the **piece decomposition** is wrong — and the next step is the bar
critic or a re-decomposition, not a third dispatch at the same tier.
