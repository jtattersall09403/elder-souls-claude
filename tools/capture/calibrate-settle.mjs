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
    const d = diff(A.px, B.px), fam = metricFamily(A.px, B.px);
    rows.push({ population: 'settled', region: r.id, cond: c.tag, ...d, fam, resid });
    log(`settled  ${r.id} ${c.tag} b24=${fam.b24.toFixed(4)} px=${fam.px.toFixed(4)} queued=${resid.queued}`);
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
    const d = diff(A.px, B.px), fam = metricFamily(A.px, B.px);
    rows.push({ population: 'lighting', region: r.id, cond: 'noon->01:00 no settle', ...d, fam, resid });
    log(`lighting ${r.id} b24=${fam.b24.toFixed(4)} px=${fam.px.toFixed(4)} queued=${resid.queued}`);
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
    const d = diff(A.px, B.px), fam = metricFamily(A.px, B.px);
    rows.push({ population: 'streaming', region: r.id, cond: 'partial-stream', ...d, fam, resid: residA });
    log(`streaming ${r.id} b24=${fam.b24.toFixed(4)} px=${fam.px.toFixed(4)} queued=${residA.queued}`);
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
    const d = diff(A.px, B.px), fam = metricFamily(A.px, B.px);
    const resid = await residency(h, p.x, p.z);
    rows.push({ population: 'absent', region: r.id, cond: 'never-streamed', ...d, fam, resid });
    log(`absent   ${r.id} b24=${fam.b24.toFixed(4)} px=${fam.px.toFixed(4)} queued=${resid.queued}`);
  }
} finally { await h.close(); }

const POPS = ['settled', 'lighting', 'streaming', 'absent'];
const METRICS = ['px', 'b4', 'b8', 'b12', 'b24', 'b48'];
const by = (p, m) => rows.filter((r) => r.population === p).map((r) => r.fam[m]).sort((a, b) => a - b);
const summ = (a) => a.length ? { n: a.length, min: +a[0].toFixed(6), median: +a[Math.floor(a.length / 2)].toFixed(6), max: +a[a.length - 1].toFixed(6) } : { n: 0 };
const table = {};
for (const m of METRICS) {
  table[m] = Object.fromEntries(POPS.map((p) => [p, summ(by(p, m))]));
  // separation: does a threshold exist strictly between the settled max and the min of the
  // populations this gate must catch? (`absent` is G1's job, not G3's, and is excluded.)
  const s = by('settled', m), bad = [...by('lighting', m), ...by('streaming', m)].sort((a, b) => a - b);
  table[m].separated = s.length && bad.length ? s[s.length - 1] < bad[0] : null;
  table[m].band = s.length && bad.length ? [+s[s.length - 1].toFixed(6), +bad[0].toFixed(6)] : null;
}
const out = {
  schema: 'elder-souls/settle-calibration@2',
  measured_at: new Date().toISOString(),
  gap_frames: GAP,
  thumb: [THUMB_W, THUMB_H],
  metric_table: table,
  absent_queued: rows.filter((r) => r.population === 'absent').map((r) => r.resid.queued),
  rows,
};
fs.writeFileSync(path.join(OUT, 'SETTLE-CALIBRATION.json'), JSON.stringify(out, null, 2));
for (const m of METRICS) {
  const t = table[m];
  process.stdout.write(`${m.padEnd(4)} settled<=${String(t.settled.max).padEnd(10)} lighting>=${String(t.lighting.min).padEnd(10)} streaming>=${String(t.streaming.min).padEnd(10)} separated=${t.separated} band=${JSON.stringify(t.band)}\n`);
}
process.stdout.write('absent queued: ' + JSON.stringify(out.absent_queued) + '\n');
