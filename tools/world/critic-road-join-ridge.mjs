#!/usr/bin/env node
/**
 * critic-road-join-ridge.mjs — did the join move the road onto the cliff, or was the cliff there?
 *
 * W1-ROAD-JOIN declares acceptance 2 (a body walks THE CROSSING) NOT MET, and argues the remaining
 * stall — a 57.5 deg skirt on the Valus Ridge at (2153.7, 1197.8), 550 m along
 * `stormhold-helstrom` — predates the join. Its evidence is a CENTRELINE slope histogram: 84
 * samples over `max_walkable_deg` before against 86 after, "over the same metres".
 *
 * THAT EVIDENCE CANNOT SETTLE IT, for one reason: the body did not stall on the centreline. It
 * stalled 4.98 m off the deck, on the ground skirt either side of it. A centreline histogram is
 * blind to the skirt by construction, and two roads with identical centreline histograms can have
 * completely different shoulders. So this tool measures the two things that actually decide it:
 *
 *   1. **THE LATERAL DISPLACEMENT.** How far did the join move `stormhold-helstrom` at each metre?
 *      If the road at the stall is where it always was, the join did not put the body there and
 *      the builder's conclusion is right for the wrong reason. If it moved, the argument fails.
 *   2. **THE SKIRT PROFILE.** Ground slope on the shoulder — at the deck edge and at 2, 5 and 8 m
 *      beyond it — before and after, over the whole leg and at the stall. This is the surface the
 *      walker is actually standing on when it cuts a corner.
 *
 * Static and offline: the same `WorldField` the game collides against, no engine, no browser.
 *
 * Usage: node tools/world/critic-road-join-ridge.mjs [--out reports/critic-road-join/ridge.json]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { WorldField } from '../../game/src/world/field.js';

globalThis.atob = globalThis.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(join(HERE, '..', '..'));
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const argv = process.argv.slice(2);
const OUT = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'reports/critic-road-join/ridge.json';

// The road corridor is NOT attached: the question is what the GROUND does beside the deck, and
// `_applyRoads` flattens the deck itself. `heightAt` on a bare field is the natural skin the
// walker leaves the deck onto.
const bare = new WorldField(rd('game/data/world/terrain.json'), rd('game/data/world/regions.json'), rd('game/data/world/water.json'));

const AFTER = rd('game/data/world/roads.json');
const BEFORE = rd('reports/w1-road-join/roads-BEFORE-join.json');
const STALL = { x: 2153.7, z: 1197.8, leg: 'stormhold-helstrom', reported_slope_deg: 61.09, off_deck_m: 4.98 };
const MAX_WALKABLE_DEG = (() => {
  try { return rd('game/data/world/traversal.json').slope.max_walkable_deg; } catch { return 40; }
})();

const legOf = (doc, id) => doc.legs.find((l) => l.id === id);

/** Ground slope in degrees at (x, z), central differences on the bare field at 1 m. */
function slopeDeg(x, z) {
  const h = 1.0;
  const gx = (bare.heightAt(x + h, z) - bare.heightAt(x - h, z)) / (2 * h);
  const gz = (bare.heightAt(x, z + h) - bare.heightAt(x, z - h)) / (2 * h);
  return Math.atan(Math.hypot(gx, gz)) * 180 / Math.PI;
}

function resample(points, step) {
  const out = [];
  let m = 0;
  for (let k = 0; k + 1 < points.length; k++) {
    const [ax, az] = points[k], [bx, bz] = points[k + 1];
    const seg = Math.hypot(bx - ax, bz - az);
    if (seg <= 1e-9) continue;
    const nx = (bx - ax) / seg, nz = (bz - az) / seg;
    for (let d = 0; d < seg; d += step) { out.push({ x: ax + nx * d, z: az + nz * d, m, tx: nx, tz: nz }); m += step; }
  }
  return out;
}
function nearestOn(pts, x, z) {
  let best = Infinity, at = null;
  for (const q of pts) { const d = Math.hypot(q.x - x, q.z - z); if (d < best) { best = d; at = q; } }
  return { d: best, at };
}

/**
 * The skirt: slope at the centreline and at `offs` metres either side of it, perpendicular to the
 * road. `half_width_m` is the deck; anything beyond it is bare ground.
 */
function skirt(leg, offs) {
  const S = resample(leg.points, 1);
  const rows = [];
  for (const s of S) {
    const px = -s.tz, pz = s.tx;              // unit normal
    const row = { m: +s.m.toFixed(1), x: +s.x.toFixed(1), z: +s.z.toFixed(1), centre: +slopeDeg(s.x, s.z).toFixed(2), off: {} };
    for (const o of offs) {
      const a = slopeDeg(s.x + px * o, s.z + pz * o);
      const b = slopeDeg(s.x - px * o, s.z - pz * o);
      row.off[o] = +Math.max(a, b).toFixed(2);
    }
    rows.push(row);
  }
  return rows;
}

const OFFS = [3.6, 5.6, 8.6, 11.6];
const out = {
  schema: 'critic-road-join/ridge@1',
  measured_at: new Date().toISOString(),
  git: execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(),
  max_walkable_deg: MAX_WALKABLE_DEG,
  stall: STALL,
  question: 'did the join move stormhold-helstrom at the stall, and is the skirt the join\'s doing?',
  legs: {},
};

for (const legId of ['stormhold-helstrom', 'helstrom-blackrose', 'blackrose-lilmoth']) {
  const a = legOf(AFTER, legId), b = legOf(BEFORE, legId);
  if (!a || !b) continue;
  const SA = resample(a.points, 1), SB = resample(b.points, 1);
  // Lateral displacement: for every metre of the AFTER road, how far to the nearest point of the
  // BEFORE road. That is the question "did this bit of road move?", asked per metre.
  let worst = 0, worstAt = null, movedOver1m = 0;
  for (const s of SA) {
    const n = nearestOn(SB, s.x, s.z);
    if (n.d > 1.0) movedOver1m++;
    if (n.d > worst) { worst = n.d; worstAt = { m: +s.m.toFixed(1), x: +s.x.toFixed(1), z: +s.z.toFixed(1) }; }
  }
  const skA = skirt(a, OFFS), skB = skirt(b, OFFS);
  const overs = (rows, o) => rows.filter((r) => r.off[o] > MAX_WALKABLE_DEG).length;
  const worstOff = (rows, o) => rows.reduce((mx, r) => Math.max(mx, r.off[o]), 0);

  const entry = {
    displacement: {
      worst_m: +worst.toFixed(2), worst_at: worstAt,
      metres_moved_over_1m: movedOver1m, metres_total: SA.length,
      pct_moved: +(100 * movedOver1m / SA.length).toFixed(1),
    },
    centreline: {
      before_over_walkable: skB.filter((r) => r.centre > MAX_WALKABLE_DEG).length,
      after_over_walkable: skA.filter((r) => r.centre > MAX_WALKABLE_DEG).length,
      before_worst_deg: +skB.reduce((m, r) => Math.max(m, r.centre), 0).toFixed(2),
      after_worst_deg: +skA.reduce((m, r) => Math.max(m, r.centre), 0).toFixed(2),
    },
    skirt: {},
  };
  for (const o of OFFS) {
    entry.skirt[`${o}m`] = {
      before_metres_over_walkable: overs(skB, o), after_metres_over_walkable: overs(skA, o),
      before_worst_deg: +worstOff(skB, o).toFixed(2), after_worst_deg: +worstOff(skA, o).toFixed(2),
    };
  }
  if (legId === STALL.leg) {
    const nA = nearestOn(SA, STALL.x, STALL.z), nB = nearestOn(SB, STALL.x, STALL.z);
    entry.at_the_stall = {
      after_road_nearest_m: +nA.d.toFixed(2), after_at: nA.at ? { m: +nA.at.m.toFixed(1), x: +nA.at.x.toFixed(1), z: +nA.at.z.toFixed(1) } : null,
      before_road_nearest_m: +nB.d.toFixed(2), before_at: nB.at ? { m: +nB.at.m.toFixed(1), x: +nB.at.x.toFixed(1), z: +nB.at.z.toFixed(1) } : null,
      the_two_roads_apart_here_m: nA.at && nB.at ? +nearestOn(SB, nA.at.x, nA.at.z).d.toFixed(2) : null,
      ground_slope_at_stall_deg: +slopeDeg(STALL.x, STALL.z).toFixed(2),
      // The window the walker actually crosses: 60 m of leg either side of the stall.
      window: (() => {
        const c = nA.at ? nA.at.m : 0;
        const w = SA.filter((s) => Math.abs(s.m - c) <= 60);
        let mx = 0;
        for (const s of w) { const d = nearestOn(SB, s.x, s.z).d; if (d > mx) mx = d; }
        return { from_m: +(c - 60).toFixed(0), to_m: +(c + 60).toFixed(0), worst_displacement_m: +mx.toFixed(2) };
      })(),
    };
  }
  out.legs[legId] = entry;
  const D = entry.displacement;
  process.stdout.write(`\n${legId}\n`);
  process.stdout.write(`  displacement: worst ${D.worst_m} m at ${D.worst_at ? D.worst_at.m + ' m' : '?'}; ${D.metres_moved_over_1m} of ${D.metres_total} m moved > 1 m (${D.pct_moved}%)\n`);
  process.stdout.write(`  centreline over ${MAX_WALKABLE_DEG} deg: before ${entry.centreline.before_over_walkable} m, after ${entry.centreline.after_over_walkable} m (worst ${entry.centreline.before_worst_deg} -> ${entry.centreline.after_worst_deg} deg)\n`);
  for (const o of OFFS) {
    const s = entry.skirt[`${o}m`];
    process.stdout.write(`  skirt +/-${o} m over ${MAX_WALKABLE_DEG} deg: before ${s.before_metres_over_walkable} m, after ${s.after_metres_over_walkable} m (worst ${s.before_worst_deg} -> ${s.after_worst_deg} deg)\n`);
  }
  if (entry.at_the_stall) {
    const T = entry.at_the_stall;
    process.stdout.write(`  AT THE STALL (${STALL.x}, ${STALL.z}): joined road ${T.after_road_nearest_m} m away (at ${T.after_at.m} m), pre-join road ${T.before_road_nearest_m} m away\n`);
    process.stdout.write(`               the two roads are ${T.the_two_roads_apart_here_m} m apart here; worst displacement in the 120 m window ${T.window.worst_displacement_m} m\n`);
    process.stdout.write(`               ground slope at the stall point ${T.ground_slope_at_stall_deg} deg\n`);
  }
}

mkdirSync(dirname(join(ROOT, OUT)), { recursive: true });
writeFileSync(join(ROOT, OUT), JSON.stringify(out, null, 1) + '\n');
process.stdout.write(`\n  ${OUT}\n`);
