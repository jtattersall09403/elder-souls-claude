#!/usr/bin/env node
// W1-30C's permanent family close-up instrument.
//
//   node tools/assets/family-closeup.mjs                 # measure, write contact sheets + JSON
//   node tools/assets/family-closeup.mjs --null-control   # also run the noise-fallback arm
//
// The gate it answers (W1-30C's bar, `close-up survives`): at 0.5 m, >= 15 of 20 families show
// local luminance standard deviation >= 0.06 in a 64x64 patch AND normal-map-driven shading
// variation >= 0.04. The second number exists because the first is exactly what procedural noise
// raises — which is the failure this whole piece was written to undo. A statistic can fail a build
// and can never pass one, so this tool's real product is the contact sheet next to the numbers.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, DETERMINISTIC_CHROMIUM_ARGS } from '../lib/browser.mjs';
import { serveDir } from '../lib/serve.mjs';
import { parseArgs } from '../lib/cli.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = parseArgs(process.argv.slice(2));
const NULL_CONTROL = !!args['null-control'];
const OUT = path.resolve(String(args.out || path.join(ROOT, 'reports/w1-30/C-closeup')));
const SHOTS = path.join(process.env.TMPDIR || '/tmp', 'w1-30c-closeup-frames');

const SD_MIN = 0.06;        // structure present at all
const SHADING_MIN = 0.04;   // structure the LIGHT can see, i.e. a real normal map
const FAMILIES_MIN = 15;

fs.mkdirSync(OUT, { recursive: true });
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });

// The rig is a fixture, not the game, so it does not expose window.__HARNESS and launchGame()
// would (correctly) refuse it. One browser, one page, closed in the finally block.
const { chromium } = await loadPlaywright();
const server = await serveDir(ROOT);
const browser = await chromium.launch({ headless: true, args: DETERMINISTIC_CHROMIUM_ARGS.slice() });
const page = await browser.newPage({ viewport: { width: 560, height: 560 } });
await page.goto(server.origin + '/tools/assets/rig/family-closeup.html', { waitUntil: 'load', timeout: 60000 });
const errors = [];
page.on('pageerror', e => errors.push(String(e).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });

try {
  await page.waitForFunction(() => !!window.__RIG, null, { timeout: 60000 });
  await page.evaluate(() => window.__RIG.warm());

  const families = await page.evaluate(() => window.__RIG.families);
  const modes = ['full', 'shading', ...(NULL_CONTROL ? ['noise', 'noise-shading'] : [])];
  const rows = [];

  for (const family of families) {
    const row = { family, class: await page.evaluate(f => window.__RIG.classOf(f), family) };
    for (const mode of modes) {
      const r = await page.evaluate(([f, m]) => window.__RIG.run(f, m), [family, mode]);
      row[mode] = { sd: +r.stats.sd.toFixed(4), mean: +r.stats.mean.toFixed(4) };
      fs.writeFileSync(path.join(SHOTS, `${mode}-${family}.png`), Buffer.from(r.png.split(',')[1], 'base64'));
    }
    row.pass = row.full.sd >= SD_MIN && row.shading.sd >= SHADING_MIN;
    rows.push(row);
    console.log(`  ${family.padEnd(12)} structure ${row.full.sd.toFixed(4)}  shading ${row.shading.sd.toFixed(4)}  ${row.pass ? 'pass' : 'FAIL'}`
      + (NULL_CONTROL ? `   [noise arm: structure ${row.noise.sd.toFixed(4)} shading ${row['noise-shading'].sd.toFixed(4)}]` : ''));
  }

  // Contact sheets, small enough to commit. The evidence standard's point is that progress over
  // time has to be visible, and a number in a JSON file is not visible.
  const sheet = (mode, file) => {
    const list = path.join(SHOTS, `list-${mode}.txt`);
    fs.writeFileSync(list, families.map(f => `file '${path.join(SHOTS, `${mode}-${f}.png`)}'`).join('\n'));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
      '-vf', 'scale=256:256,tile=5x4', '-frames:v', '1', '-q:v', '4', path.join(OUT, file)], { stdio: ['ignore', 'pipe', 'pipe'] });
    return file;
  };
  const sheets = [sheet('full', 'family-closeup-full.jpg'), sheet('shading', 'family-closeup-shading.jpg')];
  if (NULL_CONTROL) sheets.push(sheet('noise', 'family-closeup-noise-control.jpg'), sheet('noise-shading', 'family-closeup-noise-shading-control.jpg'));

  const passed = rows.filter(r => r.pass).length;
  const control = NULL_CONTROL ? {
    // The control must come out WORSE, and be seen to. A control nobody has watched go red is a
    // second copy of the experiment (RULES.md rule 6).
    meanShadingAuthored: +(rows.reduce((a, r) => a + r.shading.sd, 0) / rows.length).toFixed(4),
    meanShadingNoise: +(rows.reduce((a, r) => a + r['noise-shading'].sd, 0) / rows.length).toFixed(4),
    familiesPassingOnNoise: rows.filter(r => r.noise.sd >= SD_MIN && r['noise-shading'].sd >= SHADING_MIN).length,
  } : null;

  const report = {
    schema: 'elder-souls/w1-30c-family-closeup@1',
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim(),
    thresholds: { sd: SD_MIN, shading: SHADING_MIN, familiesRequired: FAMILIES_MIN },
    distance_m: 0.5, light: 'one directional key at (-0.7, 0.9, 0.6), ambient 0.35',
    result: passed >= FAMILIES_MIN ? 'GREEN' : 'RED',
    passed, of: rows.length, sheets, control, pageErrors: errors.slice(0, 10), rows,
  };
  fs.writeFileSync(path.join(OUT, 'family-closeup.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`family-closeup: ${passed}/${rows.length} families resolve structure at 0.5 m — ${report.result}`);
  if (control) console.log(`  null control: mean shading ${control.meanShadingAuthored} authored vs ${control.meanShadingNoise} on the noise fallback; ${control.familiesPassingOnNoise}/${rows.length} would pass on noise`);
  if (errors.length) console.error(`  page errors: ${errors.slice(0, 3).join(' | ')}`);
  process.exitCode = report.result === 'GREEN' ? 0 : 1;
} finally {
  await page.close().catch(() => {});
  await browser.close().catch(() => {});
  await server.close().catch(() => {});
}
