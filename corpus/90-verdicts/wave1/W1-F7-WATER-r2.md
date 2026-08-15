# W1-F7-WATER-r2 — the water surface, round 2

**Verdict: FAIL at 2 (min over axes). Keep the change.**
`RI-WLD10` 2 · `RI-VIS04` 3 · `RI-VIS03` 2 · pass threshold 7.

I did not build this. I am the **second** critic on this round — the container restart at ~20:03 killed my
predecessor, which had banked nothing. What I recovered from the quarantine commit and how I treated it is at
the end.

---

## The one-paragraph version

**Round 2 fixed the sign of the corpus's own instrument for the property F7 exists to fix, at every pose a
player occupies, by roughly twice the margin the builder claimed for itself — and it still fails.** `RI-VIS03`
M12 `FresnelDelta` reads **−0.0751 to −0.0988** on the round-1 arm across four eye-level bearings and **+0.0136
to +0.0460** on the round-2 arm. The paired change is **+0.1128 mean**, same sign at all four bearings, **12×
the instrument's band which I measured at 0.0094**. The band is **≥ 0.05** and the best bearing is **0.004
short**. Meanwhile two of `RI-VIS04` §9's four MIN BAR components turn out to be **absent from the shader
entirely**, `RI-WLD10`'s blind gate has still never run, and the lane defect that has dominated two rounds is
now **excluded from the reflection by ablation** and remains unexplained.

**The score is unchanged from round 1. The build is not.**

---

## What I was asked to falsify, and what happened

| # | Asked | Ruling |
|---|---|---|
| 1 | Is the eye-level visual claim true, and an improvement? | **True, and an improvement — but strongly bearing-dependent, which the build did not say.** |
| 2 | Is the `ShoreDelta` regression visible or metric-only? | **Real, reproducible, worse than reported — and metric-only.** Both halves matter. |
| 3 | Can M12 gate anything, given a 0.049 spread? | **Yes. The 0.049 is not noise.** The real band is **0.0094**. The build talked itself out of its own best result. |
| 4 | Is clause (d)'s luma floor inside the noise? | **Confirmed.** Three readings straddle it: 73.142, 70.151, 69.917. `unresolved` → fails closed. |
| 5 | Does the null control kill a family of metrics? | **Verified, and the family is wider than two.** `lane_aniso` and `band_contrast` join `x_rms` and `lane_power_normalised`. |

### 1. The visual claim — true, and bearing-dependent

I orbited the camera at eye level through **eight bearings**, both arms at each. Four produced valid arm pairs.

At **yaw 090** the build's description is exactly right: the round-1 arm's near water is a pale washed-out
blue-grey sheet carrying a readable smeared ghost of the tree trunks across the **entire** foreground; the
round-2 arm's near field is deep teal-green with the mirror confined to the middle distance where grazing
angles actually are. Large, obvious, at-a-glance.

At **yaw 000** the same −14.4% of brightness buys almost nothing. Both arms read pale blue-grey; the mid-ground
is essentially identical.

The removed term is a mirror of the **canopy**, so its visible cost tracks how much reflected trunk a bearing
puts in the near field — not the luminance change, which is similar at both. **The build measured one bearing
and generalised.** This is exactly what the owner's 2026-08-14 directive is for: *"if you just load the game
rotate the camera around the player it's immediately obvious."*

### 3. The instrument is not noisy — it is *ordinal*

The most reusable finding of the round, and it came out of two **recovered** runs.

`f7-r2-sweep.mjs` advances the simulation with `stepFrames` between every arm and **never resets the water
phase**, so an arm's *capture ordinal* fixes the ripple phase it is measured at.

- The round-2 arm is **bit-identical** across two separate processes at two different commits — FresnelDelta
  −0.01381, ShoreDelta 0.01222, luma 74.684, lane_power 18.3239 — because it is the 3rd arm in both.
- The **same untouched shader** captured 5th in one of those runs reads **+0.00598**. Same process, same
  shader, different ordinal, 0.0198 apart.
- Five replicates of untouched HEAD, changing nothing but phase: FresnelDelta range **0.00943**, ShoreDelta
  **0.00806**, mean_luma **2.069**.

So the build's 0.049 is **5× the band** and has a cause. And the sweep's headline within-process delta
(+0.05311) is **confounded** — its two arms sit at different ordinals. Interleaving the arms and swapping their
order recovers the true effect: **+0.1128**.

---

## The clauses

| clause | build said | I say |
|---|---|---|
| **(a)** weight ≤ 0.05 down, ≥ 0.60 grazing | PASS both | **Half passes on 1% of pixels; the grazing half has no valid measurement → 0 fail-closed** |
| **(b)** FresnelDelta ≥ 0.05 positive | FAIL (−0.01381) | **FAIL — on a much better build than described.** Positive everywhere; short by 0.004 |
| **(c)** S63's three-number replacement | fails on aniso | **`unresolved` on all three terms → fails closed** |
| **(d)** preservation | mixed | **One holds on arithmetic, one unresolved, ShoreDelta fails at every bearing** |

**Clause (a)'s grazing half** is scored on a per-pixel join between the esView probe frame and the weight probe
frame — a join **the build itself declares invalid** and then uses anyway. I can show it broken, not merely
suspect: at the top-down pose the same bin reads median **0.022** where the shader's own algebra requires
**≥ 0.576**, and 0.022 is almost exactly Schlick at *normal* incidence. The pixels the esView frame labels
"grazing" are normal-incidence pixels in the weight frame. The join is **anti-correlated with the truth**.

**Clause (c)** I could not score. Two instruments disagree on the **sign** of the lane_power change (+1.8% vs
−21.2%) and on aniso (+29% vs +3%); three readings of the round-1 arm's aniso are **1.54, 1.73, 1.97**, a spread
larger than the 0.45 "rise" the clause fails on; and S52's null control reproduces **71%** of that rise with no
Fresnel at all. The replacement clause is still built entirely out of brightness proxies.

---

## Two things the bar itself gets wrong

**Two of `RI-VIS04` §9's four MIN BAR components are absent from the shader.** Measured, not argued:

- `grep -c 'depthTexture\|tDepth\|depthFade' game/src/render/water.js` → **0**. No depth-buffer read exists, so
  **"shoreline depth fade" is unimplemented**. What ships is a per-vertex edge mask that `province.js:1554`
  documents against itself: *"`waterShore` is an edge mask, not a depth ramp."*
- `water.js:124` sets the body colour to the literal constant `vec3(.038,.105,.118)`, and the shader's complete
  uniform set — `uWaterPhase, uWaterReflection, uWaterReflectionMatrix, uWaterReflectionResolution,
  uWaterReflectionStrength` — carries **no depth, no k, no region**. So **"depth-based colour" is
  unimplemented**, one province gets one water colour, and `RI-WLD10`'s Deep Marshes at k = 4.5 cannot reach
  the fragment shader.

**Two rounds and two critics have been spent on the Fresnel blend between a constant and a stale half-res
mirror — the one MIN BAR component that was already there.**

**And M12's `ShoreDelta` is the wrong shape.** It is an *absolute* near-shore/open-water luminance difference.
`RI-VIS04` §9's TELL names *"a hard geometric line where the water plane intersects the terrain"* as the defect.
**A hard line maximises ShoreDelta; a correct depth-fade to matching colour minimises it.** The metric scores the
named defect high and the required feature low. It needs a **gradient-width** companion — a hard line is a high
delta over 1–2 px, a fade is a comparable delta over 20–40 px — and that is an arbitration call, not mine.

This is why the `ShoreDelta` regression is **metric-only**: what the round-1 arm had near the shore was not a
shore treatment, it was the 25% mirror making near-shore water brighter. **Nothing the bar wants was lost,
because nothing the bar wants was ever there.**

---

## The lanes: five ablations, and I was wrong twice

**Established, robustly, across two processes: the lanes are not the reflection.** With `esRefl = 0.0` — no
reflection of any kind — **76–78% of the lane power remains**. That falsifies S63's replacement conclusion that
what is left is `renderer.js`'s half-resolution, six-frame-stale target. *A defect that survives deleting the
thing you blamed is not that thing's.* The `water-hidden` frame carries no bands at all, so the lanes **are**
the water's — in the file F7 owns.

Then I derived an explanation, and ablated it, and it was wrong. Then I derived a better one, and ablated it,
and it was wrong too.

| arm | lane power | aniso | vs `fixed` |
|---|---|---|---|
| `fixed` | 0.2907 | 1.96 | — |
| `no-refl` (all reflection deleted) | 0.2210 | 1.83 | **76% survives** |
| `no-fine-sines` (esCapillary + esMicro deleted) | 0.2696 | 1.87 | **93% survives** |
| `no-caustic` (esCaustic deleted) | 0.2741 | **1.96** | **94% survives, aniso identical** |
| `no-additives` (all six additive terms deleted) | 0.2383 | 1.83 | **82% survives** |

My first account was sub-pixel **moiré**: `esCapillary` is 1.83 px at this pose (below Nyquist) with predicted
bands at −56° against a measured −50°. Clean arithmetic, convincing match, **false**. My second was
**`esCaustic`**, whose two beat components have bands at *exactly* −49.7° and +49.7° and a 32 px wavelength —
a better match still. **Also false**: deleting it leaves anisotropy *identical*.

I also leaned on bearing agreement, and I should not have: the same arm reads **−26, −50 and −56** across runs.
It is an argmax over 2° steps and it jumps. The reflection finding does not depend on it — it rests on lane
**power**, which replicates.

**The lesson I am recording against myself:** I produced two quantitative, well-argued, source-derived
explanations and ablation killed both, each looking stronger than the last. On this defect a shader-source
argument is worth nothing until the term has been deleted and the number has come back. The next candidate —
`province.js:1559`'s per-water-cell vertex colour feeding `water.js:124` — is **named as an arm to run, not
asserted**, because the first two were named that way too and were still wrong.

---

## `province.js` — the defect two rounds stepped over

**The requirement is F7's. The file is not. And the fix belongs in F7's own file anyway.**

`RI-VIS04` §9 and `RI-WLD10` §10 both name the waterline, and both are items F7 is judged against. But the bar
asks for a **depth-fade against the depth buffer** — a fragment-shader technique, implemented in
`game/src/render/water.js`, the only file either round has touched. `province.js`'s 25 m axis-aligned wet-bank
lattice is a **geometric substitute** for a shader feature that has never existed, and the substitute is what
draws the hard axis-aligned intersection.

So: F7 owns closing it, in `water.js`, by adding the depth read that `grep` says has never been there. Removing
`province.js`'s lattice is a separate, smaller piece for whoever owns that file — sequenced **after**, never
before.

> **A defect is owned by the item whose bar names it, not by the file it happens to be drawn from.** This one
> was stepped over twice because the pixels lived somewhere else. If that principle is not written down, it
> will happen again at the next subsystem seam.

---

## The builder's ruling: **confirmed — keep it**

Its own three overturn conditions:

1. **ShoreDelta visible rather than metric-only** — *tested, not met.* Neither arm has a shoreline treatment;
   the round-1 arm was merely brighter. Proved in source, not inferred.
2. **The darkening pushes another region below its k** — *not tested by me either.* One region, one tide state,
   same as both prior rounds. **This is the strongest surviving argument against the change I just confirmed.**
3. **A blind pair ranking round 1 above round 2** — *not run. The orchestrator owes it (rule 0e).*

I confirm rather than defer because the `.25` floor was indefensible and measured (whole-mask median composited
weight **0.3250 → 0.0868** where real water reflects ~2%); because the corpus's own instrument moves **+0.1128**
across four bearings, 12× its band, and changes sign; because every metric arguing for a revert is a brightness
proxy the null dimmer reproduces without any Fresnel; and because reverting would restore a 25% mirror to fix a
lane defect I have now shown by ablation the reflection does not cause.

**The build undersold itself.** It scored clause (b) at the one pose where the instrument sits near zero and is
phase-sensitive, and never measured it at the poses whose frames it had already opened and correctly described.
It reported "+0.0531, still negative" where the true unconfounded effect is **+0.1128 and positive at every
player pose**. Its `what_i_could_not_do` is the most honest I have read in this repo, and most of what I found,
I found because it pointed at where to look.

---

## What I could not do

- **The blind gate.** `RI-WLD10` declares `blind_pair: yes`; M56 §5 has never run. `blind_status:
  not_possible`, scored 0, fail-closed. **The orchestrator owes it.** Re-derived myself, not inherited:
  `grep -rl "blind_pair: yes" corpus/ --include=*.md | wc -l` → **100** (the brief and the r1 verdict say 98 —
  it has grown); `grep -rln "blind_status: *run" corpus/90-verdicts/ | wc -l` → **0**.
- **Say what draws the lanes.** Five arms exclude the reflection, both sub-pixel sines, `esCaustic` and the
  whole additive layer. Both positive explanations I derived were falsified by ablating them.
- **The shoreline close-ups never ran** — the orbit run ended at bearing 315 before reaching them. **The shot
  the builder named as its own overturn condition still has not been taken by anybody.** My ruling rests on
  eight eye-level frames plus the source-level proof, the second of which does not depend on any capture.
- **The top-down replicate band.** I killed that run by PID to give the orbit room when the box was at 6.43
  load per core against a ceiling of 4.0. The band I publish is the **vista** band.
- **Four of eight orbit bearings lost their round-1 arm** to a program-cache-key collision *in my own tool*. A
  VACUOUS `prefix` frame is the `fixed` shader under a `prefix` filename — `yaw045`, `yaw135`, `yaw270` and
  `yaw315` **must not be compared**. Bug fixed and banked.
- **M12 `NormalEnergy` and `ReflCorr`** remain unmeasurable at every pose, as in both prior rounds — 0
  fail-closed, **not** demonstrated absent. Three rounds have failed to find a pose that yields them; somebody
  should decide whether they are obtainable here at all.
- **M12 `TemporalVar`** not measured (needs ≥ 5 stationary frames per arm).
- **One region, one tide state.** `RI-WLD10` M56 wants four of each.
- **No timing figure**, from the build or from me.

## Recovered from the quarantine

`refs/orphaned/2026-08-15-container-restart` (`86181c27`) — **59 files, 56 MB**, my predecessor's four sweep
runs and their frames. Recovered and banked before I measured anything, and treated as **data, never
conclusions**: there was no note saying what it measured. Two checks first — every run records a real pinned
sha in its `commit` field, not `"unknown"`, so by `HAZARDS` §22 none is a control clone measuring the main tree;
and all four assert the round-2 expression against the live file.

It bought the single most important structural finding here — the ordinal/phase confound came out of comparing
two of those runs against each other — plus the S52 null-control row and the clause (a) probe bins, without
spending a browser on any of them. **My predecessor never captured the player poses, which is why the round's
central claim was still unjudged when I arrived.**

I banked five times during this round for the same reason.
