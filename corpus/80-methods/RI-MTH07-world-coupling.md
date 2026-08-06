---
id: RI-MTH07
title: World coupling — proving the model is consumed by the world, not merely computed beside it
kind: structure
side: neutral
judges: [process.critic.discipline, process.verdict.format, platform.determinism.harness]
provenance: constructed
confidence: high
blind_pair: no
---

## The bar

`RI-MTH04` killed the critic who reads source and writes numbers. It did not kill the *next*
failure, which wave 1 produced three times independently: a builder ships a correct, well-tested,
fully-instrumented **model** — a visibility formula, a moveset table, a witness predicate — exposes
it through `window.__HARNESS` as a pure function, drives that function from a probe, and reports
the probe's assertions as measurements of the game. Every rule of `RI-MTH04` is obeyed: a real
browser booted, a real trace was written, real numbers came out. And **nothing in the running world
ever calls the function.** The player sees none of it.

This failure is invisible to every Comparison method in the corpus, because a Comparison method
that says *"assert `visibilityAt()` returns 0.157"* is satisfied identically by a model that drives
the game and by a model that sits next to it. The bar this item sets:

> **For every model a piece ships, the verdict must name the world-side consumer that reads it, and
> demonstrate the consumption by perturbing the model and observing an entity change behaviour.**
> A model with no demonstrated consumer is `unmeasurable ⇒ 0`, exactly as a missing model is —
> because from the player's chair they are the same thing.

## The reference artifact

### A. The three shapes of the failure, all observed in wave 1

| Shape | What is shipped | What is missing | Wave-1 instance |
|---|---|---|---|
| **Orphan model** | a formula the harness can evaluate | no entity reads its output | `RI-STL01`'s visibility term `V`: computed every frame into the trace; the enemy alert meter fills at a flat `+4/frame` and never multiplies by it (`W1-15`) |
| **Orphan data** | a table/roster in `game/data/**` | no code path instantiates it | `RI-WPN01`'s 87 movesets, unreachable from the running game (`W1-10` verdict) |
| **Orphan predicate** | a rule that decides something | nothing ever supplies it world state; only a critic hand-feeds it | `RI-CRM01`'s witness predicate: an `ALARM` civilian 3 m from a theft produces `witnesses: []` (`W1-15`) |

### B. The coupling test — three parts, all required

For each model `M` a piece ships:

1. **Name the consumer.** The verdict states the world-side call site: which entity type, in which
   system, on which frame, reads `M`'s output. `"the trace carries it"` is **not** a consumer — the
   trace is an observer. A field that only a critic ever reads is instrumentation, not gameplay.
2. **Perturb and observe.** Drive `M` to two well-separated values through the harness, hold
   *everything else fixed*, run the world, and record an **entity-side** quantity that changes:
   an alert meter, a state transition, a path target, a bounty, a spawn. The pair must be recorded
   as `{model_value_a, model_value_b, observed_a, observed_b}`.
3. **The null control.** Record the same pair with the model driven to a value where the item
   predicts **no** change, so the observed difference cannot be an artefact of the perturbation
   method.

The coupling ratio is the discriminator:

```
coupling = |observed_b − observed_a| / |predicted_b − predicted_a|
```

| `coupling` | Reading |
|---:|---|
| ≈ 1 | the world consumes the model |
| 0 < c < 1 | the world consumes it, attenuated or clamped — name where |
| **0** | **orphan.** The model is not in the game. Score the dimension 0, fail-closed |

### C. The worked instance (W1-15, RI-STL01 §2)

| | `V` | predicted t→AGGRO | observed t→AGGRO |
|---|---:|---:|---:|
| lit, standing, heavy, Sneak 5 | 0.6669 | 1.03 s | **0.50 s** |
| unlit, crouched, in cover, Sneak 100 | 0.0500 | 26.7 s | **0.50 s** |
| coupling | | | **0.00** |

Control: at 30 m (beyond the archetype's 16 m sight radius) neither configuration ever alerts, which
proves the probe is driving a live entity and not a stub. The model is real; the coupling is zero.

## Comparison method

1. **Enumerate the piece's models** from the harness surface: every method that returns a computed
   quantity rather than reading entity state (`visibilityAt`, `soundRadiusFor`, `getGuardBand`,
   `jailLedger`, `fenceQuote`, `reportRoute`, …). Record the list in the verdict.
2. **For each, apply §B.** Two runs, one perturbed variable, one entity-side observable, plus the
   null control. Record `coupling` per model in a `world_coupling` artifact.
3. **The hand-feed audit.** For every harness method that accepts world facts as *arguments*
   (`{dist, bearingDeg, moving, targetCivState}`, `{eid, identified}`, `{observedBy: []}`),
   assert the same result is reachable **without supplying them** — i.e. drive the world into that
   configuration and let the system derive them. A rule that is only reachable by telling the engine
   what it should have observed is an orphan predicate.
4. **The trace-only check.** Grep the piece's trace schema for fields no system consumes. A field
   present in the record and absent from every decision is instrumentation debt, and must be
   declared as such rather than counted as implementation.
5. **Report.** `world_coupling: [{model, consumer, coupling, evidence}]` in the verdict, with any
   `coupling == 0` entry forcing its dimension to 0 and appearing in the piece's status reasons.

## Scoring

| Axis | 10 | 6 (pass floor) | 0 (we lose) |
|---|---|---|---|
| Consumer named | every model has a named world-side consumer with a frame number | every model has a named consumer | any model whose only reader is the trace or a probe |
| Coupling measured | all models `coupling ∈ [0.95, 1.05]`, controls clean | all models `coupling > 0`, controls clean | any `coupling == 0` |
| Hand-feed audit | zero harness methods require injected world facts | injected facts exist but the derived path is demonstrated | the rule is only reachable by hand-feeding |
| Instrumentation honesty | trace fields with no consumer are declared | declared | undeclared trace-only fields presented as implementation |

**Failure threshold: any `coupling == 0` on a model the piece's own reference items require to act.**
That is binary and it is the point of the item.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2.** Derived from this item's own
bands above; no threshold in this item was changed.

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 | 6 / 10 | 8 / 10 |

**Aggregation:** min-over-axes.

## How we lose

- **The item is read as bureaucracy.** It adds a column to every verdict, and the first critic under
  budget pressure will write `coupling: 1` from a probe that called the model directly. The defence
  is §B's requirement that the observable be **entity-side** — an alert meter, a state name, a
  position — never the model's own return value.
- **"The consumer is the next piece."** True and irrelevant. If `W1-12` owns the enemy that should
  read `W1-15`'s visibility term, then `W1-15`'s dimension is still 0 today and the debt is recorded
  against the *seam*, not absorbed by either side. A cross-piece coupling debt with no owner is how
  both pieces pass and the game does nothing.
- **Coupling is demonstrated once, on the happy path.** One consumer wired, twelve orphans behind it.
  §C1's enumeration must be exhaustive over the harness surface, which is why it is step 1.
- **The null control is skipped**, and a critic reports coupling from a perturbation that was really
  a scenario reset. Every wave-1 orphan in the table above would have been caught by the control
  alone.
- **This item is applied only to new pieces.** The three shapes above are all *already in the tree*.
  It is worth a single retro-pass over every wave-1 verdict that scored a model without naming a
  consumer.

## Provenance note

**Everything here is `constructed`**, wave 1, by the `W1-15` critic, and the failure it describes is
`measured`: the §C table is reproduced verbatim from
`corpus/90-verdicts/wave1/artifacts/W1-15/critic-w1-15.json`, produced by
`node tools/harness/critic-w1-15.mjs` at commit `21c9566`, and the two orphan instances in §A are
from that artifact and from the `W1-10` verdict of the same wave. The `coupling` statistic itself is
this item's, and the `[0.95, 1.05]` band is a stated convention rather than a derived one — a model
consumed through a clamp legitimately reads below 1, which is why the 6-floor asks only for `> 0`.

This item deliberately does **not** re-open `RI-MTH04`; it is its successor on the next failure mode.
`RI-MTH04` asks *did you run it*. This asks *did the thing you ran do anything*.
