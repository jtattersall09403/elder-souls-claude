#!/usr/bin/env node
// W1-04 round 4 — WHERE VP04 SHOULD STAND.
//
// The round-3 critic photographed `VP04-settlement-street` at its declared pose and found the
// camera **inside a wall**: `[3825.5, 15.1, 879]` is 3.8 m from the centre of `thorn-sapwell` and
// inside its footprint. Round 1's ruling — no capture through VP04 may be cited as evidence of a
// settlement — therefore still stands, for a new reason: it is no longer a picture of terrain, it
// is a picture of the inside of a building.
//
// A pose is not a thing to eyeball. This surveys Thorn's plan — the SAME `planSettlement()` the
// renderer builds from, so the footprints are the drawn ones and not the declared ones — and
// scores every candidate standing point on a 1 m grid by:
//
//   * clearance: not inside any building, and at least `--clear` metres from every wall;
//   * how many buildings fall inside a 60-degree cone looking at the town centre;
//   * how close the nearest of them is, because a street view wants a facade in the near field
//     and not a horizon of small boxes.
//
// It prints the best few and writes them, so whoever changes `tools/harness/viewpoints.json` is
// changing it to a measured pose rather than to a guess.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const TOWN = arg('--town', 'thorn');
const CLEAR = Number(arg('--clear', 2.5));

const EX = await import(path.join(ROOT, 'game/src/render/exterior.js'));
const S = JSON.parse(fs.readFileSync(path.join(ROOT, `game/data/world/settlements/${TOWN}.json`), 'utf8'));
const I = {};
for (const f of fs.readdirSync(path.join(ROOT, 'game/data/world/interiors'))) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'game/data/world/interiors', f), 'utf8'));
  I[d.id] = d;
}
const plan = EX.planSettlement(S, I);
const cx = plan.pos[0], cz = plan.pos[2];

/** Distance from (x,z) to a building's footprint rectangle, negative inside. */
function distTo(b, x, z) {
  const yaw = (b.yaw_deg || 0) * Math.PI / 180;
  const c = Math.cos(-yaw), s = Math.sin(-yaw);
  const dx = x - b.x, dz = z - b.z;
  const lx = Math.abs(dx * c + dz * s), lz = Math.abs(-dx * s + dz * c);
  const hw = b.drawn_footprint_m[0] / 2, hd = b.drawn_footprint_m[1] / 2;
  const ox = lx - hw, oz = lz - hd;
  if (ox <= 0 && oz <= 0) return -Math.min(-ox, -oz);
  return Math.hypot(Math.max(ox, 0), Math.max(oz, 0));
}

const cands = [];
const R = Math.ceil(plan.radius_m + 20);
for (let x = cx - R; x <= cx + R; x += 1) {
  for (let z = cz - R; z <= cz + R; z += 1) {
    let near = Infinity;
    for (const b of plan.buildings) { const d = distTo(b, x, z); if (d < near) near = d; }
    if (near < CLEAR) continue;
    // Look at the town centre.
    const lx = cx - x, lz = cz - z;
    const len = Math.hypot(lx, lz);
    if (len < 8 || len > plan.radius_m + 15) continue;
    const ux = lx / len, uz = lz / len;
    let inCone = 0, nearest = Infinity;
    for (const b of plan.buildings) {
      const vx = b.x - x, vz = b.z - z;
      const vl = Math.hypot(vx, vz) || 1;
      const cos = (vx * ux + vz * uz) / vl;
      if (cos < Math.cos(30 * Math.PI / 180)) continue;   // half-angle 30 deg = 60 deg fov
      inCone++;
      if (vl < nearest) nearest = vl;
    }
    cands.push({ x, z, clear_m: +near.toFixed(2), in_cone: inCone, nearest_m: +nearest.toFixed(2), dist_to_centre_m: +len.toFixed(1) });
  }
}
// Most buildings in frame; then a facade in the near field; then the tightest street that still
// clears. A pose that sees everything from 90 m away is a map, not a street.
cands.sort((a, b) => (b.in_cone - a.in_cone) || (a.nearest_m - b.nearest_m) || (a.clear_m - b.clear_m));
const best = cands.slice(0, 8);
const out = {
  tool: 'tools/world/w1-04-r4-vp04.mjs', town: TOWN, commit: process.env.W1_04_COMMIT || null,
  clearance_required_m: CLEAR,
  buildings: plan.buildings.length,
  declared_pose_is_inside: EX_inside(3825.5, 879),
  candidates: best,
};
function EX_inside(x, z) {
  for (const b of plan.buildings) if (distTo(b, x, z) < 0) return b.id;
  return null;
}
fs.mkdirSync(path.join(ROOT, 'reports/w1-04-r4'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports/w1-04-r4/vp04-survey.json'), JSON.stringify(out, null, 2));
console.log(`VP04 survey, ${TOWN}: declared pose [3825.5, _, 879] is inside ${out.declared_pose_is_inside || 'nothing'}`);
for (const c of best) console.log(`  [${c.x}, _, ${c.z}]  clear ${c.clear_m} m   buildings in a 60-deg cone: ${c.in_cone}   nearest ${c.nearest_m} m   ${c.dist_to_centre_m} m from the centre`);
console.log('wrote reports/w1-04-r4/vp04-survey.json');
