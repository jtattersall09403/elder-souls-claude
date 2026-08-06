# Proposed amendment AM-W1-00-C1 — `RI-MTH02` rung R4's frame-difference clause is defeated by one trace field

**Filed by:** critic of wave-1 piece **W1-00** (`crit-w1-00-h7q2`).
**Status:** proposed. **Not applied.** The item wins until it is amended; this verdict scores R4
against the hard-fail clause's own words (*"R4 fails (seed changes nothing)"*) and records the
literal tolerance as met.
**Reason:** `sharper_discriminator`.
**Affects:** `corpus/80-methods/RI-MTH02-determinism-reproducibility.md` §A rung R4,
`## Comparison method` M3, and the 3 points R4 carries in `## Scoring`.

## What R4 says

| Rung | Property | Test | Tolerance |
|---|---|---|---|
| R4 | **Seed-sensitive** | same scenario, seeds 1337 vs 4242 | `body_sha256` **differs**, and ≥ 5% of frames differ in at least one field |

M3 adds the rung's meaning: *"A seed that changes nothing means the PRNG is not actually wired
into the AI, and every 'randomised' behaviour in `corpus/10-combat/` is a lie."*

## What was measured

`node tools/harness/trace.mjs --scenario cmb-duel-infantry` at seeds 1337 and 4242, 3600 frames
each, field-by-field diff over the whole body
(`corpus/90-verdicts/wave1/artifacts/W1-00/r4-seed-sensitivity.txt`):

```
all differing fields across 3600 frames: {'.rng.seed': 3600}
frames differing in ANY field other than .rng.seed: 0
```

`rng.draws` is **0 on every one of the 3600 frames**. The two runs are the same simulation.
`body_sha256` differs and **100%** of frames differ in at least one field, so the rung's stated
tolerance is satisfied — by the trace record echoing back the seed it was given.

The build's own instrument agrees and reports the rung as passing:
`node tools/harness/determinism.mjs` prints
`PASS R4 — seed-sensitive: different seed diverges, >=5% of frames differ / frames_differing_pct: 100`.

## Why this is a defect in the rung

`RI-MTH02`'s own `## How we lose` #8 predicts this exact outcome — *"R4's 5% clause passes on a
technicality while world generation is silently unseeded"* — and the rung as written contains
nothing that stops it. R5 already solves the same class of problem by **naming a field to drop**
(`rng.draws`) before comparing. R4 does not, and `rng.seed` is a field that is a pure function of
the independent variable, so it guarantees a 100% frame-difference rate for any build whatsoever,
including one with no PRNG at all.

## Proposed replacement

> | R4 | **Seed-sensitive** | same scenario, seeds 1337 vs 4242 | `body_sha256` **differs**; and after **dropping `rng.seed` and any other field that is a pure function of the seed input**, ≥ 5% of frames still differ in at least one field; **and** `max(rng.draws) > 0` in both runs. |

And in M3, after the existing text:

> The frame-difference count is taken **excluding `rng.seed`**. A run whose only seed-dependent
> field is the seed itself has not passed this rung, it has passed a tautology. Additionally
> report `max(rng.draws)`: a scenario in which the PRNG is never drawn from cannot demonstrate
> seed sensitivity at all, and the rung scores 0 with the reason `prng_never_drawn`.

Two properties are preserved and one is added: a genuinely seeded build still passes; a build
whose seed reaches the AI still passes; and a build in which the seed reaches nothing now fails,
which is what the rung's own hard-fail clause already says should happen.

## Scope note

This amendment does not change any threshold. The 5% figure, the 3-point weight and the
hard-fail clause are unchanged.
