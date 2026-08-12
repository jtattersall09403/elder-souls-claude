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
