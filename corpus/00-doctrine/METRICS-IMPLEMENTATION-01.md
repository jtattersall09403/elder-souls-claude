# METRICS-IMPLEMENTATION-01 — RI-VIS03 is now an instrument

**Agent:** `vis-metrics`. **Date:** 2026-08-06. **Brief:** `orchestration/briefs/vis-metrics.md`.
**Implements:** `corpus/70-visual/RI-VIS03-fidelity-image-metrics.md` (M1–M12).
**Supersedes as the statement of what the harness computes:** `refs/ACQUISITION-REPORT.md` §13.2.
**Does not edit RI-VIS03.** Every band change in §7 is a *proposal*, per the brief and per
RI-VIS03's own guard ("threshold amendments require three measured modern reference frames as
evidence and cannot be made by the critic judging that wave").

---

## 1. The headline

Before this task, of RI-VIS03's twelve metrics **two** (M1, and loosely M4) could be calibrated
by any reference image. **All twelve are now implemented, and eleven of them return numbers on a
still image today.** M11 is temporal and returns numbers on a supplied frame sequence; M12 returns
numbers on a supplied `WATER_MASK`. Neither fakes a single-frame proxy — RI-VIS03's contract for
"we cannot measure this" is now a first-class output rather than a silence.

Three things were not merely missing but *wrong*, and each has been fixed:

| Was | Now |
|---|---|
| No `FG_MASK`. Every band that RI-VIS03 says excludes sky included it, by a different amount per frame. | `SKY_MASK` / `FG_MASK` / `SHADOW_MASK` / `LIT_MASK` per RI-VIS03 §0, emitted as PNG artefacts on request, with the detector used recorded on every image. |
| M5's FFT ran on a 256×256 box-downscale of the whole frame — so it measured the resampler, was resolution-dependent, and made 320 px 2002 screenshots score as *better anti-aliased* than 1440p Witcher 3 frames. | M5 runs on a **native 1024² crop**. An image smaller than that is reported `unmeasurable` with a reason. **The impossible result is gone, and §7 withdraws the amendment that was proposed to accommodate it.** |
| M8's two HARD FAIL statistics, `FS_score` and `LargestFlat`, were computed by nothing at all — and M8 is the metric that caps the whole FIDELITY score. | Both implemented to the letter (3×3 median → 6×6×6 RGB cube → area-weighted within-bin σ(Yp); 9×9 local σ < 0.008 → 4-connected components), with the offending component's bounding box and mean colour reported so a builder can find the object. |

And the instrument can now **fail**: `tools/metrics/self-test.mjs` asserts 25 behaviours and
every one holds. §6.

---

## 2. What was delivered

| File | What |
|---|---|
| `tools/metrics/lib/decode.mjs` | PNG / JPEG / AVIF / WebP → RGBA8. Pure JS + wasm, no native build, no system binaries. Removes ACQUISITION-REPORT §9's "decode everything to PNG in a scratch directory first" step — the tool now reads `corpus/70-visual/refs/` directly. |
| `tools/metrics/lib/vis03.mjs` | §0 preprocessing (sRGB, Yp, Ylin, CIELAB), the masks, and M1–M12 as pure functions. |
| `tools/metrics/lib/battery.mjs` | Bands per profile, pass/fail, named hard-fail diagnoses with the RI-VIS04 remedy, M8 `AT DEFAULT`, and RI-VIS03 §Scoring including its absolute caps. |
| `tools/metrics/image-metrics.mjs` | CLI. Schema `elder-souls/image-metrics@2`. |
| `tools/metrics/self-test.mjs` | 25 assertions. Exit 20 if any fails. |

`tools/package.json` gains `jpeg-js`, `@jsquash/avif`, `@jsquash/webp`. All three install with no
compilation. (Note for a successor: `@jsquash`'s default entry points `fetch()` their wasm and
fail under Node; `decode.mjs` loads the `.wasm` off disk instead.)

**Backwards compatibility is preserved.** `tools/run-all.mjs:112` and `HARNESS.md` §464 call
`--in <dir> --out <json>`; that still works, and every schema-v1 per-image block
(`luminance`, `dynamic_range`, `rms_contrast`, `saturation`, `edge_density`, `flat_shading`,
`sky_gradient`) is still emitted at the top level so `refs/reference-metrics.json` remains
comparable. Each of those blocks now carries a `note` saying which RI-VIS03 metric supersedes it.
The v1 `fft` block is **not** emitted any more: it was the 256² downscale, and continuing to
publish it would invite someone to cite it.

```bash
# the normal call
node tools/metrics/image-metrics.mjs --in shots/w03 --profile exterior_daylight \
  --anti refs/anti/threejs-default.png --out out/w03.metrics.json --masks-out out/w03/masks

# temporal metrics
node tools/metrics/image-metrics.mjs --in shots/w03/dolly/frame_000.png --profile exterior_daylight \
  --sequence shots/w03/dolly --stationary shots/w03/still_a.png,shots/w03/still_b.png \
  --displacements shots/w03/dolly/displacement.json

# water
node tools/metrics/image-metrics.mjs --in shots/w03/water_edge.png --profile exterior_daylight \
  --water-mask shots/w03/water_edge.mask.png --sequence shots/w03/water_still

node tools/metrics/self-test.mjs          # exit 0 = the instrument is trustworthy
```

---

## 3. Metric-by-metric status

| Metric | Status | Notes |
|---|---|---|
| **M1** Luminance / DR | **complete, extended** | `DR`, `occupancy`, `blown`, `crushed`, `mean_Yp`, `skew`, `P1/P50/P99`, 256-bin histogram, all three named fail rules including the sRGB-encoding diagnosis. **Adds `stops`** — log₂ of the linear-luminance p99.5/p0.5 ratio — per the brief. |
| **M2** RMS contrast | **complete, corrected** | Now `stddev(Yp[FG_MASK])` and the **median** of **32×32** tiles *fully inside* FG_MASK (v1: mean of 16×16, whole frame). Reports the flattest tile's centroid for the `C_local_p10` fail as RI-VIS03 requires. |
| **M3** Colour | **complete, replaced** | **CIELAB**, D65, via linear sRGB → XYZ → Lab. `meanC`, `p95C`, chroma-weighted 36-bin hue entropy `H_hue`, `chroma_frac`. v1's HSV saturation is retained only in the deprecated block. |
| **M4** Edge density | **complete** | `ED_1`, `ED_2`, `ED_4` and **`scale_ratio`** (absent in v1 — it is the guard against passing M5/M2 by adding film grain). Over FG_MASK. |
| **M5** Spectrum | **complete, fixed** | Hand-rolled radix-2 2D FFT on a Hann-windowed **native 1024²** crop; RI-VIS03's exact band edges `[0.004,0.05) [0.05,0.20) [0.20,0.45) [0.45,0.50)`; `alpha` from a log–log fit over f∈[0.02,0.40]. If the centre crop is >90% sky the window slides down and records `crop_shifted`; if no window qualifies, `unmeasurable`. **Never resamples.** |
| **M6** Shadow retention | **complete except M6b** | `retention`, chroma-weighted circular `hue_offset`, `shadow_frac`, `C_shadow`, plus the "no shadowed region" hard fail. **M6b (contact shadow) is `unmeasurable`** — see §5. |
| **M7** Sky gradient | **complete + 2 gates** | RI-VIS03's connected-component sky detector, `dY/dC/dH_sky`, `BI`, `sky_noise`. Two additions on measured evidence: a recorded stage-B detector fallback and a vertical-extent gate — §7 amendments **M7-detect** and **M7-span**. |
| **M8** Flat shading | **complete — was entirely absent** | `FS_score`, `LargestFlat`, `TotalFlat`, largest-component bbox + mean RGB, and the `AT DEFAULT` triple against `--anti`. |
| **M9** Tonemapping | **complete + 1 gate** | `ClipFrac`, `ShoulderRatio`, `HighlightDesat`, `BloomHalo` (chamfer distance transform → 12–40 px annulus), `VeilIndex`, and all three combined diagnosis rules. Gate: amendment **M9-shoulder**. |
| **M10** Aerial perspective | **single-image proxy complete; two-capture form not possible** | `R_aerial`, `dY_depth`, `dC_depth` over the far/near bands. The FogDelta two-capture upgrade needs the harness to drive the engine with fog off — not computable from a supplied image. §5. |
| **M11** LOD pop | **complete on a sequence; `unmeasurable` on a still** | `--sequence <dir>`. Animated-region mask from `--stationary a,b` (reports `ANIMATED_MASK_EMPTY` when the pair is identical, per RI-VIS03). Displacement gating applied only if `--displacements` is supplied; otherwise the output says in words that it over-counts. |
| **M12** Water | **complete on a supplied mask; `unmeasurable` without one** | `FresnelDelta`, `NormalEnergy` (M5's HFR on the largest square window inside the mask), `ShoreDelta`, `ReflCorr`, `TemporalVar` (needs `--sequence`). The "any two failing = blue plane" rule and its cap at 3. |

**Every statistic emits `{value, unit, profile, measurable, reason, band, pass}`.** `value` is
`null` whenever `measurable` is false, and `reason` names the obstacle in a sentence. Metrics that
are profile-skipped or unmeasurable are **excluded from the score denominator** and listed in
`verdict.skipped` / `verdict.unmeasurable`, so RI-VIS03's "skipped metrics counted as passes"
failure mode is not expressible. Self-test T10/T10b/T10c assert exactly this.

---

## 4. Two deliberate deviations from the letter of RI-VIS03

**1. The Sobel magnitude is normalised by 4** (so a 0→1 step edge gives `G ≈ 1`). RI-VIS03's M4
writes the raw convolution, which would put the same edge at `G ≈ 4` and make the `0.08` threshold
mean something four times weaker. The pre-existing harness used `/4`, and the acquisition report's
measured `ED_1 = 0.172–0.320` — the *only* evidence that M4's `0.10–0.34` band is roughly right —
was measured on that scale. Changing it would silently invalidate the project's one piece of M4
calibration. Documented in `vis03.mjs`.

**2. Profile is inferred rather than refused when `--profile` is absent.** RI-VIS03 §0c says the
harness refuses to run without a declared profile. `tools/run-all.mjs` does not pass one. Rather
than break the runner, the tool infers from the containing directory or filename and sets
`verdict.admissible: false` with the reason. **The numbers are real; the grade is not admissible
in a verdict.** This preserves RI-VIS03's anti-laundering intent without a hard stop.

---

## 5. What could not be implemented, and why

Each of these returns `measurable: false` with the reason below, never a substitute number.

| Not implemented | Reason |
|---|---|
| **M6b — contact shadow** | Needs the character's silhouette-to-ground contact band, i.e. an object-id / debug render pass. Not recoverable from pixels alone, and any "find the dark band under the tallest thing" heuristic would be a guess dressed as a measurement. |
| **M10 two-capture `FogDelta`** | Requires capturing the same pose with fog disabled. The harness must drive the engine; a supplied JPEG cannot provide it. The single-image proxy runs, and §7 proposes demoting it to advisory because it does not discriminate. |
| **M5's supersampled differential** | RI-VIS03's own distinguisher for `NYQ_ratio > 0.30` ("compute on a 2× supersampled capture; if it collapses it is AA/mip, if it persists it is geometry aliasing") needs a second capture from the engine. The fail message names it as the follow-up. |
| **M11 displacement gating without `--displacements`** | RI-VIS03 gates a POP on camera displacement < 0.07 m. An image sequence carries no camera telemetry. Without the file, every large inter-frame change is counted and the output says so in words. |
| **M12 `WATER_MASK`** | RI-VIS03 itself says this comes from an object-id pass or a hand-marked polygon. No mask, no M12. |
| **M11 / M12 on the current reference set** | `refs/video/` is empty (ACQUISITION-REPORT §2). All 89 Morrowind and 25 modern files are stills. Both metrics report `unmeasurable` on all 114. |
| **Determinism assertion (double-capture sha256)** | RI-VIS03 §0b makes this a precondition of the whole battery. It belongs to the *capture* harness, not to a metric tool that is handed bytes. The battery's own determinism is asserted (T12). |

---

## 6. The self-test — what it proves the instrument can detect

`node tools/metrics/self-test.mjs` → **25/25 assertions hold** (49 s). Synthetic images are
generated from a fixed LCG seed, never `Math.random()`.

| # | Assertion | Measured |
|---|---|---|
| T1 | M3 is CIELAB, not HSV | neutral ramp `meanC = 0.000007`; saturated red `meanC = 84.93` |
| T2 | FG/SKY masks separate sky from world | detected `SKY_MASK = 42.0%` against a ground truth of 42.0% |
| **T3a** | **M5 detects anti-aliasing at fixed resolution** | same scene at 1280², no AA `NYQ_ratio = 0.131` vs 4× supersampled `0.060` — **2.18×** |
| **T3b** | **a downscale cannot out-score a native frame — M5 refuses it** | box-downscaled to 640², `M5.measurable = false` |
| **T3c** | on the real set: 320 px 2002 previews yield **no** M5 number; native 1440p frames do | mwscr 320×320 → refused; Witcher 3 2560×1440 → `NYQ_ratio = 0.124` |
| T3d | M1 `stops` separates the eras | mwscr 7.49 stops vs Witcher 3 next-gen 11.87 stops |
| T4 | M8's two hard-fail statistics exist at all | `FS_score` and `LargestFlat` both returned |
| **T5** | **a synthetic flat-shaded render HARD FAILS M8** | `FS_score = 0.0001` (fail < 0.018), `LargestFlat = 0.473` (fail > 0.15) |
| T5b | an M8 hard fail drives the shot to 0 | `score = 0`, cap 0 applied |
| **T6** | **a synthetic uniform-colour sky HARD FAILS M7** | `dY_sky = 0`, `dC_sky = 0` → FLAT SINGLE-COLOUR SKY |
| T6b | the same frame does **not** hard-fail M8 | M8 measures FG_MASK only; flat sky ≠ flat world |
| T7 | a dithered gradient sky over textured ground does **not** hard-fail M7 or M8 | `dY_sky = 0.301`, `BI = 0.87`, `FS_score = 0.045` |
| T7b | the stage-B sky detector fires **and is recorded** | `sky_frac = 0.420`, detector string names the substitution |
| T8 | M6 `hue_offset` separates one-light from key+fill | one white light `0.27°` vs warm key + cool fill `166°` |
| T8b | a one-light frame is capped at 4 | `score = 3.89` |
| T9 | M9 fires on a linear clamp | `ClipFrac = 0.197` → HARD CLIPPING, NO SHOULDER |
| T10 | 60 statistics all carry `{value, unit, profile, measurable, reason}`; none is a number that was not computed | 0 violations |
| T10b | M11/M12 report `unmeasurable` on a still rather than a proxy | reasons name `--sequence` and `WATER_MASK` |
| T10c | skipped/unmeasurable are excluded from the denominator | `runnable` excludes M11, M12 |
| T11 | M11 finds one LOD pop in a 6-frame sequence, and only one | `pops = 1`, `worst_pop = 0.0061` for a 40×40 object in 512² |
| T12 | the battery is bit-deterministic | identical JSON on repeat |
| T14 | M12 calls a uniform blue plane a blue plane, and does not call a rippled reflective surface one | plane: 3 fails; rippled: 1 fail |
| T14b | `TemporalVar` stays unmeasurable without a stationary sequence even when the mask is supplied | — |
| T13 | a **real** current-generation frame does **not** hard-fail M8 | Witcher 3 `FS_score = 0.0445`, `LargestFlat = 0.028` |
| T13b | and its M5 runs on a native 1024² crop | `native 1024x1024 at (768,208)`, `resampled: false` |

The three the brief asked for are **T3b/T3c** (a downscale must not score as better
anti-aliased than a native one), **T5** (a synthetic flat-shaded render trips M8) and **T6** (a
synthetic uniform-sky image trips M7). T7, T6b and T13 exist because an instrument that only
fails is as useless as one that only passes.

---

## 7. Proposed amendments to RI-VIS03's bands

### 7.0 Read this before adopting any of it

The evidence below is **one population: 24 Witcher 3 next-gen 1440p frames from a single
capture session by a single operator, every one of which carries a HUD.** The acquisition
request's §5a bars `modern/hud/` from numeric comparison, and the HUD occupies ~4% of frame area
with synthetic maximum-contrast geometry that biases `M4.ED_1`, `M2.C_local` and `M8` **upward**.
There is exactly **one** HUD-free modern frame in the whole repository (the RDR2 REF-M6), and it
is used below as an independent check, not as a population.

RI-VIS03's own calibration procedure asks for **≥ 3 legally-usable modern frames per profile**
and sets each band to `[p10, p90]` of that population. **Only `exterior_daylight` has any
population at all. No amendment below applies to `exterior_lowlight`, `interior_darkemissive`
or `character_closeup`, and none should be made to those rows until Codex's set lands.**

So: these are **proposals with their evidence attached**, in the form RI-VIS03 §Comparison
method step 7 demands. Adopt A1–A3 and the two withdrawals now (the direction is unambiguous and
independently confirmed); hold the rest for Codex's set.

### Measured populations

`exterior_daylight`, n = 24 (Witcher 3 next-gen, 2560×1440, HUD-bearing) — p10 / p50 / p90:

| Statistic | RI-VIS03 band | p10 | p50 | p90 | RDR2 (HUD-free, n=1) |
|---|---|---|---|---|---|
| `M1.DR` | ≥ 0.72 | 0.772 | 0.860 | 0.919 | 0.871 |
| `M1.mean_Yp` | 0.28–0.58 | **0.234** | 0.307 | 0.412 | 0.347 |
| `M1.stops` | *(not in spec)* | 9.51 | 11.07 | 16.29 | 10.62 |
| `M1.blown` | ≤ 0.05 | 0 | 0.0001 | **0.0012** | 0.0003 |
| `M1.crushed` | ≤ 0.10 | 0.0003 | 0.0036 | **0.0116** | 0.0021 |
| `M1.occupancy` | ≥ 0.80 | 0.857 | 0.955 | 1.000 | 0.922 |
| `M2.C_global` | 0.13–0.28 | 0.187 | 0.222 | 0.278 | 0.235 |
| `M2.C_local_med` | ≥ 0.045 | 0.0632 | 0.0781 | 0.1035 | 0.0578 |
| `M2.C_local_p10` | ≥ 0.012 | 0.0137 | 0.0187 | 0.0356 | 0.0091 |
| `M3.meanC` | 12–32 | **9.50** | 13.32 | 17.99 | **6.27** |
| `M3.p95C` | ≥ 45 | **25.4** | 32.9 | 43.9 | **16.4** |
| `M3.H_hue` | 2.0–4.2 | 2.87 | 3.24 | 4.07 | 2.42 |
| `M3.chroma_frac` | ≥ 0.55 | **0.417** | 0.587 | 0.699 | **0.325** |
| `M4.ED_1` | 0.10–0.34 | 0.190 | 0.261 | 0.344 | 0.177 |
| `M4.scale_ratio` | 0.35–1.10 | **1.052** | 1.297 | **1.679** | **1.469** |
| `M5.HFR` | 0.06–0.24 | **0.044** | 0.085 | 0.144 | 0.073 |
| `M5.NYQ_ratio` | ≤ 0.18 | 0.064 | 0.082 | **0.123** | 0.093 |
| `M5.alpha` | 1.6–2.6 | **1.951** | 2.367 | **2.701** | 2.328 |
| `M6.retention` | ≥ 0.60 | **0.250** | 0.434 | 0.679 | **0.266** |
| `M6.hue_offset` | ≥ 15° | **9.96** | 62.8 | 171.3 | **10.07** |
| `M6.C_shadow` | ≥ 6 | **1.69** | 2.44 | 5.54 | **3.24** |
| `M8.FS_score` | ≥ 0.035 | 0.0362 | 0.0460 | 0.0589 | 0.0443 |
| `M8.LargestFlat` | ≤ 0.06 | 0.0040 | 0.0161 | 0.0535 | 0.0768 |
| `M8.TotalFlat` | ≤ 0.18 | 0.0508 | 0.0964 | 0.1499 | 0.2448 |
| `M9.ClipFrac` | ≤ 0.02 | 0 | 0.0001 | 0.0008 | 0.0003 |
| `M9.HighlightDesat` | ≤ 0.85 | 0.326 | 0.863 | **1.569** | 0.356 |
| `M9.BloomHalo` | 0.010–0.09 | 0.0123 | 0.0807 | **0.157** | 0.0334 |
| `M9.ShoulderRatio` | 0.25–1.10 | **0.0082** | **0.0616** | 0.351 | **0.0233** |
| `M9.VeilIndex` | ≤ 0.10 | 0.0037 | 0.0100 | 0.0181 | 0.0117 |
| `M10.R_aerial` | 0.25–0.70 | **0.691** | **1.424** | **2.828** | *(skipped)* |
| `M10.dC_depth` | ≤ −3 | −12.3 | **+0.43** | **+7.40** | *(skipped)* |

**M7 is measured on the 15 of 24 frames that pass the vertical-extent gate** (amendment M7-span;
the other 9 are recorded SKIPPED, never passed): `dY_sky` **0.0113 / 0.0672 / 0.1595**,
`dC_sky` 1.58 / 4.83 / 19.13, `dH_sky` 1.83° / 9.90° / 125.8°, `BI` 0.74 / 1.32 / 2.39,
`sky_noise` 0.0045 / 0.0065 / 0.0091, `sky_span_frac` 0.210 / 0.281 / 0.449,
`dY_per_span` 0.053 / 0.219 / 0.494. **Before the gate, 6 of 24 real frames hard-failed
`dY_sky < 0.02 AND dC_sky < 2` → FLAT SINGLE-COLOUR SKY. After it, none do.**

Bold = outside the RI-VIS03 band. The Morrowind contrast population (n = 89, 320 px AVIF,
`pixel_metrics_valid: false` — a *contrast* population, never a target) is in §7.4.

### 7.1 Adopt now — the direction is unambiguous

**A1. `M1 mean_Yp` floor 0.28 → 0.23 (`exterior_daylight`).** Measured p10 = 0.234; ~25% of
genuine current-gen daylight frames fail the band as written. This confirms ACQUISITION-REPORT
amendment 1 with the same statistic (M1 is whole-frame in RI-VIS03, so the two measurements are
directly comparable). Propose **0.23 – 0.50**.

**A2. `M1 blown` 0.05 → 0.005 and `M1 crushed` 0.10 → 0.03.** Measured p90 = 0.0012 and 0.0116.
As written neither can fire on anything short of a wholly broken renderer, which makes them
decorative. The proposal leaves 4× and 2.6× headroom over the measured p90. Confirms
ACQUISITION-REPORT amendment 2.

**A3. Add `stops` to M1's reported set, band ≥ 9.0.** Modern p10 = 9.51 (n=24) and the HUD-free
RDR2 frame = 10.62; the 2002 population's p90 = 8.32 (n=89). **No overlap, on the corrected
instrument.** This is the single most discriminating statistic in the corpus and it costs one
`log2`. Implemented and reported today.

### 7.2 Withdraw — these were artefacts of the broken instrument, not band errors

**W1. ACQUISITION-REPORT amendment 5 (`M5 NYQ_ratio ≤ 0.18` "is simply wrong") is WITHDRAWN.**
Measured on a native 1024² crop, `NYQ_ratio` is **0.064 – 0.123** (p90 0.123) across 24 real
1440p frames and 0.093 on the RDR2 frame — comfortably inside the band as written. The reported
0.363–0.465, and the impossible inversion in which 2002 previews measured *better* anti-aliased
than 1440p frames, were **entirely** the 256×256 box-downscale. **The band was never broken; the
instrument was. Do not relax M5 `NYQ_ratio`.** RI-VIS03's guessed 0.18 was a good guess.

**W2. ACQUISITION-REPORT amendment 3 (`M7 dY_sky` 0.06 → 0.15) is WITHDRAWN.** It rested on a
measured p10 of 0.248 — but that number was `sky_gradient.row_mean_range`, the luminance range of
the **top 40% of all rows**, which in a forest frame is mostly trees. With a real `SKY_MASK` the
same 24 frames measure `dY_sky` p50 ≈ 0.03. Raising the floor to 0.15 would have failed the large
majority of genuine modern frames. **A band amendment computed from the wrong statistic is worse
than no amendment**; this one would have hard-coded the instrument bug into the corpus.

### 7.3 Instrument amendments — defects in RI-VIS03's own definitions

These three are not band changes; they are places where the *formula* produces a wrong answer on
real frames. All three are implemented, and in every case the substitution is **recorded in the
output** so it is never silent.

**M7-detect — the sky detector cannot see a gradient sky.** RI-VIS03 M7 §detect requires the sky
candidate to satisfy `Yp > P60(Yp)` *over the whole frame* **and** the chosen component to touch
row 0. Any sky whose zenith is darker than the frame's 60th percentile — every dawn/dusk gradient,
and any daylight sky over bright ground — has no candidate pixel in row 0, so no component touches
row 0, `SKY_MASK` comes back empty, and M7 records itself SKIPPED. **This is the worst possible
failure: the sky is visible, the detector missed it, and the frame is penalised for nothing.**
*Proposed wording:* if the literal rule yields `sky_frac < 0.02`, retry without the luminance gate,
requiring instead that the component span ≥ 50% of the frame width. Record which stage produced
the mask. (Implemented; `masks.sky_detect` on every image. Self-test T7b.)

**M7-span — `dY_sky` is meaningless over a short band.** `dY_sky` is a difference between the top
sky row and the horizon row. RI-VIS03 gates M7 on *area* (`sky_frac ≥ 0.02`), which a wide thin
sliver of sky between trees passes — and over 20 rows the difference is necessarily tiny, so
"`dY_sky < 0.02 AND dC_sky < 2` → FLAT SINGLE-COLOUR SKY" fires on a real sky. *Proposed wording:*
add `SKY_MASK` vertical span ≥ 0.15·H to the M7 precondition, and report `dY_per_span =
dY_sky / span_frac` alongside `dY_sky` so short and tall skies are comparable. (Implemented.)

**M9-shoulder — `ShoulderRatio` is a ratio of two near-empty bins, *and* its threshold points
the wrong way.** `|Yp∈[0.90,0.996)| / |Yp∈[0.75,0.90)|` describes the shape of a highlight
roll-off. On a frame with almost nothing above 0.75 it is a ratio of two tiny counts and reports
noise, so the gate below is necessary. *Proposed wording (implemented):* compute `ShoulderRatio`
only when `|Yp ≥ 0.75| / N ≥ 0.02`; otherwise report it unmeasurable. `M9.highlight_frac` is
reported so the gate is auditable.

**The gate is not sufficient, and this is the important part.** With it applied, **17 of 24 real
Witcher 3 frames still "hard fail" `ShoulderRatio < 0.12 → LINEAR CLAMP`** (measured p10 0.008,
p50 0.062, p90 0.351), and not one of them is a linear clamp. The threshold assumes a filmic
shoulder puts *more* pixels in `[0.90,0.996)`; in real graded frames it puts *fewer*, because the
curve compresses the whole highlight region downward. **The premise of the fail rule is inverted.**
This is a band question, not an instrument one, so it is filed in §7.4 rather than fixed here —
but no verdict should cite `M9.ShoulderRatio` as evidence of anything until it is resolved.

### 7.4 Hold for Codex's set — measured, but on a barred population

Each of these has a band that a majority of the reference population fails. That is prima facie
an instrument or band error rather than 24 bad frames, but the population is HUD-bearing and
n = 24 from one game, so these are **flagged, not proposed for adoption**:

| Band | Measured | Comment |
|---|---|---|
| `M6 retention ≥ 0.60`, hard fail `< 0.30` | p10 0.250, p50 0.434; RDR2 0.266 | 5/24 + the one HUD-free frame **hard fail**. RI-VIS03 calls this "crushed blacks / no IBL" — it is firing on frames that demonstrably have IBL. Likely candidates: `≥ 0.25` with hard fail `< 0.12`. |
| `M6 C_shadow ≥ 6` | p10 1.69, p50 2.44; RDR2 3.24 | 15/24 outside band. CIELAB C* in a shadowed quarter is genuinely low. Likely `≥ 1.6`. |
| `M6 hue_offset ≥ 15°` | p10 9.96, p50 62.8 | Likely `≥ 10°`. **Keep the `< 6°` hard fail** — self-test T8 shows it cleanly separates one-light from key+fill (0.27° vs 166°). |
| `M3 p95C ≥ 45` | p10 25.4; RDR2 16.4 | 22/24 outside. Likely `≥ 24`, and the `< 20` "dead render" hard fail probably belongs nearer `< 9` (the 2002 population's p10 is 9.3). |
| `M3 meanC 12–32`, `chroma_frac ≥ 0.55` | 9.5–18.0; 0.417–0.699 | Likely `8–24` and `≥ 0.40`. RI-VIS03's own M3 note (low chroma inside band is correct for a muted art direction) argues for the low floor. |
| `M4 scale_ratio 0.35–1.10` | 1.052–1.679; RDR2 1.469 | 19/24 outside. The band assumed edge density *falls* on downsample; with a fixed threshold it **rises**, because downsampling concentrates contrast. Likely `0.35–1.90`. **Keep the `< 0.22` alias-storm hard fail** — that is the anti-grain guard and nothing real trips it. |
| `M5 HFR ≥ 0.06`, `alpha 1.6–2.6` | 0.044–0.144; 1.951–2.701 | Likely `≥ 0.045` and `1.9–2.8`. |
| `M7 dY_sky ≥ 0.06` (post-gate) | p10 0.0113, p50 0.0672 | RI-VIS03's floor now sits almost exactly on the measured **median**, so ~half of real skies fall below it. Likely `≥ 0.02`, or better, band `dY_per_span ≥ 0.06` (measured p10 0.053), which is the span-normalised form and is comparable between a full-height sky and a sliver. **Keep the `dY_sky < 0.02 AND dC_sky < 2` conjunction as the hard fail** — self-test T6 shows it catches a flat `scene.background` and T7 shows it clears a real gradient. |
| `M9 ShoulderRatio 0.25–1.10`, hard fail `< 0.12` | p10 0.008, p50 0.062, p90 0.351 | **17/24 hard fail on frames that are not linear clamps.** The fail premise is inverted (§7.3, M9-shoulder). Likely band `0.005–0.40` with the hard fail near `< 0.003`, but this needs Codex's set before anyone touches it. **Do not cite this statistic in a verdict today.** |
| `M9 HighlightDesat ≤ 0.85` | p50 0.863, p90 1.569 | 9/24 hard fail `> 1.05`. **Recommend the hard fail require RI-VIS03's own combined rule** (`HighlightDesat > 1.05 AND ClipFrac > 0.02`) rather than the bare threshold. Note the statistic is otherwise excellent: the 2002 population's p50 is **1.60** against modern **0.86** — it correctly reads Morrowind as having no tonemapping. |
| `M9 BloomHalo 0.010–0.09` | 0.0123–0.157 | 6/24 hard fail `> 0.12`. Likely `0.010–0.18` with the hard fail at `> 0.25`. |
| `M10 R_aerial 0.25–0.70`, `dC_depth ≤ −3` | 0.691–2.828; median **+0.43** | **22/24 hard fail "no atmospheric attenuation" and 13/24 hard fail `dC_depth > 0` on a game that plainly has aerial perspective.** The single-image proxy is dominated by content — a smooth road in the near band against a detailed treeline in the far band inverts it. **Recommendation: demote the single-image M10 to advisory (soft only, never hard) and treat RI-VIS03's two-capture `FogDelta` as the only sound form.** Keep the `R_aerial < 0.10` fog-wall hard fail; nothing real trips it. |

### 7.5 What the guesses got right — and this matters

**M8's bands, the ones that carry the whole FIDELITY cap, survived contact with reality
unchanged.** `FS_score ≥ 0.035` against a measured p10 of **0.0362**; `LargestFlat ≤ 0.06`
against a measured p90 of **0.0535**; `TotalFlat ≤ 0.18` against **0.1499**. The headline metric
was guessed almost exactly right by an agent with no reference population, and the self-test shows
it hard-fails a flat-shaded render at `FS_score = 0.0001` — three orders of magnitude below the
real floor. **No amendment to M8 is proposed and none should be accepted without extraordinary
evidence.**

Also correct as written: `M1 DR ≥ 0.72` (measured p10 0.772), `M1 occupancy ≥ 0.80` (0.857),
`M2 C_global 0.13–0.28` (0.187–0.278), `M2 C_local_p10 ≥ 0.012` (0.0137), `M4 ED_1 0.10–0.34`
(0.190–0.344), `M5 NYQ_ratio ≤ 0.18` (0.123), `M9 ClipFrac ≤ 0.02` (0.0008), `M9 VeilIndex ≤ 0.10`
(0.018), `M7 sky_noise 0.0008–0.020` (0.0056–0.0086). **`M2 C_local_med ≥ 0.045`** measures
p10 = 0.0632 with the *correct* 32 px median statistic, so ACQUISITION-REPORT amendment 4's
proposal of 0.052 is safe and 0.055 would be safer.

### 7.6 The 2002 contrast population (n = 89, `pixel_metrics_valid: false`)

Not a target and not a band — included because the *direction* of the differences is informative,
and because it shows the corrected instrument still separates the eras:

| Statistic | Morrowind p10–p90 | Modern p10–p90 | Separates? |
|---|---|---|---|
| `M1.stops` | 5.62 – 8.32 | 9.51 – 16.29 | **yes, no overlap** |
| `M1.DR` | 0.301 – 0.860 | 0.772 – 0.919 | partly |
| `M9.HighlightDesat` (p50) | 1.60 | 0.86 | **yes — correctly reads 2002 as no-tonemapping** |
| `M4.ED_1` (p50) | 0.126 | 0.261 | yes |
| `M8.FS_score` (p50) | 0.0327 | 0.0460 | partly |
| `M2.C_local_med` | 0.031 – 0.082 | 0.063 – 0.104 | partly |
| `M5`, `M10`, `M11`, `M12` | **unmeasurable on all 89** | measurable | the instrument refuses rather than inventing a comparable-looking number |

---

## 8. How this still loses

- **Someone cites §7.4's "likely" values as if they were adopted bands.** They are not. They are
  what a HUD-bearing n=24 population from one game says, recorded so that Codex's set can confirm
  or refute them in one run. Anything in §7.4 that Codex's set contradicts should follow Codex.
- **The `exterior_lowlight`, `interior_darkemissive` and `character_closeup` rows get amended by
  analogy** from the `exterior_daylight` evidence. They have **zero** reference images. Amending
  them from this document would be exactly the "thresholds get tuned to whatever we ship" failure
  RI-VIS03 names.
- **The anti-reference is never regenerated.** Without `--anti`, `AT DEFAULT` cannot be computed,
  M8's floor anchor is missing, and RI-VIS03 caps the verdict at 6/10 — which the tool now
  enforces and states in `verdict.caps`. `corpus/80-methods/make-anti-ref.mjs` does not exist yet.
  **Until it does, no shot can score above 6.**
- **M11 and M12 stay permanently unmeasurable** because no dolly capture and no water mask is ever
  produced, and two of twelve metrics quietly drop out of every verdict. The tool lists them in
  `verdict.unmeasurable` on every run so the omission is visible, but visibility is not a fix.
- **The instrument gets trusted past its evidence.** Eleven metrics returning numbers is not the
  same as eleven calibrated metrics. Today: M1 and M8 are calibrated; M2, M4, M5 are close; M3,
  M6, M9, M10 have bands that the reference population fails and that no one should judge on
  until §7.4 is resolved; M11 and M12 have never been run on real data at all.

---

## 9. What must happen next, in order

1. **Codex's ~60 modern frames land.** Run
   `node tools/metrics/image-metrics.mjs --in <folder> --profile <profile> --no-legacy` per profile
   folder and read `aggregate.ri_vis03`, which emits p10/p50/p90 for every RI-VIS03 statistic
   directly. Resolve §7.4 against it and file the amendment to RI-VIS03.
2. **Write `corpus/80-methods/make-anti-ref.mjs`** — a real Three.js default scene rendered to
   PNG. Without it every verdict is capped at 6 and M8's `AT DEFAULT` never fires, which is the
   half of M8 that catches "we shipped the default".
3. **Add `--dolly` to the capture harness** (120 frames, 4.0 m/s, fixed yaw) plus a stationary pair
   and a `displacement.json`. M11 then runs for real.
4. **Emit a `WATER_MASK` from the object-id pass** on `water_edge`. M12 then runs for real.
5. **Re-run the self-test in CI.** `node tools/metrics/self-test.mjs` exits 20 on any regression.
   A visual verdict issued while it is red is not admissible.
