# MATERIAL_API — the frozen material contract

**Owner:** W1-30C. **Consumers:** W1-30D (characters), W1-30E (architecture), W1-30F (terrain and
vegetation), W1-30G (interiors), W1-30H (VFX/water), and every visual piece after Wave 1.
**Implementation:** `game/src/render/visual-foundation.js`. **Registry rules:**
`orchestration/plans/W1-30-LIBRARY.md`. **Frozen 2026-08-14.**

Frozen means: **an option may be added; an option may never be removed or repurposed.** If you
write against this file today, your call site still compiles and still means the same thing when
C's texture content lands underneath it. That is the whole point of publishing it before the
content: your geometry work and C's material work are concurrent, not sequential.

Nothing else in the game may construct a `MeshStandardMaterial` or `MeshPhysicalMaterial` for a
world surface. `tools/visual/library-census.mjs` fails the build on a mesh whose material has no
`userData.visualFamily`.

---

## 1. The one factory

```js
import { worldMaterial } from './visual-foundation.js';

const mat = worldMaterial('timber', { palette: 'helstrom-region-id', wear: 0.6, tilingScale: 1.4 });
```

`worldMaterial(family, options) -> THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial`

It throws — deliberately, at construction, not at the one frame where it matters — on an unknown
family, an unknown option key, an unknown palette or trim id, an out-of-range `wear`/`wetness`, or a
non-positive `tilingScale`. **A silently-wrong material is the defect this piece exists to remove.**

`water`, `wet_chitin` and `resin` return `MeshPhysicalMaterial`; every other family returns
`MeshStandardMaterial`. Do not depend on which — depend on the family.

## 2. The twenty families — frozen

```
mud  wet_mud  bark  leaf  reed  root  timber  clay  stone  salt
bone chitin   resin cloth skin  metal water   shell thorn  wet_chitin
```

Read them from `MATERIAL_FAMILIES`; do not retype the list. **Adding a family is a plan-level
edit, not a builder's judgement call.** If your surface does not fit one of the twenty, the answer
is a variant spec (§4), not a twenty-first family. If the variant axes genuinely cannot carry it,
file it against `orchestration/plans/W1-30C.md` — that is a plan edit and C will make it.

### The six material classes

`MATERIAL_CLASSES` groups the twenty by **how the surface responds to light**, not by fiction:

| class | families | detail-normal tile |
|---|---|---|
| `soil` | mud, wet_mud, clay | `mineral` |
| `wood` | bark, root, timber, thorn | `organic` |
| `foliage` | leaf, reed | `organic` |
| `mineral` | stone, salt, metal | `mineral` |
| `carapace` | chitin, wet_chitin, shell, bone, resin | `hard` |
| `pliant` | cloth, skin, water | `fabric` |

`metal` sits with the minerals because it is hard, opaque and roughness-driven; `water` sits with
the pliant surfaces because it is the third family whose surface deforms continuously. A naive
judge shown twenty unlabelled close-ups must be able to reproduce this grouping — that is C's
`families are distinguishable` gate, and if a critic re-cuts the six, the cut changes here and
nowhere else.

## 3. Options — frozen, additive only

Read the authoritative list from `MATERIAL_OPTION_KEYS`.

### three.js pass-through — unchanged semantics

| option | type | note |
|---|---|---|
| `color` | hex \| `THREE.Color` | multiplied with the albedo map; default `0xffffff` |
| `roughness` | 0..1 | overrides the family default, **before** wear/wetness modulate it |
| `metalness` | 0..1 | overrides the family default |
| `map` | `THREE.Texture` \| `false` | your own albedo (D's character sheets, F's foliage atlas). `false` removes the map entirely |
| `normalMap` | `THREE.Texture` \| `false` | **now honoured** — it was declared and ignored before 2026-08-14 |
| `alphaTest` | 0..1 | see §6, foliage |
| `transparent` | bool | alpha blending. For foliage use `alphaTest`, not this |
| `opacity` | 0..1 | |
| `side` | `THREE.FrontSide` etc. | |
| `emissive` | hex | |
| `emissiveIntensity` | number | |
| `envMapIntensity` | number | scaled up by `wetness` |
| `vertexColors` | bool | |
| `depthWrite` | bool | |
| `aoMapIntensity` | number | retained from the pre-freeze surface |
| `bumpScale` | number | retained |
| `authored` | `false` | retained: opt out of authored maps, procedural only |

### The declared variant axes

| axis | type | today | when C's content lands |
|---|---|---|---|
| `palette` | swatch id, default `neutral` | **live** — tints base colour and re-grades saturation/value | also tints the trim atlas |
| `wear` | 0..1, default 0 | **live** — rougher, desaturated, lighter toward the substrate, multiplied by a curvature mask | see `wearFrom` |
| `wetness` | 0..1, default 0 | **live** — smoother, higher `envMapIntensity` | multiplied by a world-height mask so *hollows* wet |
| `tilingScale` | >0, ≤64, default 1 | **live** — multiplies metres-per-tile, so 2 makes the texture read twice as coarse | unchanged |
| `wearFrom` | `texture` \| `geometry`, default `texture` | **live** — see §6a | unchanged |
| `trim` | slot id, default `null` | **live** — `trimSlot(id)` returns the band; `trimAtlasTextures()` returns the maps | unchanged |
| `lod` | `shared`\|`near`\|`far`\|`impostor` | recorded | drives mip bias and detail-normal cut-off |
| `boundedException` | string | recorded; appears in the census as a named exemption | unchanged |

**Four of the seven are already real.** Write `{wear: 0.7}` today and you get a visibly different
material today, a better one later, and no call-site change in between.

## 4. Variant, not copy — the rule the census enforces

> *if I want a second one of these, am I writing a spec or writing a definition?*

A second texture set for a family you already have is a census `duplicate` failure. The answer to
"Helstrom stone and Thorn stone" is two palette swatches over one stone set — not two stone sets.

`materialVariantKey(family, options)` returns the stable string identity of a (family, variant)
pair; the census hashes it to find copies masquerading as variants.

### Palette swatches

`PALETTES` carries `neutral` plus one swatch per region id in `world-art.js`. The registry asserts
at **import time** that every region has a swatch, so the two files cannot drift. `world-art.js` is
read-only to every W1-30 child, which is why the colour lives here and not there.

```
neutral  blackwood  clay-moor  crimson-coast  deep-marshes  eastern-rootlands  hive
marauders-coast  salt-hills  stone-forest  stone-wastes  thornmarsh  valus-ridge
western-rootlands
```

### Trim slots

`TRIM_SLOTS` — twelve bands of the shared 2048×1536 atlas. `trimSlot(id)` returns
`{band, v0, v1, row}` so a kit part can map a face straight onto its band.

```
edge  moulding  plank  lashing  bolt  shell-ring
bone-binding  resin-seam  dye-band  metal-course  chitin-bar  bleached-timber
```

## 5. Texel density — the seam that keeps the world coherent

`TEXEL_METRES[family]` is **the metres of world surface one tile of that family's texture covers.**

```js
const t = materialTiling('timber', { tilingScale: 1.4 });
// { metresPerTile: 3.08, texelsPerMetre: 332, repeat: 0.325, detailRepeat: 2.6 }
```

**Lay your UVs out so that one UV unit equals `metresPerTile` metres of surface.** Then every
surface in a frame resolves at a comparable number of texels per metre, and a wall does not sit
next to a floor at four times the sharpness. The plan's hard fail is a >4× density change between
adjacent surfaces in one shot; the table's widest legal adjacency (resin 1.0 m against mud 3.8 m)
is 3.8×.

Do not inline the numbers. If a surface genuinely needs a different density, that is what
`tilingScale` is for, and it is recorded in `userData.w1_30.metresPerTile` where the census can see
it.

## 6a. `wearFrom` — and the one thing C could not finish

`wear` is multiplied by a curvature mask so that the arris of a plank wears and the face does not.
Where that curvature comes from is the `wearFrom` axis.

- **`texture`** (default) derives it from the base normal map. Every surface can do this today and
  it is honest micro-wear. **It is not enough.** C's own variant proof, measured on an independent
  edge/face split taken from the rendered image, found it moves rims and faces within about **one
  percentage point** of each other — against the plan's bar of **8%**. The reason is structural: a
  normal map's rate of change is dominated by grain, not by the arris of a plank, so no amount of
  tuning the threshold turns it into an edge detector.
- **`geometry`** reads a per-vertex float attribute **`esCurvature`** (0 = flat facet, 1 = edge)
  and uses it directly.

**This is a request to D and E.** Bake `esCurvature` onto your kit parts and your rigs — an edge
between two faces meeting above a threshold angle is 1, a face interior is 0, smoothed — and pass
`wearFrom: 'geometry'`. The option is frozen and live now, so you do not need another C commit, and
this is the only route to the plan's `wear reads` gate.

## 6. Foliage and alpha

Vegetation must be **alpha-cut**, not opaque geometry and not alpha-blended:

```js
worldMaterial('leaf', { map: myLeafAtlas, alphaTest: 0.5, side: THREE.DoubleSide, transparent: false });
```

`alphaTest` defaults to 0, which is why vegetation reads as solid lumps today. F owns the atlases;
C owns the path, the mipmap policy and alpha-coverage preservation in the conversion script.
`transparent: true` on foliage is wrong — it costs sorting and produces the see-through defect the
orbit gate exists to catch.

## 7. The fallback is loud on purpose

If a family's authored maps fail to load, every material built from that set turns
**magenta (`FALLBACK_COLOUR`, `0xff00d4`)** and its name gains `:ASSET-LOAD-FAILED`.

A plausible fallback is how a 96 px hash-noise field textured a whole province without anyone
seeing it. `materialFallbackReport()` lists the affected families; `visualFoundationCensus(root)`
reports `noiseFallbackFamilies` and `assetFailureFamilies`. **A shipped frame on either is a hard
fail.**

## 8. What C publishes for you to consume

| export | what it is |
|---|---|
| `worldMaterial(family, options)` | the one factory |
| `MATERIAL_FAMILIES`, `MATERIAL_CLASSES`, `materialClass(f)` | the frozen taxonomy |
| `MATERIAL_OPTION_KEYS`, `validateMaterialOptions(f, o)` | the frozen variant axes, checkable without building a material |
| `PALETTES`, `paletteSwatch(id)` | region palette variants |
| `TRIM_SLOTS`, `TRIM_ATLAS`, `trimSlot(id)` | the shared trim atlas |
| `TEXEL_METRES`, `materialTiling(f, o)` | the texel-density seam |
| `DETAIL_NORMAL_TILES`, `DETAIL_NORMAL_TILING` | the four shared detail-normal tiles |
| `materialVariantKey(f, o)` | stable variant identity, for the census |
| `FALLBACK_COLOUR`, `materialFallbackReport()`, `markFamilyAssetFailure(f)` | the loud fallback |
| `consumeStyleboard(mat, board, role, amount)` | styleboard application, unchanged |
| `updateVisualFoundationFrame(frame)`, `bindWaterReflection(...)` | per-frame drivers (moving to `render/water.js` under W1-30S) |
| `visualFoundationCensus(root)` | live scene walk |

## 9. Changing this file

An addition is a normal C commit. **A removal or a repurposing is not available** — it breaks four
children at once, and the reason this document exists is that a good interface published early is
worth more than a perfect library published late. Bring the case to
`orchestration/plans/W1-30C.md`; the answer will be a new option.
