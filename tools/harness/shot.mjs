#!/usr/bin/env node
/**
 * shot.mjs — one picture, one command, no ceremony.
 *
 *   node tools/harness/shot.mjs --viewpoint VP01
 *   node tools/harness/shot.mjs --viewpoint VP01 --time 6 --weather storm
 *   node tools/harness/shot.mjs --at 4210,9880 --yaw 135 --time 11
 *
 * Prints the path of a PNG and exits. It starts the shared capture daemon if it is not already
 * running (see tools/capture/server.mjs), so the FIRST call on a cold box pays a ~9 s boot and
 * every call after that — from this agent or any other — does not. A repeat of an identical
 * request is served from a build-keyed cache and costs milliseconds.
 *
 * WHAT THIS IS ADMISSIBLE FOR (ARBITRATION.md S34)
 *   This is a PLACED capture: it teleports and it poses the camera; nothing walks anywhere. Under
 *   S34(a) that is legitimate evidence of APPEARANCE — what a region looks like, whether two
 *   regions are distinguishable, whether an impact frame reads, whether a menu is legible.
 *   Under S34(b) it is NOT evidence of ARRIVAL, and the daemon will refuse to take the picture at
 *   all if you tell it the claim is about reachability, traversal, the crossing, RI-JRN*, or how
 *   long something takes. Every capture carries `arrival: "placed"`, the build sha and its settle
 *   proof in a sidecar .json; a verdict citing one for an arrival claim is VOID.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, die, log, EXIT, TOOLS_DIR, readJson } from '../lib/cli.mjs';
import { capture, serverStatus, ensureServer, CaptureError } from '../capture/client.mjs';

const USAGE = `
shot.mjs — one capture from the shared capture daemon. Prints a path.

USAGE
  node tools/harness/shot.mjs --viewpoint VP01 [--time <h>] [--weather <id>]
  node tools/harness/shot.mjs --at <x>,<z> [--yaw <deg>] [--pitch <deg>] [--eye <m>] [--fov <deg>]
  node tools/harness/shot.mjs --status | --start | --stop

WHERE
  --viewpoint <id>   a viewpoint id from tools/harness/viewpoints.json
  --viewpoints <f>   an alternative viewpoints file
  --at <x>,<z>       world coordinates; the player is teleported there and the camera set at eye height
  --yaw <deg>        compass yaw for --at (default 0)
  --pitch <deg>      downward pitch for --at (default 4.3, i.e. looking slightly down)
  --eye <m>          eye height for --at (default 1.7)
  --fov <deg>        field of view for --at (default 70)

CONDITIONS (all of them are part of the cache key)
  --time <h>         time of day, hours, 0-24
  --weather <id>     weather id, e.g. clear, storm, ashfall
  --tide <phase>     tide phase
  --width/--height   capture resolution (default 1920x1080, or the viewpoint's own)
  --state <name>     named save state to load (default: default)
  --seed <n>         simulation seed (default 1337)
  --ui               keep the HUD visible (default: stripped)

S34
  --evidence <kind>  appearance (default) | arrival. "arrival" is REFUSED — see S34(b).
  --claim <text>     what the picture is for. Checked: a claim naming RI-JRN*, reachability,
                     traversal, the crossing or a duration is refused however it is labelled.

OTHER
  --out <path>       also copy the PNG here
  --json             print the full capture manifest instead of just the path
  --no-cache         force a re-render (the result is still written to the cache)
  --status           print the daemon's status
  --start            start the daemon and exit
  --stop             stop the daemon
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

if (args.status) {
  try { process.stdout.write(JSON.stringify(await serverStatus(), null, 2) + '\n'); process.exit(0); }
  catch (e) { process.stdout.write(JSON.stringify({ running: false, reason: e.message }, null, 2) + '\n'); process.exit(1); }
}
if (args.start) { const r = await ensureServer(); log(r.started ? 'daemon started' : 'daemon already running'); process.exit(0); }
if (args.stop) {
  const { CaptureSession } = await import('../capture/client.mjs');
  const s = new CaptureSession();
  try { await s.connect(); await s.send('stop', {}); log('stopped'); } catch { log('not running'); } finally { s.close(); }
  process.exit(0);
}

// ---- build the spec ---------------------------------------------------------------------------
const spec = {
  evidence_of: args.evidence ? String(args.evidence) : 'appearance',
  claim: args.claim ? String(args.claim) : undefined,
  no_cache: !!args['no-cache'],
};

if (args.viewpoint) {
  const vpFile = args.viewpoints ? path.resolve(String(args.viewpoints)) : path.join(TOOLS_DIR, 'harness', 'viewpoints.json');
  if (!fs.existsSync(vpFile)) die(EXIT.INTERNAL, `viewpoints file missing: ${vpFile}`);
  const doc = readJson(vpFile);
  // Prefix match, exactly as shoot.mjs --only does: the ids are `VP01-vista-wide`, and asking for
  // `VP01` must work or the "one command, no ceremony" promise is a lie.
  const want = String(args.viewpoint);
  const cands = (doc.viewpoints || []).filter((x) => x.id === want || x.id.startsWith(want));
  if (!cands.length) die(EXIT.USAGE, `no viewpoint ${JSON.stringify(want)} in ${vpFile} (try --list on shoot.mjs)`);
  if (cands.length > 1 && !cands.some((x) => x.id === want)) {
    die(EXIT.USAGE, `--viewpoint ${JSON.stringify(want)} is ambiguous: ${cands.map((x) => x.id).join(', ')}`);
  }
  const v = cands.find((x) => x.id === want) || cands[0];
  const cap = Object.assign({ width: 1920, height: 1080, settleFrames: 24 }, doc.capture || {});
  spec.viewpoint = v.id;
  spec.viewpoints_file = path.relative(path.dirname(TOOLS_DIR), vpFile);
  spec.camera = v.camera;
  spec.state = v.state || v.anchor || undefined;
  if (v.world) { spec.time = v.world.timeOfDay; spec.weather = v.world.weather; }
  spec.width = Number(args.width || cap.width);
  spec.height = Number(args.height || cap.height);
  spec.settle_frames = Number(args.settle ?? v.settleFrames ?? cap.settleFrames);
} else if (args.at) {
  const [x, z] = String(args.at).split(',').map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(z)) die(EXIT.USAGE, '--at wants <x>,<z>');
  spec.place = { x, z };
  // A ground-relative pose: the daemon knows the terrain height, this process does not.
  spec.pose = {
    yaw_deg: Number(args.yaw || 0),
    pitch_deg: Number(args.pitch ?? 4.3),
    eye_m: Number(args.eye || 1.7),
    fov: Number(args.fov || 70),
  };
  spec.width = Number(args.width || 1280);
  spec.height = Number(args.height || 720);
} else {
  usage(USAGE, EXIT.USAGE);
}

if (args.time !== undefined) spec.time = Number(args.time);
if (args.weather !== undefined) spec.weather = String(args.weather);
if (args.tide !== undefined) spec.tide = String(args.tide);
if (args.state !== undefined) spec.state = String(args.state);
if (args.seed !== undefined) spec.seed = Number(args.seed);
if (args.ui) spec.ui = true;
if (args.width) spec.width = Number(args.width);
if (args.height) spec.height = Number(args.height);

// ---- ask ---------------------------------------------------------------------------------------
const t0 = Date.now();
let res;
try {
  res = await capture(spec);
} catch (e) {
  if (e instanceof CaptureError) {
    process.stderr.write(`[shot] REFUSED (${e.code})\n${e.message}\n`);
    if (e.detail) process.stderr.write(JSON.stringify(e.detail, null, 2) + '\n');
    process.exit(e.code === 'ARRIVAL_REFUSED' ? EXIT.USAGE : EXIT.MEASUREMENT_FAIL);
  }
  throw e;
}

if (args.out) {
  const out = path.resolve(String(args.out));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.copyFileSync(res.path, out);
  fs.writeFileSync(out.replace(/\.png$/, '') + '.capture.json', JSON.stringify(res, null, 2));
  res.copied_to = out;
}

log(`${res.cached ? 'CACHE HIT ' : 'rendered  '} ${Date.now() - t0} ms  settled=${res.settle.settled}  build=${res.build.build_key}`);
if (args.json) process.stdout.write(JSON.stringify(res, null, 2) + '\n');
else process.stdout.write((res.copied_to || res.path) + '\n');
process.exit(EXIT.OK);
