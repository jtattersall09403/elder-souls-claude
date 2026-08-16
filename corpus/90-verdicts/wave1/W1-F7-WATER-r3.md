# W1-F7-WATER-r3 — the water surface, round 3

**Status: FAIL — not done, KEEP the change. Score 3 / 10 (pass 7), min over axes.**
RI-WLD10 **3** · RI-VIS04 **5** · RI-VIS03 **3**. Up from 2, and it moved for a real reason.

Machine-readable verdict: `W1-F7-WATER-r3.json`. Evidence: `artifacts/W1-F7-WATER-r3-critic/`.

---

## What the round did, and what I had to do to see it

The r2 verdict's `biggest_gap` was that **two of `RI-VIS04` §9's four MIN BAR components were absent
from the water shader outright** — depth-based colour and a shoreline depth fade. Round 3 built both
out of one mechanism: Beer–Lambert extinction over the water column depth, against the region's own
`k` from `game/data/world/water.json`.

**Both are delivered and both are real.** But the build could not demonstrate it, and reported its own
work as nearly inert, because **three rounds of F7 have been shot in the Deep Marshes — the one region
of thirteen where the feature cannot show.** `RI-WLD10` §8 gives it WCI **0.86**, class *drowned*,
`k = 4.5`, 0.67 m of visibility. There is no shallow water in the frame and no shoreline in any frame
any round has captured.

So I photographed a second region — **the Western Rootlands, `k = 1.9`** — for the first time in this
piece's history. Everything below is from there unless it says otherwise.

---

## The three results that decide the verdict

**1. The shoreline fade takes the waterline from 1 px to 15 px, and a dimmer cannot fake it.**

| arm | mean luma | gradient width |
|---|---:|---:|
| `prefix` (the round-2 shader) | 113.701 | **1** |
| `fixed` (round 3) | 106.607 | **15** |
| `no-shorefade` (depth colour alone) | 112.622 | 1 |
| **`null-const-trans` at matched luminance** | **105.251** | **1** |
| `nothing-restore-control` | 106.602 | 15 |

Top-down 120 m, one process, drift floor **0.009 %** on luma. The S52 null is pinned to a *constant*
transmittance tuned so it **over-reproduces the entire brightness change (118 % of it)** — and it
produces **none** of the width. Holds over a **pinned mask** at thresholds 4, 6 and 10.
This is the first F7 measurement in three rounds that a brightness change cannot reproduce.

**2. The depth-colour half is not inert — it is inert at `k = 4.5`.** The build's most self-damaging
number is `no-shorefade` reading 70.418 against 70.428 in the Deep Marshes, *inside* its own drift
floor. The same arm here moves luma **113.701 → 112.622 — about 120× the drift floor**, roughly 68×
the Deep Marshes effect.

**3. `k` reaches the fragment, and its colour response replicates in two regions.** Read off the live
materials in three of my own runs: `deep-marshes` 4.5, `eastern-rootlands` 3.2, `western-rootlands`
1.9, `stone-wastes` 1.4. Mean luma is monotonic in `k` in both regions.

**Falsified:** *gradient width* is **not** monotonic in `k`. The Deep Marshes series (5/7/13/19) is a
segment of a curve, not a law — here `k = 0.35` collapses back to **1**, because a fade needs partial
opacity to have a gradient. Half the build's headline does not survive a second region.

---

## The instrument defect that runs through all three rounds

**The water mask is derived per-arm** by differencing against a water-hidden frame. Round 3 is the
first round to touch **alpha**, so it is the first round where an arm moves its own mask — and then
the two arms are scored over *different pixel sets*.

At one pose (`eye-yaw000`) the fixed arm's mask grew **5.7 %**, and:

| | per-arm mask | pinned mask |
|---|---|---|
| `FresnelDelta` | +0.148 → **−0.145** (sign flip) | +0.148 → **+0.161** (small gain) |
| `ShoreDelta` | 0.024 → **0.093** (a first-ever pass) | 0.024 → **0.021** (still failing) |

The per-arm mask manufactured **both a catastrophic false regression and a spurious pass, in the same
frame pair.** Now required to be pinned — see below.

---

## What I corrected in the build, both directions

- **Up:** M12 `NormalEnergy` is reported as *"still not measured, a fourth round running"* while the
  round's **own JSON carries a number for it at 14 of 14 rows** — 0.076 to 0.342 against a band of
  ≥ 0.035. **It passes.** It runs at the seven close/eye poses round 3 added and is null only at the
  two poses earlier rounds used. *(Confound named: HFR cannot separate ripple from the dither stipple
  visible on both arms.)*
- **Up:** the colour half is not inert (above).
- **Down:** *"shore-close-c is the only one of the three with a real bank in it"* — **it has no bank.**
  I opened it. All three close-ups are shoreless; the partial retraction was itself too generous.
- **Down:** width is not monotonic in `k`; and the build's 3-vs-4-vs-5 width contrasts sit inside the
  measure's own ±2 drift and should not have been quoted as separating the null.

**The build's single best judgement:** it measured `ShoreDelta` *rising* at six of nine poses — a
number that agreed with it — and refused to quote it, because its fade makes shallow water take the
brighter bed colour. My pinned-mask control shows why that mattered: the un-pinned rise would have
been the round's first `≥ 0.03` pass and it was entirely an artefact.

---

## The bar, extended (CRITIC-DOCTRINE §1.3, ADD only)

`RI-VIS03` gains **§M12a — the declared pose set**. On *one unchanged shader*, `FresnelDelta` spans
**0.006 → 0.128** across seven Deep Marshes poses and **−0.090 → +0.155** in the Western Rootlands.
The `≥ 0.05` band is cleared at **5 of 7** poses **by the very arm round 2 was failed on at 0.04599,
"short by 0.004"**. That failure is correct arithmetic at the pose it chose and is not a judgement of
the shader.

M12a requires: ≥ 4 poses ≥ 90° apart, declared before measuring · every pose on its own line ·
**no mean over poses** · **a band is met only at the worst pose** · at least one `water_edge` pose with
a real boundary · a WCI rule for when a region has none · **and both arms scored over one pinned mask.**

It removes a degree of freedom and relaxes no threshold. **It is not the reason for any score here.**

---

## Why it still fails at 3

1. **The blind gate has never run — by anyone.** 102 items declare `blind_pair: yes`. The
   `blind_status: run` grep returns 1, and **that 1 is a false positive**: it matches the r2 verdict's
   own sentence saying the count is zero. Strict field form: **0**. The orchestrator owes this (rule 0e).
2. **M12 two-or-more sub-metrics fail at the `water_edge` shot**, in both regions — the item's own
   cap at 3, applied here for the first time.
3. **No depth-buffer read exists** (`grep` = 0, deliberately). `RI-VIS04` §9's HAVE names one, and also
   names refraction, velocity-driven foam and a scum/duckweed layer — none of which exists.
4. **`ShoreDelta` fails on both arms everywhere**; the r2 eye-level regression is not repaired.

---

## The single biggest gap

**`GAP-W1-F7-the-shoreline-fade-cannot-act-at-the-provinces-own-starting-k`.** The fade's width is a
function of *extinction*, so it vanishes in the region that needs it most: **1 px on both arms at every
Deep Marshes player pose, 15 px at `k = 1.9`.** The Deep Marshes is the starting region and the first
water anybody sees. Compounding it, `esDepthM` is inverted from a per-vertex quantity on province.js's
**12.5 m** lattice, clamped at **1.35 m**.

**Remedy, in F7's own file:** give the shoreline term a depth-driven component that does not vanish as
`k` rises — a shore band in *metres*, mixed with rather than replaced by the transmittance term.
Acceptance, paired: `gradient_width_px ≥ 12` at a declared `water_edge` pose **in the Deep Marshes**,
over a pinned mask at three thresholds, with the matched null reproducing **< 20 %** of it. Plus:
measure ≥ 2 regions; take one frame-time reading (three rounds have shipped with none); and run
`RI-VIS04` §8's supersample test so `NormalEnergy`'s pass can be told from dither.

---

## What I could not do

No blind gate (nobody can but the orchestrator) · no `TemporalVar`, a fourth round running · **my orbit
run was killed by my own timeout at 2.5 of 4 bearings — `eye-yaw180-fixed` and `eye-yaw270` do not
exist and no pair may be read from them** · no frame-time figure from me either · no transparency-sorting
test against province.js's wet-bank strip, which is the build's own overturn condition #3 and remains
the strongest untested argument against keeping · I did not write the dither-stipple reference item
(two critics have now named it) nor the HAZARDS entry for the arm-dependent mask, which is the most
reusable thing in this verdict and currently lives only where a water critic will find it.

**And the caveat my headline depends on:** `gradient_width_px` measures luma against distance from
*non-water*. In the Deep Marshes that is reed clumps, not a bank. In the Western Rootlands there are
real bunds and banks in frame — but I did not verify pixel-by-pixel that the near-shore bins sit on a
bank rather than a bund top, and province.js's `wet_mud` strip is not hidden by the mask build.
