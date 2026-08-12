# W1-30 builder delivery

Tested source: `ce10b0a` plus this delivery commit (`9f992f5` before amendment).
Dependencies: W1-06 `236f97b`; W1-24 `302ee3e`.

## Production delivery

* Added one fail-closed semantic PBR family factory, deterministic reusable non-colour detail maps,
  actual cavity/AO sampling, explicit shadow/IBL/LOD metadata, and a live scene census for all 21
  owned paths.
* Routed the canonical exterior, every data-built interior, actor materials (through the canonical
  scene palette), all 13 streamed province terrain/flora/water families, and near/far LOD materials
  through the foundation. Existing bounded Basic materials remain light sources, decals, refractive
  effects, and canvas composites rather than governed opaque world fallbacks.
* Routed the 13 region and eight settlement style boards through the boot loader, renderer and
  province material resources. Each live regional family now carries its resolved dominant
  materials, silhouette grammar, inexplicable element and atmospheric response for perturbation.
* Replaced key-presence coverage with 21 explicit module/observable contracts. The gate opens each
  shipping module and refuses a missing observable; it separately proves the three-stage styleboard
  consumer chain, so `VISUAL_FEATURES` alone cannot produce green coverage.
* Preserved the W1-06 simulation-evaluated skinned rig, attachment sockets, attack/locomotion/action
  state presentation, camera containment, and the W1-24 capture/declaration routes. Renderer code
  remains read-only with respect to simulation.

## Bounded builder verification

`node tools/render/w1-30-gate.mjs` was GREEN: 21/21 verified module/observable consumers, 13+8 style
boards, three styleboard consumer stages, three shared whole-game builder families, and 12
explicitly bounded Basic sites. An unknown
`generic_fantasy` family produced the intended red before material creation. `npm run
metrics:selftest` held all 21 assertions (two legal-reference-dependent checks skipped as declared).

`node tools/harness/smoke.mjs` launched Chromium 141/WebGL2, advanced rAF, decoded the shipping PNG
and found 577 unique colours (non-blank). No capture binary is committed.

## Critic reproduction order

1. `node tools/render/w1-30-gate.mjs`
2. `node tools/analysis/data-index.mjs --check`
3. `npm run metrics:selftest`
4. `npm run gate:strict`
5. Run the plan-owned fixed-eight/live action matrices and blind protocols from the sealed reference
   inventory. No visual score or 7.0 gate is claimed by this builder.

## Continuation renderer completion (2026-08-12)

The continuation commit replaces renderer declarations with shipping-pixel mechanisms on the shared
path: a single bounded HDR world target and depth texture feed depth-neighbour AO, edge-aware AA and
a restrained post grade before dialogue/HUD/title composition; the existing ACES/sRGB fallback
remains available. `Renderer.setVisualFeature()` is the live sabotage surface for post-processing,
AO, AA, shadows, IBL, atmosphere, sky and lighting.

`Sky` now owns one direction for the dome, sun, inverse moon and dynamic radiance environment. Its
120 m shadow fit snaps to 120/2048 m texels. The deterministic 16x8 equirectangular environment is
updated from the same time/weather/region response and is sampled by governed Standard materials;
disabling IBL removes it. Shared material records now publish UV scale, wetness, bounded exception
and family-specific environment response in addition to cavity maps.

Cheap aggregate: `node tools/render/w1-30-aggregate.mjs`. Full consumer gate: `node
tools/render/w1-30-gate.mjs`. Literal metric controls: `npm run metrics:selftest`. Shipping WebGL
smoke: `node tools/harness/smoke.mjs` (Chromium 141/WebGL2, 577 unique colours). A subsequent live
capture caught an invalid Three `Color.addScaledVector` call in the dynamic IBL update; the focused
repair uses explicit RGB accumulation and the readiness path then completed. Capture media stayed
under `/tmp` and no binary evidence was committed.

## Package 2 — whole-game world-art breadth (2026-08-12)

Package 2 is complete. The production registry and consumers now add region-specific flora
proportion/lean/depth composition across all 13 regions, settlement-specific structural grammar
inside and outside all eight settlements, and governed identities for every hand-built place.
The exhaustive text census, controls, rendered observation and reproduction commands are in
`reports/w1-30/PACKAGE-2-CENSUS.md`. At that checkpoint Packages 3–5 remained pending; their final
delivery is recorded below. Package 2 did not and the final builder still does not claim the
critic's visual scores.

### Package 2 visible-production remediation

The continuation converts the remaining metadata-only seams into geometry/material output:
eight exterior skyline/support/aperture/street grammars, settlement ceiling and junction grammar
for all generated interiors, terrain vertex-material variation driven by all 13 region art rows,
grammar-derived construction in all five hand-built places, and four creature primitive/proportion/
material families. The strengthened Package 2 gate requires the art read and render mutation in the
same production consumer and checks distinct perturbable render profiles; mesh names and userData
cannot independently satisfy it. The later Packages 3–5 closure follows.

## Packages 3–5 — final production builder closure (2026-08-12)

All remaining builder-owned work is complete. Critic-owned complete populations, blind comparison,
independent visual judgement, final aggregation and the two 7/10 verdicts remain explicitly unclaimed.

### Character, equipment and animation

The W1-06 simulation rig remains authoritative for combat timing, root translation, hurtboxes and
weapon sockets. The renderer now consumes that evaluated pose for a skinned player and NPC, adds
three deterministic 4/7/10 f@60 secondary-motion layers, three visibly distinct five-slot equipment
sets selected from the authoritative equip-load band, and terminal foot IK against the active
collision-cell ground. Cross-fades were lengthened to 16 frames without changing state or hit
windows, and the idle breathing/weight shift was strengthened so it remains continuous at 60 Hz.

The shared trace now records the RI-VIS08 authority block (clip time/length/sample rate, blend
weights, root/controller, named bones, attachment, surface normals, IK, secondary proxies and an
8x8-equivalent locality-sensitive silhouette/rest hash). Three deterministic representative traces
(`attack_chain`, `locomotion_slope20`, `hit_reactions`; seed 3030; 180 frames each; 60 f@60) produced
a GREEN literal C1–C10 report at `/tmp/w1-30-animation-metrics.json`. Complete action-matched motion
populations remain critic-owned.

### VFX, streaming and LOD

The shipping spell renderer now has bounded release, travel, impact and long residue paths with
school palettes, lit particles, depth prepass/soft intersection, mesh/refraction effects, controlled
blending, a 4,000-particle whole-frame cap, 60-decal cap and deterministic spawn-frame seeds. The
live Marshfire proof observed one release system, three impact systems/612 particles/two decals,
then a surviving late decal. Corrected spell core colours pass the literal strict ΔE2000 > 13
forbidden-anchor gate.

Province streaming publishes near/detailed/far bands, one-tile release hysteresis, shared geometry
pools and final-reference disposal. Renderer resize/history policy, shader prewarm and draw,
triangle, program, geometry, texture and VFX observables are production-readable. Time/weather pins
now survive deterministic captures, and the sky has a restrained region-coloured fill light for
readable shadowed forms.

### Bounded live proof and controls

One reusable Chromium 141/SwiftShader WebGL browser completed all nine required observations at
320x180 under `/tmp/w1-30-live-proof-final`: exterior day, low-light exterior, emissive interior,
street/interior transition, combat, character close-up, vegetation/atmosphere, spell
release-impact-residue and a 27 m/525-frame walked streamed boundary. The manifest is GREEN, all
frames have deterministic SHA-256 provenance, the missing-spell case refuses cleanly, the walked
route reports zero teleports, and no page errors occurred. Frames and browser caches are transient
and intentionally not committed.

Targeted controls were executed and observed RED:

* `node tools/render/w1-30-package3.mjs --break actor-secondary-frill`
* `node tools/render/w1-30-package4.mjs --break 'MAX_FRAME_PARTICLES = 4000'`
* `node corpus/80-methods/palette-selfcheck.mjs --json --break-core sorcery_marshfire`
* live `setVisualFeature('postprocess', false)` changed the shipping frame hash and was restored.

No binary production assets were added. All new visual content is deterministic code/data-native
geometry, material and motion work; therefore no third-party asset provenance or LFS change is
required.

That statement applied to the superseded closure commit only. The rendered-evidence remediation
below adds governed production assets and replaces it as the current asset declaration.

### Exact fresh-critic reproduction order

1. `node tools/boot-check.mjs`
2. `npm run gate:strict && npm run metrics:selftest`
3. `node tools/analysis/data-index.mjs --check`
4. `node tools/render/w1-30-package2.mjs && node tools/render/w1-30-package3.mjs && node tools/render/w1-30-package4.mjs`
5. Run the three trace commands above (and the registered flat/stair scenarios), then run
   `node corpus/80-methods/anim-metrics.mjs <trace.jsonl...> --json <fresh-output.json>`.
6. `node tools/render/w1-30-live-proof.mjs --out <fresh-transient-dir> --width 320 --height 180 --timeout 180000`
7. `W130_LIVE_MANIFEST=<fresh-transient-dir>/manifest.json node tools/render/w1-30-final.mjs`
8. Run the plan's complete native reference, visual, action-matched motion and blind populations;
   independently aggregate and issue the modern-fidelity and art-direction verdicts.

## Rendered-evidence remediation (2026-08-12)

The previous builder-complete claim is superseded. Inspection of the ordinary shipping frames
showed prototype geometry, crushed values, repeated cones/boxes, buried settlements, tubular
characters and weak effect integration even though mechanism gates were green. The complete
population and reference-led diagnosis is tracked in `VISUAL-REMEDIATION-MATRIX.md`.

This pass implemented the shared terrain/material, vegetation, settlement, architecture, interior,
actor/equipment/weapon, weather, VFX-light, streaming-observable and UI changes recorded there. A
concrete consumption defect found during inspection was fixed: full wilderness density was stamped
through settlement plans, so Thorn's 18 buildings were hidden by scrub. Plan-aware negative space
now applies to tile, near and cover populations. Material pooling reduces the default representative
from 2,429 live materials to 390 without removing regional styles.

### Production assets and provenance

Three official Poly Haven 1K PBR packs (`brown_mud`, `bark_brown_01`,
`plastered_stone_wall`) are CC0 by Rob Tuytel. A project-owned Black Marsh 4×4 surface atlas was
created with the built-in OpenAI image generator, split to 256² sources, and seven admitted runtime
maps were neutralised to preserve regional colour authority. The exact source/licence, prompt,
transform, dimensions, consumers and SHA-256 for all 35 files are in
`game/assets/w1-30/materials/manifest.json`; `node tools/render/w1-30-assets.mjs` verifies them.
Total committed asset bytes are 6,681,570. Individual files are below GitHub limits. Git LFS is
installed locally but the repository has no active LFS routing for these paths; it was not added or
reconfigured.

### Latest bounded result and honest handoff state

`/tmp/w1-30-remediation-final2/manifest.json` is the latest complete GREEN nine-scene SwiftShader
run with pinned seed, frames, action labels and frame hashes. Inspection then found that the named
`swamp_canopy` fixture had zero vegetation instances under its proof pose despite satisfying the
luma gate. The current tree replaces it with the real Thornmarsh population and requires >1,000
vegetation plus >100 ground-cover instances; the focused replacement at
`/tmp/w1-30-remediation-vegetation2` observed 34,312 and 405 respectively. A fresh complete current-tree
run is deliberately left to the GPU continuation rather than spending another software-raster pass
after the user requested immediate handoff. Structural gates do not constitute either 7/10 verdict.

This machine has no GPU. The following are not claimed: native 1024²/1280×720 material and AA
inspection; full-speed action-matched moving review; temporal water/foliage/rain stability; repeated
native walked LOD seams; representative GPU frame budgets. Run these in this order on the GPU
instance after checking out the PR head:

1. `node tools/render/w1-30-aggregate.mjs`
2. `node tools/render/w1-30-live-proof.mjs --out /tmp/w1-30-gpu-proof --width 1280 --height 720 --timeout 180000`
3. run RI-VIS03 M1–M12 at the plan-native windows, including stationary water and displacement-gated sequences;
4. render the registered locomotion/combat action cells at 60 f@60 and inspect attachments, IK and secondary motion;
5. repeat the streamed-boundary walk and record GPU frame time, draw/triangle/program/geometry/texture/VFX budgets;
6. only then dispatch the fresh critic for complete populations, blind comparison, independent judgement, final aggregation and the two 7/10 verdicts.
