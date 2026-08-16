# W1-F7-WATER — round 5 verdict

**FAIL, 2 / 10** (min over four items: RI-WLD10 2, RI-VIS03 2, RI-VIS04 3, RI-VIS11 2). Held at 2,
not lowered. Pass threshold 7.

**Critic:** fresh context, built none of this, launched no browser. Every number below was computed
this turn from the round's banked artifacts or by re-running its offline tools. Working is in
`artifacts/W1-F7-WATER-r5-critic/critic-measurements.json`, blocks A–J, each naming its command.

---

## The headline

The shipped change is real, small and correctly directed. The round's own instrument work has
destroyed the evidence class its acceptance clause was written in.

**1. Threshold 16 is genuinely stable and I reproduce it on five runs, not four.** Recomputing from
the raw `baseline_captures`, the unchanged arm's own mask spreads **0.14 / 0.26 / 0.26 / 0.33 / 0.54 /
0.54 %** at threshold 16 across six pose-runs, two poses and five commits, against **28.21 / 33.68 /
50.22 / 50.22 / 55.75 %** at threshold 10. The round undercounted itself — `dm-b135-null` also carries
baselines and reproduces `dm-b135-verify`'s to three decimals in a separate process at a later commit.
The order-reversed control agrees: one unchanged arm at two ordinals moves 12.52 points at threshold
10 and 0.02 at threshold 16.

**But it stabilises the mask and not presence.** `presence_pct_if_scored_as_an_arm` has range
**4.04 / 3.98 / 3.91** points at thresholds 6 / 10 / 16 — flat. The threshold choice bought nothing
for the round's own headline unit. The presence numbers survive anyway, because the effects reported
(9.29 to 30.67 points) sit an order of magnitude outside a ~3.9-point band and the round publishes
the band beside every number. But "threshold 16 is the stable threshold" is true of the mask only,
and must not travel further than that.

**2. The S52 null does not protect either width measure — and I derived that before the
orchestrator's correction reached me.** Opening `dm-b135-null/sweep.json` I found `null-t0.90`
present with full metrics and a frame on disk, in the same commit (`d597e2cd`) whose message reads
*"S52 matched null passes"* and whose status edit says that arm *"did not capture"*.

The null family's closed-profile span at threshold 16 runs **+6.255 → +3.153 → +0.021 → −3.06**
against the arm's **−7.664** — monotone in brightness, crossing zero at almost exactly the matched
point. The tool refuses to measure below `|span| 0.6`. So *"no measurable transition at the matched
point"* is the zero-crossing of the null's own profile landing on the matched brightness: an
**amplitude coincidence, not an absent mechanism**. At that same matched point the raw width reads
**25** against the arm's **30**; one step darker the closed width reads **31** against the arm's
**32**. And the profiles are the same curve — the arm rises 50.8 → 63.5 by distance bin 6 then falls
to 47 by bin 24; `null-t0.90`, with no depth dependence, no `k` and no shore geometry, rises 45.1 →
51.9 by bin 6 then falls to 47.2 by bin 24.

**3. The reason is in the measure's construction, and it settles every round at once.** I
re-implemented `shoreProfile()` and tested it. `gradient_width_px` is **exactly invariant under any
rescaling of the luma profile** — it is `d90 − d10` on a span-normalised curve, with the only
amplitude gate being the `|span| ≥ 0.6` refusal. Running the shipped arm's own banked profile through
my re-implementation returns its published **32 px**; compressing that same profile 10× and 25×
toward its mean — contrast cut from 7.66 luma levels to **0.77** and **0.31**, far below anything a
player could see — returns **32 px both times**.

> The measure records the spatial shape of whatever near-shore ordering exists, and nothing about its
> strength.

Under `ARBITRATION` **S63** — a metric family a null reproduces is evidence in neither direction — **no
width number in F7's history is admissible.** Not this round's 32, not round 4's 34, not round 3's 15.

---

## The four jobs

### Job 1 — the threshold. CONFIRMED, with one qualifier the round did not state.

| run | pose | captures | thr6 | thr10 | thr16 |
|---|---|---:|---:|---:|---:|
| dm-b225-sweep | edge-b225 | 9 | 57.00% | 33.68% | **0.26%** |
| dm-b135-verify | edge-b135 | 6 | 73.27% | 50.22% | **0.54%** |
| dm-b225-reverse | edge-b225 | 4 | 55.75% | 28.21% | **0.14%** |
| dm-b045-b315 | edge-b045 | 4 | — | 55.75% | **0.33%** |
| dm-b045-b315 | edge-b315 | 4 | — | 0.70% | **0.26%** |
| dm-b135-null | edge-b135 | 6 | — | 50.22% | **0.54%** |

*(own-mask spread, computed by me from `poses[].baseline_captures[].by_threshold[].own_mask_px`)*

**And I correct the round in its own favour.** Its self-criticism says width stability "is NOT
established at any threshold", citing 20 px vs 1 px at `edge-b045`. That is a comparison *across*
thresholds. *Within* each threshold the unchanged arm's width is flat in every run — `edge-b045`
reads `[20,20,17,17]` at thr10 and `[1,1,1,1]` at thr16; `edge-b225` reads `[1,1,1,1,1,1,1,1,1]`. The
width is **repeatable and threshold-conditional, not noisy** — which rules out capture noise and
points straight at the measure's construction.

### Job 2 — the decomposition. HOLDS, re-derived in my own arithmetic.

I inferred and verified the formula from the artifact —
`presence = 100 × (L_arm − L_hidden) / (L_baseline_local − L_hidden)` — and it reproduces every
published row to the digit.

| arm at `edge-b135`, thr16 | presence | cost |
|---|---:|---|
| `no-shorefade` (shore alpha off entirely) | **91.34%** | — |
| `r3` (round 3's fade, no metre band) | 60.67% | round 3's multiplier: **−30.67** |
| `band-0.10` (**SHIPPED**) | 51.38% | the band constant: **−9.29** |
| `fixed` (round 4's 1.20 m) | 41.99% | round 4's constant: −18.68 |

**So yes: three rounds of shore-band work argued about a term worth 9.29 points while a multiplier
nobody was sent at costs 30.67.**

**The ceiling nobody has stated, and it bounds round 6.** Deleting the multiplier *entirely* scores
91.34% against a 90% bar with a **3.75-point** drift band at that pose. It clears by 1.34 points
inside a 3.75-point band — not distinguishably. The multiplier is **necessary and not sufficient**;
the remaining ~8.7 points are the depth colour, which nothing has been sent at.

**The acceptance fails both halves and the round does not claim otherwise.** Presence across the
complete Deep Marshes 4-set: 100.17 / **51.38** / 100.35 / 100.62 against a 90% bar. Width: 1 / 32 /
1 / 3 against a 12 px bar.

**The before-and-after is the tidiest thing in the round.** `fixed` means the source default, so the
forward run measured it at 1.20 m and the reverse run, launched after the change landed, measured it
at 0.10 m: same arm, same pose, same threshold, same tool — **83.35% → 100.16%**. I checked the two
commits differ and that `water.js:132` now reads `0.10`.

### Job 3 — the three debts, and the null that does not hold.

- **Motion: paid**, first in five rounds — 12-bearing orbits, 58 frames, phase live.
- **`TemporalVar` 0.000341: CONFIRMED as a HARD FAIL.** I re-derived it offline from a separate
  invocation and ran the identity check myself — `md5sum` over the 30 temporal frames returns **30
  distinct hashes**, so HAZARDS §30's trap is ruled out. *Limit the round did not state:* the
  sequence was shot on the arm named `fixed` at a commit where `fixed` was still 1.20 m; the shipped
  arm has 2 frames, below the ≥ 5 the tool requires.
- **Supersample: CONFIRMED.** 64.95% survival against an 84.77% land control → `unresolved` → fails
  closed → `NormalEnergy` is no longer admissible as a pass, reversing three rounds.
- **The S52 null: half-pass at best, and on my reading it protects nothing.** See the headline.

### Job 4 — RI-VIS11 earns its place.

**I re-ran its instrument rather than reading its tables**, and §1 and §2 reproduce to the digit:
water `phase_spread_lsb` **0.528** (shipped) and **0.613** (round 2) against land controls of
**1.278** and **1.144**. There is no ordered dither on our water; four consecutive critics named one
and handed the name on.

**The §1.3 guards hold, in the strongest direction.** The first measurement ever taken against
RI-VIS11 §3 returns 64.95% — `unresolved`, fails closed — and its effect is to **remove the only M12
sub-metric F7 has been passing**. The author wrote a bar and failed itself on it.

Its two declared holes were handled correctly: the undefined middle band was amended the same turn to
`unresolved`/fail-closed per S61 with a dated note in the item's own text, and the missing land
control was computed offline rather than published without.

**One defect I found:** §2 cites `water.js` "lines 304–306" for the three procedural terms; read this
turn they are at **323–325**. The frequencies quoted are exactly right — the citation went stale
within the round when the shore-band edit landed above them. One-line fix.

### Job 5 — the self-filed defects.

**One published number is downstream of the unfixed window, and the mitigation holds it up.**
`dm-motion/sweep.json` has `motion: {}` — the entire motion block is absent from the banked artifact,
so every motion number came from the console log. HAZARDS §18's exact shape. But the round moved
`TemporalVar` into an offline tool that recomputes from the banked PNGs, and I ran it: 0.000341,
confirmed. The `mean_Yp` series and orbit frame list are not recoverable. The supersample run is
post-fix and clean.

**The one I would add:** the status file still contradicts itself. Its header says `null-t0.90` "did
not capture"; its corrected §S52 block tabulates that arm's results at both thresholds. The corrected
block is right and the header should be fixed before the next reader inherits the wrong sentence.

---

## M12, scored min-over-poses in my own reading

| sub-metric | band | worst pose (shipped arm, thr16, DM 4-set) | verdict |
|---|---|---:|---|
| `FresnelDelta` | ≥ 0.05 | **0.08639** (edge-b225) | **PASS** |
| `ShoreDelta` | ≥ 0.03 | **0.00461** (edge-b315) | FAIL — below the 0.01 floor |
| `NormalEnergy` | ≥ 0.035 | 0.06449 | `unresolved`, fails closed (RI-VIS11 §3) |
| `ReflCorr` | ≥ 0.35 | unmeasurable at 5 of 5 poses | inapplicable → S64, never a pass |
| `TemporalVar` | ≥ 0.002 | **0.000341** | **HARD FAIL** |

**I correct the round here.** It writes that `FresnelDelta` and `ShoreDelta` are "already failing at
their worst poses" and cites 0.03085 and 0.00610 — flagging both, honestly, as **inherited from the
r4 critic at threshold 6 and not re-derived**. I re-derived them. `FresnelDelta`'s worst pose over the
complete Deep Marshes set is **0.08639** at threshold 16 and **0.07002** at threshold 6: it **passes**
at every pose and every threshold I can compute. **The conclusion survives without it** — M12's
"any two failing" is met by ShoreDelta, TemporalVar, ReflCorr and NormalEnergy. Four, not three, by a
different route than the round gives.

---

## The bar finding: the `≥ 12 px` clause cannot gate, and here is what replaces it

The orchestrator asked for a ruling on its own clause. **Retire it.** The evidence is above: the
measure is amplitude-invariant by construction and a brightness-only null reproduces both of its
variants. Under S63 no number in that family is evidence in either direction.

**The replacement — an ADD, not a relaxation, and it fails this build too:**

1. **`presence`**, which is threshold-independent (spread 0.17–0.59 points across four thresholds on
   nine arms), carries a published interleaved drift band, and has a real control behind it.
2. **A contrast clause on the waterline itself**: publish `|span|` — the near-shore-to-open-water
   luma difference the width measure currently *discards* — and require it to exceed the unchanged
   arm's own drift band by a stated margin **and** to carry the expected sign. `|span|` is **not**
   scale-invariant, so a matched-luminance null *can* falsify it. Width may still be reported, but
   only conditional on the contrast clause passing first, and never as a gate alone.

**The guard I am bound by (§1.3):** a clause I write may never be the reason anything passes. This
one fails the round-5 build too — presence 51.38% at the worst pose — and I have **not** applied it
to the score, which rests entirely on the bar that already exists. It belongs in `RI-VIS03` M12
beside M12a, written by whoever drafts the round-6 brief; closing it properly needs a `|span|` drift
measurement across a pose set that nobody has run, which §1.3's third guard says is work, not a pass.

---

## The blind census, derived four ways, and the 80/81/82 drift explained

```
grep -rl "blind_pair: yes" corpus/ --include=*.md | wc -l                            -> 111
  ... excluding corpus/90-verdicts/                                                  ->  92
grep -rl "blind_pair: yes" corpus/ --include=*.md | grep -E '/RI-[^/]*\.md$' | wc -l ->  82
find corpus -name "RI-*.md" | wc -l                                                  -> 153
grep -rEn '"blind_status" *: *"run"' corpus/90-verdicts/ | wc -l                      ->   0
```

**Nothing drifted and no earlier count was wrong.** The r4 critic ran the RI-restricted form and got
81; I run the identical command and get **82**; the delta is exactly one file — **RI-VIS11, written by
this round, declaring `blind_pair: yes`.** The 98/100/101/102 figures in r1–r3 came from the *wide*
form, which counts verdict files that quote the string as instances of it — the same false-positive
shape the r3 critic caught in the `blind_status` grep.

**82 reference items declare a blind pair. Zero verdicts have ever run one.**

---

## What the frames actually look like

A number is not a picture, so I opened four.

- **`edge-b135` shipped** — a near-black murk. The water is not distinguishable *as water*; it reads
  as wet mud, under heavy dotted speckle. **I could not see a waterline anywhere in the frame** —
  which is the visual counterpart of the amplitude-invariance finding.
- **`edge-b135` `no-shorefade`** — a different and far better image: a lighter blue-green sheet with
  the bed visible through it, and a real boundary against the dark bank at frame left. The
  91.34-vs-51.38 gap is the difference between a surface that looks like water and one that does not.
- **`edge-b135` `fixed` (round 4)** — darker again. The shipped change **is** a visible improvement.
  It is also small: both arms read as mud.
- **`motion-orbit` b255** — a flat teal sheet, hard polygonal facet edges, heavy speckle, no ripple,
  no specular, no waterline. That is `RI-VIS04` §9's TELL almost word for word.

**And the stale HUD label, confirmed by my own eyes:** the drawn label reads `western-rootlands` in a
Deep Marshes frame whose `stand_verification` records `deep-marshes`.

---

## Score

**2 / 10, FAIL. Held, not lowered.**

It does not fall: the delivered state is genuinely better than round 4's where a player starts —
presence up at 4 of 4 Deep Marshes bearings, +16.81 points at the pose round 4 failed hardest on,
reproduced across two capture orders, four processes and five commits, and visible in the frames.

It does not rise: nothing crossed a band. The acceptance fails both halves, M12's blue-plane clause is
met four times over including a `TemporalVar` hard fail measured for the first time in five rounds,
and the width evidence class the headline lives in is reproducible by a dimmer.

**It is not lowered for the round's honesty, which is the best conduct I have seen in this piece.**
Thirteen self-filed defects before I read a line; two write-ordering bugs found and fixed mid-run; and
a protective ruling voluntarily rewritten from a PASS to a HALF-PASS *after filing*. Most of the
findings in this verdict exist only because the round banked the arms that falsify it.

---

## What a round-6 brief must carry — and none of it is "tune the band"

1. **Retire and replace the width gate before dispatching anything**, or round 6 produces a number
   that cannot be read.
2. **The target is the multiplier at `water.js:320`** — and removing it entirely reaches 91.34%
   against a 90% bar with a 3.75-point band. Necessary, not sufficient. The brief must say so rather
   than promise a pass.
3. **Attack `TemporalVar` and `hf_survival` together** in one ablation of `water.js:323–325`. They may
   be one defect — the ripple terms contribute of order 0.008 luma against a surface at 0.180, at the
   exact frequencies that collapse under supersampling. *Candidate only: I did not ablate it, and per
   S63 I do not claim it.*

The Western Rootlands owes three bearings. The blind gate owes everything.

## What I could not do

- **I launched no browser**, deliberately, under HAZARDS §29 and the box's overnight state. I ran
  `node tools/contention.mjs` three times — 1.79 per core / GO at the start, GO mid-way, GO before
  filing — and launched nothing, so I contributed nothing to the load and took no reading with a run
  of mine in flight. The cost: I could not re-shoot the Western Rootlands, could not run the `|span|`
  drift measurement my own bar finding asks for, and could not settle which material the measured
  pixels belong to. Everything I confirm, I confirm on this round's evidence.
- **I did not re-derive the r4 `FresnelDelta` 0.03085 at its own pose.** My correction is sound for
  the Deep Marshes and is not a claim about the Western Rootlands, where this round shot 1 of 4.
- **I did not ablate the ripple coefficients.** The candidate mechanism is arithmetic over source, not
  an experiment.
- **I did not re-derive the offline band census** (59.81% / 3.11%, 100% / 17.98%). Read from the
  banked file. Marked inherited.
- **No blind pair, again.** My own reading — that one arm looks like water and the other looks like
  mud — is exactly the kind of look claim a blind pair exists to check, and it is unchecked.

**The loosest thread in my own S52 finding — named because it pointed against me, then chased down
and resolved.** Every `null-t<c>` arm records `edits_applied: 10` against `edits_expected: 2`, which
on its face suggests the shader edit did something other than advertised — and if so the "null" is
not a null and my finding collapses. Reading `applyShaderArm()` at `f7-r5-sweep.mjs:375–388`:
`edits_expected` is `edits.length` (the two replacements, `TRANS_LINE` and `BAND_LINE`), while
`__R5_EDITS` increments **once per matched needle per material recompile** across the 11 water
materials. 10 is therefore ~5 recompiled materials × 2 needles, not 10 distinct edits. Line 598
confirms the intended reading: a **zero** count is what marks an arm `VACUOUS`. And the arms' mean
luma moves 8–25 levels, which cannot happen unless the edit reached the compiled shader. **The nulls
applied. The thread closes against me and my S52 finding stands.**
