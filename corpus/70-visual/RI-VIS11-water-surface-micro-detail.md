---
id: RI-VIS11
title: Water surface micro-detail — when ripple becomes stipple
kind: number
side: modern-fidelity
judges: [visual.renderer.antialiasing, visual.renderer.materials, visual.process.measurement]
provenance: constructed
confidence: medium
blind_pair: yes
---

> **SIDE DECLARATION: this item is `modern-fidelity`.**
> Cited **only** under `JUDGEMENT SIDE: FIDELITY` (`RI-VIS01` §B).
> **This item REFUSES Morrowind references.** Morrowind's water is a scrolling texture on a flat
> plane and cannot set a bar for whether *our* procedural ripple resolves. A 2002 screenshot may
> never be used to argue a threshold here down.

## The bar

**Four F7 critics in a row have written that our water is covered in a heavy dotted stipple, and
none of them wrote this item, so nobody has ever had to say what would settle it.** Round 4's own
verdict is explicit about the cost: `NormalEnergy` — `RI-VIS03` M12's ripple-detail sub-metric, and
the only M12 sub-metric F7 passes — is *"high-frequency energy over a water window"*, and if the
dominant high-frequency energy on our water is a sampling artefact then **a passing `NormalEnergy`
is scoring the artefact**. A metric that cannot tell ripple from stipple cannot be the reason
anything passes.

This item exists to make that separable with two numbers, and it starts by **killing the name**.

## The reference artifact

### §1 It is not a dither, and that has been measured

*(Derived 2026-08-16 by the F7 r5 builder, `tools/visual/f7-r5-offline.mjs --mode stipple`, over
round 4's own banked frames at `corpus/90-verdicts/wave1/artifacts/W1-F7-WATER-r4/dm-edge2` and
`wr-edge`. No browser; a critic re-runs it in seconds.)*

Every previous naming of this defect has called it a **dither** or an **ordered stipple**. That is a
specific, testable claim, because an ordered dither — Bayer, and the 4×4 matrix three.js's own
`dithering` chunk uses — is a **fixed function of screen position**: every pixel sharing an
`(x mod 4, y mod 4)` phase receives the same offset. So bucket the water pixels by that phase and
compare the sixteen bucket means. Under an ordered dither they separate systematically. Under noise,
aliasing, geometry or a ripple normal — none of which know where the pixel grid is — they agree.

| pose / arm | water `phase_spread_lsb` | water `parity_contrast_lsb` | **land control** `phase_spread_lsb` |
|---|---:|---:|---:|
| `edge-b135` shipped (`fixed`) | **0.528** | 0.047 | **1.278** |
| `edge-b135` round-2 (`prefix`) | **0.613** | 0.057 | 1.144 |
| `edge-b135` water hidden | 0.352 | 0.046 | 1.128 |
| `edge-b225` (W. Rootlands) shipped | **0.275** | 0.028 | **1.518** |

**The phase signature is under two thirds of an 8-bit level on water, and it is two to five times
LARGER on the land the water shader never touches.** There is no ordered dither on our water
surface. **The name is wrong and four verdicts have inherited it** — this is `ARBITRATION` S63's
family, a stated mechanism travelling as established because nobody ran the ablation.

### §2 What is actually there — and it is real, and it is large

The same instrument, over the pinned water mask, mean absolute luma difference between horizontally
adjacent pixels:

| `edge-b135` | adjacent | two apart | ratio |
|---|---:|---:|---:|
| water hidden (bed and bank only, same pixels) | 4.788 | 5.233 | 0.915 |
| round-2 water (`prefix`) | **7.173** | 7.832 | 0.916 |
| shipped round-4 water (`fixed`) | 6.167 | 6.663 | 0.926 |
| **land control** (elsewhere in frame) | 9.638 | 13.172 | **0.732** |

Two facts, and they point the same way. **(a) The water adds ~50% more pixel-to-pixel energy than
the same pixels carry with the water hidden** — so the energy is the shader's, not the scene's.
**(b) The water's ratio is ~0.92 where land's is ~0.73.** On a properly resolved surface the
difference between two pixels *grows* with their separation, which is why land sits well below 1.
Water sitting at 0.92 means its energy is concentrated at the **finest scale the pixel grid can
carry** — the signature of a signal sampled at or past its Nyquist limit, not of a surface.

**The candidate cause is named in F7's own source and it is not a mystery.** `game/src/render/water.js`
lines 304–306, read this turn, add three procedural terms at spatial frequencies of **4.7, 13.7 and
26.3 radians per world metre** in `vEsWaterWorld.x/z`, with no mip chain, no derivative-based
filtering and no distance rolloff. At a grazing view — which is every `water_edge` pose and most of
how a player sees water — a metre of world compresses into a few pixels, so the 26.3 term is
sampled far below its own period and returns a different arbitrary value per pixel. That is a
stipple by construction, and it needs no dither matrix to appear.

**This item does not rule that this is the cause.** It rules that the cause is *an aliasing-class
defect rather than a dithering-class one*, which changes the remedy from "find the dither and turn
it off" — four rounds of a search for something that is not there — to "filter or roll off the
procedural frequencies", and it gives the test that decides it.

### §3 The test: supersample, and see what survives

`RI-VIS04` §8 already asks for this and F7 has owed it for four rounds. Capture the identical pose
twice, at 1× and at 2× linear resolution; box-downsample the 2× frame to 1×; measure adjacent-pixel
energy over each frame's **own** water mask.

```
HF(frame, mask) = mean |Yp[i] - Yp[i+1]|  over adjacent pairs both inside mask
survival = 100 * HF(supersampled_downsampled) / HF(native)
```

**Real surface detail survives supersampling** — four samples of a resolved feature average to that
feature. **Aliasing collapses** — four samples of an unresolved oscillation average toward its mean.

| Quantity | Band | Fail |
|---|---|---|
| `hf_survival_pct` on the water mask | **≥ 70%** | **< 45% → the water's high-frequency detail is predominantly aliasing** |
| `phase_spread_lsb` (4×4), water mask | < 1.0 | ≥ 2.0 → an ordered dither IS present; a different defect, fix that instead |
| `stipple_ratio` (adjacent / two-apart) | ≤ **0.85** | > 0.95 → energy is entirely at the Nyquist limit |

**The 45–70% middle is `unresolved`, and `unresolved` fails closed.** *(Added 2026-08-16, hours after
this item was written, by the F7 r5 builder — the first measurement taken against it returned
**64.95%** and landed in a zone the first draft did not define. Recording the hole rather than
rounding the number into whichever neighbouring verdict was convenient.)* This follows `ARBITRATION`
S61's asymmetry directly: **a statistic can fail a build and can never pass one**, so a survival
figure that is neither clearly resolved detail nor clearly aliasing may not be read as either. It is
reported as `unresolved`, it does not license a `NormalEnergy` pass, and it is not the hard fail that
`< 45%` is.

**The land control is required on every row.** All three numbers are properties of a region of
screen as much as of a shader, and the only thing that makes a water reading mean anything is the
same reading taken over pixels the water shader does not touch, in the same frame. A water figure
published without its land control is inadmissible here.

**The first measurement ever taken against this section, so the next reader has a worked example.**
*(F7 r5, deep-marshes `edge-b135`, `tools/visual/f7-r5-sweep.mjs --mode supersample` for the capture
and `tools/visual/f7-r5-offline.mjs --mode supersample` for the control. Note the sequence: the
in-browser tool produced the water half **without** the land half, i.e. it did not satisfy this
clause, and the row was made admissible by computing the control offline from the banked frames
rather than by publishing it anyway.)*

| arm | water `hf_survival` | **land control** | water − land | water `stipple_ratio` 1× → 2× |
|---|---:|---:|---:|---|
| shipped water (`band 0.10`) | **64.95%** | 84.77% | **−19.82 pp** | 0.9368 → 0.8205 |
| round-2 water (`prefix`) | **64.01%** | 85.85% | **−21.84 pp** | 0.9161 → 0.8001 |

**Read it as the clause intends:** ~85% survival on land is what a mostly-resolved surface looks
like under 4× supersampling; the water's ~64% is not, and the ~20 pp gap is the part that is
actually about the water. **Both arms read the same**, so this is a standing property of our water
and not an artefact of any recent change — which is also why the `unresolved` verdict here is a
finding about F7's whole water surface rather than about one round's constant.

**And `NormalEnergy` is gated on this.** `RI-VIS03` M12's `NormalEnergy ≥ 0.035` may be reported as
a **PASS only where `hf_survival_pct ≥ 70%`**. Between 45% and 70% it is `unresolved` and fails
closed. Below 45% it is recorded `inapplicable — high-frequency energy is predominantly aliasing`,
and per `ARBITRATION` S64 that `inapplicable` **carries the absence forward as a finding and is never
a pass**. This is an ADD under `CRITIC-DOCTRINE` §1.3: it
removes a degree of freedom, relaxes no threshold, and **it may be the reason a build fails and may
never be the reason one passes.**

### §4 What this item does not own

- **The fix.** Whether the remedy is a derivative-based rolloff (`fwidth`), a mip-mapped normal
  texture replacing the analytic terms, or an AA change, belongs to `RI-VIS04` §8 and to F7.
- **Foam, shoreline fade and depth colour.** `RI-VIS04` §9 and `RI-WLD10` §10 own those, and this
  item must not be cited to argue about a waterline.
- **Whether it looks bad.** The numbers here say the energy is unresolved; they cannot say a player
  minds. `blind_pair: yes` — an admissible counterpart exists (`RI-VIS09`'s modern water plates) and
  per `ARBITRATION` S52 that field means a counterpart exists, not that anyone has run one. **No
  blind pair has been run for this item and per `CLAUDE.md` rule 0e only the orchestrator can spawn
  one.**

## How we lose

**By fixing the dither.** There is no dither. Four verdicts said there was, this item measured the
phase signature at 0.28–0.61 LSB against a land control that is larger, and a fifth round spent on
hunting a dither matrix is a round spent on an artefact of language.

**By passing `NormalEnergy` and calling the water detailed.** F7 has now passed that sub-metric in
three rounds while every critic who opened a frame described the surface as wrong. The metric was
never lying; it was measuring energy and calling it detail, and §3 is the sentence that separates
them.

**By publishing a water number with no land control.** Both estimators here are region-sensitive.
The single most misleading table this item could produce is a water `stipple_ratio` of 0.92 quoted
as damning with no note that the same frame's bed-and-bank pixels, with all water hidden, read
0.915 — because they do, and it is in §2.

## Provenance note

`provenance: constructed`. Written 2026-08-16 by the F7 round-5 builder, from measurements taken
this turn over round 4's banked frames; the instrument is `tools/visual/f7-r5-offline.mjs` and the
supersample arm is `tools/visual/f7-r5-sweep.mjs --mode supersample`. **The defect was named by the
F7 r2, r3 and r4 critics** — each recorded it, each said it was nobody's item, and the r4 critic
wrote *"I did not write the dither-stipple reference item either. Four critics have now named it."*
Their observation is upheld: there is something wrong with the water's micro-detail and it
contaminates the one M12 sub-metric that passes. **Their diagnosis is corrected: it is not a
dither.** `confidence: medium` — §1 and §2 are measured and reproducible, §3's thresholds are
first-draft and set from the physics of box-downsampling rather than from a corpus of measured
references, and the first build judged against them should be expected to argue with the exact
numbers.
