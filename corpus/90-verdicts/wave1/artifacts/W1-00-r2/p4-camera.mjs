#!/usr/bin/env node
// CRITIC-OWNED probe: RI-CAM02 §B pitch clamp, per-frame look cap, zero-lag, auto-follow.
import fs from 'node:fs';
import { launchGame } from '/home/user/elder-souls-claude/tools/lib/browser.mjs';

const OUT = process.argv[2];
const h = await launchGame({});
const page = h.page;
await page.waitForFunction(() => window.__HARNESS && window.__HARNESS.ready, null, { timeout: 60000 });
await page.evaluate(() => window.__HARNESS.ready());

const out = { produced_by: 'critic-owned p4-camera.mjs' };

async function pitchRun({ dp, frames, lock }) {
  return page.evaluate(async (o) => {
    const H = window.__HARNESS;
    H.setSeed(1337); H.loadState('swamp_canopy'); H.teleport(0, 0);
    let eid = null;
    if (o.lock) { eid = H.spawn('inf_trash', 0, 6, { as: 'e0' }); H.lockOn(eid); }
    H.stepFrames(24);
    const series = [];
    const script = [];
    for (let f = 0; f < o.frames; f++) script.push({ f, look: [0, o.dp] });
    H.clearInputs(); H.queueInputs(script);
    for (let f = 0; f < o.frames; f++) { H.stepFrames(1); series.push(H.camera().pitch_deg); }
    return { series, lockedOn: eid };
  }, { dp, frames, lock });
}

for (const lock of [false, true]) {
  for (const dir of ['down', 'up']) {
    const dp = dir === 'down' ? -40 : 40;
    const r = await pitchRun({ dp, frames: 400, lock });
    const s = r.series;
    const tail = s.slice(200);
    const sat = dir === 'down' ? Math.min(...s) : Math.max(...s);
    // bounce: a frame that moves back towards zero after saturation was reached
    let bounce = 0, creep = 0;
    const eps = 1e-9;
    for (let i = 1; i < s.length; i++) {
      if (dir === 'down') { if (s[i] > s[i - 1] + eps) bounce++; if (s[i] < sat - eps) creep++; }
      else { if (s[i] < s[i - 1] - eps) bounce++; if (s[i] > sat + eps) creep++; }
    }
    out[`pitch_${lock ? 'locked' : 'unlocked'}_${dir}`] = {
      saturated_at: sat, tail_distinct: [...new Set(tail)],
      p100_abs: Math.max(...s.map(Math.abs)), bounce_frames: bounce, creep_frames: creep,
      first10: s.slice(0, 10), last3: s.slice(-3),
    };
  }
}

// per-frame look cap: one enormous swipe
out.per_frame_cap = await page.evaluate(async () => {
  const H = window.__HARNESS;
  H.setSeed(1337); H.loadState('swamp_canopy'); H.teleport(0, 0); H.lockOn(null); H.stepFrames(24);
  const y0 = H.camera().yaw_deg;
  H.clearInputs(); H.queueInputs([{ f: 0, look: [400, 0] }, { f: 1, look: [0, 0] }, { f: 2, look: [0, 0] }]);
  H.stepFrames(1); const y1 = H.camera().yaw_deg;
  H.stepFrames(1); const y2 = H.camera().yaw_deg;
  H.stepFrames(1); const y3 = H.camera().yaw_deg;
  const d = (a, b) => { let x = b - a; while (x > 180) x -= 360; while (x < -180) x += 360; return x; };
  return { y0, y1, y2, y3, frame1_delta: d(y0, y1), frame2_delta: d(y1, y2), frame3_delta: d(y2, y3) };
});

// M3 zero lag: 3 deg on one frame then nothing
out.zero_lag = await page.evaluate(async () => {
  const H = window.__HARNESS;
  H.setSeed(1337); H.loadState('swamp_canopy'); H.teleport(0, 0); H.lockOn(null); H.stepFrames(24);
  const d = (a, b) => { let x = b - a; while (x > 180) x -= 360; while (x < -180) x += 360; return x; };
  const ys = [H.camera().yaw_deg];
  H.clearInputs(); H.queueInputs([{ f: 0, look: [3, 0] }]);
  for (let i = 0; i < 12; i++) { H.stepFrames(1); ys.push(H.camera().yaw_deg); }
  const deltas = []; for (let i = 1; i < ys.length; i++) deltas.push(+d(ys[i - 1], ys[i]).toFixed(9));
  return { deltas, nonzero_after_frame1: deltas.slice(1).filter(x => Math.abs(x) > 1e-9).length };
});

// M5 no auto-follow: rotate the movement stick through a full circle, camera must not yaw
out.no_auto_follow = await page.evaluate(async () => {
  const H = window.__HARNESS;
  H.setSeed(1337); H.loadState('swamp_canopy'); H.teleport(0, 0); H.lockOn(null); H.stepFrames(24);
  const y0 = H.camera().yaw_deg;
  const script = [];
  for (let f = 0; f < 720; f++) { const a = (f / 720) * 2 * Math.PI; script.push({ f, move: [Math.sin(a), Math.cos(a)] }); }
  H.clearInputs(); H.queueInputs(script);
  let maxAbs = 0;
  for (let f = 0; f < 720; f++) { H.stepFrames(1); const y = H.camera().yaw_deg; let x = y - y0; while (x > 180) x -= 360; while (x < -180) x += 360; maxAbs = Math.max(maxAbs, Math.abs(x)); }
  return { y0, max_abs_camera_yaw_change_deg: +maxAbs.toFixed(6) };
});

fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1).slice(0, 4000));
await h.close();
