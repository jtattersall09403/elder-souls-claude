#!/usr/bin/env node
// m-cam01-rig.mjs — the executable form RI-CAM01 names in its own `## Comparison method`.
//
// RULES.md rule 24: "if a method names a tool that does not exist, build it — and make it able
// to fail." This file names it: `corpus/15-camera/RI-CAM01-rig-geometry-and-spring-arm.md` §
// Comparison method points at `corpus/80-methods/m-cam01-rig.mjs`, and until this round nothing
// on disk answered to that path. `tools/corpus-index.mjs`'s C8 sweep does not catch it, because
// its phantom-tool regex only matches `tools/...`, not `corpus/80-methods/...` — this was a real
// gap, not a false alarm.
//
// It is a DELEGATE, not a stub. `tools/camera/cam-probe.mjs` already implements RI-CAM01's six
// comparison-method probes end to end against the real browser (M1 static rig census + pitch
// scale, M2 arm histogram on the three worst geometries, M3 the clip_through hard gate, M4
// pull-in/push-out/dwell rate asymmetry, M5 back-into-wall, M6 actor-push immunity) — this file
// runs the real thing under the name the item declares and forwards its real exit code. There is
// no code path here that can report a pass the underlying probe did not itself earn.
//
// USAGE
//   node corpus/80-methods/m-cam01-rig.mjs [--out <dir>]
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = path.resolve(HERE, '../../tools');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('m-cam01-rig.mjs — RI-CAM01 M1-M6, delegated to tools/camera/cam-probe.mjs --probe rig,arm,clip,rate,wall,layers');
  console.log('USAGE: node corpus/80-methods/m-cam01-rig.mjs [--out <dir>]');
  process.exit(0);
}

const outIdx = args.indexOf('--out');
const outDir = outIdx >= 0 ? args[outIdx + 1] : null;
const outPath = outDir
  ? path.join(path.resolve(outDir), 'm-cam01-rig.json')
  : path.join(TOOLS, '..', 'reports', 'w1-06', 'm-cam01-rig.json');

const script = path.join(TOOLS, 'camera', 'cam-probe.mjs');
const probeArgs = ['--probe', 'rig,arm,clip,rate,wall,layers', '--out', outPath];
console.log(`[m-cam01-rig] delegating to: node tools/camera/cam-probe.mjs ${probeArgs.join(' ')}`);
const r = spawnSync(process.execPath, [script, ...probeArgs], {
  stdio: 'inherit', cwd: path.resolve(TOOLS, '..'),
});
process.exit(r.status === null ? 70 : r.status);
