#!/usr/bin/env node
// shoot.mjs — capture screenshots at the canonical viewpoints.
// Spec: corpus/80-methods/HARNESS.md §6. Consumers: corpus/70-visual/RI-*.
import fs from 'node:fs';
import path from 'node:path';
import {
  parseArgs, wantsHelp, usage, die, log, EXIT, TOOLS_DIR,
  readJson, writeJson, ensureDir, sha256, makeRunId, gitInfo, hashDataTree,
} from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';
import { SETUP_OPS } from '../lib/run.mjs';
import { RUNS_DIR } from '../lib/cli.mjs';

const VP_PATH = path.join(TOOLS_DIR, 'harness', 'viewpoints.json');

const USAGE = `
shoot.mjs — capture PNGs at the canonical viewpoints.

USAGE
  node tools/harness/shoot.mjs [--out <dir>] [--only VP01,VP03] [--list]

OPTIONS
  --out <dir>       Output directory (default: reports/runs/<runId>/shots)
  --only <ids>      Comma-separated viewpoint ids or id prefixes
  --purpose <p>     Only viewpoints with this purpose (fidelity | art-direction)
  --viewpoints <p>  Alternative viewpoints file (default tools/harness/viewpoints.json)
  --entry <path>    HTML entry (default game/index.html)
  --url <url>       Load an already-served URL
  --seed <n>        Seed (default 1337)
  --settle <n>      Frames to step after posing the camera (default: per-viewpoint)
  --list            List the canonical viewpoints and exit
  --help            This message

OUTPUT
  <out>/<VPID>.png  one PNG per viewpoint at the contract resolution
  <out>/index.json  per-shot manifest: viewpoint config, sha256, run id, build info

CONTRACT
  Resolution, camera pose, time of day and weather are fixed by viewpoints.json. A shot
  taken at a pose not in that file is NOT admissible evidence in a fidelity verdict.

SELF-TEST (no game required)
  node tools/harness/shoot.mjs --entry tools/harness/stub/index.html --only VP01,VP02,VP09
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const vpFile = args.viewpoints ? path.resolve(String(args.viewpoints)) : VP_PATH;
if (!fs.existsSync(vpFile)) die(EXIT.INTERNAL, `viewpoints file missing: ${vpFile}`);
const vpDoc = readJson(vpFile);
let viewpoints = vpDoc.viewpoints || [];

if (args.list) {
  for (const v of viewpoints) process.stdout.write(`${v.id}\t${v.purpose}\t${v.note}\n`);
  process.exit(0);
}
if (args.only) {
  const want = String(args.only).split(',').map((s) => s.trim()).filter(Boolean);
  viewpoints = viewpoints.filter((v) => want.some((w) => v.id === w || v.id.startsWith(w)));
}
if (args.purpose) viewpoints = viewpoints.filter((v) => v.purpose === args.purpose);
if (!viewpoints.length) die(EXIT.USAGE, 'no viewpoints selected');

const cap = Object.assign({ width: 1920, height: 1080, settleFrames: 24 }, vpDoc.capture || {});
const seed = Number(args.seed || 1337);
const runId = makeRunId('shots', seed);
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, runId, 'shots');
ensureDir(outDir);

log(`shooting ${viewpoints.length} viewpoint(s) at ${cap.width}x${cap.height} -> ${outDir}`);

const handle = await launchGame({ ...args, width: cap.width, height: cap.height });
const shots = [];
try {
  const has = async (m) => handle.page.evaluate((x) => typeof (window.__HARNESS || {})[x] === 'function', m);
  if (!(await has('camera'))) {
    die(EXIT.HARNESS_ABSENT,
      'window.__HARNESS.camera() is required to take canonical screenshots (HARNESS.md §3/§6). ' +
      'Without a scriptable camera, fidelity verdicts cannot be reproduced.');
  }
  await handle.h('setSeed', seed);
  if (await has('setUIVisible')) await handle.h('setUIVisible', !cap.disableUI ? true : false);

  for (const v of viewpoints) {
    const t0 = Date.now();
    if (v.state || v.anchor) await handle.hOpt('loadState', v.state || v.anchor);
    if (v.world) {
      if (v.world.timeOfDay !== undefined) await handle.hOpt('setTimeOfDay', v.world.timeOfDay);
      if (v.world.weather !== undefined) await handle.hOpt('setWeather', v.world.weather);
    }
    for (const op of v.setup || []) {
      const fn = SETUP_OPS[op.op];
      if (fn) await fn(handle, op);
    }
    await handle.h('camera', v.camera);
    const settle = Number(args.settle ?? v.settleFrames ?? cap.settleFrames);
    if (settle > 0) await handle.hOpt('stepFrames', settle);
    await handle.hOpt('renderFrame');
    const file = path.join(outDir, `${v.id}.png`);
    await handle.page.screenshot({ path: file, type: 'png', animations: 'disabled', caret: 'hide' });
    const buf = fs.readFileSync(file);
    shots.push({
      id: v.id, purpose: v.purpose, file: path.basename(file), bytes: buf.length,
      sha256: sha256(buf), camera: v.camera, world: v.world || null,
      anchor: v.anchor || null, metrics: v.metrics || [], settle_frames: settle,
      ms: Date.now() - t0,
    });
    log(`  ${v.id} -> ${path.basename(file)} (${(buf.length / 1024).toFixed(0)} KiB)`);
  }
} finally {
  await handle.close();
}

const index = {
  schema: 'elder-souls/shots@1',
  run_id: runId,
  captured_at: new Date().toISOString(),
  capture: cap,
  viewpoints_file: vpFile,
  url: handle.url,
  harness_version: handle.harnessVersion,
  build: handle.buildInfo,
  git: gitInfo(),
  data: hashDataTree(),
  page_errors: handle.errors,
  shots,
};
writeJson(path.join(outDir, 'index.json'), index);
if (args.json) process.stdout.write(JSON.stringify(index, null, 2) + '\n');
else process.stdout.write(outDir + '\n');
process.exit(handle.errors.length ? EXIT.HARNESS_ERROR : EXIT.OK);
