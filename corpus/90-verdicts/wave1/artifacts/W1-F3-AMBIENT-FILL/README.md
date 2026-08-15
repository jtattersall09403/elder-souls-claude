# W1-F3 — ambient/GI shadow fill: the evidence, including the part that falsified it

Roadmap item **F3** (ring 1). Commissioned by `corpus/90-verdicts/wave1/W1-VISUAL-BLIND-PROTOCOL-A-r1.md`
remedy **R3**, named by 3 of 5 blind judges: *"crushed to a near-uniform black with no bounced or
ambient fill, so an ambient/GI term with tone-mapped shadow lift is needed."*

**Read the second section first.** The headline result of this piece is not the shader. It is that the
instrument the shader was being judged by was measuring the wrong thing, and that the delete-the-fix
control is the only reason anybody found out.

---

## 1. What the fix actually does, measured properly

Hardware: **NVIDIA RTX A5000**, renderer string
`ANGLE (NVIDIA, Vulkan 1.4.312 (NVIDIA NVIDIA RTX A5000 (0x00002231)), NVIDIA)`, `software_renderer:
false`. **Both arms on one Pod and one GPU**, and the control run's own
`BOTH-ARMS-ON-THE-SAME-RENDERER` check compares the two renderer strings and passes.

Scene: `town-thorn` at the VP04 settlement-street pose, 09:00, clear — the same pose F2's own
production evidence used. Metric crop excludes the HUD and the sky.

Measurement design: **paired**. One 240-frame warm-up, then GI off / GI on / off / on … six times at
one fixed pose with equal settle between every capture, so any drift lands on both arms and cancels.

| | GI off | GI on | paired difference |
|---|---|---|---|
| `p10_luma` (shadow floor) | 14.287 → 14.300 over six captures | 14.913 → 14.929 | **+0.631 luma, positive in 6 of 6 pairs, smallest +0.626** |
| `p90_luma` (lit end) | — | — | +0.215 luma |
| drift across the whole GI-off series | **0.013 luma** | | |

Multi-angle, both arms taken back-to-back **at each pose before the camera moves**: the shadow floor
lifts at **8 of 8** orbit angles, per-angle lifts `[0.623, 0.359, 0.692, 0.350, 0.218, 0.121, 0.537,
0.289]`. Under a 1.5°-per-frame camera pan the frame-to-frame instability of the shadow floor is
`0.1233` with GI on against `0.1284` with it off — **the fill does not crawl; it is marginally steadier
than the untouched scene.**

**Delete-the-fix, on a clone built from the pinned pre-F3 sha** `eafd1316` (the two source files as
they stood are in `baseline-src/`, so the control is reconstructible anywhere, including on a Pod with
no `.git`):

- `setVisualFeature('giFill')` **throws** `unknown renderer feature` — the fix is genuinely torn out,
  not merely switched off.
- The GI-off series is **identical to the head tree's**: `[14.287, 14.287, 14.287, 14.287, 14.289,
  14.300]` on both.
- The paired difference **collapses to −0.001 luma**, against +0.631 with the fix present.

That is the fix being real, directional, and the cause of its own number.

**And it is small.** +0.631 luma on a settled shadow floor of 14.287 is a **4.4% lift**. Any reading of
this piece that carries away "shadows are no longer crushed" is carrying away more than the evidence
supports.

### In the verdict's own vocabulary

The verdict corroborated its judges with two statistics from `image-leakcheck.mjs`, and R3's stated
acceptance is written in the first of them. Both, measured **paired**:

| statistic | GI off | GI on | paired change |
|---|---|---|---|
| `shadow_levels` — cluster C, R3's own acceptance metric, 5/5 pairs named the reference | 33 in all six captures | 34 in all six | **+1 level, in every pair** |
| `local_contrast_med` — cluster A, 5/5 pairs named the reference | 4.685 | 4.325 | **−0.359, i.e. −7.7%** |

### The cost, stated rather than buried

`local_contrast_med` moves the **wrong way**. The bounce average is mechanically a soft blur of nearby
lit colour, and averaging a wide neighbourhood into a very dark pixel washes out what little texture
the base shading carried. Reducing `uGIStrength` from 0.55 to the shipped 0.22 improved this and did
not remove it.

**The size of that cost is itself a correction.** The confounded block design put it at about 30%
(6.172 → 4.328). Paired, it is **7.7%**. Both the benefit and the cost were inflated by the same
artefact, and the honest figures are the paired ones. This is worth stating plainly because the
tempting move — quoting the paired benefit and the block-design cost, or vice versa — would be
choosing a number per claim.

### The control is watched moving, not merely watched

`RULES.md` rule 6: *a control you have never seen fail is not evidence, it is a second copy of the
experiment.* On the pinned-baseline tree the paired change in `local_contrast_med` is **−0.001** and
the per-angle shadow lifts are `[0, −0.003, 0.003, 0.002, −0.007, 0, −0.010, −0.002]` — every one
inside ±0.01 luma, against `[0.623, 0.359, 0.692, 0.350, 0.218, 0.121, 0.537, 0.289]` with the fix
present. The control does not merely fail to reproduce the effect; it sits at zero on every axis the
head tree moves on.

---

## 2. The delete-the-fix came back red, and it was right

The first design of this instrument captured GI-off, then captured GI-on, and compared. On an **RTX
A4500** it produced `p10_luma` 4.641 → 15.001 and would have been reported as a **+223% lift**.

Run against the pinned pre-F3 tree — where the shader is physically absent — the same instrument
produced 4.641 → **14.353**.

> **9.712 of the 10.360 "improvement" — 93.7% of it — is reproduced by a tree with no fix in it.**

The first capture is identical on both trees to three decimals. Only the second diverges. The block
design was measuring **capture order**, and only marginally the shader. SwiftShader reproduces the
same confound independently at the same 93.7%, so it is not a driver artefact.

This is `RULES.md` rule 6's third and worst shape — *an inert-looking fix whose number moves the right
way anyway* — and nothing except the delete-the-fix control would have caught it. The block-design
numbers are still in `reports/runpod-gpu/runs/w1-f3-ambient-fill/` and are kept deliberately: a
confound that is deleted once a better instrument exists cannot teach anybody anything.

### The finding underneath it, which is bigger than F3

Whatever settles between those two captures moves the shadow floor from **4.6 to 14.3 luma with no
shader change at all** — more than twenty times the entire effect of the remedy commissioned to fix
it. After a 240-frame warm-up the same measurement is stable to 0.013 luma.

So a frame captured shortly after a teleport is **far darker in shade than the same frame once the
scene has settled**, and the game's visual tools do not wait: `pauseClock` is exposed on the harness
(`game/src/harness/api.js:195`) and **no tool under `tools/visual/` or `tools/harness/` calls it**,
though `HARNESS.md` §6 requires the clock pinned for a comparable screenshot.

**This bears directly on the blind re-judge.** If the original comparison pack was captured in that
unsettled state — and this instrument's first version was, by default — then our side was judged on a
shadow floor a player never actually sees, and *"crushed to a near-uniform black"* may be describing
the capture procedure as much as the renderer. Nobody should pay five judges again until the pack's
capture path is checked against this.

---

## 3. The null control is the plausible wrong answer, not the trivial one

The trivial control is "turn GI off and it goes dark again". The control that matters is a **flat
global lift** — `c += K` on every pixel — with `K` solved so its shadow floor matches the fix's
exactly, the most charitable construction available to it.

- For the same shadow-floor lift, GI moves the lit end by **0.121 luma**; the flat lift moves it by
  **11.000**, because an additive lift cannot touch one region without touching all of them.
- `falloff_ratio` (p90/p10) is reported and **does not gate anything** — see §4.

## 4. Three checks in this instrument were found wrong by running them, not by reasoning

1. **`falloff_ratio` was the wrong operationalisation of "directional falloff".** A flat lift matched
   to the fix scored a *higher* ratio than the fix (4.00 vs 3.46), because the ratio rewards moving
   the lit end up alongside the shadow floor — which is the flattening itself. Replaced by a direct
   lit-end-movement comparison at matched shadow floor.
2. **The null control's matching check was arithmetically impossible.** It demanded a match within 0.5
   luma; an 8-bit additive lift is quantised to whole levels (`round(px+K) = px+round(K)` for integer
   `px`), so the achievable values are one luma apart. Worse, bisecting over real `K` converged onto
   the discontinuity and the applied lift became whichever side floating point landed on — which made
   the algebraic cross-check disagree with the frame it was predicting (4.2986 predicted, 4.4105
   measured). Fixed by searching integers only; the prediction now agrees to 1e-4.
3. **The block ordering, above.**

`--offline-null <dir>` re-derives the whole null control from the two committed PNGs with no browser,
no GPU and no repo state, so a reader can reproduce it.

---

## 5. What is here

| path | what |
|---|---|
| `baseline-src/` | `composite.js` and `renderer.js` exactly as at the pinned pre-F3 sha `eafd1316`, with the note explaining why F1 and F2 survive the tear-down and only F3 is removed |
| `sw-head/` | SwiftShader stills, **block design, confounded** — kept for the record, not cited |
| `sw-deletefix/` | SwiftShader delete-the-fix, the independent replication of the confound |
| `reports/runpod-gpu/runs/w1-f3-ambient-fill/` | RTX A4500, block design — the run that falsified its own design |
| `reports/runpod-gpu/runs/w1-f3-paired/` | RTX A5000, paired and alternating, head tree + pinned-baseline control |
| `hw-final-a5000/` | **the citable evidence** — RTX A5000, paired and alternating, head tree and pinned-baseline control, with the verdict's own two statistics. Full run at `reports/runpod-gpu/runs/w1-f3-final/` |
| `hw-paired-a5000/` | the first paired run, same conclusions, kept as an independent repeat |

The instrument is `tools/visual/w1-f3-ambient-fill.mjs`.
