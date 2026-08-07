#!/usr/bin/env node
// m-cam03-lockon-framing.mjs — the executable form RI-CAM03 names in its own `## Comparison
// method`. See m-cam01-rig.mjs's header for why this file did not exist and why a delegate,
// not a stub, is the honest fix (RULES.md rule 24; tools/corpus-index.mjs's C8 sweep does not
// catch `corpus/80-methods/...` paths, only `tools/...` ones).
//
// Delegates to `tools/camera/cam-probe.mjs --probe lock,pitchlaw,latency`, which implements
// RI-CAM03's M1 (containment law, on-screen fractions), M2 (the 40-pose pitch grid) and M4/M5
// (reframe / switch / break-with-no-snap latency) against the real browser.
//
// Also runs `tools/camera/cam-pitch-instrument.mjs --m2`, RI-CAM03 §E M2 read exactly as
// written ("settled pitch minus the pitch the aim-point spring alone would produce, versus
// pitch_bias(d,h), ±1.0°") — the check that caught round 2's pitch-pin defect (a positive-
// feedback loop that pinned every lock-on at the -50° floor for the rest of the fight) and that
// cam-probe's own `pitchlaw` probe, reading only the SETTLED pose, could not have distinguished
// from a well-posed law reaching the same clamp on purpose. Both instruments' failures are
// reported; neither is allowed to mask the other.
//
// USAGE
//   node corpus/80-methods/m-cam03-lockon-framing.mjs [--out <dir>]
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = path.resolve(HERE, '../../tools');
const ROOT = path.resolve(TOOLS, '..');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('m-cam03-lockon-framing.mjs — RI-CAM03 M1/M2/M4/M5, delegated to cam-probe.mjs --probe lock,pitchlaw,latency');
  console.log('                             plus cam-pitch-instrument.mjs --m2 (the pitch-pin falsifier, no browser)');
  console.log('USAGE: node corpus/80-methods/m-cam03-lockon-framing.mjs [--out <dir>]');
  process.exit(0);
}
const outIdx = args.indexOf('--out');
const outDir = outIdx >= 0 ? args[outIdx + 1] : path.join(ROOT, 'reports', 'w1-06');
const outPath = path.join(path.resolve(outDir), 'm-cam03-lockon-framing.json');

console.log('[m-cam03-lockon-framing] leg 1/2: node tools/camera/cam-pitch-instrument.mjs --m2 (no browser)');
const m2 = spawnSync(process.execPath, [path.join(TOOLS, 'camera', 'cam-pitch-instrument.mjs'), '--m2'],
  { stdio: 'inherit', cwd: ROOT });

console.log(`[m-cam03-lockon-framing] leg 2/2: node tools/camera/cam-probe.mjs --probe lock,pitchlaw,latency --out ${outPath}`);
const probe = spawnSync(process.execPath,
  [path.join(TOOLS, 'camera', 'cam-probe.mjs'), '--probe', 'lock,pitchlaw,latency', '--out', outPath],
  { stdio: 'inherit', cwd: ROOT });

const m2Status = m2.status === null ? 70 : m2.status;
const probeStatus = probe.status === null ? 70 : probe.status;
console.log(`[m-cam03-lockon-framing] m2=${m2Status} probe=${probeStatus}`);
process.exit(m2Status !== 0 ? m2Status : probeStatus);
