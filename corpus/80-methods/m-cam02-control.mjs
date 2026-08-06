#!/usr/bin/env node
// m-cam02-control.mjs — the executable form of `RI-CAM02`'s M2, M3 and M5.
//
// The W1-00 critic recorded this script as ABSENT and had to build a closest-executable
// variant, which is a method deviation on every future run of the item. It exists now.
//
// What it runs, and what it does not:
//
//   M2 pitch clamp (hard gate, 15 pts) — FULL. Injects look [0,+40] for 600 frames, then
//     [0,-40] for 600, then alternating for 600, unlocked and locked, and samples pitch on
//     EVERY frame. Checks the band, the bounce condition and the creep condition.
//   M3 zero look lag / no smoothing (10 pts) — FULL. Step input, per-frame delta, and the
//     cross-correlation lag between input and response.
//   M5 no auto-follow while walking (the discriminator) — FULL. 720 frames of rotating
//     movement input with zero look input.
//   M1 deadzone and response curve — NOT RUN, and reported as not-run rather than skipped:
//     it measures a stick magnitude remap (`m' = clamp((m-0.15)/0.80,0,1)`, then squared)
//     that this build does not implement. `look` in this build is a per-frame delta in
//     degrees, not a normalised stick magnitude, so there is no curve to fit and a fitted
//     R^2 would be a fabricated measurement. Named in `declared_not_implemented`.
//   M4 turn-rate ceiling / M6 auto-recentre — owned by the movement and camera pieces.
//
// USAGE
//   node corpus/80-methods/m-cam02-control.mjs [--state arena_flat] [--out <dir>]
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOLS = path.resolve(HERE, '../../tools');
const { parseArgs, wantsHelp, usage, log, EXIT, writeJson, RUNS_DIR, ensureDir } = await import(path.join(TOOLS, 'lib/cli.mjs'));
const { launchGame } = await import(path.join(TOOLS, 'lib/browser.mjs'));

const USAGE = `
m-cam02-control.mjs — RI-CAM02 M2 (pitch clamp), M3 (look lag), M5 (no auto-follow).

USAGE
  node corpus/80-methods/m-cam02-control.mjs [--state arena_flat] [--out <dir>] [--json]
`;

const args = parseArgs();
if (wantsHelp(args)) usage(USAGE);
const STATE = String(args.state || 'arena_flat');
const outDir = args.out ? path.resolve(String(args.out)) : path.join(RUNS_DIR, 'CAM02');
ensureDir(outDir);

const BAND = { unlocked: [-55.0, 38.0], locked: [-50.0, 32.0] };

const handle = await launchGame(args);
const report = {
  schema: 'elder-souls/m-cam02@1', item: 'RI-CAM02', state: STATE, band: BAND,
  declared_not_implemented: [
    'M1 deadzone and response curve: this build takes `look` as a per-frame delta in degrees, not a normalised stick magnitude, so RI-CAM02 §A\'s radial deadzone and quadratic magnitude remap have no implementation to measure. Reported not-run, scored 0, rather than fitted to a curve that does not exist.',
    'M4 turn-rate ceiling and M6 auto-recentre: owned by the movement/camera pieces, not by W1-00.',
  ],
  checks: [],
};

/** Run a look script and return the per-frame camera and input series. */
async function lookRun({ script, frames, lockOn }) {
  return handle.page.evaluate(async (o) => {
    const H = window.__HARNESS;
    await H.ready();
    H.setRenderRate(0);
    H.setSeed(1337);
    H.loadState(o.state);
    H.teleport(0, 0);
    if (o.lockOn) { H.spawn('inf_trash', 0, 6, { as: 'lk' }); H.lockOn('lk'); } else { H.lockOn(null); }
    H.stepFrames(30);
    H.reanchorFreeRunning();
    H.queueInputs(o.script);
    H.traceStart({ enemies: false, hitboxes: false, events: false });
    H.stepFrames(o.frames);
    const recs = H.traceStop();
    return recs.map((r) => ({
      f: r.f, pitch: r.camera.pitch_deg, yaw: r.camera.yaw_deg,
      lookIn: r.input.look[1], lookInX: r.input.look[0],
    }));
  }, { ...{ script, frames, lockOn }, state: STATE });
}

function check(id, name, pass, evidence) {
  report.checks.push({ id, name, result: pass ? 'pass' : 'fail', ...evidence });
  log(`${pass ? 'PASS' : 'FAIL'} ${id} — ${name}`);
  for (const [k, v] of Object.entries(evidence)) log(`        ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
  return pass;
}

try {
  await handle.page.waitForFunction(() => !!(window.__HARNESS && window.__HARNESS.version));

  // ---- M2: pitch clamp, unlocked then locked -------------------------------------------
  for (const lockOn of [false, true]) {
    const [lo, hi] = lockOn ? BAND.locked : BAND.unlocked;
    // Every frame carries a look event: `look` is a per-frame delta, so "hold for 600
    // frames" means 600 events, not one. Injecting one event and calling it "held" is how
    // a saturating input turns into a single 40-degree nudge.
    const script = [];
    for (let f = 0; f < 600; f++) script.push({ f, look: [0, 40] });
    for (let f = 600; f < 1200; f++) script.push({ f, look: [0, -40] });
    for (let f = 1200; f < 1800; f++) script.push({ f, look: [0, f % 2 ? 40 : -40] });
    // 60 frames of ZERO look at each pin, to test creep.
    for (let f = 1800; f < 1860; f++) script.push({ f, look: [0, 0] });
    const rec = await lookRun({ script, frames: 1860, lockOn });

    const maxP = Math.max(...rec.map((r) => r.pitch));
    const minP = Math.min(...rec.map((r) => r.pitch));
    let bounce = 0, creep = 0;
    for (let i = 1; i < rec.length; i++) {
      const d = rec[i].pitch - rec[i - 1].pitch;
      const want = -rec[i].lookIn;          // positive look Y pitches DOWN
      if (want !== 0 && d !== 0 && Math.sign(d) !== Math.sign(want)) bounce++;
      if (rec[i].lookIn === 0 && d !== 0) creep++;
    }
    const pinnedLow = rec.filter((r) => Math.abs(r.pitch - lo) < 1e-9).length;
    const pinnedHigh = rec.filter((r) => Math.abs(r.pitch - hi) < 1e-9).length;
    check(`M2-${lockOn ? 'locked' : 'unlocked'}`, `pitch clamp hard gate, band [${lo}, ${hi}]`,
      maxP <= hi + 1e-9 && minP >= lo - 1e-9 && bounce === 0 && creep === 0,
      {
        frames: rec.length, max_pitch_deg: +maxP.toFixed(6), min_pitch_deg: +minP.toFixed(6),
        band: [lo, hi], frames_pinned_at_min: pinnedLow, frames_pinned_at_max: pinnedHigh,
        bounce_frames: bounce, creep_frames: creep,
      });
  }
  // The locked band must be STRICTLY narrower — a relation, not a bound.
  {
    const u = report.checks.find((c) => c.id === 'M2-unlocked');
    const l = report.checks.find((c) => c.id === 'M2-locked');
    check('M2-relation', 'locked band strictly narrower than unlocked',
      l.min_pitch_deg > u.min_pitch_deg && l.max_pitch_deg < u.max_pitch_deg,
      { unlocked_reached: [u.min_pitch_deg, u.max_pitch_deg], locked_reached: [l.min_pitch_deg, l.max_pitch_deg] });
  }

  // ---- M2b: the per-frame look cap (RI-CAM02 §A) ----------------------------------------
  {
    // Frame 0 is a settle frame with zero look: the record for frame f is built AFTER
    // frame f's step, so the swipe must land on frame 1 for `yaw[1] - yaw[0]` to be the
    // response to it. Putting it on frame 0 measures nothing and reads as a pass-by-zero.
    const script = [{ f: 0, look: [0, 0] }, { f: 1, look: [400, 0] }, { f: 2, look: [0, 0] }, { f: 3, look: [0, 0] }];
    const rec = await lookRun({ script, frames: 6, lockOn: false });
    const d1 = ((rec[1].yaw - rec[0].yaw) + 540) % 360 - 180;
    const d2 = ((rec[2].yaw - rec[1].yaw) + 540) % 360 - 180;
    check('M2b', 'per-frame look cap: 400 deg of yaw in one frame is clamped to 30 and the surplus is DISCARDED, not carried',
      Math.abs(Math.abs(d1) - 30) < 1e-6 && Math.abs(d2) < 1e-9,
      { yaw_delta_frame_1: +d1.toFixed(6), yaw_delta_frame_2: +d2.toFixed(9), cap_deg_per_frame: 30 });
  }

  // ---- M3: zero look lag, zero output smoothing -----------------------------------------
  {
    const script = [];
    for (let f = 0; f <= 120; f++) script.push({ f, look: [3.0, 0] });
    for (let f = 121; f <= 240; f++) script.push({ f, look: [0, 0] });
    for (let f = 241; f <= 360; f++) script.push({ f, look: [-3.0, 0] });
    const rec = await lookRun({ script, frames: 380, lockOn: false });
    const dyaw = [];
    for (let i = 1; i < rec.length; i++) dyaw.push(((rec[i].yaw - rec[i - 1].yaw) + 540) % 360 - 180);
    const first = dyaw[0];
    const tail = dyaw.slice(121, 240).filter((d) => Math.abs(d) > 1e-9).length;
    // lag correlation: argmax over lags -3..3
    const inp = rec.map((r) => r.lookInX).slice(1);
    let bestLag = 0, bestCorr = -Infinity;
    for (let lag = -3; lag <= 3; lag++) {
      let s = 0, n = 0;
      for (let i = 0; i < dyaw.length; i++) {
        const j = i - lag;
        if (j < 0 || j >= inp.length) continue;
        s += inp[j] * dyaw[i]; n++;
      }
      const c = n ? s / n : 0;
      if (c > bestCorr) { bestCorr = c; bestLag = lag; }
    }
    check('M3', 'zero look lag, zero output smoothing',
      Math.abs(first - 3.0) < 0.001 && tail === 0 && bestLag === 0,
      { first_frame_delta_deg: +first.toFixed(6), expected: 3.0, nonzero_frames_in_the_still_window: tail, argmax_corr_lag_frames: bestLag });
  }

  // ---- M5: no auto-follow while walking -------------------------------------------------
  {
    const script = [];
    for (let f = 0; f < 720; f++) {
      const a = f * Math.PI / 180;                 // movement bearing rotates 1 deg/frame
      script.push({ f, move: [Math.sin(a), Math.cos(a)], look: [0, 0] });
    }
    const rec = await lookRun({ script, frames: 720, lockOn: false });
    let sum = 0;
    for (let i = 1; i < rec.length; i++) sum += Math.abs(((rec[i].yaw - rec[i - 1].yaw) + 540) % 360 - 180);
    check('M5', 'no auto-follow: 720 frames of rotating movement input with zero look input move the camera yaw by nothing',
      sum <= 0.5, { total_abs_camera_yaw_change_deg: +sum.toFixed(6), bar_deg: 0.5, frames: rec.length });
  }
} finally {
  report.page_errors = handle.errors;
  await handle.close();
}

report.pass = report.checks.every((c) => c.result === 'pass') && report.page_errors.length === 0;
writeJson(path.join(outDir, 'cam02.json'), report);
if (args.json) process.stdout.write(JSON.stringify(report, null, 2) + '\n');
else process.stdout.write(path.join(outDir, 'cam02.json') + '\n');
process.exit(report.pass ? EXIT.OK : EXIT.MEASUREMENT_FAIL);
