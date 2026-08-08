#!/usr/bin/env node
/*
 * W1-04 ROUND-5 CRITIC — the offline instrument, written with fresh context.
 *
 * Four questions the round's own tools do not answer, each measured here independently of
 * `tools/world/w1-04-r5-census.mjs` (which I read only to reconcile a number with it, in P).
 *
 *   D  THE DOORSTEP, over ALL 115 records rather than the 113 the census enumerates.
 *      `insideBuilding()` on every `continuity.exterior_spawn`, in every arm.
 *
 *   R  RE-ENTRY, WHICH IS NOT "IS A DOOR IN REACH". `sim/settlement.js#doorAt()` returns the
 *      NEAREST door of the town within `DOOR_REACH_M`, and `stepSettlement` then enters THAT
 *      one. So the question is not "is some door in reach" — the round's live tool counts that
 *      and got 106 — but "is the door in reach the door you just came out of". Reimplemented
 *      here from the shipped constant, not imported from the round's rollup.
 *
 *   P  THE PROP COUNT, under BOTH predicates, because the round's published definition and the
 *      round's implemented definition are not the same predicate:
 *        OVERHANG  — how far the mesh's box REACHES past the wall.  max over axes.
 *                    This is the round-4 critic's, and it is what the round-5 status file's
 *                    words say ("reaches more than 0.6 m outside its own room's bounds_m").
 *        CLEARANCE — how far the whole box sits CLEAR of the room.  0 unless the box and the
 *                    room are disjoint. This is what `w1-04-r5-census.mjs` actually computes.
 *      CLEARANCE <= OVERHANG always, so a bench with 1.9 m through the wall scores 0 under the
 *      one the headline was measured with. Both are reported, classified by mesh name.
 *
 *   B  WHAT EACH ENUMERATOR CAN SEE. Rule 11's general form: not "is this field read" but
 *      "which records can this loop reach at all".
 *
 * SELF-BREAK (rule 4): `--self-break` moves every doorstep to its own building's centre and
 * every prop 5 m out. D must go to 115 offenders and P must go non-zero under BOTH predicates.
 * If it does not, this instrument is not measuring what it says and exits non-zero.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const THREE = await import(path.join(ROOT, 'game/vendor/three/three.module.js'));
const EX = await import(path.join(ROOT, 'game/src/render/exterior.js'));
const IN = await import(path.join(ROOT, 'game/src/render/interior.js'));
const ST = await import(path.join(ROOT, 'game/src/sim/settlement.js'));

const ARG = new Set(process.argv.slice(2));
const SELF_BREAK = ARG.has('--self-break');
const OUT_TOL_M = 0.6;
const OUTDIR = path.join(ROOT, 'reports/critic-w1-04-r5');
fs.mkdirSync(OUTDIR, { recursive: true });

const load = (dir) => {
  const o = {};
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    if (!f.endsWith('.json')) continue;
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, dir, f), 'utf8'));
    o[d.id] = d;
  }
  return o;
};

const out = {
  tool: 'tools/world/critic-w1-04-r5-offline.mjs',
  when: new Date().toISOString(),
  commit: process.env.CRITIC_COMMIT || null,
  self_break: SELF_BREAK,
  door_reach_m: ST.DOOR_REACH_M,
  out_tol_m: OUT_TOL_M,
  sections: {}, findings: [],
};
const save = () => fs.writeFileSync(path.join(OUTDIR, 'offline.json'), JSON.stringify(out, null, 2));

/** One full pass of the shipped derivation, from fresh copies of the data every time. */
function pass(opts) {
  const S = load('game/data/world/settlements');
  const I = load('game/data/world/interiors');
  const docs = Object.values(S);
  const plans = Object.keys(S).sort().map((id) => EX.planSettlement(S[id], I));
  let join = null;
  if (!opts.noJoin) join = EX.applyInteriorBounds(plans, I, docs, { doorstep: !opts.noDoorstep, lamps: !opts.noLamps });
  return { S, I, docs, plans, join };
}

/* ---------------------------------------------------------------------------------------------
 * D — the doorstep, over ALL 115 records.
 * -------------------------------------------------------------------------------------------*/
function sectionD(w, breakIt) {
  const planFor = new Map(w.plans.map((p) => [p.id, p]));
  const rows = [];
  for (const rec of Object.values(w.I)) {
    const c = rec.continuity || {};
    const sp = c.exterior_spawn;
    const plan = planFor.get(rec.settlement) || null;
    if (breakIt && plan && Array.isArray(sp)) {
      // SELF-BREAK: put the doorstep at its own building's centre.
      const b = plan.buildings.find((x) => x.id === c.building);
      if (b) { sp[0] = b.x; sp[2] = b.z; }
    }
    const hit = plan && Array.isArray(sp) ? EX.insideBuilding(plan, sp[0], sp[2], 0) : null;
    rows.push({
      id: rec.id, settlement: rec.settlement, building: c.building || null,
      has_plan: !!plan,
      spawn: Array.isArray(sp) ? [+sp[0].toFixed(2), +sp[2].toFixed(2)] : null,
      inside_building: hit || null,
      inside_its_own: !!(hit && hit === c.building),
    });
  }
  const withPlan = rows.filter((r) => r.has_plan);
  return {
    what: 'is continuity.exterior_spawn inside a drawn building footprint — over ALL interior records, not only those whose building is in a plan',
    records_total: rows.length,
    records_with_a_settlement_plan: withPlan.length,
    records_with_NO_settlement_plan: rows.length - withPlan.length,
    no_plan_ids: rows.filter((r) => !r.has_plan).map((r) => r.id),
    doorsteps_inside_a_building: withPlan.filter((r) => r.inside_building).length,
    doorsteps_inside_their_own_building: withPlan.filter((r) => r.inside_its_own).length,
    offenders: withPlan.filter((r) => r.inside_building).slice(0, 20),
  };
}

/* ---------------------------------------------------------------------------------------------
 * R — re-entry. Reimplements doorAt() from the shipped constant.
 * -------------------------------------------------------------------------------------------*/
function sectionR(w) {
  // The door table exactly as SettlementSystem's constructor builds it.
  const doors = new Map();
  for (const d of w.docs) {
    const rows = [];
    for (const b of d.buildings || []) {
      if (b.kind !== 'interior' || !b.door) continue;
      rows.push({ building: b.id, interior: b.interior, door: b.door });
    }
    doors.set(d.id, rows);
  }
  const doorAt = (sid, x, z) => {
    const rows = doors.get(sid);
    if (!rows) return null;
    let best = null, bd = Infinity;
    for (const r of rows) {
      const dd = Math.hypot(r.door[0] - x, r.door[2] - z);
      if (dd <= ST.DOOR_REACH_M && dd < bd) { bd = dd; best = r; }
    }
    return best ? { ...best, dist_m: +bd.toFixed(3) } : null;
  };
  const rows = [];
  for (const rec of Object.values(w.I)) {
    const c = rec.continuity || {};
    const sp = c.exterior_spawn;
    if (!Array.isArray(sp)) continue;
    const hit = doorAt(rec.settlement, sp[0], sp[2]);
    rows.push({
      id: rec.id, settlement: rec.settlement,
      town_has_a_door_table: doors.has(rec.settlement),
      door_in_reach: hit ? hit.interior : null,
      dist_m: hit ? hit.dist_m : null,
      re_enters_the_room_you_left: !!(hit && hit.interior === rec.id),
    });
  }
  // How crowded is the door table after the derivation? Two doors inside DOOR_REACH_M of each
  // other is a doorstep that can reach the wrong house.
  let crowded = 0; const pairs = [];
  for (const [sid, rs] of doors) {
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const d = Math.hypot(rs[i].door[0] - rs[j].door[0], rs[i].door[2] - rs[j].door[2]);
      if (d <= ST.DOOR_REACH_M) { crowded++; if (pairs.length < 25) pairs.push({ settlement: sid, a: rs[i].interior, b: rs[j].interior, apart_m: +d.toFixed(2) }); }
    }
  }
  return {
    what: 'from the doorstep, which interior does sim/settlement.js#doorAt() hand to `interact`',
    records: rows.length,
    no_door_in_reach: rows.filter((r) => !r.door_in_reach).length,
    a_door_in_reach_ANY: rows.filter((r) => r.door_in_reach).length,
    re_enters_the_room_you_left: rows.filter((r) => r.re_enters_the_room_you_left).length,
    re_enters_A_DIFFERENT_ROOM: rows.filter((r) => r.door_in_reach && !r.re_enters_the_room_you_left).length,
    wrong_door_rows: rows.filter((r) => r.door_in_reach && !r.re_enters_the_room_you_left),
    no_reach_rows: rows.filter((r) => !r.door_in_reach).map((r) => ({ id: r.id, settlement: r.settlement, town_has_a_door_table: r.town_has_a_door_table })),
    door_pairs_within_reach_of_each_other: crowded,
    door_pairs: pairs,
  };
}

/* ---------------------------------------------------------------------------------------------
 * P — the props, under BOTH predicates.
 * -------------------------------------------------------------------------------------------*/
function sectionP(w, breakIt) {
  let overhang = 0, clearance = 0; const ohRooms = new Set(), clRooms = new Set();
  const ohClass = {}, clClass = {}; let meshes = 0, zero = 0;
  const worstRows = [];
  for (const rec of Object.values(w.I)) {
    const bm = rec.bounds_m; if (!bm || !bm.x || !bm.z) continue;
    const bx = bm.x, bz = bm.z;
    const root = new THREE.Group();
    IN.buildInterior(root, rec);
    if (breakIt) root.traverse((m) => { if (m.isMesh) m.position.x += 5; });
    root.updateMatrixWorld(true);
    let seen = 0; const box = new THREE.Box3();
    root.traverse((m) => {
      if (!m.isMesh || !m.geometry) return;
      seen++;
      box.setFromObject(m);
      // OVERHANG: how far the box REACHES past the wall (the round-4 critic's, and the words
      // the round-5 status file uses).
      const ox = Math.max(bx[0] - box.min.x, box.max.x - bx[1]);
      const oz = Math.max(bz[0] - box.min.z, box.max.z - bz[1]);
      const oh = Math.max(ox, oz);
      // CLEARANCE: how far the whole box sits CLEAR of the room (what w1-04-r5-census.mjs
      // computes). Zero whenever the box still overlaps the room at all.
      const cx = Math.max(bx[0] - box.max.x, box.min.x - bx[1], 0);
      const cz = Math.max(bz[0] - box.max.z, box.min.z - bz[1], 0);
      const cl = Math.hypot(cx, cz);
      let node = m, label = m.name || '';
      while (node && !label) { node = node.parent; label = node ? (node.name || '') : ''; }
      const cls = label.includes(':') ? label.split(':')[0] : (label || 'unnamed');
      if (oh > OUT_TOL_M) {
        overhang++; ohRooms.add(rec.id); ohClass[cls] = (ohClass[cls] || 0) + 1;
        if (worstRows.length < 60) worstRows.push({ room: rec.id, label, cls, overhang_m: +oh.toFixed(2), clearance_m: +cl.toFixed(2) });
      }
      if (cl > OUT_TOL_M) { clearance++; clRooms.add(rec.id); clClass[cls] = (clClass[cls] || 0) + 1; }
    });
    meshes += seen;
    if (seen === 0) zero++;
  }
  return {
    what: `meshes more than ${OUT_TOL_M} m outside their room, under two predicates`,
    meshes_traversed: meshes, rooms_that_traversed_nothing: zero,
    OVERHANG_reaches_past_the_wall: { meshes: overhang, rooms: ohRooms.size, by_class: ohClass },
    CLEARANCE_sits_wholly_clear: { meshes: clearance, rooms: clRooms.size, by_class: clClass },
    worst_overhang_rows: worstRows.sort((a, b) => b.overhang_m - a.overhang_m).slice(0, 25),
  };
}

/* ---------------------------------------------------------------------------------------------
 * B — what each enumerator can reach.
 * -------------------------------------------------------------------------------------------*/
function sectionB(w) {
  const claimed = new Set();
  for (const p of w.plans) for (const b of p.buildings) if (b.interior) claimed.add(b.interior);
  const planFor = new Map(w.plans.map((p) => [p.id, p]));
  const all = Object.keys(w.I);
  const orphans = all.filter((id) => !claimed.has(id));
  const orphansHandled = orphans.filter((id) => planFor.has(w.I[id].settlement));
  const orphansSkipped = orphans.filter((id) => !planFor.has(w.I[id].settlement));
  const enterable = new Set();
  for (const p of w.plans) for (const b of p.buildings) if (b.enterable && b.interior) enterable.add(b.interior);
  return {
    what: 'which interior records each loop in this piece can reach at all (rule 11, general form)',
    interior_records: all.length,
    reachable_by_a_loop_over_plan_buildings: claimed.size,
    orphans_not_in_any_plan: orphans.length,
    orphans_the_round5_orphan_pass_HANDLES: orphansHandled,
    orphans_the_round5_orphan_pass_SKIPS_because_their_settlement_has_no_plan: orphansSkipped,
    reachable_by_check_building_fits_room: enterable.size,
    note: 'applyInteriorBounds() orphan pass does `const plan = planFor.get(rec.settlement); if (!plan) continue;` BEFORE counting, so an orphan in a settlement with no document is invisible to it AND to its own count.',
  };
}

/* --------------------------------------------------------------------------------------------*/
const shipped = pass({});
out.sections.D_doorstep = sectionD(shipped, false);
out.sections.R_reentry = sectionR(shipped);
out.sections.P_props = sectionP(shipped, false);
out.sections.B_enumerators = sectionB(shipped);
save();

// The arms, for rule 6 — each one a fresh load of the data.
const cutDoor = pass({ noDoorstep: true });
const cutLamp = pass({ noLamps: true });
out.sections.ARM_doorstep_cut = { D: sectionD(cutDoor, false), R: sectionR(cutDoor), P: sectionP(cutDoor, false).OVERHANG_reaches_past_the_wall };
out.sections.ARM_lamps_cut = { P: sectionP(cutLamp, false) };
save();

// --- rule 4, against myself -------------------------------------------------------------------
if (SELF_BREAK) {
  const w = pass({});
  const d = sectionD(w, true);
  const p = sectionP(w, true);
  out.sections.SELF_BREAK = { D: d, P: p };
  const dRed = d.doorsteps_inside_a_building > 100;
  const pRed = p.OVERHANG_reaches_past_the_wall.meshes > 0 && p.CLEARANCE_sits_wholly_clear.meshes > 0;
  console.log(`SELF-BREAK  D: ${d.doorsteps_inside_a_building} doorsteps inside a building (want >100) -> ${dRed ? 'RED' : 'NOT RED'}`);
  console.log(`SELF-BREAK  P: overhang ${p.OVERHANG_reaches_past_the_wall.meshes}, clearance ${p.CLEARANCE_sits_wholly_clear.meshes} (want both >0) -> ${pRed ? 'RED' : 'NOT RED'}`);
  save();
  if (!dRed || !pRed) { console.error('SELF-BREAK FAILED: this instrument does not go red when the thing it measures is broken.'); process.exit(1); }
  console.log('SELF-BREAK: both arms went red. The instrument can fail.');
  process.exit(0);
}

const D = out.sections.D_doorstep, R = out.sections.R_reentry, P = out.sections.P_props, B = out.sections.B_enumerators;
if (P.rooms_that_traversed_nothing) out.findings.push(`PROBE FAILURE: ${P.rooms_that_traversed_nothing} rooms traversed zero meshes`);
if (D.doorsteps_inside_a_building) out.findings.push(`D: ${D.doorsteps_inside_a_building} doorsteps inside a drawn building`);
if (R.re_enters_A_DIFFERENT_ROOM) out.findings.push(`R: ${R.re_enters_A_DIFFERENT_ROOM} doorsteps put a DIFFERENT room's door in reach — pressing interact there enters the wrong building`);
if (R.no_door_in_reach) out.findings.push(`R: ${R.no_door_in_reach} doorsteps have no door in reach at all`);
if (P.OVERHANG_reaches_past_the_wall.meshes) out.findings.push(`P: ${P.OVERHANG_reaches_past_the_wall.meshes} meshes in ${P.OVERHANG_reaches_past_the_wall.rooms} rooms REACH more than ${OUT_TOL_M} m past their room's wall`);
if (B.orphans_the_round5_orphan_pass_SKIPS_because_their_settlement_has_no_plan.length) {
  out.findings.push(`B: ${B.orphans_the_round5_orphan_pass_SKIPS_because_their_settlement_has_no_plan.join(', ')} are reached by NO loop in this piece`);
}
save();

console.log(`D  doorsteps inside a building: ${D.doorsteps_inside_a_building} of ${D.records_with_a_settlement_plan} (with a plan); ${D.records_with_NO_settlement_plan} records have no plan at all: ${D.no_plan_ids.join(', ')}`);
console.log(`R  re-entry: ${R.re_enters_the_room_you_left} of ${R.records} put THEIR OWN door in reach; ${R.re_enters_A_DIFFERENT_ROOM} put a DIFFERENT room's door in reach; ${R.no_door_in_reach} none at all`);
console.log(`R  door pairs within ${ST.DOOR_REACH_M} m of each other: ${R.door_pairs_within_reach_of_each_other}`);
console.log(`P  OVERHANG >${OUT_TOL_M} m: ${P.OVERHANG_reaches_past_the_wall.meshes} meshes in ${P.OVERHANG_reaches_past_the_wall.rooms} rooms ${JSON.stringify(P.OVERHANG_reaches_past_the_wall.by_class)}`);
console.log(`P  CLEARANCE >${OUT_TOL_M} m: ${P.CLEARANCE_sits_wholly_clear.meshes} meshes in ${P.CLEARANCE_sits_wholly_clear.rooms} rooms`);
console.log(`P  arm: lamp clamp cut -> overhang ${out.sections.ARM_lamps_cut.P.OVERHANG_reaches_past_the_wall.meshes}, clearance ${out.sections.ARM_lamps_cut.P.CLEARANCE_sits_wholly_clear.meshes}`);
console.log(`ARM doorstep cut -> D ${out.sections.ARM_doorstep_cut.D.doorsteps_inside_a_building} inside, R ${out.sections.ARM_doorstep_cut.R.re_enters_the_room_you_left} correct re-entry / ${out.sections.ARM_doorstep_cut.R.re_enters_A_DIFFERENT_ROOM} wrong`);
console.log(`B  ${B.interior_records} records; plan loop reaches ${B.reachable_by_a_loop_over_plan_buildings}; orphan pass handles ${B.orphans_the_round5_orphan_pass_HANDLES.length}, SKIPS ${B.orphans_the_round5_orphan_pass_SKIPS_because_their_settlement_has_no_plan.length}`);
console.log(`\nwrote reports/critic-w1-04-r5/offline.json  findings=${out.findings.length}`);
for (const f of out.findings) console.log(`  - ${f}`);
process.exit(0);
