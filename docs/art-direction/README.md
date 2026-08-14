# `docs/art-direction/` — the look target, as numbers

**What this is.** The ranges a frame has to land in, derived from reference plates the corpus
already holds, so ten parallel builders aim at one look instead of ten. **What it is not:** a
score, a verdict, or anything a judging pack may contain. W1-30V judges; this directory only
publishes the target, and `validate-board.mjs` check C6 fails if a board artefact turns up in a
pack.

**Start here:** `board.json`. It is the machine-readable emission and it is the point of the whole
piece — a critic checks a frame against a range in it rather than against a paragraph. The two
prose halves, `ART.md` and `FIDELITY.md`, are generated from it and exist so a human can read the
same thing.

## The files

| file | what it is |
|---|---|
| `board.json` | **the target.** 104 rows, 92 set and 12 unset. Every set row names the plate paths it was read from and the statistic used. |
| `ART.md` | the art-direction half. Generated. Cites the 2002 plates and the negative anchor only. |
| `FIDELITY.md` | the fidelity half. Generated. Cites the modern plates only, HUD-free only. |
| `plate-metrics.json` | one row of raw statistics per measured plate — the layer everything above is a quantile of. |
| `measure-plates.mjs` | reads the plates, computes the statistics. Re-runnable. |
| `build-board.mjs` | turns the statistics into ranges. Contains no number that is a judgement. |
| `emit-docs.mjs` | writes `ART.md`, `FIDELITY.md` and this file from `board.json`. |
| `validate-board.mjs` | the gate: sourcing, bifurcation, the cc-scan, discrimination, consumers, quarantine — with four null controls. |

```sh
node docs/art-direction/measure-plates.mjs
node docs/art-direction/build-board.mjs
node docs/art-direction/emit-docs.mjs
node docs/art-direction/validate-board.mjs --self-test
```

## The consumer map — which child reads which rows

| child | rows | the rows that matter most to it |
|---|---|---|
| `W1-30E` | 53 | `ART-X2-CHROMA-P95*`, `ART-X4-SKY-FRACTION*`, `ART-X5-SKYLINE-RELIEF*`, `ART-X6-STRANGENESS-RAW*` |
| `W1-30C` | 49 | `ART-X2-CHROMA-P95*`, `ART-X2-CHROMA-FRAC*`, `ART-X3-PALETTE-BREADTH*`, `ART-X6-STRANGENESS-RAW*` |
| `W1-30A` | 44 | `ART-X1-VALUE-SPLIT*`, `ART-X2-CHROMA-P95*`, `ART-X2-CHROMA-FRAC*`, `ART-X3-PALETTE-BREADTH*` |
| `W1-30F` | 38 | `ART-X1-VALUE-SPLIT*`, `ART-X2-CHROMA-P95*`, `ART-X3-PALETTE-BREADTH*`, `ART-X4-SKY-FRACTION*` |
| `W1-30G` | 22 | `ART-X2-CHROMA-P95*`, `ART-X2-CHROMA-FRAC*`, `ART-X6-STRANGENESS-RAW*`, `ART-X6-STRANGENESS-LAYOUT*` |
| `W1-30B` | 20 | `ART-X1-VALUE-SPLIT*`, `ART-X4-SKY-FRACTION*`, `ART-X6-STRANGENESS-RAW*`, `ART-X6-STRANGENESS-LAYOUT*` |
| `W1-30D` | 8 | `ART-X1-VALUE-SPLIT*`, `ART-X2-CHROMA-P95*`, `ART-X2-CHROMA-FRAC*`, `ART-X6-STRANGENESS-RAW*` |

Every row names at least one consuming child.

**If you are W1-30F**, the row to read first is `ART-X5-SKYLINE-RELIEF` and then your region's
`ART-REG-SKYLINE-*`. A dead-flat horizon measures 0.000 on that statistic; the reference floor is
0.085 of frame height, and the per-region bands are ordered
by `landforms.json`'s own `measured_relief_range_m`, so the region declaring the most relief is
asked for the most skyline. Read `ART-X7-SEPARATION-RAW` before spending time on per-region colour:
it is unset, and the reason is a measurement.

**If you are W1-30E**, read the eight `ART-SET-*` blocks for your settlement and note that four
settlement rows are unset for want of plates rather than for want of a decision.

**If you are W1-30D**, the province-wide rows bind you — the saturation ceiling and the value
structure apply to a character in a frame exactly as they apply to a hillside — and
`FID-CHROMA-character_closeup` and `FID-DYNRANGE-character_closeup` are the profile bands for a
character shot.

## The gaps register — 12 rows this piece could not set

An unset row is a legitimate output. An invented row is the failure this piece exists to prevent.

| row | why | what would fill it |
|---|---|---|
| `ART-X7-SEPARATION-RAW` | the reference population cannot identify its own regions on this descriptor: leave-one-out 9.1% against 11.1% chance, Fisher 0.964 (inter-centroid p50 68.04 against intra p50 70.57). A separation floor read off a population that fails its own test is noise wearing a number. This is a measurement, not a decision: it is the same finding AM-W1-01-01 filed against RI-WLD04's A7 instrument, arrived at  | a descriptor on which the reference set identifies its own regions above chance, or a reference population large enough per region for the centroids to settle. Nine regions at 4-13 frames each is what refs/ holds. |
| `ART-SET-ROOFLINE-RELIEF-helstrom` | fewer than 3 measurable plates in the source population (n=2) | — |
| `ART-SET-SKY-FRACTION-helstrom` | fewer than 3 measurable plates in the source population (n=2) | — |
| `ART-SET-ROOFLINE-RELIEF-archon` | fewer than 3 measurable plates in the source population (n=1) | — |
| `ART-SET-SKY-FRACTION-archon` | fewer than 3 measurable plates in the source population (n=1) | — |
| `ART-SET-ROOFLINE-RELIEF-thorn` | fewer than 3 measurable plates in the source population (n=0) | — |
| `ART-SET-SKY-FRACTION-thorn` | fewer than 3 measurable plates in the source population (n=0) | — |
| `ART-SET-ROOFLINE-RELIEF-stormhold` | fewer than 3 measurable plates in the source population (n=0) | — |
| `ART-SET-SKY-FRACTION-stormhold` | fewer than 3 measurable plates in the source population (n=0) | — |
| `ART-SET-SILHOUETTE-RHYTHM` | The instrument finds a repeat period in only 51% of the reference frames it is run on. A target derived from half a population is not a target. The plan asked for "silhouette rhythm at 200 m"; the plates also cannot supply the 200 m — a screenshot has no depth channel, so no statistic here can be stated at a distance. | either a reference population framed at a declared camera distance, or a depth buffer alongside the frame. Neither exists in refs/. The rhythm can be measured on OUR frames at a known camera distance without any reference at all, and W1-30E can set its own baseline that way. |
| `FID-KEYFILL` | A key-to-fill ratio is the ratio of two named light sources. A screenshot contains their SUM. Recovering the ratio needs either a known probe object of known albedo in frame or the light rig itself, and refs/modern/ has neither. Every "key-to-fill" number derivable from these plates would be a lit-to-shadow luminance ratio wearing the wrong name, so the honest statistic ships under its own name as | a reference frame containing a grey sphere or chart of known albedo, or the light rig of a reference scene. Neither is acquirable from a screenshot population. |
| `FID-HORIZON-DISTANCE` | Metres are not in a screenshot. No plate in refs/ carries a depth channel, a camera intrinsic or a scale object, so no distance in metres can be read from any of them. The measurable consequence of a fog profile is the contrast falloff between foreground and far field, and that ships as FID-AERIAL-*. | a reference capture with a recorded depth buffer or a known-size object at a known distance. Our own build can supply both, so this row is fillable from OUR frames without any reference at all — W1-30B can set it from the engine and W1-30K should not. |

## What a critic should attack

1. **The three cross-cutting decisions are judgements** and they are the rows most worth attacking.
   The rest of the board is arithmetic in support of them.
2. **A board can be correct and wrong.** The mean of a reference population is arithmetic, not art
   direction. That risk is not fully guarded and saying so is part of the deliverable.
3. **The orderings.** Per-region bands take their values from the measured distribution and their
   ORDER from corpus-owned data. Every such row carries `judgement.ordering_source` and
   `judgement.would_overturn`, and every one is reversible in one line.
4. **The current-build column is mostly empty**, and the reason is on every row.
