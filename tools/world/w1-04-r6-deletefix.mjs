#!/usr/bin/env node
/*
 * W1-04 ROUND 6 — RULE 6, with the control that actually controls for THIS round.
 *
 * Rule 6 names four shapes and says to declare which one you have:
 *   * an INERT FIX     — the change does nothing and the number passes anyway;
 *   * an INERT CONTROL — the teardown does nothing, so both arms are the positive arm;
 *   * an INERT FIX THAT IMPROVES THE NUMBER — every signal says it worked and something else
 *     moved it;
 *   * TWO GUARDS FOR ONE DEFECT — deleting either alone moves nothing.
 *
 * THE TRAP THIS ROUND HAD TO AVOID. Round 5 already shipped a doorstep derivation that passes its
 * own number. So `--no-doorstep` — cutting the whole derivation — is a control for round FIVE, and
 * an arm that goes red there tells you nothing about round six. The arm that matters is
 * `--r5-doorstep`: round 5's derivation entire, with only round 6's additions removed (the
 * standability predicate, the door-table predicate, the door slide along the wall, the entry-side
 * rotation, and the ring start at 0.5 m rather than 1.5 m).
 *
 * If that arm does not go red, round 6 is an inert fix sitting on round 5's evidence.
 *
 * Every arm is cut through `applyInteriorBounds(plans, interiors, docs, opts)`'s own switches, so
 * the arm that runs is the shipped code path with one branch disabled, not a fork of the file.
 *
 * Exits non-zero if the shipped arm is not clean, or if any control fails to go red.
 *
 *   node tools/world/w1-04-r6-deletefix.mjs
 */
'use strict';

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'reports/w1-04-r6');
fs.mkdirSync(OUT, { recursive: true });
const TMP_REL = 'reports/w1-04-r6/_arm.json';
const TMP = path.join(ROOT, TMP_REL);

const arms = [
  { cell: 'A  shipped (round 6)', flags: [] },
  { cell: 'B  ROUND 6 CUT — round 5\'s derivation entire, round 6\'s predicates removed', flags: ['--r5-doorstep'] },
  { cell: 'C  the whole doorstep derivation cut (round 4\'s world)', flags: ['--no-doorstep'] },
  { cell: 'D  the lamp clamp cut', flags: ['--no-lamp-clamp'] },
  { cell: 'E  round 6 cut AND lamp clamp cut', flags: ['--r5-doorstep', '--no-lamp-clamp'] },
  // Not a control — a PROOF OF ABSENCE for the generator's second definition. Every declared
  // `continuity.exterior_spawn` is deleted before the derivation runs, which is the world
  // `build-settlements.mjs` now generates. If no record goes from correct to incorrect, the field
  // the generator used to write was contributing nothing but a second opinion.
  { cell: 'F  every DECLARED doorstep stripped (the world the generator now makes)', flags: ['--strip-declared-doorstep'] },
  { cell: 'G  the per-prop inset cut', flags: ['--no-prop-inset'] },
];

const rows = [];
for (const a of arms) {
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools/world/w1-04-r6-census.mjs'), ...a.flags, '--json', TMP_REL], { cwd: ROOT, stdio: 'pipe' });
  } catch { /* a non-zero exit IS the result for a cut arm */ }
  const c = JSON.parse(fs.readFileSync(TMP, 'utf8'));
  rows.push({
    cell: a.cell, flags: a.flags,
    doorsteps_inside_a_footprint: c.S.inside_a_footprint,
    doorsteps_in_a_wall_slab: c.S.in_a_wall_slab,
    reentry_own: c.R.back_in_the_room_you_left,
    reentry_other: c.R.into_a_different_building,
    reentry_none: c.R.into_nothing,
    lamps_outside_their_room: c.L.lamps_outside_their_room,
    meshes_overhanging_0_6m: c.P.overhang.meshes,
  });
}
fs.rmSync(TMP, { force: true });

const [A, B, C, D, E, F, G] = rows;
const findings = [];
if (A.doorsteps_inside_a_footprint !== 0 || A.doorsteps_in_a_wall_slab !== 0) findings.push('the SHIPPED arm leaves a doorstep the solver will move');
if (A.lamps_outside_their_room !== 0) findings.push('the SHIPPED arm leaves a lamp outside its room');

// --- the control that controls for THIS round ---------------------------------------------------
if (!(B.doorsteps_in_a_wall_slab > A.doorsteps_in_a_wall_slab)) findings.push('B: cutting ROUND 6 did not put any doorstep back inside a wall slab — round 6 is an INERT FIX');
if (!(B.reentry_own < A.reentry_own)) findings.push('B: cutting ROUND 6 did not reduce re-entry — round 6 is an INERT FIX');
// --- and the round-5 control, kept so the two are distinguishable ---------------------------------
if (!(C.doorsteps_inside_a_footprint > A.doorsteps_inside_a_footprint)) findings.push('C: cutting the whole derivation did not put a doorstep inside a footprint — INERT CONTROL');
if (!(D.lamps_outside_their_room > A.lamps_outside_their_room)) findings.push('D: cutting the lamp clamp did not move the lamp number — INERT');
// --- independence ---------------------------------------------------------------------------------
if (B.lamps_outside_their_room !== A.lamps_outside_their_room) findings.push('B: cutting round 6 moved the LAMP number — the legs are not independent');
if (D.doorsteps_in_a_wall_slab !== A.doorsteps_in_a_wall_slab) findings.push('D: cutting the lamp clamp moved the DOORSTEP number — the legs are not independent');
if (!(E.doorsteps_in_a_wall_slab === B.doorsteps_in_a_wall_slab && E.lamps_outside_their_room === D.lamps_outside_their_room)) {
  findings.push('E: cutting both does not equal cutting each — this is not two independent fixes');
}

// --- the generator's deleted definition, proved to have been contributing nothing ---------------
if (F.reentry_own < A.reentry_own) findings.push(`F: stripping the declared doorsteps took ${A.reentry_own - F.reentry_own} record(s) from correct to incorrect — the generator's value was load-bearing after all`);
if (F.doorsteps_inside_a_footprint || F.doorsteps_in_a_wall_slab) findings.push('F: with no declared doorstep, the derivation leaves a body somewhere the solver will move it');

// --- the third leg: the per-prop inset ----------------------------------------------------------
if (A.meshes_overhanging_0_6m !== 0) findings.push('the SHIPPED arm still overhangs a room by more than 0.6 m');
if (!(G.meshes_overhanging_0_6m > A.meshes_overhanging_0_6m)) findings.push('G: cutting the per-prop inset did not put a mesh back outside its room — INERT');
if (G.doorsteps_in_a_wall_slab !== A.doorsteps_in_a_wall_slab || G.lamps_outside_their_room !== A.lamps_outside_their_room) findings.push('G: cutting the prop inset moved a doorstep or a lamp number — the legs are not independent');

const shape = findings.length ? 'UNDECLARED — see findings'
  : 'THREE INDEPENDENT FIXES. Cutting round 6\'s doorstep predicates alone moves the doorstep and re-entry numbers and nothing else; cutting the lamp clamp alone moves the lamp number; cutting the per-prop inset alone moves the overhang number. Not two guards for one defect, and not an inert fix: each leg alone moves its own number and only its own number.';

const report = { tool: 'tools/world/w1-04-r6-deletefix.mjs', when: new Date().toISOString(), commit: null, rows, shape, findings };
try { report.commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim(); } catch { /* not a git tree */ }
fs.writeFileSync(path.join(OUT, 'deletefix.json'), JSON.stringify(report, null, 2));

const pad = (s, n) => String(s).padEnd(n);
console.log(`w1-04-r6-deletefix @ ${report.commit}`);
console.log(`${pad('arm', 62)} ${pad('in fp', 6)} ${pad('in wall', 8)} ${pad('reentry own/other/none', 24)} ${pad('lamps', 6)} meshes>0.6m`);
for (const r of rows) {
  console.log(`${pad(r.cell, 62)} ${pad(r.doorsteps_inside_a_footprint, 6)} ${pad(r.doorsteps_in_a_wall_slab, 8)} ${pad(`${r.reentry_own} / ${r.reentry_other} / ${r.reentry_none}`, 24)} ${pad(r.lamps_outside_their_room, 6)} ${r.meshes_overhanging_0_6m}`);
}
console.log(`\nSHAPE: ${shape}`);
if (findings.length) { for (const f of findings) console.error(`FINDING: ${f}`); process.exit(1); }
console.log('Every control went red for its own leg, and only for its own leg.');
