# W1-ORPHANED-SURFACE-SHADERS — the material copy seam

**Commit measured:** `52d66578`, branch `codex/wave1-build-experiment`.
**Instruments:** `tools/visual/w1-30-surface-orphan-census.mjs`, `tools/visual/w1-30-surface-consumption.mjs`.
**Reversal:** `node tools/visual/w1-30-copy-seam-patch.mjs --revert` — the same script that applied
the change, so the delete-the-fix arm cannot drift from the change it reverses.

> Everything under `reports/` is gitignored (`reports/.gitignore:3:*`), so every artefact cited
> anywhere in this piece is copied here. Files under `reports/` are working copies, not evidence.

---

## 1. The finding, reproduced

A critic sweeping for shader-hook collisions reported *"305 of 406 materials carry
`userData.surfaceUniforms` with no shader installing them"*. Reproduced exactly at `52d66578`:

| | before | after |
|---|---:|---:|
| materials in the scene | 584 | 584 |
| carrying `userData.surfaceUniforms` | 406 | 406 |
| **orphaned — the hook no longer installs them** | **305** | **0** |
| carrying a dead JSON-ghost uniform block | 305 | 0 |
| unreachable by `setWorldWetness()` | 305 | 0 |
| `cloth` materials invisible to the loud magenta fallback | 130 of 131 | 0 of 131 |

`census/before-summary.json`, `census/after-summary.json` (per-material rows in `*-rows.json`).

## 2. Which visible things — because 305 is not a blast radius

The defect is **concentrated, not uniform**. It follows `.clone()`, and `.clone()` is what
characters and settlements are built from.

| category | orphaned | intact |
|---|---:|---:|
| **the player's own body** | **14** | 1 |
| other actors (NPCs, beasts) | 195 | 0 |
| buildings | 95 | 30 |
| terrain | 0 | 5 |
| water | 0 | 31 |
| canopy / foliage | 0 | 7 |
| other | 1 | 27 |

**The player.** 14 of the 16 materials on `renderer.playerMesh` had lost the shader: skin, cloth,
the three spine frills, all three equipment sets (reed / chitin / xanmeer), eyes, pupils, shield
rim / face / inner / straps, weapon metal and weapon haft. The single PBR material that survived is
the **shared `mats.skin` original** used by the brow horns and shoulder scales — the one that was
never copied. The other two are `MeshBasicMaterial`s (contact shadow, action silhouette) that never
had the pass at all.

**How they became copies**, attributed from evidence carried on the material rather than guessed:

| route | orphans |
|---|---:|
| `actor.js:592/619` body + frill `mats.<family>.clone()` | 174 |
| `province.js:552` settlement styleboard `.clone()` | 95 |
| `actor.js:674` `familyMat.clone()` | 20 |
| `actor.js:1070-1099` weapon / shield `.clone()` | 12 |
| `actor.js:635` equipment set `.clone()` | 3 |
| unattributed | 1 |

**Other copy routes were checked and are not routes.** There is no `new THREE.Material().copy(m)`
anywhere in `game/src`; `InstancedMesh` shares the material object rather than copying it; the `lod`
axis is a `worldMaterial()` option, not a copy; and the two material caches (`STYLE_MATERIAL_CACHE`
in province.js, `MAT_CACHE` in kits.js) cache the *result* of a clone and of `worldMaterial()`
respectively — a cache is what makes one clone serve many meshes, not a way of making one.

## 3. Four losses at one seam, not one

`installSurfaceShader` does four things. A `.clone()` keeps only the first, and the first is the one
every census reads.

| | what it is | why it hides |
|---|---|---|
| **A** | `userData.surfaceUniforms = u` | **survives**, deep-copied by `JSON.parse(JSON.stringify())` into a ghost whose `uDetailNormal.value` is no longer a Texture. *This is why static inspection of the material tables said the world was fine: the tables are fine.* |
| **B** | `onBeforeCompile = …` | lost — no detail normal, no wear mask, no wetness mask |
| **C** | `shadedMaterials.add(mat)` | lost — `setWorldWetness()` cannot reach the copy, so rain has nothing to land on |
| **D** | `registerFamilyMaterial(f, mat)` | lost — a texture 404 cannot stain the copy magenta, so `MATERIAL_API` §7's deliberately-loud fallback goes quiet |
| **E** | *(separate)* `actor.js#installWaterline` **assigned** `onBeforeCompile` | fixing the seam alone would still have left the player's body broken |

C and D were measured by firing the real code path, not by reading the registry: `setWorldWetness()`
driven to a sentinel and every material asked whether its own uniform followed; and
`markFamilyAssetFailure('cloth')` fired for real and the stained materials counted.

## 4. The fix, and why it is at the copy

Every material `worldMaterial()` builds now carries a **JSON-safe recipe** in `userData` — which
survives `Material.copy()` exactly as the uniforms did — and an own-property `clone` that rebuilds
the shader and both registrations on the copy, then installs itself on the copy so a clone of a
clone is covered.

**Why not at the call sites.** There are a dozen `.clone()` sites across four files. That is a dozen
chances to miss one, and it rots the first time somebody adds the thirteenth.

**Why `clone` and not `copy` — and this one matters.** `Material.prototype.clone()` is
`new this.constructor().copy(this)`. The `copy` that actually runs belongs to the **new** object,
which is a stock material, so an instance-level `copy` override on the source would never be
consulted. **A copy hook would have been inert and would have looked exactly like a fix.**

`MATERIAL_API.md` is frozen and was not edited. Two exports were **added** (§9 permits additions);
the documentation of them is owed: `installCopySeam(mat)` and `adoptMaterialCopy(copy, source)`.

## 5. The instrument had to be rebuilt mid-run, and that is worth recording

The original gate and the first version of this census both asked
`/uDetailNormal/.test(String(mat.onBeforeCompile))`. That reads the **source text of the outer
function** and is blind the moment a hook **chains** a prior one, because the chained code lives in
a closure variable. Against the fixed tree it reported **116 false orphans** — and the obvious
reading of that number was "the fix failed on the actor path".

The census now **calls the hook** against a stand-in shader and asks what came back. It also asks a
harder question the text test could never have asked: *is the uniform object the shader receives the
same object `setWorldWetness()` writes into?* A hook that installed a detached copy would render,
would look installed, and would never respond to the world.

`tools/visual/w1-30-shader-hook-collision.mjs` still uses the text test and will report those 116
false orphans against the fixed tree. It is another piece's instrument; flagged, not edited.

## 6. What this fix does **not** do

- **No ambient occlusion, no contact darkening.** `worldMaterial()` sets `aoMap: authored ? null : …`
  and all twenty families have authored sets, so **`aoMap` is null on every material in the game**;
  there is no screen-space AO pass in `game/src/render`, only a comment deferring it to a GTAO stack
  that is not in the tree. `FEATURE_CONSUMERS.ao` names `aoMap` as its consumer and that consumer is
  null everywhere. This is the thing five blind judges named 5 of 5 and it is a separate remedy.
- **Nothing in `game/src` ever calls `setWorldWetness()`** — only tools do. `uWorldWetness` has been
  0 in every frame the game has ever drawn, on the intact materials as much as the orphaned ones.
  This fix restores the mechanism; it does not supply that input.
- **`CHARACTER_SPECS` declares `wear` (0.15–0.95) and `palette` for all 19 characters — including the
  player's `wear: 0.25` — and `ensureBuilt()` reads only the two colour hexes.** Wiring it is one
  caller, and it was deliberately *not* done here: landing it in the same commit would have made the
  before/after evidence unreadable, because a moved pixel could then be new wear rather than a
  restored shader (RULES rule 6, third shape).

**Falsifiable prediction for the next blind fidelity round:** buildings should improve most (kit
materials carry real `wear` 0.2–0.9 with `wearFrom: 'geometry'` and baked `esCurvature`, so they go
from no wear at all to real geometric edge wear); the player should improve modestly (micro-relief
only, until the `CHARACTER_SPECS` wiring lands); **terrain and canopy should not change at all.** If
terrain and canopy are still judged flat, there is a second cause and it is not this seam.
