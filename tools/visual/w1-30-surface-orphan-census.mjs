#!/usr/bin/env node
/**
 * w1-30-surface-orphan-census.mjs — WHICH VISIBLE THINGS LOST THE SURFACE SHADER, AND HOW.
 *
 * WHY THIS EXISTS. `tools/visual/w1-30-shader-hook-collision.mjs` established the headline —
 * 305 of 406 materials carry `userData.surfaceUniforms` whose `onBeforeCompile` no longer
 * installs them — and proved the mechanism in the page with a clone arm. A count is not a blast
 * radius. This tool answers the two questions the count does not:
 *
 *   1. WHICH THINGS. Group every affected material by what a player is looking at (player body,
 *      NPC, building, terrain, canopy, water, prop, UI) rather than by uuid.
 *   2. HOW IT HAPPENED. `Material.copy()` is one route. Attribute each orphan to the call site
 *      that made it, from evidence carried on the material itself, and say how many are
 *      unattributed rather than rounding them into the nearest guess.
 *
 * THE FOUR LOSSES AT ONE SEAM. `installSurfaceShader` does four things and a `.clone()` keeps
 * only the first. This tool measures all four independently, because a fix for one is not a fix
 * for the others and reporting them as one number would hide three of them:
 *
 *   A. `mat.userData.surfaceUniforms = u`   — SURVIVES a copy, as a dead JSON ghost. Deep-copied
 *      by `JSON.parse(JSON.stringify())`, so `uDetailNormal.value` is no longer a THREE.Texture.
 *   B. `mat.onBeforeCompile = ...`          — LOST. `Material.copy()` does not copy it.
 *   C. `shadedMaterials.add(mat)`           — LOST. So `setWorldWetness()` cannot reach the copy
 *      even if B were restored: B's rain never lands on three quarters of the world.
 *   D. `registerFamilyMaterial(family, mat)` — LOST. So the deliberately-loud magenta
 *      ASSET-LOAD-FAILED fallback (MATERIAL_API §7) cannot stain a copied material. A texture
 *      404 would go unseen on exactly the materials this census counts.
 *
 * IT CAN FAIL, AND IT IS MADE TO FAIL TWO WAYS BEFORE IT IS BELIEVED (RULES rule 4, rule 6):
 *
 *   --selfcheck   Take a material whose hook IS intact, destroy its hook in the page, restore it,
 *                 and run the same predicate at all three points. It must read clean / red /
 *                 clean. An instrument that cannot detect a defect it created by hand cannot be
 *                 trusted about 305 it did not — and one that only ever runs the red arm is a
 *                 second copy of the experiment.
 *   --clone-arm   (always on) The mechanism: clone an intact material and ask the clone the same
 *                 four questions. If the clone comes back intact, the diagnosis is falsified and
 *                 the count needs another explanation. Printed whether it agrees or not.
 *
 * The reachability probe for C is a real perturbation rather than a Set-membership read, because
 * a Set read would only tell me about the code I already read: `setWorldWetness()` is driven to a
 * sentinel value and every material is asked whether its own uniform followed. That is the same
 * question the renderer asks, and it distinguishes a live uniform block from a JSON ghost.
 *
 * Usage:
 *   node tools/visual/w1-30-surface-orphan-census.mjs
 *   node tools/visual/w1-30-surface-orphan-census.mjs --selfcheck        (must exit non-zero)
 *   node tools/visual/w1-30-surface-orphan-census.mjs --out <dir> --steps 40
 *
 * Exit 0 only when there are zero orphans AND zero wetness-unreachable shaded materials AND zero
 * unregistered families. At HEAD before the fix it is expected to exit 1 loudly.
 */
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
}
const SELFCHECK = args.selfcheck === true;
// The loud-fallback probe permanently marks a family as failed in the page it runs in, so it is
// opt-in and the page it ran in must not then be used for appearance evidence.
const FALLBACK = args['fallback-probe'] === true;
const STEPS = Number(args.steps || 30);
const OUT = path.resolve(REPO, args.out || 'reports/visual-truth/surface-orphans');
fs.mkdirSync(OUT, { recursive: true });

const g = await launchGame({ entry: 'game/index.html', width: 480, height: 270 });
await g.h('ready');
await g.h('stepFrames', STEPS);

const report = await g.page.evaluate(async ({ selfcheck, fallback }) => {
  const VF = await import('./src/render/visual-foundation.js');
  const R = window.__ENGINE.renderer;

  // ---- W1-F1-SHADER-COLLISION: does the composed program actually LINK? ---------------------
  // Every check above asks whether a hook INSTALLS uniforms into a stand-in shader. None of them
  // ask whether the shader those hooks compose is a legal GLSL program — so two hooks that each
  // install cleanly can still declare the same identifier twice, the renderer's driver refuses to
  // link, and the mesh draws nothing while every count above reads clean. That is exactly what
  // shipped: `installWaterline` (actor.js) started chaining onto `installSurfaceShader`
  // (visual-foundation.js) and both declared `uniform float uWetness`; 124 actor-body materials
  // failed to link and every existing check here stayed green throughout
  // (`corpus/90-verdicts/wave1/W1-ORPHANED-SURFACE-SHADERS-r1.md` §3, the `NO-HOOK-THREW` near
  // miss — the hook does not throw, it emits illegal GLSL). This is the missing tripwire named
  // there: no material actually mounted in the live scene may hold a program the driver marked
  // `runnable === false`. It reads the renderer's OWN program diagnostics, not a re-derivation.
  const GL = [R.gl, R.webgl, R.three, R.renderer, R.threeRenderer, window.__ENGINE.gl]
    .find((c) => c && c.properties && typeof c.properties.get === 'function') || null;
  const programRunnable = (m) => {
    if (!GL) return null;
    const props = GL.properties.get(m) || {};
    const prog = props.currentProgram;
    // three.js's WebGLProgram only populates `.diagnostics` when there is something to report —
    // empirically confirmed on this repo's own before/after packs (corpus/90-verdicts/wave1/
    // artifacts/W1-F1-SHADER-COLLISION/{before,after}/shader-collision.json): a program that
    // links cleanly leaves `.diagnostics` undefined FOREVER, not just before its first compile.
    // So null here is genuinely silent — it means "no evidence of a link failure", which covers
    // both "never compiled" and "compiled and linked fine" and cannot be told apart from this
    // signal alone. That is exactly why only a POSITIVE `runnable === false` is ever treated as a
    // finding below; null must never be read as a pass on its own.
    if (!prog || !prog.diagnostics) return null;
    return {
      runnable: prog.diagnostics.runnable,
      fragment_log: String(prog.diagnostics.fragmentShader?.log || '').slice(0, 400),
    };
  };

  // ---- HOW WE ASK WHETHER A HOOK INSTALLS THE SURFACE PASS ----------------------------------
  // The first version of this census — and the gate that found the defect — tested
  // `/uDetailNormal/.test(String(mat.onBeforeCompile))`. That reads the SOURCE TEXT of the outer
  // function, and it is blind the moment a hook CHAINS a prior one: the chaining wrapper's own
  // text mentions nothing, because the surface code lives in a closure variable. It reported 116
  // false orphans against a build where the pass was demonstrably installed, and it would have
  // been read as the fix having failed.
  //
  // So ask the hook what it DOES, not what it says. Call it against a stand-in shader carrying
  // the chunk markers three would give it, and see what comes back. This is immune to chaining,
  // to minification and to anybody renaming a variable, and it is the same question the renderer
  // asks at program-compile time.
  const probeHook = (m) => {
    const fake = {
      uniforms: {},
      vertexShader: '#include <begin_vertex>\n#include <skinning_vertex>\n#include <worldpos_vertex>\n',
      fragmentShader: '#include <normal_fragment_maps>\n#include <lights_physical_fragment>\n'
        + '#include <clipping_planes_fragment>\n#include <color_fragment>\n#include <roughnessmap_fragment>\n',
    };
    let threw = null;
    try { if (m.onBeforeCompile) m.onBeforeCompile(fake, R); } catch (e) { threw = String((e && e.message) || e); }
    const su = m.userData && m.userData.surfaceUniforms;
    return {
      hook_threw: threw,
      // The pass is installed only if BOTH the uniform arrived AND the fragment source gained the
      // wear/wetness body. A uniform with no shader body would be bookkeeping all over again.
      installs_surface: !!fake.uniforms.uDetailNormal && /uDetailNormal/.test(fake.fragmentShader)
        && /vEsSurfaceCurv/.test(fake.fragmentShader) && /esWet/.test(fake.fragmentShader),
      // THE IDENTITY LINK, and it is the whole CONSUMPTION question in one boolean: is the uniform
      // object the shader receives THE SAME OBJECT `setWorldWetness()` writes into? A hook that
      // installed a detached copy would render, would look installed, and would never respond to
      // the world. That is the failure this project has shipped sixteen times.
      shader_uniform_is_the_live_one: !!(fake.uniforms.uDetailNormal && su
        && fake.uniforms.uWorldWetness === su.uWorldWetness),
      installs_water: !!fake.uniforms.uWaterPhase,
      installs_waterline: !!fake.uniforms.uWaterY,
    };
  };

  // ---- collect every material reachable from the scene, plus the ones parked in userData ----
  // `renderer.js#setCharacterFade` keeps a cloned `__fadeMat` on the MESH's userData and only
  // mounts it when the camera closes on the player. A scene walk taken at arm's length would
  // miss the single material the owner is most likely to be looking at, so walk both.
  // The owner looks at the player first, and `actor-body:saxhleel:skin` is not distinguishable
  // from any other saxhleel by name. Ask the renderer which subtree is actually the player rather
  // than pattern-matching a name and hoping.
  const playerMaterials = new Set();
  if (R.playerMesh) R.playerMesh.traverse((o) => {
    if (o.material) for (const m of [].concat(o.material)) playerMaterials.add(m);
    if (o.userData && o.userData.__fadeMat) playerMaterials.add(o.userData.__fadeMat);
    if (o.userData && o.userData.__solidMat) playerMaterials.add(o.userData.__solidMat);
  });

  const seen = new Map();   // material -> row
  const record = (m, meshName, mounted) => {
    if (!m) return;
    let row = seen.get(m);
    if (!row) {
      const u = m.userData && m.userData.surfaceUniforms;
      const p = probeHook(m);
      row = {
        material_name: m.name || m.type,
        family: (m.userData && m.userData.visualFamily) || null,
        is_player: playerMaterials.has(m),
        meshes: [],
        mounted,
        has_surface_uniforms: !!u,
        // A DEAD JSON GHOST vs a LIVE uniform block. After JSON deep-copy the texture is gone and
        // the object is no longer the one any shader holds a reference to.
        uniforms_are_live: !!(u && u.uDetailNormal && u.uDetailNormal.value
          && u.uDetailNormal.value.isTexture === true),
        hook_installs_surface: p.installs_surface,
        shader_uniform_is_the_live_one: p.shader_uniform_is_the_live_one,
        hook_threw: p.hook_threw,
        hook_installs_water: p.installs_water,
        hook_installs_waterline: p.installs_waterline,
        has_water_uniforms: !!(m.userData && m.userData.waterUniforms),
        has_w1_30: !!(m.userData && m.userData.w1_30),
        // Evidence of route, carried on the material itself rather than inferred from a name.
        styleboard: (m.userData && m.userData.styleboard) || null,
        source_family: (m.userData && m.userData.sourceFamily) || null,
        wetness_followed: null,
        family_registered: null,
        // The tripwire (W1-F1-SHADER-COLLISION): null means "not compiled at sampling time", not
        // green — only `runnable === false` is a finding, and `runnable === true` is the only
        // passing answer this field can give.
        program_runnable: programRunnable(m),
      };
      seen.set(m, row);
    }
    if (meshName && row.meshes.length < 6) row.meshes.push(meshName);
    if (mounted) row.mounted = true;
  };
  R.scene.traverse((o) => {
    if (o.material) for (const m of [].concat(o.material)) record(m, o.name || o.type, true);
    // parked, not currently mounted
    if (o.userData && o.userData.__fadeMat) record(o.userData.__fadeMat, `${o.name || o.type}#__fadeMat`, false);
    if (o.userData && o.userData.__solidMat) record(o.userData.__solidMat, `${o.name || o.type}#__solidMat`, false);
  });

  // ---- LOSS C, measured by perturbation rather than by reading the Set -----------------------
  // Drive the world wetness to a sentinel nobody else would write and ask every material whether
  // its own uniform followed. Restore afterwards. This is what `setWorldWetness` exists to do, so
  // a material that does not follow is a material B's weather cannot reach.
  const before = VF.worldWetnessState();
  const SENTINEL = 0.8137;
  VF.setWorldWetness({ amount: SENTINEL, topY: before.topY, bottomY: before.bottomY });
  for (const [m, row] of seen) {
    const u = m.userData && m.userData.surfaceUniforms;
    row.wetness_followed = !!(u && u.uWorldWetness && Math.abs(u.uWorldWetness.value - SENTINEL) < 1e-6);
  }
  VF.setWorldWetness(before);

  // ---- the mechanism arm: clone an intact material and ask the clone -------------------------
  let intact = null;
  for (const [m, row] of seen) { if (row.has_surface_uniforms && row.hook_installs_surface) { intact = m; break; } }
  let mechanism = null;
  if (intact) {
    const c = intact.clone();
    const cu = c.userData && c.userData.surfaceUniforms;
    mechanism = {
      source: intact.name,
      source_hook_installs_surface: probeHook(intact).installs_surface,
      clone_hook_installs_surface: probeHook(c).installs_surface,
      clone_shader_uniform_is_the_live_one: probeHook(c).shader_uniform_is_the_live_one,
      clone_keeps_surface_uniforms: !!cu,
      clone_uniforms_are_live: !!(cu && cu.uDetailNormal && cu.uDetailNormal.value && cu.uDetailNormal.value.isTexture === true),
    };
    const b2 = VF.worldWetnessState();
    VF.setWorldWetness({ amount: 0.6131, topY: b2.topY, bottomY: b2.bottomY });
    mechanism.clone_wetness_followed = !!(cu && cu.uWorldWetness && Math.abs(cu.uWorldWetness.value - 0.6131) < 1e-6);
    VF.setWorldWetness(b2);
    c.dispose();
  }

  // ---- the self-check: break one on purpose and require the instrument to see it -------------
  // Both arms run the SAME predicate against the SAME material; only the hook differs. An arm
  // that asserted the "before" answer instead of measuring it would be a second copy of the
  // experiment (RULES rule 6, HAZARDS §0).
  let selfcheckResult = null;
  if (selfcheck && intact) {
    const victim = intact;
    const isOrphan = (m) => !!(m.userData && m.userData.surfaceUniforms) && !probeHook(m).installs_surface;
    const beforeBreak = isOrphan(victim);
    const savedHook = victim.onBeforeCompile;
    victim.onBeforeCompile = (shader) => shader;    // a hook that installs nothing
    const afterBreak = isOrphan(victim);
    victim.onBeforeCompile = savedHook;
    const restored = isOrphan(victim);
    selfcheckResult = { victim: victim.name, detected_as_orphan_before_break: beforeBreak,
      detected_as_orphan_after_break: afterBreak, detected_as_orphan_after_restore: restored };
  }

  // ---- LOSS D, measured the same way, and DESTRUCTIVE so it runs last -------------------------
  // `markFamilyAssetFailure` stains every material the registry knows about for that family. Any
  // material of that family that does NOT change colour is invisible to the loud-fallback
  // guarantee of MATERIAL_API §7. This fires the real failure path rather than reading the
  // registry, because reading the registry would only tell me about the code I already read.
  // It permanently marks that family as failed in this page, so it is the last thing done here
  // and the page must not be reused for appearance measurements afterwards.
  let fallbackProbe = null;
  if (fallback) {
    const counts = new Map();
    for (const [, row] of seen) if (row.family) counts.set(row.family, (counts.get(row.family) || 0) + 1);
    const probeFamily = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    if (probeFamily && !VF.materialFallbackReport().families.includes(probeFamily)) {
      const members = [...seen.entries()].filter(([, r]) => r.family === probeFamily);
      VF.markFamilyAssetFailure(probeFamily, '(census probe)');
      const stained = members.filter(([m]) => /ASSET-LOAD-FAILED/.test(m.name)).length;
      fallbackProbe = { family: probeFamily, members: members.length, stained_by_registry: stained,
        invisible_to_loud_fallback: members.length - stained,
        page_state_permanently_mutated: true };
    }
  }

  const rows = [...seen.values()];
  return {
    three_version: (await import('./vendor/three/three.module.js')).REVISION,
    materials_seen: rows.length,
    rows,
    mechanism,
    fallbackProbe,
    selfcheckResult,
    pageErrors: [],
  };
}, { selfcheck: SELFCHECK, fallback: FALLBACK });

// ---------------------------------------------------------------------------------------------
// Classification happens HERE, not in the page, so the categories can be re-cut against a saved
// row dump without paying for another browser.
// ---------------------------------------------------------------------------------------------
// Categories are ordered most-specific-first on purpose. The first cut of this function put the
// `xanmeer` equipment set in `building` and two equipment sets in `ui`, because it tested the
// architecture words before the actor ones. A misfiled row is a wrong answer to "which visible
// things are affected", which is the only question here that matters.
function category(row) {
  const s = `${row.material_name || ''} ${row.meshes.join(' ')}`.toLowerCase();
  if (row.is_player) return 'player';
  if (/actor-|held-weapon|held-grip|shield-/.test(s)) return 'actor (npc)';
  if (/water|river|pool|flood|waterfall/.test(s)) return 'water';
  if (/canopy|foliage|leaf|frond|cover:|understor|crown|trunk/.test(s)) return 'canopy/foliage';
  if (/ground|terrain|geology|rock|ground-skin|bed/.test(s)) return 'terrain';
  if (/style-|wall|roof|post|plank|building|kit|settlement|door|xanmeer|hut|shrine|tower|bridge|pier/.test(s)) return 'building';
  if (/hud|compass|journal|menu|reticle/.test(s)) return 'ui';
  return 'other';
}
function route(row) {
  const s = `${row.material_name || ''} ${row.meshes.join(' ')}`.toLowerCase();
  if (row.styleboard) return 'province.js:552 settlement styleboard .clone()';
  if (/camera-fade|__fademat/.test(s)) return 'renderer.js:761 player camera-fade .clone()';
  if (/actor-body|actor-secondary-frill/.test(s)) return 'actor.js:592/619 body+frill mats.<family>.clone()';
  if (/actor-equipment/.test(s)) return 'actor.js:635 equipment set .clone() (cached per mats)';
  if (/actor-family-form|actor-beast/.test(s)) return 'actor.js:674 familyMat.clone()';
  if (/held-weapon|held-grip|shield-/.test(s)) return 'actor.js:1070-1099 weapon/shield .clone()';
  if (/actor-eye|pupil/.test(s)) return 'actor.js:703/734 eye mats.<family>.clone()';
  if (/dungeonstone|:inner/.test(s)) return 'scene.js:465/516 fixture .clone()';
  return 'unattributed';
}

const rows = report.rows;
for (const r of rows) { r.category = category(r); r.route = route(r); }

const withUniforms = rows.filter((r) => r.has_surface_uniforms);
const orphans = withUniforms.filter((r) => !r.hook_installs_surface);
const ghosts = withUniforms.filter((r) => !r.uniforms_are_live);
const unreachableWet = withUniforms.filter((r) => !r.wetness_followed);
const clobbered = orphans.filter((r) => r.hook_installs_waterline || r.hook_installs_water);
// W1-F1-SHADER-COLLISION tripwire: only a POSITIVE `runnable === false` counts against a
// material. `program_runnable === null` means the driver never compiled a program for it at the
// instant we sampled (never mounted/never drawn) and is silent on the question, not a pass.
const notRunnable = rows.filter((r) => r.program_runnable && r.program_runnable.runnable === false);

const tally = (list, key) => {
  const m = new Map();
  for (const r of list) m.set(r[key], (m.get(r[key]) || 0) + 1);
  return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]));
};

const summary = {
  commit: process.env.ES_COMMIT || null,
  three_revision: report.three_version,
  materials_seen: report.materials_seen,
  with_surface_uniforms: withUniforms.length,
  orphaned_surface_pass: orphans.length,
  dead_json_ghost_uniforms: ghosts.length,
  wetness_unreachable: unreachableWet.length,
  orphans_whose_hook_was_reassigned: clobbered.length,
  program_not_runnable: notRunnable.length,
  program_runnable_sampled: rows.filter((r) => r.program_runnable !== null).length,
  orphans_by_category: tally(orphans, 'category'),
  orphans_by_family: tally(orphans, 'family'),
  orphans_by_route: tally(orphans, 'route'),
  intact_by_category: tally(withUniforms.filter((r) => r.hook_installs_surface), 'category'),
  player_rows: rows.filter((r) => r.is_player)
    .map((r) => ({ name: r.material_name, meshes: r.meshes, family: r.family,
      orphaned: r.has_surface_uniforms && !r.hook_installs_surface,
      hook_installs_waterline: r.hook_installs_waterline, uniforms_are_live: r.uniforms_are_live,
      wetness_followed: r.wetness_followed })),
  mechanism: report.mechanism,
  loud_fallback_probe: report.fallbackProbe,
  selfcheck: report.selfcheckResult,
};

const checks = [
  { id: 'NO-ORPHANED-SURFACE-PASS', ok: orphans.length === 0,
    detail: `${orphans.length} of ${withUniforms.length} materials carry surfaceUniforms whose onBeforeCompile no longer installs them` },
  { id: 'NO-DEAD-GHOST-UNIFORMS', ok: ghosts.length === 0,
    detail: `${ghosts.length} of ${withUniforms.length} carry a JSON-deep-copied uniform block whose uDetailNormal is not a Texture` },
  { id: 'WETNESS-REACHES-EVERY-SHADED-MATERIAL', ok: unreachableWet.length === 0,
    detail: `${unreachableWet.length} of ${withUniforms.length} did not follow setWorldWetness() to its sentinel value` },
  // The identity link between the model and the renderer, per material. This is the check that
  // would still fail if somebody "fixed" the orphans by installing a detached uniform block.
  { id: 'SHADER-UNIFORM-IS-THE-LIVE-ONE',
    ok: withUniforms.filter((r) => !r.shader_uniform_is_the_live_one).length === 0,
    detail: `${withUniforms.filter((r) => !r.shader_uniform_is_the_live_one).length} of ${withUniforms.length} bind a uWorldWetness that is NOT the object setWorldWetness() writes into` },
  { id: 'NO-HOOK-THREW', ok: rows.filter((r) => r.hook_threw).length === 0,
    detail: `${rows.filter((r) => r.hook_threw).length} onBeforeCompile hooks threw when invoked against a stand-in shader` },
  // THE MISSING TRIPWIRE (W1-ORPHANED-SURFACE-SHADERS-r1.md §3/§6). Every check above asks
  // whether a hook INSTALLS something into a stand-in shader; none of them ask whether the real,
  // composed program the renderer builds from the LIVE scene actually LINKS. `NO-HOOK-THREW` is
  // the near miss it names: `installWaterline` never threw, it emitted a fragment shader that
  // declared `uniform float uWetness` twice, and every check above this line passed at 0-of-422
  // while 124 actor-body materials failed to link and neither the player nor any NPC had a body.
  // This reads `program.diagnostics.runnable` straight off the renderer's own WebGLProperties for
  // every material actually mounted and compiled in the scene — the same fact a driver-level GLSL
  // link failure leaves behind, independent of what any hook claims about itself.
  { id: 'NO-UNRUNNABLE-PROGRAM-IN-SCENE', ok: notRunnable.length === 0,
    detail: notRunnable.length === 0
      ? `0 of ${rows.length} materials hold a program the driver marked runnable:false (three.js leaves .diagnostics undefined for a program that links cleanly, so a link-failure report is the only signal this reads — see the comment on programRunnable above)`
      : `${notRunnable.length} material(s) hold a program the driver marked runnable:false — the mesh is not drawn. `
        + notRunnable.slice(0, 3).map((r) => `${r.material_name}: ${r.program_runnable.fragment_log.replace(/ /g, '').trim().slice(0, 200)}`).join(' | ') },
];
if (report.fallbackProbe) {
  checks.push({ id: 'LOUD-FALLBACK-REACHES-EVERY-MATERIAL',
    ok: report.fallbackProbe.invisible_to_loud_fallback === 0,
    detail: `${report.fallbackProbe.invisible_to_loud_fallback} of ${report.fallbackProbe.members} '${report.fallbackProbe.family}' materials were NOT stained by markFamilyAssetFailure()` });
}
if (SELFCHECK) {
  const s = report.selfcheckResult;
  checks.push({ id: 'INSTRUMENT-SEES-A-DEFECT-IT-CREATED',
    // All three arms must disagree in the right direction: clean before, red when broken, clean
    // again when restored. Only the middle one going red is a control that has never failed.
    ok: !!(s && s.detected_as_orphan_before_break === false && s.detected_as_orphan_after_break === true
      && s.detected_as_orphan_after_restore === false),
    detail: s ? `broke ${s.victim}: before=${s.detected_as_orphan_before_break} broken=${s.detected_as_orphan_after_break} restored=${s.detected_as_orphan_after_restore}`
      : 'no intact material existed to break — the self-check could not run, which is itself a finding' });
}

fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ ...summary, checks }, null, 2));
fs.writeFileSync(path.join(OUT, 'rows.json'), JSON.stringify(rows, null, 2));

console.log(`three r${report.three_version} — ${report.materials_seen} materials, ${withUniforms.length} carrying surfaceUniforms`);
if (report.mechanism) {
  const m = report.mechanism;
  console.log(`mechanism arm on '${m.source}': source installs surface=${m.source_hook_installs_surface}; `
    + `clone installs surface=${m.clone_hook_installs_surface}; clone keeps userData.surfaceUniforms=${m.clone_keeps_surface_uniforms}; `
    + `clone uniforms live=${m.clone_uniforms_are_live}; clone follows setWorldWetness=${m.clone_wetness_followed}`);
}
console.log('orphans by category:', JSON.stringify(summary.orphans_by_category));
console.log('orphans by route   :', JSON.stringify(summary.orphans_by_route));
console.log('player materials   :', JSON.stringify(summary.player_rows));
if (report.fallbackProbe) console.log('loud fallback probe:', JSON.stringify(report.fallbackProbe));
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.id}  — ${c.detail}`);
console.log(`wrote ${path.join(OUT, 'summary.json')} and rows.json`);

await g.close();
process.exit(checks.every((c) => c.ok) ? 0 : 1);
