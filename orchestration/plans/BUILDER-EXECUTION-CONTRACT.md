# Builder execution contract — bounded proof, independent judgement

**Owner-ratified:** 2026-08-11. **Applies when a piece plan links to this file.**

This contract allocates work between the production builder and the fresh independent build critic.
It does not change any governing predicate, population, threshold, hard fail, native method or final
acceptance bar in the linked plan or reference corpus. It defines who executes that work and what a
builder must finish before handoff.

## Meaning of the owner command

When the owner says:

> Deliver all builder-owned work from `orchestration/plans/<piece>.md` in a single run.

the builder must continue until every available builder-owned implementation and verification item
in the piece-specific allocation is complete. Completing the first repair, first test group or first
diagnosis is not completion. The builder must consume work already landed on the branch, preserve
valid existing work, and finish all other independent builder-owned items before terminating.

A missing canonical dependency is the only permitted reason to defer a dependency-bound item. The
builder records the exact dependency and continues every other available builder-owned item. Time,
browser duration, a red result, or discovery of further in-scope work is not a reason to stop: the
builder repairs the implementation and reruns the narrow affected proof. A genuine authority or plan
defect is recorded immediately under `orchestration/PLAN-LOOP.md`; the builder continues unaffected
work and does not invent a local ruling.

## Builder-owned work

The linked plan's `Builder/critic execution allocation` section is binding. In addition, every
builder owns the following common work:

Where later historical plan prose assigns a builder a complete native population, full capture
matrix, long session, blind/naive judgement or final aggregate, read that prose as the unchanged
final acceptance contract and critic instruction unless the piece-specific allocation explicitly
retains it for the builder. The builder still owns every missing production implementation and
instrument needed to make that critic work executable.

1. Implement every builder-owned production-code, game-data, content, integration and instrument
   change required by the plan and by the latest critic remediation specification, if one exists.
2. Run exhaustive cheap checks where they are deterministic and materially inexpensive: syntax,
   schemas, manifests, graph/reference completeness, formulas, data populations and relevant
   repository boot/data/content gates.
3. Prove every distinct changed mechanism through the shipping game path with the smallest
   representative live population that covers:
   - one positive case;
   - one important boundary or edge case;
   - one refusal, negative or clean-null case;
   - a moving and/or late-frame observation when the mechanism responds to motion or time;
   - live post-load state when persistence is affected;
   - actual rendered output when pixels, text, animation, camera, UI or VFX are affected.
4. Run one representative end-to-end happy path for an integration-heavy system when the
   piece-specific allocation requires it. The route must use player-available production actions;
   setup-only harness verbs cannot substitute for the behaviour under proof.
5. For each instrument created or materially changed, run its clean positive fixture and deliberately
   break the measured mechanism so the relevant check goes red. Confirm the changed production code
   executed and that the support/population is non-empty.
6. Delete each distinct implementation fix on an isolated copy, or use the narrowest legitimate
   combined/2x2 arm when two guards carry one defect, and reproduce the pre-fix failure. This is a
   targeted implementation proof; it does not require repeating every critic population or every
   data row.
7. Run one bounded builder aggregate containing every builder-owned check at the same commit. Fix all
   failures in that aggregate before handoff.
8. Write text-only delivery evidence: tested commit, commands, fixtures, populations, observed
   outcomes, targeted red/delete results, known dependency blocks and exact reproduction commands
   for the critic-owned suite. Builders may create screenshots, video, audio and other binaries for
   their own inspection, but do not commit those binaries.
9. **Publish before handoff.** Owner-ratified 2026-08-14 (`orchestration/OWNER-DIRECTIVES-2026-08-14.md`
   #7), after `orchestration/INDEX.md`, `docs/index.html`, `docs/progress.html` and
   `docs/status.json` went stale for days because regeneration lived only in a local git hook,
   which never runs for a PR merged on GitHub and never runs in a sandbox where nobody has run
   `git config core.hooksPath .githooks`. Before reporting `builder-owned work complete`, run:

   ```
   node tools/gen-index.mjs && node tools/publish.mjs
   ```

   and commit the result by explicit path (rule 28), the same as any other declared file. This is
   required **in addition to**, not instead of, the pre-commit hook and the CI workflow
   (`.github/workflows/publish.yml`) that also do this — three independent legs, because any one of
   them alone has already been observed to go silent. It costs one command. Also append the one
   required line to `reports/blog-feed.jsonl` (rule 27) — the twice-daily blog roundup
   (`orchestration/briefs/blog.md`) is built from that feed, and a builder that skips it is a
   builder the reader never hears about.

## Cost and runtime boundary

Use one reusable browser instance and run cheap/static/headless gates before live work. Rerun the
narrow affected fixture after a repair; do not restart an unchanged complete population after every
edit.

By default, an empirical test belongs to the critic when any of these is true:

- it is expected to consume more than about 15 minutes of wall time by itself;
- it exists principally to estimate a distribution, rate, percentile, preference or full-population
  score after the production mechanism is already shown to work;
- it requires a fresh/naive participant, blind judge, sealed reveal or independent pack actor;
- it is a complete capture matrix, repeated multi-seed/session population, exact long-duration
  journey, exhaustive modality matrix or comprehensive cross-item aggregate.

The piece-specific allocation may explicitly retain one longer indispensable end-to-end builder
journey or a cheap complete population. The 15-minute boundary is a dispatch default, not permission
to abandon a failing builder-owned fixture. A builder fixes builder-owned failures until they pass.

## Critic-owned work

The fresh independent build critic owns:

1. Exact full native populations and denominators not explicitly retained by the builder allocation.
2. Repeated trials, seeds, rates, devices, long sessions and statistical confidence/score work.
3. Blind, naive, fresh-agent and human-quality protocols, including pack construction where the
   governing method requires critic-side construction.
4. Complete capture matrices, exhaustive sabotage/control populations and independent replay of
   builder evidence.
5. Final native aggregation, hard-fail assessment, score and verdict against every governing item.
6. Fresh evidence gathering. Builder artifacts and reports guide reproduction but never substitute
   for the critic's independent observation where the method requires freshness.

On failure the critic supplies one complete executable remediation specification covering every
material builder-actionable gap. The next builder consumes that delta plus the canonical plan and
again applies this contract.

## Completion labels

The builder reports `builder-owned work complete` only when the piece-specific builder list and the
common work above are complete at one stamped commit, aside from explicitly named unavailable
dependencies. Critic-owned rows are reported as `critic handoff`, `not_run by builder` or
`dependency-blocked`; they are never scored green by the builder.

The piece reaches final satisfaction only through the existing fresh-critic loop in
`orchestration/PLAN-LOOP.md`.
