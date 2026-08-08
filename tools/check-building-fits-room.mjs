#!/usr/bin/env node
// A BUILDING'S OUTSIDE MUST CONTAIN ITS INSIDE. RI-WLD13 N1, as a check that can fail.
//
// WHY THIS IS A CHECK AND NOT A PROBE. Round 3 of W1-04 shrank 54 of 202 exterior footprints to
// stop buildings interpenetrating, and left every interior at the footprint its record declares.
// Nothing in the tree read both halves, so nothing noticed, and the round-3 verdict measured the
// result: **41 of 112 enterable buildings drew an exterior smaller than the room behind their
// door**, worst `blackrose-inn` — a 3.4 m shed you walk into and find a 13.6 m inn. That is the
// one defect in the piece a player meets by doing the ordinary thing, walking up to a door.
//
// The invariant, in the numbers the renderers themselves use (imported, not copied, so the check
// cannot drift away from the code):
//
//     drawn_footprint - SHELL_WALL_T  >=  bounds_m span + ROOM_WALL_T
//
// on every enterable building, where `drawn_footprint` comes from `planSettlement()` and
// `bounds_m` comes from the interior record AFTER `applyInteriorBounds()` — which is exactly what
// `world/province.js#setSettlements()` does at boot, in that order, on those objects.
//
// IT GOES RED. `--self-break` runs the identical assertion with the join skipped, which is the
// tree as it shipped at `9e962a4`, and requires the check to fail; if it passes there, the check
// is not measuring anything and this tool exits non-zero to say so. RULES.md rule 4.
//
//   node tools/check-building-fits-room.mjs [--verbose] [--self-break]
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const has = (f) => args.includes(f);

const EX = await import(path.join(ROOT, 'game/src/render/exterior.js'));

function load(dir) {
  const out = {};
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, dir, f), 'utf8'));
    out[d.id] = d;
  }
  return out;
}

/**
 * One pass of the shipped data path. `join:false` is the world round 3 shipped.
 *
 * `opts` lets `--self-break` cut ONE leg of the join instead of all of it, so the doorstep
 * assertion added in round 5 has a control of its own rather than borrowing the bounds one's.
 */
/**
 * ROUND 6 — ENUMERATE FROM THE INTERIORS, NOT FROM THE PLANS.
 *
 * The round-5 verdict's attack B: this check iterated `plan.buildings` and could therefore not see
 * `thorn-house-0`, `barge-hold` or `writ-house` — three interior records whose
 * `continuity.building` no settlement document contains. It reached 112 of 115 and could not say
 * which three it had missed. It was shipped as the fail-closed assertion that stops the doorstep
 * defect coming back, and it was blind to the same class of record the defect had already hidden
 * in once.
 *
 * The general rule the verdict draws out of it, and it is the useful form of RULES rule 11: the
 * question is not "is this field read" but **"which records can this loop reach at all"**. So the
 * outer loop below is over `Object.keys(interiors)`, every record is accounted for, and a record
 * this check cannot test is REPORTED with its reason rather than skipped.
 */
function run(join, opts) {
  const S = load('game/data/world/settlements');
  const I = load('game/data/world/interiors');
  const plans = Object.keys(S).sort().map((id) => EX.planSettlement(S[id], I));
  if (join) EX.applyInteriorBounds(plans, I, Object.values(S), opts || {});
  const bad = [], doorBad = [], reEntry = [];
  let checked = 0;
  // interior id -> {plan, building}, built from the plans; every interior NOT in this map is an
  // orphan and is counted below by name.
  const placed = new Map();
  const planById = new Map();
  for (const plan of plans) {
    planById.set(plan.id, plan);
    for (const b of plan.buildings) if (b.interior) placed.set(b.interior, { plan, b });
  }
  const orphans = [];
  const seen = new Set();
  for (const id of Object.keys(I).sort()) {
    const rec = I[id];
    const at = placed.get(id);
    if (!at) { orphans.push({ interior: id, settlement: (rec && rec.settlement) || null, in_a_plan: false }); }
    const plan = at ? at.plan : planById.get(rec && rec.settlement);
    // ---- ROUND 5/6: A DOORSTEP MAY NOT BE INSIDE A BUILDING, AND MAY NOT BE IN A WALL ---------
    // The round-4 verdict's blocking gap and the round-5 verdict's. `buildings[].door` was the
    // building's CENTRE on 112 of 112 and every declared `continuity.exterior_spawn` fell inside
    // its own building's wall box, so walking out of a door left you under the roof round 4 had
    // just added. Round 5 fixed containment at ONE FRAME and the collision solver then slid ten
    // bodies indoors, because a point outside the footprint can still be inside the wall slab.
    // Both are asserted here, on the point `leaveInterior()` actually puts the body on.
    const sp = rec && rec.continuity && rec.continuity.exterior_spawn;
    if (plan && Array.isArray(sp)) {
      const hit = EX.insideBuilding(plan, sp[0], sp[2], 0);
      if (hit) doorBad.push(`${id}: the doorstep you are put on when you leave is inside ${hit === (at && at.b.id) ? 'THE BUILDING YOU JUST LEFT' : hit}`);
      else {
        const solids = EX.settlementSolids(plan, 0, 0, 1e9, null);
        const clear = EX.horizontalClearance(solids, sp[0], sp[2]);
        if (clear < EX.BODY_RADIUS_M) {
          doorBad.push(`${id}: the doorstep is outside every footprint but only ${clear.toFixed(3)} m clear of a wall slab, and the body is ${EX.BODY_RADIUS_M} m wide — the collision solver will move it`);
        }
      }
      // ---- ROUND 6: AND THE DOOR IN REACH MUST OPEN THIS BUILDING ------------------------------
      // The round-5 verdict's blocking gap. `doorAt()` returns the NEAREST door, so "a door is in
      // reach" and "your door is in reach" are different questions and only the second one is
      // interior/exterior continuity. Reimplemented here from the settlement document's own rows,
      // which is the array `SettlementSystem`'s reach table holds.
      const doc = S[rec.settlement];
      const rows = ((doc && doc.buildings) || []).filter((r) => r.kind === 'interior' && r.door);
      let near = null, nd = Infinity;
      for (const r of rows) {
        const d = Math.hypot(r.door[0] - sp[0], r.door[2] - sp[2]);
        if (d <= EX.DOOR_REACH_M && d < nd) { nd = d; near = r; }
      }
      if (at) {
        if (near !== rows.find((r) => r.id === at.b.id)) {
          reEntry.push(`${id}: pressing interact on this doorstep opens ${near ? near.interior : 'NOTHING'}, not the room you left`);
        }
      } else {
        // An orphan has no row in any door table, so there is no door of its own to be nearest and
        // no derivation can give it one. Stated by name rather than skipped — that omission is what
        // the round-5 verdict caught the last version of this check doing.
        orphans[orphans.length - 1].reentry = near ? `opens ${near.interior}` : 'opens nothing — no door row anywhere names this interior';
      }
    }
    seen.add(id);
    if (!at) continue;
    const b = at.b;
    if (!b.enterable) continue;
    if (!rec) { bad.push(`${b.id}: enterable, but no interior record ${JSON.stringify(b.interior)} — the door opens on nothing`); continue; }
    if (!rec.bounds_m || !rec.bounds_m.x || !rec.bounds_m.z) { bad.push(`${rec.id}: no bounds_m`); continue; }
    checked++;
    {
      const W = rec.bounds_m.x[1] - rec.bounds_m.x[0];
      const D = rec.bounds_m.z[1] - rec.bounds_m.z[0];
      const availX = b.drawn_footprint_m[0] - EX.SHELL_WALL_T;
      const availZ = b.drawn_footprint_m[1] - EX.SHELL_WALL_T;
      const needX = W + EX.ROOM_WALL_T;
      const needZ = D + EX.ROOM_WALL_T;
      if (availX + 1e-6 < needX || availZ + 1e-6 < needZ) {
        const ratio = ((b.drawn_footprint_m[0] * b.drawn_footprint_m[1]) / (W * D));
        bad.push(`${b.id} (${rec.id}): drawn ${b.drawn_footprint_m[0]}x${b.drawn_footprint_m[1]} m but the room is ${W.toFixed(2)}x${D.toFixed(2)} m — the outside is ${(ratio * 100).toFixed(1)}% of the inside`);
      }
    }
  }
  return { checked, bad, doorBad, reEntry, orphans, records: Object.keys(I).length, reached: seen.size };
}

/* ---- ROUND 6: THE MIRRORS, CHECKED ----------------------------------------------------------
 * `render/exterior.js` must not import `sim/`, so it restates two numbers that live there:
 * `BODY_RADIUS_M` (= `sim/world-collision.js#PLAYER_RADIUS_M`, the radius the collision solver
 * depenetrates the body at) and `DOOR_REACH_M` (= `sim/settlement.js#DOOR_REACH_M`, how close your
 * hand has to be to a door). An unchecked copy of a number is the shape this project has now found
 * five times — two soul ledgers, `magic.gold`, a gold write bypassing its setter, and the
 * generator's second doorstep. So they are checked here, in the gate, and this exits non-zero if
 * either has drifted.
 */
const WC = await import(path.join(ROOT, 'game/src/sim/world-collision.js'));
const SETT = await import(path.join(ROOT, 'game/src/sim/settlement.js'));
const mirrors = [];
if (EX.BODY_RADIUS_M !== WC.PLAYER_RADIUS_M) mirrors.push(`exterior.js BODY_RADIUS_M = ${EX.BODY_RADIUS_M} but world-collision.js PLAYER_RADIUS_M = ${WC.PLAYER_RADIUS_M}`);
if (EX.DOOR_REACH_M !== SETT.DOOR_REACH_M) mirrors.push(`exterior.js DOOR_REACH_M = ${EX.DOOR_REACH_M} but settlement.js DOOR_REACH_M = ${SETT.DOOR_REACH_M}`);
if (mirrors.length) {
  console.error('check-building-fits-room: the doorstep derivation is using a stale copy of a number that lives in sim/:');
  for (const m of mirrors) console.error(`  ${m}`);
  console.error('\nThe derivation decides where a body stands by comparing against these. A copy that has');
  console.error('drifted from its source derives doorsteps against a world that is not the one the body');
  console.error('is solved in. Fix the copy in game/src/render/exterior.js.');
  process.exit(1);
}

const live = run(true);

if (has('--self-break')) {
  const cut = run(false);
  console.log(`check-building-fits-room --self-break: with the interior join skipped, ${cut.bad.length} of ${cut.checked} buildings fail.`);
  for (const b of cut.bad.slice(0, 5)) console.log(`  ${b}`);
  if (!cut.bad.length) {
    console.error('SELF-BREAK FAILED: the check passes even with the join removed, so it is not measuring the join.');
    process.exit(1);
  }
  // The doorstep leg gets its OWN control: the bounds join stays on and only the round-5 doorstep
  // derivation is cut, which is the world round 4 shipped. Two assertions in one tool need two
  // red arms, or the second one is riding on the first one's evidence.
  const cutDoor = run(true, { doorstep: false });
  console.log(`check-building-fits-room --self-break: with ONLY the doorstep derivation cut, ${cutDoor.doorBad.length} of ${cutDoor.checked} doorsteps are inside a building.`);
  for (const b of cutDoor.doorBad.slice(0, 3)) console.log(`  ${b}`);
  if (!cutDoor.doorBad.length) {
    console.error('SELF-BREAK FAILED: the doorstep assertion passes even with the doorstep derivation removed, so it is not measuring it.');
    process.exit(1);
  }
  // ROUND 6: a THIRD red arm, for the third assertion. The re-entry check must go red when the
  // doorstep derivation is cut, or it is a second copy of the containment experiment.
  console.log(`check-building-fits-room --self-break: with ONLY the doorstep derivation cut, ${cutDoor.reEntry.length} of ${cutDoor.records} doorsteps open a room other than the one you left.`);
  for (const b of cutDoor.reEntry.slice(0, 3)) console.log(`  ${b}`);
  if (!cutDoor.reEntry.length) {
    console.error('SELF-BREAK FAILED: the re-entry assertion passes even with the doorstep derivation removed, so it is not measuring it.');
    process.exit(1);
  }
  console.log('SELF-BREAK OK: all three assertions see the defect they exist for.');
}

// ROUND 6: enumeration, said out loud. A check that silently reaches 112 of 115 records is how the
// last blind set survived five rounds.
console.log(`check-building-fits-room: ${live.reached} of ${live.records} interior records enumerated; ${live.orphans.length} are in no settlement plan and are named here rather than skipped:`);
for (const o of live.orphans) console.log(`  ${o.interior} (settlement ${JSON.stringify(o.settlement)}): ${o.reentry || 'no doorstep to test — no settlement document for this town'}`);

if (live.doorBad.length) {
  console.error(`check-building-fits-room: ${live.doorBad.length} of ${live.checked} doorsteps put the body inside a building:`);
  for (const b of live.doorBad.slice(0, 20)) console.error(`  ${b}`);
  if (live.doorBad.length > 20) console.error(`  ... and ${live.doorBad.length - 20} more`);
  console.error('\nRI-WLD13. render/exterior.js#applyInteriorBounds() re-derives the door onto the');
  console.error('entry wall and the doorstep to the nearest standable point outside it.');
  process.exit(1);
}

if (live.reEntry.length) {
  console.error(`check-building-fits-room: ${live.reEntry.length} of ${live.records} doorsteps do not put your hand on your own door:`);
  for (const b of live.reEntry.slice(0, 20)) console.error(`  ${b}`);
  if (live.reEntry.length > 20) console.error(`  ... and ${live.reEntry.length - 20} more`);
  console.error('\nRI-WLD13. "The door I came out of is the door I go back in by" is the other end of the');
  console.error('doorstep. sim/settlement.js#doorAt() returns the NEAREST door, so a doorstep nearer to a');
  console.error('neighbour\'s door opens the neighbour. render/exterior.js#applyInteriorBounds() derives the');
  console.error('doorstep against the door table for exactly this reason.');
  process.exit(1);
}

if (live.bad.length) {
  console.error(`check-building-fits-room: ${live.bad.length} of ${live.checked} enterable buildings draw an exterior smaller than the room behind their door:`);
  for (const b of live.bad.slice(0, 20)) console.error(`  ${b}`);
  if (live.bad.length > 20) console.error(`  ... and ${live.bad.length - 20} more`);
  console.error('\nRI-WLD13 N1. Either the town plan has to give the building more room —');
  console.error('game/data/world/settlements/<town>.json buildings[].offset_m — or the room has to');
  console.error('fit the building: render/exterior.js#applyInteriorBounds() is where that is decided.');
  process.exit(1);
}

console.log(`check-building-fits-room: ${live.checked} enterable buildings, every one of them big enough on the outside for the room behind its door, and ${live.checked} doorsteps that put the body outside it.`);
if (has('--verbose')) {
  const S = load('game/data/world/settlements'); const I = load('game/data/world/interiors');
  const plans = Object.keys(S).sort().map((id) => EX.planSettlement(S[id], I));
  const rep = EX.applyInteriorBounds(plans, I);
  console.log(`  ${rep.rooms_limited_by_the_plan} rooms are smaller than their record declares because the town plan cannot afford them; worst ${rep.worst ? rep.worst.id + ' keeps ' + (rep.worst.area_kept * 100).toFixed(1) + '%' : 'none'}.`);
}
