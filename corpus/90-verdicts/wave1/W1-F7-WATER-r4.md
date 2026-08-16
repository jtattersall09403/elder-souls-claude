# W1-F7-WATER-r4 — the water surface, round 4

**Status: FAIL — 2 / 10, min over axes (pass 7). KEEP the mechanism. THE SHIPPED DEFAULT IS
REJECTED.** `RI-WLD10` **2** · `RI-VIS04` **4** · `RI-VIS03` **2**. Down from 3.

Machine-readable verdict: `W1-F7-WATER-r4.json`. My own numbers, with the command that made each:
`artifacts/W1-F7-WATER-r4-critic/critic-measurements.json`. I did not build this.

---

## The one-paragraph version

**The build declined its own acceptance, and it was right to. It also under-sold the reason.** The
mechanism the r3 verdict asked for is genuinely there — the fade's width contains no `k`, which three
lines of shader settle without any measurement. But at the shipped constant of **1.20 m** the term is
non-zero over **65.1% of the Deep Marshes water in frame and 98.6% of the Western Rootlands water in
frame**, so it is not a shoreline fade at all; it is a depth-driven transparency multiplier over the
whole water body. That single fact is **one cause for both symptoms** the build reported as two: a
fade applied nearly everywhere has almost no edge, and it lowers alpha nearly everywhere. And it is
**tunable, against the build's own conclusion**: swept at the pose that carries the round's only
positive result, `gradient_width_px` is **flat at 34 px from 0.10 m to 1.20 m** while the water gets
monotonically darker — so the shipped constant is *dominated* by a constant twelve times smaller.

---

## What I was asked to falsify, and what happened

| # | Asked | Ruling |
|---|---|---|
| 1 | Is the shoreline census true — is the Deep Marshes shoreless? | **CONFIRMED to the digit, in my own code.** It is not shoreless. Three rounds of reasoning rested on a mis-sited camera. |
| 2 | Does the acceptance fail, and is "keep at 1.20 m" or "revert to 1e-4" right? | **It fails. NEITHER.** The constant is dominated on the build's own instrument; ship **0.10 m**, not 1.20 and not 1e-4. |
| 3 | Does the transparency-sorting objection fire? | **CONFIRMED: it does not.** `depthWrite` is false everywhere, at source. |
| 4 | Is HAZARDS §25 measured at 20×, and is the HUD label stale? | **The label: CONFIRMED, at 4 of 4 poses, by eye. §25: NOT established by this round** — the number tracks capture ordinal. |
| 5 | What does it owe? | The S52 null, three Western Rootlands bearings, TemporalVar, the supersample test — **and now an order-reversed mask control, and a re-sweep at `edge-b225`.** |

---

## Job 1 — the census holds, and it is the finding

I wrote my own script against `game/src/world/field.js`'s `WorldField`, reproducing
`province.js:1531-1562`'s cell arithmetic from the source I read this turn. It does **not** import the
build's tool. Within 120 m of the `vista-deep-marshes` stand:

| | water cells | waterline cells | nearest | q-saturation |
|---|---:|---:|---:|---:|
| **vista-deep-marshes** | **121** | **47 (38.84%)** | **17.7 m** | **0.2416** |
| eye-deep-marshes | 144 | 51 (35.42%) | 25.9 m | 0.3307 |
| vista-western-rootlands | 126 | 93 (73.81%) | 20.9 m | 0.0000 |
| vista-marauder's-coast | 121 | 4 (3.31%) | 81.0 m | **0.9248** |
| vista-crimson-coast | 121 | 4 (3.31%) | 60.5 m | **0.9706** |

**Every figure matches the build's, derived independently. The Deep Marshes is full of shoreline.**
What was true is a *pose* fact: round 3's close-ups were shot at 4.5–7 m from a stand whose nearest
bank is 17.7 m away. The genuinely dead regions are the two seas, and that is a `province.js` limit —
no shader reading a saturated vertex colour can fade there at any `k`.

**This is now wrong in the corpus, not only in a status file.** `RI-VIS03` §M12a clause 4 says, in
the bar itself: *"The Deep Marshes is WCI 0.86; three rounds of F7 shot every frame there and **not
one frame contains a shoreline**."* Every future critic inherits that. I have amended the clause in
place under `CRITIC-DOCTRINE` §1.3 — **the rule is untouched and no threshold is relaxed**; only the
false worked example is corrected, which is exactly what `ARBITRATION` S60, S63 and S65 each had to do
to their own narrations.

---

## Job 2 — the acceptance fails, and the choice the build offered me is a false pair

### The measurement nobody had run: is the water still there?

Every artifact directory carries a `--water-hidden` frame — the same pose with all 93 water meshes
hidden — and **no round has ever scored it.** It is the only absolute reference for *no water at all*.
Over the pinned mask, `presence = (L[arm] − L[hidden]) / (L[prefix] − L[hidden])`:

| pose | `prefix` (r2) | `r3` | **`fixed` (r4)** |
|---|---:|---:|---:|
| **deep-marshes `edge-b135`** | 100% | 59.5% | **41.2%** |
| deep-marshes `edge-b045` | 100% | 99.3% | 94.5% |
| deep-marshes `edge-b225` | 100% | 99.5% | 82.3% |
| deep-marshes `edge-b315` | 100% | 100.6% | 86.5% |
| western-rootlands `edge-b225` | 100% | 97.2% | **69.3%** |

It reads **41.1 / 41.2 / 41.4 at thresholds 4 / 6 / 10** — threshold-independent, which
`gradient_width_px` is not. At the pose carrying the round's only positive result, round 4 leaves
**41% of round 2's visible water**, and you can see it: open
`dm-edge2/frames/edge-b135--fixed-o3.png` beside `edge-b135--water-hidden.png` and they are nearly the
same picture. Round 2's frame at that pose has an obvious pale sheet over the bed; round 4's does not.

**And the round had the arm to decompose it and did not.** `no-shorefade` (the depth colour alone)
leaves **89.4%**. So of the 58.8 points lost, **10.6 are the depth colour and 48.2 are the shoreline
alpha term.** The build's defence — *"the colour half is deliberately untouched"* — does not reach the
cost, because the cost is not the colour. `RI-WLD10` §10.1 is *"water is opaque before it is
reflective"*, and this term multiplies `diffuseColor.a` down to **0.42×** wherever it saturates.

### Why: the band is not a shoreline band

`esDepthM = clamp((q−0.43)/0.57,0,1)×1.35` is the exact inverse of `province.js`'s `q`, so a wet
corner's `esDepthM` **is** its depth in metres and I can evaluate `esBandM` offline over the same
field. At the shipped 1.20 m:

| | untouched | in transition | full fade |
|---|---:|---:|---:|
| Deep Marshes (418 wet corners, median depth **0.824 m**) | 34.9% | 61.7% | 3.3% |
| **Western Rootlands** (280 wet corners, median depth **0.375 m**) | **1.4%** | 84.3% | 14.3% |

The constant sits **above the median water depth in both regions.** `RI-VIS04` §9's MIN BAR component
is a *shoreline* depth fade; a term acting on 98.6% of the water in frame is not one. This is also why
the Western Rootlands width went **5 → 1**: a fade applied uniformly has no edge to measure.

**The constant was chosen by a criterion that is the inverse of what a shore band needs.** `water.js`'s
own comment and the status both justify 1.20 m because *"71 of 121 water cells … carry a corner
shallower than 1.20 m … so 1.20 m spans effectively the whole graded population"*. Maximal coverage is
the goal of a depth tint. A shoreline band wants **minimal** coverage.

### The sweep the round did not run — and it overturns "it is not a tuning problem"

The build swept 0.60 / 1.20 / 1.35 at the failing pose, read 1 px at every constant, and concluded the
constant cannot help. **All three sit above the median depth in frame**, i.e. entirely inside the
broad regime. I copied its instrument, added four arms below 0.60 (and changed nothing else), and ran
`edge-b135` at thresholds 6 and 10:

| arm | band | width @thr10 | mean luma | presence |
|---|---:|---:|---:|---:|
| `prefix` (r2) | — | 3 | 67.939 | 100.0% |
| `r3` | 1e-4 | 1 | 52.070 | 59.7% |
| **`band-0.10`** | **0.10 m** | **34** | **48.464** | **50.6%** |
| `band-0.20` | 0.20 m | 34 | 47.677 | 48.6% |
| `band-0.30` | 0.30 m | 34 | 47.152 | 47.2% |
| `band-0.45` | 0.45 m | 34 | 46.523 | 45.6% |
| `band-0.60` | 0.60 m | 34 | 45.977 | 44.2% |
| **`fixed` (SHIPPED)** | **1.20 m** | **34** | **44.596** | **40.7%** |

**The width is flat at 34 px across a 12× range of the constant. Only the darkness moves.** So the
shipped 1.20 m is *dominated*: identical width, ten percentage points less water. What is actually
true is narrower and more useful than either party's claim — **the width is a step function of
whether a band exists at all, not a function of its size**, and beyond that the constant buys nothing
but absence.

**What I did not establish:** I ran this at `edge-b135` only. The build's failing pose is `edge-b225`,
where I did **not** test below 0.60. Nobody should read "0.10 m rescues `edge-b225`" into that table.

### So the ruling is neither of the two the build offered

The build framed it as *keep the mechanism at 1.20* versus *set it to 1e-4 and ship round 3*. On the
numbers both are wrong. **KEEP the mechanism; set the default to 0.10 m.** It is one number, it is
exactly as reversible as the build's own, and it is not my preference — it is the dominating point of
the shipped parameter on the build's own instrument.

---

## Job 3 — CONFIRMED, both halves, and it is the clean result of the round

`depthWrite` is **false** for the entire water family, structurally:
`game/src/render/visual-foundation.js:689` — `depthWrite: options.depthWrite ?? family!=='water'` —
and on all four live materials in the banked `gpu_state_before`. The r3 status file is corrected.

The sort test, arithmetic re-done by me on the banked luma: the wet-bank strip moves
**−1.845 on 44.362 (−4.16%)**, the water plane **−22.231 on 66.945 (−33.21%)**, the land leak
**−0.568 on 76.598 (−0.74%)** — inside the 1.18% pin replicate. **The strip moves 8.0× less, as a
fraction, than the water it sits on. The r3 build's overturn condition #3 does not fire.**

---

## Job 4 — one confirmed, one refuted

**The HUD label is stale — CONFIRMED, and visibly.** The banked `stand_verification` reads
`teleport_offset_m: 0.00`, running-field `regionAt` = `deep-marshes` at both the deck point and the
player, `hud_region_name: "The Deep Marshes"`; my offline `WorldField` agrees. The label **drawn in
the frame** reads `western-rootlands` in every one of `edge-b045/b135/b225/b315`. Three rounds of F7
evidence have been under suspicion for this. **That suspicion is withdrawn.**

**HAZARDS §25 is NOT measured by this round.** `own_mask_delta_pct` rises **monotonically with capture
ordinal in all six runs I have**, the build's five and my own:

| run, thr10 | o0 | o1 | o2 | o3 | o4 |
|---|---:|---:|---:|---:|---:|
| `dm-edge2` | prefix −1.66 | r3 −0.54 | r3-shader +12.97 | **fixed +23.24** | **no-shorefade +35.67** |
| `dm-edge` | prefix −0.30 | r3 +10.65 | r3-shader +42.91 | fixed +56.55 | no-shorefade +63.32 |
| `dm-b045` | prefix +0.01 | r3 +11.14 | fixed +31.55 | | |
| mine (8 arms) | prefix −1.57 | r3 +1.60 | 0.10 +16.10 | 0.20 +28.71 | … 1.20 **+45.12** |

**The falsifier is `no-shorefade`.** It sets `uWaterShoreFade = 0`, so its water alpha is *identical to
the pin arm's* and of every arm it should move the mask **least**. It moves it **most** — and it is
captured last. In my own run the delta rises monotonically across all eight ordinals, including
between two bands 0.10 m apart. So *"the fix moves its own mask +23.24% where the pin's replicate is
−1.13% — a measured 20× effect"* is **drift accumulating with capture order**, not an arm choosing its
own pixels. §25 stays true as a hazard on the r3 critic's original frame-pair evidence; **round 4's
band should not be quoted as its measurement.** One order-reversed run settles it; I launched exactly
that and killed it by PID when contention hit 4.53 per core against a ceiling of 4.0. It is owed.

**Threshold 6 is unstable and the round says it is stable.** `prefix` *is* the mask arm, so its
own-mask delta is the instrument re-measuring an unchanged shader: **+61.75 / +51.07 / +33.56 / +19.87
/ −0.03%** at the five poses, against a published back-to-back replicate of **+5.73 / +1.18 / +1.33 /
+2.15 / +0.12%**. The replicate is taken `PIN → PIN2` back to back; the arms are measured across
shader round-trips, so it understates by 10–50×. **Threshold 10 is the only stable threshold, and
every headline row in the status file is a threshold-6 row.**

Re-read at threshold 10, closed width, `prefix / r3 / fixed`:

| pose | thr10 |
|---|---|
| `edge-b045` | **20 / 20 / 20 — no change at all** |
| `edge-b135` | 5 / 1 / **33** |
| `edge-b225` | 2 / 2 / 1 |
| `edge-b315` | 5 / 6 / 5 |

So the status's second "improvement", `edge-b045` 15 → 17, **exists only at threshold 6 — at the pose
whose mask arm drifts +61.75%.** The acceptance fails either way, at 1 against a bar of 12.

**And the build's own named overturn condition does not fire — the opposite is true.** It asks a critic
to attack the morphological closing. Run at the same pose in a second process, the **closed** width
reproduces on every arm (5/1/33 vs 3/1/34); **`shore_raw` — the figure it offers as the honest
r3-comparable one — moved 1 → 33 on an *unchanged* arm between two runs**, which is the size of the
entire headline effect. The closing is the reliable half.

---

## Job 5 — what it owes, and one thing it published that cannot be checked

Owed and confirmed owed: the **S52 matched-luminance null** (`null_calibration: null` in the
artifacts — there is no null row, and no claim in this round is protected by one), three more Western
Rootlands bearings, `TemporalVar`, and `RI-VIS04` §8's supersample test, without which a passing
`NormalEnergy` cannot be told from the dither stipple that is plainly the dominant texture of our
water at every pose I opened.

**The frame-time figures are not in the banked evidence.** `dm-perf/sweep.json` carries `perf: {}`, and
grepping the whole artifact tree for `3703` or `5605` returns nothing. The *conclusion* is
independently supported and I confirm it from source — `game/src/engine.js:9379-9381` puts
`renderCpuMs` in `_unmeasurable`, *"this container is SwiftShader; a wall-clock render time here is a
fact about the software rasteriser, not the game"* — but the numbers published to prove it cannot be
verified. That is HAZARDS §18's shape.

**On its two self-reported failures:** the `water.js` template-literal break is real, cost the whole
branch its browser tooling, and is written up as HAZARDS §26 — I re-ran the check it prescribes and
the literal is whole now. The blind-census error is the more interesting one, because the build caught
it *itself*, by running the command instead of quoting the r3 verdict. My own derivation: **81
reference items** declare `blind_pair: yes` (`grep -rl … | grep -E '/RI-[^/]*\.md$' | wc -l`); the
strict field form returns **0**; and enumerating every wave-1 verdict's `blind_comparisons[].status`,
the only `done` rows are the ten in the two Protocol A verdicts. **81 items, and Protocol A is the
entire blind-judgement history of this project.**

**One internal contradiction to flag:** `pose_set_completeness` says the Deep Marshes set is 4 of 4
and M12a clause 1 satisfied; `method_deviations[2]` says only 3 are valid and clause 1 is satisfied in
neither region. On the artifacts the first is right — all four bearings have non-void rows with
`water_edge_verified.on_screen` true. It changes no outcome, but a critic reading the deviations alone
would void the whole pose set.

---

## Why it scores 2 rather than 3

1. **The game looks worse at the region a player starts in, and now there is a number for it.** Worst
   pose `presence` **41.2%**; 8–14% darker at every pose measured; the preservation half of the r3
   remedy's paired acceptance failed at 4 of 4 poses taken. `RI-WLD10` §10.1's *"water is opaque before
   it is reflective"* is contradicted by a term that drops alpha to 0.42× over 65% (Deep Marshes) and
   98.6% (Western Rootlands) of the water in frame.
2. **`RI-VIS03` M12 two-or-more still fail at the `water_edge` shot** — `FresnelDelta` worst pose
   **0.03085** against 0.05, `ShoreDelta` worst pose **0.00610** against 0.03 — which is the item's own
   cap at 3; and on top of it the threshold the round measured at is not stable, so several published
   rows are unreadable rather than merely failing.
3. **`RI-VIS04` §9's fourth MIN BAR component is present as a mechanism and mis-scaled into something
   else.** Nothing was added this round; §9's HAVE still names a depth-buffer read, refraction, foam
   and a scum layer, none of which exist.
4. **The blind gate has still never run**, for any item, in this project's history bar Protocol A.

**What the round did that deserves saying plainly, because it is rarer than a passing number:** it
refused its own headline, published the pose that killed its own `FresnelDelta` row, kept a void run on
disk and labelled it void, wrote up the branch-wide defect it caused as a hazard for everyone else, and
caught its own inherited census error by running the command. **Three of my findings only exist because
it banked the arms that falsify it** — `no-shorefade`, `water-hidden` and the per-ordinal mask deltas
were all its own captures. A round that had graded itself would have shipped "1 px → 34 px".

---

## The single biggest gap

**`GAP-W1-F7-the-shore-band-is-scaled-to-the-water-body-not-to-the-bank`.** The band's constant
(1.20 m) exceeds the median water depth in both measured regions, so the term acts as a transparency
multiplier over 65.1% / 98.6% of the water rather than as a shoreline fade — producing the absent-water
cost *and* the missing gradient from one cause. **Remedy, in F7's own file, in this order:** (a) set
`uWaterShoreBandM`'s default to **0.10 m** — measured to hold the full 34 px width at `edge-b135` while
returning ten points of `presence`; (b) re-sweep 0.10/0.20/0.30 at `edge-b225` and in the Western
Rootlands, because the failing pose was never tested in that regime; (c) report `presence` against the
`water-hidden` frame on every row. **Acceptance, paired, per S59 and S60:** `gradient_width_px ≥ 12`
at the **worst** pose of a complete 4-bearing set in the Deep Marshes, at **threshold 10** (the only
threshold whose mask arm is stable), **AND** `presence ≥ 90%` at every pose in both regions, **AND**
the mask control run with arms in **both orders** so `own_mask_delta` can be attributed.

---

## What I could not do

**No motion.** I judged 5 bearings × 3–8 arms of stills plus the water-hidden control, from two
regions — many angles, but the owner's directive is explicit that stills are not enough, and every
tool in this piece freezes `uWaterPhase` by design. `TemporalVar` is a fifth round unmeasured and this
is the same hole. · **No order-reversed mask control** — launched, then killed by PID at 4.53 load per
core. · **No sweep below 0.60 m at `edge-b225`**, the failing pose, so I have not shown a small band
rescues it. · **No S52 null of my own**, so my `band-0.10` result is unprotected by a matched-luminance
control exactly as the build's is. · **No blind pair** — `blind_status: not_possible`, 0, fail-closed.
A critic cannot spawn a fresh judge; `CLAUDE.md` rule 0e puts it with the orchestrator, **and my brief
says a pack-builder for another item is running now, so the debt is moving.** · **I did not write the
dither-stipple reference item either.** Four critics have now named it. It is the dominant texture of
our water at eye level and it contaminates the one M12 sub-metric that passes.
