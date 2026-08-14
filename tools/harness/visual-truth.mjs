#!/usr/bin/env node
/**
 * visual-truth.mjs — play the shipping path, orbit, and capture SEQUENCES.
 *
 * Written for the 2026-08-14 owner directive §2: "static inspection is not evidence".
 * Every capture here is part of a sequence: an orbit is 24 frames around one subject, a
 * traversal is N frames of the player actually walking. Nothing here takes one still.
 *
 *   node tools/harness/visual-truth.mjs orbit   --out <dir> [--at x,z] [--time 12] [--radius 3.5]
 *   node tools/harness/visual-truth.mjs walk    --out <dir> [--at x,z] [--frames 600]
 *   node tools/harness/visual-truth.mjs tour    --out <dir>
 */
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0];
const args = {};
for (let i = 1; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const k = argv[i].slice(2);
  const v = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : true;
  args[k] = v;
}

const OUT = path.resolve(args.out || 'docs/shots/visual-truth');
fs.mkdirSync(OUT, { recursive: true });

function savePng(dataUrl, file) {
  const b64 = String(dataUrl).replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  return file;
}

export async function boot(extra = {}) {
  const g = await launchGame({
    entry: 'game/index.html',
    width: Number(args.width || 1280),
    height: Number(args.height || 720),
    hardwareGpu: args.hardwareGpu === true || args['hardware-gpu'] === true || process.env.VT_HARDWARE_GPU === '1',
    ...extra,
  });
  await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 90000 });
  await g.h('ready');
  return g;
}

async function shoot(g, file) {
  return savePng(await g.h('screenshot'), path.join(OUT, file));
}

// ---------------------------------------------------------------- orbit
async function orbit(g, tag, opts = {}) {
  const steps = Number(opts.steps || 24);
  const radius = Number(opts.radius ?? args.radius ?? 3.5);
  const eye = Number(opts.eye ?? 1.75);
  const snap = await g.h('snapshot');
  const [px, py, pz] = snap.player.pos;
  const manifest = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const pos = [px + Math.sin(a) * radius, py + eye, pz + Math.cos(a) * radius];
    await g.h('camera', { pos, look: [px, py + 1.0, pz], fov: 50 });
    const deg = Math.round((i / steps) * 360);
    const f = `${tag}-orbit-${String(deg).padStart(3, '0')}.png`;
    await shoot(g, f);
    manifest.push({ deg, file: f, camera_pos: pos, player_pos: [px, py, pz] });
  }
  await g.h('camera', { mode: 'gameplay' });
  return manifest;
}

// ---------------------------------------------------------------- shipping-path look sweep
// The player's own way of rotating the camera: the `look` axis through the input pipeline.
async function lookSweep(g, tag, opts = {}) {
  // `look` is DEGREES PER FRAME and `sim/camera.js` zeroes it after it consumes it, so a
  // scripted turn has to emit an event on EVERY frame. Emitting one event and stepping 12
  // frames turns the camera by one degree, not twelve — which is how a "the camera barely
  // turns" defect can be invented out of a harness mistake. rig.json caps yaw at
  // max_yaw_deg_per_frame = 3, so 120 frames at 3 deg/frame is exactly one full revolution.
  const dps = Number(opts.degPerFrame || 3);
  const frames = Math.round(360 / dps);
  const every = Number(opts.every || 10);
  const manifest = [];
  const script = [];
  for (let f = 0; f <= frames; f++) script.push({ f, look: [dps, 0] });
  await g.h('queueInputs', script);
  for (let done = 0; done < frames; done += every) {
    await g.h('stepFrames', Math.min(every, frames - done));
    const cam = await g.h('camera', {});
    const f = `${tag}-look-${String(done + every).padStart(3, '0')}f.png`;
    await shoot(g, f);
    manifest.push({ frame: done + every, file: f, cam_yaw_deg: cam.yaw_deg, cam_pitch_deg: cam.pitch_deg });
  }
  return manifest;
}

const main = {
  async orbit() {
    const g = await boot();
    if (args.at) { const [x, z] = String(args.at).split(',').map(Number); await g.h('teleport', x, z); }
    if (args.time) await g.h('setTimeOfDay', Number(args.time));
    if (args.weather) await g.h('setWeather', String(args.weather));
    await g.h('stepFrames', 30);
    const tag = String(args.tag || 'player');
    const m = { orbit: await orbit(g, tag), look: await lookSweep(g, tag) };
    fs.writeFileSync(path.join(OUT, `${tag}-manifest.json`), JSON.stringify(m, null, 2));
    console.log(JSON.stringify(m, null, 2));
    await g.close();
  },
};

if (!main[cmd]) { console.error(`usage: orbit | walk | tour (got ${cmd})`); process.exit(2); }
await main[cmd]();
