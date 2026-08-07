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
import { RUNS_DIR, GAME_DIR } from '../lib/cli.mjs';
import { CaptureSession, CaptureError } from '../capture/client.mjs';
import { REPO_ROOT as REPO_ROOT_FOR_KEY } from '../lib/cli.mjs';

/**
 * A viewpoint `setup` op, as the daemon's spec carries it. SETUP_OPS in tools/lib/run.mjs are
 * functions that take a live handle; the daemon needs the CALL, not the closure, because the call
 * has to go into the cache key. Ops with a direct harness equivalent are translated; anything else
 * is refused loudly rather than silently dropped, because a viewpoint whose setup was skipped is a
 * picture of the wrong thing.
 */
const SETUP_SKIPPED = [];
function SETUP_TO_OPS(op) {
  const table = {
    teleport: (o) => ['teleport', o.x, o.z, o.opts || {}],
    spawn: (o) => ['spawn', o.id, o.x, o.z, { as: o.as }],
    despawn: (o) => ['despawn', o.eid || o.as],
    aggro: (o) => ['aggro', o.target || o.eid || o.as],
    lockOn: (o) => ['lockOn', o.target || o.eid || o.as],
    loadState: (o) => ['loadState', o.state],
    setTimeOfDay: (o) => ['setTimeOfDay', o.hour ?? o.value],
    setWeather: (o) => ['setWeather', o.weather ?? o.value],
    camera: (o) => ['camera', o.pose || o],
    setCharacter: (o) => ['setCharacter', o.character || o],
    spawnEncounter: (o) => ['spawnEncounter', o.id, o.x, o.z, o.opts || {}],
    setStealthState: (o) => ['setStealthState', o.patch || o],
    setCrimeContext: (o) => ['setCrimeContext', o.context || o.value],
    spawnCivilian: (o) => ['spawnCivilian', o.civ || o],
    addLightSource: (o) => ['addLightSource', o.light || o],
    setBounty: (o) => ['setBounty', o.jurisdiction || 'imperial', o.n, o.settlement],
    setFactionStandings: (o) => ['setFactionStandings', o.standings || o],
  };
  if (table[op.op]) return table[op.op](op);
  // PARITY, not improvement. The direct path does `const fn = SETUP_OPS[op.op]; if (fn) ...` —
  // an op run.mjs does not implement is SILENTLY SKIPPED there, and viewpoints in this file
  // already carry four such ops (`state`, `spell`, `cast_on_frame`, `capture_at`). Refusing them
  // here would break viewpoints that currently produce a picture, which is not this piece's job.
  // So: skip exactly what the direct path skips, and RECORD the skip in index.json so a reader
  // can see the scene was not fully set up either way.
  if (!SETUP_OPS[op.op]) { SETUP_SKIPPED.push(op.op); return null; }
  die(EXIT.USAGE, `viewpoint setup op ${JSON.stringify(op.op)} is implemented by run.mjs but has ` +
    'no capture-service translation. Add one to SETUP_TO_OPS in tools/harness/shoot.mjs, or ' +
    're-run with --direct. Silently dropping it would produce a picture of a scene that was ' +
    'never set up.');
  return null;
}

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
  --direct          Boot a private browser instead of using the shared capture daemon
  --help            This message

CAPTURE BACKEND (ARBITRATION.md S34)
  By default these go through the shared capture daemon (tools/capture/server.mjs): one browser
  for the whole box, and a build-keyed cache, so a viewpoint already shot on this build costs
  milliseconds and a second agent asking for it costs nothing. Every frame comes back with a
  settle proof and arrival: "placed". These are captures of APPEARANCE and are admissible as
  such under S34(a); they are NOT evidence of arrival.
  --direct restores the private-browser path unchanged, for when the daemon cannot be reached
  or when you are debugging the harness itself.

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

// The daemon serves ONE entry point: game/index.html. `--url` and a non-default `--entry` are
// asking for a different page — the stub fixture in the self-test, or an already-served build —
// so they fall back to the private-browser path automatically rather than silently photographing
// the wrong thing. tools/run-all.mjs passes entryArgs through, and its harness self-test runs
// against tools/harness/stub/index.html; without this it would have started shooting the real
// game and reported a pass for a fixture it never loaded.
const DEFAULT_ENTRY = path.join(GAME_DIR, 'index.html');
const ALT_ENTRY = !!args.url || (args.entry && path.resolve(String(args.entry)) !== DEFAULT_ENTRY);
const DIRECT = !!args.direct || !!ALT_ENTRY;
if (ALT_ENTRY && !args.direct) log('non-default entry point: using a private browser, not the capture daemon');
const shots = [];
let handle = null, session = null;
let backendMeta = { backend: DIRECT ? 'direct' : 'service' };

if (DIRECT) {
  // ---- the original private-browser path, unchanged -------------------------------------------
  handle = await launchGame({ ...args, width: cap.width, height: cap.height });
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
        ms: Date.now() - t0, arrival: 'placed', settle_proof: null, served_from_cache: false,
      });
      log(`  ${v.id} -> ${path.basename(file)} (${(buf.length / 1024).toFixed(0)} KiB)`);
    }
  } finally {
    await handle.close();
  }
} else {
  // ---- the shared capture daemon (S34) ---------------------------------------------------------
  session = new CaptureSession();
  await session.connect();
  try {
    const st = await session.status();
    backendMeta = { backend: 'service', daemon_pid: st.pid, build_key: st.build && st.build.build_key, settle: st.settle };
    for (const v of viewpoints) {
      const t0 = Date.now();
      const settle = Number(args.settle ?? v.settleFrames ?? cap.settleFrames);
      const spec = {
        evidence_of: 'appearance',
        claim: `canonical viewpoint ${v.id}${v.purpose ? ' (' + v.purpose + ')' : ''}`,
        viewpoint: v.id,
        viewpoints_file: path.relative(REPO_ROOT_FOR_KEY, vpFile),
        state: v.state || v.anchor || undefined,
        seed,
        camera: v.camera,
        time: v.world && v.world.timeOfDay !== undefined ? v.world.timeOfDay : undefined,
        weather: v.world && v.world.weather !== undefined ? v.world.weather : undefined,
        width: cap.width, height: cap.height,
        ui: !cap.disableUI,
        settle_frames: settle,
        // A viewpoint's `setup` ops are replayed by the daemon in order, and they are part of the
        // cache key: two viewpoints that differ only in their setup must not share a picture.
        ops: (v.setup || []).map((op) => SETUP_TO_OPS(op)).filter(Boolean),
      };
      let res;
      try { res = await session.capture(spec); }
      catch (e) {
        if (e instanceof CaptureError) {
          die(EXIT.MEASUREMENT_FAIL, `viewpoint ${v.id} was REFUSED by the capture service (${e.code}): ${e.message}`,
            e.detail ? { detail: e.detail } : undefined);
        }
        throw e;
      }
      const file = path.join(outDir, `${v.id}.png`);
      fs.copyFileSync(res.path, file);
      const buf = fs.readFileSync(file);
      shots.push({
        id: v.id, purpose: v.purpose, file: path.basename(file), bytes: buf.length,
        sha256: sha256(buf), camera: v.camera, world: v.world || null,
        anchor: v.anchor || null, metrics: v.metrics || [], settle_frames: settle,
        ms: Date.now() - t0,
        // S34 provenance, carried into index.json alongside the picture it describes.
        arrival: res.provenance.arrival,
        served_from_cache: res.cached,
        settle_proof: res.settle,
        build_key: res.provenance.build_key,
        cache_key: res.cache_key,
      });
      log(`  ${v.id} -> ${path.basename(file)} (${(buf.length / 1024).toFixed(0)} KiB)${res.cached ? ' [cache]' : ''}`);
    }
  } finally { session.close(); }
}

const index = {
  schema: 'elder-souls/shots@1',
  run_id: runId,
  captured_at: new Date().toISOString(),
  viewpoints_file: vpFile,
  capture: cap,
  url: handle ? handle.url : null,
  harness_version: handle ? handle.harnessVersion : null,
  build: handle ? handle.buildInfo : null,
  capture_backend: backendMeta,
  setup_ops_skipped: [...new Set(SETUP_SKIPPED)],
  s34: {
    arrival: 'placed',
    ruling: 'ARBITRATION.md S34(a) — canonical viewpoints are evidence of APPEARANCE. A verdict ' +
      'citing one of these frames for an ARRIVAL claim is VOID.',
  },
  git: gitInfo(),
  data: hashDataTree(),
  page_errors: handle ? handle.errors : [],
  shots,
};
writeJson(path.join(outDir, 'index.json'), index);
if (args.json) process.stdout.write(JSON.stringify(index, null, 2) + '\n');
else process.stdout.write(outDir + '\n');
process.exit(handle && handle.errors.length ? EXIT.HARNESS_ERROR : EXIT.OK);
