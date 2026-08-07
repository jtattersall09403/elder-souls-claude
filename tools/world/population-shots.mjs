#!/usr/bin/env node
/**
 * population-shots.mjs — the before/after pair for the hostile population.
 *
 * Goes through `tools/capture/` (one warm browser for the whole box, build-keyed cache) rather
 * than launching a browser of its own, per AGENT-PROTOCOL §"Do not launch a browser for a
 * photograph". Two frames from the same camera at the same hour:
 *
 *   before — `setPopulation({enabled:false})`: the road as the world shipped it
 *   after  — the population system live: the same road with its posts resident
 *
 * ADMISSIBILITY (ARBITRATION S34). Both frames are PLACED — the camera is teleported and posed,
 * nothing walks. They are evidence of APPEARANCE only: what a populated stretch of road looks
 * like. The claim that the population materialises UNDER A WALKING PLAYER is an arrival claim and
 * is carried by `tools/world/population-consumption.mjs`, which walks it. Neither picture is
 * evidence for that and neither is declared as such.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir } from '../lib/cli.mjs';
import { capture } from '../capture/client.mjs';

const USAGE = `population-shots.mjs — before/after frames of a populated stretch of road
  --at <x>,<z>     camera position   (default 3196,4620 — the densest road stretch)
  --yaw <deg>      compass yaw       (default 180, looking down the run of the road)
  --time <h>       hour of day       (default 9)
  --width/--height resolution        (default 1280x720)
  --out-dir <d>    where the PNGs land (default docs/shots)`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

const AT = String(args.at || '3196,4620').split(',').map(Number);
const YAW = Number(args.yaw === undefined ? 180 : args.yaw);
const TIME = Number(args.time === undefined ? 9 : args.time);
const W = Number(args.width || 1280);
const H = Number(args.height || 720);
const OUT_DIR = path.resolve(String(args['out-dir'] || path.join(REPO_ROOT, 'docs', 'shots')));
ensureDir(OUT_DIR);

const DATE = new Date().toISOString().slice(0, 10);

/**
 * The two specs differ by ONE harness op and nothing else — same camera, same hour, same
 * weather, same state — so the difference in the frames is the population and not the light.
 */
const base = {
  evidence_of: 'composition',
  place: { x: AT[0], z: AT[1] },
  // EYE HEIGHT IS 11 m, NOT 1.7 m, AND THAT IS THE WHOLE LESSON OF THE FIRST PAIR: at standing
  // height on a road this world scatters with real vegetation, the first frame was 90% the
  // inside of a bush. The subject here is a STRETCH of road and the spacing of what stands
  // beside it, which is a thing you have to be above to see at all.
  pose: { yaw_deg: YAW, pitch_deg: Number(args.pitch === undefined ? 16 : args.pitch), eye_m: Number(args.eye || 11), fov: 70 },
  time: TIME, weather: 'clear',
  width: W, height: H, ui: false,
};

const ONLY = String(args.only || 'both');
const allSpecs = [
  {
    key: 'after',
    name: `${DATE}-population-road-after-populated.png`,
    spec: {
      ...base,
      claim: 'how a stretch of trunk highway is composed with the hostile population resident beside it — two posts, eight bodies, at the density the model sets for a tier-2 region',
      ops: [['setPopulation', { enabled: true, reset: true }]],
    },
  },
  {
    key: 'before',
    name: `${DATE}-population-road-before-empty.png`,
    spec: {
      ...base,
      claim: 'how the same stretch of trunk highway is composed with the hostile population system switched off — the empty frame, for comparison with the populated one',
      ops: [['setPopulation', { enabled: false, reset: true }]],
    },
  },
];
// The populated frame is the deliverable and is taken FIRST; the empty comparison frame is a
// bonus. On a box carrying thirty concurrent browsers a 1280x720 capture queues for many
// minutes, and a run that renders the optional frame first is a run that ships neither.
const specs = ONLY === 'both' ? allSpecs : allSpecs.filter((s) => s.key === ONLY);

(async () => {
  const out = [];
  for (const { name, spec } of specs) {
    log(`capturing ${name} …`);
    const shot = await capture(spec);
    const dest = path.join(OUT_DIR, name);
    fs.copyFileSync(shot.path, dest);
    // Carry the sidecar across too: a frame without its settle proof and its arrival stamp is a
    // frame nobody downstream can check.
    const side = shot.path.replace(/\.png$/, '.json');
    if (fs.existsSync(side)) fs.copyFileSync(side, dest.replace(/\.png$/, '.json'));
    out.push({ name, dest: path.relative(REPO_ROOT, dest), cached: shot.cached, arrival: shot.provenance && shot.provenance.arrival });
    log(`  -> ${path.relative(REPO_ROOT, dest)} (cached: ${shot.cached})`);
  }
  console.log(JSON.stringify({ at: AT, yaw: YAW, time: TIME, shots: out }, null, 2));
})();
