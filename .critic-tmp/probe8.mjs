// CRITIC-OWNED probe 8: camera items (RI-CAM06 M1/M3/M4/M5, RI-CAM02 M2/M3/M5),
// RI-CMB07 trace-shape conformance, RI-MTH02 R3/R5/R6/R7/R8, integer-step audit (RI-PLT01 M9).
import { launchGame } from '../tools/lib/browser.mjs';
import fs from 'node:fs';
import crypto from 'node:crypto';

const out = process.argv[2];
const handle = await launchGame({});
const page = handle.page;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const report = { schema: 'critic/w1-00-camera@1', at: new Date().toISOString() };

const camRun = async (mode) => page.evaluate(async (m) => {
  const H = window.__HARNESS; await H.ready(); H.setMode('harness');
  H.setSeed(1337); H.loadState('swamp_canopy'); H.clearInputs(); H.setRenderRate(m === 'render' ? 60 : 0);
  H.teleport(0, 0);
  H.queueInputs([{ f: 0, move: [0, 1] }, { f: 300, look: [1.5, 0] }, { f: 600, look: [0, 0] }, { f: 900, move: [0.7, 0.7] }, { f: 1500, hold: ['sprint'], until: 2400 }]);
  H.traceStart({});
  if (m === 'one') { for (let i = 0; i < 2700; i++) H.stepFrames(1); }
  else if (m === 'batch') { for (let i = 0; i < 45; i++) H.stepFrames(60); }
  else { for (let i = 0; i < 2700; i++) { H.stepFrames(1); H.renderFrame(); } }
  const recs = H.traceStop();
  return JSON.stringify(recs.map(r => ({ f: r.f, cam: r.camera, pl: { pos: r.player.pos, yaw: r.player.yaw_deg, mdd: r.player.move_dir_deg, st: r.player.state, anim: r.player.anim, af: r.player.anim_frame }, t: r.t_ms })));
}, mode);

const a = await camRun('one');
const b = await camRun('batch');
const c = await camRun('render');
report.CAM06_M1 = { sha_stepFrames1: sha(a), sha_stepFrames60: sha(b), sha_with_render: sha(c),
  identical_a_b: sha(a) === sha(b), identical_a_c: sha(a) === sha(c), frames: JSON.parse(a).length };

const recs = JSON.parse(a);
// M4 FOV variance
const fovs = recs.map(r => r.cam.fov_deg);
report.CAM06_M4 = { min: Math.min(...fovs), max: Math.max(...fovs), range: Math.max(...fovs) - Math.min(...fovs) };
// M5 head-bob: camera.pos.y residual on straight run + roll
const ys = recs.map(r => r.cam.pos[1]);
const mean = ys.reduce((x, y) => x + y, 0) / ys.length;
const sd = Math.sqrt(ys.reduce((x, y) => x + (y - mean) ** 2, 0) / ys.length);
const rolls = recs.map(r => r.cam.roll_deg);
report.CAM06_M5 = { cam_y_stdev_m: sd, cam_y_min: Math.min(...ys), cam_y_max: Math.max(...ys),
  roll_max_abs: Math.max(...rolls.map(Math.abs)), residual_series_head: ys.slice(0, 60) };
// integer step audit (RI-PLT01 M9)
let badStep = 0, badF = 0;
for (let i = 1; i < recs.length; i++) {
  if (recs[i].f !== recs[i - 1].f + 1) badF++;
  const dt = recs[i].t - recs[i - 1].t;
  if (Math.abs(dt - 1000 / 60) > 0.002) badStep++;
}
report.PLT01_M9 = { frames: recs.length, non_unit_frame_increments: badF, non_16_666_t_deltas: badStep };

// CAM02 M2 pitch clamp + M3 zero look lag + M5 no auto-follow
report.CAM02 = await page.evaluate(async () => {
  const H = window.__HARNESS; const o = {};
  // M2 pitch clamp
  H.setSeed(1337); H.loadState('swamp_canopy'); H.clearInputs(); H.setRenderRate(0); H.teleport(0, 0);
  H.queueInputs([{ f: 0, look: [0, 40] }, { f: 600, look: [0, -40] }, { f: 1200, look: [0, 0] }]);
  H.traceStart({}); H.stepFrames(1200); let r = H.traceStop();
  const p = r.map(x => x.camera.pitch_deg);
  o.M2 = { max_pitch: Math.max(...p), min_pitch: Math.min(...p), bar: '<=38.00 / >=-55.00' };
  // M3 zero look lag
  H.setSeed(1337); H.loadState('swamp_canopy'); H.clearInputs(); H.teleport(0, 0);
  H.queueInputs([{ f: 0, look: [3.0, 0] }, { f: 121, look: [0, 0] }, { f: 241, look: [-3.0, 0] }, { f: 361, look: [0, 0] }]);
  H.traceStart({}); H.stepFrames(400); r = H.traceStop();
  const yaw = r.map(x => x.camera.yaw_deg);
  const d = []; for (let i = 1; i < yaw.length; i++) { let dd = yaw[i] - yaw[i - 1]; if (dd > 180) dd -= 360; if (dd < -180) dd += 360; d.push(dd); }
  o.M3 = { dyaw_frame1: d[0], dyaw_frame2: d[1], tail_122_240_nonzero: d.slice(121, 240).filter(x => Math.abs(x) > 1e-9).length,
    dyaw_241: d[240], dyaw_362_400_nonzero: d.slice(361).filter(x => Math.abs(x) > 1e-9).length };
  // M5 no auto-follow: rotate the movement vector 1 deg/frame for 720 frames, zero look
  H.setSeed(1337); H.loadState('swamp_canopy'); H.clearInputs(); H.teleport(0, 0);
  const script = [];
  for (let f = 0; f < 720; f++) { const th = f * Math.PI / 180; script.push({ f, move: [Math.sin(th), Math.cos(th)] }); }
  H.queueInputs(script);
  H.traceStart({}); H.stepFrames(720); r = H.traceStop();
  const cy = r.map(x => x.camera.yaw_deg);
  let sum = 0; for (let i = 1; i < cy.length; i++) { let dd = cy[i] - cy[i - 1]; if (dd > 180) dd -= 360; if (dd < -180) dd += 360; sum += Math.abs(dd); }
  o.M5 = { sum_abs_dcam_yaw_deg: sum, bar: '<=0.5', player_yaw_start: r[0].player.yaw_deg, player_yaw_end: r[r.length - 1].player.yaw_deg };
  return o;
});

// RI-MTH02 R3 / R5 / R6 / R7 / R8 taken by me
report.MTH02 = await (async () => {
  const o = {};
  const run = (opts) => page.evaluate(async (op) => {
    const H = window.__HARNESS; H.setMode('harness');
    if (op.order === 'seed_first') { H.setSeed(op.seed); H.loadState(op.state); } else { H.loadState(op.state); H.setSeed(op.seed); }
    H.clearInputs();
    if (op.warmup) H.stepFrames(op.warmup);
    H.queueInputs([{ f: 0, move: [0, 1] }, { f: 30, tap: 'light' }, { f: 120, tap: 'roll', hold: 3 }, { f: 300, move: [1, 0] }]);
    H.traceStart({});
    const total = op.frames, chunk = op.chunk || op.frames;
    for (let i = 0; i < total; i += chunk) H.stepFrames(Math.min(chunk, total - i));
    const recs = H.traceStop();
    const f0 = recs[0].f;
    return JSON.stringify(recs.map(r => { const c = JSON.parse(JSON.stringify(r)); c.f = c.f - f0; c.t_ms = null; delete c.rng; return c; }));
  }, opts);
  const base = { state: 'arena_flat', seed: 1337, frames: 1800, warmup: 30, order: 'seed_first' };
  const r1 = await run({ ...base, chunk: 1800 });
  const r2 = await run({ ...base, chunk: 60 });
  const r3 = await run({ ...base, chunk: 1 });
  o.R3_batch = { chunk1800: sha(r1), chunk60: sha(r2), chunk1: sha(r3), all_equal: sha(r1) === sha(r2) && sha(r1) === sha(r3) };
  const w30 = await run({ ...base, warmup: 30 });
  const w90 = await run({ ...base, warmup: 90 });
  o.R5_warmup = { warm30: sha(w30), warm90: sha(w90), equal: sha(w30) === sha(w90) };
  if (sha(w30) !== sha(w90)) {
    const A = JSON.parse(w30), B = JSON.parse(w90);
    const fields = {};
    const flat = (v, p, acc) => { if (v === null || typeof v !== 'object') { acc[p] = v; return acc; } if (Array.isArray(v)) { v.forEach((x, i) => flat(x, `${p}[${i}]`, acc)); return acc; } for (const k of Object.keys(v)) flat(v[k], p ? `${p}.${k}` : k, acc); return acc; };
    let framesDiff = 0;
    for (let i = 0; i < Math.min(A.length, B.length); i++) {
      const fa = flat(A[i], '', {}), fb = flat(B[i], '', {});
      const ks = new Set([...Object.keys(fa), ...Object.keys(fb)].filter(k => JSON.stringify(fa[k]) !== JSON.stringify(fb[k])));
      if (ks.size) framesDiff++;
      for (const k of ks) fields[k] = (fields[k] || 0) + 1;
    }
    o.R5_field_census = { frames_differing: framesDiff, fields };
  }
  const so = await run({ ...base, order: 'seed_first' });
  const os = await run({ ...base, order: 'state_first' });
  o.R6_load_order = { seed_then_state: sha(so), state_then_seed: sha(os), equal: sha(so) === sha(os) };
  return o;
})();
report.page_errors = handle.errors;
await handle.close();

// R7 wall-clock invariance (sleep between chunks) and R8 resolution invariance
{
  const runWith = async (opts, sleepMs) => {
    const h = await launchGame(opts);
    const res = await h.page.evaluate(async () => {
      const H = window.__HARNESS; await H.ready(); H.setMode('harness');
      H.setSeed(1337); H.loadState('arena_flat'); H.clearInputs(); H.stepFrames(30);
      H.queueInputs([{ f: 0, move: [0, 1] }, { f: 30, tap: 'light' }, { f: 120, tap: 'roll', hold: 3 }, { f: 300, move: [1, 0] }]);
      H.traceStart({});
      return true;
    });
    for (let i = 0; i < 6; i++) {
      await h.page.evaluate(() => window.__HARNESS.stepFrames(300));
      if (sleepMs) await new Promise(r => setTimeout(r, sleepMs));
    }
    const s = await h.page.evaluate(() => {
      const recs = window.__HARNESS.traceStop();
      const f0 = recs[0].f;
      return JSON.stringify(recs.map(r => { const c = JSON.parse(JSON.stringify(r)); c.f -= f0; c.t_ms = null; delete c.rng; return c; }));
    });
    await h.close();
    return sha(s);
  };
  const nosleep = await runWith({}, 0);
  const sleep = await runWith({}, 3000);
  const lowres = await runWith({ width: 640, height: 360 }, 0);
  report.MTH02.R7_wallclock = { no_sleep: nosleep, sleep_3s_between_chunks: sleep, equal: nosleep === sleep };
  report.MTH02.R8_resolution = { at_1920x1080: nosleep, at_640x360: lowres, equal: nosleep === lowres };
}

fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log('wrote', out);
