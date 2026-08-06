#!/usr/bin/env node
/**
 * calibrate-micro.mjs — measure the mean and standard deviation of each ground micro-relief
 * primitive over the province box, so `game/src/world/microrelief.js`'s CAL table is a
 * measurement and a region's declared `amp_m` is a standard deviation in metres.
 *
 * Prints the table to paste into CAL, plus the realised slope each primitive contributes at unit
 * amplitude — which is the number that decides whether micro-relief fences the province.
 *
 * Usage: node tools/world/calibrate-micro.mjs [--samples 240000]
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MICRO_KINDS, microPrimitive } from '../../game/src/world/microrelief.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const argv = process.argv.slice(2);
const NS = argv.includes('--samples') ? Number(argv[argv.indexOf('--samples') + 1]) : 240000;
const scale = JSON.parse(readFileSync(join(ROOT, 'corpus/50-world/world-scale.json'), 'utf8'));
const WX = scale.scale.world_bounds_m.x[1], WZ = scale.scale.world_bounds_m.z[1];

let st = 0x5EED1234;
const rnd = () => { st ^= st << 13; st >>>= 0; st ^= st >>> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; };

const rows = [];
for (let k = 0; k < MICRO_KINDS.length; k++) {
  let s = 0, s2 = 0, gmax = 0, gsum = 0;
  st = 0x5EED1234;
  for (let i = 0; i < NS; i++) {
    const x = rnd() * WX, z = rnd() * WZ;
    const v = microPrimitive(k, x, z, false);
    s += v; s2 += v * v;
    if (i % 8 === 0) {                       // gradient at 2.5 m, on the normalised field
      const e = 2.5;
      const gx = (microPrimitive(k, x + e, z) - microPrimitive(k, x - e, z)) / (2 * e);
      const gz = (microPrimitive(k, x, z + e) - microPrimitive(k, x, z - e)) / (2 * e);
      const g = Math.hypot(gx, gz);
      gsum += g; gmax = Math.max(gmax, g);
    }
  }
  const mean = s / NS, sd = Math.sqrt(s2 / NS - mean * mean);
  rows.push({ kind: MICRO_KINDS[k], mean, sd, grad_mean: gsum / (NS / 8), grad_max: gmax });
}

process.stdout.write('const CAL = [\n');
for (const r of rows) {
  process.stdout.write(`  { mean: ${r.mean.toFixed(6)}, sd: ${r.sd.toFixed(6)} },`.padEnd(46)
    + `// ${r.kind}\n`);
}
process.stdout.write('];\n\n');
process.stdout.write('per-unit-amplitude slope contribution (deg at 1.0 m of sd, 2.5 m baseline)\n');
for (const r of rows) {
  process.stdout.write(`  ${r.kind.padEnd(12)} mean ${(Math.atan(r.grad_mean) * 180 / Math.PI).toFixed(2).padStart(6)}   `
    + `max ${(Math.atan(r.grad_max) * 180 / Math.PI).toFixed(2).padStart(6)}\n`);
}
