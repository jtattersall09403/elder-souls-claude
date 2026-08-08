#!/usr/bin/env node
/*
 * W1-04 round 5 — RULE 6, run as a 2x2, with both control arms watched going red.
 *
 * Rule 6 names three shapes and says to declare which one you have:
 *   * an INERT FIX     — the change does nothing and the number passes anyway;
 *   * an INERT CONTROL — the teardown does nothing, so both arms are the positive arm;
 *   * TWO GUARDS FOR ONE DEFECT — deleting either alone moves nothing.
 *
 * This round ships two independent legs inside one function (`applyInteriorBounds()`), so the
 * honest way to report them is the full 2x2 rather than two one-armed deletions:
 *
 *      doorstep ON   doorstep OFF
 *   lamps ON     A         B
 *   lamps OFF    C         D
 *
 * A is the shipped tree. If B moves only the doorstep number and C moves only the lamp number,
 * the two legs are independent and each is doing its own work — which is the claim, and it is a
 * claim that can fail here.
 *
 * The arms are cut through `applyInteriorBounds(plans, interiors, docs, opts)`'s own switches
 * rather than by editing a copy of the file, so the arm that runs is the shipped code path with
 * one branch disabled, not a fork of it.
 *
 * Exits non-zero if the shipped arm is not clean, or if EITHER control fails to go red.
 */
'use strict';

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'reports/w1-04-r5');
fs.mkdirSync(OUT, { recursive: true });

const arms = [
  { cell: 'A  shipped', flags: [] },
  { cell: 'B  doorstep cut', flags: ['--no-doorstep'] },
  { cell: 'C  lamp clamp cut', flags: ['--no-lamp-clamp'] },
  { cell: 'D  both cut', flags: ['--no-doorstep', '--no-lamp-clamp'] },
  { cell: 'E  the whole join cut (round 3)', flags: ['--no-join'] },
];

const rows = [];
for (const a of arms) {
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools/world/w1-04-r5-census.mjs'), ...a.flags], { cwd: ROOT, stdio: 'pipe' });
  } catch { /* a non-zero exit IS the result for a cut arm */ }
  const c = JSON.parse(fs.readFileSync(path.join(OUT, 'census.json'), 'utf8'));
  rows.push({
    cell: a.cell, flags: a.flags,
    doorsteps_inside_a_building: c.D.doorsteps_inside_a_building,
    doorsteps_inside_their_own_building: c.D.doorsteps_inside_the_building_they_belong_to,
    doors_at_the_building_centre: c.D.doors_at_the_building_centre,
    lamps_outside_their_room: c.L.lamps_outside,
    hearths_outside: c.L.hearths_outside,
    meshes_more_than_0_6m_outside: c.P.meshes_outside,
  });
}
// Leave the artifact holding the SHIPPED arm, not the last cut one.
try { execFileSync(process.execPath, [path.join(ROOT, 'tools/world/w1-04-r5-census.mjs')], { cwd: ROOT, stdio: 'pipe' }); } catch { /* the shipped arm's own exit code is asserted below, off its artifact */ }

const A = rows[0], Bc = rows[1], C = rows[2], D = rows[3];
const findings = [];
if (A.doorsteps_inside_a_building !== 0 || A.lamps_outside_their_room !== 0) findings.push('the SHIPPED arm is not clean');
if (!(Bc.doorsteps_inside_a_building > A.doorsteps_inside_a_building)) findings.push('B: cutting the doorstep leg did not move the doorstep number — INERT');
if (!(C.lamps_outside_their_room > A.lamps_outside_their_room)) findings.push('C: cutting the lamp clamp did not move the lamp number — INERT');
if (Bc.lamps_outside_their_room !== A.lamps_outside_their_room) findings.push('B: cutting the doorstep leg moved the LAMP number — the legs are not independent');
if (C.doorsteps_inside_a_building !== A.doorsteps_inside_a_building) findings.push('C: cutting the lamp clamp moved the DOORSTEP number — the legs are not independent');

const shape = findings.length ? 'undetermined — see findings'
  : 'TWO INDEPENDENT FIXES, NOT TWO GUARDS FOR ONE DEFECT. Each leg alone moves its own number and only its own number; cutting either one is enough to bring its defect back.';

const out = { tool: 'tools/world/w1-04-r5-deletefix.mjs', when: new Date().toISOString(), commit: process.env.W1_04_COMMIT || null, rows, shape, findings };
fs.writeFileSync(path.join(OUT, 'deletefix.json'), JSON.stringify(out, null, 2));

const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('arm', 34)}${pad('doorsteps in a bldg', 21)}${pad('(own)', 7)}${pad('doors at centre', 17)}${pad('lamps out', 11)}${pad('hearths', 9)}meshes >0.6 m out`);
for (const r of rows) console.log(`${pad(r.cell, 34)}${pad(r.doorsteps_inside_a_building, 21)}${pad(r.doorsteps_inside_their_own_building, 7)}${pad(r.doors_at_the_building_centre, 17)}${pad(r.lamps_outside_their_room, 11)}${pad(r.hearths_outside, 9)}${r.meshes_more_than_0_6m_outside}`);
console.log('');
console.log(`SHAPE: ${shape}`);
for (const f of findings) console.log(`  ! ${f}`);
process.exit(findings.length ? 1 : 0);
