#!/usr/bin/env node
/**
 * reachability-walk.mjs — S9's "13/13 regions reachable on foot", as a WALK.
 *
 * Verdict W1-01 §6:
 *
 *   > The reachability claim does not survive as stated. `S9-NO-FENCES` is a grid flood fill over
 *   > cells with `depth <= 1.40 m` and `slope <= 40 deg`. It is not a walk, and the capsule was
 *   > never driven along it. … its own passability rule is what conceals the drowned road: a cell
 *   > under 65 m of water is "impassable" and simply drops out of the fill, while the road through
 *   > it is still a road. … "walk it" was my measurement, not the builder's.
 *
 * So the capsule walks it. A route is planned per region with A* over the field — but the route is
 * only a suggestion: what is reported is where the CAPSULE ended up, how far it moved, the longest
 * run of frames in which a held stick produced under 1 cm of travel, and the deepest water it
 * stood in on the way. A plan the body cannot follow shows up as `aborted: 'stuck'`, which is the
 * thing a flood fill is constitutionally unable to notice.
 *
 * Usage: node tools/world/reachability-walk.mjs [--out reports/reachability-walk.json]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WorldField } from '../../game/src/world/field.js';
import { launchGame } from '../lib/browser.mjs';

globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const argv = process.argv.slice(2);
const outFile = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'reports/reachability-walk.json';

const regionsDoc = rd('game/data/world/regions.json');
const scale = rd('corpus/50-world/world-scale.json');
const field = new WorldField(rd('game/data/world/terrain.json'), regionsDoc, rd('game/data/world/water.json'));
field.setRoads(rd('game/data/world/roads.json'));
const COLS = field.cols, ROWS = field.rows, CELL = field.cell;

// ---- plan: A* over ground the capsule can plausibly hold ------------------------------------------
// Deliberately NOT the flood fill's rule. Water is COSTED, not thresholded, and slope is costed
// too, so the planner will happily propose a route through shin-deep water — and the walk then
// says whether the body agrees.
//
// ROUND 4: WET SUCK IS COSTED TOO, and it has to be. RI-WLD10 §4's own sentence about the mire is
// that it is "survivable, expensive, and something a competent player WALKS AROUND". A planner
// that prices water and slope but treats sucking mud as free is not modelling a competent player;
// it is walking one into a bog and then reporting that the province is unreachable. It is a COST
// and not a threshold, so where mud is the only way through the route still takes it and the walk
// still says whether the body agrees — which is the whole design of this instrument.
const cost = new Float32Array(COLS * ROWS);
const PLAN_TIDE = 0.75;      // LOW. The tide is a real gate; "reachable on foot" is read at low water.
for (let z = 0; z < ROWS; z++) for (let x = 0; x < COLS; x++) {
  // Five probes per 25 m cell, and the BEST one wins: a 7 m causeway across a channel is a road a
  // player walks and a cell centre cannot see. This is the one thing the flood fill got right.
  let best = Infinity;
  for (const [ux, uz] of [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) {
    const px = x * CELL + ux * CELL, pz = z * CELL + uz * CELL;
    const d = field.depthAt(px, pz, PLAN_TIDE);
    const sl = field.slopeAt(px, pz, 12);
    const mud = field.substrateAt(px, pz) === 'SUCK' && d >= 0.01 ? 9 : 0;
    const c = sl > 45 || d > 1.35 ? Infinity : 1 + 0.25 * sl + 6 * d + mud;
    if (c < best) best = c;
  }
  cost[z * COLS + x] = best;
}
function plan(ax, az, bx, bz) {
  const s = Math.floor(az / CELL) * COLS + Math.floor(ax / CELL);
  const t = Math.floor(bz / CELL) * COLS + Math.floor(bx / CELL);
  const g = new Float64Array(COLS * ROWS).fill(Infinity);
  const prev = new Int32Array(COLS * ROWS).fill(-1);
  const closed = new Uint8Array(COLS * ROWS);
  const tx = t % COLS, tz = (t - tx) / COLS;
  const hp = [], hv = [];
  const push = (pri, val) => { hp.push(pri); hv.push(val); let i = hv.length - 1;
    while (i > 0) { const q = (i - 1) >> 1; if (hp[q] <= hp[i]) break; [hp[q], hp[i]] = [hp[i], hp[q]]; [hv[q], hv[i]] = [hv[i], hv[q]]; i = q; } };
  const pop = () => { const top = hv[0]; const lp = hp.pop(), lv = hv.pop();
    if (hv.length) { hp[0] = lp; hv[0] = lv; let i = 0;
      for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < hv.length && hp[l] < hp[m]) m = l;
        if (r < hv.length && hp[r] < hp[m]) m = r;
        if (m === i) break;
        [hp[m], hp[i]] = [hp[i], hp[m]]; [hv[m], hv[i]] = [hv[i], hv[m]]; i = m; } }
    return top; };
  push(0, s); g[s] = 0;
  while (hv.length) {
    const cur = pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === t) break;
    const cx = cur % COLS, cz = (cur - cx) / COLS;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= COLS || nz >= ROWS) continue;
      const ni = nz * COLS + nx;
      if (closed[ni] || !Number.isFinite(cost[ni])) continue;
      const ng = g[cur] + CELL * (dx && dz ? Math.SQRT2 : 1) * (cost[cur] + cost[ni]) / 2;
      if (ng < g[ni]) { g[ni] = ng; prev[ni] = cur; push(ng + Math.hypot(nx - tx, nz - tz) * CELL, ni); }
    }
  }
  if (prev[t] === -1 && t !== s) return null;
  const out = [];
  for (let i = t; i !== -1; i = prev[i]) { const x = i % COLS; out.push([x * CELL + CELL / 2, ((i - x) / COLS) * CELL + CELL / 2]); if (i === s) break; }
  out.reverse();
  out[0] = [ax, az]; out[out.length - 1] = [bx, bz];
  return out;
}

/** A target inside a region: the walkable point nearest its centroid, at any tide phase. */
function targetIn(r) {
  const [cx, cz] = r.centroid_m;
  let best = null, bd = Infinity;
  for (let a = 0; a < 900; a++) {
    const u = (a * 0.6180339887498949) % 1, v = (a * 0.3819660112501051 + 0.5) % 1;
    const x = r.bounds_m.x[0] + u * (r.bounds_m.x[1] - r.bounds_m.x[0]);
    const z = r.bounds_m.z[0] + v * (r.bounds_m.z[1] - r.bounds_m.z[0]);
    if (field.regionAt(x, z).id !== r.id || !field.isLandAt(x, z)) continue;
    if (field.depthAt(x, z, PLAN_TIDE) > 0.5 || field.slopeAt(x, z, 12) > 30) continue;
    const q = Math.hypot(x - cx, z - cz);
    if (q < bd) { bd = q; best = [x, z]; }
  }
  return best;
}

const START = [scale.settlements.Lilmoth.x, scale.settlements.Lilmoth.z];
const legs = [];
for (const r of regionsDoc.regions) {
  const t = targetIn(r);
  if (!t) { legs.push({ region: r.id, planned: false, reason: 'no walkable interior point found' }); continue; }
  const path = plan(START[0], START[1], t[0], t[1]);
  legs.push({ region: r.id, planned: !!path, target: [+t[0].toFixed(1), +t[1].toFixed(1)],
    planned_points: path ? path.length : 0, planned_m: path ? +path.reduce((a, p, i) => i ? a + Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]) : 0, 0).toFixed(1) : 0, path });
}

// ---- walk ------------------------------------------------------------------------------------------
const h = await launchGame({ width: 320, height: 180 });
const results = [];
try {
  await h.h('setSeed', 1337);
  await h.h('loadState', 'default');
  for (const l of legs) {
    if (!l.planned) { results.push({ region: l.region, planned: false, reason: l.reason, arrived: false }); continue; }
    const r = await h.page.evaluate(({ path }) => window.__HARNESS.walkPath(path, { speed: 'walk', maxFrames: 260000 }), { path: l.path });
    results.push({ region: l.region, planned: true, planned_m: l.planned_m, ...r, reached_region: r.regions_entered.includes(l.region) });
    process.stdout.write(`  ${l.region.padEnd(20)} ${r.arrived ? 'ARRIVED' : 'FAILED '} ${String(r.path_m).padStart(8)} m  ${String(r.minutes).padStart(7)} min  `
      + `offset ${String(r.offset_m).padStart(6)} m  longest stuck ${String(r.longest_stuck_frames).padStart(4)} f  deepest ${r.deepest_water_on_the_walk.depth_m} m\n`);
  }
} catch (e) { results.push({ error: String(e && e.stack) }); }
finally { await h.close(); }

const reached = results.filter((r) => r.arrived && r.reached_region);
const totalM = results.reduce((a, r) => a + (r.path_m || 0), 0);
const worstStuck = Math.max(0, ...results.map((r) => r.longest_stuck_frames || 0));
const deepest = Math.max(0, ...results.map((r) => (r.deepest_water_on_the_walk ? r.deepest_water_on_the_walk.depth_m : 0)));
const ok = reached.length === regionsDoc.regions.length && worstStuck < 900;
const doc = {
  schema: 'elder-souls/reachability-walk@1',
  method: 'S9 / RI-WLD01 — every region entered by driving the capsule, not by flooding a grid',
  measured_at: new Date().toISOString(),
  start: START, start_settlement: 'Lilmoth',
  regions_total: regionsDoc.regions.length, regions_walked_into: reached.length,
  total_walked_m: +totalM.toFixed(1), total_walked_min: +(totalM / 2 / 60).toFixed(1),
  longest_stuck_frames: worstStuck, deepest_water_stood_in_m: deepest,
  legs: results,
  pass: ok,
};
mkdirSync(dirname(join(ROOT, outFile)), { recursive: true });
writeFileSync(join(ROOT, outFile), JSON.stringify(doc, null, 1) + '\n');
process.stdout.write(`\n  [${ok ? 'PASS' : 'FAIL'}] S9-NO-FENCES-WALKED: ${reached.length}/${regionsDoc.regions.length} regions entered by the capsule; `
  + `${(totalM / 1000).toFixed(2)} km walked; longest stuck run ${worstStuck} frames; deepest water stood in ${deepest} m\n  ${outFile}\n`);
process.exit(ok ? 0 : 1);
