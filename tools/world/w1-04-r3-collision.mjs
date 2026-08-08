#!/usr/bin/env node
// W1-04 round 3 — CAN YOU WALK THROUGH A WALL, AND IS ANYBODY STANDING IN ONE?
//
// Split out of `w1-04-r3-exterior.mjs` after its first live run, because that run's collision
// section asked the question badly and I would rather say so than keep the number. It walked at
// the biggest building in Thorn from a start point that was already inside a DIFFERENT building,
// so the body stopped against the inside face of the Rotted Hall's east wall: the wall worked,
// and the measurement did not say so. It also sampled `solidAt` at building CENTRES, which are
// correctly hollow — a building is four wall slabs with a room-shaped hole in the middle, and
// asking whether its centre is solid is asking whether you can stand in your own kitchen.
//
// This asks it properly, and with a control arm:
//
//   §A  For a sample of buildings across the province: start 6 m outside the middle of a wall
//       that is NOT the doorway, on ground that is inside no building at all, and walk straight
//       at it. Solid: the body stops outside. Then `__w1_04_townSolids(false)` — the walls come
//       out of `sim.cell` and nothing else changes — and walk the identical path again.
//   §B  `solidAt` sampled ON the wall slab and 4 m clear of it, for every building in a town.
//   §C  Every outdoor townsperson at 03:00, 09:00 and 20:00, tested against every building's
//       footprint. The round-2 population is the one this piece has to not bury in masonry.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { launchGame } = await import(path.join(ROOT, 'tools/lib/browser.mjs'));

const TOWNS = ['thorn', 'helstrom', 'gideon', 'stormhold', 'soulrest'];
const B = await launchGame({});
const out = { tool: 'tools/world/w1-04-r3-collision.mjs', sections: {} };
const errors = [];
B.page.on('pageerror', (e) => errors.push(String(e)));

try {
  // ---- §A WALK AT A WALL, WITH AND WITHOUT THE WALL -------------------------------------------
  const walk = await B.page.evaluate((towns) => {
    const H = window.__HARNESS;
    const rows = [];
    for (const sid of towns) {
      const plan = H.__w1_04_plan(sid);
      if (!plan) continue;
      // Candidates: buildings with a clear approach — a point 6 m off one wall that is inside
      // no building's footprint at all. Take the three biggest that have one.
      const cands = plan.buildings.slice().sort((a, b) => b.drawn_footprint_m[0] - a.drawn_footprint_m[0]);
      let taken = 0;
      for (const b of cands) {
        if (taken >= 3) break;
        const yaw = (b.yaw_deg || 0) * Math.PI / 180;
        const c = Math.cos(yaw), s = Math.sin(yaw);
        const hw = b.drawn_footprint_m[0] / 2, hd = b.drawn_footprint_m[1] / 2;
        // Four candidate approaches, in the building's own frame, pushed out to world space.
        const sides = [
          { lx: -hw, lz: 0, dx: -1, dz: 0, name: '-x' },
          { lx: hw, lz: 0, dx: 1, dz: 0, name: '+x' },
          { lx: 0, lz: -hd, dx: 0, dz: -1, name: '-z' },
          { lx: 0, lz: hd, dx: 0, dz: 1, name: '+z' },
        ];
        let chosen = null;
        for (const S of sides) {
          const wallX = b.x + S.lx * c + S.lz * s, wallZ = b.z - S.lx * s + S.lz * c;
          const ox = S.dx * c + S.dz * s, oz = -S.dx * s + S.dz * c;   // outward, in world
          const startX = wallX + ox * 6, startZ = wallZ + oz * 6;
          // The start must be clear of EVERY building, and so must the halfway point.
          if (H.buildingAt(startX, startZ)) continue;
          if (H.buildingAt(wallX + ox * 3, wallZ + oz * 3)) continue;
          chosen = { wallX, wallZ, ox, oz, startX, startZ, side: S.name };
          break;
        }
        if (!chosen) continue;
        taken++;
        const run = (solidsOn) => {
          H.__w1_04_townSolids(solidsOn);
          H.teleport(chosen.startX, chosen.startZ);
          H.stepFrames(20);
          H.__w1_04_townSolids(solidsOn);
          // Walk 12 m straight at the wall — 6 m to reach it and 6 m past it.
          const endX = chosen.wallX - chosen.ox * 6, endZ = chosen.wallZ - chosen.oz * 6;
          H.walkPath([[chosen.startX, chosen.startZ], [endX, endZ]], { speedMps: 3 });
          H.stepFrames(300);
          const p = H.whereAmI().pos;
          // Signed distance along the approach: + means still outside the wall plane.
          const d = (p[0] - chosen.wallX) * chosen.ox + (p[2] - chosen.wallZ) * chosen.oz;
          return { end: [+p[0].toFixed(2), +p[2].toFixed(2)], outside_wall_m: +d.toFixed(2), inside: H.buildingAt(p[0], p[2], 0.1) };
        };
        const solid = run(true);
        const cut = run(false);
        rows.push({
          settlement: sid, building: b.id, side: chosen.side,
          footprint_m: b.drawn_footprint_m,
          with_walls: solid, walls_cut: cut,
          stopped_by_the_wall: solid.outside_wall_m > -0.1,
          passed_through_when_cut: cut.outside_wall_m < -0.1,
        });
      }
    }
    H.__w1_04_townSolids(true);
    return rows;
  }, TOWNS);
  out.sections.A_walk_at_a_wall = walk;
  const stopped = walk.filter((r) => r.stopped_by_the_wall).length;
  const through = walk.filter((r) => r.passed_through_when_cut).length;
  console.log(`\n## A. walk at a wall — ${stopped} of ${walk.length} walks stopped outside the wall; with the walls cut, ${through} of ${walk.length} walked through`);
  for (const r of walk) {
    console.log(`  ${r.settlement}/${r.building} (${r.side})  with walls: ${r.with_walls.outside_wall_m >= 0 ? '+' : ''}${r.with_walls.outside_wall_m} m outside${r.with_walls.inside ? ' INSIDE ' + r.with_walls.inside.building : ''}   walls cut: ${r.walls_cut.outside_wall_m} m${r.walls_cut.inside ? ' inside ' + r.walls_cut.inside.building : ''}`);
  }

  // ---- §B solidAt ON the wall and clear of it -------------------------------------------------
  const solidAt = await B.page.evaluate((towns) => {
    const H = window.__HARNESS;
    const rows = [];
    for (const sid of towns) {
      const plan = H.__w1_04_plan(sid);
      if (!plan) continue;
      H.teleport(plan.pos[0], plan.pos[2]);
      H.stepFrames(20);
      H.__w1_04_townSolids(true);
      let onWall = 0, clear = 0, n = 0;
      for (const b of plan.buildings) {
        const dx = b.x - plan.pos[0], dz = b.z - plan.pos[2];
        if (dx * dx + dz * dz > 40 * 40) continue;   // outside the collision radius
        n++;
        const yaw = (b.yaw_deg || 0) * Math.PI / 180;
        const c = Math.cos(yaw), s = Math.sin(yaw);
        const hd = b.drawn_footprint_m[1] / 2;
        // A point in the middle of the +z wall slab, at 1.0 m up.
        const wx = b.x + 0 * c + hd * s, wz = b.z - 0 * s + hd * c;
        const gy = 1.0;
        if (H.solidAt(wx, b.y === undefined ? gy : gy, wz).solid) onWall++;
        // 4 m clear of it, outward.
        const ox = 0 * c + 1 * s, oz = -0 * s + 1 * c;
        if (!H.solidAt(wx + ox * 4, gy, wz + oz * 4).solid) clear++;
      }
      rows.push({ settlement: sid, buildings_in_radius: n, solid_on_the_wall: onWall, not_solid_4m_clear: clear });
    }
    return rows;
  }, TOWNS);
  out.sections.B_solid_at = solidAt;
  console.log('\n## B. solidAt on the wall slab, and 4 m clear of it');
  for (const r of solidAt) console.log(`  ${r.settlement}: ${r.solid_on_the_wall}/${r.buildings_in_radius} solid on the wall, ${r.not_solid_4m_clear}/${r.buildings_in_radius} clear 4 m out`);

  // ---- §C the outdoor townspeople --------------------------------------------------------------
  const people = await B.page.evaluate(() => {
    const H = window.__HARNESS;
    const sids = ['archon', 'blackrose', 'gideon', 'helstrom', 'lilmoth', 'soulrest', 'stormhold', 'thorn'];
    const rows = [];
    for (const hour of [3, 9, 20]) {
      H.setTimeOfDay(hour);
      let outdoors = 0, insideFootprint = 0, insideSolid = 0;
      const stuck = [];
      for (const sid of sids) {
        const rec = H.__w1_04_settlement(sid);
        H.teleport(rec.pos[0], rec.pos[2]);
        H.stepFrames(10);
        H.populateSettlement(sid);
        H.stepFrames(40);
        const town = new Set(H.listNPCs().filter((n) => n.settlement === sid).map((n) => n.eid));
        for (const n of H.whereIsEveryone()) {
          if (!town.has(n.eid)) continue;
          if (n.at) continue;                     // indoors: the schedule names a room
          outdoors++;
          const hit = H.buildingAt(n.pos[0], n.pos[2], 0.35);
          if (hit) {
            insideFootprint++;
            // Inside the FOOTPRINT is a room, which is fine. Inside a WALL is not.
            const s = H.solidAt(n.pos[0], n.pos[1] + 1.0, n.pos[2]);
            if (s.solid) { insideSolid++; stuck.push({ npc: n.eid, building: hit.building, pos: n.pos.map((v) => +v.toFixed(1)) }); }
          }
        }
      }
      rows.push({ hour, outdoors, inside_a_building_footprint: insideFootprint, inside_solid_masonry: insideSolid, stuck });
    }
    return rows;
  });
  out.sections.C_outdoor_people = people;
  console.log('\n## C. the outdoor townspeople');
  for (const r of people) console.log(`  ${String(r.hour).padStart(2)}:00  outdoors ${r.outdoors}  inside a footprint ${r.inside_a_building_footprint}  INSIDE SOLID MASONRY ${r.inside_solid_masonry}`);
} finally {
  out.errors = errors;
  await B.close();
}

const p = path.join(ROOT, 'reports/w1-04-r3-collision.json');
fs.mkdirSync(path.dirname(p), { recursive: true });
fs.writeFileSync(p, JSON.stringify(out, null, 2));
console.log(`\nwrote ${path.relative(ROOT, p)}  page errors: ${errors.length}`);
process.exit(errors.length ? 1 : 0);
