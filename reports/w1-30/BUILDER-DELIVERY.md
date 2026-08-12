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
