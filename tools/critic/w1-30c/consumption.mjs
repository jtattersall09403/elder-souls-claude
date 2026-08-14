#!/usr/bin/env node
// W1-30C critic — CONSUMPTION (RI-MTH07, mandatory under ARBITRATION.md section 3).
//
// A model nothing in the running world reads scores zero. So: boot the SHIPPED game, stand in a
// settlement street, perturb the material registry, and watch the frame change. Not a fixture —
// the game, with its own province, its own styleboards and its own geometry.
//
// Four perturbations, two of which are controls that MUST NOT move the frame. A probe whose every
// arm moves the picture is measuring "did I re-render", not "is this model read".
//
//   node tools/critic/w1-30c/consumption.mjs [--hardware]
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../../lib/browser.mjs';
import { parseArgs } from '../../lib/cli.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const args = parseArgs(process.argv.slice(2));
const HW = !!args.hardware;
const OUT = path.resolve(String(args.out || path.join(ROOT, 'reports/w1-30/C-critic')));
const FRAMES = path.join(OUT, 'consumption-frames');
fs.mkdirSync(FRAMES, { recursive: true });

const R = { schema: 'elder-souls/w1-30c-consumption@1', hardware: HW, arms: [], failures: [], census: null };
const fail = (id, why) => { R.failures.push(`${id}: ${why}`); console.log(`  FAIL  ${id} — ${why}`); };
const ok = (id, what) => console.log(`  ok    ${id} — ${what}`);

const g = await launchGame({ entry: 'game/index.html', width: 960, height: 540, hardwareGpu: HW });
try {
  await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 120000 });
  await g.h('ready');
  R.renderer = await g.page.evaluate(() => {
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      const e = gl.getExtension('WEBGL_debug_renderer_info');
      return String(e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    } catch (e) { return `unavailable: ${e.message}`; }
  });
  R.software = /swiftshader|llvmpipe|software|mesa|unavailable/i.test(R.renderer);
  console.log(`renderer: ${R.renderer}`);
  await g.h('setSeed', 20260814);

  // Stand in a settlement street: the shot the plan's own gates are written against.
  const deck = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/visual/deck.json'), 'utf8'));
  const street = deck.setups.find(s => s.id === 'street-helstrom') || deck.setups.find(s => s.block === 'settlement-street');
  R.place = street.id;
  await g.h('teleport', street.place.x, street.place.z);
  await g.h('stepFrames', 16);
  await g.h('setTimeOfDay', 13);
  await g.h('setWeather', 'clear');
  await g.h('stepFrames', 12);

  // ---- the live census: what the SHIPPED scene graph actually carries -------------------------
  R.census = await g.page.evaluate(async () => {
    const M = await import('/game/src/render/visual-foundation.js');
    const scene = window.__ENGINE.renderer.scene;
    const byFamily = {}, noise = new Set(), bypass = [], detail = {}, instancedFamilies = new Set();
    let meshes = 0, instanced = 0, instances = 0;
    scene.traverse(o => {
      if (!(o.isMesh || o.isInstancedMesh) || !o.material) return;
      meshes++;
      if (o.isInstancedMesh) { instanced++; instances += o.count; }
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        const f = m.userData?.visualFamily;
        if (!f) { if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) bypass.push(o.name || o.type); continue; }
        byFamily[f] = (byFamily[f] || 0) + 1;
        if (o.isInstancedMesh) instancedFamilies.add(f);
        const d = m.userData?.w1_30?.detail;
        if (typeof d === 'string') { detail[d] = (detail[d] || 0) + 1; if (d.startsWith('96px')) noise.add(f); }
        for (const k of ['map', 'normalMap', 'roughnessMap', 'bumpMap', 'aoMap']) {
          if (m[k]?.name && /96px-multiscale/.test(m[k].name)) noise.add(f + ':' + k);
        }
      }
    });
    return {
      meshes, instancedMeshes: instanced, instances,
      families: Object.fromEntries(Object.entries(byFamily).sort((a, b) => b[1] - a[1])),
      familiesPresent: Object.keys(byFamily).length,
      instancedFamilies: [...instancedFamilies].sort(),
      noiseFallback: [...noise].sort(),
      bypass: [...new Set(bypass)].slice(0, 40), bypassCount: new Set(bypass).size,
      fallbackReport: M.materialFallbackReport(),
    };
  });
  console.log(`census: ${R.census.meshes} meshes, ${R.census.familiesPresent}/20 families present, ` +
    `${R.census.instancedMeshes} instanced meshes carrying ${R.census.instances} instances, ` +
    `${R.census.bypassCount} bypass, noise-bound: ${R.census.noiseFallback.length ? R.census.noiseFallback.join(',') : 'none'}`);
  if (R.census.noiseFallback.length) fail('live-noise-retired', `the running world still binds the 96px field: ${R.census.noiseFallback.join(', ')}`);
  else ok('live-noise-retired', 'no material in the shipped scene binds a 96px noise texture');

  // ---- the arms ------------------------------------------------------------------------------
  const shoot = async (tag) => {
    const d = await g.h('screenshot');
    const buf = Buffer.from(String(d).replace(/^data:image\/png;base64,/, ''), 'base64');
    fs.writeFileSync(path.join(FRAMES, `${tag}.png`), buf);
    return { hash: crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16), bytes: buf.length };
  };
  const pixels = async () => g.page.evaluate(() => {
    const c = document.getElementById('view');
    const g2 = document.createElement('canvas'); g2.width = c.width; g2.height = c.height;
    const ctx = g2.getContext('2d'); ctx.drawImage(c, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let s = 0, magenta = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      s += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; n++;
      if (d[i] > 140 && d[i + 2] > 110 && d[i + 1] < d[i] * 0.55) magenta++;
    }
    return { luma: s / n, magentaFrac: magenta / n };
  });

  const arm = async (id, expect, apply) => {
    if (apply) await g.page.evaluate(apply);
    await g.h('stepFrames', 6);
    const [px, sh] = [await pixels(), await shoot(id)];
    const row = { id, expect, ...px, ...sh };
    R.arms.push(row);
    console.log(`  ${id.padEnd(22)} luma ${px.luma.toFixed(5)}  magenta ${(px.magentaFrac * 100).toFixed(3)}%  ${sh.hash}`);
    return row;
  };

  const base = await arm('0-baseline', 'reference', null);

  // A — the loud fallback: mark the family with the most surfaces in this street as failed.
  const top = Object.keys(R.census.families)[0];
  R.perturbed_family = top;
  await arm('A-family-failed', 'MUST move and go magenta',
    `(async () => { const M = await import('/game/src/render/visual-foundation.js'); M.markFamilyAssetFailure(${JSON.stringify(top)}, '(critic consumption probe)'); })()`);

  // B — world wetness, B's rain consumer, driven through the published setter.
  await arm('B-world-wetness', 'MUST move',
    `(async () => { const M = await import('/game/src/render/visual-foundation.js'); M.setWorldWetness({ amount: 1, topY: 200, bottomY: -50 }); })()`);

  // C — CONTROL. Re-issuing the same failure for the same family must be a no-op (the registry
  // guards on `failedFamilies`), and wetness is returned to the value it already holds.
  await arm('C-control-noop', 'MUST NOT move',
    `(async () => { const M = await import('/game/src/render/visual-foundation.js'); M.markFamilyAssetFailure(${JSON.stringify(top)}, '(again)'); M.setWorldWetness({ amount: 1, topY: 200, bottomY: -50 }); })()`);

  // D — CONTROL. A family with zero surfaces in this street must not change this street.
  const absent = await g.page.evaluate(async () => {
    const M = await import('/game/src/render/visual-foundation.js');
    const present = new Set();
    window.__ENGINE.renderer.scene.traverse(o => { if (o.material) for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (m.userData?.visualFamily) present.add(m.userData.visualFamily); });
    return M.MATERIAL_FAMILIES.find(f => !present.has(f)) || null;
  });
  R.absent_family = absent;
  if (absent) {
    await arm('D-control-absent', 'MUST NOT move',
      `(async () => { const M = await import('/game/src/render/visual-foundation.js'); M.markFamilyAssetFailure(${JSON.stringify(absent)}, '(absent family control)'); })()`);
  }

  const by = id => R.arms.find(a => a.id === id);
  const A = by('A-family-failed'), B = by('B-world-wetness'), C = by('C-control-noop'), D = by('D-control-absent');
  const moved = (x, y) => x && y && x.hash !== y.hash;

  if (!moved(base, A)) fail('consumption-fallback', `marking family '${top}' failed produced a byte-identical street frame — the registry's fallback is not read by the shipped world`);
  else if (A.magentaFrac <= base.magentaFrac) fail('consumption-fallback', `the frame moved but no magenta appeared (${(base.magentaFrac * 100).toFixed(3)}% -> ${(A.magentaFrac * 100).toFixed(3)}%) — the fallback is not visibly loud in the world`);
  else ok('consumption-fallback', `family '${top}' failed -> street frame magenta ${(base.magentaFrac * 100).toFixed(3)}% -> ${(A.magentaFrac * 100).toFixed(3)}%`);

  if (!moved(A, B)) fail('consumption-wetness', 'setWorldWetness(1) produced a byte-identical street frame — B\'s rain has nothing to land on');
  else ok('consumption-wetness', `world wetness moves the street frame (luma ${A.luma.toFixed(5)} -> ${B.luma.toFixed(5)})`);

  if (moved(B, C)) fail('consumption-control', 'the no-op control CHANGED the frame — every arm above is measuring re-render, not consumption');
  else ok('consumption-control', 'the no-op control leaves the frame byte-identical');

  if (D && moved(C, D)) fail('consumption-control-absent', `failing '${absent}', which has no surface in this street, changed the street frame`);
  else if (D) ok('consumption-control-absent', `failing the absent family '${absent}' leaves the frame byte-identical`);
  else console.log('  note  every one of the twenty families is present in this street — no absent-family control available');
} finally {
  await g.close?.().catch?.(() => {});
}

fs.writeFileSync(path.join(OUT, HW ? 'consumption-hardware.json' : 'consumption-software.json'), JSON.stringify(R, null, 2) + '\n');
console.log(`\nconsumption: ${R.failures.length} failure(s)`);
process.exit(R.failures.length ? 1 : 0);
