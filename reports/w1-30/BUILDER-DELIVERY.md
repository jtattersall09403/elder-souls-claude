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

## Native GPU remediation checkpoint (2026-08-13)

This checkpoint is not builder closure. The prior completion language above remains superseded.
Chromium 151.0.7922.110 was launched with hardware acceleration and reported ANGLE D3D11 on an
NVIDIA Tesla T4 rather than SwiftShader. Native 1280x720 stills, short moving clips and repeated
walked-boundary sequences were inspected directly. The structural gates are green, but several
shipping populations remain visibly below the requested modern reference bar.

### Production repairs delivered in this continuation

* The shared player renderer now has a more coherent opaque body, better head/torso/limb
  proportions and attachment-following presentation. The motion ledger verifies the player body
  stays opaque, head direction does not remain static and representative held attachments remain
  stable during motion.
* A complete 37-cell native motion ledger now renders 60 f@60 clips for locomotion, traversal,
  turns, falls, directional dodges, blocking, reactions, swaps, IK, secondary motion, creature
  movement and all 15 weapon classes. Clips and traces are transient and remain outside Git.
* Slitherfang and shared creature construction gained stronger family anatomy and motion reads;
  canopy/root silhouettes and vegetation LOD use more organic, asymmetric construction.
* Regional water gained reflection/shore response and successive wave-field repairs. Crossed wave
  frequencies reduce the most regular grid artifact, but inspected marsh vistas still show broad
  directional banding and this row remains builder-red.
* All 115 generated interiors now consume shared structural bays, wall bases and caps, ceiling
  coffers, room-kind focal areas and clustered dressing. A literal delete-the-fix control changes
  the rendered output. Some narrow rooms remain occluded and family repetition remains visible.
* Population capture now covers all 13 regions, all eight settlements at street height and all 115
  interiors. The street camera correction exposes facade/occupation defects that the former aerial
  view concealed. It does not claim those settlements are visually complete.
* Arena, rootway, landmark, foliage, equipment, weapon, VFX-light, HDR, residency and visual-control
  repairs in the preceding continuation commits remain part of this checkpoint.

### Current visual assessment

The builder estimate is roughly 50-55% of the way to the requested whole-game visual bar. Coverage,
repeatability and diagnostic instrumentation are about 90% established, while visible production
fidelity is nearer 45-50%. The main remaining deficits are terrain/material richness, water
banding, settlement architecture and street occupation, hero-quality characters/creatures and
equipment, VFX composition, temporal weather, LOD continuity and GPU performance. These are rough
planning estimates, not the critic-owned modern-fidelity or art-direction verdicts.

### Transient native evidence

The hardware evidence root is
`C:/Users/Administrator/AppData/Local/Temp/1/w1-30-gpu-ec2amaztmcr7kb-d2ef87d6`.
Important populations are `motion-phase43-full`, `atlas-phase74-interiors-production`,
`atlas-phase77-world`, `atlas-phase78-settlements-street`, `water-phase70-short-motion`,
`fixed-eight-phase83-crossed-water` and the targeted `control-phase75-interior-dressing-delete` /
`control-phase81-water-no-reflection` controls.

The latest measured boundary sequence recorded GPU frame time around 17.99 ms p50 and 26.96 ms
p99; several settlement representatives also exceed the intended draw budget. Performance is
therefore not closed and will be repaired without reducing required population coverage.

## Final-builder continuation: traversal and room containment (2026-08-13)

This is a bounded production phase, not W1-30 closure. It repairs two ordinary-play failures that
the prior motion/census checkpoint exposed but did not solve:

* Jump root motion is now relative to the launch floor. The former action replaced world Y with a
  `0..0.62 m` clip value and then reset Y to zero, which made an actor on elevated terrain or in an
  elevated room disappear below the scene and reappear at action teardown. The declared 46 f@60
  action, stamina cost, no-i-frame rule, contextual attack window and simulation rig remain the
  authorities.
* Every one of the 115 shipped generated interiors now installs a `CollisionCell` from the exact
  record-derived shell plan used to render its walls. A visible closed door leaf fills the entry
  aperture; the existing `interact` action remains the only cell transition. Player, combat enemy,
  spring camera and scheduled non-combat NPC paths consume the same room shell.

`node tools/render/w1-30-traversal-controls.mjs` is the focused production control. At this tree it
reports GREEN over one elevated jump, 460 wall approaches, 115 door approaches and 115 scheduled-NPC
approaches. The jump rises from Y=8.75 to Y=9.3681 and returns to Y=8.75 after exactly 46 frames. A
launch-floor deletion drops the action to Y=0. Removing only each door releases all 115 thresholds;
removing every shell releases all 115 wall controls. The W1-30 aggregate now consumes this gate.

The six inherited checkpoint commands are GREEN in this continuation. They are structural and
causal evidence, not a visual-quality verdict. Native moving pixels remain required to confirm the
door construction, camera response and jump silhouette from ordinary UI-visible play.

The repository-native RunPod smoke attempted six allowlisted candidates from the clean production
target before this repair. Each readiness failure was deletion-confirmed, and the bounded run ended
without one of its Pods remaining. Later cleanup dry-runs saw differently named Pods owned by other
parallel builders; those Pods were deliberately left untouched. A committed hardware continuation
must use a unique artifact root and the full committed $1.00/hour ceiling.

Rough builder estimates for this phase only: jump/traversal correctness 85% (hardware moving review
and broader slope/stair combinations remain); generated-interior boundary containment 90% (door
opening animation and furniture collision are not claimed); generated-interior visible production
quality remains approximately 55% and still needs the matrix's composition/prop/lighting work. No
modern-fidelity or art-direction score is assigned.

## Final-builder settlement construction and native Vulkan phase (2026-08-13)

This bounded phase repairs civic structures that still rendered as blank house-like shells and
then recaptures every shipped settlement on an attested NVIDIA/Vulkan renderer. It does not close
the settlement rows or W1-30:

* All 56 civic records now construct their declared purpose—walls, vats, quays, racks, pits,
  yards, bridges, gates and regional variants—rather than borrowing the generic house shell.
  Structure collision follows those feature groups: 43 records contribute physical solids and 19
  declared walkable structures retain traversable surfaces.
* All 205 exterior buildings consume the strengthened shared facade, foundation, aperture,
  threshold, support/roof rhythm and plan-origin public-realm route. Settlement approaches use
  less regular arrival/causeway placement. Physical-material-only clearcoat and IOR controls no
  longer produce Standard-material warnings.
* `node tools/render/w1-30-settlement-construction.mjs` is GREEN over eight settlements, 205
  buildings and 56 structures. It observes 56 semantic feature groups, zero generic civic shell
  walls, 43 collision solids and 19 walkable records. Removing the semantic mapping, its visible
  consumption or its collision construction independently turns the gate red. The aggregate now
  consumes this focused gate.
* Native Linux hardware capture is fail-closed on Vulkan rather than the prior Windows-only D3D11
  arguments. The aggregate has a literal Linux `--use-angle=vulkan` deletion control. A first
  hardware attempt correctly returned RED when Chromium exposed llvmpipe; the repaired committed
  launcher then returned GREEN on NVIDIA Vulkan.

The successful committed reproduction tree is
`1124b3e4b4786993772ed9ba44bd0336b4edbfd4` (clean snapshot hash
`fe6565937112c702179412edae2f98639cc06ff18e6bf491cf3b5a0b429355ea`). RunPod run
`20260813-181711Z-137426` selected Secure Cloud Pod `e9aowzkz4k3tjq`, an NVIDIA RTX A5000 at an
actual $0.27/hour. The host reported Linux 6.8.0-124-generic, NVIDIA driver 580.159.04 and 24,564
MiB GPU memory; Chromium 141.0.7390.37 reported
`ANGLE (NVIDIA, Vulkan 1.4.312 (NVIDIA NVIDIA RTX A5000 (0x00002231)), NVIDIA)`. The native window
was 1280x720 at DPR 1, seed 3030, using:

```text
node tools/render/w1-30-population-atlas.mjs --hardware-gpu --only settlements --width 1280 --height 720 --out "$RUNPOD_ARTIFACT_DIR/settlements"
```

All eight returned frames were opened and inspected in the Codespace. Helstrom's grown civic
arches, Lilmoth's quays and Soulrest's rib structures now have distinct purpose, so the former
blank-shell failure is repaired. The frames also keep the broader row honestly red: Archon and
Blackrose have broad empty foregrounds; Gideon retains blank side walls and generic large pitched
roofs; path pieces read as regular slabs/ties; Stormhold's near wall blocks the focal composition;
street occupation and facade depth remain sparse throughout.

This atlas records no representative frame-time distribution. It does expose excessive draws:
1,102–2,989 calls across the eight scenes, with 509,792–955,055 triangles, 55–56 programs and about
51.3 MiB decoded textures. These measurements belong specifically to the RTX A5000 run and are not
evidence for lower-tier consumer performance. Settlement rendering therefore remains materially
red for performance as well as for composition.

Returned lifecycle and evidence hashes are: run ledger
`f2299823c6c5b839796a631d1aad1fcbfb2773a3a01c82f472746a04d6411427`, settlement manifest
`f91ed47cf6d257e8906b2bb4b3b6cda1b0ca4d4275af0cddaeb4fd29767404a3`, and worker result
`0a8278ada9e351efeaa1db17a89ae780f81b9824ccc871ac9116cd5f8491fe2e`. Artifact retrieval completed,
then both the Pod and ephemeral template `fo42qhykvn` were deletion-confirmed. The transient root is
`/tmp/w1-30-final-8c1d4f7a/runpod/settlement-phase2-1124b3e4`; no frame or cloud cache is committed.
The following cleanup dry-run showed only differently named resources owned by a parallel builder,
which were deliberately not modified.

Rough production estimates after this phase: semantic civic construction 100%; shared exterior
facade/threshold construction about 70%; street occupation and composition about 55–60%; visible
settlement fidelity about 55–60%; settlement performance repair about 35%. Whole-W1-30 builder
progress is roughly 55–60%. These are planning estimates, not modern-fidelity or art-direction
scores, and neither critic-owned 7/10 verdict is claimed.
