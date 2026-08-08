#!/usr/bin/env node
// W1-04 ROUND 6 — THE OFFLINE CENSUS, ENUMERATED FROM THE INTERIORS.
//
// Five sections, and each one exists because a previous round measured it with the wrong predicate
// or could not reach the records it was about:
//
//   E  ENUMERATION   — 115 of 115 interior records reached, every one accounted for by name.
//                      Round 5's census reached 113, its fail-closed check reached 112, and
//                      `applyInteriorBounds()`'s own orphan pass counted 113 while acting on 1.
//   S  STANDABILITY  — is the doorstep a FIXED POINT OF THE COLLISION SOLVER, not merely outside a
//                      footprint? Round 5 asked the second question, measured it one frame after
//                      the door, and got 0; the solver then slid ten bodies indoors by frame 30.
//                      Checked twice: once through `exterior.js#horizontalClearance()` and once
//                      through a REAL `CollisionCell` built from the shipped shapes, so the 2-D
//                      restatement in `render/` is verified against the 3-D original in `sim/`.
//   R  RE-ENTRY      — pressing `interact` on the doorstep: does it open the room you left?
//                      `doorAt()` returns the NEAREST door, so "a door is in reach" and "your door
//                      is in reach" are different questions and round 5 published the first.
//   P  PROPS         — the two predicates, both measured, both named, neither hidden behind the
//                      other's prose. See the header of section P.
//   L  LAMPS         — round 5's leg 2, re-measured so a regression in it is visible here.
//
// IT GOES RED. `--self-break` calls `buildInterior(rec)` with the wrong arity on purpose — the
// exact failure the round-4 critic made and reported — so a census that reads nothing reports a
// PROBE FAILURE instead of a clean zero.
//
//   node tools/world/w1-04-r6-census.mjs [--json <path>] [--self-break]
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from '../../game/vendor/three/three.module.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const argOf = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const SELF_BREAK = has('--self-break');

const EX = await import(path.join(ROOT, 'game/src/render/exterior.js'));
const IN = await import(path.join(ROOT, 'game/src/render/interior.js'));
const COL = await import(path.join(ROOT, 'game/src/sim/collision.js'));
const WC = await import(path.join(ROOT, 'game/src/sim/world-collision.js'));
const SETT = await import(path.join(ROOT, 'game/src/sim/settlement.js'));

function load(dir) {
  const out = {};
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, dir, f), 'utf8'));
    out[d.id] = d;
  }
  return out;
}

const S = load('game/data/world/settlements');
const I = load('game/data/world/interiors');
const plans = Object.keys(S).sort().map((id) => EX.planSettlement(S[id], I));
const join = EX.applyInteriorBounds(plans, I, Object.values(S), {});

const out = { commit: null, self_break: SELF_BREAK, findings: [] };
try {
  out.commit = (await import('node:child_process')).execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
} catch { /* not a git tree */ }

/* ---- the mirrors --------------------------------------------------------------------------- */
out.mirrors = {
  body_radius_m: { in_render: EX.BODY_RADIUS_M, in_sim: WC.PLAYER_RADIUS_M, agree: EX.BODY_RADIUS_M === WC.PLAYER_RADIUS_M },
  door_reach_m: { in_render: EX.DOOR_REACH_M, in_sim: SETT.DOOR_REACH_M, agree: EX.DOOR_REACH_M === SETT.DOOR_REACH_M },
};
if (!out.mirrors.body_radius_m.agree || !out.mirrors.door_reach_m.agree) out.findings.push('MIRROR DRIFT: render/exterior.js is deriving doorsteps against a number sim/ no longer uses');

/* ---- E: enumeration ------------------------------------------------------------------------ */
const placed = new Map(), planById = new Map();
for (const plan of plans) {
  planById.set(plan.id, plan);
  for (const b of plan.buildings) if (b.interior) placed.set(b.interior, { plan, b });
}
const ids = Object.keys(I).sort();
const orphans = ids.filter((id) => !placed.has(id));
out.E = {
  what: 'which interior records can this loop reach at all — the general form of RULES rule 11',
  interior_records: ids.length,
  reached_by_this_census: ids.length,
  in_a_settlement_plan: placed.size,
  orphans: orphans.map((id) => ({
    interior: id,
    settlement: I[id].settlement || null,
    has_settlement_document: !!planById.get(I[id].settlement),
    why: planById.get(I[id].settlement) ? 'no building row in its town names this interior' : 'its declared settlement is not one of the eight documents',
  })),
  join_pass_reported: {
    interiors_total: join.interiors_total, orphans: join.orphans,
    orphans_without_a_settlement_document: join.orphans_without_a_settlement_document,
    unreachable: join.orphans_unreachable,
  },
};
if (out.E.reached_by_this_census !== out.E.interior_records) out.findings.push('this census cannot reach every interior record');
if (join.orphans !== orphans.length) out.findings.push(`applyInteriorBounds() counted ${join.orphans} orphans; there are ${orphans.length}`);

/* ---- S: standability, twice ---------------------------------------------------------------- */
// A doorstep is standable iff the collision solver leaves it where it is. `resolveSphere()` pushes
// until `distance >= r`, so the condition is exactly `distance >= BODY_RADIUS_M`. Measured here
// with the SHIPPED `CollisionCell` — the same class `Engine._syncTownCell()` builds — and again
// with `exterior.js#horizontalClearance()`, and the two are required to agree on every record.
const cellFor = new Map();
for (const plan of plans) cellFor.set(plan.id, new COL.CollisionCell(plan.id, EX.settlementSolids(plan, 0, 0, 1e9, null)));
const solidsFor = new Map();
for (const plan of plans) solidsFor.set(plan.id, EX.settlementSolids(plan, 0, 0, 1e9, null));

let insideFootprint = 0, inWall = 0, disagree = 0, tested = 0, noPlan = 0;
const sRows = [];
for (const id of ids) {
  const rec = I[id];
  const sp = rec && rec.continuity && rec.continuity.exterior_spawn;
  const at = placed.get(id);
  const plan = at ? at.plan : planById.get(rec.settlement);
  if (!Array.isArray(sp)) { sRows.push({ interior: id, verdict: 'no exterior_spawn' }); continue; }
  if (!plan) { noPlan++; sRows.push({ interior: id, verdict: 'no settlement document — untestable', settlement: rec.settlement }); continue; }
  tested++;
  const hit = EX.insideBuilding(plan, sp[0], sp[2], 0);
  const d2 = EX.horizontalClearance(solidsFor.get(plan.id), sp[0], sp[2]);
  const d3 = cellFor.get(plan.id).distance(sp[0], (sp[1] || 0) + 0.90, sp[2]);
  if (hit) { insideFootprint++; sRows.push({ interior: id, verdict: 'INSIDE A FOOTPRINT', building: hit }); continue; }
  // The 2-D restatement must never call a point clear that the 3-D original calls solid.
  if (d2 >= EX.BODY_RADIUS_M && d3 < EX.BODY_RADIUS_M) { disagree++; sRows.push({ interior: id, verdict: 'PREDICATE DISAGREEMENT', horizontal_m: +d2.toFixed(3), cell_m: +d3.toFixed(3) }); }
  if (d3 < EX.BODY_RADIUS_M) { inWall++; sRows.push({ interior: id, verdict: 'IN A WALL SLAB — the solver will move it', cell_m: +d3.toFixed(3) }); }
}
out.S = {
  what: 'is the point leaveInterior() puts the body on a FIXED POINT of the collision solver',
  predicate: `insideBuilding() === null AND CollisionCell.distance(x, y+0.90, z) >= BODY_RADIUS_M (${EX.BODY_RADIUS_M})`,
  tested, untestable_no_settlement_document: noPlan,
  inside_a_footprint: insideFootprint,
  in_a_wall_slab: inWall,
  horizontal_vs_cell_disagreements: disagree,
  rows: sRows.filter((r) => r.verdict !== 'ok').slice(0, 40),
};
if (insideFootprint || inWall) out.findings.push(`${insideFootprint} doorstep(s) inside a footprint, ${inWall} inside a wall slab`);
if (disagree) out.findings.push(`horizontalClearance() and CollisionCell disagree on ${disagree} doorstep(s) — the 2-D restatement is not conservative`);

/* ---- R: re-entry --------------------------------------------------------------------------- */
// `doorAt()`'s rule, reimplemented from the settlement document's own rows — the array
// `SettlementSystem`'s reach table holds. Its result is compared to the row of the building the
// interior belongs to. This is the offline half; `w1-04-r6-live.mjs` presses `interact`.
const rowsBy = new Map();
for (const sid of Object.keys(S)) rowsBy.set(sid, (S[sid].buildings || []).filter((r) => r.kind === 'interior' && r.door));
let own = 0, other = 0, none = 0;
const rRows = [];
for (const id of ids) {
  const rec = I[id];
  const sp = rec && rec.continuity && rec.continuity.exterior_spawn;
  const rows = rowsBy.get(rec.settlement);
  if (!Array.isArray(sp) || !rows) { none++; rRows.push({ interior: id, opens: null, why: rows ? 'no exterior_spawn' : 'no settlement document' }); continue; }
  let best = null, bd = Infinity;
  for (const r of rows) {
    const d = Math.hypot(r.door[0] - sp[0], r.door[2] - sp[2]);
    if (d <= SETT.DOOR_REACH_M && d < bd) { bd = d; best = r; }
  }
  if (!best) { none++; rRows.push({ interior: id, opens: null, why: 'no door within DOOR_REACH_M' }); }
  else if (best.interior === id) own++;
  else { other++; rRows.push({ interior: id, opens: best.interior, dist_m: +bd.toFixed(2) }); }
}
out.R = {
  what: 'pressing interact on the doorstep — which interior does doorAt() hand to useDoor()',
  records: ids.length, back_in_the_room_you_left: own, into_a_different_building: other, into_nothing: none,
  rows: rRows,
};

/* ---- P: the prop predicate, NAMED ----------------------------------------------------------- */
//
// THE ROUND-5 VERDICT SETTLED THAT THIS IS NOT A TOLERANCE DISAGREEMENT. Round 4's critic and
// round 5's census both used 0.6 m and got 292/61 and 0. They differ in the PREDICATE:
//
//   OVERHANG  = how far the box REACHES past the room boundary   max(bx0 - box.min, box.max - bx1)
//   CLEARANCE = how far the whole box sits CLEAR of the room     max(bx0 - box.max, box.min - bx1, 0)
//
// CLEARANCE <= OVERHANG always, and CLEARANCE is 0 whenever the box still overlaps the room at
// all — a two-metre bench with 1.9 m of itself through the wall scores zero.
//
// WHICH ONE THE REFERENCE ITEM MEANS, and this round states it rather than inheriting it.
// `RI-WLD13` §1 N1 is "footprint containment": the interior floor area against the exterior
// building's ground footprint, ratio in [0.70, 1.15], and *"> 1.15 is the bigger-on-the-inside
// failure"*. The item states NO per-mesh bar — the 0.6 m per-mesh predicate is an instrument this
// piece invented, and saying so is part of naming it. But N1's subject is unambiguous: the failure
// it exists to catch is inside geometry that does not fit inside the building. A mesh that is
// PARTLY through the wall is partly outside the building, and a predicate that scores it zero
// cannot see the failure N1 is about.
//
// **This round measures and publishes OVERHANG**, which is also the round-4 verdict's predicate
// and the round-5 census's own published prose. CLEARANCE is published beside it, named, so the
// two rounds' numbers can be reconciled instead of argued about.
const OUT_TOL_M = 0.6;
let zeroMeshRooms = [], roomsRead = 0, totalMeshes = 0;
const P = {
  overhang: { meshes: 0, rooms: new Set(), byClass: {}, worst: null, rows: [] },
  clearance: { meshes: 0, rooms: new Set(), byClass: {}, worst: null, rows: [] },
};
let lampsOut = 0; const lampRooms = new Set(); let hearthsOut = 0, worstLamp = null;
for (const id of ids) {
  const rec = I[id];
  if (!rec || !rec.bounds_m) continue;
  const bx = rec.bounds_m.x, bz = rec.bounds_m.z;
  for (const Lt of rec.lights || []) {
    const p = Lt.pos || [0, 1.4, 0];
    const d = Math.hypot(Math.max(bx[0] - p[0], p[0] - bx[1], 0), Math.max(bz[0] - p[2], p[2] - bz[1], 0));
    if (d > 1e-6) {
      lampsOut++; lampRooms.add(id);
      if (Lt.kind === 'hearth') hearthsOut++;
      if (!worstLamp || d > worstLamp.out_m) worstLamp = { room: id, id: Lt.id, kind: Lt.kind, out_m: +d.toFixed(2) };
    }
  }
  const root = new THREE.Group();
  // THE SIGNATURE IS (root, rec). Getting it wrong is how a census reads nothing and passes.
  if (SELF_BREAK) IN.buildInterior(rec); else IN.buildInterior(root, rec);
  let seen = 0;
  const box = new THREE.Box3();
  root.traverse((m) => {
    if (!m.isMesh || !m.geometry) return;
    seen++;
    m.updateWorldMatrix(true, false);
    box.setFromObject(m);
    const ovr = Math.max(Math.max(bx[0] - box.min.x, box.max.x - bx[1]), Math.max(bz[0] - box.min.z, box.max.z - bz[1]));
    const clr = Math.hypot(Math.max(bx[0] - box.max.x, box.min.x - bx[1], 0), Math.max(bz[0] - box.max.z, box.min.z - bz[1], 0));
    let node = m, label = m.name || '';
    while (node && !label) { node = node.parent; label = node ? (node.name || '') : ''; }
    const cls = label.includes(':') ? label.split(':')[0] : (label || 'unnamed');
    for (const [key, d] of [['overhang', ovr], ['clearance', clr]]) {
      if (d <= OUT_TOL_M) continue;
      const t = P[key];
      t.meshes++; t.rooms.add(id); t.byClass[label] = (t.byClass[label] || 0) + 1;
      if (!t.worst || d > t.worst.out_m) t.worst = { room: id, label, cls, out_m: +d.toFixed(2) };
      if (t.rows.length < 200) t.rows.push({ room: id, label, out_m: +d.toFixed(2) });
    }
  });
  totalMeshes += seen;
  if (seen === 0) zeroMeshRooms.push(id); else roomsRead++;
}
out.probe = {
  rooms_with_meshes: roomsRead, rooms_with_zero_meshes: zeroMeshRooms.length,
  zero_mesh_rooms: zeroMeshRooms.slice(0, 20), meshes_traversed: totalMeshes,
  assertion: 'a room that traverses zero meshes is a PROBE FAILURE, not a clean result',
};
out.P = {
  tolerance_m: OUT_TOL_M,
  predicate_this_round_publishes: 'OVERHANG',
  why: 'RI-WLD13 N1 is footprint containment; the failure it exists to catch is inside geometry that does not fit inside the building. CLEARANCE scores a mesh 1.9 m through a wall as zero, so it cannot see that failure. The item states no per-mesh bar — the 0.6 m predicate is this piece\'s own instrument — and this round names which one it is using rather than describing one and computing the other.',
  overhang: { meshes: P.overhang.meshes, rooms: P.overhang.rooms.size, by_label: P.overhang.byClass, worst: P.overhang.worst },
  clearance: { meshes: P.clearance.meshes, rooms: P.clearance.rooms.size, by_label: P.clearance.byClass, worst: P.clearance.worst },
};
out.L = {
  what: 'authored lights[].pos outside their own room bounds_m — the positions render/interior.js draws and sim/stealth/system.js#syncInteriorLights() feeds the detection model',
  lamps_outside_their_room: lampsOut, rooms: lampRooms.size, hearths: hearthsOut, worst: worstLamp,
};
out.join = {
  rooms: join.rooms, doors_moved: join.doors_moved, doors_slid_along_wall: join.doors_slid_along_wall || 0,
  entry_sides_rotated: join.entry_sides_rotated || 0, rotated: join.rotated || [],
  doorsteps_moved: join.doorsteps_moved,
  doorsteps_standable_own_door: join.doorsteps_standable_own_door,
  doorsteps_standable_other_door: join.doorsteps_standable_other_door,
  doorsteps_standable_no_door: join.doorsteps_standable_no_door,
  doorsteps_not_standable: join.doorsteps_not_standable,
  doorsteps_unresolved: join.doorsteps_unresolved,
  lamps: join.lamps, lamps_moved: join.lamps_moved,
};

if (zeroMeshRooms.length) out.findings.push(`PROBE FAILURE: ${zeroMeshRooms.length} room(s) traversed zero meshes — this census read nothing`);

const jsonPath = argOf('--json', 'reports/w1-04-r6/census.json');
fs.mkdirSync(path.dirname(path.join(ROOT, jsonPath)), { recursive: true });
fs.writeFileSync(path.join(ROOT, jsonPath), JSON.stringify(out, null, 2));

console.log(`w1-04-r6-census @ ${out.commit}${SELF_BREAK ? '  [--self-break]' : ''}`);
console.log(`  E enumeration: ${out.E.reached_by_this_census} of ${out.E.interior_records} records reached; ${out.E.orphans.length} orphan(s): ${out.E.orphans.map((o) => `${o.interior}(${o.settlement})`).join(', ') || 'none'}`);
console.log(`  S standability: ${out.S.tested} tested, ${out.S.inside_a_footprint} inside a footprint, ${out.S.in_a_wall_slab} in a wall slab, ${out.S.horizontal_vs_cell_disagreements} predicate disagreements`);
console.log(`  R re-entry:     ${out.R.back_in_the_room_you_left} own / ${out.R.into_a_different_building} other / ${out.R.into_nothing} nothing, over ${out.R.records}`);
console.log(`  P props:        OVERHANG ${out.P.overhang.meshes} meshes in ${out.P.overhang.rooms} rooms · CLEARANCE ${out.P.clearance.meshes} in ${out.P.clearance.rooms}  (published: ${out.P.predicate_this_round_publishes})`);
console.log(`  L lamps:        ${out.L.lamps_outside_their_room} outside their room in ${out.L.rooms} rooms`);
console.log(`  probe:          ${out.probe.meshes_traversed} meshes over ${out.probe.rooms_with_meshes} rooms, ${out.probe.rooms_with_zero_meshes} rooms read NOTHING`);
console.log(`  join:           ${out.join.doors_moved} doors moved, ${out.join.doors_slid_along_wall} slid along their wall, ${out.join.entry_sides_rotated} entry sides rotated`);
console.log(`  -> ${jsonPath}`);

if (out.findings.length) {
  for (const f of out.findings) console.error(`FINDING: ${f}`);
  process.exit(1);
}
if (SELF_BREAK) {
  console.error('SELF-BREAK FAILED: the census read the rooms correctly even with the wrong buildInterior() arity.');
  process.exit(1);
}
