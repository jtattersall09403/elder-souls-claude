# W1-30-SHADOW-CASTERS — round 1 verdict

**Critic:** fresh, did not build any of this. **Branch:** `codex/wave1-build-experiment`.
**Piece under test:** two measured one-line fixes handed over by W1-30B and W1-30F, plus the third
defect the builder found underneath them — `world/aerial.js` and `render/sky.js` patching the same
four `THREE.ShaderChunk` fog chunks at module scope.

**Verdict: PASS, 7 (min over six named axes), with two corrections to the report that do not
change any landed decision and one defect that is not this piece's to fix.**

The order below is the order the builder itself asked a critic to take.

---

## 1. R1 — is the surviving atmosphere actually better, or only different?

**Better, by a factor of nineteen, and the arm that says so could have said the opposite.**

`tools/visual/w1-30-fog-owner-ab.mjs` renders the same Deck vistas twice. The only difference
between the arms is one source line: `installAerialPerspective()` is commented out at HEAD, and is
uncommented in a `tools/control-clone.mjs` copy of `game/` (826 files hard-linked, one file
writable, the real tree verified untouched afterwards). Neither arm asserts which module owns the
chunks — both read `THREE.ShaderChunk.fog_fragment` back out of the live page and stamp the answer
into the report.

| Deck vista | σ₀ (per m) | H (m) | camera Y | 95% fog at, `render/sky.js` | 95% fog at, `world/aerial.js` |
|---|---:|---:|---:|---:|---:|
| vista-blackwood | 0.005805 | 55 | 31.3 | **912 m** | **48 m** |
| vista-deep-marshes | 0.006023 | 26 | 27.2 | **1414 m** | **23 m** |
| vista-salt-hills | 0.002851 | 340 | 168.6 | **1726 m** | **294 m** |

σ₀, H and camera Y are **byte-identical between the arms** — the world, the region record, the
weather and the camera are the same in both, and only the fog law differs. `uAerial_declared` is
`false` at HEAD and `true` in the clone, so the control demonstrably applied.

The pictures agree with the arithmetic and are the evidence that matters
(`reports/visual-truth/fog-owner/*/frames/vista-deep-marshes.png`): at HEAD the Deep Marshes is a
legible flooded forest reaching a treeline at the horizon; with the aerial chunks reinstated the
same camera at the same instant is a flat grey wash with a hard horizon line and a handful of near
trunks fading out at about twenty metres.

**So R1 is not a preference between two models. Only one of the two draws a world.** The builder's
own overturning condition — *"a capture showing sky.js's model is the WORSE picture"* — was tested
and not met.

### 1a. Some of the credit did belong to the wrong implementation, and the instrument cannot tell

The brief asked whether W1-30F's *"13 of 13 regions improved, unusable frames 9 → 5"* survives.
Run `tools/visual/frame-stats.mjs` — the exact screen that claim rests on — over both arms above:

| vista | dominant %, sky.js | edge %, sky.js | span, sky.js | dominant %, aerial | edge %, aerial | span, aerial |
|---|---:|---:|---:|---:|---:|---:|
| vista-deep-marshes | 6.0 | **15.22** | 140 | 35.3 | **2.74** | 96 |
| vista-salt-hills | 11.2 | 2.79 | 128 | 11.2 | **3.05** | **160** |
| vista-blackwood | 4.0 | 22.32 | 98 | 4.0 | 22.16 | 99 |

Three separate things fall out of that table, and the second is the important one.

1. Where distance is visible, the screen agrees emphatically with R1 (Deep Marshes, 15.22 against
   2.74, a 5.6× collapse in edge density).
2. **At vista-salt-hills the screen mildly PREFERS the broken model** — higher edge density and a
   wider tonal span — because that camera sits 168 m up in a 340 m haze layer, where aerial's
   `smoothstep` wall lands at 294 m and reads as crisper than a Beer-Lambert ramp. A statistic that
   prefers a model which paints the Deep Marshes opaque at 23 m cannot arbitrate between two
   atmospheres. This is the plan's own rule biting exactly where the round needed it: *statistics
   are a regression tripwire only; they can fail a build and they can never pass one.*
3. **vista-blackwood is confirmed as a non-instrument by a third party.** A nineteen-fold change in
   the fog wall moves its three numbers by 0.1 points, because F8 is right and that camera sees no
   distance at all. The builder's F8 stands, and so does W1-30V's `vista-valus-ridge` finding.

**Consequence for the record: W1-30F's 13/13 is not transferable to the model that ships**, and no
one should quote it against the current build. It was measured through `aerial.js`'s chunks while
they were clobbering `sky.js`, and the instrument that produced it has now been shown to rank the
two models the wrong way round at one of three sites. Re-taking it under the shipped model is a
piece of work, not a paragraph; it is named in the gap below.

### 1b. The sweep, and the commented path

**Module-scope `THREE.ShaderChunk` patching in `game/src`: exactly two files, both known** —
`world/aerial.js` (inside `installAerialPerspective()`, now uncalled) and `render/sky.js` (at module
scope, line 236). Nothing else in the tree mutates `ShaderChunk`, `ShaderLib` or `UniformsLib`.

**The commented path is genuinely dead, confirmed at runtime rather than by grep.**
`installAerialPerspective` has one import site (`province.js:15`) and one call site (line 144,
commented). The live page reports `fog_fragment` owned by `render/sky.js` and
`uAerial_declared: false`, which also proves `THREE.ShaderLib` was never touched — so no material
carries a stale `uAerial` and there is no second import route.

**But the pattern has a second, larger and older instance, and the builder is right that it is a
pattern.** `tools/visual/w1-30-shader-hook-collision.mjs` is the standing gate the builder asked
for and could not afford, generalised from the chunk registry to the other global shader hook:

- `Material.copy()` in the vendored three r180 (`three.core.js:17236`) does **not** copy
  `onBeforeCompile`, and **does** deep-copy `userData` through `JSON.parse(JSON.stringify(...))`.
- So every `.clone()` of a `worldMaterial()` silently drops `installSurfaceShader`'s
  detail-normal / wear / wetness pass **while keeping `userData.surfaceUniforms`** — the
  bookkeeping any census would read survives; the shader does not.
- Measured in the page: **305 of 406 materials carrying `surfaceUniforms` have an
  `onBeforeCompile` that no longer installs them**, including `actor-body:saxhleel:skin` and
  `:cloth` — the player's own body.
- The mechanism arm is explicit rather than inferred: take a material whose hook is intact, clone
  it, ask the clone. `source hook installs surface = true; after .clone() hook installs surface =
  false; clone still carries userData.surfaceUniforms = true`.
- A second, smaller mechanism sits beside it: `visual-foundation.js#installSurfaceShader` chains
  `prior`, while `water.js#installWaterShader` and `actor.js#installWaterline` assign over the top.
  Order saves the water case today; nothing enforces it.

**This is not this round's defect and not this round's file** (`visual-foundation.js`, `actor.js`),
and it predates the piece. It is reported because the builder asked for the sweep and because it is
the same failure shape at ten times the blast radius: *the loser fails invisibly, and the census
says everything is fine.*

The gate can fail, which is what makes it a gate. It goes red two independent ways: with
`--sabotage` (re-install aerial's chunks in the page and force a recompile) and against the control
clone. Both were run.

---

## 2. The 1080p budget, re-taken independently — the ruling holds, and the strange result is the instrument

The builder wrote R4 declining the canopy on cost, named a 1080p hardware frame-time budget as what
would overturn it, went and took that budget, and was overturned by its own evidence. That is
exemplary and I want to say so before the corrections. The corrections do not move the decision.

**The arms are not six. They are four, and two pairs are the same arm run twice.**
`w1-30-shadow-casters.mjs#applyArm()` only ever turns flags **on** (`&& !o.castShadow`). Once
`ground`, `ground-skin` and `geology:*` landed as casters in `province.js`, the `terrain` and
`geology` subsets became no-ops. Read straight out of the run's own JSON:

| site | pair | caster triangles | `flagged.cast` | medians | spread |
|---|---|---:|---:|---|---:|
| vista-blackwood | `base` vs `terrain` | 492,990 both | 0 both | 6.09 / 6.12 | 0.03 |
| vista-blackwood | `terrain+canopy` vs `+geology` | 1,356,166 both | 246 both | 5.56 / 5.92 | 0.36 |
| vista-salt-hills | `base` vs `terrain` | 485,458 both | 0 both | 13.73 / 13.60 | 0.13 |
| vista-salt-hills | `terrain+canopy` vs `+geology` | 705,106 both | 162 both | 14.87 / 13.28 | **1.59** |
| spawn | `base` vs `terrain` | 485,458 both | 0 both | 14.37 / 13.82 | 0.55 |
| spawn | `terrain+canopy` vs `+geology` | 705,106 both | 162 both | 14.08 / 15.31 | **1.23** |

**Six same-configuration repeats. Median spread 0.55 ms, maximum 1.59 ms.** That is a repeatability
estimate the run contains and nobody claimed, and it is the answer to *"the arms are not even
monotone in triangle count, which is what below-the-noise looks like"*: the arms are not monotone
because **two of them are literally the same arm**, and the noise is measured rather than inferred.

Against that floor, what the canopy costs (pair means, so the duplicates are used rather than
double-counted):

| site | base pair | canopy pair | Δ | for | everything | Δ | for |
|---|---:|---:|---:|---:|---:|---:|---:|
| vista-blackwood | 6.11 | 5.74 | **−0.37 ms** | +863,176 tris | 6.01 | −0.10 ms | +1,336,758 |
| vista-salt-hills | 13.66 | 14.07 | **+0.41 ms** | +219,648 tris | 13.98 | +0.32 ms | +612,312 |
| spawn | 14.09 | 14.70 | **+0.60 ms** | +219,648 tris | 14.30 | +0.21 ms | +612,312 |

Every delta, including the every-caster-on arm, is smaller than the run's own same-configuration
spread — by a factor of about three at worst and with the wrong sign at Blackwood. **The canopy
ruling holds and is better evidenced than the builder knew.** R4's self-withdrawal stands.

**Two corrections to the report, neither of which moves a decision.**

- **F2's headline sentence crosses two sites.** *"Salt Hills: base 13.73 ms median at 485,458
  shadow-pass triangles, everything-on 13.98 ms at 1,829,748."* At Salt Hills `everything` is
  **1,097,770** triangles; 1,829,748 is Blackwood's, whose medians are 6.09 → 6.01. No row of the
  table reads as that sentence does.
- **F3's first entry is vacuous.** *"terrain alone 0.009%"* is an arm with `flagged.cast: 0` — it
  turned on nothing, because the flags were already in the source. The 0.009% is a receiver-only
  change on a mesh 750 m away, not a measurement of what terrain casting buys. The builder blamed
  the camera (F8); the camera is also bad, but the arm was empty first.

**What the budget does and does not establish, stated precisely.** It establishes that *no
shadow-pass cost is detectable in end-to-end `stepFrames(1)` wall clock on an L4 at 1080p*. It does
not establish that the shadow pass is cheap: `frameMs()` times a Node↔CDP round trip around one
simulation step, `nvidia-smi.csv` in the run holds only the GPU's identity line and never sampled
utilisation, and the medians are not ordered by triangle count across sites (Blackwood is 6 ms with
1.36 M triangles; Salt Hills is 13.7 ms with 485 k). The instrument is dominated by something other
than the GPU. That is enough to land the canopy — a cost invisible end-to-end is invisible to a
player on that machine — and it is not enough to retire the question for weaker hardware.

**Remediation, one line each:** sample `nvidia-smi --query-gpu=utilization.gpu --format=csv -l 1 &`
alongside the capture, and wrap the shadow pass in `EXT_disjoint_timer_query`. And give
`applyArm()` a subtractive mode so `base` can mean *shipped minus the change* rather than *shipped*
— without it, R2's terrain flags (+127,552 triangles) have a triangle census and no hardware arm at
all, because the only run that could have priced them was taken after they landed.

---

## 3. The Deep Marshes bands — the accusation was correctly falsified and the attribution is wrong

The builder saw regular parallel bands on the Deep Marshes ground, suspected its own terrain caster
flags, ran an A/B, and found the bands identical with the flags off. That control could have
condemned the change and did not; it was run honestly and it is right.

The attribution that followed it was not tested: *"they belong to something that was already
casting (the province is full of posts, piles and landmark trunks that always have)."*

Take the committed hardware stills, high-pass a fixed band-rich crop (x 560–900, y 300–470, chosen
off the frames before any arm was run) and cross-correlate:

| pair | ρ |
|---|---:|
| Deep Marshes t0800 vs t1300 | **0.844** |
| Deep Marshes t0800 vs t1930 | **0.666** |
| Deep Marshes t1300 vs t1930 | **0.689** |
| Deep Marshes t1300 clear vs t1300 rain | 0.896 |
| *negative control:* Deep Marshes t1300 vs Blackwood t1300, same crop | **0.046** |

The negative control works, so the statistic discriminates. **A sun-driven shadow pattern cannot be
0.67–0.84 self-similar from 08:00 to 19:30** — the individual tree shadows in those same frames
visibly swing through the day while the bands do not move at all. The bands are locked to the
world, not to the sun.

`tools/visual/w1-30-deep-marshes-bands.mjs` then names the owner in the page. Each arm hides or
disables one candidate and is correlated against an untouched baseline over the same crop; the arm
whose correlation collapses owns the bands.

| arm | ρ vs baseline | band energy | what it did |
|---|---:|---:|---|
| *baseline* | 1.000 | 5.372 | — |
| `shadows-off` (`setFeature('shadows', false)`) | **0.990** | 5.301 | the whole shadow system off |
| `water-hidden` | **0.335** | **3.111** | 94 water meshes hidden |
| `skin-hidden` | 0.978 | 5.402 | 1 `ground-skin` mesh hidden |

**Turning off every shadow in the game changes the band pattern by ρ = 0.99 and 1% of its energy.
Hiding the water collapses it to ρ = 0.335 and takes 42% of its energy away.**

**The bands are the water surface.** They are not shadow acne, they are not cast by posts, piles or
landmark trunks, and no caster flag on any mesh could have produced or removed them — which means
the builder's A/B was structurally incapable of finding their owner even though it was run
correctly. `render/water.js`'s own header records that its first wave field produced *"the
axis-aligned 20 m light/dark lanes"* that the crossed incommensurate waves were introduced to
remove. The lanes are still there.

And they are not confined to the Deep Marshes. The hardware frame
`reports/runpod-gpu/runs/critic-canopy-motion/artifacts/shimmer/frames/B-canopy-on-f0048.png`,
taken at **eye-blackwood** on an RTX A5000, is a flooded forest crossed by a dozen evenly spaced
parallel lanes running to a vanishing point — the most conspicuous single artefact in the frame,
and present identically in the canopy-off arm.

**Owner: `game/src/render/water.js` (W1-30H's file by the plan's decomposition, W1-30S's seam
today).** Not this piece's, and it should be told rather than left in a status file.

---

## 4. Motion evidence for the canopy — the gap the builder named first

The builder's `could_not_do` #1 is honest and is the largest hole: all twelve hardware motion
sequences predate the canopy and geology flags, so nobody had watched a walk with the canopy
casting, and sub-texel shimmer is precisely what a still cannot show.

`tools/visual/w1-30-canopy-shimmer.mjs` takes that measurement, and it deliberately does **not** use
a frame-to-frame pixel diff — everything in a forest frame moves, and a shadow that sweeps smoothly
across the ground is the feature. The statistic is the **zero-crossing rate of each pixel's
luminance time series**: a smooth ramp contributes zero reversals, a texel flip contributes one per
reversal. Three arms walk the identical scripted path through the real input pipeline, so the
foliage animation and camera track are identical by construction:

- **A** `canopy-off` — the state before this round.
- **B** `canopy-on` — HEAD.
- **C** `canopy+under+rock` — **the set R5 declined**, and the positive control. If C does not read
  higher than B, this instrument cannot see shimmer and its verdict on B is worthless. That is
  checked as `INSTRUMENT-CAN-SEE-SHIMMER` rather than assumed.

The arms are not additive-only: `setCasters()` writes the value it wants and reports how many
meshes it changed, so a duplicate arm is visible instead of passing as a second copy of its
neighbour — which is the defect §2 found in the builder's own harness.

**Taken on hardware** — RTX A5000, `ANGLE (NVIDIA, Vulkan 1.4.312)`, `software: false`, 90 frames
per arm at 960×540, eye-blackwood, 13:00 clear, zero page errors:

| arm | caster meshes | caster triangles | flags changed | **flicker / px / 10 frames** | pixels that moved |
|---|---:|---:|---|---:|---:|
| A `canopy-off` | 1,285 | 492,330 | 246 canopy → false | **1.848** | 96.4% |
| B `canopy-on` (HEAD) | 1,531 | 1,345,138 | 246 canopy → true | **1.888** | 96.0% |
| C `canopy+under+rock` | 1,617 | 1,732,544 | 86 under/rock → true | **2.017** | 98.6% |

- `ARMS-ARE-DISTINCT` **PASS** — 492,330 < 1,345,138 < 1,732,544, and every arm reports the
  meshes it actually changed, so none is a silent duplicate.
- `INSTRUMENT-CAN-SEE-SHIMMER` **PASS** — the set R5 declined reads **6.8% higher** than the
  shipped set on the identical walk. The instrument is not blind, which is what makes B's number
  mean anything.
- `CANOPY-DOES-NOT-SHIMMER` **PASS** — B is **2.2%** above A, well inside the 25% allowance.

**So the canopy's shadow does not shimmer in motion, on real hardware, and R5's caution about the
sub-texel buckets is corroborated rather than merely asserted.** The builder's largest declared
gap is closed, and the answer is the one it hoped for.

**The honest limit on that, stated rather than left to be found:** each arm was walked once, so I
have no repeatability estimate for the flicker statistic itself — exactly the criticism §2 makes of
the builder's budget, and I am not exempt from it. The 2.2% and 6.8% gaps are single observations.
What is robust is the *ordering* (A < B < C, monotone in sub-texel content) and the absence of any
step change at B; a claim that 6.8% is significant would need the walk repeated.

Alongside it, a 180-frame `boundary-walk` through the flooded forest on the same Pod
(`reports/runpod-gpu/runs/critic-canopy-motion/artifacts/motion/contact/boundary-walk.png`,
180 frames, 180 distinct, hardware-attested). Set beside the builder's pre-canopy sheet, the
difference is easy to see and is a plain improvement: the forest floor was a bright plane crossed
by thin lanes and is now dappled with broad, soft-edged canopy shade that tracks the camera
smoothly. That is the first forest walk with the canopy casting that exists.

Cost of both: one RTX A5000 at $0.27/hr for 4.3 minutes. Pod deleted and deletion confirmed by API
lookup; `cleanup --dry-run` afterwards shows nothing of mine outstanding.

---

## 5. Method — did the round hold to its own bar?

**Yes, and unusually well.** The builder explicitly avoided `HAZARDS.md` §0's fifth failure shape:
its first before/after for the fog field *would have moved zero pixels*, because `sky.js`'s
stand-in table holds the same thirteen numbers as `regions.json`, so both arms would have agreed
about a false premise. It said so, threw the arm away, and built one that can fail — perturb the
live region record, watch `scene.fog.heightFalloff` follow 70 → 280 and 6.47% of the frame move,
against 2.55% at that site's own nondeterminism floor with the fix deleted. That is the right
answer to the right question and it is rare.

Holding myself to the same test: **which input do all my arms supply identically?** The fog A/B
supplies the region records, the terrain raster and the camera list identically — and that is the
control, not the flaw, because those are the shared world both models are being asked to draw, and
neither arm fabricates them. The disputed input, the chunk owner, is read out of the page by both
arms and differs. The shimmer arms supply the walk script identically, deliberately, and differ in
the caster census each reads back off the scene graph. The bands correlation supplies the crop
identically and is anchored by a negative control that reads 0.046.

Where the round is weaker: **every appearance number in it is a statistic.** No human has read any
of these frames and no Craft number exists, so the plan's `Craft ≥ 7.0` row and Ruling W2's *"show
the artefact as a player meets it and ask whether it is good"* are unmet for this piece. The
builder says so plainly in `could_not_do`. This verdict inherits that limit and cannot lift it.

---

## 6. Scores, minimum over axes

| axis | score | why |
|---|---:|---|
| **A1 — diagnosis of the shader-chunk collision** | 10 | Read out of the live page, not inferred. Exactly the right fix, exactly the right reversal, and it was not in the brief. |
| **A2 — the canopy cost ruling and its evidence** | 8 | Right decision, self-overturned by its own tripwire, and the noise floor is stronger than claimed. Docked for the crossed-site headline, the vacuous `terrain` arm, and a budget whose duplicate arms went unnoticed. |
| **A3 — null controls** | 9 | Plausible-wrong-answer controls throughout (`wrongset`, `--deleteFix`, the acne A/B that could have condemned the change). One control was structurally impossible and that was stated rather than faked. |
| **A4 — motion and orbit evidence** | **7** | The binding axis. The piece landed a caster change whose named risk is temporal and shipped zero motion frames of it, and said so first. Now taken by this critic rather than by the builder, which is the correct order but leaves the round itself stills-only. |
| **A5 — attribution and ownership of what it found** | 7 | The acne accusation was falsified honestly; the follow-on attribution to "posts, piles and landmark trunks" is wrong and untested, and the bands are visible in a shipped frame. |
| **A6 — honesty of the report** | 10 | `could_not_do` names the forty minutes lost to a buffered pipe, the settling artefact, the arm it could not build, and the gap it most wanted closed. This file was easy to critique because it told the truth. |

**Overall: 7 — minimum over axes, no averaging. PASS against the wave-1 gate of 7.0.**

Nothing landed by this round is recommended for reversal. R1, R2, R3 and the withdrawn R4 all
stand; R5 and R6 remain correctly untaken.

---

## 7. The one gap

**Nobody has re-taken the height-fog result under the model that ships.** The thirteen-region
before/after that justifies the whole atmosphere line — *13 of 13 improved, 9 of 13 unusable frames
down to 5* — was rendered through `aerial.js`'s chunks while they were deleting `sky.js`, and the
screen that produced it has now been shown to rank the two models the wrong way round at one of the
three sites I tested. The number is not wrong so much as **about a build that no longer exists**,
and it is currently the headline evidence for region identity.

**Remedy, and it is small:** re-run the thirteen region vistas at HEAD with `heightFog` on and off
— `sky.js` already exposes the switch, and setting `heightFalloff = 0` degenerates its integral to
plain Beer-Lambert, which is the honest before-arm. Publish both, retire the old pair, and stop
quoting 9 → 5 against the current tree. One capture run.

**Severity: major.** Not because the atmosphere is wrong — §1 shows it is much better — but because
the number in circulation is unanchored, and the project's own rule is that a measurement is a
claim about a commit rather than about the project.
