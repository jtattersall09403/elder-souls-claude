#!/usr/bin/env node
/**
 * crossing.mjs — RI-WLD01 M2 (the traversal budget) and M3 (the speed-honesty check).
 *
 * Walks the canonical crossing — Stormhold south gate to Lilmoth harbour steps, via Helstrom and
 * Blackrose — on foot, at 2.0 m/s, through the game's own locomotion, and reports the elapsed
 * simulated time, the integrated path length, and the distribution of instantaneous ground speed.
 *
 * M3 is the check this tool exists for. The bar is not "the walk took an hour"; it is "the hour
 * came from distance". A world that manufactures the hour out of mud, stair-catching and collision
 * snagging shows it as a tail of sub-1.6 m/s samples, and RI-WLD01 fails at 8%.
 *
 * Usage:
 *   node tools/world/crossing.mjs                          # walk, then jog, then the long way
 *   node tools/world/crossing.mjs --route crossing --speed walk --out reports/crossing.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, REPO_ROOT, ensureDir, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `crossing.mjs — RI-WLD01 M2/M3.
  --route <id>   crossing | long_way   (default: both, at walk and jog)
  --speed <s>    walk | jog
  --out <file>   default reports/crossing.json`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outFile = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports', 'crossing.json')));
ensureDir(path.dirname(outFile));

const plan = args.route
  ? [{ route: String(args.route), speed: String(args.speed || 'walk') }]
  : [{ route: 'crossing', speed: 'walk' }, { route: 'crossing', speed: 'jog' }, { route: 'long_way', speed: 'walk' }];

const handle = await launchGame({ ...args, width: 640, height: 360 });
const results = [];
try {
  await handle.h('setSeed', 1337);
  await handle.h('loadState', 'default');
  await handle.h('setTide', 'LOW');            // the tideway is a road at low water (RI-TRV01)
  const routes = await handle.h('getRoutes');
  for (const step of plan) {
    log(`walking ${step.route} at ${step.speed} ...`);
    let r = await handle.h('walkRoute', { route: step.route, speed: step.speed, restart: true, chunkFrames: 1 });
    let guard = 0;
    while (!r.done && guard++ < 400) {
      r = await handle.h('walkRoute', { route: step.route, speed: step.speed, chunkFrames: 30000 });
      log(`  ${r.minutes.toFixed(2)} min, ${r.path_m.toFixed(0)} m, ${r.remaining_points} points left`);
    }
    results.push(r);
  }
  var world = await handle.h('getWorldStats');
  var province = await handle.h('getProvinceStats');
  var routesDoc = routes;
} finally { await handle.close(); }

const BARS = {
  crossing_walk_min: [52, 65], crossing_m: [6300, 7600], crossing_jog_min: [33, 41],
  m3_frac_below_1_6_max: 0.08,
};
const walk = results.find((r) => r.route === 'crossing' && r.speed === 'walk');
const jog = results.find((r) => r.route === 'crossing' && r.speed === 'jog');
const checks = [];
const check = (id, ok, detail) => checks.push({ id, pass: !!ok, detail });
if (walk) {
  check('M2-TIME', walk.minutes >= BARS.crossing_walk_min[0] && walk.minutes <= BARS.crossing_walk_min[1],
    `${walk.minutes} min walking, bar ${BARS.crossing_walk_min.join('-')}`);
  check('M2-DISTANCE', walk.path_m >= BARS.crossing_m[0] && walk.path_m <= BARS.crossing_m[1],
    `${walk.path_m} m integrated, bar ${BARS.crossing_m.join('-')}`);
  check('M3-SPEED-HONESTY', walk.frac_samples_below_1_6 <= BARS.m3_frac_below_1_6_max,
    `${(walk.frac_samples_below_1_6 * 100).toFixed(3)}% of ${walk.speed_samples} ground-speed samples below 1.6 m/s, bar <= 8%`);
  check('M3-MEAN-SPEED', Math.abs(walk.mean_speed_mps - 2.0) < 0.05,
    `mean ground speed ${walk.mean_speed_mps} m/s (walk_mps is 2.0 — the hour is distance, not friction)`);
}
if (jog) check('M2-JOG', jog.minutes >= BARS.crossing_jog_min[0] && jog.minutes <= BARS.crossing_jog_min[1],
  `${jog.minutes} min jogging, bar ${BARS.crossing_jog_min.join('-')}`);

const doc = {
  schema: 'elder-souls/crossing@1', method: 'RI-WLD01 M2 + M3',
  measured_at: new Date().toISOString(), git: gitInfo(),
  world: { areaKm2: world.areaKm2, worldBoundsM: world.worldBoundsM, elevationRangeM: world.elevationRangeM, roadNetworkM: world.roadNetworkM },
  declared: { crossing_m: 6909, crossing_walk_min: 57.6, crossing_jog_min: 36.0, long_way_walk_min: 79.0 },
  built_routes: routesDoc.named_routes,
  runs: results, checks,
  ok: checks.every((c) => c.pass),
};
fs.writeFileSync(outFile, JSON.stringify(doc, null, 2) + '\n');
process.stdout.write(`\nRI-WLD01 M2/M3 — the traversal budget\n`);
for (const r of results) {
  process.stdout.write(`  ${r.route.padEnd(10)} ${r.speed.padEnd(5)}  ${String(r.minutes).padStart(7)} min  ${String(r.path_m).padStart(8)} m  `
    + `mean ${r.mean_speed_mps} m/s  min ${r.min_speed_mps}  below 1.6 m/s: ${(r.frac_samples_below_1_6 * 100).toFixed(3)}%\n`);
}
process.stdout.write('\n');
for (const c of checks) process.stdout.write(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.id}: ${c.detail}\n`);
process.stdout.write(`\n${outFile}\n`);
process.exit(doc.ok ? EXIT.OK : 1);
