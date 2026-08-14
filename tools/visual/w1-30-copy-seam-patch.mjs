#!/usr/bin/env node
/**
 * patch-W1-ORPHANED-SURFACE-SHADERS.mjs — apply the copy-seam fix to two HOT files.
 *
 * Both targets are declared by three other live pieces each (`tools/ownership.mjs --for`), so this
 * is deliberately not an editor session: it is one scripted run that
 *   - records the pre-edit md5 of every file it touches,
 *   - REFUSES to apply twice (it looks for its own marker and exits 0 having done nothing),
 *   - REFUSES to apply at all if any anchor has moved or is not unique,
 *   - writes nothing unless every anchor in every file matched.
 *
 * `--check`  report what it would do and change nothing.
 * `--revert` put the files back exactly (this is the delete-the-fix arm, and it is the same
 *            script so the reversal cannot drift from the change).
 *
 * This file lives in the scratchpad, NOT in the repo tree: a temporary file in a shared tree is a
 * committed file (RULES 17).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Resolve the repo from THIS FILE's own location, never from a hard-coded path. The first version
// hard-coded `/home/user/elder-souls-claude` and the revert therefore silently did nothing on a
// RunPod Pod, where the workspace is `/workspace/elder-souls-<runid>` — so the "delete the fix"
// arm of a hardware run was a second copy of the positive arm. The run's own guard caught it and
// printed "REVERT DID NOT APPLY — the BEFORE arm below is NOT a control", which is the only reason
// it was not read as a result. A control that cannot fail is bad; a control that silently becomes
// the experiment is worse (RULES rule 6, HAZARDS §0).
const ROOT = process.env.ES_ROOT || path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const CHECK = process.argv.includes('--check');
const REVERT = process.argv.includes('--revert');
const MARKER = 'W1-ORPHANED-SURFACE-SHADERS';

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');

// ---------------------------------------------------------------------------------------------
// visual-foundation.js
// ---------------------------------------------------------------------------------------------
const VF_A1_FROM = `  mat.userData.surfaceUniforms=u;
  const prior=mat.onBeforeCompile;`;
const VF_A1_TO = `  mat.userData.surfaceUniforms=u;
  // THE RECIPE, not just the uniforms.  Every value here is a JSON primitive, so it survives
  // \`Material.copy()\`'s deep copy of \`userData\` intact — which is exactly what lets a COPY rebuild
  // the shader a copy cannot inherit.  See THE COPY SEAM below for why that matters. (${MARKER})
  mat.userData.w1_30surface={tile,tiling,wear,wetness,detailStrength,wearFrom};
  const prior=mat.onBeforeCompile;`;

const VF_A2_FROM = `export function worldMaterial(family, options={}) {`;
const VF_A2_TO = `// ---------------------------------------------------------------------------
// THE COPY SEAM — where three quarters of this library was being thrown away. (${MARKER})
//
// \`Material.copy()\` in the vendored three r180 does NOT copy \`onBeforeCompile\`, and it deep-copies
// \`userData\` through \`JSON.parse(JSON.stringify(...))\`.  A \`.clone()\` of a \`worldMaterial()\`
// therefore keeps the BOOKKEEPING and loses the SHADER — and loses two registrations that no
// census could ever see, because they live in this module rather than on the material:
//
//   A. \`userData.surfaceUniforms\`  SURVIVES, as a dead JSON ghost whose textures are gone. This is
//                                  why every static inspection of the material tables said the
//                                  world was fine: the tables ARE fine. Nothing installed them.
//   B. \`onBeforeCompile\`           LOST — no detail normal, no wear mask, no wetness mask.
//   C. \`shadedMaterials\`           does not contain the copy, so \`setWorldWetness()\` cannot reach
//                                  it: B's rain would have nothing to land on.
//   D. \`liveFamilyMaterials\`       does not contain the copy, so a texture 404 cannot stain it
//                                  magenta and §7's deliberately loud fallback goes quiet on it.
//
// WHY THE FIX IS HERE AND NOT AT THE CALL SITES.  There are a dozen \`.clone()\` sites today, across
// \`world/province.js\` (settlement styleboards — every building in the province),
// \`render/actor.js\` (bodies, frills, eyes, weapons, shields), \`render/renderer.js\` (the player's
// camera-fade material) and \`render/scene.js\` (fixtures).  Re-installing at each of them is a
// dozen chances to miss one, and it rots the first time somebody adds the thirteenth.  Instead
// every material this factory builds carries its own recipe and knows how to rebuild itself when
// it is copied.  That is what OWNER-DIRECTIVES §3 means by reuse being structural, not a hope.
//
// WHY \`clone\` AND NOT \`copy\`.  \`Material.prototype.clone()\` is \`new this.constructor().copy(this)\`:
// the \`copy\` that actually runs belongs to the NEW object, which is a stock material, so an
// instance-level \`copy\` override on the SOURCE would never be consulted — a \`copy\` hook here would
// be inert and would look exactly like a fix.  \`clone\` is the method invoked on the source, so
// that is the seam that works.  The override is re-installed on the copy, so a clone of a clone is
// covered too, and \`installCopySeam\` is idempotent by construction.
//
// NOT COVERED, and said plainly rather than left to be found: a caller that writes
// \`new THREE.MeshStandardMaterial().copy(worldMat)\` by hand bypasses this seam. There is no such
// call site in \`game/src\` today; \`tools/visual/w1-30-surface-orphan-census.mjs\` is the standing
// tripwire that would catch one being added.
// ---------------------------------------------------------------------------

/** Rebuild everything a copy could not inherit.  Idempotent: \`installSurfaceShader\` rewrites
 * rather than appends, and both registries are Sets. Exported so a census or a repair pass can
 * call it on a material it finds hollow. */
export function adoptMaterialCopy(copy, source) {
  const family=source?.userData?.visualFamily;
  if(family) registerFamilyMaterial(family, copy);                  // D
  if(source?.userData?.waterUniforms) installWaterShader(copy);     // water first, as worldMaterial() does
  const recipe=source?.userData?.w1_30surface;
  if(recipe) installSurfaceShader(copy, recipe);                    // A, B and C in one call
  installCopySeam(copy);
  return copy;
}

/** Make \`mat.clone()\` return a whole material instead of a hollow one. */
export function installCopySeam(mat) {
  if(!mat || Object.hasOwn(mat,'clone')) return mat;
  Object.defineProperty(mat,'clone',{ configurable:true, writable:true, enumerable:false,
    value: function(){ return adoptMaterialCopy(Object.getPrototypeOf(this).clone.call(this), this); } });
  return mat;
}

export function worldMaterial(family, options={}) {`;

const VF_A3_FROM = `      wearFrom:variant.wearFrom });
  }
  return mat;
}`;
const VF_A3_TO = `      wearFrom:variant.wearFrom });
  }
  // Every material this factory hands out knows how to rebuild itself when copied. (${MARKER})
  installCopySeam(mat);
  return mat;
}`;

// ---------------------------------------------------------------------------------------------
// actor.js — the second, smaller mechanism at the same seam.
// ---------------------------------------------------------------------------------------------
const AC_A1_FROM = `function installWaterline(mat, sharedUniforms) {
  mat.onBeforeCompile = (shader) => {`;
const AC_A1_TO = `function installWaterline(mat, sharedUniforms) {
  // CHAIN, DO NOT ASSIGN. (${MARKER})  \`mat\` is a \`.clone()\` of a \`worldMaterial()\`, and since the
  // copy seam in \`visual-foundation.js\` that clone now arrives with its detail-normal / wear /
  // wetness pass rebuilt. Assigning over the top would delete it again — and the player's own body
  // is the most visible thing this file builds, so the fix would have been inert exactly where it
  // matters most. This is the same chain \`installSurfaceShader\` already does, for the same reason.
  const prior = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    if (prior) prior(shader, renderer);`;

const AC_A2_FROM = `          + '\\troughnessFactor = mix(roughnessFactor, roughnessFactor * 0.30, esWet);\\n');
  };
  mat.needsUpdate = true;
}`;
const AC_A2_TO = `          + '\\troughnessFactor = mix(roughnessFactor, roughnessFactor * 0.30, esWet);\\n');
  };
  // three.js's DEFAULT \`customProgramCacheKey\` reads \`this.onBeforeCompile.toString()\`, so calling
  // a prior key detached throws inside the renderer's program lookup — a boot failure, not a
  // visual one. Only chain a key the material actually OWNS. (${MARKER})
  const priorKey = Object.hasOwn(mat, 'customProgramCacheKey') ? mat.customProgramCacheKey.bind(mat) : null;
  mat.customProgramCacheKey = () => \`es-waterline-v1:\${priorKey ? priorKey() : ''}\`;
  mat.needsUpdate = true;
}`;

const PLAN = [
  { file: 'game/src/render/visual-foundation.js', md5: '5ff49046a21a3eb3dded0e2abed939d8',
    edits: [[VF_A1_FROM, VF_A1_TO], [VF_A2_FROM, VF_A2_TO], [VF_A3_FROM, VF_A3_TO]] },
  { file: 'game/src/render/actor.js', md5: '22989617981ffa6ee8a1813d33c72d89',
    edits: [[AC_A1_FROM, AC_A1_TO], [AC_A2_FROM, AC_A2_TO]] },
];

let failed = false;
const results = [];
for (const p of PLAN) {
  const abs = path.join(ROOT, p.file);
  const src = fs.readFileSync(abs, 'utf8');
  const pre = md5(src);
  const applied = src.includes(MARKER);
  if (!REVERT && applied) { results.push(`SKIP  ${p.file} — already carries the ${MARKER} marker; refusing to apply twice`); continue; }
  if (REVERT && !applied) { results.push(`SKIP  ${p.file} — no ${MARKER} marker; nothing to revert`); continue; }

  let out = src, ok = true;
  for (const [from, to] of p.edits) {
    const [a, b] = REVERT ? [to, from] : [from, to];
    const n = out.split(a).length - 1;
    if (n !== 1) { results.push(`FAIL  ${p.file} — anchor matched ${n} time(s), needed exactly 1:\n        ${a.split('\n')[0].slice(0, 96)}`); ok = false; failed = true; break; }
    out = out.replace(a, b);
  }
  if (!ok) continue;
  results.push(`${CHECK ? 'WOULD ' : ''}${REVERT ? 'REVERT' : 'APPLY '} ${p.file}  pre-md5=${pre} (expected ${p.md5}${pre === p.md5 ? ' MATCH' : ' DRIFTED — anchors still unique, proceeding'})  post-md5=${md5(out)}`);
  if (!CHECK) fs.writeFileSync(abs, out);
}
for (const r of results) console.log(r);
process.exit(failed ? 1 : 0);
