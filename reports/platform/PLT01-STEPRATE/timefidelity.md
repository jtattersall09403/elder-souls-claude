# RI-PLT01 §C.5 / M16 — world-time fidelity, measured on the shipped loop

**Task** `PLT01-STEPRATE` · **commit** `c5292f7` · **2026-08-08** · **verdict PASS**, exit 0
(checked directly, not through a pipeline)

Reproduce with `node tools/platform/timefidelity.mjs`. The JSON artifact beside this file is
untracked by `reports/.gitignore`'s rule — it is reproducible by re-running the tool, and this one
is the most reproducible artifact in the tree: **no browser, no GPU, no network, no scene**. It
drives the shipped `game/src/core/loop.js` from Node with a synthetic clock and a synthetic
`requestAnimationFrame`, so every number below is identical on a phone, on a workstation and on
SwiftShader. That is `RI-PLT01` §A Tier-S in the strong sense, and it is why the item's own rule
T1 does not bite here.

## The law

`world_time_fidelity = 1 − catchupDroppedMs / wall_ms`, predicted as
`min(1, MAX_CATCHUP × STEP_MS × raf_hz / 1000)` with the shipped `MAX_CATCHUP = 5`.

| rAF Hz | steps/rAF | fidelity | predicted | dropped ms/s | longest clamp run | law |
|---:|---:|---:|---:|---:|---:|:--|
| 60 | 1.000 | 1.0000 | 1.0000 | 0 | 0 | ok |
| 30 | 2.000 | 1.0000 | 1.0000 | 0 | 0 | ok |
| 20 | 2.998 | 1.0000 | 1.0000 | 0 | 0 | ok |
| 15 | 4.000 | 1.0000 | 1.0000 | 0 | 0 | ok |
| 12.5 | 4.798 | 1.0000 | 1.0000 | 0 | 0 | ok |
| **12.0** | 4.993 | **0.9990** | 1.0000 | — | 1 | ok |
| 11.5 | 5.000 | 0.9583 | 0.9583 | 41.67 | 1 | ok |
| 8 | 5.000 | 0.6667 | 0.6667 | 333.33 | 400 | ok |
| 4 | 5.000 | 0.3333 | 0.3333 | 666.67 | 400 | ok |
| **2.32** | 5.000 | **0.1933** | 0.1933 | **806.67** | **400 of 400** | ok |
| 1.5 | 5.000 | 0.1250 | 0.1250 | 875.00 | 400 | ok |

400 ticks per rate. Below the floor `steps_per_raf` is pinned at exactly 5.000 — the accumulator
cap — and the law is exact to 1e-9.

**P15** — 10 000 rAF ticks of 431 ms each in mode `harness` and in `play-instrumented`:
**0 sim steps, 0 clamps, 0 ms dropped** in both. rAF does not advance the simulation on the path
every probe in this project drives.

## Two floors, and 12.00 Hz is the cliff edge

A **single** tick clamps iff its arrears reach `(MAX_CATCHUP+1) × STEP_MS` = 100 ms = **10.00 Hz**.
A **sustained** rate keeps real time only at or above `MAX_CATCHUP × STEP_MS` = **12.00 Hz**,
because below that each tick leaves a residue, residues add up, and the clamp that eventually
fires **zeroes the accumulator and discards the lot**. S39's 12.00 Hz is the right number for the
right reason; the two floors are not interchangeable and a check written against the wrong one
passes at 11.5 Hz, where fidelity is already 0.9583.

At exactly 12.00 Hz, `STEP_MS = 1000/60` is not representable in binary and the arrears come to
99.9999999999999 against a nominal 100 — whether a tick clamps is decided in the last bits of a
double. Over 33.3 s: **one clamp, fidelity 0.9990**, on the line of P10's session bound.

## The null controls — all four red, each breaking the arm it was aimed at

Four mutants of the **shipped** source, one line each, written to the scratchpad (never into
`game/src` — RULES 17), with the `guards.js` import rewritten to an absolute URL so they share the
process clock. Each asserts its anchor text matched, so an edit that did not apply throws instead
of passing as an inert control.

| mutant | one-line edit | result |
|---|---|---|
| `leak` | the clamp branch stops zeroing the accumulator | **RED** — spiral; fidelity **−160.7** |
| `nocount` | `catchupDroppedMs` stops incrementing | **RED** — fidelity at 2.32 Hz reads a perfect **1.0000** while the world still runs at a fifth speed |
| `rafsteps` | `rafDrivesSim` returns true in every mode | **RED** — P15 fails, HF10's shape |
| `maxcatchup50` | `MAX_CATCHUP` 5 → 50 | **RED** — fidelity at 2.32 Hz **0.1933 → 1.0000** |

`nocount` is the one to read rather than count: **it is the state this project was in until §C.5
existed.** The counter was incrementing and nothing scored it, which is observationally identical
to not counting at all.

`maxcatchup50` **came out GREEN on run 1 and is reported, not quietly repaired.** `predicted` is
computed from the module's own `MAX_CATCHUP`, so the law self-adjusted and both arms were
byte-identical in behaviour — RULES 6's inert control exactly. It is also a true statement about
the law: **the law cannot detect a change to `MAX_CATCHUP`, because the constant sits on both
sides of it.** R3 and M8 own that constant and do catch it. The control kept the mutation and
changed what it is a control *for*: the headline number, which it establishes is caused by the cap
and not by the harness.

## Three defects in my own checker, and the false result each produced

Recorded here because each one would have been published as a finding:

1. **Run 1** defined fidelity as `simStepsTotal × STEP_MS / wall_ms`. That carries a
   window-boundary artefact — up to one `STEP_MS` of real time is sitting in the accumulator when
   the window closes, neither simulated nor dropped — which over 33 s pushed the 12.00 Hz row under
   P10's 0.999 line and produced a **false FAIL**. Fidelity is now defined on the counter.
2. **Run 2** asserted the clamp iff as a closed form, `arrears ≥ 6 × STEP_MS`, against a machine
   that is not doing real arithmetic. **Ten 1-ULP false violations at 12.00 Hz.** The predicate is
   now evaluated in the loop's own float order.
3. **Run 3** compared against the *nominal* rAF period rather than the `dt` the loop actually
   computed. A clock advanced by 60 nominal 16.666666666666668 ms steps reads back
   16.666666666666629 on the first tick — below `STEP_MS`, so zero steps run. **Three phantom
   violations at 60 Hz.** The checker now reads `loop.lastWallMs`.

## What this does not measure

P10–P13 and M17 are **Tier-H** and score `unmeasurable` = 0 until a run manifest attests real
hardware. The 11.6 steps/s of `reports/critic-w1-touch/critic-gate-wallclock.json` and the
7.8–9.0 of `reports/w1-touch-r2/framerate.json` were taken in this container on SwiftShader on a
shared box; under rule T1 they may not be reported as facts about a device, and "a phone at 11.6
steps/s" is the inference "How we lose" #5 exists to forbid. What survives with no device is the
conditional — *if* a device sustains an rAF rate below 12.00 Hz, *then* the world runs at
`MAX_CATCHUP × STEP_MS × raf_hz / 1000` of real time and nothing tells anyone — and that is P14,
and it is proved above.

Why the rate is low in the first place is **not** this piece's finding and was not re-measured
here: `W1-TOUCH-r2` is live and had already answered it (`orchestration/status/W1-TOUCH-r2.json`
A1–A5, `reports/w1-touch-r2/framerate.json`). Its answer, in short: the collapse is **not**
handheld-specific — the desktop control was worse than the phone — the mechanism is the render,
and neither the touch overlay nor device pixel ratio accounts for it.
