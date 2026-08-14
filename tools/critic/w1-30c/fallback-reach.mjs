#!/usr/bin/env node
// W1-30C critic — does the loud magenta fallback actually reach the shipped settlement street?
//
// The first consumption pass found that marking `stone` failed — 1504 stone meshes in the Helstrom
// street — moved the frame's mean luminance by 0.00003 and lit no magenta. Two explanations fit
// that, and they have opposite consequences, so this separates them instead of guessing:
//
//   (a) the fallback does not reach those materials at all, or
//   (b) it reaches them and the first pass's colour detector was mistuned (0xff00d4 multiplied by a
//       mid-grey albedo and pushed through ACES is a long way from bright magenta).
//
// So this counts MATERIALS, not pixels: how many live materials of the family exist in the scene
// graph, and how many of them carry the `:ASSET-LOAD-FAILED` name after the failure is raised. A
// count needs no threshold and cannot be mistuned. The per-pixel change is recorded alongside it.
'use strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchGame } from '../../lib/browser.mjs';
import { parseArgs } from '../../lib/cli.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const args = parseArgs(process.argv.slice(2));
const OUT = path.resolve(String(args.out || path.join(ROOT, 'reports/w1-30/C-critic')));
fs.mkdirSync(OUT, { recursive: true });

const g = await launchGame({ entry: 'game/index.html', width: 640, height: 360, hardwareGpu: !!args.hardware });
const R = { schema: 'elder-souls/w1-30c-fallback-reach@1', failures: [] };
try {
  await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 120000 });
  await g.h('ready');
  await g.h('setSeed', 20260814);
  const deck = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/visual/deck.json'), 'utf8'));
  const street = deck.setups.find(s => s.id === 'street-helstrom');
  await g.h('teleport', street.place.x, street.place.z);
  await g.h('stepFrames', 16);
  await g.h('setTimeOfDay', 13); await g.h('setWeather', 'clear');
  await g.h('stepFrames', 12);

  const survey = () => g.page.evaluate(() => {
    const mats = new Map();
    window.__ENGINE.renderer.scene.traverse(o => {
      if (!o.material) return;
      for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
        if (m.userData?.visualFamily) mats.set(m.uuid, m);
      }
    });
    const out = {};
    for (const m of mats.values()) {
      const f = m.userData.visualFamily;
      out[f] = out[f] || { total: 0, stained: 0, styleboardClones: 0, colours: {} };
      out[f].total++;
      if (/ASSET-LOAD-FAILED/.test(m.name || '')) out[f].stained++;
      // A styleboard clone is the shape that cannot be reached: _settlementStyleboard() does
      // o.material.clone() and assigns the clone, and clone() copies userData but the clone is
      // never passed back through worldMaterial()'s registerFamilyMaterial().
      if (m.userData.styleRole || m.userData.sourceFamily) out[f].styleboardClones++;
      const hex = m.color ? m.color.getHexString() : 'none';
      out[f].colours[hex] = (out[f].colours[hex] || 0) + 1;
    }
    return out;
  });

  R.before = await survey();
  const FAM = 'stone';
  R.family = FAM;
  await g.page.evaluate(async f => {
    const M = await import('/game/src/render/visual-foundation.js');
    M.markFamilyAssetFailure(f, '(critic fallback-reach probe)');
  }, FAM);
  await g.h('stepFrames', 6);
  R.after = await survey();

  const b = R.before[FAM] || { total: 0 }, a = R.after[FAM] || { total: 0 };
  R.result = {
    family: FAM,
    live_materials: a.total,
    stained_before: b.stained, stained_after: a.stained,
    styleboard_clones: a.styleboardClones,
    unreached: a.total - a.stained,
    colours_after: a.colours,
  };
  console.log(`family '${FAM}': ${a.total} live materials in the shipped street; ` +
    `${a.stained} carry :ASSET-LOAD-FAILED after the failure is raised; ${a.total - a.stained} do not; ` +
    `${a.styleboardClones} are styleboard clones`);
  console.log(`colours after: ${JSON.stringify(a.colours)}`);
  // The first version read `a.unreached`, which lives on R.result and not on the survey row, so
  // `undefined > 0` was false and the tool printed "ok" over a 20-of-51 result. Recorded rather
  // than quietly corrected: a tool that cannot go red is the thing this project fails builders for.
  const unreached = a.total - a.stained;
  if (a.stained === 0) R.failures.push(`the loud fallback reached NONE of the ${a.total} live '${FAM}' materials in the street`);
  else if (unreached > 0) R.failures.push(`the loud fallback reached ${a.stained} of ${a.total} live '${FAM}' materials in the shipped street; ${unreached} kept their normal appearance`);
  for (const f of R.failures) console.log(`  FAIL  ${f}`);
  if (!R.failures.length) console.log('  ok    every live material of the family went magenta');
} finally {
  await g.close?.().catch?.(() => {});
}
fs.writeFileSync(path.join(OUT, 'fallback-reach.json'), JSON.stringify(R, null, 2) + '\n');
process.exit(R.failures.length ? 1 : 0);
