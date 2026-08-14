#!/usr/bin/env node
// door-yaw-teardown.mjs — remove the door-yaw fix, or part of it, from a CLONE of the tree.
//
// RULES.md rule 6: a fix is not a fix until it has been deleted on a copy and the old number has
// come back — and a teardown that quietly does nothing is the second failure shape, an INERT
// CONTROL, which has already cost this project a wrong published count. So every arm here asserts
// that the text it was looking for was actually there and is actually gone, and exits non-zero
// otherwise. A teardown that cannot fail is not a control.
//
// THE ARMS, and why there are four rather than one. The dispatch's own warning is that the fix
// touches THREE fields — `sim.player.yaw` (a mirror `combat-bridge.mirror()` overwrites every
// step), `combat.player.yaw` (the authoritative one) and `sim.camera.yaw` (whose auto-recentre is
// clamped to 1.5 deg/frame, so a camera 170 deg out takes ~113 frames to come round). "Writing the
// yaw" in one place is invisible in the running game. One all-or-nothing control cannot tell those
// apart, so the partial arms exist to show what each field is carrying:
//
//   before        the fix fully removed — the door verbs pass no yaw AND `_placeBody` ignores one.
//                 THE BASELINE.
//   mirror-only   `_placeBody` writes ONLY `sim.player.yaw`. If the number survives this, the fix
//                 did not need the other two and the file's comments are wrong.
//   no-camera     writes the body and the combat body but NOT the camera. This is the arm that
//                 isolates the 1.5 deg/frame recentre clamp.
//   no-combat     writes the body and the camera but NOT `combat.player.yaw`, so the mirror
//                 overwrites the body one step later.
//   no-refine     removes the `sim.faceRefine` hook install — the delete-the-fix for the GEOMETRY
//                 half added by W1-DOOR-YAW-SWEEP, leaving the predecessor's data rule intact.
//
// THE ARM TEXT TRACKS THE TREE, ON PURPOSE. These are exact source strings, so an edit to
// `settlement.js` or `engine.js` makes the matching arm REFUSE rather than silently apply to
// nothing. That has already happened once during this piece — the `before` arm's two
// `placeBody(...)` lines changed shape when the refinement landed, and the guard caught it in the
// same minute. Update the string, do not relax the check.
//
// USAGE
//   node tools/harness/door-yaw-teardown.mjs --dir <clone> --arm before|mirror-only|no-camera|no-combat|no-refine
//   node tools/harness/door-yaw-teardown.mjs --self-test
'use strict';

import path from 'node:path';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import { parseArgs, wantsHelp, usage } from '../lib/cli.mjs';

const USAGE = `
door-yaw-teardown.mjs — delete the door-yaw fix (or one field of it) from a clone.

USAGE
  node tools/harness/door-yaw-teardown.mjs --dir <clone dir> --arm <arm>
  node tools/harness/door-yaw-teardown.mjs --self-test

ARMS  before | mirror-only | no-camera | no-combat | no-refine
`;

/** One edit: find exactly this text, replace it with that. `n` occurrences are REQUIRED. */
const EDITS = {
  before: [
    { file: 'game/src/sim/settlement.js', n: 1,
      from: 'placeBody(sim, spawn, Number.isFinite(face.yaw_deg) ? face.yaw_deg : undefined);',
      to: 'placeBody(sim, spawn); /* TEARDOWN before: no yaw */' },
    { file: 'game/src/sim/settlement.js', n: 1,
      from: 'placeBody(sim, out, Number.isFinite(face.yaw_deg) ? face.yaw_deg : undefined);',
      to: 'placeBody(sim, out); /* TEARDOWN before: no yaw */' },
    { file: 'game/src/engine.js', n: 1,
      from: '  _placeBody(x, y, z, yaw) {',
      to: '  _placeBody(x, y, z, yaw) {\n    yaw = undefined; /* TEARDOWN before: the placement writes position only */' },
  ],
  'mirror-only': [
    { file: 'game/src/engine.js', n: 1,
      from: '      if (this.sim.camera) { this.sim.camera.yaw = y360; this.sim.camera.yawRate = 0; }',
      to: '      /* TEARDOWN mirror-only: camera not written */' },
    { file: 'game/src/engine.js', n: 1,
      from: '      if (Number.isFinite(yaw)) b.yaw = p.yaw;',
      to: '      /* TEARDOWN mirror-only: combat body not written */' },
  ],
  'no-camera': [
    { file: 'game/src/engine.js', n: 1,
      from: '      if (this.sim.camera) { this.sim.camera.yaw = y360; this.sim.camera.yawRate = 0; }',
      to: '      /* TEARDOWN no-camera: camera not written */' },
  ],
  // The delete-the-fix arm for the GEOMETRY REFINEMENT specifically, as opposed to the yaw write
  // the predecessor landed. Removing the hook install is the whole reversal: `refineFacing()` in
  // sim/settlement.js is fail-open by construction, so with no hook the door falls back to the
  // data-derived proposal and the tree behaves exactly as it did before the refinement existed.
  // One line, and it is the line named in the report as the reversal.
  'no-refine': [
    { file: 'game/src/engine.js', n: 1,
      from: '    this.sim.faceRefine = (x, y, z, yaw) => this._refineFacing(x, y, z, yaw);',
      to: '    /* TEARDOWN no-refine: the geometry hook is not installed */' },
  ],
  'no-combat': [
    { file: 'game/src/engine.js', n: 1,
      from: '      if (Number.isFinite(yaw)) b.yaw = p.yaw;',
      to: '      /* TEARDOWN no-combat: combat body not written */' },
  ],
};

export function applyTeardown(dir, arm) {
  const edits = EDITS[arm];
  if (!edits) throw new Error(`unknown arm ${JSON.stringify(arm)}; known: ${Object.keys(EDITS).join(', ')}`);
  const applied = [];
  for (const e of edits) {
    const p = path.join(dir, e.file);
    const src = readFileSync(p, 'utf8');
    const count = src.split(e.from).length - 1;
    if (count !== e.n) {
      throw new Error(`teardown ${arm}: expected ${e.n} occurrence(s) of ${JSON.stringify(e.from.slice(0, 60))} in ${e.file}, found ${count}. ` +
        'The tree has moved under this control and the control would have been INERT — refusing rather than passing silently.');
    }
    const next = src.split(e.from).join(e.to);
    if (next === src) throw new Error(`teardown ${arm}: replacement changed nothing in ${e.file}`);
    writeFileSync(p, next);
    // Read back: the write is only evidence if the bytes on disk changed.
    const after = readFileSync(p, 'utf8');
    // Only meaningful when the replacement does not itself contain the original — the `before`
    // arm's engine edit deliberately keeps the signature line and inserts a line under it.
    if (!e.to.includes(e.from) && after.includes(e.from)) {
      throw new Error(`teardown ${arm}: ${e.file} still contains the text after the write`);
    }
    if (!after.includes(e.to)) throw new Error(`teardown ${arm}: ${e.file} does not contain the replacement after the write`);
    applied.push({ file: e.file, occurrences: count });
  }
  return { arm, dir, applied };
}

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);

if (args['self-test']) {
  // Proves the guard, not the fix: a tree WITHOUT the text must make every arm throw. That is the
  // arm that has to disagree, or this file is a rubber stamp.
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'dyt-selftest-'));
  mkdirSync(path.join(tmp, 'game/src/sim'), { recursive: true });
  const ok = [];
  for (const arm of Object.keys(EDITS)) {
    writeFileSync(path.join(tmp, 'game/src/engine.js'), 'nothing here\n');
    writeFileSync(path.join(tmp, 'game/src/sim/settlement.js'), 'nothing here\n');
    let threw = false;
    try { applyTeardown(tmp, arm); } catch { threw = true; }
    ok.push({ arm, refused_on_absent_text: threw });
  }
  const bad = ok.filter((r) => !r.refused_on_absent_text);
  console.log(JSON.stringify({ self_test: 'door-yaw-teardown', arms: ok }, null, 2));
  if (bad.length) { console.error(`SELF-TEST FAILED: ${bad.length} arm(s) applied silently against a tree with none of the text.`); process.exit(1); }
  console.log('self-test: every arm refuses a tree that does not contain the fix (an inert control is impossible here).');
  process.exit(0);
}

if (!args.dir || !args.arm) usage(USAGE);
const res = applyTeardown(path.resolve(String(args.dir)), String(args.arm));
console.log(JSON.stringify(res, null, 2));
