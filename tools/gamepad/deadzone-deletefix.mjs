#!/usr/bin/env node
// deadzone-deletefix.mjs — RULES 6 for W1-GAMEPAD's one source change.
//
// THE CHANGE: `game/src/engine.js` locomotion `move_deadzone: 0.15` -> `0`.
//
// RULES 6 names three failure shapes and this file is built to catch all three, because the one
// that is most dangerous here is the third: the number moving the right way for a reason that is
// not my change.
//
//   1. AN INERT FIX — the change does nothing and the measurement passes anyway. Caught by A1:
//      the value is read OUT OF THE RUNNING ENGINE on the shipped tree (RULES 7 — audit the
//      running world, not the bytes). If `engine.data`/`combat.d` had been built from some other
//      literal, or the object the controller reads were a different one from the object I edited,
//      A1 goes red and every number below it is void.
//   2. AN INERT CONTROL — the teardown does nothing, so both arms are the positive arm. Caught by
//      B1: the teardown must reproduce the OLD number EXACTLY (0.27 first-live, 0.000 m/s at
//      0.16/0.20/0.25), not merely "differ".
//   3. AN INERT FIX THAT IMPROVES THE NUMBER. Caught by A2/A3: the deflections that come alive
//      are exactly and only the ones the arithmetic predicts (0.15 < d <= 0.2655), and the ones
//      above 0.2655 are BYTE-FOR-BYTE unchanged. A change that improved the walk for some other
//      reason would move rows it has no business moving.
//
// Both arms run on ONE body in ONE browser over the SAME frames, so nothing but the one number
// differs between them.
//
// EXIT: 0 only if the fix is live, the teardown goes red, and neither arm is inert.
'use strict';

import path from 'node:path';
import { parseArgs, wantsHelp, usage, writeJson, REPO_ROOT, REPORTS_DIR, ensureDir, gitInfo } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `
deadzone-deletefix.mjs — delete-the-fix for engine.js locomotion.move_deadzone.

USAGE
  node tools/gamepad/deadzone-deletefix.mjs [--json PATH]
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const jsonPath = args.json ? path.resolve(String(args.json)) : path.join(REPORTS_DIR, 'w1-gamepad', 'deadzone-deletefix.json');
ensureDir(path.dirname(jsonPath));
const say = (s) => process.stdout.write(s + '\n');

const out = {
  schema: 'elder-souls/deadzone-deletefix@1', piece: 'W1-GAMEPAD', commit: gitInfo().commit || null,
  change: 'game/src/engine.js locomotion.move_deadzone: 0.15 -> 0',
  passes: [], failures: [],
};
const pass = (id, w, d) => { out.passes.push(id); say(`  PASS ${id}  ${w}`); out[id] = { ok: true, ...(d || {}) }; };
const fail = (id, w, d) => { out.failures.push(id); say(`  FAIL ${id}  ${w}`); out[id] = { ok: false, ...(d || {}) }; };

const DEFLECTIONS = [0.05, 0.10, 0.14, 0.16, 0.20, 0.25, 0.27, 0.30, 0.45, 0.55, 0.70, 0.92, 1.00];
const START = { x: 2766.5, z: 5011 };

const h = await launchGame({ width: 640, height: 360, timeout: 180000 });
try {
  await h.page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, { timeout: 180000 });
  await h.page.evaluate(() => window.__HARNESS.ready());
  await h.page.evaluate(() => window.__HARNESS.setMode('play-instrumented'));
  await h.page.evaluate(() => window.__HARNESS.setRenderRate(0));
  await h.page.evaluate(() => {
    window.__PAD = {
      make(o) { o = o || {}; const b = new Array(17).fill(false); for (const i of (o.down || [])) b[i] = true; return { buttons: b, axes: [o.lx || 0, o.ly || 0, 0, 0] }; },
      hold(s, n) { for (let i = 0; i < n; i++) { window.__HARNESS.gamepad(s); window.__HARNESS.stepFrames(1); } },
    };
  });
  const hold = (o, n) => h.page.evaluate(({ o: oo, n: nn }) => window.__PAD.hold(window.__PAD.make(oo), nn), { o, n });

  // ---- A1: is the fix ACTUALLY LIVE in the running world? --------------------------------
  // Read from the object the locomotion controller reads (`combat.playerCtl.d === combat.d`),
  // not from the source file and not from a copy of the data.
  const live = await h.page.evaluate(() => ({
    value: window.__ENGINE.combat.d.locomotion.move_deadzone,
    ctl_reads_this_object: window.__ENGINE.combat.playerCtl.d === window.__ENGINE.combat.d,
  }));
  out.live_value = live;
  if (live.value === 0 && live.ctl_reads_this_object) {
    pass('A1', `THE CODE I WROTE IS THE CODE THAT RUNS: booting the shipped tree, the object combat/player.js reads has locomotion.move_deadzone = ${live.value} (was 0.15), and playerCtl.d IS that object`, live);
  } else {
    fail('A1', `the source edit is not what the running world holds: move_deadzone=${live.value}, controller reads the same object=${live.ctl_reads_this_object} — every number below is void`, live);
  }

  const sweep = async (label) => {
    const rows = [];
    for (const d of DEFLECTIONS) {
      await h.page.evaluate((s) => { window.__HARNESS.teleport(s.x, s.z); window.__ENGINE.sim.camera.yaw = 0; }, START);
      await hold({}, 3);
      await hold({ ly: -d }, 30);                                   // accelerate onto the bearing
      const p0 = await h.page.evaluate(() => window.__ENGINE.sim.player.pos.slice());
      await hold({ ly: -d }, 60);                                   // the measured window
      const p1 = await h.page.evaluate(() => window.__ENGINE.sim.player.pos.slice());
      await hold({}, 3);
      rows.push({ deflection: d, m_per_s: +(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) / 60 * 60).toFixed(4) });
    }
    say(`     ${label}: ${rows.map((r) => `${r.deflection}=${r.m_per_s}`).join('  ')}`);
    return rows;
  };

  // ---- ARM A: the tree as I am shipping it -------------------------------------------------
  const armA = await sweep('ARM A  fix in place (move_deadzone=0)  ');
  // ---- ARM B: delete the fix, same body, same frames ---------------------------------------
  await h.page.evaluate(() => { window.__ENGINE.combat.d.locomotion.move_deadzone = 0.15; });
  const armB = await sweep('ARM B  fix DELETED  (move_deadzone=0.15)');
  await h.page.evaluate(() => { window.__ENGINE.combat.d.locomotion.move_deadzone = 0; });
  out.arm_fix = armA; out.arm_deleted = armB;

  const firstLive = (rows) => { const r = rows.find((x) => x.m_per_s > 0.01); return r ? r.deflection : null; };
  const fa = firstLive(armA), fb = firstLive(armB);
  out.first_live = { with_fix: fa, fix_deleted: fb };

  // ---- B1: THE CONTROL MUST GO RED, and reproduce the OLD number exactly --------------------
  const deadInB = armB.filter((r) => r.deflection > 0.15 && r.deflection <= 0.2655 && r.m_per_s <= 0.01);
  if (fb === 0.27 && fa === 0.16 && deadInB.length === 3) {
    pass('B1', `THE TEARDOWN GOES RED, and returns the old number exactly: with the fix deleted the body is dead until deflection ${fb} again and 0.16/0.20/0.25 all go back to 0.000 m/s. With the fix it starts at ${fa}. This control has been watched failing; it is not a second copy of the experiment`, { with_fix: fa, deleted: fb, dead_again: deadInB });
  } else {
    fail('B1', `the teardown did not reproduce the old behaviour: first-live with fix ${fa}, with fix deleted ${fb}, ${deadInB.length} deflections dead again (expected 0.16 / 0.27 / 3)`, { armA, armB });
  }

  // ---- A2: exactly the predicted rows moved ------------------------------------------------
  const predictedEdge = 0.15 + 0.15 * (0.92 - 0.15);      // 0.2655
  const moved = DEFLECTIONS.filter((d) => {
    const a = armA.find((r) => r.deflection === d), b = armB.find((r) => r.deflection === d);
    return Math.abs(a.m_per_s - b.m_per_s) > 0.005;
  });
  const expected = DEFLECTIONS.filter((d) => d > 0.15 && d <= predictedEdge);
  out.moved_rows = moved; out.predicted_rows = expected; out.predicted_edge = predictedEdge;
  if (JSON.stringify(moved) === JSON.stringify(expected)) {
    pass('A2', `EXACTLY the rows the arithmetic predicts changed and no others: [${moved.join(', ')}] are the deflections in (0.15, ${predictedEdge.toFixed(4)}]. A change that improved the walk for some other reason would have moved rows it has no business moving`, { moved, expected });
  } else {
    fail('A2', `the wrong rows moved: changed [${moved.join(', ')}], predicted [${expected.join(', ')}]`, { moved, expected });
  }

  // ---- A3: everything above the edge is UNCHANGED ------------------------------------------
  const above = DEFLECTIONS.filter((d) => d > predictedEdge);
  const drift = above.filter((d) => {
    const a = armA.find((r) => r.deflection === d), b = armB.find((r) => r.deflection === d);
    return a.m_per_s !== b.m_per_s;
  });
  if (!drift.length) pass('A3', `every deflection above ${predictedEdge.toFixed(4)} is byte-for-byte identical across the two arms (${above.length} rows) — the fix touches the bottom of the stick and nothing else`, { above });
  else fail('A3', `the fix changed deflections it should not have: ${drift.join(', ')}`, { drift });

  // ---- A4: and the fix is not merely "different" — it is CONTINUOUS ------------------------
  // The defect's visible symptom was a STEP: nothing, nothing, nothing, then 0.567 m/s. With the
  // fix the same band eases in. This is the player-facing claim and it is separate from "a number
  // changed".
  const rowAt = (d) => armA.find((r) => r.deflection === d).m_per_s;
  const stepShipped = armB.find((r) => r.deflection === 0.27).m_per_s;
  const easedIn = [0.16, 0.20, 0.25].map(rowAt);
  out.continuity = { with_fix_016_020_025: easedIn, deleted_first_step_m_per_s: stepShipped };
  if (easedIn[0] < easedIn[1] && easedIn[1] < easedIn[2] && easedIn[0] > 0 && easedIn[2] < stepShipped) {
    pass('A4', `the stick now EASES IN instead of stepping: 0.16/0.20/0.25 give ${easedIn.join(' / ')} m/s, rising, all below the ${stepShipped} m/s the deleted-fix arm jumps straight to at 0.27`, out.continuity);
  } else {
    fail('A4', `the bottom of the stick is not continuous with the fix: ${JSON.stringify(out.continuity)}`, out.continuity);
  }
} catch (e) {
  fail('RUN', `the probe threw: ${String((e && e.message) || e)}`, { stack: String((e && e.stack) || '').split('\n').slice(0, 8).join('\n') });
} finally {
  try { await h.close(); } catch { /* ignore */ }
}

writeJson(jsonPath, out);
say('');
say(`  ${out.passes.length} pass · ${out.failures.length} fail`);
say(`  artifact: ${path.relative(REPO_ROOT, jsonPath)}`);
process.exit(out.failures.length ? 1 : 0);
