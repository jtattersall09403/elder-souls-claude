#!/usr/bin/env node
/**
 * w1-01-r4-soulrest-leg.mjs — the body-walk on `soulrest-blackrose`, for W1-05.
 *
 * WHY. `orchestration/status/W1-05.json`'s reachability proof has been stuck for a session on a
 * drowning defect near `soulrest-blackrose`. Three independent body-walk attempts have failed and
 * converged on the same water. Depth, tide and current have each been exonerated, and the leading
 * hypothesis is population streaming near hostile posts moving bodies while the walker is in
 * water.
 *
 * W1-01 round 4 found something cheaper that has never been tested against it: the
 * `soulrest-blackrose` leg passes through THREE building footprints — `soulrest-grey-hist`,
 * `blackrose-pawn` and `blackrose-rootpost` (see `reports/road-through-building.json`) — and a
 * building wall stops the player capsule dead. On THE CROSSING that mechanism pinned a body 39 m
 * into a 6,816 m route for 60,001 frames.
 *
 * The three buildings sit on DRY ground (0.00 m of water at low, mid and high tide), so this is
 * not itself a drowning. But a body that cannot pass a wall is a body that stops, and where it
 * stops next to water is where a walker with a breath clock dies. So the question this answers is
 * narrow and useful: **walk the leg both ways, with the town walls in and with them out, and say
 * where the body stops and whether it is in water when it does.**
 *
 * ARMS (one browser, same loaded world):
 *   A  walls on,  Soulrest -> Blackrose        C  walls on,  Blackrose -> Soulrest
 *   B  walls off, Soulrest -> Blackrose        D  walls off, Blackrose -> Soulrest
 *
 * Both directions, because a wall is not symmetric: the body meets a different face of it.
 *
 * Usage: node tools/world/w1-01-r4-soulrest-leg.mjs [--frames 120000] [--out reports/w1-01-r4/soulrest-leg.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { launchGame } from '../lib/browser.mjs';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const OUT = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'reports/w1-01-r4/soulrest-leg.json';
const FRAMES = argv.includes('--frames') ? Number(argv[argv.indexOf('--frames') + 1]) : 120000;
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const git = (() => {
  try { const q = (c) => execSync(c, { cwd: ROOT }).toString().trim();
    return { commit: q('git rev-parse HEAD'), branch: q('git rev-parse --abbrev-ref HEAD'), dirty: q('git status --porcelain').length > 0 };
  } catch { return null; }
})();

const roads = rd('game/data/world/roads.json');
const leg = roads.legs.find((l) => l.id === 'soulrest-blackrose' || l.id === 'blackrose-soulrest');
if (!leg) throw new Error('no soulrest<->blackrose leg in roads.json — retarget this probe');
const fwd = leg.points.map((p) => [p[0], p[1]]);
const rev = fwd.slice().reverse();
let legM = 0; for (let i = 1; i < fwd.length; i++) legM += Math.hypot(fwd[i][0] - fwd[i - 1][0], fwd[i][1] - fwd[i - 1][1]);

const handle = await launchGame({ width: 320, height: 180 });
const arms = [];
try {
  await handle.h('setSeed', 1337);
  await handle.h('loadState', 'default');
  await handle.h('setTide', 'LOW');

  const run = async (label, points, wallsOn) => {
    await handle.h('loadState', 'default');
    await handle.h('setTide', 'LOW');
    await handle.h('__w1_04_townSolids', wallsOn);
    const r = await handle.page.evaluate(({ pts, maxFrames }) =>
      window.__HARNESS.walkPath(pts, { speed: 'walk', maxFrames }), { pts: points, maxFrames: FRAMES });
    const p = await handle.h('getPlayerStats');
    const w = await handle.h('getWaterAt', p.pos[0], p.pos[2]);
    const sol = await handle.h('getSettlementSolids');
    const row = {
      arm: label, walls: wallsOn,
      arrived: !!r.arrived, aborted: r.aborted ?? null,
      frames: r.frames, minutes: +(r.frames / 3600).toFixed(3),
      path_m: +(r.path_m ?? r.dist ?? 0).toFixed(1), leg_m: +legM.toFixed(1),
      longest_stuck_frames: r.longest_stuck_frames ?? r.worst_stuck ?? null,
      mired_frames: r.mired_frames ?? null,
      deepest_water_m: r.deepest && r.deepest.depth_m !== undefined ? r.deepest.depth_m : (r.deepest_water_stood_in_m ?? null),
      stopped_at: [+p.pos[0].toFixed(1), +p.pos[2].toFixed(1)],
      // The question W1-05 needs answering: is the body IN water where it stopped, and is it dead.
      stopped_in_water_m: w.depth_m, stopped_water_band: p.water_band,
      breath_s: p.breath_s, breath_max_s: p.breath_max_s, submerged: p.submerged,
      hp: p.hp, state: p.state, drowned: p.hp <= 0 || p.state === 'DEATH',
      settlement_solids_at_stop: sol.shapes, inside_a_building: sol.inside_a_building,
      regions_visited: r.regions_visited ?? r.visited ?? null,
    };
    arms.push(row);
    process.stdout.write(`${label.padEnd(30)} walls=${wallsOn ? 'on ' : 'off'}  arrived=${row.arrived ? 'YES' : 'no '}  `
      + `${String(row.path_m).padStart(8)} m of ${row.leg_m}  stopped ${JSON.stringify(row.stopped_at)}  `
      + `water ${row.stopped_in_water_m} m (${row.stopped_water_band})  hp ${row.hp}  ${row.drowned ? 'DROWNED' : ''}\n`);
    return row;
  };

  await run('A soulrest->blackrose', fwd, true);
  await run('B soulrest->blackrose', fwd, false);
  await run('C blackrose->soulrest', rev, true);
  await run('D blackrose->soulrest', rev, false);
} finally { await handle.close(); }

const wallsOn = arms.filter((a) => a.walls), wallsOff = arms.filter((a) => !a.walls);
const doc = {
  schema: 'w1-01/soulrest-leg@1', measured_at: new Date().toISOString(), git,
  for: 'orchestration/status/W1-05.json — the standing drowning defect near soulrest-blackrose',
  leg: leg.id, leg_m: +legM.toFixed(1), frames_cap: FRAMES,
  buildings_on_this_leg: ['soulrest-grey-hist', 'blackrose-pawn', 'blackrose-rootpost'],
  arms,
  findings: {
    any_arm_arrived: arms.some((a) => a.arrived),
    any_arm_drowned: arms.some((a) => a.drowned),
    any_arm_stopped_in_water: arms.some((a) => a.stopped_in_water_m > 0.05),
    walls_change_the_answer: wallsOn.some((a, i) => wallsOff[i] && Math.abs(a.path_m - wallsOff[i].path_m) > 5),
    mean_path_walls_on: +(wallsOn.reduce((s, a) => s + a.path_m, 0) / Math.max(1, wallsOn.length)).toFixed(1),
    mean_path_walls_off: +(wallsOff.reduce((s, a) => s + a.path_m, 0) / Math.max(1, wallsOff.length)).toFixed(1),
  },
};
fs.mkdirSync(path.dirname(path.join(ROOT, OUT)), { recursive: true });
fs.writeFileSync(path.join(ROOT, OUT), JSON.stringify(doc, null, 1) + '\n');
process.stdout.write(`\n${JSON.stringify(doc.findings, null, 1)}\n  ${OUT}\n`);
