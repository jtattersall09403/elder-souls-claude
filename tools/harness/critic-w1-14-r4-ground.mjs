#!/usr/bin/env node
// critic-w1-14-r4-ground.mjs — CAN A SPELL BE CAST WHERE THE PLAYER ACTUALLY STANDS?
//
// The W1-14 round-4 builder reported, from outside its own brief, that `MagicSystem.stepFall`
// was called as `M.stepFall(frame, M.groundY || 0)` with `M.groundY` written only by
// `beginLevitation` — so the ground plane of the whole province was 0, every standing body was
// permanently `airborne`, and `castDropReason` returned `'airborne'` for every spell but
// `slowfall`. This tool is the critic's independent check of that claim and of the corollary
// the builder drew from it: **every magic measurement this project has published was taken in
// an arena whose floor happens to be zero.**
//
// It does three things the builder's own arm did not:
//   1. It sweeps EVERY named state in `game/data/states/`, not one town, and records the
//      player's standing y in each — so "the arenas are at 0 and the world is not" is a
//      measured population statement rather than two examples.
//   2. It presses the cast button in each and records `INPUT_DROPPED`/`cast_start` from the
//      event stream, in both arms (`H.__breakGroundPlane`).
//   3. It asks whether the fix survives MOTION — rule 8. A body that has walked is placed by
//      `sim/traversal.js`, not by `loadState`, and a ground plane that is only right for a body
//      standing where the save put it is a fix that has not been tested.
//
// A control that cannot go red is not a control: the tool FAILS if the broken arm casts.
//
// USAGE  node tools/harness/critic-w1-14-r4-ground.mjs [--out <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, writeJson, ensureDir, EXIT, gitInfo, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame } from '../lib/browser.mjs';

const USAGE = `critic-w1-14-r4-ground.mjs — is the ground plane the world's, or zero?

  --out <dir>   report directory (default reports/critic-w1-14-r4)

Exit 0 only if: the FIXED arm casts in every state where the player stands above y=0, the
BROKEN arm is refused with reason 'airborne' in every such state, and a body that has WALKED
can still cast. An arm that agrees with its control is reported as an INERT CONTROL and fails.
`;
const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const outDir = args.out ? path.resolve(String(args.out)) : path.resolve('reports/critic-w1-14-r4');
ensureDir(outDir);

const STATES = fs.readdirSync(path.join(REPO_ROOT, 'game/data/states'))
  .filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort();

const ARM = (page, broken, states) => page.evaluate(async ({ BROKEN, STATES }) => {
  const H = window.__HARNESS;
  await H.ready();
  if (BROKEN) {
    if (!H.__breakGroundPlane) return { fatal: 'H.__breakGroundPlane is absent — the sabotage did NOT happen' };
    H.__breakGroundPlane(true);
  }
  const rows = [];
  for (const st of STATES) {
    let row = { state: st };
    try {
      H.setSeed(11);
      H.loadState(st);
      H.setRenderRate(0);
      H.setCatalyst('great_staff');
      H.setWillpower(99);
      H.hearthRest();
      // The same sabotage has to be re-armed after a load if the load rebuilds the system.
      if (BROKEN && H.__breakGroundPlane) H.__breakGroundPlane(true);
      const spells = H.getMagicData().spells.spells.map((s) => s.id);
      const pick = spells.includes('spark_dart') ? 'spark_dart' : spells[0];
      H.learnSpell(pick);
      H.setAttuned([pick]);
      H.stepFrames(10);
      const st0 = H.getMagicState();
      row.y = st0.pos_y_m;
      row.airborne = !!st0.airborne;
      row.focus = st0.focus;
      row.focus_max = st0.focus_max;
      H.magicEventsDrain();
      // THE REAL BUTTON. `pressCast` queues `light` with a catalyst in hand and steps — the
      // whole input path, the drop table, the move and the resource charge — so a refusal here
      // is the refusal a player gets. It returns the INPUT_DROPPED rows for `cast`.
      const pc = H.pressCast(60);
      const evs = H.magicEventsDrain();
      row.events = evs.map((e) => e.kind || e.type);
      row.cast_start = evs.filter((e) => (e.kind || e.type) === 'cast_start').length;
      row.dropped = pc.drops.length;
      row.drop_reasons = [...new Set(pc.drops.map((d) => d.reason))];
      row.focus_after = H.getMagicState().focus;
      row.spell = pick;
    } catch (err) {
      row.error = String(err && err.message || err);
    }
    rows.push(row);
  }
  return { broken: !!BROKEN, rows };
}, { BROKEN: broken, STATES: states });

// ---- rule 8: a body that has WALKED, not a body the save put down --------------------------
const MOVING = (page, broken) => page.evaluate(async (BROKEN) => {
  const H = window.__HARNESS;
  await H.ready();
  if (BROKEN && H.__breakGroundPlane) H.__breakGroundPlane(true);
  H.setSeed(11);
  H.loadState('town-lilmoth');
  H.setRenderRate(0);
  if (BROKEN && H.__breakGroundPlane) H.__breakGroundPlane(true);
  H.setCatalyst('great_staff'); H.setWillpower(99); H.hearthRest();
  const spells = H.getMagicData().spells.spells.map((s) => s.id);
  const pick = spells.includes('spark_dart') ? 'spark_dart' : spells[0];
  H.learnSpell(pick); H.setAttuned([pick]);
  const w0 = H.whereAmI();
  const a0 = [w0.pos ? w0.pos[0] : 0, w0.pos ? w0.pos[2] : 0];
  // Walk. Not teleport: the point of the check is that traversal, not `loadState`, placed the body.
  H.queueInputs([{ f: 1, move: [0, 1] }, { f: 240, move: [0, 0] }]);
  H.stepFrames(260);
  const w1 = H.whereAmI();
  const a1 = [w1.pos ? w1.pos[0] : 0, w1.pos ? w1.pos[2] : 0];
  const walked = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
  H.hearthRest(); H.setAttuned([pick]);
  H.magicEventsDrain();
  const pc = H.pressCast(60);
  const evs = H.magicEventsDrain();
  return {
    broken: !!BROKEN,
    from: a0.map((v) => Math.round(v * 100) / 100), to: a1.map((v) => Math.round(v * 100) / 100),
    walked_m: Math.round(walked * 100) / 100,
    y: H.getMagicState().pos_y_m,
    airborne: !!H.getMagicState().airborne,
    cast_start: evs.filter((e) => (e.kind || e.type) === 'cast_start').length,
    dropped: pc.drops.length,
    drop_reasons: [...new Set(pc.drops.map((d) => d.reason))],
  };
}, broken);

const handle = await launchGame(args);
let fixed, brokenArm, movedFixed, movedBroken;
try {
  fixed = await ARM(handle.page, false, STATES);
  movedFixed = await MOVING(handle.page, false);
  const p2 = await handle.page.context().newPage();
  await p2.goto(handle.page.url(), { waitUntil: 'load' });
  await p2.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });
  brokenArm = await ARM(p2, true, STATES);
  await p2.close();
  const p3 = await handle.page.context().newPage();
  await p3.goto(handle.page.url(), { waitUntil: 'load' });
  await p3.waitForFunction(() => !!window.__HARNESS, null, { timeout: 60000 });
  movedBroken = await MOVING(p3, true);
  await p3.close();
} finally {
  await handle.close();
}

const fails = [];
if (fixed.fatal) fails.push(`FIXED: ${fixed.fatal}`);
if (brokenArm.fatal) fails.push(`BROKEN: ${brokenArm.fatal}`);

const byState = new Map();
for (const r of (fixed.rows || [])) byState.set(r.state, { fixed: r });
for (const r of (brokenArm.rows || [])) {
  const e = byState.get(r.state) || {}; e.broken = r; byState.set(r.state, e);
}
const table = [...byState.entries()].map(([state, v]) => ({
  state,
  y: v.fixed ? v.fixed.y : null,
  above_zero: v.fixed && v.fixed.y !== null && Math.abs(v.fixed.y) > 0.01,
  fixed_cast: v.fixed ? v.fixed.cast_start : null,
  fixed_drop: v.fixed ? v.fixed.drop_reasons : null,
  broken_cast: v.broken ? v.broken.cast_start : null,
  broken_drop: v.broken ? v.broken.drop_reasons : null,
  fixed_error: v.fixed ? v.fixed.error || null : null,
}));

const aboveZero = table.filter((r) => r.above_zero);
const atZero = table.filter((r) => r.y !== null && !r.above_zero);
const fixedCastsAbove = aboveZero.filter((r) => r.fixed_cast > 0);
const brokenRefusedAbove = aboveZero.filter((r) => r.broken_cast === 0 && (r.broken_drop || []).includes('airborne'));

if (aboveZero.length === 0) fails.push('no state in the tree puts the player above y=0 — the finding cannot be reproduced at all');
if (aboveZero.length && fixedCastsAbove.length !== aboveZero.length) {
  fails.push(`FIXED arm cast in only ${fixedCastsAbove.length} of ${aboveZero.length} above-zero states: ${aboveZero.filter((r) => !(r.fixed_cast > 0)).map((r) => r.state).join(', ')}`);
}
if (aboveZero.length && brokenRefusedAbove.length !== aboveZero.length) {
  fails.push(`INERT CONTROL: the BROKEN arm was NOT refused as 'airborne' in ${aboveZero.length - brokenRefusedAbove.length} of ${aboveZero.length} above-zero states`);
}
if (movedFixed.cast_start === 0) fails.push(`RULE 8: a body that WALKED ${movedFixed.walked_m} m could not cast (${(movedFixed.drop_reasons || []).join(',')})`);

const report = {
  schema: 'elder-souls/critic-w1-14-r4-ground@1',
  commit: gitInfo().commit,
  states_swept: STATES.length,
  above_zero: aboveZero.length,
  at_zero: atZero.length,
  at_zero_states: atZero.map((r) => r.state),
  table,
  moving: { fixed: movedFixed, broken: movedBroken },
  control_is_live: !fails.some((f) => f.startsWith('INERT CONTROL')),
  pass: fails.length === 0,
  failures: fails,
};
writeJson(path.join(outDir, 'ground-plane.json'), report);
log(`states swept ${STATES.length}: ${aboveZero.length} above y=0, ${atZero.length} at y=0`);
log(`at zero: ${atZero.map((r) => r.state).join(', ')}`);
for (const r of aboveZero) log(`  ${r.state.padEnd(28)} y=${String(r.y).padStart(9)}  fixed cast=${r.fixed_cast} drop=${JSON.stringify(r.fixed_drop)}  broken cast=${r.broken_cast} drop=${JSON.stringify(r.broken_drop)}`);
log(`moving FIXED : walked ${movedFixed.walked_m} m, airborne=${movedFixed.airborne}, cast_start=${movedFixed.cast_start}, drops=${JSON.stringify(movedFixed.drop_reasons)}`);
log(`moving BROKEN: walked ${movedBroken.walked_m} m, airborne=${movedBroken.airborne}, cast_start=${movedBroken.cast_start}, drops=${JSON.stringify(movedBroken.drop_reasons)}`);
for (const f of fails) log(`FAIL: ${f}`);
log(`report: ${path.join(outDir, 'ground-plane.json')}`);
process.exit(fails.length ? EXIT.MEASUREMENT_FAIL : 0);
