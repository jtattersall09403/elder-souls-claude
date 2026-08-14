#!/usr/bin/env node
/**
 * vt-world.mjs — the world, seen twice: as the player sees it, and with the haze switched
 * off so the geometry underneath is checkable. Several places, several hours.
 */
import fs from 'node:fs';
import path from 'node:path';
import { launchGame } from '../lib/browser.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  if (!process.argv[i].startsWith('--')) continue;
  const k = process.argv[i].slice(2);
  args[k] = (process.argv[i+1] && !process.argv[i+1].startsWith('--')) ? process.argv[++i] : true;
}
const OUT = path.resolve(args.out || 'docs/shots/2026-08-14-visual-truth/world');
fs.mkdirSync(OUT, { recursive: true });

const HW = process.env.VT_HARDWARE_GPU === '1';
const g = await launchGame({ entry: 'game/index.html', width: 1280, height: 720, hardwareGpu: HW });
await g.page.waitForFunction(() => window.__HARNESS, null, { timeout: 90000 });
await g.h('ready');
const [CW, CH] = String(args.canvas || '960x540').split('x').map(Number);
await setCanvas(g, CW, CH);


async function shot(f) {
  const d = await g.h('screenshot');
  fs.writeFileSync(path.join(OUT, f), Buffer.from(String(d).replace(/^data:image\/png;base64,/,''),'base64'));
}
async function setHaze(on) {
  await g.page.evaluate((enabled) => {
    const sc = window.__ENGINE.renderer.scene;
    if (!sc.fog) return;
    if (!enabled) {
      if (!sc.fog.__pinned) {
        Object.defineProperty(sc.fog, 'density', { get: () => 0, set: () => {}, configurable: true });
        sc.fog.__pinned = true;
      }
    } else if (sc.fog.__pinned) {
      delete sc.fog.density; sc.fog.__pinned = false;
    }
  }, on);
}

const SPOTS = JSON.parse(fs.readFileSync(path.resolve(args.spots || 'tools/harness/vt-spots.json'), 'utf8'));
const HOURS = String(args.hours || '7,12,18,23').split(',').map(Number);
const report = [];
for (const spot of SPOTS) {
  await g.h('teleport', spot.x, spot.z);
  await g.h('stepFrames', 40);
  for (const hr of HOURS) {
    await g.h('setTimeOfDay', hr);
    await g.h('stepFrames', 10);
    const env = await g.h('getEnvConditions');
    const s = await g.h('snapshot');
    // A short in-place look sweep so this is a sequence, not a still.
    for (const yawStep of [0, 1, 2, 3]) {
      if (yawStep) { await g.h('queueInputs', [{ f: 0, look: [1.4, 0] }, { f: 18, look: [0, 0] }]); await g.h('stepFrames', 20); }
      await setHaze(true);
      await shot(`${spot.id}-h${String(hr).padStart(2,'0')}-yaw${yawStep}.png`);
    }
    await setHaze(false);
    await shot(`${spot.id}-h${String(hr).padStart(2,'0')}-nohaze.png`);
    await setHaze(true);
    report.push({ spot: spot.id, hour: hr, env, player_y: s.player.pos[1], region: s.env && s.env.region });
  }
}
fs.writeFileSync(path.join(OUT, 'world-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2).slice(0, 4000));
await g.close();

// Shrink the capture backing store. In harness mode main.js never resizes the canvas, so it
// stays at the 1920x1080 in the HTML and every screenshot() pays a 2 Mpx readPixels. For a
// defect sweep 960x540 is plenty and it is ~4x cheaper, which is the difference between a
// sequence and a still.
async function setCanvas(g, w, h) {
  await g.page.evaluate(({ w, h }) => {
    const c = document.getElementById('view');
    c.width = w; c.height = h;
    const R = window.__ENGINE.renderer;
    if (R.setSize) R.setSize(w, h);
    else if (R.three && R.three.setSize) { R.three.setSize(w, h, false); if (R.camera) { R.camera.aspect = w / h; R.camera.updateProjectionMatrix(); } }
  }, { w, h });
}
