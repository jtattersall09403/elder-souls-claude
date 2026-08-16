---
id: RI-VIS03
title: Fidelity as measurable quantities — the image-metric battery
kind: number
side: modern-fidelity
judges: [visual.renderer.lighting, visual.renderer.materials, visual.renderer.postprocess, visual.renderer.shadows, visual.renderer.atmosphere, visual.renderer.sky, visual.renderer.antialiasing, visual.renderer.lod, visual.process.measurement]
provenance: constructed
confidence: high
blind_pair: no
---

> **SIDE DECLARATION: this item is `modern-fidelity`.**
> Cited **only** under `JUDGEMENT SIDE: FIDELITY` (RI-VIS01 §B).
> **This item REFUSES Morrowind references.** These metrics are never run against a 2002
> screenshot, and no 2002 screenshot may be used to justify relaxing a threshold. A muted
> palette (an art-direction choice, RI-VIS05) is *not* a defence for a failing M2, M6 or M8
> — muted means low chroma, not low luminance range and not flat shading. Any argument of
> the form "our M8 is low because of the art direction" is CC-3 and voids the verdict.

## The bar

Fidelity must be judgeable by an agent with no eyes and no taste. Every claim in a fidelity
verdict must reduce to a number computed from a PNG by a script, compared against a band,
with a stated fail threshold. "It looks flat" is not a verdict; `M8.FS = 0.011 (band ≥
0.035, anti-reference 0.009) → AT DEFAULT → hard fail` is.

Twelve metrics. Each is (a) cheap enough to run on every capture in every wave, (b)
implementable with no native dependencies beyond a PNG decoder, (c) *diagnostic* — a failing
value points at a specific missing renderer feature in RI-VIS04, not at a mood.

## The reference artifact

### §0 Common preprocessing (all metrics share this; implement once)

Input: 1920×1080 8-bit RGB PNG, no alpha, no UI overlay, sRGB-encoded (i.e. what the user
sees). All metrics operate on the **displayed** frame — this is deliberate: we are measuring
the output of the whole pipeline including tonemapping and colour space, and a bug in either
must show up here.

```
decode(png) -> R,G,B uint8 [H][W]
r,g,b       = R/255, G/255, B/255                    # sRGB-encoded, 0..1
Yp          = 0.2126*r + 0.7152*g + 0.0722*b         # "display luminance", 0..1
                                                     # USED BY: M1,M2,M4,M5,M6,M7,M8,M9,M11
lin(c)      = c<=0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4
Ylin        = 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b)   # USED BY: M10 only
Lab         = sRGB -> linear -> XYZ(D65) -> CIELAB    # USED BY: M3,M6,M7,M9
Cstar       = sqrt(a*^2 + b*^2)                       # chroma
hue_deg     = atan2(b*, a*) in [0,360)
N           = W*H
```

Masks computed once and shared:

```
SKY_MASK    = see M7 §detect
FG_MASK     = NOT SKY_MASK                            # "the world", used by M8 and M3
SHADOW_MASK = FG_MASK AND Yp < percentile(Yp[FG_MASK], 25)
LIT_MASK    = FG_MASK AND Yp > percentile(Yp[FG_MASK], 75)
```

### §0b Tooling

**Primary (Node, no native deps):**
```
npm i pngjs                       # pure JS PNG decode, no compilation
# optional, faster, native: npm i sharp
```
Harness file: `corpus/80-methods/vis-metrics.mjs`, CLI:
```bash
node corpus/80-methods/vis-metrics.mjs \
  --shot shots/w03/exterior_marsh_dusk.png \
  --anti refs/anti/threejs-default.png \
  --profile exterior_daylight \
  --json out/w03/exterior_marsh_dusk.metrics.json
```
**Alternative (Python):** `pip install numpy Pillow` — identical formulas; the JSON output
schema is normative and both implementations must produce it.
**Capture:** Playwright at `/opt/pw-browsers/chromium`, deterministic:
```js
// corpus/80-methods/capture-shots.md owns this; shown for the contract only
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
         '--disable-lcd-text','--force-device-scale-factor=1','--hide-scrollbars']
});
const page = await browser.newPage({ viewport:{width:1920,height:1080},
                                     deviceScaleFactor:1 });
// pin RNG, pin time-of-day, pin camera to a named debug pose, wait for
// "renderer:idle" (N frames with no pending texture/geometry loads), then:
await page.screenshot({ path: out, type:'png', animations:'disabled' });
```
Captures MUST be deterministic: same commit + same shot name → byte-identical PNG. The
harness asserts this by capturing twice and comparing sha256; a mismatch fails the wave
before any metric runs (non-deterministic captures make every threshold meaningless).

Output JSON schema (normative):
```json
{"shot":"exterior_marsh_dusk","profile":"exterior_daylight","commit":"abc123",
 "sha256":"...","w":1920,"h":1080,
 "metrics":{"M1":{"DR":0.61,"occupancy":0.78,"blown":0.004,"crushed":0.02,
                  "band":[0.72,1.0],"pass":false,"anti":0.55,"at_default":false}, ...},
 "verdict":{"hard_fails":["M8"],"soft_fails":["M1","M5"],"score":4.2}}
```

### §0c Profiles

Thresholds differ by scene class. Every capture declares its profile; the harness refuses to
run without one.

| Profile | Applies to | Notes |
|---|---|---|
| `exterior_daylight` | `exterior_marsh_noon`, `foliage_dense`, `xanmeer_vista` | full bands |
| `exterior_lowlight` | `exterior_marsh_dusk`, `water_edge` at dawn | M1 mean relaxed, M6 tightened |
| `interior_darkemissive` | `interior_rootway` | M1 mean relaxed hard, M7 skipped, M6 + M9 tightened |
| `character_closeup` | `character_closeup`, `combat_midfight` | M7, M10, M11 skipped; M4/M5 computed on the model crop only |

Skipped metrics are recorded `"pass": null, "skipped": "profile"`. **A skipped metric never
counts as a pass** — the score renormalises over the metrics actually run.

---

### M1 — Luminance histogram spread and dynamic range

**Measures:** whether the frame uses the display range. **Diagnoses:** missing tonemapping,
missing exposure, washed-out ambient-only lighting, crushed output.

```
h[256]      = histogram of round(Yp*255)
P1,P50,P99  = 1st, 50th, 99th percentile of Yp
DR          = P99 - P1
occupancy   = |{ i : h[i] >= 0.0001*N }| / 256
blown       = |{ p : Yp >= 0.996 }| / N
crushed     = |{ p : Yp <= 0.004 }| / N
skew        = E[(Yp-mean)^3] / std^3
```

| Profile | `DR` band | `occupancy` | `blown` max | `crushed` max | mean `Yp` band |
|---|---|---|---|---|---|
| exterior_daylight | ≥ 0.72 | ≥ 0.80 | 0.05 | 0.10 | 0.28–0.58 |
| exterior_lowlight | ≥ 0.65 | ≥ 0.72 | 0.03 | 0.20 | 0.14–0.40 |
| interior_darkemissive | ≥ 0.70 | ≥ 0.65 | 0.02 | 0.35 | 0.06–0.26 |
| character_closeup | ≥ 0.60 | ≥ 0.72 | 0.03 | 0.12 | 0.22–0.55 |

**Fail:** `DR < 0.55` (any profile) → **washed / no tonemapping / no lighting range**.
**Fail:** `blown > 2× profile max` → hard clipping, see M9.
**Fail:** `mean Yp < 0.18 AND P99 ≥ 0.95 AND skew > 1.6` → *suspected missing sRGB output
encoding* (a linear buffer shown without the sRGB transfer function). Report this as a named
diagnosis, not just a number: it is a one-line fix (`renderer.outputColorSpace = SRGBColorSpace`).

---

### M2 — Global and local RMS contrast

**Measures:** whether surfaces vary in brightness at all. **Diagnoses:** flat/unlit
materials, no normal maps, no shadowing, no material variation.

```
C_global    = stddev(Yp[FG_MASK])
tiles       = non-overlapping 32x32 px tiles fully inside FG_MASK
C_tile[t]   = stddev(Yp within tile t)
C_local_med = median over t of C_tile[t]
C_local_p90 = 90th percentile over t of C_tile[t]
C_local_p10 = 10th percentile over t of C_tile[t]
```

| Profile | `C_global` band | `C_local_med` min | `C_local_p10` min |
|---|---|---|---|
| exterior_daylight | 0.13–0.28 | 0.045 | 0.012 |
| exterior_lowlight | 0.11–0.26 | 0.038 | 0.010 |
| interior_darkemissive | 0.12–0.32 | 0.035 | 0.008 |
| character_closeup | 0.10–0.26 | 0.040 | 0.012 |

**Fail:** `C_local_med < 0.025` → **flat shading**; escalate to M8 for confirmation.
**Fail:** `C_local_p10 < 0.004` → at least 10% of the frame is a perfectly uniform surface
(untextured wall/ground/water plane). Report the largest such tile's centroid so the builder
can find the offending object.
**Fail:** `C_global > 0.34` → likely blown/clipped rather than detailed; cross-check M9.

---

### M3 — Colour distribution and saturation statistics

**Measures:** colour richness and variety. **Diagnoses:** vertex-colour/untextured
placeholder palettes (too saturated, too few hues), dead grey-brown mush (too little), or a
single-material scene.

```
P           = { pixels in FG_MASK with Cstar > 8 }        # "chromatic pixels"
chroma_frac = |P| / |FG_MASK|
meanC       = mean(Cstar[FG_MASK])
p95C        = 95th percentile of Cstar[FG_MASK]
hue_hist[36]= chroma-weighted histogram of hue_deg over P, 10-degree bins,
              each pixel contributing weight Cstar
H_hue       = -sum_i (q_i * log2 q_i), q = hue_hist normalised   # 0 .. 5.17 bits
```

| Profile | `meanC` band | `p95C` min | `H_hue` band | `chroma_frac` min |
|---|---|---|---|---|
| exterior_daylight | 12–32 | 45 | 2.0–4.2 | 0.55 |
| exterior_lowlight | 8–28 | 38 | 1.8–4.2 | 0.45 |
| interior_darkemissive | 8–34 | 50 | 1.5–3.8 | 0.40 |
| character_closeup | 10–34 | 42 | 1.8–4.0 | 0.50 |

**Fail:** `meanC > 45` → **garish untextured placeholder colours** (raw material colours
with no albedo texture and no lighting desaturation).
**Fail:** `p95C < 20` → nothing in the frame is coloured; dead render.
**Fail:** `H_hue < 1.2` → the whole frame is one hue family → one material, or a full-screen
colour overlay swamping everything.
**Note for the critic:** a *low* `meanC` inside band is the correct outcome for our art
direction and is **not** a fidelity failure. `meanC` failing *low* only fires below the band
floor; the band floors are deliberately low to accommodate a muted marsh. This is the one
metric where art direction and fidelity nearly touch, and the band is drawn so they do not.

---

### M4 — Edge density (geometric + texture detail proxy)

**Measures:** how much structure is in the frame. **Diagnoses:** untextured surfaces, low
geometric density, missing detail meshes/clutter.

```
Sx = [[-1,0,1],[-2,0,2],[-1,0,1]]  ; Sy = Sx^T
G  = sqrt( (Yp * Sx)^2 + (Yp * Sy)^2 )         # convolution, replicate border
ED(img) = |{ p in FG_MASK : G[p] > 0.08 }| / |FG_MASK|
ED_1 = ED(full res)
ED_2 = ED(box-downsample 2x)      ; ED_4 = ED(box-downsample 4x)
scale_ratio = ED_4 / max(ED_1, 1e-6)
```

| Profile | `ED_1` band | `scale_ratio` band |
|---|---|---|
| exterior_daylight | 0.10–0.34 | 0.35–1.10 |
| exterior_lowlight | 0.07–0.30 | 0.35–1.10 |
| interior_darkemissive | 0.06–0.28 | 0.30–1.10 |
| character_closeup (model crop) | 0.09–0.32 | 0.35–1.10 |

**Fail:** `ED_1 < 0.045` → **untextured coloured boxes**. This is the flagship "we have no
art" detector.
**Fail:** `scale_ratio < 0.22` → all the detail lives at one pixel scale and vanishes on
downsample: the frame is *noise or aliasing*, not structure. Cross-check M5 NYQ.
**Fail:** `ED_1 > 0.42` → hash/alias storm (untamed alpha-test foliage, no AA, no mips).

---

### M5 — High-frequency energy and spectral slope (FFT band ratio)

**Measures:** texture resolution and aliasing, together, because they are the same
frequency question. **Diagnoses:** low-res or missing textures (too little HF), missing AA
or missing mipmaps (too much energy at Nyquist), over-aggressive post blur.

```
crop  = centre 1024x1024 of Yp   (or resize 1920x1080 -> 1024x1024 box filter if the
                                  centre crop lands entirely on sky; record which)
win   = crop * hann2d(1024)      # 2D separable Hann to kill edge ringing
F     = FFT2(win) ; P = |F|^2 ; shift zero-freq to centre
f(u,v)= sqrt(u^2+v^2)/1024       # normalised radial frequency, 0 .. 0.5 cyc/px
E(a,b)= sum of P over { f in [a,b) },  excluding DC bin

E_LOW  = E(0.004, 0.05)
E_MID  = E(0.05,  0.20)
E_HIGH = E(0.20,  0.45)
E_NYQ  = E(0.45,  0.50)

HFR       = E_HIGH / (E_LOW + E_MID + E_HIGH)
NYQ_ratio = E_NYQ  / max(E_HIGH, 1e-9)
alpha     = -slope of least-squares fit of log10(Erad(f)) vs log10(f)
            over f in [0.02, 0.40], Erad = radially-averaged power per bin
```

Natural images follow a `1/f^alpha` power law with `alpha ≈ 2` (≈1.6–2.6 in practice).
Rendered frames that match reality sit in that band; synthetic flat frames do not.

| Profile | `HFR` band | `NYQ_ratio` max | `alpha` band |
|---|---|---|---|
| exterior_daylight | 0.06–0.24 | 0.18 | 1.6–2.6 |
| exterior_lowlight | 0.045–0.22 | 0.18 | 1.6–2.8 |
| interior_darkemissive | 0.04–0.22 | 0.20 | 1.5–2.9 |
| character_closeup | 0.05–0.24 | 0.15 | 1.6–2.8 |

**Fail:** `HFR < 0.03` → **no texture detail** (flat colours, or a 64px texture stretched
over a wall, or over-blurred post).
**Fail:** `NYQ_ratio > 0.30` → **no anti-aliasing** and/or **no mipmaps**. Distinguish:
compute `NYQ_ratio` on a 2× supersampled capture; if it collapses, it is AA/mip (renderer
config); if it persists, it is geometry aliasing (needs TAA/SMAA).
**Fail:** `alpha > 3.2` → over-smoothed, no high-frequency content anywhere: the "plastic
world" render.
**Fail:** `alpha < 1.1` → energy is white-noise-flat across frequencies: alias storm.

---

### M6 — Shadow-region detail retention

**Measures:** what survives in the dark quarter of the frame. This is the single best proxy
for "does this renderer have ambient occlusion, image-based lighting, and a filmic curve",
because all three show up here and only here. **Diagnoses:** no IBL/env map, no AO,
one-light rendering, crushed blacks.

```
if |SHADOW_MASK| / N < 0.03:  -> HARD FAIL "no shadowed region in frame"
tilesS      = 32x32 tiles with >= 50% of pixels in SHADOW_MASK
C_shadow_med= median over tilesS of stddev(Yp within tile)
retention   = C_shadow_med / max(C_local_med, 1e-6)          # from M2

hue_shadow  = circular mean of hue_deg over SHADOW_MASK, weighted by Cstar
hue_lit     = circular mean of hue_deg over LIT_MASK,    weighted by Cstar
hue_offset  = circular |hue_shadow - hue_lit|  in degrees, 0..180
C_shadow    = mean(Cstar[SHADOW_MASK])
```

| Profile | `retention` min | `hue_offset` min | `SHADOW_MASK` frac min | `C_shadow` min |
|---|---|---|---|---|
| exterior_daylight | 0.60 | 15° | 0.03 | 6 |
| exterior_lowlight | 0.55 | 12° | 0.05 | 5 |
| interior_darkemissive | 0.50 | 20° | 0.08 | 6 |
| character_closeup | 0.55 | 12° | 0.04 | 5 |

**Fail:** `retention < 0.30` → **crushed blacks / no ambient / no IBL**. In a modern render
the shadowed quarter is lit by the environment and still shows material structure; ours is a
silhouette.
**Fail:** `hue_offset < 6°` → **one light source only**. Real scenes have a warm key and a
cool sky-fill, so shadows are hue-shifted relative to lit surfaces. A single white
`DirectionalLight` plus a white `AmbientLight` produces `hue_offset ≈ 0`, and this metric
catches it in one number.
**Fail:** `|SHADOW_MASK| < 0.03·N` in a `exterior_daylight` profile → **no shadow casting at
all** (`castShadow`/`receiveShadow` never set, or `renderer.shadowMap.enabled = false`).

**Contact-shadow sub-check (`M6b`):** in `character_closeup`, sample a 16 px band immediately
around the character's silhouette-to-ground contact. Mean `Yp` in that band must be ≤ 0.75 ×
mean `Yp` of ground 100 px away. Fail otherwise → **character is floating / no contact
shadow / no AO**.

---

### M7 — Sky and horizon gradient smoothness

**Measures:** whether the sky is rendered or is a background colour. **Diagnoses:** flat
`scene.background`, no sky model, 8-bit banding, no aerial perspective at the horizon.

```
detect: candidate = pixels in top 45% of rows with G < 0.02 (from M4) and Yp > P60(Yp)
        SKY_MASK  = largest 4-connected component of candidate touching row 0
        sky_frac  = |SKY_MASK| / N
        if sky_frac < 0.02 -> metric SKIPPED (record; does NOT pass)

profile: for each row y within SKY_MASK, ybar(y) = mean(Yp), cbar(y) = mean(Cstar),
         hbar(y) = circular mean hue
         smooth with a 9-row moving average -> ys(y), cs(y)
dY_sky   = |ys(y_top) - ys(y_horizon)|        # y_horizon = lowest row with >=20% sky
dC_sky   = |cs(y_top) - cs(y_horizon)|
dH_sky   = circular |hbar(y_top) - hbar(y_horizon)| degrees
BI       = per 100 rows, count of y where |d2 ys/dy2| > 3 * sigma(d2 ys/dy2)
sky_noise= median over 16x16 sky tiles of stddev(Yp)      # should be tiny but nonzero
```

| Profile | `dY_sky` min | `dC_sky` min | `dH_sky` min | `BI` max /100 rows | `sky_noise` band |
|---|---|---|---|---|---|
| exterior_daylight | 0.06 | 4 | 6° | 2 | 0.0008–0.020 |
| exterior_lowlight | 0.10 | 8 | 12° | 2 | 0.0008–0.025 |

**Fail:** `dY_sky < 0.02 AND dC_sky < 2` → **flat single-colour sky**
(`scene.background = new THREE.Color(0x87ceeb)`). This is the most common Three.js tell and
it is a single-number detection.
**Fail:** `BI > 4` → **banding**: no dithering on an 8-bit gradient. Fix is a 1-line noise
dither in the tonemap pass.
**Fail:** `sky_noise < 0.0004` → the sky is mathematically perfect, which real skies and real
renderers are not; combined with a passing `dY_sky` this means a linear gradient texture, not
a scattering model. Soft fail (−1), not hard.

---

### M8 — The flat-shading detector  *(the headline metric)*

**Measures:** the presence of large regions of uniformly-lit, uniformly-coloured surface.
**Diagnoses:** `MeshBasicMaterial`, unlit/emissive-only materials, no normal maps, no
textures, ambient-only lighting, water-as-a-plane.

Two independent statistics; failing **either** is a hard fail.

```
--- FS_score: within-colour-bin luminance variance ---
med      = 3x3 median filter on RGB (kills dither/noise, keeps flat regions flat)
bin(p)   = quantise med(p) to a 6x6x6 RGB cube -> 216 bins
for each bin b with |b| >= 0.005 * |FG_MASK|:
    v_b = stddev(Yp over pixels of b)
FS_score = sum_b (|b| * v_b) / sum_b |b|          # area-weighted

--- LargestFlat: connected uniform area ---
localstd(p) = stddev(Yp) over the 9x9 window centred at p
FLAT        = { p in FG_MASK : localstd(p) < 0.008 }
comps       = 4-connected components of FLAT
LargestFlat = max_c |c| / |FG_MASK|
TotalFlat   = |FLAT| / |FG_MASK|
```

| Profile | `FS_score` min | `LargestFlat` max | `TotalFlat` max |
|---|---|---|---|
| exterior_daylight | 0.035 | 0.06 | 0.18 |
| exterior_lowlight | 0.030 | 0.08 | 0.24 |
| interior_darkemissive | 0.028 | 0.10 | 0.30 |
| character_closeup | 0.032 | 0.07 | 0.20 |

**HARD FAIL:** `FS_score < 0.018` → the frame is made of flat colour fields.
**HARD FAIL:** `LargestFlat > 0.15` (excluding SKY_MASK) → one object occupies a sixth of the
frame with no shading variation whatsoever. The harness must report the component's bounding
box and mean colour so the builder can identify the object in one look.
**Reporting requirement:** M8 is always reported as the triple `(anti, ours, band)` against
REF-M8 (RI-VIS02). If `|ours − anti| / max(anti,1e-6) < 0.15` → `AT DEFAULT` → hard fail
regardless of band.

**Why this metric is the headline:** every cheap shortcut in a Three.js scene converges here.
Unlit materials, ambient-only lighting, missing textures, untextured water, and flat-shaded
low-poly geometry all produce large uniform regions. It is the metric a stylisation defence
will be aimed at, and RI-VIS01 CC-3 exists to make that defence inadmissible.

---

### M9 — Tonemapping and colour response

**Measures:** whether a filmic curve and correct colour management are in the pipeline.
**Diagnoses:** `NoToneMapping`, wrong `outputColorSpace`, no exposure control, bloom applied
to the whole frame instead of thresholded.

```
ClipFrac      = |{ p : r>=0.99 AND g>=0.99 AND b>=0.99 }| / N
ShoulderRatio = |{ p : Yp in [0.90,0.996) }| / max(|{ p : Yp in [0.75,0.90) }|, 1)
topmask       = top 5% of pixels by Yp
C_top         = mean(Cstar[topmask]) ; C_all = mean(Cstar[FG_MASK])
HighlightDesat= C_top / max(C_all, 1e-6)
BloomHalo     = mean(Yp) in an annulus 12-40 px around each connected region of
                Yp>0.95, minus mean(Yp) of the frame       # >0 means bloom present
VeilIndex     = P1(Yp) of FG_MASK                          # bloom applied unthresholded
                                                           # lifts the black floor
```

| Metric | Band | Fail |
|---|---|---|
| `ClipFrac` | ≤ 0.02 | > 0.02 → hard clipping, no shoulder |
| `ShoulderRatio` | 0.25–1.10 | < 0.12 → the histogram falls off a cliff into white = linear clamp |
| `HighlightDesat` | ≤ 0.85 | > 1.05 → **no tonemapping** (a filmic curve desaturates highlights; a linear clamp keeps them saturated and then clips a channel, producing hue shifts into pure primaries) |
| `BloomHalo` | 0.010–0.09 | ≤ 0.002 → no bloom; > 0.12 → bloom is eating the frame |
| `VeilIndex` | ≤ 0.10 | > 0.14 with a passing `BloomHalo` → unthresholded bloom veiling the blacks |

Combined diagnosis rule (report the named cause, not just the numbers):
```
if HighlightDesat > 1.05 and ClipFrac > 0.02          -> "NO TONEMAPPING"
if mean Yp < 0.18 and skew(M1) > 1.6 and P99 >= 0.95  -> "SUSPECTED LINEAR OUTPUT (no sRGB encode)"
if ShoulderRatio < 0.12 and blown(M1) > 0.05          -> "EXPOSURE TOO HIGH / no auto-exposure"
```

---

### M10 — Aerial perspective / atmospheric depth

**Measures:** whether distance attenuates contrast. **Diagnoses:** no fog, wrong fog
(non-height, non-exponential), fog wall hiding a short draw distance.

Single-image proxy (always runnable):
```
horizon_y  = lowest row of SKY_MASK, or 0.45*H if no sky
bandFar    = rows [horizon_y - 0.05H, horizon_y]          in FG_MASK
bandNear   = bottom 20% of rows                            in FG_MASK
C_far      = median 32x32-tile stddev(Yp) within bandFar
C_near     = median 32x32-tile stddev(Yp) within bandNear
R_aerial   = C_far / max(C_near, 1e-6)

# hue/luminance lift with distance (fog colour should intrude)
dY_depth   = mean(Yp[bandFar]) - mean(Yp[bandNear])
dC_depth   = mean(Cstar[bandFar]) - mean(Cstar[bandNear])   # fog desaturates: expect < 0
```

| Profile | `R_aerial` band | `dC_depth` | notes |
|---|---|---|---|
| exterior_daylight | 0.25–0.70 | ≤ −3 | |
| exterior_lowlight | 0.20–0.65 | ≤ −2 | |
| xanmeer_vista (long) | 0.15–0.55 | ≤ −5 | longest sightline |

**Fail:** `R_aerial > 0.85` → **no atmospheric attenuation**; the 400 m silhouette is as
crisp as the 4 m rock. Infinite-clarity tell.
**Fail:** `R_aerial < 0.10` → **fog wall**: distance is not attenuated, it is deleted. Almost
always concealing a short draw distance. Cross-check M11 and the far-plane value.
**Fail:** `dC_depth > 0` → distant things are *more* saturated than near things: fog is being
applied as a colour multiply rather than a mix, or is absent and the distant surfaces are
unlit raw material colours.

**Two-capture upgrade (preferred when the harness can drive the engine):** capture the same
pose with fog disabled; `FogDelta = mean|Yp_fog − Yp_nofog|` over `bandFar` must be ≥ 0.06
and over `bandNear` must be ≤ 0.02. This separates "has height/exponential fog" (near
unaffected, far affected) from "has a global tint" (both affected equally). Height-fog
verification: the delta measured on a vertical column through a tall object must decrease
monotonically with height; a constant delta means non-height fog (RI-VIS04 §6 fail).

---

### M11 — LOD pop and draw-distance stability *(temporal, needs a dolly capture)*

**Measures:** pop-in, LOD swapping, streaming hitches. **Diagnoses:** naive LOD with no
hysteresis or dithered transition, aggressive frustum/distance culling.

```
capture: 120 frames, camera translating forward at constant 4.0 m/s, fixed yaw,
         fixed time-of-day, PNG per frame (harness: --dolly)
for each consecutive pair (i, i+1):
    D      = |Yp_{i+1} - Yp_i|
    changed= { p : D[p] > 0.25 }
    comps  = 4-connected components of `changed` with area > 400 px
    POP if any comp exists AND camera displacement between frames < 0.07 m
       AND the comp is not intersecting a known animated region (water, foliage-wind mask)
pops       = count of POP events over 119 pairs
worst_pop  = max comp area / N
```

| Metric | Band | Fail |
|---|---|---|
| `pops` | ≤ 1 per 120 frames | > 6 |
| `worst_pop` | ≤ 0.01 | > 0.02 |

**Note:** wind-animated foliage and water will trip this if not masked. The harness gets the
animated-region mask by capturing two frames with the camera *stationary* and marking any
pixel with `|ΔYp| > 0.02` as animated; those pixels are excluded from POP detection. A scene
where the stationary-pair delta is **zero everywhere** fails RI-VIS04 §11 (no wind) and is
reported here as `ANIMATED_MASK_EMPTY`.

---

### M12 — Water plausibility *(applies to `water_edge` and any shot with `sky_frac`>0 and water)*

**Measures:** whether water is a rendered surface or a coloured plane. **Diagnoses:** the
blue-plane failure.

```
WATER_MASK = provided by the harness via a debug render pass (object id buffer). If
             unavailable, the critic hand-marks a polygon; record which.
grazing    = water pixels in the top 25% of WATER_MASK rows (far, low view angle)
downward   = water pixels in the bottom 25% of WATER_MASK rows (near, steep view angle)

FresnelDelta = mean(Yp[grazing]) - mean(Yp[downward])       # reflectance rises at grazing
NormalEnergy = HFR (M5) computed on WATER_MASK only          # ripple normal detail
ShoreDelta   = mean(Yp) in a 6px band inside the water/land boundary vs 30px inside
               (wet-darkening / depth-based colour)
ReflCorr     = Pearson correlation between Yp of the water strip and Yp of the vertically
               mirrored above-water strip, over the far half of WATER_MASK
TemporalVar  = stddev over 30 stationary frames of mean(Yp[WATER_MASK])
```

| Metric | Band | Fail |
|---|---|---|
| `FresnelDelta` | ≥ 0.05 | < 0.02 → no Fresnel; uniform plane |
| `NormalEnergy` (HFR on water) | ≥ 0.035 | < 0.012 → no normal/ripple detail |
| `ShoreDelta` | ≥ 0.03 | < 0.01 → no depth-based colour, no shoreline |
| `ReflCorr` | ≥ 0.35 | < 0.15 → no reflection of any kind |
| `TemporalVar` | ≥ 0.002 | < 0.0005 → water is static |

**Any two of these failing = "water is a blue plane" hard fail.**

#### M12a — the declared pose set. A single bearing may not decide any M12 band.
*(ADDED 2026-08-16 by the F7 r3 critic under `CRITIC-DOCTRINE` §1.3. `provenance: constructed`.
This is an ADD: it removes a degree of freedom, it does not relax a threshold. It may be the
reason a build FAILS and it may never be the reason a build PASSES.)*

**Why.** M12's bands were being decided by where the camera was pointed. Measured on **one
unchanged shader** (F7's round-2 water), `FresnelDelta` reads **0.00629 → 0.12817 across seven
poses in the Deep Marshes** (a 20.4× spread) and **−0.08972 → +0.15514 across four poses in the
Western Rootlands** — a range of **0.245**, spanning the sign, on a shader that did not change
between readings. The `≥ 0.05` band was crossed at **5 of 7** Deep Marshes poses by the very arm
that F7 round 2 was **failed** on at 0.04599 "short by 0.004", because that reading was taken at a
26 m vista where the instrument sits near zero. A band that one arm both passes and fails by
choice of pose is not gating the build.
Evidence: `corpus/90-verdicts/wave1/artifacts/W1-F7-WATER-r3-critic/` (`m12redo`, `wrootlands-look`).

**The rule, all four clauses required:**

1. **Declare the pose set before measuring**, in the verdict, with each pose's yaw, pitch and
   distance. **≥ 4 poses**, at least **90° apart** in bearing, all in the same scene, seed, time of
   day and weather.
2. **Report every pose on its own line. A mean over poses is inadmissible** — it is exactly the
   averaging that let one bearing stand for the water.
3. **A band is met only if it is met at the WORST pose in the set** (min over poses). Reporting the
   best pose is metric-shopping and voids the row.
4. **The pose set must contain at least one `water_edge` pose** — a close, low camera with a real
   water/land boundary in frame. `RI-WLD10` §8's WCI table says where one exists: a region at
   **WCI ≤ 0.05 has no water plane** (report `N/A — region has no water`), and a region at
   **WCI ≥ 0.80 is drowned and may contain no waterline at all**. The Deep Marshes is WCI **0.86**;
   three rounds of F7 shot every frame there and **not one frame contains a shoreline**. If no pose
   in the region yields a water/land boundary, that is recorded as `no waterline in region` and the
   shoreline rows are **`inapplicable`, which per `ARBITRATION` S64 must carry the absence forward
   as a finding rather than absorb it** — not as a pass.

**The mask is part of the instrument and must be pinned.** Where `WATER_MASK` is derived by
differencing against a water-hidden frame, **an arm that changes the water's alpha changes the
mask**, so the two arms are then scored over different pixel sets. Measured: at one pose the
per-arm mask grew 5.7% and turned a `FresnelDelta` of **+0.148 → +0.161** (a small gain) into
**+0.148 → −0.145** (a sign flip), and a `ShoreDelta` of 0.024 → 0.021 (still failing) into
0.024 → 0.093 (a spurious pass). **Both arms of any comparison must be scored over ONE mask**,
and the verdict must say which arm it was taken from.

---

### §13 Reference implementation sketch (normative for formulas, not for style)

```js
// corpus/80-methods/vis-metrics.mjs  (sketch; harness owner implements)
import { PNG } from 'pngjs'; import fs from 'node:fs';

const png = PNG.sync.read(fs.readFileSync(shotPath));
const {width:W, height:H, data} = png;                 // RGBA8
const N = W*H, Yp = new Float32Array(N);
const r=new Float32Array(N), g=new Float32Array(N), b=new Float32Array(N);
for (let i=0,p=0;i<N;i++,p+=4){
  r[i]=data[p]/255; g[i]=data[p+1]/255; b[i]=data[p+2]/255;
  Yp[i]=0.2126*r[i]+0.7152*g[i]+0.0722*b[i];
}
const lab = toLab(r,g,b);                              // D65, per §0
const sky = detectSky(Yp, sobel(Yp,W,H), W, H);        // M7 §detect
const fg  = not(sky);
const m = {};
m.M1 = histogramStats(Yp, fg);                         // DR, occupancy, blown, crushed, skew
m.M2 = rmsContrast(Yp, fg, W, H, 32);                  // C_global, C_local_med, p10, p90
m.M3 = chromaStats(lab, fg);                           // meanC, p95C, H_hue, chroma_frac
m.M4 = edgeDensity(Yp, fg, W, H, 0.08);                // ED_1, ED_2, ED_4, scale_ratio
m.M5 = spectrum(Yp, W, H);                             // HFR, NYQ_ratio, alpha  (radix-2 FFT
                                                       //  on a 1024^2 Hann-windowed crop)
m.M6 = shadowRetention(Yp, lab, fg, m.M2.C_local_med, W, H);
m.M7 = skyGradient(Yp, lab, sky, W, H);
m.M8 = flatShading(r,g,b,Yp, fg, W, H);                // FS_score, LargestFlat, TotalFlat
m.M9 = tonemapResponse(r,g,b,Yp,lab, fg, m.M1);
m.M10= aerialPerspective(Yp, lab, fg, sky, W, H);
// M11, M12 take multi-frame inputs; run only when --dolly / --water-mask supplied
const bands = PROFILES[profile];
const verdict = grade(m, bands, antiMetrics);          // pass/fail/at_default per metric
fs.writeFileSync(outJson, JSON.stringify({shot, profile, commit, sha256, metrics:m, verdict}));
```

FFT note for the implementer: a 1024×1024 real-input 2D FFT via row/column radix-2 is ~10 M
butterfly ops and runs in well under a second in plain JS. No FFT library is required and
none should be added — a hand-rolled radix-2 with a precomputed twiddle table is ~60 lines
and removes a dependency risk from the harness.

## Comparison method

1. Emit the RI-VIS01 §B declaration, `JUDGEMENT SIDE: FIDELITY`, listing the `F*` properties
   the metrics cover.
2. Regenerate the anti-reference: `node corpus/80-methods/make-anti-ref.mjs` →
   `refs/anti/threejs-default.png`. Run the full battery on it. (If this step is skipped,
   `AT DEFAULT` cannot be computed and every metric is reported without its floor anchor —
   the verdict is then capped at 6/10.)
3. Capture the eight shots (RI-VIS02 §Comparison method step 1), assert capture determinism
   by double-capture sha256 equality.
4. Run:
   ```bash
   for s in exterior_marsh_noon exterior_marsh_dusk interior_rootway xanmeer_vista \
            combat_midfight character_closeup water_edge foliage_dense; do
     node corpus/80-methods/vis-metrics.mjs --shot shots/w$W/$s.png \
       --anti refs/anti/threejs-default.png --profile $(profile_for $s) \
       --json out/w$W/$s.metrics.json
   done
   node corpus/80-methods/vis-metrics.mjs --dolly shots/w$W/dolly/ --json out/w$W/dolly.json
   ```
5. **Report every metric as the triple** `(anti, ours, band)`. A metric reported as a bare
   number is not admissible.
6. For each **hard fail**, name the RI-VIS04 feature it diagnoses and the file/line-level
   remedy where the harness can determine it (e.g. `M9 HighlightDesat 1.31 → NO TONEMAPPING
   → RI-VIS04 §5 → set renderer.toneMapping = ACESFilmicToneMapping`).
7. Metrics never override the eye, but the eye never overrides a hard fail. If the critic
   believes a hard-failed frame looks fine, it files a corpus amendment proposing a threshold
   change **with the measured values of three modern reference frames as evidence** — never
   by assertion, and never in the same wave in which it is judging.

## Scoring

Per shot:
```
runnable   = metrics not skipped by profile
soft       = runnable metrics outside band but not past a hard-fail threshold
hard       = metrics past a hard-fail threshold, or AT DEFAULT
score      = 10 * (runnable - soft*0.5 - hard*1.0) / runnable      # floored at 0
```

| Score | Meaning |
|---|---|
| 9–10 | 0 hard, ≤ 1 soft. Frame is measurably in the modern band. |
| 7–8 | 0 hard, 2–4 soft. Shippable; named gaps. |
| 5–6 | 0 hard, ≥ 5 soft — the render is coherent but consistently thin. |
| 3–4 | 1 hard fail. |
| 0–2 | ≥ 2 hard fails, or any `AT DEFAULT`, or M8 hard fail. |

**Failure thresholds (absolute, override the arithmetic):**
- **M8 hard fail → the shot scores 0 and the wave's FIDELITY score is capped at 2.** Flat
  shading is not a deduction, it is the absence of rendering.
- **Any `AT DEFAULT` metric → shot capped at 2.**
- **M6 `hue_offset < 6°` → shot capped at 4** (one-light rendering).
- **M12 two-or-more fail on `water_edge` → that shot capped at 3.**
- The wave FIDELITY score = **minimum** across shots, not mean (RI-VIS01 §E).

**What "we lose" looks like numerically** — the expected first-build profile, written in
advance so the critic can recognise it:
```
M1 DR 0.48 (band ≥0.72) FAIL      M2 C_local_med 0.019 FAIL
M3 meanC 51 FAIL (raw material colours)   M4 ED_1 0.031 FAIL
M5 HFR 0.018 FAIL, NYQ_ratio 0.41 FAIL, alpha 3.6 FAIL
M6 retention 0.11 FAIL, hue_offset 1.2° FAIL
M7 dY_sky 0.004 FAIL (flat background colour)
M8 FS 0.010 HARD FAIL, LargestFlat 0.31 HARD FAIL, AT DEFAULT vs anti 0.009
M9 HighlightDesat 1.28 → "NO TONEMAPPING"
M10 R_aerial 0.94 FAIL      M12 FresnelDelta 0.00, ReflCorr 0.02 → blue plane
=> shot score 0, FIDELITY capped 2
```

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 | 6 / 10 | 8 / 10 |

**Aggregation (a property of this item, not of the critic):** band on the computed score, then MINIMUM across shots, not mean (RI-VIS01 §E).

## How we lose

- **The harness is never built.** RI-VIS03 becomes a beautiful unexecuted document and the
  critic falls back to adjectives. Mitigation: a verdict that reports no `metrics.json`
  scores at most 4 and must say so explicitly.
- **Thresholds get "tuned" to whatever we ship.** Someone fails M8, then edits the band.
  Guard: threshold amendments require three measured modern reference frames as evidence and
  cannot be made by the critic judging that wave.
- **Non-deterministic captures.** Wind, water and time-of-day drift make every metric noisy;
  the team learns to ignore red numbers. Guard: the double-capture sha256 assertion runs
  before any metric and fails the wave outright.
- **Profile laundering.** Every shot is declared `interior_darkemissive` because its bands
  are loosest. Guard: profile is a property of the shot name, fixed in `capture-shots.md`,
  not chosen at judging time.
- **Skipped metrics counted as passes.** M7 is skipped because no sky is visible in any shot
  — because we never built a sky. Guard: skipped metrics renormalise the denominator and are
  listed in the verdict; and a wave where `sky_frac < 0.02` in *every* exterior shot is a
  named failure, not a skip.
- **Masking everything.** The animated-region mask (M11) or a hand-drawn WATER_MASK (M12) is
  drawn generously until nothing is measured. Guard: masks are emitted as PNGs alongside the
  metrics JSON and are part of the verdict artefact.
- **Metric-passing ugliness.** We optimise M5 by adding film grain, M2 by adding noise, M8 by
  adding a dirt-lens overlay. All three raise numbers without raising fidelity. Guard: M4
  `scale_ratio` and M5 `alpha` both punish flat-spectrum noise, and the RI-VIS06 blind test
  is the backstop — a human/agent pairwise pick that grain cannot fake.
- **The one that will actually get us:** we pass every metric on a carefully-chosen beauty
  shot and never capture the parts of the world that are still grey boxes. Guard: the eight
  shot slots are fixed by name, the camera poses are fixed in the repo, and a wave may not
  substitute a shot without recording the substitution in the verdict.

## Provenance note

`provenance: constructed`, `confidence: high`.

**The formulas are standard and load-bearing; the thresholds are ours.** The metric
definitions draw on well-established image statistics — RMS contrast as the standard
deviation of luminance; the ~`1/f^2` power-law spectrum of natural images (so a rendered
frame whose spectral slope is far from ~2 is measurably unlike reality); Sobel edge density
as a detail proxy; CIELAB chroma and ΔE for colour comparison; Rec.709 luma weights. Those
are not invented here and are `confidence: high` as *formulas*.

**The target bands and fail thresholds are `constructed`** — chosen by the authoring agent to
sit between the measured anti-reference floor and a plausible modern ceiling. They have
**not** been calibrated against measured current-gen frames, because no image bytes from the
RI-VIS02 references were retrieved (see RI-VIS02's provenance note). This is the item's
principal weakness and it is stated here rather than hidden: a critic must report bands as
`band: constructed` until calibration lands.

**Calibration is owed and is the highest-value upgrade to this file.** Procedure: place ≥ 3
legally-usable modern frames per profile in `refs/modern/`, run the battery, and set each
band to `[p10, p90]` of the reference population, with hard-fail thresholds at the
anti-reference value plus 20% of the gap to the reference p10. On completion this item
becomes `provenance: measured, confidence: high` and the `constructed` caveat is removed from
every verdict.

The anti-reference (REF-M8) values used for `AT DEFAULT` **are** measured — regenerated by
the harness each wave from a real Three.js default scene — so the floor half of every
comparison is honest today even though the ceiling half is not.
