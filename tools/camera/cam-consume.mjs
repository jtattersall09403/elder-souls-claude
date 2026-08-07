#!/usr/bin/env node
/**
 * cam-consume.mjs — RI-MTH07 / ARBITRATION §3 for the camera.
 *
 * THE DEFECT THIS EXISTS TO PROVE FIXED. `game/data/camera/rig.json` describes the rig the
 * player looks through in 97 constants. Until 2026-08-07 the engine fetched it at boot,
 * assigned it to `data.cameraRig`, and read it from nowhere: every one of those numbers was
 * also a literal in `game/src/sim/camera.js`, so editing the file changed nothing anybody
 * could see. That is the fifteenth instrumented-model-with-no-consumer in this project and
 * the first one in the piece whose whole subject is the view.
 *
 * A probe that merely diffed the file against `getCameraRig().const` would be another
 * promise: both sides would come from the same module. So this probe does the only thing
 * that settles it —
 *
 *   1. write a perturbation into `game/data/camera/rig.json` ON DISK,
 *   2. reload the page so the engine boots from the edited file,
 *   3. run a script and read a number OUT OF THE CAMERA'S BEHAVIOUR,
 *   4. require that number to have moved, in the direction and by roughly the amount the
 *      edit predicts, and require the unrelated observables to have stayed still,
 *   5. restore the file, reload, and require the baseline to come back byte-for-byte.
 *
 * Every observable below is read from where the camera actually put itself — the pivot, the
 * boom length, a projected NDC coordinate, the yaw the world turned by — never from the
 * declaration. `fov` is the one number the engine also reports directly, so it is checked
 * BOTH ways: the reported field and the NDC of a fixed world point through the projection.
 *
 * --falsify IS THE PROOF THE PROBE CAN FAIL. It performs exactly the same run except that
 * the perturbation is written to `rig.json.notloaded`, a file the game never opens, while the
 * real `rig.json` is left alone. That is a faithful simulation of the pre-fix world, and every
 * check must go RED. A green --falsify run means this instrument is measuring nothing.
 *
 *   node tools/camera/cam-consume.mjs
 *   node tools/camera/cam-consume.mjs --falsify
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, wantsHelp, usage, log, EXIT, REPO_ROOT } from '../lib/cli.mjs';
import { launchGame, requireMethods } from '../lib/browser.mjs';

const USAGE = `
cam-consume.mjs — prove game/data/camera/rig.json governs the running camera (RI-MTH07).

  --falsify    write the perturbations to a file the game does NOT load. Every check must
               fail. This is the control that shows the probe can go red.
  --out <path> write JSON here (default reports/w1-06/cam-consume.json)
  --json       print JSON instead of the table
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const FALSIFY = !!args.falsify;

const RIG = path.join(REPO_ROOT, 'game', 'data', 'camera', 'rig.json');
const DECOY = RIG + '.notloaded';
const ORIGINAL = fs.readFileSync(RIG, 'utf8');

/**
 * The perturbations. `path` is a dotted path into rig.json; `to` is the value to write;
 * `observable` names the behavioural quantity that must move; `expect` receives
 * (baseline, perturbed) and returns null on success or a string explaining the failure.
 *
 * Each one is chosen so that the number read back is a POSITION or an ANGLE the camera
 * arrived at, not a constant echoed back. `holds` names the observables that must NOT move,
 * which is what stops "everything changed" from counting as consumption.
 */
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const PERTURBATIONS = [
  {
    id: 'pivot_height',
    path: 'rig.pivot_height_m', to: 3.05,          // 1.55 + 1.50
    why: 'RI-CAM01 §A — the pivot sits a stated height above the feet. Raise it and the ' +
      'camera looks down on the character from a metre and a half higher.',
    observable: 'pivot_y_above_feet_m',
    expect: (b, p) => (near(p - b, 1.50, 0.02) ? null
      : `pivot rose by ${(p - b).toFixed(4)} m, expected 1.50`),
    holds: ['arm_len_m', 'fov_deg'],
  },
  {
    id: 'arm_free',
    path: 'rig.arm_free_m', to: 2.00,              // 4.10 -> 2.00
    why: 'RI-CAM01 §A — the unobstructed free-camera boom. Shorten it and the camera sits ' +
      'closer to the character\'s back.',
    observable: 'arm_len_m',
    expect: (b, p) => (near(b, 4.10, 0.02) && near(p, 2.00, 0.02) ? null
      : `boom went ${b.toFixed(4)} -> ${p.toFixed(4)} m, expected 4.10 -> 2.00`),
    holds: ['pivot_y_above_feet_m', 'fov_deg'],
  },
  {
    id: 'fov',
    path: 'rig.fov_deg', to: 90.0,                 // 50 -> 90
    why: 'RI-CAM01 §A — a constant FOV. Widen it and a fixed world point moves toward the ' +
      'middle of the frame. Checked through the PROJECTION, not just the reported field.',
    observable: 'ndc_x_of_fixed_point',
    expect: (b, p) => (Math.abs(p) < Math.abs(b) * 0.75 ? null
      : `a point at NDC x ${b.toFixed(4)} moved to ${p.toFixed(4)}; a 50->90 deg widening ` +
        'must pull it substantially toward centre'),
    holds: ['pivot_y_above_feet_m'],
  },
  {
    id: 'look_rate',
    path: 'look.max_yaw_rate_dps', to: 45.0,       // 180 -> 45, i.e. a quarter
    why: 'RI-CAM02 §A and SEAM S32 — the RESPONSE CURVE above the raw stick is the camera\'s, ' +
      'and it was five literals in input/pipeline.js. Quarter the rate and a held stick ' +
      'turns the view a quarter as far.',
    observable: 'yaw_swept_deg',
    expect: (b, p) => (b > 5 && near(p, b / 4, Math.max(0.2, b * 0.03)) ? null
      : `a 60-frame full-deflection stick swept ${b.toFixed(3)} deg then ${p.toFixed(3)}; ` +
        'expected a quarter'),
    holds: ['pivot_y_above_feet_m', 'arm_len_m'],
  },
  {
    id: 'death_pitch',
    path: 'feel.death.pitch_to_deg', to: -60.0,    // -22 -> -60
    why: 'RI-CAM06 §H — the death camera eases to a stated pitch. This one is behind a MODE ' +
      'branch, so it proves the file reaches code the free camera never runs.',
    observable: 'death_pitch_deg',
    expect: (b, p) => (near(b, -22.0, 1.5) && p < -45 ? null
      : `death pitch settled at ${b.toFixed(2)} then ${p.toFixed(2)}; expected ~-22 then past -45`),
    holds: [],
  },
];

// ---------------------------------------------------------------------------------------
function dig(o, dotted) { for (const k of dotted.split('.')) o = o[k]; return o; }
function put(o, dotted, v) {
  const ks = dotted.split('.');
  let t = o; for (let i = 0; i < ks.length - 1; i++) t = t[ks[i]];
  const was = t[ks[ks.length - 1]];
  t[ks[ks.length - 1]] = v;
  return was;
}
function writeRig(mutate) {
  const doc = JSON.parse(ORIGINAL);
  const was = mutate ? put(doc, mutate.path, mutate.to) : null;
  const text = JSON.stringify(doc, null, 2) + '\n';
  // --falsify puts the edit somewhere the game does not look. The real file keeps its
  // original bytes, so a probe that "passes" here is reporting a change that never happened.
  fs.writeFileSync(FALSIFY && mutate ? DECOY : RIG, text);
  if (FALSIFY && mutate) fs.writeFileSync(RIG, ORIGINAL);
  return was;
}
function restore() {
  fs.writeFileSync(RIG, ORIGINAL);
  if (fs.existsSync(DECOY)) fs.unlinkSync(DECOY);
}

/**
 * THE MEASUREMENT, run in the page. Five behavioural quantities, all read after the camera
 * has actually placed itself. Nothing here reads `getCameraRig().const`.
 */
/* eslint-disable no-undef */
async function measure() {
  const H = window.__HARNESS;
  const out = {};
  H.setSeed(20260807);
  H.setRenderRate(0);                         // never step with the renderer live
  H.setSeed(20260807);
  H.loadState('default');
  H.setRenderRate(0);
  // The camera fixtures are NOT in the province heightfield: `setCameraCell` selects the
  // authored collision set and the teleport needs the cell's own floor height or the body
  // drops 41 m through it. (Predecessor's finding; it cost 40 minutes once already.)
  const rig = H.getCameraRig();
  const cell = rig.cells_meta.find((c) => c.id === 'cam-flat-plain');
  H.setCameraCell('cam-flat-plain');
  H.teleport(0, 0, { y: cell ? cell.ground_y : 0, yaw: 0 });
  H.stepFrames(90);                           // let the boom and the pivot settle

  const f = H.getCameraFrame();
  const c = f.camera;
  out.pivot_y_above_feet_m = c.pivot[1] - f.player_pos[1];
  out.arm_len_m = Math.hypot(c.pos[0] - c.pivot[0], c.pos[1] - c.pivot[1], c.pos[2] - c.pivot[2]);
  out.fov_deg = c.fov;

  // The projection, not the field. A point 10 m in front of and 3 m to the right of the
  // pivot: how far across the frame it lands is a function of the FOV the camera actually
  // built its matrix with.
  const yaw = c.yaw_deg * Math.PI / 180;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = -fz, rz = fx;
  const pt = [c.pivot[0] + fx * 10 + rx * 3, c.pivot[1], c.pivot[2] + fz * 10 + rz * 3];
  const nd = H.projectPoint(pt[0], pt[1], pt[2]);
  out.ndc_x_of_fixed_point = nd.ndc[0];

  // The look curve. A full-deflection right stick for 60 frames; how far the world turned.
  const yaw0 = H.getCameraFrame().camera.yaw_deg;
  for (let i = 0; i < 60; i++) H.queueInputs([{ f: 0, look_stick: [1, 0] }]), H.stepFrames(1);
  let sweep = H.getCameraFrame().camera.yaw_deg - yaw0;
  while (sweep > 180) sweep -= 360; while (sweep < -180) sweep += 360;
  out.yaw_swept_deg = Math.abs(sweep);

  // The death camera — a mode branch the free camera never enters.
  H.setSeed(20260807);
  H.loadState('default');
  H.setRenderRate(0);
  H.setCameraCell('cam-flat-plain');
  H.teleport(0, 0, { y: cell ? cell.ground_y : 0, yaw: 0 });
  H.stepFrames(30);
  H.deathCamera ? H.deathCamera() : H.killPlayer('probe');
  H.stepFrames(120);
  out.death_pitch_deg = H.getCameraFrame().camera.pitch_deg;
  out.death_mode = H.getCameraFrame().camera.mode;
  return out;
}
/* eslint-enable no-undef */

// ---------------------------------------------------------------------------------------
const handle = await launchGame({ ...args, width: 320, height: 240 });
const url = handle.page.url();
await requireMethods(handle, ['setSeed', 'loadState', 'stepFrames', 'queueInputs', 'setRenderRate',
  'teleport', 'getCameraFrame', 'getCameraRig', 'projectPoint', 'setCameraCell', 'deathCamera']);

/**
 * Reload the page so the engine boots from whatever is on disk NOW. `waitUntil: 'load'` is not
 * enough on its own: `window.__HARNESS` is installed before the data fetch resolves, so a probe
 * that only waits for the object calls `loadState()` against a half-loaded engine and gets
 * `data.states is null`. `__HARNESS.ready()` is what `launchGame` itself waits for, and it is
 * what makes a reload equivalent to a fresh launch — which is the whole reason this probe can
 * honour "launch one browser and keep it" while still booting five times.
 */
async function reboot() {
  await handle.page.goto(url, { waitUntil: 'load' });
  await handle.page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version), null, { timeout: 60000 });
  await handle.page.evaluate(() => (typeof window.__HARNESS.ready === 'function' ? window.__HARNESS.ready() : null));
}

const result = {
  schema: 'elder-souls/cam-consume@1', piece: 'W1-06', rule: 'RI-MTH07',
  mode: FALSIFY ? 'falsify (perturbations written to a file the game does not load)' : 'live',
  generated: new Date().toISOString(),
  consumer: 'game/src/sim/camera.js applyCameraRig(), called from Engine.loadState (engine.js)',
  data_file: 'game/data/camera/rig.json',
  baseline: null, trials: [], checks: {},
};

try {
  restore();
  await reboot();
  const baseline = await handle.page.evaluate(measure);
  result.baseline = baseline;
  log(`baseline: pivot ${baseline.pivot_y_above_feet_m.toFixed(3)} m, boom ` +
    `${baseline.arm_len_m.toFixed(3)} m, fov ${baseline.fov_deg}, sweep ` +
    `${baseline.yaw_swept_deg.toFixed(2)} deg, death pitch ${baseline.death_pitch_deg.toFixed(2)}`);

  for (const P of PERTURBATIONS) {
    const wasVal = writeRig(P);
    await reboot();
    // Proof the ENGINE saw the edit, independent of behaviour: applyCameraRig() reports
    // every constant the file moved off the module default.
    const audit = await handle.page.evaluate(() => window.__HARNESS.getCameraRig().rig_from_file);
    const m = await handle.page.evaluate(measure);
    restore();

    const b = baseline[P.observable], p = m[P.observable];
    const problem = P.expect(b, p);
    const held = [];
    for (const h of P.holds) {
      if (!near(m[h], baseline[h], Math.max(1e-6, Math.abs(baseline[h]) * 0.01))) {
        held.push(`${h} ${baseline[h]} -> ${m[h]}`);
      }
    }
    const pass = !problem && held.length === 0;
    result.trials.push({
      id: P.id, path: P.path, from: wasVal, to: P.to, why: P.why,
      observable: P.observable, baseline: b, perturbed: p,
      engine_saw_change: !!(audit && audit.changed || []).length,
      engine_changed_keys: (audit && audit.changed || []).map((c) => c.key),
      pass, problem: problem || null, side_effects: held,
    });
    result.checks[`rig_governs.${P.id}`] = {
      pass, note: problem || (held.length ? `unrelated observable moved: ${held.join('; ')}` : null),
    };
    log(`  ${P.id.padEnd(14)} ${P.observable} ${Number(b).toFixed(4)} -> ${Number(p).toFixed(4)}  ` +
      `${pass ? 'CONSUMED' : 'NOT CONSUMED' + (problem ? ` (${problem})` : '')}`);
  }

  // The file must come back. A probe that leaves a perturbed data file behind poisons every
  // other agent on the box.
  await reboot();
  const after = await handle.page.evaluate(measure);
  const drift = Object.keys(baseline).filter((k) => typeof baseline[k] === 'number'
    && !near(after[k], baseline[k], Math.max(1e-9, Math.abs(baseline[k]) * 1e-6)));
  result.checks.restored = {
    pass: drift.length === 0,
    note: drift.length ? `rig.json did not restore cleanly: ${drift.join(', ')}` : null,
  };
} finally {
  restore();
  await handle.close();
}

const failed = Object.entries(result.checks).filter(([, v]) => !v.pass);
result.summary = { checks: Object.keys(result.checks).length, failed: failed.length,
  failures: failed.map(([k, v]) => `${k}: ${v.note || 'FAIL'}`) };

const dest = args.out ? path.resolve(String(args.out))
  : path.join(REPO_ROOT, 'reports', 'w1-06', FALSIFY ? 'cam-consume-falsify.json' : 'cam-consume.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(result, null, 2) + '\n');

if (args.json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
else {
  log('');
  log(`${result.summary.checks - result.summary.failed}/${result.summary.checks} checks pass  ->  ${dest}`);
  for (const f of result.summary.failures) log(`  FAIL ${f}`);
}

// In --falsify the expected outcome is INVERTED: every perturbation check must fail, because
// the game never read the edit. A falsify run in which anything passed is the probe reporting
// a change that did not happen, and exits non-zero just as loudly as a real failure.
if (FALSIFY) {
  const perturbChecks = Object.entries(result.checks).filter(([k]) => k.startsWith('rig_governs.'));
  const wronglyGreen = perturbChecks.filter(([, v]) => v.pass).map(([k]) => k);
  log(wronglyGreen.length
    ? `FALSIFY BROKEN: ${wronglyGreen.length} check(s) passed with the edit written to a file ` +
      `the game does not load: ${wronglyGreen.join(', ')}`
    : `FALSIFY OK: all ${perturbChecks.length} perturbation checks went red when the edit was ` +
      'not delivered, so this probe detects the absence of consumption.');
  process.exit(wronglyGreen.length ? (EXIT.MEASUREMENT_FAIL) : 0);
}
process.exit(result.summary.failed ? (EXIT.MEASUREMENT_FAIL) : 0);
