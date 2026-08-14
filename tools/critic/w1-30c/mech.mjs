#!/usr/bin/env node
// W1-30C critic — drive tools/critic/w1-30c/mech-rig.html and report mechanism results.
//
//   node tools/critic/w1-30c/mech.mjs                 # SwiftShader, deterministic
//   node tools/critic/w1-30c/mech.mjs --hardware      # hardware GL (pod only)
//
// Exits non-zero when any mechanism test fails OR when any positive control fails to move —
// a control that cannot go red is not evidence (RULES.md rule 6).
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, DETERMINISTIC_CHROMIUM_ARGS, HARDWARE_CHROMIUM_ARGS } from '../../lib/browser.mjs';
import { serveDir } from '../../lib/serve.mjs';
import { parseArgs } from '../../lib/cli.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const args = parseArgs(process.argv.slice(2));
const HW = !!args.hardware;
const OUT = path.resolve(String(args.out || path.join(ROOT, 'reports/w1-30/C-critic')));
fs.mkdirSync(OUT, { recursive: true });

const { chromium } = await loadPlaywright();
const server = await serveDir(ROOT);
const browser = await chromium.launch({
  headless: !HW,
  args: (HW ? HARDWARE_CHROMIUM_ARGS : DETERMINISTIC_CHROMIUM_ARGS).slice(),
});
const page = await browser.newPage({ viewport: { width: 320, height: 320 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 400)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 400)); });

const R = { schema: 'elder-souls/w1-30c-mech@1', hardware: HW, tests: {}, failures: [], controls_ok: true };
const fail = (id, why) => { R.failures.push(`${id}: ${why}`); console.log(`  FAIL  ${id} — ${why}`); };
const pass = (id, what) => console.log(`  ok    ${id} — ${what}`);

try {
  await page.goto(server.origin + '/tools/critic/w1-30c/mech-rig.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!window.__MECH, null, { timeout: 60000 });
  R.renderer = await page.evaluate(() => window.__MECH.renderer);
  R.software = /swiftshader|llvmpipe|software|mesa|unavailable/i.test(R.renderer);
  console.log(`renderer: ${R.renderer}${R.software ? '  [software — mechanism deltas only, no appearance claim]' : ''}`);

  // ---- T4 bindings: what is actually on a shipped material ---------------------------------
  const fams = await page.evaluate(() => window.__MECH.families);
  const binds = [];
  for (const f of fams) binds.push(await page.evaluate(f => window.__MECH.bindings(f, {}), f));
  R.tests.bindings = binds;
  const noiseBound = binds.filter(b => [b.map, b.normalMap, b.roughnessMap, b.bumpMap, b.aoMap]
    .some(n => n && /96px-multiscale/.test(n)));
  R.tests.noise_bound_families = noiseBound.map(b => b.family);
  if (noiseBound.length) fail('noise-retired', `${noiseBound.length}/20 families still bind a 96px noise texture: ${noiseBound.map(b => b.family).join(', ')}`);
  else pass('noise-retired', 'no family binds a 96px noise texture on the default path');
  const noShader = binds.filter(b => !b.hasSurfaceShader);
  R.tests.families_without_surface_shader = noShader.map(b => b.family);
  if (noShader.length) fail('surface-shader-coverage', `${noShader.length} families get no wear/wetness/detail shader: ${noShader.map(b => b.family).join(', ')}`);
  else pass('surface-shader-coverage', 'all 20 families install the surface shader');

  // ---- T4b the detail-normal layer's tiling under the tilingScale axis -----------------------
  // MATERIAL_API.md section 5 publishes `detailRepeat = DETAIL_NORMAL_TILING / metresPerTile`, i.e.
  // the detail tile is meant to sit at a FIXED 8x the base tiling whatever tilingScale is. The
  // shader multiplies vNormalMapUv — which already carries the base repeat of 2/tilingScale — by
  // uDetailTiling = 8/tilingScale, so the ratio it actually delivers is 8/tilingScale, not 8.
  // At the default tilingScale of 1 those two are the same number, which is why nothing has seen it.
  const dt = {};
  for (const ts of [1, 2, 4, 8]) {
    const b = await page.evaluate(ts => window.__MECH.bindings('timber', { tilingScale: ts }), ts);
    dt[ts] = { uDetailTiling: b.detailTilingUniform, baseRepeat: b.normalRepeat?.[0] ?? null,
      delivered_ratio: b.detailTilingUniform, published_ratio: 8 };
  }
  R.tests.detail_tiling_vs_tilingScale = dt;
  const wrong = Object.entries(dt).filter(([, v]) => Math.abs(v.delivered_ratio - 8) > 1e-6).map(([k]) => k);
  if (wrong.length) fail('detail-tiling-scale', `at tilingScale ${wrong.join(', ')} the detail normal is blended at ${wrong.map(k => dt[k].delivered_ratio).join('/')}x the base tiling instead of the published 8x — tilingScale is applied to the detail layer twice`);
  else pass('detail-tiling-scale', 'detail normal sits at 8x base tiling at every tilingScale');

  // authored:false — the one declared option that reinstates the retired field
  const off = await page.evaluate(() => window.__MECH.bindings('stone', { authored: false }));
  R.tests.authored_false = off;
  const reinstated = [off.map, off.roughnessMap, off.bumpMap, off.aoMap].filter(n => n && /96px-multiscale/.test(n));
  if (reinstated.length) fail('noise-reinstatable', `worldMaterial('stone',{authored:false}) rebinds ${reinstated.length} noise maps and does NOT go magenta (detail="${off.detail}")`);
  else pass('noise-reinstatable', 'authored:false does not reinstate noise');

  // ---- T1 declared axes: live or recorded-only ----------------------------------------------
  const base = await page.evaluate(() => window.__MECH.planeArm('timber', {}));
  const axes = {};
  for (const [id, opts] of [
    ['palette', { palette: 'blackwood' }],      // positive control — builder measured this live
    ['wear', { wear: 0.9 }],
    ['wetness', { wetness: 0.9 }],
    ['tilingScale', { tilingScale: 4 }],
    ['trim', { trim: 'plank' }],
    ['lod', { lod: 'far' }],
  ]) {
    const arm = await page.evaluate(o => window.__MECH.planeArm('timber', o), opts);
    axes[id] = { ...arm, identical_to_base: arm.hash === base.hash, dLuma: +(arm.luma - base.luma).toFixed(6) };
  }
  R.tests.variant_axes = { base, axes };
  if (axes.palette.identical_to_base) { R.controls_ok = false; fail('axis-control', 'the palette positive control produced a byte-identical frame — the whole axis test is void'); }
  else pass('axis-control', `palette moves the frame (dLuma ${axes.palette.dLuma})`);
  const inert = Object.entries(axes).filter(([k, v]) => k !== 'lod' && v.identical_to_base).map(([k]) => k);
  R.tests.inert_axes = inert;
  if (inert.length) fail('axes-live', `declared variant axes that change NOTHING in the frame: ${inert.join(', ')}`);
  else pass('axes-live', 'every declared axis moves pixels');

  // ---- T2 wetness under instancing -----------------------------------------------------------
  const wet = {};
  for (const kind of ['mesh', 'instanced']) {
    wet[kind] = {};
    for (const amount of [0, 1]) wet[kind][amount] = await page.evaluate(([k, a]) => window.__MECH.wetArm(k, 'stone', a), [kind, amount]);
  }
  // The discriminator is per-quad: how much does turning world wetness on change THIS quad?
  // Correct behaviour saturates — the low quad goes fully wet and the high quad not at all — so
  // the two per-quad effects are far apart. A shader blind to instanceMatrix gives both instances
  // the identical base-geometry gradient, so the two effects are equal.
  for (const k of ['mesh', 'instanced']) for (const a of [0, 1]) {
    if (wet[k][a].error) { R.controls_ok = false; fail('wetness-instrument', `${k}@${a}: ${wet[k][a].error}`); }
  }
  const eff = k => ({
    low: +(wet[k][1].low - wet[k][0].low).toFixed(6),
    high: +(wet[k][1].high - wet[k][0].high).toFixed(6),
  });
  const em = eff('mesh'), ei = eff('instanced');
  const meshSep = Math.abs(em.low - em.high), instSep = Math.abs(ei.low - ei.high);
  R.tests.wetness_instancing = { ...wet, mesh_effect: em, instanced_effect: ei, mesh_separation: +meshSep.toFixed(6), instanced_separation: +instSep.toFixed(6) };
  R.tests.shader_worldY = await page.evaluate(() => window.__MECH.shaderSource('stone'));
  if (meshSep < 2e-3) { R.controls_ok = false; fail('wetness-control', `the non-instanced positive control did not separate the two heights (${meshSep.toFixed(6)}) — the instanced result below is void`); }
  else {
    pass('wetness-control', `separate meshes: low quad moves ${em.low}, high quad moves ${em.high} (separation ${meshSep.toFixed(4)})`);
    if (instSep < meshSep * 0.25) fail('wetness-instancing', `two INSTANCES at the same two heights separate by only ${instSep.toFixed(6)} against ${meshSep.toFixed(6)} for two separate meshes — the world-height wetness mask does not see instanceMatrix, so every instanced surface in the world shares one height`);
    else pass('wetness-instancing', `instanced separation ${instSep.toFixed(4)}`);
  }
  const sw = R.tests.shader_worldY;
  if (sw && sw.mentions_modelMatrix && !sw.mentions_instanceMatrix) {
    fail('wetness-instancing-source', `the vertex line computing the height mask is "${sw.line}" — it applies modelMatrix and never instanceMatrix, which three.js's own worldpos_vertex chunk does apply`);
  }

  // ---- T3 wearFrom:'geometry', the published route to the unmet gate --------------------------
  const wear = {};
  for (const [id, wf, w] of [['tex0', 'texture', 0], ['tex9', 'texture', 0.9], ['geo0', 'geometry', 0], ['geo9', 'geometry', 0.9]]) {
    wear[id] = await page.evaluate(([f, a, b]) => window.__MECH.wearArm(f, a, b), ['timber', wf, w]);
  }
  const texSel = Math.abs(wear.tex9.columnSd - wear.tex0.columnSd);
  const geoSel = Math.abs(wear.geo9.columnSd - wear.geo0.columnSd);
  const geoMoved = wear.geo9.hash !== wear.geo0.hash;
  R.tests.wear = {
    texture_columnSd_delta: +texSel.toFixed(6), geometry_columnSd_delta: +geoSel.toFixed(6),
    geometry_changed_frame: geoMoved,
    texture_mean_shift: +(wear.tex9.mean - wear.tex0.mean).toFixed(6),
    geometry_mean_shift: +(wear.geo9.mean - wear.geo0.mean).toFixed(6),
    arms: Object.fromEntries(Object.entries(wear).map(([k, v]) => [k, { mean: v.mean, columnSd: v.columnSd, hash: v.hash }])),
  };
  if (!geoMoved) fail('wearFrom-geometry', 'wearFrom:"geometry" with a baked esCurvature attribute produced a byte-identical frame at wear 0 and wear 0.9 — the route C published instead of meeting its gate does not execute');
  else pass('wearFrom-geometry', `geometry route moves the frame; selectivity delta ${geoSel.toFixed(4)} vs texture ${texSel.toFixed(4)}`);

  // ---- T3b the ceiling of the geometry route, in the gate's own units ------------------------
  const ceil = {};
  for (const w of [0, 0.6, 0.9, 1.0]) {
    const face = await page.evaluate(w => window.__MECH.wearCeiling('timber', w, 0), w);
    const arris = await page.evaluate(w => window.__MECH.wearCeiling('timber', w, 1), w);
    ceil[w] = { face: face.luma, arris: arris.luma, identical: face.hash === arris.hash,
      pct: +(((arris.luma - face.luma) / Math.max(1e-9, face.luma)) * 100).toFixed(2) };
  }
  R.tests.wear_geometry_ceiling = ceil;
  if (!ceil[0].identical) fail('wear-ceiling-control', `at wear 0 the arris and face planes are NOT identical (${ceil[0].pct}%) — the difference is not wear`);
  else pass('wear-ceiling-control', 'at wear 0 arris and face are byte-identical');
  const best = Math.max(...[0.6, 0.9, 1.0].map(w => Math.abs(ceil[w].pct)));
  R.tests.wear_geometry_best_pct = +best.toFixed(2);
  if (best < 8) fail('wear-geometry-reaches-gate', `the geometry route's UPPER BOUND — a whole plane at esCurvature 1 against a whole plane at 0 — is ${best.toFixed(2)}% against the gate's 8%, so baking esCurvature cannot close the gate on its own`);
  else pass('wear-geometry-reaches-gate', `geometry route reaches ${best.toFixed(2)}% >= 8% at its ceiling`);

  R.tests.page_errors = errors;
  R.memory = await page.evaluate(() => window.__MECH.info());
} finally {
  await browser.close().catch(() => {});
  await server.close?.().catch?.(() => {});
}

const file = path.join(OUT, HW ? 'mech-hardware.json' : 'mech-software.json');
fs.writeFileSync(file, JSON.stringify(R, null, 2) + '\n');
console.log(`\nmech: ${R.failures.length} failure(s), controls ${R.controls_ok ? 'ok' : 'VOID'} — ${file}`);
process.exit(R.failures.length || !R.controls_ok ? 1 : 0);
