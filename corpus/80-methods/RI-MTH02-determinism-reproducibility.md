---
id: RI-MTH02
title: Determinism and reproducibility as a judged property
kind: trace
side: neutral
judges: [engine.loop, engine.rng, engine.physics, engine.animation, engine.ai, engine.state]
provenance: constructed
confidence: high
blind_pair: no
---

## The bar

Two runs of the same scenario at the same seed produce **byte-identical** traces. Not
statistically similar — identical, down to the SHA-256 of the frame lines. This is the
load-bearing property of the whole project: without it, "the roll has 13 i-frames" is a
sample rather than a fact, a critic cannot tell a regression from noise, and a builder
cannot reproduce a reported failure. Determinism is also the cheapest possible proxy for a
whole family of architecture sins — a wall-clock read, a `Math.random()` in the AI, a
`* deltaTime` in a cooldown, an unordered `Set` iteration — because every one of them
shows up as a diverging trace and none of them can hide. A game that is deterministic is
not necessarily good; a game that is not deterministic **cannot be judged at all** by this
corpus, and that is why this item can void a wave on its own.

## The reference artifact

### A. The reproducibility ladder — each rung is separately scored

> **R4's discriminator was sharpened by an APPLIED amendment: `AM-W1-00-C1`.** See
> `orchestration/amendments/AM-W1-00-C1-mth02-r4-discriminator.md`. It was adopted by the W1-00
> remediation builder into §A rung R4, `## Comparison method` M3 and `## Scoring`, and implemented
> in `tools/harness/determinism.mjs` and `tools/harness/seed-sweep.mjs` — the "≥ 5% of frames
> still differ after dropping `rng.seed`" and "`max(rng.draws) > 0`" clauses in the R4 row below
> **are** that amendment. It moves no threshold. *(Pointer added 2026-08-14 by
> AUDIT-CITATION-STALENESS: the amendment was applied to this item's text and this item never
> named it, so nobody reading R4 could tell which clauses were original and which were the
> repair — and `AM-W1-00-01`, listed one directory away and **WITHDRAWN**, was the only amendment
> this item pointed at.)*

| Rung | Property | Test | Tolerance |
|---|---|---|---|
| R1 | **Run-to-run** identical | same scenario, same seed, two runs, same process | `body_sha256` equal — zero tolerance |
| R2 | **Process-to-process** identical | as R1 but two separate `node` invocations | `body_sha256` equal — zero tolerance |
| R3 | **Batch-invariant** | `stepFrames(3600)` once vs `stepFrames(300)` × 12 | `body_sha256` equal — zero tolerance |
| R4 | **Seed-sensitive** | same scenario, seeds 1337 vs 4242 | `body_sha256` **differs**; and after **dropping `rng.seed` and any other field that is a pure function of the seed input**, ≥ 5% of frames still differ in at least one field; **and** `max(rng.draws) > 0` in both runs |
| R5 | **Warm-up-invariant** | warm-up 30 vs 90 frames, script frames relative | scripted-window records identical after re-basing **every absolute frame index** — `f`, `events[].f`, `enemies[].state_entered_f` — and normalising a re-based index that lands before the window to `"pre-window"`. Nothing is excluded from the comparison |
| R6 | **Load-order-invariant** | `loadState` → `setSeed` vs `setSeed` → `loadState` | documented which is authoritative; the documented order reproduces |
| R7 | **Wall-clock-invariant** | insert a 3 s host sleep between two `stepFrames` calls | `body_sha256` unchanged |
| R8 | **Resolution-invariant (sim)** | run at 1920×1080 and 640×360 | sim fields identical; only pixels differ |
| R9 | **Save round-trip** | `saveState()` at frame 600, reload, run 600 more | tail matches the uninterrupted run's tail |

### B. Observed reference trace — the stub, which satisfies R1–R4

Produced on this machine, in separate processes (R1/R2), then re-run with a different
batch size (R3) and a different seed (R4):

```
$ node tools/harness/trace.mjs --scenario cmb-duel-infantry --entry tools/harness/stub/index.html
[harness] body_sha256=a2c1e6f5f8e52d5f07ebffe9985197dbba97bfbb9906f6e630f4d8cefc14f47f
$ node tools/harness/trace.mjs --scenario cmb-duel-infantry --entry tools/harness/stub/index.html
[harness] body_sha256=a2c1e6f5f8e52d5f07ebffe9985197dbba97bfbb9906f6e630f4d8cefc14f47f
$ node tools/harness/run-headless.mjs --scenario cmb-duel-infantry --chunk 60 ...   # R3
  manifest.trace.body_sha256 = a2c1e6f5f8e52d5f07ebffe9985197dbba97bfbb9906f6e630f4d8cefc14f47f
$ node tools/harness/trace.mjs --scenario cmb-spacing-hold --seed 1337 ...          # R4
[harness] body_sha256=e9664d68ceee6331f359…
$ node tools/harness/trace.mjs --scenario cmb-spacing-hold --seed 4242 ...
[harness] body_sha256=e6105818b02d17b39a98…                                          differs, as required
```

3600 frames, 0 frame discontinuities, `integrity.fail_closed: false`, and the 60-frame
batching produces the identical hash. This is the shape of a passing result.

The stub is a test fixture, not the game — it is cited here only to show that the bar is
achievable in a browser, in this environment, with this tooling.

### C. The banned constructs (D1–D7 of `HARNESS.md` §8)

| Ban | Typical offender | How it surfaces |
|---|---|---|
| `Math.random()` in sim | AI strafe direction, damage variance, loot | R1 fails |
| `Date.now()`/`performance.now()` in sim | cooldowns, i-frame windows, stamina regen | R7 fails |
| `* deltaTime` in gameplay | movement, stamina, animation advance | R3 fails (batch size changes the result) |
| unordered iteration | `for (const e of entitySet)` | R2 fails intermittently — the worst kind |
| floating-point time accumulation | `t += 1/60` instead of `frame/60` | R3/R5 fail after a few thousand frames |
| GPU-dependent readback in sim | reading a render target to decide a hit | R8 fails |

`Math.random` is expected to be **reassigned to a throwing stub in harness mode**, so a
violation is a loud page error rather than a subtle divergence. The stub does exactly this
in one line and the real game should copy it.

## Comparison method

Fully scripted; no judgement calls.

**M1 — R1/R2 (the headline).**

```bash
node tools/harness/trace.mjs --scenario cmb-duel-infantry --out reports/runs/DET-A
node tools/harness/trace.mjs --scenario cmb-duel-infantry --out reports/runs/DET-B
```

Compare the `body_sha256` in each run's footer line (also echoed by the tool and stored in
`manifest.json → trace.body_sha256`). **PASS** iff equal. On mismatch, find the first
differing frame:

```bash
diff <(tail -n +2 reports/runs/DET-A/trace.jsonl) <(tail -n +2 reports/runs/DET-B/trace.jsonl) | head -20
```

and report the frame number and the first differing field. That field names the bug.

**M2 — R3 batch invariance.** Run the same scenario with `--chunk 3600` and `--chunk 60`.
`body_sha256` must be equal. This is the single best detector of `deltaTime` leakage.

**M3 — R4 seed sensitivity.** Run with `--seed 1337` and `--seed 4242`. Hashes must
differ, **and** at least 5% of frames must differ in at least one field. A seed that
changes nothing means the PRNG is not actually wired into the AI, and every "randomised"
behaviour in `corpus/10-combat/` is a lie.

The frame-difference count is taken **excluding `rng.seed`**. A run whose only seed-dependent
field is the seed itself has not passed this rung, it has passed a tautology. Additionally
report `max(rng.draws)`: a scenario in which the PRNG is never drawn from cannot demonstrate
seed sensitivity at all, and the rung scores 0 with the reason `prng_never_drawn`.

> **Applied amendment `AM-W1-00-C1`** (filed by the critic of wave-1 piece `W1-00`,
> `crit-w1-00-h7q2`; reason `sharper_discriminator`; adopted in the W1-00 remediation). The
> rung as originally written counted a frame as differing if ANY field differed, and
> `rng.seed` is a pure function of the independent variable — so it guaranteed a 100%
> frame-difference rate for *any* build, including one with no PRNG at all. It did exactly
> that: the W1-00 build reported `frames_differing_pct: 100` on a trace whose `rng.draws` was
> **0 on all 3,600 frames**, and this item's own `## How we lose` #8 predicted it. No
> threshold moves: the 5% figure, the 3-point weight and the hard-fail clause are unchanged.
> Implemented in `tools/harness/determinism.mjs` (R4) and swept in
> `tools/harness/seed-sweep.mjs`.

**M4 — R7 wall-clock invariance.** Run `cmb-spacing-hold` normally; then run it again with
a harness that sleeps 3 s between chunks (`--chunk 300` plus a host-side delay, or simply
run under heavy load). Hashes must match.

**M5 — R5 warm-up invariance.** Run `cmb-duel-infantry` with `warmupFrames` 30 and 90
(edit a scenario copy). Re-base **every absolute frame index** by subtracting the first
frame index in each — the trace carries three, not one: `f`, `events[].f` and
`enemies[].state_entered_f` — drop the `rng.draws` field, and compare the remaining records.
They must be identical. A re-based index that lands **before** the window opened normalises
to the sentinel `"pre-window"`: that it happened before the window is the only
warm-up-independent fact about it, and its exact index is a warm-up artefact by construction.

**Nothing else is excluded.** In particular `enemies[].anim_frame` is compared. A build whose
entities have free-running animation satisfies this rung by re-anchoring those clocks at the
frame the scripted window opens — a change to the **fixture**, declared and printed by the
run report — and not by omitting the field from the comparison.

> **Applied amendment `AM-W1-00-02`**, which withdraws and replaces `AM-W1-00-01`. See
> `orchestration/amendments/AM-W1-00-02-mth02-r5-absolute-frame-indices.md`. R5 failed on
> `arena_flat` **with no enemy at all**, on `events[].f` alone, which is a defect in the
> rung's re-basing instruction and has nothing to do with idle animations.

**M6 — R8 resolution invariance.** Run at `--width 1920 --height 1080` and
`--width 640 --height 360`. `body_sha256` must match: the simulation must not know the
viewport size.

**M7 — R9 save round-trip** (only if `saveState`/`loadState` are implemented). Run 1200
frames. Separately: run 600, `saveState()`, reload it into a fresh page, run 600 more.
Frames 601–1200 must match.

**M8 — Static evidence, advisory only.** Grep the shipped bundle for `Math.random`,
`Date.now`, `performance.now`, `new Date`, `deltaTime`, `elapsedTime`. Hits are a *lead*,
never a verdict; the trace hashes are the verdict. Record hits in the report so a builder
has somewhere to start.

## Scoring

| Rung | Points | Notes |
|---|---|---|
| R1 run-to-run | 4 | binary |
| R2 process-to-process | 4 | binary |
| R3 batch invariance | 3 | binary |
| R4 seed sensitivity | 3 | binary + the 5% frame-difference clause, taken excluding `rng.seed`, plus `max(rng.draws) > 0` (`AM-W1-00-C1`) |
| R5 warm-up invariance | 2 | binary |
| R6 documented load order | 1 | binary |
| R7 wall-clock invariance | 3 | binary |
| R8 resolution invariance | 2 | binary |
| R9 save round-trip | 2 | scored 0 and *excluded from the denominator* if `saveState` is absent |

Max 24 (22 without R9).

| Total | Verdict |
|---|---|
| 24 (or 22/22) | Meets the bar |
| 18–23 | Below bar — named remedy required |
| ≤ 17 | Loses outright |

**Hard fails, independent of total — any one voids the piece:**

- **R1 or R2 fails.** Nothing else in the corpus can be scored; every combat verdict from
  this wave is void and must be re-taken after the fix. This is the most severe finding a
  critic can make short of the game not booting.
- **R4 fails** (seed changes nothing): the AI's "randomness" is fake, and `RI-AI01` M4's
  coefficient-of-variation check is meaningless.
- **R3 fails**: `deltaTime` is in the simulation; every frame-data number in the wave is a
  measurement of the test machine.
- Any harness-mode page error naming `Math.random`.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 18 / 24 | 21 / 24 | 24 / 24 |

**Aggregation (a property of this item, not of the critic):** sum over the rungs, max 24 (22 without R9).

## How we lose

1. **`Math.random()` in the enemy strafe reseed.** The single most likely violation,
   because `RI-AI01` T11 explicitly asks for a randomised strafe timer and the obvious
   implementation is one character of `Math.random()`. It must be the seeded PRNG.
2. **Three.js `Clock`.** `new THREE.Clock()` and `clock.getDelta()` land in the update
   loop by copy-paste from every tutorial. R3 and R7 both fail.
3. **Physics library with an internal fixed step and an accumulator.** Even a "fixed step"
   physics engine driven by a variable accumulator will drift; it must be stepped exactly
   once per simulation frame.
4. **`Set`/`Map` iteration over entities.** Deterministic in V8 by insertion order, which
   sounds safe until entities are inserted in response to something time-dependent (asset
   load order, promise resolution order). Sort by `eid` before iterating; do not rely on
   insertion order.
5. **Async asset loading changing spawn order.** The world is deterministic only after
   `ready()` resolves; if `ready()` resolves before textures/models finish, spawn order —
   and therefore iteration order — varies with disk cache state. R2 catches it, but only
   intermittently, which makes it the nastiest bug on this list.
6. **Floating-point accumulation of `t`.** `t += 1/60` diverges from `frame/60` around
   frame ~10⁵; more importantly it differs between batch sizes. Derive time from the
   integer frame, always.
7. **Animation driven by wall clock** while gameplay is on the fixed step, so `anim_frame`
   in the trace is a float that varies between runs and every startup/active/recovery count
   is off by one, inconsistently.
8. **Seeding after world generation.** `loadState()` generates the world, *then*
   `setSeed()` runs — so the seed changes combat but not the world, and R4's 5% clause
   passes on a technicality while world generation is silently unseeded.
9. **"It's deterministic except for particles."** Cosmetic randomness is fine only if it
   can never touch a traced value. The moment a particle system contributes to a hit test
   or a camera shake that feeds a screenshot, it is simulation.
10. **Determinism achieved by removing all variation.** The over-correction: every enemy
    does the same thing every time, R4 fails, and the fights become memorisable rather than
    readable. Seeded variety is the target, not no variety.

## Provenance note

`provenance: constructed`. The ladder R1–R9, the point weights and the 5% seed-difference
clause are **defined for this project**. The `body_sha256` mechanism, the run/manifest
format and the `--chunk` batching flag are implemented in `tools/` and were exercised on
this machine: the two identical hashes quoted in §B are real output from
`tools/harness/trace.mjs` against `tools/harness/stub/index.html`, not an illustration.

The general principle (fixed timestep + seeded PRNG + scripted input ⇒ reproducible
replays) is standard practice in fighting-game and speedrun-verification tooling and in
lockstep multiplayer; no external numbers are borrowed and none are needed, because the
tolerance here is zero by construction.
