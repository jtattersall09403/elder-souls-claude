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

/** One pass of the shipped data path. `join:false` is the world round 3 shipped. */
function run(join) {
  const S = load('game/data/world/settlements');
  const I = load('game/data/world/interiors');
  const plans = Object.keys(S).sort().map((id) => EX.planSettlement(S[id], I));
  if (join) EX.applyInteriorBounds(plans, I);
  const bad = [];
  let checked = 0;
  for (const plan of plans) {
    for (const b of plan.buildings) {
      if (!b.enterable || !b.interior) continue;
      const rec = I[b.interior];
      if (!rec) { bad.push(`${b.id}: enterable, but no interior record ${JSON.stringify(b.interior)} — the door opens on nothing`); continue; }
      if (!rec.bounds_m || !rec.bounds_m.x || !rec.bounds_m.z) { bad.push(`${rec.id}: no bounds_m`); continue; }
      checked++;
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
  return { checked, bad };
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
  console.log('SELF-BREAK OK: the check sees the defect it exists for.');
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

console.log(`check-building-fits-room: ${live.checked} enterable buildings, every one of them big enough on the outside for the room behind its door.`);
if (has('--verbose')) {
  const S = load('game/data/world/settlements'); const I = load('game/data/world/interiors');
  const plans = Object.keys(S).sort().map((id) => EX.planSettlement(S[id], I));
  const rep = EX.applyInteriorBounds(plans, I);
  console.log(`  ${rep.rooms_limited_by_the_plan} rooms are smaller than their record declares because the town plan cannot afford them; worst ${rep.worst ? rep.worst.id + ' keeps ' + (rep.worst.area_kept * 100).toFixed(1) + '%' : 'none'}.`);
}
