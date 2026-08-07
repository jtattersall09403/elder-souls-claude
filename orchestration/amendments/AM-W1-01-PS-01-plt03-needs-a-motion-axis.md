# AM-W1-01-PS-01 — `RI-PLT03` needs a motion axis: every streaming budget is defined at a walk

**Area:** `85-platform` · **Judges:** `platform.load.hitches` · **Reason:** `corpus_hole`
**Filed by:** `crit-w1-01-provstream-r1-3c19`, 2026-08-07, commit `8734986`
**Status:** filed, not applied. `RI-PLT03` is unchanged; this records the hole rather than working
around it.

## The hole

`RI-PLT03` §C.3 defines its two headline streaming budgets in terms of **walking**:

| # | Quantity | Budget |
|---|---|---|
| **S4** | `hitches_per_traversal_minute` — frames > 50 ms outside declared boundaries, **per minute of continuous walking** | ≤ 1.0 |
| **S7** | Prefetch lead time — region requested before the player can reach its border | ≥ **20 s of walking at `RI-WLD01` walk speed** |

Both are anchored to 2.0 m/s. Nothing in the item ever asks what the same streamer does at the
fastest speed the build can actually move a body.

## Why it matters here

This build's transport network (`RI-TRV01`) ships a `rootspeak` mode at **40 m/s** — twenty times
walking speed. Measured on `svc-065-rootspeak-helstrom-lilmoth`, 3,293.7 m, 4,940 fixed steps
(`corpus/90-verdicts/wave1/artifacts/W1-01-province-stream-r1/ride.json`):

| | walking | riding |
|---|---:|---:|
| steps over 50 ms | 38 / 14,689 | 273 / 4,940 |
| traversal minutes | 4.08 | 1.37 |
| **S4 — hitches per traversal minute** | **9.3** | **199** |
| max step | 144.23 ms | 674.76 ms |

Both fail S4. But a builder that reads the item, sizes its constants against the walk, and measures
the walk has done everything the item asks and has shipped a vehicle that stutters continuously.
That is exactly what happened: `Engine.STREAM_REFOCUS_M`'s own comment says *"one `request()` per 60
frames at the 2.0 m/s walk"*, and on a rootspeak it is one per **three** frames.

The same blindness applies to S7: 20 s of *walking* lead time is 40 m of road, which a rootspeak
covers in one second.

## Proposed amendment

1. **S4 and S7 are evaluated at `max_locomotion_speed`** — the fastest speed at which the build can
   move the player body under its own systems, taken from `getTravelNetwork().mode_detail` and the
   locomotion constants, not assumed. Report the speed alongside the figure.
2. **Add S4b:** the ratio `hitches_per_traversal_minute(max_speed) / hitches_per_traversal_minute(walk)`.
   A streamer that budgets by *metres* rather than by *frames* has a ratio near 1; one that budgets
   by frames has a ratio near the speed ratio. Here it is **21.4** against a speed ratio of 20 —
   which says, in one number, that the budget is per-frame and should be per-metre.
3. **M-L11's hitch census is run once per locomotion modality**, not once per session, and the item
   reports the worst.

## What this does not change

Nothing about the walking budgets, which are correct and which this build also fails. This is
additive: it closes the gap between "the item passed" and "the player was moving".
