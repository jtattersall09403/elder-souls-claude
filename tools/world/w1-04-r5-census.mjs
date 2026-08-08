#!/usr/bin/env node
/*
 * W1-04 round 5 — THE OFFLINE CENSUS. Bare Node, no browser, no engine.
 *
 * It measures the four things the round-4 verdict said were wrong, off the SHIPPED derivation
 * (`planSettlement()` + `applyInteriorBounds()`) and off the BUILT scene graph — not off the JSON.
 *
 *   D  the doorstep      — is `continuity.exterior_spawn` inside a drawn building footprint?
 *                          and is the door still within `DOOR_REACH_M` of it once you are out?
 *   L  the lamps         — is an authored `lights[].pos` outside its own room's `bounds_m`?
 *   P  the props         — is a built mesh more than `OUT_TOL_M` outside its own room?
 *   R  the regressions    — unique items and NPC anchors, which round 4 got right and this round
 *                          must not break.
 *
 * A PROBE THAT READS NOTHING AND PASSES IS THIS PROJECT'S MOST COMMON FAILURE. The round-4
 * critic's first census called `buildInterior(rec)` instead of `buildInterior(root, rec)`,
 * traversed 0 meshes in 115 of 115 rooms and reported a clean "nothing outside the room". So:
 * every room MUST traverse meshes, and a room that traverses none is a PROBE FAILURE that exits
 * non-zero and is named in the report. Run with `--self-break` to watch that assertion go red.
 *
 * Exits 1 if any of D/L/P is non-zero, or if the probe read nothing. Artifact:
 * `reports/w1-04-r5/census.json`.
 */
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'reports/w1-04-r5');
fs.mkdirSync(OUT, { recursive: true });

const ARG = new Set(process.argv.slice(2));
const SELF_BREAK = ARG.has('--self-break');          // read nothing on purpose; the assertion must fire
const NO_JOIN = ARG.has('--no-join');                // delete-the-fix: skip applyInteriorBounds entirely
const NO_DOORSTEP = ARG.has('--no-doorstep');        // delete-the-fix: keep the joined bounds, drop the doorstep re-derivation
const NO_LAMPS = ARG.has('--no-lamp-clamp');         // delete-the-fix: keep everything else, drop the lamp clamp

const THREE = await import(path.join(ROOT, 'game/vendor/three/three.module.js'));
const EX = await import(path.join(ROOT, 'game/src/render/exterior.js'));
const IN = await import(path.join(ROOT, 'game/src/render/interior.js'));

/** How far outside its own room a mesh has to reach before it is a defect. The round-4 verdict's number. */
const OUT_TOL_M = 0.6;
/** `sim/settlement.js` DOOR_REACH_M — the door has to still be in reach from the doorstep. */
const DOOR_REACH_M = 2.6;

function loadData() {
  const S = {}, I = {};
  const sdir = path.join(ROOT, 'game/data/world/settlements');
  for (const f of fs.readdirSync(sdir)) if (f.endsWith('.json')) { const d = JSON.parse(fs.readFileSync(path.join(sdir, f), 'utf8')); if (d.id) S[d.id] = d; }
  const idir = path.join(ROOT, 'game/data/world/interiors');
  for (const f of fs.readdirSync(idir)) if (f.endsWith('.json')) { const d = JSON.parse(fs.readFileSync(path.join(idir, f), 'utf8')); if (d.id) I[d.id] = d; }
  return { S, I };
}

const { S, I } = loadData();
const insideBuilding_ = (plan, sp) => EX.insideBuilding(plan, sp[0], sp[2], 0);
const docs = Object.values(S);
const plans = docs.map((d) => EX.planSettlement(d, I));
let join = null;
if (!NO_JOIN) {
  join = EX.applyInteriorBounds(plans, I, docs, {
    doorstep: !NO_DOORSTEP,
    lamps: !NO_LAMPS,
  });
}

const out = {
  tool: 'tools/world/w1-04-r5-census.mjs',
  when: new Date().toISOString(),
  commit: process.env.W1_04_COMMIT || null,
  arms: { no_join: NO_JOIN, no_doorstep: NO_DOORSTEP, no_lamp_clamp: NO_LAMPS, self_break: SELF_BREAK },
  join_report: join ? { rooms: join.rooms, limited: join.rooms_limited_by_the_plan, spawns_moved: join.spawns_moved, doorsteps_moved: join.doorsteps_moved, doorsteps_unresolved: join.doorsteps_unresolved, lamps_moved: join.lamps_moved } : null,
  D: {}, L: {}, P: {}, R: {}, probe: {}, findings: [],
};
const save = () => fs.writeFileSync(path.join(OUT, 'census.json'), JSON.stringify(out, null, 2));
save();

// ==================================================================================================
// D — THE DOORSTEP. Where does the body stand when it comes out?
// ==================================================================================================
{
  const rows = [];
  let insideAny = 0, insideOwn = 0, doorAtCentre = 0, outOfReach = 0, n = 0;
  // THE BLIND SPOT THIS PROBE HAD, WRITTEN DOWN. The loop below walks PLAN buildings, so an
  // interior whose `continuity.building` is not in any settlement document is invisible to it —
  // and three are (`thorn-house-0`, `barge-hold`, `writ-house`). This census reported a clean
  // "0 of 112 doorsteps inside a building" while `thorn-house-0`'s doorstep stood inside
  // `thorn-gate`; the LIVE sweep found it, because it asked the body instead of the plan. The
  // orphans are enumerated first and counted in the same totals.
  const claimed = new Set();
  for (const plan of plans) for (const b of plan.buildings) if (b.interior) claimed.add(b.interior);
  const planFor = new Map(plans.map((p) => [p.id, p]));
  for (const id of Object.keys(I).sort()) {
    const rec = I[id];
    if (claimed.has(id) || !rec || !rec.continuity || !Array.isArray(rec.continuity.exterior_spawn)) continue;
    const plan = planFor.get(rec.settlement);
    if (!plan) { rows.push({ building: rec.continuity.building || null, interior: id, settlement: rec.settlement, orphan: true, no_plan: true, inside: null }); continue; }
    n++;
    const sp = rec.continuity.exterior_spawn;
    const hit = insideBuilding_(plan, sp);
    if (hit) insideAny++;
    rows.push({ building: rec.continuity.building || null, interior: id, settlement: rec.settlement, orphan: true, spawn: [+sp[0].toFixed(2), +sp[2].toFixed(2)], inside: hit, inside_own: false, door_to_centre_m: null, door_to_doorstep_m: null });
  }
  for (let pi = 0; pi < plans.length; pi++) {
    const plan = plans[pi];
    const doc = docs[pi];
    for (const b of plan.buildings) {
      if (!b.enterable || !b.interior) continue;
      const rec = I[b.interior];
      if (!rec || !rec.continuity || !Array.isArray(rec.continuity.exterior_spawn)) continue;
      n++;
      const sp = rec.continuity.exterior_spawn;
      const hit = EX.insideBuilding(plan, sp[0], sp[2], 0);
      // the door the SIM's reach table will use — the raw document's building record
      const raw = (doc.buildings || []).find((r) => r.id === b.id);
      const door = (raw && raw.door) || b.door || null;
      const dCentre = door ? Math.hypot(door[0] - b.x, door[2] - b.z) : null;
      const dReach = door ? Math.hypot(door[0] - sp[0], door[2] - sp[2]) : null;
      if (hit) { insideAny++; if (hit === b.id) insideOwn++; }
      if (dCentre !== null && dCentre < 0.05) doorAtCentre++;
      if (dReach !== null && dReach > DOOR_REACH_M) outOfReach++;
      rows.push({
        building: b.id, interior: b.interior, settlement: plan.id,
        drawn_footprint_m: b.drawn_footprint_m, entry_side: b.entry_side || null,
        spawn: [+sp[0].toFixed(2), +sp[2].toFixed(2)],
        inside: hit, inside_own: hit === b.id,
        door_to_centre_m: dCentre === null ? null : +dCentre.toFixed(2),
        door_to_doorstep_m: dReach === null ? null : +dReach.toFixed(2),
      });
    }
  }
  out.D = {
    what: 'is the declared exterior doorstep inside a drawn building footprint, and is the door still in reach from it',
    buildings: n,
    doorsteps_inside_a_building: insideAny,
    doorsteps_inside_the_building_they_belong_to: insideOwn,
    doors_at_the_building_centre: doorAtCentre,
    doorsteps_with_the_door_out_of_reach: outOfReach,
    orphan_interiors_no_plan_building: rows.filter((r) => r.orphan).length,
    door_reach_m: DOOR_REACH_M,
    offenders: rows.filter((r) => r.inside).slice(0, 40),
    out_of_reach: rows.filter((r) => r.door_to_doorstep_m !== null && r.door_to_doorstep_m > DOOR_REACH_M).slice(0, 40),
  };
  if (insideAny) out.findings.push(`D: ${insideAny} of ${n} doorsteps are inside a drawn building footprint`);
  if (outOfReach) out.findings.push(`D: ${outOfReach} of ${n} doorsteps cannot reach their own door (> ${DOOR_REACH_M} m)`);
  save();
}

// ==================================================================================================
// L / P / R — build every room and measure the built meshes against the room that now exists.
// ==================================================================================================
{
  const lampRows = [], meshRows = [], zeroMeshRooms = [];
  let lampsOut = 0, lampRooms = new Set(), hearthsOut = 0, worstLamp = null;
  let meshesOut = 0, meshRooms = new Set(), byClass = {};
  let uniquesOut = 0, anchorsOut = 0, anchorRooms = 0;
  let roomsRead = 0, totalMeshes = 0;

  const ids = Object.keys(I).sort();
  for (const id of ids) {
    const rec = I[id];
    if (!rec || !rec.bounds_m) continue;
    const bx = rec.bounds_m.x, bz = rec.bounds_m.z;

    // ---- L: the authored lamps, at the position the RENDERER and `syncInteriorLights()` both use
    for (const Lt of rec.lights || []) {
      const p = Lt.pos || [0, 1.4, 0];
      const dx = Math.max(bx[0] - p[0], p[0] - bx[1], 0);
      const dz = Math.max(bz[0] - p[2], p[2] - bz[1], 0);
      const d = Math.hypot(dx, dz);
      if (d > 1e-6) {
        lampsOut++; lampRooms.add(id);
        if (Lt.kind === 'hearth') hearthsOut++;
        if (!worstLamp || d > worstLamp.out_m) worstLamp = { room: id, id: Lt.id, kind: Lt.kind, out_m: +d.toFixed(2) };
        if (lampRows.length < 200) lampRows.push({ room: id, id: Lt.id, kind: Lt.kind, snuffable: Lt.snuffable !== false, out_m: +d.toFixed(3) });
      }
    }

    // ---- P: every mesh the room actually builds
    const root = new THREE.Group();
    // THE SIGNATURE IS (root, rec). Getting it wrong is how a census reads nothing and passes.
    const summary = SELF_BREAK ? IN.buildInterior(rec) : IN.buildInterior(root, rec);
    let seen = 0;
    const box = new THREE.Box3();
    root.traverse((m) => {
      if (!m.isMesh || !m.geometry) return;
      seen++;
      m.updateWorldMatrix(true, false);
      box.setFromObject(m);
      const dx = Math.max(bx[0] - box.max.x, box.min.x - bx[1], 0);
      const dz = Math.max(bz[0] - box.max.z, box.min.z - bz[1], 0);
      const d = Math.hypot(dx, dz);
      if (d <= OUT_TOL_M) return;
      // Which object it belongs to — walk up to the first named ancestor.
      let node = m, label = m.name || '';
      while (node && !label) { node = node.parent; label = node ? (node.name || '') : ''; }
      const cls = label.includes(':') ? label.split(':')[0] : (label || 'unnamed');
      meshesOut++; meshRooms.add(id);
      byClass[cls] = (byClass[cls] || 0) + 1;
      if (meshRows.length < 500) meshRows.push({ room: id, label, cls, out_m: +d.toFixed(2) });
    });
    totalMeshes += seen;
    if (seen === 0) zeroMeshRooms.push(id); else roomsRead++;

    // ---- R: the two things round 4 got right
    const uq = summary && summary.placements && summary.placements.unique;
    if (uq && uq.pos) {
      const dx = Math.max(bx[0] - uq.pos[0], uq.pos[0] - bx[1], 0);
      const dz = Math.max(bz[0] - uq.pos[2], uq.pos[2] - bz[1], 0);
      if (Math.hypot(dx, dz) > 1e-6) uniquesOut++;
    }
    // `sim/npc.js#anchorFor()`'s rule: the half-extent less a 1.2 m inset must not collapse.
    const hw = (bx[1] - bx[0]) / 2, hd = (bz[1] - bz[0]) / 2;
    anchorRooms++;
    if (hw - 1.2 <= 0 || hd - 1.2 <= 0) anchorsOut++;
  }

  out.probe = {
    rooms_with_meshes: roomsRead, rooms_with_zero_meshes: zeroMeshRooms.length,
    zero_mesh_rooms: zeroMeshRooms.slice(0, 20), meshes_traversed: totalMeshes,
    assertion: 'a room that traverses zero meshes is a PROBE FAILURE, not a clean result',
  };
  out.L = {
    what: 'authored lights[].pos outside their own room bounds_m — the positions render/interior.js draws and sim/stealth/system.js#syncInteriorLights() feeds the detection model',
    lamps_outside: lampsOut, rooms: lampRooms.size, hearths_outside: hearthsOut, worst: worstLamp,
    offenders: lampRows,
  };
  out.P = {
    what: `built meshes more than ${OUT_TOL_M} m outside their own room`,
    meshes_outside: meshesOut, rooms: meshRooms.size, by_class: byClass, offenders: meshRows,
  };
  out.R = {
    unique_items_outside_their_room: uniquesOut,
    rooms_where_the_1_2m_npc_anchor_inset_collapses: anchorsOut,
    rooms_checked: anchorRooms,
  };
  if (zeroMeshRooms.length) out.findings.push(`PROBE FAILURE: ${zeroMeshRooms.length} room(s) traversed zero meshes — this census read nothing`);
  if (lampsOut) out.findings.push(`L: ${lampsOut} authored lamps in ${lampRooms.size} rooms stand outside their own walls (${hearthsOut} hearths)`);
  if (meshesOut) out.findings.push(`P: ${meshesOut} meshes in ${meshRooms.size} rooms sit more than ${OUT_TOL_M} m outside their room`);
  if (uniquesOut) out.findings.push(`R: ${uniquesOut} unique items outside their room — a REGRESSION on round 4`);
  if (anchorsOut) out.findings.push(`R: the 1.2 m NPC anchor inset collapses in ${anchorsOut} rooms — a REGRESSION on round 4`);
  save();
}

const bad = out.findings.length > 0;
console.log(`W1-04 r5 census  arms=${JSON.stringify(out.arms)}`);
console.log(`  D  doorsteps inside a building: ${out.D.doorsteps_inside_a_building} / ${out.D.buildings}   (own building: ${out.D.doorsteps_inside_the_building_they_belong_to}, door at centre: ${out.D.doors_at_the_building_centre}, door out of reach: ${out.D.doorsteps_with_the_door_out_of_reach})`);
console.log(`  L  lamps outside their room:    ${out.L.lamps_outside} in ${out.L.rooms} rooms  (${out.L.hearths_outside} hearths)  worst ${out.L.worst ? out.L.worst.out_m + ' m' : '-'}`);
console.log(`  P  meshes > ${OUT_TOL_M} m outside:      ${out.P.meshes_outside} in ${out.P.rooms} rooms   ${JSON.stringify(out.P.by_class)}`);
console.log(`  R  uniques out ${out.R.unique_items_outside_their_room}, anchor inset collapses ${out.R.rooms_where_the_1_2m_npc_anchor_inset_collapses} / ${out.R.rooms_checked}`);
console.log(`  probe: ${out.probe.meshes_traversed} meshes over ${out.probe.rooms_with_meshes} rooms, ${out.probe.rooms_with_zero_meshes} rooms read NOTHING`);
for (const f of out.findings) console.log(`  ! ${f}`);
console.log(`  -> ${path.relative(ROOT, path.join(OUT, 'census.json'))}`);
process.exit(bad ? 1 : 0);
