#!/usr/bin/env node
// CRITIC-OWNED probe v2: RI-CAM02 §B pitch clamp etc, read from the trace record's
// camera block in one stepFrames() call per run (v1 read camera() per frame and each
// stepFrames(1) forces a render, which made it too slow to finish).
import fs from 'node:fs';
import { launchGame } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';

const OUT = process.argv[2];
const h = await launchGame({});
const page = h.page;
await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, null, { timeout: 60000 });
await page.evaluate(() => window.__HARNESS.ready());
const out = { produced_by: 'critic-owned p4b-camera.mjs; camera.pitch_deg/yaw_deg read from the §5 trace record' };

async function run({ look, frames, lock, move }) {
  return page.evaluate(async (o) => {
    const H = window.__HARNESS;
    H.setSeed(1337); H.loadState('swamp_canopy'); H.teleport(0, 0);
    H.lockOn(null);
    if (o.lock) { const e = H.spawn('inf_trash', 0, 6, { as: 'e0' }); H.lockOn(e); }
    H.stepFrames(24);
    const sc = [];
    for (let f = 0; f < o.frames; f++) {
      const ev = { f };
      if (o.look) ev.look = typeof o.look === 'function' ? o.look(f) : o.look;
      if (o.move) ev.move = o.move(f);
      sc.push(ev);
    }
    H.clearInputs(); H.queueInputs(sc);
    H.traceStart(); H.stepFrames(o.frames); const recs = H.traceStop();
    return recs.map(r => [r.camera.pitch_deg, r.camera.yaw_deg, r.camera.roll_deg, r.camera.fov_deg]);
  }, { look, frames, lock, move: undefined, ...(move ? { move: true } : {}) });
}

for (const lock of [false, true]) {
  for (const dir of ['down', 'up']) {
    const dp = dir === 'down' ? -40 : 40;
    const s = (await run({ look: [0, dp], frames: 400, lock })).map(r => r[0]);
    const sat = dir === 'down' ? Math.min(...s) : Math.max(...s);
    let bounce = 0, creep = 0; const eps = 1e-9;
    for (let i = 1; i < s.length; i++) {
      if (dir === 'down') { if (s[i] > s[i - 1] + eps) bounce++; if (s[i] < sat - eps) creep++; }
      else { if (s[i] < s[i - 1] - eps) bounce++; if (s[i] > sat + eps) creep++; }
    }
    out[`pitch_${lock ? 'locked' : 'unlocked'}_${dir}`] = {
      frames: s.length, saturated_at: sat, p100_abs_pitch: Math.max(...s.map(Math.abs)),
      tail_distinct: [...new Set(s.slice(200))], bounce_frames: bounce, creep_frames: creep,
      first8: s.slice(0, 8),
    };
  }
}

// per-frame look cap: one 400-degree swipe on frame 0 only
out.per_frame_cap = await page.evaluate(async () => {
  const H = window.__HARNESS;
  H.setSeed(1337); H.loadState('swamp_canopy'); H.teleport(0, 0); H.lockOn(null); H.stepFrames(24);
  H.clearInputs(); H.queueInputs([{ f: 0, look: [400, 0] }]);
  H.traceStart(); H.stepFrames(6); const r = H.traceStop();
  const d = (a, b) => { let x = b - a; while (x > 180) x -= 360; while (x < -180) x += 360; return x; };
  const ys = r.map(x => x.camera.yaw_deg);
  const deltas = []; for (let i = 1; i < ys.length; i++) deltas.push(+d(ys[i - 1], ys[i]).toFixed(9));
  return { yaws: ys, deltas };
});

// M3 zero lag: 3 deg on one frame, nothing after
out.zero_lag = await page.evaluate(async () => {
  const H = window.__HARNESS;
  H.setSeed(1337); H.loadState('swamp_canopy'); H.teleport(0, 0); H.lockOn(null); H.stepFrames(24);
  H.clearInputs(); H.queueInputs([{ f: 0, look: [3, 0] }]);
  H.traceStart(); H.stepFrames(14); const r = H.traceStop();
  const d = (a, b) => { let x = b - a; while (x > 180) x -= 360; while (x < -180) x += 360; return x; };
  const ys = r.map(x => x.camera.yaw_deg);
  const deltas = []; for (let i = 1; i < ys.length; i++) deltas.push(+d(ys[i - 1], ys[i]).toFixed(9));
  return { deltas, nonzero_after_first: deltas.slice(1).filter(x => Math.abs(x) > 1e-9).length };
});

// M5 no auto-follow: rotate the movement stick a full circle, camera yaw must not move
out.no_auto_follow = await page.evaluate(async () => {
  const H = window.__HARNESS;
  H.setSeed(1337); H.loadState('swamp_canopy'); H.teleport(0, 0); H.lockOn(null); H.stepFrames(24);
  const sc = [];
  for (let f = 0; f < 720; f++) { const a = (f / 720) * 2 * Math.PI; sc.push({ f, move: [Math.sin(a), Math.cos(a)] }); }
  H.clearInputs(); H.queueInputs(sc);
  H.traceStart(); H.stepFrames(720); const r = H.traceStop();
  const y0 = r[0].camera.yaw_deg;
  let m = 0; for (const x of r) { let d = x.camera.yaw_deg - y0; while (d > 180) d -= 360; while (d < -180) d += 360; m = Math.max(m, Math.abs(d)); }
  return { y0, max_abs_camera_yaw_change_deg: +m.toFixed(6), distinct_yaw: [...new Set(r.map(x => x.camera.yaw_deg))].slice(0, 5) };
});

// RI-CAM06 M4 FOV variance and M5 head-bob over a straight run
out.CAM06 = await page.evaluate(async () => {
  const H = window.__HARNESS;
  H.setSeed(1337); H.loadState('swamp_canopy'); H.teleport(0, 0); H.lockOn(null); H.stepFrames(24);
  const sc = [{ f: 0, move: [0, 1] }];
  for (let f = 0; f < 900; f++) sc.push({ f, hold: undefined });
  H.clearInputs(); H.queueInputs([{ f: 0, move: [0, 1] }, { f: 0, press: ['sprint'] }]);
  H.traceStart(); H.stepFrames(900); const r = H.traceStop();
  const fov = r.map(x => x.camera.fov_deg), roll = r.map(x => x.camera.roll_deg), y = r.map(x => x.camera.pos[1]);
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };
  return {
    frames: r.length, fov_distinct: [...new Set(fov)], fov_range: Math.max(...fov) - Math.min(...fov),
    roll_max_abs: Math.max(...roll.map(Math.abs)), cam_y_distinct: [...new Set(y)].slice(0, 6), cam_y_stdev: +sd(y).toFixed(9),
    shake_nonzero_frames: r.filter(x => x.camera.shake[0] !== 0 || x.camera.shake[1] !== 0).length,
    hitstop_frames: r.filter(x => x.camera.hitstop).length,
    max_speed: Math.max(...r.map(x => Math.hypot(x.player.pos[0], x.player.pos[2]))),
  };
});

fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1).slice(0, 5000));
await h.close();
