---
id: RI-VIS04
title: The renderer feature checklist — what a Three.js scene must have to be modern, and the tell when it doesn't
kind: structure
side: modern-fidelity
judges: [visual.renderer.materials, visual.renderer.ibl, visual.renderer.shadows, visual.renderer.ao, visual.renderer.postprocess, visual.renderer.atmosphere, visual.renderer.antialiasing, visual.renderer.water, visual.renderer.foliage, visual.renderer.lod, visual.renderer.sky, visual.renderer.vfx]
provenance: constructed
confidence: high
blind_pair: no
---

> **SIDE DECLARATION: this item is `modern-fidelity`.**
> Cited **only** under `JUDGEMENT SIDE: FIDELITY` (RI-VIS01 §B).
> **This item REFUSES Morrowind references.** Nothing on this list is optional because
> "Morrowind didn't have it". Morrowind shipped the highest-fidelity feature set available in
> 2002; we ship the feature set available now. A missing feature defended by a 2002 reference
> is CC-3 and voids the verdict.
> This file is simultaneously a **build checklist** (the builder works down it) and a
> **judging checklist** (the critic works down it). Same list, same order, same tells.

## The bar

Thirteen features. Each one, when absent, produces a *specific and nameable* artefact that a
critic can find in a still frame in under thirty seconds. The bar is: **all thirteen present,
each detectable as present from a screenshot, none of them detectable as absent.**

A renderer that has all thirteen and mediocre art still looks modern. A renderer missing four
of them cannot be rescued by any amount of art, and every hour spent on art before these are
in place is wasted. So the list is ordered by **cost-to-benefit**: §1–§5 are the ones that
move the metrics most per line of code, and no wave should proceed to §9+ with any of §1–§5
missing.

## The reference artifact

Legend for each entry:
**HAVE** = what "present and correct" means · **TELL** = what it looks like when missing ·
**DETECT** = how a critic proves absence from a capture · **METRIC** = the RI-VIS03 metric
that fires · **MIN BAR** = the minimum acceptable configuration.

---

### §1 — PBR materials (roughness / metalness / normal / AO maps)

- **HAVE:** every surface uses `MeshStandardMaterial` or `MeshPhysicalMaterial` with, at
  minimum, an albedo map and a roughness map; normal maps on anything with surface relief
  (bark, stone, chitin, cloth); metalness 0 for everything except actual metal, where it is
  1 with a roughness map that varies. Roughness must **vary across the surface** — a
  constant scalar roughness is the giveaway that no map is bound.
- **TELL:** all surfaces have the same sheen. Wet root and dry stone reflect identically.
  Metal has no bright moving specular. Everything looks like painted clay. Under a moving
  light nothing changes character, only brightness.
- **DETECT:** find two materially different objects in the frame (bark vs stone vs metal vs
  water). Sample a 16×16 patch of each. If their luminance *distributions* have similar shape
  (std within 25% of each other) and neither has a small bright specular tail, roughness is
  not varying → no roughness maps. Second check: orbit the camera 30° and re-capture; if no
  bright region moves across any surface, there is no view-dependent specular at all.
- **METRIC:** M2 `C_local_med`, M8 `FS_score`, M4 `ED_1`.
- **MIN BAR:** albedo + roughness on every material; normal on every material with visible
  relief at ≤ 3 m; `material.envMapIntensity` non-zero (needs §2).

---

### §2 — Image-based lighting / environment map

- **HAVE:** a `PMREMGenerator`-processed environment (HDR/EXR or a procedurally generated
  sky cubemap) bound as `scene.environment`, so every PBR material receives directional
  ambient and a plausible reflection. The env map must be **regenerated when time-of-day
  changes** or the ambient will disagree with the sun.
- **TELL:** shadowed sides of objects are uniformly dark and *neutral grey*. Nothing reflects
  the sky. A metal object looks like grey plastic. Interiors look like objects floating in
  fog. The scene reads as "lit by two lamps" rather than "standing in a place".
- **DETECT:** M6 `hue_offset`. In a real environment-lit frame, the shadow side of an object
  takes the hue of the sky/environment; with only an `AmbientLight` it takes the ambient's
  single colour and `hue_offset ≈ 0°`. Also: find a smooth convex object; its shaded side
  should have a *gradient* around the terminator, not a step to constant.
- **METRIC:** M6 `hue_offset`, `retention`, `C_shadow`.
- **MIN BAR:** `scene.environment = pmrem(skyRenderTarget)`, refreshed on any sun move > 2°.
  `AmbientLight` alone is **not** acceptable and is treated as the absence of this feature.

> **AMENDED 2026-08-16 — ADDED by the `F4` round-2 critic (`corpus/90-verdicts/wave1/W1-F4-r2.md`).
> NOTHING ABOVE IS REMOVED, NO THRESHOLD IS LOWERED AND NO NUMBER IN §2 CHANGES. This adds a
> METHOD that a claim about the light budget must follow, and it can only ever cost a build a
> mark, never earn it one.**
>
> **§2-D2 — ENUMERATE THE LIGHT BUDGET PER LIGHT, ON THE *VISIBLE* RIG, AGAINST THE CAPTURE'S OWN
> NOISE FLOOR — BEFORE CALLING ANY TERM A LEVER OR RULING ONE OUT.**
>
> §2's DETECT is one number over the whole frame. It says whether the shadow side takes the
> environment's hue; it cannot say *which* of the frame's lights failed to put it there. Both F4
> rounds picked their lever from an argument about the light budget rather than a measurement of
> one — round 1 cut `sky` 0.42 → 0.315 and `fill` 0.30 → 0.225, and round 2's ablation then showed
> both cuts sat inside the capture's own noise. Ruling **S60**'s clause (a) does not close this
> either: it compares the key against the probe and puts the hemisphere and the ambient fill in
> **neither arm**, so on this build 0.558 of ambient intensity is in no arm of the acceptance.
>
> **The method, four steps, and step 1 is the one that has already been got wrong.**
>
> 1. **Census every light with its parent chain's visibility, and quote only the lights that can
>    reach a pixel.** A scene-wide `scene.traverse(o => o.isHemisphereLight)` sum is *not* the rig.
>    Measured on this build at 08:00 (`artifacts/W1-F4-r2-critic/metrics/light-census-visible-vs-scenewide.json`):
>    that sum is **5.0011**, and the hemisphere light whose chain is visible is **0.37107** — the
>    other **4.63** sits inside `Group`s that are hidden (`arena-bounded-readable-fill`,
>    `rootway-bounded-fill`, three interior sets). A budget quoted from the sum is wrong by 13×,
>    and round 2's headline sentence — *"switching off a HemisphereLight of live intensity
>    5.0011"* — is that error.
> 2. **One ablation arm per visible light, plus one for `scene.environment`**, applied per frame
>    (a one-shot edit is overwritten before the screenshot by any `apply()` that rewrites the rig).
> 3. **A `base` re-capture taken AFTER every other arm is the run's own noise floor**, and every
>    arm is reported as a multiple of it, on the sealed judged crop **and** the full frame (**S64**).
> 4. **A term whose ablation lands inside that floor is `unresolvable at its shipped value`.** It
>    may **not** be reported as absent, as "not a lever", or as evidence about a *class* of levers.
>    The honest sentence names the value: here `hemi_off` 2.18 and `fill_off` 2.04 against a floor
>    of 1.86 are unresolvable **at hemisphere 0.371 and ambient 0.187** — values a previous round
>    chose. What the same term does at 4× is a different measurement and needs a different arm.
>
> **Bound.** DETECT and method only. It adds no route to a higher §14 mark and no route to a higher
> score for any build; a critic may cite it to **withhold** a mark and never to grant one. It changes
> none of §2's thresholds and it is **not the reason for any pass** — the verdict that adds it is a
> FAIL set by §2's own pre-existing DETECT. **Overturned** if a per-light visible-chain census proves
> unavailable to a harness, in which case §2 records the budget `UNVERIFIED`, which counts as absent.

---

### §3 — Cascaded shadow maps at a sane resolution

- **HAVE:** directional sunlight with ≥ 3 cascades covering near/mid/far, ≥ 2048² per
  cascade, PCF or PCSS soft filtering, stable (texel-snapped) cascade fitting, and a bias
  configuration that produces neither peter-panning nor acne. Shadow softness should increase
  with distance from the occluder (contact-hard, distance-soft).
- **TELL (missing entirely):** no shadows at all; objects sit on the ground with no anchoring
  and appear to hover. **TELL (single low-res map):** shadow edges are visibly stair-stepped
  blocks; shadows only exist within ~30 m of the camera and vanish at a hard circular
  boundary; shadows shimmer and crawl as the camera moves. **TELL (bad bias):** dark diagonal
  stripe acne on lit surfaces, or a visible gap between an object and its own shadow.
- **DETECT:** M6 `SHADOW_MASK` fraction < 3% in a daylight exterior = no shadows. Then look
  at any shadow edge at 1:1 zoom: count pixels of penumbra. < 2 px everywhere = hard shadows,
  no filtering. Blocky stair-steps whose step size is constant across the frame = single
  cascade. Walk the camera back 40 m and watch for the shadow boundary ring.
- **METRIC:** M6 (all), M11 (cascade transitions can register as pops).
- **MIN BAR:** 3 cascades × 2048², PCF 3×3 minimum, shadow distance ≥ 150 m.

> **AMENDED 2026-08-15 — ADDED by the `F4` round-1 critic (`corpus/90-verdicts/wave1/W1-F4-r1.md`
> §8). NOTHING ABOVE IS REMOVED AND NO THRESHOLD IS LOWERED. This adds a DETECT that can fire and
> a preservation clause; both can only ever cost a build points, never earn it any.**
>
> **§3-D2 — the `SHADOW_MASK < 3%` clause above cannot detect the absence of shadows, so it must
> not be the only test.** `RI-VIS03` §0 defines
> `SHADOW_MASK = FG_MASK AND Yp < percentile(Yp[FG_MASK], 25)` — the darkest **quartile** of the
> foreground, *by construction*. It is ≈25% of the foreground whether the scene casts one shadow or
> none. Measured across ten frames of this build, before and after a lighting change that
> demonstrably added cast shadow, `SHADOW_MASK` frac sat between **0.2329 and 0.2498** in every
> single one. The `< 3%` clause can only fire when the sky fills more than ~88% of the frame. It is
> the same misdomained-metric family as rulings **S58**, **S59** and **S60**.
>
> **The test that does work — the SHADOW-MAP ABLATION MASK.** Capture the same pose twice: shipped,
> and with `renderer.shadowMap.enabled = false` (every material marked `needsUpdate`, or the flag is
> a silent no-op — it is compiled into the program). A pixel is **cast-shadowed** when the
> shadow-map-off frame is brighter than the shipped frame by more than `tau` in display luma. Report
> the area fraction as a **curve over `tau ∈ {1, 2, 4, 8, 16}`**, never at a single chosen `tau`.
> **`cast_shadow_area_fraction` at `tau = 8` ≥ 0.03 in a daylight exterior**, or §3 is absent. This
> mask is derived from the shadow map itself rather than from a luminance percentile, so it measures
> what §3 names.
>
> **§3-D3 — WHAT IS INSIDE THE SHADOW IS PART OF HAVING SHADOWS.** A build can add cast-shadow area
> by removing the light that fills shadows, and score better on every "is there a shadow" test while
> the picture gets worse. Measured on this build: at the `pair03` window, cast-shadow area rose
> (77.9% → 79.2% at `tau = 1`) while `M6 retention` fell **0.7199 → 0.4526** and `M6 C_shadow` fell
> **9.762 → 4.785**, through the `exterior_daylight` minimum of 6. So, binding alongside the area
> clause: **`M6 retention` and `M6 C_shadow` may not fall below their `RI-VIS03` profile minima in a
> window whose cast-shadow area rose.** A shadow you cannot see into is a hole, and §2's whole
> purpose is that the environment lights it.
>
> **Bound.** These two clauses are DETECT and preservation only. They add no route to a higher §14
> mark and no route to a higher score for any build; a critic may cite them to withhold a mark and
> never to grant one. Overturned if a shadow-map ablation proves unavailable to a harness, in which
> case §3 falls back to the penumbra and cascade-ring tests above and records the area clause
> `UNVERIFIED`, which counts as absent.

---

### §4 — Ambient occlusion (SSAO/GTAO or equivalent)

- **HAVE:** screen-space AO (GTAO preferred over classic SSAO) at half or full res, radius
  tuned to the world scale, **plus** baked AO maps on static props where possible. AO must
  darken creases, contact points, and the interiors of concave forms, and must be applied to
  ambient/indirect only, never to direct sunlight.
- **TELL:** everything looks pasted on. A crate on the ground has no darkening at the seam.
  Root systems, brick joints, cloth folds, and the underside of overhangs are all as bright as
  the faces around them. The scene has no sense of enclosure — an interior looks like an
  exterior with a roof.
- **DETECT:** M6b contact-shadow sub-check. Pick any object-ground contact and any concave
  corner (wall-floor junction). Sample luminance at the junction and 100 px away along both
  surfaces. If the junction is not ≥ 25% darker, there is no AO. Do this in a shot with the
  sun *behind* the camera so direct shadowing cannot account for it.
- **METRIC:** M6 `retention`, M6b, M2 `C_local_med`.
- **MIN BAR:** SSAO at half-res with a bilateral upsample, radius ≈ 0.5 m, intensity such
  that the junction test passes by ≥ 25%.

---

### §5 — Tonemapping (ACES) and correct colour space

- **HAVE:** `renderer.toneMapping = THREE.ACESFilmicToneMapping` (or AgX), a tuned
  `toneMappingExposure`, `renderer.outputColorSpace = THREE.SRGBColorSpace`, all colour
  textures flagged `SRGBColorSpace` and all data textures (normal/roughness/AO)
  `LinearSRGBColorSpace`, and an HDR render target (`HalfFloatType`) so values above 1.0
  survive to the tonemapper. Plus dithering in the final pass to kill 8-bit banding.
- **TELL (no tonemapping):** highlights clip to flat saturated patches with hard edges — a
  bright sky becomes a solid white shape with a razor boundary; a bright torch becomes a pure
  orange blob. **TELL (wrong output colour space):** the whole image is either muddy-dark and
  over-contrasty (linear shown as sRGB) or milky and washed (double-encoded). **TELL (normal
  map flagged sRGB):** shading is subtly wrong everywhere; surfaces look inflated.
- **DETECT:** M9 `HighlightDesat > 1.05` and `ClipFrac > 0.02` → NO TONEMAPPING, stated by
  name. M1's `mean Yp < 0.18 AND skew > 1.6 AND P99 ≥ 0.95` → suspected linear output. M7
  `BI > 4` → no dithering.
- **METRIC:** M9 (all), M1 (skew/DR), M7 `BI`.
- **MIN BAR:** ACES + sRGB output + HalfFloat render target + per-texture colour-space flags.
  This is the cheapest single change in the whole document and the one that moves the most
  metrics; it must be in place before any art is judged.

---

### §6 — Exponential height fog and volumetric scattering

- **HAVE:** analytic exponential **height** fog (density falls off with altitude) evaluated
  per-pixel from depth, tinted separately for the sun-facing and away-facing hemispheres
  (cheap in-scattering approximation), plus at least one true volumetric element: light
  shafts from the sun through the canopy, or a raymarched local fog volume in the root
  tunnels. Fog colour must be derived from the sky, not hardcoded.
- **TELL (no fog):** the 400 m xanmeer silhouette is as crisp and as contrasty as the rock at
  4 m. The world looks like a diorama under glass. **TELL (`FogExp2` only, no height):**
  uniform grey haze that fogs the treetops exactly as much as the tree roots — no ground mist
  pooling, no clear air above the mist line. This is the single biggest gap between a default
  Three.js marsh and RDR2's Bluewater Marsh (RI-VIS02 REF-M4 clause 1). **TELL (fog as a
  wall):** distant geometry does not fade, it terminates; there is a distance at which the
  world simply stops and everything beyond is flat fog colour.
- **DETECT:** M10 `R_aerial`. Then the height test: capture a vertical column through a tall
  object (a cypress, a tower) at 200 m; sample fog-blend along it. If the blend is constant
  with height, the fog is non-height. Two-capture upgrade (M10) makes this exact.
- **METRIC:** M10 (all), M1 `DR` (a fog wall compresses range).
- **MIN BAR:** analytic height fog with sky-derived colour + sun in-scatter term; one
  volumetric light-shaft pass in exteriors; a raymarched fog volume in the root tunnels.

---

### §7 — Bloom (thresholded, multi-mip)

- **HAVE:** a thresholded bright-pass followed by a mip-chain blur, so bright cores glow
  tightly and very bright cores glow widely. Only emissives, speculars and the sun should
  bloom. Intensity low enough that black stays black.
- **TELL (missing):** bioluminescent fungus, Hist sap, lanterns and the sun are all just
  *bright coloured shapes* with no glow, and read as stickers. In the root tunnels this is
  fatal — the whole region's identity is emissive light. **TELL (unthresholded):** the entire
  frame is veiled in milk, blacks lift to grey, contrast dies.
- **DETECT:** M9 `BloomHalo ≤ 0.002` = missing; `VeilIndex > 0.14` = unthresholded.
  Visually: find the brightest emissive object and look for a luminance falloff extending
  beyond its geometric silhouette.
- **METRIC:** M9 `BloomHalo`, `VeilIndex`, M1 `crushed`/`P1`.
- **MIN BAR:** threshold ≈ 1.0 in HDR space, 5-mip chain, `strength ≤ 0.35`.

---

### §8 — Anti-aliasing (TAA, or SMAA/FXAA as a floor)

- **HAVE:** temporal AA with jittered projection and motion-vector reprojection is the target
  (it also stabilises alpha-tested foliage, which is our worst aliasing source). SMAA is the
  acceptable floor; FXAA is the emergency floor. Alpha-tested foliage additionally needs
  alpha-to-coverage or `alphaTest` + MSAA, and correctly generated mipmaps with an alpha
  coverage fix, or it will sparkle regardless of AA.
- **TELL:** jagged staircase edges on every silhouette against the sky; roof lines and
  branches crawl and shimmer when the camera moves slowly; distant foliage sparkles like TV
  static; thin geometry (reeds, ropes, moss) flickers in and out of existence.
- **DETECT:** M5 `NYQ_ratio > 0.30`. Confirm with the supersample test: re-capture at 2× and
  downsample; if `NYQ_ratio` collapses, the renderer has no AA (rather than the content being
  inherently noisy). Visually: zoom 1:1 on any high-contrast silhouette edge against the sky
  and count intermediate-value pixels — zero intermediate pixels = no AA.
- **METRIC:** M5 `NYQ_ratio`, `alpha`; M4 `scale_ratio`.
- **MIN BAR:** SMAA + mipmapped alpha-tested foliage with alpha-coverage correction. TAA
  required before the fidelity score can exceed 8.

---

### §9 — Water: reflection, refraction, depth, animated normals

- **HAVE:** planar reflection (a second camera pass, mirrored) or SSR for the reflection
  term; a refraction/depth term reading the depth buffer so shallow water is transparent and
  deep water is dark; Fresnel blending between the two; two scrolling normal maps at
  different scales and speeds for ripple; a shoreline term (wet-darkening on land, foam or
  depth-fade at the intersection); and — for our marsh specifically — floating scum/duckweed
  as a masked detail layer so the mirror is broken by hard-edged flecks.
- **TELL:** a flat blue/green semi-transparent plane. The same colour and brightness
  everywhere. No reflection of the sky, the trees, or the moon. A hard geometric line where
  the water plane intersects the terrain. No motion, or a single sine-wave vertex wobble.
  This is our most likely and most damaging single failure **in the regions that have water** —
  the Rootlands, the Deep Marshes, Thornmarsh, Blackwood and the two coasts.
  ~~because Black Marsh is *made of standing water*.~~
  *(AMENDED wave 0 (rebase-s22), ARBITRATION seam **S24**: Black Marsh is the name, not the
  terrain. `RI-WLD10` §7 has five regions with a tide and eight without, and the Clay Moor with
  no standing water at all. Water fidelity is still the highest-stakes single feature, because
  the starting region is a fen and it is the first thing anyone sees — but a capture from Valus
  Ridge, the Stone Wastes, the Stone Forest, the Clay Moor or the Salt Hills has no water plane
  to judge, and M12 must be reported as `N/A — region has no water` there rather than scored 0
  or quietly skipped. **Two seas, Topal Bay and the Padomaic, must not share one water
  material.**)*
- **DETECT:** M12, all five sub-metrics. `FresnelDelta < 0.02` and `ReflCorr < 0.15` together
  are conclusive.
- **METRIC:** M12 (all), M8 `LargestFlat` (a water plane is usually the largest flat region).
- **MIN BAR:** planar reflection at half-res for the main water body + depth-based colour +
  two-layer animated normals + shoreline depth fade. SSR optional.

---

### §10 — LOD and draw distance

- **HAVE:** discrete LOD chains (≥ 3 levels) on all large props with **dithered or
  cross-faded** transitions and hysteresis on the switch distance; impostor billboards for
  distant trees; a terrain LOD/clipmap; instanced rendering for everything repeated; and a
  far plane long enough to see the xanmeer from across the fen (≥ 1500 m of visible world).
- **TELL:** trees and rocks *appear* out of nothing at a fixed radius as you walk; a visible
  ring of detail around the player; objects visibly change shape as you approach; or the
  opposite failure, where nothing is culled at all and the framerate collapses so the world is
  kept tiny to compensate.
- **DETECT:** M11 dolly capture, `pops` and `worst_pop`. Also: stand still and note the
  furthest visible object; if nothing is visible beyond ~250 m in an exterior, the draw
  distance is a fidelity failure regardless of how the fog hides it (cross-check M10
  `R_aerial < 0.10`).
- **METRIC:** M11 (all), M10 (fog-wall detection).
- **MIN BAR:** 3-level LOD with dithered transition + hysteresis, instanced foliage,
  ≥ 1000 m visible world with a named silhouette landmark visible from the start area.

---

### §11 — Instanced foliage with wind

- **HAVE:** `InstancedMesh` (or GPU-driven instancing) for grass, reeds, ferns and small
  plants, thousands of instances, with per-instance random rotation/scale/colour-tint;
  vertex-shader wind with at least two frequencies (a slow bend and a fast flutter) and a
  per-instance phase offset; leaf **translucency** (transmission/backlight term) so
  sun-behind foliage glows; and foliage that receives shadows and casts at least contact
  shadows.
- **TELL:** two crossed alpha-test quads per bush, all bushes identical, all facing the same
  two directions so the entire field flickers coherently as the camera turns; hard black
  fringes around the cutouts; total stillness; and a uniform flat green because the leaves
  are lit as opaque double-sided planes with no transmission.
- **DETECT:** M4 `ED_1` in `foliage_dense` below band = not enough foliage. M11's
  `ANIMATED_MASK_EMPTY` (stationary two-frame delta is zero everywhere) = **no wind**, stated
  by name. Translucency test: capture the same foliage with the sun behind it and in front of
  it; if the mean hue and luminance of the leaves are the same in both, there is no
  transmission. Cutout test: zoom 1:1 on a leaf edge — a dark halo of near-black pixels means
  the alpha texture was not premultiplied / mips not coverage-corrected.
- **METRIC:** M4, M5 `NYQ_ratio`, M11 `ANIMATED_MASK_EMPTY`.
- **MIN BAR:** instanced, ≥ 5 000 instances in view in `foliage_dense`, two-frequency wind
  with per-instance phase, transmission term on leaf materials.

---

### §12 — Sky model with sun position

- **HAVE:** an atmospheric scattering sky (Preetham/Hosek-Wilkie `THREE.Sky` at minimum,
  ideally a Bruneton-style precomputed scattering) driven by a real sun elevation/azimuth;
  the sun light's colour and intensity **derived from that sky** so a low sun is warm and
  dim and a high sun is neutral and bright; the sky feeding the IBL (§2) and the fog colour
  (§6); plus clouds — even a two-layer scrolling cloud texture with parallax — and moon/stars
  for night.
- **TELL:** a single flat colour behind everything (`scene.background = new Color(0x87ceeb)`)
  — the definitive Three.js tell, visible in one glance. Or a gradient sky whose colours do
  not change with time of day, or a sky whose brightness does not agree with the scene's
  lighting (a sunset sky over a noon-lit world).
- **DETECT:** M7 `dY_sky < 0.02 AND dC_sky < 2` = flat background colour. `sky_noise <
  0.0004` with a passing gradient = a gradient texture, not a scattering model. Agreement
  test: the mean hue of `LIT_MASK` should be within ~30° of the sun's disc hue; a large
  disagreement means the sun light colour is hardcoded independently of the sky.
- **METRIC:** M7 (all), M6 `hue_offset` (needs the sky for the cool fill).
- **MIN BAR:** `THREE.Sky` with a driven sun, PMREM'd into `scene.environment` and into the
  fog colour, sun light colour/intensity sampled from the sky, one cloud layer.

---

### §13 — Particles and VFX

- **HAVE:** soft particles (depth-faded so they do not cut hard lines against geometry),
  correctly sorted or additive-blended, lit or at least tinted by the local light, with
  enough resolution that they do not read as sprites; ambient world VFX everywhere —
  midges over water, drifting spores in the root tunnels, dust motes in sun shafts, rain that
  interacts with surfaces (wetness, ripples on water).
- **TELL:** particles have hard rectangular edges where they intersect geometry; smoke is a
  visibly rotating flat card; every particle is the same size and brightness; the air is
  completely empty in every shot; rain falls *through* the water surface with no ripple.
- **DETECT:** look for any particle intersecting geometry and check for a hard boundary
  (= no soft-particle depth fade). Count distinct particle systems visible in
  `exterior_marsh_dusk` and `interior_rootway`; zero is a fail. M5 in the sky/air region: a
  frame with atmosphere has non-zero HF energy in "empty" air.
- **METRIC:** M5 on an air-only crop; qualitative clause count.
- **MIN BAR:** soft-particle depth fade on all particles; ≥ 2 ambient systems visible in
  every exterior shot and ≥ 1 in every interior.

---

### §14 — The checklist, condensed (this is the form the critic fills in)

| # | Feature | Present? | Tell if absent | Metric | Blocks score above |
|---|---|---|---|---|---|
| 1 | PBR materials + roughness/normal maps | ☐ | all surfaces same sheen | M2, M8 | 4 |
| 2 | IBL / environment map | ☐ | neutral grey shadow sides | M6 hue_offset | 5 |
| 3 | Cascaded shadow maps ≥3×2048² | ☐ | objects hover, blocky edges | M6 | 4 |
| 4 | SSAO / GTAO | ☐ | no contact darkening | M6b | 6 |
| 5 | ACES + sRGB + HDR target | ☐ | clipped saturated highlights | M9 | 3 |
| 6 | Exponential height fog + volumetrics | ☐ | diorama-under-glass | M10 | 5 |
| 7 | Thresholded bloom | ☐ | emissives read as stickers | M9 BloomHalo | 7 |
| 8 | AA (TAA / SMAA floor) | ☐ | crawling jagged edges | M5 NYQ | 6 |
| 9 | Water reflect/refract/depth/normals | ☐ | blue plane | M12 | 3 |
| 10 | LOD + draw distance ≥1000 m | ☐ | pop-in ring | M11, M10 | 6 |
| 11 | Instanced foliage + wind + transmission | ☐ | crossed quads, stillness | M4, M11 | 5 |
| 12 | Sky model + driven sun | ☐ | flat background colour | M7 | 4 |
| 13 | Soft particles + ambient VFX | ☐ | empty air, hard sprite edges | M5 (air crop) | 8 |

The **"Blocks score above"** column is binding: a missing feature caps the wave's FIDELITY
score at that value regardless of every other result. Caps compose by `min()`.

## Comparison method

1. Emit the RI-VIS01 §B declaration, `JUDGEMENT SIDE: FIDELITY`, properties `F01`–`F16`.
2. Fill in §14 by running each feature's **DETECT** procedure against the eight captures.
   A feature may be marked present **only** if its DETECT procedure was run and its result
   recorded with a cited pixel region, crop, or metric value. "Looks present" is not a mark.
3. Where DETECT requires a second capture (orbit for §1, sun-behind for §11, supersample for
   §8, fog-off for §6, dolly for §10, stationary-pair for §11), request it from the harness.
   A feature whose second capture could not be produced is recorded `UNVERIFIED` and counts
   as **absent** for the cap.
4. Cross-check against RI-VIS03: every hard-failing metric must map to at least one absent
   feature here. A hard-failing metric with all thirteen features marked present means either
   a feature mark is wrong (re-run its DETECT) or the corpus has a hole (file an extension).
5. Report §14 verbatim as a table in the verdict, plus the resulting `min()` cap.
6. Optionally cross-check by code inspection (`grep` for `MeshBasicMaterial`,
   `NoToneMapping`, `scene.background = new THREE.Color`, `PlaneGeometry` used for water).
   **Code inspection may only confirm an absence detected from the image, never substitute
   for it** — the judgement is about what renders, not what is configured.

## Scoring

```
present   = features marked present with a recorded DETECT result
cap       = min over absent features of their "Blocks score above" value  (10 if none absent)
raw       = 10 * present / 13
FEATURE SCORE = min(raw, cap)
```

| Score | Meaning |
|---|---|
| 9–10 | 13/13 present, all verified by DETECT with cited evidence |
| 7–8 | 12/13, the missing one is §7 or §13 |
| 5–6 | 10–11/13, missing one of §4/§6/§8/§10/§11 |
| 3–4 | missing §1, §3, or §12 — the render is structurally pre-modern |
| 0–2 | missing §5 or §9, or ≥ 5 features absent |

**Failure threshold: < 6 blocks the wave.** Additionally:
- **Missing §5 (tonemapping/colour space) is an automatic wave block** at any score. It is
  a handful of lines and it gates the meaning of every other metric — judging materials or
  lighting through a broken output transform is measuring noise.
- Any feature marked present without a recorded DETECT result → that mark is struck, the
  feature counts absent, and the critic's own RI-VIS01 score drops to 4 (unevidenced claim,
  CC-6).

**What we lose looks like:** `present = 3/13` (PBR materials nominally, shadows nominally,
sky nominally-as-a-colour), `cap = 3` (no tonemapping, water is a plane), `FEATURE SCORE =
2`. Every remaining hour of art production is spent on a pipeline that cannot display it.

**Native → ladder anchors — the row mandated by `SCORING.md` §1.2 (BAR-CRITIQUE-01 W7).**
Added wave-1-prep to close BAR-CRITIQUE-02 **C1**; derived from this item's own bands above.
**No threshold in this item was changed.**

| Ladder | 4 | 6 | 8 |
|---|---|---|---|
| Native | 4 / 10 | 6 / 10 | 8 / 10 |

**Aggregation (a property of this item, not of the critic):** min(raw, cap) where cap is the lowest 'blocks score above' value among absent features.

## How we lose

- **Art before pipeline.** We model a beautiful xanmeer and render it with no tonemapping, no
  IBL, and a flat sky. It looks worse than a grey box would under a correct pipeline, and
  nobody can tell whether the model is good. Ordering violation: §1–§5 must land before any
  art is judged, and this file is ordered by cost-to-benefit for exactly that reason.
- **"It runs at 60fps though."** Every feature here costs frame time, and the temptation is
  to cut §4, §6, §8 and §10 to hold framerate on a laptop. That is a legitimate engineering
  tradeoff and an illegitimate *judging* one: cut features are cut features, and the fidelity
  score falls. Performance is a different axis with a different corpus area; it may not be
  offered as a defence here.
- **Half-features.** SSAO with a radius of 2 cm that does nothing. Bloom at strength 0.02.
  A "sky" that is a gradient PNG. Three cascades at 512². Each is marked present by an
  optimistic builder and each fails its DETECT. Guard: MIN BAR lines are part of the
  definition of present, not aspirations.
- **`MeshBasicMaterial` survival.** It gets used once for a debug marker and then copied.
  Every basic-material object is invisible to lights and immune to shadows, and each one
  creates a flat region that fires M8. Guard: a repo-wide grep is part of §14's cross-check,
  and a shipped `MeshBasicMaterial` on anything other than UI or a debug gizmo is a defect.
- **The foliage compromise.** Crossed quads are cheap and instancing is work, so foliage
  stays as quads "for now" through five waves. ~~Black Marsh is 70% vegetation~~ **the vegetated
  regions are dense enough that this is the feature most likely to be permanently deferred and
  most damaging when it is** — and the *arid* regions punish the opposite failure, since a
  quad-billboard reads worst of all against open sky with nothing to hide behind.
  *(AMENDED wave 0 (rebase-s22), S24: "70% vegetation" is a province-wide claim the map does not
  support — the Stone Wastes, the Clay Moor and the Salt Hills are not vegetated, and the Stone
  Forest's growth is petrified. Per-region foliage density belongs to `regions.json`.)*
- **Water deferred because it's hard.** Planar reflections need a second render pass and
  someone will decide that's a week-four problem. The starting region is a fen. The very
  first screenshot anyone ever sees of this game will be mostly water.
- **DETECT never run.** The critic fills §14 from the build log ("the PR says SSAO was
  added") instead of from pixels. The checklist becomes a changelog. Guard: every present
  mark requires a cited pixel region or metric value, and unevidenced marks are struck.

## Provenance note

`provenance: constructed`, `confidence: high`.

The feature list is the standard contemporary real-time rendering feature set as it exists in
Three.js r150+ (`MeshStandardMaterial`/`MeshPhysicalMaterial`, `PMREMGenerator`,
`ACESFilmicToneMapping`, `SRGBColorSpace`, `CSM`/cascade add-ons, `EffectComposer` with
SSAO/Bloom/SMAA passes, `InstancedMesh`, `THREE.Sky`, `Reflector`/planar reflection,
`LOD`). Those APIs and their behaviour are `confidence: high` — they are documented engine
features, not recalled numbers.

The **TELL** and **DETECT** entries are `constructed`: they are the authoring agent's
enumeration of the visual consequence of each absence, written to be checkable from a
screenshot. They have not been empirically validated against a corpus of broken builds — the
validation will happen naturally, as each wave's captures either do or do not exhibit the
described tell. **Critics should record when a DETECT procedure proves unusable in practice
and amend it**; that feedback is the intended calibration path and is more valuable than the
list being right first time.

The **MIN BAR** numbers (2048² cascades, 5 000 instances, 1000 m draw distance, bloom
strength ≤ 0.35, SSAO radius ≈ 0.5 m) are `constructed` project decisions with no upstream
authority. They are binding anyway, per CORPUS-CONTRACT §3, because they are checkable. The
**"Blocks score above"** column is a project judgement about relative severity and is the
most arguable content in this file; it should be amended by ruling, not by drift.
