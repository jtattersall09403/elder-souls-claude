#!/usr/bin/env node
/**
 * crossing-body.mjs — A BODY WALKS FROM STORMHOLD TO LILMOTH. NOT A SOLVER, NOT A FLOOD FILL.
 *
 * Written for W1-CROSSING because §P.4 of the playable gate asks for three numbers — distance,
 * frames and in-world time — that nobody in this project has ever produced from an end-to-end walk.
 * Every "crossing" figure published so far came from a path solver, or from a walker that stopped
 * early and reported the metres it had managed. This tool exists to be unable to do that: it walks
 * with `walkRoute`, with settlement collision ON, and it **writes its artifact after every chunk**,
 * so a run killed by a timeout still leaves the distance it had reached on disk. (A walker that
 * wrote only at the end produced no artifact at all when it was killed at 25 minutes.)
 *
 * It is not a second copy of `tools/world/crossing.mjs`. That tool is W1-01-r4's, it computes
 * RI-WLD01 M2/M3's checks, and it writes once at the end. This one adds the three things
 * W1-CROSSING needs and it does not restate M2/M3:
 *
 *   - incremental artifacts, so a long walk is resumable evidence rather than all-or-nothing;
 *   - the H1 census — how far the body ever strays from the road, how long it spends off it, and
 *     **how many times it gets back on** — read straight off the shipped `walkRoute` return, so
 *     the count is a property of the engine and not of this file;
 *   - `--shot`, which puts a picture of wherever the body has got to next to the number.
 *
 * Usage:
 *   node tools/world/crossing-body.mjs                       # THE CROSSING, walking, walls in
 *   node tools/world/crossing-body.mjs --route long_way --speed jog
 *   node tools/world/crossing-body.mjs --budget-min 25        # wall-clock budget, then report
 *   node tools/world/crossing-body.mjs --shot docs/shots/x.png --shot-at-m 560
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, REPO_ROOT, ensureDir, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `crossing-body.mjs — a body walks the route, end to end.
  --route <id>        crossing | long_way            (default crossing)
  --speed <s>         walk | jog                     (default walk)
  --out <file>        default reports/w1-crossing/crossing-body.json
  --budget-min <n>    wall-clock minutes before giving up and reporting (default 40)
  --chunk <n>         frames per chunk (default 20000)
  --stall-frames <n>  give up after this many frames of no route progress (default 12000)
  --no-town-solids    take the settlement walls out (the control arm)
  --shot <png>        screenshot at --shot-at-m, or at the end if not given
  --shot-at-m <m>     take the shot the first chunk past this many metres`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const ROUTE = String(args.route || 'crossing');
const SPEED = String(args.speed || 'walk');
const OUT = path.resolve(String(args.out || path.join(REPO_ROOT, 'reports/w1-crossing/crossing-body.json')));
const BUDGET_MS = Number(args['budget-min'] || 40) * 60_000;
const CHUNK = Number(args.chunk || 20000);
const STALL = Number(args['stall-frames'] || 12000);
const NO_SOLIDS = !!args['no-town-solids'];
const SHOT = args.shot ? path.resolve(String(args.shot)) : null;
const SHOT_AT = args['shot-at-m'] === undefined ? null : Number(args['shot-at-m']);
ensureDir(path.dirname(OUT));

const doc = {
  schema: 'elder-souls/crossing-body@1',
  measured_at: new Date().toISOString(), git: gitInfo(),
  route: ROUTE, speed: SPEED, town_solids: !NO_SOLIDS,
  budget_min: BUDGET_MS / 60000, chunk_frames: CHUNK, stall_frames: STALL,
  state: 'starting', chunks: [], result: null, shot: null,
};
const flush = () => fs.writeFileSync(OUT, JSON.stringify(doc, null, 2) + '\n');
flush();

const t0 = Date.now();
const handle = await launchGame({ ...args, width: 960, height: 540 });
let shotTaken = false;
try {
  await handle.h('setSeed', 1337);
  await handle.h('loadState', 'default');
  await handle.h('setTide', 'LOW');
  if (NO_SOLIDS) log(`town solids OFF: ${JSON.stringify(await handle.h('__w1_04_townSolids', false))}`);
  doc.world = await handle.h('getWorldStats');
  doc.declared_route = (await handle.h('getRoutes')).named_routes[ROUTE];
  doc.state = 'walking';
  flush();

  let r = await handle.h('walkRoute', { route: ROUTE, speed: SPEED, restart: true, chunkFrames: 1 });
  let stalled = 0, guard = 0;
  while (!r.done && guard++ < 400) {
    const before = { m: r.path_m, left: r.remaining_points };
    r = await handle.h('walkRoute', { route: ROUTE, speed: SPEED, chunkFrames: CHUNK });
    doc.chunks.push({ t_s: +((Date.now() - t0) / 1000).toFixed(1), frames: r.frames, path_m: r.path_m,
      minutes: r.minutes, remaining_points: r.remaining_points, worst_off_path_m: r.worst_off_path_m,
      off_path_frames: r.off_path_frames, regains: r.regains });
    doc.result = r;
    flush();
    log(`  ${r.minutes.toFixed(2)} in-world min · ${r.path_m.toFixed(0)} m · ${r.remaining_points} pts left · `
      + `off-path worst ${r.worst_off_path_m} m, ${r.off_path_frames} f, ${r.regains} regains`);
    if (SHOT && !shotTaken && (SHOT_AT === null ? false : r.path_m >= SHOT_AT)) {
      ensureDir(path.dirname(SHOT));
      await handle.page.screenshot({ path: SHOT });
      doc.shot = { path: path.relative(REPO_ROOT, SHOT), at_m: r.path_m, frames: r.frames };
      shotTaken = true; flush();
      log(`  shot at ${r.path_m.toFixed(0)} m -> ${SHOT}`);
    }
    // ROUTE PROGRESS, NOT DISTANCE. A body orbiting a waypoint racks up path length as fast as a
    // body crossing a province; only `remaining_points` falling is progress.
    if (r.remaining_points >= before.left) {
      stalled += CHUNK;
      if (stalled >= STALL) {
        const p = await handle.h('getPlayerStats');
        doc.stalled = {
          flavour: r.path_m - before.m < 1 ? 'pinned (no travel, no progress)' : 'orbiting (travelling, no progress)',
          at_m: r.path_m, after_frames: r.frames, pos: [+p.pos[0].toFixed(1), +p.pos[2].toFixed(1)],
          terrain: await handle.h('getTerrainAt', p.pos[0], p.pos[2]),
          water: await handle.h('getWaterAt', p.pos[0], p.pos[2]),
          settlement_solids: await handle.h('getSettlementSolids'),
          traversal: await handle.h('getTraversalReport'),
        };
        doc.state = 'stalled'; flush();
        log(`  STALLED at ${r.path_m.toFixed(1)} m — ${JSON.stringify(doc.stalled.pos)}`);
        break;
      }
    } else stalled = 0;
    if (Date.now() - t0 > BUDGET_MS) { doc.state = 'out-of-budget'; flush(); log('  wall-clock budget spent'); break; }
  }
  if (r.done) doc.state = 'arrived';
  doc.result = r;
  if (SHOT && !shotTaken) {
    ensureDir(path.dirname(SHOT));
    await handle.page.screenshot({ path: SHOT });
    doc.shot = { path: path.relative(REPO_ROOT, SHOT), at_m: r.path_m, frames: r.frames };
    flush();
  }
  doc.player_end = await handle.h('getPlayerStats');
} catch (e) {
  doc.state = 'threw'; doc.error = String(e && e.stack || e); flush(); throw e;
} finally {
  doc.wall_clock_s = +((Date.now() - t0) / 1000).toFixed(1);
  flush();
  await handle.close();
}

const r = doc.result || {};
console.log(`\n${ROUTE} at ${SPEED}, settlement collision ${NO_SOLIDS ? 'OFF' : 'ON'} — ${doc.state}`);
console.log(`  distance      ${r.path_m} m   (declared ${doc.declared_route && doc.declared_route.metres} m)`);
console.log(`  frames        ${r.frames}`);
console.log(`  in-world time ${r.minutes} min  (${r.seconds} s at 60 Hz)`);
console.log(`  off the road  worst ${r.worst_off_path_m} m, ${r.off_path_frames} frames off, ${r.regains} regains`);
console.log(`  ${OUT}`);
process.exit(doc.state === 'arrived' ? 0 : 1);
