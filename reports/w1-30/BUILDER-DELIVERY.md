# W1-30 builder delivery

Tested source: `09d9609865a49fb8f01d07396d66d6a67b9448f7` plus this delivery commit.
Dependencies: W1-06 `236f97b`; W1-24 `302ee3e`.

## Production delivery

* Added one fail-closed semantic PBR family factory, deterministic reusable non-colour detail maps,
  explicit shadow/AO/IBL/LOD metadata, and a live scene census for all 21 owned paths.
* Routed the canonical exterior, every data-built interior, actor materials (through the canonical
  scene palette), all 13 streamed province terrain/flora/water families, and near/far LOD materials
  through the foundation. Existing bounded Basic materials remain light sources, decals, refractive
  effects, and canvas composites rather than governed opaque world fallbacks.
* Added 13 region and eight settlement style boards. Each records dominant/contrast materials,
  silhouette grammar, inexplicable element, atmospheric response, and forbidden generic forms.
* Preserved the W1-06 simulation-evaluated skinned rig, attachment sockets, attack/locomotion/action
  state presentation, camera containment, and the W1-24 capture/declaration routes. Renderer code
  remains read-only with respect to simulation.

## Bounded builder verification

`node tools/render/w1-30-gate.mjs` was GREEN: 21/21 owned-path consumers, 13+8 style boards, three
shared whole-game builder families, and 12 explicitly bounded Basic sites. An unknown
`generic_fantasy` family produced the intended red before material creation. `npm run
metrics:selftest` held all 21 assertions (two legal-reference-dependent checks skipped as declared).

One reusable live browser rendered a settled 960x540 exterior/gameplay frame with actual pixels and
no page errors. The transient composite is `/tmp/w1-30-live.png` and is not committed. The frame
showed the shipping player silhouette, layered canopy/root architecture, streamed wet ground,
atmospheric depth and shadowed vegetation; its paired cleared-buffer null remained visibly black.

## Critic reproduction order

1. `node tools/render/w1-30-gate.mjs`
2. `node tools/analysis/data-index.mjs --check`
3. `npm run metrics:selftest`
4. `npm run gate:strict`
5. Run the plan-owned fixed-eight/live action matrices and blind protocols from the sealed reference
   inventory. No visual score or 7.0 gate is claimed by this builder.
