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

### Two residual risks, named rather than discovered later

- **Shader program count.** Every copy now compiles the surface pass. `installSurfaceShader` sets
  `customProgramCacheKey` to a string derived only from the recipe, so two copies of one material
  produce the *same* key and three.js shares one program between them — that is why this should not
  multiply programs. **Reasoned from the code, not measured.** If a future frame-time regression is
  traced to program count, `renderer.info.programs.length` before and after is the arm to run.
- **`shadedMaterials` is an unbounded `Set`** and copies now join it. It was already unbounded for
  originals; this raises the rate. Nothing iterates it at frame rate today (`setWorldWetness()` is
  never called from `game/src` at all), so the cost today is memory, not time. The census's
  `with_surface_uniforms` count is the tripwire: if it climbs across a long session while the scene
  does not, materials are being retained after their meshes are gone.

## 5. CONSUMPTION (`RI-MTH07`) — on hardware, and the control is the point

**NVIDIA L4, `ANGLE (NVIDIA, Vulkan 1.4.303)`, `software: false`** — a hardware attestation, so
these are admissible as appearance evidence.

The perturbation drives a material's **own uniform objects** to an extreme and **never sets
`needsUpdate`**, so no program is recompiled and no `onBeforeCompile` re-runs. The only route from
the call to a pixel is the renderer already holding those exact objects. The three captures at each
site are taken with **no simulated frames between them** — `__HARNESS.screenshot()` re-renders by
itself — so the frames are identical but for the uniform value.

| target | affected by the defect? | pixels moved (best angle) | restore floor |
|---|---|---:|---:|
| **player**, 8-angle orbit | yes | 3.23 – **5.36%** at every one of 8 angles | **0.00%** |
| **building**, 3 angles | yes | 24.25 / **32.84** / 25.12% | **0.00%** |
| **ground**, 2 angles *(control)* | **no** | 73.97 / 52.68% | **0.00%** |

The restore floor is **0.00% at all thirteen sites** — the site is perfectly deterministic, so any
movement at all is signal rather than noise.

**Why `ground` is in the table.** It is the plausible-wrong-answer control. Terrain kept its shader
in both arms, so it must respond in *both*. If every target had come back zero in the before-arm,
the honest reading would have been "the harness cannot perturb anything" and the whole result would
be worthless. `ground` responding is what makes a player/building zero mean an *absence*.

**An accidental repeatability estimate, and it is worth more than it cost.** The first hardware run
tried to delete the fix with a script that resolved the repo from a hard-coded
`/home/user/elder-souls-claude`, which does not exist on a Pod. The revert silently did nothing —
and the run's own guard printed *"REVERT DID NOT APPLY — the BEFORE arm below is NOT a control"*,
which is the only reason it was not read as a result. That arm is therefore a **same-configuration
repeat** of the positive arm, and it returned **byte-identical** numbers: 73.97 / 5.36 / 32.84 and a
0.00% floor. Repeatability spread on this instrument is **zero**. (The script now resolves the repo
from its own location, and the runner additionally greps both source files for the marker rather
than trusting the revert's own log.)

## 6. Delete-the-fix, on a copy

`node tools/control-clone.mjs make` (hard-linked, `game/` and `tools/`, the two edited files
declared writable), then `--revert` inside the clone:

```
REVERT game/src/render/visual-foundation.js  pre=5084d503… post=5ff49046…
REVERT game/src/render/actor.js              pre=a3a0a740… post=22989617…
```

`5ff49046…` and `22989617…` are **the exact md5s of the two files before the change was applied** —
the reversal is byte-for-byte, not approximate. The marker count goes 3 → 0 and 2 → 0 in the clone
while the live tree still reads 3 and 2 and its md5s are unchanged, so the clone was written and the
repository was not.

**The census run inside that reverted clone** (`census/deletefix-clone-summary.json`):

| check | fixed tree | reverted clone |
|---|---|---|
| `NO-ORPHANED-SURFACE-PASS` | PASS, 0 of 406 | **FAIL, 321 of 422** |
| `NO-DEAD-GHOST-UNIFORMS` | PASS, 0 | **FAIL, 321** |
| `WETNESS-REACHES-EVERY-SHADED-MATERIAL` | PASS, 0 | **FAIL, 321** |
| `SHADER-UNIFORM-IS-THE-LIVE-ONE` | PASS, 0 | **FAIL, 321** |
| `INSTRUMENT-SEES-A-DEFECT-IT-CREATED` | PASS | PASS |
| `NO-HOOK-THREW` | PASS | PASS |

The four substantive checks come back red and the two **instrument** controls stay green, which is
the distinction that matters: the arms disagree about the build and agree about the instrument. The
denominator moves (422 rather than 406) because more NPCs had spawned in that session; the *ratio* —
76% of materials carrying surface uniforms that nothing installs — is unchanged, and the per-route
attribution is identical apart from the extra bodies.

## 7. The instrument had to be rebuilt mid-run, and that is worth recording

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

## 8. What this fix does **not** do

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
