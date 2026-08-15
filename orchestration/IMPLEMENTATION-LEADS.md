# Item-specific implementation leads

**Owner:** Orchestrator. **Purpose:** Route builders for named roadmap items to bounded external code
candidates worth inspecting before they choose an implementation.

**Audit basis:** checked on 2026-08-15 against `codex/wave1-build-experiment` at `989a259`, including
`CLAUDE.md`, `orchestration/ROADMAP.md`, `orchestration/PLAN-LOOP.md`, the current Wave-1 plans, and
the production authorities named below. External sources are pinned to the full commits in the
candidate registry. Re-check the live Elder files and the pinned external source at dispatch time;
builders read both trees before deciding.

## How a mapped builder uses this file

1. Read only the heading linked from the dispatched roadmap item and the candidate entries it names.
2. Inspect the pinned paths and licence before choosing an implementation.
3. Record one existing-status finding per candidate: `used`, `adapted`, `concept-only` or `declined`,
   followed by the decisive technical, evidential or licensing reason.
4. A `declined` finding completes the evaluation. It creates no follow-on work by itself.
5. Any copied or adapted material carries its exact pin, licence and required attribution beside the
   vendored code. A `concept-only` entry supports an independently written implementation and permits
   no source copying.

The shipped constraints remain runtime-created Three.js assets, vendored browser ESM/JavaScript,
Three r180 with the current WebGL renderer, no runtime network dependency, seeded determinism,
fixed-step and allocation contracts, and ordinary mobile/desktop budgets. Autonomous development
tools may emit committed runtime JavaScript. External leads preserve the item's existing scope,
acceptance bar, authority boundaries, null controls, ownership and independent critic gates.

Current agents continue their assigned work. This routing enters when a mapped item next reaches
planning, remediation or building.

## Existing Elder authorities the adapters must preserve

- `game/src/sim/camera.js` owns the single fixed-step third-person camera state.
- `game/src/sim/collision.js`, `game/src/combat/geometry.js` and `game/src/world/field.js` own current
  primitive collision, actor melee sweeps and canonical terrain height/query behaviour.
- `game/src/combat/ai.js` and `game/src/sim/stealth/{perception,system,search}.js` own combat decisions,
  LOS policy, memory and search state.
- `game/src/render/actor.js` consumes the existing combat rig and Three skeleton.
- `game/src/world/footprint.js`, `game/src/render/exterior.js` and `game/src/world/province.js` own
  settlement footprints, exterior plans and their shared render/collision consumption.
- `tools/world/build-roads.mjs` and `game/src/world/field.js` own the current road grades, deck spans,
  clearances and runtime ingestion.

An external module may sit behind one of these authorities or supply pure input data to it. A second
competing authority requires an explicit roadmap/plan ruling before implementation.

## Roadmap routing

<a id="i2--capture-and-the-deck"></a>
### `I2` — Capture and the Deck

Inspect [three-gpu-pathtracer](#candidate-three-gpu-pathtracer) as an optional development-only,
physically based comparison arm for bounded hero scenes.

<a id="g1--camera"></a>
### `G1` — Camera

Inspect [camera-controls](#candidate-camera-controls) for damping, bounds and near-plane obstruction
algorithms, and [three-mesh-bvh](#candidate-three-mesh-bvh) for new static triangle-structure
obstruction. Preserve `sim/camera.js` as the state and trace authority.

<a id="f1--materials-and-surface-response"></a>
### `F1` — Materials and surface response

Inspect [three-gpu-pathtracer](#candidate-three-gpu-pathtracer) only when a bounded reference-render
arm could distinguish material response from the existing raster pipeline.

<a id="f4--light-sky-and-atmosphere"></a>
### `F4` — Light, sky and atmosphere

Inspect [three-gpu-pathtracer](#candidate-three-gpu-pathtracer) as a development comparison tool for
selected static lighting compositions. The current F4 WebGL work and its measured acceptance remain
the production path.

<a id="f5--frame-pipeline"></a>
### `F5` — Frame pipeline

Inspect [LAAS CPU colour scripting](#candidate-laas-cpu) for deterministic time/region keyframe
interpolation and [three-gpu-pathtracer](#candidate-three-gpu-pathtracer) for bounded reference frames.

<a id="f6--terrain-and-vegetation"></a>
### `F6` — Terrain and vegetation

Compare [LAAS CPU geometry](#candidate-laas-cpu) with [ez-tree](#candidate-ez-tree) for runtime-grown
trees, rocks, deadfall and small ground dressing. Choose from Elder captures and measured budgets.

<a id="f8--building-kit"></a>
### `F8` — Building kit

Inspect [three-bvh-csg](#candidate-three-bvh-csg) for cached openings and unusual modules,
[img2threejs](#candidate-img2threejs) for autonomous code-generated kit parts, and the rectangular
lot outputs from [JGengine and Town Forge](#candidate-town-layouts) where placement data helps the kit.

<a id="f10--characters-and-creatures"></a>
### `F10` — Characters and creatures

Inspect [img2threejs](#candidate-img2threejs) as development tooling for code-only heads, bodies,
armour and silhouette modules. The current actor skeleton and combat rig remain authoritative.

<a id="f11--animation-quality"></a>
### `F11` — Animation quality

Inspect the small pure state-resolution seams in [ecctrl](#candidate-ecctrl). Integrate any useful
logic into Elder's existing clip library, animator and rig.

<a id="f12--vfx"></a>
### `F12` — VFX

Study [fable-lite](#candidate-fable-lite) for pooled decals, shockwaves, fixed light pools and pipeline
prewarming. Its licence status permits `concept-only` use at the audited pin.

<a id="f13--art-direction-and-region-identity"></a>
### `F13` — Art direction and region identity

Inspect [LAAS CPU colour scripting](#candidate-laas-cpu) for deterministic region/time palettes and
[img2threejs](#candidate-img2threejs) for code-only region-specific prop families. Elder's Black Marsh
references supply the values and shapes.

<a id="f14--performance-and-lod"></a>
### `F14` — Performance and LOD

Inspect [LAAS CPU geometry](#candidate-laas-cpu), [ez-tree](#candidate-ez-tree),
[three-mesh-bvh](#candidate-three-mesh-bvh) and [Navcat](#candidate-navcat) for cached archetypes,
raw LOD geometry, accelerated static queries and generation-time navigation. Measure each candidate
under the existing phone and desktop budgets.

<a id="g2--the-exchange"></a>
### `G2` — The exchange

Inspect [three-mesh-bvh](#candidate-three-mesh-bvh) only for weapon/projectile interaction with static
world triangles or a proven static broadphase need. `combat/geometry.js` keeps the exact moving-actor
capsule sweep.

<a id="g3--weapons-and-movesets"></a>
### `G3` — Weapons and movesets

Inspect [img2threejs](#candidate-img2threejs) as autonomous development tooling for runtime-code weapon
and shield geometry. Existing moveset reachability, frames, traces and combat acceptance stay intact.

<a id="g4--enemies-that-can-fight-you"></a>
### `G4` — Enemies that can fight you

Inspect [Yuka](#candidate-yuka) for steering/goal algorithms, [Navcat](#candidate-navcat) for path data
and local avoidance, and [three-mesh-bvh](#candidate-three-mesh-bvh) for static-world LOS or projectile
queries. Adapt behind Elder's SoulsAI and perception authorities.

<a id="g5--bosses-and-encounters"></a>
### `G5` — Bosses and encounters

Inspect [Yuka](#candidate-yuka) for bounded steering/goal patterns and [Navcat](#candidate-navcat) for
arena path/spacing data when the live acceptance exposes a relevant gap.

<a id="g6--combat-impact-feedback"></a>
### `G6` — Combat impact feedback

Study [fable-lite](#candidate-fable-lite) for trauma-squared shake, hit-stop, slow motion and prewarmed
impact effects. Implement through Elder's time, camera and feedback authorities.

<a id="g7--combat-feel"></a>
### `G7` — Combat feel

Study the same [fable-lite](#candidate-fable-lite) feedback mechanisms when player evidence identifies
impact readability as the active gap. Its source remains `concept-only` at the audited pin.

<a id="w1--terrain-form-and-road-network"></a>
### `W1` — Terrain form and road network

Inspect [JGengine and Town Forge](#candidate-town-layouts) for settlement/local-road data and
[Azgaar](#candidate-azgaar-routes) for regional route topology. Inspect
[three-mesh-bvh](#candidate-three-mesh-bvh) only for static triangle structures and overhangs; Elder's
height field remains the ground authority. Feed accepted topology into Elder's existing terrain,
grade, deck, clearance, gate and ingestion pipeline.

<a id="w4--settlements-with-an-outside"></a>
### `W4` — Settlements with an outside

Compare [JGengine and Town Forge](#candidate-town-layouts) for pure street/lot/building placement data,
[img2threejs](#candidate-img2threejs) for generated exterior modules,
[three-bvh-csg](#candidate-three-bvh-csg) for cached unusual forms, and
[Navcat](#candidate-navcat) for later navigation derived from accepted geometry. Use Elder's oriented
footprint and shared plan pipeline for every accepted building.

<a id="w5--doors-interiors-and-continuity"></a>
### `W5` — Doors, interiors and continuity

Inspect [three-bvh-csg](#candidate-three-bvh-csg) for cached unusual openings,
[three-mesh-bvh](#candidate-three-mesh-bvh) for new static triangle interiors and
[Navcat](#candidate-navcat) for paths/off-mesh doorway links. Existing footprint, door and interior
continuity contracts remain canonical.

<a id="w6--landmarks-and-prose-directions"></a>
### `W6` — Landmarks and prose directions

Inspect [JGengine and Town Forge](#candidate-town-layouts) for street hierarchy, junctions and landmark
placement inputs, and [Azgaar](#candidate-azgaar-routes) for route hierarchy. The resulting world must
still pass Elder's prose-direction and played navigation gates.

<a id="w7--getting-around"></a>
### `W7` — Getting around

Inspect [Azgaar](#candidate-azgaar-routes) only for regional route hierarchy/shared-corridor concepts
that help the authored transport network. Travel modes, fares, stations and discovery remain Elder data.

<a id="w8--dungeons-xanmeers-and-ruins"></a>
### `W8` — Dungeons, xanmeers and ruins

Inspect [img2threejs](#candidate-img2threejs) and [three-bvh-csg](#candidate-three-bvh-csg) for runtime
code geometry, [three-mesh-bvh](#candidate-three-mesh-bvh) for new static triangle collision/query
needs, and [Navcat](#candidate-navcat) for navigation derived from the accepted final geometry.

<a id="w10--living-world"></a>
### `W10` — Living world

Inspect [Yuka](#candidate-yuka) for ambient steering/goal ideas and [Navcat](#candidate-navcat) for
paths/local avoidance. Elder's schedules, stable entity order and simulation authority remain in control.

<a id="w11--strangeness-and-built-alienness"></a>
### `W11` — Strangeness and built alienness

Inspect [LAAS CPU rock/deadfall geometry](#candidate-laas-cpu),
[img2threejs](#candidate-img2threejs), [three-bvh-csg](#candidate-three-bvh-csg) and
[three-mesh-bvh](#candidate-three-mesh-bvh) for code-generated alien forms and their static queries.
Black Marsh architecture and banned-pattern data govern the result.

<a id="c6--magic-projectiles"></a>
### `C6` — Magic projectiles

Inspect [three-mesh-bvh](#candidate-three-mesh-bvh) for first-hit and swept projectile obstruction
against newly generated static triangle structures. Spell behaviour and combat timing stay authoritative.

<a id="c7--stealth-and-theft"></a>
### `C7` — Stealth and theft

Inspect [Yuka](#candidate-yuka) for perception/memory algorithms and
[three-mesh-bvh](#candidate-three-mesh-bvh) for static triangle occlusion only when the current Elder
query cannot express the geometry. Preserve the unified Elder perception, memory and search state.

<a id="c8--crime-and-justice"></a>
### `C8` — Crime and justice

Inspect [Yuka](#candidate-yuka) for bounded witness/perception ideas and
[three-mesh-bvh](#candidate-three-mesh-bvh) for the same static-world query seam. Elder owns witness,
report, bounty and guard state.

## Candidate registry

<a id="candidate-laas-cpu"></a>
### `Braffolk/fable5-world-demo` — CPU geometry and colour scripting

- **Pin/licence:** [`fd75fdb718996908aad3d22b59dfa297dc94298d`](https://github.com/Braffolk/fable5-world-demo/tree/fd75fdb718996908aad3d22b59dfa297dc94298d), [MIT](https://github.com/Braffolk/fable5-world-demo/blob/fd75fdb718996908aad3d22b59dfa297dc94298d/LICENSE).
- **Inspect:** [`Seed.ts`](https://github.com/Braffolk/fable5-world-demo/blob/fd75fdb718996908aad3d22b59dfa297dc94298d/src/core/Seed.ts), [`NoiseJS.ts`](https://github.com/Braffolk/fable5-world-demo/blob/fd75fdb718996908aad3d22b59dfa297dc94298d/src/core/NoiseJS.ts), [`RockBuilder.ts`](https://github.com/Braffolk/fable5-world-demo/blob/fd75fdb718996908aad3d22b59dfa297dc94298d/src/vegetation/RockBuilder.ts), [`Skeleton.ts`](https://github.com/Braffolk/fable5-world-demo/blob/fd75fdb718996908aad3d22b59dfa297dc94298d/src/vegetation/Skeleton.ts), [`TubeMesh.ts`](https://github.com/Braffolk/fable5-world-demo/blob/fd75fdb718996908aad3d22b59dfa297dc94298d/src/vegetation/TubeMesh.ts), [`LeafMesh.ts`](https://github.com/Braffolk/fable5-world-demo/blob/fd75fdb718996908aad3d22b59dfa297dc94298d/src/vegetation/LeafMesh.ts), [`Species.ts`](https://github.com/Braffolk/fable5-world-demo/blob/fd75fdb718996908aad3d22b59dfa297dc94298d/src/vegetation/Species.ts), [`Deadfall.ts`](https://github.com/Braffolk/fable5-world-demo/blob/fd75fdb718996908aad3d22b59dfa297dc94298d/src/vegetation/Deadfall.ts) and [`ColorScript.ts`](https://github.com/Braffolk/fable5-world-demo/blob/fd75fdb718996908aad3d22b59dfa297dc94298d/src/render/ColorScript.ts).
- **Candidate use:** deterministic CPU/basic-Three trees, rocks, deadfall and palette interpolation.
  Convert the smallest selected TypeScript closure to r180 browser JS, generate a bounded archetype
  set once, cache it and feed Elder's batching/instancing.
- **Boundary:** `TreeBuilder.ts` imports a mixed WebGPU foliage path. A builder either replaces that
  dependency or selects the pure files above. `src/gpu/**`, `src/sky/**`, `Forests.ts`, `Heightfield.ts`,
  `MacroMap.ts`, `TerrainTiles.ts`, TSL materials, GTAO/post, water and private Three patches are outside
  the current r180/WebGL decision.

<a id="candidate-fable-lite"></a>
### `wass08/fable-lite` — impact feedback and pooled VFX (`concept-only`)

- **Pin/licence:** [`26423b9b9e7678fb4219c8adf6e302196fad19fe`](https://github.com/wass08/fable-lite/tree/26423b9b9e7678fb4219c8adf6e302196fad19fe). The audited tree has no `LICENSE` file and its [`package.json`](https://github.com/wass08/fable-lite/blob/26423b9b9e7678fb4219c8adf6e302196fad19fe/package.json) declares no licence.
- **Inspect:** [`src/main.js`](https://github.com/wass08/fable-lite/blob/26423b9b9e7678fb4219c8adf6e302196fad19fe/src/main.js) for trauma-squared shake/hit-stop/slow motion and [`src/spells.js`](https://github.com/wass08/fable-lite/blob/26423b9b9e7678fb4219c8adf6e302196fad19fe/src/spells.js) for pooled decals, shockwaves, fixed lights and prewarming.
- **Candidate use:** independently implement the observed behaviour. The source uses `Math.random`,
  render-camera mutation and local time scaling; an Elder implementation must use project RNG,
  established camera/time ownership and fixed-step rules.
- **Boundary:** source copying and adaptation require a future explicit licence. Its TSL/WebGPU renderer
  and materials remain outside the current renderer decision.

<a id="candidate-ecctrl"></a>
### `pmndrs/ecctrl` — animation state resolution

- **Pin/licence:** v2.0.0 [`e2f4eb899ab54787170f5472832efb0a238c0ef9`](https://github.com/pmndrs/ecctrl/tree/e2f4eb899ab54787170f5472832efb0a238c0ef9), [MIT](https://github.com/pmndrs/ecctrl/blob/e2f4eb899ab54787170f5472832efb0a238c0ef9/LICENSE) plus [`NOTICE`](https://github.com/pmndrs/ecctrl/blob/e2f4eb899ab54787170f5472832efb0a238c0ef9/NOTICE).
- **Inspect:** [`resolveAnimationState.ts`](https://github.com/pmndrs/ecctrl/blob/e2f4eb899ab54787170f5472832efb0a238c0ef9/src/character/animation/resolveAnimationState.ts), [`EcctrlAnimationStateController.tsx`](https://github.com/pmndrs/ecctrl/blob/e2f4eb899ab54787170f5472832efb0a238c0ef9/src/character/animation/EcctrlAnimationStateController.tsx) and optional [`CurveLUT.ts`](https://github.com/pmndrs/ecctrl/blob/e2f4eb899ab54787170f5472832efb0a238c0ef9/src/curves/CurveLUT.ts).
- **Candidate use:** adapt the small state-resolution and lookup-table algorithms into Elder's existing
  animator. The full package requires Three ≥ r184, React, R3F and Rapier; package installation creates
  a second controller stack. Example GLB animation assets fall outside runtime-created assets.
- **Boundary:** ecctrl supplies no suitable standalone third-person follow/obstruction camera and no
  Elder-compatible character rig.

<a id="candidate-camera-controls"></a>
### `yomotsu/camera-controls` — orbit, damping and obstruction algorithms

- **Pin/licence:** v3.1.2 [`e541737375d12851358bda940611872ec796fcf0`](https://github.com/yomotsu/camera-controls/tree/e541737375d12851358bda940611872ec796fcf0), [MIT](https://github.com/yomotsu/camera-controls/blob/e541737375d12851358bda940611872ec796fcf0/LICENSE); peer Three ≥ r126.1.
- **Inspect:** [`src/CameraControls.ts`](https://github.com/yomotsu/camera-controls/blob/e541737375d12851358bda940611872ec796fcf0/src/CameraControls.ts), especially damping, focal offsets, bounds and its four near-plane-corner collision rays.
- **Candidate use:** extract bounded algorithms or vendor only after proving package DOM/event ownership
  fits Elder. Keep input sampling, fixed-step trace, camera state and determinism in `sim/camera.js`.

<a id="candidate-ez-tree"></a>
### `dgreenheck/ez-tree` — runtime tree geometry and LOD

- **Pin/licence:** v1.1.0 [`dcf309bd86bd521083d9c70f01f2de45fdc7c457`](https://github.com/dgreenheck/ez-tree/tree/dcf309bd86bd521083d9c70f01f2de45fdc7c457), [MIT](https://github.com/dgreenheck/ez-tree/blob/dcf309bd86bd521083d9c70f01f2de45fdc7c457/LICENSE); peer Three ≥ r167.
- **Inspect:** [`src/lib/tree.js`](https://github.com/dgreenheck/ez-tree/blob/dcf309bd86bd521083d9c70f01f2de45fdc7c457/src/lib/tree.js), including seeded generation, `createGeometry()` and `generateLODs()`.
- **Candidate use:** build a small fixed set of Black Marsh archetypes once, take raw branch/leaf
  `BufferGeometry`, cache it and pass it to Elder's batching/instancing. Measure generation, memory,
  silhouette and mobile LOD behaviour against LAAS's CPU alternative.

<a id="candidate-three-bvh-csg"></a>
### `gkjohnson/three-bvh-csg` — cached runtime booleans

- **Pin/licence:** v0.0.18 [`0ac3a84662958579d3627bbfcd6bb81746c2d699`](https://github.com/gkjohnson/three-bvh-csg/tree/0ac3a84662958579d3627bbfcd6bb81746c2d699), [MIT](https://github.com/gkjohnson/three-bvh-csg/blob/0ac3a84662958579d3627bbfcd6bb81746c2d699/LICENSE); peers Three ≥ r179 and three-mesh-bvh ≥ 0.9.7.
- **Inspect:** [`Brush.js`](https://github.com/gkjohnson/three-bvh-csg/blob/0ac3a84662958579d3627bbfcd6bb81746c2d699/src/core/Brush.js), [`Evaluator.js`](https://github.com/gkjohnson/three-bvh-csg/blob/0ac3a84662958579d3627bbfcd6bb81746c2d699/src/core/Evaluator.js) and the upstream [limitations](https://github.com/gkjohnson/three-bvh-csg/blob/0ac3a84662958579d3627bbfcd6bb81746c2d699/README.md).
- **Candidate use:** evaluate one-time generation/streaming booleans for shapes current wall slabs cannot
  express, then cache output. Inputs require watertight two-manifold brushes; outputs need explicit
  finite/manifold/winding checks. The upstream project describes the implementation as experimental.

<a id="candidate-img2threejs"></a>
### `img2threejs/img2threejs` — autonomous code-only asset tooling

- **Pin/licence:** v1.4.4 [`d6673386f89673a58736f8d398dd16ece67874f5`](https://github.com/img2threejs/img2threejs/tree/d6673386f89673a58736f8d398dd16ece67874f5), [Apache-2.0](https://github.com/img2threejs/img2threejs/blob/d6673386f89673a58736f8d398dd16ece67874f5/LICENSE).
- **Inspect:** [`SKILL.md`](https://github.com/img2threejs/img2threejs/blob/d6673386f89673a58736f8d398dd16ece67874f5/SKILL.md), [`forge/stage2_spec`](https://github.com/img2threejs/img2threejs/tree/d6673386f89673a58736f8d398dd16ece67874f5/forge/stage2_spec), [`forge/stage3_build`](https://github.com/img2threejs/img2threejs/tree/d6673386f89673a58736f8d398dd16ece67874f5/forge/stage3_build), [`forge/stage4_review`](https://github.com/img2threejs/img2threejs/tree/d6673386f89673a58736f8d398dd16ece67874f5/forge/stage4_review) and [`grimoire/character`](https://github.com/img2threejs/img2threejs/tree/d6673386f89673a58736f8d398dd16ece67874f5/grimoire/character).
- **Candidate use:** allow a builder to run the tool autonomously from Elder's reference images and
  emit code-only Three factories/specifications. Review and convert accepted output to vendored r180
  browser JS whose meshes are created at runtime.
- **Boundary:** this is beta development tooling. Elder's reference corpus, runtime integration,
  geometry checks, visual gates and mobile budgets judge every emitted module.

<a id="candidate-three-gpu-pathtracer"></a>
### `gkjohnson/three-gpu-pathtracer` — development reference renderer

- **Pin/licence:** v0.0.24 [`3c6cda19d1788d7d93705eee704328e66823c845`](https://github.com/gkjohnson/three-gpu-pathtracer/tree/3c6cda19d1788d7d93705eee704328e66823c845), [MIT](https://github.com/gkjohnson/three-gpu-pathtracer/blob/3c6cda19d1788d7d93705eee704328e66823c845/LICENSE); peers Three ≥ r180, three-mesh-bvh and xatlas-web.
- **Inspect:** [`README.md`](https://github.com/gkjohnson/three-gpu-pathtracer/blob/3c6cda19d1788d7d93705eee704328e66823c845/README.md) and [`src`](https://github.com/gkjohnson/three-gpu-pathtracer/tree/3c6cda19d1788d7d93705eee704328e66823c845/src).
- **Candidate use:** render progressive WebGL2 reference frames for bounded, static hero scenes to
  diagnose material/light potential and compare raster choices. It supplies a development oracle
  that stays outside the shipped real-time renderer.
- **Boundary:** upstream lists instanced geometry as unsupported and `setScene` is expensive. A trial must
  use a small selected scene or a development-only expanded copy and must never enter the game loop.

<a id="candidate-yuka"></a>
### `Mugen87/yuka` — steering, goals and perception ideas

- **Pin/licence:** v0.7.8 [`10591304811222d6856020d5de129b39ef43b58d`](https://github.com/Mugen87/yuka/tree/10591304811222d6856020d5de129b39ef43b58d), [MIT](https://github.com/Mugen87/yuka/blob/10591304811222d6856020d5de129b39ef43b58d/LICENSE).
- **Inspect:** [`SteeringManager.js`](https://github.com/Mugen87/yuka/blob/10591304811222d6856020d5de129b39ef43b58d/src/steering/SteeringManager.js), [`WanderBehavior.js`](https://github.com/Mugen87/yuka/blob/10591304811222d6856020d5de129b39ef43b58d/src/steering/behaviors/WanderBehavior.js), [`Vision.js`](https://github.com/Mugen87/yuka/blob/10591304811222d6856020d5de129b39ef43b58d/src/perception/vision/Vision.js) and [`MemorySystem.js`](https://github.com/Mugen87/yuka/blob/10591304811222d6856020d5de129b39ef43b58d/src/perception/memory/MemorySystem.js).
- **Candidate use:** adapt individual steering, goal, vision or memory algorithms behind Elder's
  existing enemy/NPC/perception interfaces.
- **Boundary:** Yuka's applicable surface is steering, goals, vision and memory. `EntityManager` would
  duplicate simulation authority; wander uses `Math.random`; several query/path operations allocate. Any adaptation needs project RNG,
  integer-frame time, stable eid order and preallocated scratch.

<a id="candidate-three-mesh-bvh"></a>
### `gkjohnson/three-mesh-bvh` — static triangle acceleration

- **Pin/licence:** v0.9.14 [`75a7046260e2bfb3bc158d8c7759f581bc1fea9d`](https://github.com/gkjohnson/three-mesh-bvh/tree/75a7046260e2bfb3bc158d8c7759f581bc1fea9d), [MIT](https://github.com/gkjohnson/three-mesh-bvh/blob/75a7046260e2bfb3bc158d8c7759f581bc1fea9d/LICENSE); peer Three ≥ r159.
- **Inspect:** [`README.md`](https://github.com/gkjohnson/three-mesh-bvh/blob/75a7046260e2bfb3bc158d8c7759f581bc1fea9d/README.md), shapecast, `raycastFirst`, worker generation and serialization.
- **Candidate use:** build/cache a BVH for new static triangle-soup buildings, interiors, overhangs or
  dungeon structures; expose bounded queries through the existing Elder collision/perception APIs.
- **Boundary:** the drawn streamed terrain is intentionally coarser than `WorldField.heightAt`.
  `WorldField.heightAt` remains ground authority; BVH queries cover selected static triangle geometry.
  Dynamic/skinned geometry requires other authorities.
  Existing SDF sphere casts and actor swept capsules stay exact for their current domains. Construct or
  rebuild trees outside the armed allocation-free fixed step.

<a id="candidate-navcat"></a>
### `isaac-mason/navcat` — runtime all-JavaScript navmesh and paths

- **Pin/licence:** v0.4.1 [`bc9d3c3f372a9a94cde9c8c2382baa35c1ebd25f`](https://github.com/isaac-mason/navcat/tree/bc9d3c3f372a9a94cde9c8c2382baa35c1ebd25f), [MIT](https://github.com/isaac-mason/navcat/blob/bc9d3c3f372a9a94cde9c8c2382baa35c1ebd25f/LICENSE); peer Three ≥ r180, dependency `mathcat`.
- **Inspect:** [`generate-tiled-nav-mesh.ts`](https://github.com/isaac-mason/navcat/blob/bc9d3c3f372a9a94cde9c8c2382baa35c1ebd25f/blocks/generators/generate-tiled-nav-mesh.ts), [`find-path.ts`](https://github.com/isaac-mason/navcat/blob/bc9d3c3f372a9a94cde9c8c2382baa35c1ebd25f/src/query/find-path.ts) and [`crowd.ts`](https://github.com/isaac-mason/navcat/blob/bc9d3c3f372a9a94cde9c8c2382baa35c1ebd25f/blocks/agents/crowd.ts).
- **Candidate use:** generate navmesh/path data at runtime after final geometry is known and feed
  precomputed waypoint buffers through Elder's NPC/enemy authorities.
- **Boundary:** current crowd/path code allocates arrays, maps, queues and clones. Direct crowd updates
  violate the armed fixed-step allocation contract. Use generation outside the step or prove a
  preallocated adaptation; maintain one navigation authority.

<a id="candidate-town-layouts"></a>
### JGengine and Town Forge — local streets, plots and buildings

#### `Noisemaker111/jgengine`

- **Pin/licence:** [`d6e64e69198aa2093d61a9a9404377adf916bcf2`](https://github.com/Noisemaker111/jgengine/tree/d6e64e69198aa2093d61a9a9404377adf916bcf2), [Apache-2.0](https://github.com/Noisemaker111/jgengine/blob/d6e64e69198aa2093d61a9a9404377adf916bcf2/LICENSE) with mandatory [`NOTICE`](https://github.com/Noisemaker111/jgengine/blob/d6e64e69198aa2093d61a9a9404377adf916bcf2/NOTICE). Earlier releases used AGPL, so this exact pin is mandatory.
- **Inspect:** [`streetGenerator.ts`](https://github.com/Noisemaker111/jgengine/blob/d6e64e69198aa2093d61a9a9404377adf916bcf2/packages/core/src/world/streetGenerator.ts), its extensive [`tests`](https://github.com/Noisemaker111/jgengine/blob/d6e64e69198aa2093d61a9a9404377adf916bcf2/packages/core/src/world/streetGenerator.test.ts), [`cityGenerator.ts`](https://github.com/Noisemaker111/jgengine/blob/d6e64e69198aa2093d61a9a9404377adf916bcf2/packages/core/src/world/cityGenerator.ts) and seeded [`rng.ts`](https://github.com/Noisemaker111/jgengine/blob/d6e64e69198aa2093d61a9a9404377adf916bcf2/packages/core/src/random/rng.ts).
- **Candidate use:** bounded deterministic street graphs, junctions, cul-de-sacs, terrain sampling,
  frontage plots, rectangular lots and parks as pure data. Use public core/package material only;
  the repository excludes copying its `Games/*` applications.
- **Boundary:** the project is young. Begin with a feature-flagged pure-data fixture and feed only
  accepted rectangles through Elder's canonical footprint and settlement plan pipeline.

#### `Obsidian-TTRPG-Community/Town-Forge`

- **Pin/licence:** v1.2.2 [`6523f7241ac4652b474e1cc1e518e88e81463eae`](https://github.com/Obsidian-TTRPG-Community/Town-Forge/tree/6523f7241ac4652b474e1cc1e518e88e81463eae), [MIT](https://github.com/Obsidian-TTRPG-Community/Town-Forge/blob/6523f7241ac4652b474e1cc1e518e88e81463eae/LICENSE).
- **Inspect:** [`rng.ts`](https://github.com/Obsidian-TTRPG-Community/Town-Forge/blob/6523f7241ac4652b474e1cc1e518e88e81463eae/src/rng.ts), [`generate.ts`](https://github.com/Obsidian-TTRPG-Community/Town-Forge/blob/6523f7241ac4652b474e1cc1e518e88e81463eae/src/generate.ts), [`roads.ts`](https://github.com/Obsidian-TTRPG-Community/Town-Forge/blob/6523f7241ac4652b474e1cc1e518e88e81463eae/src/roads.ts), [`buildings.ts`](https://github.com/Obsidian-TTRPG-Community/Town-Forge/blob/6523f7241ac4652b474e1cc1e518e88e81463eae/src/buildings.ts) and [`geometry.ts`](https://github.com/Obsidian-TTRPG-Community/Town-Forge/blob/6523f7241ac4652b474e1cc1e518e88e81463eae/src/geometry.ts).
- **Candidate use:** deterministic terrain-cost A* local roads, rectangular house placement, walls and
  approach roads as pure data. Disable its authored castle/cathedral/European landmark semantics.
- **Boundary:** the repository is young and has no test suite or published benchmarks. Start with the
  rectangle output; arbitrary polygons do not match Elder's canonical footprint contract.

Neither candidate supplies proven production medieval-town code across Elder's exact contracts. A
bounded data-only comparison determines whether either shortens W4/F8 delivery.

<a id="candidate-azgaar-routes"></a>
### `Azgaar/Fantasy-Map-Generator` — regional route topology reference

- **Pin/licence:** v1.143.2 [`992246f213b13146595d0eceb7cac7e2c7cf6586`](https://github.com/Azgaar/Fantasy-Map-Generator/tree/992246f213b13146595d0eceb7cac7e2c7cf6586), [MIT](https://github.com/Azgaar/Fantasy-Map-Generator/blob/992246f213b13146595d0eceb7cac7e2c7cf6586/LICENSE).
- **Inspect:** [`routes-generator.ts`](https://github.com/Azgaar/Fantasy-Map-Generator/blob/992246f213b13146595d0eceb7cac7e2c7cf6586/src/generators/routes-generator.ts), [`pathUtils.ts`](https://github.com/Azgaar/Fantasy-Map-Generator/blob/992246f213b13146595d0eceb7cac7e2c7cf6586/src/utils/pathUtils.ts) and [`route tests`](https://github.com/Azgaar/Fantasy-Map-Generator/blob/992246f213b13146595d0eceb7cac7e2c7cf6586/src/generators/routes-generator.test.ts).
- **Candidate use:** independently extract the Urquhart/Delaunay topology idea, terrain/habitability
  edge costs and shared-corridor preference into a pure injected-RNG planner.
- **Boundary:** upstream is coupled to global `pack`, grid, D3/SVG, Delaunator, Alea and
  `window.FlatQueue`, and it replaces global `Math.random`. Elder still owns 3D routing, grades, water
  crossings, deck spans, clearances, settlement gates, collision and quest/travel continuity.

## Screened-out material

- The WebGPU/TSL/compute/storage/private-renderer portions of LAAS and fable-lite remain outside the
  current Three r180/WebGL renderer decision.
- [`recast-navigation-js` at `8769e8b9995f127033af9f6e6eeac3fad7d66201`](https://github.com/isaac-mason/recast-navigation-js/tree/8769e8b9995f127033af9f6e6eeac3fad7d66201)
  uses WebAssembly at runtime. It remains a benchmark/reference while the all-JavaScript requirement
  applies.
- `three-pathfinding` consumes a supplied navmesh and does not generate one; Navcat owns the runtime
  generation lead.
- LYGIA's Prosperity Public License permits noncommercial use and a limited commercial trial; it
  requires separate licensing for this project.
- Ossos, mannequin.js, old ocean/skunami projects and external model/texture libraries do not fit the
  current rig, licence, maintenance or runtime-created-asset constraints.
- [`awesome-threejs`](https://github.com/AxiomeCG/awesome-threejs) is a discovery list. Its CC0 licence
  does not license the linked projects; every adopted candidate uses its own pinned licence above.
