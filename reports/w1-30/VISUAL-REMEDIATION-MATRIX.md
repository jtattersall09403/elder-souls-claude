# W1-30 whole-game visual remediation matrix

Status: **builder remediation in progress**. This supersedes the previous builder-complete claim.
The earlier gates proved that mechanisms existed and were sabotage-sensitive; ordinary shipping
captures proved that the resulting imagery was still prototype-grade. No 7/10 judgement is made
here. Final population scoring and independent visual judgement remain critic-owned.

## Reference review basis

The builder reviews the registered populations, not isolated favourites:

* modern fidelity: 43 exterior daylight, 24 exterior low-light, 22 dark/emissive interior,
  13 character close-up, 12 combat, 9 material close-up and 8 UI frames;
* motion: the registered 808-file corpus, including 207 animated sequences and 304
  behaviour-valid references, routed through the existing action-cell register;
* art direction: the registered Morrowind REF-A population and anti-generic/context sets, kept
  separate from modern-fidelity judgement as RI-VIS01 requires.

Transient reference contact sheets live at `/tmp/w1-30-reference-sheets/`. They are review aids,
not evidence or committed assets.

## Tracked production populations

| Population | Shipped population / representative strata | Reference route | Direct baseline diagnosis | Required production remediation | State |
|---|---|---|---|---|---|
| Terrain macro form | 13 regions; near skin, 25 resident tiles, province far mesh | modern exterior day/low-light; REF-A1/A21/A23 | Height authority exists, but large areas read as coarse triangulated scalar fields; colour modulation exposes contour bands | Multi-scale material blend, restrained macro colour, slope/wetness response, silhouette breakup, continuous near/far value structure | in progress |
| Ground detail | 12 cover shapes, 1.7 m cover lattice, roots/rock/litter/decals | material close-up; exterior daylight; REF-A10/A23 | Repeated low-sided cones/cylinders and saturated cover create a patterned carpet rather than soil | Authored family geometry, clustered distribution, decals/litter, scale/rotation/hue variation, stable texel density | pending |
| Water and shorelines | regional water materials, tide/channel surfaces, standing-water test scene | REF-M4/material close-up; W1-03 authority | Broad translucent planes lack convincing Fresnel, reflection, normal motion, foam/wet shoreline transition and depth colour | Extend the authoritative W1-03 shader seam; reflection/normal/depth response, shoreline wet band, bounded foam/debris | pending |
| Canopy and trees | 7 canopy shapes across 13 regions; near/mid instancing | modern forest/day/low-light; REF-A4/A10/A11 | Primitive crowns, perfect arch repetition, bare poles and hard intersections; no branch hierarchy or leaf-scale breakup | Trunk/branch families, alpha-tested leaf clusters, asymmetric crowns, per-instance bend/hue, near/mid/far bands | in progress |
| Understorey and aquatic flora | 5 understorey shapes, reeds, fungal/aquatic/xeric layers | modern foliage; REF-A10/A11/A18 | Single planes/cones repeat visibly and have no wind, leaf thickness, cluster logic or species-level silhouette | Crossed/clustered alpha-tested geometry, deterministic wind, local density patches and region-specific hybrids | pending |
| Regional landmarks | 13 signatures plus 13 styleboard hero silhouettes | modern vista; REF-A1/A5/A9/A17 | Several are visibly constructed from toruses, boxes and columns; scale overwhelms the camera without believable structure | Re-author every silhouette as rooted, load-bearing layered geometry with readable mid/far profile and material hierarchy | in progress |
| Roads, crossings and signposts | 25.1 km roads, 6.7 km crossings, bridges/piers/sign system | modern exterior/settlement; REF-A8/A11/A19 | Flat slabs and repeated posts lack edge wear, drainage, supports, junction dressing and traffic composition | Road material blend, shoulders/ruts, bridge module detail, settlement approach dressing, bounded roadside props | pending |
| Settlement composition | 8 settlements, 8 plans and skyline grammars | modern exterior daylight; REF-A8/A9/A19; anti-generic | Counts and layouts exist, but repeated block masses, empty streets and implausible spacing dominate | Authored street hierarchy, foreground/midground landmarks, clutter, vegetation incursions, occupation and focal lighting | pending |
| Exterior architecture | 8 kits and their doors/apertures; Imperial exception | modern exterior/architecture; REF-A8/A9/A16/A19 | Buildings remain obvious boxes/cones with paper-thin add-ons; no wall thickness, trim, roof construction or material ageing | Modular wall/roof/foundation/trim/aperture kits, bevel/profile depth, structural supports, weathering and regional asymmetry | pending |
| Doors, windows and thresholds | every enterable building and continuity seam | modern exterior/interior; material close-up | Openings often read as markings or thin rectangles; threshold and interior light do not sell inhabitable depth | Recessed frames, lintels/sills, door hardware, glass/emissive interiors, visible thickness and transition lighting | pending |
| Interior shells | 115 interiors, 12 kinds, 8 settlement families | 22 modern interior frames; REF-A2/A3/A7 | Generated rooms are cuboids with flat ceilings and weak structural rhythm | Vault/rib/beam/column families, floor and wall segmentation, recesses, ceiling hierarchy and settlement-specific shells | in progress |
| Interior composition and lighting | all 115 rooms; day/night/see-through states | modern dark/emissive interior; REF-A2/A7 | Props can become evenly scattered mannequins; one bright primitive and ambient fill do not create local value hierarchy | Practical-light zones, emissive fixtures, foreground occlusion, focal paths, dark adaptation and exposure-safe local contrast | in progress |
| Props and clutter | 148 unique prop ids plus five bespoke place scenes | modern interior/material close-up; REF-A3/A7/A14 | Props are recognisable icons assembled from boxes/cylinders but lack thickness, joins, wear and material specificity | Shared detailed prop modules, hardware, small-object atlases, coherent placement clusters and surface contact | pending |
| Material library | 20 semantic PBR families and legacy exceptions | 9 material close-ups plus all modern profiles; REF-A23 | One shared greyscale noise map cannot represent bark, cloth, skin, stone and metal; surfaces lack normal/roughness identity | Family-specific multi-channel procedural maps or licensed textures, texel scale, anisotropy, wet/dry variants and bounded physical effects | in progress |
| Lighting, shadows, AO and IBL | sun/moon, weather, interiors, actor contact, compositor AO | every modern profile | Shaded faces crush to black, sun/ambient balance is unstable, local contact is weak and the tiny environment map gives little specular structure | Calibrated key/fill, fitted shadows, local probes/practicals, improved environment radiance, contact/AO and exposure validation | in progress |
| Sky, atmosphere and weather | 41 weather states, day/night, 13 region fog responses | modern day/low-light/interior; REF-A11/A17/A18 | Flat blue dome and uniform Exp2 fog lack cloud layers, height structure, aerial perspective and weather matter | Layered deterministic sky/clouds, height/depth fog, rain/mist/particulates, horizon depth and coupled material wetness | in progress |
| Player model | Saxhleel simulation rig, rear view and close-up | 13 character frames; RI-CAM07/RI-VIS08 motion | Correct authority but visibly tubular anatomy, crude face, exposed joints and low-detail back silhouette | Rebuild skinned body topology, hands/feet/head, layered clothing/armour, normals/roughness and rear-view hero read | in progress |
| NPC models | 392 NPC records routed through humanoid/Saxhleel families | character close-up and settlement references | Near-identical rig/body with tint changes; family overlay previously obscured the rig | Body/head/hair/garment variants, occupation kits, regional materials, proportion and silhouette diversity | in progress |
| Creature models | 22 combat records, 4 art families, 8 combat material classes | combat/character references; REF-A6 | Non-humanoids are metadata accents around humanoid rigs or simple poly masses; material classes do not create anatomy | Dedicated beast/undead/plant/construct body plans, readable locomotion, layered anatomy and family-specific surfaces | pending |
| Armour, clothing and shields | 3 authored sets × 5 visible slots, load tiers | character/material/combat; REF-A13 | Slot coverage exists but pieces are large primitives, intersect anatomy and have no fastening/layer logic | Purpose-built layered slot modules, straps/edges/cloth, compact back equipment, asymmetric variants and joint-safe fit | in progress |
| Weapons and catalysts | 87 weapons across 15 classes plus enemy weapons/catalysts | combat/material/motion; REF-A14 | Dimensions match hit authority, but silhouettes are merged boxes with flat blades, no bevels, wraps, sockets or family ornament | Class-specific cross-sections, bevel/profile geometry, guards/haft wraps, material variants, scabbards and impact-readable edges | pending |
| Locomotion and traversal animation | idle/walk/run/sprint/start/stop/turn/jump/fall/land/roll/dodge/IK | action-matched motion corpus | State coverage and deterministic curves exist, but tubular body and limited secondary layers make motion read robotic | Reassess poses against matched sequences, improve weight shift, arcs, feet/hips/spine, transitions and equipment follow-through | pending |
| Combat animation and reactions | four attack archetypes across 15 weapon classes, block/hit/recovery/swap | action-matched Souls behaviour corpus | Timing is authoritative but many classes share broad curves; hand/weapon/body posing lacks authored class identity and impact weight | Class-specific pose families, anticipation/follow-through, recovery, hit direction, grip/attachment and camera-readable silhouettes | pending |
| Spell and environmental VFX | 72 spells, 9 VFX briefs, 4 stages, residue/decal pools | modern combat/interior; RI-MAG05 | Mechanisms exist, but effects remain abstract particles/primitive meshes with thin matter, collision and environmental response | School-specific mesh/particle materials, volumetric-looking layers, surface-conforming residue, light/depth response and late-frame composition | pending |
| Streaming and LOD presentation | near disc, detailed tiles, far mesh, overlap/hysteresis, teleport/resize | modern vistas and walked seams | Lifecycle is sound, but geometry/material bands do not yet preserve authored silhouette or surface frequency | Family LOD assets, overlap/dither, impostor/cluster strategy, prewarm and native-resolution walked seam inspection | pending |
| World-space UI presentation | HUD, target/interaction cues, combat readability, minimap | 8 modern UI frames; separate Morrowind UI route | Minimal HUD is functional but flat bars/icons compete weakly with the world and lack production hierarchy | Improve typography, frames, icons, feedback animation and contrast while preserving UI footprint and world/UI colour separation | pending |
| Post-processing and output | colour management, ACES, AO, AA, restrained bloom | all modern fidelity profiles | Spatial compositor works, but cannot create missing material/geometry; crushed blacks and flat sky remain visible | Fix scene values first, then tune HDR target, threshold bloom, AO/AA and grade with sabotage and low-tier fallback | in progress |

## Asset strategy decision gate

The repository currently ships **zero** raster, glTF/GLB or KTX2 production art assets; all visible
world and actor content is constructed at runtime. That explains much of the repeated primitive
language. The builder will use two routes:

1. improve shared procedural systems where they are genuinely appropriate (terrain masks, scatter,
   weather, LOD, deterministic variants, simple architectural modules);
2. ingest or produce authored models/textures for hero and close-range families where procedural
   primitives cannot plausibly meet the references (characters, creatures, armour, weapons,
   foliage clusters and architectural trims), with source, licence, transformation, consumer,
   dimensions/format and hash recorded before commit.

No third-party asset is admitted merely because it is available; visual fit, licence, scale,
material routing, LOD and deterministic consumer coverage are all required.

## GPU follow-up ledger

These checks are deferred only because SwiftShader makes them prohibitively slow. Each remains
builder verification before a final critic handoff unless explicitly marked critic-owned later.

| GPU task | Why hardware is needed | Cheapest work done without it | Required GPU result |
|---|---|---|---|
| Native 1280×720/1024² population captures | Added world geometry takes minutes per sub-HD SwiftShader frame | Targeted 320×180 captures plus source/metric checks | Recapture every matrix stratum at native windows and inspect full-size materials, AA and shadow detail |
| Long motion derivatives | Exhaustive rendered clips multiply the software raster cost | Deterministic pose traces, low-resolution keyframes and short clips | Inspect action-matched locomotion/combat clips at playback speed, including near-plane and equipment runs |
| Temporal foliage/water/weather | Stable wind, reflection and precipitation need multi-frame native observation | Deterministic shader/state checks and short low-res sequences | Run M11/M12 sequences and inspect shimmer, flicker, water motion and rain/foliage temporal stability |
| Walked LOD/stream seams | Native repeated traversal is expensive under software rasterisation | State/lifecycle probes plus short low-res walked paths | Run multiple native-resolution boundary walks and inspect pop/fade/hitch/silhouette continuity |
| Performance budgets | SwiftShader timing is not representative of a GPU | Draw/triangle/program/geometry/texture/pool budgets | Record GPU frame timings and tune shadow, post, particles and LOD without relaxing visual coverage |

## Implemented remediation delta (2026-08-12)

The state column above records the diagnosis at the start of this pass. The following production
changes now apply across the listed populations; final native-resolution adequacy remains the GPU
and independent-critic work below.

| Population families | Production change consumed by shipping code | CPU/SwiftShader observation |
|---|---|---|
| Terrain, ground, material library | World-space UVs on near/far/skin terrain; restrained macro and skin modulation; three CC0 1K mud/bark/stone PBR packs; seven generated 256² neutral detail families; Physical wet materials; decoded texture census | Terrain false-colour bands removed; texture census is 50–51 MiB decoded on representative scenes; asset gate verifies 35 files / 6,681,570 bytes |
| Water, atmosphere, weather, lighting | Physical water response retained; coupled sky/sun/moon/IBL; layered deterministic cloud field and horizon haze; bounded frame-driven precipitation; stronger region-coloured key/fill floor; controlled compositor grade | Day, low-light and interior frames are nonblank and materially distinct; native temporal water/rain remains GPU work |
| Canopy, understorey, settlements | Cone canopy replaced by asymmetric compound thorn crowns; arch roots replaced by Bezier tubes; open blade/frond clusters; plan-aware settlement clearings across tile/near/cover layers; eight facade grammars receive foundations, supports, apertures and skyline detail | Thorn before fix was 37,621 wilderness instances over the town; after clearing 34,312 remain around it and ground cover inside the plan falls to 405; buildings become visible in the bounded vista |
| Architecture, interiors, props | All 202 facades receive courses, corner supports and window depth; all 115 shells receive base/cornice junctions and framed windows; common furniture uses bevelled crafted profiles and bounded hardware; practical interior composition retained | Thorn Hall capture shows structural ceiling rhythm, cross-framed windows, local practical hierarchy and material texture; full 115-room visual judgement remains critic-owned |
| Player, NPC, creatures, equipment | Simulation-driven skin gained UVs and family material detail; dedicated beast/undead/Saxhleel/humanoid articulated forms; equipment material pooling; three five-slot sets reshaped with compact back pieces and tapered torso shells; shoulders reduced to preserve pose; creature-family routing fixed | Package 3 remains 19/19 actions, 15 weapon classes and deterministic 4/7/10-frame secondary motion; native motion viewing is GPU work |
| Weapons and animation | Pointed faceted blade cross-sections and ridges replace representative box blades while authoritative lengths/sockets remain unchanged; existing class-specific silhouettes, transition curves, IK and action traces retained | 1,160 registered clips across 15 classes; package 3 and attachment/delete controls green |
| VFX | Release/travel/impact/residue pools retained; release and impact now drive two bounded scene practicals; production stats expose practical count; depth/soft-particle/mesh/decal paths unchanged | Marshfire proof observes release, multi-system impact and late residue; native temporal judgement remains GPU work |
| Streaming/LOD/output/UI | Styleboard material clones pooled by source/board/role; resize/history and decoded texture observables fixed; near/far overlap and hysteresis retained; dialogue receives layered vellum/inset/knot treatment | Default live material count fell from 2,429 to 390; package 4 lifecycle and budget controls green |

Transient inspected outputs are `/tmp/w1-30-remediation-proof`,
`/tmp/w1-30-remediation-town4`, `/tmp/w1-30-remediation-interior`,
`/tmp/w1-30-remediation-arena` and `/tmp/w1-30-remediation-final`. The last directory includes
the nine-scene manifest and contact sheet. They are deliberately outside Git.

## GPU continuation ledger (2026-08-13 checkpoint)

Hardware attestation: Chromium 151.0.7922.110, ANGLE D3D11, NVIDIA Tesla T4, native 1280x720.
SwiftShader evidence is not used for the observations below.

| Population | Native evidence and implemented repair | Honest checkpoint state |
|---|---|---|
| Motion and attachments | 37 action cells, 60 f@60, including all 15 weapon classes, locomotion, traversal, combat, swaps, IK, secondary motion and creature motion; opaque-body and attachment-following defects repaired | broad moving coverage complete; further visual polish in progress |
| Player close-up | torso/limb/head silhouette rebuilt; translucent body and static head ornament behavior covered by motion assertions | improved, still below hero-character reference quality |
| Creature family | slitherfang anatomy/motion rebuilt and shared family differentiation strengthened | improved; remaining families need close-up polish |
| Canopy/LOD | compound asymmetric crowns, root construction, shadow waste and far-band continuity repaired | improved; repetition and full boundary polish remain |
| Interiors | all 115 captured after shared shell, focal-zone and dressing rebuild; literal delete control recorded | population delivered; repetition/occlusion polish remains |
| Regions | all 13 captured at native resolution after landmark, HDR, residency and material repairs | covered; terrain relief/material richness remain red |
| Settlements | all eight recaptured from street height after capture/residency repair | diagnostic coverage delivered; architecture and occupation remain red |
| Water/shore | native stills plus short motion and reflection-delete control; crossed wave field committed | improved but broad banding remains red |
| Streaming/performance | repeated native boundary motion with timing/counters | functional; p50/p99 and high-draw representatives remain red |

Current builder estimate: about **50-55%** toward the requested whole-game visual bar. This estimate
weights actual pixels and moving output more heavily than green structural gates. Complete blind
comparison and both 7/10 judgements remain exclusively critic-owned and are not claimed here.
