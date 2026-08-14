# W1-30A — the frame pipeline: what was wrong, what changed, and what the GPU said

Builder report. Plan: [`orchestration/plans/W1-30A.md`](../../orchestration/plans/W1-30A.md).
Status file: [`orchestration/status/W1-30A.json`](../../orchestration/status/W1-30A.json).
Branch `codex/wave1-build-experiment`.

Evidence is on hardware — **NVIDIA RTX A5000, ANGLE/Vulkan 1.4.312, driver 580.159.04** — so it is
valid for appearance claims under `W1-30-EVIDENCE.md` §4. The raw report is
`reports/w1-30a/probe/probe.json` (gitignored as a run artifact; the numbers that matter are in
this file, which is not). Contact sheets and zoom crops are alongside it, and two are published to
`docs/shots/2026-08-14-W1-30A-*.png`.

> **The rule this report obeys:** statistics can fail a build and can never pass one. Every green
> row below is permission to go and look at the contact sheets. It is not a substitute for looking.

---

## 1. The two defects, verified at file and line before any code was written

**There was no antialiasing in this game at all.** `renderer.js:75` asks the WebGL *context* for
`antialias: true`. The world is then rendered into `worldTarget` — an offscreen render target — and
a context's multisampling applies only to the default framebuffer. The request was granted and
never used. What stood in for AA was a depth-edge detector that blended four neighbours at
`edge * 0.38`: it cannot see a colour edge at constant depth, cannot see an alpha-tested edge (every
leaf in the province, whose depth is written by the whole quad), and against sky the depth delta
saturates so it smears the horizon rather than resolving it.

This survived because **jagged silhouettes are invisible in a still and obvious the moment the
camera moves.** It is the single most reliable amateur tell there is, and every screenshot review
this project has run would have passed it.

**The colour grade was a no-op.** The whole of it was `mix(vec3(luma), c, 1.035)`, a `1.015`
contrast and a `0.075` vignette — a rounding error with a comment. `game/data/world/regions.json`
gives Blackwood the palette `#1F2E1C / #4A3423 / #C9A54B` and the Stone Wastes
`#DCD2B8 / #8C5A3A / #EDEDE6`, and none of it reached a pixel. Art direction that exists only in a
plan is art direction nobody applied.

## 2. What changed

| # | change | where |
|---|---|---|
| 1 | `worldTarget.samples` — 4 at `high`, 2 at `medium`, 0 at `low`, clamped by the device `MAX_SAMPLES`, with a framebuffer-completeness probe that falls back to 0 rather than let a driver refusal show a player a black screen | `post/composite.js`, `renderer.js` |
| 2 | the depth-blur replaced by a luma-directed FXAA, aimed at the edges MSAA cannot reach (alpha-test cutouts, specular sparkle) | `post/composite.js` |
| 3 | a real grade: one base curve, plus a named variant per region, per time of day, per weather, eased across region borders and snapped on a teleport so frame hashes stay deterministic | `post/grade.js` |
| 4 | ordered dither (interleaved gradient noise, ±0.5 LSB) after the colour-space transform | `post/composite.js` |
| 5 | a wider soft-knee bloom — three rings instead of one 2-pixel ring | `post/composite.js` |
| 6 | a `high`/`medium`/`low` quality ladder, published for the settings screen and the capture harness | `renderer.js` |

**Substitution, recorded not hidden.** The plan asked for SMAA vendored from the r180 addons. SMAA
needs two ~100 KB base64 lookup textures, a three-pass ping-pong and its own render targets; FXAA is
one branch inside a pass that already exists. With MSAA carrying the geometric silhouettes, what is
left for the post pass is cutout and specular edges, where the two are close. **Reversible:** if the
motion gate fails, escalate to SMAA and only then to TAA, and the plan's reason for not starting at
TAA (history invalidation on cuts, teleports, resize, cell changes, animated foliage) still stands.

## 3. How it was measured, and the one place the plan's instrument had to change

Aliasing is a **motion** defect, so the probe pans the camera at **0.05° per frame — about half a
pixel** — across four Deck camera stops, capturing 36 frames per variant, with an 8-frame *static*
control as the floor. Before and after run **in the same process on the same GPU on the same
frames**: `post/baseline-composite.js` holds the pre-A compositor verbatim, sha256-checked against
git by `tools/render/w1-30a-baseline-check.mjs`, so the comparison is not two Pod runs with two
driver states.

The plan's crawl row asks for luma change between frames *"while the camera and subject are both
static in world space"*. Taken literally that measures animation, not aliasing — with nothing moving
there is no sub-pixel sampling change for antialiasing to fix. The pan is the honest version of that
row; the static case is kept as the floor.

## 4. The numbers

### Green

| row | result |
|---|---|
| **silhouette width, still** | worst stop **1.95 px** against a 1.8 px bar; mean **1.56 px → 2.43 px**. Edges are genuinely being resolved rather than chosen between. |
| **sabotage matrix** | all six off-switches change the frame on every stop. No pass is decorative. |
| **MSAA in force** | 4× allocated on the device; the off-switch really returns 0. |
| **dither null** | turning dither off brings banding back everywhere (runs up to 55 px). |

### Red, and why — the confounds are as much mine as the build's

**Crawl.** Per stop, against the pre-A frame: 53%, 68%, 28%, 95% — worst 28%, so red as written.
But that comparison is **confounded by this piece's own grade**, which raises contrast and therefore
raises the count of pixels crossing the 24/255 threshold: the grade works against its own AA
measurement. Held at constant grade (`after` vs `after-noaa`) the AA-attributable reduction is
**68%, 67%, 42%, 96%** — worst 42%. Still short of 60% on one stop, and honestly short.

**Banding.** Worst 54 px against a 6 px bar. The instrument is at fault as much as the build: it
counts runs down *any* sky column, and a genuinely flat fog colour is a long run of identical values
that is not banding and that dither correctly does not break. Where there *is* a gradient the dither
works and is measurable — Stone Wastes 53→25 px, Deep Marshes 55→35 px, Salt Hills 53→35 px.

**Still-edge null.** Three stops fall back to 1.10–1.25 px as required. Blackwood stays at 1.97 px
because Blackwood is heavy fog and its edges were already soft before anything was done to them; the
1.2 px bar assumes a clear-air frame.

**Two of the four camera stops were poor choices for an AA measurement** and that is a process
failure worth naming: `vista-stone-wastes` at 13:00 is near-featureless fog, and `vista-blackwood`
puts a large black wedge of geometry across the frame. `tools/visual/frame-stats.mjs` exists exactly
to catch that and was not run over the stop list first.

## 5. The two findings the null controls bought

**(a) The grade amplifies palettes, so alike palettes get more alike.** The null control here was
*not* "grade off" but **every region pinned to one real grade** — the plausible wrong answer. It did
**not** collapse regional separation, and that is the finding: most of what separates two regions is
the terrain and the fog, not the grade. Paired properly (same region pair, same hour, same weather),
the grade **increases** separation in about two thirds of pairs and **decreases** it in the rest —
and every loser involves Blackwood against another dark-green region, the Deep Marshes above all.

One fix followed and is verified by a second GPU run: the overcast variant was desaturating every
region toward the same grey in rain, undoing the region variant sitting under it. Halved. Rain pairs
helped moved **70% → 75%**, median gain **0.053 → 0.066**. Rain should make a place more itself, not
less. The remainder is an art call, not a bug: Blackwood and the Deep Marshes need deliberately
divergent palettes in the world corpus, which is not this piece's file.

**(b) MSAA does very little in canopy, and that points at the next cheap win.** At Blackwood,
MSAA-only removes about **3%** of the crawl while the post pass removes **66%**. In the open Salt
Hills, MSAA-only removes **79%**. That pattern is what **alpha-tested foliage** looks like: MSAA
cannot antialias a cutout edge without `alphaToCoverage` on the material. Turning that on for the
foliage materials is the highest-value follow-up in this area, and those materials are not in this
piece's owned paths.

## 6. What is still owed, plainly

- **The 5-mip bloom chain** (plan item 3). The bloom is wider and now has a soft knee so a light
  source does not pop into existence as it brightens, but emissives still will not read as light
  sources the way they should.
- **Real ambient occlusion** (plan item 4). The old 4-tap depth ring, clamped to 0.12, is untouched
  and close to invisible. Nothing looks grounded yet.
- **The frame budget.** No frame time at 1920×1080 was taken. "`high` fits 16.6 ms in the worst Deck
  vista" is unproven, and 4× MSAA on a HalfFloat target is the largest new cost — exactly the number
  the plan called least certain.
- **Determinism over 288 stills.** The probe hashes each still but no second run was made to compare.
- **The full Deck and the naive human judgement pack.** The critic's job under the plan's allocation;
  note also that `deck.json` declares 12 motion sequences and `deck.mjs` captures stills only, which
  is W1-30V's gap and unchanged by this piece.

## 7. Reuse

**Consumed:** `tools/visual/deck.json` (every camera stop measured is a Deck stop),
`tools/visual/contact-sheet.mjs`, `render/lighting.js`'s frame scalars via the W1-30S seam,
`field.regionAt()` (the same region record the fog already reads, so grade and fog can never
disagree about where the camera is), and the existing `setVisualFeature` surface.

**Published:** `render/post/grade.js` — the shared colour identity for the whole visual programme;
any child needing the game's look should call `resolveGrade()` rather than invent numbers.
`MSAA_BY_TIER` + `renderer.setQualityTier()` + `renderer.qualityReport()` — the quality ladder.
`renderer.disposeComposite()`. `render/post/baseline-composite.js` — so any child can measure a
before and an after on the same frames in one process rather than across two Pod runs.

## 8. Tools added

| tool | what it does | its null control |
|---|---|---|
| `tools/render/w1-30a-frame-probe.mjs` | the GPU probe: pans, samples in-page, never claims GPU it does not have | seven variants, each isolating one pass |
| `tools/render/w1-30a-verdict.mjs` | judges a probe report against the plan's bar, binding on the worst stop per ruling W1 | — |
| `tools/render/w1-30a-grade-census.mjs` | offline: 13 recipes for exactly the 13 shipped regions, none indistinguishable, all responsive to time and weather | `--flat` pins every region to one **real** grade; distinctness must collapse |
| `tools/render/w1-30a-baseline-check.mjs` | proves the held pre-A shader is byte-identical to git | `--null` compares the **current** compositor — a real, plausible wrong answer |
