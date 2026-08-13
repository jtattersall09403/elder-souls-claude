# W1-30 Package 2 — whole-game world-art census

Tested tree: Package 2 delivery commit (base `1ab7cc4`).

## Reachable production census

| Family | Population | Production consumer |
|---|---:|---|
| Regions | 13/13 | Province terrain, six regional PBR resources, flora transforms, water, signatures, weather and distance composition |
| Settlements | 8/8 | Exterior kit grammar, settlement styleboard sculpture/materials and interior structural grammar |
| Generated interiors | 115/115 | Record-derived shell, aperture, beams, fittings, lights, props and settlement braces |
| Interior kinds | 12 | dwelling, gate, guild, hall, hold, prison, shop, shrine, tavern, temple, travel, unclassified |
| Hand-built places | 5/5 | Barge hold, writ house, market, street and well; each has a fail-closed production identity |
| Creature directions | 4/4 | Saxhleel, humanoid, beast and undead silhouette/material direction; Package 3 retains movement |

All thirteen region ids and eight settlement ids are equality-checked among shipped world data,
styleboards and the production registry. Unknown region, settlement and place ids throw; the four
admission controls were observed red. The nine art rows map to live consumers: architecture
(exterior/interior), flora (province transforms), creature (actor direction), composition
(landmarks/depth profiles), weirdness (landmarks/sculptures), mood (sky/material response), palette
(`consumeStyleboard`), silhouette (flora/kits), and art materials (`worldMaterial` + styleboards).

## Controls and observations

### Visible-production remediation (2026-08-12)

The former label-only seams are now rendered consumers.  Every exterior building receives a
settlement-specific support cadence, material junction, aperture trim, street offering and one of
eight skyline constructions.  Every governed interior extends its settlement grammar through
ceiling ties and floor/wall junctions.  Region terrain/depth records now select vertex-colour
frequency, hue and saturation response in addition to three flora proportions and lean.  The five
places build grammar-derived entrance monuments, and the four creature rows build different
primitive assemblies, proportions and Standard-material responses around the rig; Package 3 still
owns animation quality.

The Package 2 gate now refuses a row without geometry/material controls and refuses production
functions lacking an art read plus a mesh/material mutation.  Its profile perturbation control
also requires 13 distinct region, eight settlement and four creature render signatures; names and
`userData` do not participate in those predicates.

* `node tools/render/w1-30-package2.mjs` — GREEN: 13/13, 8/8, 115/115, 5/5, nine mapped rows,
  and 4/4 unknown-id red controls.
* `node tools/render/w1-30-gate.mjs` — GREEN: all 21 W1-30 paths retain real consumers and all
  13+8 styleboards retain the material/landmark chain.
* `node tools/render/w1-30-aggregate.mjs` — GREEN: landed compositor, lighting, shadow, IBL and
  material predicates remain intact.
* The first transient Blackwood frame was visibly enclosed by opaque trunk geometry. Cause:
  deterministic tile canopy placement had no arrival-footprint exclusion. The repair clears 2.4 m
  around active stream focus; the inspected rerun showed legible near/middle/far forest depth.
* The multi-region capture command hit its bounded 180-second timeout during the next screenshot
  under SwiftShader. It is not represented as a completed beauty population; Package 5 and the
  fresh critic retain the complete aggregate/population.
* The remediation reran that capture at 320x180 with one private reusable browser. One Blackwood
  frame completed and was inspected (the near/far trunks and triangular understory were legible,
  but the nominal day exposure remained very dark); the second frame again exceeded a bounded
  240-second process limit and Chromium was closed by `timeout`. No binary was retained. This is a
  capture-infrastructure limitation, not claimed representative visual proof.

## Reproduction

```text
node tools/render/w1-30-package2.mjs
node tools/render/w1-30-gate.mjs
node tools/render/w1-30-aggregate.mjs
node tools/harness/boot-check.mjs
node tools/harness/smoke.mjs --out /tmp/w1-30-p2-smoke.json
npm run metrics:selftest
node tools/world/province-shots.mjs --out /tmp/w1-30-p2-regions --per 1 --passes day --width 640 --height 360 --direct
```

## Semantic settlement-construction continuation (2026-08-13)

Package 2's eight-settlement census now has a stronger visible consumer. All 56 shipped civic
structure records resolve to purpose-specific feature construction instead of the former generic
house shell, while all 205 buildings retain the settlement grammar and receive the strengthened
facade/threshold/public-realm route. The focused census reports 56/56 semantic feature groups,
zero generic civic shell walls, 43 collision solids and 19 walkable structures. Independent
semantic-mapping, visible-consumption and collision deletions each make the result red:

```text
node tools/render/w1-30-settlement-construction.mjs
```

All eight settlements were also captured at 1280x720, DPR 1 from clean commit `1124b3e4` in one
persistent Chromium 141.0.7390.37 browser on a Secure Cloud NVIDIA RTX A5000. WebGL reported NVIDIA
Vulkan, not SwiftShader, llvmpipe or Mesa. The RunPod run was `20260813-181711Z-137426`; its Pod and
ephemeral template were deletion-confirmed after retrieval. Manifest SHA-256:
`f91ed47cf6d257e8906b2bb4b3b6cda1b0ca4d4275af0cddaeb4fd29767404a3`.

The native pixels confirm improved semantic identity, not final adequacy. Large empty foregrounds,
blank facade sides, generic large roofs, regular path slabs, sparse occupation and blocked focal
views remain builder-red. Draw calls range from 1,102 to 2,989, so Package 2 coverage is preserved
while settlement visual and performance remediation continues.

## Settlement submission continuation (2026-08-13)

The Package 2 identities now survive a shipping-only settlement-scope `THREE.BatchedMesh` pass.
All 205 building groups and their kit/door identities remain in the graph, while the complete
eight-town render mesh population falls from 9,990 to 740. Logical triangle counts and rendered
bounds are unchanged, and disabling only this pass restores the former graph:

```text
node tools/render/w1-30-settlement-batching.mjs
```

A clean Secure Cloud NVIDIA L4/Vulkan atlas (`15133c39`, run `20260813-183712Z-143987`) rendered
all eight 1280x720 frames GREEN. Direct inspection found no missing settlement population. Actual
scene draw calls fell from 14,558 to 4,715 in aggregate (67.6%), but the 421–836 per-frame range
still exceeds the intended 350-call budget. Package 2 breadth remains complete; performance and
visible settlement quality remain in progress.

## Occupied settlement-route continuation (2026-08-13)

Package 2's eight settlement identities now extend into the ordinary approach surface: five dry
towns build dense founded-cobble courses, three wet towns build overlapping board-and-lashing
causeways, and every town adds four deterministic work/marker/vessel/goods clusters. The focused
census reports 8/8 towns, 32 clusters and 1,876 route parts. Disabling the repair restores exactly
112 generic runway slabs and removes all 32 clusters.

The clean `930cd714` native atlas on a Secure RTX A4500/Vulkan renderer returned all eight 1280x720
frames. Direct inspection confirms that the broad pale slab runway is gone, while also keeping the
row honestly open for procedural cobble packing, sparse occupation, facade massing and Stormhold
occlusion. Static batching holds at 753 render meshes from 18,345 logical meshes; actual scene
draws are 423–837, still above budget. Run `20260813-190041Z-151469` and its ephemeral resources
were deletion-confirmed after artifact retrieval.
