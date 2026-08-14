#!/usr/bin/env node
/**
 * w1-30-shader-hook-collision.mjs — the standing gate W1-30-SHADOW-CASTERS asked for and could
 * not afford: WHO OWNS EACH GLOBAL SHADER HOOK, read out of the running page.
 *
 * WHY THIS EXISTS. Two files patched the same four `THREE.ShaderChunk` fog chunks at module scope
 * on the same day. Import order decided which won; the loser's feature flags kept appearing to
 * work because they toggled state the shader no longer read, and both agents' controls passed. It
 * cost the whole build its atmosphere for four hours and nobody's instrument could see it, because
 * every instrument flipped its own switch and its own switch still moved.
 *
 * The builder's own note: *"a one-line probe catches it — read the chunk back out of the page and
 * assert whose marker string is in it."* This is that probe, generalised to the CLASS of defect
 * rather than the incident, because a global shader hook has exactly two shapes in this tree:
 *
 *   1. `THREE.ShaderChunk.<name> = ...` at module scope — global, last writer wins silently.
 *   2. `material.onBeforeCompile = ...` — per material, and last writer wins silently UNLESS the
 *      assignment chains the `prior` hook. `visual-foundation.js#installSurfaceShader` chains.
 *      `water.js#installWaterShader` and `actor.js#installWaterline` do not.
 *
 * Shape 2 is not hypothetical: `worldMaterial('skin')` installs the detail-normal/wear/wetness
 * pass, and `makeRiggedActor` clones that material and assigns `installWaterline` over the top.
 * This tool asks the page which markers survived into each hook rather than reading the source.
 *
 * IT CAN FAIL, WHICH IS THE POINT. `--sabotage` re-installs `world/aerial.js`'s chunks in the page
 * and forces a recompile; the fog rows must go RED. An assertion that has never been seen to fail
 * is a second copy of the experiment (RULES 6).
 *
 * Usage:
 *   node tools/visual/w1-30-shader-hook-collision.mjs
 *   node tools/visual/w1-30-shader-hook-collision.mjs --sabotage      (must exit non-zero)
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
const SABOTAGE = args.sabotage === true;
const OUT = path.resolve(REPO, args.out || 'reports/visual-truth/shader-hooks');
fs.mkdirSync(OUT, { recursive: true });

const g = await launchGame({ entry: 'game/index.html', width: 480, height: 270 });
await g.h('ready');
await g.h('stepFrames', 20);

if (SABOTAGE) {
  await g.page.evaluate(async () => {
    const A = await import('./src/world/aerial.js');
    A.installAerialPerspective();
    const R = window.__ENGINE.renderer;
    R.scene.traverse((o) => {
      if (!o.material) return;
      for (const m of [].concat(o.material)) m.needsUpdate = true;
    });
  });
  await g.h('stepFrames', 4);
}

const report = await g.page.evaluate(async () => {
  const THREE = await import('./vendor/three/three.module.js');
  const R = window.__ENGINE.renderer;

  // ---- shape 1: the global chunk registry --------------------------------------------------
  const owners = {};
  const MARK = {
    fog_fragment: [['esAerialScale', 'world/aerial.js'], ['esSigma0', 'render/sky.js']],
    fog_pars_fragment: [['uAerial', 'world/aerial.js'], ['W1-30B', 'render/sky.js']],
    fog_vertex: [['viewMatrix[0][1]', 'world/aerial.js'], ['viewMatrix[ 0 ].y', 'render/sky.js']],
    fog_pars_vertex: [['vFogWorldY', 'patched (either)']],
  };
  for (const [chunk, marks] of Object.entries(MARK)) {
    const src = String(THREE.ShaderChunk[chunk] || '');
    owners[chunk] = (marks.find(([needle]) => src.includes(needle)) || [null, 'three stock'])[1];
  }

  // ---- shape 2: per-material hooks, asked of the material and not of the source -------------
  // A material whose hook was overwritten still carries the loser's `userData` uniforms, so the
  // census must read the FUNCTION, not the bookkeeping beside it.
  const mats = new Map();
  R.scene.traverse((o) => {
    if (!o.material) return;
    for (const m of [].concat(o.material)) {
      if (!m || mats.has(m.uuid)) continue;
      const src = m.onBeforeCompile ? String(m.onBeforeCompile) : '';
      mats.set(m.uuid, {
        name: o.name || o.type,
        family: (m.userData && m.userData.family) || null,
        has_surface_uniforms: !!(m.userData && m.userData.surfaceUniforms),
        has_water_uniforms: !!(m.userData && m.userData.waterUniforms),
        hook_mentions_surface: /uDetailNormal|vEsSurfaceWorldY/.test(src),
        hook_mentions_water: /uWaterPhase|uWaterReflection/.test(src),
        hook_mentions_waterline: /uWaterY|vEsWaterY/.test(src),
      });
    }
  });
  const rows = [...mats.values()];
  // The defect: bookkeeping says the surface pass was installed, the hook says it is gone.
  const orphaned = rows.filter((r) => r.has_surface_uniforms && !r.hook_mentions_surface);

  // ---- the MECHANISM arm, so the count above is a diagnosis and not a correlation -----------
  // Take a material whose hook IS intact, clone it the way the actor and equipment builders do,
  // and ask the clone the same two questions. `Material.copy()` in three r180 copies `userData`
  // through `JSON.parse(JSON.stringify(...))` and does NOT copy `onBeforeCompile` — so if this
  // is the mechanism, the clone keeps the bookkeeping and loses the shader. If the clone comes
  // back intact, this arm falsifies the diagnosis and the count above needs another explanation.
  let mechanism = null;
  let intact = null;
  R.scene.traverse((o) => {
    if (intact || !o.material) return;
    for (const m of [].concat(o.material)) {
      if (m && m.userData && m.userData.surfaceUniforms
        && /uDetailNormal|vEsSurfaceWorldY/.test(String(m.onBeforeCompile || ''))) { intact = m; return; }
    }
  });
  if (intact) {
    const c = intact.clone();
    mechanism = {
      source_hook_installs_surface: /uDetailNormal|vEsSurfaceWorldY/.test(String(intact.onBeforeCompile || '')),
      clone_hook_installs_surface: /uDetailNormal|vEsSurfaceWorldY/.test(String(c.onBeforeCompile || '')),
      clone_keeps_surface_uniforms: !!(c.userData && c.userData.surfaceUniforms),
    };
  }

  return {
    mechanism,
    chunk_owners: owners,
    materials_seen: rows.length,
    with_surface_uniforms: rows.filter((r) => r.has_surface_uniforms).length,
    orphaned_surface_pass: orphaned.length,
    orphaned_examples: orphaned.slice(0, 12).map((r) => ({
      mesh: r.name, family: r.family,
      hook_is: r.hook_mentions_waterline ? 'installWaterline' : (r.hook_mentions_water ? 'installWaterShader' : 'unknown'),
    })),
  };
});

const fogOwners = new Set([report.chunk_owners.fog_fragment, report.chunk_owners.fog_pars_fragment]);
const checks = [];
checks.push({
  id: 'FOG-CHUNKS-SINGLE-OWNER',
  ok: fogOwners.size === 1 && report.chunk_owners.fog_fragment === 'render/sky.js',
  detail: `fog_fragment=${report.chunk_owners.fog_fragment} fog_pars_fragment=${report.chunk_owners.fog_pars_fragment} fog_vertex=${report.chunk_owners.fog_vertex}`,
});
checks.push({
  id: 'NO-ORPHANED-SURFACE-PASS',
  ok: report.orphaned_surface_pass === 0,
  detail: `${report.orphaned_surface_pass} of ${report.with_surface_uniforms} materials carry surfaceUniforms whose onBeforeCompile no longer installs them`,
});
if (report.mechanism) {
  console.log(`mechanism arm: source hook installs surface = ${report.mechanism.source_hook_installs_surface}; `
    + `after .clone() hook installs surface = ${report.mechanism.clone_hook_installs_surface}; `
    + `clone still carries userData.surfaceUniforms = ${report.mechanism.clone_keeps_surface_uniforms}`);
}

const out = { sabotage: SABOTAGE, ...report, checks, pageErrors: g.errors.slice(0, 10) };
fs.writeFileSync(path.join(OUT, SABOTAGE ? 'hooks-sabotage.json' : 'hooks.json'), JSON.stringify(out, null, 2));
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.id}  — ${c.detail}`);
for (const e of report.orphaned_examples) console.log(`   orphaned: ${e.mesh} (family ${e.family}) — hook is now ${e.hook_is}`);
await g.close();
process.exit(checks.every((c) => c.ok) ? 0 : 1);
