#!/usr/bin/env node
// m-cam05-world-camera.mjs — the executable form RI-CAM05 names in its own `## Comparison
// method`. See m-cam01-rig.mjs's header for why this file did not exist and why a delegate,
// not a stub, is the honest fix.
//
// Delegates to `tools/camera/cam-probe.mjs --probe world,stairs,fp`, which implements RI-CAM05's
// M1/M2/M3/M6 (combat == exploration rig, dialogue's one bounded accommodation, menu freeze,
// HEARTH rest), M5 (vertical bars + tread-frequency FFT on a 30° stair) and M7 (the 140-probe
// first-person detector this item's own §G forbids ever tripping).
//
// Does NOT cover §D's interior-geometry census (combat/traversal/crawl-space clip_through and
// arm-length fractions over a scripted spine walk of each cell) — that lives in `cam-probe.mjs
// --probe clip,arm`, which m-cam01-rig.mjs already runs under RI-CAM01's name, because RI-CAM01
// §D is where `clip_through` itself is defined and RI-CAM05 §D only ADOPTS it. Re-running the
// same browser pass under a second name would not add evidence; the corpus's own "Adopted" note
// at RI-CAM05 §D says exactly this ("clip_through is RI-CAM01 §D's").
//
// See also reports/w1-06/AMENDMENT-W1-06-01.md — RI-CAM05 §D's crawl-space row demands a clip
// figure RI-CAM01 §A's own rig geometry cannot produce at any pitch a player would naturally
// hold. Filed, not fixed here; a corpus owner decides the correction.
//
// USAGE
//   node corpus/80-methods/m-cam05-world-camera.mjs [--out <dir>]
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = path.resolve(HERE, '../../tools');
const ROOT = path.resolve(TOOLS, '..');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('m-cam05-world-camera.mjs — RI-CAM05 M1/M2/M3/M5/M6/M7, delegated to cam-probe.mjs --probe world,stairs,fp');
  console.log('                           (§D clip/arm census runs under m-cam01-rig.mjs — see this file\'s header)');
  console.log('USAGE: node corpus/80-methods/m-cam05-world-camera.mjs [--out <dir>]');
  process.exit(0);
}
const outIdx = args.indexOf('--out');
const outDir = outIdx >= 0 ? args[outIdx + 1] : path.join(ROOT, 'reports', 'w1-06');
const outPath = path.join(path.resolve(outDir), 'm-cam05-world-camera.json');

const script = path.join(TOOLS, 'camera', 'cam-probe.mjs');
const probeArgs = ['--probe', 'world,stairs,fp', '--out', outPath];
console.log(`[m-cam05-world-camera] delegating to: node tools/camera/cam-probe.mjs ${probeArgs.join(' ')}`);
const r = spawnSync(process.execPath, [script, ...probeArgs], { stdio: 'inherit', cwd: ROOT });
process.exit(r.status === null ? 70 : r.status);
