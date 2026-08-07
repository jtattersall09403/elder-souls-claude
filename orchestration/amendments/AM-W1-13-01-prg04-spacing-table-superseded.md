# AM-W1-13-01 — `RI-PRG04` §5's spacing table is superseded by the built province

**Filed by:** the `W1-13` round-1 critic (`corpus/90-verdicts/wave1/W1-13-r1.json`)
**Status:** filing, not a resolution. `RI-PRG04` §5's counts are amended; **no spacing RULE changes.**
**Reason:** `corpus_hole` — a discrepancy that was correctly ruled and filed in the wrong place.

## What happened

`RI-JRN06`'s division-of-labour blockquote is binding: *"If this item and `RI-PRG04` ever disagree
on one of those numbers, `RI-PRG04` is authoritative and the disagreement is a corpus defect this
item must file, not resolve."*

The `W1-13` builder placed 29 sapwells by Dijkstra over a seconds-per-metre field derived from the
traversal rules, measured the built world, and found `RI-PRG04` §5's table disagrees with it:

| Quantity | `RI-PRG04` §5 declares | The built province measures |
|---|---:|---:|
| Critical path, traversed once, unopposed | 95 min | **56.91 min** |
| Regions | 6 | **13** |
| HEARTHs | 28 | **29** |
| Long axis of the world | ≈55 min | (crossing measured at 56.91) |

It filed this in `game/data/world/hearths.json.ri_prg04_table_discrepancy` and did **not** bend the
placement to fit the table. Both of those decisions are correct.

## The ruling

**`RI-PRG04`'s own provenance note settles it, and it settles it in favour of the map.**

> *"§5's spacing table is the one part of this corpus that cannot be validated without a real map.
> Every figure in it — 55-minute long axis, 95-minute critical path, 28 HEARTHs, 3.4-minute mean
> spacing, the 11-minute worst case — is a target handed to `corpus/50-world/`, not a measurement
> taken from it. When the world item lands with real traversal times, method 3 must be re-run and
> **this table amended rather than the map bent to fit it**. The spacing **rules** (2.0 min floor,
> 11 min ceiling, boss within 110 s) are the binding part; **the counts are derived and should move
> if the map says so.**"*

So: the world item has landed, method 3 has been re-run on real traversal times, and **the built
counts are authoritative over the declared counts.** The binding half — the spacing rules — is
unchanged and was measured to hold at all nine:

| Rule | Bound | Measured |
|---|---|---:|
| Total count | 24–32 | **29** |
| Absolute minimum between any two | ≥ 2.0 min | **2.10 min** |
| Consecutive on the critical path | 3.0–5.5 min | **3.07–3.98 min** |
| Mean critical-path spacing | 3.0–4.0 min | **3.51 min** |
| Any reachable point to its nearest HEARTH | ≤ 11.0 min | **10.42 min** over 22,068 walkable cells |
| Every boss fog gate to a HEARTH | 60–110 s | **84.0 s** and **85.8 s** |
| Every settlement with a merchant | exactly one, at the edge | **8/8**, 118 m off centre |
| Station keep-out (seam S7) | not a travel node | **90 m enforced**, 0 wells on a quay |

**Nothing in `RI-PRG04` is loosened by this filing.** The eleven-minute ceiling that a shorter
crossing might have been used to argue down is left exactly where it is, and the built world beats
it by 35 seconds rather than being measured against a relaxed one.

## Why this file exists at all

The builder's filing is inside `game/data/world/hearths.json` — the artifact the placement
produced. That is the right *content* in the wrong *place*: a reader who opens
`corpus/20-progression/RI-PRG04-hearth-and-death.md` §5 still sees **28 / 95 / 6** with nothing
pointing at the measurement that supersedes them, and the next agent to consume that table will
consume the stale numbers. `RI-JRN06` says the discrepancy must be *filed*; filing means the
corpus's own filing surfaces, not the data file that caused it.

## What the owner of `RI-PRG04` should do

1. Replace §5's per-region table with the built 13-region figures, or mark it `superseded by
   AM-W1-13-01` in place and cite `game/data/world/hearths.json.measured`.
2. Leave every row of the **spacing rules** table untouched.
3. Re-derive nothing else from the old counts: §7's death-cost model is keyed on `RI-PRG06`'s
   per-region soul banks, and re-basing it from 6 regions to 13 is `W1-16`'s work under
   `RI-PRG04` method 9, which has not been run against this build.

## Provenance

`measured`, confidence high. The built figures are from
`node tools/world/build-hearths.mjs` at commit `0a8a4d0`, recorded in
`game/data/world/hearths.json.measured`; the fog-gate distances, the station keep-out and the
29-well registry were spot-checked live against the running build by the `W1-13` critic
(`corpus/90-verdicts/wave1/artifacts/W1-13-r1/walked-loop.json`). The Dijkstra field itself was
**not** independently recomputed by the critic and that is stated in the verdict's
`method_deviations`.
