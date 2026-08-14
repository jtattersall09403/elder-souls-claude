#!/usr/bin/env node
// thorn-quay-deletefix.mjs — RULES.md rule 6, for the Thorn writ-house / barge-hold separation.
//
// THE FIX UNDER TEST. `reports/opening-frame/2026-08-14-opening-frame.md` §1 measured the Writ
// House and the barge hold — the first two structures a player meets, in the town the game starts
// in — overlapping by 7.02 x 4.00 m, with the writ house's front door opening INSIDE the barge
// hold. `orchestration/status/RULING-D1-BUILDING-OVERLAP.json` ruled: separate the buildings, do
// not move `exterior_spawn`. The separation is a pure +8 m translation of the barge hold along z,
// spread over NINE world coordinates in two files, because all 115 interiors are native RI-WLD13
// records whose door and doorstep are world coordinates that do not follow `offset_m`.
//
// THE TEARDOWN. A control clone (hard-linked, HAZARDS.md §5) with those two files declared
// writable; every one of the nine values put back to what it was; then the SAME two instruments
// run against both trees:
//
//   `tools/world/building-overlap-census.mjs`  — the oriented-footprint overlap, per pair
//   `tools/harness/opening-frame.mjs --sweep`  — the shipped `stepCamera`, 72 bearings from the
//                                                writ-house doorstep
//
// WHY THE CONTROL CANNOT BE INERT, WHICH IS THE FAILURE RULE 6 WARNS ABOUT TWICE. The teardown is
// not "skip a code path" — there is no code path here to skip. It is nine numbers, and the tool
// asserts that all nine actually changed on disk before it measures anything. If a write silently
// failed, the run stops and says so rather than reporting two identical arms as a clean negative.
//
// WHAT MUST COME BACK, or this tool exits non-zero:
//   1. the pair reappears as a counted overlap, at 7.02 m in x and 4.00 m in z
//   2. the writ house's door is inside the barge hold again
//   3. `best_drawn_and_clear` collapses from 12 m of clearance back to under 1 m
//   4. the 72-bearing clearance sweep goes back to having NOTHING between 2 m and the 12 m cap
//
//   node tools/world/thorn-quay-deletefix.mjs [--json <path>] [--keep]
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const jsonAt = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;

// ---- the nine values, and what they were before the separation --------------------------------
// Every one is `+8` in z on the barge hold. Listed as literal before/after text so the teardown is
// a diff a reader can check by eye, not an arithmetic this tool could get wrong in both directions.
const REVERTS = [
  ['game/data/world/settlements/thorn.json', '    -20,\n    0,\n    57\n   ],\n   "yaw_deg": 90,', '    -20,\n    0,\n    49\n   ],\n   "yaw_deg": 90,', 'offset_m'],
  ['game/data/world/settlements/thorn.json', '   "door": [\n    3800,\n    0,\n    912.5\n   ],', '   "door": [\n    3800,\n    0,\n    904.5\n   ],', 'doc door'],
  ['game/data/world/settlements/thorn.json', '   "door_declared": [\n    3800,\n    0,\n    916\n   ],', '   "door_declared": [\n    3800,\n    0,\n    908\n   ],', 'doc door_declared'],
  ['game/data/world/settlements/thorn.json', '     "world_pos": [\n      3800,\n      0,\n      916\n     ],', '     "world_pos": [\n      3800,\n      0,\n      908\n     ],', 'doc aperture'],
  ['game/data/world/interiors/barge-hold.json', ' "exterior_door": [\n  3800,\n  0,\n  916\n ],', ' "exterior_door": [\n  3800,\n  0,\n  908\n ],', 'exterior_door'],
  ['game/data/world/interiors/barge-hold.json', '  "exterior_spawn": [\n   3800,\n   0,\n   912\n  ],', '  "exterior_spawn": [\n   3800,\n   0,\n   904\n  ],', 'exterior_spawn'],
  ['game/data/world/interiors/barge-hold.json', '  "exterior_spawn_declared": [\n   3800,\n   0,\n   917.4\n  ]', '  "exterior_spawn_declared": [\n   3800,\n   0,\n   909.4\n  ]', 'exterior_spawn_declared'],
  ['game/data/world/interiors/barge-hold.json', ' "door_world_pos": [\n  3800,\n  0,\n  912.5\n ],', ' "door_world_pos": [\n  3800,\n  0,\n  904.5\n ],', 'door_world_pos'],
  ['game/data/world/interiors/barge-hold.json', '   "world_pos": [\n    3800,\n    0,\n    916\n   ],\n   "kind": "hatch"', '   "world_pos": [\n    3800,\n    0,\n    908\n   ],\n   "kind": "hatch"', 'interior aperture'],
];

const say = (s) => process.stdout.write(s + '\n');
const fail = [];
const ok = (name, cond, detail) => {
  say(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  if (!cond) fail.push(name);
};

/** The pair's oriented overlap, plus its extent on each world axis, from the shipped plan. */
async function pairGeometry(root) {
  const EX = await import(path.join(root, 'game/src/render/exterior.js') + `?t=${Date.now()}`);
  const interiors = {};
  for (const f of fs.readdirSync(path.join(root, 'game/data/world/interiors'))) {
    if (!f.endsWith('.json')) continue;
    const r = JSON.parse(fs.readFileSync(path.join(root, 'game/data/world/interiors', f), 'utf8'));
    interiors[r.id] = r;
  }
  const doc = JSON.parse(fs.readFileSync(path.join(root, 'game/data/world/settlements/thorn.json'), 'utf8'));
  const plan = EX.planSettlement(doc, interiors);
  const box = (id) => {
    const b = plan.buildings.find((x) => x.id === id);
    const [w, d] = b.drawn_footprint_m;
    const yaw = (b.yaw_deg || 0) * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw);
    const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]
      .map(([lx, lz]) => [b.x + lx * c + lz * s, b.z - lx * s + lz * c]);
    return {
      b,
      x: [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))],
      z: [Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))],
    };
  };
  const W = box('writ-house'), B = box('barge-hold');
  const ovx = Math.min(W.x[1], B.x[1]) - Math.max(W.x[0], B.x[0]);
  const ovz = Math.min(W.z[1], B.z[1]) - Math.max(W.z[0], B.z[0]);
  const doorIn = W.b.door[0] > B.x[0] && W.b.door[0] < B.x[1] && W.b.door[2] > B.z[0] && W.b.door[2] < B.z[1];
  return { overlap_x_m: +ovx.toFixed(2), overlap_z_m: +ovz.toFixed(2), overlaps: ovx > 0 && ovz > 0, writ_door_inside_barge: doorIn };
}

/** The 72-bearing sweep at the writ-house doorstep, run by the shipped tool in that tree. */
function sweep(root, tag) {
  const out = path.join(process.env.TMPDIR || '/tmp', `thorn-quay-deletefix-${tag}-${process.pid}.json`);
  execFileSync('node', [path.join(root, 'tools/harness/opening-frame.mjs'), '--sweep', '--quiet', '--json', out], { stdio: 'pipe' });
  const site = JSON.parse(fs.readFileSync(out, 'utf8')).sites.writ_house_doorstep;
  fs.rmSync(out, { force: true });
  const mid = site.sweep.filter((s) => s.clearance_m >= 2 && s.clearance_m < 11.9).length;
  return {
    best_drawn_and_clear: site.sweep_summary.best_drawn_and_clear,
    bearings_with_player_drawn: site.sweep_summary.bearings_with_player_drawn,
    bearings_in_the_middle: mid,   // bimodality: 0 means no middle at all
  };
}

// ---- build the torn-down copy -----------------------------------------------------------------
const clone = execFileSync('node', [
  path.join(ROOT, 'tools/control-clone.mjs'), 'make', '--label', 'thorn-quay-deletefix',
  '--paths', 'game,tools',
  '--writable', 'game/data/world/settlements/thorn.json,game/data/world/interiors/barge-hold.json',
], { encoding: 'utf8' }).trim().split('\n').pop().trim();

say(`torn-down copy: ${clone}`);
say('');
say('  --- the teardown itself must be shown to have happened (an inert control is rule 6) ---');
let applied = 0;
for (const [rel, from, to, label] of REVERTS) {
  const p = path.join(clone, rel);
  const src = fs.readFileSync(p, 'utf8');
  if (!src.includes(from)) { ok(`revert ${label}`, false, 'the fixed text is not in the clone — cannot tear down what is not there'); continue; }
  fs.writeFileSync(p, src.replace(from, to));
  applied++;
}
ok('all nine values reverted on the copy', applied === REVERTS.length, `${applied}/${REVERTS.length}`);
if (applied !== REVERTS.length) { say('\nteardown incomplete — refusing to report two arms as a result.'); process.exit(2); }

// ---- measure both arms ------------------------------------------------------------------------
const fixedGeom = await pairGeometry(ROOT);
const brokenGeom = await pairGeometry(clone);
const fixedSweep = sweep(ROOT, 'fixed');
const brokenSweep = sweep(clone, 'broken');

say('');
say('  --- the old numbers must come back ---');
ok('the overlap returns', brokenGeom.overlaps && !fixedGeom.overlaps,
  `torn down ${brokenGeom.overlap_x_m} x ${brokenGeom.overlap_z_m} m; fixed ${fixedGeom.overlaps ? 'still overlapping' : 'disjoint'}`);
ok('and it is the report\'s 7.02 x 4.00 m',
  Math.abs(brokenGeom.overlap_x_m - 7.02) < 0.02 && Math.abs(brokenGeom.overlap_z_m - 4.00) < 0.02,
  `${brokenGeom.overlap_x_m} x ${brokenGeom.overlap_z_m} m`);
ok('the writ house\'s door is inside the barge hold again',
  brokenGeom.writ_door_inside_barge && !fixedGeom.writ_door_inside_barge);
ok('best_drawn_and_clear collapses',
  brokenSweep.best_drawn_and_clear.clearance_m < 1 && fixedSweep.best_drawn_and_clear.clearance_m > 6,
  `torn down ${brokenSweep.best_drawn_and_clear.clearance_m} m, fixed ${fixedSweep.best_drawn_and_clear.clearance_m} m`);
ok('the sweep goes bimodal again — nothing between 2 m and the 12 m cap',
  brokenSweep.bearings_in_the_middle === 0 && fixedSweep.bearings_in_the_middle > 0,
  `torn down ${brokenSweep.bearings_in_the_middle} bearings in the middle, fixed ${fixedSweep.bearings_in_the_middle}`);
ok('and fewer bearings keep the player drawn',
  brokenSweep.bearings_with_player_drawn < fixedSweep.bearings_with_player_drawn,
  `torn down ${brokenSweep.bearings_with_player_drawn}/72, fixed ${fixedSweep.bearings_with_player_drawn}/72`);

const result = { tool: 'tools/world/thorn-quay-deletefix.mjs', generated_utc: new Date().toISOString(), fixed: { geometry: fixedGeom, sweep: fixedSweep }, torn_down: { geometry: brokenGeom, sweep: brokenSweep }, failures: fail };
if (jsonAt) {
  const out = path.isAbsolute(jsonAt) ? jsonAt : path.join(ROOT, jsonAt);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
  say(`\n  json: ${path.relative(ROOT, out)}`);
}
if (!args.includes('--keep')) {
  try { execFileSync('node', [path.join(ROOT, 'tools/control-clone.mjs'), 'cleanup', '--dir', clone], { stdio: 'pipe' }); } catch { /* leave it; sweep will get it */ }
}
say(fail.length ? `\ndelete-the-fix: ${fail.length} FAILED — ${fail.join(', ')}` : '\ndelete-the-fix: 6/6 — the fix is what is carrying the numbers.');
process.exit(fail.length ? 1 : 0);
