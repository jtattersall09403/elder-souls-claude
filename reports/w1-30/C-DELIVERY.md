# W1-30C — builder delivery evidence

**Piece:** [W1-30C](../../orchestration/plans/W1-30C.md) — the material and texture library.
**Role:** builder. **Branch:** `codex/wave1-build-experiment`.
**Contract:** [BUILDER-EXECUTION-CONTRACT.md](../../orchestration/plans/BUILDER-EXECUTION-CONTRACT.md).
**Nothing here is a verdict.** Every number below is a builder measurement; the populations, the
naive judges, the Deck and the aggregate belong to a fresh critic.

---

## What the piece was for, in one paragraph

The province was textured by **three** authored material sets wearing nine hats, nine more families
had a 256 px albedo and **no normal or roughness map at all**, and a **96 × 96 hash-noise field was
bound as albedo, height, AO and roughness for the whole world** (`visual-foundation.js:112`, before
this piece). That is why surfaces read as flat plastic under any light and why the image statistics
looked acceptable while the game looked like a prototype: procedural noise raises exactly the
statistics that were being measured. All twenty families now carry real albedo + normal +
roughness, the noise field is retired from every one of them, and the fallback that remains is
**magenta on purpose**.

## Phase 1 — the API contract, published first

`game/src/render/MATERIAL_API.md`, committed before any content work, because D, E, F and G were
blocked on the interface and not on the textures.

- Twenty families and six material classes published as frozen registries. Adding a family is a
  plan edit, not a builder's call.
- `MATERIAL_OPTION_KEYS` frozen; `validateMaterialOptions()` exported so a consumer or the census
  can check a variant spec without building a material.
- **Four of the seven declared variant axes were live on day one**, not stubs — `palette`, `wear`,
  `wetness`, `tilingScale` all changed pixels in the first commit. Only `trim` was recorded-only
  until the atlas landed, and it is live now.
- `TEXEL_METRES` publishes metres-per-tile per family, so D/E/F lay their UVs against one density
  rather than guessing repeats. Read it through `materialTiling(family, options)`.
- `options.normalMap` was **declared by the API and silently ignored by the implementation** — the
  family's own normal always won. Fixed in the same commit.
- `worldMaterial` now fails closed on an unknown option key, palette, trim slot or lod, and on an
  out-of-range `wear`/`wetness`/`tilingScale`. Every one of the 23 live call sites was enumerated
  first, so this assertion was armed against data that already exists (RULES.md rule 13).

## Phase 2 — the content

| what | where |
|---|---|
| 16 CC0 photogrammetry sets, provenance + upstream hash recorded | `tools/assets/fetch-cc0-materials.mjs`, Poly Haven, CC0-1.0 |
| 3 synthesised sets — chitin, resin, water | `tools/assets/synth-materials.mjs` |
| 1 declared variant — `wet_chitin` is `chitin` + wetness, not a second set | `material-library.json` |
| 4 shared detail-normal tiles, blended in tangent space at 8× base tiling | `synth-materials.mjs` |
| 1 trim atlas, 2048×1536, twelve bands, one per declared `TRIM_SLOT` | `synth-materials.mjs` |
| wear and wetness as **masks**, not scalars | `visual-foundation.js` `installSurfaceShader` |
| 14 region palette swatches, asserted at import against `world-art.js` | `visual-foundation.js` |
| the loud magenta fallback | `visual-foundation.js` `markFamilyAssetFailure` |
| the generated manifest with hashes and the budget measurement | `tools/assets/check-material-coverage.mjs --write` |

**The three synthesised families are a recorded substitution under the plan's stop condition**, not
a shortcut: no CC0 set in the corpus reads as insect carapace or sap resin, and water's appearance
belongs to `render/water.js` (W1-30H) rather than to a texture. Each records *why* in
`material-library.json` and the manifest, and `tools/render/w1-30-assets.mjs` fails if a synthesised
set has no reason.

## Reuse rows (`W1-30-LIBRARY.md` §3)

**CONSUMED** — the existing 20-family registry and its roughness/metalness/bump table (preserved
wholesale); `world-art.js`'s thirteen region ids (read-only, keyed against); the existing manifest
discipline; `render/water.js` as moved by W1-30S.

**PUBLISHED** — every entry with two or more distinct consumers:

| entry | consumers |
|---|---|
| `worldMaterial` + the frozen option surface | W1-30D, E, F, G, H — five |
| `TEXEL_METRES` / `materialTiling` | D (character sheets), E (kit parts), F (terrain and foliage) |
| the four detail-normal tiles | all twenty families, via six classes |
| the trim atlas + `trimSlot()` | E's kit parts, D's equipment — declared, **not yet realised** (see below) |
| `PALETTES` / `paletteSwatch` | thirteen regions × every family |
| `setWorldWetness()` | W1-30B's rain, W1-30G's interiors |
| the magenta fallback + `materialFallbackReport()` | the coverage gate, `w1-30-assets.mjs`, `visualFoundationCensus` |

**VARIANTS in use** — `wet_chitin = chitin @ wetness 0.7`; 13 region palettes over one stone set;
`tilingScale` live on the whole library through `materialTiling`. **Exemptions: one** — `water` is
exempt from the close-up structure gate because its appearance is the surface shader's, not the
texture's, and C ships only a ripple normal for it.

**Honest gap:** the trim atlas has **zero realised consumers today** — E has not landed a kit and D
has not landed equipment. It is published with its slots frozen so those two can consume it without
waiting for C, but under `W1-30-LIBRARY.md` §3 that is one consumer short and it is recorded here
rather than argued away.

## Measurements, with the commands

Every one of these is reproducible from a clean checkout.

### Coverage — `node tools/assets/check-material-coverage.mjs --write`

```
material-coverage: 20/20 families authored, 19 texture sets, 281 MB high / 70 MB medium — PASS
```

Texture memory is measured as decompressed GPU cost (RGBA8 + full mip chain), which is what the
budget is about; a JPEG's disk size is irrelevant once it is uploaded. Budgets: 320 MB high,
120 MB medium.

**Null control, executed on a copy:** delete `dark_wooden_planks_normal_1k.jpg`.

```
FAIL  family 'timber' has no normal map (…/dark_wooden_planks_normal_1k.jpg)
material-coverage: … — FAIL
```

and in the browser, against the same copy:

```
timber  → colour ff00d4, name "visual-family:timber:ASSET-LOAD-FAILED"
bark    → colour ffffff, name "visual-family:bark"          (untouched neighbour)
materialFallbackReport().families → ["timber"]
```

Both halves go red. **The frame turns magenta rather than quietly reverting to something
plausible**, which is the whole point of the fallback being loud.

### Close-up — `node tools/assets/family-closeup.mjs --null-control`

A permanent fixture: twenty families, one directional light, one fixed camera, 0.5 m, the published
texel density honoured so the rig cannot flatter a material by tiling it more finely than the game
will. Two numbers per family, deliberately different in kind:

- **structure** — luminance standard deviation over 64×64 patches. *Noise raises this.*
- **shading** — the same statistic with the albedo replaced by flat grey, so only the normal map can
  move it. *Noise-as-albedo scores zero here.*

```
family-closeup: 15/20 families resolve structure at 0.5 m — GREEN   (bar: >= 15)
null control:  mean shading 0.0798 authored vs 0.0061 on the noise fallback
               0/20 families would pass on the noise fallback
```

The control is 13× worse and passes nothing. Contact sheets: `C-closeup/family-closeup-full.jpg`,
`-shading.jpg`, `-noise-control.jpg`, `-noise-shading-control.jpg`.

**The five that do not clear both thresholds, named:** `water` (by design — declared exemption),
`leaf`, `reed`, `root`, `cloth`. All five clear the *shading* threshold or come within 0.01 of it;
what they miss is albedo contrast. `reed` in particular still reads washed-out in the contact sheet
and I would not defend it to a judge.

**Two defects this rig found and I fixed rather than reported around**, both visible only in the
pictures:

1. **Three of my first sixteen picks were the same material.** `plastered_stone_wall`,
   `clay_plaster` and `white_plaster_rough_01` are all plaster, so clay, stone and salt came out of
   the rig as one surface — which fails the distinguishability gate before a judge ever sees it.
   Replaced with `coral_stone_wall` and `marble_cliff_02`, which are also more Black Marsh than
   render-farm plaster.
2. **One detail-normal strength for everything imprinted one pattern on everything.** Leather came
   out reading as burlap. The amplitude is now per class, with three per-family overrides, and the
   reason is written beside the numbers in the source.

### The variant axes — `node tools/assets/variant-proof.mjs`

```
wear      4/5 subjects selective (inverted: chitin)
wetness   reads on 5/5: delta -10.3% to -22.1% between the wet and dry arms
palette   78 region pairs over ONE stone set; closest pair 0.013 hue / 0.011 value
          control (same swatch twice) 0.0000 / 0.0000
```

**Three implementation defects this proof caught, each fixed and each re-measured:**

1. **The curvature mask was inert.** It used `length(mapN.xy)`, which saturates to 1 across any
   strong normal map, so `wear` was uniform. This is exactly the failure RULES.md rule 6 describes,
   and it passed every other check I had.
2. **The replacement was scale-dependent.** `fwidth()` is screen-space, so the same wall would have
   worn differently at 1 m and at 10 m. It is now a fixed-epsilon difference of the normal map in
   texture space.
3. **The wetness metric had an inert control.** It compared absolute bottom-vs-top luminance on a
   vertical plane, which the plane's own lighting gradient dominates, so the control came out at
   −25% rather than at zero. The number is now the *difference of the splits*.
4. **Two palette swatches were the same colour.** Blackwood and Deep Marshes were 0.006 hue apart
   over one stone set. Re-authored, along with three others that were crowding.

**`chitin` inverts and is not tuned away.** Its synthesised height is a plateau per plate with
grooves between, so the texture-space curvature lands in the grooves while this test's independent
edge proxy (rendered luminance gradient) lands on the plate rims. The mask is demonstrably not inert
on chitin — it moves edges and faces by different amounts — but it is pointed at the wrong feature,
and the fix belongs with the synth script's height field.

### Boot and the shipping gates

```
node tools/boot-check.mjs                → PASS
node tools/render/w1-30-assets.mjs       → GREEN
node tools/render/w1-30-package2.mjs     → failures: []
node tools/render/w1-30-gate.mjs         → failures: []
node tools/assets/fetch-cc0-materials.mjs --verify → 48/48 files present
```

One boot failure was caused by this work and is recorded because it is instructive: chaining
three.js's *default* `customProgramCacheKey` detached loses `this`, and the default reads
`this.onBeforeCompile.toString()`. The renderer threw inside program lookup. It now chains only a
cache key the material actually owns.

## What I could not do, plainly

| item | state | why |
|---|---|---|
| **KTX2/Basis compression** | **not done** | Neither `basisu` nor `toktx` is installed on this host and neither is vendorable here. The budget is met without them (281/320 MB high, 70/120 MB medium) by keeping roughness at 512. The deferral, the measured figures and the one-command reversal are recorded in `manifest.json`. |
| **Library census** (`tools/visual/library-census.mjs`) | **dependency-blocked** | W1-30V owns the tool and it does not exist yet. `visualFoundationCensus()` now reports the fields it will need — `variants`, `palettes`, `noiseFallbackFamilies`, `assetFailureFamilies`, `metresPerTile`, `classes` — and `materialVariantKey()` gives it the structural identity for the duplicate check. |
| **The bounded live proof on the pod** (3 settlement streets, 2 vistas, 1 rain transition) | **not run** | Not attempted. Every capture above is SwiftShader, which `W1-30-EVIDENCE.md` §4 permits for determinism and boot checks and **explicitly forbids for any appearance claim**. So the close-up sheets are builder diagnostics and *not* evidence of appearance; the hardware Deck run is the critic's, and I am not going to launder a software capture into an appearance claim. |
| **The diffuse-floor removal test** | **critic-owned** | It is in the plan's critic allocation and needs the eight settlement street shots on hardware. The floor at `consumeStyleboard` is untouched by this piece; it should now be testable for removal, and that test is the one I most want the critic to run. |
| **The naive grouping test** (20 unlabelled close-ups → 6 classes) | **critic-owned** | Requires a fresh judge and a pack the builder did not build (RULES.md rule 25). The pack it needs is `family-closeup-full.jpg`, already committed. |
| **`trim` realised consumers** | **zero today** | Published and frozen so E and D can consume without waiting; one consumer short of the library rule, recorded above. |
| **M1–M12 tripwire, texture-memory measurement on hardware, the full Deck** | **critic-owned** | Per the plan's allocation. |

## Reversal

Every change lands with a one-step reversal:

- **the library** — `git revert` the content commit; `tools/render/w1-30-assets.mjs` then fails
  against the old manifest, which is the tripwire.
- **the surface shader** — delete the `installSurfaceShader(...)` call in `worldMaterial`; wear,
  wetness and the detail normal all become no-ops and the base maps still render. Executed on a
  copy: materials build, boot passes, the close-up shading figures fall back toward the base-map
  values.
- **any single family** — change its slug in `FAMILY_SET`; `check-material-coverage.mjs` fails
  immediately if the shipped table and `material-library.json` disagree.
- **the fetch pipeline** — `NODE_USE_ENV_PROXY=1 node tools/assets/fetch-cc0-materials.mjs --force`
  reproduces every CC0 file from its recorded upstream URL and md5.

## Files owned and touched

`game/src/render/MATERIAL_API.md` (new), `game/src/render/visual-foundation.js`,
`game/assets/w1-30/materials/**`, `tools/assets/**`, `reports/w1-30/C-*`.

**One file outside the declared paths:** `tools/render/w1-30-assets.mjs`. It validated the old
three-set manifest and the 256 px generated atlas, both of which this piece removes, so it would
have gone permanently red for everyone. Rewritten for `manifest@2` rather than left broken; no
other piece declares it.
