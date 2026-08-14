# W1-30D — the sourcing spike, and the stop decision it reached

**Ruled: PIVOT to authored in-repo geometry. Recorded 2026-08-14 by the W1-30D builder.**
**Reversible.** The evidence that would overturn it is named at the bottom, and the ingestion path
was built anyway so that overturning it costs an afternoon rather than a week.

`orchestration/plans/W1-30D.md` makes this the child's first action and gives it an explicit stop
condition: *"Spend a bounded effort identifying legally redistributable, quality-sufficient humanoid
base meshes and clip sets. If that fails, pivot in writing… Do not continue shopping, and do not
ship the current primitives while shopping."* This is that decision, with what was actually checked.

## What was checked, and what came back

| source | reachable | what it holds | verdict |
|---|---|---|---|
| **Khronos `glTF-Sample-Assets`** (`model-index.json`, fetched) | yes, 148 models | the only rigged humanoids are `CesiumMan` and `RiggedFigure` | **refused.** `CesiumMan` is *"© 2017, Cesium. CC-BY 4.0 International **with Trademark Limitations**"* and carries the Cesium logo baked into its texture. `RiggedFigure` is an untextured test blob. These are conformance fixtures, not characters. |
| **Quaternius** (`quaternius.com`, fetched) | yes | CC0, animated, stylised low-poly fantasy packs | **licence is fine; the mesh is not the blocker either.** Refused on retargeting and on species — see below. |
| **Mixamo** | not attempted | rigged humanoids + large clip library | Adobe's terms require an account and restrict redistribution. A licence we cannot put in a manifest is a licence we cannot ship. |
| **three.js r180 loaders** (`GLTFLoader`, `DRACOLoader`, `KTX2Loader` + their four transitive addons) | yes, fetched byte-exact from `unpkg` | the ingestion path itself | **taken.** Vendored under `game/vendor/three/addons/**`. |

## The two reasons that decide it, neither of which is licensing

**1. Every sourced rig is on the wrong skeleton, and the skeleton is not ours to change.**
`game/data/combat/skeleton.json` declares twenty bones with exact rest offsets;
`hitgeometry.json` declares every hurtbox capsule as *a segment of* one of those bones, and
`Rig.evaluate()` computes the weapon sockets from the grip hand in that same frame. A Mixamo or
Quaternius rig is a different hierarchy with different proportions and a different rest pose.
Retargeting one is not a mesh import, it is a pipeline — and a mis-retarget does not look wrong, it
looks *slightly* wrong while the drawn body and the thing that can be hit quietly stop being the
same object. That is precisely the class of defect `render/actor.js` exists to prevent.

**2. There is no CC0 Saxhleel, and the player is Saxhleel.** Black Marsh's people are reptilian:
snout, jaw, crest, tail, and a back silhouette that `RI-CAM07` §F1 requires to be distinguishable
from a common humanoid at 32 pixels. Sourcing a generic low-poly human and dressing it would give
us the incoherence the parent plan's own falsification audit names as the worst outcome — *"a
half-populated glTF world with primitive fallbacks looks worse than a consistent primitive world,
because incoherence reads as broken where uniformity reads as stylised."*

## So what was built instead

Not "the current primitives", which the plan forbids shipping. The pivot arm as the plan words it:
*"authored procedural geometry at a much higher standard than today… reachable in-repo with a
committed generation script."* Concretely, in this commit:

- the body is a **welded, sealed surface** whose joint volumes are *derived* from the body plan
  rather than authored per joint, so a future radius edit cannot silently reopen a seam;
- the dorsal crest is **part of the skinned mesh** instead of four cones hovering 13 cm off the
  back, and the tail root starts **inside** the pelvis rather than tangent to it;
- every rigid fitting (belt, pack, helm, straps) is embedded rather than resting against the body;
- `esCurvature` is **computed from the mesh's own dihedral angles** and baked on every geometry the
  file makes, which is what `MATERIAL_API.md` §6a asked for and what C's `wearFrom: 'geometry'`
  needs;
- and the whole thing is behind a **registry**: two humanoid bases plus one exempt quadruped, on one
  skeleton, with seventeen characters as variant specs.

## The ingestion path was built anyway, and here is why that is not hedging

`render/models.js` now vendors and lazily imports the r180 loaders, reads
`game/assets/w1-30/models/manifest.json`, and **refuses to load anything the manifest does not
declare** — an unknown id, a missing field, a licence outside the allow-list, a CC-BY entry with no
attribution string, a file-backed model with no `sha256`, or an asset that blows its own declared
LOD0 triangle ceiling. The procedural bases are in that manifest too, so they pass through exactly
the same admission gate.

Two things follow. The rule *"an unmanifested model must not load"* is in force **today**, on the
geometry we actually ship, rather than being a promise about geometry we do not have. And the next
sourcing round — if somebody commissions or finds a properly licensed Saxhleel — is a manifest entry
and a retarget, not a pipeline build.

## What would overturn this, stated so a critic can go and get it

1. **A CC0 or CC-BY reptilian humanoid, rigged, with its licence text**, at a fidelity above what
   the procedural base now reaches. Licence and fidelity both, judged on pictures.
2. **A retargeting result** that puts a foreign rig onto `es.humanoid.v1` with the drawn surface and
   the hurtbox capsules agreeing to within the tolerance `tools/harness/wpn-render-probe.mjs` §C
   already measures in millimetres. If that exists, reason 1 above evaporates.
3. **A measurement showing the procedural base cannot clear the human-read gate** while a sourced
   one could. This is the one I consider most likely to bite: faces and hands at Morrowind fidelity
   are the two things a person looks at first and the two things hardest to reach procedurally, and
   `W1-30D.md`'s own "least certain" line says so. Nothing in this commit settles it — no naive
   judge has seen these characters yet.
