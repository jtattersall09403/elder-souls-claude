#!/usr/bin/env node
// W1-04 round 3 — CAN YOU WALK THROUGH A WALL, AND IS ANYBODY STANDING IN ONE?
//
// REWRITTEN BY A SUCCESSOR. The first version of this file ran to completion and wrote a report
// that cannot be used, and the three reasons are worth keeping written down because each of them
// is a way a probe passes without measuring anything:
//
//   1. THE CONTROL ARM WAS INERT. Every one of its 15 walks returned byte-identical `with_walls`
//      and `walls_cut` results. `__w1_04_townSolids(false)` nulled `engine._townCell` before
//      calling `_settleSettlementSolids()`, whose off-branch is
//      `if (this._townCell && this.sim.cell === this._townCell) this.sim.cell = EMPTY_CELL` — so
//      the branch was dead, `sim.cell` kept the wall set, and BOTH arms were the walls-on arm.
//      Fixed in `game/src/harness/api.js`. RULES.md #6: check the two arms actually differ.
//   2. §B SAMPLED UNDERGROUND. It asked `solidAt` at absolute y = 1.0 m (`b.y === undefined ? gy
//      : gy` always yields 1.0). The wall slabs span groundY .. groundY + height, and Thorn
//      stands at y ≈ 15, Soulrest at y ≈ 8. It reported 0 of 15 solid in every town, and that
//      number was about the probe.
//   3. §A WALKED IN THROUGH THE DOOR. Its comment says it approaches a wall that is NOT the
//      doorway; the code never excluded `entry_side`, so 6 of 15 walks used the door and were
//      scored as walking through a wall.
//
// This version asks it properly. Every geometric number below is taken from
// `getDrawnSettlements()` — the renderer's own record of what it drew — and never from the data.
//
//   §0  INSTRUMENT CHECK. Walls on / off / restored, reading the live `sim.cell` shape count.
//       If taking the walls out does not empty the cell, the run fails here and says so.
//   §A  WALK AT A WALL. Start 6 m off the middle of a wall that is NOT the doorway, on ground
//       inside no building, and walk 12 m straight through it. With the walls, then with
//       `__w1_04_townSolids(false)` and nothing else changed, then restored.
//   §A2 WALK AT THE DOOR — the positive control. The identical walk aimed at the doorway, walls
//       ON. If this also stops, the walls are not a wall, they are a blanket.
//   §B  `solidAt` ON the wall slab and 4 m clear of it, at the drawn building's own base Y.
//   §C  Every outdoor townsperson at 03:00, 09:00 and 20:00, against every building's footprint,
//       and — for anyone standing in one — against the live collision set rebuilt around them.
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { launchGame } = await import(path.join(ROOT, 'tools/lib/browser.mjs'));

const TOWNS = ['thorn', 'helstrom', 'gideon', 'stormhold', 'soulrest'];
const PER_TOWN = 3;

/* The probe body, injected into the page once and shared by every section. Mirrors
 * `render/exterior.js#entrySideLocal()` exactly — the door has to be the same door. */
const PROBE = `
window.__W = {
  entrySideLocal(b) {
    const yaw = (b.yaw_deg || 0) * Math.PI / 180;
    let wx = 0, wz = 1;
    if (b.entry_side === 'north') { wx = 0; wz = -1; }
    else if (b.entry_side === 'south') { wx = 0; wz = 1; }
    else if (b.entry_side === 'east') { wx = 1; wz = 0; }
    else if (b.entry_side === 'west') { wx = -1; wz = 0; }
    else if (b.door) {
      const dx = b.door[0] - b.x, dz = b.door[2] - b.z;
      if (Math.abs(dx) > Math.abs(dz)) { wx = Math.sign(dx) || 1; wz = 0; } else { wx = 0; wz = Math.sign(dz) || 1; }
    }
    const c = Math.cos(-yaw), s = Math.sin(-yaw);
    const lx = wx * c + wz * s, lz = -wx * s + wz * c;
    return Math.abs(lx) > Math.abs(lz) ? (lx > 0 ? '+x' : '-x') : (lz > 0 ? '+z' : '-z');
  },
  /**
   * The buildings a town DREW, joined to the plan for entry_side/enterable.
   *
   * IT HAS TO STAND IN THE TOWN FIRST. The province streams, so nothing is in the scene graph
   * until the tiles round the town have been requested and drained — the first version of this
   * probe read the drawn settlements from wherever the player happened to boot, got an empty
   * settlements list for all five towns, and every section below it then reported 0 of 0 and
   * called itself a pass. That is the vacuous control this project has been bitten by before.
   */
  town(sid) {
    const H = window.__HARNESS;
    const plan = H.__w1_04_plan(sid);
    if (!plan) return null;
    H.teleport(plan.pos[0], plan.pos[2]);
    H.stepFrames(20);
    const drawnAll = H.getDrawnSettlements();
    const s = drawnAll && drawnAll.settlements ? drawnAll.settlements.find((t) => t.id === sid) : null;
    if (!s || !s.drawn || !s.drawn.length) return null;
    const byId = new Map(plan.buildings.map((b) => [b.id, b]));
    const buildings = s.drawn.map((d) => {
      const p = byId.get(d.id) || {};
      return { id: d.id, x: d.x, y: d.y, z: d.z, yaw_deg: d.yaw_deg || 0,
               w: d.footprint_m[0], d: d.footprint_m[1], h: d.height_m,
               doorway: d.doorway, enterable: !!p.enterable,
               entry_local: window.__W.entrySideLocal(Object.assign({}, p, { yaw_deg: d.yaw_deg || 0, x: d.x, z: d.z })) };
    });
    return { id: sid, pos: plan.pos, buildings };
  },
  /** The four approaches to a building, in world space. */
  sides(b) {
    const yaw = b.yaw_deg * Math.PI / 180;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const hw = b.w / 2, hd = b.d / 2;
    return [
      { lx: -hw, lz: 0, dx: -1, dz: 0, name: '-x' },
      { lx: hw, lz: 0, dx: 1, dz: 0, name: '+x' },
      { lx: 0, lz: -hd, dx: 0, dz: -1, name: '-z' },
      { lx: 0, lz: hd, dx: 0, dz: 1, name: '+z' },
    ].map((S) => {
      const wallX = b.x + S.lx * c + S.lz * s, wallZ = b.z - S.lx * s + S.lz * c;
      const ox = S.dx * c + S.dz * s, oz = -S.dx * s + S.dz * c;
      return { name: S.name, wallX, wallZ, ox, oz, startX: wallX + ox * 6, startZ: wallZ + oz * 6 };
    });
  },
  /** One walk: 12 m straight at the wall plane, 6 m of approach and 6 m of follow-through. */
  walk(S) {
    const H = window.__HARNESS;
    const endX = S.wallX - S.ox * 6, endZ = S.wallZ - S.oz * 6;
    const r = H.walkPath([[S.startX, S.startZ], [endX, endZ]],
                         { arrive_m: 1.0, maxFrames: 900, stuckAbort: 200 });
    const p = H.whereAmI().pos;
    // Signed distance along the approach direction: + is still outside the wall plane.
    const d = (p[0] - S.wallX) * S.ox + (p[2] - S.wallZ) * S.oz;
    return {
      end: [+p[0].toFixed(2), +p[2].toFixed(2)],
      outside_wall_m: +d.toFixed(2),
      inside: H.buildingAt(p[0], p[2], 0.1),
      walk: { arrived: r.arrived, aborted: r.aborted, frames: r.frames,
              path_m: r.path_m, longest_stuck_frames: r.longest_stuck_frames },
      shapes_in_cell: H.getSettlementSolids().shapes,
    };
  },
};
`;

const B = await launchGame({});
const out = { tool: 'tools/world/w1-04-r3-collision.mjs', commit: null, sections: {} };
const errors = [];
B.page.on('pageerror', (e) => errors.push(String(e)));
let fatal = null;

try {
  await B.page.evaluate(PROBE);

  // ---- §0 INSTRUMENT CHECK -------------------------------------------------------------------
  // The control arm has to be shown to work before anything it controls is worth reading.
  const inst = await B.page.evaluate((towns) => {
    const H = window.__HARNESS;
    const rows = [];
    for (const sid of towns) {
      const t = window.__W.town(sid);
      if (!t) continue;
      H.teleport(t.pos[0], t.pos[2]);
      H.stepFrames(20);
      const on = H.__w1_04_townSolids(true).shapes;
      const off = H.__w1_04_townSolids(false).shapes;
      const back = H.__w1_04_townSolids(true).shapes;
      rows.push({ settlement: sid, shapes_with_walls: on, shapes_walls_cut: off, shapes_restored: back });
    }
    return rows;
  }, TOWNS);
  out.sections['0_instrument'] = inst;
  console.log('\n## 0. instrument check — does taking the walls out actually take them out?');
  for (const r of inst) {
    console.log(`  ${r.settlement}: ${r.shapes_with_walls} shapes with the walls, ${r.shapes_walls_cut} with them cut, ${r.shapes_restored} restored`);
  }
  // GOES-RED (RULES.md #4). The §0 check above is only worth anything if it can fail, so run it
  // once more against a faithful re-creation of the DEFECT it exists to catch: the old
  // `__w1_04_townSolids`, which nulled `_townCell` before settling and so could never clear
  // `sim.cell`. If this arm reports the walls coming out, §0 cannot detect an inert control.
  const red = await B.page.evaluate((towns) => {
    const H = window.__HARNESS, E = window.__ENGINE;
    const buggy = (on) => {   // verbatim the pre-fix verb
      E._townSolidsOff = !on;
      E._townSolids = null; E._townCell = null;
      E._settleSettlementSolids();
      return E.settlementSolidsReport();
    };
    const rows = [];
    for (const sid of towns) {
      const t = window.__W.town(sid);
      if (!t) continue;
      H.teleport(t.pos[0], t.pos[2]);
      H.stepFrames(20);
      const on = buggy(true).shapes;
      const off = buggy(false).shapes;
      rows.push({ settlement: sid, shapes_with_walls: on, shapes_walls_cut: off });
    }
    H.__w1_04_townSolids(true);
    return rows;
  }, TOWNS);
  const redDetected = red.filter((r) => r.shapes_walls_cut !== 0).length;
  out.sections['0_goes_red'] = {
    what: 'the pre-fix __w1_04_townSolids, re-created in the page, run through the same §0 check',
    rows: red,
    detected_as_inert: redDetected,
    of: red.length,
    the_check_can_fail: redDetected === red.length && red.length > 0,
  };
  console.log(`  GOES-RED: with the old verb re-created, the walls fail to come out in ${redDetected} of ${red.length} towns — the §0 check can fail.`);

  const inert = inst.filter((r) => !(r.shapes_with_walls > 0 && r.shapes_walls_cut === 0 && r.shapes_restored === r.shapes_with_walls));
  out.sections['0_instrument_verdict'] = {
    towns: inst.length,
    control_arm_live: inert.length === 0,
    towns_where_the_control_did_nothing: inert.map((r) => r.settlement),
  };
  // A PASS ON ZERO TOWNS IS NOT A PASS. The first run of this rewrite reached no town at all and
  // reported `control_arm_live: true` over an empty list, which is exactly the shape of vacuous
  // green this project keeps catching in other people's probes.
  if (inst.length < TOWNS.length) {
    fatal = `REACHED ${inst.length} of ${TOWNS.length} TOWNS — the scene graph held no drawn buildings for the rest, so there was nothing to measure and every count below would be a vacuous zero.`;
    console.log(`  !! ${fatal}`);
  } else if (inert.length) {
    fatal = `CONTROL ARM INERT in ${inert.length} of ${inst.length} towns — every §A number below would be meaningless.`;
    console.log(`  !! ${fatal}`);
  } else {
    console.log(`  the control arm is live in all ${inst.length} towns.`);
  }

  if (!fatal) {
    // ---- §A WALK AT A WALL, WITH AND WITHOUT THE WALL -----------------------------------------
    const walks = [];
    const doors = [];
    for (const sid of TOWNS) {
      const rows = await B.page.evaluate(({ sid, per }) => {
        const H = window.__HARNESS;
        const t = window.__W.town(sid);
        if (!t) return { walls: [], doors: [] };
        const walls = [], doorRows = [];
        // Biggest first: the biggest buildings are the ones a body is most likely to get past.
        const cands = t.buildings.slice().sort((a, b) => b.w - a.w);
        let taken = 0;
        for (const b of cands) {
          if (taken >= per) break;
          let chosen = null, doorSide = null;
          for (const S of window.__W.sides(b)) {
            // THE DOORWAY IS NOT A WALL. Skip the entry side for the wall arm — walking in
            // through a door is the system working, and scoring it as a breach is what the
            // first version of this file did.
            if (b.enterable && S.name === b.entry_local) { doorSide = S; continue; }
            if (H.buildingAt(S.startX, S.startZ)) continue;
            if (H.buildingAt(S.wallX + S.ox * 3, S.wallZ + S.oz * 3)) continue;
            if (!chosen) chosen = S;
          }
          if (!chosen) continue;
          taken++;
          H.__w1_04_townSolids(true);
          const solid = window.__W.walk(chosen);
          H.__w1_04_townSolids(false);
          const cut = window.__W.walk(chosen);
          H.__w1_04_townSolids(true);
          walls.push({
            settlement: sid, building: b.id, side: chosen.name, entry_side: b.entry_local,
            footprint_m: [b.w, b.d], height_m: b.h,
            with_walls: solid, walls_cut: cut,
            stopped_by_the_wall: solid.outside_wall_m > -0.1 && !solid.inside,
            passed_through_when_cut: cut.outside_wall_m < -0.1,
            arms_differ: Math.abs(solid.outside_wall_m - cut.outside_wall_m) > 0.5,
          });
          // §A2 the positive control: the same walk aimed at the doorway, walls ON.
          if (doorSide && b.doorway && !H.buildingAt(doorSide.startX, doorSide.startZ)) {
            H.__w1_04_townSolids(true);
            const through = window.__W.walk(doorSide);
            doorRows.push({
              settlement: sid, building: b.id, door_side: doorSide.name,
              end: through.end, outside_wall_m: through.outside_wall_m,
              inside: through.inside, walk: through.walk,
              got_in_through_the_door: through.outside_wall_m < -0.1,
            });
          }
        }
        H.__w1_04_townSolids(true);
        return { walls, doors: doorRows };
      }, { sid, per: PER_TOWN });
      walks.push(...rows.walls);
      doors.push(...rows.doors);
      console.log(`  ...${sid}: ${rows.walls.length} wall walks, ${rows.doors.length} door walks`);
    }
    out.sections.A_walk_at_a_wall = walks;
    out.sections.A2_walk_at_the_door = doors;
    const stopped = walks.filter((r) => r.stopped_by_the_wall).length;
    const through = walks.filter((r) => r.passed_through_when_cut).length;
    const differ = walks.filter((r) => r.arms_differ).length;
    out.sections.A_verdict = {
      walks: walks.length, stopped_outside_the_wall: stopped,
      walked_through_when_the_walls_were_cut: through, arms_that_differ: differ,
      door_walks: doors.length, got_in_through_the_door: doors.filter((r) => r.got_in_through_the_door).length,
    };
    console.log(`\n## A. walk at a wall — ${stopped} of ${walks.length} stopped outside; ${through} of ${walks.length} walked through when the walls were cut; ${differ} of ${walks.length} arms differ`);
    for (const r of walks) {
      console.log(`  ${r.settlement}/${r.building} (${r.side}, door ${r.entry_side})  with walls: ${r.with_walls.outside_wall_m >= 0 ? '+' : ''}${r.with_walls.outside_wall_m} m [${r.with_walls.walk.aborted || 'arrived'}, ${r.with_walls.walk.frames}f]   cut: ${r.walls_cut.outside_wall_m} m [${r.walls_cut.walk.aborted || 'arrived'}, ${r.walls_cut.walk.frames}f]${r.walls_cut.inside ? ' inside ' + r.walls_cut.inside.building : ''}`);
    }
    console.log(`\n## A2. the positive control — the same walk aimed at the DOORWAY, walls on: ${doors.filter((r) => r.got_in_through_the_door).length} of ${doors.length} got inside`);
    for (const r of doors) console.log(`  ${r.settlement}/${r.building} (${r.door_side}): ${r.outside_wall_m} m${r.inside ? ' INSIDE ' + r.inside.building : ''}`);
  }

  // ---- §B solidAt ON the wall and clear of it, at the DRAWN base Y -----------------------------
  const solidAt = await B.page.evaluate((towns) => {
    const H = window.__HARNESS;
    const rows = [];
    for (const sid of towns) {
      const t = window.__W.town(sid);
      if (!t) continue;
      H.teleport(t.pos[0], t.pos[2]);
      H.stepFrames(20);
      H.__w1_04_townSolids(true);
      let onWall = 0, clear = 0, n = 0;
      const misses = [];
      for (const b of t.buildings) {
        const dx = b.x - t.pos[0], dz = b.z - t.pos[2];
        if (dx * dx + dz * dz > 40 * 40) continue;   // outside the 45 m collision radius
        n++;
        const yaw = b.yaw_deg * Math.PI / 180;
        const c = Math.cos(yaw), s = Math.sin(yaw);
        const hd = b.d / 2;
        // The middle of the +z wall slab, 1.0 m above THIS BUILDING'S OWN drawn base.
        const wx = b.x + hd * s, wz = b.z + hd * c;
        const gy = b.y + 1.0;
        const hit = H.solidAt(wx, gy, wz);
        if (hit.solid) onWall++; else misses.push({ id: b.id, at: [+wx.toFixed(1), +gy.toFixed(1), +wz.toFixed(1)], nearest_m: +hit.distance_m.toFixed(2) });
        const ox = s, oz = c;
        if (!H.solidAt(wx + ox * 4, gy, wz + oz * 4).solid) clear++;
      }
      rows.push({ settlement: sid, buildings_in_radius: n, solid_on_the_wall: onWall,
                  not_solid_4m_clear: clear, sampled_at: 'drawn base Y + 1.0 m', misses });
    }
    return rows;
  }, TOWNS);
  out.sections.B_solid_at = solidAt;
  console.log('\n## B. solidAt on the wall slab, and 4 m clear of it (at each building\'s own drawn base Y + 1 m)');
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
      const perTown = [];
      for (const sid of sids) {
        const rec = H.__w1_04_settlement(sid);
        H.teleport(rec.pos[0], rec.pos[2]);
        H.stepFrames(10);
        H.populateSettlement(sid);
        H.stepFrames(40);
        const town = new Set(H.listNPCs().filter((n) => n.settlement === sid).map((n) => n.eid));
        let o = 0, f = 0, sSolid = 0;
        for (const n of H.whereIsEveryone()) {
          if (!town.has(n.eid)) continue;
          if (n.at) continue;                     // indoors: the schedule names a room
          outdoors++; o++;
          const hit = H.buildingAt(n.pos[0], n.pos[2], 0.35);
          if (!hit) continue;
          insideFootprint++; f++;
          // Inside the FOOTPRINT is a room, which is fine. Inside a WALL is not — and the
          // collision set only ever holds the buildings within 45 m of the PLAYER, so it has
          // to be rebuilt around this person before the question can be asked of them.
          H.teleport(n.pos[0], n.pos[2]);
          H.__w1_04_townSolids(true);
          const s = H.solidAt(n.pos[0], n.pos[1] + 1.0, n.pos[2]);
          if (s.solid) {
            insideSolid++; sSolid++;
            stuck.push({ npc: n.eid, settlement: sid, building: hit.building, pos: n.pos.map((v) => +v.toFixed(1)) });
          }
        }
        perTown.push({ settlement: sid, outdoors: o, inside_a_footprint: f, inside_solid_masonry: sSolid });
      }
      rows.push({ hour, outdoors, inside_a_building_footprint: insideFootprint,
                  inside_solid_masonry: insideSolid, per_town: perTown, stuck });
    }
    return rows;
  });
  out.sections.C_outdoor_people = people;
  console.log('\n## C. the outdoor townspeople');
  for (const r of people) console.log(`  ${String(r.hour).padStart(2)}:00  outdoors ${r.outdoors}  inside a footprint ${r.inside_a_building_footprint}  INSIDE SOLID MASONRY ${r.inside_solid_masonry}`);
} finally {
  out.errors = errors;
  out.fatal = fatal;
  const p = path.join(ROOT, 'reports/w1-04-r3-collision.json');
  fs.mkdirSync(path.dirname(p), { recursive: true });

  // THE WRITE IS IN A `finally`, SO IT RUNS EVEN WHEN THE TRY BODY THREW BEFORE FILLING A SINGLE
  // SECTION — and on 2026-08-15 it did exactly that, replacing a 1,425-line report with
  // `"sections": {}, "errors": [], "fatal": null` and exiting 0. An empty run that reports no error
  // is indistinguishable from a run that found nothing wrong, and it had already destroyed the
  // previous run's evidence by the time anybody could read it. Two guards, both one-sided on
  // purpose: never overwrite a real report with an empty one, and never exit 0 on an empty run.
  const emptyRun = Object.keys(out.sections).length === 0;
  if (emptyRun && fs.existsSync(p)) {
    const keep = `${p}.EMPTY-RUN-REFUSED.json`;
    fs.writeFileSync(keep, JSON.stringify(out, null, 2));
    console.error(`\nREFUSED to overwrite ${path.relative(ROOT, p)}: this run produced 0 sections.`);
    console.error(`the empty result is at ${path.relative(ROOT, keep)} so it can still be read.`);
  } else {
    fs.writeFileSync(p, JSON.stringify(out, null, 2));
    console.log(`\nwrote ${path.relative(ROOT, p)}  page errors: ${errors.length}${fatal ? `  FATAL: ${fatal}` : ''}`);
  }
  if (emptyRun) fatal = fatal || 'run produced 0 sections';
  await B.close();
}

process.exit(fatal || errors.length ? 1 : 0);
