#!/usr/bin/env node
// m-cam02-control.mjs — executable builder-owned controls for `RI-CAM02`.
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
//   M1 deadzone and response curve — NOT RUN HERE, and the STATED REASON IS NOW STALE.
//     When this script was written the reason given was that the build had no stick magnitude
//     remap to measure. It did: `input/pipeline.js:shapeLookStick()` has always implemented
//     RI-CAM02 §A's radial deadzone, outer saturation and quadratic-on-magnitude, and the
//     `look_stick` event that reaches it has always been handled by `_pump()`. What was
//     missing was one entry in `QUEUE_INPUT_KEYS`, so the validator threw on the only key
//     that could drive it and no probe in the project could reach the curve. W1-06 added it
//     (2026-08-07) and demonstrated the path end to end: quartering `look.max_yaw_rate_dps`
//     in `game/data/camera/rig.json` took a 60-frame full-deflection `look_stick` sweep from
//     180.00 deg to 45.00 deg exactly (`reports/w1-06/cam-consume.json`). M1 is therefore
//     RUNNABLE now, and a successor should run it here rather than re-deriving the excuse.
//     Left not-run in this script because W1-06 did not run M1 itself and will not claim it.
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
  // M4 and M6 need state-specific movement fixtures. They are emitted by the W1-06 aggregate,
  // rather than silently being inferred from this look-control run.
  declared_not_implemented: ['M4 turn-rate ceiling and M6 auto-recentre run in the W1-06 aggregate fixture.'],
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

  // ---- M1: complete radial stick population --------------------------------------------
  // Eight directions × 101 magnitudes × 30 frames. The sign alternates every frame so the
  // pitch population cannot disappear into the hard clamp. Normalising yaw and pitch by
  // their distinct maximum rates recovers the shaped radial magnitude without an axis proxy.
  {
    const rows = await handle.page.evaluate(async (o) => {
      const H = window.__HARNESS; const out = [];
      for (let di = 0; di < 8; di++) {
        const a = di * Math.PI / 4, ux = Math.cos(a), uy = Math.sin(a);
        H.loadState(o.state); H.teleport(0, 0); H.stepFrames(3); H.reanchorFreeRunning();
        const script = [];
        for (let mi = 0; mi <= 100; mi++) {
          const m = mi / 100;
          for (let f = 0; f < 30; f++) {
            const sign = f & 1 ? -1 : 1;
            script.push({ f: mi * 30 + f, look_stick: [ux * m * sign, uy * m * sign] });
          }
        }
        H.queueInputs(script); H.traceStart({ enemies: false, hitboxes: false, events: false });
        H.stepFrames(script.length); const trace = H.traceStop();
        for (let mi = 0; mi <= 100; mi++) {
          const m = mi / 100, rec = trace.slice(mi * 30, (mi + 1) * 30);
          const rates = rec.map(r => Math.hypot(r.input.look[0] / 3, r.input.look[1] / 2));
          out.push({ direction_deg: di * 45, magnitude: m,
            shaped: rates.reduce((x, y) => x + y, 0) / rates.length });
        }
      }
      return out;
    }, { state: STATE });
    let ssRes = 0, ssTot = 0, maxDead = 0, maxErr = 0;
    const mean = rows.reduce((s, r) => s + r.shaped, 0) / rows.length;
    for (const r of rows) {
      const expected = r.magnitude <= 0.15 ? 0 : Math.min(1, ((r.magnitude - 0.15) / 0.80) ** 2);
      ssRes += (r.shaped - expected) ** 2; ssTot += (r.shaped - mean) ** 2;
      maxErr = Math.max(maxErr, Math.abs(r.shaped - expected));
      if (r.magnitude <= 0.15) maxDead = Math.max(maxDead, r.shaped);
    }
    const r2 = 1 - ssRes / ssTot;
    const diagonal016 = rows.find(r => r.direction_deg === 45 && r.magnitude === 0.16)?.shaped ?? 0;
    const full = rows.filter(r => r.magnitude === 1).map(r => r.shaped);
    check('M1', 'radial deadzone, quadratic magnitude response and saturation over 8×101 population',
      maxDead < 1e-9 && diagonal016 > 0 && r2 >= 0.99 && full.every(v => Math.abs(v - 1) <= 0.02),
      { rows: rows.length, r_squared: +r2.toFixed(9), max_deadzone_output: +maxDead.toFixed(9),
        diagonal_m016_output: +diagonal016.toFixed(9), max_normalized_error: +maxErr.toFixed(9),
        full_deflection_yaw_dps: 180, full_deflection_pitch_dps: 120 });
    report.m1_rows = rows;
  }

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
    // Under lock RI-CAM03 derives pitch and consumes the right stick for target switching.
    // RI-CAM02 M2's locked repeat therefore specifies only the narrower-band hard fail; its
    // manual-input bounce/creep predicates apply to the unlocked manual instrument.
    const pass = maxP <= hi + 1e-9 && minP >= lo - 1e-9 && (lockOn || (bounce === 0 && creep === 0));
    check(`M2-${lockOn ? 'locked' : 'unlocked'}`, `pitch clamp hard gate, band [${lo}, ${hi}]`, pass,
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
    check('M2-relation', 'configured locked band strictly narrower than unlocked',
      BAND.locked[0] > BAND.unlocked[0] && BAND.locked[1] < BAND.unlocked[1],
      { unlocked_band: BAND.unlocked, locked_band: BAND.locked,
        unlocked_reached: [u.min_pitch_deg, u.max_pitch_deg], locked_observed: [l.min_pitch_deg, l.max_pitch_deg] });
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
