#!/usr/bin/env node
/**
 * calibrate-settle.mjs — pick the settle threshold from measurement, not from taste.
 *
 * S34 says the threshold must be *declared*; the brief adds "do not pick a number that can never
 * fire". So this measures both populations on one boot:
 *
 *   SETTLED    — teleport, stream to completion, pose, step, then two frames `gap` apart.
 *                This is what a good capture looks like. The threshold must sit ABOVE this.
 *   STREAMING  — pose the camera somewhere the player has never been, then let the streamer
 *                build between the two frames. This is what "photographed too early" looks like.
 *                The threshold must sit BELOW this.
 *   ABSENT     — pose the camera somewhere the player has never been and DO NOT stream at all.
 *                The control that proves image-stability alone is not a sufficient gate: nothing
 *                changes between the frames because nothing is there to change.
 *
 * Writes reports/capture/SETTLE-CALIBRATION.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';
import { REPO_ROOT, ensureDir, readJson, log } from '../lib/cli.mjs';
import { THUMB_SOURCE, THUMB_W, THUMB_H, thumbnail, diff, residency, metricFamily } from './settle.mjs';

const GAP = Number(process.env.GAP || 12);
const OUT = path.join(REPO_ROOT, 'reports', 'capture');
ensureDir(OUT);

const regions = readJson(path.join(REPO_ROOT, 'game/data/world/regions.json')).regions;
const h = await launchGame({ width: 1280, height: 720 });
const rows = [];
try {
  await h.page.addInitScript(THUMB_SOURCE);
  await h.page.evaluate(THUMB_SOURCE);
  await h.h('setSeed', 1337);
  await h.h('loadState', 'default');
  await h.hOpt('setUIVisible', false);
  await h.h('setRenderRate', 0);

  let st = 424242;
  const rnd = () => { st ^= st << 13; st >>>= 0; st ^= st >> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; };

  const point = async (r) => {
    const bb = r.bounds_m;
    for (let t = 0; t < 3000; t++) {
      const x = bb.x[0] + rnd() * (bb.x[1] - bb.x[0]), z = bb.z[0] + rnd() * (bb.z[1] - bb.z[0]);
      const g = await h.h('getTerrainAt', x, z);
      if (g.region !== r.id || !g.land || g.slope_deg > 30) continue;
      const w = await h.h('getWaterAt', x, z);
      if (w.depth_m > 0.3) continue;
      return { x, z, y: g.y };
    }
    return null;
  };

  const pose = async (p, yaw) => {
    await h.h('camera', {
      pos: [p.x, p.y + 1.7, p.z],
      look: [p.x + Math.sin(yaw) * 40, p.y + 1.7 - 3.0, p.z + Math.cos(yaw) * 40],
      fov: 70,
    });
  };

  // Three frames A(t), B(t+g), C(t+2g). d1 = |A-B|, d2 = |B-C|, excess = max(0, d1-d2).
  // d2 is the scene's OWN ambient-motion floor measured over the same gap, in the same place,
  // under the same conditions — so `excess` is d1 with the world's liveness subtracted out.
  // d13 = |A-C| IS RECORDED, AND THIS IS THE POINT OF THE R2 PASS.
  //
  // The R1 calibration computed d1 and d2 only. G3c gates on gamma = |A-C| / max(d1, d2) — the
  // sub-gate that catches a STEADY arrival, which decelerates by nothing and accelerates by nothing
  // and is therefore invisible to both of the other two — and there was no observed gamma anywhere
  // in the project's data to bound it with. A and C were already in hand on every row; only the
  // comparison was missing. It costs one more metricFamily() per row and no extra frame.
  const record = (population, region, cond, A, B, C, resid) => {
    const f1 = metricFamily(A.px, B.px), f2 = metricFamily(B.px, C.px), f13 = metricFamily(A.px, C.px);
    const excess = {}, rise = {}, gamma = {};
    for (const k of Object.keys(f1)) {
      if (k.includes('_')) continue;
      excess[k] = Math.max(0, f1[k] - f2[k]);
      rise[k] = Math.max(0, f2[k] - f1[k]);
      const denom = Math.max(f1[k], f2[k]);
      gamma[k] = denom > 0 ? f13[k] / denom : null;   // null, not 1: nothing moved, so the ratio says nothing
    }
    log(`${population.padEnd(9)} ${region.padEnd(18)} d1.b4=${f1.b4.toFixed(4)} d2.b4=${f2.b4.toFixed(4)} ` +
      `d13.b4=${f13.b4.toFixed(4)} excess.b4=${excess.b4.toFixed(4)} rise.b4=${rise.b4.toFixed(4)} ` +
      `gamma.b4=${gamma.b4 === null ? '   -  ' : gamma.b4.toFixed(3)} queued=${resid.queued}`);
    return { population, region, cond, d1: f1, d2: f2, d13: f13, excess, rise, gamma, resid };
  };

  // ---------- population 1: SETTLED (and a weather/night spread, because rain moves) ----------
  const conds = [
    { time: 11.0, weather: 'clear', tag: 'day-clear' },
    { time: 11.0, weather: 'storm', tag: 'day-storm' },
    { time: 1.0, weather: 'clear', tag: 'night-clear' },
    { time: 16.0, weather: 'ashfall', tag: 'day-ashfall' },
  ];
  for (const r of regions) {
    const p = await point(r);
    if (!p) continue;
    const c = conds[rows.length % conds.length];
    await h.h('teleport', p.x, p.z);
    await h.h('streamAround', p.x, p.z);
    await h.h('setTimeOfDay', c.time);
    await h.h('setWeather', c.weather);
    await pose(p, rnd() * Math.PI * 2);
    await h.h('streamAround', p.x, p.z);
    await h.h('stepFrames', 24);
    await h.h('renderFrame');
    const A = await thumbnail(h.page, THUMB_W, THUMB_H);
    const resid = await residency(h, p.x, p.z);
    await h.h('stepFrames', GAP);
    await h.h('renderFrame');
    const B = await thumbnail(h.page, THUMB_W, THUMB_H);
    await h.h('stepFrames', GAP);
    await h.h('renderFrame');
    const C = await thumbnail(h.page, THUMB_W, THUMB_H);
    rows.push(record('settled', r.id, c.tag, A, B, C, resid));
  }

  // ---------- population 1b: LIGHTING NOT YET CONVERGED — what G3 actually exists for ----------
  // Change the time of day (and therefore sun angle, sky LUT, shadows, signature lights) and
  // photograph immediately, with no settle frames at all. Streaming is complete; the *lighting*
  // is not. G1/G2 cannot see this — only image stability can.
  for (const r of regions.slice(0, 5)) {
    const p = await point(r);
    if (!p) continue;
    await h.h('teleport', p.x, p.z);
    await h.h('streamAround', p.x, p.z);
    await h.h('setTimeOfDay', 12.0);
    await h.h('setWeather', 'clear');
    await pose(p, rnd() * Math.PI * 2);
    await h.h('stepFrames', 24);
    await h.h('renderFrame');
    await h.h('setTimeOfDay', 1.0);          // hard swing: noon -> 01:00
    await h.h('setWeather', 'storm');
    await h.h('renderFrame');                // photograph immediately, zero settle frames
    const A = await thumbnail(h.page, THUMB_W, THUMB_H);
    const resid = await residency(h, p.x, p.z);
    await h.h('stepFrames', GAP);
    await h.h('renderFrame');
    const B = await thumbnail(h.page, THUMB_W, THUMB_H);
    await h.h('stepFrames', GAP);
    await h.h('renderFrame');
    const C = await thumbnail(h.page, THUMB_W, THUMB_H);
    rows.push(record('lighting', r.id, 'noon->01:00 no settle', A, B, C, resid));
  }

  // ---------- population 2: STREAMING — the world arriving between the two frames ----------
  // Pose the camera somewhere the player is not, then hand the streamer a small budget so it is
  // still building while the two frames are taken. This is a capture taken too early.
  for (const r of regions.slice(0, 5)) {
    const p = await point(r);
    if (!p) continue;
    // Park the player far away so nothing near the camera is resident.
    const far = await point(regions[(regions.indexOf(r) + 6) % regions.length]);
    if (!far) continue;
    await h.h('teleport', far.x, far.z);
    await h.h('setTimeOfDay', 11.0);
    await h.h('setWeather', 'clear');
    await pose(p, rnd() * Math.PI * 2);
    await h.h('streamAround', p.x, p.z, 2);   // a couple of tiles only: still arriving
    await h.h('stepFrames', 24);
    await h.h('renderFrame');
    const A = await thumbnail(h.page, THUMB_W, THUMB_H);
    const residA = await residency(h, p.x, p.z);
    await h.h('streamAround', p.x, p.z, 40);  // more of it lands between the frames
    await h.h('stepFrames', GAP);
    await h.h('renderFrame');
    const B = await thumbnail(h.page, THUMB_W, THUMB_H);
    await h.h('stepFrames', GAP);
    await h.h('renderFrame');
    const C = await thumbnail(h.page, THUMB_W, THUMB_H);
    rows.push(record('streaming', r.id, 'partial-stream', A, B, C, residA));
  }

  // ---------- population 3: ABSENT — the control that damns image-stability-only ----------
  for (const r of regions.slice(0, 5)) {
    const p = await point(r);
    if (!p) continue;
    const far = await point(regions[(regions.indexOf(r) + 6) % regions.length]);
    if (!far) continue;
    await h.h('teleport', far.x, far.z);
    await h.h('setTimeOfDay', 11.0);
    await h.h('setWeather', 'clear');
    await pose(p, rnd() * Math.PI * 2);
    // deliberately NO streamAround at the camera
    await h.h('stepFrames', 24);
    await h.h('renderFrame');
    const A = await thumbnail(h.page, THUMB_W, THUMB_H);
    await h.h('stepFrames', GAP);
    await h.h('renderFrame');
    const B = await thumbnail(h.page, THUMB_W, THUMB_H);
    await h.h('stepFrames', GAP);
    await h.h('renderFrame');
    const C = await thumbnail(h.page, THUMB_W, THUMB_H);
    const resid = await residency(h, p.x, p.z);
    rows.push(record('absent', r.id, 'never-streamed', A, B, C, resid));
  }
} finally { await h.close(); }

const POPS = ['settled', 'lighting', 'streaming', 'absent'];
const METRICS = ['px', 'b4', 'b8', 'b12', 'b24', 'b48'];
const by = (p, m, field) => rows.filter((r) => r.population === p).map((r) => r[field][m]).sort((a, b) => a - b);
const summ = (a) => a.length ? { n: a.length, min: +a[0].toFixed(6), median: +a[Math.floor(a.length / 2)].toFixed(6), p90: +a[Math.min(a.length - 1, Math.floor(a.length * 0.9))].toFixed(6), max: +a[a.length - 1].toFixed(6) } : { n: 0 };
const table = {};
for (const field of ['d1', 'excess']) {
  table[field] = {};
  for (const m of METRICS) {
    const t = Object.fromEntries(POPS.map((p) => [p, summ(by(p, m, field))]));
    const s0 = by('settled', m, field);
    const bad = by('streaming', m, field);
    t.separated = s0.length && bad.length ? s0[s0.length - 1] < bad[0] : null;
    t.band = s0.length && bad.length ? [+s0[s0.length - 1].toFixed(6), +bad[0].toFixed(6)] : null;
    table[field][m] = t;
  }
}
const out = {
  schema: 'elder-souls/settle-calibration@3',
  measured_at: new Date().toISOString(),
  gap_frames: GAP,
  thumb: [THUMB_W, THUMB_H],
  metric_table: table,
  absent_queued: rows.filter((r) => r.population === 'absent').map((r) => r.resid.queued),
  rows,
};
fs.writeFileSync(path.join(OUT, 'SETTLE-CALIBRATION.json'), JSON.stringify(out, null, 2));
for (const field of ['d1', 'excess']) {
  process.stdout.write('== ' + field + ' ==\n');
  for (const m of METRICS) {
    const t = table[field][m];
    process.stdout.write(`${m.padEnd(4)} settled_max=${String(t.settled.max).padEnd(10)} streaming_min=${String(t.streaming.min).padEnd(10)} streaming_med=${String(t.streaming.median).padEnd(10)} absent_max=${String(t.absent.max).padEnd(10)} separated=${t.separated} band=${JSON.stringify(t.band)}\n`);
  }
}
process.stdout.write('absent queued: ' + JSON.stringify(out.absent_queued) + '\n');
