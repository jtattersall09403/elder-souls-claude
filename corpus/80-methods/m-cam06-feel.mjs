#!/usr/bin/env node
// m-cam06-feel.mjs — the executable form RI-CAM06 names in its own `## Comparison method`. See
// m-cam01-rig.mjs's header for why this file did not exist and why a delegate, not a stub, is
// the honest fix.
//
// Delegates to `tools/camera/cam-probe.mjs --probe feel,coupling,scripted`, which implements
// RI-CAM06's M2 (per-frame position/angle derivatives), M4 (FOV variance — the item's own zero-
// zoom-on-lock-acquire rule), M5 (head-bob FFT), M7 (shake decomposition), M1 (byte-identical
// output across three different stepping patterns — the determinism bar) and M8/M9 (the death
// camera and the fog-gate cut, both reproducibility-tested).
//
// The shake check is where round 2 found and fixed RI-CAM06 §G's automatic-fail condition: the
// original basis() folded the shake into the FORWARD vector that desiredPoint() uses to place
// the camera, so a "rotational only" shake was measurably POSITIONAL (0.277 m over 20 events).
// Fixed by splitting the rig basis (no shake, places the camera) from the view basis (with
// shake, projection + clip only); this probe is what re-confirms it stays at 0 m.
//
// USAGE
//   node corpus/80-methods/m-cam06-feel.mjs [--out <dir>]
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = path.resolve(HERE, '../../tools');
const ROOT = path.resolve(TOOLS, '..');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('m-cam06-feel.mjs — RI-CAM06 M1/M2/M4/M5/M7/M8/M9, delegated to cam-probe.mjs --probe feel,coupling,scripted');
  console.log('USAGE: node corpus/80-methods/m-cam06-feel.mjs [--out <dir>]');
  process.exit(0);
}
const outIdx = args.indexOf('--out');
const outDir = outIdx >= 0 ? args[outIdx + 1] : path.join(ROOT, 'reports', 'w1-06');
const outPath = path.join(path.resolve(outDir), 'm-cam06-feel.json');

const script = path.join(TOOLS, 'camera', 'cam-probe.mjs');
const probeArgs = ['--probe', 'feel,coupling,scripted', '--out', outPath];
console.log(`[m-cam06-feel] delegating to: node tools/camera/cam-probe.mjs ${probeArgs.join(' ')}`);
const r = spawnSync(process.execPath, [script, ...probeArgs], { stdio: 'inherit', cwd: ROOT });
process.exit(r.status === null ? 70 : r.status);
