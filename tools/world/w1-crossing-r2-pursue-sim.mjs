#!/usr/bin/env node
/**
 * w1-crossing-r2-pursue-sim.mjs — `_pursue` ON ITS OWN, WITH NO WORLD UNDER IT.
 *
 * `stormhold-helstrom` walked FORWARDS arrives in 2,784.8 m. Walked BACKWARDS the same body walks
 * **3,393.7 m of a 2,827.9 m leg and never gets there** — never more than 3.27 m off the
 * centreline, zero frames off the road, zero water, zero teleports, longest stall 701 frames. It
 * is not drowning, not falling, not blocked: the slope gate and the slide are both skipped
 * outright when `onRoad` is true (`sim/traversal.js` §3 and §6), and the body is on the road the
 * whole time.
 *
 * So the suspect is the STEERING, and the way to convict or acquit it is to run it with nothing
 * else attached. This file transcribes `Engine._pursue` verbatim and drives a KINEMATIC body — a
 * point that moves at exactly `speed / 60` metres per frame straight at whatever target `_pursue`
 * returns, with no terrain, no collision, no gravity, no parapet, no signature landform and no
 * slope gate. If the walk fails here it is the pursuit loop, because there is nothing else left.
 *
 * Both directions of every leg, and `--fix <name>` swaps in a candidate repair so the two can be
 * compared on the identical fixture.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const ARGV = process.argv.slice(2);
const argOf = (f, d) => (ARGV.includes(f) ? ARGV[ARGV.indexOf(f) + 1] : d);
const OUT = String(argOf('--out', 'reports/w1-crossing-r2/pursue-sim.json'));
const ROADS = String(argOf('--roads', 'game/data/world/roads.json'));
const FIX = String(argOf('--fix', 'none'));
const MAXF = Number(argOf('--max-frames', 400000));
const LOOKAHEAD = Number(argOf('--lookahead', 4.5));
const ARRIVE = Number(argOf('--arrive', 3.0));
const WINDOW = Number(argOf('--window', 150));

/**
 * `game/src/engine.js` `_pursue`, transcribed. `pos` replaces `this.sim.player.pos`.
 *
 * `fix = 'nearest-window'`: the candidate repair. The search window is measured in ARC LENGTH from
 * the cursor, which on a leg whose sinuosity solve produced a 12 m sawtooth puts a dozen limbs of
 * the same zigzag inside it — and `st.seg` is monotonic, so ONE frame in which a later limb is
 * marginally nearer moves the cursor there permanently. The repair keeps the arc window for
 * PROGRESS but refuses a cursor jump of more than `maxSegJump` segments in a single frame unless
 * the body is genuinely nearer to it by a margin.
 */
function pursue(pts, st, lookahead, arrive, pos, fix) {
  const px = pos[0], pz = pos[1];
  const n = pts.length - 1;
  let bestSeg = Math.min(st.seg, n - 1), bestU = 0, bestD = Infinity, span = 0;
  let curD = Infinity;
  for (let j = Math.min(st.seg, n - 1); j < n; j++) {
    const ax = pts[j][0], az = pts[j][1];
    const dx = pts[j + 1][0] - ax, dz = pts[j + 1][1] - az;
    const L2 = dx * dx + dz * dz || 1;
    const u = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2));
    const d = Math.hypot(px - (ax + dx * u), pz - (az + dz * u));
    if (j <= st.seg + 1) curD = Math.min(curD, d);
    if (fix === 'nearest-window' && j > st.seg + 2 && !(d < curD - 0.75)) { span += Math.sqrt(L2); if (span > WINDOW) break; continue; }
    if (d < bestD) { bestD = d; bestSeg = j; bestU = u; }
    span += Math.sqrt(L2);
    if (span > WINDOW) break;
  }
  st.seg = bestSeg;
  let remaining = 0;
  {
    const ax = pts[bestSeg][0], az = pts[bestSeg][1];
    remaining += Math.hypot(pts[bestSeg + 1][0] - ax, pts[bestSeg + 1][1] - az) * (1 - bestU);
    for (let j = bestSeg + 1; j < n; j++) remaining += Math.hypot(pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]);
  }
  let forward = Math.max(1.0, lookahead - bestD);
  let seg = bestSeg, u = bestU;
  while (forward > 0 && seg < n) {
    const L = Math.hypot(pts[seg + 1][0] - pts[seg][0], pts[seg + 1][1] - pts[seg][1]) || 1;
    const room = L * (1 - u);
    if (room >= forward) { u += forward / L; forward = 0; break; }
    forward -= room; seg++; u = 0;
  }
  if (seg >= n) { seg = n - 1; u = 1; }
  const tx = pts[seg][0] + (pts[seg + 1][0] - pts[seg][0]) * u;
  const tz = pts[seg][1] + (pts[seg + 1][1] - pts[seg][1]) * u;
  const endD = Math.hypot(px - pts[n][0], pz - pts[n][1]);
  return { seg: bestSeg, off_m: bestD, target: [tx, tz], remaining_m: remaining,
    done: remaining <= arrive && endD <= Math.max(arrive, lookahead) };
}

/** A point that walks at `speed` straight at the target. No terrain, no collision, no anything. */
function walk(points, fix, speed = 2.0) {
  const st = { seg: 0 };
  const pos = [points[0][0], points[0][1]];
  const per = speed / 60;
  let frames = 0, dist = 0, worstOff = 0, cursorJumps = 0, biggestJump = 0, stall = 0, worstStall = 0;
  const revisits = new Map();
  while (frames < MAXF) {
    const before = st.seg;
    const pur = pursue(points, st, LOOKAHEAD, ARRIVE, pos, fix);
    if (st.seg - before > 1) { cursorJumps++; biggestJump = Math.max(biggestJump, st.seg - before); }
    if (pur.off_m > worstOff) worstOff = pur.off_m;
    if (pur.done) return { arrived: true, frames, path_m: +dist.toFixed(1), worst_off_m: +worstOff.toFixed(2),
      cursor_jumps: cursorJumps, biggest_cursor_jump: biggestJump, worst_stall_frames: worstStall, end: pos.map((v) => +v.toFixed(1)) };
    const dx = pur.target[0] - pos[0], dz = pur.target[1] - pos[1];
    const d = Math.hypot(dx, dz) || 1;
    const stepX = dx / d * Math.min(per, d), stepZ = dz / d * Math.min(per, d);
    const moved = Math.hypot(stepX, stepZ);
    pos[0] += stepX; pos[1] += stepZ;
    dist += moved; frames++;
    if (moved < 0.005) { stall++; worstStall = Math.max(worstStall, stall); } else stall = 0;
    const key = `${Math.round(pos[0])},${Math.round(pos[1])}`;
    revisits.set(key, (revisits.get(key) || 0) + 1);
  }
  let hot = null;
  for (const [k, v] of revisits) if (!hot || v > hot[1]) hot = [k, v];
  return { arrived: false, frames, path_m: +dist.toFixed(1), worst_off_m: +worstOff.toFixed(2),
    cursor_jumps: cursorJumps, biggest_cursor_jump: biggestJump, worst_stall_frames: worstStall,
    end: pos.map((v) => +v.toFixed(1)), orbit_centre: hot && { cell: hot[0], frames_in_it: hot[1] } };
}

const roads = rd(ROADS);
const out = { tool: 'tools/world/w1-crossing-r2-pursue-sim.mjs',
  commit: execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(),
  roads: ROADS, fix: FIX, lookahead_m: LOOKAHEAD, arrive_m: ARRIVE, window_m: WINDOW,
  note: 'kinematic body: no terrain, no collision, no gravity, no parapet, no slope gate. Only _pursue.',
  legs: {} };
let bad = 0;
for (const leg of roads.legs) {
  const pts = leg.points.map((p) => [p[0], p[1]]);
  const f = walk(pts, FIX), r = walk(pts.slice().reverse(), FIX);
  out.legs[leg.id] = { fwd: f, rev: r };
  if (!f.arrived || !r.arrived) bad++;
  console.log(`${leg.id.padEnd(20)} fwd ${f.arrived ? 'ARRIVED' : 'STUCK  '} ${String(f.path_m).padStart(8)} m  jumps ${String(f.cursor_jumps).padStart(5)} (max ${f.biggest_cursor_jump})`
    + `   rev ${r.arrived ? 'ARRIVED' : 'STUCK  '} ${String(r.path_m).padStart(8)} m  jumps ${String(r.cursor_jumps).padStart(5)} (max ${r.biggest_cursor_jump})`
    + (r.orbit_centre ? `  orbit ${r.orbit_centre.cell} (${r.orbit_centre.frames_in_it} f)` : '')
    + (f.orbit_centre ? `  FWD orbit ${f.orbit_centre.cell} (${f.orbit_centre.frames_in_it} f)` : ''));
}
out.legs_failing = bad;
mkdirSync(join(ROOT, dirname(OUT)), { recursive: true });
writeFileSync(join(ROOT, OUT), JSON.stringify(out, null, 2));
console.log(`\n${bad} leg(s) with a direction that does not arrive.  wrote ${OUT}`);
process.exit(bad ? 1 : 0);
